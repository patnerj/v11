<?php
/**
 * FXSIM Push Notification Foundation (V10.7.3)
 *
 * FOUNDATION ONLY — no FCM/APNs delivery is implemented yet, by design.
 * What exists now:
 *   1. Device registry: mobile apps register their FCM/APNs push token per
 *      device (REST: /devices/register, /devices, /devices/{id} DELETE).
 *   2. Event capture: the platform's existing action hooks are mapped to
 *      queued push payloads (trade closed / SL / TP, challenge passed/failed/
 *      promoted, payout status, breach warnings piggyback on the in-app
 *      notification writer so EVERY current and future in-app notification is
 *      automatically push-eligible).
 *   3. Dispatch queue: durable table, status lifecycle pending → sent/failed/
 *      skipped, attempt counter, provider-agnostic payload.
 *   4. Provider seam: FXSIM_Push::deliver() is the single integration point.
 *      When FCM credentials are configured (setting fcm_service_account),
 *      a later release implements HTTP v1 delivery here — nothing else in the
 *      platform will need to change. Until then the cron marks rows 'skipped'
 *      so the queue cannot grow unbounded.
 */

defined('ABSPATH') || exit;

class FXSIM_Push {

    private const QUEUE_CAP      = 5000;   // safety valve
    private const MAX_ATTEMPTS   = 3;
    private const BATCH_PER_TICK = 50;

    public static function register(): void {
        add_action('rest_api_init', [self::class, 'routes']);

        // ── Event capture ────────────────────────────────────────────────────
        // Single choke point: every in-app notification (trade events, breach,
        // challenge lifecycle, payout status, admin broadcasts) already flows
        // through FXSIM_Database::notify(). The action below is fired there,
        // making the push queue automatically consistent with the in-app feed.
        add_action('fxsim_notification_created', [self::class, 'on_notification'], 10, 5);

        // Dispatch on the existing 30s cron — zero new cron plumbing.
        add_action('fxsim_price_update', [self::class, 'dispatch_queue'], 60);
    }

    public static function routes(): void {
        $ns = 'fxsim/v1';
        $auth = fn() => is_user_logged_in();
        register_rest_route($ns, '/devices/register', ['methods' => 'POST',   'callback' => [self::class, 'register_device'],  'permission_callback' => $auth]);
        register_rest_route($ns, '/devices',          ['methods' => 'GET',    'callback' => [self::class, 'list_devices'],     'permission_callback' => $auth]);
        register_rest_route($ns, '/devices/(?P<id>\d+)', ['methods' => 'DELETE', 'callback' => [self::class, 'remove_device'], 'permission_callback' => $auth]);
    }

    // ── Device registry ───────────────────────────────────────────────────────

    public static function register_device(WP_REST_Request $r) {
        global $wpdb;
        $platform = strtolower(sanitize_text_field((string)$r->get_param('platform')));
        $token    = trim((string)$r->get_param('push_token'));
        if (!in_array($platform, ['ios', 'android', 'web'], true) || $token === '' || strlen($token) > 512) {
            return new WP_REST_Response(['success' => false, 'message' => 'Invalid platform or push token.'], 400);
        }
        $provider = $platform === 'ios' ? 'apns' : 'fcm';   // FCM covers Android + web

        // Upsert on push_token: a token moving between accounts (shared device,
        // re-login) must always end up owned by the CURRENT user only.
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_devices WHERE push_token = %s", $token));
        $data = [
            'user_id'     => get_current_user_id(),
            'platform'    => $platform,
            'provider'    => $provider,
            'push_token'  => $token,
            'app_version' => mb_substr(sanitize_text_field((string)$r->get_param('app_version') ?: ''), 0, 20),
            'enabled'     => 1,
            'last_seen'   => current_time('mysql'),
        ];
        if ($existing) {
            $wpdb->update($wpdb->prefix . 'fxsim_devices', $data, ['id' => (int)$existing]);
            $id = (int)$existing;
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert($wpdb->prefix . 'fxsim_devices', $data);
            $id = (int)$wpdb->insert_id;
        }
        return new WP_REST_Response(['success' => true, 'device_id' => $id], 200);
    }

    public static function list_devices() {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, platform, provider, app_version, enabled, created_at, last_seen
             FROM {$wpdb->prefix}fxsim_devices WHERE user_id = %d ORDER BY last_seen DESC",
            get_current_user_id()));
        return new WP_REST_Response($rows ?: [], 200);
    }

    public static function remove_device(WP_REST_Request $r) {
        global $wpdb;
        $deleted = $wpdb->delete($wpdb->prefix . 'fxsim_devices',
            ['id' => (int)$r['id'], 'user_id' => get_current_user_id()]);
        if (!$deleted) return new WP_REST_Response(['success' => false, 'message' => 'Device not found.'], 404);
        return new WP_REST_Response(['success' => true], 200);
    }

    // ── Event capture → queue ────────────────────────────────────────────────

    /** Fired by FXSIM_Database::notify() for every in-app notification. */
    public static function on_notification(int $user_id, string $type, string $title, string $message, string $link): void {
        if ($user_id <= 0) return;   // admin-feed broadcasts are not per-device pushes (V10.8: topic support)
        self::enqueue($user_id, $type, $title, $message, ['link' => $link]);
    }

    public static function enqueue(int $user_id, string $event, string $title, string $body, array $data = []): void {
        global $wpdb;

        // Only queue when the user has at least one enabled device — keeps the
        // queue empty on cookie-only installs (i.e. every install today).
        $has_device = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_devices WHERE user_id = %d AND enabled = 1", $user_id));
        if (!$has_device) return;

        $depth = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_push_queue WHERE status = 'pending'");
        if ($depth >= self::QUEUE_CAP) {
            error_log('[PropFirm] Push queue at capacity — dropping event ' . $event);
            return;
        }

        $wpdb->insert($wpdb->prefix . 'fxsim_push_queue', [
            'user_id'    => $user_id,
            'event_type' => mb_substr($event, 0, 50),
            'title'      => mb_substr($title, 0, 200),
            'body'       => mb_substr($body, 0, 500),
            'data'       => wp_json_encode($data),
            'status'     => 'pending',
            'attempts'   => 0,
            'created_at' => current_time('mysql'),
        ]);
    }

    // ── Dispatcher (provider seam) ────────────────────────────────────────────

    public static function dispatch_queue(): void {
        global $wpdb;
        if (get_transient('fxsim_push_dispatch_lock')) return;
        set_transient('fxsim_push_dispatch_lock', 1, 25);
        try {
            $batch = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}fxsim_push_queue
                 WHERE status = 'pending' AND attempts < %d
                 ORDER BY id ASC LIMIT %d",
                self::MAX_ATTEMPTS, self::BATCH_PER_TICK));
            if (!$batch) return;

            $configured = self::provider_configured();
            foreach ($batch as $item) {
                if (!$configured) {
                    // Foundation behaviour: no provider yet → close the row out
                    // so the queue cannot grow unbounded. In-app notification
                    // already exists; nothing is lost.
                    $wpdb->update($wpdb->prefix . 'fxsim_push_queue',
                        ['status' => 'skipped', 'error' => 'no_provider_configured'],
                        ['id' => (int)$item->id]);
                    continue;
                }
                $ok = self::deliver($item);   // V10.8: real FCM HTTP v1 / APNs
                $wpdb->update($wpdb->prefix . 'fxsim_push_queue', [
                    'status'   => $ok ? 'sent' : (($item->attempts + 1) >= self::MAX_ATTEMPTS ? 'failed' : 'pending'),
                    'attempts' => (int)$item->attempts + 1,
                    'sent_at'  => $ok ? current_time('mysql') : null,
                ], ['id' => (int)$item->id]);
            }
        } finally {
            delete_transient('fxsim_push_dispatch_lock');
        }
    }

    /** Daily retention hygiene: settled queue rows older than 14 days. */
    public static function cleanup(): void {
        global $wpdb;
        $wpdb->query(
            "DELETE FROM {$wpdb->prefix}fxsim_push_queue
             WHERE status IN ('sent','failed','skipped')
               AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)"
        );
        // Devices unseen for 180 days are dead tokens — drop them.
        $wpdb->query(
            "DELETE FROM {$wpdb->prefix}fxsim_devices
             WHERE last_seen < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 180 DAY)"
        );
    }

    public static function provider_configured(): bool {
        return class_exists('FXSIM_Challenge_DB')
            && FXSIM_Challenge_DB::get_setting('fcm_service_account', '') !== '';
    }

    /**
     * Single provider integration point. Deliberately unimplemented in the
     * foundation release: returns false so nothing is falsely marked sent.
     * V10.8 implements FCM HTTP v1 (OAuth2 service account) + APNs here.
     */
    private static function deliver(object $item): bool {
        return false;
    }
}
