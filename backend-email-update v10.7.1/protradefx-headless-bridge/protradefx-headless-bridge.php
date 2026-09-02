<?php
/**
 * Plugin Name:  PropFirm Launcher — Headless Bridge
 * Description:  Adds login/register/logout/me REST endpoints + CORS so the
 *               Next.js frontend can talk to the existing fxsim/v1 namespace.
 *               Drop into wp-content/plugins/ and activate. Does not modify
 *               the parent PropFirm_System plugin.
 * Version:      11.1.2
 * Author:       PropFirm Launcher
 * Requires PHP: 8.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class ProTradeFX_Headless_Bridge {

    /** Origins permitted to make cross-origin, credentialed calls. */
    const ALLOWED_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];

    /**
     * Production origins are derived at runtime from the configured frontend
     * URL (fxsim_frontend_url option, set in admin Settings) rather than
     * hardcoded — so a buyer's own domain is trusted automatically with no
     * code edit and no leftover references to any other domain.
     */
    public static function allowed_origins(): array {
        $origins = self::ALLOWED_ORIGINS;
        $fe = get_option('fxsim_frontend_url', '');
        if (!$fe && defined('FXSIM_FRONTEND_URL')) $fe = FXSIM_FRONTEND_URL;
        if ($fe) {
            $p = wp_parse_url($fe);
            if (!empty($p['scheme']) && !empty($p['host'])) {
                $origins[] = $p['scheme'] . '://' . $p['host'] . (empty($p['port']) ? '' : ':' . $p['port']);
            }
        }
        return array_values(array_unique($origins));
    }

    public static function init() {
        // Help WP resolve the current user from the logged-in cookie on
        // cross-origin REST calls (some setups don't populate it otherwise).
        add_filter( 'determine_current_user', [ __CLASS__, 'force_cookie_auth' ], 25 );

        // Short-circuit WP Core's REST cookie-nonce CSRF check for the fxsim
        // namespace ONLY. The headless SPA authenticates via the logged-in
        // cookie + the CORS allowlist; a cross-origin client can't reliably
        // present a Core-valid `wp_rest` nonce, and Core's rest_cookie_check_errors
        // would otherwise 403 every cookie-authenticated request with
        // `rest_cookie_invalid_nonce`. Endpoints still require a logged-in user
        // via their permission callbacks, so access is not widened.
        add_filter( 'rest_authentication_errors', [ __CLASS__, 'bypass_rest_nonce' ], 1 );

        // When we log a user in during this same request, wp_set_auth_cookie()
        // only queues a Set-Cookie header — it does NOT populate $_COOKIE. So a
        // nonce minted right after would use an empty session token and fail
        // verification on the next request. Priming $_COOKIE here means
        // wp_create_nonce('wp_rest') below reads the real session token and
        // returns a nonce that is valid for subsequent requests.
        add_action( 'set_logged_in_cookie', function ( $logged_in_cookie ) {
            if ( defined( 'LOGGED_IN_COOKIE' ) ) $_COOKIE[ LOGGED_IN_COOKIE ] = $logged_in_cookie;
        }, 10, 1 );

        add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
        add_action( 'rest_api_init', [ __CLASS__, 'cors_filter' ], 15 );
        add_action( 'init',          [ __CLASS__, 'cors_preflight' ], 1 );
    }

    /* ─────────────────────────────────────────────────────────────────
     *  CORS
     * ──────────────────────────────────────────────────────────────── */

    public static function cors_preflight() {
        if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || $_SERVER['REQUEST_METHOD'] !== 'OPTIONS' ) return;
        if ( strpos( $_SERVER['REQUEST_URI'] ?? '', '/wp-json/fxsim/' ) === false ) return;

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ( in_array( $origin, self::allowed_origins(), true ) ) {
            header( 'Access-Control-Allow-Origin: ' . $origin );
            header( 'Access-Control-Allow-Credentials: true' );
            header( 'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS' );
            header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, X-FXSIM-Token, Authorization' );
            header( 'Access-Control-Max-Age: 600' );
        }
        http_response_code( 204 );
        exit;
    }

    public static function cors_filter() {
        remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
        add_filter( 'rest_pre_serve_request', function( $served ) {
            $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
            if ( in_array( $origin, self::allowed_origins(), true ) ) {
                header( 'Access-Control-Allow-Origin: ' . $origin );
                header( 'Access-Control-Allow-Credentials: true' );
                header( 'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS' );
                header( 'Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce, X-FXSIM-Token' );
                header( 'Access-Control-Expose-Headers: X-WP-Nonce, X-FXSIM-Token, Content-Disposition, Content-Type, Content-Length' );
                header( 'Access-Control-Max-Age: 600' );
                header( 'Vary: Origin' );
            }
            return $served;
        });
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Cross-origin cookie + Bearer token auth
     *  Resolves the current user from Bearer Token, X-WP-Nonce, or logged-in
     *  cookie for fxsim/v1 requests. Allows 100% reliable headless session
     *  persistence even when browsers block cross-subdomain third-party cookies.
     * ──────────────────────────────────────────────────────────────── */

    public static function generate_auth_token( int $user_id, int $ttl_seconds = 2592000 ): string {
        $expires = time() + $ttl_seconds;
        $version = (int) get_user_meta( $user_id, 'fxsim_token_version', true );
        $user = get_userdata( $user_id );
        $pass_frag = $user ? substr( (string)$user->user_pass, -8 ) : '0';
        $sig = hash_hmac( 'sha256', "fxsim-token|{$user_id}|{$expires}|{$version}|{$pass_frag}", wp_salt( 'auth' ) );
        return base64_encode( "{$user_id}:{$expires}:{$version}:{$sig}" );
    }

    public static function validate_auth_token( string $token ): int {
        $token = trim($token);
        if ( empty($token) ) return 0;
        $raw = base64_decode( $token, true );
        if ( ! $raw ) return 0;
        $parts = explode( ':', $raw );
        
        // Versioned Token Format (v11 hardened): user_id:expires:version:sig
        if ( count( $parts ) === 4 ) {
            $user_id = (int) $parts[0];
            $expires = (int) $parts[1];
            $version = (int) $parts[2];
            $sig     = (string) $parts[3];
            if ( $user_id <= 0 || $expires < time() ) return 0;
            $curr_version = (int) get_user_meta( $user_id, 'fxsim_token_version', true );
            if ( $version !== $curr_version ) return 0;
            $user = get_userdata( $user_id );
            $pass_frag = $user ? substr( (string)$user->user_pass, -8 ) : '0';
            $expected = hash_hmac( 'sha256', "fxsim-token|{$user_id}|{$expires}|{$version}|{$pass_frag}", wp_salt( 'auth' ) );
            return hash_equals( $expected, $sig ) ? $user_id : 0;
        }

        // The 3-part legacy token format (no version, no password fragment) was
        // removed: it never checked fxsim_token_version, so it survived both
        // logout and password-change revocation for its full 30-day life. Only
        // the 4-part format above has ever been issued, so this was pure
        // exposure with no compatibility benefit.
        return 0;
    }

    public static function extract_token_from_request(): string {
        // SECURITY FIX (M5): Only accept authentication tokens from HTTP headers.
        // Never read session bearer tokens from URL query parameters ($_GET) to prevent
        // credential leakage into access logs, proxy logs, and Referer headers.
        if ( ! empty( $_SERVER['HTTP_X_FXSIM_TOKEN'] ) ) {
            return trim( (string) $_SERVER['HTTP_X_FXSIM_TOKEN'] );
        }
        if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
            return preg_replace( '/^Bearer\s+/i', '', trim( (string) $_SERVER['HTTP_AUTHORIZATION'] ) );
        }
        if ( ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
            return preg_replace( '/^Bearer\s+/i', '', trim( (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
        }
        if ( ! empty( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
            $nonce = trim( (string) $_SERVER['HTTP_X_WP_NONCE'] );
            if ( self::validate_auth_token( $nonce ) > 0 ) return $nonce;
        }
        if ( function_exists( 'getallheaders' ) ) {
            $headers = getallheaders();
            foreach ( ['X-FXSIM-Token', 'x-fxsim-token', 'Authorization', 'authorization', 'X-WP-Nonce', 'x-wp-nonce'] as $h ) {
                if ( ! empty( $headers[ $h ] ) ) {
                    $val = trim( (string) $headers[ $h ] );
                    $val = preg_replace( '/^Bearer\s+/i', '', $val );
                    if ( self::validate_auth_token( $val ) > 0 ) return $val;
                }
            }
        }
        return '';
    }

    /**
     * determine_current_user filter (priority 25 — AFTER core's own
     * wp_validate_auth_cookie at priority 10).
     *
     * WP 7.1 hardening: core's priority-10 validator treats the previous
     * filter's return value as its $cookie STRING argument — returning an int
     * or WP_User from a priority <10 filter fatals/short-circuits there. So
     * this filter must run after core and only ever return user IDs (ints):
     *   • core already resolved the logged-in cookie natively → pass through
     *     (with the fxsim account-status gate applied);
     *   • a bridge bearer token (mobile/API clients) overrides with its own
     *     validated user.
     * The old explicit wp_validate_auth_cookie() fallback duplicated core and
     * broke under WP 7.1 — removed.
     */
    public static function force_cookie_auth( $user_id ) {
        if ( ! empty( $user_id ) && $user_id > 0 ) {
            $status = get_user_meta( (int) $user_id, 'fxsim_account_status', true );
            if ( $status === 'suspended' || $status === 'banned' ) return 0;
            return (int) $user_id; // core already resolved — pass through
        }

        // Bridge bearer token path (X-FXSIM-Token / Authorization header).
        $token = self::extract_token_from_request();
        if ( $token !== '' ) {
            $token_uid = self::validate_auth_token( $token );
            if ( $token_uid > 0 ) {
                $status = get_user_meta( $token_uid, 'fxsim_account_status', true );
                if ( $status === 'suspended' || $status === 'banned' ) return 0;
                wp_set_current_user( $token_uid );
                return $token_uid;
            }
        }

        return $user_id; // false/0 — not logged in; nothing to add
    }

    public static function generate_csrf_token( $user_id ) {
        return hash_hmac( 'sha256', 'fxsim-csrf-' . $user_id, wp_salt( 'nonce' ) );
    }

    private static function set_session_flag_cookie( int $user_id, bool $remember ): void {
        $domain = trim( (string) get_option( 'fxsim_cookie_domain', '' ) );
        if ( ! $domain && class_exists( 'FXSIM_Challenge_DB' ) ) {
            $domain = trim( (string) FXSIM_Challenge_DB::get_setting( 'cookie_domain', '' ) );
        }
        $expire = $remember ? time() + 30 * DAY_IN_SECONDS : 0; // 0 = browser-session cookie
        $args = [
            'expires'  => $expire,
            'path'     => '/',
            'secure'   => is_ssl(),
            'httponly' => false, // carries no sensitive data — a presence flag for edge middleware only
            'samesite' => is_ssl() ? 'None' : 'Lax',
        ];
        if ( $domain !== '' ) $args['domain'] = $domain;
        setcookie( 'fxsim_authed', '1', $args );
    }

    private static function clear_session_flag_cookie(): void {
        $domain = trim( (string) get_option( 'fxsim_cookie_domain', '' ) );
        if ( ! $domain && class_exists( 'FXSIM_Challenge_DB' ) ) {
            $domain = trim( (string) FXSIM_Challenge_DB::get_setting( 'cookie_domain', '' ) );
        }
        $args = [ 'expires' => time() - HOUR_IN_SECONDS, 'path' => '/', 'secure' => is_ssl(), 'httponly' => false, 'samesite' => is_ssl() ? 'None' : 'Lax' ];
        if ( $domain !== '' ) $args['domain'] = $domain;
        setcookie( 'fxsim_authed', '', $args );
    }

    /**
     * Skip WP Core's REST nonce CSRF check for the fxsim namespace.
     * Validates a custom stateless CSRF token instead.
     */
    public static function bypass_rest_nonce( $result ) {
        if ( ! empty( $result ) ) return $result; // a prior callback already decided
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        // SECURITY: strip the query string before any matching. Matching the raw
        // REQUEST_URI let attackers smuggle `?x=/fxsim/v1/auth/login` into ANY
        // endpoint's URL and skip the CSRF check entirely (substring + end
        // anchors matched the query string). Only the path may influence routing.
        $uri = preg_replace( '/\?.*$/', '', $uri );
        // Match this plugin's own namespace only — matching bare 'wp-json'/any
        // rest_route previously short-circuited Core's real nonce check (and
        // demanded this plugin's static CSRF token instead) for every other
        // REST client on the install: the block editor's own writes, or any
        // Application-Password integration, would 403 against this plugin's
        // token instead of their real WP nonce.
        $route_param = isset( $_GET['rest_route'] ) ? (string) $_GET['rest_route'] : '';
        if ( strpos( $uri, 'fxsim/v1' ) !== false || strpos( $route_param, 'fxsim/v1' ) !== false ) {
            // Ensure the user is identified from bearer token or cookie
            if ( get_current_user_id() === 0 ) {
                self::force_cookie_auth( 0 );
            }

            // Public auth endpoints establish their own session and must never demand
            // a pre-existing CSRF nonce — a stray unrelated logged-in cookie (e.g. an
            // admin's wp-admin session on the same domain) must not block a fresh
            // login/register/2FA attempt that has no session yet to have a nonce for.
            // logout is deliberately NOT exempt: unlike the others it acts on an
            // EXISTING session (which does have a nonce to present), and a
            // cross-site logout-CSRF can force-invalidate a signed-in victim's
            // tokens via the fxsim_token_version bump in logout() below.
            if ( preg_match( '#/fxsim/v1/auth/(login|register|2fa/verify)(?:$|[/?])#', $uri ) ) {
                return true;
            }
            $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
            if ( $method !== 'GET' && $method !== 'OPTIONS' ) {
                $user_id = get_current_user_id();
                if ( $user_id ) {
                    // Token-based requests (Authorization / X-FXSIM-Token) are immune to browser CSRF
                    $bearer_token = self::extract_token_from_request();
                    if ( $bearer_token !== '' && self::validate_auth_token( $bearer_token ) > 0 ) {
                        return true;
                    }

                    $header = $_SERVER['HTTP_X_WP_NONCE'] ?? '';
                    $expected = self::generate_csrf_token( $user_id );
                    if ( ! hash_equals( $expected, $header ) ) {
                        return new WP_Error( 'rest_cookie_invalid_nonce', __( 'CSRF token mismatch.' ), [ 'status' => 403 ] );
                    }
                }
            }
            return true; // authentication handled — stop Core's nonce check
        }
        return $result;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Routes
     * ──────────────────────────────────────────────────────────────── */

    public static function register_routes() {
        register_rest_route( 'fxsim/v1', '/auth/login', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'login' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'username' => [ 'required' => true, 'type' => 'string' ],
                'password' => [ 'required' => true, 'type' => 'string' ],
                'remember' => [ 'type' => 'boolean', 'default' => true ],
            ],
        ]);

        register_rest_route( 'fxsim/v1', '/auth/register', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'register' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'username' => [ 'required' => true, 'type' => 'string' ],
                'email'    => [ 'required' => true, 'type' => 'string' ],
                'password' => [ 'required' => true, 'type' => 'string' ],
            ],
        ]);

        register_rest_route( 'fxsim/v1', '/auth/2fa/verify', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'verify_2fa' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'uid'      => [ 'required' => true, 'type' => 'integer' ],
                'code'     => [ 'required' => true, 'type' => 'string' ],
                'remember' => [ 'type' => 'boolean', 'default' => true ],
            ],
        ]);

        register_rest_route( 'fxsim/v1', '/auth/logout', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'logout' ],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route( 'fxsim/v1', '/auth/me', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'me' ],
            'permission_callback' => '__return_true',
        ]);
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Handlers
     * ──────────────────────────────────────────────────────────────── */

    /**
     * Brute-force throttle shared by login() and verify_2fa(). Without this,
     * a 6-digit 2FA code (1-in-1,000,000 per guess) with a 10-minute TTL is
     * brute-forceable well within that window, and the password check itself
     * had no lockout at all.
     *
     * Budget: 10 failures per key per 15 minutes (~960 guesses/day per IP and
     * per account). The old 50/2min budget allowed ~36k guesses/day.
     */
    // bump/check use Redis INCRBY when available — a transient is a plain
    // read-modify-write with no atomicity, so concurrent requests (a scripted
    // burst hitting /auth/login at once) can all read the same low count
    // before any of their writes land, letting the real failure count run
    // far past the intended 10-per-15-min budget. Redis INCRBY is atomic
    // regardless of concurrency; transients remain the fallback when Redis
    // isn't configured, matching prior behavior rather than regressing it.
    private static function check_login_throttle( string $key ): bool {
        if ( class_exists( 'FXSIM_Redis_Client' ) && FXSIM_Redis_Client::available() ) {
            // INCRBY ...,0 atomically reads the counter (and creates it at 0
            // if absent) without disturbing its value or TTL.
            $count = FXSIM_Redis_Client::incrby( 'ptfx_fail_' . $key, 0 );
            if ( $count !== null ) return $count < 10;
        }
        return (int) get_transient( 'ptfx_fail_' . $key ) < 10;
    }
    private static function bump_login_throttle( string $key ): void {
        if ( class_exists( 'FXSIM_Redis_Client' ) && FXSIM_Redis_Client::available() ) {
            $new = FXSIM_Redis_Client::incrby( 'ptfx_fail_' . $key, 1 );
            if ( $new !== null ) {
                if ( $new === 1 ) FXSIM_Redis_Client::expire( 'ptfx_fail_' . $key, 15 * MINUTE_IN_SECONDS );
                return;
            }
        }
        set_transient( 'ptfx_fail_' . $key, (int) get_transient( 'ptfx_fail_' . $key ) + 1, 15 * MINUTE_IN_SECONDS );
    }
    private static function clear_login_throttle( string $key ): void {
        if ( class_exists( 'FXSIM_Redis_Client' ) && FXSIM_Redis_Client::available() ) {
            FXSIM_Redis_Client::del( 'ptfx_fail_' . $key );
        }
        delete_transient( 'ptfx_fail_' . $key );
    }

    public static function login( WP_REST_Request $req ) {
        $raw_user = trim( (string) $req->get_param( 'username' ) );
        $password = (string) $req->get_param( 'password' );
        $remember = (bool) $req->get_param( 'remember' );

        if ( empty( $raw_user ) || empty( $password ) ) {
            return new WP_Error( 'auth_failed', __( 'Username and password are required.' ), [ 'status' => 400 ] );
        }

        $ip_key  = 'ip_'  . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
        $usr_key = 'usr_' . md5( strtolower( $raw_user ) );
        if ( ! self::check_login_throttle( $ip_key ) || ! self::check_login_throttle( $usr_key ) ) {
            return new WP_Error( 'too_many_attempts', 'Too many attempts. Please try again later.', [ 'status' => 429 ] );
        }

        // Allow login by email directly
        if ( is_email( $raw_user ) ) {
            $user_obj = get_user_by( 'email', $raw_user );
            $username = $user_obj ? $user_obj->user_login : $raw_user;
        } else {
            $username = $raw_user;
        }

        // Validate credentials WITHOUT wp_signon
        $user = wp_authenticate( $username, $password );
        if ( is_wp_error( $user ) || !$user ) {
            // Also check by email if initial lookup missed
            if ( is_email( $raw_user ) ) {
                $user_by_email = get_user_by( 'email', $raw_user );
                if ( $user_by_email && wp_check_password( $password, $user_by_email->user_pass, $user_by_email->ID ) ) {
                    $user = $user_by_email;
                }
            }
        }

        if ( is_wp_error( $user ) || !$user ) {
            self::bump_login_throttle( $ip_key );
            self::bump_login_throttle( $usr_key );
            return new WP_Error( 'auth_failed', __( 'Invalid username or password.' ), [ 'status' => 401 ] );
        }

        $account_status = get_user_meta( $user->ID, 'fxsim_account_status', true );
        if ( $account_status === 'suspended' || $account_status === 'banned' ) {
            return new WP_Error( 'account_suspended', __( 'This account has been deactivated. Access revoked.' ), [ 'status' => 403 ] );
        }

        // Optional hard gate: admin accounts must have 2FA enrolled before they
        // can sign in. Enable via fxsim settings key `require_admin_2fa` = 1
        // AFTER every admin has enrolled, otherwise they will be locked out.
        $require_admin_2fa = class_exists( 'FXSIM_Challenge_DB' )
            && FXSIM_Challenge_DB::get_setting( 'require_admin_2fa', '0' ) === '1';
        $admin_has_2fa = class_exists( 'FXSIM_2FA' ) && FXSIM_2FA::is_enabled( (int) $user->ID );
        if ( $require_admin_2fa && user_can( $user, 'manage_options' ) && ! $admin_has_2fa ) {
            return new WP_Error(
                'admin_2fa_required',
                __( 'Two-factor authentication is required for staff accounts. Sign in to WordPress and enable 2FA from your profile, then try again.' ),
                [ 'status' => 403 ]
            );
        }

        // If 2FA is enabled, do NOT establish the session yet: send exactly one
        // code and ask the SPA to complete verification via /auth/2fa/verify.
        // Throttle stays armed until verify_2fa() actually succeeds — a correct
        // password alone must not clear it, or 2FA brute-forcing is unthrottled.
        if ( class_exists( 'FXSIM_2FA' ) && FXSIM_2FA::is_enabled( (int) $user->ID ) ) {
            // A correct password doesn't clear the login throttle (by design,
            // see above) but it also didn't previously cap how often a fresh
            // code gets sent — an attacker who already has the password could
            // loop this call to spam the victim's email/SMS. Cap sends per uid
            // separately from the failure-count throttle above.
            $send_key = 'send2fa_' . (int) $user->ID;
            if ( self::check_login_throttle( $send_key ) ) {
                self::bump_login_throttle( $send_key );
                FXSIM_2FA::send_code( (int) $user->ID );
            }
            return [
                'two_factor_required' => true,
                'uid'                 => (int) $user->ID,
            ];
        }

        self::clear_login_throttle( $ip_key );
        self::clear_login_throttle( $usr_key );

        // No 2FA — establish the session.
        wp_set_current_user( $user->ID );
        wp_set_auth_cookie( $user->ID, $remember, is_ssl() );
        self::set_session_flag_cookie( (int) $user->ID, (bool) $remember );

        self::log_user_ip( $user->ID );

        $token = self::generate_auth_token( (int) $user->ID, $remember ? 30 * DAY_IN_SECONDS : 86400 );

        return [
            'user'  => self::user_payload( $user ),
            'nonce' => self::generate_csrf_token( $user->ID ),
            'token' => $token,
        ];
    }

    public static function verify_2fa( WP_REST_Request $req ) {
        $uid  = (int) $req->get_param( 'uid' );
        $code = preg_replace( '/\D/', '', (string) $req->get_param( 'code' ) );

        $ip_key  = 'ip_'  . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
        $uid_key = 'uid_' . $uid;
        if ( ! self::check_login_throttle( $ip_key ) || ! self::check_login_throttle( $uid_key ) ) {
            return new WP_Error( 'too_many_attempts', 'Too many attempts. Please try again later.', [ 'status' => 429 ] );
        }

        if ( ! $uid || ! class_exists( 'FXSIM_2FA' ) || ! FXSIM_2FA::verify_code( $uid, $code ) ) {
            self::bump_login_throttle( $ip_key );
            self::bump_login_throttle( $uid_key );
            return new WP_Error( 'invalid_code', __( 'Invalid or expired verification code.' ), [ 'status' => 401 ] );
        }

        $user = get_user_by( 'id', $uid );
        if ( ! $user ) {
            return new WP_Error( 'invalid_code', __( 'Invalid or expired verification code.' ), [ 'status' => 401 ] );
        }

        $account_status = get_user_meta( $user->ID, 'fxsim_account_status', true );
        if ( $account_status === 'suspended' || $account_status === 'banned' ) {
            return new WP_Error( 'account_suspended', __( 'This account has been deactivated. Access revoked.' ), [ 'status' => 403 ] );
        }

        self::clear_login_throttle( $ip_key );
        self::clear_login_throttle( $uid_key );

        $remember = (bool) ( $req->get_param( 'remember' ) ?? true );

        wp_set_current_user( $user->ID );
        wp_set_auth_cookie( $user->ID, $remember, is_ssl() );
        self::set_session_flag_cookie( (int) $user->ID, $remember );

        self::log_user_ip( $user->ID );

        $token = self::generate_auth_token( (int) $user->ID, $remember ? 30 * DAY_IN_SECONDS : 86400 );

        return [
            'user'  => self::user_payload( $user ),
            'nonce' => self::generate_csrf_token( $user->ID ),
            'token' => $token,
        ];
    }

    public static function register( WP_REST_Request $req ) {
        if ( ! get_option( 'users_can_register' ) ) {
            return new WP_Error( 'registration_disabled', 'Registration is disabled.', [ 'status' => 403 ] );
        }
        // #8 Emergency control: global registration pause (whitelabel switch).
        if ( class_exists( 'FXSIM_Challenge_DB' ) ) {
            $pause_reg = FXSIM_Challenge_DB::get_setting( 'pause_registrations', '0' );
            if ( in_array( $pause_reg, [ '1', 1, 'true', true ], true ) ) {
                return new WP_Error( 'registration_paused', 'New registrations are temporarily paused.', [ 'status' => 503 ] );
            }
        }

        // Unlike login, this endpoint had no throttle at all — it doubles as
        // an unauthenticated account-creation script target otherwise. Reuses
        // the same 10-per-15-min budget under its own key prefix so it can't
        // burn a shared IP's login attempts (or vice versa).
        $reg_ip_key = 'reg_' . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
        if ( ! self::check_login_throttle( $reg_ip_key ) ) {
            return new WP_Error( 'too_many_attempts', 'Too many registration attempts. Please try again later.', [ 'status' => 429 ] );
        }
        // Every attempt counts here (not just failures like login) — the risk
        // is the call RATE itself (email-enumeration probing, mass account
        // creation), not just repeated wrong credentials.
        self::bump_login_throttle( $reg_ip_key );

        $username = sanitize_user( $req->get_param( 'username' ), true );
        $email    = sanitize_email( $req->get_param( 'email' ) );
        $password = (string) $req->get_param( 'password' );
        $ref_code = sanitize_text_field( (string) ( $req->get_param( 'ref' ) ?? '' ) );

        // Consistent policy: 8+ everywhere (matches /auth/change-password).
        if ( strlen( $password ) < 8 ) {
            return new WP_Error( 'weak_password', 'Password must be at least 8 characters.', [ 'status' => 400 ] );
        }
        if ( ! is_email( $email ) ) {
            return new WP_Error( 'invalid_email', 'Invalid email address.', [ 'status' => 400 ] );
        }
        if ( username_exists( $username ) ) {
            return new WP_Error( 'username_taken', 'That username is already taken.', [ 'status' => 409 ] );
        }
        if ( email_exists( $email ) ) {
            return new WP_Error( 'email_taken', 'That email is already registered.', [ 'status' => 409 ] );
        }

        $uid = wp_create_user( $username, $password, $email );
        if ( is_wp_error( $uid ) ) {
            return new WP_Error( 'register_failed', $uid->get_error_message(), [ 'status' => 400 ] );
        }

        // Trigger the parent plugin's verification email if it exists.
        if ( class_exists( 'FXSIM_REST_API' )
             && method_exists( 'FXSIM_REST_API', 'send_verification_email' ) ) {
            try {
                FXSIM_REST_API::send_verification_email( $uid );
            } catch ( \Throwable $e ) { /* non-fatal */ }
        }

        // Affiliate attribution (first-touch): record the referring affiliate.
        if ( $ref_code !== '' && class_exists( 'FXSIM_Affiliates' ) ) {
            $aff = FXSIM_Affiliates::get_by_code( $ref_code );
            if ( $aff && (int) $aff->user_id !== (int) $uid ) {
                update_user_meta( (int) $uid, 'fxsim_referred_by', (int) $aff->id );
            }
        }

        // Notify admins of the new registration.
        if ( class_exists( 'FXSIM_Database' )
             && method_exists( 'FXSIM_Database', 'push_admin_notification' ) ) {
            FXSIM_Database::push_admin_notification( 'info', 'New user registered',
                'A new account was created on the platform.', (int) $uid );
        }

        // Sign the new user in.
        wp_set_current_user( $uid );
        wp_set_auth_cookie( $uid, true, is_ssl() );
        self::set_session_flag_cookie( (int) $uid, true );

        $token = self::generate_auth_token( (int) $uid, 30 * DAY_IN_SECONDS );

        return [
            'user'  => self::user_payload( get_user_by( 'id', $uid ) ),
            'nonce' => self::generate_csrf_token( $uid ),
            'token' => $token,
        ];
    }

    private static function log_user_ip( $user_id ) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        if ( $ip ) {
            $ips = get_user_meta( $user_id, 'fxsim_recent_ips', true );
            if ( ! is_array( $ips ) ) $ips = [];
            if ( ! in_array( $ip, $ips ) ) {
                $ips[] = $ip;
                if ( count( $ips ) > 10 ) array_shift( $ips ); // keep last 10
                update_user_meta( $user_id, 'fxsim_recent_ips', $ips );
            }
        }
    }

    public static function logout() {
        // Invalidate bridge bearer tokens for this user — a stolen 30-day
        // token must not survive an explicit logout.
        $uid = get_current_user_id();
        if ( $uid ) {
            $v = (int) get_user_meta( $uid, 'fxsim_token_version', true );
            update_user_meta( $uid, 'fxsim_token_version', $v + 1 );
        }
        wp_logout();
        self::clear_session_flag_cookie();
        return [ 'success' => true ];
    }

    public static function me() {
        wp_get_current_user();
        $uid = get_current_user_id();
        if ( ! $uid ) {
            return new WP_Error( 'not_logged_in', 'Not authenticated.', [ 'status' => 401 ] );
        }
        $status = get_user_meta( $uid, 'fxsim_account_status', true );
        if ( $status === 'suspended' || $status === 'banned' ) {
            return new WP_Error( 'account_suspended', 'This account has been deactivated.', [ 'status' => 403 ] );
        }
        return self::user_payload( get_user_by( 'id', $uid ) );
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Helpers
     * ──────────────────────────────────────────────────────────────── */

    private static function user_payload( WP_User $u ): array {
        $is_admin = user_can( $u, 'manage_options' );
        // Admins are exempt from the email-verification requirement.
        $verified = $is_admin || (bool) get_user_meta( $u->ID, 'fxsim_email_verified', true );
        $two_fa   = class_exists( 'FXSIM_2FA' ) && method_exists( 'FXSIM_2FA', 'is_enabled' )
            ? (bool) FXSIM_2FA::is_enabled( $u->ID )
            : false;

        return [
            'id'             => (int) $u->ID,
            'username'       => $u->user_login,
            'email'          => $u->user_email,
            'display_name'   => $u->display_name,
            'is_admin'       => $is_admin,
            'email_verified' => $verified,
            'two_factor'     => $two_fa,
        ];
    }
}

ProTradeFX_Headless_Bridge::init();
