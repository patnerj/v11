<?php
/**
 * FXSIM_2FA — Two-factor authentication via email OTP.
 *
 * Approach: email-based OTP (no authenticator app required).
 * When enabled by a user, login generates a 6-digit code, stores it as a
 * transient (10-minute TTL), and emails it. The login handler checks for
 * a pending 2FA state and redirects to the verification page.
 *
 * No new DB tables: state stored in WP transients + user meta.
 *
 * User meta keys:
 *   fxsim_2fa_enabled  — bool: 1 = enabled
 *
 * Transient keys (per-user, 10min TTL):
 *   fxsim_2fa_{user_id} — 6-digit code
 *
 * Hooks:
 *   wp_login           — intercept login, generate/send code, redirect to verify page
 *   template_redirect  — serve POST to /verify-2fa/
 *
 * REST endpoints (added by FXSIM_REST_API):
 *   POST /auth/2fa/toggle   — enable/disable 2FA for current user
 *   GET  /auth/2fa/status   — current user's 2FA state
 */
defined('ABSPATH') || exit;

class FXSIM_2FA {

    const META_KEY     = 'fxsim_2fa_enabled';
    const TRANSIENT_PFX = 'fxsim_2fa_';
    const CODE_TTL     = 600; // 10 minutes

    // ── Registration ──────────────────────────────────────────────────────────

    public static function register(): void {
        // NOTE: This platform is headless — login happens through the REST bridge
        // (/auth/login), not the WordPress login form. The old wp_login redirect
        // flow (redirect to /verify-2fa/) is incompatible with a fetch()-based SPA
        // login: it broke the JSON response and re-sent codes on every retry.
        // 2FA is now handled by the bridge via send_code()/verify_code() below.
        // (Intentionally no wp_login / template_redirect hooks here.)
    }

    /** Generate a one-time code, store it, and email it to the user. */
    public static function send_code(int $user_id): void {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        set_transient(self::TRANSIENT_PFX . $user_id, $code, self::CODE_TTL);
        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send($user_id, '2fa_code', ['code' => $code]);
        }
    }

    /** Verify a submitted code against the stored transient (one-time use). */
    public static function verify_code(int $user_id, string $submitted): bool {
        $stored = get_transient(self::TRANSIENT_PFX . $user_id);
        if (!$stored || !hash_equals((string) $stored, $submitted)) return false;
        delete_transient(self::TRANSIENT_PFX . $user_id);
        return true;
    }

    // ── Login intercept ───────────────────────────────────────────────────────

    /**
     * Called by WP after successful password authentication.
     * If the user has 2FA enabled: generate code, email it, redirect to verify page.
     * If not enabled: no-op, normal login proceeds.
     */
    public static function on_login(string $login, WP_User $user): void {
        if (!get_user_meta($user->ID, self::META_KEY, true)) return;

        // Generate 6-digit code
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        set_transient(self::TRANSIENT_PFX . $user->ID, $code, self::CODE_TTL);

        // Send email
        FXSIM_Emails::send($user->ID, '2fa_code', ['code' => $code]);

        // Clear the auth cookie WP just set — force re-auth after OTP
        wp_clear_auth_cookie();

        // Redirect to verify page with user hint (no password exposed)
        $verify_url = add_query_arg([
            'fxsim_2fa_uid'  => $user->ID,
            'fxsim_2fa_nonce'=> wp_create_nonce('fxsim_2fa_' . $user->ID),
        ], home_url('/verify-2fa/'));

        wp_safe_redirect($verify_url);
        exit;
    }

    // ── OTP verification form handler ─────────────────────────────────────────

    /**
     * Handle POST submission from the /verify-2fa/ page.
     * Validates the code, logs the user in if correct.
     */
    public static function handle_verify_post(): void {
        // Guard: only run on the 2FA verification page.
        // Check by slug first; fall back to shortcode presence so this works
        // even when the admin chose a non-standard page name (same pattern as
        // FXSIM_Shortcodes::is_fxsim_page() used in the enqueue system).
        $on_verify_page = is_page('verify-2fa');
        if (!$on_verify_page) {
            $post = get_queried_object();
            if ($post instanceof WP_Post && has_shortcode($post->post_content, 'fxsim_verify_2fa')) {
                $on_verify_page = true;
            }
        }
        if (!$on_verify_page) return;
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;
        if (!isset($_POST['fxsim_2fa_code'], $_POST['fxsim_2fa_uid'], $_POST['fxsim_2fa_nonce'])) return;

        $user_id    = (int)$_POST['fxsim_2fa_uid'];
        $submitted  = sanitize_text_field($_POST['fxsim_2fa_code']);
        $nonce      = sanitize_text_field($_POST['fxsim_2fa_nonce']);

        // Verify nonce
        if (!wp_verify_nonce($nonce, 'fxsim_2fa_' . $user_id)) {
            self::verify_redirect($user_id, $nonce, 'Security check failed. Please log in again.');
            return;
        }

        $stored = get_transient(self::TRANSIENT_PFX . $user_id);

        if (!$stored) {
            self::verify_redirect($user_id, $nonce, 'Code expired. Please log in again.');
            return;
        }

        if (!hash_equals($stored, $submitted)) {
            self::verify_redirect($user_id, $nonce, 'Incorrect code. Check your email and try again.');
            return;
        }

        // Code valid — clear transient, set auth cookie, redirect to dashboard
        delete_transient(self::TRANSIENT_PFX . $user_id);
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, false);
        wp_safe_redirect(home_url('/dashboard/'));
        exit;
    }

    private static function verify_redirect(int $uid, string $nonce, string $error): void {
        wp_safe_redirect(add_query_arg([
            'fxsim_2fa_uid'   => $uid,
            'fxsim_2fa_nonce' => $nonce,
            'error'           => urlencode($error),
        ], home_url('/verify-2fa/')));
        exit;
    }

    // ── Enable / disable ──────────────────────────────────────────────────────

    public static function toggle(int $user_id, bool $enable): bool {
        if ($enable) {
            update_user_meta($user_id, self::META_KEY, 1);
        } else {
            delete_user_meta($user_id, self::META_KEY);
            delete_transient(self::TRANSIENT_PFX . $user_id);
        }
        FXSIM_Database::log_admin($user_id, $enable ? '2fa_enabled' : '2fa_disabled', $user_id);
        return true;
    }

    public static function is_enabled(int $user_id): bool {
        return (bool) get_user_meta($user_id, self::META_KEY, true);
    }
}
