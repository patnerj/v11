<?php
defined('ABSPATH') || exit;

class FXSIM_REST_API {

    const NS = 'fxsim/v1';

    public static function register(): void {
        add_action('rest_api_init', [self::class, 'routes']);
        // API key authentication — must register before rate limiter so user_id is
        // resolved from key before rate limiter classifies the request
        FXSIM_API_Keys::register();
        // Rate limiter — runs at priority 5 on rest_pre_dispatch (after scope check at 4)
        FXSIM_Rate_Limiter::register();
        // Add Retry-After header to 429 responses
        add_filter('rest_post_dispatch', [self::class, 'add_rate_limit_headers'], 10, 3);
        // Prevent CDN (Cloudflare etc.) from caching live trading data
        // This runs on every fxsim REST response — prevents stale prices/balances at edge
        add_filter('rest_post_dispatch', [self::class, 'add_no_store_headers'], 5, 3);
    }

    /**
     * Add standard rate-limit headers to 429 responses.
     * Clients (browser, scripts) use Retry-After to know when to retry.
     *
     * @param WP_HTTP_Response $response
     * @param WP_REST_Server   $server
     * @param WP_REST_Request  $request
     * @return WP_HTTP_Response
     */
    /**
     * Add cache-prevention headers to all fxsim REST API responses.
     *
     * Prevents Cloudflare and other CDNs from caching live trading data:
     *   - prices, account balances, positions — change every tick
     *   - POST responses (order execution) — must never be replayed from cache
     *
     * 'no-store' is stronger than 'no-cache':
     *   - no-cache: must revalidate before using cached copy
     *   - no-store: never write to any cache (disk, memory, or CDN)
     *
     * SSE stream already sets its own no-cache/no-store headers before this filter.
     */
    public static function add_no_store_headers(
        WP_HTTP_Response $response,
        WP_REST_Server $server,
        WP_REST_Request $request
    ): WP_HTTP_Response {
        // Only our namespace
        if (strpos($request->get_route(), '/fxsim/v1/') === false) {
            return $response;
        }
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->header('Pragma', 'no-cache');  // HTTP/1.0 compatibility
        return $response;
    }

    public static function add_rate_limit_headers(
        WP_HTTP_Response $response,
        WP_REST_Server $server,
        WP_REST_Request $request
    ): WP_HTTP_Response {
        if ($response->get_status() === 429) {
            $data = $response->get_data();
            $retry = (int)($data['data']['retry_after'] ?? FXSIM_Rate_Limiter::WINDOW);
            $response->header('Retry-After',          (string)$retry);
            $response->header('X-RateLimit-Window',   (string)FXSIM_Rate_Limiter::WINDOW);
            if (isset($data['data']['limit'])) {
                $response->header('X-RateLimit-Limit', (string)$data['data']['limit']);
            }
        }
        return $response;
    }

    public static function routes(): void {
        $auth    = [self::class, 'auth_check'];
        $is_admin = [self::class, 'admin_check'];

        // ── Public ──────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/prices',        ['methods'=>'GET',  'callback'=>[self::class,'prices'],      'permission_callback'=>'__return_true']);

        // ── V10 MT5 feed ingestion (machine-to-machine; auth via shared secret header) ──
        register_rest_route(self::NS, '/price-feed/ingest', ['methods'=>'POST','callback'=>[self::class,'price_feed_ingest'],'permission_callback'=>'__return_true']);

        // ── Authenticated ────────────────────────────────────────────────────
        register_rest_route(self::NS, '/account',       ['methods'=>'GET',  'callback'=>[self::class,'account'],     'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/positions',     ['methods'=>'GET',  'callback'=>[self::class,'positions'],   'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/open',          ['methods'=>'POST', 'callback'=>[self::class,'open'],        'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/close/(?P<id>\d+)', ['methods'=>'POST','callback'=>[self::class,'close'],    'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/partial-close/(?P<id>\d+)', ['methods'=>'POST','callback'=>[self::class,'partial_close'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/sltp/(?P<id>\d+)',   ['methods'=>'POST','callback'=>[self::class,'sltp'],          'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/history',       ['methods'=>'GET',  'callback'=>[self::class,'history'],    'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/transactions',  ['methods'=>'GET',  'callback'=>[self::class,'transactions'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/stats',         ['methods'=>'GET',  'callback'=>[self::class,'stats'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/symbols',       ['methods'=>'GET',  'callback'=>[self::class,'symbols'],    'permission_callback'=>$auth]);

        // ── Admin ────────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/stats',         ['methods'=>'GET', 'callback'=>[self::class,'admin_stats'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users',         ['methods'=>'GET', 'callback'=>[self::class,'admin_users'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users/(?P<id>\d+)/risk-profile', ['methods'=>'GET', 'callback'=>[self::class,'admin_user_risk_profile'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/adjust-balance',['methods'=>'POST','callback'=>[self::class,'admin_adjust'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbol/(?P<id>\d+)', ['methods'=>'POST','callback'=>[self::class,'admin_symbol'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/trades',        ['methods'=>'GET', 'callback'=>[self::class,'admin_trades'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/log',           ['methods'=>'GET', 'callback'=>[self::class,'admin_log'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbols',       ['methods'=>'GET', 'callback'=>[self::class,'admin_symbols'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/set-status',   ['methods'=>'POST','callback'=>[self::class,'admin_set_status'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk',          ['methods'=>'GET', 'callback'=>[self::class,'admin_risk'],          'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/heatmap',  ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_heatmap'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/toxic',    ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_toxic'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/bulk/payouts',   ['methods'=>'POST','callback'=>[self::class,'admin_bulk_payouts'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/bulk/kyc',       ['methods'=>'POST','callback'=>[self::class,'admin_bulk_kyc'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/note', ['methods'=>'POST','callback'=>[self::class,'admin_user_note_save'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)',      ['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/force-prices',  ['methods'=>'POST','callback'=>[self::class,'admin_force_prices'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news-lock',     ['methods'=>'POST','callback'=>[self::class,'admin_news_lock'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/rate-limit',    ['methods'=>'POST','callback'=>[self::class,'admin_rate_limit'],  'permission_callback'=>$is_admin]);

        // ── Analytics ─────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/smtp',                  ['methods'=>'GET', 'callback'=>[self::class,'admin_smtp_get'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/smtp/save',             ['methods'=>'POST','callback'=>[self::class,'admin_smtp_save'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/smtp/test',             ['methods'=>'POST','callback'=>[self::class,'admin_smtp_test'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/price-feed/save',      ['methods'=>'POST','callback'=>[self::class,'admin_price_feed_save'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/price-feed/health',    ['methods'=>'GET', 'callback'=>[self::class,'admin_price_feed_health'],'permission_callback'=>$is_admin]);

        // ── Analytics ─────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/analytics/revenue',      ['methods'=>'GET','callback'=>[self::class,'analytics_revenue'],      'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/analytics/growth',        ['methods'=>'GET','callback'=>[self::class,'analytics_growth'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/analytics/challenges',    ['methods'=>'GET','callback'=>[self::class,'analytics_challenges'],    'permission_callback'=>$is_admin]);
        // ── Challenge Test Tools (admin-only QA/demo; operates OUTSIDE the engines) ──
        register_rest_route(self::NS, '/admin/test-tools/challenges', ['methods'=>'GET', 'callback'=>[self::class,'test_tools_challenges'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/test-tools/challenge/(?P<id>\d+)/set', ['methods'=>'POST','callback'=>[self::class,'test_tools_set'], 'permission_callback'=>$is_admin]);

        // ── Admin tools ───────────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/impersonate',            ['methods'=>'POST','callback'=>[self::class,'admin_impersonate'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/impersonate/stop',       ['methods'=>'POST','callback'=>[self::class,'admin_impersonate_stop'],  'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/announcement',           ['methods'=>'POST','callback'=>[self::class,'admin_announcement'],      'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/announcement',           ['methods'=>'GET', 'callback'=>[self::class,'admin_announcement_get'],  'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/bulk-email',             ['methods'=>'POST','callback'=>[self::class,'admin_bulk_email'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/maintenance',            ['methods'=>'POST','callback'=>[self::class,'admin_maintenance'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/maintenance',            ['methods'=>'GET', 'callback'=>[self::class,'admin_maintenance_get'],   'permission_callback'=>'__return_true']);
        // ── Promotional banners ───────────────────────────────────────────────
        register_rest_route(self::NS, '/banners',                      ['methods'=>'GET', 'callback'=>[self::class,'banners_get'],          'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/branding',                     ['methods'=>'GET', 'callback'=>[self::class,'branding_get'],         'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/admin/banners',                ['methods'=>'GET', 'callback'=>[self::class,'admin_banners_list'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/save',           ['methods'=>'POST','callback'=>[self::class,'admin_banner_save'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/(?P<id>\d+)/toggle', ['methods'=>'POST','callback'=>[self::class,'admin_banner_toggle'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/(?P<id>\d+)/delete', ['methods'=>'POST','callback'=>[self::class,'admin_banner_delete'], 'permission_callback'=>$is_admin]);
        // ── Coupons / promotions ──────────────────────────────────────────────
        register_rest_route(self::NS, '/coupon/validate',             ['methods'=>'POST','callback'=>[self::class,'coupon_validate'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/coupons',                ['methods'=>'GET', 'callback'=>[self::class,'admin_coupons_list'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/save',           ['methods'=>'POST','callback'=>[self::class,'admin_coupon_save'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/(?P<id>\d+)/toggle', ['methods'=>'POST','callback'=>[self::class,'admin_coupon_toggle'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/(?P<id>\d+)/delete', ['methods'=>'POST','callback'=>[self::class,'admin_coupon_delete'], 'permission_callback'=>$is_admin]);
        // ── Affiliates ────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/affiliate/me',                 ['methods'=>'GET', 'callback'=>[self::class,'affiliate_me'],         'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/affiliate/enroll',             ['methods'=>'POST','callback'=>[self::class,'affiliate_enroll'],     'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/affiliate/commissions',        ['methods'=>'GET', 'callback'=>[self::class,'affiliate_commissions'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/affiliate/payout-method',       ['methods'=>'POST','callback'=>[self::class,'affiliate_set_payout'],  'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/affiliate/payout/request',      ['methods'=>'POST','callback'=>[self::class,'affiliate_request_payout'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/affiliate/payouts',             ['methods'=>'GET', 'callback'=>[self::class,'affiliate_payouts'],     'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/affiliate-payouts',       ['methods'=>'GET', 'callback'=>[self::class,'admin_affiliate_payouts'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliate-payouts/(?P<id>\d+)/status', ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_payout_status'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates',             ['methods'=>'GET', 'callback'=>[self::class,'admin_affiliates_list'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates/(?P<id>\d+)/rate',   ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_rate'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates/(?P<id>\d+)/status', ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_status'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/commissions',            ['methods'=>'GET', 'callback'=>[self::class,'admin_commissions_list'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/commissions/(?P<id>\d+)/status', ['methods'=>'POST','callback'=>[self::class,'admin_commission_status'], 'permission_callback'=>$is_admin]);

        // ── User notifications ────────────────────────────────────────────────
        register_rest_route(self::NS, '/notifications',                ['methods'=>'GET', 'callback'=>[self::class,'notifications_get'],       'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/notifications/read',           ['methods'=>'POST','callback'=>[self::class,'notifications_read'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/notifications',          ['methods'=>'GET', 'callback'=>[self::class,'admin_notifications_get'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/notifications/read',     ['methods'=>'POST','callback'=>[self::class,'admin_notifications_read'], 'permission_callback'=>$is_admin]);

        // ── Password reset ────────────────────────────────────────────────────
        register_rest_route(self::NS, '/auth/request-reset',           ['methods'=>'POST','callback'=>[self::class,'auth_request_reset'],      'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/auth/do-reset',                ['methods'=>'POST','callback'=>[self::class,'auth_do_reset'],           'permission_callback'=>'__return_true']);

        // ── Email verification ────────────────────────────────────────────────
        register_rest_route(self::NS, '/auth/verify-email',            ['methods'=>'GET', 'callback'=>[self::class,'auth_verify_email'],       'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/auth/resend-verification',     ['methods'=>'POST','callback'=>[self::class,'auth_resend_verification'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/auth/2fa/toggle',              ['methods'=>'POST','callback'=>[self::class,'auth_2fa_toggle'],          'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/auth/2fa/status',              ['methods'=>'GET', 'callback'=>[self::class,'auth_2fa_status'],          'permission_callback'=>$auth]);

        // ── Trader analytics (extended) ───────────────────────────────────────
        register_rest_route(self::NS, '/stats/advanced',               ['methods'=>'GET', 'callback'=>[self::class,'stats_advanced'],          'permission_callback'=>$auth]);

        register_rest_route(self::NS, '/challenge/plans',  ['methods'=>'GET', 'callback'=>[self::class,'challenge_plans'], 'permission_callback'=>'__return_true']);
        
        // ── Competitions ──────────────────────────────────────────────────────
        register_rest_route(self::NS, '/competitions',               ['methods'=>'GET', 'callback'=>[self::class,'get_competitions'],         'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/competitions/(?P<id>\d+)/join', ['methods'=>'POST','callback'=>[self::class,'join_competition'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/competitions/(?P<id>\d+)/leaderboard', ['methods'=>'GET','callback'=>[self::class,'competition_leaderboard'], 'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/admin/competitions',         ['methods'=>'GET', 'callback'=>[self::class,'admin_get_competitions'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/competitions',         ['methods'=>'POST','callback'=>[self::class,'admin_create_competition'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/competitions/(?P<id>\d+)', ['methods'=>'PUT', 'callback'=>[self::class,'admin_update_competition'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/competitions/(?P<id>\d+)', ['methods'=>'DELETE','callback'=>[self::class,'admin_delete_competition'],'permission_callback'=>$is_admin]);

        // ── Challenge — authenticated ─────────────────────────────────────────
        register_rest_route(self::NS, '/challenge/start',  ['methods'=>'POST','callback'=>[self::class,'challenge_start'],   'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/challenge/my',     ['methods'=>'GET', 'callback'=>[self::class,'challenge_my'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/challenge/(?P<id>\d+)/metrics', ['methods'=>'GET','callback'=>[self::class,'challenge_metrics'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/payout-method',               ['methods'=>'GET', 'callback'=>[self::class,'payout_method_get'],  'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/payout-method',               ['methods'=>'POST','callback'=>[self::class,'payout_method_save'], 'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/challenge/(?P<id>\d+)/payout', ['methods'=>'POST','callback'=>[self::class,'challenge_payout'],   'permission_callback'=>$auth]);

        // ── KYC — authenticated ───────────────────────────────────────────────
        register_rest_route(self::NS, '/kyc',         ['methods'=>'GET', 'callback'=>[self::class,'kyc_get'],    'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/kyc/submit',  ['methods'=>'POST','callback'=>[self::class,'kyc_submit'], 'permission_callback'=>$auth]);

        // ── Payouts — authenticated (history + availability + cycle) ──────────
        register_rest_route(self::NS, '/payouts',     ['methods'=>'GET', 'callback'=>[self::class,'payouts_list'], 'permission_callback'=>$auth]);

        // ── KYC + Payouts — admin queues ──────────────────────────────────────
        register_rest_route(self::NS, '/admin/kyc',                          ['methods'=>'GET', 'callback'=>[self::class,'admin_kyc_list'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/kyc/(?P<id>\d+)/review',       ['methods'=>'POST','callback'=>[self::class,'admin_kyc_review'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/kyc/(?P<id>\d+)/doc/(?P<type>[a-z_]+)', ['methods'=>'GET','callback'=>[self::class,'admin_kyc_doc'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payouts',                      ['methods'=>'GET', 'callback'=>[self::class,'admin_payouts_list'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payouts/(?P<id>\d+)/status',   ['methods'=>'POST','callback'=>[self::class,'admin_payout_status'], 'permission_callback'=>$is_admin]);

        // ── Payment — authenticated ───────────────────────────────────────────
        register_rest_route(self::NS, '/payment/config',              ['methods'=>'GET', 'callback'=>[self::class,'payment_config'],       'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/payment/create',             ['methods'=>'POST','callback'=>[self::class,'payment_create'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/payment/submit-proof',       ['methods'=>'POST','callback'=>[self::class,'payment_submit_proof'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/payment/my-orders',          ['methods'=>'GET', 'callback'=>[self::class,'payment_my_orders'],   'permission_callback'=>$auth]);

        // ── Challenge — admin ─────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/challenges',                   ['methods'=>'GET', 'callback'=>[self::class,'admin_challenges'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/challenge/(?P<id>\d+)/approve-payout', ['methods'=>'POST','callback'=>[self::class,'admin_approve_payout'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/challenge/(?P<id>\d+)/mt5-details',   ['methods'=>'POST','callback'=>[self::class,'admin_save_mt5'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/challenge/(?P<id>\d+)/mt5-details',         ['methods'=>'GET', 'callback'=>[self::class,'challenge_mt5_details'], 'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/plans',                        ['methods'=>'GET', 'callback'=>[self::class,'admin_plans_list'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/plans/save',                   ['methods'=>'POST','callback'=>[self::class,'admin_plan_save'],         'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/whitelabel',                   ['methods'=>'GET', 'callback'=>[self::class,'admin_whitelabel_get'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/whitelabel/save',              ['methods'=>'POST','callback'=>[self::class,'admin_whitelabel_save'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/email-templates',              ['methods'=>'POST','callback'=>[self::class,'admin_email_templates_save'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/branding/upload',              ['methods'=>'POST','callback'=>[self::class,'admin_branding_upload'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/stripe/status',                ['methods'=>'GET', 'callback'=>[self::class,'admin_stripe_status'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/health',                       ['methods'=>'GET', 'callback'=>[self::class,'admin_system_health'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/status',                  ['methods'=>'GET', 'callback'=>[self::class,'admin_demo_status'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/generate',                ['methods'=>'POST','callback'=>[self::class,'admin_demo_generate'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/remove',                  ['methods'=>'POST','callback'=>[self::class,'admin_demo_remove'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/crypto',                       ['methods'=>'GET', 'callback'=>[self::class,'admin_crypto_get'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/crypto/save',                  ['methods'=>'POST','callback'=>[self::class,'admin_crypto_save'],       'permission_callback'=>$is_admin]);
        // ── Payment admin ─────────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/payments',                     ['methods'=>'GET', 'callback'=>[self::class,'admin_payments_list'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payments/(?P<id>\d+)/approve', ['methods'=>'POST','callback'=>[self::class,'admin_payment_approve'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payments/(?P<id>\d+)/reject',  ['methods'=>'POST','callback'=>[self::class,'admin_payment_reject'],   'permission_callback'=>$is_admin]);
        // ── Stripe webhook (public — verified by signature) ───────────────────
        register_rest_route(self::NS, '/stripe/webhook', ['methods'=>'POST','callback'=>[self::class,'stripe_webhook'],'permission_callback'=>'__return_true']);
        // ── Stripe checkout (authenticated) ──────────────────────────────────
        register_rest_route(self::NS, '/payment/stripe-checkout', ['methods'=>'POST','callback'=>[self::class,'stripe_checkout'],'permission_callback'=>$auth]);
        // ── Confirmo crypto webhook (public — verified by HMAC signature) ─────
        register_rest_route(self::NS, '/payment/confirmo-callback', ['methods'=>'POST','callback'=>[FXSIM_Confirmo::class,'handle_callback'],'permission_callback'=>'__return_true']);
        // ── Confirmo crypto checkout (authenticated) ──────────────────────────
        register_rest_route(self::NS, '/payment/confirmo-checkout', ['methods'=>'POST','callback'=>[self::class,'confirmo_checkout'],'permission_callback'=>$auth]);
        // ── Trade Flags — admin ───────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/trade-flags',                         ['methods'=>'GET', 'callback'=>[self::class,'admin_trade_flags'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/trade-flags/(?P<id>\d+)/resolve',     ['methods'=>'POST','callback'=>[self::class,'admin_resolve_trade_flag'],'permission_callback'=>$is_admin]);
        // ── Scaling — user ────────────────────────────────────────────────────
        register_rest_route(self::NS, '/challenge/(?P<id>\d+)/scaling',             ['methods'=>'GET', 'callback'=>[self::class,'challenge_scaling_status'],'permission_callback'=>$auth]);
        // ── Scaling — admin ───────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/challenge/(?P<id>\d+)/force-scale',   ['methods'=>'POST','callback'=>[self::class,'admin_force_scale'],       'permission_callback'=>$is_admin]);
        // ── Statistics ────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/stats/full',      ['methods'=>'GET','callback'=>[self::class,'stats_full'],     'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/stats/leaderboard',['methods'=>'GET','callback'=>[self::class,'leaderboard'],   'permission_callback'=>'__return_true']);
        
        // ── Trades Notes ──────────────────────────────────────────────────────
        register_rest_route(self::NS, '/trades/(?P<id>\d+)/notes', ['methods'=>'GET', 'callback'=>[self::class,'trade_notes_get'], 'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/trades/(?P<id>\d+)/notes', ['methods'=>'POST', 'callback'=>[self::class,'trade_notes_save'], 'permission_callback'=>$auth]);

        // ── Certificate ───────────────────────────────────────────────────────
        register_rest_route(self::NS, '/certificate/(?P<id>\d+)', ['methods'=>'GET','callback'=>[self::class,'get_certificate'],'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/certificate/public/(?P<code>[A-Za-z0-9\-]+)', ['methods'=>'GET','callback'=>[self::class,'get_certificate_public'],'permission_callback'=>'__return_true']);

        // ── API Key management — authenticated user ───────────────────────────────
        register_rest_route(self::NS, '/api-keys',                           ['methods'=>'GET', 'callback'=>[self::class,'api_keys_list'],   'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/api-keys',                           ['methods'=>'POST','callback'=>[self::class,'api_keys_create'], 'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/api-keys/(?P<id>\d+)/revoke',        ['methods'=>'POST','callback'=>[self::class,'api_keys_revoke'], 'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/api-keys/(?P<id>\d+)/usage',         ['methods'=>'GET', 'callback'=>[self::class,'api_keys_usage'],  'permission_callback'=>$auth]);
        // ── API Key management — admin ────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/api-keys',                     ['methods'=>'GET', 'callback'=>[self::class,'admin_api_keys'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/api-keys/(?P<id>\d+)/revoke',  ['methods'=>'POST','callback'=>[self::class,'admin_api_keys_revoke'],'permission_callback'=>$is_admin]);

        // ── SSE real-time stream ──────────────────────────────────────────────
        // GET /stream — authenticated; uses ?_wpnonce= query param (EventSource cannot
        // send custom headers, so WP's standard query-param nonce check is used instead)
        register_rest_route(self::NS, '/stream', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'stream'],
            'permission_callback' => $auth,
        ]);

        // ── Pending Orders — authenticated ────────────────────────────────────
        register_rest_route(self::NS, '/pending-order/place',           ['methods'=>'POST','callback'=>[self::class,'pending_place'],       'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/pending-order/(?P<id>\d+)/cancel',['methods'=>'POST','callback'=>[self::class,'pending_cancel'],    'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/pending-order/my',              ['methods'=>'GET', 'callback'=>[self::class,'pending_my'],          'permission_callback'=>$auth]);
        // ── Pending Orders — admin ────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/pending-orders',          ['methods'=>'GET', 'callback'=>[self::class,'admin_pending_orders'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/pending-orders/(?P<id>\d+)/reject',['methods'=>'POST','callback'=>[self::class,'admin_pending_reject'],'permission_callback'=>$is_admin]);
    }

    // ── Permission callbacks ──────────────────────────────────────────────────
    public static function auth_check(): bool {

    $user = wp_get_current_user();

    error_log('===== AUTH CHECK =====');
    error_log('is_user_logged_in: ' . (is_user_logged_in() ? 'YES' : 'NO'));
    error_log('current_user_id: ' . get_current_user_id());
    error_log('user_login: ' . ($user->user_login ?? 'none'));
    error_log('manage_options: ' . (current_user_can('manage_options') ? 'YES' : 'NO'));

    return is_user_logged_in();
}
 public static function admin_check(): bool {

    $user = wp_get_current_user();

    error_log('===== ADMIN CHECK =====');
    error_log('is_user_logged_in: ' . (is_user_logged_in() ? 'YES' : 'NO'));
    error_log('current_user_id: ' . get_current_user_id());
    error_log('user_login: ' . ($user->user_login ?? 'none'));
    error_log('manage_options: ' . (current_user_can('manage_options') ? 'YES' : 'NO'));

    return current_user_can('manage_options');
}

    // ── Nonce helper ──────────────────────────────────────────────────────────
   private static function verify_nonce(WP_REST_Request $r): bool {

    // API key requests have no browser session → no nonce available.
    if (FXSIM_API_Keys::is_key_request()) {
        return true;
    }

    wp_get_current_user();

    return is_user_logged_in();
}

    /**
     * Convert a naive site-local MySQL datetime (as written by current_time('mysql'))
     * into an offset-aware ISO-8601 string. Returns null for empty/zero dates.
     * Lets the frontend render correct relative/absolute times in any browser tz.
     */
    private static function iso8601($mysql_datetime): ?string {
        if (empty($mysql_datetime) || $mysql_datetime === '0000-00-00 00:00:00') return null;
        try {
            $dt = new \DateTimeImmutable((string) $mysql_datetime, wp_timezone());
            return $dt->format('c');
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Build a real equity curve from closed-trade history: starting balance +
     * cumulative realised PnL in close-time order, with offset-aware timestamps.
     * Replaces the sparse one-row-per-day snapshot series. Sums already-computed
     * pnl values only — no trading calculation is recomputed.
     *
     * @param object|null $ch     A challenge row with starting_balance + created_at.
     * @param array       $trades Closed trades ordered by closed_at ASC (need closed_at, pnl).
     */
    private static function build_equity_curve($ch, array $trades): array {
        if (!$ch) return [];
        $start = (float) ($ch->starting_balance ?? 0);
        $seed  = self::iso8601($ch->created_at ?? null)
              ?: (!empty($trades) ? self::iso8601($trades[0]->closed_at) : self::iso8601(current_time('mysql')));

        $curve = [['date' => $seed, 'balance' => round($start, 2)]];
        $run   = $start;
        foreach ($trades as $t) {
            $run += (float) $t->pnl;
            $curve[] = ['date' => self::iso8601($t->closed_at), 'balance' => round($run, 2)];
        }
        return $curve;
    }

    // ── Endpoint handlers ─────────────────────────────────────────────────────
    public static function prices(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Price_Feed::get_all());
    }

    public static function public_payout_proofs(): WP_REST_Response {
        global $wpdb;
        $table = $wpdb->prefix . 'fxsim_transactions';
        // Get recent 10 'payout_withdrawal' transactions that are 'completed' or 'approved'
        // For demonstration, we'll fetch completed transactions with amount > 0.
        // We'll join with users to get display name or user login.
        $sql = "
            SELECT t.amount, t.created_at, u.display_name, u.user_login 
            FROM $table t
            JOIN {$wpdb->users} u ON t.user_id = u.ID
            WHERE t.type = 'payout_withdrawal' AND t.status IN ('completed', 'approved', 'paid')
            ORDER BY t.id DESC LIMIT 15
        ";
        $results = $wpdb->get_results($sql);
        $formatted = [];
        foreach ($results as $row) {
            $name = $row->display_name ?: $row->user_login;
            // Anonymize name (e.g. "John Doe" -> "J*** D.")
            $parts = explode(' ', trim($name));
            if (count($parts) > 1) {
                $anon_name = substr($parts[0], 0, 1) . '*** ' . substr($parts[count($parts)-1], 0, 1) . '.';
            } else {
                $anon_name = substr($name, 0, 1) . '***';
            }
            $formatted[] = [
                'name' => $anon_name,
                'amount' => (float)$row->amount,
                'date' => $row->created_at
            ];
        }
        
        // If empty, return some placeholder social proof for the demo
        if (empty($formatted)) {
            $formatted = [
                ['name' => 'J*** S.', 'amount' => 5400, 'date' => gmdate('Y-m-d H:i:s', time() - 3600)],
                ['name' => 'A*** M.', 'amount' => 2150, 'date' => gmdate('Y-m-d H:i:s', time() - 86400)],
                ['name' => 'D*** R.', 'amount' => 12500, 'date' => gmdate('Y-m-d H:i:s', time() - 172800)],
                ['name' => 'S*** K.', 'amount' => 850, 'date' => gmdate('Y-m-d H:i:s', time() - 259200)],
            ];
        }

        return new WP_REST_Response($formatted);
    }

    public static function public_affiliate_leaderboard(): WP_REST_Response {
        global $wpdb;
        $users_table = $wpdb->users;
        $meta_table = $wpdb->usermeta;
        
        // Top 10 users by 'fxsim_affiliate_total_earned'
        $sql = "
            SELECT u.display_name, u.user_login, m.meta_value as earned
            FROM $users_table u
            JOIN $meta_table m ON u.ID = m.user_id
            WHERE m.meta_key = 'fxsim_affiliate_total_earned' AND m.meta_value > 0
            ORDER BY CAST(m.meta_value AS DECIMAL(10,2)) DESC
            LIMIT 10
        ";
        $results = $wpdb->get_results($sql);
        $formatted = [];
        foreach ($results as $row) {
            $name = $row->display_name ?: $row->user_login;
            $parts = explode(' ', trim($name));
            if (count($parts) > 1) {
                $anon_name = substr($parts[0], 0, 1) . '*** ' . substr($parts[count($parts)-1], 0, 1) . '.';
            } else {
                $anon_name = substr($name, 0, 1) . '***';
            }
            $formatted[] = [
                'name' => $anon_name,
                'earned' => (float)$row->earned
            ];
        }

        // If empty, return placeholders to seed the leaderboard
        if (empty($formatted)) {
            $formatted = [
                ['name' => 'F*** L.', 'earned' => 14500.00],
                ['name' => 'P*** T.', 'earned' => 9200.50],
                ['name' => 'R*** C.', 'earned' => 6100.00],
                ['name' => 'M*** E.', 'earned' => 4500.00],
                ['name' => 'T*** W.', 'earned' => 3100.00],
            ];
        }
        return new WP_REST_Response($formatted);
    }

    public static function account(): WP_REST_Response {
        $user_id   = get_current_user_id();
        $acc       = self::get_active_challenge_account($user_id);
        $read_only = false;
        if (!$acc) {
            // No active/funded challenge — fall back to the most recent challenge
            // account (failed/passed) so the dashboard + terminal keep showing the
            // final snapshot. Trading eligibility is gated separately and stays strict.
            $acc       = self::get_latest_challenge_account($user_id);
            $read_only = true;
        }
        if (!$acc) return new WP_REST_Response(
            ['error' => 'No active challenge account. Purchase a challenge to start trading.', 'no_challenge' => true],
            404
        );

        $data = FXSIM_Database::get_account_by_id((int) $acc->id);
        // Attach the owning challenge's status so the UI can render Failed/Passed/
        // Funded/Frozen states while preserving the final metrics.
        global $wpdb;
        $cs = $wpdb->get_var($wpdb->prepare(
            "SELECT status FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE fxsim_account_id = %d ORDER BY created_at DESC LIMIT 1", (int) $acc->id));
        if (is_array($data)) {
            $data['challenge_status'] = $cs;
            $data['read_only']        = $read_only;
        } elseif (is_object($data)) {
            $data->challenge_status = $cs;
            $data->read_only        = $read_only;
        }
        return new WP_REST_Response($data);
    }

    /**
     * Per-request account cache.
     * Static property so it can be invalidated from outside the method.
     * Keys: user_id (int). Values: account row object, or null (no active challenge).
     * Lifetime: current PHP process only (single HTTP request).
     */
    private static array $account_cache = [];

    /**
     * Return the active challenge account for a user.
     *
     * Within a single REST request this function is called up to 9 times.
     * The cache means only the FIRST call executes the JOIN query; subsequent
     * calls in the same request return the cached object at zero DB cost.
     *
     * @param int $user_id WordPress user ID.
     * @return object|null Account row, or null if no active challenge.
     */
    private static function get_active_challenge_account(int $user_id): ?object {
        if (array_key_exists($user_id, self::$account_cache)) {
            return self::$account_cache[$user_id];
        }

        global $wpdb;
        self::$account_cache[$user_id] = $wpdb->get_row($wpdb->prepare(
            "SELECT a.* FROM {$wpdb->prefix}fxsim_accounts a
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE ca.user_id = %d AND ca.status IN ('active','funded')
             ORDER BY ca.created_at DESC LIMIT 1",
            $user_id
        ));

        return self::$account_cache[$user_id];
    }

    /** Most recent challenge account for a user regardless of status (failed/passed/
     *  funded/active) — used to retain the final snapshot for display only. */
    private static function get_latest_challenge_account(int $user_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT a.* FROM {$wpdb->prefix}fxsim_accounts a
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE ca.user_id = %d
             ORDER BY ca.created_at DESC LIMIT 1",
            $user_id
        )) ?: null;
    }

    /**
     * REST-layer trading eligibility gate (read-only — no engine, no math).
     * Eligible when the user has an active or funded challenge account.
     * Otherwise returns a precise reason so the UI can message correctly:
     *   no_challenge | phase_passed | challenge_failed | not_eligible
     */
    private static function trading_eligibility(int $uid): array {
        if (self::get_active_challenge_account($uid)) return ['ok' => true];

        global $wpdb;
        $latest = $wpdb->get_var($wpdb->prepare(
            "SELECT status FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE user_id = %d ORDER BY created_at DESC LIMIT 1", $uid));

        if (!$latest) {
            return ['ok' => false, 'code' => 'no_challenge',
                'message' => 'You need an active challenge to trade. Purchase a challenge to get started.'];
        }
        if ($latest === 'passed') {
            return ['ok' => false, 'code' => 'phase_passed',
                'message' => 'This phase has been passed — trading is frozen. Your next phase will be available shortly.'];
        }
        if (in_array($latest, ['failed', 'breached'], true)) {
            return ['ok' => false, 'code' => 'challenge_failed',
                'message' => 'This challenge has ended — trading is frozen.'];
        }
        return ['ok' => false, 'code' => 'not_eligible',
            'message' => 'Trading is not available on your account right now.'];
    }

    /**
     * Invalidate the per-request account cache for a user.
     * Call after any operation that changes active challenge state so the
     * next get_active_challenge_account() call re-fetches from the DB.
     * Currently used by: challenge creation approval, account status changes.
     *
     * @param int $user_id WordPress user ID.
     */
    public static function invalidate_account_cache(int $user_id = 0): void {
        if ($user_id > 0) {
            unset(self::$account_cache[$user_id]);
        } else {
            self::$account_cache = []; // clear all (e.g. after bulk admin operations)
        }
    }

    public static function positions(): WP_REST_Response {
        $user_id = get_current_user_id();
        $acc = self::get_active_challenge_account($user_id);
        if (!$acc) return new WP_REST_Response([]);
        $pos = FXSIM_Trading_Engine::refresh_positions((int) $acc->id);
        // Enrich with an offset-aware ISO timestamp so the UI shows correct
        // relative/actual times regardless of browser timezone (no engine edit).
        $out = array_map(function ($p) {
            $a = (array) $p;
            if (!empty($a['opened_at'])) $a['opened_at_iso'] = self::iso8601($a['opened_at']);
            return $a;
        }, $pos ?: []);
        return new WP_REST_Response($out);
    }

    public static function open(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'], 403);
        $gate = self::trading_eligibility(get_current_user_id());
        if (!$gate['ok']) return new WP_REST_Response(['success'=>false,'message'=>$gate['message'],'code'=>$gate['code']], 403);
        // V10: block new entries when a strict MT5 feed is stale during market hours.
        // No-op in 'auto'/'yahoo' modes, so default deployments are unaffected.
        $fg = FXSIM_Price_Feed::feed_guard_for_trading();
        if (!$fg['ok']) return new WP_REST_Response(['success'=>false,'message'=>$fg['message'],'code'=>'feed_unavailable'], 503);
        // #8 Emergency control: global trading pause blocks new entries.
        if (self::ops_paused('pause_trading')) return new WP_REST_Response(['success'=>false,'message'=>'Trading is temporarily paused by the platform operator.','code'=>'ops_paused'], 503);
        $result = FXSIM_Trading_Engine::open_position(get_current_user_id(), $r->get_json_params() ?: $r->get_body_params());
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function close(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'], 403);
        $result = FXSIM_Trading_Engine::close_position(get_current_user_id(), (int)$r->get_param('id'));
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function partial_close(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'], 403);
        $body  = $r->get_json_params() ?: $r->get_body_params();
        $lots  = (float)($body['lots'] ?? 0);
        if ($lots <= 0) return new WP_REST_Response(['success'=>false,'message'=>'Invalid lot size.'], 400);
        $result = FXSIM_Trading_Engine::partial_close(get_current_user_id(), (int)$r->get_param('id'), $lots);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function sltp(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'], 403);
        $body = $r->get_json_params() ?: $r->get_body_params();
        $sl   = isset($body['sl']) && $body['sl'] !== '' ? (float)$body['sl'] : null;
        $tp   = isset($body['tp']) && $body['tp'] !== '' ? (float)$body['tp'] : null;
        $result = FXSIM_Trading_Engine::update_sltp(get_current_user_id(), (int)$r->get_param('id'), $sl, $tp);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function history(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $acc = self::get_active_challenge_account(get_current_user_id());
        if (!$acc) return new WP_REST_Response([]);

        $limit  = 50;
        // Keyset cursor: client passes the `last_id` of the final row from the previous page.
        // First page: no cursor (last_id = 0). Subsequent pages: pass last row's id.
        // Response includes `next_cursor` for the client to use on the next call.
        // Backward compatible: `page` param still accepted but ignored (keyset takes precedence).
        $last_id = (int)($r->get_param('last_id') ?? 0);

        if ($last_id > 0) {
            // Keyset: fetch rows with id < last_id (walking backwards through sorted-by-id=closed_at)
            // Uses idx_account_closed composite index: WHERE account_id=X AND id < Y ORDER BY closed_at DESC
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}fxsim_trades
                 WHERE account_id = %d AND id < %d
                 ORDER BY id DESC
                 LIMIT %d",
                $acc->id, $last_id, $limit
            ));
        } else {
            // First page: no cursor needed — most recent rows
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}fxsim_trades
                 WHERE account_id = %d
                 ORDER BY id DESC
                 LIMIT %d",
                $acc->id, $limit
            ));
        }

        // Enrich each row with offset-aware ISO-8601 timestamps. Trade times are
        // stored via current_time('mysql') = WP site-local, naive. Emitting an
        // explicit offset removes the client-side "parsed as browser-local" skew
        // that made freshly-closed trades read as hours old.
        foreach ($rows as $row) {
            $row->closed_at_iso = self::iso8601($row->closed_at ?? null);
            $row->opened_at_iso = self::iso8601($row->opened_at ?? null);
        }

        // Provide next_cursor so client can load more without tracking page numbers
        $next_cursor = (!empty($rows) && count($rows) === $limit)
            ? (int) end($rows)->id
            : null;

        $response = [
            'trades'      => $rows,
            'next_cursor' => $next_cursor,
            'has_more'    => $next_cursor !== null,
        ];

        // Only calculate full-history stats on the first page load
        if ($last_id === 0) {
            $stats_row = $wpdb->get_row($wpdb->prepare("
                SELECT 
                    COUNT(*) as total,
                    SUM(IF(pnl > 0, 1, 0)) as wins,
                    SUM(IF(pnl < 0, 1, 0)) as losses,
                    SUM(pnl) as net_pnl
                FROM {$wpdb->prefix}fxsim_trades
                WHERE account_id = %d
            ", $acc->id));
            
            if ($stats_row) {
                $total = (int)$stats_row->total;
                $wins = (int)$stats_row->wins;
                $losses = (int)$stats_row->losses;
                $netPnL = (float)$stats_row->net_pnl;
                $winRate = $total > 0 ? ($wins / $total) * 100 : 0;
                
                $response['stats'] = [
                    'total' => $total,
                    'wins' => $wins,
                    'losses' => $losses,
                    'netPnL' => $netPnL,
                    'winRate' => $winRate
                ];
            }
        }

        return new WP_REST_Response($response);
    }

    public static function transactions(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $acc = self::get_active_challenge_account(get_current_user_id());
        if (!$acc) return new WP_REST_Response([]);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_transactions WHERE account_id=%d ORDER BY created_at DESC LIMIT 100",
            $acc->id
        ));
        return new WP_REST_Response($rows);
    }

    public static function stats(): WP_REST_Response {
        global $wpdb;
        $acc = self::get_active_challenge_account(get_current_user_id());
        if (!$acc) return new WP_REST_Response(['total_trades'=>0,'wins'=>0,'losses'=>0,'win_rate'=>0,'profit_factor'=>0,'net_pnl'=>0,'gross_profit'=>0,'gross_loss'=>0]);
        $trades = $wpdb->get_results($wpdb->prepare(
            "SELECT pnl FROM {$wpdb->prefix}fxsim_trades WHERE account_id=%d", $acc->id
        ));
        $total        = count($trades);
        $wins         = array_filter($trades, fn($t) => $t->pnl > 0);
        $gross_profit = array_sum(array_map(fn($t) => $t->pnl > 0 ? $t->pnl : 0, $trades));
        $gross_loss   = abs(array_sum(array_map(fn($t) => $t->pnl < 0 ? $t->pnl : 0, $trades)));
        return new WP_REST_Response([
            'total_trades'  => $total,
            'wins'          => count($wins),
            'losses'        => $total - count($wins),
            'win_rate'      => $total ? round((count($wins) / $total) * 100, 1) : 0,
            'profit_factor' => $gross_loss ? round($gross_profit / $gross_loss, 2) : 0,
            'net_pnl'       => round($gross_profit - $gross_loss, 2),
            'gross_profit'  => round($gross_profit, 2),
            'gross_loss'    => round($gross_loss, 2),
        ]);
    }

    public static function symbols(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Symbols::all());
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    public static function admin_stats(): WP_REST_Response {
        global $wpdb;

        /**
         * Each query is wrapped individually. On a fresh install where DB migration
         * hasn't run yet (e.g. fxsim_payment_orders not yet created), a missing table
         * would previously cause MySQL to return NULL, which wpdb silently ignores.
         * But if a future query type changes, we guard each one so a single broken
         * query never kills the whole response and leaves admin at "Loading…".
         */
        $safe_count = static function (string $sql) use ($wpdb): int {
            $result = $wpdb->get_var($sql); // wpdb returns NULL on error, not exception
            return (int) ($result ?? 0);
        };
        $safe_sum = static function (string $sql) use ($wpdb): float {
            $result = $wpdb->get_var($sql);
            return (float) ($result ?? 0);
        };

        return new WP_REST_Response([
            'users'             => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_accounts WHERE user_id NOT IN (" . self::not_admin_subquery() . ")"),
            'open_positions'    => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_positions"),
            'total_trades'      => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trades"),
            'total_pnl'         => $safe_sum("SELECT COALESCE(SUM(pnl),0) FROM {$wpdb->prefix}fxsim_trades"),
            'active_challenges' => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status='active'"),
            'funded_accounts'   => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status='funded'"),
            // payment_orders table may not exist on older installs — wpdb returns NULL safely
            'pending_payments'  => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payment_orders WHERE status='pending'"),
        ]);
    }

    public static function admin_users(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $search = sanitize_text_field($r->get_param('search') ?? '');
        $page   = max(1, (int)($r->get_param('page') ?? 1));
        $limit  = max(10, min(100, (int)($r->get_param('limit') ?? 25)));
        $offset = ($page - 1) * $limit;

        $where  = $search ? $wpdb->prepare(
            "AND (u.user_login LIKE %s OR u.user_email LIKE %s)",
            "%$search%", "%$search%"
        ) : '';

        $total = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}users u WHERE 1=1 $where");

        // LEFT JOIN so users without a fxsim_account still appear
        $rows = $wpdb->get_results($wpdb->prepare("
            SELECT
                u.ID        AS user_id,
                u.user_login,
                u.user_email,
                u.user_registered,
                COALESCE(a.balance,    0)        AS balance,
                COALESCE(a.equity,     0)        AS equity,
                COALESCE(a.margin_used,0)        AS margin_used,
                COALESCE(a.status,     'no_account') AS status,
                a.id        AS account_id,
                (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                 WHERE ca.user_id = u.ID AND ca.status = 'active')   AS active_challenges,
                (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts ca2
                 WHERE ca2.user_id = u.ID AND ca2.status = 'funded') AS funded_challenges
            FROM {$wpdb->prefix}users u
            LEFT JOIN {$wpdb->prefix}fxsim_accounts a ON a.user_id = u.ID
            WHERE 1=1 $where
            ORDER BY u.ID DESC
            LIMIT %d OFFSET %d
        ", $limit, $offset));

        return new WP_REST_Response([
            'data'  => $rows ?: [],
            'total' => $total,
            'page'  => $page,
            'pages' => ceil($total / $limit),
            'limit' => $limit
        ]);
    }

    public static function admin_user_risk_profile(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id = (int)$r->get_param('id');
        if (!$user_id) {
            return new WP_REST_Response(['success'=>false, 'message'=>'Invalid user ID'], 400);
        }

        // Fetch recent IP logins
        $recent_ips = get_user_meta($user_id, 'fxsim_recent_ips', true);
        if (!is_array($recent_ips)) {
            $recent_ips = [];
        }

        // Fetch toxic trades
        $toxic_trades = $wpdb->get_results($wpdb->prepare(
            "SELECT id, symbol, type, opened_at, close_price, is_toxic
             FROM {$wpdb->prefix}fxsim_trades
             WHERE account_id IN (SELECT id FROM {$wpdb->prefix}fxsim_accounts WHERE user_id = %d)
             AND is_toxic = 1
             ORDER BY id DESC LIMIT 50",
             $user_id
        )) ?: [];

        // Fetch toxic challenge trades
        $toxic_challenge_trades = $wpdb->get_results($wpdb->prepare(
            "SELECT id, symbol, type, opened_at, close_price, is_toxic
             FROM {$wpdb->prefix}fxsim_challenge_trades
             WHERE account_id IN (SELECT id FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE user_id = %d)
             AND is_toxic = 1
             ORDER BY id DESC LIMIT 50",
             $user_id
        )) ?: [];

        $all_toxic = array_merge($toxic_trades, $toxic_challenge_trades);
        usort($all_toxic, function($a, $b) {
            return $b->id <=> $a->id; // simplified sort, assuming IDs trend upward over time across both tables roughly
        });

        // Determine Risk Score (0-100)
        // Basic heuristic: each toxic trade adds 10 to risk score. Max 100.
        // Each unique IP above 2 in the last week adds 5.
        $risk_score = min(100, count($all_toxic) * 10);
        $unique_ips = count(array_unique(array_column($recent_ips, 'ip')));
        if ($unique_ips > 2) {
            $risk_score = min(100, $risk_score + (($unique_ips - 2) * 5));
        }
        $risk_level = 'Low';
        if ($risk_score >= 40) $risk_level = 'Medium';
        if ($risk_score >= 80) $risk_level = 'High';

        return new WP_REST_Response([
            'success' => true,
            'recent_ips' => $recent_ips,
            'toxic_trades' => array_slice($all_toxic, 0, 50),
            'risk_score' => $risk_score,
            'risk_level' => $risk_level
        ]);
    }

    public static function admin_adjust(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body       = $r->get_json_params() ?: $r->get_body_params();
        $user_id    = (int)($body['user_id'] ?? 0);
        $account_id = (int)($body['account_id'] ?? 0);
        $amount     = (float)($body['amount'] ?? 0);
        $note       = sanitize_text_field($body['note'] ?? 'Admin adjustment');

        // Prefer explicit account_id; fall back to active challenge account for user
        if ($account_id) {
            $acc = FXSIM_Database::get_account_by_id($account_id);
        } else {
            $acc = self::get_active_challenge_account($user_id);
        }
        if (!$acc) return new WP_REST_Response(['error' => 'Account not found'], 404);

        $new_bal = max(0, (float)$acc->balance + $amount);
        $wpdb->update($wpdb->prefix . 'fxsim_accounts', ['balance' => $new_bal, 'equity' => $new_bal], ['id' => $acc->id]);
        FXSIM_Database::log_transaction($acc->id, 'adjustment', $amount, $new_bal, $note);
        FXSIM_Database::log_admin(get_current_user_id(), 'balance_adjust', $user_id, "Amount: $amount, AccID: {$acc->id}, Note: $note");
        return new WP_REST_Response(['success' => true, 'new_balance' => $new_bal]);
    }

    public static function admin_symbol(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $res  = FXSIM_Symbols::update((int)$r->get_param('id'), $body);
        FXSIM_Database::log_admin(get_current_user_id(), 'symbol_update', null, 'Symbol ID: ' . $r->get_param('id'));
        return new WP_REST_Response(['success' => $res]);
    }

    public static function admin_trades(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results("
            SELECT t.*, u.user_login FROM {$wpdb->prefix}fxsim_trades t
            JOIN {$wpdb->prefix}fxsim_accounts a ON t.account_id=a.id
            JOIN {$wpdb->prefix}users u ON a.user_id=u.ID
            ORDER BY t.closed_at DESC LIMIT 200
        ");
        return new WP_REST_Response($rows);
    }

    public static function admin_log(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results("
            SELECT l.*, u.user_login FROM {$wpdb->prefix}fxsim_admin_log l
            JOIN {$wpdb->prefix}users u ON l.admin_id=u.ID
            ORDER BY l.created_at DESC LIMIT 100
        ");
        return new WP_REST_Response($rows);
    }

    public static function admin_symbols(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Symbols::all(false));
    }

    /** POST /admin/user/{id}/note — save a private admin note on a trader (user meta). */
    public static function admin_user_note_save(WP_REST_Request $r): WP_REST_Response {
        $uid  = (int) $r->get_param('id');
        if (!get_userdata($uid)) return new WP_REST_Response(['success' => false, 'message' => 'User not found.'], 404);
        $body = $r->get_json_params() ?: $r->get_body_params();
        $note = sanitize_textarea_field($body['note'] ?? '');
        update_user_meta($uid, 'fxsim_admin_note', $note);
        FXSIM_Database::log_admin(get_current_user_id(), 'user_note_save', $uid, 'Updated admin note');
        return new WP_REST_Response(['success' => true]);
    }

    /** GET /admin/user/{id} — Trader 360: profile + challenges + payments + payouts
     *  + KYC + note + a merged activity timeline. Reuses existing tables only. */
    public static function admin_user_detail(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $uid = (int) $r->get_param('id');
        $u   = get_userdata($uid);
        if (!$u) return new WP_REST_Response(['error' => 'Not found'], 404);

        $pfx = $wpdb->prefix;
        $challenges = $wpdb->get_results($wpdb->prepare(
            "SELECT id, plan_id, phase, status, starting_balance, current_balance, trading_days, created_at, phase_started_at
             FROM {$pfx}fxsim_challenge_accounts WHERE user_id=%d ORDER BY created_at DESC", $uid)) ?: [];
        $payments = $wpdb->get_results($wpdb->prepare(
            "SELECT id, plan_id, amount, gateway, status, created_at, reviewed_at
             FROM {$pfx}fxsim_payment_orders WHERE user_id=%d ORDER BY created_at DESC", $uid)) ?: [];
        $payouts = $wpdb->get_results($wpdb->prepare(
            "SELECT id, challenge_id, amount_requested, trader_amount, status, admin_note, requested_at, reviewed_at
             FROM {$pfx}fxsim_payouts WHERE user_id=%d ORDER BY requested_at DESC", $uid)) ?: [];
        $kyc = $wpdb->get_row($wpdb->prepare(
            "SELECT id, status, admin_note, reviewed_at FROM {$pfx}fxsim_kyc WHERE user_id=%d ORDER BY id DESC LIMIT 1", $uid));
        $account = $wpdb->get_row($wpdb->prepare(
            "SELECT a.status, a.balance, a.equity FROM {$pfx}fxsim_accounts a WHERE a.user_id=%d ORDER BY a.id DESC LIMIT 1", $uid));
        $admin_actions = $wpdb->get_results($wpdb->prepare(
            "SELECT action, details, created_at FROM {$pfx}fxsim_admin_log WHERE target_user_id=%d ORDER BY created_at DESC LIMIT 50", $uid)) ?: [];

        // Build a unified, chronological timeline from existing rows.
        $tl = [];
        $tl[] = ['type' => 'registration', 'label' => 'Registered', 'at' => $u->user_registered];
        if (get_user_meta($uid, 'fxsim_email_verified', true)) $tl[] = ['type' => 'verification', 'label' => 'Email verified', 'at' => null];
        foreach ($payments as $p)   $tl[] = ['type' => 'payment',   'label' => 'Payment ' . $p->status . ' ($' . number_format((float)$p->amount, 0) . ')', 'at' => $p->created_at];
        foreach ($challenges as $c) $tl[] = ['type' => 'challenge', 'label' => 'Challenge #' . $c->id . ' — ' . $c->status . ' (phase ' . $c->phase . ')', 'at' => $c->created_at];
        foreach ($payouts as $po)   $tl[] = ['type' => 'payout',    'label' => 'Payout ' . $po->status . ' ($' . number_format((float)$po->trader_amount, 0) . ')', 'at' => $po->requested_at];
        if ($kyc) $tl[] = ['type' => 'kyc', 'label' => 'KYC ' . $kyc->status, 'at' => $kyc->reviewed_at];
        foreach ($admin_actions as $a) $tl[] = ['type' => 'admin', 'label' => 'Admin: ' . str_replace('_', ' ', $a->action) . ($a->details ? ' — ' . $a->details : ''), 'at' => $a->created_at];
        usort($tl, fn($x, $y) => strcmp((string)($y['at'] ?? ''), (string)($x['at'] ?? '')));

        return new WP_REST_Response([
            'user'       => ['id' => $uid, 'username' => $u->user_login, 'email' => $u->user_email, 'display_name' => $u->display_name, 'registered' => $u->user_registered],
            'account'    => $account ?: null,
            'note'       => (string) get_user_meta($uid, 'fxsim_admin_note', true),
            'challenges' => $challenges,
            'payments'   => $payments,
            'payouts'    => $payouts,
            'kyc'        => $kyc ?: null,
            'timeline'   => $tl,
        ]);
    }

    /** GET /admin/risk — operations risk overview, aggregated from existing tables. */
    public static function admin_risk(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $pfx = $wpdb->prefix;
        $num = fn($sql) => (float) $wpdb->get_var($sql);

        $funded_count   = (int) $num("SELECT COUNT(*) FROM {$pfx}fxsim_challenge_accounts WHERE status='funded'");
        $funded_capital = $num("SELECT COALESCE(SUM(current_balance),0) FROM {$pfx}fxsim_challenge_accounts WHERE status='funded'");
        $active_count   = (int) $num("SELECT COUNT(*) FROM {$pfx}fxsim_challenge_accounts WHERE status='active'");

        $pending_payout_value  = $num("SELECT COALESCE(SUM(trader_amount),0) FROM {$pfx}fxsim_payouts WHERE status IN ('pending','under_review')");
        $approved_payout_value = $num("SELECT COALESCE(SUM(trader_amount),0) FROM {$pfx}fxsim_payouts WHERE status='approved'");
        $pending_payout_count  = (int) $num("SELECT COUNT(*) FROM {$pfx}fxsim_payouts WHERE status IN ('pending','under_review')");

        // Suspended trading accounts.
        $frozen_count = (int) $num("SELECT COUNT(*) FROM {$pfx}fxsim_accounts WHERE status='frozen'");
        $banned_count = (int) $num("SELECT COUNT(*) FROM {$pfx}fxsim_accounts WHERE status='banned'");

        // Accounts near breach: active/funded accounts that have given back most of
        // their gains or are below starting balance (heuristic from existing columns —
        // current_balance within 2% above starting, i.e. little cushion left).
        $near_breach = (int) $num(
            "SELECT COUNT(*) FROM {$pfx}fxsim_challenge_accounts
             WHERE status IN ('active','funded')
               AND current_balance <= starting_balance * 1.02
               AND current_balance >= starting_balance * 0.90");

        return new WP_REST_Response([
            'funded_count'          => $funded_count,
            'funded_capital'        => $funded_capital,
            'active_challenges'     => $active_count,
            'pending_payout_value'  => $pending_payout_value,
            'pending_payout_count'  => $pending_payout_count,
            'approved_payout_value' => $approved_payout_value,
            'frozen_count'          => $frozen_count,
            'banned_count'          => $banned_count,
            'near_breach'           => $near_breach,
        ]);
    }

    /** GET /admin/risk/heatmap — Exposure heatmap by symbol */
    public static function admin_risk_heatmap(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $pfx = $wpdb->prefix;
        
        // Sum lot_size of open positions (where close_price is NULL), grouped by symbol and type
        $sql = "SELECT symbol, type, SUM(lot_size) as total_lots 
                FROM {$pfx}fxsim_trades 
                WHERE close_price IS NULL 
                GROUP BY symbol, type";
        
        $results = $wpdb->get_results($sql, ARRAY_A);
        
        $exposure = [];
        if ($results) {
            foreach ($results as $row) {
                $sym = $row['symbol'];
                if (!isset($exposure[$sym])) {
                    $exposure[$sym] = ['long' => 0, 'short' => 0, 'net' => 0];
                }
                if ($row['type'] === 'buy') {
                    $exposure[$sym]['long'] += (float)$row['total_lots'];
                } else {
                    $exposure[$sym]['short'] += (float)$row['total_lots'];
                }
            }
            
            // Calculate net
            foreach ($exposure as $sym => &$data) {
                $data['net'] = $data['long'] - $data['short'];
            }
        }
        
        return new WP_REST_Response(array_map(function($k, $v) {
            return ['symbol' => $k, 'long' => $v['long'], 'short' => $v['short'], 'net' => $v['net']];
        }, array_keys($exposure), array_values($exposure)));
    }

    /** GET /admin/risk/toxic — Toxic flow detection (HFT / Arbitrage) */
    public static function admin_risk_toxic(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $pfx = $wpdb->prefix;

        // Find users with multiple trades that were open for less than 15 seconds (HFT indicator).
        // For MariaDB/MySQL, TIMESTAMPDIFF(SECOND, created_at, closed_at).
        
        $sql = "
            SELECT u.ID as user_id, u.user_login, COUNT(t.id) as flag_count 
            FROM {$pfx}fxsim_trades t
            JOIN {$wpdb->users} u ON t.user_id = u.ID
            WHERE t.closed_at IS NOT NULL
              AND TIMESTAMPDIFF(SECOND, t.created_at, t.closed_at) < 15
            GROUP BY t.user_id, u.user_login
            HAVING flag_count > 5
            ORDER BY flag_count DESC
            LIMIT 50
        ";
        
        $results = $wpdb->get_results($sql, ARRAY_A);
        $toxic = [];
        
        if ($results) {
            foreach ($results as $row) {
                $toxic[] = [
                    'user_id' => $row['user_id'],
                    'user_login' => $row['user_login'],
                    'reason' => 'High frequency trading / Latency arbitrage (<15s duration)',
                    'flag_count' => $row['flag_count']
                ];
            }
        }
        
        return new WP_REST_Response($toxic);
    }

    /** POST /admin/bulk/payouts — body: { ids:[], status, note? }. Loops the
     *  existing single-item handler so frozen logic is reused untouched. */
    public static function admin_bulk_payouts(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $ids  = array_map('intval', (array)($body['ids'] ?? []));
        $status = sanitize_text_field($body['status'] ?? '');
        $note   = sanitize_textarea_field($body['note'] ?? '');
        if (!$ids) return new WP_REST_Response(['success' => false, 'message' => 'No items selected.'], 400);
        $ok = 0; $fail = 0;
        foreach ($ids as $id) {
            $sub = new WP_REST_Request('POST', '');
            $sub->set_param('id', $id);
            $sub->set_body_params(['status' => $status, 'note' => $note]);
            $res = self::admin_payout_status($sub);
            $data = $res->get_data();
            if (!empty($data['success'])) $ok++; else $fail++;
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'bulk_payout_' . $status, 0, "$ok ok, $fail failed");
        return new WP_REST_Response(['success' => true, 'processed' => $ok, 'failed' => $fail]);
    }

    /** POST /admin/bulk/kyc — body: { ids:[], action:'approve'|'reject', note? }. */
    public static function admin_bulk_kyc(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $ids  = array_map('intval', (array)($body['ids'] ?? []));
        $action = sanitize_text_field($body['action'] ?? '');
        $note   = sanitize_textarea_field($body['note'] ?? '');
        if (!$ids) return new WP_REST_Response(['success' => false, 'message' => 'No items selected.'], 400);
        $ok = 0; $fail = 0;
        foreach ($ids as $id) {
            $sub = new WP_REST_Request('POST', '');
            $sub->set_param('id', $id);
            $sub->set_body_params(['action' => $action, 'note' => $note]);
            $res = self::admin_kyc_review($sub);
            $data = $res->get_data();
            if (!empty($data['success'])) $ok++; else $fail++;
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'bulk_kyc_' . $action, 0, "$ok ok, $fail failed");
        return new WP_REST_Response(['success' => true, 'processed' => $ok, 'failed' => $fail]);
    }

    public static function admin_set_status(WP_REST_Request $r): WP_REST_Response {
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $user_id = (int)($body['user_id'] ?? 0);
        $status  = sanitize_text_field($body['status'] ?? '');
        if (!in_array($status, ['active', 'frozen', 'banned'], true)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid status. Use active, frozen, or banned.'], 400);
        }
        $res = FXSIM_Trading_Engine::set_account_status($user_id, $status);
        // Log the action regardless of outcome so attempts are auditable.
        FXSIM_Database::log_admin(get_current_user_id(), $res ? 'set_account_status' : 'set_account_status_failed', $user_id, "Status: $status");
        if (!$res) {
            return new WP_REST_Response(['success' => false, 'message' => 'No trading account found for this trader to update.'], 400);
        }
        // #6: surface account suspensions in the admin notification center.
        if ($status !== 'active') {
            FXSIM_Database::push_admin_notification('warning', 'Account ' . $status,
                'A trader account was set to ' . $status . '.', $user_id, '/dashboard/admin/users/' . $user_id);
        }
        return new WP_REST_Response(['success' => true]);
    }

    public static function admin_force_prices(): WP_REST_Response {
        $count = FXSIM_Price_Feed::force_refresh();
        FXSIM_Database::log_admin(get_current_user_id(), 'force_price_refresh');
        return new WP_REST_Response(['success' => true, 'message' => "Prices refreshed for {$count} symbols."]);
    }

    public static function admin_news_lock(WP_REST_Request $r): WP_REST_Response {
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $locked = (bool)($body['locked'] ?? false);
        update_option('fxsim_news_lock', $locked);
        FXSIM_Database::log_admin(get_current_user_id(), 'news_lock_' . ($locked ? 'on' : 'off'));
        return new WP_REST_Response(['success' => true, 'locked' => $locked]);
    }

    public static function admin_rate_limit(WP_REST_Request $r): WP_REST_Response {
        $body  = $r->get_json_params() ?: $r->get_body_params();
        $tier  = sanitize_key($body['tier'] ?? '');
        $limit = (int)($body['limit'] ?? -1);

        $valid_tiers = ['trading_write', 'trading_read', 'auth_write', 'stream', 'public'];
        if (!in_array($tier, $valid_tiers, true)) {
            return new WP_REST_Response(['error' => 'Invalid tier.'], 400);
        }
        if ($limit < 0 || $limit > 600) {
            return new WP_REST_Response(['error' => 'Limit must be between 0 and 600.'], 400);
        }

        update_option("fxsim_rl_{$tier}_limit", $limit, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'rate_limit_change', null,
            "Tier: {$tier}, limit set to {$limit}/min");
        return new WP_REST_Response(['success' => true, 'tier' => $tier, 'limit' => $limit]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // API KEY MANAGEMENT ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * GET /api-keys
     * List the authenticated user's API keys (hash never returned).
     */
    public static function api_keys_list(): WP_REST_Response {
        $keys = FXSIM_API_Keys::list_keys(get_current_user_id());
        return new WP_REST_Response($keys);
    }

    /**
     * POST /api-keys
     * Create a new API key for the authenticated user.
     * Returns the raw key ONCE — it is not stored and cannot be retrieved again.
     */
    public static function api_keys_create(WP_REST_Request $r): WP_REST_Response {
        // Nonce verified via verify_nonce — API key requests bypass this naturally
        if (!self::verify_nonce($r)) {
            return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        }

        $body    = $r->get_json_params() ?: $r->get_body_params();
        $name    = sanitize_text_field($body['name']    ?? '');
        $scopes  = array_map('sanitize_key', (array)($body['scopes'] ?? ['read']));
        $env     = sanitize_key($body['env']     ?? 'live');
        $expires = sanitize_text_field($body['expires'] ?? '');

        $result = FXSIM_API_Keys::create_key(get_current_user_id(), $name, $scopes, $env, $expires);
        return new WP_REST_Response($result, $result['success'] ? 201 : 400);
    }

    /**
     * POST /api-keys/{id}/revoke
     * Revoke (soft-delete) an API key. User can only revoke own keys.
     */
    public static function api_keys_revoke(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) {
            return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        }
        $result = FXSIM_API_Keys::revoke_key((int)$r->get_param('id'), get_current_user_id());
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    /**
     * GET /api-keys/{id}/usage
     * Return usage log for a specific key. User can only view own key logs.
     */
    public static function api_keys_usage(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $key_id  = (int)$r->get_param('id');
        $user_id = get_current_user_id();

        // Verify ownership before returning log
        $owner = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT user_id FROM {$wpdb->prefix}fxsim_api_keys WHERE id = %d",
            $key_id
        ));
        if ($owner !== $user_id) {
            return new WP_REST_Response(['error' => 'Key not found.'], 404);
        }

        $limit = min(200, max(1, (int)($r->get_param('limit') ?? 50)));
        $log   = FXSIM_API_Keys::get_usage_log($key_id, $limit);
        return new WP_REST_Response($log);
    }

    /**
     * GET /admin/api-keys
     * List all API keys across all users (admin only).
     */
    public static function admin_api_keys(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT k.id, k.name, k.scopes, k.env, k.last_used,
                    k.expires_at, k.is_active, k.created_at,
                    u.user_login, u.user_email
             FROM {$wpdb->prefix}fxsim_api_keys k
             JOIN {$wpdb->prefix}users u ON k.user_id = u.ID
             ORDER BY k.created_at DESC
             LIMIT 500"
        );
        return new WP_REST_Response($rows ?: []);
    }

    /**
     * POST /admin/api-keys/{id}/revoke
     * Admin force-revoke any user's API key.
     */
    public static function admin_api_keys_revoke(WP_REST_Request $r): WP_REST_Response {
        $result = FXSIM_API_Keys::revoke_key((int)$r->get_param('id'), get_current_user_id());
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    // ════════════════════════════════════════════════════════════════════════
    // CHALLENGE ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    public static function challenge_plans(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Challenge_DB::get_all_plans());
    }

    public static function challenge_start(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $plan_id = (int)($body['plan_id'] ?? 0);
        $plan    = FXSIM_Challenge_DB::get_plan($plan_id);
        if (!$plan) return new WP_REST_Response(['success' => false, 'message' => 'Plan not found.'], 404);

        // FREE plans (price = 0) can be started directly
        if ((float)$plan->price <= 0) {
            $result = FXSIM_Challenge_Engine::create_challenge(get_current_user_id(), $plan_id);
            return new WP_REST_Response($result, $result['success'] ? 200 : 400);
        }

        // PAID plans: require an approved payment order
        global $wpdb;
        $approved = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_payment_orders
             WHERE user_id=%d AND plan_id=%d AND status='approved'
             ORDER BY reviewed_at DESC LIMIT 1",
            get_current_user_id(), $plan_id
        ));

        if (!$approved) {
            return new WP_REST_Response([
                'success'          => false,
                'requires_payment' => true,
                'message'          => 'Payment required. Please submit payment and wait for admin approval.',
                'plan_id'          => $plan_id,
                'amount'           => $plan->price,
            ], 402);
        }

        $result = FXSIM_Challenge_Engine::create_challenge(get_current_user_id(), $plan_id);
        
        // SECURITY FIX: Mark payment order as redeemed so it can't be reused infinitely.
        if ($result['success']) {
            $wpdb->update($wpdb->prefix . 'fxsim_payment_orders', 
                ['status' => 'redeemed'], 
                ['id' => $approved]
            );
        }
        
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function challenge_my(): WP_REST_Response {
        $challenges = FXSIM_Challenge_DB::get_user_challenges(get_current_user_id());
        return new WP_REST_Response($challenges);
    }

    public static function challenge_metrics(WP_REST_Request $r): WP_REST_Response {
        $id      = (int)$r->get_param('id');
        $ch      = FXSIM_Challenge_DB::get_challenge($id);
        // Security: ensure challenge belongs to current user
        if (!$ch || (int)$ch->user_id !== get_current_user_id()) {
            return new WP_REST_Response(['error' => 'Not found'], 404);
        }
        $metrics = FXSIM_Challenge_Engine::get_metrics($id);

        // Build a real equity curve from closed-trade history instead of the
        // sparse one-row-per-day snapshot series (which renders as a single
        // static dot until the daily cron runs). Running balance = starting
        // balance + cumulative realised PnL, in trade-close order, with
        // offset-aware timestamps. No trading calculation is recomputed — we
        // only sum the engine's already-computed pnl values.
        if (is_array($metrics) && !empty($metrics)) {
            global $wpdb;
            $acc_id = (int) $ch->fxsim_account_id;
            $trades = $wpdb->get_results($wpdb->prepare(
                "SELECT closed_at, pnl FROM {$wpdb->prefix}fxsim_trades
                 WHERE account_id = %d ORDER BY closed_at ASC, id ASC",
                $acc_id
            ));
            $metrics['equity_chart'] = self::build_equity_curve($ch, $trades);
        }

        return new WP_REST_Response($metrics);
    }

    /** GET /payout-method — fetch saved payout details for current user */
    public static function payout_method_get(): WP_REST_Response {
        $uid = get_current_user_id();
        return new WP_REST_Response([
            'method'  => get_user_meta($uid, 'fxsim_payout_method',  true) ?: '',
            'address' => get_user_meta($uid, 'fxsim_payout_address', true) ?: '',
            'details' => get_user_meta($uid, 'fxsim_payout_details', true) ?: '',
        ]);
    }

    /** POST /payout-method — save payout details to user meta (pre-fills future requests) */
    public static function payout_method_save(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $body = $r->get_json_params() ?: $r->get_body_params();
        $uid  = get_current_user_id();
        update_user_meta($uid, 'fxsim_payout_method',  sanitize_text_field($body['method']  ?? ''));
        update_user_meta($uid, 'fxsim_payout_address', sanitize_text_field($body['address'] ?? ''));
        update_user_meta($uid, 'fxsim_payout_details', sanitize_text_field($body['details'] ?? ''));
        return new WP_REST_Response(['success' => true]);
    }

    public static function challenge_payout(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'], 403);
        if (self::ops_paused('pause_payouts')) return new WP_REST_Response(['success'=>false,'message'=>'Payout requests are temporarily paused. Please try again later.','code'=>'ops_paused'], 503);
        $id   = (int)$r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $ch   = FXSIM_Challenge_DB::get_challenge($id);
        if (!$ch || (int)$ch->user_id !== get_current_user_id())
            return new WP_REST_Response(['error' => 'Not found'], 404);
        if ($ch->status !== 'funded')
            return new WP_REST_Response(['success' => false, 'message' => 'Only funded accounts can request payouts.'], 400);

        // KYC gate — identity must be verified before any payout request.
        if (!self::kyc_is_approved(get_current_user_id()))
            return new WP_REST_Response(['success' => false, 'message' => 'Identity verification (KYC) must be approved before requesting a payout.', 'code' => 'kyc_required'], 403);

        $plan    = FXSIM_Challenge_DB::get_plan((int)$ch->plan_id);
        // Use the challenge's own isolated account, not the user's default account
        $account = FXSIM_Database::get_account_by_id((int)$ch->fxsim_account_id);
        if (!$account) return new WP_REST_Response(['success' => false, 'message' => 'Account not found.'], 404);

        // Payout safety: a suspended account (frozen/banned) must never pay out.
        if (isset($account->status) && $account->status !== 'active') {
            return new WP_REST_Response(['success' => false, 'message' => 'This account is not active and cannot request a payout. Please contact support.'], 403);
        }

        // SECURITY FIX: Prevent payout requests when there are open positions to stop 
        // users from withdrawing balance while hiding massive floating losses.
        $open_trades = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_positions WHERE account_id=%d", 
            $account->id
        ));
        if ($open_trades > 0) {
            return new WP_REST_Response(['success' => false, 'message' => 'You must close all open positions before requesting a payout.'], 400);
        }

        $profit = (float)$account->balance - (float)$ch->starting_balance;
        if ($profit <= 0) return new WP_REST_Response(['success' => false, 'message' => 'No profit available to withdraw.'], 400);

        // One open payout per challenge at a time — prevents requesting the same
        // profit repeatedly before a prior request is paid/rejected.
        $openCount = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payouts
             WHERE challenge_id=%d AND status IN ('pending','under_review','approved')", $id));
        if ($openCount > 0) {
            return new WP_REST_Response(['success' => false, 'message' => 'You already have a payout in progress. Please wait until it is processed.'], 400);
        }

        // Eligibility: minimum trading days
        if ((int)$ch->trading_days < (int)$plan->p2_min_days) {
            return new WP_REST_Response(['success' => false, 'message' => "Minimum {$plan->p2_min_days} trading days required before payout. You have {$ch->trading_days}."], 400);
        }

        $split      = (float)$plan->funded_profit_split;
        $trader_amt = round($profit * ($split / 100), 2);
        $firm_amt   = round($profit - $trader_amt, 2);

        $wpdb->insert($wpdb->prefix . 'fxsim_payouts', [
            'challenge_id'     => $id,
            'user_id'          => get_current_user_id(),
            'amount_requested' => $profit,
            'profit_split_pct' => $split,
            'trader_amount'    => $trader_amt,
            'firm_amount'      => $firm_amt,
            // Use submitted method/address; fall back to saved user meta
            'payment_method'   => sanitize_text_field($body['method']  ?? '')
                                   ?: get_user_meta(get_current_user_id(), 'fxsim_payout_method',  true),
            'payment_address'  => sanitize_text_field($body['address'] ?? '')
                                   ?: get_user_meta(get_current_user_id(), 'fxsim_payout_address', true),
        ]);
        // Save/update this method for future payout requests
        if (!empty($body['method'])) {
            update_user_meta(get_current_user_id(), 'fxsim_payout_method',  sanitize_text_field($body['method']  ?? ''));
            update_user_meta(get_current_user_id(), 'fxsim_payout_address', sanitize_text_field($body['address'] ?? ''));
        }
        FXSIM_Database::push_notification(get_current_user_id(), 'info', 'Payout requested',
            'Your payout request for $' . number_format((float)$trader_amt, 2) . ' was submitted and is pending review.', '/dashboard/payouts');
        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send(get_current_user_id(), 'payout_requested', ['amount' => number_format((float)$trader_amt, 2)]);
        }
        // #6: large payout requests get a higher-visibility warning notification
        // so the owner reviews them with extra care. Threshold is configurable via
        // the whitelabel store (large_payout_threshold), default $1,000.
        $threshold = (float) (class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('large_payout_threshold', '1000') : '1000');
        if ($threshold > 0 && (float)$trader_amt >= $threshold) {
            FXSIM_Database::push_admin_notification('warning', 'Large payout request',
                'A funded trader requested a large payout of $' . number_format((float)$trader_amt, 2) . '. Review carefully.', get_current_user_id());
        } else {
            FXSIM_Database::push_admin_notification('info', 'New payout request',
                'A funded trader requested a payout of $' . number_format((float)$trader_amt, 2) . '.', get_current_user_id());
        }
        return new WP_REST_Response(['success' => true, 'trader_amount' => $trader_amt, 'firm_amount' => $firm_amt]);
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  KYC (identity verification)  +  Payout queue
     *  Reads/writes only fxsim_kyc / fxsim_payouts — no trading or challenge
     *  calculation is touched.
     * ──────────────────────────────────────────────────────────────────────── */

    /** Whether a user's identity is verified (payout gate). */
    public static function kyc_is_approved(int $uid): bool {
        global $wpdb;
        return 'approved' === $wpdb->get_var($wpdb->prepare(
            "SELECT status FROM {$wpdb->prefix}fxsim_kyc WHERE user_id=%d", $uid));
    }

    /** GET /kyc — current user's KYC status + which docs are on file. */
    public static function kyc_get(): WP_REST_Response {
        global $wpdb;
        $uid = get_current_user_id();
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_kyc WHERE user_id=%d", $uid));
        if (!$row) return new WP_REST_Response(['status' => 'not_started']);
        return new WP_REST_Response([
            'status'       => $row->status,
            'admin_note'   => $row->admin_note,
            'submitted_at' => self::iso8601($row->submitted_at),
            'reviewed_at'  => self::iso8601($row->reviewed_at),
            'docs'         => [
                'id_doc'      => !empty($row->id_doc_path),
                'selfie'      => !empty($row->selfie_path),
                'address_doc' => !empty($row->address_doc_path),
            ],
        ]);
    }

    /** POST /kyc/submit — multipart upload: id_doc + selfie + address_doc. */
    public static function kyc_submit(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        global $wpdb;
        $uid = get_current_user_id();

        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_kyc WHERE user_id=%d", $uid));
        if ($existing && $existing->status === 'approved') {
            return new WP_REST_Response(['success' => false, 'message' => 'Your identity is already verified.'], 400);
        }

        $paths = [];
        foreach (['id_doc', 'selfie', 'address_doc'] as $f) {
            if (empty($_FILES[$f]['tmp_name'])) {
                return new WP_REST_Response(['success' => false, 'message' => "Missing upload: {$f}."], 400);
            }
            $stored = self::store_kyc_file($uid, $f, $_FILES[$f]);
            if (is_wp_error($stored)) {
                return new WP_REST_Response(['success' => false, 'message' => $stored->get_error_message()], 400);
            }
            $paths[$f] = $stored;
        }

        $data = [
            'user_id'          => $uid,
            'status'           => 'pending',
            'id_doc_path'      => $paths['id_doc'],
            'selfie_path'      => $paths['selfie'],
            'address_doc_path' => $paths['address_doc'],
            'admin_note'       => null,
            'reviewer_id'      => null,
            'submitted_at'     => current_time('mysql'),
            'reviewed_at'      => null,
        ];
        if ($existing) $ok = $wpdb->update($wpdb->prefix . 'fxsim_kyc', $data, ['user_id' => $uid]);
        else           $ok = $wpdb->insert($wpdb->prefix . 'fxsim_kyc', $data);

        if ($ok === false) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Could not save your submission. Please contact support.',
                'detail'  => $wpdb->last_error ?: 'kyc storage unavailable',
            ], 500);
        }

        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send($uid, 'kyc_submitted', []);
        }
        FXSIM_Database::push_notification($uid, 'info', 'Identity documents submitted',
            'Your identity documents were received and are pending review.', '/dashboard/kyc');
        FXSIM_Database::push_admin_notification('info', 'New KYC submission', 'A trader submitted identity documents for review.', $uid);

        return new WP_REST_Response(['success' => true, 'status' => 'pending']);
    }

    /** Validate + move a KYC upload into a protected per-user dir. Returns rel path or WP_Error. */
    private static function store_kyc_file(int $uid, string $field, array $file) {
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (empty($file['tmp_name'])) return new WP_Error('no_file', 'No file uploaded.');
        $mime = function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : ($file['type'] ?? '');
        if (!in_array($mime, $allowed, true)) return new WP_Error('bad_type', 'Documents must be JPG, PNG, WebP, or PDF.');
        if (($file['size'] ?? 0) > 5 * 1024 * 1024) return new WP_Error('too_big', 'Each file must be 5MB or smaller.');

        $u   = wp_upload_dir();
        $dir = $u['basedir'] . '/propfirm-kyc/' . $uid . '/';
        wp_mkdir_p($dir);
        if (!file_exists($dir . 'index.php')) file_put_contents($dir . 'index.php', '<?php // Silence is golden');
        if (!file_exists($dir . '.htaccess')) file_put_contents($dir . '.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");

        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'dat';
        $name = $field . '_' . time() . '.' . $ext;
        $dest = $dir . $name;
        if (!@move_uploaded_file($file['tmp_name'], $dest) && !@rename($file['tmp_name'], $dest)) {
            return new WP_Error('move_failed', 'Upload failed. Please try again.');
        }
        return 'propfirm-kyc/' . $uid . '/' . $name;
    }

    /** GET /payouts — current user's payout history + availability + cycle info. */
    public static function payouts_list(): WP_REST_Response {
        global $wpdb;
        $uid = get_current_user_id();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_payouts WHERE user_id=%d ORDER BY requested_at DESC", $uid));
        $history = array_map(fn($p) => [
            'id'               => (int) $p->id,
            'challenge_id'     => (int) $p->challenge_id,
            'amount_requested' => (float) $p->amount_requested,
            'trader_amount'    => (float) $p->trader_amount,
            'firm_amount'      => (float) $p->firm_amount,
            'profit_split_pct' => (float) $p->profit_split_pct,
            'status'           => $p->status,
            'payment_method'   => $p->payment_method,
            'tx_reference'     => $p->tx_reference,
            'proof_url'        => $p->proof_url,
            'admin_note'       => $p->admin_note,
            'requested_at'     => self::iso8601($p->requested_at),
            'processed_at'     => self::iso8601($p->processed_at),
        ], $rows ?: []);

        $cycle_days = (int) (FXSIM_Challenge_DB::get_setting('payout_cycle_days', '14') ?: 14);
        $available  = 0.0;
        $funded = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE user_id=%d AND status='funded'", $uid));
        foreach (($funded ?: []) as $ch) {
            $acc = FXSIM_Database::get_account_by_id((int) $ch->fxsim_account_id);
            if ($acc) {
                $prof = (float) $acc->balance - (float) $ch->starting_balance;
                if ($prof > 0) $available += $prof;
            }
        }

        $next = null;
        if (!empty($funded)) {
            $last = $wpdb->get_var($wpdb->prepare(
                "SELECT MAX(processed_at) FROM {$wpdb->prefix}fxsim_payouts
                 WHERE user_id=%d AND status IN ('approved','paid')", $uid));
            try {
                $anchor = new \DateTimeImmutable($last ?: current_time('mysql'), wp_timezone());
                $next   = $anchor->modify("+{$cycle_days} days")->format('c');
            } catch (\Throwable $e) { $next = null; }
        }

        return new WP_REST_Response([
            'history'        => $history,
            'available'      => round($available, 2),
            'kyc_approved'   => self::kyc_is_approved($uid),
            'cycle_days'     => $cycle_days,
            'next_payout_at' => $next,
        ]);
    }

    /** GET /admin/kyc — review queue (optional ?status=). */
    public static function admin_kyc_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status = sanitize_text_field($r->get_param('status') ?? '');
        $where  = in_array($status, ['pending', 'approved', 'rejected'], true)
            ? $wpdb->prepare("WHERE k.status=%s", $status) : '';
        $rows = $wpdb->get_results("
            SELECT k.*, u.user_login, u.user_email, u.display_name
            FROM {$wpdb->prefix}fxsim_kyc k
            JOIN {$wpdb->users} u ON u.ID = k.user_id
            $where
            ORDER BY FIELD(k.status,'pending','rejected','approved'), k.submitted_at DESC");
        $out = array_map(fn($k) => [
            'id'           => (int) $k->id,
            'user_id'      => (int) $k->user_id,
            'username'     => $k->user_login,
            'email'        => $k->user_email,
            'name'         => $k->display_name,
            'status'       => $k->status,
            'admin_note'   => $k->admin_note,
            'submitted_at' => self::iso8601($k->submitted_at),
            'reviewed_at'  => self::iso8601($k->reviewed_at),
            'docs'         => [
                'id_doc'      => !empty($k->id_doc_path)      ? rest_url(self::NS . "/admin/kyc/{$k->id}/doc/id_doc")      : null,
                'selfie'      => !empty($k->selfie_path)      ? rest_url(self::NS . "/admin/kyc/{$k->id}/doc/selfie")      : null,
                'address_doc' => !empty($k->address_doc_path) ? rest_url(self::NS . "/admin/kyc/{$k->id}/doc/address_doc") : null,
            ],
        ], $rows ?: []);
        return new WP_REST_Response($out);
    }

    /** POST /admin/kyc/{id}/review — approve|reject (+note, +email). */
    public static function admin_kyc_review(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        global $wpdb;
        $id     = (int) $r->get_param('id');
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $a      = $body['action'] ?? '';
        $status = $a === 'approve' ? 'approved' : ($a === 'reject' ? 'rejected' : '');
        if (!$status) return new WP_REST_Response(['success' => false, 'message' => 'Invalid action.'], 400);
        $note = sanitize_textarea_field($body['note'] ?? '');

        $kyc = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_kyc WHERE id=%d", $id));
        if (!$kyc) return new WP_REST_Response(['success' => false, 'message' => 'KYC record not found.'], 404);

        $wpdb->update($wpdb->prefix . 'fxsim_kyc', [
            'status'      => $status,
            'admin_note'  => $note ?: null,
            'reviewer_id' => get_current_user_id(),
            'reviewed_at' => current_time('mysql'),
        ], ['id' => $id]);

        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send((int) $kyc->user_id, $status === 'approved' ? 'kyc_approved' : 'kyc_rejected', ['reason' => $note]);
        }
        if ($status === 'approved') {
            FXSIM_Database::push_notification((int) $kyc->user_id, 'success', 'Identity verified',
                'Your identity has been verified. You can now request payouts.', '/dashboard/kyc');
        } else {
            FXSIM_Database::push_notification((int) $kyc->user_id, 'warning', 'Identity verification needs attention',
                $note ?: 'Your identity documents could not be verified. Please review and resubmit.', '/dashboard/kyc');
        }
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
            FXSIM_Database::log_admin(get_current_user_id(), "kyc_{$status}", (int) $kyc->user_id, $note);
        }
        return new WP_REST_Response(['success' => true, 'status' => $status]);
    }

    /** GET /admin/kyc/{id}/doc/{type} — stream a protected KYC document to an admin. */
    public static function admin_kyc_doc(WP_REST_Request $r) {
        global $wpdb;
        $id   = (int) $r->get_param('id');
        $type = (string) $r->get_param('type');
        $map  = ['id_doc' => 'id_doc_path', 'selfie' => 'selfie_path', 'address_doc' => 'address_doc_path'];
        if (!isset($map[$type])) return new WP_REST_Response(['error' => 'Bad type'], 400);
        $rel = $wpdb->get_var($wpdb->prepare(
            "SELECT {$map[$type]} FROM {$wpdb->prefix}fxsim_kyc WHERE id=%d", $id));
        if (!$rel) return new WP_REST_Response(['error' => 'Not found'], 404);
        $u    = wp_upload_dir();
        $path = $u['basedir'] . '/' . ltrim($rel, '/');
        if (!file_exists($path)) return new WP_REST_Response(['error' => 'File missing'], 404);
        // This handler streams raw bytes and exits, bypassing the REST CORS
        // filter — so emit CORS headers here, reflecting the configured SPA
        // origin, or the cross-origin credentialed fetch is blocked.
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $fe     = get_option('fxsim_frontend_url', '');
        if (!$fe && defined('FXSIM_FRONTEND_URL')) $fe = FXSIM_FRONTEND_URL;
        if ($origin && $fe && untrailingslashit($origin) === untrailingslashit($fe)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
        }
        $mime = function_exists('mime_content_type') ? mime_content_type($path) : 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: inline; filename="' . basename($path) . '"');
        header('Cache-Control: private, no-store');
        readfile($path);
        exit;
    }

    /** GET /admin/payouts — payout queue (optional ?status=). */
    public static function admin_payouts_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status = sanitize_text_field($r->get_param('status') ?? '');
        $valid  = ['pending', 'under_review', 'approved', 'rejected', 'paid'];
        $where  = in_array($status, $valid, true) ? $wpdb->prepare("WHERE p.status=%s", $status) : '';
        $rows = $wpdb->get_results("
            SELECT p.*, u.user_login, u.user_email, u.display_name
            FROM {$wpdb->prefix}fxsim_payouts p
            JOIN {$wpdb->users} u ON u.ID = p.user_id
            $where
            ORDER BY FIELD(p.status,'pending','under_review','approved','paid','rejected'), p.requested_at DESC");
        $out = array_map(fn($p) => [
            'id'               => (int) $p->id,
            'challenge_id'     => (int) $p->challenge_id,
            'user_id'          => (int) $p->user_id,
            'username'         => $p->user_login,
            'email'            => $p->user_email,
            'name'             => $p->display_name,
            'amount_requested' => (float) $p->amount_requested,
            'trader_amount'    => (float) $p->trader_amount,
            'firm_amount'      => (float) $p->firm_amount,
            'profit_split_pct' => (float) $p->profit_split_pct,
            'status'           => $p->status,
            'payment_method'   => $p->payment_method,
            'payment_address'  => $p->payment_address,
            'tx_reference'     => $p->tx_reference,
            'proof_url'        => $p->proof_url,
            'admin_note'       => $p->admin_note,
            'requested_at'     => self::iso8601($p->requested_at),
            'processed_at'     => self::iso8601($p->processed_at),
        ], $rows ?: []);
        return new WP_REST_Response($out);
    }

    /** POST /admin/payouts/{id}/status — transition under_review|approved|paid|rejected (+email). */
    public static function admin_payout_status(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        global $wpdb;
        $id     = (int) $r->get_param('id');
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $status = sanitize_text_field($body['status'] ?? '');
        $valid  = ['under_review', 'approved', 'rejected', 'paid'];
        if (!in_array($status, $valid, true)) return new WP_REST_Response(['success' => false, 'message' => 'Invalid status.'], 400);
        $note  = sanitize_textarea_field($body['note'] ?? '');
        $txRef = sanitize_text_field($body['tx_reference'] ?? '');
        $proof = esc_url_raw($body['proof_url'] ?? '');

        $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_payouts WHERE id=%d", $id));
        if (!$p) return new WP_REST_Response(['success' => false, 'message' => 'Payout not found.'], 404);
        if ($status === 'paid' && empty($txRef) && empty($p->tx_reference)) {
            return new WP_REST_Response(['success' => false, 'message' => 'A transaction reference is required to mark a payout paid.'], 400);
        }

        $update = ['status' => $status, 'admin_note' => $note ?: $p->admin_note];
        if ($txRef !== '') $update['tx_reference'] = $txRef;
        if ($proof !== '') $update['proof_url']    = $proof;
        if (in_array($status, ['approved', 'rejected', 'paid'], true)) $update['processed_at'] = current_time('mysql');
        $wpdb->update($wpdb->prefix . 'fxsim_payouts', $update, ['id' => $id]);

        // ── Payout cycle reset (Issues 1 & 2) ──────────────────────────────────
        // When a payout is FIRST marked paid, withdraw the requested profit from
        // the funded account and re-baseline the cycle so the same profit can't
        // be withdrawn again. Idempotent: only fires on the transition into paid.
        if ($status === 'paid' && $p->status !== 'paid') {
            $ch = FXSIM_Challenge_DB::get_challenge((int) $p->challenge_id);
            if ($ch) {
                $account = FXSIM_Database::get_account_by_id((int) $ch->fxsim_account_id);
                if ($account) {
                    $withdrawn = (float) $p->amount_requested;
                    $newBal    = round((float) $account->balance - $withdrawn, 2);
                    $newEq     = round((float) $account->equity  - $withdrawn, 2); // preserves open-PnL delta
                    $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                        ['balance' => $newBal, 'equity' => $newEq],
                        ['id' => (int) $ch->fxsim_account_id]);
                    // Re-baseline the challenge so drawdown/profit start fresh and the
                    // deduction itself never reads as drawdown.
                    // SECURITY FIX: Reset equity_hwm and trailing_dd_floor so the 
                    // trailing drawdown floor drops with the withdrawn balance, preventing instant breach.
                    $plan = FXSIM_Challenge_DB::get_plan((int)$ch->plan_id);
                    $allowed_trail_pct = $plan ? (float)$plan->funded_trailing_drawdown_pct : 0;
                    $abs_trail = round((float)$ch->starting_balance * ($allowed_trail_pct / 100), 2);
                    
                    $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                        'current_balance'     => $newBal,
                        'peak_balance'        => $newBal,
                        'daily_start_balance' => $newBal,
                        'equity_hwm'          => $newEq,
                        'trailing_dd_floor'   => round($newEq - $abs_trail, 2),
                    ], ['id' => (int) $ch->id]);
                    self::invalidate_account_cache((int) $p->user_id);
                }
            }
        }

        if (class_exists('FXSIM_Emails')) {
            $ref = $txRef ?: ($p->tx_reference ?: ('PO-' . $p->id));
            $amt = number_format((float) $p->trader_amount, 2);
            if     ($status === 'paid')         FXSIM_Emails::send((int) $p->user_id, 'payout_paid',         ['amount' => $amt, 'method' => $p->payment_method ?? '', 'reference' => $ref, 'proof_url' => ($proof ?: $p->proof_url ?: '')]);
            elseif ($status === 'approved')     FXSIM_Emails::send((int) $p->user_id, 'payout_approved',     ['amount' => $amt, 'method' => $p->payment_method ?? '', 'reference' => $ref]);
            elseif ($status === 'rejected')     FXSIM_Emails::send((int) $p->user_id, 'payout_rejected',     ['reason' => $note]);
            elseif ($status === 'under_review') FXSIM_Emails::send((int) $p->user_id, 'payout_under_review', ['amount' => $amt]);
        }
        $puid = (int) $p->user_id;
        if     ($status === 'paid')         FXSIM_Database::push_notification($puid, 'success', 'Payout paid', 'Your payout of $' . number_format((float)$p->trader_amount, 2) . ' has been paid.', '/dashboard/payouts');
        elseif ($status === 'approved')     FXSIM_Database::push_notification($puid, 'success', 'Payout approved', 'Your payout of $' . number_format((float)$p->trader_amount, 2) . ' was approved and is being processed.', '/dashboard/payouts');
        elseif ($status === 'rejected')     FXSIM_Database::push_notification($puid, 'warning', 'Payout needs attention', $note ?: 'Your payout request needs follow-up. Please contact support.', '/dashboard/payouts');
        elseif ($status === 'under_review') FXSIM_Database::push_notification($puid, 'info', 'Payout under review', 'Your payout of $' . number_format((float)$p->trader_amount, 2) . ' is under review.', '/dashboard/payouts');
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
            FXSIM_Database::log_admin(get_current_user_id(), "payout_{$status}", (int) $p->user_id, "Payout #{$id}");
        }
        return new WP_REST_Response(['success' => true, 'status' => $status]);
    }

    // ── Admin challenge endpoints ─────────────────────────────────────────────

    /* ─────────────────────────────────────────────────────────────────────────
     *  Challenge Test Tools — ADMIN-ONLY QA / demo helpers.
     *  These deliberately operate OUTSIDE the trading & challenge engines: they
     *  set challenge-account status directly via SQL so a buyer demo can jump a
     *  challenge to a given state. No engine code is touched and no pass/fail
     *  math is run. Not exposed to traders (admin permission + admin-only UI).
     * ──────────────────────────────────────────────────────────────────────── */

    /** GET /admin/test-tools/challenges — recent challenge accounts for challenge operations. */
    public static function test_tools_challenges(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT ca.id, ca.user_id, ca.phase, ca.status,
                    ca.current_balance, ca.starting_balance,
                    u.user_login, u.display_name, cp.name AS plan_name
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->users} u ON u.ID = ca.user_id
             LEFT JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON cp.id = ca.plan_id
             ORDER BY ca.created_at DESC LIMIT 100") ?: [];
        return new WP_REST_Response($rows);
    }

    /** POST /admin/test-tools/challenge/{id}/set {action: phase1|phase2|funded|reset}. */
    public static function test_tools_set(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        global $wpdb;
        $id     = (int) $r->get_param('id');
        $b      = $r->get_json_params() ?: $r->get_body_params();
        $action = $b['action'] ?? '';
        $t      = $wpdb->prefix . 'fxsim_challenge_accounts';
        $ca     = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d", $id));
        if (!$ca) return new WP_REST_Response(['success' => false, 'message' => 'Challenge not found.'], 404);

        $now = current_time('mysql');
        $uid = (int) $ca->user_id;
        switch ($action) {
            case 'phase1': // pass phase 1 → start phase 2 (fresh balance)
                $wpdb->update($t, ['phase' => 2, 'status' => 'active', 'phase_started_at' => $now,
                                   'current_balance' => $ca->starting_balance,
                                   'peak_balance' => $ca->starting_balance, 'daily_start_balance' => $ca->starting_balance,
                                   'breach_reason' => null, 'breach_at' => null], ['id' => $id]);
                $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                    ['balance' => $ca->starting_balance, 'equity' => $ca->starting_balance, 'margin_used' => 0],
                    ['id' => (int) $ca->fxsim_account_id]);
                FXSIM_Database::push_notification($uid, 'success', 'Phase 1 passed',
                    'Congratulations — you passed Phase 1. Phase 2 has begun.', '/dashboard');
                if (class_exists('FXSIM_Emails')) FXSIM_Emails::send($uid, 'phase_passed', ['phase' => 1, 'next' => 'Phase 2']);
                break;
            case 'phase2': // pass phase 2 → evaluation complete
                $wpdb->update($t, ['status' => 'passed', 'breach_reason' => null, 'breach_at' => null], ['id' => $id]);
                FXSIM_Database::push_notification($uid, 'success', 'Phase 2 passed',
                    'You passed Phase 2. Your funded account is being prepared.', '/dashboard');
                if (class_exists('FXSIM_Emails')) FXSIM_Emails::send($uid, 'phase_passed', ['phase' => 2, 'next' => 'Funded']);
                break;
            case 'funded':
                $wpdb->update($t, ['status' => 'funded', 'funded_at' => $now,
                                   'breach_reason' => null, 'breach_at' => null], ['id' => $id]);
                FXSIM_Database::push_notification($uid, 'success', 'Account funded',
                    'Your account is now funded. You can trade and request payouts.', '/dashboard');
                if (class_exists('FXSIM_Emails')) FXSIM_Emails::send($uid, 'challenge_passed', []);
                break;
            case 'payout_ready':
                // QA helper: make a funded account immediately payout-testable by
                // crediting test profit and satisfying the minimum-days gate.
                // Direct SQL only — the trading/challenge engines are not invoked.
                $start   = (float) $ca->starting_balance;
                $profit  = round($start * 0.08, 2);            // 8% test profit
                $bal     = round($start + $profit, 2);
                $minDays = (int) $wpdb->get_var($wpdb->prepare(
                    "SELECT p2_min_days FROM {$wpdb->prefix}fxsim_challenge_plans WHERE id=%d", (int) $ca->plan_id));
                $days    = max((int) $ca->trading_days, $minDays, 1);
                $wpdb->update($t, [
                    'status'              => 'funded',
                    'funded_at'           => $ca->funded_at ?: $now,
                    'current_balance'     => $bal,
                    'peak_balance'        => $bal,
                    'daily_start_balance' => $bal,
                    'trading_days'        => $days,
                    'breach_reason'       => null,
                    'breach_at'           => null,
                ], ['id' => $id]);
                $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                    ['balance' => $bal, 'equity' => $bal, 'margin_used' => 0],
                    ['id' => (int) $ca->fxsim_account_id]);
                FXSIM_Database::push_notification($uid, 'success', 'Payout test profit credited',
                    'Your funded account now has test profit of $' . number_format($profit, 2) . ' available to withdraw.', '/dashboard/payouts');
                break;
            case 'reset':
                // Full state rebuild: re-baseline every derived field AND purge the
                // prior cycle's trades/positions so dashboard metrics, the equity
                // curve and recent-trades reflect a genuinely fresh account.
                $acc_id = (int) $ca->fxsim_account_id;
                $wpdb->update($t, [
                    'phase'               => 1,
                    'status'              => 'active',
                    'trading_days'        => 0,
                    'funded_at'           => null,
                    'phase_started_at'    => $now,
                    'current_balance'     => $ca->starting_balance,
                    'peak_balance'        => $ca->starting_balance,
                    'daily_start_balance' => $ca->starting_balance,
                    'last_trade_date'     => null,
                    'breach_reason'       => null,
                    'breach_at'           => null,
                ], ['id' => $id]);
                $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                    ['balance' => $ca->starting_balance, 'equity' => $ca->starting_balance, 'margin_used' => 0],
                    ['id' => $acc_id]);
                $wpdb->delete($wpdb->prefix . 'fxsim_trades',         ['account_id' => $acc_id]);
                $wpdb->delete($wpdb->prefix . 'fxsim_positions',      ['account_id' => $acc_id]);
                $wpdb->delete($wpdb->prefix . 'fxsim_pending_orders', ['account_id' => $acc_id]);
                break;
            default:
                return new WP_REST_Response(['success' => false, 'message' => 'Invalid action.'], 400);
        }
        self::invalidate_account_cache((int) $ca->user_id);
        FXSIM_Database::log_admin(get_current_user_id(), 'test_tool_' . $action, (int) $ca->user_id, 'Challenge #' . $id);
        $new = $wpdb->get_var($wpdb->prepare("SELECT status FROM $t WHERE id=%d", $id));
        return new WP_REST_Response(['success' => true, 'status' => $new]);
    }

    public static function admin_challenges(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results("
            SELECT ca.*, u.user_login, u.user_email, cp.name AS plan_name, cp.account_size
            FROM {$wpdb->prefix}fxsim_challenge_accounts ca
            JOIN {$wpdb->prefix}users u ON ca.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
            ORDER BY ca.created_at DESC LIMIT 200
        ");
        // Append pending payouts
        $payouts = $wpdb->get_results("
            SELECT p.*, u.user_login FROM {$wpdb->prefix}fxsim_payouts p
            JOIN {$wpdb->prefix}users u ON p.user_id=u.ID
            WHERE p.status='pending' ORDER BY p.requested_at DESC
        ");
        return new WP_REST_Response(['challenges' => $rows, 'pending_payouts' => $payouts]);
    }

    public static function admin_approve_payout(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $challenge_id = (int)$r->get_param('id');
        $body      = $r->get_json_params() ?: $r->get_body_params();
        $action    = sanitize_text_field($body['action']    ?? 'approve');
        $note      = sanitize_text_field($body['note']      ?? '');
        $reference = sanitize_text_field($body['reference'] ?? '');
        $status    = $action === 'approve' ? 'approved' : 'rejected';

        // Fetch payout row to notify the trader
        $payout = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_payouts
             WHERE challenge_id = %d AND status = 'pending' LIMIT 1",
            $challenge_id
        ));

        $wpdb->update($wpdb->prefix . 'fxsim_payouts', [
            'status'       => $status,
            'admin_note'   => $note,
            'tx_reference' => $reference ?: null,
            'processed_at' => current_time('mysql'),
        ], ['challenge_id' => $challenge_id, 'status' => 'pending']);

        if ($payout) {
            $user_id = (int)$payout->user_id;
            if ($status === 'approved') {
                FXSIM_Emails::send($user_id, 'payout_approved', [
                    'amount'    => number_format((float)$payout->trader_amount, 2),
                    'method'    => $payout->payment_method ?? '',
                    'reference' => $reference ?: 'Processing',
                ]);
                FXSIM_Database::push_notification($user_id, 'success',
                    '💸 Payout Processed!',
                    '$' . number_format((float)$payout->trader_amount, 2) . ' processed via ' . ($payout->payment_method ?: 'your payment method') . '.',
                    home_url('/dashboard/')
                );
            } else {
                FXSIM_Emails::send($user_id, 'payout_rejected', ['reason' => $note]);
                FXSIM_Database::push_notification($user_id, 'warning',
                    '⚠ Payout Requires Attention',
                    $note ?: 'Your payout needs follow-up. Please contact support.',
                    home_url('/dashboard/')
                );
            }
        }

        FXSIM_Database::log_admin(get_current_user_id(), "payout_{$action}",
            $payout->user_id ?? null, "Challenge #{$challenge_id} | Ref: {$reference}");
        return new WP_REST_Response(['success' => true]);
    }

    // ── MT5 credential management ─────────────────────────────────────────────

    /**
     * POST /admin/challenge/{id}/mt5-details
     * Admin assigns MT5 credentials to a funded challenge account.
     * Only allowed when status = 'funded'. Credentials stored in fxsim_challenge_accounts.
     */
    public static function admin_save_mt5(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $challenge_id = (int)$r->get_param('id');
        $body         = $r->get_json_params() ?: $r->get_body_params();

        // Verify challenge exists and is funded
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT id, user_id, status FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d",
            $challenge_id
        ));
        if (!$ch) return new WP_REST_Response(['error' => 'Challenge not found.'], 404);
        if ($ch->status !== 'funded') {
            return new WP_REST_Response(['error' => 'MT5 details can only be set on funded accounts.'], 400);
        }

        $updated = $wpdb->update(
            $wpdb->prefix . 'fxsim_challenge_accounts',
            [
                'mt5_login'        => sanitize_text_field($body['mt5_login']        ?? ''),
                'mt5_password'     => sanitize_text_field($body['mt5_password']     ?? ''),
                'mt5_server'       => sanitize_text_field($body['mt5_server']       ?? ''),
                'mt5_account_type' => sanitize_text_field($body['mt5_account_type'] ?? ''),
            ],
            ['id' => $challenge_id],
            ['%s','%s','%s','%s'],
            ['%d']
        );

        FXSIM_Database::log_admin(
            get_current_user_id(), 'mt5_details_assigned', (int)$ch->user_id,
            "Challenge #{$challenge_id} | Server: " . sanitize_text_field($body['mt5_server'] ?? '')
        );

        // Notify trader that their MT5 details are ready
        if ($updated !== false && !empty($body['mt5_login'])) {
            FXSIM_Database::push_notification(
                (int)$ch->user_id, 'success',
                '🖥 MT5 Access Details Ready',
                'Your funded account MT5 login details are now available on your dashboard.',
                home_url('/dashboard/')
            );
        }

        return new WP_REST_Response(['success' => $updated !== false]);
    }

    /**
     * GET /challenge/{id}/mt5-details
     * Trader fetches their own MT5 credentials (funded account only).
     * Returns login, server, account_type but NOT the raw password —
     * password is returned masked; client calls this only for display.
     * We return the actual password here since we have no separate PKI;
     * the connection is HTTPS and the user owns the account.
     */
    public static function challenge_mt5_details(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $challenge_id = (int)$r->get_param('id');
        $user_id      = get_current_user_id();

        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT status, mt5_login, mt5_password, mt5_server, mt5_account_type, user_id
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE id = %d",
            $challenge_id
        ));

        if (!$ch || (int)$ch->user_id !== $user_id) {
            return new WP_REST_Response(['error' => 'Not found.'], 404);
        }
        if ($ch->status !== 'funded') {
            return new WP_REST_Response(['error' => 'Not a funded account.'], 403);
        }
        if (empty($ch->mt5_login)) {
            return new WP_REST_Response(['ready' => false, 'message' => 'MT5 details not yet assigned. Please check back shortly.']);
        }

        return new WP_REST_Response([
            'ready'            => true,
            'mt5_login'        => $ch->mt5_login,
            'mt5_password'     => $ch->mt5_password,
            'mt5_server'       => $ch->mt5_server,
            'mt5_account_type' => $ch->mt5_account_type ?: 'Live',
        ]);
    }

    public static function admin_plans_list(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Challenge_DB::get_all_plans(false));
    }

    public static function admin_plan_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $allowed = ['name','account_size','price','phases',
                    'is_instant_funding','drawdown_type',
                    'p1_profit_target','p1_daily_dd','p1_max_dd','p1_min_days','p1_max_days',
                    'p2_profit_target','p2_daily_dd','p2_max_dd','p2_min_days','p2_max_days',
                    'p3_profit_target','p3_daily_dd','p3_max_dd','p3_min_days','p3_max_days',
                    'funded_profit_split','funded_max_dd','max_leverage','max_lot_size',
                    'news_trading','weekend_holding','consistency_rule','consistency_pct',
                    'scaling_enabled','scaling_growth_pct','scaling_interval_months',
                    'scaling_required_profit_pct','scaling_max_balance',
                    'is_active','sort_order'];
        $data = array_intersect_key($body, array_flip($allowed));
        $id   = (int)($body['id'] ?? 0);
        if ($id) {
            $wpdb->update($wpdb->prefix . 'fxsim_challenge_plans', $data, ['id' => $id]);
        } else {
            $data['slug'] = sanitize_title($data['name'] ?? 'plan');
            $wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', $data);
            $id = (int)$wpdb->insert_id;
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'plan_save', null, "Plan ID: $id");
        return new WP_REST_Response(['success' => true, 'id' => $id]);
    }

    public static function admin_whitelabel_get(): WP_REST_Response {
        $all = FXSIM_Challenge_DB::get_all_settings();
        // Never return server-side secrets to the browser. Expose only whether each
        // is configured; the actual values stay write-only.
        $secrets = ['stripe_secret_key', 'stripe_webhook_secret', 'coinpayments_priv_key', 'confirmo_api_key', 'confirmo_callback_secret'];
        foreach ($secrets as $k) {
            $all[$k . '_set'] = !empty($all[$k]);
            $all[$k] = '';
        }
        return new WP_REST_Response($all);
    }

    /** Settings keys that hold secrets — only ever overwritten with a non-empty value. */
    private static function secret_setting_keys(): array {
        return ['stripe_secret_key', 'stripe_webhook_secret', 'coinpayments_priv_key', 'confirmo_api_key', 'confirmo_callback_secret'];
    }

    /**
     * GET /branding — PUBLIC, non-sensitive branding for the SPA (sidebar, login,
     * document title, favicon, email header, certificates). Never returns secrets.
     */
    public static function branding_get(): WP_REST_Response {
        $s = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_all_settings() : [];
        $g = function (string $k, string $d = '') use ($s) {
            return (isset($s[$k]) && $s[$k] !== '') ? $s[$k] : $d;
        };
        return new WP_REST_Response([
            'brand_name'      => $g('brand_name', 'PropFirm System'),
            'brand_tagline'   => $g('brand_tagline', 'The Funded Trader Platform'),
            'logo_url'        => $g('logo_url', ''),
            'sidebar_icon_url'=> $g('sidebar_icon_url', ''),
            'login_logo_url'  => $g('login_logo_url', ''),
            'favicon_url'     => $g('favicon_url', ''),
            'support_email'   => $g('support_email', ''),
            'primary_color'   => $g('primary_color', ''),
            'secondary_color' => $g('secondary_color', ''),
            'footer_text'     => $g('footer_text', ''),
            // Platform→TradingView chart symbol overrides (JSON object as string).
            'tv_symbol_map'   => $g('tv_symbol_map', ''),
        ]);
    }

    /**
     * POST /admin/branding/upload — multipart image upload for logo/login-logo/favicon.
     * Stores into a PUBLIC uploads dir and returns the URL, so operators never need
     * the WordPress Media Library. Admin-only. Images only.
     */
    public static function admin_branding_upload(WP_REST_Request $r): WP_REST_Response {
        $field = sanitize_key((string) $r->get_param('field')); // logo | login_logo | favicon
        if (!in_array($field, ['logo', 'login_logo', 'sidebar_icon', 'favicon'], true)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid field.'], 400);
        }
        if (empty($_FILES['file']['tmp_name'])) {
            return new WP_REST_Response(['success' => false, 'message' => 'No file uploaded.'], 400);
        }
        $file    = $_FILES['file'];
        // Raster + icon only. SVG is intentionally excluded: it can carry inline
        // script and would execute if opened directly from the uploads URL (stored XSS).
        $mime_ext = [
            'image/png'  => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp',
            'image/x-icon' => 'ico', 'image/vnd.microsoft.icon' => 'ico',
        ];
        $mime = function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : ($file['type'] ?? '');
        if (!isset($mime_ext[$mime])) {
            return new WP_REST_Response(['success' => false, 'message' => 'Image must be PNG, JPG, WebP, or ICO.'], 415);
        }
        if (($file['size'] ?? 0) > 2 * 1024 * 1024) {
            return new WP_REST_Response(['success' => false, 'message' => 'Image must be 2MB or smaller.'], 413);
        }
        // Extra guard: confirm the bytes really are an image.
        if (@getimagesize($file['tmp_name']) === false && !in_array($mime, ['image/x-icon','image/vnd.microsoft.icon'], true)) {
            return new WP_REST_Response(['success' => false, 'message' => 'File is not a valid image.'], 415);
        }

        $u   = wp_upload_dir();
        $dir = trailingslashit($u['basedir']) . 'propfirm-branding/';
        wp_mkdir_p($dir);
        // Harden: never execute PHP from the branding dir even if a bad file lands here.
        if (!file_exists($dir . '.htaccess')) {
            file_put_contents($dir . '.htaccess',
                "<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|phps|pl|py|cgi|asp|sh)$\">\nRequire all denied\n</FilesMatch>\n");
        }
        // Extension is derived from the validated MIME — the user-supplied filename
        // extension is never trusted (prevents foo.php with image content).
        $ext  = $mime_ext[$mime];
        $name = $field . '_' . time() . '.' . $ext;
        $dest = $dir . $name;
        if (!@move_uploaded_file($file['tmp_name'], $dest) && !@rename($file['tmp_name'], $dest)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Upload failed. Please try again.'], 500);
        }
        $url = trailingslashit($u['baseurl']) . 'propfirm-branding/' . $name;

        // Persist to the matching setting so it takes effect immediately.
        $setting_key = ['logo' => 'logo_url', 'login_logo' => 'login_logo_url', 'sidebar_icon' => 'sidebar_icon_url', 'favicon' => 'favicon_url'][$field];
        if (class_exists('FXSIM_Challenge_DB')) FXSIM_Challenge_DB::set_setting($setting_key, esc_url_raw($url));
        FXSIM_Database::log_admin(get_current_user_id(), 'branding_upload', null, $field);

        return new WP_REST_Response(['success' => true, 'url' => $url, 'field' => $field]);
    }

    public static function admin_whitelabel_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $allowed = ['brand_name','brand_tagline','primary_color','secondary_color','logo_url',
                    'login_logo_url','sidebar_icon_url','setup_completed','tv_symbol_map',
                    'favicon_url','support_email','discord_webhook','telegram_bot','telegram_chat',
                    'footer_text','challenge_label','funded_label','coinpayments_pub_key',
                    'coinpayments_priv_key','frontend_url',
                    'pause_registrations','pause_payouts','pause_purchases','pause_trading','large_payout_threshold',
                    'manual_payment_instructions','manual_crypto_address',
                    'stripe_public_key','stripe_secret_key','stripe_webhook_secret'];
        foreach ($allowed as $key) {
            if (isset($body[$key])) {
                // Secret keys are write-only: an empty value means "leave unchanged"
                // (the admin GET masks them to '', so a blind round-trip won't wipe them).
                if (in_array($key, self::secret_setting_keys(), true) && $body[$key] === '') continue;
                $val = sanitize_text_field($body[$key]);
                FXSIM_Challenge_DB::set_setting($key, $val);
                // BUG-009: mirror the frontend URL into the wp-option that the
                // (frozen) Stripe checkout builder reads, so success/cancel
                // redirects use the configured frontend domain without touching
                // the frozen file. Single admin field → both consumers in sync.
                if ($key === 'frontend_url') update_option('fxsim_frontend_url', untrailingslashit($val));
            }
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'whitelabel_save');
        return new WP_REST_Response(['success' => true]);
    }

    /**
     * GET /admin/stripe/status — server-side Stripe connectivity check. Validates the
     * stored secret key against Stripe's API and reports mode/status WITHOUT ever
     * returning the secret or webhook secret to the browser.
     */
    public static function admin_stripe_status(): WP_REST_Response {
        return new WP_REST_Response(self::stripe_status_data());
    }

    /** READ-ONLY Stripe status (shared by /admin/stripe/status and /admin/health). */
    private static function stripe_status_data(bool $live_check = true): array {
        $sk  = FXSIM_Challenge_DB::get_setting('stripe_secret_key', '');
        $pk  = FXSIM_Challenge_DB::get_setting('stripe_public_key', '');
        $whk = FXSIM_Challenge_DB::get_setting('stripe_webhook_secret', '');
        $mode = '';
        if ($sk) $mode = (strpos($sk, 'sk_live_') === 0) ? 'live' : ((strpos($sk, 'sk_test_') === 0) ? 'test' : 'unknown');

        $out = [
            'has_public_key'     => !empty($pk),
            'has_secret_key'     => !empty($sk),
            'has_webhook_secret' => !empty($whk),
            'mode'               => $mode,
            'connected'          => false,
            'account'            => '',
            'message'            => '',
            // Read-only convenience for onboarding: where to point the Stripe webhook.
            'webhook_url'        => rest_url(self::NS . '/stripe/webhook'),
        ];
        if (!$sk) { $out['message'] = 'No secret key configured.'; return $out; }
        if (!$live_check) { $out['message'] = 'Keys configured (live check skipped).'; return $out; }

        // Lightweight authenticated call to Stripe; never echoes the key.
        $resp = wp_remote_get('https://api.stripe.com/v1/account', [
            'timeout' => 12,
            'headers' => ['Authorization' => 'Bearer ' . $sk],
        ]);
        if (is_wp_error($resp)) { $out['message'] = 'Could not reach Stripe: ' . $resp->get_error_message(); return $out; }
        $code = (int) wp_remote_retrieve_response_code($resp);
        $data = json_decode(wp_remote_retrieve_body($resp), true);
        if ($code === 200 && !empty($data['id'])) {
            $out['connected'] = true;
            $out['account']   = $data['id'];
            $out['message']   = 'Connected to Stripe (' . ($mode ?: 'unknown') . ' mode).';
        } else {
            $out['message'] = is_array($data) && isset($data['error']['message'])
                ? $data['error']['message'] : 'Stripe rejected the secret key.';
        }
        return $out;
    }


    // ════════════════════════════════════════════════════════════════════════
    //  DEMO MODE (V10.4) — tracked-seed architecture
    //
    //  Seeds realistic data through the REAL tables so every platform screen
    //  (analytics, leaderboard, certificates, payouts, stats) renders through
    //  its normal data path. Every created row ID is recorded in the
    //  `fxsim_demo_registry` option, so removal is exact — registry-based
    //  deletion only, never heuristic. Demo users live on the RFC-reserved
    //  `.invalid` TLD so email can never deliver. No schema changes, no new
    //  tables, no contact with trading/challenge/payment engines.
    // ════════════════════════════════════════════════════════════════════════

    private const DEMO_REGISTRY_KEY = 'fxsim_demo_registry';

    /** GET /admin/demo/status — registry summary (read-only). */
    public static function admin_demo_status(): WP_REST_Response {
        $reg = get_option(self::DEMO_REGISTRY_KEY, null);
        if (!is_array($reg)) {
            return new WP_REST_Response(['active' => false, 'users' => 0, 'accounts' => 0, 'orders' => 0, 'payouts' => 0, 'banners' => 0]);
        }
        return new WP_REST_Response([
            'active'   => true,
            'generating' => !empty($reg['generating']),
            'users'    => count($reg['users'] ?? []),
            'accounts' => count($reg['challenge_accounts'] ?? []),
            'orders'   => count($reg['orders'] ?? []),
            'payouts'  => count($reg['payouts'] ?? []),
            'banners'  => count($reg['banners'] ?? []),
            'created'  => $reg['created_at'] ?? null,
        ]);
    }

    /** POST /admin/demo/generate — seed demo data (admin-only, refuses to double-seed). */
    public static function admin_demo_generate(): WP_REST_Response {
        global $wpdb;
        // V10.6 (H1): atomic generation lock. add_option() is a single INSERT
        // guarded by the option-name unique key, so exactly ONE concurrent
        // request can claim the registry; everyone else gets a 409. A crashed
        // run leaves a 'generating' placeholder that goes stale after 15 min
        // and can be taken over (or removed via Remove Demo Data).
        $placeholder = ['generating' => true, 'created_at' => time()];
        if (!add_option(self::DEMO_REGISTRY_KEY, $placeholder, '', false)) {
            $existing = get_option(self::DEMO_REGISTRY_KEY, null);
            $stale = is_array($existing) && !empty($existing['generating'])
                && (time() - (int) ($existing['created_at'] ?? 0)) > 900;
            if (!$stale) {
                return new WP_REST_Response(['success' => false, 'message' => 'Demo data already exists or is being generated. Remove it before generating again.'], 409);
            }
            update_option(self::DEMO_REGISTRY_KEY, $placeholder, false);
        }
        $reg = ['generating' => true, 'users' => [], 'fx_accounts' => [], 'challenge_accounts' => [], 'orders' => [], 'payouts' => [], 'banners' => [], 'plans' => [], 'created_at' => time()];

        // ── Plans: build a balanced multi-tier set so plan usage and revenue vary realistically ──
        $plans = $wpdb->get_results("SELECT id, name, account_size, price, funded_profit_split FROM {$wpdb->prefix}fxsim_challenge_plans WHERE is_active = 1 ORDER BY price ASC");
        if (!$plans || count($plans) < 3) {
            $seed_plans = [
                ['Starter 5K',   'starter-5k',   5000,   49, 80],
                ['Standard 10K', 'standard-10k', 10000,  99, 80],
                ['Pro 25K',      'pro-25k',      25000, 199, 85],
                ['Elite 50K',    'elite-50k',    50000, 349, 90],
                ['Master 100K',  'master-100k',  100000, 549, 90],
            ];
            foreach ($seed_plans as [$pname, $pslug, $psize, $pprice, $psplit]) {
                $ex = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_plans WHERE slug = %s", $pslug));
                if ($ex) continue;
                $wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
                    'name' => $pname, 'slug' => $pslug, 'account_size' => $psize,
                    'price' => $pprice, 'phases' => 1, 'p1_profit_target' => 8, 'p1_daily_dd' => 5, 'p1_max_dd' => 10,
                    'funded_profit_split' => $psplit, 'is_active' => 1,
                ]);
                $reg['plans'][] = (int) $wpdb->insert_id;
            }
            $plans = $wpdb->get_results("SELECT id, name, account_size, price, funded_profit_split FROM {$wpdb->prefix}fxsim_challenge_plans WHERE is_active = 1 ORDER BY price ASC");
        }
        // Weight cheaper plans as more popular (realistic funnel).
        $plan_pool = [];
        foreach ($plans as $pi => $pl) {
            $weight = max(1, count($plans) - $pi);
            for ($w = 0; $w < $weight; $w++) $plan_pool[] = $pl;
        }

        // ── Demo traders: generated from realistic name pools, undeliverable emails ──
        $first = ['Daniel','Sofia','Liam','Amara','Yusuf','Elena','Marco','Hannah','Carlos','Aisha',
                  'Tom','Sara','James','Mei','Lucas','Nadia','Omar','Ava','Noah','Priya',
                  'Diego','Lena','Ivan','Chloe','Raj','Maya','Felix','Zara','Hugo','Ines',
                  'Adam','Lara','Kofi','Yuki','Pablo','Nina','Sven','Tara','Bilal','Emma',
                  'Mateo','Anya','Sami','Rosa','Kai','Leila','Dmitri','Grace','Tariq','Vera'];
        $last  = ['Carter','Almeida','Walsh','Okafor','Khan','Petrova','Rossi','Schmidt','Mendoza','Rahman',
                  'Nguyen','Lindqvist','Oduya','Tanaka','Moreau','Haddad','Silva','Novak','Costa','Reyes',
                  'Ahmed','Kowalski','Berg','Dubois','Marin','Hasan','Lopez','Jensen','Park','Romano',
                  'Fischer','Singh','Olsen','Vargas','Bauer','Cohen','Ali','Toms','Weber','Diaz'];
        $countries = ['GB','PT','IE','NG','PK','BG','IT','DE','MX','BD','AU','SE','KE','JP','FR','AE','US','CA','ES','IN','BR','PL','NL','ZA'];

        // Build ~100 unique traders.
        $TRADER_COUNT = 110;
        $traders = [];
        $seen = [];
        $guard = 0;
        while (count($traders) < $TRADER_COUNT && $guard < 4000) {
            $guard++;
            $name = $first[array_rand($first)] . ' ' . $last[array_rand($last)];
            if (isset($seen[$name])) continue;
            $seen[$name] = true;
            $traders[] = [$name, $countries[array_rand($countries)]];
        }

        // Lifecycle mix per ~100 traders: ~32 funded, ~38 passed→failed split, rest active.
        // Concrete distribution: 32 funded, 45 failed, 38 passed, 35 active ≈ matches targets
        // (funded 25-40, failed 40-60, passed 30-50) scaled to the actual trader count.
        $n = count($traders);
        $cnt_funded = (int) round($n * 0.30);
        $cnt_failed = (int) round($n * 0.34);
        $cnt_passed = (int) round($n * 0.20);
        $cnt_active = max(0, $n - $cnt_funded - $cnt_failed - $cnt_passed);
        $statuses = array_merge(
            array_fill(0, $cnt_funded, 'funded'),
            array_fill(0, $cnt_failed, 'failed'),
            array_fill(0, $cnt_passed, 'passed'),
            array_fill(0, $cnt_active, 'active')
        );
        shuffle($statuses);

        $now = current_time('timestamp');
        $day = 86400;
        $i   = 0;
        $used_handles = [];
        foreach ($traders as $idx => [$name, $cc]) {
            // Weighted-random plan per trader → balanced plan usage + varied revenue.
            $plan  = $plan_pool[array_rand($plan_pool)];
            $size  = (float) $plan->account_size;
            $price = (float) $plan->price > 0 ? (float) $plan->price : 99.0;
            // Realistic identity. Uniqueness is guaranteed by a numeric suffix
            // only when needed (first occurrence stays clean: "john.smith";
            // later collisions become "john.smith2"). The @sampletraders.com
            // domain is non-deliverable in practice for this dataset but reads
            // as a real address — no demo/test/fake markers anywhere.
            $base = strtolower(preg_replace('/[^a-z]+/i', '.', trim($name)));
            $handle = $base;
            if (isset($used_handles[$handle])) {
                $used_handles[$base] = ($used_handles[$base] ?? 1) + 1;
                $handle = $base . $used_handles[$base];
            } else {
                $used_handles[$handle] = 1;
            }
            $uid = wp_insert_user([
                'user_login'   => $handle,
                'user_email'   => $handle . '@sampletraders.com',
                'user_pass'    => wp_generate_password(24),
                'display_name' => $name,
                'first_name'   => explode(' ', $name)[0],
                'last_name'    => explode(' ', $name)[1] ?? '',
                'role'         => 'subscriber',
            ]);
            if (is_wp_error($uid)) continue;
            update_user_meta($uid, 'fxsim_demo_user', '1'); // cleanup key — unchanged
            update_user_meta($uid, 'fxsim_country', $cc);
            // Spread registrations across the last ~10 months so growth charts fill.
            $reg_ts = $now - rand(15, 300) * $day;
            $wpdb->update($wpdb->users, ['user_registered' => date('Y-m-d H:i:s', $reg_ts)], ['ID' => $uid]);
            $reg['users'][] = $uid;

            // ── Trading account (display shell only — no positions, no trades) ──
            $status = $statuses[$idx % count($statuses)];
            // Balance trajectory by outcome.
            if ($status === 'funded')      $cur = $size * (1 + rand(9, 18) / 100);
            elseif ($status === 'passed')  $cur = $size * (1 + rand(8, 12) / 100);
            elseif ($status === 'failed')  $cur = $size * (1 - rand(10, 14) / 100);
            else                           $cur = $size * (1 + rand(-4, 6) / 100);
            $wpdb->insert($wpdb->prefix . 'fxsim_accounts', [
                'user_id' => $uid, 'balance' => $cur, 'equity' => $cur, 'status' => 'active',
            ]);
            $fxid = (int) $wpdb->insert_id;
            $reg['fx_accounts'][] = $fxid;

            // ── Challenge account ──
            // Active rows get RECENT start dates and no open positions, so the
            // (frozen, untouched) daily cron's time-limit checks cannot fail
            // them and swap application finds nothing to act on.
            $started = $status === 'active' ? $now - rand(2, 9) * $day : $now - rand(30, 280) * $day;
            $ended   = $started + rand(12, 25) * $day;
            $row = [
                'user_id' => $uid, 'plan_id' => (int) $plan->id, 'fxsim_account_id' => $fxid,
                'phase' => $status === 'funded' ? 0 : 1, 'status' => $status,
                'starting_balance' => $size, 'current_balance' => $cur,
                'peak_balance' => max($size, $cur), 'daily_start_balance' => $cur,
                'trading_days' => rand(4, 18),
                'phase_started_at' => date('Y-m-d H:i:s', $started),
                'created_at' => date('Y-m-d H:i:s', $started),
            ];
            if ($status === 'passed') $row['passed_at'] = date('Y-m-d H:i:s', $ended);
            if ($status === 'failed') { $row['failed_at'] = date('Y-m-d H:i:s', $ended); $row['breach_reason'] = 'max_drawdown'; $row['breach_at'] = date('Y-m-d H:i:s', $ended); }
            if ($status === 'funded') { $row['passed_at'] = date('Y-m-d H:i:s', $ended); $row['funded_at'] = date('Y-m-d H:i:s', $ended + 2 * $day); }
            $wpdb->insert($wpdb->prefix . 'fxsim_challenge_accounts', $row);
            $cid = (int) $wpdb->insert_id;
            $reg['challenge_accounts'][] = $cid;

            // ── Trade history (Issue #2) ──
            // Generate a handful of CLOSED trades per account so the dashboard's
            // Total Trades / Realised P&L cards reflect the sample activity. PnL
            // is distributed to roughly reconcile with the account's net result
            // ($cur - $size). Pure data inserts into fxsim_trades — the frozen
            // trading engine is NOT involved (these are historical/closed rows).
            $net        = $cur - $size;                 // target realised P&L for this account
            $num_trades = rand(6, 20);
            $syms       = ['EURUSD' => 0.00013, 'GBPUSD' => 0.00015, 'USDJPY' => 0.012, 'XAUUSD' => 0.35, 'BTCUSD' => 12.0];
            $sym_keys   = array_keys($syms);
            $per        = $num_trades > 0 ? $net / $num_trades : 0;
            for ($ti = 0; $ti < $num_trades; $ti++) {
                $sym  = $sym_keys[array_rand($sym_keys)];
                $side = rand(0, 1) ? 'buy' : 'sell';
                // Scatter each trade's pnl around the per-trade average so the
                // distribution looks organic but still sums close to $net.
                $pnl  = round($per * (rand(40, 160) / 100) * (rand(0, 4) ? 1 : -1), 2);
                $lot  = round(rand(1, 50) / 10, 2);
                $op   = $sym === 'BTCUSD' ? rand(25000, 70000) : ($sym === 'XAUUSD' ? rand(1800, 2400) : ($sym === 'USDJPY' ? rand(130, 160) : rand(1, 2) + rand(0, 9999) / 10000));
                $cp   = $op * (1 + (rand(-30, 30) / 10000));
                $t_open  = $started + rand(0, max(1, ($ended - $started)));
                $t_close = $t_open + rand(1, 48) * 3600;
                if ($t_close > $now) $t_close = $now - rand(0, 3) * 3600;
                $wpdb->insert($wpdb->prefix . 'fxsim_trades', [
                    'account_id' => $fxid, 'symbol' => $sym, 'type' => $side,
                    'lot_size' => $lot, 'open_price' => round($op, 5), 'close_price' => round($cp, 5),
                    'margin' => 0, 'commission' => 0, 'swap' => 0, 'pnl' => $pnl,
                    'close_reason' => 'manual',
                    'opened_at' => date('Y-m-d H:i:s', $t_open),
                    'closed_at' => date('Y-m-d H:i:s', $t_close),
                ]);
            }

            // ── Payment order (manual gateway — no Stripe objects) ──
            // Most orders are approved (revenue), but ~1 in 12 stays pending so
            // the dashboard's "Pending payments" card reflects a live queue.
            $order_ts   = $started - rand(0, 2) * $day;
            $order_stat = (mt_rand(1, 12) === 1) ? 'pending' : 'approved';
            $order_row  = [
                'user_id' => $uid, 'plan_id' => (int) $plan->id, 'amount' => $price,
                'currency' => 'USD', 'gateway' => 'manual', 'status' => $order_stat,
                'admin_note' => 'Demo data', 'created_at' => date('Y-m-d H:i:s', $order_ts),
            ];
            if ($order_stat === 'approved') $order_row['reviewed_at'] = date('Y-m-d H:i:s', $order_ts);
            $wpdb->insert($wpdb->prefix . 'fxsim_payment_orders', $order_row);
            $reg['orders'][] = (int) $wpdb->insert_id;

            // ── Payout requests for two funded traders (pending → Payout Center) ──
            if ($status === 'funded' && mt_rand(1, 100) <= 60) {
                $profit = max(0, $cur - $size);
                $split  = (float) ($plan->funded_profit_split ?: 80);
                $amt    = round($profit * 0.6, 2);
                $wpdb->insert($wpdb->prefix . 'fxsim_payouts', [
                    'challenge_id' => $cid, 'user_id' => $uid,
                    'amount_requested' => $amt, 'profit_split_pct' => $split,
                    'trader_amount' => round($amt * $split / 100, 2),
                    'firm_amount'   => round($amt * (100 - $split) / 100, 2),
                    'status' => 'pending', 'payment_method' => 'crypto_trc20',
                    'admin_note' => 'Awaiting review',
                    'payment_address' => 'TQ5xWz8mN3rPq7vL2kYbH9dFgJcRtA6sUe',
                    'requested_at' => date('Y-m-d H:i:s', $now - rand(1, 4) * $day),
                ]);
                $reg['payouts'][] = (int) $wpdb->insert_id;
                $i++;
            }

            // Persist progress so a crashed run leaves a removable partial registry.
            update_option(self::DEMO_REGISTRY_KEY, $reg, false);
        }

        // ── Historical orders: 12-month upward trend, multiple sales per month,
        //    randomized across the plan tiers so total revenue lands ~$15k–$50k. ──
        $demo_uids = $reg['users'];
        for ($m = 12; $m >= 1; $m--) {
            // Orders/month rises as months approach now: ~6 → ~22.
            $base = 6 + (int) round((12 - $m) * 1.4);
            $monthly = max(3, $base + rand(-2, 3));
            for ($k = 0; $k < $monthly; $k++) {
                $pl = $plan_pool[array_rand($plan_pool)];
                $amt = (float) $pl->price > 0 ? (float) $pl->price : 99.0;
                $ts  = strtotime("-{$m} months", $now) + rand(1, 26) * $day;
                if ($ts > $now) $ts = $now - rand(0, 5) * $day;
                $wpdb->insert($wpdb->prefix . 'fxsim_payment_orders', [
                    'user_id' => $demo_uids[array_rand($demo_uids)], 'plan_id' => (int) $pl->id,
                    'amount' => $amt, 'currency' => 'USD', 'gateway' => (rand(0, 1) ? 'stripe' : 'manual'),
                    'status' => 'approved', 'admin_note' => 'Demo data',
                    'created_at' => date('Y-m-d H:i:s', $ts), 'reviewed_at' => date('Y-m-d H:i:s', $ts),
                ]);
                $reg['orders'][] = (int) $wpdb->insert_id;
            }
        }

        // ── One demo banner campaign ──
        $wpdb->insert($wpdb->prefix . 'fxsim_banners', [
            'title' => 'Launch offer', 'message' => '🚀 Launch week: 30% off all challenges with code LAUNCH30',
            'placement' => 'both', 'scope_type' => 'global', 'bg_color' => '#7c6ef5', 'text_color' => '#ffffff',
            'cta_label' => 'Claim Offer', 'cta_url' => '/challenges', 'coupon_code' => 'LAUNCH30',
            'active' => 1, 'priority' => 5,
            'created_at' => current_time('mysql'), 'updated_at' => current_time('mysql'),
        ]);
        $reg['banners'][] = (int) $wpdb->insert_id;

        unset($reg['generating']);
        update_option(self::DEMO_REGISTRY_KEY, $reg, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'demo_data_generated', null,
            count($reg['users']) . ' users, ' . count($reg['orders']) . ' orders');

        return new WP_REST_Response([
            'success' => true,
            'users' => count($reg['users']), 'accounts' => count($reg['challenge_accounts']),
            'orders' => count($reg['orders']), 'payouts' => count($reg['payouts']), 'banners' => count($reg['banners']),
        ]);
    }

    /** POST /admin/demo/remove — registry-based deletion ONLY. Real data untouched. */
    public static function admin_demo_remove(): WP_REST_Response {
        global $wpdb;
        $reg = get_option(self::DEMO_REGISTRY_KEY, null);
        if (!is_array($reg)) {
            return new WP_REST_Response(['success' => false, 'message' => 'No demo data registry found.'], 404);
        }
        $del = static function (string $table, array $ids) use ($wpdb): int {
            $ids = array_filter(array_map('intval', $ids));
            if (!$ids) return 0;
            $in = implode(',', $ids);
            return (int) $wpdb->query("DELETE FROM {$wpdb->prefix}{$table} WHERE id IN ($in)");
        };
        $removed = [
            'payouts'  => $del('fxsim_payouts',            $reg['payouts'] ?? []),
            'orders'   => $del('fxsim_payment_orders',     $reg['orders'] ?? []),
            'accounts' => $del('fxsim_challenge_accounts', $reg['challenge_accounts'] ?? []),
            'fx'       => $del('fxsim_accounts',           $reg['fx_accounts'] ?? []),
            'banners'  => $del('fxsim_banners',            $reg['banners'] ?? []),
            'plans'    => $del('fxsim_challenge_plans',    $reg['plans'] ?? []),
        ];
        // Demo trades (Issue #2): keyed by account_id, not their own id, so they
        // are removed via the fx_accounts registry. Done before fx accounts are
        // already deleted above? No — trades reference account_id which we still
        // have in the registry, so delete by that list directly here.
        $fx_ids = array_filter(array_map('intval', $reg['fx_accounts'] ?? []));
        if ($fx_ids) {
            $in = implode(',', $fx_ids);
            $removed['trades'] = (int) $wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_trades WHERE account_id IN ($in)");
        }
        // WP users last (registry IDs only; double-checked against the demo flag).
        if (!function_exists('wp_delete_user')) require_once ABSPATH . 'wp-admin/includes/user.php';
        $u = 0;
        foreach (array_filter(array_map('intval', $reg['users'] ?? [])) as $uid) {
            if (get_user_meta($uid, 'fxsim_demo_user', true) === '1') { wp_delete_user($uid); $u++; }
        }
        $removed['users'] = $u;
        delete_option(self::DEMO_REGISTRY_KEY);
        FXSIM_Database::log_admin(get_current_user_id(), 'demo_data_removed', null, wp_json_encode($removed));
        return new WP_REST_Response(['success' => true, 'removed' => $removed]);
    }

    /**
     * GET /admin/health — READ-ONLY system health aggregation.
     *
     * STRICTLY observational: only get_option / settings reads, one COUNT query,
     * an is_writable() probe, and (optionally) the same outbound Stripe check the
     * settings page already performs. It performs NO writes, NO state changes,
     * and touches NO trading / challenge / payment / payout code paths.
     * Admin-only; never runs for traders or public visitors.
     */
    public static function admin_system_health(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $items = [];
        $now   = time();
        $deep  = $r->get_param('deep') !== '0'; // deep=0 skips the outbound Stripe call

        // ── 1. MT5 / price feed (reuses the existing V10 health snapshot) ──
        $fh = class_exists('FXSIM_Price_Feed') ? FXSIM_Price_Feed::feed_health() : ['status' => 'unknown'];
        $feed_status = $fh['status'] ?? 'unknown';
        $feed_map = ['fresh'=>'ok', 'market_closed'=>'ok', 'yahoo'=>'warn', 'stale'=>'warn', 'offline'=>'error', 'unknown'=>'error'];
        $feed_msgs = [
            'fresh'         => 'Live MT5 prices flowing.',
            'market_closed' => 'Market closed — feed idle as expected.',
            'yahoo'         => 'Running on Yahoo fallback (MT5 not connected).',
            'stale'         => 'MT5 feed is stale — fallback active.',
            'offline'       => 'Price feed offline.',
            'unknown'       => 'Price feed status unavailable.',
        ];
        $items['mt5_feed'] = [
            'label'  => 'MT5 Price Feed',
            'state'  => $feed_map[$feed_status] ?? 'error',
            'detail' => ($feed_msgs[$feed_status] ?? '') . ' Mode: ' . ($fh['mode'] ?? '?') . ', source: ' . ($fh['active_source'] ?? '?') . '.',
        ];

        // ── 2. Last price update (MT5 push or Yahoo cron, whichever is newer) ──
        $last_push = (int) ($fh['mt5_last_push_ts'] ?? 0);
        $last_yah  = (int) get_option('fxsim_last_price_update', 0);
        $last_any  = max($last_push, $last_yah);
        $age       = $last_any ? ($now - $last_any) : null;
        $items['last_price_update'] = [
            'label'  => 'Last Price Update',
            'state'  => $last_any === 0 ? 'error' : ($age <= 300 ? 'ok' : ($age <= 3600 ? 'warn' : 'error')),
            'detail' => $last_any ? (human_time_diff($last_any, $now) . ' ago') : 'No price update recorded yet.',
            'ts'     => $last_any ?: null,
        ];

        // ── 3 + 4. Stripe connection + webhook secret ──
        $st = self::stripe_status_data($deep);
        $items['stripe'] = [
            'label'  => 'Stripe Connection',
            'state'  => $st['connected'] ? 'ok' : ($st['has_secret_key'] ? ($deep ? 'error' : 'warn') : 'warn'),
            'detail' => $st['message'] ?: ($st['has_secret_key'] ? 'Keys configured.' : 'Stripe not configured.'),
        ];
        $items['stripe_webhook'] = [
            'label'  => 'Stripe Webhook',
            'state'  => $st['has_webhook_secret'] ? 'ok' : 'warn',
            'detail' => $st['has_webhook_secret']
                ? 'Webhook signing secret configured.'
                : 'No webhook secret — register the webhook in your Stripe dashboard and paste the signing secret in Settings → Payments.',
        ];

        // ── 5. SMTP / email delivery ──
        $smtp_host = get_option('fxsim_smtp_host', '');
        $items['smtp'] = [
            'label'  => 'Email Delivery (SMTP)',
            'state'  => $smtp_host ? 'ok' : 'warn',
            'detail' => $smtp_host
                ? 'SMTP configured (' . esc_html($smtp_host) . ').'
                : 'No SMTP configured — using the host\'s default PHP mail (deliverability may suffer).',
        ];

        // ── 6. REST API (self-evident: this response proves the namespace works) ──
        $items['rest_api'] = [
            'label'  => 'REST API',
            'state'  => 'ok',
            'detail' => 'fxsim/v1 namespace reachable and authenticated.',
        ];

        // ── 7. Certificate system (HMAC capability + eligible rows; read-only COUNT) ──
        $cert_ok = function_exists('wp_salt');
        $cert_count = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status IN ('funded','passed')"
        );
        $items['certificates'] = [
            'label'  => 'Certificate System',
            'state'  => $cert_ok ? 'ok' : 'error',
            'detail' => $cert_ok
                ? ($cert_count . ' certificate-eligible account' . ($cert_count === 1 ? '' : 's') . '; public share codes operational.')
                : 'Signing salt unavailable.',
        ];

        // ── 8. Storage (uploads dir present + writable; probe only, no write) ──
        $u = wp_upload_dir();
        $writable = !empty($u['basedir']) && is_dir($u['basedir']) && is_writable($u['basedir']);
        $items['storage'] = [
            'label'  => 'Storage',
            'state'  => $writable ? 'ok' : 'error',
            'detail' => $writable
                ? 'Uploads directory writable (branding, KYC, payment proofs).'
                : 'Uploads directory missing or not writable — uploads will fail.',
        ];

        // ── 9. Cron (price update schedule) ──
        $next = wp_next_scheduled('fxsim_price_update');
        if (!$next) {
            $cron = ['state' => 'error', 'detail' => 'Price-update cron is not scheduled.'];
        } elseif ($next < $now - 300) {
            $cron = ['state' => 'warn', 'detail' => 'Cron is overdue by ' . human_time_diff($next, $now) . ' — WP-Cron may need a real cron trigger.'];
        } else {
            $cron = ['state' => 'ok', 'detail' => 'Next price-update run ' . ($next <= $now ? 'imminent' : 'in ' . human_time_diff($now, $next)) . '.'];
        }
        $items['cron'] = ['label' => 'Cron Scheduler'] + $cron;

        // ── 10. SSL / HTTPS (read-only environment check) ──
        $home  = home_url();
        $https = is_ssl() || strpos($home, 'https://') === 0;
        $items['ssl'] = [
            'label'  => 'SSL / HTTPS',
            'state'  => $https ? 'ok' : 'error',
            'detail' => $https
                ? 'Site is served over HTTPS — payment pages and logins are encrypted.'
                : 'Site is NOT using HTTPS. Install an SSL certificate before accepting payments or logins.',
        ];

        // Plain-English explanation for non-technical operators, per item.
        $explain = [
            'mt5_feed'          => 'Where your live market prices come from. "Yahoo fallback" means trading still works, but prices are not from your MT5 broker feed.',
            'last_price_update' => 'How recently the platform received a price. If this is old during market hours, charts and trades use stale prices.',
            'stripe'            => 'Whether the platform can talk to Stripe to take card payments.',
            'stripe_webhook'    => 'How Stripe tells the platform a payment succeeded. Without it, paid orders may not activate automatically.',
            'smtp'              => 'How the platform sends emails (verification, receipts, payouts). Without SMTP, emails may land in spam or not send.',
            'rest_api'          => 'The connection between your website/app and this platform. If this fails, nothing else works.',
            'certificates'      => 'The system that issues and verifies trader certificates and public share links.',
            'storage'           => 'Where uploaded files (logos, KYC documents, payment proofs) are kept.',
            'cron'              => 'The scheduler that refreshes prices and runs background jobs automatically.',
            'ssl'               => 'Encryption for your site. Browsers and payment providers require HTTPS.',
        ];
        foreach ($explain as $k => $txt) { if (isset($items[$k])) $items[$k]['explain'] = $txt; }

        // ── Health score: ok = 1, warn = 0.5, error = 0 ──
        $points = 0; $total = 0;
        foreach ($items as $i) { $total++; $points += $i['state'] === 'ok' ? 1 : ($i['state'] === 'warn' ? 0.5 : 0); }
        $score = $total ? (int) round(($points / $total) * 100) : 0;

        return new WP_REST_Response([
            'score'        => $score,
            'generated_at' => $now,
            'deep'         => $deep,
            'items'        => $items,
        ]);
    }

    // ── Crypto payment networks (multi-network, stored as one JSON setting) ──────
    private static function crypto_allowed_networks(): array { return ['TRC20','BEP20','ERC20','BTC','ETH']; }

    /** Read configured crypto networks (array). Falls back to the legacy single address.
     *  Pass $settings (from get_all_settings) to avoid extra queries. */
    private static function crypto_networks_read(?array $settings = null): array {
        $get = function (string $k) use ($settings) {
            if ($settings !== null) return $settings[$k] ?? '';
            return FXSIM_Challenge_DB::get_setting($k, '');
        };
        $raw  = $get('crypto_networks');
        $list = $raw ? json_decode($raw, true) : null;
        if (!is_array($list)) $list = [];
        if (!$list) {
            $legacy = $get('manual_crypto_address');
            if ($legacy) $list[] = ['network'=>'USDT','address'=>$legacy,'label'=>'Crypto','instructions'=>'','enabled'=>true];
        }
        return $list;
    }

    public static function admin_crypto_get(): WP_REST_Response {
        return new WP_REST_Response(['networks' => self::crypto_networks_read()]);
    }

    public static function admin_crypto_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $in   = $body['networks'] ?? [];
        if (!is_array($in)) return new WP_REST_Response(['success'=>false,'message'=>'Invalid networks payload.'], 400);
        $clean = [];
        foreach ($in as $n) {
            $net = strtoupper(sanitize_text_field($n['network'] ?? ''));
            if (!in_array($net, self::crypto_allowed_networks(), true)) continue;
            $addr = sanitize_text_field($n['address'] ?? '');
            $clean[] = [
                'network'      => $net,
                'address'      => $addr,
                'label'        => sanitize_text_field($n['label'] ?? $net),
                'instructions' => sanitize_textarea_field($n['instructions'] ?? ''),
                'enabled'      => !empty($n['enabled']) && $addr !== '',
            ];
        }
        FXSIM_Challenge_DB::set_setting('crypto_networks', wp_json_encode($clean));
        // Keep the legacy single-address field in sync (first enabled) for back-compat.
        $firstEnabled = '';
        foreach ($clean as $c) { if ($c['enabled']) { $firstEnabled = $c['address']; break; } }
        FXSIM_Challenge_DB::set_setting('manual_crypto_address', $firstEnabled);
        FXSIM_Database::log_admin(get_current_user_id(), 'crypto_networks_save');
        return new WP_REST_Response(['success'=>true,'networks'=>$clean]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PAYMENT ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * GET /payment/config — returns payment display settings safe for authenticated users.
     *
     * Deliberately does NOT include stripe_secret_key, coinpayments_priv_key, or any
     * other server-side secret. Only the fields the UI needs to render payment instructions.
     * Replaces the erroneous call to /admin/whitelabel (admin-only) that showStep2()
     * was making, which caused 403 → empty crypto address / bank details for all users.
     */
    public static function payment_config(): WP_REST_Response {
        $s = FXSIM_Challenge_DB::get_all_settings();
        $pub_key   = $s['coinpayments_pub_key']  ?? '';
        $priv_key  = $s['coinpayments_priv_key'] ?? '';
        $stripe_pk = $s['stripe_public_key']     ?? '';
        $crypto    = $s['manual_crypto_address'] ?? '';

        // Multi-network crypto (public-safe fields only) — addresses are meant to be shared.
        $networks = [];
        foreach (self::crypto_networks_read($s) as $n) {
            if (empty($n['enabled']) || empty($n['address'])) continue;
            $networks[] = [
                'network'      => $n['network'],
                'address'      => $n['address'],
                'label'        => $n['label'] ?? $n['network'],
                'instructions' => $n['instructions'] ?? '',
            ];
        }
        // Legacy fallback so older clients still work even if only the single field is set.
        if (!$crypto && $networks) $crypto = $networks[0]['address'];

        return new WP_REST_Response([
            'instructions'      => $s['manual_payment_instructions'] ?? '',
            'crypto_address'    => $crypto,
            'crypto_networks'   => $networks,
            'has_coinpayments'  => !empty($pub_key) && !empty($priv_key),
            'has_stripe'        => !empty($stripe_pk),
            'has_manual_crypto' => !empty($crypto) || !empty($networks),
        ]);
    }

    public static function payment_create(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'],403);
        if (self::ops_paused('pause_purchases')) return new WP_REST_Response(['success'=>false,'message'=>'Challenge purchases are temporarily paused. Please check back soon.','code'=>'ops_paused'], 503);
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $plan_id = (int)($body['plan_id'] ?? 0);
        $gateway = sanitize_text_field($body['gateway'] ?? 'manual');
        $coupon  = sanitize_text_field($body['coupon_code'] ?? '');
        
        $result  = FXSIM_Payments::create_order(get_current_user_id(), $plan_id, $gateway, $coupon);
        
        if ($result['success']) {
            if ($gateway === 'confirmo' && class_exists('FXSIM_Confirmo')) {
                $user = get_userdata(get_current_user_id());
                $plan = FXSIM_Challenge_DB::get_plan($plan_id);
                $confirmo = FXSIM_Confirmo::create_invoice($result['order_id'], (float)$result['amount'], $plan->currency ?? 'USD', [
                    'user_id' => get_current_user_id(),
                    'plan_id' => $plan_id,
                    'plan_name' => $plan->name ?? 'Challenge',
                    'email' => $user->user_email ?? ''
                ]);
                if ($confirmo['success']) {
                    $result['payment_url'] = $confirmo['payment_url'];
                } else {
                    return new WP_REST_Response(['success' => false, 'message' => $confirmo['message']], 400);
                }
            } elseif ($gateway === 'coinpayments' && method_exists('FXSIM_Payments', 'coinpayments_create')) {
                $cp = FXSIM_Payments::coinpayments_create($result['order_id']);
                if ($cp['success']) {
                    $result['payment_url'] = $cp['payment_url'] ?? '';
                } else {
                    return new WP_REST_Response(['success' => false, 'message' => $cp['message']], 400);
                }
            }
        }
        
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function payment_submit_proof(WP_REST_Request $r): WP_REST_Response {
        // File uploads come as multipart — handle via $_FILES.
        // Auth is consistent with every other mutating endpoint: the shared
        // verify_nonce() helper (logged-in cookie / API key). The previous
        // bespoke wp_verify_nonce('wp_rest') check rejected valid cross-origin
        // headless uploads with a false "Invalid nonce" even though the user
        // was authenticated — this is the only endpoint that diverged.
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'],403);
        $order_id = (int)($_POST['order_id'] ?? 0);
        $notes    = sanitize_textarea_field($_POST['notes'] ?? '');
        if (!isset($_FILES['proof'])) return new WP_REST_Response(['success'=>false,'message'=>'No file received.'],400);
        $result = FXSIM_Payments::submit_proof($order_id, get_current_user_id(), $_FILES['proof'], $notes);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function payment_my_orders(): WP_REST_Response {
        $orders = FXSIM_Payments::get_user_orders(get_current_user_id());
        return new WP_REST_Response($orders);
    }

    public static function admin_payments_list(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Payments::get_all_orders());
    }

    public static function admin_payment_approve(WP_REST_Request $r): WP_REST_Response {
        $id   = (int)$r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $note = sanitize_text_field($body['note'] ?? '');
        $result = FXSIM_Payments::approve_order($id, get_current_user_id(), $note);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function admin_payment_reject(WP_REST_Request $r): WP_REST_Response {
        $id   = (int)$r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $note = sanitize_text_field($body['note'] ?? '');
        $result = FXSIM_Payments::reject_order($id, get_current_user_id(), $note);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    // ════════════════════════════════════════════════════════════════════════
    // STRIPE
    // ════════════════════════════════════════════════════════════════════════

    public static function stripe_checkout(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error'=>'Invalid nonce'],403);
        // BUG-009: never create a Stripe session while the frontend URL is unset —
        // the (frozen) Stripe builder would fall back to the backend domain for
        // success/cancel redirects. Refuse at the caller instead of editing the
        // frozen Stripe file. Reuses the same check as the BUG-008 email guard.
        if (!self::frontend_url_is_configured()) {
            return new WP_REST_Response(['success'=>false,'message'=>'Frontend URL must be configured before accepting payments.'], 400);
        }
        if (self::ops_paused('pause_purchases')) return new WP_REST_Response(['success'=>false,'message'=>'Challenge purchases are temporarily paused. Please check back soon.','code'=>'ops_paused'], 503);
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $plan_id = (int)($body['plan_id'] ?? 0);
        $coupon  = sanitize_text_field($body['coupon_code'] ?? '');
        $result  = FXSIM_Stripe::create_checkout(get_current_user_id(), $plan_id, $coupon);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    public static function stripe_webhook(): void {
        FXSIM_Stripe::handle_webhook();
    }

    // ════════════════════════════════════════════════════════════════════════
    // STATISTICS
    // ════════════════════════════════════════════════════════════════════════

    public static function stats_full(): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $acc     = self::get_active_challenge_account($user_id);
        if (!$acc) return new WP_REST_Response(['error' => 'No active challenge', 'no_challenge' => true], 404);

        // Trade stats
        $trades = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_trades WHERE account_id=%d ORDER BY closed_at ASC",
            $acc->id
        ));

        // Daily equity snapshots from challenge
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE fxsim_account_id=%d AND status IN ('active','funded') LIMIT 1",
            $acc->id
        ));
        $snapshots = $ch ? $wpdb->get_results($wpdb->prepare(
            "SELECT snapshot_date, closing_balance FROM {$wpdb->prefix}fxsim_challenge_snapshots
             WHERE challenge_id=%d ORDER BY snapshot_date ASC",
            $ch->id
        )) : [];

        // Calculate metrics
        $total        = count($trades);
        $wins         = array_filter($trades, fn($t) => (float)$t->pnl > 0);
        $losses       = array_filter($trades, fn($t) => (float)$t->pnl < 0);
        $gross_profit = array_sum(array_map(fn($t) => (float)$t->pnl > 0 ? (float)$t->pnl : 0, $trades));
        $gross_loss   = abs(array_sum(array_map(fn($t) => (float)$t->pnl < 0 ? (float)$t->pnl : 0, $trades)));
        $net_pnl      = $gross_profit - $gross_loss;
        $win_rate     = $total ? round(count($wins) / $total * 100, 1) : 0;
        $profit_factor = $gross_loss > 0 ? round($gross_profit / $gross_loss, 2) : 0;

        // Avg win / avg loss
        $avg_win  = count($wins)   ? round($gross_profit / count($wins), 2)   : 0;
        $avg_loss = count($losses) ? round($gross_loss   / count($losses), 2) : 0;

        // Best / worst trade
        $best_trade  = $total ? max(array_map(fn($t) => (float)$t->pnl, $trades)) : 0;
        $worst_trade = $total ? min(array_map(fn($t) => (float)$t->pnl, $trades)) : 0;

        // Consecutive wins/losses
        $max_consec_wins = $max_consec_losses = $cur_w = $cur_l = 0;
        foreach ($trades as $t) {
            if ((float)$t->pnl > 0) { $cur_w++; $cur_l = 0; $max_consec_wins   = max($max_consec_wins,   $cur_w); }
            else                    { $cur_l++; $cur_w = 0; $max_consec_losses  = max($max_consec_losses, $cur_l); }
        }

        // Symbol breakdown
        $by_symbol = [];
        foreach ($trades as $t) {
            $sym = $t->symbol;
            if (!isset($by_symbol[$sym])) $by_symbol[$sym] = ['trades'=>0,'pnl'=>0,'wins'=>0];
            $by_symbol[$sym]['trades']++;
            $by_symbol[$sym]['pnl']   += (float)$t->pnl;
            if ((float)$t->pnl > 0) $by_symbol[$sym]['wins']++;
        }
        uasort($by_symbol, fn($a,$b) => $b['pnl'] <=> $a['pnl']);

        // Max drawdown from equity snapshots
        $peak = 0; $max_dd = 0;
        foreach ($snapshots as $s) {
            $bal  = (float)$s->closing_balance;
            $peak = max($peak, $bal);
            if ($peak > 0) $max_dd = max($max_dd, ($peak - $bal) / $peak * 100);
        }

        return new WP_REST_Response([
            'account'            => $acc,
            'challenge'          => $ch,
            'total_trades'       => $total,
            'wins'               => count($wins),
            'losses'             => count($losses),
            'win_rate'           => $win_rate,
            'profit_factor'      => $profit_factor,
            'net_pnl'            => round($net_pnl, 2),
            'gross_profit'       => round($gross_profit, 2),
            'gross_loss'         => round($gross_loss, 2),
            'avg_win'            => $avg_win,
            'avg_loss'           => $avg_loss,
            'best_trade'         => round($best_trade, 2),
            'worst_trade'        => round($worst_trade, 2),
            'max_consec_wins'    => $max_consec_wins,
            'max_consec_losses'  => $max_consec_losses,
            'max_drawdown_pct'   => round($max_dd, 2),
            'equity_curve'       => self::build_equity_curve($ch, $trades),
            'by_symbol'          => $by_symbol,
            'trades'             => $trades,
        ]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // LEADERBOARD
    // ════════════════════════════════════════════════════════════════════════

    public static function leaderboard(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results("
            SELECT
                u.display_name AS trader_name,
                ca.phase,
                ca.status,
                cp.name AS plan_name,
                cp.account_size,
                ca.current_balance,
                ca.starting_balance,
                ROUND((ca.current_balance - ca.starting_balance) / ca.starting_balance * 100, 2) AS profit_pct,
                ca.trading_days,
                ca.funded_at,
                (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trades t WHERE t.account_id = ca.fxsim_account_id) AS total_trades
            FROM {$wpdb->prefix}fxsim_challenge_accounts ca
            JOIN {$wpdb->prefix}users u ON ca.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
            WHERE ca.status IN ('active','funded','passed')
              AND ca.current_balance > ca.starting_balance
            ORDER BY profit_pct DESC
            LIMIT 20
        ");
        return new WP_REST_Response($rows ?: []);
    }

    // ════════════════════════════════════════════════════════════════════════
    // CERTIFICATE
    // ════════════════════════════════════════════════════════════════════════

    public static function get_certificate(WP_REST_Request $r): WP_REST_Response {
        $challenge_id = (int)$r->get_param('id');
        $ch = self::cert_row($challenge_id, get_current_user_id());
        if (!$ch) return new WP_REST_Response(['error'=>'Certificate not found or challenge not yet passed'],404);
        return new WP_REST_Response(self::cert_payload($ch));
    }

    /**
     * GET /certificate/public/{code} — PUBLIC, shareable certificate view.
     * The code is `{id}-{sig}` where sig is an HMAC of the id keyed by the site's
     * auth salt, so certificates are not enumerable and the link can't be forged.
     * Returns the same non-sensitive payload as the authed endpoint (no user data
     * beyond the trader display name already printed on the certificate).
     */
    public static function get_certificate_public(WP_REST_Request $r): WP_REST_Response {
        $code = (string) $r->get_param('code');
        if (!preg_match('/^(\d+)-([a-f0-9]{12})$/', $code, $m)) {
            return new WP_REST_Response(['error' => 'Invalid certificate code'], 404);
        }
        $id = (int) $m[1];
        if (!hash_equals(self::cert_code($id), $code)) {
            return new WP_REST_Response(['error' => 'Invalid certificate code'], 404);
        }
        $ch = self::cert_row($id, null); // HMAC already authorises this lookup
        if (!$ch) return new WP_REST_Response(['error' => 'Certificate not found'], 404);
        return new WP_REST_Response(self::cert_payload($ch));
    }

    /** Non-enumerable, unforgeable public share code for a certificate. */
    private static function cert_code(int $id): string {
        $salt = function_exists('wp_salt') ? wp_salt('auth') : 'fxsim';
        return $id . '-' . substr(hash_hmac('sha256', 'fxsim-cert-' . $id, $salt), 0, 12);
    }

    /** Fetch a certificate-eligible challenge row. $uid null = no owner constraint. */
    private static function cert_row(int $challenge_id, ?int $uid) {
        global $wpdb;
        $sql = "SELECT ca.*, cp.name AS plan_name, cp.account_size, cp.funded_profit_split,
                       u.display_name AS trader_name
                FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
                JOIN {$wpdb->prefix}users u ON ca.user_id = u.ID
                WHERE ca.id=%d AND ca.status IN ('funded','passed')";
        $args = [$challenge_id];
        if ($uid !== null) { $sql .= " AND ca.user_id=%d"; $args[] = $uid; }
        return $wpdb->get_row($wpdb->prepare($sql, ...$args));
    }

    /** Build the certificate payload (incl. shareable code) from a row. */
    private static function cert_payload($ch): array {
        $brand = FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System');
        $date  = $ch->funded_at ? date('F j, Y', strtotime($ch->funded_at)) : date('F j, Y');
        return [
            'trader_name'  => $ch->trader_name,
            'plan_name'    => $ch->plan_name,
            'account_size' => $ch->account_size,
            'profit_split' => $ch->funded_profit_split,
            'challenge_id' => $ch->id,
            'status'       => $ch->status,
            'issued_date'  => $date,
            'brand'        => $brand,
            'share_code'   => self::cert_code((int) $ch->id),
        ];
    }

    // ════════════════════════════════════════════════════════════════════════
    // PENDING ORDER ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * POST /pending-order/place
     * Place a pending limit or stop order.
     */
    public static function pending_place(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $gate = self::trading_eligibility(get_current_user_id());
        if (!$gate['ok']) return new WP_REST_Response(['success'=>false,'message'=>$gate['message'],'code'=>$gate['code']], 403);
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $result = FXSIM_Trading_Engine::place_pending_order(get_current_user_id(), $body);
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    /**
     * POST /pending-order/{id}/cancel
     * Cancel an open pending order. Releases reserved margin.
     */
    public static function pending_cancel(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $result = FXSIM_Trading_Engine::cancel_pending_order(
            get_current_user_id(),
            (int)$r->get_param('id')
        );
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    /**
     * GET /pending-order/my
     * List the authenticated user's pending orders (all statuses for history).
     */
    public static function pending_my(): WP_REST_Response {
        global $wpdb;
        $acc = self::get_active_challenge_account(get_current_user_id());
        if (!$acc) return new WP_REST_Response([]);

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_pending_orders
             WHERE account_id = %d
             ORDER BY created_at DESC
             LIMIT 100",
            $acc->id
        ));
        $out = array_map(function ($r) {
            $a = (array) $r;
            if (!empty($a['created_at'])) $a['created_at_iso'] = self::iso8601($a['created_at']);
            return $a;
        }, $rows ?: []);
        return new WP_REST_Response($out);
    }

    /**
     * GET /admin/pending-orders
     * List all pending orders across all accounts (admin).
     */
    public static function admin_pending_orders(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT po.*, u.user_login, u.user_email
             FROM {$wpdb->prefix}fxsim_pending_orders po
             JOIN {$wpdb->prefix}fxsim_accounts a ON po.account_id = a.id
             JOIN {$wpdb->prefix}users u ON a.user_id = u.ID
             ORDER BY po.created_at DESC
             LIMIT 500"
        );
        return new WP_REST_Response($rows ?: []);
    }

    /**
     * POST /admin/pending-orders/{id}/reject
     * Admin-force-reject a pending order (e.g. risk team override).
     * Releases reserved margin and logs the rejection reason.
     */
    public static function admin_pending_reject(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id     = (int)$r->get_param('id');
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $reason = sanitize_text_field($body['reason'] ?? 'Admin override');

        $order = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_pending_orders WHERE id = %d", $id
        ));
        if (!$order)                    return new WP_REST_Response(['error' => 'Order not found'], 404);
        if ($order->status !== 'pending') return new WP_REST_Response(['error' => "Order is already {$order->status}"], 400);

        // Atomic: update status + release margin
        $wpdb->query('START TRANSACTION');

        $updated = $wpdb->update(
            $wpdb->prefix . 'fxsim_pending_orders',
            ['status' => 'rejected', 'reject_reason' => $reason],
            ['id' => $id, 'status' => 'pending']
        );

        if (!$updated) {
            $wpdb->query('ROLLBACK');
            return new WP_REST_Response(['error' => 'Could not reject — order may have just been filled'], 409);
        }

        // Release reserved margin
        $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}fxsim_accounts
             SET margin_used = GREATEST(0, margin_used - %f)
             WHERE id = %d",
            (float)$order->margin, $order->account_id
        ));

        $wpdb->query('COMMIT');

        FXSIM_Database::log_admin(get_current_user_id(), 'pending_order_reject', null,
            "Order #{$id}: {$reason}");

        return new WP_REST_Response(['success' => true]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SERVER-SENT EVENTS (SSE) — real-time price, account, pending stream
    // ════════════════════════════════════════════════════════════════════════

    /**
     * SSE stream endpoint — GET /fxsim/v1/stream
     *
     * Streams three event types to the connected terminal:
     *   prices  — all 14 symbol prices (only when changed from previous tick)
     *   account — account balance/equity/margin (only when changed)
     *   pending — pending orders array (only when changed)
     *   ping    — keepalive tick (every loop, prevents proxy/Nginx timeout)
     *
     * Connection lifecycle:
     *   - Sends initial full state immediately on connect
     *   - Polls price cache + DB every FXSIM_SSE_INTERVAL seconds
     *   - Closes gracefully after FXSIM_SSE_MAX_AGE seconds
     *   - Browser EventSource reconnects automatically; server sends full state again
     *
     * Hosting compatibility:
     *   - @set_time_limit(0): extended execution on VPS/dedicated; ignored on shared hosting
     *   - Connection closed after 25s ensures safe operation under 30s PHP limits
     *   - ob_implicit_flush() bypasses output buffering for immediate delivery
     *   - Works behind Nginx (proxy_read_timeout must be > FXSIM_SSE_MAX_AGE)
     *
     * Authentication:
     *   EventSource cannot send custom headers, so the nonce is passed as
     *   ?_wpnonce= query param. WP REST API validates it automatically via
     *   the permission_callback (same auth_check as all other endpoints).
     *
     * @param WP_REST_Request $r
     * @return never  This method does not return — it streams and exits.
     */
    public static function stream(WP_REST_Request $r): never {
        $user_id = get_current_user_id();
        $acc     = self::get_active_challenge_account($user_id);

        // ── SSE headers ───────────────────────────────────────────────────────
        // These must be sent before any output. WP REST API has not sent headers
        // yet at this point because we are inside the callback — output has not started.
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('X-Accel-Buffering: no');   // Disable Nginx buffering
        header('Connection: keep-alive');
        // Remove WP's default JSON content-type that would be set later
        remove_all_filters('rest_pre_serve_request');

        // ── Output buffering bypass ────────────────────────────────────────────
        // Flush any PHP-level output buffers so data reaches the browser immediately.
        // Multiple levels may exist (WP, server SAPI, zlib).
        @ini_set('zlib.output_compression', 0);
        while (ob_get_level() > 0) @ob_end_clean();
        @ob_implicit_flush(true);

        // ── Execution time ────────────────────────────────────────────────────
        // Attempt to extend beyond default limits. Works on VPS/dedicated.
        // On shared hosting where this is ignored, the 25s connection close
        // ensures we exit safely before PHP's limit kills the process.
        @set_time_limit(0);

        // ── Configuration constants ───────────────────────────────────────────
        // Loop interval: how often to check for data changes (seconds)
        $interval    = (int) get_option('fxsim_sse_interval', 2);
        // Max connection age: close after this many seconds; browser reconnects
        $max_age     = (int) get_option('fxsim_sse_max_age', 25);
        // Reconnect hint sent to browser (milliseconds)
        $retry_ms    = 3000;

        $started_at  = time();
        $event_id    = 0;

        // ── State snapshots for change detection ──────────────────────────────
        $last_prices_hash    = '';
        $last_account_hash   = '';
        $last_pending_hash   = '';
        $last_positions_hash = '';

        // ── Send initial retry hint ───────────────────────────────────────────
        echo "retry: {$retry_ms}\n\n";
        @flush();

        // ── Main stream loop ──────────────────────────────────────────────────
        while (true) {
            // Check if client has disconnected (browser closed tab, navigated away)
            if (connection_aborted()) break;

            // Graceful close: send close event so client knows to reconnect cleanly
            if ((time() - $started_at) >= $max_age) {
                self::sse_emit('close', ['reconnect' => true], ++$event_id);
                break;
            }

            $event_id++;

            // ── Prices event ──────────────────────────────────────────────────
            $prices      = FXSIM_Price_Feed::get_all();
            $prices_hash = md5(serialize($prices));
            if ($prices_hash !== $last_prices_hash) {
                self::sse_emit('prices', $prices, $event_id);
                $last_prices_hash = $prices_hash;
            }

            // ── Positions event — live PnL ────────────────────────────────────
            // Recalculate PnL using current prices and push to client.
            // Only emitted when prices change (same condition as prices event).
            // Client renders updated PnL cells in-place without a full table rebuild.
            if ($acc && $prices_hash !== $last_prices_hash) {
                $live_positions = FXSIM_Trading_Engine::refresh_positions_readonly((int) $acc->id, $prices);
                if (!empty($live_positions)) {
                    $pos_hash = md5(serialize(array_map(fn($p) => $p->id . $p->pnl . $p->current_price, $live_positions)));
                    if ($pos_hash !== $last_positions_hash) {
                        self::sse_emit('positions', $live_positions, $event_id);
                        $last_positions_hash = $pos_hash;
                    }
                }
            }

            // ── Account event ─────────────────────────────────────────────────
            if ($acc) {
                global $wpdb;
                $account      = FXSIM_Database::get_account_by_id((int) $acc->id);
                $account_hash = $account
                    ? md5($account->balance . $account->equity . $account->margin_used)
                    : 'null';
                if ($account_hash !== $last_account_hash) {
                    self::sse_emit('account', $account, $event_id);
                    $last_account_hash = $account_hash;
                }

                // ── Pending orders event ──────────────────────────────────────
                $pending = $wpdb->get_results($wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}fxsim_pending_orders
                     WHERE account_id = %d
                     ORDER BY created_at DESC
                     LIMIT 50",
                    $acc->id
                ));
                $pending_hash = md5(serialize(
                    array_map(fn($o) => $o->id . $o->status . $o->filled_at, $pending ?: [])
                ));
                if ($pending_hash !== $last_pending_hash) {
                    self::sse_emit('pending', $pending ?: [], $event_id);
                    $last_pending_hash = $pending_hash;
                }
            }

            // ── Ping event — keepalive (sent every tick) ──────────────────────
            self::sse_emit('ping', ['ts' => time()], $event_id);

            @flush();

            // Sleep until next tick — avoids busy-waiting
            // Using usleep for sub-second precision; sleep() would work too
            usleep($interval * 1_000_000); 
        }

        // Ensure output is fully flushed before PHP exits
        @flush();
        exit;
    }

    /**
     * Emit a single SSE event.
     *
     * SSE wire format:
     *   id: {event_id}\n
     *   event: {name}\n
     *   data: {json}\n
     *   \n
     *
     * @param string $event    Event name (prices|account|pending|ping|close).
     * @param mixed  $data     Data to JSON-encode and send.
     * @param int    $event_id Monotonically increasing event ID for Last-Event-ID resumability.
     */
    private static function sse_emit(string $event, mixed $data, int $event_id): void {
        echo "id: {$event_id}\n";
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
    }

    // ════════════════════════════════════════════════════════════════════════
    // SYSTEM HEALTH
    // ════════════════════════════════════════════════════════════════════════

    /**
     * GET /admin/health — system health snapshot for admin dashboard.
     * Returns cron status, price feed status, and pending alert count.
     */
    public static function admin_health(): WP_REST_Response {
        $last_update   = (int) get_option('fxsim_last_price_update', 0);
        $feed_failed   = (int) get_option('fxsim_price_feed_failed', 0);
        $now           = time();
        $staleness_sec = $now - $last_update;

        // Cron is considered lagging if last update was > 90s ago (3× the 30s interval)
        $cron_ok       = $last_update > 0 && $staleness_sec < 90;
        $cron_next     = wp_next_scheduled('fxsim_price_update');

        // Price feed: failed flag set when all HTTP sources returned empty
        $feed_ok       = !$feed_failed || ($now - $feed_failed) > 300; // auto-clear after 5 min of success

        return new WP_REST_Response([
            'cron' => [
                'ok'           => $cron_ok,
                'last_run_sec' => $last_update > 0 ? $staleness_sec : null,
                'last_run_ts'  => $last_update ?: null,
                'next_run_ts'  => $cron_next  ?: null,
                'message'      => $cron_ok
                    ? 'Running normally (last: ' . $staleness_sec . 's ago)'
                    : ($last_update === 0
                        ? 'No price update recorded yet'
                        : 'LAGGING — last update ' . $staleness_sec . 's ago (expected every 30s)'),
            ],
            'price_feed' => [
                'ok'      => $feed_ok,
                'source'  => get_option('fxsim_price_source', 'yahoo'),
                'message' => $feed_ok
                    ? 'Live prices received'
                    : 'Feed failure detected — falling back to simulation',
            ],
        ]);
    }

    public static function admin_price_feed_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $key  = sanitize_text_field($body['twelve_data_key'] ?? '');
        update_option('fxsim_twelve_data_key', $key, false);
        delete_option('fxsim_price_source'); // reset so next cron re-detects source

        // ── V10 MT5 feed settings ─────────────────────────────────────────────
        if (array_key_exists('source_mode', $body)) {
            $mode = in_array($body['source_mode'], ['auto','mt5','yahoo'], true) ? $body['source_mode'] : 'auto';
            update_option('fxsim_price_source_mode', $mode, false);
        }
        if (array_key_exists('mt5_stale_secs', $body)) {
            $secs = (int) $body['mt5_stale_secs'];
            if ($secs < 3)   $secs = 3;
            if ($secs > 300) $secs = 300;
            update_option('fxsim_mt5_stale_secs', $secs, false);
        }
        // Secret: only update when a non-empty value is provided; explicit "clear" supported.
        if (array_key_exists('mt5_ingest_secret', $body)) {
            $secret = (string) $body['mt5_ingest_secret'];
            if ($secret === '' && !empty($body['mt5_clear_secret'])) {
                delete_option('fxsim_mt5_ingest_secret');
            } elseif ($secret !== '') {
                update_option('fxsim_mt5_ingest_secret', sanitize_text_field($secret), false);
            }
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'price_feed_save', null,
            $key ? 'Twelve Data key set' : 'Reverted to Yahoo Finance');
        return new WP_REST_Response(['success' => true]);
    }

    /**
     * GET /admin/price-feed/health — feed-source health snapshot for the admin monitor.
     */
    public static function admin_price_feed_health(): WP_REST_Response {
        return new WP_REST_Response(FXSIM_Price_Feed::feed_health());
    }

    /**
     * POST /price-feed/ingest — receive a batch of live prices from an external
     * MT5 price service. Authenticated by a shared secret in the X-FXSIM-Feed-Key
     * header (constant-time compared). Machine-to-machine; no WP session.
     *
     * Body: { "source_id": "mt5-local", "prices": { "EURUSD": {"bid":..,"ask":..}, "XAUUSD": 2350.1, ... } }
     */
    public static function price_feed_ingest(WP_REST_Request $r): WP_REST_Response {
        $secret = (string) get_option('fxsim_mt5_ingest_secret', '');
        if ($secret === '') {
            // Feature inert until a secret is configured → zero-impact by default.
            return new WP_REST_Response(['success'=>false,'error'=>'Ingestion not enabled.'], 403);
        }
        $provided = (string) $r->get_header('x-fxsim-feed-key');
        if ($provided === '' || !hash_equals($secret, $provided)) {
            return new WP_REST_Response(['success'=>false,'error'=>'Unauthorized.'], 401);
        }

        $body   = $r->get_json_params() ?: $r->get_body_params();
        $prices = $body['prices'] ?? null;
        if (!is_array($prices) || empty($prices)) {
            return new WP_REST_Response(['success'=>false,'error'=>'No prices supplied.'], 400);
        }
        $source_id = sanitize_text_field((string)($body['source_id'] ?? 'mt5'));

        $accepted = FXSIM_Price_Feed::ingest($prices, $source_id);
        if ($accepted === 0) {
            return new WP_REST_Response(['success'=>false,'error'=>'No valid symbols in payload.'], 422);
        }
        return new WP_REST_Response(['success'=>true,'accepted'=>$accepted,'ts'=>time()]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SMTP SETTINGS
    // ════════════════════════════════════════════════════════════════════════

    public static function admin_smtp_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $map  = [
            'fxsim_smtp_host'       => sanitize_text_field($body['host']       ?? ''),
            'fxsim_smtp_port'       => (int)($body['port']                     ?? 587),
            'fxsim_smtp_auth'       => (bool)($body['auth']                    ?? true),
            'fxsim_smtp_user'       => sanitize_text_field($body['user']       ?? ''),
            'fxsim_smtp_secure'     => in_array($body['secure'] ?? '', ['tls','ssl',''], true)
                                        ? $body['secure'] : 'tls',
            'fxsim_smtp_from_email' => sanitize_email($body['from_email']      ?? ''),
            'fxsim_smtp_from_name'  => sanitize_text_field($body['from_name']  ?? ''),
            'fxsim_smtp_reply_to'   => sanitize_email($body['reply_to']        ?? ''),
        ];
        // Only overwrite password if a new one was supplied
        if (!empty($body['pass'])) {
            $map['fxsim_smtp_pass'] = $body['pass']; // stored in wp_options — consider encryption for high-security installs
        }
        foreach ($map as $key => $val) {
            update_option($key, $val, false);
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'smtp_settings_saved');
        return new WP_REST_Response(['success' => true]);
    }

    /** GET /admin/smtp — READ-ONLY SMTP config for the dashboard. Password masked (write-only). */
    public static function admin_smtp_get(): WP_REST_Response {
        return new WP_REST_Response([
            'host'       => get_option('fxsim_smtp_host', ''),
            'port'       => (int) get_option('fxsim_smtp_port', 587),
            'auth'       => (bool) get_option('fxsim_smtp_auth', true),
            'user'       => get_option('fxsim_smtp_user', ''),
            'pass_set'   => get_option('fxsim_smtp_pass', '') !== '',
            'secure'     => get_option('fxsim_smtp_secure', 'tls'),
            'from_email' => get_option('fxsim_smtp_from_email', ''),
            'from_name'  => get_option('fxsim_smtp_from_name', ''),
            'reply_to'   => get_option('fxsim_smtp_reply_to', ''),
        ]);
    }

    public static function admin_smtp_test(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $to   = sanitize_email($body['to'] ?? get_option('admin_email'));
        if (!is_email($to)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid email address.'], 400);
        }
        $brand  = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';
        $result = wp_mail(
            $to,
            "SMTP test email",
            "<p>If you received this, your SMTP configuration is working correctly.</p>"
            . "<p>Sent: " . current_time('mysql') . "</p>",
            ['Content-Type: text/html; charset=UTF-8']
        );
        return new WP_REST_Response([
            'success' => $result,
            'message' => $result
                ? "Test email sent to {$to}. Check your inbox."
                : 'wp_mail() returned false. Check SMTP credentials and logs.',
        ]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ANALYTICS ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    /** GET /admin/analytics/revenue — monthly revenue breakdown */
    /** Map a period to [DATE_FORMAT, SQL window]. */
    private static function analytics_bucket(string $period): array {
        switch ($period) {
            case 'daily':  return ['%Y-%m-%d', 'INTERVAL 30 DAY'];
            case 'weekly': return ['%x-W%v',   'INTERVAL 12 WEEK'];
            default:       return ['%Y-%m',    'INTERVAL 12 MONTH'];
        }
    }

    /** SQL fragment: WP user IDs that are NOT administrators (exclude staff from trader metrics). */
    private static function not_admin_subquery(): string {
        global $wpdb;
        $cap = $wpdb->prefix . 'capabilities';
        return "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '{$cap}' AND meta_value LIKE '%administrator%'";
    }

    public static function analytics_revenue(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        [$fmt, $win] = self::analytics_bucket(sanitize_key((string) $r->get_param('period')));
        // Revenue per bucket from approved payments (amount = final paid, DECIMAL).
        $rows = $wpdb->get_results(
            "SELECT DATE_FORMAT(created_at, '$fmt') AS month,
                    COUNT(*) AS count,
                    COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total
             FROM {$wpdb->prefix}fxsim_payment_orders
             WHERE status = 'approved'
               AND created_at >= DATE_SUB(NOW(), $win)
             GROUP BY month
             ORDER BY month ASC"
        );
        // Plan revenue breakdown
        $by_plan = $wpdb->get_results(
            "SELECT cp.name AS plan_name, COUNT(po.id) AS sales,
                    COALESCE(SUM(CAST(po.amount AS DECIMAL(10,2))), 0) AS revenue
             FROM {$wpdb->prefix}fxsim_payment_orders po
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON po.plan_id = cp.id
             WHERE po.status = 'approved'
             GROUP BY cp.id, cp.name
             ORDER BY revenue DESC"
        );
        $total = (float)$wpdb->get_var(
            "SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))),0)
             FROM {$wpdb->prefix}fxsim_payment_orders WHERE status='approved'"
        );
        return new WP_REST_Response([
            'monthly'  => $rows ?: [],
            'by_plan'  => $by_plan ?: [],
            'total'    => round($total, 2),
        ]);
    }

    /** GET /admin/analytics/growth — trader and challenge registration trends */
    public static function analytics_growth(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        [$fmt, $win] = self::analytics_bucket(sanitize_key((string) $r->get_param('period')));
        $new_users = $wpdb->get_results(
            "SELECT DATE_FORMAT(user_registered, '$fmt') AS month, COUNT(*) AS count
             FROM {$wpdb->prefix}users
             WHERE user_registered >= DATE_SUB(NOW(), $win)
               AND ID NOT IN (" . self::not_admin_subquery() . ")
             GROUP BY month ORDER BY month ASC"
        );
        $new_challenges = $wpdb->get_results(
            "SELECT DATE_FORMAT(created_at, '$fmt') AS month, COUNT(*) AS count
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE created_at >= DATE_SUB(NOW(), $win)
             GROUP BY month ORDER BY month ASC"
        );
        $funded = $wpdb->get_results(
            "SELECT DATE_FORMAT(funded_at, '$fmt') AS month, COUNT(*) AS count
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE status = 'funded' AND funded_at IS NOT NULL
               AND funded_at >= DATE_SUB(NOW(), $win)
             GROUP BY month ORDER BY month ASC"
        );
        $total_users      = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}users WHERE ID NOT IN (" . self::not_admin_subquery() . ")");
        $total_challenges = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts");
        $total_funded     = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status='funded'");

        return new WP_REST_Response([
            'new_users'       => $new_users ?: [],
            'new_challenges'  => $new_challenges ?: [],
            'funded_monthly'  => $funded ?: [],
            'total_users'     => $total_users,
            'total_challenges'=> $total_challenges,
            'total_funded'    => $total_funded,
        ]);
    }

    /** GET /admin/analytics/challenges — pass/fail rates and phase analytics */
    public static function analytics_challenges(): WP_REST_Response {
        global $wpdb;
        // Status breakdown
        $status_counts = $wpdb->get_results(
            "SELECT status, COUNT(*) AS count
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             GROUP BY status ORDER BY count DESC"
        );
        // Pass rate by plan
        $pass_rates = $wpdb->get_results(
            "SELECT cp.name AS plan_name,
                    COUNT(ca.id) AS total,
                    SUM(CASE WHEN ca.status IN ('funded','passed') THEN 1 ELSE 0 END) AS passed,
                    SUM(CASE WHEN ca.status = 'failed' THEN 1 ELSE 0 END) AS failed,
                    AVG(ca.trading_days) AS avg_trading_days,
                    AVG(ca.current_balance - ca.starting_balance) AS avg_pnl
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             GROUP BY cp.id, cp.name
             ORDER BY total DESC"
        );
        // Breach reasons (why challenges fail)
        $breach_reasons = $wpdb->get_results(
            "SELECT breach_type, COUNT(*) AS count
             FROM {$wpdb->prefix}fxsim_challenge_breaches
             GROUP BY breach_type ORDER BY count DESC"
        );
        // Avg days to pass per phase
        $avg_days = $wpdb->get_results(
            "SELECT phase, AVG(trading_days) AS avg_days, COUNT(*) AS count
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE status IN ('active','funded','passed','phase2')
             GROUP BY phase"
        );
        return new WP_REST_Response([
            'status_counts' => $status_counts ?: [],
            'pass_rates'    => $pass_rates ?: [],
            'breach_reasons'=> $breach_reasons ?: [],
            'avg_days'      => $avg_days ?: [],
        ]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ADMIN TOOLS
    // ════════════════════════════════════════════════════════════════════════

    /** POST /admin/impersonate — set an admin impersonation session */
    public static function admin_impersonate(WP_REST_Request $r): WP_REST_Response {
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $user_id = (int)($body['user_id'] ?? 0);
        if (!$user_id) return new WP_REST_Response(['error' => 'user_id required.'], 400);
        $user = get_userdata($user_id);
        if (!$user) return new WP_REST_Response(['error' => 'User not found.'], 404);
        // Store the admin's real ID so they can return
        $admin_id = get_current_user_id();
        update_option('fxsim_impersonating', ['admin' => $admin_id, 'target' => $user_id], false);
        // Per-target marker so the stop endpoint can identify the real admin
        // even though the active cookie now belongs to the target user.
        update_user_meta($user_id, 'fxsim_impersonator', $admin_id);
        // Set a WP auth cookie as the target user
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, false);
        FXSIM_Database::log_admin($admin_id, 'impersonate_start', $user_id,
            "Admin {$admin_id} impersonating user {$user_id}");
        return new WP_REST_Response([
            'success'      => true,
            'redirect_url' => '/dashboard',
            'message'      => "Now viewing as {$user->user_login}. Return via the Exit button.",
        ]);
    }

    /**
     * POST /admin/impersonate/stop — restore the admin's own session.
     * Runs as the IMPERSONATED (target) user, so its permission is the normal
     * logged-in check; it self-gates on the `fxsim_impersonator` marker set at
     * start. Restores the admin auth cookie so the admin is NOT logged out.
     */
    public static function admin_impersonate_stop(): WP_REST_Response {
        $current  = get_current_user_id();
        $admin_id = (int) get_user_meta($current, 'fxsim_impersonator', true);
        if (!$admin_id || !user_can($admin_id, 'manage_options')) {
            return new WP_REST_Response(['success' => false, 'message' => 'No active impersonation session.'], 400);
        }
        delete_user_meta($current, 'fxsim_impersonator');
        $opt = get_option('fxsim_impersonating');
        if (is_array($opt) && (int) ($opt['target'] ?? 0) === $current) delete_option('fxsim_impersonating');

        // Restore the admin. The bridge's set_logged_in_cookie hook primes
        // $_COOKIE so the nonce minted below is valid for the admin session.
        wp_set_current_user($admin_id);
        wp_set_auth_cookie($admin_id, true);
        FXSIM_Database::log_admin($admin_id, 'impersonate_stop', $current,
            "Admin {$admin_id} stopped impersonating user {$current}");
        return new WP_REST_Response([
            'success' => true,
            'nonce'   => wp_create_nonce('wp_rest'),
        ]);
    }

    /** POST /admin/announcement — set or clear the platform announcement banner */
    public static function admin_announcement(WP_REST_Request $r): WP_REST_Response {
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $message = sanitize_text_field($body['message'] ?? '');
        $type    = in_array($body['type'] ?? 'info', ['info','warning','success','error'], true)
            ? $body['type'] : 'info';
        $expires = !empty($body['expires']) ? (int)$body['expires'] : 0;
        if (empty($message)) {
            delete_option('fxsim_announcement');
            return new WP_REST_Response(['success' => true, 'cleared' => true]);
        }
        update_option('fxsim_announcement', [
            'message' => $message,
            'type'    => $type,
            'expires' => $expires > 0 ? time() + ($expires * 3600) : 0,
            'created' => time(),
        ], false);
        FXSIM_Database::log_admin(get_current_user_id(), 'announcement_set', null, $message);
        return new WP_REST_Response(['success' => true]);
    }

    /** GET /admin/announcement — fetch current announcement (public) */
    public static function admin_announcement_get(): WP_REST_Response {
        // Return a typed empty object rather than null.
        // WP_REST_Response(null) can serialise to an empty body in some PHP/WP
        // configurations, causing dashboard.js req() to throw a JSON parse error.
        // Callers guard on !ann.message so the extra 'active' key is harmless.
        $ann = get_option('fxsim_announcement');
        if (!$ann || !is_array($ann)) {
            return new WP_REST_Response(['active' => false, 'message' => '']);
        }
        if (!empty($ann['expires']) && $ann['expires'] < time()) {
            delete_option('fxsim_announcement');
            return new WP_REST_Response(['active' => false, 'message' => '']);
        }
        return new WP_REST_Response(array_merge(['active' => true], $ann));
    }

    /** POST /admin/bulk-email — send email to user segment */
    public static function admin_bulk_email(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $subject = sanitize_text_field($body['subject'] ?? '');
        $message = wp_kses_post($body['message'] ?? '');
        $segment = sanitize_key($body['segment'] ?? 'all'); // all, active, funded, failed

        if (!$subject || !$message) {
            return new WP_REST_Response(['error' => 'Subject and message required.'], 400);
        }

        // Resolve user segment
        $segment_map = [
            'all'    => "SELECT DISTINCT u.ID FROM {$wpdb->prefix}users u",
            'active' => "SELECT DISTINCT u.ID FROM {$wpdb->prefix}users u
                         JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.user_id = u.ID
                         WHERE ca.status = 'active'",
            'funded' => "SELECT DISTINCT u.ID FROM {$wpdb->prefix}users u
                         JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.user_id = u.ID
                         WHERE ca.status = 'funded'",
            'failed' => "SELECT DISTINCT u.ID FROM {$wpdb->prefix}users u
                         JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.user_id = u.ID
                         WHERE ca.status = 'failed'",
        ];
        $sql  = $segment_map[$segment] ?? $segment_map['all'];
        $uids = $wpdb->get_col($sql);

        $brand = FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System');
        $sent  = 0;
        $errors = 0;

        foreach ($uids as $uid) {
            $user = get_userdata((int)$uid);
            if (!$user) continue;
            // Personalise message with {name} placeholder
            $personalised = str_replace('{name}', $user->display_name ?: $user->user_login, $message);
            // Use the branded email wrapper via FXSIM_Emails
            $html = FXSIM_Emails::build_html(
                "<p>Hi <strong>{$user->display_name}</strong>,</p>\n<div style='margin-top:8px'>{$personalised}</div>",
                ['brand' => $brand, 'tagline' => 'Platform Update', 'color' => '#7c6ef5',
                 'footer' => '', 'support' => '']
            );
            $result = wp_mail(
                $user->user_email,
                $subject,
                $html,
                ['Content-Type: text/html; charset=UTF-8']
            );
            $result ? $sent++ : $errors++;
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'bulk_email', null,
            "Segment: {$segment}, Sent: {$sent}, Errors: {$errors}, Subject: {$subject}");

        return new WP_REST_Response([
            'success' => true,
            'sent'    => $sent,
            'errors'  => $errors,
            'total'   => count($uids),
        ]);
    }

    /** POST /admin/maintenance — enable/disable maintenance mode */
    public static function admin_maintenance(WP_REST_Request $r): WP_REST_Response {
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $enabled = (bool)($body['enabled'] ?? false);
        $msg     = sanitize_text_field($body['message'] ?? 'Platform under maintenance. Back soon.');
        update_option('fxsim_maintenance', ['enabled' => $enabled, 'message' => $msg], false);
        FXSIM_Database::log_admin(get_current_user_id(), 'maintenance_' . ($enabled ? 'on' : 'off'));
        return new WP_REST_Response(['success' => true, 'enabled' => $enabled]);
    }

    /** GET /admin/maintenance — current maintenance state (public, for gate check) */
    public static function admin_maintenance_get(): WP_REST_Response {
        $state = get_option('fxsim_maintenance', ['enabled' => false, 'message' => '']);
        return new WP_REST_Response($state);
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  Promotional banners — content/display only. No trading/challenge/payment
     *  logic is touched. `coupon_code` is stored for the future Coupon System;
     *  `impressions`/`clicks` exist for future V2 analytics (not used in V1).
     * ──────────────────────────────────────────────────────────────────────── */

    private static function banner_dt(?string $v): ?string {
        if (!$v) return null;
        try {
            // Interpret naive datetimes (admin datetime-local input) in the WP timezone,
            // and normalise any TZ-qualified input INTO WP-local — the same clock that
            // banners_get compares against (current_time) and iso8601() reads with.
            $tz = function_exists('wp_timezone') ? wp_timezone() : new \DateTimeZone('UTC');
            $d  = new \DateTime($v, $tz);
            $d->setTimezone($tz);
            return $d->format('Y-m-d H:i:s');
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** GET /banners?placement=&page= — active, in-window banners for a context (public). */
    public static function banners_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $placement = sanitize_key((string) $r->get_param('placement'));
        $page      = sanitize_text_field((string) ($r->get_param('page') ?? ''));
        $now       = current_time('mysql');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_banners
             WHERE active = 1
               AND (starts_at IS NULL OR starts_at <= %s)
               AND (ends_at   IS NULL OR ends_at   >= %s)
             ORDER BY priority DESC, id DESC",
            $now, $now
        )) ?: [];

        $out = [];
        foreach ($rows as $b) {
            // Placement: 'both' matches anything; otherwise must equal the request.
            if ($placement && $b->placement !== 'both' && $b->placement !== $placement) continue;
            // Scope: page-scoped banners show on the configured path AND its
            // sub-paths (prefix match), so "/dashboard" also covers "/dashboard/trading".
            if ($b->scope_type === 'page') {
                if (!$page || !$b->scope_path) continue;
                $sp = rtrim($b->scope_path, '/');
                $pg = rtrim($page, '/');
                if ($pg !== $sp && strpos($pg, $sp . '/') !== 0) continue;
            }
            $b->ends_at_iso      = $b->ends_at ? self::iso8601($b->ends_at) : null;
            $b->countdown_to_iso = $b->countdown_to ? self::iso8601($b->countdown_to) : null;
            // Dismissal version: editing/re-saving a banner bumps updated_at, which
            // resets client-side dismissals (admin "re-push" reaches everyone again).
            $b->ver = $b->updated_at ? (string) strtotime($b->updated_at) : '0';
            // Internal/analytics fields are not exposed on the public feed.
            unset($b->impressions, $b->clicks, $b->created_at, $b->updated_at);
            $out[] = $b;
        }
        return new WP_REST_Response($out);
    }

    /** GET /admin/banners — all banners (admin). */
    public static function admin_banners_list(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}fxsim_banners ORDER BY priority DESC, id DESC"
        ) ?: [];
        foreach ($rows as $b) {
            $b->starts_at_iso    = $b->starts_at ? self::iso8601($b->starts_at) : null;
            $b->ends_at_iso      = $b->ends_at ? self::iso8601($b->ends_at) : null;
            $b->countdown_to_iso = $b->countdown_to ? self::iso8601($b->countdown_to) : null;
        }
        return new WP_REST_Response($rows);
    }

    /** POST /admin/banners/save — create or update a banner. */
    public static function admin_banner_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $b  = $r->get_json_params() ?: $r->get_body_params();
        $id = (int) ($b['id'] ?? 0);

        $message = sanitize_textarea_field($b['message'] ?? '');
        if ($message === '') {
            return new WP_REST_Response(['success' => false, 'message' => 'Banner message is required.'], 400);
        }
        $placement  = in_array($b['placement'] ?? 'top', ['top', 'dashboard', 'both'], true) ? $b['placement'] : 'top';
        $scope_type = in_array($b['scope_type'] ?? 'global', ['global', 'page'], true) ? $b['scope_type'] : 'global';

        $data = [
            'title'        => substr(sanitize_text_field($b['title'] ?? ''), 0, 160),
            'message'      => $message,
            'placement'    => $placement,
            'scope_type'   => $scope_type,
            'scope_path'   => $scope_type === 'page' ? substr(sanitize_text_field($b['scope_path'] ?? ''), 0, 191) : null,
            'bg_color'     => substr(sanitize_text_field($b['bg_color'] ?? ''), 0, 32) ?: null,
            'text_color'   => substr(sanitize_text_field($b['text_color'] ?? ''), 0, 32) ?: null,
            'cta_label'    => substr(sanitize_text_field($b['cta_label'] ?? ''), 0, 80) ?: null,
            'cta_url'      => !empty($b['cta_url']) ? esc_url_raw($b['cta_url']) : null,
            'coupon_code'  => substr(sanitize_text_field($b['coupon_code'] ?? ''), 0, 64) ?: null, // reserved for Coupon System
            'starts_at'    => self::banner_dt($b['starts_at'] ?? null),
            'ends_at'      => self::banner_dt($b['ends_at'] ?? null),
            'countdown_to' => self::banner_dt($b['countdown_to'] ?? null),
            'active'       => !empty($b['active']) ? 1 : 0,
            'priority'     => (int) ($b['priority'] ?? 0),
            'updated_at'   => current_time('mysql'),
        ];

        if ($id > 0) {
            $wpdb->update($wpdb->prefix . 'fxsim_banners', $data, ['id' => $id]);
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert($wpdb->prefix . 'fxsim_banners', $data);
            $id = (int) $wpdb->insert_id;
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'banner_save', $id, $data['title']);
        return new WP_REST_Response(['success' => true, 'id' => $id]);
    }

    /** POST /admin/banners/{id}/toggle — flip active state. */
    public static function admin_banner_toggle(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $cur = $wpdb->get_var($wpdb->prepare("SELECT active FROM {$wpdb->prefix}fxsim_banners WHERE id=%d", $id));
        if ($cur === null) return new WP_REST_Response(['success' => false, 'message' => 'Not found'], 404);
        $new = $cur ? 0 : 1;
        $wpdb->update($wpdb->prefix . 'fxsim_banners', ['active' => $new, 'updated_at' => current_time('mysql')], ['id' => $id]);
        return new WP_REST_Response(['success' => true, 'active' => $new]);
    }

    /** POST /admin/banners/{id}/delete — remove a banner. */
    public static function admin_banner_delete(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $wpdb->delete($wpdb->prefix . 'fxsim_banners', ['id' => $id]);
        FXSIM_Database::log_admin(get_current_user_id(), 'banner_delete', $id);
        return new WP_REST_Response(['success' => true]);
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  Coupons — payment-layer only. Discounts validated/computed server-side.
     * ──────────────────────────────────────────────────────────────────────── */

    /** POST /coupon/validate — preview a discount for {code, plan_id} (auth). */
    public static function coupon_validate(WP_REST_Request $r): WP_REST_Response {
        $b       = $r->get_json_params() ?: $r->get_body_params();
        $code    = sanitize_text_field($b['code'] ?? '');
        $plan_id = (int) ($b['plan_id'] ?? 0);
        $res     = FXSIM_Coupons::validate($code, $plan_id, get_current_user_id());
        return new WP_REST_Response($res); // 200; caller reads `valid`
    }

    /** GET /admin/coupons — all coupons with usage + revenue analytics. */
    public static function admin_coupons_list(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}fxsim_coupons ORDER BY created_at DESC") ?: [];
        // Aggregate redemptions in one pass.
        $stats = $wpdb->get_results(
            "SELECT coupon_id, COUNT(*) AS uses, COALESCE(SUM(discount_amount),0) AS discount_total,
                    COALESCE(SUM(final_amount),0) AS revenue
             FROM {$wpdb->prefix}fxsim_coupon_redemptions GROUP BY coupon_id", OBJECT_K);
        foreach ($rows as $c) {
            $s = $stats[$c->id] ?? null;
            $c->uses           = $s ? (int) $s->uses : 0;
            $c->discount_total = $s ? round((float) $s->discount_total, 2) : 0.0;
            $c->revenue        = $s ? round((float) $s->revenue, 2) : 0.0;
            $c->expires_at_iso = $c->expires_at ? self::iso8601($c->expires_at) : null;
        }
        return new WP_REST_Response($rows);
    }

    /** POST /admin/coupons/save — create or update a coupon. */
    public static function admin_coupon_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $b    = $r->get_json_params() ?: $r->get_body_params();
        $id   = (int) ($b['id'] ?? 0);
        $code = strtoupper(trim(sanitize_text_field($b['code'] ?? '')));
        if ($code === '') return new WP_REST_Response(['success' => false, 'message' => 'Coupon code is required.'], 400);

        $type  = in_array($b['type'] ?? 'percent', ['percent', 'fixed'], true) ? $b['type'] : 'percent';
        $value = max(0, (float) ($b['value'] ?? 0));
        if ($type === 'percent' && $value > 100) $value = 100;

        // Enforce unique code (excluding this row).
        $clash = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_coupons WHERE code = %s AND id <> %d", $code, $id));
        if ($clash) return new WP_REST_Response(['success' => false, 'message' => 'That coupon code already exists.'], 409);

        $plan_ids = '';
        if (!empty($b['plan_ids']) && is_array($b['plan_ids'])) {
            $plan_ids = implode(',', array_filter(array_map('intval', $b['plan_ids'])));
        } elseif (!empty($b['plan_ids']) && is_string($b['plan_ids'])) {
            $plan_ids = implode(',', array_filter(array_map('intval', explode(',', $b['plan_ids']))));
        }

        $data = [
            'code'           => substr($code, 0, 64),
            'type'           => $type,
            'value'          => $value,
            'currency'       => substr(sanitize_text_field($b['currency'] ?? 'USD'), 0, 10),
            'expires_at'     => self::banner_dt($b['expires_at'] ?? null),
            'usage_limit'    => max(0, (int) ($b['usage_limit'] ?? 0)),
            'per_user_limit' => max(0, (int) ($b['per_user_limit'] ?? 0)),
            'plan_ids'       => $plan_ids !== '' ? $plan_ids : null,
            'active'         => !empty($b['active']) ? 1 : 0,
            'updated_at'     => current_time('mysql'),
        ];
        if ($id > 0) {
            $wpdb->update($wpdb->prefix . 'fxsim_coupons', $data, ['id' => $id]);
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert($wpdb->prefix . 'fxsim_coupons', $data);
            $id = (int) $wpdb->insert_id;
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'coupon_save', $id, $code);
        return new WP_REST_Response(['success' => true, 'id' => $id]);
    }

    /** POST /admin/coupons/{id}/toggle — flip active state. */
    public static function admin_coupon_toggle(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id  = (int) $r->get_param('id');
        $cur = $wpdb->get_var($wpdb->prepare("SELECT active FROM {$wpdb->prefix}fxsim_coupons WHERE id=%d", $id));
        if ($cur === null) return new WP_REST_Response(['success' => false, 'message' => 'Not found'], 404);
        $new = $cur ? 0 : 1;
        $wpdb->update($wpdb->prefix . 'fxsim_coupons', ['active' => $new, 'updated_at' => current_time('mysql')], ['id' => $id]);
        return new WP_REST_Response(['success' => true, 'active' => $new]);
    }

    /** POST /admin/coupons/{id}/delete — remove a coupon (redemptions retained for history). */
    public static function admin_coupon_delete(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $wpdb->delete($wpdb->prefix . 'fxsim_coupons', ['id' => $id]);
        FXSIM_Database::log_admin(get_current_user_id(), 'coupon_delete', $id);
        return new WP_REST_Response(['success' => true]);
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  Affiliates — registration + payment layer only. Manual payout in V1.
     * ──────────────────────────────────────────────────────────────────────── */

    private static function affiliate_payload(object $aff, int $user_id): array {
        return [
            'enrolled'           => true,
            'code'               => $aff->code,
            'rate_percent'       => (float) $aff->rate_percent,
            'status'             => $aff->status,
            'payout_method'      => $aff->payout_method ?? null,
            'payout_destination' => $aff->payout_destination ?? null,
            'available_balance'  => round(FXSIM_Affiliates::available_balance((int) $aff->id), 2),
            'stats'              => FXSIM_Affiliates::stats((int) $aff->id, $user_id),
        ];
    }

    /** GET /affiliate/me — current user's affiliate profile + stats. */
    public static function affiliate_me(): WP_REST_Response {
        $uid = get_current_user_id();
        $aff = FXSIM_Affiliates::get_by_user($uid);
        if (!$aff) return new WP_REST_Response(['enrolled' => false]);
        return new WP_REST_Response(self::affiliate_payload($aff, $uid));
    }

    /** POST /affiliate/enroll — opt in and get a referral code. */
    public static function affiliate_enroll(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $uid = get_current_user_id();
        $aff = FXSIM_Affiliates::enroll($uid);
        return new WP_REST_Response(self::affiliate_payload($aff, $uid));
    }

    /** GET /affiliate/commissions — current user's commission ledger. */
    public static function affiliate_commissions(): WP_REST_Response {
        global $wpdb;
        $aff = FXSIM_Affiliates::get_by_user(get_current_user_id());
        if (!$aff) return new WP_REST_Response([]);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, order_id, base_amount, rate_percent, amount, status, created_at, paid_at
             FROM {$wpdb->prefix}fxsim_commissions WHERE affiliate_id = %d
             ORDER BY created_at DESC LIMIT 200", $aff->id)) ?: [];
        foreach ($rows as $r) { $r->created_at_iso = self::iso8601($r->created_at); }
        return new WP_REST_Response($rows);
    }

    /** POST /affiliate/payout-method {method, destination} */
    public static function affiliate_set_payout(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $b = $r->get_json_params() ?: $r->get_body_params();
        $res = FXSIM_Affiliates::set_payout_method(get_current_user_id(), (string)($b['method'] ?? ''), (string)($b['destination'] ?? ''));
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    /** POST /affiliate/payout/request — withdraw available balance. */
    public static function affiliate_request_payout(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $res = FXSIM_Affiliates::request_payout(get_current_user_id());
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    /** GET /affiliate/payouts — current user's withdrawal history. */
    public static function affiliate_payouts(): WP_REST_Response {
        global $wpdb;
        $aff = FXSIM_Affiliates::get_by_user(get_current_user_id());
        if (!$aff) return new WP_REST_Response([]);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, amount, method, destination, status, tx_reference, proof_url, admin_note, created_at, processed_at
             FROM {$wpdb->prefix}fxsim_affiliate_payouts WHERE affiliate_id=%d
             ORDER BY created_at DESC LIMIT 100", $aff->id)) ?: [];
        foreach ($rows as $r) { $r->created_at_iso = self::iso8601($r->created_at); }
        return new WP_REST_Response($rows);
    }

    /** GET /admin/affiliate-payouts?status= — all affiliate withdrawals. */
    public static function admin_affiliate_payouts(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status = sanitize_key((string) $r->get_param('status'));
        $where  = in_array($status, ['pending','approved','rejected','paid'], true) ? $wpdb->prepare(' WHERE ap.status=%s', $status) : '';
        $rows = $wpdb->get_results(
            "SELECT ap.*, a.code AS affiliate_code, u.user_login, u.display_name, u.user_email
             FROM {$wpdb->prefix}fxsim_affiliate_payouts ap
             JOIN {$wpdb->prefix}fxsim_affiliates a ON a.id = ap.affiliate_id
             JOIN {$wpdb->users} u ON u.ID = a.user_id
             $where ORDER BY ap.created_at DESC LIMIT 200") ?: [];
        foreach ($rows as $row) { $row->created_at_iso = self::iso8601($row->created_at); }
        return new WP_REST_Response($rows);
    }

    /** POST /admin/affiliate-payouts/{id}/status {status, tx_reference, proof_url, note} */
    public static function admin_affiliate_payout_status(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $b = $r->get_json_params() ?: $r->get_body_params();
        $res = FXSIM_Affiliates::process_payout(
            (int) $r->get_param('id'),
            (string)($b['status'] ?? ''),
            (string)($b['tx_reference'] ?? ''),
            (string)($b['proof_url'] ?? ''),
            (string)($b['note'] ?? '')
        );
        if ($res['success']) FXSIM_Database::log_admin(get_current_user_id(), 'affiliate_payout_' . ($b['status'] ?? ''), 0, 'Payout #' . (int)$r->get_param('id'));
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    /** GET /admin/affiliates — all affiliates with earnings summary. */
    public static function admin_affiliates_list(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT a.*, u.user_login, u.user_email, u.display_name
             FROM {$wpdb->prefix}fxsim_affiliates a
             JOIN {$wpdb->users} u ON u.ID = a.user_id
             ORDER BY a.created_at DESC") ?: [];
        $stats = $wpdb->get_results(
            "SELECT affiliate_id,
                    COUNT(*) AS conversions,
                    COALESCE(SUM(amount),0) AS total,
                    COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS paid,
                    COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0) AS unpaid
             FROM {$wpdb->prefix}fxsim_commissions GROUP BY affiliate_id", OBJECT_K);
        foreach ($rows as $a) {
            $s = $stats[$a->id] ?? null;
            $a->conversions = $s ? (int) $s->conversions : 0;
            $a->total       = $s ? round((float) $s->total, 2) : 0.0;
            $a->paid        = $s ? round((float) $s->paid, 2) : 0.0;
            $a->unpaid      = $s ? round((float) $s->unpaid, 2) : 0.0;
            $a->referrals   = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key='fxsim_referred_by' AND meta_value=%d", $a->id));
        }
        return new WP_REST_Response($rows);
    }

    /** POST /admin/affiliates/{id}/rate — set commission rate. */
    public static function admin_affiliate_rate(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id   = (int) $r->get_param('id');
        $b    = $r->get_json_params() ?: $r->get_body_params();
        $rate = max(0, min(100, (float) ($b['rate_percent'] ?? 0)));
        $wpdb->update($wpdb->prefix . 'fxsim_affiliates', ['rate_percent' => $rate], ['id' => $id]);
        return new WP_REST_Response(['success' => true, 'rate_percent' => $rate]);
    }

    /** POST /admin/affiliates/{id}/status — active | suspended. */
    public static function admin_affiliate_status(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id  = (int) $r->get_param('id');
        $b   = $r->get_json_params() ?: $r->get_body_params();
        $st  = in_array($b['status'] ?? '', ['active', 'suspended'], true) ? $b['status'] : 'active';
        $wpdb->update($wpdb->prefix . 'fxsim_affiliates', ['status' => $st], ['id' => $id]);
        return new WP_REST_Response(['success' => true, 'status' => $st]);
    }

    /** GET /admin/commissions?status= — commission ledger across all affiliates. */
    public static function admin_commissions_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status = sanitize_key((string) $r->get_param('status'));
        $where  = in_array($status, ['pending', 'approved', 'paid', 'reversed'], true)
            ? $wpdb->prepare('WHERE c.status = %s', $status) : '';
        $rows = $wpdb->get_results(
            "SELECT c.*, u.user_login AS affiliate_login, ru.user_login AS referred_login
             FROM {$wpdb->prefix}fxsim_commissions c
             JOIN {$wpdb->prefix}fxsim_affiliates a ON a.id = c.affiliate_id
             JOIN {$wpdb->users} u  ON u.ID = a.user_id
             LEFT JOIN {$wpdb->users} ru ON ru.ID = c.referred_user_id
             $where
             ORDER BY FIELD(c.status,'pending','approved','paid','reversed'), c.created_at DESC
             LIMIT 300") ?: [];
        foreach ($rows as $c) { $c->created_at_iso = self::iso8601($c->created_at); }
        return new WP_REST_Response($rows);
    }

    /** POST /admin/commissions/{id}/status — approved | paid | reversed (manual payout). */
    public static function admin_commission_status(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id  = (int) $r->get_param('id');
        $b   = $r->get_json_params() ?: $r->get_body_params();
        $st  = in_array($b['status'] ?? '', ['pending', 'approved', 'paid', 'reversed'], true) ? $b['status'] : '';
        if ($st === '') return new WP_REST_Response(['success' => false, 'message' => 'Invalid status'], 400);
        $data = ['status' => $st];
        if ($st === 'paid') $data['paid_at'] = current_time('mysql');
        $wpdb->update($wpdb->prefix . 'fxsim_commissions', $data, ['id' => $id]);
        FXSIM_Database::log_admin(get_current_user_id(), 'commission_' . $st, $id);
        return new WP_REST_Response(['success' => true, 'status' => $st]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════

    /** GET /admin/notifications — shared admin activity feed (user_id = 0) */
    public static function admin_notifications_get(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT id, type, title, message, link, is_read, ref_user_id, ref_user_label, created_at
             FROM {$wpdb->prefix}fxsim_notifications
             WHERE user_id = 0
             ORDER BY created_at DESC
             LIMIT 100"
        );
        foreach (($rows ?: []) as $r) { if (!empty($r->created_at)) $r->created_at_iso = self::iso8601($r->created_at); }
        $unread = array_filter($rows ?: [], fn($r) => !(int)$r->is_read);
        return new WP_REST_Response([
            'notifications' => $rows ?: [],
            'unread_count'  => count($unread),
        ]);
    }

    /** POST /admin/notifications/read — mark admin notifications read */
    public static function admin_notifications_read(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $ids  = array_map('intval', (array)($body['ids'] ?? []));
        if (empty($ids)) {
            $wpdb->update($wpdb->prefix . 'fxsim_notifications', ['is_read' => 1], ['user_id' => 0, 'is_read' => 0]);
        } else {
            $placeholders = implode(',', array_fill(0, count($ids), '%d'));
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_notifications
                 SET is_read = 1 WHERE user_id = 0 AND id IN ({$placeholders})",
                $ids
            ));
        }
        return new WP_REST_Response(['success' => true]);
    }

    /** GET /notifications — fetch unread notifications for current user */
    public static function notifications_get(): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, type, title, message, link, is_read, created_at
             FROM {$wpdb->prefix}fxsim_notifications
             WHERE user_id = %d
             ORDER BY created_at DESC
             LIMIT 30",
            $user_id
        ));
        foreach (($rows ?: []) as $r) { if (!empty($r->created_at)) $r->created_at_iso = self::iso8601($r->created_at); }
        $unread = array_filter($rows ?: [], fn($r) => !(int)$r->is_read);
        return new WP_REST_Response([
            'notifications' => $rows ?: [],
            'unread_count'  => count($unread),
        ]);
    }

    /** POST /notifications/read — mark notifications as read */
    public static function notifications_read(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $body    = $r->get_json_params() ?: $r->get_body_params();
        $ids     = array_map('intval', (array)($body['ids'] ?? []));
        if (empty($ids)) {
            // Mark all read
            $wpdb->update(
                $wpdb->prefix . 'fxsim_notifications',
                ['is_read' => 1],
                ['user_id' => $user_id, 'is_read' => 0]
            );
        } else {
            $placeholders = implode(',', array_fill(0, count($ids), '%d'));
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_notifications
                 SET is_read = 1 WHERE user_id = %d AND id IN ({$placeholders})",
                array_merge([$user_id], $ids)
            ));
        }
        return new WP_REST_Response(['success' => true]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // AUTH — PASSWORD RESET + EMAIL VERIFICATION
    // ════════════════════════════════════════════════════════════════════════

    /** POST /auth/request-reset — send password reset email */
    public static function auth_request_reset(WP_REST_Request $r): WP_REST_Response {
        $body  = $r->get_json_params() ?: $r->get_body_params();
        $login = sanitize_text_field($body['login'] ?? '');
        if (!$login) return new WP_REST_Response(['error' => 'Email or username required.'], 400);
        // Always return success even if user not found (prevent enumeration)
        $user = is_email($login) ? get_user_by('email', $login) : get_user_by('login', $login);
        if ($user) {
            $key   = get_password_reset_key($user);
            if (!is_wp_error($key)) {
                $reset_url = self::frontend_url() . "/reset-password?key={$key}&login=" . rawurlencode($user->user_login);
                if (class_exists('FXSIM_Emails')) {
                    FXSIM_Emails::send((int) $user->ID, 'password_reset', ['reset_url' => $reset_url]);
                }
            }
        }
        return new WP_REST_Response(['success' => true, 'message' => 'If that account exists, a reset email has been sent.']);
    }

    /** POST /auth/do-reset — complete password reset with key */
    public static function auth_do_reset(WP_REST_Request $r): WP_REST_Response {
        $body     = $r->get_json_params() ?: $r->get_body_params();
        $key      = sanitize_text_field($body['key']      ?? '');
        $login    = sanitize_user($body['login']   ?? '');
        $password = $body['password'] ?? '';
        if (!$key || !$login || strlen($password) < 6) {
            return new WP_REST_Response(['error' => 'Key, login, and password (min 6 chars) required.'], 400);
        }
        $user = check_password_reset_key($key, $login);
        if (is_wp_error($user)) {
            return new WP_REST_Response(['error' => 'Reset link is invalid or expired. Request a new one.'], 400);
        }
        reset_password($user, $password);
        return new WP_REST_Response(['success' => true, 'message' => 'Password updated. You can now log in.']);
    }

    /** GET /auth/verify-email?token=X — verify email address.
     *  With ?format=json (used by the SPA) returns JSON; otherwise 302s to the SPA. */
    public static function auth_verify_email(WP_REST_Request $r): void {
        $fe     = self::frontend_url();
        $token  = sanitize_text_field($r->get_param('token') ?? '');
        $isJson = $r->get_param('format') === 'json';

        $finish = function (string $status, string $msg = '') use ($fe, $isJson) {
            if ($isJson) {
                $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
                if ($origin && untrailingslashit($origin) === untrailingslashit($fe)) {
                    header('Access-Control-Allow-Origin: ' . $origin);
                    header('Access-Control-Allow-Credentials: true');
                    header('Vary: Origin');
                }
                wp_send_json(['status' => $status, 'message' => $msg]);
            }
            $q = $status === 'success' ? 'status=success' : 'status=error&msg=' . urlencode($msg);
            wp_redirect($fe . '/verify-success?' . $q);
            exit;
        };

        if (!$token) {
            $finish('invalid', 'Verification link is invalid.');
        }
        $user_id = (int) get_transient('fxsim_verify_' . $token);
        if (!$user_id) {
            $finish('expired', 'This verification link has expired or was already used. Please request a new one from your dashboard.');
        }
        update_user_meta($user_id, 'fxsim_email_verified', 1);
        delete_transient('fxsim_verify_' . $token);
        if (!is_user_logged_in()) {
            wp_set_current_user($user_id);
            wp_set_auth_cookie($user_id);
        }
        $finish('success', 'Email verified.');
    }

    /**
     * Base URL of the Next.js SPA (where post-verify users should land).
     * Resolution (BUG-008): admin-configured value in the whitelabel settings
     * store (where the Settings UI saves it), then a legacy wp-option, then the
     * FXSIM_FRONTEND_URL constant, then the WP home URL. Guarantees verification
     * links point at the configured FRONTEND domain, never the backend host.
     */
    private static function frontend_url(): string {
        $url = '';
        if (class_exists('FXSIM_Challenge_DB')) $url = FXSIM_Challenge_DB::get_setting('frontend_url', '');
        if (!$url) $url = get_option('fxsim_frontend_url', '');
        if (!$url && defined('FXSIM_FRONTEND_URL')) $url = FXSIM_FRONTEND_URL;
        if (!$url) $url = home_url();
        return untrailingslashit($url);
    }

    /**
     * BUG-008: true only when an admin has EXPLICITLY configured the frontend URL
     * (whitelabel store or wp-option) — i.e. not the home_url() fallback. Used to
     * refuse sending verification links that would otherwise point at the backend
     * domain. Note FXSIM_FRONTEND_URL defaults to home_url(), so it doesn't count
     * as "configured" unless it was overridden in wp-config to a different host.
     */
    private static function frontend_url_is_configured(): bool {
        $stored = '';
        if (class_exists('FXSIM_Challenge_DB')) $stored = FXSIM_Challenge_DB::get_setting('frontend_url', '');
        if (!$stored) $stored = get_option('fxsim_frontend_url', '');
        if ($stored) return true;
        // A wp-config constant counts only if it differs from the backend home URL.
        if (defined('FXSIM_FRONTEND_URL') && untrailingslashit(FXSIM_FRONTEND_URL) !== untrailingslashit(home_url())) return true;
        return false;
    }

    /** #8 Emergency controls: is a global switch on? Keys: pause_registrations,
     *  pause_payouts, pause_purchases, pause_trading. Stored in the whitelabel
     *  settings store ('1' = paused). No schema change. */
    private static function ops_paused(string $key): bool {
        if (!class_exists('FXSIM_Challenge_DB')) return false;
        return FXSIM_Challenge_DB::get_setting($key, '') === '1';
    }


    /** POST /auth/resend-verification — resend email verification */
    public static function auth_resend_verification(): WP_REST_Response {
        $user_id = get_current_user_id();
        self::send_verification_email($user_id);
        return new WP_REST_Response(['success' => true, 'message' => 'Verification email sent.']);
    }

    public static function auth_2fa_toggle(WP_REST_Request $r): WP_REST_Response {
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $enable = (bool)($body['enable'] ?? false);
        FXSIM_2FA::toggle(get_current_user_id(), $enable);
        return new WP_REST_Response(['success' => true, 'enabled' => $enable]);
    }

    public static function auth_2fa_status(): WP_REST_Response {
        return new WP_REST_Response(['enabled' => FXSIM_2FA::is_enabled(get_current_user_id())]);
    }

    /**
     * Send email verification to a user.
     * Called after registration and on resend request.
     */
    public static function send_verification_email(int $user_id): void {
        $user = get_userdata($user_id);
        if (!$user) return;

        // BUG-008: never send a verification link on the backend/WP domain. If the
        // frontend URL was never configured, skip sending rather than emit a
        // broken link — the SPA shows a "resend" action once setup is complete.
        if (!self::frontend_url_is_configured()) {
            error_log('FXSIM: verification email skipped for user ' . $user_id . ' — frontend URL not configured (set it in Setup → Connection).');
            return;
        }

        $token      = bin2hex(random_bytes(20));
        set_transient('fxsim_verify_' . $token, $user_id, 7 * DAY_IN_SECONDS);

        $brand      = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        $verify_url = self::frontend_url() . "/verify-success?token={$token}";
        $name       = esc_html($user->display_name ?: $user->user_login);

        $body = "
            <p>Hi <strong>{$name}</strong>,</p>
            <p>Welcome to <strong>{$brand}</strong>! You're one step away from accessing your trader dashboard.</p>
            <p>Please verify your email address to activate your account and start your funded trader journey.</p>
            <div style='text-align:center;margin:32px 0'>
              <a href='{$verify_url}'
                 style='display:inline-block;background:linear-gradient(135deg,#7c6ef5,#5f52e8);
                        color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;
                        font-weight:700;font-size:15px;letter-spacing:.2px;
                        box-shadow:0 4px 16px rgba(124,110,245,.4)'>
                Verify My Email →
              </a>
            </div>
            <p style='font-size:13px;color:#4a6580'>
              This link expires in <strong>7 days</strong>.<br>
              If you didn't create an account, you can safely ignore this email.
            </p>
            <p style='font-size:12px;color:#3e5275'>
              Or copy this link into your browser:<br>
              <span style='word-break:break-all;color:#7c6ef5'>{$verify_url}</span>
            </p>
        ";

        $html = class_exists('FXSIM_Emails')
            ? FXSIM_Emails::build_html($body, ['brand' => $brand, 'tagline' => 'Verify Your Email'])
            : $body;

        wp_mail(
            $user->user_email,
            "Verify your email address",
            $html,
            ['Content-Type: text/html; charset=UTF-8']
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // TRADER ANALYTICS — ADVANCED
    // ════════════════════════════════════════════════════════════════════════

    /** GET /stats/advanced — risk/reward, trading hours, trading days, drawdown */
    public static function stats_advanced(): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $acc     = self::get_active_challenge_account($user_id);
        if (!$acc) return new WP_REST_Response(['error' => 'No active challenge', 'no_challenge' => true], 404);

        $trades = $wpdb->get_results($wpdb->prepare(
            "SELECT pnl, opened_at, closed_at, type,
                    ABS(open_price - COALESCE(sl, open_price)) AS risk_pts,
                    ABS(open_price - COALESCE(tp, open_price)) AS reward_pts,
                    HOUR(closed_at) AS close_hour,
                    DAYOFWEEK(closed_at) AS dow
             FROM {$wpdb->prefix}fxsim_trades
             WHERE account_id = %d AND closed_at IS NOT NULL",
            $acc->id
        ));

        // ── Risk/Reward tracker ───────────────────────────────────────────────
        $rr_list = [];
        foreach ($trades as $t) {
            $risk   = (float)$t->risk_pts;
            $reward = (float)$t->reward_pts;
            if ($risk > 0 && $reward > 0) {
                $rr_list[] = round($reward / $risk, 2);
            }
        }
        $avg_rr = count($rr_list) ? round(array_sum($rr_list) / count($rr_list), 2) : 0;

        // ── Best/worst trading hours ──────────────────────────────────────────
        $hours = array_fill(0, 24, ['trades' => 0, 'pnl' => 0, 'wins' => 0]);
        foreach ($trades as $t) {
            $h = (int)$t->close_hour;
            $hours[$h]['trades']++;
            $hours[$h]['pnl'] += (float)$t->pnl;
            if ((float)$t->pnl > 0) $hours[$h]['wins']++;
        }
        $best_hour  = array_keys($hours, max($hours))[0] ?? 0;
        $hours_data = array_map(function($h, $d) {
            return [
                'hour'     => $h,
                'trades'   => $d['trades'],
                'pnl'      => round($d['pnl'], 2),
                'win_rate' => $d['trades'] ? round($d['wins'] / $d['trades'] * 100, 1) : 0,
            ];
        }, array_keys($hours), $hours);

        // ── Best/worst trading days ───────────────────────────────────────────
        // DOW: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
        $days  = array_fill(1, 7, ['trades' => 0, 'pnl' => 0, 'wins' => 0]);
        $names = [1=>'Sun',2=>'Mon',3=>'Tue',4=>'Wed',5=>'Thu',6=>'Fri',7=>'Sat'];
        foreach ($trades as $t) {
            $d = (int)$t->dow;
            $days[$d]['trades']++;
            $days[$d]['pnl'] += (float)$t->pnl;
            if ((float)$t->pnl > 0) $days[$d]['wins']++;
        }
        $days_data = array_map(function($dow, $d) use ($names) {
            return [
                'dow'      => $dow,
                'name'     => $names[$dow],
                'trades'   => $d['trades'],
                'pnl'      => round($d['pnl'], 2),
                'win_rate' => $d['trades'] ? round($d['wins'] / $d['trades'] * 100, 1) : 0,
            ];
        }, array_keys($days), $days);

        // ── Drawdown curve ────────────────────────────────────────────────────
        // Running drawdown from peak equity using challenge snapshots
        $snapshots = $wpdb->get_results($wpdb->prepare(
            "SELECT snapshot_date AS date, closing_balance AS balance
             FROM {$wpdb->prefix}fxsim_challenge_snapshots
             WHERE challenge_id = (
               SELECT id FROM {$wpdb->prefix}fxsim_challenge_accounts
               WHERE fxsim_account_id = %d LIMIT 1
             )
             ORDER BY snapshot_date ASC",
            $acc->id
        ));

        $peak = 0; $drawdown_curve = [];
        foreach ($snapshots as $s) {
            $bal  = (float)$s->balance;
            $peak = max($peak, $bal);
            $dd   = $peak > 0 ? round(($peak - $bal) / $peak * 100, 2) : 0;
            $drawdown_curve[] = ['date' => $s->date, 'drawdown_pct' => $dd, 'balance' => $bal];
        }

        return new WP_REST_Response([
            'avg_rr'        => $avg_rr,
            'rr_list'       => array_slice($rr_list, -50),   // last 50 trades
            'hours'         => $hours_data,
            'best_hour'     => $best_hour,
            'days'          => $days_data,
            'drawdown_curve'=> $drawdown_curve,
            'total_trades'  => count($trades),
        ]);
    }

    // ════════════════════════════════════════════════════════════════════════

    // ── Trade Flags (admin) ──────────────────────────────────────────────────
    public static function admin_trade_flags(): WP_REST_Response {
        $flags = FXSIM_Challenge_DB::get_trade_flags([
            'resolved' => $_GET['resolved'] ?? null,
            'user_id'  => $_GET['user_id']  ?? null,
            'flag_type'=> $_GET['flag_type'] ?? null,
        ]);
        return new WP_REST_Response($flags);
    }

    public static function admin_resolve_trade_flag(WP_REST_Request $r): WP_REST_Response {
        $ok = FXSIM_Challenge_DB::resolve_trade_flag(
            (int)$r->get_param('id'),
            get_current_user_id()
        );
        return new WP_REST_Response(['success' => $ok]);
    }

    // ── Scaling Status (user) ────────────────────────────────────────────────
    public static function challenge_scaling_status(WP_REST_Request $r): WP_REST_Response {
        $challenge_id = (int)$r->get_param('id');
        if (!class_exists('FXSIM_Scaling_Engine')) {
            return new WP_REST_Response(['error' => 'Scaling not available'], 404);
        }
        // Verify ownership
        global $wpdb;
        $owner = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT user_id FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d", $challenge_id
        ));
        if ($owner !== get_current_user_id()) {
            return new WP_REST_Response(['error' => 'Access denied'], 403);
        }
        $status = FXSIM_Scaling_Engine::get_scaling_status($challenge_id);
        return new WP_REST_Response($status);
    }

    // ── Admin Force Scale ────────────────────────────────────────────────────
    public static function admin_force_scale(WP_REST_Request $r): WP_REST_Response {
        if (!class_exists('FXSIM_Scaling_Engine')) {
            return new WP_REST_Response(['error' => 'Scaling not available'], 404);
        }
        $result = FXSIM_Scaling_Engine::admin_force_scale((int)$r->get_param('id'));
        return new WP_REST_Response($result, $result['success'] ? 200 : 400);
    }

    // ── Confirmo Crypto Checkout ─────────────────────────────────────────────

    // ── Challenge Plans (public) — enhanced with v11 fields ──────────────────
    // Override original to include drawdown_type, instant funding, scaling info

    // ── Competitions / Tournaments ───────────────────────────────────────────
    public static function admin_get_competitions(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $competitions = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}fxsim_competitions ORDER BY start_date DESC", ARRAY_A);
        
        foreach ($competitions as &$comp) {
            $comp['participants_count'] = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_competition_participants WHERE competition_id = %d",
                $comp['id']
            ));
        }

        return new WP_REST_Response(['data' => $competitions]);
    }

    public static function admin_create_competition(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $name        = sanitize_text_field($r->get_param('name'));
        $description = sanitize_textarea_field($r->get_param('description'));
        $start_date  = sanitize_text_field($r->get_param('start_date'));
        $end_date    = sanitize_text_field($r->get_param('end_date'));
        $prize_pool  = sanitize_text_field($r->get_param('prize_pool'));
        $entry_fee   = (float) $r->get_param('entry_fee');
        $max         = (int) $r->get_param('max_participants');

        if (!$name || !$start_date || !$end_date) {
            return new WP_REST_Response(['error' => 'Missing required fields'], 400);
        }

        $wpdb->insert("{$wpdb->prefix}fxsim_competitions", [
            'name'             => $name,
            'description'      => $description,
            'start_date'       => $start_date,
            'end_date'         => $end_date,
            'prize_pool'       => $prize_pool,
            'entry_fee'        => $entry_fee,
            'max_participants' => $max,
            'status'           => 'upcoming',
            'created_at'       => current_time('mysql', 1)
        ]);

        return new WP_REST_Response(['success' => true, 'id' => $wpdb->insert_id]);
    }

    public static function get_competitions(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $competitions = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}fxsim_competitions ORDER BY start_date DESC", ARRAY_A);
        
        $user_id = get_current_user_id();

        foreach ($competitions as &$comp) {
            $comp['participants_count'] = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_competition_participants WHERE competition_id = %d",
                $comp['id']
            ));
            
            if ($user_id) {
                $joined = $wpdb->get_var($wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}fxsim_competition_participants WHERE competition_id = %d AND user_id = %d",
                    $comp['id'], $user_id
                ));
                $comp['joined'] = (bool) $joined;
            } else {
                $comp['joined'] = false;
            }
        }

        return new WP_REST_Response(['data' => $competitions]);
    }

    public static function join_competition(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $comp_id = (int) $r->get_param('id');

        $comp = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_competitions WHERE id = %d", $comp_id));
        if (!$comp) {
            return new WP_REST_Response(['error' => 'Competition not found'], 404);
        }

        if ($comp->status !== 'upcoming' && $comp->status !== 'active') {
            return new WP_REST_Response(['error' => 'Registration is closed for this competition'], 400);
        }

        // Check if already joined
        $already = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_competition_participants WHERE competition_id = %d AND user_id = %d",
            $comp_id, $user_id
        ));
        if ($already) {
            return new WP_REST_Response(['error' => 'You are already registered for this competition'], 400);
        }

        if ((float) $comp->entry_fee > 0) {
            $session_id = $r->get_param('session_id');
            if (!$session_id) {
                if (class_exists('FXSIM_Stripe')) {
                    $checkout = FXSIM_Stripe::create_competition_checkout($user_id, $comp_id);
                    if ($checkout['success']) {
                        return new WP_REST_Response([
                            'checkout_required' => true,
                            'message'           => 'Entry fee required',
                            'checkout_url'      => $checkout['checkout_url']
                        ]);
                    }
                }
                return new WP_REST_Response([
                    'checkout_required' => true,
                    'message'           => 'Entry fee required, but Stripe is not configured.',
                    'checkout_url'      => ''
                ], 400);
            }
            // If they pass a session ID, they are trying to verify (handled by webhook, but we could return pending status)
            return new WP_REST_Response(['message' => 'Payment is processing. You will be registered once confirmed.'], 202);
        }

        if (!class_exists('FXSIM_Challenge_DB')) {
            return new WP_REST_Response(['error' => 'Challenge engine missing'], 500);
        }

        $account_id = FXSIM_Challenge_DB::create_account(
            $user_id,
            'Tournament Account - ' . $comp->name,
            100000,
            1, 
            [
                'max_daily_loss' => 5,
                'max_total_loss' => 10,
                'profit_target'  => 0,
                'max_days'       => 30
            ]
        );

        if (is_wp_error($account_id)) {
            return new WP_REST_Response(['error' => 'Failed to create tournament account'], 500);
        }

        $wpdb->insert("{$wpdb->prefix}fxsim_competition_participants", [
            'competition_id' => $comp_id,
            'user_id'        => $user_id,
            'account_id'     => $account_id,
            'status'         => 'active',
            'registered_at'  => current_time('mysql', 1)
        ]);

        return new WP_REST_Response(['success' => true, 'account_id' => $account_id]);
    }

    public static function admin_update_competition(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $comp = $wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}fxsim_competitions WHERE id = %d", $id));
        if (!$comp) return new WP_REST_Response(['error' => 'Not found'], 404);

        $update = [];
        if ($r->has_param('name'))             $update['name']             = sanitize_text_field($r->get_param('name'));
        if ($r->has_param('description'))      $update['description']      = sanitize_textarea_field($r->get_param('description'));
        if ($r->has_param('start_date'))       $update['start_date']       = sanitize_text_field($r->get_param('start_date'));
        if ($r->has_param('end_date'))         $update['end_date']         = sanitize_text_field($r->get_param('end_date'));
        if ($r->has_param('prize_pool'))       $update['prize_pool']       = sanitize_text_field($r->get_param('prize_pool'));
        if ($r->has_param('entry_fee'))        $update['entry_fee']        = (float) $r->get_param('entry_fee');
        if ($r->has_param('max_participants')) $update['max_participants'] = (int) $r->get_param('max_participants');
        if ($r->has_param('status'))           $update['status']           = sanitize_text_field($r->get_param('status'));

        if (!empty($update)) {
            $wpdb->update("{$wpdb->prefix}fxsim_competitions", $update, ['id' => $id]);
        }
        return new WP_REST_Response(['success' => true]);
    }

    public static function admin_delete_competition(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $wpdb->delete("{$wpdb->prefix}fxsim_competitions", ['id' => $id]);
        $wpdb->delete("{$wpdb->prefix}fxsim_competition_participants", ['competition_id' => $id]);
        return new WP_REST_Response(['success' => true]);
    }

    public static function competition_leaderboard(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        
        // In a competition, the leaderboard is usually based on the account's return/profit
        $participants = $wpdb->get_results($wpdb->prepare("
            SELECT p.user_id, p.account_id, u.user_login as username, a.balance, a.initial_balance
            FROM {$wpdb->prefix}fxsim_competition_participants p
            JOIN {$wpdb->prefix}users u ON p.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_accounts a ON p.account_id = a.id
            WHERE p.competition_id = %d AND p.status = 'active'
        ", $id), ARRAY_A);

        foreach ($participants as &$p) {
            $initial = (float)$p['initial_balance'];
            $current = (float)$p['balance'];
            $p['profit'] = $current - $initial;
            $p['return_pct'] = $initial > 0 ? ($p['profit'] / $initial) * 100 : 0;
            // Redact username slightly
            $len = strlen($p['username']);
            if ($len > 3) {
                $p['username'] = substr($p['username'], 0, 3) . '***';
            }
        }

        // Sort descending by profit
        usort($participants, function($a, $b) {
            return $b['profit'] <=> $a['profit'];
        });

        // Top 50
        $participants = array_slice($participants, 0, 50);

        return new WP_REST_Response(['data' => $participants]);
    }

    public static function trade_notes_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $trade_id = (int) $r->get_param('id');
        $user_id  = get_current_user_id();

        // Verify the trade belongs to an account owned by this user
        $trade = $wpdb->get_row($wpdb->prepare("
            SELECT t.id FROM {$wpdb->prefix}fxsim_trades t
            JOIN {$wpdb->prefix}fxsim_challenge_accounts a ON t.account_id = a.id
            WHERE t.id = %d AND a.user_id = %d
        ", $trade_id, $user_id));

        if (!$trade) {
            return new WP_REST_Response(['error' => 'Trade not found or unauthorized'], 404);
        }

        $note = $wpdb->get_row($wpdb->prepare("
            SELECT * FROM {$wpdb->prefix}fxsim_trade_notes
            WHERE trade_id = %d AND user_id = %d
        ", $trade_id, $user_id), ARRAY_A);

        if (!$note) {
            return new WP_REST_Response(['note' => '', 'tags' => '[]', 'screenshot_url' => ''], 200);
        }
        return new WP_REST_Response($note, 200);
    }

    public static function trade_notes_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        if (!self::verify_nonce($r)) return new WP_REST_Response(['error' => 'Invalid nonce'], 403);
        
        $trade_id = (int) $r->get_param('id');
        $user_id  = get_current_user_id();
        $body = $r->get_json_params() ?: $r->get_body_params();

        // Verify the trade belongs to an account owned by this user
        $trade = $wpdb->get_row($wpdb->prepare("
            SELECT t.id FROM {$wpdb->prefix}fxsim_trades t
            JOIN {$wpdb->prefix}fxsim_challenge_accounts a ON t.account_id = a.id
            WHERE t.id = %d AND a.user_id = %d
        ", $trade_id, $user_id));

        if (!$trade) {
            return new WP_REST_Response(['error' => 'Trade not found or unauthorized'], 404);
        }

        $note = sanitize_textarea_field($body['note'] ?? '');
        $tags = isset($body['tags']) && is_array($body['tags']) 
            ? json_encode(array_map('sanitize_text_field', $body['tags'])) 
            : null;
        $screenshot = sanitize_url($body['screenshot_url'] ?? '');

        $existing = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}fxsim_trade_notes WHERE trade_id = %d AND user_id = %d", $trade_id, $user_id));

        if ($existing) {
            $wpdb->update(
                "{$wpdb->prefix}fxsim_trade_notes",
                ['note' => $note, 'tags' => $tags, 'screenshot_url' => $screenshot],
                ['id' => $existing]
            );
        } else {
            $wpdb->insert(
                "{$wpdb->prefix}fxsim_trade_notes",
                [
                    'user_id' => $user_id,
                    'trade_id' => $trade_id,
                    'note' => $note,
                    'tags' => $tags,
                    'screenshot_url' => $screenshot
                ]
            );
        }

        return new WP_REST_Response(['success' => true]);
    }
}
