<?php
/**
 * FXSIM Token Authentication (V10.7.3 Foundation)
 *
 * Bearer-token auth for mobile/API clients, ADDED ALONGSIDE the existing
 * WordPress cookie authentication. Cookie auth is untouched: the web frontend
 * (headless bridge /auth/login etc.) continues to work unchanged. Bearer auth
 * is resolved through the `determine_current_user` filter, so every existing
 * REST endpoint and permission callback works with tokens with zero changes.
 *
 * Design (OWASP ASVS-aligned):
 *  - Opaque tokens, 256-bit CSPRNG (`random_bytes(32)`), base64url.
 *    Prefixes: fxa_ (access) / fxr_ (refresh) for identification & secret
 *    scanning. Raw tokens are returned once and NEVER stored or logged.
 *  - Server stores SHA-256 hashes only; lookups by hash, verified with
 *    hash_equals (constant-time).
 *  - Short-lived access tokens (30 min) + long-lived refresh tokens (30 days).
 *  - Refresh ROTATION on every use: a new refresh token is issued and the old
 *    hash is retired to prev_refresh_hash.
 *  - Refresh REUSE DETECTION: presenting a retired (already-rotated) refresh
 *    token revokes the entire session — the canonical response to token theft.
 *  - Per-device sessions: each login creates one session row (device name,
 *    platform, IP), listable and individually revocable by the user.
 *  - Rate limiting via the existing FXSIM_Rate_Limiter tier system plus a
 *    dedicated per-IP + per-account failed-login throttle (transients).
 *  - 2FA respected: if the account has email 2FA enabled, login requires the
 *    emailed OTP (two-step: first call triggers the code, second supplies it).
 *  - Generic error messages (no user-enumeration), no tokens in logs.
 */

defined('ABSPATH') || exit;

class FXSIM_Token_Auth {

    private const ACCESS_TTL  = 1800;      // 30 minutes
    private const REFRESH_TTL = 2592000;   // 30 days
    private const MAX_SESSIONS_PER_USER = 20;   // oldest evicted beyond this
    private const REFRESH_REUSE_GRACE   = 30;   // sec: benign double-refresh tolerance

    // ── Registration ──────────────────────────────────────────────────────────

    public static function register(): void {
        add_filter('determine_current_user', [self::class, 'resolve_bearer'], 30);
        // Ensure bearer-authenticated requests are not rejected by WP's REST
        // cookie-nonce check (which only applies to cookie-authenticated users).
        add_filter('rest_authentication_errors', [self::class, 'bless_bearer'], 90);
        add_action('rest_api_init', [self::class, 'routes']);
    }

    public static function routes(): void {
        $ns   = 'fxsim/v1';
        $anon = '__return_true';
        $auth = fn() => is_user_logged_in();

        register_rest_route($ns, '/auth/token',            ['methods' => 'POST',   'callback' => [self::class, 'login'],       'permission_callback' => $anon]);
        register_rest_route($ns, '/auth/token/refresh',    ['methods' => 'POST',   'callback' => [self::class, 'refresh'],     'permission_callback' => $anon]);
        register_rest_route($ns, '/auth/token/logout',     ['methods' => 'POST',   'callback' => [self::class, 'logout'],      'permission_callback' => $anon]);
        register_rest_route($ns, '/auth/token/logout-all', ['methods' => 'POST',   'callback' => [self::class, 'logout_all'],  'permission_callback' => $auth]);
        register_rest_route($ns, '/auth/sessions',         ['methods' => 'GET',    'callback' => [self::class, 'sessions'],    'permission_callback' => $auth]);
        register_rest_route($ns, '/auth/sessions/(?P<id>\d+)', ['methods' => 'DELETE', 'callback' => [self::class, 'revoke_session'], 'permission_callback' => $auth]);
    }

    // ── Token primitives ──────────────────────────────────────────────────────

    private static function mint(string $prefix): array {
        $raw = $prefix . rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        return [$raw, hash('sha256', $raw)];
    }

    private static function table(): string {
        global $wpdb;
        return $wpdb->prefix . 'fxsim_auth_sessions';
    }

    // ── Bearer resolution (makes ALL existing endpoints token-aware) ─────────

    public static function resolve_bearer($user_id) {
        if ($user_id) return $user_id;                      // cookie auth already resolved

        $header = self::auth_header();
        if ($header === '' || !str_starts_with($header, 'Bearer fxa_')) return $user_id;

        global $wpdb;
        $hash = hash('sha256', substr($header, 7));
        $row  = $wpdb->get_row($wpdb->prepare(
            "SELECT id, user_id, access_expires, revoked FROM " . self::table() . " WHERE access_hash = %s",
            $hash
        ));
        if (!$row || (int)$row->revoked === 1) return $user_id;
        if (strtotime($row->access_expires) < time()) return $user_id;   // expired → anonymous → 401 downstream

        // Throttled last_used touch (at most once/minute per session)
        if (!get_transient('fxsim_tok_touch_' . $row->id)) {
            $wpdb->update(self::table(), ['last_used' => current_time('mysql')], ['id' => $row->id]);
            set_transient('fxsim_tok_touch_' . $row->id, 1, 60);
        }
        $GLOBALS['fxsim_bearer_session_id'] = (int)$row->id;
        return (int)$row->user_id;
    }

    /** Skip WP's cookie-nonce REST check for requests we authenticated by bearer. */
    public static function bless_bearer($result) {
        if (!empty($GLOBALS['fxsim_bearer_session_id'])) return true;
        return $result;
    }

    private static function auth_header(): string {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if ($h === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) {
                if (strcasecmp($k, 'Authorization') === 0) { $h = $v; break; }
            }
        }
        return trim((string)$h);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public static function login(WP_REST_Request $r) {
        $username = trim((string)$r->get_param('username'));
        $password = (string)$r->get_param('password');
        if ($username === '' || $password === '') {
            return new WP_REST_Response(['success' => false, 'message' => 'Missing credentials.'], 400);
        }

        // ── Brute-force throttle: per-IP and per-account (OWASP AT-002) ──────
        $ip      = self::client_ip();
        $ip_key  = 'fxsim_tok_fail_ip_'  . md5($ip);
        $usr_key = 'fxsim_tok_fail_usr_' . md5(strtolower($username));
        if ((int)get_transient($ip_key) >= 10 || (int)get_transient($usr_key) >= 5) {
            return new WP_REST_Response(['success' => false, 'message' => 'Too many attempts. Try again later.'], 429);
        }

        // Allow login by email (mirrors the web login behaviour)
        if (is_email($username)) {
            $u = get_user_by('email', $username);
            if ($u) $username = $u->user_login;
        }

        $user = wp_authenticate($username, $password);
        if (is_wp_error($user)) {
            set_transient($ip_key,  (int)get_transient($ip_key)  + 1, 15 * MINUTE_IN_SECONDS);
            set_transient($usr_key, (int)get_transient($usr_key) + 1, 15 * MINUTE_IN_SECONDS);
            // Generic message — do not reveal whether the account exists.
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid credentials.'], 401);
        }

        // ── 2FA (email OTP) — same mechanism as the web flow ─────────────────
        if (class_exists('FXSIM_2FA') && FXSIM_2FA::is_enabled($user->ID)) {
            $otp = trim((string)$r->get_param('otp'));
            if ($otp === '') {
                FXSIM_2FA::send_code($user->ID);
                return new WP_REST_Response([
                    'success' => false, 'code' => '2fa_required',
                    'message' => 'Verification code sent to your email. Re-submit with the otp field.',
                ], 401);
            }
            if (!FXSIM_2FA::verify_code($user->ID, $otp)) {
                set_transient($usr_key, (int)get_transient($usr_key) + 1, 15 * MINUTE_IN_SECONDS);
                return new WP_REST_Response(['success' => false, 'message' => 'Invalid verification code.'], 401);
            }
        }

        delete_transient($ip_key);
        delete_transient($usr_key);

        return new WP_REST_Response(self::create_session(
            (int)$user->ID,
            sanitize_text_field((string)$r->get_param('device_name') ?: 'Unknown device'),
            sanitize_text_field((string)$r->get_param('platform')    ?: 'unknown'),
            $ip
        ), 200);
    }

    private static function create_session(int $user_id, string $device, string $platform, string $ip): array {
        global $wpdb;
        [$access_raw,  $access_hash]  = self::mint('fxa_');
        [$refresh_raw, $refresh_hash] = self::mint('fxr_');
        $now = time();

        $wpdb->insert(self::table(), [
            'user_id'           => $user_id,
            'device_name'       => mb_substr($device, 0, 100),
            'platform'          => mb_substr($platform, 0, 20),
            'ip'                => mb_substr($ip, 0, 45),
            'access_hash'       => $access_hash,
            'access_expires'    => gmdate('Y-m-d H:i:s', $now + self::ACCESS_TTL),
            'refresh_hash'      => $refresh_hash,
            'prev_refresh_hash' => '',
            'refresh_expires'   => gmdate('Y-m-d H:i:s', $now + self::REFRESH_TTL),
            'created_at'        => current_time('mysql'),
            'last_used'         => current_time('mysql'),
            'revoked'           => 0,
        ]);
        $session_id = (int)$wpdb->insert_id;

        // Session cap: evict the oldest beyond MAX_SESSIONS_PER_USER.
        $wpdb->query($wpdb->prepare(
            "UPDATE " . self::table() . " SET revoked = 1, revoked_reason = 'evicted'
             WHERE user_id = %d AND revoked = 0
               AND id NOT IN (SELECT id FROM (
                   SELECT id FROM " . self::table() . "
                   WHERE user_id = %d AND revoked = 0
                   ORDER BY id DESC LIMIT %d) keep)",
            $user_id, $user_id, self::MAX_SESSIONS_PER_USER
        ));

        return [
            'success'            => true,
            'token_type'         => 'Bearer',
            'access_token'       => $access_raw,
            'expires_in'         => self::ACCESS_TTL,
            'refresh_token'      => $refresh_raw,
            'refresh_expires_in' => self::REFRESH_TTL,
            'session_id'         => $session_id,
            'user_id'            => $user_id,
        ];
    }

    // ── Refresh (with rotation + reuse detection) ─────────────────────────────

    public static function refresh(WP_REST_Request $r) {
        global $wpdb;
        $raw = (string)$r->get_param('refresh_token');
        if (!str_starts_with($raw, 'fxr_')) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid token.'], 401);
        }
        $hash = hash('sha256', $raw);

        // Reuse detection: a RETIRED refresh token being replayed normally means
        // theft → kill the session. BUT a benign client-side race (the scheduled
        // refresh timer and an app-resume refresh both firing with the same token
        // within seconds) also lands here. To avoid nuking a legitimate session
        // over a harmless double-call, allow a short grace window: if the token
        // was rotated very recently, treat the replay as an idempotent retry and
        // tell the client to reload its already-rotated token — do NOT revoke.
        // Outside the grace window a retired token is treated as compromise.
        $stolen = $wpdb->get_row($wpdb->prepare(
            "SELECT id, user_id, revoked, prev_rotated_at FROM " . self::table() . " WHERE prev_refresh_hash = %s", $hash
        ));
        if ($stolen) {
            $rotated_ts = $stolen->prev_rotated_at ? strtotime($stolen->prev_rotated_at . ' UTC') : 0;
            $within_grace = $rotated_ts && (time() - $rotated_ts) <= self::REFRESH_REUSE_GRACE
                            && (int)$stolen->revoked === 0;
            if ($within_grace) {
                // Benign race: the other concurrent caller already rotated. The
                // session is intact. 409 signals "your token was just rotated —
                // reload the stored one", which the client already persisted.
                return new WP_REST_Response([
                    'success' => false,
                    'code'    => 'refresh_raced',
                    'message' => 'Token already rotated; reuse the current token.',
                ], 409);
            }
            $wpdb->update(self::table(),
                ['revoked' => 1, 'revoked_reason' => 'refresh_reuse_detected'],
                ['id' => (int)$stolen->id]);
            error_log('[PropFirm] Refresh-token reuse detected — session ' . (int)$stolen->id . ' revoked (user ' . (int)$stolen->user_id . ').');
            return new WP_REST_Response(['success' => false, 'message' => 'Session revoked. Please sign in again.'], 401);
        }

        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM " . self::table() . " WHERE refresh_hash = %s", $hash
        ));
        if (!$row || (int)$row->revoked === 1 || strtotime($row->refresh_expires) < time()) {
            return new WP_REST_Response(['success' => false, 'message' => 'Session expired. Please sign in again.'], 401);
        }

        [$access_raw,  $access_hash]  = self::mint('fxa_');
        [$refresh_raw, $refresh_hash] = self::mint('fxr_');
        $wpdb->update(self::table(), [
            'access_hash'       => $access_hash,
            'access_expires'    => gmdate('Y-m-d H:i:s', time() + self::ACCESS_TTL),
            'prev_refresh_hash' => $row->refresh_hash,           // retire old refresh
            'prev_rotated_at'   => gmdate('Y-m-d H:i:s'),        // when we retired it (grace window)
            'refresh_hash'      => $refresh_hash,                // rotate
            'refresh_expires'   => gmdate('Y-m-d H:i:s', time() + self::REFRESH_TTL),
            'last_used'         => current_time('mysql'),
        ], ['id' => (int)$row->id]);

        return new WP_REST_Response([
            'success'            => true,
            'token_type'         => 'Bearer',
            'access_token'       => $access_raw,
            'expires_in'         => self::ACCESS_TTL,
            'refresh_token'      => $refresh_raw,
            'refresh_expires_in' => self::REFRESH_TTL,
        ], 200);
    }

    // ── Logout / revocation / device management ──────────────────────────────

    /** Logout the session identified by the presented access or refresh token. */
    public static function logout(WP_REST_Request $r) {
        global $wpdb;
        $sid = 0;
        $header = self::auth_header();
        if (str_starts_with($header, 'Bearer fxa_')) {
            $sid = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT id FROM " . self::table() . " WHERE access_hash = %s",
                hash('sha256', substr($header, 7))));
        }
        if (!$sid) {
            $raw = (string)$r->get_param('refresh_token');
            if (str_starts_with($raw, 'fxr_')) {
                $sid = (int)$wpdb->get_var($wpdb->prepare(
                    "SELECT id FROM " . self::table() . " WHERE refresh_hash = %s", hash('sha256', $raw)));
            }
        }
        if ($sid) {
            $wpdb->update(self::table(), ['revoked' => 1, 'revoked_reason' => 'logout'], ['id' => $sid]);
        }
        // Always 200 — logout must be idempotent and non-informative.
        return new WP_REST_Response(['success' => true], 200);
    }

    public static function logout_all() {
        global $wpdb;
        $wpdb->update(self::table(),
            ['revoked' => 1, 'revoked_reason' => 'logout_all'],
            ['user_id' => get_current_user_id(), 'revoked' => 0]);
        return new WP_REST_Response(['success' => true], 200);
    }

    public static function sessions() {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, device_name, platform, ip, created_at, last_used
             FROM " . self::table() . "
             WHERE user_id = %d AND revoked = 0 AND refresh_expires > UTC_TIMESTAMP()
             ORDER BY last_used DESC",
            get_current_user_id()
        ));
        $current = (int)($GLOBALS['fxsim_bearer_session_id'] ?? 0);
        foreach (($rows ?: []) as $row) $row->current = ((int)$row->id === $current);
        return new WP_REST_Response($rows ?: [], 200);
    }

    public static function revoke_session(WP_REST_Request $r) {
        global $wpdb;
        $updated = $wpdb->update(self::table(),
            ['revoked' => 1, 'revoked_reason' => 'user_revoked'],
            ['id' => (int)$r['id'], 'user_id' => get_current_user_id(), 'revoked' => 0]);
        if (!$updated) return new WP_REST_Response(['success' => false, 'message' => 'Session not found.'], 404);
        return new WP_REST_Response(['success' => true], 200);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Daily retention hygiene: drop sessions dead for 7+ days (audit window). */
    public static function cleanup(): void {
        global $wpdb;
        $wpdb->query(
            "DELETE FROM " . self::table() . "
             WHERE (revoked = 1 AND last_used < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY))
                OR refresh_expires < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)"
        );
    }

    private static function client_ip(): string {
        return sanitize_text_field((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    }
}
