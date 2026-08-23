<?php
/**
 * FXSIM_Redis_Client — Minimal dependency-free Redis client (RESP2).
 *
 * Purpose:
 *   Gives the plugin a direct Redis transport WITHOUT requiring the phpredis
 *   extension or the Predis Composer package (this plugin is deliberately
 *   dependency-free). Implements just enough of the RESP2 wire protocol for
 *   the hot paths that benefit from a central store on multi-server setups:
 *
 *     - Atomic INCR counters        (rate limiter, usage counters)
 *     - Short-TTL hot values        (price feed runtime, feed health)
 *     - Distributed locks           (SET NX PX + token, see FXSIM_Distributed_Lock)
 *
 * Design rules:
 *   1. FAIL SOFT. If Redis is unreachable/misconfigured every method returns
 *      null/false and the caller's existing fallback path (MySQL/transients)
 *      keeps working. A dead Redis must never take trading down.
 *   2. ONE connection per request (lazy). Reconnects once if the socket dies
 *      mid-request; after a second failure it marks itself unavailable.
 *   3. All keys are prefixed with self::PREFIX ('fxsim:') so a shared Redis
 *      instance can host multiple apps without key collisions.
 *
 * Configuration (first match wins):
 *   wp-config.php constants:  FXSIM_REDIS_HOST / FXSIM_REDIS_PORT /
 *                             FXSIM_REDIS_PASSWORD / FXSIM_REDIS_DB / FXSIM_REDIS_ENABLED
 *   Admin options:            fxsim_redis_host / fxsim_redis_port /
 *                             fxsim_redis_password / fxsim_redis_enabled
 *   Defaults:                 127.0.0.1:6379, no auth, db 0, enabled=auto-detect
 *
 * Supported commands (subset, intentionally):
 *   PING, GET, SET(EXT|PX|NX combos), SETEX, DEL, EXISTS, INCRBY, TTL,
 *   EXPIRE, EVAL (used for the atomic compare-and-delete release script),
 *   SELECT, AUTH.
 */

defined('ABSPATH') || exit;

class FXSIM_Redis_Client {

    /** Namespace prefix applied to every key (multi-app safety on shared instances). */
    const PREFIX = 'fxsim:';

    /** Sentinel returned by cmd() for a RESP nil reply ($-1) — lets SET-NX
     *  callers tell "key existed" apart from "transport died". Never leak it
     *  past the public wrappers. */
    private const NIL = "\x00__REDIS_NIL__";

    /** Connect/auth/read timeouts in seconds. Kept tiny — Redis should be LAN-local. */
    const CONNECT_TIMEOUT = 1.0;
    const IO_TIMEOUT      = 1.5;

    /** @var array|null Resolved config cache (host/port/pass/db). */
    private static ?array $config = null;

    /** @var resource|null The live socket connection (lazy). */
    private static $sock = null;

    /** @var bool True once we decide Redis is unavailable for this request (fail soft). */
    private static bool $unavailable = false;

    /** @var bool Whether the connection was ever established (used by health checks). */
    private static bool $ever_connected = false;

    // ────────────────────────────────────────────────────────────────────────
    // CONFIGURATION
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Resolve configuration once per request.
     * Constants win over options so ops can pin prod settings in wp-config.php.
     */
    private static function config(): array {
        if (self::$config !== null) return self::$config;

        $host = defined('FXSIM_REDIS_HOST') ? FXSIM_REDIS_HOST : (string) get_option('fxsim_redis_host', '127.0.0.1');
        $port = defined('FXSIM_REDIS_PORT') ? (int) FXSIM_REDIS_PORT : (int) get_option('fxsim_redis_port', 6379);
        $pass = defined('FXSIM_REDIS_PASSWORD') ? (string) FXSIM_REDIS_PASSWORD : (string) get_option('fxsim_redis_password', '');
        $db   = defined('FXSIM_REDIS_DB') ? (int) FXSIM_REDIS_DB : (int) get_option('fxsim_redis_db', 0);

        // Explicit enable/disable switch. Default: enabled (fail-soft makes it harmless).
        if (defined('FXSIM_REDIS_ENABLED')) {
            $enabled = (bool) constant('FXSIM_REDIS_ENABLED');
        } else {
            $opt = get_option('fxsim_redis_enabled', null);
            $enabled = ($opt === null) ? true : (bool) $opt;
        }

        self::$config = [
            'enabled'  => $enabled,
            'host'     => $host !== '' ? $host : '127.0.0.1',
            'port'     => $port > 0 ? $port : 6379,
            'password' => $pass,
            'db'       => $db,
        ];
        return self::$config;
    }

    /** Public health probe used by admin status cards. */
    public static function available(): bool {
        if (!self::config()['enabled']) return false;
        if (self::$unavailable) return false;
        return self::ping() === 'PONG'; // cmd() strips the '+' status prefix
    }

    /** Was a working connection ever made this request? */
    public static function ever_connected(): bool {
        return self::$ever_connected;
    }

    // ────────────────────────────────────────────────────────────────────────
    // PUBLIC COMMAND API
    // ────────────────────────────────────────────────────────────────────────

    public static function ping(): ?string {
        return self::cmd('PING');
    }

    public static function get(string $key): ?string {
        $r = self::cmd('GET', self::k($key));
        return ($r === self::NIL || $r === null) ? null : (string) $r;
    }

    /**
     * SET with optional flags.
     * @param int $ttl_seconds >0 adds EX.
     * @param bool $nx Only set if NOT exists (lock acquisition primitive).
     * @return bool|null true=written, false=NX miss (key existed),
     *                   null=transport failure (caller should use fallback).
     */
    public static function set(string $key, string $value, int $ttl_seconds = 0, bool $nx = false): ?bool {
        $args = [self::k($key), $value];
        if ($ttl_seconds > 0) { $args[] = 'EX'; $args[] = (string) max(1, $ttl_seconds); }
        if ($nx)              { $args[] = 'NX'; }

        $resp = self::cmd('SET', ...$args);
        if ($resp === self::NIL || $resp === null || $resp === false) {
            // NX miss (nil reply) or server error → not acquired.
            return ($resp === self::NIL) ? false : null;
        }
        return ($resp === 'OK' || str_starts_with((string)$resp, 'OK'));
    }

    /** Legacy convenience wrapper. */
    public static function setex(string $key, int $ttl_seconds, string $value): ?bool {
        return self::set($key, $value, $ttl_seconds);
    }

    public static function del(string ...$keys): ?int {
        $prefixed = array_map([self::class, 'k'], $keys);
        return self::int('DEL', ...$prefixed);
    }

    public static function exists(string $key): ?bool {
        $n = self::int('EXISTS', self::k($key));
        return $n === null ? null : $n > 0;
    }

    /** Atomic increment. Creates the key at 0 if missing (Redis semantics). */
    public static function incrby(string $key, int $by = 1): ?int {
        return self::int('INCRBY', self::k($key), (string) $by);
    }

    public static function ttl(string $key): ?int {
        return self::int('TTL', self::k($key));
    }

    public static function expire(string $key, int $seconds): ?bool {
        $n = self::int('EXPIRE', self::k($key), (string) max(1, $seconds));
        return $n === null ? null : $n === 1;
    }

    /**
     * Atomic compare-and-delete — THE safe lock release primitive.
     * Deletes $key only if its value equals $token. Runs as a Lua script so
     * check+delete is one atomic step (no TOCTOU between GET and DEL).
     * Returns true when the lock was released by THIS caller.
     */
    public static function cas_delete(string $key, string $token): ?bool {
        $script = <<<LUA
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
LUA;
        $n = self::eval_int($script, [self::k($key)], [$token]);
        return $n === null ? null : $n === 1;
    }

    // ────────────────────────────────────────────────────────────────────────
    // TRANSPORT
    // ────────────────────────────────────────────────────────────────────────

    /** Prefix + sanitise a caller key into the namespaced Redis key. */
    private static function k(string $key): string {
        return self::PREFIX . preg_replace('/[^A-Za-z0-9_\-.:]/', '_', $key);
    }

    /** Send a command expecting an integer reply (nil-safe). */
    private static function int(string $cmd, string ...$args): ?int {
        $resp = self::cmd($cmd, ...$args);
        if ($resp === null || !is_numeric($resp)) return null;
        return (int) $resp;
    }

    /** EVAL returning an integer (script, keys[], args[]). */
    private static function eval_int(string $lua, array $keys, array $argv): ?int {
        $resp = self::cmd('EVAL', $lua, (string) count($keys), ...$keys, ...$argv);
        if ($resp === null || !is_numeric($resp)) return null;
        return (int) $resp;
    }

    /**
     * Core command runner.
     * Returns:
     *   'OK'              simple status strings (leading '+' stripped)
     *   string            bulk string payload
     *   numeric string    integer replies (':' prefix stripped)
     *   self::NIL         RESP nil reply ($-1) — "key not found" / NX miss
     *   null|false        transport failure (callers fail soft / use fallback)
     */
    private static function cmd(string $cmd, string ...$args): ?string {
        $cfg = self::config();
        if (!$cfg['enabled'] || self::$unavailable) return null;

        $sock = self::socket();
        if ($sock === null) return null;

        $attempts = 2; // one retry after a single reconnect
        while ($attempts-- > 0) {
            try {
                self::write_command($sock, $cmd, $args);
                $reply = self::read_reply($sock);

                // Broken pipe mid-write/read: one transparent reconnect retry.
                if ($reply === false) {
                    self::close_socket();
                    $sock = self::socket();
                    if ($sock === null) return null;
                    continue;
                }
                return $reply;
            } catch (\Throwable $e) {
                self::close_socket();
                break;
            }
        }
        return null;
    }

    /**
     * Lazy socket factory.
     * @return resource|null
     */
    private static function socket() {
        if (self::$sock !== null) return self::$sock;
        if (self::$unavailable)   return null;

        $cfg = self::config();

        $errno = 0; $errstr = '';
        $sock = @stream_socket_client(
            sprintf('tcp://%s:%d', $cfg['host'], $cfg['port']),
            $errno, $errstr,
            self::CONNECT_TIMEOUT
        );
        if (!$sock) {
            // Fail soft for the remainder of this request. One quiet log line.
            self::$unavailable = true;
            error_log(sprintf('[PropFirm] Redis unavailable (%s:%d): %s — falling back to local backend.',
                $cfg['host'], $cfg['port'], $errstr ?: "errno {$errno}"));
            return null;
        }
        self::$ever_connected = true;
        stream_set_timeout($sock, (int) self::IO_TIMEOUT, (int) ((self::IO_TIMEOUT - (int) self::IO_TIMEOUT) * 1e6));

        if ($cfg['password'] !== '') {
            self::write_command($sock, 'AUTH', [$cfg['password']]);
            $r = self::read_reply($sock);
            if ($r === false || $r === null) { self::close_socket(); self::$unavailable = true; return null; }
        }
        if ($cfg['db'] > 0) {
            self::write_command($sock, 'SELECT', [(string) $cfg['db']]);
            $r = self::read_reply($sock);
            if ($r === false || $r === null) { self::close_socket(); self::$unavailable = true; return null; }
        }

        self::$sock = $sock;
        return $sock;
    }

    /** RESP2 serializer: *<argc>\r\n $<len>\r\n <arg>\r\n … */
    private static function write_command($sock, string $cmd, array $args): void {
        $argc = count($args) + 1;
        // NOTE: built by concatenation on purpose — "\${...}" would escape the
        // dollar sign and emit a literal '${len}' header (protocol error).
        $out  = '*'.$argc."\r\n".'$'.strlen($cmd)."\r\n".$cmd."\r\n";
        foreach ($args as $a) {
            $a = (string) $a;
            $out .= '$' . strlen($a) . "\r\n" . $a . "\r\n";
        }
        fwrite($sock, $out);
    }

    /**
     * RESP2 reply reader.
     * @return string|int|null|false  false = transport error, null = nil reply
     */
    private static function read_reply($sock) {
        $line = fgets($sock);
        if ($line === false || $line === '') return false;
        $type = $line[0];
        $data = substr(rtrim($line, "\r\n"), 1);

        switch ($type) {
            case '+': return $data;                    // simple status
            case '-': error_log("[PropFirm] Redis error reply: {$data}");
                      return null;                     // server-side error → treat as miss
            case ':': return $data;                    // integer (returned as numeric string)
            case '$':                                  // bulk string
                $len = (int) $data;
                if ($len === -1) return self::NIL;     // nil (distinct from transport error)
                if ($len === 0)  { fread($sock, 2); return ''; }
                $payload = $len > 0 ? fread($sock, $len) : '';
                fread($sock, 2);                       // trailing CRLF
                return ($payload === false) ? false : $payload;
            case '*': return null;                     // multi-bulk: not needed by this subset
            default:  return false;                    // protocol violation
        }
    }

    private static function close_socket(): void {
        if (self::$sock !== null && is_resource(self::$sock)) {
            @fclose(self::$sock);
        }
        self::$sock = null;
    }

    /** Test hook: reset all static state (unit tests / long-running workers). */
    public static function reset(): void {
        self::close_socket();
        self::$unavailable     = false;
        self::$ever_connected  = false;
        self::$config          = null;
    }
}
