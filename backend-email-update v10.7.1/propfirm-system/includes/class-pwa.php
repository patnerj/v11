<?php
/**
 * FXSIM_PWA — Progressive Web App support.
 *
 * Features:
 *   - Web App Manifest (dynamically generated from WhiteLabel settings)
 *   - Service Worker registration (with SSE-compatible scope)
 *   - Mobile meta tags (viewport, theme-color, apple-mobile)
 *   - Add to Home Screen support (iOS + Android)
 *   - Fullscreen app display mode
 *   - Offline shell via service worker
 *   - Push notification foundation (VAPID key support, UI deferred)
 *   - CDN-aware SW scope (works behind Cloudflare)
 *
 * Architecture:
 *   manifest.json is served via a WP REST endpoint (/fxsim/v1/manifest.json)
 *   rather than a static file. This allows dynamic brand name, colors, and
 *   icon URLs from WhiteLabel settings without a separate file on disk.
 *
 *   The SW file (pwa/sw.js) is registered at the site root scope ('/') via
 *   a rewrite rule (see FXSIM_PWA::register_sw_rewrite). This gives it
 *   full-site scope, covering all plugin pages.
 *
 * Future / SaaS compatibility:
 *   - Multi-tenant: manifest endpoint can return per-tenant branding
 *   - Push notifications: VAPID keys stored in wp_options, endpoint ready
 *   - iOS shortcuts: apple-touch-icon served from WhiteLabel logo URL
 */
defined('ABSPATH') || exit;

class FXSIM_PWA {

    /** SW file path relative to plugin directory. */
    const SW_FILE = 'pwa/sw.js';

    /**
     * Register all PWA hooks. Called once from propfirm-system.php.
     */
    public static function register(): void {
        // Serve manifest via REST (dynamic, branded)
        add_action('rest_api_init', [self::class, 'register_manifest_route']);

        // Inject PWA meta tags + SW registration script into <head>
        add_action('wp_head', [self::class, 'inject_head_tags'], 2);

        // Register the SW rewrite so /sw.js maps to our plugin file
        add_action('init',             [self::class, 'register_sw_rewrite']);
        add_filter('query_vars',       [self::class, 'add_sw_query_var']);
        add_action('template_redirect',[self::class, 'serve_sw_file']);

        // Flush rewrite rules only once after activation (stored flag)
        if (get_option('fxsim_pwa_rewrite_flushed') !== FXSIM_VERSION) {
            add_action('init', function () {
                flush_rewrite_rules(false);
                update_option('fxsim_pwa_rewrite_flushed', FXSIM_VERSION, false);
            }, 99);
        }
    }

    // ── Service Worker Rewrite ────────────────────────────────────────────────

    /**
     * Register rewrite rule: /sw.js → internal WP query with fxsim_sw=1.
     * This makes /sw.js available at the root of the site, giving the SW
     * maximum scope (controls all pages under '/').
     *
     * Why rewrite instead of serving the raw file?
     * Serving the raw file from /wp-content/plugins/... would limit SW scope
     * to that directory. SW scope = file location by default.
     * With a rewrite to the root, scope covers all plugin pages.
     */
    public static function register_sw_rewrite(): void {
        add_rewrite_rule('^sw\.js$', 'index.php?fxsim_sw=1', 'top');
    }

    public static function add_sw_query_var(array $vars): array {
        $vars[] = 'fxsim_sw';
        return $vars;
    }

    /**
     * Serve the service worker file with correct headers.
     * SW must have Service-Worker-Allowed header to expand scope.
     * Cache-Control: no-cache ensures clients always check for SW updates.
     */
    public static function serve_sw_file(): void {
        if (get_query_var('fxsim_sw') !== '1') return;

        $sw_path = FXSIM_DIR . self::SW_FILE;
        if (!file_exists($sw_path)) {
            status_header(404);
            exit;
        }

        // Inject the current version so SW cache names match plugin version
        $sw_content = file_get_contents($sw_path);
        $version    = FXSIM_VERSION;

        // Replace self.FXSIM_SW_VERSION placeholder with actual version
        // This invalidates all SW caches when plugin is updated
        $sw_content = "self.FXSIM_SW_VERSION = '{$version}';\n" . $sw_content;

        header('Content-Type: application/javascript; charset=utf-8');
        // SW files must not be cached aggressively — browser checks for updates
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        // Allow SW to control all pages under site root
        header('Service-Worker-Allowed: /');

        echo $sw_content;
        exit;
    }

    // ── Manifest endpoint ─────────────────────────────────────────────────────

    /**
     * Register the manifest.json REST endpoint.
     * Public: no authentication required (browsers fetch manifest without credentials).
     */
    public static function register_manifest_route(): void {
        register_rest_route('fxsim/v1', '/manifest\.json', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'serve_manifest'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Generate and serve the Web App Manifest.
     * Reads brand name, colors, and logo from WhiteLabel settings.
     */
    public static function serve_manifest(): void {
        $brand   = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';
        $color   = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('primary_color', '#00d4ff')
            : '#00d4ff';
        $logo    = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('logo_url', '')
            : '';

        // Icon array: use logo if set; otherwise use a generated SVG data URI
        $icons = [];
        if ($logo) {
            $icons[] = [
                'src'   => $logo,
                'sizes' => 'any',
                'type'  => 'image/png',
                'purpose' => 'any maskable',
            ];
        } else {
            // Minimal SVG icon using brand color — no external file needed
            $svg_icon = 'data:image/svg+xml,' . rawurlencode(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">'
                . '<rect width="192" height="192" rx="24" fill="' . $color . '"/>'
                . '<text x="96" y="130" font-size="100" text-anchor="middle" fill="#060b14">⚡</text>'
                . '</svg>'
            );
            $icons = [
                ['src' => $svg_icon, 'sizes' => '192x192', 'type' => 'image/svg+xml', 'purpose' => 'any'],
                ['src' => $svg_icon, 'sizes' => '512x512', 'type' => 'image/svg+xml', 'purpose' => 'maskable'],
            ];
        }

        $manifest = [
            'name'             => $brand,
            'short_name'       => strlen($brand) > 12 ? 'PropFirm' : $brand,
            'description'      => 'Professional prop firm trading challenge platform',
            'start_url'        => home_url('/dashboard/'),
            'scope'            => home_url('/'),
            'display'          => 'standalone',          // Hides browser chrome — app feel
            'display_override' => ['window-controls-overlay', 'standalone'],
            'orientation'      => 'any',
            'theme_color'      => $color,
            'background_color' => '#060b14',
            'lang'             => get_bloginfo('language') ?: 'en',
            'icons'            => $icons,
            'categories'       => ['finance', 'productivity'],
            'screenshots'      => [],                    // Future: add screenshots for richer install UI
            // Shortcuts — quick actions from Home Screen long-press
            'shortcuts' => [
                [
                    'name'        => 'Trading Terminal',
                    'url'         => home_url('/trading/'),
                    'description' => 'Open live trading terminal',
                ],
                [
                    'name'        => 'Dashboard',
                    'url'         => home_url('/dashboard/'),
                    'description' => 'View account summary',
                ],
                [
                    'name'        => 'Challenges',
                    'url'         => home_url('/challenges/'),
                    'description' => 'Browse challenge programs',
                ],
            ],
            // Push notification placeholder (actual subscription handled client-side)
            // VAPID public key stored in wp_options when push is configured
            'prefer_related_applications' => false,
        ];

        // Serve as JSON — bypass WP REST JSON wrapper
        header('Content-Type: application/manifest+json; charset=utf-8');
        header('Cache-Control: public, max-age=3600'); // Manifest can be cached for 1 hour
        header('Access-Control-Allow-Origin: *');       // Required for cross-origin manifest fetch
        echo json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }

    // ── Head tags ─────────────────────────────────────────────────────────────

    /**
     * Inject PWA meta tags, manifest link, and SW registration script.
     * Only runs on plugin pages (terminal, dashboard, challenges etc.).
     */
    public static function inject_head_tags(): void {
        $plugin_pages = ['trading', 'dashboard', 'challenges', 'statistics',
                         'leaderboard', 'certificate', 'login', 'register', 'landing'];
        $on_plugin_page = false;
        foreach ($plugin_pages as $slug) {
            if (is_page($slug)) { $on_plugin_page = true; break; }
        }
        if (!$on_plugin_page) return;

        $brand = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';
        $color = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('primary_color', '#00d4ff')
            : '#00d4ff';
        $logo  = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('logo_url', '')
            : '';

        $manifest_url = rest_url('fxsim/v1/manifest.json');
        $sw_url       = home_url('/sw.js');
        $brand_esc    = esc_attr($brand);
        $color_esc    = esc_attr($color);
        ?>

<!-- PropFirm System PWA -->
<link rel="manifest" href="<?= esc_url($manifest_url) ?>">

<!-- Viewport — required for proper mobile rendering -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

<!-- Theme color — browser chrome color on Android + PWA title bar -->
<meta name="theme-color" content="<?= $color_esc ?>">

<!-- Mobile app mode — hide browser chrome when launched from Home Screen -->
<meta name="mobile-web-app-capable" content="yes">

<!-- iOS Safari specific -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="<?= $brand_esc ?>">
<?php if ($logo): ?>
<link rel="apple-touch-icon" href="<?= esc_url($logo) ?>">
<?php endif; ?>

<!-- Windows/Edge tiles -->
<meta name="msapplication-TileColor" content="<?= $color_esc ?>">
<meta name="application-name" content="<?= $brand_esc ?>">

<!-- iOS splash screen color (matches app background) -->
<meta name="apple-mobile-web-app-status-bar-style" content="black">

<!-- Service Worker registration -->
<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('<?= esc_js($sw_url) ?>', {
            scope: '/',
            updateViaCache: 'none', // Always fetch fresh SW file (our no-cache header handles this)
        }).then(function (reg) {
            console.debug('[PropFirm] SW registered, scope:', reg.scope);

            // Check for SW updates every time the page gains focus
            // Ensures traders get the latest SW without closing the app
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible') {
                    reg.update().catch(function () {}); // silent — update if available
                }
            });

        }).catch(function (err) {
            // SW registration failure is non-fatal — app works without it
            console.debug('[PropFirm] SW registration failed (non-fatal):', err.message);
        });
    });
}
</script>

<?php
    }
}
