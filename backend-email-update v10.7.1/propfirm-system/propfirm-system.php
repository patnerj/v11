<?php
/**
 * Plugin Name: PropFirm System
 * Plugin URI:  https://example.com/propfirm-system
 * Description: Complete white-label prop firm platform — challenge engine, funded accounts, payout system, TradingView charts, and full admin panel.
 * Version:     11.0.0
 * Author:      PropFirm Systems
 * Author URI:  https://propfirm.systems
 * License:     Proprietary
 * Text Domain: fxsim
 */

defined('ABSPATH') || exit;

// Version must match the plugin header
define('FXSIM_VERSION', '11.0.3');
define('FXSIM_DIR',     plugin_dir_path(__FILE__));
define('FXSIM_URL',     plugin_dir_url(__FILE__));
// Default SPA origin for this deployment. The `fxsim_frontend_url` option, if
// set, takes precedence — this constant is the shipped fallback so email
// verification links, Stripe redirects, notification deep-links and KYC doc
// CORS all resolve to the frontend even before the option is configured.
// Frontend URL fallback. The admin sets the real value in Settings (stored as
// the fxsim_frontend_url option); this constant is only a last resort and must
// NOT hardcode any specific external domain — default to the install's own URL
// so verification links, redirects and deep-links are always domain-correct on
// a fresh install. A buyer can still override via wp-config if frontend lives
// on a different host.
if (!defined('FXSIM_FRONTEND_URL')) define('FXSIM_FRONTEND_URL', home_url());
define('FXSIM_PREFIX',  'fxsim_');

// ── Autoload includes ──────────────────────────────────────────────────────────
require_once FXSIM_DIR . 'includes/class-database.php';
require_once FXSIM_DIR . 'includes/class-symbols.php';
require_once FXSIM_DIR . 'includes/class-cache.php';        // cache abstraction — must precede price feed
require_once FXSIM_DIR . 'includes/class-price-feed.php';
require_once FXSIM_DIR . 'includes/class-trading-engine.php';
// Challenge system — loaded early: class-emails, class-payments, and class-rest-api
// all call FXSIM_Challenge_DB / FXSIM_Challenge_Engine directly (no class_exists guards),
// so the DB and engine must be defined before any of those files are parsed.
require_once FXSIM_DIR . 'includes/challenge/class-challenge-db.php';
require_once FXSIM_DIR . 'includes/challenge/class-challenge-engine.php';
require_once FXSIM_DIR . 'includes/class-emails.php';
require_once FXSIM_DIR . 'includes/class-payments.php';
require_once FXSIM_DIR . 'includes/class-coupons.php';
require_once FXSIM_DIR . 'includes/class-affiliates.php';
require_once FXSIM_DIR . 'includes/class-rate-limiter.php';  // rate limiting — must precede REST API
require_once FXSIM_DIR . 'includes/class-api-keys.php';      // API key auth — must precede REST API
require_once FXSIM_DIR . 'includes/class-rest-api.php';
require_once FXSIM_DIR . 'includes/class-webhooks.php';
require_once FXSIM_DIR . 'includes/class-pwa.php';           // PWA support — manifest, SW, meta tags
require_once FXSIM_DIR . 'includes/class-2fa.php';            // Two-factor authentication
require_once FXSIM_DIR . 'includes/class-icons.php';           // SVG icon library
require_once FXSIM_DIR . 'includes/class-shortcodes.php';
require_once FXSIM_DIR . 'admin/class-admin.php';
require_once FXSIM_DIR . 'includes/stripe/class-stripe.php';
require_once FXSIM_DIR . 'includes/class-scaling-engine.php';  // v11: automated scaling plans
require_once FXSIM_DIR . 'includes/class-confirmo.php';        // v11: Confirmo crypto payments
require_once FXSIM_DIR . 'includes/class-pvp-engine.php';      // v11.1: 1v1 PvP E-Sports Arena engine
require_once FXSIM_DIR . 'includes/class-push.php';             // v10.7.3: push notification foundation (device registry + queue)

// ── Activation / Deactivation ─────────────────────────────────────────────────
// Activation order is intentional:
// 1. FXSIM_Challenge_DB::install() creates fxsim_challenge_accounts and related tables first
// 2. FXSIM_Database::install() then runs ALTER TABLE migrations including adding
//    weekend_close_week to fxsim_challenge_accounts — table must exist first
register_activation_hook(__FILE__,   ['FXSIM_Challenge_DB', 'install']);
register_activation_hook(__FILE__,   ['FXSIM_Database', 'install']);
register_activation_hook(__FILE__,   'fxsim_create_pages');
// BUG-001: a prop-firm platform must accept trader sign-ups out of the box.
// WordPress ships with users_can_register = 0, which made the headless
// /auth/register endpoint return "Registration is disabled" on every fresh
// install until an admin manually flipped the core setting. Enable it once on
// activation (only if the option has never been set), so registration works by
// default while the admin can still explicitly disable it afterwards.
register_activation_hook(__FILE__, function () {
    if (get_option('users_can_register', null) === null || get_option('users_can_register') === false) {
        update_option('users_can_register', 1);
    } elseif ((int) get_option('users_can_register') === 0 && get_option('fxsim_reg_default_applied') !== '1') {
        // First activation of this plugin on a default WP install — opt in once.
        update_option('users_can_register', 1);
    }
    update_option('fxsim_reg_default_applied', '1');
});
register_deactivation_hook(__FILE__, ['FXSIM_Database', 'deactivate']);

// ── Auto-create required pages ────────────────────────────────────────────
function fxsim_create_pages(): void {
    $pages = [
        'trading'      => ['title' => 'Trading Terminal',    'content' => '[fxsim_terminal]'],
        'login'        => ['title' => 'Login',               'content' => '[fxsim_login]'],
        'register'     => ['title' => 'Register',            'content' => '[fxsim_register]'],
        'landing'      => ['title' => 'PropFirm System',     'content' => '[fxsim_landing]'],
        'dashboard'    => ['title' => 'My Dashboard',        'content' => '[fxsim_dashboard]'],
        'challenges'   => ['title' => 'Challenge Programs',  'content' => '[fxsim_challenges]'],
        'statistics'   => ['title' => 'My Statistics',       'content' => '[fxsim_statistics]'],
        'leaderboard'  => ['title' => 'Leaderboard',         'content' => '[fxsim_leaderboard]'],
        'certificate'  => ['title' => 'My Certificate',      'content' => '[fxsim_certificate]'],
        'reset-password' => ['title' => 'Reset Password',    'content' => '[fxsim_reset_password]'],
        'challenge-rules'=> ['title' => 'Challenge Rules',   'content' => '[fxsim_challenge_rules]'],
        'profile'        => ['title' => 'My Profile',        'content' => '[fxsim_profile]'],
        'verify-2fa'     => ['title' => 'Verify Login',       'content' => '[fxsim_verify_2fa]'],
    ];
    foreach ($pages as $slug => $data) {
        if (!get_page_by_path($slug)) {
            wp_insert_post([
                'post_title'   => $data['title'],
                'post_content' => $data['content'],
                'post_status'  => 'publish',
                'post_type'    => 'page',
                'post_name'    => $slug,
            ]);
        }
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
add_action('plugins_loaded', function () {
    // Auto-run schema migrations when the plugin version changes, so new tables
    // and columns (e.g. fxsim_kyc, the payout 'under_review' status) apply
    // WITHOUT a manual plugin reactivation. The install() routines are
    // idempotent: dbDelta + SHOW COLUMNS-guarded ALTER + COUNT-guarded seeds.
    if (get_option('fxsim_db_version') !== FXSIM_VERSION) {
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        FXSIM_Challenge_DB::install();
        FXSIM_Database::install();
    }

    // V10.6 (H2) — feature-level migrations. FXSIM_VERSION has intentionally
    // not changed across V10.x (no schema changes), which meant additive data
    // top-ups gated behind the version check never ran for file-replacement
    // upgrades. This independent, integer-stepped ladder runs them exactly
    // once per install, costs a single autoloaded-option read when satisfied,
    // and every step is idempotent.
    $fxsim_feature_level = (int) get_option('fxsim_feature_level', 0);
    if ($fxsim_feature_level < 1) {
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'ensure_index_symbols')) {
            FXSIM_Database::ensure_index_symbols(); // V10.5 index catalog
        }
        update_option('fxsim_feature_level', 1, false);
    }
    if ($fxsim_feature_level < 2) {
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'ensure_extra_symbols')) {
            FXSIM_Database::ensure_extra_symbols(); // V10.6.1 oil + cross pairs
        }
        update_option('fxsim_feature_level', 2, false);
    }
    if ($fxsim_feature_level < 3) {
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'ensure_push_tables')) {
            FXSIM_Database::ensure_push_tables(); // V10.7.3 push notification foundation tables
        }
        update_option('fxsim_feature_level', 3, false);
    }
    if ($fxsim_feature_level < 4) {
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'ensure_kyc_columns')) {
            FXSIM_Database::ensure_kyc_columns(); // V10.7.4 KYC Back ID column support
        }
        update_option('fxsim_feature_level', 4, false);
    }
    if ($fxsim_feature_level < 5) {
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'ensure_admin_notes_table')) {
            FXSIM_Database::ensure_admin_notes_table(); // V11.0.3 persistent append-only admin notes
        }
        update_option('fxsim_feature_level', 5, false);
    }

    FXSIM_REST_API::register();

    // Admin notification center: observe phase events the engine already emits
    // (no engine modification — we only listen to its action hook).
    add_action('fxsim_challenge_event', function ($event, $user_id, $data = []) {
        if (!class_exists('FXSIM_Database')) return;
        $map = [
            'phase_passed'     => ['success', 'Phase passed'],
            'challenge_passed' => ['success', 'Challenge passed — account funded'],
            'challenge_failed' => ['warning', 'Challenge failed'],
        ];
        if (!isset($map[$event])) return;
        [$type, $title] = $map[$event];
        FXSIM_Database::push_admin_notification($type, $title, $title, (int) $user_id);
    }, 10, 3);
    FXSIM_Shortcodes::register();
    FXSIM_Admin::init();
    FXSIM_PWA::register();
    FXSIM_Emails::register(); // SMTP configuration + failure logging
    FXSIM_2FA::register();    // Two-factor authentication
    FXSIM_Push::register();   // Device registry + push queue (delivery unimplemented by design)

    // 30-second price cron
    add_action('fxsim_price_update', ['FXSIM_Price_Feed', 'update_all_prices']);
    if (!wp_next_scheduled('fxsim_price_update')) {
        wp_schedule_event(time(), 'fxsim_30s', 'fxsim_price_update');
    }

    // Module 1: pending orders + weekend holding run after every price update
    // These are registered separately so they can be unhooked in tests/future modules
    add_action('fxsim_price_update', ['FXSIM_Trading_Engine', 'process_pending_orders'], 20);
    add_action('fxsim_price_update', ['FXSIM_Trading_Engine', 'check_weekend_holding'],  30);

    // Daily-tasks watchdog: checked from the price cron (fires every ~30s) so
    // fxsim_daily_tasks is monitored by a DIFFERENT cron than itself — the
    // original health check only monitored the price cron from inside the
    // daily-tasks cron, so a silently-dead daily-tasks cron had no watchdog
    // at all. At most one alert email per check (throttled via a transient),
    // and only once daily_tasks has had a chance to run at least once.
    add_action('fxsim_price_update', function () {
        $last = (int) get_option('fxsim_last_daily_tasks_run', 0);
        if ($last === 0) return; // hasn't run yet since activation — nothing to alert on
        $stale_seconds = time() - $last;
        if ($stale_seconds <= DAY_IN_SECONDS + (2 * HOUR_IN_SECONDS)) return; // within schedule + buffer
        if (get_transient('fxsim_daily_tasks_stale_alerted')) return; // already alerted recently
        set_transient('fxsim_daily_tasks_stale_alerted', 1, 6 * HOUR_IN_SECONDS);

        $brand = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        $hours = round($stale_seconds / HOUR_IN_SECONDS, 1);
        wp_mail(get_option('admin_email'),
            "[{$brand}] ⚠ Daily Tasks Cron Not Running — Action Required",
            "<p>fxsim_daily_tasks has not completed successfully in <strong>{$hours} hours</strong> (expected every 24h).</p>"
            . "<p>Swaps, breach/promotion evaluation, and scaling checks are not running. Check your server cron and the PHP error log.</p>",
            ['Content-Type: text/html; charset=UTF-8']
        );
        error_log("[PropFirm] fxsim_daily_tasks watchdog: stale for {$hours} hours, admin alerted.");
    }, 40);

    // Daily tasks: swaps + challenge snapshots/time-checks (replaces old fxsim_daily_swap)
    add_action('fxsim_daily_tasks', function () {
        global $wpdb;
        // Concurrency guard: without this, an overlapping run (a slow prior
        // execution still in progress when WP-Cron fires again) could apply
        // swaps twice, or race breach()/promote() against a second pass over
        // the same challenges. Matches the GET_LOCK pattern already used by
        // check_sl_tp()/process_pending_orders()/check_margin_levels().
        $lock_key = 'fxsim_daily_tasks_running';
        $locked = $wpdb->get_var($wpdb->prepare("SELECT GET_LOCK(%s, 0)", $lock_key));
        if (!$locked) {
            error_log('[PropFirm] fxsim_daily_tasks: skipped — a previous run is still in progress.');
            return;
        }
        try {
            FXSIM_Trading_Engine::apply_daily_swaps();
            FXSIM_Challenge_Engine::daily_tasks();
            if (class_exists('FXSIM_Push')) FXSIM_Push::cleanup();
            // NOTE: daily_scaling_check() was previously called a second time
            // here, AFTER FXSIM_Challenge_Engine::daily_tasks() already calls
            // it internally — every funded account got evaluated twice per
            // run. is_eligible()'s own interval check happened to make this
            // self-guarding (the first pass's last_scaled_at update made the
            // second pass ineligible), so it was wasted work, not a double
            // scale-up — but still removed as dead/redundant.

            // Watchdog timestamp: the price-tick cron (fxsim_price_update,
            // which fires every ~30s) checks this for staleness below. The
            // old health check only monitored the PRICE cron, from inside
            // THIS cron — if fxsim_daily_tasks itself silently stopped
            // firing, nothing would ever have noticed. This makes the two
            // crons watch each other instead of one watching only the other.
            update_option('fxsim_last_daily_tasks_run', time(), false);
        } catch (\Throwable $e) {
            error_log('[PropFirm] fxsim_daily_tasks failed: ' . $e->getMessage());
        } finally {
            $wpdb->query($wpdb->prepare("SELECT RELEASE_LOCK(%s)", $lock_key));
        }

        // ── Cron health check (once per day) ──────────────────────────────────
        $last_run  = (int) get_option('fxsim_last_price_update', 0);
        $staleness = time() - $last_run;
        $brand     = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';

        if ($last_run > 0 && $staleness > 600) {
            $mins = round($staleness / 60);
            wp_mail(get_option('admin_email'),
                "[{$brand}] ⚠ Price Cron Not Running — Action Required",
                "<p>The price update cron has not run for <strong>{$mins} minutes</strong>.</p>"
                . "<p>Traders are receiving simulated prices. Add this server cron job:</p>"
                . "<code>* * * * * wget -q -O - " . site_url('/?doing_wp_cron') . " &gt; /dev/null 2&gt;&amp;1</code>",
                ['Content-Type: text/html; charset=UTF-8']
            );
        }
        if ((int) get_option('fxsim_price_feed_failed', 0) > (time() - 86400)) {
            wp_mail(get_option('admin_email'),
                "[{$brand}] ⚠ Price Feed Failing — Simulation Mode Active",
                "<p>Live prices could not be fetched in the last 24 hours. Configure Twelve Data: Settings → Price Feed.</p>",
                ['Content-Type: text/html; charset=UTF-8']
            );
        }
    });
    if (!wp_next_scheduled('fxsim_daily_tasks')) {
        wp_schedule_event(time(), 'daily', 'fxsim_daily_tasks');
    }

    // After trade close: evaluate challenge rules
    add_action('fxsim_trade_closed', function (int $account_id) {
        global $wpdb;
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE fxsim_account_id=%d AND status='active' LIMIT 1", $account_id
        ));
        if ($ch) FXSIM_Challenge_Engine::evaluate_after_trade((int)$ch->id);
    }, 10, 1);

    // After trade open: increment trading day counter
    add_action('fxsim_trade_opened', function (int $account_id) {
        global $wpdb;
        // 'funded' must be included here, not just 'active' — otherwise
        // trading_days permanently stops incrementing the moment a trader
        // gets funded, which silently breaks any minimum-trading-days-before
        // -payout gate for every funded account from that point forward.
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE fxsim_account_id=%d AND status IN ('active','funded') LIMIT 1", $account_id
        ));
        if ($ch) FXSIM_Challenge_Engine::increment_trading_days((int)$ch->id);
    }, 10, 1);
});

// ── Full-screen terminal: strip WP theme chrome on /trading/ ─────────────────
add_action('template_redirect', function () {
    if (is_page('trading') && is_user_logged_in()) {
        add_action('wp_head', function () {
            echo '<style>
/* Terminal: hide Astra chrome, let our fixed-position terminal take full viewport */
#wpadminbar,
.ast-site-header-wrap, .site-header, .main-header-bar,
.ast-above-header, .ast-below-header, .ast-mobile-header,
.site-footer, .footer-widget-area, .ast-footer-copyright,
.ast-breadcrumbs-wrapper, .entry-header, .entry-footer,
.sidebar, .widget-area { display:none !important; }

html, body {
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #060b14 !important;
}

/* Remove Astra content area padding without nuking display */
#content, .site-content, .ast-container,
.entry-content, .ast-article-single,
.hentry, .post-type-page { 
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
}
</style>';
        });
    }
});

// ── Add body class on plugin pages for reliable CSS targeting ────────────────
add_filter('body_class', function (array $classes): array {
    $plugin_pages = ['dashboard', 'challenges', 'landing', 'login', 'register', 'trading', 'statistics', 'leaderboard', 'certificate', 'reset-password', 'challenge-rules', 'profile', 'verify-2fa'];
    foreach ($plugin_pages as $slug) {
        if (is_page($slug)) {
            $classes[] = 'propfirm-page';
            $classes[] = 'propfirm-page-' . $slug;
            break;
        }
    }
    return $classes;
});

// ── Favicon + brand meta from WhiteLabel settings ──────────────────────────
add_action('wp_head', function () {
    if (!class_exists('FXSIM_Challenge_DB')) return;
    $favicon = FXSIM_Challenge_DB::get_setting('favicon_url', '');
    $color   = FXSIM_Challenge_DB::get_setting('primary_color', '#7c6ef5');
    if ($favicon) {
        echo '<link rel="icon" type="image/x-icon" href="' . esc_url($favicon) . '">' . "\n";
        echo '<link rel="shortcut icon" href="' . esc_url($favicon) . '">' . "\n";
        echo '<link rel="apple-touch-icon" href="' . esc_url($favicon) . '">' . "\n";
    }
    echo '<meta name="theme-color" content="' . esc_attr($color) . '">' . "\n";
}, 1);

// ── Strip Astra theme chrome on all plugin pages ──────────────────────────────
add_action('wp_head', function () {
    $plugin_pages = ['dashboard', 'challenges', 'landing', 'login', 'register', 'trading', 'statistics', 'leaderboard', 'certificate', 'reset-password', 'challenge-rules', 'profile', 'verify-2fa'];
    $is_plugin_page = false;
    if (!$is_plugin_page) return;

    echo '<style>
/* ── PropFirm System: Astra theme chrome removal ── */

/* Hide header/nav */
#wpadminbar,
.ast-site-header-wrap, .site-header, .main-header-bar,
.ast-above-header, .ast-below-header, .ast-mobile-header,
.ast-primary-header-bar, .ast-desktop-header,
.main-navigation, .ast-nav-menu {
    display: none !important;
}

/* Hide footer */
.site-footer, footer.site-footer,
.footer-widget-area, .ast-footer-copyright,
#colophon { display: none !important; }

/* Hide sidebar */
#secondary, .widget-area, .sidebar,
.ast-sidebar-wrap, .ast-right-sidebar,
.ast-left-sidebar { display: none !important; }

/* Hide page meta elements */
.entry-header, .entry-footer, .entry-meta,
.ast-breadcrumbs-wrapper, .ast-above-header-bar,
.post-navigation, .page-links,
.comments-area, .post-thumbnail,
.page-hero-section { display: none !important; }

/* Dark background */
html, body {
    background: #060b14 !important;
    color: #dde8f5 !important;
}

/* Remove Astra content padding/margins - keep display intact */
#content, #primary, #main,
.site-content, .content-area,
.ast-container, .ast-row,
.entry-content, .ast-article-single,
.hentry, .ast-separate-container,
.post-type-page .site-content {
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    box-shadow: none !important;
    border: none !important;
    background: transparent !important;
}

/* Ensure our plugin containers are fully visible */
.fxsim-landing, .fxsim-auth-wrap, .fxsim-dash,
#fxsim-terminal, #fxsim-dashboard, #fxsim-challenges {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
}
</style>';
});

// ── Whitelabel CSS vars injected into <head> on every frontend page ──────────
add_action('wp_head', function () {
    if (class_exists('FXSIM_Challenge_DB')) {
        $primary   = FXSIM_Challenge_DB::get_setting('primary_color',   '#00d4ff');
        $secondary = FXSIM_Challenge_DB::get_setting('secondary_color', '#00e5a0');
        $primary   = preg_match('/^#[0-9a-fA-F]{3,6}$/', $primary)   ? $primary   : '#00d4ff';
        $secondary = preg_match('/^#[0-9a-fA-F]{3,6}$/', $secondary) ? $secondary : '#00e5a0';
        echo "<style>:root{--accent:{$primary};--green:{$secondary};}</style>\n";
    }
});

add_filter('cron_schedules', function ($schedules) {
    $schedules['fxsim_30s'] = ['interval' => 30, 'display' => '30 Seconds'];
    return $schedules;
});

// ── Registration POST: handled here at template_redirect (before ANY HTML output) ──
// This is the ONLY correct place to handle form POSTs that need to redirect.
// Shortcodes run inside the_content() — headers are already sent by then.
add_action('template_redirect', function () {
    // Only process on the register page
    if (!is_page('register')) return;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;
    if (!isset($_POST['fxsim_register_nonce'])) return;

    if (!wp_verify_nonce($_POST['fxsim_register_nonce'], 'fxsim_register')) {
        // Bad nonce — store error keyed by IP so shortcode can display it
        set_transient('fxsim_reg_error_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x'), 'Security check failed.', 60);
        return;
    }

    // #8 Emergency control: global registration pause (whitelabel switch)
    if (class_exists('FXSIM_Challenge_DB')) {
        $pause_reg = FXSIM_Challenge_DB::get_setting('pause_registrations', '0');
        if (in_array($pause_reg, ['1', 1, 'true', true], true)) {
            set_transient('fxsim_reg_error_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x'), 'New registrations are temporarily paused by administration.', 60);
            return;
        }
    }

    $username = sanitize_user($_POST['username'] ?? '');
    $email    = sanitize_email($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    $error = '';
    if (strlen($password) < 6) {
        $error = 'Password must be at least 6 characters.';
    } elseif (username_exists($username)) {
        $error = 'Username already taken.';
    } elseif (email_exists($email)) {
        $error = 'Email already registered.';
    } else {
        $uid = wp_create_user($username, $password, $email);
        if (is_wp_error($uid)) {
            $error = $uid->get_error_message();
        } else {
            $user = new WP_User($uid);
            $user->set_role('subscriber');
            wp_set_current_user($uid);
            wp_set_auth_cookie($uid, true);
            // Defer both emails to WP-Cron so the redirect fires immediately.
            // wp_mail() over SMTP is synchronous and can block for up to 300 s
            // if the SMTP server is slow or unreachable — scheduling avoids the hang.
            wp_schedule_single_event(time(), 'fxsim_send_welcome_email',      [$uid]);
            wp_schedule_single_event(time(), 'fxsim_send_verification_email', [$uid]);
            // Create welcome notification
            FXSIM_Database::push_notification($uid, 'success',
                '🎉 Welcome to ' . (class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name','PropFirm System') : 'PropFirm System') . '!',
                'Your account is ready. Browse challenges to get started.',
                home_url('/challenges/')
            );
            // Redirect to dashboard with param to show "check your email" banner
            wp_safe_redirect(home_url('/dashboard/?registered=1'));
            exit;
        }
    }

    // Store error in a transient keyed by IP so shortcode can display it
    if ($error) {
        $key = 'fxsim_reg_error_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x');
        set_transient($key, $error, 60);
    }
});
add_filter('login_redirect', function ($redirect, $request, $user) {
    if ($user && !is_wp_error($user) && !current_user_can('manage_options')) {
        return home_url('/dashboard/');
    }
    return $redirect;
}, 10, 3);

// ── Registration deferred email callbacks ────────────────────────────────────
// These hooks are fired by WP-Cron after registration, keeping the main
// request free of SMTP latency. Both callbacks guard against missing classes
// and invalid user IDs so a stale/duplicate cron job is always a safe no-op.
add_action('fxsim_send_welcome_email', function (int $uid): void {
    if (!get_userdata($uid)) return;
    if (class_exists('FXSIM_Emails')) {
        FXSIM_Emails::send($uid, 'welcome', []);
    }
});
add_action('fxsim_send_verification_email', function (int $uid): void {
    if (!get_userdata($uid)) return;
    if (class_exists('FXSIM_REST_API')) {
        FXSIM_REST_API::send_verification_email($uid);
    }
});

// ── Deferred branded admin notification email (kept off the request path) ─────
add_action('fxsim_admin_email', function (string $subject, string $message): void {
    if (class_exists('FXSIM_Emails')) FXSIM_Emails::send_admin($subject, $subject, $message);
}, 10, 2);

// Suppress WordPress's plain-text new-user admin email — admins get the branded
// "New user registered" notification + branded admin email instead.
if (!function_exists('wp_new_user_notification')) {
    // Only define if a theme/plugin hasn't already; pluggable override.
    function wp_new_user_notification($user_id, $deprecated = null, $notify = '') {
        if ($notify === 'user' || $notify === 'both') {
            // Still allow the user-facing side if WP requests it; the platform's
            // own verification email is the primary user touchpoint.
        }
        // Intentionally send no admin email here.
    }
}

// Suppress WordPress core's "Password changed for user X" email to the site
// admin — password resets are the trader's business only (#8). Pluggable.
if (!function_exists('wp_password_change_notification')) {
    function wp_password_change_notification($user) {
        // Intentionally no-op: do not email the admin on trader password changes.
    }
}

// ── Payment proof deferred admin notification callback ────────────────────────
// Fired by WP-Cron after proof upload completes. Keeps the /payment/submit-proof
// REST response free of SMTP latency. get_order() and notify_admin_new_proof()
// are both public statics — visibility was already sufficient.
add_action('fxsim_notify_admin_proof', function (int $order_id): void {
    if (!class_exists('FXSIM_Payments')) return;
    $order = FXSIM_Payments::get_order($order_id);
    if ($order) {
        FXSIM_Payments::notify_admin_new_proof($order);
    }
}, 10, 1);

// ── User registration: NO auto account — user must purchase a challenge first ─
// Account is created only when a challenge is purchased via create_challenge()
add_action('user_register', function ($user_id) {
    // Intentionally empty — accounts are created per-challenge, not on registration
});


add_action('after_setup_theme', function () {
    if (is_user_logged_in() && !current_user_can('administrator')) {
        show_admin_bar(false);
    }
});