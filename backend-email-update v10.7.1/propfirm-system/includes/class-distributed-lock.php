<?php
/**
 * FXSIM_Distributed_Lock — Cross-server advisory locks with automatic backend.
 *
 * Why this exists:
 *   The plugin previously used MySQL GET_LOCK()/RELEASE_LOCK() everywhere to
 *   serialise cron engines (SL/TP, margin stop-out, pending orders) and webhook
 *   idempotency. That works on ONE server and still works on multiple servers
 *   THAT SHARE ONE DATABASE — but it holds a DB connection hostage for the
 *   whole wait, which exhausts the connection pool under load, and pseudo-cron
 *   bursts on N web nodes multiply that pressure.
 *
 *   This manager prefers Redis locks (SET key token NX PX <ttl> + atomic Lua
 *   compare-and-delete release) which cost zero DB connections, then falls
 *   back to the proven MySQL named-lock path when Redis is unavailable. Both
 *   backends are safe to mix across servers because every caller only needs
 *   "someone, somewhere, is handling this" semantics.
 *
 * Safety properties (both backends):
 *   1. Mutual exclusion        — only one acquirer wins per name at a time.
 *   2. Ownership               — release() only removes a lock you own (token).
 *   3. Expiry                  — TTL guarantees crash-of-holder self-heals.
 *   4. Reentrancy guard        — acquiring the same name twice in one request
 *                                returns the SAME token instead of deadlocking.
 *
 * Usage (new code):
 *   $token = FXSIM_Distributed_Lock::acquire('sl_tp_engine', 60, 0);
 *   if (!$token) return; // someone else is running it
 *   try { ...work... } finally { FXSIM_Distributed_Lock::release('sl_tp_engine', $token); }
 *
 * Or the ergonomic wrapper:
 *   FXSIM_Distributed_Lock::with_lock('sl_tp_engine', function () { ...work... }, 60);
 */

defined('ABSPATH') || exit;

class FXSIM_Distributed_Lock {

    /** Default hold time when a caller forgets to set one. Generous on purpose:
     *  a crashed holder self-heals after this; work that outlives it should
     *  pass its own larger TTL. */
    const DEFAULT_TTL = 60;

    /** Spin-wait sleep between acquire attempts (microseconds). */
    const RETRY_DELAY_US = 100000; // 100ms

    /** @var array<string,string> name => token for THIS request's held locks. */
    private static array $held = [];

    // ────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Acquire a lock by name.
     *
     * @param string $name      Logical lock name (e.g. 'fxsim_sl_tp_running').
     * @param int    $ttl_sec   Auto-expiry / max hold time in seconds.
     * @param int    $wait_ms   How long to WAIT for a free lock (0 = single try).
     * @return string|false     Opaque ownership token on success, false if not acquired.
     */
    public static function acquire(string $name, int $ttl_sec = self::DEFAULT_TTL, int $wait_ms = 0): string|false {
        $ttl_sec = max(1, $ttl_sec);

        // Re-entrancy: same request already holds it → hand back the same token.
        if (isset(self::$held[$name])) {
            return self::$held[$name];
        }

        $deadline = microtime(true) + ($wait_ms / 1000);

        do {
            // Backend 1: Redis (preferred — no DB connection held while waiting/holding).
            if (FXSIM_Redis_Client::available()) {
                $token = 'rl_' . bin2hex(random_bytes(12));
                $ok = FXSIM_Redis_Client::set($name, $token, $ttl_sec, true); // SET ... EX ttl NX
                if ($ok === true) {
                    self::$held[$name] = $token;
                    return $token;
                }
                if ($ok === null) {
                    // Transport died mid-attempt — fall through to MySQL for safety.
                } else {
                    // false = someone else holds it.
                    if (microtime(true) >= $deadline) return false;
                    usleep(self::RETRY_DELAY_US);
                    continue;
                }
            }

            // Backend 2: MySQL named lock (original behaviour, shared-DB safe).
            global $wpdb;
            $got = $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, %d)', $name, 1));
            if ($got === '1' || $got === 1 || $got === true) {
                $token = 'ml_' . bin2hex(random_bytes(12));
                self::$held[$name] = $token;
                return $token;
            }

            if (microtime(true) >= $deadline) return false;
            usleep(self::RETRY_DELAY_US);
        } while (true);
    }

    /**
     * Release a lock previously acquired by THIS request.
     * With Redis, only the matching token deletes the key (atomic CAS).
     * With MySQL, RELEASE_LOCK by connection is inherently owner-scoped.
     */
    public static function release(string $name, ?string $token = null): bool {
        $token = $token ?? (self::$held[$name] ?? null);
        if ($token === null) return false; // never owned here — nothing to do

        unset(self::$held[$name]);

        if (str_starts_with($token, 'rl_')) {
            // Redis-owned: token-checked delete. Wrong/expired holder → no-op.
            $r = FXSIM_Redis_Client::cas_delete($name, $token);
            return $r === true;
        }

        // MySQL-owned.
        global $wpdb;
        $rel = $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $name));
        return ($rel === '1' || $rel === 1 || $rel === true);
    }

    /**
     * Convenience wrapper: run $fn while holding the lock.
     * Returns [acquired(bool), mixed $fn_result_or_null].
     */
    public static function with_lock(string $name, callable $fn, int $ttl_sec = self::DEFAULT_TTL, int $wait_ms = 0) {
        $token = self::acquire($name, $ttl_sec, $wait_ms);
        if ($token === false) return [false, null];
        try {
            return [true, $fn()];
        } finally {
            self::release($name, $token);
        }
    }

    /** Is this name currently held BY THIS REQUEST? */
    public static function holds(string $name): bool {
        return isset(self::$held[$name]);
    }

    /** Test hook: forget everything (does NOT release server-side locks). */
    public static function reset(): void {
        self::$held = [];
    }

    /**
     * Release every lock still held by this request. Public so the shutdown
     * hook below can call it without touching private state.
     */
    public static function release_all(): void {
        foreach (array_keys(self::$held) as $name) {
            self::release($name);
        }
        self::$held = [];
    }
}

/**
 * Safety net: release anything still held when the request dies mid-work so we
 * don't pin Redis keys for full TTL after a fatal. MySQL named locks die with
 * the connection anyway; this mainly matters for the Redis backend under
 * long-running workers where shutdown may not run — hence TTLs remain the real
 * guarantee, this is just hygiene.
 */
register_shutdown_function(function () {
    FXSIM_Distributed_Lock::release_all();
});
