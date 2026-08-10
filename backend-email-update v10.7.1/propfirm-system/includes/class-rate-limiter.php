<?php
/**
 * FXSIM_Rate_Limiter — REST API rate limiting.
 *
 * Architecture:
 *   Hooked into 'rest_pre_dispatch' — fires before any REST handler.
 *   Returns a WP_Error (HTTP 429) to short-circuit the request when the
 *   limit is exceeded. Returns null to let normal processing continue.
 *
 * Storage:
 *   WordPress transients (FXSIM_Cache) — one transient per {tier, identity}.
 *   Each transient holds a single integer (request count in current window).
 *   TTL = window size (60 seconds). On window expiry the count resets automatically.
 *
 * Cost:
 *   1 cache read + 1 cache write per request (when not blocked).
 *   1 cache read only (when blocked — write skipped).
 *   With Redis object cache: sub-millisecond. Without: 2 DB ops.
 *
 * Identity:
 *   Authenticated routes: WordPress user_id (stable, unforgeable).
 *   Public routes:        MD5 of REMOTE_ADDR (cheapest safe hash, not stored).
 *
 * Tiers (endpoint classes with independent limits):
 *
 *   trading_write  POST /open, /close, /partial-close, /sltp,
 *                  POST /pending-order/place, POST /pending-order/{id}/cancel
 *                  Default: 20 req/min — prevents order spam
 *
 *   trading_read   GET  /account, /positions, /history, /transactions,
 *                  GET  /stats, /symbols, /pending-order/my
 *                  Default: 60 req/min — allows normal 8s/15s polling
 *
 *   auth_write     POST /payment/create, /payment/submit-proof,
 *                  POST /challenge/start, /challenge/{id}/payout
 *                  Default: 10 req/min — infrequent legitimate use
 *
 *   stream         GET  /stream (SSE)
 *                  Default: 5 req/min — reconnects should be rare
 *
 *   public         GET  /prices, /challenge/plans, /stats/leaderboard (unauthenticated)
 *                  Default: 30 req/min per IP
 *
 *   admin          /admin/* routes
 *                  Bypass: always exempt (already require manage_options)
 *
 * Configuration:
 *   All limits are WP options (fxsim_rl_{tier}_limit) — changeable via admin
 *   or wp-config.php without code changes. Set to 0 to disable a tier.
 *
 * Future / SaaS compatibility:
 *   Per-tenant limits can be added by passing tenant_id as part of the
 *   identity key. The tier→limit mapping can be made per-plan.
 */
defined('ABSPATH') || exit;

class FXSIM_Rate_Limiter {

    /**
     * Tier definitions: slug → [route_patterns, default_limit]
     * Route patterns are simple prefix/contains checks — no regex needed.
     */
    private const TIERS = [
        // High-risk write operations
        'trading_write' => [
            'patterns' => ['/open', '/close/', '/partial-close/', '/sltp/', '/pending-order/'],
            'methods'  => ['POST'],
            'default'  => 20,
        ],
        // Read-heavy polling endpoints
        'trading_read'  => [
            'patterns' => ['/account', '/positions', '/history', '/transactions', '/stats', '/symbols', '/pending-order/my'],
            'methods'  => ['GET'],
            'default'  => 240,
        ],
        // Infrequent high-value writes
        'auth_write'    => [
            'patterns' => ['/payment/', '/challenge/start', '/challenge/', '/payout'],
            'methods'  => ['POST'],
            'default'  => 10,
        ],
        // SSE stream connections
        'stream'        => [
            'patterns' => ['/stream'],
            'methods'  => ['GET'],
            'default'  => 60,
        ],
        // Public endpoints (IP-based)
        'public'        => [
            'patterns' => ['/prices', '/challenge/plans', '/leaderboard'],
            'methods'  => ['GET'],
            'default'  => 30,
        ],
    ];

    /**
     * Window size in seconds. Fixed-window counter resets after this many seconds.
     * Stored as the transient TTL — auto-expires without any cleanup.
     */
    const WINDOW = 60;

    /**
     * Transient key prefix. Short to stay well within the 172-char limit.
     * Full key example: fxsim_rl_tw_42  (trading_write, user 42)
     */
    const KEY_PREFIX = 'fxsim_rl_';

    /**
     * Tier slug abbreviations for compact transient keys.
     */
    private const TIER_SLUGS = [
        'trading_write' => 'tw',
        'trading_read'  => 'tr',
        'auth_write'    => 'aw',
        'stream'        => 'ss',
        'public'        => 'pub',
    ];

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Register the rate limiter on the REST API dispatch filter.
     * Called once from FXSIM_REST_API::register().
     */
    public static function register(): void {
        add_filter('rest_pre_dispatch', [self::class, 'check'], 5, 3);
    }

    /**
     * Main rate limit check — called by rest_pre_dispatch filter.
     *
     * @param mixed           $result  Current filter value (null = continue normally).
     * @param WP_REST_Server  $server  REST server instance.
     * @param WP_REST_Request $request Current request.
     * @return mixed  null to continue, WP_Error with HTTP 429 to block.
     */
    public static function check($result, WP_REST_Server $server, WP_REST_Request $request): mixed {
        // Pass through non-fxsim routes immediately
        $route = $request->get_route();
        if (strpos($route, '/fxsim/v1/') === false) {
            return $result;
        }

        // Admin users are always exempt — they need unrestricted admin panel access
        // and already have the most restricted permission_callback (manage_options)
        if (current_user_can('manage_options')) {
            return $result;
        }

        // Classify this request into a tier
        $tier = self::classify($route, $request->get_method());
        if ($tier === null) {
            return $result; // Unclassified routes (admin/*) — pass through
        }

        // Get the limit for this tier (0 = disabled, tier is bypassed)
        $limit = self::get_limit($tier);
        if ($limit === 0) {
            return $result;
        }

        // Determine identity: user_id for authenticated, IP hash for public
        $identity = self::get_identity($tier);

        // Build compact transient key
        $slug = self::TIER_SLUGS[$tier] ?? $tier;
        $key  = self::KEY_PREFIX . $slug . '_' . $identity;

        // Check and increment counter
        $count = (int) FXSIM_Cache::get($key, 'fxsim_rl');

        if ($count >= $limit) {
            // Limit exceeded — return 429 with standard headers
            return new WP_Error(
                'rate_limit_exceeded',
                sprintf(
                    'Too many requests. Limit: %d per %d seconds. Please slow down.',
                    $limit,
                    self::WINDOW
                ),
                [
                    'status'      => 429,
                    'limit'       => $limit,
                    'window'      => self::WINDOW,
                    'tier'        => $tier,
                    // Retry-After: the browser/client should wait this many seconds
                    // We approximate as WINDOW seconds (fixed window — worst case)
                    'retry_after' => self::WINDOW,
                ]
            );
        }

        // Increment counter for this window
        if ($count === 0) {
            // First request in this window — set with TTL so it auto-expires
            FXSIM_Cache::set($key, 1, self::WINDOW, 'fxsim_rl');
        } else {
            // Subsequent requests — increment without resetting TTL
            // FXSIM_Cache::set would reset the TTL; we want the window to stay fixed.
            // For transients: re-set with remaining TTL estimation is impractical.
            // Solution: always set with full WINDOW TTL — this is the standard fixed-window
            // approach. The slight TTL drift (up to WINDOW seconds extra in worst case)
            // is acceptable for abuse protection purposes.
            FXSIM_Cache::set($key, $count + 1, self::WINDOW, 'fxsim_rl');
        }

        // Also set Retry-After header on successful responses near the limit
        // so clients can self-throttle before hitting the wall
        // (Cannot easily set headers here without output — handled via WP_Error data above)

        return $result; // Continue to normal handler
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Classify a route + method into a tier.
     * Returns null for admin routes (bypass) and unrecognised patterns.
     *
     * @param string $route  Full route path e.g. '/fxsim/v1/open'
     * @param string $method HTTP method (GET, POST)
     * @return string|null   Tier slug or null for bypass.
     */
    private static function classify(string $route, string $method): ?string {
        // Strip namespace prefix for simpler matching
        $path = str_replace('/fxsim/v1', '', $route);

        // Admin routes: always bypass
        if (strpos($path, '/admin/') !== false) {
            return null;
        }

        // Stripe webhook: bypass (not user-facing, validated by signature)
        if ($path === '/stripe/webhook') {
            return null;
        }

        // Match against tier patterns — most-specific first
        // trading_write: POST to write endpoints
        if ($method === 'POST') {
            $write_patterns = self::TIERS['trading_write']['patterns'];
            foreach ($write_patterns as $pat) {
                if (strpos($path, $pat) !== false) {
                    // Distinguish auth_write from trading_write
                    if (strpos($path, '/payment/') !== false
                        || $path === '/challenge/start'
                        || strpos($path, '/payout') !== false) {
                        return 'auth_write';
                    }
                    return 'trading_write';
                }
            }
        }

        // stream: GET /stream
        if ($path === '/stream') {
            return 'stream';
        }

        // public: GET endpoints accessible without login
        $public_patterns = self::TIERS['public']['patterns'];
        foreach ($public_patterns as $pat) {
            if (strpos($path, $pat) !== false) {
                // Only apply public tier for actually unauthenticated requests
                if (!is_user_logged_in()) {
                    return 'public';
                }
                // Logged-in users hitting public routes fall into trading_read
            }
        }

        // trading_read: all remaining GET requests from authenticated users
        if ($method === 'GET' && is_user_logged_in()) {
            return 'trading_read';
        }

        return null; // Unclassified — pass through without limiting
    }

    /**
     * Get the rate limit for a tier.
     * Checks WP option first (admin-configurable), falls back to default.
     * Returns 0 if the tier is explicitly disabled.
     *
     * @param string $tier Tier slug.
     * @return int         Request limit per WINDOW seconds.
     */
    private static function get_limit(string $tier): int {
        $option_key = "fxsim_rl_{$tier}_limit";
        $option     = get_option($option_key, null);

        if ($option !== null) {
            return (int) $option; // Admin override (0 = disabled)
        }

        return (int) (self::TIERS[$tier]['default'] ?? 60);
    }

    /**
     * Get a stable identity string for the current request.
     * Authenticated requests: numeric user_id (unforgeable).
     * Public requests: MD5 of client IP (cheap, not stored, not reversible).
     *
     * IP handling: uses REMOTE_ADDR by default. When a trusted proxy header
     * is configured via FXSIM_TRUSTED_PROXY_HEADER constant, that header
     * is used instead. This avoids the security risk of blindly trusting
     * X-Forwarded-For which can be spoofed.
     *
     * @param string $tier Current tier (used to decide auth vs IP).
     * @return string      Identity string safe for use in a cache key.
     */
    private static function get_identity(string $tier): string {
        // Public tier: always use IP (user may not be logged in)
        if ($tier === 'public') {
            return self::get_ip_identity();
        }

        // All other tiers: prefer user_id for accuracy and security
        $user_id = get_current_user_id();
        if ($user_id > 0) {
            return (string) $user_id;
        }

        // Fallback for unauthenticated requests on non-public tiers
        return self::get_ip_identity();
    }

    /**
     * Return an 8-char hex identity derived from the client IP.
     * MD5 is used purely for compactness — not for security.
     *
     * @return string 8 hex chars.
     */
    private static function get_ip_identity(): string {
        // Allow trusted proxy header override via constant (defined in wp-config.php)
        // e.g. define('FXSIM_TRUSTED_PROXY_HEADER', 'HTTP_X_FORWARDED_FOR');
        if (defined('FXSIM_TRUSTED_PROXY_HEADER') && !empty($_SERVER[FXSIM_TRUSTED_PROXY_HEADER])) {
            // Take only the first IP in a comma-separated list (client IP, not proxy IPs)
            $ip = trim(explode(',', $_SERVER[FXSIM_TRUSTED_PROXY_HEADER])[0]);
        } else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        }
        return substr(md5($ip), 0, 8);
    }
}
