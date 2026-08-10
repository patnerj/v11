<?php
/**
 * FXSIM_API_Keys — API key authentication system.
 *
 * Key format:  fxsim_{env}_{32 hex chars}
 *   Example:   fxsim_live_a3f2c8d1e4b7906a2c5d8e1f4b7a0e3d
 *   env:       live | test
 *
 * Storage:     SHA-256 hash of the full key stored in fxsim_api_keys.
 *              Raw key shown exactly once at creation; never stored.
 *
 * Auth flow:
 *   1. Client sends:  X-FXSIM-Key: fxsim_live_xxxx
 *      (or query param ?fxsim_key=fxsim_live_xxxx for EventSource/browser use)
 *   2. determine_current_user hook fires → authenticate_request() called
 *   3. Hash the key → lookup in DB → verify is_active, not expired
 *   4. Set WP current user to key owner (all existing code works unchanged)
 *   5. Store key_id in static property for scope check + usage log
 *   6. permission_callback fires → auth_check() passes (user is logged in)
 *   7. Scope check runs (rest_pre_dispatch, priority 4 — before rate limiter)
 *   8. Handler executes → rest_post_dispatch logs usage + updates last_used
 *
 * Nonce bypass:
 *   write endpoints call verify_nonce() which checks FXSIM_API_Keys::is_key_request()
 *   API key requests skip the nonce — the key itself is the credential.
 *
 * Scope → route mapping:
 *   read      — GET /account /positions /history /transactions /stats /symbols
 *               /pending-order/my /challenge/my /challenge/plans /prices /leaderboard
 *   trade     — POST /open /close /partial-close /sltp /pending-order/*
 *               (implicitly includes read)
 *   challenge — POST /challenge/start /payment/create /payment/submit-proof
 *               (implicitly includes trade + read)
 *   stream    — GET /stream
 *   admin     — /admin/* (also requires WP manage_options capability)
 *
 * Future SaaS / MT5 bridge compatibility:
 *   - env='test' keys can be blocked from live trade execution
 *   - scopes are stored as comma-separated string; new scopes add without migration
 *   - Multi-tenant: add tenant_id FK when needed
 */
defined('ABSPATH') || exit;

class FXSIM_API_Keys {

    /** Header name the client sends the raw key in. */
    const HEADER = 'X-FXSIM-Key';

    /** Query parameter alternative (for EventSource / simple browser integrations). */
    const QUERY_PARAM = 'fxsim_key';

    /** Key prefix — used to detect fxsim keys in the header before touching DB. */
    const KEY_PREFIX = 'fxsim_';

    /** Maximum usage log rows retained per key. Old rows purged on each insert. */
    const LOG_MAX_ROWS = 1000;

    /**
     * Whether the current request was authenticated via an API key.
     * Set in authenticate_request(), read by is_key_request().
     */
    private static bool $authenticated_via_key = false;

    /** Key row from DB for the current request (set after successful auth). */
    private static ?object $current_key = null;

    // ════════════════════════════════════════════════════════════════════════
    // REGISTRATION
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Register all hooks. Called once from FXSIM_REST_API::register().
     */
    public static function register(): void {
        // Hook 1: determine_current_user — sets WP current user from API key
        // Priority 20: after WP's own cookie auth (10) so cookie auth takes precedence
        // when both are present (edge case — browser session + API key in same request)
        add_filter('determine_current_user', [self::class, 'authenticate_request'], 20);

        // Hook 2: rest_pre_dispatch priority 4 — scope check BEFORE rate limiter (5)
        // Blocks unauthorised scope access before counting against rate limit
        add_filter('rest_pre_dispatch', [self::class, 'check_scope'], 4, 3);

        // Hook 3: rest_post_dispatch — log usage + update last_used timestamp
        add_filter('rest_post_dispatch', [self::class, 'log_usage'], 10, 3);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 5.3: AUTH MIDDLEWARE
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Attempt to authenticate the current request via an API key.
     * Called on determine_current_user filter.
     *
     * If already authenticated (cookie auth), returns $user unchanged.
     * If API key found and valid, returns the key owner's user_id.
     * If API key found but invalid, returns WP_Error (request will be rejected).
     *
     * @param int|WP_Error $user  Current user_id or 0 (unauthenticated).
     * @return int|WP_Error       Resolved user_id, or WP_Error on bad key.
     */
    public static function authenticate_request(int|WP_Error $user): int|WP_Error {
        // If already authenticated by cookie/session, don't interfere
        if (!empty($user)) {
            return $user;
        }

        // Only process requests to our REST namespace
        if (!self::is_fxsim_request()) {
            return $user;
        }

        // Extract raw key from header or query param
        $raw_key = self::extract_key();
        if ($raw_key === null) {
            return $user; // No key present — continue with normal auth
        }

        // Basic format validation before touching the DB
        if (!str_starts_with($raw_key, self::KEY_PREFIX)) {
            return new WP_Error(
                'fxsim_invalid_key_format',
                'API key format invalid. Expected: fxsim_live_... or fxsim_test_...',
                ['status' => 401]
            );
        }

        // Hash the key and look it up
        $key_hash = hash('sha256', $raw_key);
        $key_row  = self::find_key_by_hash($key_hash);

        if (!$key_row) {
            return new WP_Error(
                'fxsim_key_not_found',
                'API key not found or revoked.',
                ['status' => 401]
            );
        }

        // Check active status
        if (!(int) $key_row->is_active) {
            return new WP_Error(
                'fxsim_key_revoked',
                'API key has been revoked.',
                ['status' => 401]
            );
        }

        // Check expiry
        if ($key_row->expires_at !== null && strtotime($key_row->expires_at) < time()) {
            return new WP_Error(
                'fxsim_key_expired',
                'API key has expired.',
                ['status' => 401]
            );
        }

        // Verify the key owner user still exists and is active
        $owner = get_userdata((int) $key_row->user_id);
        if (!$owner) {
            return new WP_Error(
                'fxsim_key_owner_invalid',
                'API key owner account not found.',
                ['status' => 401]
            );
        }

        // ── Authentication success ────────────────────────────────────────────
        self::$authenticated_via_key = true;
        self::$current_key           = $key_row;

        // Set WP current user — all existing code (get_current_user_id, caps) now works
        wp_set_current_user((int) $key_row->user_id);

        return (int) $key_row->user_id;
    }

    /**
     * Whether the current request was authenticated via an API key.
     * Used by verify_nonce() to skip nonce validation for API key requests.
     *
     * @return bool
     */
    public static function is_key_request(): bool {
        return self::$authenticated_via_key;
    }

    /**
     * Return the current key row (for scope checks and logging).
     *
     * @return object|null
     */
    public static function current_key(): ?object {
        return self::$current_key;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 5.5: SCOPE VALIDATION
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Check that the API key has the required scope for the requested endpoint.
     * Called on rest_pre_dispatch at priority 4 (before rate limiter at 5).
     *
     * Only runs for API key requests. Normal browser/cookie sessions pass through.
     *
     * @param mixed           $result
     * @param WP_REST_Server  $server
     * @param WP_REST_Request $request
     * @return mixed  null to continue, WP_Error to block.
     */
    public static function check_scope($result, WP_REST_Server $server, WP_REST_Request $request): mixed {
        // Only applies to API key authenticated requests
        if (!self::$authenticated_via_key || self::$current_key === null) {
            return $result;
        }

        // Only our namespace
        $route = $request->get_route();
        if (strpos($route, '/fxsim/v1/') === false) {
            return $result;
        }

        $path    = str_replace('/fxsim/v1', '', $route);
        $method  = $request->get_method();
        $scopes  = array_map('trim', explode(',', self::$current_key->scopes));
        $required = self::required_scope($path, $method);

        if ($required === null) {
            return $result; // No scope restriction on this endpoint
        }

        if (!self::has_scope($scopes, $required)) {
            return new WP_Error(
                'fxsim_insufficient_scope',
                "API key scope '{$required}' required. Key scopes: " . self::$current_key->scopes,
                ['status' => 403, 'required_scope' => $required]
            );
        }

        // Test key guard: test keys cannot execute live trades
        if (self::$current_key->env === 'test' && $required === 'trade') {
            return new WP_Error(
                'fxsim_test_key_trade',
                'Test API keys cannot execute live trades. Use a live key.',
                ['status' => 403]
            );
        }

        return $result;
    }

    /**
     * Determine the required scope for a path + method combination.
     *
     * @param string $path   Route path without namespace (e.g. '/account').
     * @param string $method HTTP method.
     * @return string|null   Required scope slug, or null if no restriction.
     */
    private static function required_scope(string $path, string $method): ?string {
        // Admin routes
        if (strpos($path, '/admin/') !== false) {
            return 'admin';
        }

        // SSE stream
        if ($path === '/stream') {
            return 'stream';
        }

        // Challenge and payment writes
        if ($method === 'POST' && (
            $path === '/challenge/start' ||
            strpos($path, '/payment/') !== false
        )) {
            return 'challenge';
        }

        // Trade execution writes
        if ($method === 'POST' && (
            $path === '/open' ||
            strpos($path, '/close') !== false ||
            strpos($path, '/sltp/') !== false ||
            strpos($path, '/pending-order/') !== false
        )) {
            return 'trade';
        }

        // All other authenticated GET endpoints
        if ($method === 'GET') {
            return 'read';
        }

        return null;
    }

    /**
     * Check whether a set of scopes satisfies the required scope,
     * respecting the implicit hierarchy: admin > challenge > trade > read.
     *
     * @param array  $scopes   Key's granted scopes.
     * @param string $required Required scope.
     * @return bool
     */
    private static function has_scope(array $scopes, string $required): bool {
        if (in_array($required, $scopes, true)) return true;

        // Implicit upgrades: higher scopes include lower ones
        $implies = [
            'admin'     => ['challenge', 'trade', 'read', 'stream'],
            'challenge' => ['trade', 'read'],
            'trade'     => ['read'],
        ];

        foreach ($implies as $higher => $lower) {
            if (in_array($higher, $scopes, true) && in_array($required, $lower, true)) {
                return true;
            }
        }

        return false;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 5.6: USAGE TRACKING
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Log API key usage after dispatch completes.
     * Records endpoint, method, HTTP status. Rotates log to LOG_MAX_ROWS.
     * Updates last_used timestamp on the key row.
     *
     * @param WP_HTTP_Response $response
     * @param WP_REST_Server   $server
     * @param WP_REST_Request  $request
     * @return WP_HTTP_Response  Unchanged.
     */
    public static function log_usage(
        WP_HTTP_Response $response,
        WP_REST_Server $server,
        WP_REST_Request $request
    ): WP_HTTP_Response {
        // Only log API key requests to our namespace
        if (!self::$authenticated_via_key || self::$current_key === null) {
            return $response;
        }
        if (strpos($request->get_route(), '/fxsim/v1/') === false) {
            return $response;
        }

        global $wpdb;
        $key_id = (int) self::$current_key->id;

        // Truncate endpoint to 100 chars for compact storage
        $endpoint = substr($request->get_route(), 0, 100);
        $method   = $request->get_method();
        $status   = $response->get_status();

        // Insert log row
        $wpdb->insert(
            $wpdb->prefix . 'fxsim_api_key_log',
            [
                'key_id'      => $key_id,
                'endpoint'    => $endpoint,
                'method'      => $method,
                'status_code' => $status,
                'ts'          => current_time('mysql'),
            ],
            ['%d', '%s', '%s', '%d', '%s']
        );

        // Rotate: delete rows beyond LOG_MAX_ROWS for this key
        // Subquery approach avoids the MySQL "can't refer to same table in DELETE/SELECT"
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}fxsim_api_key_log
             WHERE key_id = %d
               AND id NOT IN (
                 SELECT id FROM (
                   SELECT id FROM {$wpdb->prefix}fxsim_api_key_log
                   WHERE key_id = %d
                   ORDER BY id DESC
                   LIMIT %d
                 ) AS keep
               )",
            $key_id, $key_id, self::LOG_MAX_ROWS
        ));

        // Update last_used (fire-and-forget — non-critical)
        $wpdb->update(
            $wpdb->prefix . 'fxsim_api_keys',
            ['last_used' => current_time('mysql')],
            ['id' => $key_id],
            ['%s'],
            ['%d']
        );

        return $response;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 5.4: KEY MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Generate a new API key for a user.
     *
     * @param int    $user_id   WordPress user ID.
     * @param string $name      Human-readable label.
     * @param array  $scopes    Scope slugs (e.g. ['read', 'trade']).
     * @param string $env       'live' or 'test'.
     * @param string $expires   Optional ISO datetime or empty string for no expiry.
     * @return array {
     *   success bool
     *   key     string  Raw key — shown ONCE, never stored again
     *   key_id  int
     *   message string
     * }
     */
    public static function create_key(
        int $user_id,
        string $name,
        array $scopes,
        string $env = 'live',
        string $expires = ''
    ): array {
        // Validate inputs
        if (empty($name)) {
            return ['success' => false, 'message' => 'Key name is required.'];
        }

        $valid_scopes = ['read', 'trade', 'challenge', 'stream', 'admin'];
        $scopes = array_filter($scopes, fn($s) => in_array($s, $valid_scopes, true));
        if (empty($scopes)) {
            return ['success' => false, 'message' => 'At least one valid scope is required.'];
        }

        // Admin scope only for actual admins
        if (in_array('admin', $scopes, true) && !user_can($user_id, 'manage_options')) {
            return ['success' => false, 'message' => 'Admin scope requires administrator privileges.'];
        }

        $env = in_array($env, ['live', 'test'], true) ? $env : 'live';

        $expires_at = null;
        if (!empty($expires)) {
            $ts = strtotime($expires);
            if ($ts === false || $ts <= time()) {
                return ['success' => false, 'message' => 'Expiry must be a future date.'];
            }
            $expires_at = date('Y-m-d H:i:s', $ts);
        }

        // Enforce max keys per user (prevent abuse)
        global $wpdb;
        $key_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_api_keys WHERE user_id = %d AND is_active = 1",
            $user_id
        ));
        $max_keys = (int) get_option('fxsim_api_max_keys_per_user', 10);
        if ($key_count >= $max_keys) {
            return ['success' => false, 'message' => "Maximum {$max_keys} active keys per user."];
        }

        // Generate cryptographically secure key
        $raw_key  = self::KEY_PREFIX . $env . '_' . bin2hex(random_bytes(16));
        $key_hash = hash('sha256', $raw_key);

        $inserted = $wpdb->insert(
            $wpdb->prefix . 'fxsim_api_keys',
            [
                'user_id'    => $user_id,
                'key_hash'   => $key_hash,
                'name'       => sanitize_text_field($name),
                'scopes'     => implode(',', $scopes),
                'env'        => $env,
                'expires_at' => $expires_at,
                'is_active'  => 1,
            ],
            ['%d', '%s', '%s', '%s', '%s', '%s', '%d']
        );

        if (!$inserted) {
            return ['success' => false, 'message' => 'Database error — key not created.'];
        }

        FXSIM_Database::log_admin($user_id, 'api_key_created', $user_id,
            "Key: {$name}, Env: {$env}, Scopes: " . implode(',', $scopes));

        return [
            'success' => true,
            'key'     => $raw_key,          // Raw key — display once only
            'key_id'  => (int) $wpdb->insert_id,
            'message' => 'API key created. Copy it now — it will not be shown again.',
        ];
    }

    /**
     * Revoke an API key (soft delete — sets is_active=0).
     *
     * @param int $key_id  Key to revoke.
     * @param int $user_id Must own the key (or be admin).
     * @return array {success bool, message string}
     */
    public static function revoke_key(int $key_id, int $user_id): array {
        global $wpdb;

        $key = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_api_keys WHERE id = %d",
            $key_id
        ));

        if (!$key) {
            return ['success' => false, 'message' => 'Key not found.'];
        }

        // Allow own key revocation or admin revocation
        if ((int) $key->user_id !== $user_id && !current_user_can('manage_options')) {
            return ['success' => false, 'message' => 'Not authorised to revoke this key.'];
        }

        $wpdb->update(
            $wpdb->prefix . 'fxsim_api_keys',
            ['is_active' => 0],
            ['id' => $key_id],
            ['%d'],
            ['%d']
        );

        FXSIM_Database::log_admin($user_id, 'api_key_revoked', (int) $key->user_id,
            "Key ID: {$key_id}, Name: {$key->name}");

        return ['success' => true, 'message' => 'API key revoked.'];
    }

    /**
     * List active API keys for a user (hashes not returned — never expose).
     *
     * @param int $user_id
     * @return array  Key rows without key_hash.
     */
    public static function list_keys(int $user_id): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT id, name, scopes, env, last_used, expires_at, is_active, created_at
             FROM {$wpdb->prefix}fxsim_api_keys
             WHERE user_id = %d
             ORDER BY created_at DESC",
            $user_id
        )) ?: [];
    }

    /**
     * Get usage log for a key (most recent first).
     *
     * @param int $key_id
     * @param int $limit  Max rows to return.
     * @return array
     */
    public static function get_usage_log(int $key_id, int $limit = 50): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT endpoint, method, status_code, ts
             FROM {$wpdb->prefix}fxsim_api_key_log
             WHERE key_id = %d
             ORDER BY id DESC
             LIMIT %d",
            $key_id, $limit
        )) ?: [];
    }

    // ════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Check if the current request is to our REST namespace.
     * Fast string check — no regex.
     */
    private static function is_fxsim_request(): bool {
        // During REST request, REQUEST_URI contains the REST path
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        return strpos($uri, '/fxsim/v1/') !== false;
    }

    /**
     * Extract the raw API key from the request.
     * Checks header first (preferred), then query parameter (fallback).
     *
     * @return string|null  Raw key string, or null if not present.
     */
    private static function extract_key(): ?string {
        // Preferred: X-FXSIM-Key header
        // In PHP, headers are in $_SERVER as HTTP_{HEADER_NAME_UPPERCASE}
        $header_name = 'HTTP_' . strtoupper(str_replace('-', '_', self::HEADER));
        if (!empty($_SERVER[$header_name])) {
            return sanitize_text_field(wp_unslash($_SERVER[$header_name]));
        }

        // Fallback: query parameter (for EventSource, simple browser tools)
        if (!empty($_GET[self::QUERY_PARAM])) {
            return sanitize_text_field(wp_unslash($_GET[self::QUERY_PARAM]));
        }

        return null;
    }

    /**
     * Look up a key by its SHA-256 hash.
     * Cached per-request in FXSIM_Cache (object cache / transient) to prevent
     * repeated DB hits if the same key is checked multiple times (e.g. SSE loop).
     *
     * @param string $hash  SHA-256 hex hash of the raw key.
     * @return object|null  Key row or null.
     */
    private static function find_key_by_hash(string $hash): ?object {
        // Per-request static cache — zero DB overhead for the same key in the same request
        static $cache = [];
        if (array_key_exists($hash, $cache)) {
            return $cache[$hash];
        }

        global $wpdb;
        $cache[$hash] = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_api_keys
             WHERE key_hash = %s
             LIMIT 1",
            $hash
        ));
        return $cache[$hash];
    }
}
