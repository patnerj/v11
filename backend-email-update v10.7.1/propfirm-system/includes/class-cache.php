<?php
/**
 * FXSIM_Cache — Thin cache abstraction layer.
 *
 * Tier hierarchy (automatic, transparent to callers):
 *   1. WordPress Object Cache   — in-memory, sub-millisecond
 *                                 (populated by Redis Object Cache plugin, W3TC, etc.)
 *   2. WordPress Transients     — falls back to wp_options when no object cache plugin
 *   3. Single combined wp_option — last-resort for price data specifically
 *
 * ALL callers use only get()/set()/delete(). The tier selection is internal.
 * Upgrading from transients to Redis requires zero changes in calling code.
 *
 * Future MT5 bridge / SaaS compatibility:
 *   The 'group' parameter maps to a Redis key namespace and to a transient prefix.
 *   Multi-tenant mode can isolate data by passing group='tenant_X'.
 */
defined('ABSPATH') || exit;

class FXSIM_Cache {

    /**
     * Cache group / prefix used for all plugin keys.
     * Matches the WP object cache group parameter — allows selective flushing.
     */
    const GROUP = 'fxsim';

    /**
     * Whether the current WordPress installation has an external object cache
     * plugin active (Redis, Memcached, etc.). Evaluated once per request.
     */
    private static ?bool $has_object_cache = null;

    private static function has_object_cache(): bool {
        if (self::$has_object_cache === null) {
            // wp_using_ext_object_cache() returns true when a drop-in object-cache.php is active
            self::$has_object_cache = function_exists('wp_using_ext_object_cache')
                && wp_using_ext_object_cache();
        }
        return self::$has_object_cache;
    }

    /**
     * Retrieve a cached value.
     *
     * @param string $key   Cache key.
     * @param string $group Optional sub-group (defaults to self::GROUP).
     * @return mixed        Cached value, or false if not found / expired.
     */
    public static function get(string $key, string $group = self::GROUP): mixed {
        if (self::has_object_cache()) {
            // Object cache is fast enough to skip transients entirely
            $val = wp_cache_get($key, $group);
            return ($val !== false) ? $val : false;
        }
        // Fall through to transients (stored in wp_options when no object cache)
        return get_transient(self::transient_key($key, $group));
    }

    /**
     * Store a value in the cache.
     *
     * @param string $key        Cache key.
     * @param mixed  $value      Value to store (must be serialisable).
     * @param int    $ttl        Time-to-live in seconds. 0 = no expiry (object cache only).
     * @param string $group      Optional sub-group.
     */
    public static function set(string $key, mixed $value, int $ttl = 60, string $group = self::GROUP): void {
        if (self::has_object_cache()) {
            wp_cache_set($key, $value, $group, $ttl);
            return;
        }
        // Transients expire automatically; 0 maps to 1 hour to avoid permanent storage
        set_transient(self::transient_key($key, $group), $value, $ttl > 0 ? $ttl : 3600);
    }

    /**
     * Delete a cached value.
     *
     * @param string $key   Cache key.
     * @param string $group Optional sub-group.
     */
    public static function delete(string $key, string $group = self::GROUP): void {
        if (self::has_object_cache()) {
            wp_cache_delete($key, $group);
            return;
        }
        delete_transient(self::transient_key($key, $group));
    }

    /**
     * Increment a numeric value in the cache atomically if supported.
     *
     * @param string $key   Cache key.
     * @param int    $offset Amount to increment.
     * @param string $group Optional sub-group.
     * @return int|false    The new value on success, or false on failure.
     */
    public static function incr(string $key, int $offset = 1, string $group = self::GROUP): int|false {
        if (self::has_object_cache() && function_exists('wp_cache_incr')) {
            return wp_cache_incr($key, $offset, $group);
        }
        // Fallback for transients or object cache lacking incr: read-modify-write (not atomic)
        $t_key = self::transient_key($key, $group);
        if (self::has_object_cache()) {
            $val = wp_cache_get($key, $group);
            if ($val === false) return false;
            $new_val = (int)$val + $offset;
            wp_cache_replace($key, $new_val, $group); // Note: TTL is lost/refreshed depending on object cache backend
            return $new_val;
        } else {
            $val = get_transient($t_key);
            if ($val === false) return false;
            $new_val = (int)$val + $offset;
            set_transient($t_key, $new_val, 3600); // We don't know the exact original TTL, defaulting to 1 hour
            return $new_val;
        }
    }

    /**
     * Build a transient key from group + key.
     * Transient keys are global (no group support) so we prefix manually.
     * Max transient key length in WP is 172 chars; we keep well under that.
     *
     * @param string $key   Cache key.
     * @param string $group Group prefix.
     * @return string       Transient key string.
     */
    private static function transient_key(string $key, string $group): string {
        // Sanitise to alphanumeric + underscore + hyphen — safe for option_name column
        $safe_group = preg_replace('/[^a-z0-9_\-]/', '_', strtolower($group));
        $safe_key   = preg_replace('/[^a-z0-9_\-]/', '_', strtolower($key));
        return substr("{$safe_group}_{$safe_key}", 0, 172);
    }
}
