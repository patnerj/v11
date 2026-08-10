<?php
defined('ABSPATH') || exit;

class FXSIM_Admin {

    public static function init(): void {
        if (!is_admin()) return;
        add_action('admin_menu',          [self::class, 'menu']);
        add_action('admin_enqueue_scripts',[self::class, 'enqueue']);
        // Inject dark WP admin chrome styles only on our pages
        add_action('admin_head',          [self::class, 'admin_dark_head']);
    }

    public static function admin_dark_head(): void {
        $screen = get_current_screen();
        if (!$screen || strpos($screen->id, 'fxsim') === false) return;
        echo '<style>
        /* Dark WP admin chrome for FX pages */
        #wpcontent, #wpbody, #wpbody-content { background: #070c18 !important; }
        #wpbody-content .wrap { background: transparent !important; }
        #wpadminbar { background: #0c1220 !important; border-bottom: 1px solid #1e3050 !important; }
        #wpadminbar * { color: #7a8fb0 !important; }
        #wpadminbar a:hover { color: #e8edf8 !important; background: #131f36 !important; }
        .wp-menu-arrow div, #adminmenu .wp-has-current-submenu .wp-menu-arrow div { background: #6c63ff !important; }
        #adminmenu .current a.menu-top, #adminmenu .wp-has-current-submenu a.menu-top,
        #adminmenu a.current { background: #131f36 !important; color: #e8edf8 !important; }
        </style>' . "\n";
    }

    public static function menu(): void {
        add_menu_page('FX Simulation', 'FX Simulation', 'manage_options', 'fxsim', [self::class, 'dashboard'], 'dashicons-chart-line', 30);
        add_submenu_page('fxsim', 'Dashboard',    'Dashboard',    'manage_options', 'fxsim',              [self::class, 'dashboard']);
        add_submenu_page('fxsim', 'Users',        'Users',        'manage_options', 'fxsim-users',        [self::class, 'users']);
        add_submenu_page('fxsim', 'Trades',       'Trades',       'manage_options', 'fxsim-trades',       [self::class, 'trades']);
        add_submenu_page('fxsim', 'Challenges',   'Challenges',   'manage_options', 'fxsim-challenges',   [self::class, 'challenges']);
        add_submenu_page('fxsim', 'Plans',        'Plans',        'manage_options', 'fxsim-plans',        [self::class, 'plans']);
        add_submenu_page('fxsim', 'Payments',     'Payments',     'manage_options', 'fxsim-payments',     [self::class, 'payments']);
        add_submenu_page('fxsim', 'Payouts',      'Payouts',      'manage_options', 'fxsim-payouts',      [self::class, 'payouts']);
        add_submenu_page('fxsim', 'Symbols',      'Symbols',      'manage_options', 'fxsim-symbols',      [self::class, 'symbols']);
        add_submenu_page('fxsim', 'Audit Log',    'Audit Log',    'manage_options', 'fxsim-log',          [self::class, 'audit_log']);
        add_submenu_page('fxsim', 'Analytics',    'Analytics',    'manage_options', 'fxsim-analytics',    [self::class, 'analytics']);
        add_submenu_page('fxsim', 'Bulk Email',   'Bulk Email',   'manage_options', 'fxsim-bulk-email',   [self::class, 'bulk_email']);
        add_submenu_page('fxsim', 'Emails',       'Emails',       'manage_options', 'fxsim-emails',       [self::class, 'emails']);
        add_submenu_page('fxsim', 'Tools',        'Tools',        'manage_options', 'fxsim-tools',        [self::class, 'tools']);
        add_submenu_page('fxsim', 'White Label',  'White Label',  'manage_options', 'fxsim-whitelabel',   [self::class, 'whitelabel']);
        add_submenu_page('fxsim', 'Settings',     'Settings',     'manage_options', 'fxsim-settings',     [self::class, 'settings']);
        add_submenu_page('fxsim', 'Risk',         'Risk',         'manage_options', 'fxsim-risk',         [self::class, 'risk']);
    }

    public static function enqueue(string $hook): void {
        if (strpos($hook, 'fxsim') === false) return;
        // Register Chart.js for analytics page (same CDN version as frontend)
        wp_register_script('chartjs', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', [], null, true);
        // Inter font for admin premium feel
        wp_enqueue_style('fxsim-admin-font', 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap', [], null);
        wp_enqueue_style('fxsim-admin',  FXSIM_URL . 'assets/css/admin.css', ['fxsim-admin-font'], FXSIM_VERSION);
        wp_enqueue_script('fxsim-admin', FXSIM_URL . 'assets/js/admin.js', ['jquery','chartjs'], FXSIM_VERSION, true);
        wp_localize_script('fxsim-admin', 'FXSIM_ADMIN', [
            'api'   => rtrim(rest_url('fxsim/v1'), '/'),  // rtrim prevents double-slash in fetch(API + "/path")
            'nonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public static function dashboard(): void { self::view('dashboard'); }
    public static function users():     void { self::view('users'); }
    public static function trades():    void { self::view('trades'); }
    public static function challenges():void { self::view('challenges'); }
    public static function plans():     void { self::view('plans'); }
    public static function payments():  void { self::view('payments'); }
    public static function payouts():   void { self::view('payouts'); }
    public static function symbols():   void { self::view('symbols'); }
    public static function audit_log(): void { self::view('audit-log'); }
    public static function analytics(): void { self::view('analytics'); }
    public static function bulk_email():void { self::view('bulk-email'); }
    public static function emails():    void { self::view('emails'); }
    public static function tools():     void { self::view('tools'); }
    public static function whitelabel():void { self::view('whitelabel'); }
    public static function settings():  void { self::view('settings'); }
    public static function risk():      void { self::view('risk'); }

    private static function view(string $name): void {
        $file = FXSIM_DIR . "admin/views/{$name}.php";
        if (file_exists($file)) include $file;
        else echo "<div class='wrap'><h1>$name</h1><p>View not found.</p></div>";
    }
}
