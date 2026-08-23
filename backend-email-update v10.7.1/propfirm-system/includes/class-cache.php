<?php
/**
 * FXSIM_Cache — Thin cache abstraction layer.
 *
 * Tier hierarchy (automatic, transparent to callers):
 *   1. WordPress Object Cache   — in-memory, sub-millisecond
 *                                 (populated by Redis Object Cache plugin, W3TC, etc.)
 *   2. Plugin-managed Redis     — FXSIM_Redis_Client (central store on multi-server
 *                                 setups; atomic INCR for the rate limiter even when
 *                                 no WP object-cache drop-in is installed)
 *   3. WordPress Transients     — falls back to wp_options when neither is present
 *   4. Single combined wp_option — last-resort for price data specifically
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
        // Tier 2: plugin-managed Redis (central across web nodes).
        if (!self::has_object_cache() && FXSIM_Redis_Client::available()) {
            $raw = FXSIM_Redis_Client::get(self::redis_key($key, $group));
            if ($raw !== null) {
                return self::redis_decode($raw);
            }
            // Redis miss → fall through to transients so pre-migration data stays visible.
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
        // Tier 2: plugin-managed Redis. Values >64KB stay on transients — Redis
        // here is a HOT cache, not a blob store; big payloads belong in MySQL.
        if (FXSIM_Redis_Client::available()) {
            $encoded = self::redis_encode($value);
            if ($encoded !== null && strlen($encoded) <= 65536) {
                FXSIM_Redis_Client::set(self::redis_key($key, $group), $encoded, $ttl > 0 ? $ttl : 3600);
                return;
            }
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
        // Keep both tiers coherent: clear Redis AND the transient twin.
        if (FXSIM_Redis_Client::available()) {
            FXSIM_Redis_Client::del(self::redis_key($key, $group));
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
        // Tier 2: Redis INCRBY is truly atomic across all web nodes — this is
        // the path that makes the rate limiter correct on multi-server setups.
        if (!self::has_object_cache() && FXSIM_Redis_Client::available()) {
            $rk = self::redis_key($key, $group);
            if (FXSIM_Redis_Client::exists($rk) === false) {
                // Key absent: create it so the caller's window/TTL semantics hold.
                FXSIM_Redis_Client::set($rk, '0', 3600);
            }
            $new = FXSIM_Redis_Client::incrby($rk, $offset);
            if ($new !== null) return $new;
            // Transport hiccup → fall through to the non-atomic local fallback.
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

    // ── Redis tier helpers ────────────────────────────────────────────────────

    /** Namespaced Redis key: fxsim:cache:<group>:<key>. */
    private static function redis_key(string $key, string $group): string {
        return "cache:{$group}:{$key}";
    }

    /**
     * Serialise a value for Redis transport. Strings/ints/floats travel raw
     * (fast path); everything else goes through serialize() with a marker.
     * @return string|null null = unserialisable value, caller should use transients.
     */
    private static function redis_encode(mixed $value): ?string {
        if (is_string($value) && !preg_match('/^R[SD]:/', $value)) return $value;
        if (is_int($value) || is_float($value))  return (string) $value;
        if (is_bool($value))                     return $value ? 'RB:1' : 'RB:0';
        try {
            return 'RS:' . serialize($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /** Inverse of redis_encode(). Unknown formats pass through as strings. */
    private static function redis_decode(string $raw): mixed {
        if ($raw === 'RB:0') return false;
        if ($raw === 'RB:1') return true;
        if (str_starts_with($raw, 'RS:')) {
            try {
                return unserialize(substr($raw, 3), ['allowed_classes' => false]);
            } catch (\Throwable) {
                return false;
            }
        }
        if (is_numeric($raw)) return $raw + 0;
        return $raw;
    }
}
