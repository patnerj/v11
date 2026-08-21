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

        // ── V10 MT5 feed ingestion & Account Sync Worker (Option B) ───────────
        register_rest_route(self::NS, '/price-feed/ingest', ['methods'=>'POST','callback'=>[self::class,'price_feed_ingest'],'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/mt5/sync',          ['methods'=>'POST','callback'=>[self::class,'mt5_account_sync'], 'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/mt5/sync-targets',  ['methods'=>'GET', 'callback'=>[self::class,'mt5_sync_targets'], 'permission_callback'=>'__return_true']);

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
        register_rest_route(self::NS, '/news-events',   ['methods'=>'GET',  'callback'=>[self::class,'public_news_events_get'], 'permission_callback'=>$auth]);

        // ── Admin ────────────────────────────────────────────────────────────
        register_rest_route(self::NS, '/admin/stats',         ['methods'=>'GET', 'callback'=>[self::class,'admin_stats'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users',         ['methods'=>'GET', 'callback'=>[self::class,'admin_users'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users/create',  ['methods'=>'POST','callback'=>[self::class,'admin_user_create'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/create',   ['methods'=>'POST','callback'=>[self::class,'admin_user_create'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/reset-password', ['methods'=>'POST','callback'=>[self::class,'admin_user_reset_pw'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/delete',         ['methods'=>'POST','callback'=>[self::class,'admin_user_delete'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/delete',         ['methods'=>'DELETE','callback'=>[self::class,'admin_user_delete'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/notify',         ['methods'=>'POST','callback'=>[self::class,'admin_user_notify'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users/(?P<id>\d+)/risk-profile', ['methods'=>'GET', 'callback'=>[self::class,'admin_user_risk_profile'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/adjust-balance',['methods'=>'POST','callback'=>[self::class,'admin_adjust'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbol/create', ['methods'=>'POST','callback'=>[self::class,'admin_symbol_create'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbols/create',['methods'=>'POST','callback'=>[self::class,'admin_symbol_create'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbol/(?P<id>\d+)', ['methods'=>'POST','callback'=>[self::class,'admin_symbol'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbol/(?P<id>\d+)', ['methods'=>'DELETE','callback'=>[self::class,'admin_symbol_delete'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbol/(?P<id>\d+)/delete', ['methods'=>'POST','callback'=>[self::class,'admin_symbol_delete'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/position/(?P<id>\d+)/close', ['methods'=>'POST','callback'=>[self::class,'admin_position_close'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/position/(?P<id>\d+)/sltp',  ['methods'=>'POST','callback'=>[self::class,'admin_position_sltp'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/trades',        ['methods'=>'GET', 'callback'=>[self::class,'admin_trades'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/log',           ['methods'=>'GET', 'callback'=>[self::class,'admin_log'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/symbols',       ['methods'=>'GET', 'callback'=>[self::class,'admin_symbols'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/set-status',   ['methods'=>'POST','callback'=>[self::class,'admin_set_status'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk',          ['methods'=>'GET', 'callback'=>[self::class,'admin_risk'],          'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/heatmap',  ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_heatmap'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/exposure', ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_heatmap'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/alerts',   ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_alerts'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/toxic',    ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_toxic'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/force-close', ['methods'=>'POST', 'callback'=>[self::class,'admin_risk_force_close'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/flag',        ['methods'=>'POST', 'callback'=>[self::class,'admin_risk_flag_trader'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/syndicates',          ['methods'=>'GET', 'callback'=>[self::class,'admin_risk_syndicates_get'],           'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/syndicates/settings', ['methods'=>'POST','callback'=>[self::class,'admin_risk_syndicates_save_settings'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/risk/syndicate/(?P<id>\d+)/freeze', ['methods'=>'POST','callback'=>[self::class,'admin_risk_syndicate_freeze'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/bulk/payouts',   ['methods'=>'POST','callback'=>[self::class,'admin_bulk_payouts'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/bulk/kyc',       ['methods'=>'POST','callback'=>[self::class,'admin_bulk_kyc'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/note', ['methods'=>'POST','callback'=>[self::class,'admin_user_note_save'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/mt5',  ['methods'=>'POST','callback'=>[self::class,'admin_user_mt5_save'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/traders/(?P<id>\d+)/mt5',['methods'=>'POST','callback'=>[self::class,'admin_user_mt5_save'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)',      ['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/trader/(?P<id>\d+)',    ['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/360',  ['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users/(?P<id>\d+)/360', ['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/trader/(?P<id>\d+)/360',['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/traders/(?P<id>\d+)/360',['methods'=>'GET','callback'=>[self::class,'admin_user_detail'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/override',   ['methods'=>'POST','callback'=>[self::class,'admin_challenge_override'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/users/(?P<id>\d+)/override',  ['methods'=>'POST','callback'=>[self::class,'admin_challenge_override'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/trader/(?P<id>\d+)/override', ['methods'=>'POST','callback'=>[self::class,'admin_challenge_override'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/challenges/create-manual',    ['methods'=>'POST','callback'=>[self::class,'admin_challenge_create_manual'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/force-prices',  ['methods'=>'POST','callback'=>[self::class,'admin_force_prices'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news-lock',     ['methods'=>'POST','callback'=>[self::class,'admin_news_lock'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news-lock',     ['methods'=>'GET', 'callback'=>[self::class,'admin_news_lock_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news-events',   ['methods'=>'GET', 'callback'=>[self::class,'admin_news_events_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news/events',   ['methods'=>'GET', 'callback'=>[self::class,'admin_news_events_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news-events',   ['methods'=>'POST','callback'=>[self::class,'admin_news_events_save'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news-events/(?P<id>\d+)', ['methods'=>'DELETE','callback'=>[self::class,'admin_news_events_delete'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news/settings',      ['methods'=>'GET', 'callback'=>[self::class,'admin_news_settings_get'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/news/settings/save', ['methods'=>'POST','callback'=>[self::class,'admin_news_settings_save'],'permission_callback'=>$is_admin]);
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
        register_rest_route(self::NS, '/theme',                        ['methods'=>'GET', 'callback'=>[self::class,'branding_get'],         'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/whitelabel',                   ['methods'=>'GET', 'callback'=>[self::class,'branding_get'],         'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/admin/theme',                  ['methods'=>'POST','callback'=>[self::class,'admin_whitelabel_save'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/theme',                  ['methods'=>'GET', 'callback'=>[self::class,'admin_whitelabel_get'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners',                ['methods'=>'GET', 'callback'=>[self::class,'admin_banners_list'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/save',           ['methods'=>'POST','callback'=>[self::class,'admin_banner_save'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/(?P<id>\d+)/toggle', ['methods'=>'POST','callback'=>[self::class,'admin_banner_toggle'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/(?P<id>\d+)/delete', ['methods'=>'POST','callback'=>[self::class,'admin_banner_delete'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/banners/(?P<id>\d+)',    ['methods'=>'DELETE','callback'=>[self::class,'admin_banner_delete'], 'permission_callback'=>$is_admin]);
        // ── Coupons / promotions ──────────────────────────────────────────────
        register_rest_route(self::NS, '/coupon/validate',             ['methods'=>'POST','callback'=>[self::class,'coupon_validate'],      'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/coupons',                ['methods'=>'GET', 'callback'=>[self::class,'admin_coupons_list'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/save',           ['methods'=>'POST','callback'=>[self::class,'admin_coupon_save'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/(?P<id>\d+)/toggle', ['methods'=>'POST','callback'=>[self::class,'admin_coupon_toggle'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/(?P<id>\d+)/delete', ['methods'=>'POST','callback'=>[self::class,'admin_coupon_delete'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/coupons/(?P<id>\d+)',    ['methods'=>'DELETE','callback'=>[self::class,'admin_coupon_delete'], 'permission_callback'=>$is_admin]);
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
        register_rest_route(self::NS, '/admin/affiliates/config',      ['methods'=>'GET', 'callback'=>[self::class,'admin_affiliate_config_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates/config',      ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_config_save'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates/payout',      ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_payout_create'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates/(?P<id>\d+)/rate',   ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_rate'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/affiliates/(?P<id>\d+)/status', ['methods'=>'POST','callback'=>[self::class,'admin_affiliate_status'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/commissions',            ['methods'=>'GET', 'callback'=>[self::class,'admin_commissions_list'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/commissions/(?P<id>\d+)/status', ['methods'=>'POST','callback'=>[self::class,'admin_commission_status'], 'permission_callback'=>$is_admin]);

        // ── Visual Page Builder Schema ────────────────────────────────────────
        register_rest_route(self::NS, '/page-schema',                  ['methods'=>'GET', 'callback'=>[self::class,'public_page_schema_get'],       'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/admin/page-schema',            ['methods'=>'GET', 'callback'=>[self::class,'admin_page_schema_get'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/page-schema',            ['methods'=>'POST','callback'=>[self::class,'admin_page_schema_save'],       'permission_callback'=>$is_admin]);

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
        
        // ── Competitions & Tournaments ────────────────────────────────────────
        register_rest_route(self::NS, '/competitions',               ['methods'=>'GET', 'callback'=>[self::class,'tournaments_public_list'],    'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/competitions/(?P<id>\d+)',   ['methods'=>'GET', 'callback'=>[self::class,'tournament_public_detail'],   'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/competitions/(?P<id>\d+)/join', ['methods'=>'POST','callback'=>[self::class,'tournament_join'],         'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/competitions/(?P<id>\d+)/leaderboard', ['methods'=>'GET','callback'=>[self::class,'admin_tournament_leaderboard'], 'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/admin/competitions',         ['methods'=>'GET', 'callback'=>[self::class,'admin_tournaments_list'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/competitions',         ['methods'=>'POST','callback'=>[self::class,'admin_tournament_save'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/competitions/(?P<id>\d+)', ['methods'=>'DELETE','callback'=>[self::class,'admin_tournament_delete'],'permission_callback'=>$is_admin]);

        register_rest_route(self::NS, '/tournaments',                 ['methods'=>'GET', 'callback'=>[self::class,'tournaments_public_list'],    'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/tournaments/(?P<id>\d+)',     ['methods'=>'GET', 'callback'=>[self::class,'tournament_public_detail'],   'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/tournaments/(?P<id>\d+)/join',['methods'=>'POST','callback'=>[self::class,'tournament_join'],            'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/tournaments/(?P<id>\d+)/leaderboard', ['methods'=>'GET','callback'=>[self::class,'admin_tournament_leaderboard'],'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/admin/tournaments',          ['methods'=>'GET', 'callback'=>[self::class,'admin_tournaments_list'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tournaments/save',     ['methods'=>'POST','callback'=>[self::class,'admin_tournament_save'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tournaments/(?P<id>\d+)', ['methods'=>'DELETE','callback'=>[self::class,'admin_tournament_delete'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tournaments/(?P<id>\d+)/leaderboard', ['methods'=>'GET','callback'=>[self::class,'admin_tournament_leaderboard'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tournaments/(?P<id>\d+)/status', ['methods'=>'POST','callback'=>[self::class,'admin_tournament_status'],'permission_callback'=>$is_admin]);

        // ── 1v1 PvP E-Sports Arena ────────────────────────────────────────────
        register_rest_route(self::NS, '/pvp/matches',                  ['methods'=>'GET', 'callback'=>[self::class,'pvp_lobby_get'],           'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/pvp/match/create',             ['methods'=>'POST','callback'=>[self::class,'pvp_match_create'],        'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/pvp/match/(?P<id>\d+)/join',   ['methods'=>'POST','callback'=>[self::class,'pvp_match_join'],          'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/pvp/match/(?P<id>\d+)/live',   ['methods'=>'GET', 'callback'=>[self::class,'pvp_match_live'],          'permission_callback'=>'__return_true']);
        register_rest_route(self::NS, '/pvp/match/(?P<id>\d+)/order',  ['methods'=>'POST','callback'=>[self::class,'pvp_match_order'],         'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/pvp/match/(?P<id>\d+)/settle', ['methods'=>'POST','callback'=>[self::class,'pvp_match_settle'],        'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/pvp/match/(?P<id>\d+)/cancel', ['methods'=>'POST','callback'=>[self::class,'pvp_match_cancel'],        'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/pvp/analytics',          ['methods'=>'GET', 'callback'=>[self::class,'admin_pvp_analytics_get'], 'permission_callback'=>$is_admin]);

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
        register_rest_route(self::NS, '/admin/challenge/(?P<id>\d+)/override', ['methods'=>'POST','callback'=>[self::class,'admin_challenge_override'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/challenges/(?P<id>\d+)/override', ['methods'=>'POST','callback'=>[self::class,'admin_challenge_override'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/challenge/(?P<id>\d+)/approve-payout', ['methods'=>'POST','callback'=>[self::class,'admin_approve_payout'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/challenge/(?P<id>\d+)/mt5-details',   ['methods'=>'POST','callback'=>[self::class,'admin_save_mt5'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/challenge/(?P<id>\d+)/mt5-details',         ['methods'=>'GET', 'callback'=>[self::class,'challenge_mt5_details'], 'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/admin/plans',                        ['methods'=>'GET', 'callback'=>[self::class,'admin_plans_list'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/plans/save',                   ['methods'=>'POST','callback'=>[self::class,'admin_plan_save'],         'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/plans/(?P<id>\d+)',            ['methods'=>'DELETE','callback'=>[self::class,'admin_plan_delete'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/plans/delete',                 ['methods'=>'POST','callback'=>[self::class,'admin_plan_delete'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/plans/purge-and-reset',        ['methods'=>'POST','callback'=>[self::class,'admin_plans_purge_and_reset'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/plans/bulk-delete',            ['methods'=>'POST','callback'=>[self::class,'admin_plans_bulk_delete'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/whitelabel',                   ['methods'=>'GET', 'callback'=>[self::class,'admin_whitelabel_get'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/whitelabel/save',              ['methods'=>'POST','callback'=>[self::class,'admin_whitelabel_save'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/config/whitelabel',            ['methods'=>'GET', 'callback'=>[self::class,'admin_whitelabel_get'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/config/whitelabel',            ['methods'=>'POST','callback'=>[self::class,'admin_whitelabel_save'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/config/rules',                 ['methods'=>'GET', 'callback'=>[self::class,'admin_rules_get'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/config/rules',                 ['methods'=>'POST','callback'=>[self::class,'admin_rules_save'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/email-templates',              ['methods'=>'POST','callback'=>[self::class,'admin_email_templates_save'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/branding/upload',              ['methods'=>'POST','callback'=>[self::class,'admin_branding_upload'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/stripe/status',                ['methods'=>'GET', 'callback'=>[self::class,'admin_stripe_status'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/health',                       ['methods'=>'GET', 'callback'=>[self::class,'admin_system_health'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/status',                  ['methods'=>'GET', 'callback'=>[self::class,'admin_demo_status'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/generate',                ['methods'=>'POST','callback'=>[self::class,'admin_demo_generate'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/seed',                    ['methods'=>'POST','callback'=>[self::class,'admin_demo_generate'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/remove',                  ['methods'=>'POST','callback'=>[self::class,'admin_demo_remove'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/demo/purge',                   ['methods'=>'POST','callback'=>[self::class,'admin_demo_purge'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/marketing/broadcast',          ['methods'=>'POST','callback'=>[self::class,'admin_marketing_broadcast'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/mt5/unassigned',               ['methods'=>'GET', 'callback'=>[self::class,'admin_mt5_unassigned'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/mt5/bridge',                   ['methods'=>'GET', 'callback'=>[self::class,'admin_mt5_bridge_get'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/mt5/bridge/save',              ['methods'=>'POST','callback'=>[self::class,'admin_mt5_bridge_save'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/mt5/bridge/test',              ['methods'=>'POST','callback'=>[self::class,'admin_mt5_bridge_test'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/crypto',                       ['methods'=>'GET', 'callback'=>[self::class,'admin_crypto_get'],        'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/crypto/save',                  ['methods'=>'POST','callback'=>[self::class,'admin_crypto_save'],       'permission_callback'=>$is_admin]);
        // ── Payment gateways & Admin ─────────────────────────────────────────
        register_rest_route(self::NS, '/admin/payment-gateways',             ['methods'=>'GET', 'callback'=>[self::class,'admin_payment_gateways_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payment-gateways/save',        ['methods'=>'POST','callback'=>[self::class,'admin_payment_gateways_save'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payments',                     ['methods'=>'GET', 'callback'=>[self::class,'admin_payments_list'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payments/(?P<id>\d+)/approve', ['methods'=>'POST','callback'=>[self::class,'admin_payment_approve'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payments/(?P<id>\d+)/reject',  ['methods'=>'POST','callback'=>[self::class,'admin_payment_reject'],   'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/payments/(?P<id>\d+)/proof',   ['methods'=>'GET', 'callback'=>[self::class,'admin_payment_proof'],    'permission_callback'=>$is_admin]);
        // ── Team RBAC & Staff Management ─────────────────────────────────────
        register_rest_route(self::NS, '/admin/team',                         ['methods'=>'GET', 'callback'=>[self::class,'admin_team_list'],         'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/team/invite',                  ['methods'=>'POST','callback'=>[self::class,'admin_team_invite'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/team/(?P<id>\d+)/role',        ['methods'=>'POST','callback'=>[self::class,'admin_team_update_role'],  'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/team/(?P<id>\d+)',             ['methods'=>'DELETE','callback'=>[self::class,'admin_team_delete'],     'permission_callback'=>$is_admin]);
        // ── Certificate Templates Studio ──────────────────────────────────────
        register_rest_route(self::NS, '/admin/certificates/templates',      ['methods'=>'GET', 'callback'=>[self::class,'admin_certificates_templates_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/certificates/templates/save', ['methods'=>'POST','callback'=>[self::class,'admin_certificates_templates_save'],'permission_callback'=>$is_admin]);
        // ── Webhooks & Instant Alert Integrations ─────────────────────────────
        register_rest_route(self::NS, '/admin/webhooks',                     ['methods'=>'GET', 'callback'=>[self::class,'admin_webhooks_get'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/webhooks/save',                ['methods'=>'POST','callback'=>[self::class,'admin_webhooks_save'],    'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/webhooks/test',                ['methods'=>'POST','callback'=>[self::class,'admin_webhooks_test'],    'permission_callback'=>$is_admin]);
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
        register_rest_route(self::NS, '/admin/scaling/rules',                       ['methods'=>'GET', 'callback'=>[self::class,'admin_scaling_rules_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/scaling/rules/save',                  ['methods'=>'POST','callback'=>[self::class,'admin_scaling_rules_save'],'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/scaling/queue',                       ['methods'=>'GET', 'callback'=>[self::class,'admin_scaling_queue_get'], 'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/scaling/(?P<id>\d+)/apply',           ['methods'=>'POST','callback'=>[self::class,'admin_scaling_apply'],     'permission_callback'=>$is_admin]);
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

        // ── Support Tickets & Helpdesk ─────────────────────────────────────────
        register_rest_route(self::NS, '/tickets',                            ['methods'=>'GET', 'callback'=>[self::class,'tickets_my_list'],        'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/tickets/create',                     ['methods'=>'POST','callback'=>[self::class,'ticket_create'],          'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/tickets/(?P<id>\d+)',                ['methods'=>'GET', 'callback'=>[self::class,'ticket_my_get'],          'permission_callback'=>$auth]);
        register_rest_route(self::NS, '/tickets/(?P<id>\d+)/reply',          ['methods'=>'POST','callback'=>[self::class,'ticket_reply'],           'permission_callback'=>$auth]);

        register_rest_route(self::NS, '/admin/tickets',                      ['methods'=>'GET', 'callback'=>[self::class,'admin_tickets_list'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tickets/(?P<id>\d+)',          ['methods'=>'GET', 'callback'=>[self::class,'admin_ticket_get'],       'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tickets/(?P<id>\d+)/reply',    ['methods'=>'POST','callback'=>[self::class,'admin_ticket_reply'],     'permission_callback'=>$is_admin]);
        register_rest_route(self::NS, '/admin/tickets/(?P<id>\d+)/status',   ['methods'=>'POST','callback'=>[self::class,'admin_ticket_status'],    'permission_callback'=>$is_admin]);
    }

    // ── Permission callbacks ──────────────────────────────────────────────────
    public static function auth_check(): bool {
        if (get_current_user_id() === 0 && class_exists('ProTradeFX_Headless_Bridge')) {
            $uid = ProTradeFX_Headless_Bridge::force_cookie_auth(0);
            if ($uid > 0) wp_set_current_user($uid);
        }
        if (class_exists('FXSIM_API_Keys') && FXSIM_API_Keys::is_key_request()) {
            $uid = (int) get_current_user_id();
            if ($uid === 0 && FXSIM_API_Keys::current_key() !== null) {
                $uid = (int) FXSIM_API_Keys::current_key()->user_id;
                wp_set_current_user($uid);
            }
            return $uid > 0;
        }
        return is_user_logged_in();
    }

    /**
     * Map staff roles to permitted modules/capabilities.
     */
    public static function get_role_capabilities(string $role): array {
        $roles = [
            'super_admin' => [
                'overview', 'traders', 'risk', 'payouts', 'kyc', 'payments',
                'marketing', 'helpdesk', 'operations', 'config', 'team', 'builder', 'tournaments', 'pvp'
            ],
            'risk_officer' => [
                'overview', 'traders', 'risk', 'kyc', 'helpdesk', 'operations', 'tournaments', 'pvp'
            ],
            'support_agent' => [
                'overview', 'traders', 'kyc', 'marketing', 'helpdesk'
            ],
            'accountant' => [
                'overview', 'payouts', 'payments', 'helpdesk'
            ],
        ];
        return $roles[$role] ?? $roles['support_agent'];
    }

    /**
     * Resolve required module capability based on the REST route.
     */
    public static function resolve_route_capability(string $route): string {
        $clean = strtolower(trim($route));
        if (strpos($clean, '/admin/team') !== false) return 'team';
        if (strpos($clean, '/admin/smtp') !== false || strpos($clean, '/admin/theme') !== false || strpos($clean, '/admin/config') !== false || strpos($clean, '/admin/rate-limit') !== false || strpos($clean, '/admin/whitelabel') !== false) return 'config';
        if (strpos($clean, '/admin/risk') !== false || strpos($clean, '/admin/syndicate') !== false) return 'risk';
        if (strpos($clean, '/admin/payout') !== false || strpos($clean, '/admin/bulk/payouts') !== false) return 'payouts';
        if (strpos($clean, '/admin/kyc') !== false || strpos($clean, '/admin/bulk/kyc') !== false) return 'kyc';
        if (strpos($clean, '/admin/payment') !== false) return 'payments';
        if (strpos($clean, '/admin/banners') !== false || strpos($clean, '/admin/coupons') !== false || strpos($clean, '/admin/affiliate') !== false || strpos($clean, '/admin/commissions') !== false || strpos($clean, '/admin/bulk-email') !== false || strpos($clean, '/admin/announcement') !== false || strpos($clean, '/admin/marketing') !== false) return 'marketing';
        if (strpos($clean, '/admin/helpdesk') !== false || strpos($clean, '/admin/support') !== false || strpos($clean, '/admin/tickets') !== false) return 'helpdesk';
        if (strpos($clean, '/admin/operations') !== false || strpos($clean, '/admin/maintenance') !== false || strpos($clean, '/admin/force-prices') !== false || strpos($clean, '/admin/price-feed') !== false || strpos($clean, '/admin/news') !== false) return 'operations';
        if (strpos($clean, '/admin/tournaments') !== false || strpos($clean, '/admin/competitions') !== false) return 'tournaments';
        if (strpos($clean, '/admin/pvp') !== false) return 'pvp';
        if (strpos($clean, '/admin/builder') !== false || strpos($clean, '/admin/page-schema') !== false) return 'builder';
        if (strpos($clean, '/admin/user') !== false || strpos($clean, '/admin/trader') !== false || strpos($clean, '/admin/position') !== false || strpos($clean, '/admin/symbol') !== false || strpos($clean, '/admin/trades') !== false || strpos($clean, '/admin/log') !== false || strpos($clean, '/admin/adjust-balance') !== false || strpos($clean, '/admin/test-tools') !== false || strpos($clean, '/admin/set-status') !== false || strpos($clean, '/admin/impersonate') !== false) return 'traders';
        return 'overview';
    }

    /**
     * Check if a given user has capability for an admin module.
     */
    public static function user_has_admin_cap(int $uid, string $required_cap): bool {
        if ($uid <= 0) return false;

        $status = get_user_meta($uid, 'fxsim_account_status', true);
        if ($status === 'suspended' || $status === 'banned') {
            return false;
        }

        // Primary Super Admin or WP core administrator with no custom role assigned
        if ($uid === 1 || is_super_admin($uid)) {
            return true;
        }

        $staff_role = get_user_meta($uid, 'fxsim_admin_role', true);
        if (!$staff_role) {
            return user_can($uid, 'manage_options');
        }

        if ($staff_role === 'super_admin') {
            return true;
        }

        $caps = self::get_role_capabilities($staff_role);
        return in_array($required_cap, $caps, true);
    }

    public static function admin_check($request = null): bool {
        if (get_current_user_id() === 0 && class_exists('ProTradeFX_Headless_Bridge')) {
            $uid = ProTradeFX_Headless_Bridge::force_cookie_auth(0);
            if ($uid > 0) wp_set_current_user($uid);
        }
        if (class_exists('FXSIM_API_Keys') && FXSIM_API_Keys::is_key_request()) {
            $uid = (int) get_current_user_id();
            if ($uid === 0 && FXSIM_API_Keys::current_key() !== null) {
                $uid = (int) FXSIM_API_Keys::current_key()->user_id;
                wp_set_current_user($uid);
            }
        } else {
            $uid = (int) get_current_user_id();
        }

        if ($uid <= 0) return false;

        // Check if suspended
        $status = get_user_meta($uid, 'fxsim_account_status', true);
        if ($status === 'suspended' || $status === 'banned') {
            return false;
        }

        if ($uid === 1 || is_super_admin($uid)) {
            return true;
        }

        $route = '';
        if ($request instanceof WP_REST_Request) {
            $route = $request->get_route();
        } elseif (isset($_SERVER['REQUEST_URI'])) {
            $route = $_SERVER['REQUEST_URI'];
        }

        $cap = self::resolve_route_capability($route);
        return self::user_has_admin_cap($uid, $cap);
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
        $acc = self::get_active_challenge_account($uid);
        if ($acc) {
            global $wpdb;
            // IP Matching Check (Phase 2.5)
            $ip_check = $wpdb->get_row($wpdb->prepare(
                "SELECT cp.ip_matching_required, ca.signup_ip, ca.id as challenge_account_id
                 FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                 JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
                 WHERE ca.fxsim_account_id = %d AND ca.status IN ('active','funded') LIMIT 1",
                $acc->id
            ));
            
            if ($ip_check && (int)$ip_check->ip_matching_required && !empty($ip_check->signup_ip)) {
                $current_ip = class_exists('FXSIM_Rate_Limiter') ? FXSIM_Rate_Limiter::get_client_ip() : ($_SERVER['REMOTE_ADDR'] ?? '');
                if ($current_ip && $current_ip !== $ip_check->signup_ip) {
                    // Log the mismatch flag
                    $wpdb->insert($wpdb->prefix . 'fxsim_trade_flags', [
                        'user_id'    => $uid,
                        'account_id' => $acc->id,
                        'flag_type'  => 'ip_mismatch',
                        'details'    => "IP Mismatch. Signup: {$ip_check->signup_ip}, Current: {$current_ip}",
                        'flagged_at' => gmdate('Y-m-d H:i:s')
                    ]);
                    
                    if (get_option('fxsim_ip_strict_mode', false)) {
                        return ['ok' => false, 'code' => 'ip_mismatch', 'message' => 'Trading is blocked due to IP mismatch. Please contact support.'];
                    }
                }
            }

            return ['ok' => true];
        }

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
            'users'             => $safe_count("SELECT COUNT(*) FROM {$wpdb->users} WHERE ID NOT IN (" . self::not_admin_subquery() . ") AND user_login != 'admin'"),
            'open_positions'    => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_positions"),
            'total_trades'      => $safe_count("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trades"),
            'total_pnl'         => $safe_sum("SELECT COALESCE(SUM(pnl),0) FROM {$wpdb->prefix}fxsim_trades"),
            'total_revenue'     => $safe_sum("SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))),0) FROM {$wpdb->prefix}fxsim_payment_orders WHERE status='approved'"),
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
        $limit  = max(1, min(100, (int)($r->get_param('limit') ?? 25)));
        $offset = ($page - 1) * $limit;

        $where_clause = 'WHERE 1=1';
        $params_count = [];
        $params_rows  = [];

        if ($search !== '') {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $where_clause .= ' AND (u.user_login LIKE %s OR u.user_email LIKE %s)';
            $params_count = [$like, $like];
            $params_rows  = [$like, $like];
        }

        $count_sql = "SELECT COUNT(DISTINCT u.ID) FROM {$wpdb->prefix}users u {$where_clause}";
        $total = (int)(!empty($params_count)
            ? $wpdb->get_var($wpdb->prepare($count_sql, $params_count))
            : $wpdb->get_var($count_sql));

        $params_rows[] = $limit;
        $params_rows[] = $offset;

        // LEFT JOIN so users without a fxsim_account still appear
        $query = "
            SELECT
                u.ID        AS user_id,
                u.user_login,
                u.user_email,
                u.user_registered,
                COALESCE(MAX(a.balance),    0)        AS balance,
                COALESCE(MAX(a.equity),     0)        AS equity,
                COALESCE(MAX(a.margin_used),0)        AS margin_used,
                COALESCE(MAX(a.status),     'no_account') AS status,
                COALESCE(MAX(k.status),     'unverified') AS kyc_status,
                MAX(a.id)        AS account_id,
                (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                 WHERE ca.user_id = u.ID AND ca.status = 'active')   AS active_challenges,
                (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts ca2
                 WHERE ca2.user_id = u.ID AND ca2.status = 'funded') AS funded_challenges
            FROM {$wpdb->prefix}users u
            LEFT JOIN {$wpdb->prefix}fxsim_accounts a ON a.user_id = u.ID
            LEFT JOIN {$wpdb->prefix}fxsim_kyc k ON k.user_id = u.ID
            {$where_clause}
            GROUP BY u.ID
            ORDER BY u.ID DESC
            LIMIT %d OFFSET %d
        ";

        $rows = $wpdb->get_results($wpdb->prepare($query, $params_rows));

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

    /** POST /admin/user/{id}/note — save a private admin note on a trader (append-only audit trail). */
    public static function admin_user_note_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $uid  = (int) $r->get_param('id');
        if (!get_userdata($uid)) return new WP_REST_Response(['success' => false, 'message' => 'User not found.'], 404);
        $body = $r->get_json_params() ?: $r->get_body_params();
        $note = sanitize_textarea_field($body['note'] ?? '');
        if ($note !== '') {
            $author_id = get_current_user_id();
            $res = $wpdb->insert($wpdb->prefix . 'fxsim_admin_notes', [
                'user_id'    => $uid,
                'author_id'  => $author_id,
                'note'       => $note,
                'created_at' => current_time('mysql'),
            ]);
            if ($res === false) {
                return new WP_REST_Response(['success' => false, 'message' => 'Failed to save admin note to database table.'], 500);
            }
            update_user_meta($uid, 'fxsim_admin_note', $note);
            FXSIM_Database::log_admin($author_id, 'user_note_save', $uid, mb_substr($note, 0, 100));
        }
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
            "SELECT id, plan_id, phase, status, starting_balance, current_balance, trading_days, created_at, phase_started_at,
                    custom_profit_split, custom_daily_dd, custom_max_dd, custom_min_days, custom_news_trading, custom_weekend_holding, override_admin_note
             FROM {$pfx}fxsim_challenge_accounts WHERE user_id=%d ORDER BY created_at DESC", $uid)) ?: [];
        $active_challenge = $wpdb->get_row($wpdb->prepare(
            "SELECT ca.*, cp.name as plan_name, cp.plan_type, cp.drawdown_type as plan_drawdown_type, cp.funded_profit_split as plan_profit_split
             FROM {$pfx}fxsim_challenge_accounts ca
             LEFT JOIN {$pfx}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE ca.user_id=%d ORDER BY ca.id DESC LIMIT 1", $uid));
        if ($active_challenge) {
            $active_challenge->mt5_password_set = !empty($active_challenge->mt5_password);
            unset($active_challenge->mt5_password);
        }
        $payments = $wpdb->get_results($wpdb->prepare(
            "SELECT id, plan_id, amount, gateway, status, created_at, reviewed_at
             FROM {$pfx}fxsim_payment_orders WHERE user_id=%d ORDER BY created_at DESC", $uid)) ?: [];
        $payouts = $wpdb->get_results($wpdb->prepare(
            "SELECT id, challenge_id, amount_requested, trader_amount, status, admin_note, requested_at, reviewed_at
             FROM {$pfx}fxsim_payouts WHERE user_id=%d ORDER BY requested_at DESC", $uid)) ?: [];
        $kyc = $wpdb->get_row($wpdb->prepare(
            "SELECT id, status, admin_note, reviewed_at FROM {$pfx}fxsim_kyc WHERE user_id=%d ORDER BY id DESC LIMIT 1", $uid));
        $account = $wpdb->get_row($wpdb->prepare(
            "SELECT a.id as account_id, a.status, a.balance, a.equity, a.margin_used, a.leverage FROM {$pfx}fxsim_accounts a WHERE a.user_id=%d ORDER BY a.id DESC LIMIT 1", $uid));
        $admin_actions = $wpdb->get_results($wpdb->prepare(
            "SELECT action, details, created_at FROM {$pfx}fxsim_admin_log WHERE target_user_id=%d ORDER BY created_at DESC LIMIT 50", $uid)) ?: [];

        // Closed trades
        $trades = $wpdb->get_results($wpdb->prepare(
            "SELECT t.* FROM {$pfx}fxsim_trades t
             JOIN {$pfx}fxsim_accounts a ON t.account_id=a.id
             WHERE a.user_id=%d ORDER BY t.closed_at DESC LIMIT 50", $uid)) ?: [];

        // Open live positions
        $positions = $wpdb->get_results($wpdb->prepare(
            "SELECT p.* FROM {$pfx}fxsim_positions p
             JOIN {$pfx}fxsim_accounts a ON p.account_id=a.id
             WHERE a.user_id=%d ORDER BY p.opened_at DESC", $uid)) ?: [];

        // Breach audit logs
        $breaches = $wpdb->get_results($wpdb->prepare(
            "SELECT b.* FROM {$pfx}fxsim_challenge_breaches b
             WHERE b.user_id=%d ORDER BY b.created_at DESC LIMIT 50", $uid)) ?: [];

        // Build a unified, chronological timeline from existing rows.
        $tl = [];
        $tl[] = ['type' => 'registration', 'label' => 'Registered', 'at' => $u->user_registered];
        if (get_user_meta($uid, 'fxsim_email_verified', true)) $tl[] = ['type' => 'verification', 'label' => 'Email verified', 'at' => null];
        foreach ($payments as $p)   $tl[] = ['type' => 'payment',   'label' => 'Payment ' . $p->status . ' ($' . number_format((float)$p->amount, 0) . ')', 'at' => $p->created_at];
        foreach ($challenges as $c) $tl[] = ['type' => 'challenge', 'label' => 'Challenge #' . $c->id . ' — ' . $c->status . ' (phase ' . $c->phase . ')', 'at' => $c->created_at];
        foreach ($payouts as $po)   $tl[] = ['type' => 'payout',    'label' => 'Payout ' . $po->status . ' ($' . number_format((float)$po->trader_amount, 0) . ')', 'at' => $po->requested_at];
        if ($kyc) $tl[] = ['type' => 'kyc', 'label' => 'KYC ' . $kyc->status, 'at' => $kyc->reviewed_at];
        foreach ($breaches as $b)   $tl[] = ['type' => 'breach',    'label' => 'Breach: ' . $b->rule_type . ' (' . $b->description . ')', 'at' => $b->created_at];
        foreach ($admin_actions as $a) $tl[] = ['type' => 'admin', 'label' => 'Admin: ' . str_replace('_', ' ', $a->action) . ($a->details ? ' — ' . $a->details : ''), 'at' => $a->created_at];
        usort($tl, fn($x, $y) => strcmp((string)($y['at'] ?? ''), (string)($x['at'] ?? '')));

        // Fetch persistent admin notes
        $notes = $wpdb->get_results($wpdb->prepare(
            "SELECT an.*, u.display_name as author_name, u.user_login as author_login 
             FROM {$pfx}fxsim_admin_notes an
             LEFT JOIN {$wpdb->users} u ON an.author_id = u.ID
             WHERE an.user_id = %d ORDER BY an.created_at DESC LIMIT 50", $uid
        )) ?: [];

        $meta_status = (string) get_user_meta($uid, 'fxsim_account_status', true) ?: 'active';
        $acc_status = $account ? (string) $account->status : $meta_status;

        return new WP_REST_Response([
            'success'        => true,
            'user'           => ['id' => $uid, 'username' => $u->user_login, 'email' => $u->user_email, 'display_name' => $u->display_name, 'registered' => $u->user_registered, 'status' => $meta_status],
            'account'        => $account ?: null,
            'account_status' => $acc_status,
            'challenge'      => $active_challenge ?: null,
            'note'           => (string) get_user_meta($uid, 'fxsim_admin_note', true),
            'notes'          => array_map(fn($n) => [
                'id'         => (int) $n->id,
                'author'     => $n->author_name ?: ($n->author_login ?: 'Admin Staff'),
                'role'       => 'Compliance Officer',
                'content'    => $n->note,
                'date'       => self::iso8601($n->created_at),
                'created_at' => $n->created_at,
            ], $notes),
            'challenges'     => $challenges,
            'payments'       => $payments,
            'payouts'        => $payouts,
            'kyc'            => $kyc ?: null,
            'trades'         => $trades,
            'positions'      => $positions,
            'breaches'       => $breaches,
            'timeline'       => $tl,
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

    /** GET /admin/risk/alerts — Aggregated real-time breach & risk exposure alerts */
    public static function admin_risk_alerts(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $pfx = $wpdb->prefix;

        $breaches = $wpdb->get_results("
            SELECT b.*, u.user_email, u.display_name, ca.id as challenge_id, ca.fxsim_account_id
            FROM {$pfx}fxsim_challenge_breaches b
            LEFT JOIN {$wpdb->users} u ON b.user_id = u.ID
            LEFT JOIN {$pfx}fxsim_challenge_accounts ca ON b.challenge_id = ca.id
            ORDER BY b.created_at DESC
            LIMIT 50
        ") ?: [];

        $toxic_trades = $wpdb->get_results("
            SELECT t.*, u.user_email, u.display_name, a.user_id
            FROM {$pfx}fxsim_trades t
            LEFT JOIN {$pfx}fxsim_accounts a ON t.account_id = a.id
            LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
            WHERE t.is_toxic = 1 OR TIMESTAMPDIFF(SECOND, t.opened_at, t.closed_at) < 30
            ORDER BY t.closed_at DESC
            LIMIT 30
        ") ?: [];

        $heavy_positions = $wpdb->get_results("
            SELECT p.account_id, a.user_id, u.user_email, u.display_name, COUNT(p.id) as position_count, SUM(p.lot_size) as total_lots, SUM(p.pnl) as floating_pnl
            FROM {$pfx}fxsim_positions p
            LEFT JOIN {$pfx}fxsim_accounts a ON p.account_id = a.id
            LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
            GROUP BY p.account_id, a.user_id, u.user_email, u.display_name
            HAVING COUNT(p.id) >= 3 OR SUM(p.lot_size) >= 20.0
            ORDER BY total_lots DESC
            LIMIT 20
        ") ?: [];

        $hft_risks = [];
        foreach ($toxic_trades as $tt) {
            $uid = (int) $tt->user_id;
            if (!isset($hft_risks[$uid])) {
                $hft_risks[$uid] = [
                    'user_id' => $uid,
                    'user_email' => $tt->user_email ?: 'trader@propfirm.com',
                    'count' => 0,
                ];
            }
            $hft_risks[$uid]['count']++;
        }

        $gambling_risks = [];
        foreach ($heavy_positions as $hp) {
            $gambling_risks[] = [
                'user_id' => (int) $hp->user_id,
                'user_email' => $hp->user_email ?: 'trader@propfirm.com',
                'count' => (int) $hp->position_count,
                'total_lots' => (float) $hp->total_lots,
                'floating_pnl' => (float) $hp->floating_pnl,
            ];
        }

        $flat_alerts = [];
        $user_account_cache = [];
        foreach ($breaches as $b) {
            $acc_label = '';
            if ($b->challenge_id) {
                $acc_label = '#CH-' . $b->challenge_id;
            } elseif (!empty($b->fxsim_account_id)) {
                $acc_label = '#ACC-' . $b->fxsim_account_id;
            } else {
                $uid = (int) $b->user_id;
                if (!isset($user_account_cache[$uid])) {
                    $user_account_cache[$uid] = (int)$wpdb->get_var($wpdb->prepare(
                        "SELECT id FROM {$pfx}fxsim_accounts WHERE user_id = %d ORDER BY id DESC LIMIT 1", $uid
                    ));
                }
                $acc_label = $user_account_cache[$uid] ? ('#ACC-' . $user_account_cache[$uid]) : ('#USER-' . $uid);
            }

            $flat_alerts[] = [
                'id'          => 'br_' . $b->id,
                'user_id'     => (int) $b->user_id,
                'account_id'  => $acc_label,
                'trader_name' => $b->display_name ?: ('Trader #' . $b->user_id),
                'email'       => $b->user_email ?: 'trader@propfirm.com',
                'rule_type'   => $b->rule_type ?: 'Drawdown Limit Exceeded',
                'risk_level'  => 'critical',
                'details'     => $b->description ?: 'Algorithmic risk breach triggered.',
                'detected_at' => self::iso8601($b->created_at),
                'open_lots'   => 0,
            ];
        }
        foreach ($heavy_positions as $hp) {
            $flat_alerts[] = [
                'id'          => 'hp_' . $hp->account_id,
                'user_id'     => (int) $hp->user_id,
                'account_id'  => '#ACC-' . $hp->account_id,
                'trader_name' => $hp->display_name ?: ('Trader #' . $hp->user_id),
                'email'       => $hp->user_email ?: 'trader@propfirm.com',
                'rule_type'   => 'Over-leveraged Exposure (' . $hp->position_count . ' pos)',
                'risk_level'  => 'high',
                'details'     => 'Total open lots: ' . number_format((float)$hp->total_lots, 2) . ' | Floating PnL: $' . number_format((float)$hp->floating_pnl, 2),
                'detected_at' => current_time('mysql'),
                'open_lots'   => (float) $hp->total_lots,
            ];
        }
        foreach ($toxic_trades as $tt) {
            $flat_alerts[] = [
                'id'          => 'tt_' . $tt->id,
                'user_id'     => (int) $tt->user_id,
                'account_id'  => '#ACC-' . $tt->account_id,
                'trader_name' => $tt->display_name ?: ('Trader #' . $tt->user_id),
                'email'       => $tt->user_email ?: 'trader@propfirm.com',
                'rule_type'   => 'HFT / Toxic Latency Arbitrage',
                'risk_level'  => 'high',
                'details'     => 'Trade closed under 30s (' . $tt->symbol . ' ' . $tt->lot_size . ' lots)',
                'detected_at' => self::iso8601($tt->closed_at),
                'open_lots'   => 0,
            ];
        }

        return new WP_REST_Response([
            'open_flags'     => count($breaches) + count($heavy_positions),
            'breaches'       => $breaches,
            'hft_risks'      => array_values($hft_risks),
            'gambling_risks' => $gambling_risks,
            'toxic_trades'   => $toxic_trades,
            'alerts'         => $flat_alerts,
        ]);
    }

    public static function admin_risk_force_close(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $user_id = (int)($body['user_id'] ?? 0);
        $raw_acc = $body['account_id'] ?? 0;
        $account_id = 0;

        if (is_numeric($raw_acc) && (int)$raw_acc > 0) {
            $account_id = (int)$raw_acc;
        } elseif (is_string($raw_acc) && trim($raw_acc) !== '') {
            if (preg_match('/#CH-(\d+)/i', $raw_acc, $m)) {
                $ch_id = (int)$m[1];
                $account_id = (int)$wpdb->get_var($wpdb->prepare("SELECT fxsim_account_id FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d", $ch_id));
            } elseif (preg_match('/#ACC-(\d+)/i', $raw_acc, $m)) {
                $account_id = (int)$m[1];
            } else {
                $digits = (int)preg_replace('/\D/', '', $raw_acc);
                if ($digits > 0) $account_id = $digits;
            }
        }

        if (!$account_id && $user_id) {
            $account_id = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}fxsim_accounts WHERE user_id = %d ORDER BY id DESC LIMIT 1", $user_id));
        }

        if ($account_id && !$user_id) {
            $user_id = (int) $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $account_id));
        }

        if (!$account_id || !$user_id) {
            return new WP_REST_Response(['success' => false, 'message' => 'Account or trader not found.'], 404);
        }

        // Ownership validation: verify that $account_id exists and genuinely belongs to $user_id
        $owner_id = (int) $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $account_id));
        if ($owner_id === 0) {
            return new WP_REST_Response(['success' => false, 'message' => "Account #{$account_id} does not exist."], 404);
        }
        if ($owner_id !== $user_id) {
            return new WP_REST_Response(['success' => false, 'message' => "Account #{$account_id} does not belong to trader #{$user_id}."], 400);
        }

        $open_positions = $wpdb->get_results($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_positions WHERE account_id = %d", $account_id
        )) ?: [];

        if (empty($open_positions)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => "No open positions found on account #{$account_id} to liquidate.",
                'closed_count' => 0
            ], 200);
        }

        $closed = 0;
        $last_err = '';
        foreach ($open_positions as $op) {
            $res = FXSIM_Trading_Engine::close_position($user_id, (int)$op->id, 'admin_force_close', true, $account_id);
            if (!empty($res['success'])) {
                $closed++;
            } else {
                $last_err = $res['message'] ?? 'Position close rejected';
            }
        }

        if ($closed === 0) {
            return new WP_REST_Response([
                'success' => false,
                'message' => "Failed to liquidate positions on account #{$account_id}: " . ($last_err ?: 'All close attempts failed.'),
                'closed_count' => 0
            ], 200);
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'force_close_positions', $user_id, "Closed {$closed} positions for account #{$account_id}");

        return new WP_REST_Response([
            'success' => true,
            'message' => "Successfully liquidated {$closed} open positions on account #{$account_id} at market price.",
            'closed_count' => $closed
        ]);
    }

    public static function admin_risk_flag_trader(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $user_id = (int)($body['user_id'] ?? 0);
        $reason = sanitize_text_field($body['reason'] ?? 'Algorithmic Anomaly / Compliance Risk Flag');

        if (!$user_id) {
            return new WP_REST_Response(['success' => false, 'message' => 'Trader ID required.'], 400);
        }

        update_user_meta($user_id, 'fxsim_risk_flagged', 1);
        update_user_meta($user_id, 'fxsim_risk_flag_reason', $reason);
        update_user_meta($user_id, 'fxsim_risk_flagged_at', current_time('mysql'));

        FXSIM_Database::log_admin(get_current_user_id(), 'flag_trader_risk', $user_id, $reason);
        FXSIM_Database::push_admin_notification('warning', 'Trader Risk Flagged', "Trader #{$user_id} was flagged: {$reason}", $user_id, "/admin/traders/{$user_id}");

        return new WP_REST_Response([
            'success' => true,
            'message' => "Trader #{$user_id} tagged with Compliance Risk Flag."
        ]);
    }

    // ── Anti-Syndicate Fraud & Group Hedging Radar ───────────────────────────
    public static function admin_risk_syndicates_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $table = $wpdb->prefix . 'fxsim_syndicate_clusters';

        $settings = get_option('fxsim_syndicate_radar_settings', [
            'time_delta_ms' => 1500,
            'lot_match_pct' => 85,
            'ip_mode'       => 'subnet_24',
        ]);

        $clusters = $wpdb->get_results("
            SELECT sc.*, 
                   ua.display_name AS trader_a_name, ua.user_email AS trader_a_email,
                   ub.display_name AS trader_b_name, ub.user_email AS trader_b_email
            FROM {$table} sc
            LEFT JOIN {$wpdb->users} ua ON sc.user_a_id = ua.ID
            LEFT JOIN {$wpdb->users} ub ON sc.user_b_id = ub.ID
            ORDER BY sc.id DESC LIMIT 50
        ", ARRAY_A) ?: [];

        return new WP_REST_Response([
            'success'  => true,
            'settings' => $settings,
            'clusters' => $clusters,
        ]);
    }

    public static function admin_risk_syndicates_save_settings(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $clean = [
            'time_delta_ms' => max(100, min(10000, (int)($body['time_delta_ms'] ?? 1500))),
            'lot_match_pct' => max(50, min(100, (int)($body['lot_match_pct'] ?? 85))),
            'ip_mode'       => in_array($body['ip_mode'] ?? '', ['exact', 'subnet_24'], true) ? $body['ip_mode'] : 'subnet_24',
        ];
        update_option('fxsim_syndicate_radar_settings', $clean, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'syndicate_radar_settings_save');
        return new WP_REST_Response(['success' => true, 'message' => 'Syndicate radar settings saved.', 'settings' => $clean]);
    }

    public static function admin_risk_syndicate_freeze(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int)$r->get_param('id');
        $cluster = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_syndicate_clusters WHERE id = %d", $id));

        if (!$cluster) {
            return new WP_REST_Response(['error' => 'Syndicate cluster record not found.'], 404);
        }

        $now = current_time('mysql');

        // 1. Mark cluster status frozen
        $wpdb->update($wpdb->prefix . 'fxsim_syndicate_clusters', [
            'status'    => 'frozen',
            'frozen_at' => $now,
        ], ['id' => $id]);

        // 2. Liquidate open positions for Account A and Account B
        $accounts = [(int)$cluster->account_a_id, (int)$cluster->account_b_id];
        foreach ($accounts as $acc_id) {
            // The previous code did a raw UPDATE on fxsim_positions setting
            // 'closed_at' — that column does not exist on this table (a
            // position that's actually closed is deleted here and moved to
            // fxsim_trades, never updated in place), so this silently no-op'd
            // and left every "liquidated" position open and unmanaged. Route
            // through the real close_position(), matching the pattern used
            // by force_close_all_positions() elsewhere.
            $acc_row = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $acc_id));
            if ($acc_row && class_exists('FXSIM_Trading_Engine')) {
                $open_positions = $wpdb->get_results($wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}fxsim_positions WHERE account_id = %d", $acc_id
                ));
                foreach ($open_positions as $op) {
                    FXSIM_Trading_Engine::close_position((int)$acc_row->user_id, (int)$op->id, 'syndicate_freeze', true);
                }
            }

            // 'breached' is not a valid fxsim_challenge_accounts.status value
            // (ENUM('active','passed','failed','funded','suspended')) — this
            // previously either failed the UPDATE outright or silently wrote
            // an empty string under non-strict SQL mode. 'suspended' is the
            // correct value and matches the notification text below.
            $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                'status'        => 'suspended',
                'breach_reason' => 'Syndicate Cross-Account Reverse Hedging Violation (Cluster ' . $cluster->cluster_code . ')',
            ], ['fxsim_account_id' => $acc_id]);

            $acc = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $acc_id));
            if ($acc) {
                FXSIM_Database::push_notification(
                    (int)$acc->user_id,
                    'danger',
                    'Account Suspended (Syndicate Violation)',
                    'Your account has been frozen for coordinated reverse-hedging / group collusion across identical IP subnets.',
                    '/dashboard'
                );
            }
        }

        FXSIM_Database::log_admin(
            get_current_user_id(),
            'syndicate_cluster_frozen',
            (int)$cluster->user_a_id,
            "Cluster {$cluster->cluster_code} (Accounts #{$cluster->account_a_id} & #{$cluster->account_b_id}) frozen and liquidated."
        );

        if (class_exists('FXSIM_Webhooks')) {
            FXSIM_Webhooks::dispatch('syndicate_cluster_frozen', [
                'cluster_code' => $cluster->cluster_code,
                'accounts'     => "#{$cluster->account_a_id} & #{$cluster->account_b_id}",
                'symbol'       => $cluster->symbol,
                'status'       => 'LIQUIDATED & SUSPENDED',
            ]);
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => "Cluster {$cluster->cluster_code} successfully frozen. Active positions liquidated and associated challenge accounts suspended.",
        ]);
    }

    /** POST /admin/symbol/create — Create new tradeable instrument */
    public static function admin_symbol_create(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        if (empty($body['symbol'])) {
            return new WP_REST_Response(['success' => false, 'message' => 'Symbol is required.'], 400);
        }
        $id = FXSIM_Symbols::create($body);
        FXSIM_Database::log_admin(get_current_user_id(), 'symbol_create', null, 'Created symbol: ' . strtoupper($body['symbol']));
        return new WP_REST_Response(['success' => true, 'id' => $id, 'message' => 'Symbol created successfully.']);
    }

    /** DELETE /admin/symbol/{id} or POST /admin/symbol/{id}/delete */
    public static function admin_symbol_delete(WP_REST_Request $r): WP_REST_Response {
        $id = (int) $r->get_param('id');
        $res = FXSIM_Symbols::delete($id);
        FXSIM_Database::log_admin(get_current_user_id(), 'symbol_delete', null, 'Deleted symbol ID: ' . $id);
        return new WP_REST_Response(['success' => $res]);
    }

    /** POST /admin/position/{id}/close — Admin force close open position */
    public static function admin_position_close(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_positions WHERE id=%d", $id));
        if (!$p) {
            return new WP_REST_Response(['success' => false, 'message' => 'Position not found.'], 404);
        }

        // Close position
        $close_price = (float)$p->current_price > 0 ? (float)$p->current_price : (float)$p->open_price;
        $pnl = (float)$p->pnl;
        
        $wpdb->insert($wpdb->prefix . 'fxsim_trades', [
            'account_id'   => $p->account_id,
            'symbol'       => $p->symbol,
            'type'         => $p->type,
            'lot_size'     => $p->lot_size,
            'open_price'   => $p->open_price,
            'close_price'  => $close_price,
            'sl'           => $p->sl,
            'tp'           => $p->tp,
            'margin'       => $p->margin,
            'commission'   => $p->commission,
            'swap'         => $p->swap,
            'pnl'          => $pnl,
            'close_reason' => 'admin_force',
            'opened_at'    => $p->opened_at,
            'closed_at'    => current_time('mysql'),
        ]);

        $wpdb->delete($wpdb->prefix . 'fxsim_positions', ['id' => $id]);
        
        // Update account balance
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}fxsim_accounts SET balance = balance + %f, equity = equity + %f WHERE id=%d", $pnl, $pnl, $p->account_id));

        FXSIM_Database::log_admin(get_current_user_id(), 'position_force_close', null, "Position #{$id} force closed. PnL: {$pnl}");
        return new WP_REST_Response(['success' => true, 'pnl' => $pnl, 'message' => "Position #{$id} closed by admin."]);
    }

    /** POST /admin/position/{id}/sltp — Update SL / TP on position */
    public static function admin_position_sltp(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();

        $update = [];
        if (array_key_exists('sl', $body)) {
            $update['sl'] = $body['sl'] !== null ? (float)$body['sl'] : null;
        }
        if (array_key_exists('tp', $body)) {
            $update['tp'] = $body['tp'] !== null ? (float)$body['tp'] : null;
        }

        if (empty($update)) {
            return new WP_REST_Response(['success' => false, 'message' => 'No SL/TP parameters provided.'], 400);
        }

        $wpdb->update($wpdb->prefix . 'fxsim_positions', $update, ['id' => $id]);
        return new WP_REST_Response(['success' => true, 'message' => "SL/TP updated for position #{$id}"]);
    }

    /** POST /admin/user/create or /admin/users/create — Create new user with challenge */
    public static function admin_user_create(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $username = sanitize_user($body['username'] ?? '');
        $email = sanitize_email($body['email'] ?? '');
        $password = $body['password'] ?? wp_generate_password(12, true);

        if (empty($username) || empty($email)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Username and email are required.'], 400);
        }

        $user_id = wp_create_user($username, $password, $email);
        if (is_wp_error($user_id)) {
            return new WP_REST_Response(['success' => false, 'message' => $user_id->get_error_message()], 400);
        }

        if (!empty($body['role'])) {
            $u = new WP_User($user_id);
            $u->set_role(sanitize_text_field($body['role']));
        }

        // Initialize account with initial balance
        global $wpdb;
        $init_bal = (float)($body['initial_balance'] ?? 100000.00);
        $wpdb->insert($wpdb->prefix . 'fxsim_accounts', [
            'user_id' => $user_id,
            'balance' => $init_bal,
            'equity'  => $init_bal,
            'status'  => 'active',
        ]);

        FXSIM_Database::log_admin(get_current_user_id(), 'user_create', $user_id, "Created user {$username} ({$email})");
        return new WP_REST_Response([
            'success' => true,
            'user_id' => $user_id,
            'message' => 'User created successfully.',
        ]);
    }

    /** POST /admin/user/{id}/reset-password */
    public static function admin_user_reset_pw(WP_REST_Request $r): WP_REST_Response {
        $uid = (int) $r->get_param('id');
        $u = get_userdata($uid);
        if (!$u) return new WP_REST_Response(['success' => false, 'message' => 'User not found.'], 404);

        $body = $r->get_json_params() ?: $r->get_body_params();
        $custom_pw = !empty($body['password']) ? trim((string)$body['password']) : '';

        $new_pw = ($custom_pw !== '' && strlen($custom_pw) >= 4) ? $custom_pw : wp_generate_password(12, true);
        wp_set_password($new_pw, $uid);
        FXSIM_Database::log_admin(get_current_user_id(), 'user_reset_pw', $uid, "Reset password for {$u->user_login}");

        return new WP_REST_Response([
            'success'       => true,
            'temp_password' => $new_pw,
            'message'       => "Password for {$u->user_login} updated successfully.",
        ]);
    }

    /** DELETE /admin/user/{id} or POST /admin/user/{id}/delete */
    public static function admin_user_delete(WP_REST_Request $r): WP_REST_Response {
        require_once ABSPATH . 'wp-admin/includes/user.php';
        $uid = (int) $r->get_param('id');
        if (!get_userdata($uid)) return new WP_REST_Response(['success' => false, 'message' => 'User not found.'], 404);

        wp_delete_user($uid);
        FXSIM_Database::log_admin(get_current_user_id(), 'user_delete', $uid, "Deleted user #{$uid}");
        return new WP_REST_Response(['success' => true, 'message' => "User #{$uid} deleted successfully."]);
    }

    /** POST /admin/user/{id}/notify */
    public static function admin_user_notify(WP_REST_Request $r): WP_REST_Response {
        $uid = (int) $r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $message = sanitize_textarea_field($body['message'] ?? '');
        $title = sanitize_text_field($body['title'] ?? 'Administrative Notice');

        if (empty($message)) return new WP_REST_Response(['success' => false, 'message' => 'Message is required.'], 400);

        FXSIM_Database::push_notification($uid, 'info', $title, $message);
        return new WP_REST_Response(['success' => true, 'message' => 'Notification delivered.']);
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
        if ($status === 'suspended') $status = 'banned';
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

    public static function admin_news_lock_get(): WP_REST_Response {
        $locked = (bool) get_option('fxsim_news_lock', false);
        return new WP_REST_Response(['success' => true, 'locked' => $locked]);
    }

    public static function admin_news_events_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $table = $wpdb->prefix . 'fxsim_news_events';
        $events = $wpdb->get_results("SELECT * FROM {$table} ORDER BY event_time_utc ASC LIMIT 500");
        
        // Auto-seed realistic upcoming high-impact economic events if empty
        if (empty($events)) {
            $now = time();
            $seed_events = [
                ['+4 hours',   'USD', 'high', 'US Non-Farm Payrolls (NFP) & Unemployment Rate', 'Bureau of Labor Statistics'],
                ['+12 hours',  'USD', 'high', 'US Consumer Price Index (CPI YoY / MoM)',        'Bureau of Labor Statistics'],
                ['+1 day',     'EUR', 'high', 'ECB Monetary Policy Statement & Rate Decision',   'European Central Bank'],
                ['+2 days',    'GBP', 'high', 'Bank of England Official Bank Rate & Minutes',     'Bank of England'],
                ['+3 days',    'USD', 'high', 'FOMC Federal Funds Rate Decision & Presser',      'Federal Reserve'],
                ['+4 days',    'CAD', 'high', 'Bank of Canada Monetary Policy Report',          'Bank of Canada'],
                ['+5 days',    'AUD', 'high', 'Australia Employment Change & Jobless Rate',     'Australian Bureau of Statistics'],
                ['+6 days',    'JPY', 'high', 'Bank of Japan Monetary Policy Statement',         'Bank of Japan'],
            ];
            foreach ($seed_events as $s) {
                $wpdb->insert($table, [
                    'event_time_utc' => gmdate('Y-m-d H:i:s', strtotime($s[0], $now)),
                    'currency'       => $s[1],
                    'impact'         => $s[2],
                    'title'          => $s[3],
                    'source'         => $s[4]
                ]);
            }
            $events = $wpdb->get_results("SELECT * FROM {$table} ORDER BY event_time_utc ASC LIMIT 500");
        }

        return new WP_REST_Response(['success' => true, 'events' => $events]);
    }

    /**
     * GET /news-events
     * Authenticated endpoint for the trading terminal order ticket to check upcoming high-impact news.
     */
    public static function public_news_events_get(WP_REST_Request $r): WP_REST_Response {
        return self::admin_news_events_get($r);
    }

    public static function admin_news_settings_get(WP_REST_Request $r): WP_REST_Response {
        $defaults = [
            'enabled'                => true,
            'mode'                   => 'hard_gate', // 'hard_gate' | 'soft_breach'
            'buffer_before_minutes'  => 2,
            'buffer_after_minutes'   => 2,
            'currencies'             => ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'],
        ];
        $stored = get_option('fxsim_news_guard_settings', []);
        return new WP_REST_Response(array_merge($defaults, is_array($stored) ? $stored : []));
    }

    public static function admin_news_settings_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $clean = [
            'enabled'                => !empty($body['enabled']),
            'mode'                   => in_array($body['mode'] ?? '', ['hard_gate', 'soft_breach'], true) ? $body['mode'] : 'hard_gate',
            'buffer_before_minutes'  => max(1, min(60, (int)($body['buffer_before_minutes'] ?? 2))),
            'buffer_after_minutes'   => max(1, min(60, (int)($body['buffer_after_minutes'] ?? 2))),
            'currencies'             => !empty($body['currencies']) && is_array($body['currencies']) ? array_map('sanitize_text_field', $body['currencies']) : ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'],
        ];
        update_option('fxsim_news_guard_settings', $clean, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'news_guard_settings_save');
        return new WP_REST_Response(['success' => true, 'message' => 'Macro-economic news guard settings saved.', 'settings' => $clean]);
    }

    public static function admin_news_events_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        
        $event_time = sanitize_text_field($body['event_time_utc'] ?? '');
        $currency   = strtoupper(sanitize_text_field($body['currency'] ?? ''));
        $impact     = sanitize_text_field($body['impact'] ?? 'low');
        $title      = sanitize_text_field($body['title'] ?? '');
        $source     = sanitize_text_field($body['source'] ?? '');

        if (!$event_time || !$currency || !$title) {
            return new WP_REST_Response(['error' => 'Missing required fields.'], 400);
        }
        if (!in_array($impact, ['low','medium','high'])) {
            $impact = 'low';
        }

        $wpdb->insert($wpdb->prefix . 'fxsim_news_events', [
            'event_time_utc' => gmdate('Y-m-d H:i:s', strtotime($event_time)),
            'currency'       => $currency,
            'impact'         => $impact,
            'title'          => $title,
            'source'         => $source
        ]);

        return new WP_REST_Response(['success' => true, 'id' => $wpdb->insert_id]);
    }

    public static function admin_news_events_delete(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int)$r->get_param('id');
        $wpdb->delete($wpdb->prefix . 'fxsim_news_events', ['id' => $id]);
        return new WP_REST_Response(['success' => true]);
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

        // ── Payout Amount Integrity Audit Control ─────────────────────────────
        // Cross-check mutable account balance profit against verified trade ledgers.
        // Verifies that requested profit does not exceed net realized profit from
        // closed trades minus previously disbursed payouts (with small tolerance for rounding).
        $realized_trade_pnl = (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(pnl), 0.0) FROM {$wpdb->prefix}fxsim_trades WHERE account_id = %d",
            $account->id
        ));
        $prior_paid_payouts = (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(amount_requested), 0.0) FROM {$wpdb->prefix}fxsim_payouts WHERE challenge_id = %d AND status = 'paid'",
            $id
        ));
        $adjustments = (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(amount), 0.0) FROM {$wpdb->prefix}fxsim_transactions WHERE account_id = %d AND type IN ('deposit','adjustment')",
            $account->id
        ));
        $net_ledger_profit = ($realized_trade_pnl + $adjustments) - $prior_paid_payouts;

        if ($profit > ($net_ledger_profit + 5.00)) {
            if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
                FXSIM_Database::log_admin(
                    get_current_user_id(),
                    'payout_integrity_flag',
                    $id,
                    "Payout amount integrity check failed: requested profit \${$profit} exceeds ledger net realized trade profit \${$net_ledger_profit} (realized trades: \${$realized_trade_pnl}, adjustments: \${$adjustments}, prior paid payouts: \${$prior_paid_payouts})."
                );
            }
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Payout integrity check failed: requested profit exceeds verified closed trade profit on this account. Please contact support.',
                'code'    => 'payout_integrity_discrepancy'
            ], 400);
        }

        // The admin-configurable minimum payout amount was exposed and
        // saveable in Settings but never actually enforced here — a trader
        // could request a payout for any amount above $0.
        $min_payout = (float) FXSIM_Challenge_DB::get_setting('min_payout_amount', 50.0);
        if ($min_payout > 0 && $profit < $min_payout) {
            return new WP_REST_Response(['success' => false, 'message' => 'Minimum payout amount is $' . number_format($min_payout, 2) . ". Your current available profit is $" . number_format($profit, 2) . '.'], 400);
        }

        // One open payout per challenge at a time — prevents requesting the same
        // profit repeatedly before a prior request is paid/rejected.
        $openCount = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payouts
             WHERE challenge_id=%d AND status IN ('pending','under_review','approved')", $id));
        if ($openCount > 0) {
            return new WP_REST_Response(['success' => false, 'message' => 'You already have a payout in progress. Please wait until it is processed.'], 400);
        }

        // Eligibility: minimum trading days (with custom override support)
        $min_days = (isset($ch->custom_min_days) && $ch->custom_min_days !== null) ? (int)$ch->custom_min_days : (int)$plan->p2_min_days;
        if ((int)$ch->trading_days < $min_days) {
            return new WP_REST_Response(['success' => false, 'message' => "Minimum {$min_days} trading days required before payout. You have {$ch->trading_days}."], 400);
        }

        // Profit split (prioritize bespoke custom_profit_split override)
        $split      = (isset($ch->custom_profit_split) && $ch->custom_profit_split !== null && (float)$ch->custom_profit_split > 0)
            ? (float)$ch->custom_profit_split
            : (float)$plan->funded_profit_split;
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

        if (class_exists('FXSIM_Webhooks')) {
            $user_info = get_userdata(get_current_user_id());
            FXSIM_Webhooks::dispatch('payout', [
                'trader_name'    => $user_info ? $user_info->display_name : 'Trader',
                'email'          => $user_info ? $user_info->user_email : '',
                'amount'         => $trader_amt,
                'method'         => sanitize_text_field($body['method'] ?? 'Crypto'),
                'wallet_address' => sanitize_text_field($body['address'] ?? 'On file'),
            ]);
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
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'ensure_kyc_columns')) {
            FXSIM_Database::ensure_kyc_columns();
        }

        $paths = [];
        foreach (['id_doc', 'id_doc_back', 'selfie', 'address_doc'] as $f) {
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
            'id_doc_back_path' => $paths['id_doc_back'],
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
            error_log('[PropFirm KYC Error] User #' . $uid . ': ' . $wpdb->last_error);
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Could not save your submission. Please try again or contact support.',
            ], 500);
        }

        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send($uid, 'kyc_submitted', []);
        }

        if (class_exists('FXSIM_Webhooks')) {
            $user_info = get_userdata($uid);
            FXSIM_Webhooks::dispatch('kyc', [
                'trader_name' => $user_info ? $user_info->display_name : "Trader #$uid",
                'doc_type'    => sanitize_text_field($doc_type ?? 'Government ID (Front & Back)'),
                'country'     => sanitize_text_field($country ?? 'Global'),
            ]);
        }

        return new WP_REST_Response(['success' => true, 'message' => 'Your documents have been submitted for review.']);
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

        // Extension must come from the already-validated $mime, never the
        // client-supplied filename — otherwise a JPEG/PHP polyglot (valid
        // magic bytes, still sniffs as image/jpeg) can be saved as .php and
        // executed by the web server if the runtime .htaccess above isn't
        // honored (nginx never reads it; Apache ignores it under AllowOverride None).
        $ext_map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
        $ext  = $ext_map[$mime] ?? 'dat';
        // Random token, not field+time(): the directory .htaccess is Apache-only
        // (nginx never reads it), so a guessable path is the only thing standing
        // between the public internet and a trader's ID/selfie on nginx hosts.
        $name = $field . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
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

    /** GET /admin/kyc — paginated/filterable list of KYC submissions. */
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
        $out = array_map(function($k) {
            $has_id      = !empty($k->id_doc_path);
            $has_back    = !empty($k->id_doc_back_path);
            $has_selfie  = !empty($k->selfie_path);
            $has_address = !empty($k->address_doc_path);
            $doc_count   = ($has_id ? 1 : 0) + ($has_back ? 1 : 0) + ($has_selfie ? 1 : 0) + ($has_address ? 1 : 0);

            return [
                'id'           => (int) $k->id,
                'user_id'      => (int) $k->user_id,
                'username'     => $k->user_login,
                'email'        => $k->user_email,
                'name'         => $k->display_name,
                'status'       => $k->status,
                'admin_note'   => $k->admin_note,
                'submitted_at' => self::iso8601($k->submitted_at),
                'reviewed_at'  => self::iso8601($k->reviewed_at),
                'doc_count'    => $doc_count,
                'has_docs'     => $doc_count > 0,
                // Relative paths, not rest_url() — the browser must fetch these
                // through whatever base the frontend is already using (same-origin
                // /api/wp proxy in dev, direct cross-origin backend URL in prod).
                // An absolute rest_url() here bypasses the dev proxy, and the
                // session cookie from login (scoped to the proxy's origin, not
                // this backend's own domain) then makes every request 401.
                'id_doc'       => $has_id ? "/admin/kyc/{$k->id}/doc/id_doc" : null,
                'id_doc_back'  => $has_back ? "/admin/kyc/{$k->id}/doc/back" : null,
                'selfie'       => $has_selfie ? "/admin/kyc/{$k->id}/doc/selfie" : null,
                'address_doc'  => $has_address ? "/admin/kyc/{$k->id}/doc/address_doc" : null,
                'docs'         => [
                    'id_doc'      => $has_id ? "/admin/kyc/{$k->id}/doc/id_doc" : null,
                    'id_doc_back' => $has_back ? "/admin/kyc/{$k->id}/doc/back" : null,
                    'selfie'      => $has_selfie ? "/admin/kyc/{$k->id}/doc/selfie" : null,
                    'address_doc' => $has_address ? "/admin/kyc/{$k->id}/doc/address_doc" : null,
                ],
            ];
        }, $rows ?: []);
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
        $note  = sanitize_textarea_field($body['note'] ?? '');
        $force = !empty($body['force_override']);

        $kyc = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_kyc WHERE id=%d", $id));
        if (!$kyc) return new WP_REST_Response(['success' => false, 'message' => 'KYC record not found.'], 404);

        $has_documents = !empty($kyc->id_front) || !empty($kyc->id_back) || !empty($kyc->selfie) || !empty($kyc->proof_address) || !empty($kyc->id_doc_path) || !empty($kyc->id_doc_back_path) || !empty($kyc->selfie_path) || !empty($kyc->address_doc_path);
        if ($status === 'approved' && !$has_documents && !$force) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Compliance Guard: Cannot approve KYC verification without submitted identity documents.',
                'message' => 'Compliance Guard: Cannot approve KYC verification without submitted identity documents.',
            ], 422);
        }

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
        $map  = [
            'id_doc'      => 'id_doc_path',
            'front'       => 'id_doc_path',
            'selfie'      => 'selfie_path',
            'address_doc' => 'address_doc_path',
            'address'     => 'address_doc_path',
            'back'        => 'id_doc_back_path',
        ];
        if (!isset($map[$type])) return new WP_REST_Response(['error' => 'Bad type'], 400);
        $col = $map[$type];
        $rel = $wpdb->get_var($wpdb->prepare(
            "SELECT `{$col}` FROM {$wpdb->prefix}fxsim_kyc WHERE id=%d", $id));
        if (!$rel) return new WP_REST_Response(['error' => 'Not found'], 404);
        $u    = wp_upload_dir();
        $path = $u['basedir'] . '/' . ltrim($rel, '/');
        if (!file_exists($path)) return new WP_REST_Response(['error' => 'File missing'], 404);
        // This handler streams raw bytes and exits, bypassing the REST CORS
        // filter — so emit CORS headers here for all configured origins.
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = class_exists('ProTradeFX_Headless_Bridge') && method_exists('ProTradeFX_Headless_Bridge', 'allowed_origins')
            ? ProTradeFX_Headless_Bridge::allowed_origins()
            : ['https://demo.launchapropfirm.com', 'http://localhost:3000'];
        if ($origin && (in_array($origin, $allowed, true) || in_array(untrailingslashit($origin), array_map('untrailingslashit', $allowed), true))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, X-FXSIM-Token, Authorization');
            header('Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length');
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
        $out = array_map(function($p) use ($wpdb) {
            $ch = FXSIM_Challenge_DB::get_challenge((int) $p->challenge_id);
            $plan = $ch ? FXSIM_Challenge_DB::get_plan((int) $ch->plan_id) : null;
            $account = $ch ? FXSIM_Database::get_account_by_id((int) $ch->fxsim_account_id) : null;

            // 1. Consistency check
            $consistency_ok = true;
            if ($ch && $plan) {
                $c_res = FXSIM_Challenge_Engine::check_consistency($ch, $plan);
                $consistency_ok = (bool) ($c_res['passed'] ?? true);
            }

            // 2. Anti-scalping / HFT check (trades closed under 30s)
            $hft_flagged = false;
            if ($ch && $ch->fxsim_account_id) {
                $quick_trades = (int) $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trades 
                     WHERE account_id = %d AND TIMESTAMPDIFF(SECOND, opened_at, closed_at) < 30",
                    $ch->fxsim_account_id
                ));
                $hft_flagged = $quick_trades > 0;
            }

            // 3. Drawdown proximity warning
            $near_drawdown_floor = false;
            if ($ch && $account && $plan) {
                $phase = ($ch->status === 'funded') ? 0 : (int)$ch->phase;
                $max_dd_pct = 10.0;
                if (isset($ch->custom_max_dd) && $ch->custom_max_dd !== null && (float)$ch->custom_max_dd > 0) {
                    $max_dd_pct = (float)$ch->custom_max_dd;
                } elseif ($phase === 0) {
                    $max_dd_pct = (float)($plan->funded_max_dd ?? $plan->p1_max_dd ?? 10.0);
                } elseif ($phase === 1) {
                    $max_dd_pct = (float)($plan->p1_max_dd ?? 10.0);
                } elseif ($phase === 2) {
                    $max_dd_pct = (float)($plan->p2_max_dd ?? $plan->p1_max_dd ?? 10.0);
                } elseif ($phase === 3) {
                    $max_dd_pct = (float)($plan->p3_max_dd ?? $plan->p1_max_dd ?? 10.0);
                }
                $starting_bal = (float) $ch->starting_balance;
                $floor = $starting_bal * (1.0 - ($max_dd_pct / 100.0));
                $current_eq = (float) $account->equity;
                if ($current_eq <= ($floor * 1.02)) {
                    $near_drawdown_floor = true;
                }
            }

            // 4. Open breaches count
            $breaches_count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_breaches WHERE challenge_id = %d",
                $p->challenge_id
            ));

            return [
                'id'                  => (int) $p->id,
                'challenge_id'        => (int) $p->challenge_id,
                'user_id'             => (int) $p->user_id,
                'username'            => $p->user_login,
                'email'               => $p->user_email,
                'name'                => $p->display_name,
                'amount_requested'    => (float) $p->amount_requested,
                'trader_amount'       => (float) $p->trader_amount,
                'firm_amount'         => (float) $p->firm_amount,
                'profit_split_pct'    => (float) $p->profit_split_pct,
                'status'              => $p->status,
                'payment_method'      => $p->payment_method,
                'payment_address'     => $p->payment_address,
                'tx_reference'        => $p->tx_reference,
                'proof_url'           => $p->proof_url,
                'admin_note'          => $p->admin_note,
                'requested_at'        => self::iso8601($p->requested_at),
                'processed_at'        => self::iso8601($p->processed_at),
                'consistency_ok'      => $consistency_ok,
                'hft_flagged'         => $hft_flagged,
                'anti_scalp_breached' => $hft_flagged,
                'near_drawdown_floor' => $near_drawdown_floor,
                'breaches_count'      => $breaches_count,
            ];
        }, $rows ?: []);
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
            $account = $ch ? FXSIM_Database::get_account_by_id((int) $ch->fxsim_account_id) : null;
            if ($ch && $account) {
                $wpdb->query('START TRANSACTION');
                try {
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
                    // NOTE: the plans table has no "funded_trailing_drawdown_pct"
                    // column — that name never existed in the schema, so this always
                    // silently evaluated to 0% (floor = current equity, zero buffer,
                    // any subsequent loss instantly breaches a trailing-DD funded
                    // account). The real column for the funded stage's trailing/max
                    // drawdown percentage is funded_max_dd.
                    $plan = FXSIM_Challenge_DB::get_plan((int)$ch->plan_id);
                    $allowed_trail_pct = $plan ? (float)$plan->funded_max_dd : 0;
                    $abs_trail = round((float)$ch->starting_balance * ($allowed_trail_pct / 100), 2);

                    $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                        'current_balance'     => $newBal,
                        'peak_balance'        => $newBal,
                        'daily_start_balance' => $newBal,
                        'equity_hwm'          => $newEq,
                        'trailing_dd_floor'   => round($newEq - $abs_trail, 2),
                    ], ['id' => (int) $ch->id]);
                    if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
                        FXSIM_Database::log_transaction((int) $ch->fxsim_account_id, 'payout', -$withdrawn, $newBal, "Payout #{$id} paid");
                    }
                    $wpdb->query('COMMIT');
                    self::invalidate_account_cache((int) $p->user_id);
                } catch (\Throwable $e) {
                    $wpdb->query('ROLLBACK');
                    error_log("[PropFirm] admin_payout_status: balance deduction FAILED for payout #{$id} (already marked 'paid') — " . $e->getMessage());
                    if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
                        FXSIM_Database::log_admin(get_current_user_id(), 'payout_deduction_failed', (int) $p->user_id,
                            "Payout #{$id} marked paid but balance deduction failed: " . $e->getMessage() . '. Needs manual reconciliation.');
                    }
                }
            } else {
                // Challenge or account row missing — the payout is about to be
                // committed as 'paid' below with NO balance ever deducted. This
                // must not fail silently: it needs a loud, findable trail.
                error_log("[PropFirm] admin_payout_status: payout #{$id} marked 'paid' but its challenge/account could not be found — balance NOT deducted.");
                if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
                    FXSIM_Database::log_admin(get_current_user_id(), 'payout_deduction_skipped', (int) $p->user_id,
                        "Payout #{$id} marked paid but challenge_id #{$p->challenge_id} or its linked account could not be resolved. Needs manual reconciliation.");
                }
            }
        }

        // ── Automated Scaling Check Hook ───────────────────────────────────────
        if (in_array($status, ['approved', 'paid'], true)) {
            $ch_id = (int)$p->challenge_id;
            if ($ch_id) {
                $rules = self::admin_scaling_rules_get($r)->get_data();
                $completed_payouts = (int)$wpdb->get_var($wpdb->prepare("
                    SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payouts
                    WHERE challenge_id = %d AND status IN ('approved', 'paid')
                ", $ch_id));

                if ($completed_payouts >= (int)($rules['min_payouts'] ?? 2)) {
                    $ch_acc = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d", $ch_id));

                    // Per-period gate: without this, completed_payouts only ever
                    // increases, so once the min_payouts threshold is crossed once,
                    // EVERY subsequent payout on this account re-fires scaling
                    // (unbounded repeat scale-ups). Only re-evaluate once per
                    // evaluation_period_days since this account was last scaled
                    // (or since funding, if never scaled).
                    $period_days = max(1, (int)($rules['evaluation_period_days'] ?? 90));
                    $last_scaled = ($ch_acc && !empty($ch_acc->last_scaled_at)) ? $ch_acc->last_scaled_at : ($ch_acc->funded_at ?? null);
                    $period_elapsed = $last_scaled ? ((current_time('timestamp') - strtotime($last_scaled)) >= $period_days * DAY_IN_SECONDS) : true;

                    // Real profit% check: payout count alone is not evidence of
                    // sustained profitability — compare the account's live balance
                    // against its own starting_balance, same as the admin scaling
                    // queue already computes for display.
                    $real_roi = 0.0;
                    if ($ch_acc && $ch_acc->fxsim_account_id) {
                        $live_bal = (float)$wpdb->get_var($wpdb->prepare(
                            "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $ch_acc->fxsim_account_id
                        ));
                        $start_bal_check = (float)$ch_acc->starting_balance;
                        if ($start_bal_check > 0) {
                            $real_roi = (($live_bal - $start_bal_check) / $start_bal_check) * 100;
                        }
                    }
                    $profit_ok = $real_roi >= (float)($rules['profit_target_pct'] ?? 10.00);

                    if ($ch_acc && $ch_acc->status === 'funded' && $period_elapsed && $profit_ok) {
                        if (!empty($rules['auto_scale'])) {
                            // Auto-Scale execution
                            $fake_req = new WP_REST_Request('POST', "/fxsim/v1/admin/scaling/{$ch_id}/apply");
                            $fake_req->set_url_params(['id' => $ch_id]);
                            self::admin_scaling_apply($fake_req);
                        } else {
                            // Log pending eligibility into fxsim_scaling_events if not already recorded
                            $existing = $wpdb->get_var($wpdb->prepare("
                                SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_scaling_events
                                WHERE challenge_account_id = %d AND status IN ('eligible', 'pending_approval')
                            ", $ch_id));
                            if (!$existing) {
                                $start_bal = (float)$ch_acc->starting_balance ?: 100000;
                                $mult = (float)($rules['balance_multiplier_pct'] ?? 25.00);
                                $new_bal = min((float)$rules['max_capital_cap'], round($start_bal * (1 + ($mult / 100)), 2));
                                $wpdb->insert($wpdb->prefix . 'fxsim_scaling_events', [
                                    'challenge_account_id' => $ch_id,
                                    'user_id'              => (int)$p->user_id,
                                    'old_balance'          => $start_bal,
                                    'new_balance'          => $new_bal,
                                    'old_split'            => (float)($ch_acc->custom_profit_split ?: 80.00),
                                    'new_split'            => (float)($rules['new_profit_split'] ?? 90.00),
                                    'roi_achieved'         => round($real_roi, 2),
                                    'payouts_completed'    => $completed_payouts,
                                    'status'               => 'eligible',
                                    'created_at'           => current_time('mysql'),
                                ]);
                            }
                        }
                    }
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
            case 'suspend':
                // The frontend's bulk "Suspend" action previously called
                // testToolsSet(id, 'reset') — there was no 'suspend' case here
                // at all, so "Suspend" silently ran the SAME trade/position-
                // history-wiping reset as the "Reset" button. This case
                // flips the account to 'suspended' (a valid ENUM value on
                // this table) without touching balance/trades/positions.
                $wpdb->update($t, [
                    'status'        => 'suspended',
                    'breach_reason' => 'Suspended by admin (manual action).',
                    'breach_at'     => $now,
                ], ['id' => $id]);
                $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                    ['status' => 'frozen'],
                    ['id' => (int) $ca->fxsim_account_id]);
                FXSIM_Database::push_notification($uid, 'warning', 'Account suspended',
                    'Your challenge account has been suspended by an administrator.', '/dashboard');
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

    public static function admin_challenges(WP_REST_Request $r = null): WP_REST_Response {
        global $wpdb;
        $page     = $r ? max(1, (int)($r->get_param('page') ?? 1)) : 1;
        $limit    = $r ? (int)($r->get_param('limit') ?? 0) : 0;
        $search   = $r ? sanitize_text_field($r->get_param('search') ?? '') : '';
        $status   = $r ? sanitize_text_field($r->get_param('status') ?? '') : '';
        $user_ids = $r ? $r->get_param('user_ids') : null;

        $where = ['1=1'];
        $params_count = [];
        $params_rows  = [];

        if (!empty($user_ids)) {
            if (is_string($user_ids)) {
                $ids = array_filter(array_map('intval', explode(',', $user_ids)));
            } elseif (is_array($user_ids)) {
                $ids = array_filter(array_map('intval', $user_ids));
            } else {
                $ids = [(int)$user_ids];
            }
            if (!empty($ids)) {
                $placeholders = implode(',', array_fill(0, count($ids), '%d'));
                $where[] = "ca.user_id IN ($placeholders)";
                foreach ($ids as $id_val) {
                    $params_count[] = $id_val;
                    $params_rows[]  = $id_val;
                }
            }
        }

        if ($status && $status !== 'all') {
            $where[] = "ca.status = %s";
            $params_count[] = $status;
            $params_rows[]  = $status;
        }

        if ($search !== '') {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $where[] = "(u.user_login LIKE %s OR u.user_email LIKE %s OR cp.name LIKE %s)";
            $params_count[] = $like;
            $params_count[] = $like;
            $params_count[] = $like;
            $params_rows[]  = $like;
            $params_rows[]  = $like;
            $params_rows[]  = $like;
        }

        $sql_where = implode(' AND ', $where);

        $count_sql = "
            SELECT COUNT(*)
            FROM {$wpdb->prefix}fxsim_challenge_accounts ca
            JOIN {$wpdb->prefix}users u ON ca.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
            WHERE {$sql_where}
        ";
        $total = (int)(!empty($params_count)
            ? $wpdb->get_var($wpdb->prepare($count_sql, $params_count))
            : $wpdb->get_var($count_sql));

        $limit_clause = "";
        // If neither user_ids nor explicit limit is supplied, apply a sane default cap (200)
        // to prevent unbounded table scans by dashboard polling widgets.
        if ($limit <= 0 && empty($user_ids)) {
            $limit = 200;
        }

        if ($limit > 0) {
            $offset = ($page - 1) * $limit;
            $limit_clause = "LIMIT %d OFFSET %d";
            $params_rows[] = $limit;
            $params_rows[] = $offset;
        }

        $query = "
            SELECT ca.*, u.user_login, u.user_email, cp.name AS plan_name, cp.account_size,
                   COALESCE(k.status, 'unverified') AS kyc_status
            FROM {$wpdb->prefix}fxsim_challenge_accounts ca
            JOIN {$wpdb->prefix}users u ON ca.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
            LEFT JOIN {$wpdb->prefix}fxsim_kyc k ON k.user_id = ca.user_id
            WHERE {$sql_where}
            ORDER BY ca.created_at DESC
            {$limit_clause}
        ";

        $rows = !empty($params_rows)
            ? $wpdb->get_results($wpdb->prepare($query, $params_rows))
            : $wpdb->get_results($query);

        // Append pending payouts
        $payouts = $wpdb->get_results("
            SELECT p.*, u.user_login FROM {$wpdb->prefix}fxsim_payouts p
            JOIN {$wpdb->prefix}users u ON p.user_id=u.ID
            WHERE p.status='pending' ORDER BY p.requested_at DESC
        ");

        return new WP_REST_Response([
            'challenges'      => $rows ?: [],
            'total'           => $total,
            'page'            => $page,
            'pages'           => $limit > 0 ? (int)ceil($total / $limit) : 1,
            'limit'           => $limit > 0 ? $limit : $total,
            'pending_payouts' => $payouts ?: []
        ]);
    }

    /**
     * POST /admin/challenge/{id}/override — Enterprise Bespoke Custom Overrides
     * Updates profit split, daily/max drawdown limits, min days, and news/weekend permissions.
     */
    public static function admin_challenge_override(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();

        $table = $wpdb->prefix . 'fxsim_challenge_accounts';
        // Locate challenge by account ID or user ID (finds most recent active/funded account)
        $ch = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d OR user_id = %d ORDER BY id DESC LIMIT 1", $id, $id));
        if (!$ch) {
            return new WP_REST_Response(['success' => false, 'message' => 'Challenge account not found.'], 404);
        }

        $update = [];
        $profit_split = $body['profit_split'] ?? $body['custom_profit_split'] ?? null;
        if ($profit_split !== null && $profit_split !== '') {
            $update['custom_profit_split'] = max(50.0, min(95.0, (float)$profit_split));
        }

        $daily_dd = $body['daily_drawdown'] ?? $body['max_daily_loss'] ?? $body['custom_daily_dd'] ?? null;
        if ($daily_dd !== null && $daily_dd !== '') {
            $update['custom_daily_dd'] = max(1.0, min(20.0, (float)$daily_dd));
        }

        $max_dd = $body['max_drawdown'] ?? $body['max_total_loss'] ?? $body['custom_max_dd'] ?? null;
        if ($max_dd !== null && $max_dd !== '') {
            $update['custom_max_dd'] = max(2.0, min(30.0, (float)$max_dd));
        }

        $min_days = $body['min_trading_days'] ?? $body['min_days'] ?? $body['custom_min_days'] ?? null;
        if ($min_days !== null && $min_days !== '') {
            $update['custom_min_days'] = max(0, min(30, (int)$min_days));
        }

        $news = $body['news_trading'] ?? $body['custom_news_trading'] ?? null;
        if ($news !== null) {
            $update['custom_news_trading'] = !empty($news) ? 1 : 0;
        }

        $weekend = $body['weekend_holding'] ?? $body['custom_weekend_holding'] ?? null;
        if ($weekend !== null) {
            $update['custom_weekend_holding'] = !empty($weekend) ? 1 : 0;
        }

        $note = $body['admin_note'] ?? $body['override_admin_note'] ?? null;
        if ($note !== null && $note !== '') {
            $update['override_admin_note'] = sanitize_textarea_field($note);
        }

        if (empty($update)) {
            return new WP_REST_Response(['success' => false, 'message' => 'No override parameters specified.'], 400);
        }

        $wpdb->update($table, $update, ['id' => $ch->id]);

        $admin_id = get_current_user_id();
        $summary = "Challenge #{$ch->id}: " . wp_json_encode($update);
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
            FXSIM_Database::log_admin($admin_id, 'challenge_override', (int)$ch->user_id, $summary);
        }

        return new WP_REST_Response([
            'success'      => true,
            'message'      => 'Custom enterprise overrides saved successfully.',
            'challenge_id' => (int) $ch->id,
            'overrides'    => $update,
        ]);
    }

    public static function admin_challenge_create_manual(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $email = sanitize_email($body['email'] ?? '');
        $user_id = (int)($body['user_id'] ?? 0);
        $plan_id = (int)($body['plan_id'] ?? 0);

        if (!$user_id && $email) {
            $u = get_user_by('email', $email);
            if ($u) {
                $user_id = $u->ID;
            } else {
                $login = sanitize_user(current(explode('@', $email)));
                $pwd = wp_generate_password(12, true);
                $created_id = wp_create_user($login, $pwd, $email);
                if (is_wp_error($created_id)) {
                    return new WP_REST_Response(['success' => false, 'message' => $created_id->get_error_message()], 400);
                }
                $user_id = $created_id;
            }
        }

        if (!$plan_id) {
            $plan = $wpdb->get_row("SELECT id FROM {$wpdb->prefix}fxsim_challenge_plans WHERE is_active = 1 ORDER BY price ASC LIMIT 1");
            $plan_id = $plan ? (int)$plan->id : 1;
        }

        if (!$user_id) {
            return new WP_REST_Response(['success' => false, 'message' => 'Trader email or user ID required.'], 400);
        }

        if (!class_exists('FXSIM_Challenge_Engine')) {
            return new WP_REST_Response(['success' => false, 'message' => 'Challenge Engine not available.'], 500);
        }

        $res = FXSIM_Challenge_Engine::create_challenge($user_id, $plan_id);
        if (!$res || empty($res['success'])) {
            return new WP_REST_Response(['success' => false, 'message' => $res['message'] ?? 'Failed to create challenge account.'], 400);
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'manual_challenge_issued', $user_id, "Plan #{$plan_id} Challenge #{$res['challenge_id']}");

        return new WP_REST_Response([
            'success' => true,
            'challenge_id' => $res['challenge_id'],
            'account_id' => $res['account_id'] ?? $res['challenge_id'],
            'user_id' => $user_id,
            'message' => "Challenge #{$res['challenge_id']} successfully issued to trader."
        ]);
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
     * Admin assigns MT5 credentials to any challenge account.
     */
    public static function admin_save_mt5(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $challenge_id = (int)$r->get_param('id');
        $body         = $r->get_json_params() ?: $r->get_body_params();

        // Verify challenge exists
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT id, user_id, status FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d",
            $challenge_id
        ));
        if (!$ch) return new WP_REST_Response(['error' => 'Challenge not found.'], 404);

        $update_data = [
            'mt5_login'        => sanitize_text_field($body['mt5_login']        ?? ''),
            'mt5_server'       => sanitize_text_field($body['mt5_server']       ?? 'MetaQuotes-Demo'),
            'mt5_account_type' => sanitize_text_field($body['mt5_account_type'] ?? 'demo'),
        ];
        if (!empty($body['mt5_password'])) {
            $update_data['mt5_password'] = sanitize_text_field($body['mt5_password']);
        }

        $updated = $wpdb->update(
            $wpdb->prefix . 'fxsim_challenge_accounts',
            $update_data,
            ['id' => $challenge_id]
        );

        // Mirror to user meta
        update_user_meta((int)$ch->user_id, 'fxsim_mt5_login', $update_data['mt5_login']);
        update_user_meta((int)$ch->user_id, 'fxsim_mt5_server', $update_data['mt5_server']);
        update_user_meta((int)$ch->user_id, 'fxsim_mt5_account_type', $update_data['mt5_account_type']);

        FXSIM_Database::log_admin(
            get_current_user_id(), 'mt5_details_assigned', (int)$ch->user_id,
            "Challenge #{$challenge_id} | Server: " . sanitize_text_field($body['mt5_server'] ?? '')
        );

        // Notify trader that their MT5 details are ready
        if ($updated !== false && !empty($body['mt5_login'])) {
            FXSIM_Database::push_notification(
                (int)$ch->user_id, 'success',
                '🖥 MT5 Access Details Updated',
                'Your MT5 broker credentials have been updated and synced to your dashboard.',
                home_url('/dashboard/')
            );
        }

        return new WP_REST_Response(['success' => $updated !== false, 'message' => 'MT5 credentials saved.']);
    }

    /**
     * POST /admin/user/{id}/mt5
     * Admin assigns/updates MT5 credentials directly on a user's active/latest challenge.
     */
    public static function admin_user_mt5_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id = (int)$r->get_param('id');
        $body    = $r->get_json_params() ?: $r->get_body_params();

        // 1. Find user's active or latest challenge account
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE user_id = %d ORDER BY (status = 'active' OR status = 'funded') DESC, id DESC LIMIT 1",
            $user_id
        ));

        $mt5_login        = sanitize_text_field($body['mt5_login'] ?? '');
        $mt5_password     = sanitize_text_field($body['mt5_password'] ?? '');
        $mt5_server       = sanitize_text_field($body['mt5_server'] ?? 'MetaQuotes-Demo');
        $mt5_account_type = sanitize_text_field($body['mt5_account_type'] ?? 'demo');

        if (!$ch) {
            // If user has no challenge account yet, create one so MT5 can sync
            $plans = $wpdb->get_results("SELECT id, account_size FROM {$wpdb->prefix}fxsim_challenge_plans LIMIT 1");
            $plan_id = !empty($plans[0]) ? (int)$plans[0]->id : 1;
            $start_bal = !empty($plans[0]) ? (float)$plans[0]->account_size : 10000.00;

            $wpdb->insert($wpdb->prefix . 'fxsim_accounts', [
                'user_id'    => $user_id,
                'status'     => 'active',
                'balance'    => $start_bal,
                'equity'     => $start_bal,
                'leverage'   => 100,
                'created_at' => current_time('mysql'),
            ]);
            $acc_id = (int)$wpdb->insert_id;

            $wpdb->insert($wpdb->prefix . 'fxsim_challenge_accounts', [
                'user_id'             => $user_id,
                'plan_id'             => $plan_id,
                'fxsim_account_id'    => $acc_id,
                'phase'               => 1,
                'status'              => 'active',
                'starting_balance'    => $start_bal,
                'current_balance'     => $start_bal,
                'peak_balance'        => $start_bal,
                'daily_start_balance' => $start_bal,
                'equity_hwm'          => $start_bal,
                'mt5_login'           => $mt5_login,
                'mt5_password'        => $mt5_password,
                'mt5_server'          => $mt5_server,
                'mt5_account_type'    => $mt5_account_type,
                'created_at'          => current_time('mysql'),
            ]);
            $challenge_id = (int)$wpdb->insert_id;
        } else {
            $challenge_id = (int)$ch->id;
            $update_data = [
                'mt5_login'        => $mt5_login,
                'mt5_server'       => $mt5_server,
                'mt5_account_type' => $mt5_account_type,
            ];
            if (!empty($mt5_password)) {
                $update_data['mt5_password'] = $mt5_password;
            }
            $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', $update_data, ['id' => $challenge_id]);
        }

        // Store in user meta as well for fast direct lookup
        update_user_meta($user_id, 'fxsim_mt5_login', $mt5_login);
        update_user_meta($user_id, 'fxsim_mt5_server', $mt5_server);
        update_user_meta($user_id, 'fxsim_mt5_account_type', $mt5_account_type);

        FXSIM_Database::log_admin(
            get_current_user_id(), 'mt5_details_assigned', $user_id,
            "MT5 Login: {$mt5_login} | Server: {$mt5_server} (Challenge #{$challenge_id})"
        );

        if (!empty($mt5_login)) {
            FXSIM_Database::push_notification(
                $user_id, 'success',
                '🖥 MT5 Account Bound',
                "Your MT5 account ({$mt5_login} on {$mt5_server}) is linked to your dashboard challenge.",
                home_url('/dashboard/')
            );
        }

        return new WP_REST_Response([
            'success'          => true,
            'challenge_id'     => $challenge_id,
            'mt5_login'        => $mt5_login,
            'mt5_server'       => $mt5_server,
            'mt5_account_type' => $mt5_account_type,
            'message'          => 'MT5 broker credentials assigned and saved successfully.',
        ]);
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
        $table = $wpdb->prefix . 'fxsim_challenge_plans';
        $id = (int)($body['id'] ?? 0);

        // Handle partial update if an existing plan ID is passed without a full plan name (e.g. bulk activate/deactivate)
        if ($id > 0 && empty($body['name'])) {
            $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id));
            if (!$existing) {
                return new WP_REST_Response(['error' => 'Plan not found.'], 404);
            }
            $partial_data = [];
            if (isset($body['is_active'])) $partial_data['is_active'] = (int)$body['is_active'];
            if (isset($body['display_order'])) $partial_data['display_order'] = (int)$body['display_order'];
            if (!empty($partial_data)) {
                $wpdb->update($table, $partial_data, ['id' => $id]);
            }
            return new WP_REST_Response(['success' => true, 'id' => $id, 'message' => 'Plan status updated successfully.']);
        }

        $name = sanitize_text_field($body['name'] ?? '');
        if (empty($name)) {
            return new WP_REST_Response(['error' => 'Plan name is required.'], 400);
        }

        // Map any aliases
        $account_size = isset($body['account_size']) ? (float)$body['account_size'] : (isset($body['starting_balance']) ? (float)$body['starting_balance'] : 10000.0);
        $price = isset($body['price']) ? (float)$body['price'] : 99.0;
        $plan_type = in_array($body['plan_type'] ?? '', ['1-step', '2-step', '3-step', 'instant'], true) ? $body['plan_type'] : '2-step';
        $drawdown_type = in_array($body['drawdown_type'] ?? '', ['static', 'trailing', 'eod_trailing', 'static_balance', 'trailing_equity', 'trailing_balance'], true) ? $body['drawdown_type'] : 'static';

        $p1_profit_target = isset($body['p1_profit_target']) ? (float)$body['p1_profit_target'] : (isset($body['p1_target_pct']) ? (float)$body['p1_target_pct'] : 8.0);
        $p2_profit_target = isset($body['p2_profit_target']) ? (float)$body['p2_profit_target'] : (isset($body['p2_target_pct']) ? (float)$body['p2_target_pct'] : 5.0);
        $p3_profit_target = isset($body['p3_profit_target']) ? (float)$body['p3_profit_target'] : (isset($body['p3_target_pct']) ? (float)$body['p3_target_pct'] : 3.0);

        $daily_dd = isset($body['p1_daily_dd']) ? (float)$body['p1_daily_dd'] : (isset($body['daily_dd_pct']) ? (float)$body['daily_dd_pct'] : 5.0);
        $max_dd = isset($body['p1_max_dd']) ? (float)$body['p1_max_dd'] : (isset($body['max_dd_pct']) ? (float)$body['max_dd_pct'] : 10.0);

        $funded_profit_split = isset($body['funded_profit_split']) ? (float)$body['funded_profit_split'] : (isset($body['funded_profit_split_pct']) ? (float)$body['funded_profit_split_pct'] : 80.0);
        $max_leverage = isset($body['max_leverage']) ? (int)$body['max_leverage'] : (isset($body['leverage']) ? (int)$body['leverage'] : 100);

        $data = [
            'name'                 => $name,
            'slug'                 => !empty($body['slug']) ? sanitize_title($body['slug']) : sanitize_title($name . '-' . $account_size),
            'account_size'         => $account_size,
            'price'                => $price,
            'currency'             => sanitize_text_field($body['currency'] ?? 'USD'),
            'plan_type'            => $plan_type,
            'is_instant_funding'   => $plan_type === 'instant' ? 1 : 0,
            'phases'               => $plan_type === '1-step' ? 1 : ($plan_type === '2-step' ? 2 : ($plan_type === '3-step' ? 3 : 0)),
            'drawdown_type'        => $drawdown_type,
            'p1_profit_target'     => $p1_profit_target,
            'p1_daily_dd'          => $daily_dd,
            'p1_max_dd'            => $max_dd,
            'p1_min_days'          => isset($body['p1_min_days']) ? (int)$body['p1_min_days'] : 5,
            'p1_max_days'          => isset($body['p1_max_days']) ? (int)$body['p1_max_days'] : 30,
            'p2_profit_target'     => $p2_profit_target,
            'p2_daily_dd'          => isset($body['p2_daily_dd']) ? (float)$body['p2_daily_dd'] : $daily_dd,
            'p2_max_dd'            => isset($body['p2_max_dd']) ? (float)$body['p2_max_dd'] : $max_dd,
            'p2_min_days'          => isset($body['p2_min_days']) ? (int)$body['p2_min_days'] : 5,
            'p2_max_days'          => isset($body['p2_max_days']) ? (int)$body['p2_max_days'] : 60,
            'p3_profit_target'     => $p3_profit_target,
            'p3_daily_dd'          => isset($body['p3_daily_dd']) ? (float)$body['p3_daily_dd'] : $daily_dd,
            'p3_max_dd'            => isset($body['p3_max_dd']) ? (float)$body['p3_max_dd'] : $max_dd,
            'p3_min_days'          => isset($body['p3_min_days']) ? (int)$body['p3_min_days'] : 5,
            'p3_max_days'          => isset($body['p3_max_days']) ? (int)$body['p3_max_days'] : 60,
            'funded_profit_split'  => $funded_profit_split,
            'funded_max_dd'        => isset($body['funded_max_dd']) ? (float)$body['funded_max_dd'] : $max_dd,
            'max_leverage'         => $max_leverage,
            'max_lot_size'         => isset($body['max_lot_size']) ? (float)$body['max_lot_size'] : 50.0,
            'news_trading'         => isset($body['news_trading']) ? (int)$body['news_trading'] : 1,
            'news_window_minutes'  => isset($body['news_window_minutes']) ? (int)$body['news_window_minutes'] : 5,
            'weekend_holding'      => isset($body['weekend_holding']) ? (int)$body['weekend_holding'] : 0,
            'consistency_rule'     => isset($body['consistency_rule']) ? (int)$body['consistency_rule'] : 0,
            'consistency_pct'      => isset($body['consistency_pct']) ? (float)$body['consistency_pct'] : 50.0,
            'min_trade_seconds'    => isset($body['min_trade_seconds']) ? (int)$body['min_trade_seconds'] : 0,
            'min_hold_action'      => isset($body['min_hold_action']) ? sanitize_text_field($body['min_hold_action']) : 'flag',
            'margin_call_level'    => isset($body['margin_call_level']) ? (float)$body['margin_call_level'] : 0.0,
            'stop_out_level'       => isset($body['stop_out_level']) ? (float)$body['stop_out_level'] : 0.0,
            'stop_loss_required'   => isset($body['stop_loss_required']) ? (int)$body['stop_loss_required'] : 0,
            'max_inactivity_days'  => isset($body['max_inactivity_days']) ? (int)$body['max_inactivity_days'] : 30,
            'ip_matching_required' => isset($body['ip_matching_required']) ? (int)$body['ip_matching_required'] : 0,
            'ea_allowed'           => isset($body['ea_allowed']) ? (int)$body['ea_allowed'] : 1,
            'copy_trading_allowed' => isset($body['copy_trading_allowed']) ? (int)$body['copy_trading_allowed'] : 1,
            'martingale_allowed'   => isset($body['martingale_allowed']) ? (int)$body['martingale_allowed'] : 1,
            'hedging_allowed'      => isset($body['hedging_allowed']) ? (int)$body['hedging_allowed'] : 1,
            'evaluation_profit_share' => isset($body['evaluation_profit_share']) ? (float)$body['evaluation_profit_share'] : 0.0,
            'refundable_fee'       => isset($body['refundable_fee']) ? (int)$body['refundable_fee'] : 0,
            'scaling_enabled'      => isset($body['scaling_enabled']) ? (int)$body['scaling_enabled'] : 0,
            'scaling_growth_pct'   => isset($body['scaling_growth_pct']) ? (float)$body['scaling_growth_pct'] : 25.0,
            'scaling_interval_months' => isset($body['scaling_interval_months']) ? (int)$body['scaling_interval_months'] : 4,
            'scaling_required_profit_pct' => isset($body['scaling_required_profit_pct']) ? (float)$body['scaling_required_profit_pct'] : 10.0,
            'scaling_max_balance'  => isset($body['scaling_max_balance']) ? (float)$body['scaling_max_balance'] : 2000000.0,
            'reset_discount_pct'   => isset($body['reset_discount_pct']) ? (float)$body['reset_discount_pct'] : 0.0,
            'is_active'            => isset($body['is_active']) ? (int)$body['is_active'] : 1,
            'sort_order'           => isset($body['sort_order']) ? (int)$body['sort_order'] : 0,
        ];

        $id = (int)($body['id'] ?? 0);
        $tbl = $wpdb->prefix . 'fxsim_challenge_plans';

        if ($id > 0) {
            $updated = $wpdb->update($tbl, $data, ['id' => $id]);
            if ($updated === false && !empty($wpdb->last_error)) {
                error_log('[PropFirm Plan Update Error] ' . $wpdb->last_error);
                return new WP_REST_Response(['error' => 'Database error while updating plan. Please check server logs.'], 500);
            }
        } else {
            // Check if slug already exists to prevent duplicate slug crash
            $existing_slug = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$tbl} WHERE slug = %s", $data['slug']));
            if ($existing_slug) {
                $data['slug'] = $data['slug'] . '-' . rand(100, 999);
            }
            $inserted = $wpdb->insert($tbl, $data);
            if ($inserted === false || !empty($wpdb->last_error)) {
                error_log('[PropFirm Plan Insert Error] ' . $wpdb->last_error);
                return new WP_REST_Response(['error' => 'Database error while creating plan. Please check server logs.'], 500);
            }
            $id = (int)$wpdb->insert_id;
        }

        $saved = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$tbl} WHERE id = %d", $id), ARRAY_A);
        FXSIM_Database::log_admin(get_current_user_id(), 'plan_save', null, "Plan ID: $id ({$name})");
        return new WP_REST_Response([
            'success' => true,
            'id'      => $id,
            'plan'    => $saved,
            'message' => 'Plan saved successfully.'
        ]);
    }

    public static function admin_plan_delete(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) ($r->get_param('id') ?: ($r->get_json_params()['id'] ?? 0));
        if (!$id) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid plan ID.'], 400);
        }

        $active_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE plan_id = %d",
            $id
        ));

        if ($active_count > 0) {
            $wpdb->update($wpdb->prefix . 'fxsim_challenge_plans', ['is_active' => 0], ['id' => $id]);
            FXSIM_Database::log_admin(get_current_user_id(), 'plan_deactivate', null, "Plan ID {$id} deactivated (has {$active_count} attached accounts)");
            return new WP_REST_Response([
                'success' => true,
                'message' => "Plan archived/deactivated because {$active_count} trader account(s) are linked to it.",
                'deactivated' => true
            ]);
        } else {
            $wpdb->delete($wpdb->prefix . 'fxsim_challenge_plans', ['id' => $id]);
            FXSIM_Database::log_admin(get_current_user_id(), 'plan_delete', null, "Plan ID {$id} permanently deleted");
            return new WP_REST_Response(['success' => true, 'message' => 'Plan deleted successfully.']);
        }
    }

    public static function admin_plans_purge_and_reset(WP_REST_Request $r = null): WP_REST_Response {
        global $wpdb;
        $tbl = $wpdb->prefix . 'fxsim_challenge_plans';
        $wpdb->query("TRUNCATE TABLE {$tbl}");

        $standard_plans = [
            [
                'name'                    => '$100K Stellar 2-Step',
                'slug'                    => 'stellar-100k-2step',
                'account_size'            => 100000.00,
                'price'                   => 499.00,
                'currency'                => 'USD',
                'plan_type'               => '2-step',
                'is_instant_funding'      => 0,
                'phases'                  => 2,
                'drawdown_type'           => 'static',
                'p1_profit_target'        => 8.00,
                'p1_daily_dd'             => 5.00,
                'p1_max_dd'               => 10.00,
                'p1_min_days'             => 5,
                'p1_max_days'             => 30,
                'p2_profit_target'        => 5.00,
                'p2_daily_dd'             => 5.00,
                'p2_max_dd'               => 10.00,
                'p2_min_days'             => 5,
                'p2_max_days'             => 60,
                'funded_profit_split'     => 85.00,
                'funded_max_dd'           => 10.00,
                'max_leverage'            => 100,
                'max_lot_size'            => 50.00,
                'news_trading'            => 1,
                'weekend_holding'         => 1,
                'ea_allowed'              => 1,
                'scaling_enabled'         => 1,
                'scaling_growth_pct'      => 25.00,
                'scaling_interval_months' => 3,
                'is_active'               => 1,
                'sort_order'              => 1,
            ],
            [
                'name'                    => '$50K Rapid 1-Step',
                'slug'                    => 'rapid-50k-1step',
                'account_size'            => 50000.00,
                'price'                   => 299.00,
                'currency'                => 'USD',
                'plan_type'               => '1-step',
                'is_instant_funding'      => 0,
                'phases'                  => 1,
                'drawdown_type'           => 'trailing',
                'p1_profit_target'        => 10.00,
                'p1_daily_dd'             => 4.00,
                'p1_max_dd'               => 6.00,
                'p1_min_days'             => 3,
                'p1_max_days'             => 0,
                'funded_profit_split'     => 80.00,
                'funded_max_dd'           => 6.00,
                'max_leverage'            => 100,
                'max_lot_size'            => 25.00,
                'news_trading'            => 1,
                'weekend_holding'         => 0,
                'ea_allowed'              => 1,
                'scaling_enabled'         => 1,
                'scaling_growth_pct'      => 25.00,
                'scaling_interval_months' => 4,
                'is_active'               => 1,
                'sort_order'              => 2,
            ],
            [
                'name'                    => '$25K Direct Instant Funded',
                'slug'                    => 'instant-25k-funded',
                'account_size'            => 25000.00,
                'price'                   => 349.00,
                'currency'                => 'USD',
                'plan_type'               => 'instant',
                'is_instant_funding'      => 1,
                'phases'                  => 0,
                'drawdown_type'           => 'static',
                'p1_profit_target'        => 0.00,
                'p1_daily_dd'             => 3.00,
                'p1_max_dd'               => 6.00,
                'p1_min_days'             => 0,
                'p1_max_days'             => 0,
                'funded_profit_split'     => 75.00,
                'funded_max_dd'           => 6.00,
                'max_leverage'            => 50,
                'max_lot_size'            => 15.00,
                'news_trading'            => 1,
                'weekend_holding'         => 1,
                'ea_allowed'              => 1,
                'scaling_enabled'         => 1,
                'scaling_growth_pct'      => 25.00,
                'scaling_interval_months' => 3,
                'is_active'               => 1,
                'sort_order'              => 3,
            ],
            [
                'name'                    => '$150K Futures EOD Trailing',
                'slug'                    => 'futures-150k-eod',
                'account_size'            => 150000.00,
                'price'                   => 599.00,
                'currency'                => 'USD',
                'plan_type'               => '1-step',
                'is_instant_funding'      => 0,
                'phases'                  => 1,
                'drawdown_type'           => 'eod_trailing',
                'p1_profit_target'        => 6.00,
                'p1_daily_dd'             => 0.00,
                'p1_max_dd'               => 4.00,
                'p1_min_days'             => 5,
                'p1_max_days'             => 0,
                'funded_profit_split'     => 90.00,
                'funded_max_dd'           => 4.00,
                'max_leverage'            => 100,
                'max_lot_size'            => 75.00,
                'news_trading'            => 1,
                'weekend_holding'         => 0,
                'ea_allowed'              => 1,
                'scaling_enabled'         => 1,
                'scaling_growth_pct'      => 30.00,
                'scaling_interval_months' => 3,
                'is_active'               => 1,
                'sort_order'              => 4,
            ],
        ];

        foreach ($standard_plans as $p) {
            $wpdb->insert($tbl, $p);
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'plans_purged_and_reset', null, 'Reset to 4 standard industry blueprints');
        return new WP_REST_Response([
            'success' => true,
            'message' => 'All plans purged and successfully reset to the 4 standard industry blueprints.',
            'plans'   => FXSIM_Challenge_DB::get_all_plans(false)
        ]);
    }

    public static function admin_plans_bulk_delete(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $ids = $body['ids'] ?? [];
        $delete_all = !empty($body['all']);
        $tbl = $wpdb->prefix . 'fxsim_challenge_plans';

        if ($delete_all) {
            $wpdb->query("TRUNCATE TABLE {$tbl}");
            return new WP_REST_Response(['success' => true, 'message' => 'All challenge plans permanently deleted.']);
        }

        if (empty($ids) || !is_array($ids)) {
            return new WP_REST_Response(['error' => 'No plan IDs provided.'], 400);
        }

        $clean_ids = array_map('intval', $ids);
        $ids_str = implode(',', $clean_ids);
        $wpdb->query("DELETE FROM {$tbl} WHERE id IN ({$ids_str})");

        return new WP_REST_Response([
            'success' => true,
            'message' => count($clean_ids) . ' plan(s) permanently deleted.'
        ]);
    }

    public static function admin_rules_get(): WP_REST_Response {
        return new WP_REST_Response([
            'max_inactivity_days'         => (int) FXSIM_Challenge_DB::get_setting('max_inactivity_days', 30),
            'news_window_minutes'         => (int) FXSIM_Challenge_DB::get_setting('news_window_minutes', 5),
            'min_payout_amount'           => (float) FXSIM_Challenge_DB::get_setting('min_payout_amount', 50.0),
            'large_payout_threshold'      => (float) FXSIM_Challenge_DB::get_setting('large_payout_threshold', 5000.0),
            'payout_frequency_days'       => (int) FXSIM_Challenge_DB::get_setting('payout_frequency_days', 14),
            'mandatory_kyc'               => (int) FXSIM_Challenge_DB::get_setting('mandatory_kyc', 1),
            'weekend_holding_default'     => (int) FXSIM_Challenge_DB::get_setting('weekend_holding_default', 0),
            'min_trading_days_default'    => (int) FXSIM_Challenge_DB::get_setting('min_trading_days_default', 5),
            'stop_loss_required_default'  => (int) FXSIM_Challenge_DB::get_setting('stop_loss_required_default', 0),
        ]);
    }

    public static function admin_rules_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $fields = [
            'max_inactivity_days', 'news_window_minutes', 'min_payout_amount',
            'large_payout_threshold', 'payout_frequency_days', 'mandatory_kyc',
            'weekend_holding_default', 'min_trading_days_default', 'stop_loss_required_default'
        ];
        foreach ($fields as $k) {
            if (isset($body[$k])) {
                FXSIM_Challenge_DB::set_setting($k, sanitize_text_field((string)$body[$k]));
            }
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'system_rules_save', null, wp_json_encode($body));
        return new WP_REST_Response(['success' => true, 'message' => 'System rules saved successfully.']);
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
        $all['pause_registrations'] = $all['pause_registrations'] ?? '0';
        $all['pause_trading']       = $all['pause_trading'] ?? '0';
        $all['pause_payouts']       = $all['pause_payouts'] ?? '0';
        $all['pause_purchases']     = $all['pause_purchases'] ?? '0';
        $all['news_lock']           = (bool) get_option('fxsim_news_lock', false);
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
            'font_family'     => $g('font_family', 'poppins'),
            'radius'          => $g('radius', 'md'),
            'cookie_domain'   => $g('cookie_domain', ''),
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
        $allowed = ['brand_name','brand_tagline','primary_color','secondary_color','font_family','radius','cookie_domain','logo_url',
                    'login_logo_url','sidebar_icon_url','setup_completed','tv_symbol_map',
                    'favicon_url','support_email','discord_webhook','telegram_bot','telegram_chat',
                    'footer_text','challenge_label','funded_label','coinpayments_pub_key',
                    'coinpayments_priv_key','frontend_url',
                    'pause_registrations','pause_payouts','pause_purchases','pause_trading','large_payout_threshold',
                    'manual_payment_instructions','manual_crypto_address',
                    'stripe_public_key','stripe_secret_key','stripe_webhook_secret',
                    'confirmo_api_key','confirmo_callback_secret'];
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
                if ($key === 'cookie_domain') update_option('fxsim_cookie_domain', trim($val));
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
        $orders = FXSIM_Payments::get_all_orders();
        // proof_url is a relative filesystem path (see submit_proof() /
        // admin_payment_proof()), not a public URL — hand the admin UI a
        // proper endpoint to fetch it through instead. Relative to the
        // namespace root, not rest_url() — an absolute backend URL bypasses
        // the frontend's dev-mode same-origin proxy, and the browser has no
        // session cookie for the backend's own domain, only for the proxy's
        // origin — see apiUrl() in fxsim.ts, which resolves this correctly
        // for both dev (proxied) and production (direct cross-origin).
        foreach ($orders as $o) {
            $o->proof_view_url = !empty($o->proof_url) ? "/admin/payments/{$o->id}/proof" : null;
        }
        return new WP_REST_Response($orders);
    }

    /** GET /admin/payments/{id}/proof — stream a protected payment-proof file to an admin. */
    public static function admin_payment_proof(WP_REST_Request $r) {
        global $wpdb;
        $id  = (int) $r->get_param('id');
        $rel = $wpdb->get_var($wpdb->prepare(
            "SELECT proof_url FROM {$wpdb->prefix}fxsim_payment_orders WHERE id=%d", $id));
        if (!$rel) return new WP_REST_Response(['error' => 'Not found'], 404);
        $u    = wp_upload_dir();
        $path = $u['basedir'] . '/' . ltrim($rel, '/');
        if (!file_exists($path)) return new WP_REST_Response(['error' => 'File missing'], 404);
        // Same CORS + streaming pattern as admin_kyc_doc() — this handler exits
        // before the normal REST response pipeline (and its CORS filter) runs.
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = class_exists('ProTradeFX_Headless_Bridge') && method_exists('ProTradeFX_Headless_Bridge', 'allowed_origins')
            ? ProTradeFX_Headless_Bridge::allowed_origins()
            : ['https://demo.launchapropfirm.com', 'http://localhost:3000'];
        if ($origin && (in_array($origin, $allowed, true) || in_array(untrailingslashit($origin), array_map('untrailingslashit', $allowed), true))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, X-FXSIM-Token, Authorization');
            header('Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length');
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
        $source_mode = $body['source_mode'] ?? $body['price_source_mode'] ?? null;
        if ($source_mode !== null) {
            $mode = in_array($source_mode, ['auto','mt5','yahoo'], true) ? $source_mode : 'auto';
            update_option('fxsim_price_source_mode', $mode, false);
        }
        $stale_secs = $body['mt5_stale_secs'] ?? $body['stale_threshold_sec'] ?? null;
        if ($stale_secs !== null) {
            $secs = (int) $stale_secs;
            if ($secs < 3)   $secs = 3;
            if ($secs > 300) $secs = 300;
            update_option('fxsim_mt5_stale_secs', $secs, false);
        }
        if (array_key_exists('auto_failover', $body)) {
            update_option('fxsim_feed_auto_failover', (bool)$body['auto_failover'], false);
        }
        if (array_key_exists('auto_freeze', $body)) {
            update_option('fxsim_feed_auto_freeze', (bool)$body['auto_freeze'], false);
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
            $secret = FXSIM_Price_Feed::get_ingest_secret();
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

    /**
     * POST /mt5/sync
     * Ingest live balance, equity, positions, and deals from local/VPS Python MT5 Sync Worker (Option B).
     */
    public static function mt5_account_sync(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;

        // Verify shared feed secret if configured. This endpoint writes
        // account balance/equity/breach-status straight from the request
        // body, so the check must REQUIRE a matching key whenever one is
        // configured — the previous "&& !empty($provided)" meant simply
        // omitting the header skipped verification entirely, letting an
        // unauthenticated caller overwrite any trader's balance or force a
        // fake drawdown breach. hash_equals($secret, '') already correctly
        // evaluates to false, so no extra emptiness check is needed.
        $secret = (string) get_option('fxsim_mt5_ingest_secret', get_option('fxsim_price_feed_secret', ''));
        $provided = (string) ($r->get_header('x-feed-key') ?: $r->get_header('x-fxsim-feed-key'));

        if ($secret !== '' && !hash_equals($secret, $provided)) {
            return new WP_REST_Response(['success' => false, 'error' => 'Unauthorized feed key.'], 401);
        }

        $body = $r->get_json_params() ?: $r->get_body_params();
        if (empty($body)) {
            return new WP_REST_Response(['success' => false, 'error' => 'Empty payload.'], 400);
        }

        $account_info = $body['account_info'] ?? [];
        $positions    = $body['positions'] ?? [];
        $deals        = $body['deals'] ?? [];
        $challenge_id = (int)($body['challenge_id'] ?? 0);
        $login_id     = sanitize_text_field((string)($account_info['login'] ?? ''));
        $server_name  = sanitize_text_field((string)($account_info['server'] ?? ''));

        $balance = (float)($account_info['balance'] ?? 0.0);
        $equity  = (float)($account_info['equity'] ?? $balance);

        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';

        // 1. Locate challenge account
        $ch = null;
        if ($challenge_id > 0) {
            $ch = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$ca_table} WHERE id = %d", $challenge_id));
        }

        if (!$ch && !empty($login_id)) {
            $ch = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$ca_table} WHERE mt5_login = %s LIMIT 1",
                $login_id
            ));
        }

        $breach_detected = false;
        $breach_reason = '';

        if ($ch) {
            $current_ch_id = (int)$ch->id;
            $start_bal = (float)$ch->starting_balance;
            $daily_start = (float)$ch->daily_start_balance;
            $plan_id = (int)$ch->plan_id;

            // Fetch plan rules
            $plan = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}fxsim_challenge_plans WHERE id = %d", $plan_id
            ));

            // $plan->max_total_drawdown / max_daily_drawdown do not exist as
            // columns on fxsim_challenge_plans (the schema is stage-prefixed:
            // p1_max_dd/p1_daily_dd .. p3_*, funded_max_dd) — this silently
            // fell back to a hardcoded 10%/5% for every plan regardless of its
            // real configured limits. Resolve the correct stage-appropriate
            // field instead. Also: the gate below used to check only
            // status === 'active', which is NEVER true for a funded account
            // (its status is 'funded') — this breach check could never fire
            // for exactly the accounts this MT5-sync endpoint exists for.
            $phase = (int)($ch->phase ?? 1);
            if ($ch->status === 'funded') {
                $max_dd_pct = (float)($ch->custom_max_dd ?? ($plan->funded_max_dd ?? 10.0));
                $daily_dd_pct = null; // No funded-stage daily-DD concept in this schema — evaluated nowhere else in the platform either.
            } elseif ($ch->status === 'active') {
                $max_field = "p{$phase}_max_dd";
                $daily_field = "p{$phase}_daily_dd";
                $max_dd_pct = (float)($ch->custom_max_dd ?? ($plan->$max_field ?? 10.0));
                $daily_dd_pct = (float)($ch->custom_daily_dd ?? ($plan->$daily_field ?? 5.0));
            } else {
                $max_dd_pct = null;
                $daily_dd_pct = null; // Terminal status (failed/passed/cancelled/suspended) — nothing to breach.
            }

            // Evaluate Max Drawdown
            if ($max_dd_pct !== null) {
                $max_loss_allowed = $start_bal * ($max_dd_pct / 100.0);
                $current_drawdown = $start_bal - $equity;
                if ($current_drawdown >= $max_loss_allowed) {
                    $breach_detected = true;
                    $breach_reason = sprintf('Max Drawdown Breached: Equity $%.2f is below allowed floor of $%.2f (%.1f%% loss)', $equity, $start_bal - $max_loss_allowed, $max_dd_pct);
                }
            }

            // Evaluate Daily Drawdown (evaluation phases only)
            if ($daily_dd_pct !== null && !$breach_detected) {
                $daily_loss_allowed = $daily_start * ($daily_dd_pct / 100.0);
                $daily_loss = $daily_start - $equity;
                if ($daily_loss >= $daily_loss_allowed) {
                    $breach_detected = true;
                    $breach_reason = sprintf('Daily Drawdown Breached: Equity $%.2f lost more than %.1f%% of daily starting balance ($%.2f)', $equity, $daily_dd_pct, $daily_start);
                }
            }

            // Update challenge account state
            $peak_bal = max((float)$ch->peak_balance, $balance);
            $equity_hwm = max((float)$ch->equity_hwm, $equity);
            $new_status = $breach_detected ? 'failed' : $ch->status;

            $wpdb->update($ca_table, [
                'current_balance' => $balance,
                'peak_balance'    => $peak_bal,
                'equity_hwm'      => $equity_hwm,
                'status'          => $new_status,
                'breach_reason'   => $breach_detected ? $breach_reason : $ch->breach_reason,
                'breach_at'       => $breach_detected ? current_time('mysql') : $ch->breach_at,
            ], ['id' => $current_ch_id]);

            // Also update underlying fxsim_accounts table if present
            if (!empty($ch->fxsim_account_id)) {
                $wpdb->update($wpdb->prefix . 'fxsim_accounts', [
                    'balance' => $balance,
                    'equity'  => $equity,
                ], ['id' => $ch->fxsim_account_id]);
            }

            // If breach detected, trigger alerts. $ch->status here is still
            // the PRE-update value read at the top of the function — checking
            // only 'active' silently skipped every funded-account breach
            // (their status is 'funded'), same bug as the detection gate above.
            if ($breach_detected && in_array($ch->status, ['active', 'funded'], true)) {
                if (class_exists('FXSIM_Database')) {
                    FXSIM_Database::push_notification(
                        (int)$ch->user_id,
                        'error',
                        '⚠️ Account Drawdown Breach Detected',
                        $breach_reason,
                        home_url('/dashboard/')
                    );
                }
                
                if (class_exists('FXSIM_Webhooks')) {
                    FXSIM_Webhooks::trigger_discord('breach', [
                        'trader'   => get_the_author_meta('display_name', $ch->user_id) ?: 'Trader #' . $ch->user_id,
                        'account'  => '#' . $current_ch_id,
                        'reason'   => $breach_reason,
                        'equity'   => $equity,
                        'balance'  => $balance,
                    ]);
                }
            }
        }

        return new WP_REST_Response([
            'success'          => true,
            'challenge_id'     => $ch ? (int)$ch->id : 0,
            'status'           => $ch ? $ch->status : 'unlinked',
            'balance'          => $balance,
            'equity'           => $equity,
            'positions_count'  => count($positions),
            'deals_count'      => count($deals),
            'breach_detected'  => $breach_detected,
            'breach_reason'    => $breach_reason,
            'server_timestamp' => current_time('mysql'),
            'message'          => 'MT5 telemetry synchronized successfully.',
        ]);
    }

    /**
     * GET /mt5/sync-targets
     *
     * Returns every challenge account that has MT5 credentials assigned
     * (via admin_save_mt5()/admin_user_mt5_save(), both of which write to
     * fxsim_challenge_accounts.mt5_*) and is still in a live status. Feed-key
     * authenticated the same way as /mt5/sync — this is meant to be polled
     * by an unattended background worker (mt5-account-syncer.py), not a
     * logged-in admin session, so it can run as a long-lived service.
     *
     * This closes the loop the manual MT5-credential-entry flow always had a
     * gap in: previously, syncing an account's real MT5 telemetry back into
     * the platform required someone to hand-maintain a separate config file
     * listing every account's login/password/server, kept in sync by hand
     * with whatever an admin had typed into the admin panel. The admin panel
     * entry *is* the source of truth already — this endpoint just exposes it
     * to the worker so a newly-assigned MT5 account is picked up automatically
     * on the worker's next poll, with nothing else to configure.
     *
     * SECURITY NOTE: this returns MT5 account passwords in plaintext — that is
     * unavoidable, the worker needs them to log in — which is exactly why this
     * is feed-key gated identically to /mt5/sync (same fxsim_mt5_ingest_secret).
     * Treat that secret as sensitive as any of the credentials it protects.
     */
    public static function mt5_sync_targets(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;

        $secret = (string) get_option('fxsim_mt5_ingest_secret', get_option('fxsim_price_feed_secret', ''));
        $provided = (string) ($r->get_header('x-feed-key') ?: $r->get_header('x-fxsim-feed-key'));
        if ($secret !== '' && !hash_equals($secret, $provided)) {
            return new WP_REST_Response(['success' => false, 'error' => 'Unauthorized feed key.'], 401);
        }

        $rows = $wpdb->get_results(
            "SELECT id AS challenge_id, mt5_login, mt5_password, mt5_server, mt5_account_type, status, phase
             FROM {$wpdb->prefix}fxsim_challenge_accounts
             WHERE mt5_login IS NOT NULL AND mt5_login != ''
               AND status IN ('active', 'funded')
             ORDER BY id ASC"
        );

        $targets = array_map(function ($row) {
            return [
                'challenge_id'     => (int) $row->challenge_id,
                'login'            => $row->mt5_login,
                'password'         => $row->mt5_password,
                'server'           => $row->mt5_server,
                'account_type'     => $row->mt5_account_type,
                'status'           => $row->status,
            ];
        }, $rows ?: []);

        return new WP_REST_Response([
            'success' => true,
            'count'   => count($targets),
            'targets' => $targets,
        ]);
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

        $test_hook = null;
        if (!empty($body['host'])) {
            $test_hook = function(\PHPMailer\PHPMailer\PHPMailer $mailer) use ($body) {
                $mailer->isSMTP();
                $mailer->Host       = sanitize_text_field($body['host']);
                $mailer->Port       = (int)($body['port'] ?? 587);
                $mailer->SMTPAuth   = isset($body['auth']) ? (bool)$body['auth'] : true;
                if (!empty($body['user'])) $mailer->Username = sanitize_text_field($body['user']);
                if (isset($body['pass']) && $body['pass'] !== '') $mailer->Password = (string)$body['pass'];
                $mailer->SMTPSecure = sanitize_text_field($body['secure'] ?? 'tls');
                if (!empty($body['from_email'])) $mailer->From = sanitize_email($body['from_email']);
                if (!empty($body['from_name'])) $mailer->FromName = sanitize_text_field($body['from_name']);
            };
            add_action('phpmailer_init', $test_hook, 999);
        }

        $brand  = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System';
        $result = wp_mail(
            $to,
            "{$brand} SMTP test email",
            "<p>If you received this, your SMTP configuration is working correctly.</p>"
            . "<p>Sent: " . current_time('mysql') . "</p>",
            ['Content-Type: text/html; charset=UTF-8']
        );

        if ($test_hook) {
            remove_action('phpmailer_init', $test_hook, 999);
        }

        return new WP_REST_Response([
            'success' => $result,
            'message' => $result
                ? "Test email sent to {$to}. Check your inbox."
                : 'wp_mail() returned false. Check SMTP credentials and logs.',
        ]);
    }

    public static function admin_demo_purge(WP_REST_Request $r = null): WP_REST_Response {
        global $wpdb;
        $pfx = $wpdb->prefix;

        // 1. Run registry-based deletion first if present
        self::admin_demo_remove();

        // 2. Clear ALL trading activities, positions, snapshots, and breaches
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_trades");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_positions");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_challenge_snapshots");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_challenge_breaches");

        // 3. Clear challenge accounts and virtual accounts
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_challenge_accounts");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_accounts");

        // 4. Clear all financial orders, payouts, and commissions
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_payouts");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_payment_orders");

        // 5. Clear notifications, tickets, and thread messages
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_notifications");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_ticket_messages");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_tickets");

        // 6. Clear tournaments, competitions, and participants
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_tournament_participants");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_tournaments");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_competition_participants");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_competitions");

        // 7. Clear PvP battles & live event logs
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_pvp_events");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_pvp_matches");

        // 8. Clear Risk syndicates, scaling events, and KYC submissions
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_syndicate_clusters");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_scaling_events");
        $wpdb->query("TRUNCATE TABLE {$pfx}fxsim_kyc");

        // 9. Preserve configured challenge plans (plans remain intact as promised to admins)

        // 10. Delete ALL non-admin users completely
        if (!function_exists('wp_delete_user')) {
            require_once ABSPATH . 'wp-admin/includes/user.php';
        }
        $non_admin_users = $wpdb->get_col("
            SELECT ID FROM {$wpdb->users}
            WHERE ID != 1 AND user_login != 'admin'
        ");
        if (!empty($non_admin_users)) {
            foreach ($non_admin_users as $du_id) {
                wp_delete_user((int)$du_id);
            }
        }

        // 11. Delete all demo registries and transients
        delete_option(self::DEMO_REGISTRY_KEY);
        delete_transient('fxsim_demo_registry');
        delete_option('fxsim_seeded_matches');
        delete_option('fxsim_seeded_tickets');
        delete_option('fxsim_admin_stats_cache');
        delete_transient('fxsim_admin_stats');

        FXSIM_Database::log_admin(get_current_user_id(), 'total_fresh_system_reset');

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Total fresh install purge complete. All test traders, accounts, trades, tickets, orders, and duplicate plans have been wiped. Clean 4 standard blueprint plans are active.'
        ]);
    }

    public static function admin_marketing_broadcast(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $audience = sanitize_text_field($body['audience'] ?? 'all');
        $subject  = sanitize_text_field($body['subject'] ?? 'Important Trader Update');
        $message  = wp_kses_post($body['message'] ?? '');

        if (empty($message)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Broadcast message body cannot be empty.'], 400);
        }

        $query = "SELECT u.ID, u.user_email, u.display_name, u.user_login FROM {$wpdb->users} u";
        if ($audience === 'active') {
            $query .= " INNER JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.user_id = u.ID WHERE ca.status = 'active'";
        } elseif ($audience === 'funded') {
            $query .= " INNER JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.user_id = u.ID WHERE ca.status = 'funded'";
        } elseif ($audience === 'breached') {
            $query .= " INNER JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.user_id = u.ID WHERE ca.status = 'failed'";
        } else {
            $query .= " WHERE 1=1";
        }
        $query .= " GROUP BY u.ID LIMIT 500";
        $recipients = $wpdb->get_results($query) ?: [];
        $sent_count = 0;

        foreach ($recipients as $trader) {
            $rendered = str_replace(
                ['{trader_name}', '{login_id}', '{account_balance}'],
                [$trader->display_name ?: $trader->user_login, $trader->user_login, '$100,000.00'],
                $message
            );
            if (class_exists('FXSIM_Database')) {
                FXSIM_Database::log_notification(
                    $trader->ID,
                    'info',
                    $subject,
                    strip_tags($rendered)
                );
            }
            $sent_count++;
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'email_broadcast_sent', null, "Audience: $audience | Sent: $sent_count");

        return new WP_REST_Response([
            'success' => true,
            'audience' => $audience,
            'sent' => max(1, $sent_count),
            'message' => "Broadcast successfully dispatched to " . max(1, $sent_count) . " traders."
        ]);
    }

    /**
     * GET /admin/mt5/unassigned
     *
     * Funded challenge accounts with no MT5 credentials assigned yet. MT5
     * account creation/assignment is a fully manual step (see
     * MASTER_AUDIT_IMPLEMENTATION_REPORT.md) — this exists purely as an
     * operational safety net so a newly-funded trader is never silently
     * missed. Admin-authenticated (not feed-key) — this is for the admin UI,
     * not the background sync worker.
     */
    public static function admin_mt5_unassigned(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT ca.id AS challenge_id, ca.user_id, ca.funded_at, u.display_name, u.user_email
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->users} u ON u.ID = ca.user_id
             WHERE ca.status = 'funded'
               AND (ca.mt5_login IS NULL OR ca.mt5_login = '')
             ORDER BY ca.funded_at ASC"
        );

        $unassigned = array_map(function ($row) {
            return [
                'challenge_id' => (int)$row->challenge_id,
                'user_id'      => (int)$row->user_id,
                'name'         => $row->display_name ?: $row->user_email,
                'email'        => $row->user_email,
                'funded_at'    => $row->funded_at,
                'days_waiting' => $row->funded_at ? max(0, (int) floor((time() - strtotime($row->funded_at)) / DAY_IN_SECONDS)) : null,
            ];
        }, $rows ?: []);

        return new WP_REST_Response([
            'success' => true,
            'count'   => count($unassigned),
            'traders' => $unassigned,
        ]);
    }

    public static function admin_mt5_bridge_get(): WP_REST_Response {
        // 'connected'/'latency_ms'/'status' were previously hardcoded to
        // always claim "operational" regardless of whether any real MT5
        // Manager gateway exists — this reports only saved configuration
        // state. Use POST /admin/mt5/bridge/test for an actual reachability
        // check (still not a real MT5-protocol verification — see its docblock).
        return new WP_REST_Response([
            'server_ip'        => get_option('fxsim_mt5_server_ip', '127.0.0.1'),
            'server_port'      => (int) get_option('fxsim_mt5_server_port', 443),
            'manager_login'    => get_option('fxsim_mt5_manager_login', '1001'),
            'manager_pass_set' => get_option('fxsim_mt5_manager_pass', '') !== '',
            'demo_group'       => get_option('fxsim_mt5_demo_group', 'demo\\forex-eval'),
            'funded_group'     => get_option('fxsim_mt5_funded_group', 'real\\funded-pro'),
            'status'           => 'not_verified',
            'note'             => 'This platform has no MT5 Manager API integration. These fields are saved configuration only — use "Test Connection" for a real (network-level only) reachability check.',
        ]);
    }

    public static function admin_mt5_bridge_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        if (isset($body['server_ip'])) update_option('fxsim_mt5_server_ip', sanitize_text_field($body['server_ip']), false);
        if (isset($body['server_port'])) update_option('fxsim_mt5_server_port', (int) $body['server_port'], false);
        if (isset($body['manager_login'])) update_option('fxsim_mt5_manager_login', sanitize_text_field($body['manager_login']), false);
        if (!empty($body['manager_pass'])) update_option('fxsim_mt5_manager_pass', sanitize_text_field($body['manager_pass']), false);
        if (isset($body['demo_group'])) update_option('fxsim_mt5_demo_group', sanitize_text_field($body['demo_group']), false);
        if (isset($body['funded_group'])) update_option('fxsim_mt5_funded_group', sanitize_text_field($body['funded_group']), false);
        
        FXSIM_Database::log_admin(get_current_user_id(), 'mt5_bridge_save');
        return new WP_REST_Response(['success' => true]);
    }

    public static function admin_mt5_bridge_test(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $server = sanitize_text_field($body['server_ip'] ?? get_option('fxsim_mt5_server_ip', '127.0.0.1'));
        $port = (int) ($body['server_port'] ?? get_option('fxsim_mt5_server_port', 443));

        // This previously always returned a fabricated "Connected!" message
        // with a random fake latency (rand(18,32)) regardless of whether
        // anything was actually listening at server_ip:server_port — an
        // admin could type garbage here and still see a fake success. This
        // does a real TCP handshake instead. Note: a successful socket
        // connect only proves *something* is listening on that port — it
        // does NOT verify it's a real MT5 Manager gateway speaking the MT5
        // protocol (this codebase has no MT5 Manager API client at all, see
        // FXSIM_MT5_Manager — that would require a real Manager API SDK).
        $t0 = microtime(true);
        $conn = @fsockopen($server, $port, $errno, $errstr, 3.0);
        $latency_ms = (int) round((microtime(true) - $t0) * 1000);

        if (!$conn) {
            return new WP_REST_Response([
                'success'    => false,
                'connected'  => false,
                'server'     => "$server:$port",
                'message'    => "Could not reach $server:$port — {$errstr} (errno {$errno}). Note: reaching the port only confirms network connectivity, not a valid MT5 Manager API session (this platform does not implement the MT5 Manager protocol).",
            ]);
        }
        fclose($conn);

        return new WP_REST_Response([
            'success'    => true,
            'connected'  => true,
            'latency_ms' => $latency_ms,
            'server'     => "$server:$port",
            'message'    => "TCP connection to $server:$port succeeded ({$latency_ms}ms). This confirms network reachability only — this platform has no real MT5 Manager API integration, so this does NOT confirm a working MT5 gateway.",
        ]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PAYMENT GATEWAYS CONFIGURATION ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    public static function admin_payment_gateways_get(): WP_REST_Response {
        return new WP_REST_Response([
            'stripe_enabled'        => (bool) FXSIM_Challenge_DB::get_setting('stripe_enabled', 1),
            'stripe_public_key'     => FXSIM_Challenge_DB::get_setting('stripe_public_key', ''),
            'stripe_secret_key'     => FXSIM_Challenge_DB::get_setting('stripe_secret_key', ''),
            'stripe_webhook_secret' => FXSIM_Challenge_DB::get_setting('stripe_webhook_secret', ''),
            'cryptomus_enabled'     => (bool) get_option('fxsim_cryptomus_enabled', 1),
            'cryptomus_merchant_id' => get_option('fxsim_cryptomus_merchant_id', ''),
            'cryptomus_api_key'     => get_option('fxsim_cryptomus_api_key', ''),
            'nowpayments_enabled'   => (bool) get_option('fxsim_nowpayments_enabled', 0),
            'nowpayments_api_key'   => get_option('fxsim_nowpayments_api_key', ''),
            'paypal_enabled'        => (bool) get_option('fxsim_paypal_enabled', 0),
            'paypal_client_id'      => get_option('fxsim_paypal_client_id', ''),
            'paypal_secret'         => get_option('fxsim_paypal_secret', ''),
            'manual_crypto_enabled' => (bool) get_option('fxsim_manual_crypto_enabled', 1),
            'manual_bank_enabled'   => (bool) get_option('fxsim_manual_bank_enabled', 1),
        ]);
    }

    public static function admin_payment_gateways_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();

        if (isset($body['stripe_enabled'])) FXSIM_Challenge_DB::set_setting('stripe_enabled', (int) $body['stripe_enabled']);
        if (isset($body['stripe_public_key'])) FXSIM_Challenge_DB::set_setting('stripe_public_key', sanitize_text_field($body['stripe_public_key']));
        if (isset($body['stripe_secret_key']) && !empty($body['stripe_secret_key'])) FXSIM_Challenge_DB::set_setting('stripe_secret_key', sanitize_text_field($body['stripe_secret_key']));
        if (isset($body['stripe_webhook_secret']) && !empty($body['stripe_webhook_secret'])) FXSIM_Challenge_DB::set_setting('stripe_webhook_secret', sanitize_text_field($body['stripe_webhook_secret']));

        if (isset($body['cryptomus_enabled'])) update_option('fxsim_cryptomus_enabled', (int) $body['cryptomus_enabled'], false);
        if (isset($body['cryptomus_merchant_id'])) update_option('fxsim_cryptomus_merchant_id', sanitize_text_field($body['cryptomus_merchant_id']), false);
        if (isset($body['cryptomus_api_key']) && !empty($body['cryptomus_api_key'])) update_option('fxsim_cryptomus_api_key', sanitize_text_field($body['cryptomus_api_key']), false);

        if (isset($body['nowpayments_enabled'])) update_option('fxsim_nowpayments_enabled', (int) $body['nowpayments_enabled'], false);
        if (isset($body['nowpayments_api_key']) && !empty($body['nowpayments_api_key'])) update_option('fxsim_nowpayments_api_key', sanitize_text_field($body['nowpayments_api_key']), false);

        if (isset($body['paypal_enabled'])) update_option('fxsim_paypal_enabled', (int) $body['paypal_enabled'], false);
        if (isset($body['paypal_client_id'])) update_option('fxsim_paypal_client_id', sanitize_text_field($body['paypal_client_id']), false);
        if (isset($body['paypal_secret']) && !empty($body['paypal_secret'])) update_option('fxsim_paypal_secret', sanitize_text_field($body['paypal_secret']), false);

        if (isset($body['manual_crypto_enabled'])) update_option('fxsim_manual_crypto_enabled', (int) $body['manual_crypto_enabled'], false);
        if (isset($body['manual_bank_enabled'])) update_option('fxsim_manual_bank_enabled', (int) $body['manual_bank_enabled'], false);

        FXSIM_Database::log_admin(get_current_user_id(), 'payment_gateways_save');
        return new WP_REST_Response(['success' => true, 'message' => 'Payment gateway configurations saved successfully.']);
    }

    // ════════════════════════════════════════════════════════════════════════
    // MULTI-ADMIN TEAM & RBAC ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    public static function admin_team_list(): WP_REST_Response {
        $users = get_users(['role__in' => ['administrator', 'editor', 'author']]);
        $out = [];
        foreach ($users as $u) {
            $role_meta = get_user_meta($u->ID, 'fxsim_admin_role', true) ?: ($u->has_cap('administrator') ? 'super_admin' : 'support_agent');
            $status = get_user_meta($u->ID, 'fxsim_account_status', true) ?: 'active';
            $last_login = get_user_meta($u->ID, 'last_login', true) ?: $u->user_registered;
            $out[] = [
                'id'         => (int) $u->ID,
                'name'       => $u->display_name ?: $u->user_login,
                'email'      => $u->user_email,
                'role'       => $role_meta,
                'status'     => $status,
                'last_login' => $last_login,
                'created_at' => $u->user_registered,
            ];
        }
        return new WP_REST_Response($out);
    }

    public static function admin_team_invite(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $email = sanitize_email($body['email'] ?? '');
        $name = sanitize_text_field($body['name'] ?? '');
        $role = sanitize_text_field($body['role'] ?? 'support_agent');
        $pass = !empty($body['password']) ? $body['password'] : wp_generate_password(12, true, true);

        if (!is_email($email)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid email address.'], 400);
        }

        if (email_exists($email)) {
            return new WP_REST_Response(['success' => false, 'message' => 'User with this email already exists.'], 400);
        }

        $username = sanitize_user(explode('@', $email)[0] . '_' . rand(100, 999));
        $uid = wp_create_user($username, $pass, $email);
        if (is_wp_error($uid)) {
            return new WP_REST_Response(['success' => false, 'message' => $uid->get_error_message()], 500);
        }

        $user = new WP_User($uid);
        if ($role === 'super_admin') {
            $user->set_role('administrator');
        } else {
            $user->set_role('editor');
        }
        wp_update_user(['ID' => $uid, 'display_name' => $name ?: $username]);
        update_user_meta($uid, 'fxsim_admin_role', $role);
        update_user_meta($uid, 'fxsim_account_status', 'active');

        FXSIM_Database::log_admin(get_current_user_id(), 'team_member_invite', $uid, "Invited $name ($email) as $role");

        return new WP_REST_Response([
            'success'       => true,
            'user_id'       => $uid,
            'temp_password' => $pass,
            'message'       => "Team member $name successfully provisioned with role $role."
        ]);
    }

    public static function admin_team_update_role(WP_REST_Request $r): WP_REST_Response {
        $id = (int) $r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $role = sanitize_text_field($body['role'] ?? 'support_agent');

        if (!$id || !get_userdata($id)) {
            return new WP_REST_Response(['success' => false, 'message' => 'User not found.'], 404);
        }

        if ($id === 1 && $role !== 'super_admin') {
            return new WP_REST_Response(['success' => false, 'message' => 'Primary Super Admin (#1) role cannot be changed.'], 400);
        }

        $u = new WP_User($id);
        if ($role === 'super_admin') {
            $u->set_role('administrator');
        } else {
            $u->set_role('editor');
        }

        update_user_meta($id, 'fxsim_admin_role', $role);
        FXSIM_Database::log_admin(get_current_user_id(), 'team_role_update', $id, "Updated role to $role");
        return new WP_REST_Response(['success' => true, 'message' => 'Staff role updated.']);
    }

    public static function admin_team_delete(WP_REST_Request $r): WP_REST_Response {
        $id = (int) $r->get_param('id');
        if ($id === get_current_user_id()) {
            return new WP_REST_Response(['success' => false, 'message' => 'You cannot remove your own administrative account.'], 400);
        }
        if ($id === 1) {
            return new WP_REST_Response(['success' => false, 'message' => 'Primary Super Admin (#1) cannot be deactivated.'], 400);
        }

        // 1. Mark account status suspended in usermeta
        update_user_meta($id, 'fxsim_account_status', 'suspended');

        // 2. Strip administrative roles/capabilities
        $u = new WP_User($id);
        $u->set_role('subscriber');

        // 3. Invalidate all existing sessions / cookies for this user
        if (class_exists('WP_Session_Tokens')) {
            $sessions = \WP_Session_Tokens::get_instance($id);
            $sessions->destroy_all();
        }
        if (function_exists('wp_destroy_user_sessions')) {
            wp_destroy_user_sessions($id);
        }

        // 4. Invalidate custom auth tokens
        delete_user_meta($id, 'fxsim_auth_token');
        delete_transient('fxsim_token_' . $id);

        FXSIM_Database::log_admin(get_current_user_id(), 'team_member_suspend', $id, "Deactivated staff member #$id and revoked all active sessions");
        return new WP_REST_Response(['success' => true, 'message' => 'Staff member access deactivated and sessions revoked.']);
    }

    // ════════════════════════════════════════════════════════════════════════
    // CERTIFICATES STUDIO ENDPOINTS
    // ════════════════════════════════════════════════════════════════════════

    public static function admin_certificates_templates_get(): WP_REST_Response {
        $templates = get_option('fxsim_certificate_templates', null);
        if (!$templates) {
            $templates = [
                'phase1' => [
                    'title'          => 'CERTIFICATE OF ACHIEVEMENT',
                    'subtitle'       => 'Phase 1 Evaluation Target Mastered',
                    'body'           => 'This is proudly presented to {trader_name} for outstanding discipline, risk management, and profit target attainment on simulated account {login_id}.',
                    'signatory_name' => 'Chief Risk Officer',
                    'signatory_role' => 'PropFirm Risk Desk',
                    'show_qr'        => 1,
                    'theme_badge'    => 'gold',
                    'accent_color'   => '#10B981',
                ],
                'phase2' => [
                    'title'          => 'CERTIFICATE OF ELITE PASS',
                    'subtitle'       => 'Phase 2 Verification Fully Concluded',
                    'body'           => 'Conferred to {trader_name} for exceptional risk consistency, passing all verification metrics on simulated account {login_id}.',
                    'signatory_name' => 'Managing Director',
                    'signatory_role' => 'Global Funding Allocation Desk',
                    'show_qr'        => 1,
                    'theme_badge'    => 'platinum',
                    'accent_color'   => '#3B82F6',
                ],
                'payout' => [
                    'title'          => 'OFFICIAL PAYOUT CERTIFICATE',
                    'subtitle'       => 'Funded Trader Profit Share Disbursement',
                    'body'           => 'Certifying that {trader_name} has generated consistent returns and successfully received a simulated profit disbursement of {payout_amount}.',
                    'signatory_name' => 'Head of Treasury',
                    'signatory_role' => 'PropFirm Treasury & Settlements',
                    'show_qr'        => 1,
                    'theme_badge'    => 'emerald',
                    'accent_color'   => '#10B981',
                ],
            ];
        }
        return new WP_REST_Response($templates);
    }

    public static function admin_certificates_templates_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        update_option('fxsim_certificate_templates', $body, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'certificate_templates_save');
        return new WP_REST_Response(['success' => true, 'message' => 'Certificate studio templates saved.']);
    }

    // ════════════════════════════════════════════════════════════════════════
    // WEBHOOK INTEGRATIONS (DISCORD & TELEGRAM)
    // ════════════════════════════════════════════════════════════════════════

    public static function admin_webhooks_get(WP_REST_Request $r): WP_REST_Response {
        $defaults = [
            'discord_enabled'      => false,
            'discord_webhook_url'  => '',
            'telegram_enabled'     => false,
            'telegram_bot_token'   => '',
            'telegram_chat_id'     => '',
            'notify_on_purchase'   => true,
            'notify_on_payout'     => true,
            'notify_on_breach'     => true,
            'notify_on_kyc'        => true,
        ];
        $stored = get_option('fxsim_webhooks_config', []);
        return new WP_REST_Response(array_merge($defaults, is_array($stored) ? $stored : []));
    }

    public static function admin_webhooks_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $clean = [
            'discord_enabled'      => !empty($body['discord_enabled']),
            'discord_webhook_url'  => sanitize_text_field($body['discord_webhook_url'] ?? ''),
            'telegram_enabled'     => !empty($body['telegram_enabled']),
            'telegram_bot_token'   => sanitize_text_field($body['telegram_bot_token'] ?? ''),
            'telegram_chat_id'     => sanitize_text_field($body['telegram_chat_id'] ?? ''),
            'notify_on_purchase'   => !empty($body['notify_on_purchase']),
            'notify_on_payout'     => !empty($body['notify_on_payout']),
            'notify_on_breach'     => !empty($body['notify_on_breach']),
            'notify_on_kyc'        => !empty($body['notify_on_kyc']),
        ];
        update_option('fxsim_webhooks_config', $clean, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'webhooks_save');
        return new WP_REST_Response(['success' => true, 'message' => 'Webhook integrations saved successfully.']);
    }

    public static function admin_webhooks_test(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $channel = sanitize_text_field($body['channel'] ?? 'discord');
        $stored  = get_option('fxsim_webhooks_config', []);

        $discord_url = !empty($body['discord_webhook_url']) ? sanitize_text_field($body['discord_webhook_url']) : ($stored['discord_webhook_url'] ?? '');
        $tg_token    = !empty($body['telegram_bot_token']) ? sanitize_text_field($body['telegram_bot_token']) : ($stored['telegram_bot_token'] ?? '');
        $tg_chat_id  = !empty($body['telegram_chat_id']) ? sanitize_text_field($body['telegram_chat_id']) : ($stored['telegram_chat_id'] ?? '');

        $site_name = get_bloginfo('name') ?: 'Prop Firm System';
        $timestamp = gmdate('Y-m-d H:i:s') . ' UTC';

        if ($channel === 'discord') {
            if (empty($discord_url)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Discord Webhook URL is empty.'], 400);
            }
            $payload = [
                'username'   => $site_name . ' Alert Hub',
                'avatar_url' => 'https://cdn-icons-png.flaticon.com/512/906/906361.png',
                'embeds'     => [
                    [
                        'title'       => '⚡ Webhook Handshake Verified!',
                        'description' => "Real-time institutional telemetry channel connected successfully from **{$site_name}**.",
                        'color'       => 0x10B981, // Emerald green
                        'fields'      => [
                            ['name' => '📡 Status', 'value' => '🟢 Active & Streaming', 'inline' => true],
                            ['name' => '⏱️ Timestamp', 'value' => $timestamp, 'inline' => true],
                            ['name' => '🛡️ Active Events', 'value' => 'Purchases, Payouts, Breaches, KYC', 'inline' => false],
                        ],
                        'footer' => [
                            'text' => 'Prop Firm System • Turnkey SaaS Operations'
                        ]
                    ]
                ]
            ];

            $res = wp_remote_post($discord_url, [
                'headers' => ['Content-Type' => 'application/json; charset=utf-8'],
                'body'    => wp_json_encode($payload),
                'timeout' => 10,
            ]);

            if (is_wp_error($res)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Discord Error: ' . $res->get_error_message()], 500);
            }

            $code = wp_remote_retrieve_response_code($res);
            if ($code >= 200 && $code < 300) {
                return new WP_REST_Response(['success' => true, 'message' => 'Discord test handshake sent! Check your Discord channel.']);
            }
            return new WP_REST_Response(['success' => false, 'message' => 'Discord responded with HTTP ' . $code . ': ' . wp_remote_retrieve_body($res)], 500);
        }

        if ($channel === 'telegram') {
            if (empty($tg_token) || empty($tg_chat_id)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Telegram Bot Token or Chat ID is empty.'], 400);
            }

            $text = "⚡ *[{$site_name}] Webhook Handshake Verified*\n\n" .
                    "🟢 *Status:* Active & Operational\n" .
                    "⏱️ *Timestamp:* `{$timestamp}`\n" .
                    "🛡️ *Alert Streams:* Purchases, Payouts, Breaches, KYC\n\n" .
                    "Institutional operations telemetry is streaming to this chat.";

            $url = "https://api.telegram.org/bot{$tg_token}/sendMessage";
            $res = wp_remote_post($url, [
                'headers' => ['Content-Type' => 'application/json'],
                'body'    => wp_json_encode([
                    'chat_id'    => $tg_chat_id,
                    'text'       => $text,
                    'parse_mode' => 'Markdown',
                ]),
                'timeout' => 10,
            ]);

            if (is_wp_error($res)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Telegram Error: ' . $res->get_error_message()], 500);
            }

            $code = wp_remote_retrieve_response_code($res);
            $resp_body = json_decode(wp_remote_retrieve_body($res), true);
            if ($code === 200 && !empty($resp_body['ok'])) {
                return new WP_REST_Response(['success' => true, 'message' => 'Telegram test message sent! Check your Telegram chat.']);
            }
            $err_desc = $resp_body['description'] ?? wp_remote_retrieve_body($res);
            return new WP_REST_Response(['success' => false, 'message' => 'Telegram Error: ' . $err_desc], 500);
        }

        return new WP_REST_Response(['success' => false, 'message' => 'Unknown channel.'], 400);
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
        
        // Generate a secure token
        $token = bin2hex(random_bytes(32));
        
        // Store mapping in transient for 2 hours
        set_transient('fxsim_impersonation_' . $token, $admin_id, 2 * HOUR_IN_SECONDS);
        
        // Set secure cookie
        $is_secure = is_ssl();
        setcookie('fxsim_impersonation_token', $token, time() + 2 * HOUR_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN, $is_secure, true);

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
        
        $token = $_COOKIE['fxsim_impersonation_token'] ?? '';
        if (empty($token)) {
            return new WP_REST_Response(['success' => false, 'message' => 'No active impersonation session token.'], 400);
        }
        
        $admin_id = (int) get_transient('fxsim_impersonation_' . $token);
        
        if (!$admin_id || !user_can($admin_id, 'manage_options')) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid or expired impersonation session.'], 400);
        }
        
        // Clean up transient and cookie
        delete_transient('fxsim_impersonation_' . $token);
        $is_secure = is_ssl();
        setcookie('fxsim_impersonation_token', '', time() - 3600, COOKIEPATH, COOKIE_DOMAIN, $is_secure, true);

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

        $title = substr(sanitize_text_field($b['title'] ?? $b['name'] ?? ''), 0, 160);
        $message = sanitize_textarea_field($b['message'] ?? $b['description'] ?? $title ?? '');
        if ($message === '' && $title === '') {
            return new WP_REST_Response(['success' => false, 'error' => 'Banner title or message is required.'], 400);
        }
        if ($message === '') {
            $message = $title;
        }

        $raw_placement = $b['placement'] ?? 'both';
        $placement  = in_array($raw_placement, ['top', 'dashboard', 'login', 'marketing', 'both'], true) ? $raw_placement : 'both';
        
        $raw_scope  = $b['scope_type'] ?? 'global';
        $scope_type = in_array($raw_scope, ['global', 'page'], true) ? $raw_scope : 'global';

        $bg_color   = sanitize_text_field($b['bg_color'] ?? '#10B981');
        $text_color = sanitize_text_field($b['text_color'] ?? '#0B0F19');
        $coupon     = substr(sanitize_text_field($b['coupon_code'] ?? $b['promo_code'] ?? ''), 0, 64) ?: null;
        $cta_label  = substr(sanitize_text_field($b['cta_label'] ?? $b['cta_text'] ?? ''), 0, 80) ?: 'Claim Discount';
        $cta_url    = !empty($b['cta_url'] ?? $b['cta_link'] ?? null) ? esc_url_raw($b['cta_url'] ?? $b['cta_link']) : '/checkout';

        $active = 1;
        if (isset($b['active'])) {
            $active = !empty($b['active']) ? 1 : 0;
        } elseif (isset($b['is_active'])) {
            $active = !empty($b['is_active']) ? 1 : 0;
        }

        $data = [
            'title'        => $title ?: substr($message, 0, 80),
            'message'      => $message,
            'placement'    => $placement,
            'scope_type'   => $scope_type,
            'scope_path'   => $scope_type === 'page' ? substr(sanitize_text_field($b['scope_path'] ?? ''), 0, 191) : null,
            'bg_color'     => $bg_color ?: '#10B981',
            'text_color'   => $text_color ?: '#0B0F19',
            'cta_label'    => $cta_label,
            'cta_url'      => $cta_url,
            'coupon_code'  => $coupon,
            'starts_at'    => self::banner_dt($b['starts_at'] ?? null),
            'ends_at'      => self::banner_dt($b['ends_at'] ?? null),
            'countdown_to' => self::banner_dt($b['countdown_to'] ?? null),
            'active'       => $active,
            'priority'     => (int) ($b['priority'] ?? 0),
            'impressions'  => (int) ($b['impressions'] ?? 0),
            'clicks'       => (int) ($b['clicks'] ?? 0),
            'updated_at'   => current_time('mysql'),
        ];

        $tbl = $wpdb->prefix . 'fxsim_banners';
        if ($id > 0) {
            $updated = $wpdb->update($tbl, $data, ['id' => $id]);
            if ($updated === false && !empty($wpdb->last_error)) {
                error_log('[PropFirm Banner Update Error] ' . $wpdb->last_error);
                return new WP_REST_Response(['success' => false, 'error' => 'Database error while updating banner. Please check server logs.'], 500);
            }
        } else {
            $data['created_at'] = current_time('mysql');
            $inserted = $wpdb->insert($tbl, $data);
            if ($inserted === false || !empty($wpdb->last_error)) {
                error_log('[PropFirm Banner Insert Error] ' . $wpdb->last_error);
                return new WP_REST_Response(['success' => false, 'error' => 'Database error while creating banner. Please check server logs.'], 500);
            }
            $id = (int) $wpdb->insert_id;
        }

        $saved = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$tbl} WHERE id=%d", $id));
        FXSIM_Database::log_admin(get_current_user_id(), 'banner_save', $id, $data['title'] ?: $data['message']);

        return new WP_REST_Response([
            'success' => true,
            'id'      => $id,
            'banner'  => $saved,
            'message' => 'Promotional banner saved successfully.'
        ]);
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

    /** GET /admin/affiliates/config — retrieve global affiliate program settings. */
    public static function admin_affiliate_config_get(): WP_REST_Response {
        return new WP_REST_Response([
            'tier_1_pct'  => (float) FXSIM_Challenge_DB::get_setting('affiliate_tier_1_pct', 15),
            'tier_2_pct'  => (float) FXSIM_Challenge_DB::get_setting('affiliate_tier_2_pct', 5),
            'cookie_days' => (int)   FXSIM_Challenge_DB::get_setting('affiliate_cookie_days', 60),
            'min_payout'  => (float) FXSIM_Challenge_DB::get_setting('affiliate_min_payout', 100),
        ]);
    }

    /** POST /admin/affiliates/config — update global affiliate program settings. */
    public static function admin_affiliate_config_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        if (isset($body['tier_1_pct'])) {
            FXSIM_Challenge_DB::set_setting('affiliate_tier_1_pct', max(0, min(100, (float)$body['tier_1_pct'])));
        }
        if (isset($body['tier_2_pct'])) {
            FXSIM_Challenge_DB::set_setting('affiliate_tier_2_pct', max(0, min(100, (float)$body['tier_2_pct'])));
        }
        if (isset($body['cookie_days'])) {
            FXSIM_Challenge_DB::set_setting('affiliate_cookie_days', max(1, min(365, (int)$body['cookie_days'])));
        }
        if (isset($body['min_payout'])) {
            FXSIM_Challenge_DB::set_setting('affiliate_min_payout', max(10, (float)$body['min_payout']));
        }
        FXSIM_Database::log_admin(get_current_user_id(), 'affiliate_config_save', null, wp_json_encode($body));
        return new WP_REST_Response(['success' => true, 'message' => 'Affiliate program configurations updated.']);
    }

    /** POST /admin/affiliates/payout — manual payout trigger. */
    public static function admin_affiliate_payout_create(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body   = $r->get_json_params() ?: $r->get_body_params();
        $aff_id = (int)($body['affiliate_id'] ?? 0);
        $amount = (float)($body['amount'] ?? 0);
        $method = sanitize_text_field($body['method'] ?? 'crypto');
        $dest   = sanitize_text_field($body['destination'] ?? '');

        if (!$aff_id || $amount <= 0) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid affiliate ID or amount.'], 400);
        }

        $aff = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_affiliates WHERE id = %d", $aff_id));
        if (!$aff) {
            return new WP_REST_Response(['success' => false, 'message' => 'Affiliate not found.'], 404);
        }

        $wpdb->insert($wpdb->prefix . 'fxsim_affiliate_payouts', [
            'affiliate_id'    => $aff_id,
            'amount'          => $amount,
            'status'          => 'paid',
            'payment_method'  => $method,
            'destination'     => $dest ?: $aff->payment_destination,
            'tx_reference'    => sanitize_text_field($body['tx_reference'] ?? ('PAY-' . time())),
            'admin_note'      => sanitize_text_field($body['note'] ?? 'Manual admin payout execution'),
            'requested_at'    => current_time('mysql'),
            'processed_at'    => current_time('mysql'),
        ]);

        // Mark pending commissions as paid
        $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}fxsim_commissions SET status='paid', paid_at=NOW()
             WHERE affiliate_id = %d AND status IN ('pending','approved') LIMIT 50",
            $aff_id
        ));

        FXSIM_Database::log_admin(get_current_user_id(), 'affiliate_payout_manual', (int)$aff->user_id, "Amount: \${$amount}");
        return new WP_REST_Response(['success' => true, 'message' => 'Affiliate payout processed successfully.']);
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
                    // Deferred (send_async, with retry) — unlike 2FA the user
                    // isn't staring at a code-entry screen waiting on this, so
                    // there's no reason to block the response on SMTP latency.
                    if (method_exists('FXSIM_Emails', 'send_async')) {
                        FXSIM_Emails::send_async((int) $user->ID, 'password_reset', ['reset_url' => $reset_url]);
                    } else {
                        FXSIM_Emails::send((int) $user->ID, 'password_reset', ['reset_url' => $reset_url]);
                    }
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

    // ── Automated Scaling Plan Engine ─────────────────────────────────────────
    public static function admin_scaling_rules_get(WP_REST_Request $r): WP_REST_Response {
        $defaults = [
            'profit_target_pct'      => 10.00,
            'evaluation_period_days' => 90,
            'min_payouts'            => 2,
            'balance_multiplier_pct' => 25.00,
            'new_profit_split'       => 90.00,
            'max_capital_cap'        => 2000000.00,
            'auto_scale'             => false,
        ];
        $stored = get_option('fxsim_scaling_rules_config', []);
        return new WP_REST_Response(array_merge($defaults, is_array($stored) ? $stored : []));
    }

    public static function admin_scaling_rules_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $clean = [
            'profit_target_pct'      => (float)($body['profit_target_pct'] ?? 10.00),
            'evaluation_period_days' => max(1, (int)($body['evaluation_period_days'] ?? 90)),
            'min_payouts'            => max(1, (int)($body['min_payouts'] ?? 2)),
            'balance_multiplier_pct' => (float)($body['balance_multiplier_pct'] ?? 25.00),
            'new_profit_split'       => (float)($body['new_profit_split'] ?? 90.00),
            'max_capital_cap'        => (float)($body['max_capital_cap'] ?? 2000000.00),
            'auto_scale'             => !empty($body['auto_scale']),
        ];
        update_option('fxsim_scaling_rules_config', $clean, false);
        FXSIM_Database::log_admin(get_current_user_id(), 'scaling_rules_save');
        return new WP_REST_Response(['success' => true, 'message' => 'Scaling plan parameters saved successfully.', 'rules' => $clean]);
    }

    public static function admin_scaling_queue_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $rules = self::admin_scaling_rules_get($r)->get_data();

        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';
        $acc_table = $wpdb->prefix . 'fxsim_accounts';
        $users_table = $wpdb->users;
        $payouts_table = $wpdb->prefix . 'fxsim_payouts';

        $accounts = $wpdb->get_results("
            SELECT 
                ca.id, ca.user_id, ca.fxsim_account_id, ca.plan_id, ca.status,
                ca.starting_balance, ca.current_balance, ca.scaling_level,
                ca.custom_profit_split, ca.funded_at, ca.last_scaled_at,
                u.display_name AS trader_name, u.user_email AS trader_email,
                acc.balance AS live_balance, acc.equity AS live_equity
            FROM {$ca_table} ca
            LEFT JOIN {$users_table} u ON ca.user_id = u.ID
            LEFT JOIN {$acc_table} acc ON ca.fxsim_account_id = acc.id
            WHERE ca.status = 'funded'
            ORDER BY ca.id DESC
        ") ?: [];

        $queue = [];
        $history = $wpdb->get_results("
            SELECT * FROM {$wpdb->prefix}fxsim_scaling_events 
            ORDER BY id DESC LIMIT 50
        ") ?: [];

        foreach ($accounts as $acc) {
            $payout_count = (int)$wpdb->get_var($wpdb->prepare("
                SELECT COUNT(*) FROM {$payouts_table} 
                WHERE challenge_id = %d AND status IN ('completed', 'approved', 'paid')
            ", $acc->id));

            $start_bal = (float)$acc->starting_balance ?: 100000;
            $current_bal = (float)$acc->live_balance ?: (float)$acc->current_balance;
            $roi = $start_bal > 0 ? round((($current_bal - $start_bal) / $start_bal) * 100, 2) : 0;

            $multiplier = (float)($rules['balance_multiplier_pct'] ?? 25.00);
            $scaled_balance = round($start_bal * (1 + ($multiplier / 100)), 2);
            if ($scaled_balance > (float)($rules['max_capital_cap'] ?? 2000000)) {
                $scaled_balance = (float)$rules['max_capital_cap'];
            }

            $is_eligible = (
                $roi >= (float)$rules['profit_target_pct'] && 
                $payout_count >= (int)$rules['min_payouts'] && 
                $start_bal < (float)$rules['max_capital_cap']
            );

            $queue[] = [
                'id'                 => (int)$acc->id,
                'user_id'            => (int)$acc->user_id,
                'trader_name'        => $acc->trader_name ?: "Trader #{$acc->user_id}",
                'trader_email'       => $acc->trader_email ?: '',
                'current_balance'    => $start_bal,
                'scaled_balance'     => $scaled_balance,
                'current_profit_pct' => $roi,
                'payouts_count'      => $payout_count,
                'scaling_level'      => (int)($acc->scaling_level ?? 0),
                'current_split'      => (float)($acc->custom_profit_split ?: 80.00),
                'new_split'          => (float)($rules['new_profit_split'] ?? 90.00),
                'is_eligible'        => $is_eligible,
                'status'             => $is_eligible ? 'eligible' : 'in_progress',
            ];
        }

        return new WP_REST_Response([
            'success' => true,
            'rules'   => $rules,
            'queue'   => $queue,
            'history' => $history,
        ]);
    }

    public static function admin_scaling_apply(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int)$r->get_param('id');
        $ca = $wpdb->get_row($wpdb->prepare("
            SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts 
            WHERE id = %d
        ", $id));

        if (!$ca || $ca->status !== 'funded') {
            return new WP_REST_Response(['error' => 'Funded challenge account not found.'], 404);
        }

        $rules = self::admin_scaling_rules_get($r)->get_data();
        $start_bal = (float)$ca->starting_balance ?: 100000;
        $multiplier = (float)($rules['balance_multiplier_pct'] ?? 25.00);
        $new_bal = round($start_bal * (1 + ($multiplier / 100)), 2);

        // Cap against the MORE restrictive of the global admin ceiling and the
        // plan's own scaling_max_balance — a plan-level ceiling is a promise
        // made to the trader at purchase time and must never be exceeded just
        // because a global admin default happens to allow more.
        $plan_for_cap = FXSIM_Challenge_DB::get_plan((int)$ca->plan_id);
        $cap = (float)$rules['max_capital_cap'];
        if ($plan_for_cap && (float)$plan_for_cap->scaling_max_balance > 0) {
            $cap = min($cap, (float)$plan_for_cap->scaling_max_balance);
        }
        if ($new_bal > $cap) {
            $new_bal = $cap;
        }

        $old_split = (float)($ca->custom_profit_split ?: 80.00);
        $new_split = (float)($rules['new_profit_split'] ?? 90.00);
        $new_level = (int)$ca->scaling_level + 1;
        $now = current_time('mysql');

        // Real ROI, computed the same way admin_scaling_queue_get() displays it,
        // instead of a hardcoded placeholder.
        $live_bal_for_roi = $ca->fxsim_account_id
            ? (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", (int)$ca->fxsim_account_id))
            : $start_bal;
        $real_roi = $start_bal > 0 ? round((($live_bal_for_roi - $start_bal) / $start_bal) * 100, 2) : 0.0;
        $real_payout_count = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payouts WHERE challenge_id = %d AND status IN ('approved','paid')", $id
        ));

        // 1. Update challenge account — also rebase equity_hwm/trailing_dd_floor
        // (same pattern already applied to the payout 'paid' transition) so a
        // trailing-drawdown plan's floor moves up with the new, larger balance
        // instead of staying pinned to the pre-scale level.
        $allowed_trail_pct = $plan_for_cap ? (float)$plan_for_cap->funded_max_dd : 0;
        $abs_trail = round($new_bal * ($allowed_trail_pct / 100), 2);
        $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
            'starting_balance'    => $new_bal,
            'current_balance'     => $new_bal,
            'peak_balance'        => $new_bal,
            'daily_start_balance' => $new_bal,
            'equity_hwm'          => $new_bal,
            'trailing_dd_floor'   => round($new_bal - $abs_trail, 2),
            'custom_profit_split' => $new_split,
            'scaling_level'       => $new_level,
            'last_scaled_at'      => $now,
        ], ['id' => $id]);

        // 2. Update underlying trading account balance & equity
        if ($ca->fxsim_account_id) {
            $wpdb->update($wpdb->prefix . 'fxsim_accounts', [
                'balance' => $new_bal,
                'equity'  => $new_bal,
            ], ['id' => (int)$ca->fxsim_account_id]);
        }

        // 3. Record scaling event log
        $wpdb->insert($wpdb->prefix . 'fxsim_scaling_events', [
            'challenge_account_id' => $id,
            'user_id'              => $ca->user_id,
            'old_balance'          => $start_bal,
            'new_balance'          => $new_bal,
            'old_split'            => $old_split,
            'new_split'            => $new_split,
            'roi_achieved'         => $real_roi,
            'payouts_completed'    => $real_payout_count,
            'status'               => 'applied',
            'reviewed_by'          => get_current_user_id(),
            'applied_at'           => $now,
        ]);

        // 4. Notifications & Emails
        FXSIM_Database::push_notification(
            (int)$ca->user_id,
            'success',
            'Account Scaled Up!',
            "Congratulations! Your funded capital was scaled by +{$multiplier}% to $" . number_format($new_bal, 2) . " with a {$new_split}% profit split upgrade.",
            '/dashboard'
        );

        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send((int)$ca->user_id, 'account_scaled', [
                'old_balance' => number_format($start_bal, 2),
                'new_balance' => number_format($new_bal, 2),
                'new_split'   => $new_split,
            ]);
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'scaling_applied', (int)$ca->user_id, "Account #{$id} scaled from \${$start_bal} to \${$new_bal} ({$new_split}% split)");

        return new WP_REST_Response([
            'success'     => true,
            'message'     => "Account #{$id} successfully scaled to $" . number_format($new_bal, 2) . " (+{$multiplier}%) with {$new_split}% profit split.",
            'new_balance' => $new_bal,
            'new_split'   => $new_split,
        ]);
    }

    // ── Confirmo Crypto Checkout ─────────────────────────────────────────────

    // ── Challenge Plans (public) — enhanced with v11 fields ──────────────────
    // Override original to include drawdown_type, instant funding, scaling info

    public static function trade_notes_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $trade_id = (int) $r->get_param('id');
        $user_id  = get_current_user_id();

        // Verify the trade belongs to an account owned by this user
        $trade = $wpdb->get_row($wpdb->prepare("
            SELECT t.id FROM {$wpdb->prefix}fxsim_trades t
            JOIN {$wpdb->prefix}fxsim_accounts a ON t.account_id = a.id
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
            JOIN {$wpdb->prefix}fxsim_accounts a ON t.account_id = a.id
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

    // ── Support Tickets & Helpdesk Handlers ─────────────────────────────────

    /** GET /tickets — current user tickets */
    public static function tickets_my_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT t.*, 
                    (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_ticket_messages WHERE ticket_id = t.id) AS message_count,
                    (SELECT message FROM {$wpdb->prefix}fxsim_ticket_messages WHERE ticket_id = t.id ORDER BY id DESC LIMIT 1) AS latest_message
             FROM {$wpdb->prefix}fxsim_tickets t
             WHERE t.trader_id = %d
             ORDER BY t.updated_at DESC",
            $user_id
        )) ?: [];
        return new WP_REST_Response($rows);
    }

    /** POST /tickets/create — create a new ticket */
    public static function ticket_create(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $body = $r->get_json_params() ?: $r->get_body_params();

        $subject = sanitize_text_field($body['subject'] ?? '');
        $message = sanitize_textarea_field($body['message'] ?? '');
        $category = in_array($body['category'] ?? '', ['billing', 'rules', 'tech_mt5', 'kyc', 'general'], true) ? $body['category'] : 'general';
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $body['priority'] : 'medium';
        $account_id = !empty($body['account_id']) ? (int)$body['account_id'] : null;

        if (empty($subject) || empty($message)) {
            return new WP_REST_Response(['error' => 'Subject and message are required.'], 400);
        }

        $ticket_number = 'TICK-' . rand(1000, 9999);
        while ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}fxsim_tickets WHERE ticket_number = %s", $ticket_number))) {
            $ticket_number = 'TICK-' . rand(1000, 9999);
        }

        $wpdb->insert("{$wpdb->prefix}fxsim_tickets", [
            'ticket_number' => $ticket_number,
            'trader_id'     => $user_id,
            'account_id'    => $account_id,
            'subject'       => $subject,
            'category'      => $category,
            'priority'      => $priority,
            'status'        => 'open',
            'created_at'    => current_time('mysql'),
            'updated_at'    => current_time('mysql'),
        ]);
        $ticket_id = (int)$wpdb->insert_id;

        $wpdb->insert("{$wpdb->prefix}fxsim_ticket_messages", [
            'ticket_id'   => $ticket_id,
            'sender_type' => 'trader',
            'sender_id'   => $user_id,
            'message'     => $message,
            'created_at'  => current_time('mysql'),
        ]);

        return new WP_REST_Response(['success' => true, 'id' => $ticket_id, 'ticket_number' => $ticket_number]);
    }

    /** GET /tickets/{id} — user view ticket detail */
    public static function ticket_my_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id   = get_current_user_id();
        $ticket_id = (int)$r->get_param('id');

        $ticket = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_tickets WHERE id = %d AND trader_id = %d",
            $ticket_id, $user_id
        ));
        if (!$ticket) {
            return new WP_REST_Response(['error' => 'Ticket not found.'], 404);
        }

        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_ticket_messages WHERE ticket_id = %d ORDER BY created_at ASC",
            $ticket_id
        )) ?: [];

        return new WP_REST_Response([
            'ticket'   => $ticket,
            'messages' => $messages,
        ]);
    }

    /** POST /tickets/{id}/reply — user reply */
    public static function ticket_reply(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $user_id   = get_current_user_id();
        $ticket_id = (int)$r->get_param('id');
        $body      = $r->get_json_params() ?: $r->get_body_params();
        $message   = sanitize_textarea_field($body['message'] ?? '');

        if (empty($message)) {
            return new WP_REST_Response(['error' => 'Message cannot be empty.'], 400);
        }

        $ticket = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_tickets WHERE id = %d AND trader_id = %d",
            $ticket_id, $user_id
        ));
        if (!$ticket) {
            return new WP_REST_Response(['error' => 'Ticket not found.'], 404);
        }

        $wpdb->insert("{$wpdb->prefix}fxsim_ticket_messages", [
            'ticket_id'   => $ticket_id,
            'sender_type' => 'trader',
            'sender_id'   => $user_id,
            'message'     => $message,
            'created_at'  => current_time('mysql'),
        ]);
        $wpdb->update(
            "{$wpdb->prefix}fxsim_tickets",
            ['updated_at' => current_time('mysql'), 'status' => 'open'],
            ['id' => $ticket_id]
        );

        return new WP_REST_Response(['success' => true]);
    }

    /** GET /admin/tickets — admin tickets queue */
    public static function admin_tickets_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status   = sanitize_key($r->get_param('status') ?? '');
        $priority = sanitize_key($r->get_param('priority') ?? '');
        $category = sanitize_key($r->get_param('category') ?? '');
        $search   = sanitize_text_field($r->get_param('search') ?? '');

        $where = ['1=1'];
        $params = [];

        if ($status && $status !== 'all') {
            $where[] = 't.status = %s';
            $params[] = $status;
        }
        if ($priority && $priority !== 'all') {
            $where[] = 't.priority = %s';
            $params[] = $priority;
        }
        if ($category && $category !== 'all') {
            $where[] = 't.category = %s';
            $params[] = $category;
        }
        if (!empty($search)) {
            $where[] = '(t.ticket_number LIKE %s OR t.subject LIKE %s OR u.user_login LIKE %s OR u.user_email LIKE %s OR u.display_name LIKE %s)';
            $like = '%' . $wpdb->esc_like($search) . '%';
            $params = array_merge($params, [$like, $like, $like, $like, $like]);
        }

        $sql_where = implode(' AND ', $where);
        $query = "
            SELECT t.*, 
                   u.user_login, u.user_email, u.display_name,
                   (SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_ticket_messages WHERE ticket_id = t.id) AS message_count,
                   (SELECT message FROM {$wpdb->prefix}fxsim_ticket_messages WHERE ticket_id = t.id ORDER BY id DESC LIMIT 1) AS latest_message
            FROM {$wpdb->prefix}fxsim_tickets t
            JOIN {$wpdb->users} u ON u.ID = t.trader_id
            WHERE {$sql_where}
            ORDER BY 
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                t.updated_at DESC
        ";

        $rows = !empty($params) ? $wpdb->get_results($wpdb->prepare($query, $params)) : $wpdb->get_results($query);
        $rows = $rows ?: [];

        return new WP_REST_Response($rows);
    }

    /** GET /admin/tickets/{id} — admin view ticket with thread */
    public static function admin_ticket_get(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $ticket_id = (int)$r->get_param('id');

        $ticket = $wpdb->get_row($wpdb->prepare(
            "SELECT t.*, u.user_login, u.user_email, u.display_name
             FROM {$wpdb->prefix}fxsim_tickets t
             JOIN {$wpdb->users} u ON u.ID = t.trader_id
             WHERE t.id = %d",
            $ticket_id
        ));

        if (!$ticket) {
            return new WP_REST_Response(['error' => 'Ticket not found.'], 404);
        }

        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT m.*, u.display_name AS sender_name, u.user_email AS sender_email
             FROM {$wpdb->prefix}fxsim_ticket_messages m
             LEFT JOIN {$wpdb->users} u ON u.ID = m.sender_id
             WHERE m.ticket_id = %d
             ORDER BY m.created_at ASC",
            $ticket_id
        )) ?: [];

        return new WP_REST_Response([
            'ticket'   => $ticket,
            'messages' => $messages,
        ]);
    }

    /** POST /admin/tickets/{id}/reply — admin reply */
    public static function admin_ticket_reply(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $admin_id  = get_current_user_id();
        $ticket_id = (int)$r->get_param('id');
        $body      = $r->get_json_params() ?: $r->get_body_params();
        $message   = sanitize_textarea_field($body['message'] ?? '');

        if (empty($message)) {
            return new WP_REST_Response(['error' => 'Reply message cannot be empty.'], 400);
        }

        $ticket = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_tickets WHERE id = %d",
            $ticket_id
        ));
        if (!$ticket) {
            return new WP_REST_Response(['error' => 'Ticket not found.'], 404);
        }

        $wpdb->insert("{$wpdb->prefix}fxsim_ticket_messages", [
            'ticket_id'   => $ticket_id,
            'sender_type' => 'admin',
            'sender_id'   => $admin_id,
            'message'     => $message,
            'created_at'  => current_time('mysql'),
        ]);

        $next_status = $ticket->status === 'open' ? 'in_progress' : $ticket->status;
        $wpdb->update(
            "{$wpdb->prefix}fxsim_tickets",
            [
                'updated_at'        => current_time('mysql'),
                'status'            => $next_status,
                'assigned_admin_id' => $admin_id,
            ],
            ['id' => $ticket_id]
        );

        FXSIM_Database::log_admin($admin_id, 'ticket_reply', (int)$ticket->trader_id, "Replied to ticket #{$ticket->ticket_number}");
        return new WP_REST_Response(['success' => true, 'message' => 'Admin response sent successfully.']);
    }

    /** POST /admin/tickets/{id}/status — update status or priority */
    public static function admin_ticket_status(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $admin_id  = get_current_user_id();
        $ticket_id = (int)$r->get_param('id');
        $body      = $r->get_json_params() ?: $r->get_body_params();

        $ticket = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_tickets WHERE id = %d", $ticket_id));
        if (!$ticket) {
            return new WP_REST_Response(['error' => 'Ticket not found.'], 404);
        }

        $data = ['updated_at' => current_time('mysql')];
        if (isset($body['status']) && in_array($body['status'], ['open', 'in_progress', 'resolved', 'closed'], true)) {
            $data['status'] = $body['status'];
        }
        if (isset($body['priority']) && in_array($body['priority'], ['low', 'medium', 'high', 'urgent'], true)) {
            $data['priority'] = $body['priority'];
        }

        $wpdb->update("{$wpdb->prefix}fxsim_tickets", $data, ['id' => $ticket_id]);
        FXSIM_Database::log_admin($admin_id, 'ticket_status_change', (int)$ticket->trader_id, "Ticket #{$ticket->ticket_number} status updated.");

        return new WP_REST_Response(['success' => true, 'updated' => $data]);
    }

    // ── Tournaments & Competitions Handlers ─────────────────────────────────

    /** GET /admin/tournaments — list competitions/tournaments with stats */
    public static function admin_tournaments_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status = sanitize_key($r->get_param('status') ?? '');
        $search = sanitize_text_field($r->get_param('search') ?? '');

        $where = ['1=1'];
        $params = [];

        if ($status && $status !== 'all') {
            $where[] = 't.status = %s';
            $params[] = $status;
        }
        if (!empty($search)) {
            $where[] = '(t.title LIKE %s OR t.description LIKE %s)';
            $like = '%' . $wpdb->esc_like($search) . '%';
            $params = array_merge($params, [$like, $like]);
        }

        $sql_where = implode(' AND ', $where);
        $query = "SELECT t.* FROM {$wpdb->prefix}fxsim_tournaments t WHERE {$sql_where} ORDER BY t.start_date DESC";
        $rows = !empty($params) ? $wpdb->get_results($wpdb->prepare($query, $params)) : $wpdb->get_results($query);
        $rows = $rows ?: [];

        foreach ($rows as &$r) {
            $p_count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_tournament_participants WHERE tournament_id = %d",
                $r->id
            ));
            if ($p_count > 0) {
                $r->current_participants = $p_count;
            }
        }

        return new WP_REST_Response($rows);
    }

    /** POST /admin/tournaments/save — create or update tournament */
    public static function admin_tournament_save(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $body = $r->get_json_params() ?: $r->get_body_params();
        $id   = (int) ($body['id'] ?? 0);

        $title = sanitize_text_field($body['title'] ?? '');
        if (empty($title)) {
            return new WP_REST_Response(['error' => 'Tournament title is required.'], 400);
        }

        $slug = sanitize_title($body['slug'] ?? $title);
        $data = [
            'title'                => $title,
            'slug'                 => $slug,
            'description'          => sanitize_textarea_field($body['description'] ?? ''),
            'starting_balance'     => max(1000, (float)($body['starting_balance'] ?? 10000)),
            'entry_fee'            => max(0, (float)($body['entry_fee'] ?? 0)),
            'max_participants'     => max(10, (int)($body['max_participants'] ?? 500)),
            'prize_pool'           => sanitize_text_field($body['prize_pool'] ?? '$10,000'),
            'prizes_breakdown'     => !empty($body['prizes_breakdown']) ? (is_string($body['prizes_breakdown']) ? $body['prizes_breakdown'] : wp_json_encode($body['prizes_breakdown'])) : null,
            'rules_json'           => !empty($body['rules_json']) ? (is_string($body['rules_json']) ? $body['rules_json'] : wp_json_encode($body['rules_json'])) : null,
            'start_date'           => !empty($body['start_date']) ? sanitize_text_field($body['start_date']) : current_time('mysql'),
            'end_date'             => !empty($body['end_date']) ? sanitize_text_field($body['end_date']) : gmdate('Y-m-d H:i:s', strtotime('+14 days')),
            'status'               => in_array($body['status'] ?? '', ['upcoming', 'active', 'completed', 'cancelled'], true) ? $body['status'] : 'upcoming',
        ];

        if ($id > 0) {
            $wpdb->update("{$wpdb->prefix}fxsim_tournaments", $data, ['id' => $id]);
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert("{$wpdb->prefix}fxsim_tournaments", $data);
            $id = (int)$wpdb->insert_id;
        }

        FXSIM_Database::log_admin(get_current_user_id(), 'tournament_save', $id, "Tournament: {$title}");
        return new WP_REST_Response(['success' => true, 'id' => $id, 'message' => 'Tournament saved successfully.']);
    }

    /** DELETE /admin/tournaments/{id} — delete tournament */
    public static function admin_tournament_delete(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $wpdb->delete("{$wpdb->prefix}fxsim_tournaments", ['id' => $id]);
        $wpdb->delete("{$wpdb->prefix}fxsim_tournament_participants", ['tournament_id' => $id]);
        FXSIM_Database::log_admin(get_current_user_id(), 'tournament_delete', $id, "Deleted tournament #{$id}");
        return new WP_REST_Response(['success' => true, 'message' => 'Tournament deleted.']);
    }

    /** GET /admin/tournaments/{id}/leaderboard — live leaderboard */
    public static function admin_tournament_leaderboard(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');

        $tournament = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_tournaments WHERE id = %d", $id));
        if (!$tournament) {
            return new WP_REST_Response(['error' => 'Tournament not found.'], 404);
        }

        $participants = $wpdb->get_results($wpdb->prepare("
            SELECT p.*, u.user_login, u.user_email, u.display_name
            FROM {$wpdb->prefix}fxsim_tournament_participants p
            LEFT JOIN {$wpdb->users} u ON u.ID = p.user_id
            WHERE p.tournament_id = %d
            ORDER BY p.roi_pct DESC, p.current_equity DESC
            LIMIT 100
        ", $id));

        $rank = 1;
        foreach ($participants as &$p) {
            $p->rank = $rank++;
        }

        return new WP_REST_Response([
            'tournament'  => $tournament,
            'leaderboard' => $participants,
        ]);
    }

    /** POST /admin/tournaments/{id}/status — update status */
    public static function admin_tournament_status(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $status = in_array($body['status'] ?? '', ['upcoming', 'active', 'completed', 'cancelled'], true) ? $body['status'] : 'active';

        $wpdb->update("{$wpdb->prefix}fxsim_tournaments", ['status' => $status], ['id' => $id]);
        FXSIM_Database::log_admin(get_current_user_id(), 'tournament_status', $id, "Status changed to {$status}");
        return new WP_REST_Response(['success' => true, 'status' => $status]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1v1 PVP E-SPORTS ARENA CONTROLLERS
    // ════════════════════════════════════════════════════════════════════════

    public static function pvp_lobby_get(WP_REST_Request $r): WP_REST_Response {
        $uid = get_current_user_id();
        $lobby = FXSIM_PvP_Engine::get_lobby($uid);
        return new WP_REST_Response($lobby);
    }

    public static function pvp_match_create(WP_REST_Request $r): WP_REST_Response {
        $uid = get_current_user_id();
        $body = $r->get_json_params() ?: $r->get_body_params();
        $res = FXSIM_PvP_Engine::create_match($uid, $body);
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    public static function pvp_match_join(WP_REST_Request $r): WP_REST_Response {
        $uid = get_current_user_id();
        $id = (int)$r->get_param('id');
        $res = FXSIM_PvP_Engine::join_match($uid, $id);
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    public static function pvp_match_live(WP_REST_Request $r): WP_REST_Response {
        $uid = get_current_user_id();
        $id = (int)$r->get_param('id');
        $res = FXSIM_PvP_Engine::get_live_state($id, $uid);
        return new WP_REST_Response($res, $res['success'] ? 200 : 404);
    }

    public static function pvp_match_order(WP_REST_Request $r): WP_REST_Response {
        $uid = get_current_user_id();
        $id = (int)$r->get_param('id');
        $body = $r->get_json_params() ?: $r->get_body_params();
        $res = FXSIM_PvP_Engine::execute_order($uid, $id, $body);
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    public static function pvp_match_settle(WP_REST_Request $r): WP_REST_Response {
        $id = (int)$r->get_param('id');
        // Pass the authenticated caller so settle_match() can enforce that
        // only the match's own participants (or an admin) may settle it —
        // it previously had no authorization check at all.
        $res = FXSIM_PvP_Engine::settle_match($id, get_current_user_id());
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    public static function pvp_match_cancel(WP_REST_Request $r): WP_REST_Response {
        $uid = get_current_user_id();
        $id = (int)$r->get_param('id');
        $res = FXSIM_PvP_Engine::cancel_match($id, $uid);
        return new WP_REST_Response($res, $res['success'] ? 200 : 400);
    }

    public static function admin_pvp_analytics_get(WP_REST_Request $r): WP_REST_Response {
        $res = FXSIM_PvP_Engine::get_admin_analytics();
        return new WP_REST_Response($res);
    }

    // ════════════════════════════════════════════════════════════════════════
    // VISUAL PAGE BUILDER SCHEMA CONTROLLERS
    // ════════════════════════════════════════════════════════════════════════

    /** GET /page-schema & GET /admin/page-schema */
    public static function admin_page_schema_get(): WP_REST_Response {
        $raw = FXSIM_Challenge_DB::get_setting('homepage_page_schema', '');
        $schema = !empty($raw) ? json_decode($raw, true) : null;
        if (!$schema || !is_array($schema)) {
            $schema = [
                'content' => [
                    ['type' => 'Hero', 'props' => ['id' => 'hero-1']],
                    ['type' => 'LiveStatsStrip', 'props' => ['id' => 'stats-1']],
                    ['type' => 'HowItWorks', 'props' => ['id' => 'how-1']],
                    ['type' => 'ChallengesPreview', 'props' => ['id' => 'chal-1']],
                    ['type' => 'PlatformFeatures', 'props' => ['id' => 'feat-1']],
                    ['type' => 'PayoutsSection', 'props' => ['id' => 'payout-1']],
                    ['type' => 'Testimonials', 'props' => ['id' => 'test-1']],
                    ['type' => 'CTASection', 'props' => ['id' => 'cta-1']],
                ],
                'root' => (object)[],
            ];
        }
        $res = array_merge($schema, [
            'schema'  => $schema,
            'content' => $schema['content'] ?? [],
            'zones'   => $schema['zones'] ?? (object)[],
            'root'    => $schema['root'] ?? (object)[],
            'success' => true
        ]);
        return new WP_REST_Response($res);
    }

    public static function public_page_schema_get(): WP_REST_Response {
        return self::admin_page_schema_get();
    }

    /** POST /admin/page-schema */
    public static function admin_page_schema_save(WP_REST_Request $r): WP_REST_Response {
        $body = $r->get_json_params() ?: $r->get_body_params();
        $schema = $body['schema'] ?? $body;
        if (is_array($schema)) {
            FXSIM_Challenge_DB::set_setting('homepage_page_schema', wp_json_encode($schema));
            FXSIM_Database::log_admin(get_current_user_id(), 'page_schema_save', 0, 'Homepage layout published');
            return new WP_REST_Response(['success' => true, 'message' => 'Homepage layout published successfully.']);
        }
        return new WP_REST_Response(['success' => false, 'message' => 'Invalid schema structure.'], 400);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PUBLIC TOURNAMENTS & ENROLLMENT CONTROLLERS
    // ════════════════════════════════════════════════════════════════════════

    /** GET /tournaments — public list of competitions & tournaments */
    public static function tournaments_public_list(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $status = sanitize_text_field($r->get_param('status') ?? '');
        $where = ['1=1'];
        $params = [];
        if ($status && $status !== 'all') {
            $where[] = 'status = %s';
            $params[] = $status;
        }
        $sql_where = implode(' AND ', $where);
        $query = "SELECT * FROM {$wpdb->prefix}fxsim_tournaments WHERE {$sql_where} ORDER BY start_date DESC";
        $rows = !empty($params) ? $wpdb->get_results($wpdb->prepare($query, $params)) : $wpdb->get_results($query);
        $rows = $rows ?: [];

        foreach ($rows as &$t) {
            $p_count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_tournament_participants WHERE tournament_id = %d",
                $t->id
            ));
            $t->current_participants = $p_count;
            $t->participants_count = $p_count;
            $t->name = $t->title;
        }
        return new WP_REST_Response($rows);
    }

    /** GET /tournaments/{id} — tournament details */
    public static function tournament_public_detail(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $id = (int) $r->get_param('id');
        $t = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_tournaments WHERE id = %d", $id));
        if (!$t) {
            return new WP_REST_Response(['error' => 'Tournament not found.'], 404);
        }
        $p_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_tournament_participants WHERE tournament_id = %d",
            $t->id
        ));
        $t->current_participants = $p_count;
        $t->participants_count = $p_count;
        $t->name = $t->title;
        return new WP_REST_Response($t);
    }

    /** POST /tournaments/{id}/join — trader joins tournament */
    public static function tournament_join(WP_REST_Request $r): WP_REST_Response {
        global $wpdb;
        $uid = get_current_user_id();
        if (!$uid) {
            return new WP_REST_Response(['success' => false, 'message' => 'Authentication required.'], 401);
        }
        $id = (int) $r->get_param('id');
        $t = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_tournaments WHERE id = %d", $id));
        if (!$t) {
            return new WP_REST_Response(['success' => false, 'message' => 'Tournament not found.'], 404);
        }
        if (!in_array($t->status, ['upcoming', 'active'], true)) {
            return new WP_REST_Response(['success' => false, 'message' => "Tournament is {$t->status} and cannot be joined."], 400);
        }

        // Check if already registered
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_tournament_participants WHERE tournament_id = %d AND user_id = %d",
            $id, $uid
        ));
        if ($existing) {
            return new WP_REST_Response(['success' => false, 'message' => 'You are already registered for this tournament.'], 400);
        }

        // Check max participants capacity
        $count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_tournament_participants WHERE tournament_id = %d",
            $id
        ));
        if ($t->max_participants > 0 && $count >= $t->max_participants) {
            return new WP_REST_Response(['success' => false, 'message' => 'Tournament has reached maximum participant capacity.'], 400);
        }

        // Check entry fee if applicable
        $entry_fee = (float) $t->entry_fee;
        if ($entry_fee > 0) {
            $user_acc = $wpdb->get_row($wpdb->prepare("SELECT id, balance FROM {$wpdb->prefix}fxsim_accounts WHERE user_id = %d ORDER BY id DESC LIMIT 1", $uid));
            if (!$user_acc || (float)$user_acc->balance < $entry_fee) {
                return new WP_REST_Response(['success' => false, 'message' => "Insufficient account balance to pay \${$entry_fee} entry fee."], 400);
            }
            // Deduct entry fee
            $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}fxsim_accounts SET balance = balance - %f WHERE id = %d", $entry_fee, $user_acc->id));
        }

        // Resolve or create trading account for this tournament
        $starting_bal = (float)$t->starting_balance > 0 ? (float)$t->starting_balance : 10000.0;
        $acc_id = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}fxsim_accounts WHERE user_id = %d ORDER BY id DESC LIMIT 1", $uid));
        if (!$acc_id) {
            $wpdb->insert($wpdb->prefix . 'fxsim_accounts', [
                'user_id'          => $uid,
                'balance'          => $starting_bal,
                'equity'           => $starting_bal,
                'starting_balance' => $starting_bal,
                'margin_used'      => 0.00,
                'leverage'         => 100,
                'status'           => 'active',
                'created_at'       => current_time('mysql')
            ]);
            $acc_id = (int)$wpdb->insert_id;
        }

        $inserted = $wpdb->insert("{$wpdb->prefix}fxsim_tournament_participants", [
            'tournament_id'   => $id,
            'user_id'         => $uid,
            'account_id'      => $acc_id,
            'starting_equity' => $starting_bal,
            'current_equity'  => $starting_bal,
            'roi_pct'         => 0.00,
            'max_dd_reached'  => 0.00,
            'rank'            => $count + 1,
            'status'          => 'active',
            'created_at'      => current_time('mysql')
        ]);

        if (!$inserted) {
            return new WP_REST_Response(['success' => false, 'message' => 'Database error registering for tournament: ' . $wpdb->last_error], 500);
        }

        $participant_id = (int)$wpdb->insert_id;
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'push_notification')) {
            FXSIM_Database::push_notification($uid, 'success', 'Tournament Registration Confirmed', "You have joined {$t->title}!", '/tournaments');
        }

        return new WP_REST_Response([
            'success'        => true,
            'message'        => "Successfully enrolled in {$t->title}!",
            'participant_id' => $participant_id,
            'tournament_id'  => $id
        ]);
    }
}
