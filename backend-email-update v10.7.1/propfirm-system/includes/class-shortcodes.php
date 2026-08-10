<?php
defined('ABSPATH') || exit;

class FXSIM_Shortcodes {

    public static function register(): void {
        add_shortcode('fxsim_login',       [self::class, 'login_page']);
        add_shortcode('fxsim_register',    [self::class, 'register_page']);
        add_shortcode('fxsim_landing',     [self::class, 'landing_page']);
        add_shortcode('fxsim_terminal',    [self::class, 'terminal']);
        add_shortcode('fxsim_dashboard',   [self::class, 'dashboard_page']);
        add_shortcode('fxsim_challenges',  [self::class, 'challenges_page']);
        add_shortcode('fxsim_statistics',  [self::class, 'statistics_page']);
        add_shortcode('fxsim_leaderboard', [self::class, 'leaderboard_page']);
        add_shortcode('fxsim_certificate', [self::class, 'certificate_page']);
        add_shortcode('fxsim_reset_password', [self::class, 'reset_password_page']);
        add_shortcode('fxsim_verify_2fa',    [self::class, 'verify_2fa_page']);
        add_shortcode('fxsim_challenge_rules', [self::class, 'challenge_rules_page']);
        add_shortcode('fxsim_profile',         [self::class, 'profile_page']);

        add_action('wp_enqueue_scripts', [self::class, 'enqueue']);
    }

    /**
     * Returns true if the current request is for an FXSIM page.
     *
     * Checks two ways so it works regardless of what the admin named the WP page:
     *  1. is_page($slug)              — exact slug, title, or post-ID match (WP built-in)
     *  2. has_shortcode($content, $tag) — page contains the shortcode, whatever its slug
     *
     * Called from enqueue() which runs on wp_enqueue_scripts; the queried object
     * is already set at that point, so get_queried_object() is safe to call.
     *
     * @param string $slug     Expected WP page slug (e.g. 'challenges').
     * @param string $shortcode Shortcode tag to look for as fallback (e.g. 'fxsim_challenges').
     * @return bool
     */
    private static function is_fxsim_page(string $slug, string $shortcode = ''): bool {
        if (is_page($slug)) {
            return true;
        }
        if ($shortcode !== '') {
            $post = get_queried_object();
            if ($post instanceof WP_Post && has_shortcode($post->post_content, $shortcode)) {
                return true;
            }
        }
        return false;
    }

    public static function enqueue(): void {
        // ── Cache-busting version string ──────────────────────────────────────
        // In production, use FXSIM_VERSION so assets cache for a full version lifetime.
        // Developers can define FXSIM_DEV_MODE in wp-config.php to bust every load.
        $ver = defined('FXSIM_DEV_MODE') ? time() : FXSIM_VERSION;

        // Always load styles (auth pages need them too)
        wp_enqueue_style('fxsim-main', FXSIM_URL . 'assets/css/terminal.css', [], $ver);

        // Terminal JS + FXSIM config: ONLY on the trading terminal page.
        // Loading it on /login/ or /register/ would trigger the
        // "if (!loggedIn) redirect to /login/" guard - causing an infinite loop.
        // self::is_fxsim_page() matches by WP page slug OR by shortcode presence,
        // so it works even when the admin chose a non-standard page name.
        if (self::is_fxsim_page('trading', 'fxsim_terminal')) {
            wp_enqueue_script('fxsim-main', FXSIM_URL . 'assets/js/terminal.js', [], $ver, true);
            wp_localize_script('fxsim-main', 'FXSIM', [
                'api'    => rtrim(rest_url('fxsim/v1'), '/'),
                'stream' => rtrim(rest_url('fxsim/v1'), '/') . '/stream',
                'nonce'  => wp_create_nonce('wp_rest'),
                'user'   => [
                    'id'       => get_current_user_id(),
                    'loggedIn' => is_user_logged_in(),
                    'isAdmin'  => current_user_can('manage_options'),
                ],
            ]);
        }

        // Dashboard + Challenges + Statistics + Leaderboard + Certificate JS
        // Uses self::is_fxsim_page() which checks slug AND shortcode presence,
        // so this works even if the admin named a page 'my-challenges' etc.
        $is_dash_page = self::is_fxsim_page('dashboard',   'fxsim_dashboard')
                     || self::is_fxsim_page('challenges',  'fxsim_challenges')
                     || self::is_fxsim_page('statistics',  'fxsim_statistics')
                     || self::is_fxsim_page('leaderboard', 'fxsim_leaderboard')
                     || self::is_fxsim_page('certificate', 'fxsim_certificate')
                     || self::is_fxsim_page('profile',     'fxsim_profile');
        if ($is_dash_page) {
            wp_enqueue_style('fxsim-dashboard', FXSIM_URL . 'assets/css/dashboard.css', ['fxsim-main'], $ver);
            // Chart.js — registered from CDN with pinned version for reproducibility
            // Version is in the URL so CF/browser caches it forever at this exact URL
            wp_register_script(
                'chartjs',
                'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
                [],
                null,  // null = no ?ver= param appended (version is already in URL)
                true
            );
            wp_enqueue_script('fxsim-dashboard', FXSIM_URL . 'assets/js/dashboard.js', ['chartjs'], $ver, true);
            wp_localize_script('fxsim-dashboard', 'FXSIM', [
                'api'   => rtrim(rest_url('fxsim/v1'), '/'),
                'nonce' => wp_create_nonce('wp_rest'),
                'user'  => [
                    'id'       => get_current_user_id(),
                    'loggedIn' => is_user_logged_in(),
                    'isAdmin'  => current_user_can('manage_options'),
                ],
            ]);
            wp_localize_script('fxsim-dashboard', 'FXSIM_URLS', [
                'trading'     => home_url('/trading/'),
                'dashboard'   => home_url('/dashboard/'),
                'challenges'  => home_url('/challenges/'),
                'statistics'  => home_url('/statistics/'),
                'leaderboard' => home_url('/leaderboard/'),
                'certificate' => home_url('/certificate/'),
                'login'       => home_url('/login/'),
            ]);
        }

        // ── Preconnect hints for external origins ─────────────────────────────
        // Tells the browser (and CDN) to open connections early to these hosts.
        // Reduces first-byte latency for Google Fonts, Chart.js, TradingView.
        self::add_preconnect_hints();

        // ── Cache-Control headers for static plugin assets ────────────────────
        // Versioned URLs (contains FXSIM_VERSION query param) are immutable for
        // the lifetime of that version. max-age=31536000 = 1 year.
        // Cloudflare and other CDNs cache these at the edge.
        self::set_asset_cache_headers();
    }

    /**
     * Emit <link rel="preconnect"> and <link rel="dns-prefetch"> for external origins.
     * Placed in wp_head to give the browser maximum lead time.
     * Significant on mobile where DNS resolution adds 100–300ms on first connection.
     */
    private static function add_preconnect_hints(): void {
        $page_map = [
            'trading'     => 'fxsim_terminal',
            'dashboard'   => 'fxsim_dashboard',
            'challenges'  => 'fxsim_challenges',
            'statistics'  => 'fxsim_statistics',
            'leaderboard' => 'fxsim_leaderboard',
            'certificate' => 'fxsim_certificate',
            'login'       => 'fxsim_login',
            'register'    => 'fxsim_register',
            'profile'     => 'fxsim_profile',
        ];
        $is_plugin_page = false;
        foreach ($page_map as $slug => $tag) {
            if (self::is_fxsim_page($slug, $tag)) { $is_plugin_page = true; break; }
        }
        if (!$is_plugin_page) return;

        add_action('wp_head', function () {
            $origins = [
                // Google Fonts — used by terminal.css @import
                'https://fonts.googleapis.com',
                'https://fonts.gstatic.com',
                // Chart.js CDN — used by dashboard and statistics templates
                'https://cdn.jsdelivr.net',
            ];
            // TradingView — only on terminal page
            if (self::is_fxsim_page('trading', 'fxsim_terminal')) {
                $origins[] = 'https://s3.tradingview.com';
                $origins[] = 'https://charting_library.tradingview.com';
            }
            foreach ($origins as $origin) {
                printf(
                    '<link rel="preconnect" href="%s" crossorigin>' . "\n",
                    esc_url($origin)
                );
                printf(
                    '<link rel="dns-prefetch" href="%s">' . "\n",
                    esc_url($origin)
                );
            }
        }, 1); // priority 1 = as early as possible in <head>
    }

    /**
     * Set cache-control headers for plugin static assets.
     *
     * Strategy:
     *   Plugin assets (terminal.js, terminal.css etc.) are versioned via ?ver=X.X.X
     *   in the URL. They are safe to cache for 1 year — any version change produces
     *   a new URL, bypassing the cache automatically.
     *
     *   Cloudflare compatibility:
     *   - 'public' allows CF edge caching
     *   - 'immutable' tells CF/browser the content will never change at this URL
     *   - 's-maxage=31536000' controls CDN cache; 'max-age=31536000' controls browser cache
     *
     *   REST API and SSE responses get no-store (handled in rest_pre_dispatch and stream()).
     */
    private static function set_asset_cache_headers(): void {
        // Only apply to our plugin asset URLs (CSS/JS with ver param)
        $request_uri = $_SERVER['REQUEST_URI'] ?? '';
        $is_fxsim_asset = (
            strpos($request_uri, '/propfirm-system/assets/') !== false ||
            strpos($request_uri, 'fxsim-main') !== false ||
            strpos($request_uri, 'fxsim-dashboard') !== false
        );

        // WP already sets headers for enqueued assets via WP_Scripts/WP_Styles
        // We add our hint via wp_head filter to avoid header conflicts
        // The real cache header is set via .htaccess recommendation (documented below)
        // For programmatic control we only touch headers when serving assets directly
        if ($is_fxsim_asset && !headers_sent()) {
            header('Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable');
            header('Vary: Accept-Encoding');
        }
    }

    // ── Login Page ────────────────────────────────────────────────────────────
    public static function login_page(): string {
        if (is_user_logged_in()) {
            // JS redirect is safe here — shortcode runs inside the_content() after headers sent
            return '<script>window.location.replace("' . esc_js(home_url('/dashboard/')) . '");</script>';
        }
        $brand = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        ob_start(); ?>
        <div class="fxsim-auth-wrap">
          <div class="fxsim-auth-box">
            <div class="fxsim-logo">⚡ <?= esc_html($brand) ?></div>
            <h2>Welcome Back</h2>
            <p class="fxsim-auth-sub">Sign in to your funded trader account</p>
            <?php if (isset($_GET['login']) && $_GET['login'] === 'failed'): ?>
              <div class="fxsim-alert fxsim-alert-error">Invalid username or password. Please try again.</div>
            <?php endif; ?>
            <form method="post" action="<?= esc_url(wp_login_url(home_url('/dashboard/'))) ?>">
              <div class="fxsim-field">
                <label>Username or Email</label>
                <input type="text" name="log" required autocomplete="username" placeholder="Enter username…">
              </div>
              <div class="fxsim-field">
                <label>Password</label>
                <input type="password" name="pwd" required autocomplete="current-password" placeholder="Enter password…">
              </div>
              <label class="fxsim-remember"><input type="checkbox" name="rememberme"> Remember me</label>
              <button type="submit" class="fxsim-btn-primary w-full">Sign In</button>
              <input type="hidden" name="redirect_to" value="<?= esc_url(home_url('/dashboard/')) ?>">
              <?php wp_nonce_field('login') ?>
            </form>
            <p class="fxsim-auth-link">Don't have an account? <a href="<?= home_url('/register/') ?>">Register free</a></p>
            <p class="fxsim-auth-link" style="margin-top:6px"><a href="<?= home_url('/reset-password/') ?>" style="color:var(--text-muted);font-size:12px">Forgot password?</a></p>
          </div>
        </div>
        <?php return ob_get_clean();
    }

    // ── Register Page ─────────────────────────────────────────────────────────
    public static function register_page(): string {
        if (is_user_logged_in()) {
            // Already logged in — JS redirect is safer here since we're in shortcode context
            return '<script>window.location.href="' . esc_js(home_url('/dashboard/')) . '";</script>';
        }

        // Read any error stored by the template_redirect POST handler
        $error_key = 'fxsim_reg_error_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x');
        $error     = (string) get_transient($error_key);
        if ($error) delete_transient($error_key);

        ob_start();
        $brand = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        ?>
        <div class="fxsim-auth-wrap">
          <div class="fxsim-auth-box">
            <div class="fxsim-logo">⚡ <?= esc_html($brand) ?></div>
            <h2>Create Free Account</h2>
            <p class="fxsim-auth-sub">Pass our challenge. Get funded. Keep up to 85% of profits.</p>
            <?php if ($error): ?>
              <div class="fxsim-alert fxsim-alert-error"><?= esc_html($error) ?></div>
            <?php endif; ?>
            <form method="post" action="">
              <?php wp_nonce_field('fxsim_register', 'fxsim_register_nonce') ?>
              <div class="fxsim-field">
                <label>Username</label>
                <input type="text" name="username" required autocomplete="username"
                       value="<?= esc_attr($_POST['username'] ?? '') ?>"
                       placeholder="Choose a username…">
              </div>
              <div class="fxsim-field">
                <label>Email</label>
                <input type="email" name="email" required autocomplete="email"
                       value="<?= esc_attr($_POST['email'] ?? '') ?>"
                       placeholder="your@email.com">
              </div>
              <div class="fxsim-field">
                <label>Password</label>
                <input type="password" name="password" required minlength="6"
                       autocomplete="new-password" placeholder="Min. 6 characters…">
              </div>
              <button type="submit" class="fxsim-btn-primary w-full">Get Funded →</button>
            </form>
            <p class="fxsim-auth-link">Already have an account? <a href="<?= home_url('/login/') ?>">Sign in</a></p>
          </div>
        </div>
        <?php return ob_get_clean();
    }

    // ── Landing Page ──────────────────────────────────────────────────────────
    public static function landing_page(): string {
        $reg   = home_url('/register/');
        $log   = home_url('/login/');
        $brand = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name','PropFirm System') : 'PropFirm System';
        $plans = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_all_plans() : [];
        ob_start(); ?>
<div class="fxsim-landing">

<!-- ══ NAV ═════════════════════════════════════════════════════════════════ -->
<nav class="fxsim-nav">
  <div class="fxsim-nav-logo">⚡ <?= esc_html($brand) ?></div>
  <div class="fxsim-nav-links">
    <a href="#how-it-works" class="fxsim-nav-link">How It Works</a>
    <a href="#challenges"   class="fxsim-nav-link">Challenges</a>
    <a href="#payouts"      class="fxsim-nav-link">Payouts</a>
    <a href="<?= esc_url($log) ?>" class="fxsim-nav-link">Log In</a>
    <a href="<?= esc_url($reg) ?>" class="fxsim-nav-link fxsim-nav-cta">Get Funded →</a>
  </div>
</nav>

<!-- ══ HERO ════════════════════════════════════════════════════════════════ -->
<section class="fxsim-hero">
  <div class="fxsim-hero-content">
    <div class="fxsim-hero-badge">🏆 Funded Trader Platform</div>
    <h1>We Fund Traders.<br><span class="hl">You Keep the Profits.</span></h1>
    <p class="fxsim-hero-sub">
      Pass our evaluation, get a funded account, and trade our capital.
      Keep up to 85% of your profits — with no personal financial risk.
    </p>
    <div class="fxsim-hero-btns">
      <a href="<?= esc_url($reg) ?>" class="fxsim-btn-hero">Start Challenge →</a>
      <a href="#how-it-works"         class="fxsim-btn-hero-ghost">How It Works</a>
    </div>
    <div class="fxsim-hero-stats">
      <div class="fxsim-hero-stat"><strong>$200K+</strong><span>Max Funding</span></div>
      <div class="fxsim-hero-stat"><strong>85%</strong><span>Profit Split</span></div>
      <div class="fxsim-hero-stat"><strong>12</strong><span>Instruments</span></div>
      <div class="fxsim-hero-stat"><strong>48h</strong><span>Payout Speed</span></div>
    </div>
  </div>
</section>

<!-- ══ TRUST STRIP ══════════════════════════════════════════════════════════ -->
<div class="fxsim-trust-strip">
  <div class="fxsim-trust-inner">
    <span>✅ No Time Limits on Funded Accounts</span>
    <span class="fxsim-trust-sep">·</span>
    <span>✅ Instant Account Activation</span>
    <span class="fxsim-trust-sep">·</span>
    <span>✅ Scale Up to $200,000</span>
    <span class="fxsim-trust-sep">·</span>
    <span>✅ Real Market Prices</span>
    <span class="fxsim-trust-sep">·</span>
    <span>✅ TradingView Charts</span>
  </div>
</div>

<!-- ══ HOW IT WORKS ═════════════════════════════════════════════════════════ -->
<section class="fxsim-section" id="how-it-works" style="text-align:center">
  <span class="fxsim-section-label">The Process</span>
  <h2 class="fxsim-section-title">3 Steps to a Funded Account</h2>
  <p class="fxsim-section-sub" style="margin:0 auto 52px">Proven. Simple. Transparent.</p>
  <div class="fxsim-steps-grid">
    <div class="fxsim-step-card">
      <div class="fxsim-step-number">01</div>
      <div class="fxsim-step-icon">📋</div>
      <h3>Choose a Challenge</h3>
      <p>Select your account size. Pass Phase 1 by hitting the profit target while respecting risk rules.</p>
    </div>
    <div class="fxsim-step-card fxsim-step-featured">
      <div class="fxsim-step-number">02</div>
      <div class="fxsim-step-icon">✅</div>
      <h3>Pass Verification</h3>
      <p>Phase 2 confirms your consistency. Lower profit target, same drawdown rules. Prove it wasn't luck.</p>
    </div>
    <div class="fxsim-step-card">
      <div class="fxsim-step-number">03</div>
      <div class="fxsim-step-icon">💰</div>
      <h3>Get Funded &amp; Earn</h3>
      <p>Receive your funded account instantly. Trade our capital and keep up to 85% of all profits.</p>
    </div>
  </div>
</section>

<!-- ══ CHALLENGE PLANS ══════════════════════════════════════════════════════ -->
<section class="fxsim-section" id="challenges" style="background:var(--card);border-top:1px solid var(--border);border-bottom:1px solid var(--border);max-width:100%!important;padding:80px 24px">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <span class="fxsim-section-label">Challenge Plans</span>
      <h2 class="fxsim-section-title">Choose Your Account Size</h2>
      <p class="fxsim-section-sub" style="margin:0 auto">All plans follow the same proven 2-phase evaluation process.</p>
    </div>
    <?php if (!empty($plans)): ?>
    <div class="fxsim-plans-grid">
      <?php foreach ($plans as $i => $p):
        $featured = ($i === 1 || count($plans) === 1);
        $size     = '$' . number_format((float)$p->account_size, 0);
        $price    = $p->price > 0 ? '$' . number_format((float)$p->price, 0) : 'FREE';
      ?>
      <div class="fxsim-plan-card <?= $featured ? 'fxsim-plan-featured' : '' ?>">
        <?php if ($featured): ?><div class="fxsim-plan-badge">MOST POPULAR</div><?php endif; ?>
        <div class="fxsim-plan-size"><?= esc_html($size) ?></div>
        <div class="fxsim-plan-name"><?= esc_html($p->name) ?></div>
        <div class="fxsim-plan-price"><?= esc_html($price) ?></div>
        <ul class="fxsim-plan-rules">
          <li><span>Phase 1 Profit Target</span><strong><?= esc_html($p->p1_profit_target) ?>%</strong></li>
          <li><span>Phase 2 Profit Target</span><strong><?= esc_html($p->p2_profit_target) ?>%</strong></li>
          <li><span>Max Daily Drawdown</span><strong><?= esc_html($p->p1_daily_dd) ?>%</strong></li>
          <li><span>Max Total Drawdown</span><strong><?= esc_html($p->p1_max_dd) ?>%</strong></li>
          <li><span>Min. Trading Days</span><strong><?= esc_html($p->p1_min_days) ?> days</strong></li>
          <li><span>Leverage</span><strong>1:<?= esc_html($p->max_leverage) ?></strong></li>
          <li class="fxsim-plan-split"><span>Profit Split</span><strong><?= esc_html($p->funded_profit_split) ?>%</strong></li>
        </ul>
        <a href="<?= esc_url($reg) ?>" class="fxsim-btn-hero" style="width:100%;box-sizing:border-box;justify-content:center;margin-top:4px">
          Get Funded →
        </a>
      </div>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
    <div class="fxsim-plans-grid">
      <?php foreach ([
        ['$10,000','Starter Challenge','$99',8,5,10,5,80,100],
        ['$25,000','Pro Challenge','$199',8,5,10,5,80,100],
        ['$50,000','Elite Challenge','$349',8,5,10,5,85,100],
      ] as $i => $p): $featured = ($i===1); ?>
      <div class="fxsim-plan-card <?= $featured?'fxsim-plan-featured':'' ?>">
        <?php if($featured):?><div class="fxsim-plan-badge">MOST POPULAR</div><?php endif;?>
        <div class="fxsim-plan-size"><?= $p[0] ?></div>
        <div class="fxsim-plan-name"><?= $p[1] ?></div>
        <div class="fxsim-plan-price"><?= $p[2] ?></div>
        <ul class="fxsim-plan-rules">
          <li><span>Phase 1 Target</span><strong><?= $p[3] ?>%</strong></li>
          <li><span>Daily Drawdown</span><strong><?= $p[4] ?>%</strong></li>
          <li><span>Max Drawdown</span><strong><?= $p[5] ?>%</strong></li>
          <li><span>Min. Days</span><strong><?= $p[6] ?> days</strong></li>
          <li class="fxsim-plan-split"><span>Profit Split</span><strong><?= $p[7] ?>%</strong></li>
        </ul>
        <a href="<?= esc_url($reg) ?>" class="fxsim-btn-hero" style="width:100%;box-sizing:border-box;justify-content:center">Get Funded →</a>
      </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </div>
</section>

<!-- ══ PAYOUTS ══════════════════════════════════════════════════════════════ -->
<section class="fxsim-section" id="payouts">
  <div class="fxsim-payout-row">
    <div class="fxsim-payout-text">
      <span class="fxsim-section-label">Profit Payouts</span>
      <h2 class="fxsim-section-title">Your Profits.<br>Paid Fast.</h2>
      <p style="font-size:16px;color:var(--text-muted);line-height:1.75;margin-bottom:28px">
        Once funded, request a payout anytime. We process within 48 hours.
        You keep up to <strong style="color:var(--accent)">85% of all profits</strong> — with no cap.
      </p>
      <div class="fxsim-payout-points">
        <div class="fxsim-payout-point"><span class="fxsim-pp-icon">⚡</span><div><strong>Instant Request</strong><p>Request payouts directly from your dashboard, any time.</p></div></div>
        <div class="fxsim-payout-point"><span class="fxsim-pp-icon">🔒</span><div><strong>Risk-Free Trading</strong><p>All losses are absorbed by us. You only share in profits.</p></div></div>
        <div class="fxsim-payout-point"><span class="fxsim-pp-icon">📈</span><div><strong>Scale Up</strong><p>Prove your consistency and unlock larger funded accounts.</p></div></div>
      </div>
    </div>
    <div class="fxsim-payout-card-wrap">
      <div class="fxsim-payout-example">
        <div class="fxsim-pe-label">Example Payout</div>
        <div class="fxsim-pe-account">$25,000 Funded Account</div>
        <div class="fxsim-pe-row"><span>Monthly Profit</span><strong>+$2,500</strong></div>
        <div class="fxsim-pe-row"><span>Profit Split</span><strong>80 / 20</strong></div>
        <div class="fxsim-pe-divider"></div>
        <div class="fxsim-pe-row fxsim-pe-big"><span>Your Payout</span><strong style="color:var(--green)">+$2,000</strong></div>
        <div class="fxsim-pe-row" style="font-size:12px;color:var(--text-muted)"><span>Firm share</span><strong>$500</strong></div>
      </div>
    </div>
  </div>
</section>

<!-- ══ TESTIMONIALS ══════════════════════════════════════════════════════════ -->
<div class="fxsim-testimonials">
  <div style="text-align:center;margin-bottom:48px">
    <span class="fxsim-section-label">Funded Traders</span>
    <h2 class="fxsim-section-title">Real Results. Real Traders.</h2>
  </div>
  <div class="fxsim-testimonial-grid">
    <div class="fxsim-testimonial">
      <div class="fxsim-stars">★★★★★</div>
      <p class="fxsim-testimonial-text">"I passed Phase 1 in 12 days using ICT concepts. The platform feels exactly like trading on a real prop firm — the SL/TP logic, margin levels, everything is spot on."</p>
      <div class="fxsim-testimonial-author">
        <div class="fxsim-testimonial-avatar">AK</div>
        <div><div class="fxsim-testimonial-name">Ahmed K.</div><div class="fxsim-testimonial-role">Funded Trader · Dubai · $25K Account</div></div>
      </div>
    </div>
    <div class="fxsim-testimonial">
      <div class="fxsim-stars">★★★★★</div>
      <p class="fxsim-testimonial-text">"After failing 3 challenges on other platforms, this one helped me understand my actual weaknesses. The daily drawdown tracker is a game-changer for discipline."</p>
      <div class="fxsim-testimonial-author">
        <div class="fxsim-testimonial-avatar">MJ</div>
        <div><div class="fxsim-testimonial-name">Marcus J.</div><div class="fxsim-testimonial-role">Funded Trader · UK · $50K Account</div></div>
      </div>
    </div>
    <div class="fxsim-testimonial">
      <div class="fxsim-stars">★★★★★</div>
      <p class="fxsim-testimonial-text">"Received my first payout of $1,800 within 48 hours. The process was seamless. Already scaling up to a $50K account after 2 months of consistent trading."</p>
      <div class="fxsim-testimonial-author">
        <div class="fxsim-testimonial-avatar">SR</div>
        <div><div class="fxsim-testimonial-name">Sofia R.</div><div class="fxsim-testimonial-role">Funded Trader · Germany · $25K Account</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ══ CTA ══════════════════════════════════════════════════════════════════ -->
<section class="fxsim-cta-section">
  <div class="fxsim-hero-badge" style="margin:0 auto 20px">Start Today — Free Account</div>
  <h2>Ready to Trade Our Capital?</h2>
  <p>Join funded traders who passed our challenge. No personal risk. No hidden fees.</p>
  <a href="<?= esc_url($reg) ?>" class="fxsim-btn-hero">Get Your Funded Account →</a>
</section>

<!-- ══ FOOTER ════════════════════════════════════════════════════════════════ -->
<footer class="fxsim-footer">
  <div class="fxsim-footer-logo">⚡ <?= esc_html($brand) ?></div>
  <div class="fxsim-footer-text"><?= esc_html(class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('footer_text', '© ' . date('Y') . ' PropFirm System. Not financial advice.') : '© ' . date('Y') . ' PropFirm System') ?></div>
  <div class="fxsim-footer-links">
    <a href="<?= esc_url($log) ?>">Login</a>
    <a href="<?= esc_url($reg) ?>">Register</a>
  </div>
</footer>

</div>
        <?php return ob_get_clean();
    }

    // ── Trading Terminal ──────────────────────────────────────────────────────
    public static function terminal(): string {
        if (!is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/login/')) . '");</script>';
        }
        global $wpdb;
        $user_id = get_current_user_id();

        // Check for funded status first — funded accounts use MT5, not web terminal
        $funded_challenge = $wpdb->get_row($wpdb->prepare(
            "SELECT id, mt5_login, mt5_password, mt5_server, mt5_account_type
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE user_id = %d AND status = 'funded'
             ORDER BY funded_at DESC LIMIT 1",
            $user_id
        ));

        if ($funded_challenge) {
            ob_start(); ?>
            <div style="min-height:100vh;background:#060b14;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui">
              <div style="max-width:520px;width:100%;text-align:center">
                <div style="font-size:56px;margin-bottom:16px">🖥</div>
                <h1 style="color:#dde8f5;font-size:24px;font-weight:800;margin-bottom:10px">
                  Your Funded Account is on MT5
                </h1>
                <p style="color:#8ba4c0;font-size:15px;margin-bottom:28px;line-height:1.6">
                  The web terminal was for your challenge phases. Now that you're funded,
                  your live trading account is on MetaTrader 5. Use the details below.
                </p>
                <a href="<?= home_url('/dashboard/') ?>"
                   style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,212,255,.1);
                          border:1px solid rgba(0,212,255,.3);color:#00d4ff;text-decoration:none;
                          padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600">
                  ← Back to Dashboard
                </a>
              </div>
            </div>
            <?php return ob_get_clean();
        }

        // Gate: user must have an active challenge account
        $has_active = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE user_id=%d AND status = 'active'",
            $user_id
        ));
        if (!$has_active) {
            $brand = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
            ob_start(); ?>
            <nav class="fxdb-nav">
              <div class="fxdb-nav-logo"><span style="background:linear-gradient(135deg,var(--accent),var(--teal));-webkit-background-clip:text;-webkit-text-fill-color:transparent">◆</span> <?= esc_html($brand) ?></div>
              <div class="fxdb-nav-links" id="fxdb-nav-links">
                <a href="<?= home_url('/dashboard/') ?>" class="fxdb-nav-link">Dashboard</a>
                <a href="<?= home_url('/challenges/') ?>" class="fxdb-nav-link">Challenges</a>
                <a href="<?= wp_logout_url(home_url('/login/')) ?>" class="fxdb-nav-link fxdb-nav-logout">Logout</a>
              </div>
            </nav>
            <div class="fxsim-no-challenge-page">
              <div class="fxsim-no-challenge-inner">
                <div class="fxsim-no-challenge-icon">📈</div>
                <h2>Your Trading Terminal</h2>
                <p>Purchase a challenge to unlock access to the professional trading terminal with real-time prices, SL/TP management, and live P&L tracking.</p>
                <div class="fxsim-no-challenge-steps">
                  <div class="fxsim-ncs">
                    <span class="fxsim-ncs-num">1</span>
                    <strong>Choose a Plan</strong>
                    Select a challenge that matches your goals
                  </div>
                  <div class="fxsim-ncs">
                    <span class="fxsim-ncs-num">2</span>
                    <strong>Pass the Evaluation</strong>
                    Hit the profit target, respect drawdown rules
                  </div>
                  <div class="fxsim-ncs">
                    <span class="fxsim-ncs-num">3</span>
                    <strong>Trade Live on MT5</strong>
                    Get funded, keep up to 85% of profits
                  </div>
                </div>
                <div class="fxsim-no-challenge-cta">
                  <a href="<?= home_url('/challenges/') ?>" class="fxsim-btn-primary" style="width:auto;padding:13px 32px">Browse Challenge Plans →</a>
                  <a href="<?= home_url('/challenge-rules/') ?>" class="fxdb-btn-ghost" style="padding:13px 24px">View Rules</a>
                </div>
              </div>
            </div>
            <?php return ob_get_clean();
        }
        ob_start();
        include FXSIM_DIR . 'templates/terminal.php';
        return ob_get_clean();
    }

    // ── Trader Dashboard ──────────────────────────────────────────────────────
    public static function dashboard_page(): string {
        if (!is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/login/')) . '");</script>';
        }
        ob_start();
        include FXSIM_DIR . 'templates/dashboard.php';
        return ob_get_clean();
    }

    // ── Challenge Programs ────────────────────────────────────────────────────
    public static function challenges_page(): string {
        if (!is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/login/')) . '");</script>';
        }
        ob_start();
        include FXSIM_DIR . 'templates/challenges.php';
        return ob_get_clean();
    }

    // ── Statistics Page ───────────────────────────────────────────────────────
    public static function statistics_page(): string {
        if (!is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/login/')) . '");</script>';
        }
        ob_start();
        include FXSIM_DIR . 'templates/statistics.php';
        return ob_get_clean();
    }

    // ── Leaderboard Page ──────────────────────────────────────────────────────
    public static function leaderboard_page(): string {
        ob_start();
        include FXSIM_DIR . 'templates/leaderboard.php';
        return ob_get_clean();
    }

    // ── Certificate Page ──────────────────────────────────────────────────────
    // ── 2FA Verification Page ─────────────────────────────────────────────────
    public static function verify_2fa_page(): string {
        if (is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/dashboard/')) . '");</script>';
        }
        $user_id = (int)($_GET['fxsim_2fa_uid']   ?? 0);
        $nonce   = sanitize_text_field($_GET['fxsim_2fa_nonce'] ?? '');
        $error   = sanitize_text_field($_GET['error'] ?? '');
        $brand   = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';

        if (!$user_id || !wp_verify_nonce($nonce, 'fxsim_2fa_' . $user_id)) {
            return '<div class="fxsim-auth-wrap"><div class="fxsim-auth-box">'
                . '<p style="color:#ff4757">Invalid or expired link. <a href="' . home_url('/login/') . '">Log in again</a>.</p>'
                . '</div></div>';
        }
        ob_start(); ?>
        <div class="fxsim-auth-wrap">
          <div class="fxsim-auth-box">
            <div class="fxsim-logo">⚡ <?= esc_html($brand) ?></div>
            <h2>Check Your Email</h2>
            <p class="fxsim-auth-sub">We sent a 6-digit code to your email address. It expires in 10 minutes.</p>
            <?php if ($error): ?>
              <div class="fxsim-alert fxsim-alert-error"><?= esc_html($error) ?></div>
            <?php endif; ?>
            <form method="post" action="">
              <input type="hidden" name="fxsim_2fa_uid"   value="<?= esc_attr($user_id) ?>">
              <input type="hidden" name="fxsim_2fa_nonce" value="<?= esc_attr($nonce) ?>">
              <div class="fxsim-field">
                <label>Verification Code</label>
                <input type="text" name="fxsim_2fa_code" required maxlength="6" pattern="[0-9]{6}"
                       inputmode="numeric" autocomplete="one-time-code"
                       placeholder="000000" autofocus
                       style="font-size:28px;letter-spacing:12px;text-align:center;font-family:monospace">
              </div>
              <button type="submit" class="fxsim-btn-primary w-full">Verify →</button>
            </form>
            <p class="fxsim-auth-link"><a href="<?= home_url('/login/') ?>">← Back to login</a></p>
          </div>
        </div>
        <?php return ob_get_clean();
    }


    private static function get_nav(string $active = ''): string {
        $brand    = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        $is_admin = current_user_can('manage_options');
        $nav_items = [
            'dashboard'       => ['Dashboard',  home_url('/dashboard/')],
            'challenges'      => ['Challenges', home_url('/challenges/')],
            'challenge-rules' => ['Rules',      home_url('/challenge-rules/')],
            'statistics'      => ['Statistics', home_url('/statistics/')],
            'leaderboard'     => ['Leaderboard',home_url('/leaderboard/')],
            'profile'         => ['Profile',    home_url('/profile/')],
        ];
        $links = '';
        foreach ($nav_items as $slug => [$label, $url]) {
            $ac = $slug === $active ? ' active' : '';
            $links .= "<a href='" . esc_url($url) . "' class='fxdb-nav-link{$ac}'>{$label}</a>";
        }
        if (is_user_logged_in()) {
            $links .= "<a href='" . wp_logout_url(home_url('/login/')) . "' class='fxdb-nav-link fxdb-nav-logout'>Logout</a>";
        } else {
            $links .= "<a href='" . home_url('/login/') . "' class='fxdb-nav-link'>Login</a>";
        }
        $logo = "<span style='background:linear-gradient(135deg,var(--accent),var(--teal));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text'>◆</span> " . esc_html($brand);
        return "
<nav class='fxdb-nav'>
  <div class='fxdb-nav-logo'>{$logo}</div>
  <button class='fxdb-nav-hamburger' id='fxdb-hamburger' onclick='(function(){var l=document.getElementById(&quot;fxdb-nav-links&quot;),o=document.getElementById(&quot;fxdb-nav-overlay&quot;),b=document.getElementById(&quot;fxdb-hamburger&quot;),open=l.classList.toggle(&quot;open&quot;);o&amp;&amp;o.classList.toggle(&quot;open&quot;,open);b.setAttribute(&quot;aria-expanded&quot;,open);document.body.classList.toggle(&quot;fxdb-nav-open&quot;,open);})()' aria-label='Menu' aria-expanded='false'>
    <span></span><span></span><span></span>
  </button>
  <div class='fxdb-nav-links' id='fxdb-nav-links'>{$links}</div>
</nav>";
    }

    // ── Challenge Rules Page ──────────────────────────────────────────────────
    // ── Trader Profile Page ───────────────────────────────────────────────────
    public static function profile_page(): string {
        if (!is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/login/')) . '");</script>';
        }
        $user    = wp_get_current_user();
        $user_id = (int)$user->ID;
        if (!$user_id) {
            return '<script>window.location.replace("' . esc_js(home_url('/login/')) . '");</script>';
        }
        global $wpdb;

        // Guard: tables must exist
        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';
        $tables_ok = $wpdb->get_var("SHOW TABLES LIKE '{$ca_table}'") === $ca_table;

        $funded   = $tables_ok ? (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE user_id=%d AND status='funded'", $user_id)) : 0;
        $passed   = $tables_ok ? (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE user_id=%d AND status IN ('funded','passed')", $user_id)) : 0;
        $total_ch = $tables_ok ? (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE user_id=%d", $user_id)) : 0;

        // Trade stats
        $acc = $tables_ok ? $wpdb->get_row($wpdb->prepare(
            "SELECT a.* FROM {$wpdb->prefix}fxsim_accounts a
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE ca.user_id=%d AND ca.status IN ('active','funded')
             ORDER BY ca.created_at DESC LIMIT 1", $user_id)) : null;

        $stats = $acc ? $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins,
                    SUM(pnl) AS net_pnl,
                    MAX(pnl) AS best_trade,
                    MIN(pnl) AS worst_trade,
                    AVG(CASE WHEN pnl > 0 THEN pnl END) AS avg_win,
                    AVG(CASE WHEN pnl < 0 THEN ABS(pnl) END) AS avg_loss
             FROM {$wpdb->prefix}fxsim_trades WHERE account_id=%d", $acc->id)) : null;

        $total_trades = $stats ? (int)$stats->total : 0;
        $wins         = $stats ? (int)$stats->wins  : 0;
        $win_rate     = $total_trades ? round($wins / $total_trades * 100, 1) : 0;
        $avg_win      = $stats ? round((float)$stats->avg_win,  2) : 0;
        $avg_loss     = $stats ? round((float)$stats->avg_loss, 2) : 0;
        $rr           = ($avg_loss > 0) ? round($avg_win / $avg_loss, 2) : 0;
        $net_pnl      = $stats ? round((float)$stats->net_pnl, 2) : 0;
        $best_sym     = $acc ? $wpdb->get_var($wpdb->prepare(
            "SELECT symbol FROM {$wpdb->prefix}fxsim_trades WHERE account_id=%d GROUP BY symbol ORDER BY SUM(pnl) DESC LIMIT 1", $acc->id)) : null;

        $member_since = date('M Y', strtotime($user->user_registered));
        $has_2fa      = (bool)get_user_meta($user_id, 'fxsim_2fa_enabled', true);
        $verified     = (bool)get_user_meta($user_id, 'fxsim_email_verified', true);
        $initial      = strtoupper(substr($user->display_name ?: $user->user_login, 0, 1));

        $badge_class = $funded ? 'fxsim-badge-funded' : ($passed ? 'fxsim-badge-passed' : ($total_ch > 0 ? 'fxsim-badge-active' : 'fxsim-badge-new'));
        $badge_icon  = $funded ? '💰' : ($passed ? '✅' : ($total_ch > 0 ? '🎯' : '🌱'));
        $badge_label = $funded ? 'Funded Trader' : ($passed ? 'Challenge Passed' : ($total_ch > 0 ? 'In Challenge' : 'New Trader'));

        ob_start();
        $active = 'profile';
        include FXSIM_DIR . 'templates/nav.php';
        ?>
        <div class="fxdb-body fxsim-profile-wrap">

          <!-- ── Profile header card ──────────────────────────────────── -->
          <div class="fxdb-card fxsim-profile-header-card">
            <div class="fxsim-profile-avatar"><?= esc_html($initial) ?></div>
            <div class="fxsim-profile-info">
              <div class="fxsim-profile-top">
                <h2><?= esc_html($user->display_name ?: $user->user_login) ?></h2>
                <span class="fxsim-profile-badge <?= $badge_class ?>"><?= $badge_icon ?> <?= esc_html($badge_label) ?></span>
              </div>
              <div class="fxsim-profile-meta-row">
                <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('mail','13') : '' ?>
                <span><?= esc_html($user->user_email) ?></span>
                <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('calendar','13') : '' ?>
                <span>Member since <?= esc_html($member_since) ?></span>
                <?php if ($verified): ?>
                  <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('check','13') : '' ?>
                  <span style="color:var(--green)">Verified</span>
                <?php endif; ?>
              </div>
            </div>
          </div>

          <!-- ── Stats row ────────────────────────────────────────────── -->
          <?php if ($total_trades > 0): ?>
          <div class="fxdb-card">
            <div class="fxdb-card-title"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('activity','14') : '' ?> Trading Performance</div>
            <div class="fxsim-profile-stats-grid">
              <div class="fxsim-pstat">
                <span>Total Trades</span>
                <strong><?= $total_trades ?></strong>
              </div>
              <div class="fxsim-pstat">
                <span>Win Rate</span>
                <strong style="color:<?= $win_rate >= 50 ? 'var(--green)' : 'var(--red)' ?>"><?= $win_rate ?>%</strong>
              </div>
              <div class="fxsim-pstat">
                <span>Net P&amp;L</span>
                <strong style="color:<?= $net_pnl >= 0 ? 'var(--green)' : 'var(--red)' ?>">
                  <?= ($net_pnl >= 0 ? '+' : '') . '$' . number_format(abs($net_pnl), 2) ?>
                </strong>
              </div>
              <div class="fxsim-pstat">
                <span>Avg R:R</span>
                <strong style="color:<?= $rr >= 1 ? 'var(--green)' : 'var(--yellow)' ?>"><?= $rr ?>:1</strong>
              </div>
              <div class="fxsim-pstat">
                <span>Avg Win</span>
                <strong style="color:var(--green)">$<?= $avg_win ?></strong>
              </div>
              <div class="fxsim-pstat">
                <span>Avg Loss</span>
                <strong style="color:var(--red)">$<?= $avg_loss ?></strong>
              </div>
              <?php if ($best_sym): ?>
              <div class="fxsim-pstat">
                <span>Best Instrument</span>
                <strong style="color:var(--accent)"><?= esc_html($best_sym) ?></strong>
              </div>
              <?php endif; ?>
              <div class="fxsim-pstat">
                <span>Best Trade</span>
                <strong style="color:var(--green)">$<?= number_format((float)$stats->best_trade, 2) ?></strong>
              </div>
            </div>
          </div>
          <?php endif; ?>

          <!-- ── Challenge history ─────────────────────────────────────── -->
          <div class="fxdb-card">
            <div class="fxdb-card-title"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('challenges','14') : '' ?> Challenge History</div>
            <?php
            $history = $tables_ok ? $wpdb->get_results($wpdb->prepare(
                "SELECT ca.*, cp.name AS plan_name, cp.account_size
                 FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                 JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
                 WHERE ca.user_id = %d ORDER BY ca.created_at DESC LIMIT 20", $user_id
            )) : [];
            if ($history): ?>
            <table class="fxdb-table" style="margin-top:10px">
              <thead><tr><th>Plan</th><th>Account</th><th>Phase</th><th>Status</th><th>Started</th></tr></thead>
              <tbody>
                <?php foreach ($history as $ch):
                  $sc = match($ch->status) { 'funded' => 'var(--green)', 'failed' => 'var(--red)', 'active' => 'var(--accent)', default => 'var(--text-muted)' };
                ?>
                <tr>
                  <td><?= esc_html($ch->plan_name) ?></td>
                  <td>$<?= number_format((float)$ch->account_size) ?></td>
                  <td>Phase <?= esc_html($ch->phase) ?></td>
                  <td style="color:<?= $sc ?>;font-weight:700;text-transform:capitalize"><?= esc_html($ch->status) ?></td>
                  <td style="color:var(--text-muted);font-size:12px"><?= date('M d, Y', strtotime($ch->created_at)) ?></td>
                </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
            <?php else: ?>
            <div class="fxdb-empty">
              No challenges yet. <a href="<?= home_url('/challenges/') ?>" class="fxdb-link">Browse programs →</a>
            </div>
            <?php endif; ?>
          </div>

          <!-- ── Bottom 2-col: Payout + Security ───────────────────────── -->
          <div class="fxsim-profile-bottom-grid">

            <!-- Payout Method -->
            <div class="fxdb-card">
              <div class="fxdb-card-title"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('payout','14') : '' ?> Payout Method</div>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;line-height:1.5">
                Saved details pre-fill your payout request automatically after each submission.
              </p>
              <div class="fxsim-profile-form">
                <div class="fxsim-pf-field">
                  <label>Method</label>
                  <select id="pm-method">
                    <option value="">Select…</option>
                    <option value="Wise">Wise</option>
                    <option value="PayPal">PayPal</option>
                    <option value="USDT (TRC20)">USDT (TRC20)</option>
                    <option value="USDT (ERC20)">USDT (ERC20)</option>
                    <option value="Bitcoin">Bitcoin</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="fxsim-pf-field">
                  <label>Wallet / Account Address</label>
                  <input type="text" id="pm-address" placeholder="Email, wallet address, IBAN…">
                </div>
                <div class="fxsim-pf-field">
                  <label>Additional Details <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
                  <input type="text" id="pm-details" placeholder="Account name, memo, network…">
                </div>
                <button class="fxdb-btn-primary" onclick="fxDash.savePayoutMethod()" style="width:100%">
                  <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('check','14') : '' ?>
                  Save Payout Method
                </button>
                <div id="pm-msg" style="font-size:12px;font-weight:600;text-align:center"></div>
              </div>
            </div>

            <!-- Security -->
            <div class="fxdb-card">
              <div class="fxdb-card-title"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('shield','14') : '' ?> Security Settings</div>
              <div class="fxsim-profile-security">
                <div class="fxsim-sec-row">
                  <div class="fxsim-sec-info">
                    <span class="fxsim-sec-label"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('key','14') : '' ?> Two-Factor Authentication</span>
                    <span class="fxsim-sec-desc">Email OTP required at each login</span>
                  </div>
                  <div class="fxsim-sec-action">
                    <span id="fxdb-2fa-status" class="fxsim-sec-status <?= $has_2fa ? 'on' : 'off' ?>">
                      <?= $has_2fa ? 'Enabled' : 'Disabled' ?>
                    </span>
                    <button id="fxdb-2fa-btn" class="<?= $has_2fa ? 'fxdb-btn-ghost' : 'fxdb-btn-primary' ?> fxdb-btn-sm"
                      onclick="fxDash.toggle2FA()" style="<?= $has_2fa ? '' : '' ?>">
                      <?= $has_2fa ? 'Disable' : 'Enable' ?>
                    </button>
                  </div>
                </div>
                <div class="fxsim-sec-row">
                  <div class="fxsim-sec-info">
                    <span class="fxsim-sec-label"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('mail','14') : '' ?> Email Verification</span>
                    <span class="fxsim-sec-desc"><?= esc_html($user->user_email) ?></span>
                  </div>
                  <div class="fxsim-sec-action">
                    <?php if ($verified): ?>
                    <span class="fxsim-sec-status on"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('check','12') : '' ?> Verified</span>
                    <?php else: ?>
                    <span class="fxsim-sec-status off">Not Verified</span>
                    <?php endif; ?>
                  </div>
                </div>
                <div class="fxsim-sec-row">
                  <div class="fxsim-sec-info">
                    <span class="fxsim-sec-label"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('users','14') : '' ?> Member Since</span>
                    <span class="fxsim-sec-desc"><?= esc_html($member_since) ?></span>
                  </div>
                  <div class="fxsim-sec-action">
                    <span style="font-size:12px;color:var(--text-muted)">User #<?= $user_id ?></span>
                  </div>
                </div>
              </div>
            </div>

          </div><!-- /.fxsim-profile-bottom-grid -->

        </div><!-- /.fxdb-body -->
        <?php return ob_get_clean();
    }

    public static function challenge_rules_page(): string {
        global $wpdb;
        $nav   = self::get_nav('challenge-rules');
        $brand = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';

        $plans = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}fxsim_challenge_plans
             WHERE is_active = 1
             ORDER BY price ASC"
        );

        if (empty($plans)) {
            return '<div class="fxsim-dash"><div class="fxdb-empty">No challenge plans available.</div></div>';
        }

        ob_start(); ?>
        <?= $nav ?>
        <div class="fxsim-rules-page">
          <div class="fxsim-rules-header">
            <h1><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('award','32') : '' ?> <?= esc_html($brand) ?> — Challenge Rules</h1>
            <p>Everything you need to know before you start trading.</p>
          </div>

          <!-- How it works -->
          <div class="fxsim-rules-section">
            <h2>How It Works</h2>
            <div class="fxsim-rules-steps">
              <div class="fxsim-rules-step">
                <div class="fxsim-rules-step-num">1</div>
                <h3>Phase 1 — Evaluation</h3>
                <p>Hit your profit target while staying within the daily and maximum drawdown limits. Meet the minimum trading day requirement.</p>
              </div>
              <div class="fxsim-rules-step">
                <div class="fxsim-rules-step-num">2</div>
                <h3>Phase 2 — Verification</h3>
                <p>A shorter phase with a reduced profit target. Confirm your consistency and risk management over more days.</p>
              </div>
              <div class="fxsim-rules-step">
                <div class="fxsim-rules-step-num">3</div>
                <h3>Funded Account</h3>
                <p>Receive a funded account. Trade with our capital and keep your agreed profit split — up to 90%.</p>
              </div>
            </div>
          </div>

          <!-- Plan comparison table -->
          <div class="fxsim-rules-section">
            <h2>Plan Comparison</h2>
            <div class="fxsim-rules-table-wrap">
              <table class="fxsim-rules-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <?php foreach ($plans as $plan): ?>
                      <th>
                        <div class="fxsim-rules-plan-name"><?= esc_html($plan->name) ?></div>
                        <div class="fxsim-rules-plan-size">$<?= number_format((float)$plan->account_size) ?></div>
                        <?php if ((float)$plan->price > 0): ?>
                          <div class="fxsim-rules-plan-price">$<?= number_format((float)$plan->price, 0) ?></div>
                        <?php else: ?>
                          <div class="fxsim-rules-plan-price fxsim-rules-free">FREE</div>
                        <?php endif; ?>
                      </th>
                    <?php endforeach; ?>
                  </tr>
                </thead>
                <tbody>
                  <?php
                  $rows = [
                    ['Phase 1 Profit Target', 'p1_profit_target', '%', false],
                    ['Phase 1 Daily Drawdown', 'p1_daily_dd', '%', false],
                    ['Phase 1 Max Drawdown', 'p1_max_dd', '%', false],
                    ['Phase 1 Min Trading Days', 'p1_min_days', ' days', false],
                    ['Phase 1 Max Days', 'p1_max_days', ' days', false],
                    ['Phase 2 Profit Target', 'p2_profit_target', '%', false],
                    ['Phase 2 Daily Drawdown', 'p2_daily_dd', '%', false],
                    ['Phase 2 Max Drawdown', 'p2_max_dd', '%', false],
                    ['Phase 2 Min Trading Days', 'p2_min_days', ' days', false],
                    ['Profit Split', 'funded_profit_split', '%', true],
                    ['Funded Daily Drawdown', 'funded_daily_dd', '%', false],
                    ['Funded Max Drawdown', 'funded_max_dd', '%', false],
                    ['Max Lot Size', 'max_lot_size', ' lots', false],
                    ['Max Leverage', 'max_leverage', ':1', false],
                    ['Weekend Holding', 'weekend_holding', null, false],
                    ['News Trading', 'news_trading', null, false],
                  ];
                  foreach ($rows as [$label, $field, $suffix, $highlight]):
                  ?>
                  <tr>
                    <td class="fxsim-rules-label"><?= esc_html($label) ?></td>
                    <?php foreach ($plans as $plan): ?>
                    <td class="<?= $highlight ? 'fxsim-rules-highlight' : '' ?>">
                      <?php
                      $val = $plan->$field ?? null;
                      if ($suffix === null) {
                          // Boolean field
                          echo $val ? '<span class="fxsim-rules-yes">✅ Allowed</span>'
                                    : '<span class="fxsim-rules-no">❌ Not Allowed</span>';
                      } elseif ($val !== null && $val != 0) {
                          echo esc_html($val) . esc_html($suffix);
                      } else {
                          echo '<span style="color:var(--text-muted)">—</span>';
                      }
                      ?>
                    </td>
                    <?php endforeach; ?>
                  </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </div>

          <!-- General rules -->
          <div class="fxsim-rules-section">
            <h2>General Rules</h2>
            <div class="fxsim-rules-general">
              <div class="fxsim-rules-rule">
                <span class="fxsim-rules-rule-icon">📏</span>
                <div>
                  <strong>Drawdown is measured from highest balance</strong>
                  <p>The maximum and daily drawdown limits are calculated from your highest recorded balance, not the starting balance. Protect your profits.</p>
                </div>
              </div>
              <div class="fxsim-rules-rule">
                <span class="fxsim-rules-rule-icon">🕐</span>
                <div>
                  <strong>A trading day counts when you place at least one trade</strong>
                  <p>A calendar day (00:00–23:59 UTC) counts toward your minimum when you open at least one position.</p>
                </div>
              </div>
              <div class="fxsim-rules-rule">
                <span class="fxsim-rules-rule-icon">💰</span>
                <div>
                  <strong>Profit target is net — including commissions</strong>
                  <p>Your profit target is calculated on your net balance after commissions and swap fees are deducted.</p>
                </div>
              </div>
              <div class="fxsim-rules-rule">
                <span class="fxsim-rules-rule-icon">📅</span>
                <div>
                  <strong>Weekend positions may be closed automatically</strong>
                  <p>On plans where weekend holding is not allowed, all open positions are automatically closed at Friday 22:00 UTC.</p>
                </div>
              </div>
              <div class="fxsim-rules-rule">
                <span class="fxsim-rules-rule-icon">🔄</span>
                <div>
                  <strong>Consistent trading is expected</strong>
                  <p>No single trade may account for more than 40% of total profit. Consistent risk management is required.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- CTA -->
          <div class="fxsim-rules-cta">
            <a href="<?= home_url('/challenges/') ?>" class="fxsim-btn-primary" style="display:inline-flex;padding:14px 32px;font-size:15px">
              Start a Challenge →
            </a>
            <?php if (is_user_logged_in()): ?>
            <a href="<?= home_url('/dashboard/') ?>" class="fxsim-btn-ghost" style="display:inline-flex;padding:14px 24px;font-size:15px;margin-left:12px">
              My Dashboard
            </a>
            <?php endif; ?>
          </div>
        </div>

        <?php return ob_get_clean();
    }

    public static function certificate_page(): string {
        return ob_get_clean();
    }

    // ── Password Reset Page ───────────────────────────────────────────────────
    public static function reset_password_page(): string {
        // If already logged in, redirect to dashboard
        if (is_user_logged_in()) {
            return '<script>window.location.replace("' . esc_js(home_url('/dashboard/')) . '");</script>';
        }

        $brand = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';

        // Detect reset key in URL — show "set new password" form
        $key   = sanitize_text_field($_GET['key']   ?? '');
        $login = sanitize_user($_GET['login'] ?? '');
        $step  = ($key && $login) ? 'new_password' : 'request';

        ob_start(); ?>
        <div class="fxsim-auth-wrap">
          <div class="fxsim-auth-box">
            <div class="fxsim-logo">⚡ <?= esc_html($brand) ?></div>

            <?php if ($step === 'request'): ?>
              <h2>Reset Password</h2>
              <p class="fxsim-auth-sub">Enter your email or username and we'll send a reset link.</p>
              <div id="fxreset-request-form">
                <div class="fxsim-field">
                  <label>Email or Username</label>
                  <input type="text" id="fxreset-login" placeholder="your@email.com"
                         autocomplete="username">
                </div>
                <button id="fxreset-submit" class="fxsim-btn-primary w-full"
                        onclick="fxResetPw.requestReset()">Send Reset Link</button>
              </div>
              <div id="fxreset-msg" style="display:none;margin-top:12px;padding:10px;
                border-radius:6px;font-size:13px;font-weight:600"></div>
              <p class="fxsim-auth-link">
                <a href="<?= home_url('/login/') ?>">← Back to login</a>
              </p>

            <?php else: ?>
              <h2>Set New Password</h2>
              <p class="fxsim-auth-sub">Choose a strong password for your account.</p>
              <div id="fxreset-pw-form">
                <div class="fxsim-field">
                  <label>New Password</label>
                  <input type="password" id="fxreset-pw" placeholder="Min. 6 characters"
                         autocomplete="new-password">
                </div>
                <div class="fxsim-field">
                  <label>Confirm Password</label>
                  <input type="password" id="fxreset-pw2" placeholder="Repeat password"
                         autocomplete="new-password">
                </div>
                <button id="fxreset-pw-submit" class="fxsim-btn-primary w-full"
                        onclick="fxResetPw.doReset('<?= esc_js($key) ?>', '<?= esc_js($login) ?>')">
                  Update Password
                </button>
              </div>
              <div id="fxreset-msg" style="display:none;margin-top:12px;padding:10px;
                border-radius:6px;font-size:13px;font-weight:600"></div>
            <?php endif; ?>
          </div>
        </div>

        <script>
        const fxResetPw = (() => {
          const api = '<?= esc_js(rtrim(rest_url('fxsim/v1'), '/')) ?>';

          function showMsg(msg, ok) {
            const el = document.getElementById('fxreset-msg');
            if (!el) return;
            el.style.display  = 'block';
            el.style.background = ok ? 'rgba(0,229,160,.12)' : 'rgba(255,71,87,.12)';
            el.style.color      = ok ? '#00e5a0' : '#ff4757';
            el.style.border     = `1px solid ${ok ? '#00e5a0' : '#ff4757'}`;
            el.textContent = msg;
          }

          async function requestReset() {
            const login  = document.getElementById('fxreset-login')?.value?.trim();
            const btn    = document.getElementById('fxreset-submit');
            if (!login) { showMsg('Please enter your email or username.', false); return; }
            if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
            try {
              const r = await fetch(api + '/auth/request-reset', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ login }),
              });
              const data = await r.json();
              showMsg(data.message || 'Reset email sent if account exists.', true);
            } catch(e) {
              showMsg('Request failed. Check your connection.', false);
            } finally {
              if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
            }
          }

          async function doReset(key, login) {
            const pw   = document.getElementById('fxreset-pw')?.value || '';
            const pw2  = document.getElementById('fxreset-pw2')?.value || '';
            const btn  = document.getElementById('fxreset-pw-submit');
            if (pw.length < 6)  { showMsg('Password must be at least 6 characters.', false); return; }
            if (pw !== pw2)     { showMsg('Passwords do not match.', false); return; }
            if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
            try {
              const r = await fetch(api + '/auth/do-reset', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ key, login, password: pw }),
              });
              const data = await r.json();
              if (data.success) {
                showMsg('✓ ' + data.message, true);
                document.getElementById('fxreset-pw-form').style.display = 'none';
                setTimeout(() => { window.location.href = '<?= esc_js(home_url('/login/')) ?>'; }, 2000);
              } else {
                showMsg('✗ ' + (data.error || 'Failed. Request a new link.'), false);
                if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
              }
            } catch(e) {
              showMsg('Request failed. Check your connection.', false);
              if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
            }
          }

          return { requestReset, doReset };
        })();
        </script>
        <?php return ob_get_clean();
    }
}
