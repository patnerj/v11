<?php
/**
 * Plugin Name:  PropFirm Launcher — Headless Bridge
 * Description:  Adds login/register/logout/me REST endpoints + CORS so the
 *               Next.js frontend can talk to the existing fxsim/v1 namespace.
 *               Drop into wp-content/plugins/ and activate. Does not modify
 *               the parent PropFirm_System plugin.
 * Version:      11.0.0
 * Author:       PropFirm Launcher
 * Requires PHP: 8.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class ProTradeFX_Headless_Bridge {

    /** Origins permitted to make cross-origin, credentialed calls. */
    const ALLOWED_ORIGINS = [
        'http://localhost:3000',
		'https://localhost:3000',
        'http://127.0.0.1:3000',
		'https://demo.launchapropfirm.com',
    ];

    /**
     * Production origins are derived at runtime from the configured frontend
     * URL (fxsim_frontend_url option, set in admin Settings) rather than
     * hardcoded — so a buyer's own domain is trusted automatically with no
     * code edit and no leftover references to any other domain.
     */
    private static function allowed_origins(): array {
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
        add_filter( 'determine_current_user', [ __CLASS__, 'force_cookie_auth' ], 1 );

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
            header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, Authorization' );
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
                header( 'Access-Control-Expose-Headers: X-WP-Nonce' );
                header( 'Vary: Origin' );
            }
            return $served;
        });
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Cross-origin cookie auth
     *  Resolves the current user from the logged-in cookie for fxsim/v1
     *  requests when WP hasn't already done so. Read-only: it never grants
     *  access beyond what the cookie itself authorises.
     * ──────────────────────────────────────────────────────────────── */

    public static function force_cookie_auth( $user_id ) {
        if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) return $user_id;
        if ( strpos( $_SERVER['REQUEST_URI'] ?? '', '/wp-json/fxsim/v1/' ) === false ) return $user_id;
        if ( ! empty( $user_id ) ) return $user_id; // already resolved

        if ( function_exists( 'wp_cookie_constants' ) ) wp_cookie_constants();
        $validated = wp_validate_auth_cookie( '', 'logged_in' );
        if ( $validated ) {
            wp_set_current_user( $validated );
            return $validated;
        }
        return $user_id;
    }

    /**
     * Scope WP Core's REST nonce CSRF check for the fxsim namespace, instead
     * of disabling it entirely.
     *
     * SECURITY FIX: this previously returned `true` unconditionally for the
     * whole fxsim/v1 namespace, fully disabling Core's cookie-nonce CSRF
     * check platform-wide. The comment justifying it ("endpoints still
     * require a logged-in user via permission callbacks") does not actually
     * defend against CSRF — CSRF's entire premise is that the victim's
     * browser IS already logged in and attaches the cookie automatically; a
     * simple (non-preflighted) HTML form POST from any origin bypasses CORS
     * entirely and would have been processed as a fully authenticated
     * request with zero CSRF protection, against every state-changing
     * cookie-authenticated endpoint in this namespace (this app's own
     * verify_nonce() in class-rest-api.php also only checks login state, not
     * a real nonce, so nothing else in the stack was catching this).
     *
     * Fix: only bypass Core's check for requests that genuinely don't need
     * it — safe HTTP methods, bearer-token-authenticated requests (a
     * browser never attaches an Authorization header automatically, so
     * these aren't CSRF-able), and anonymous/not-yet-logged-in requests
     * (nothing to forge). A cookie-authenticated, state-changing request
     * must present the nonce it was issued at login (the client already
     * receives and resends this — see login()/verify_2fa()/register()
     * returning wp_create_nonce('wp_rest'), and fxsim.ts already sends it
     * back as X-WP-Nonce on every non-public request).
     */
    public static function bypass_rest_nonce( $result ) {
        if ( ! empty( $result ) ) return $result; // a prior callback already decided
        if ( strpos( $_SERVER['REQUEST_URI'] ?? '', 'fxsim/v1' ) === false ) return $result;

        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ( in_array( $method, [ 'GET', 'HEAD', 'OPTIONS' ], true ) ) return true;

        $auth_header = trim( (string) ( $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '' ) );
        if ( str_starts_with( $auth_header, 'Bearer fxa_' ) ) return true;

        if ( ! is_user_logged_in() ) return true;

        $nonce = $_SERVER['HTTP_X_WP_NONCE'] ?? ( $_REQUEST['_wpnonce'] ?? '' );
        if ( $nonce && wp_verify_nonce( $nonce, 'wp_rest' ) ) return true;

        return new WP_Error( 'rest_cookie_invalid_nonce', 'Cookie check failed. Please refresh and try again.', [ 'status' => 403 ] );
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
                'uid'  => [ 'required' => true, 'type' => 'integer' ],
                'code' => [ 'required' => true, 'type' => 'string' ],
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
     * Brute-force throttle shared by login() and verify_2fa() — this is the
     * endpoint the frontend actually calls (api.auth.login() in fxsim.ts),
     * unlike class-token-auth.php's separately-protected /auth/token, which
     * has its own equivalent throttle but appears unused by the SPA. Without
     * this, a 6-digit 2FA code (1-in-1,000,000 per guess) with a 10-minute
     * TTL is brute-forceable well within that window, and the password check
     * itself had no lockout at all.
     */
    private static function check_login_throttle( string $key ): bool {
        return (int) get_transient( 'ptfx_fail_' . $key ) < 10;
    }
    private static function bump_login_throttle( string $key ): void {
        set_transient( 'ptfx_fail_' . $key, (int) get_transient( 'ptfx_fail_' . $key ) + 1, 15 * MINUTE_IN_SECONDS );
    }
    private static function clear_login_throttle( string $key ): void {
        delete_transient( 'ptfx_fail_' . $key );
    }

    public static function login( WP_REST_Request $req ) {
        $username = sanitize_user( $req->get_param( 'username' ), true );
        $password = (string) $req->get_param( 'password' );
        $remember = (bool) $req->get_param( 'remember' );

        $ip_key  = 'ip_'  . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
        $usr_key = 'usr_' . md5( strtolower( $username ) );
        if ( ! self::check_login_throttle( $ip_key ) || ! self::check_login_throttle( $usr_key ) ) {
            return new WP_Error( 'too_many_attempts', 'Too many attempts. Please try again later.', [ 'status' => 429 ] );
        }

        // Allow login by email.
        if ( is_email( $username ) ) {
            $user = get_user_by( 'email', $username );
            if ( $user ) $username = $user->user_login;
        }

        // Validate credentials WITHOUT wp_signon — wp_signon fires the `wp_login`
        // action and (historically) a 2FA redirect that breaks the SPA fetch.
        $user = wp_authenticate( $username, $password );
        if ( is_wp_error( $user ) ) {
            self::bump_login_throttle( $ip_key );
            self::bump_login_throttle( $usr_key );
            return new WP_Error( 'auth_failed', __( 'Invalid username or password.' ), [ 'status' => 401 ] );
        }

        // If 2FA is enabled, do NOT establish the session yet: send exactly one
        // code and ask the SPA to complete verification via /auth/2fa/verify.
        if ( class_exists( 'FXSIM_2FA' ) && FXSIM_2FA::is_enabled( (int) $user->ID ) ) {
            FXSIM_2FA::send_code( (int) $user->ID );
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

        return [
            'user'  => self::user_payload( $user ),
            'nonce' => wp_create_nonce( 'wp_rest' ),
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

        self::clear_login_throttle( $ip_key );
        self::clear_login_throttle( $uid_key );

        wp_set_current_user( $user->ID );
        wp_set_auth_cookie( $user->ID, true, is_ssl() );

        return [
            'user'  => self::user_payload( $user ),
            'nonce' => wp_create_nonce( 'wp_rest' ),
        ];
    }

    public static function register( WP_REST_Request $req ) {
        if ( ! get_option( 'users_can_register' ) ) {
            return new WP_Error( 'registration_disabled', 'Registration is disabled.', [ 'status' => 403 ] );
        }
        // #8 Emergency control: global registration pause (whitelabel switch).
        if ( class_exists( 'FXSIM_Challenge_DB' ) && FXSIM_Challenge_DB::get_setting( 'pause_registrations', '' ) === '1' ) {
            return new WP_Error( 'registration_paused', 'New registrations are temporarily paused.', [ 'status' => 503 ] );
        }

        $username = sanitize_user( $req->get_param( 'username' ), true );
        $email    = sanitize_email( $req->get_param( 'email' ) );
        $password = (string) $req->get_param( 'password' );
        $ref_code = sanitize_text_field( (string) ( $req->get_param( 'ref' ) ?? '' ) );

        if ( strlen( $password ) < 6 ) {
            return new WP_Error( 'weak_password', 'Password must be at least 6 characters.', [ 'status' => 400 ] );
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

        return [
            'user'  => self::user_payload( get_user_by( 'id', $uid ) ),
            'nonce' => wp_create_nonce( 'wp_rest' ),
        ];
    }

    public static function logout() {
        wp_logout();
        return [ 'success' => true ];
    }

    public static function me() {
        wp_get_current_user();
        $uid = get_current_user_id();
        if ( ! $uid ) {
            return new WP_Error( 'not_logged_in', 'Not authenticated.', [ 'status' => 401 ] );
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
