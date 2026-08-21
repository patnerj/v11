<?php
/**
 * FXSIM_Stripe — Stripe Checkout integration
 * Uses Stripe Checkout Sessions (no card data on our server)
 * Flow: create session → redirect to Stripe → webhook confirms → challenge created
 */
defined('ABSPATH') || exit;

class FXSIM_Stripe {

    // ── Create a Stripe Checkout session ─────────────────────────────────────
    public static function create_checkout(int $user_id, int $plan_id, string $coupon_code = ''): array {
        $sk = FXSIM_Challenge_DB::get_setting('stripe_secret_key', '');
        if (!$sk) return ['success' => false, 'message' => 'Stripe not configured. Please use manual payment.'];

        $plan = FXSIM_Challenge_DB::get_plan($plan_id);
        if (!$plan) return ['success' => false, 'message' => 'Plan not found.'];

        if ((float)$plan->price <= 0) return ['success' => false, 'message' => 'This plan is free — no Stripe needed.'];

        // Compute the post-discount total WITHOUT creating an order. The order is
        // created + activated only when Stripe confirms payment (webhook), so a
        // cancelled checkout leaves no pending order, no admin notification, and
        // no admin email. Coupon validation here is read-only (no redemption).
        $price = (float)$plan->price; $discount = 0.0; $code_stored = '';
        if (class_exists('FXSIM_Coupons') && trim($coupon_code) !== '') {
            $v = FXSIM_Coupons::validate($coupon_code, $plan_id, $user_id);
            if (!empty($v['valid'])) { $discount = (float)$v['discount']; $code_stored = (string)$v['code']; }
        }
        $pay    = max(0, round($price - $discount, 2));
        $amount = (int)round($pay * 100); // Stripe uses cents
        if ($amount < 50) {
            // Below Stripe's minimum charge (e.g. a near/100% discount).
            return ['success' => false, 'message' => 'This order total is too low for card checkout — please use manual payment.'];
        }

        $user     = get_userdata($user_id);
        $brand    = FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System');
        $currency = strtolower($plan->currency ?? 'usd');

        // Stripe API call
        $fe = get_option('fxsim_frontend_url', '');
        if (!$fe && defined('FXSIM_FRONTEND_URL')) $fe = FXSIM_FRONTEND_URL;
        $fe = $fe ? untrailingslashit($fe) : untrailingslashit(home_url());

        $response = wp_remote_post('https://api.stripe.com/v1/checkout/sessions', [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'Bearer ' . $sk,
                'Content-Type'  => 'application/x-www-form-urlencoded',
            ],
            'body' => http_build_query([
                'payment_method_types[0]'           => 'card',
                'line_items[0][price_data][currency]'            => $currency,
                'line_items[0][price_data][product_data][name]'  => $brand . ' — ' . $plan->name,
                'line_items[0][price_data][product_data][description]' => 'Challenge account: $' . number_format((float)$plan->account_size) . ' | ' . $plan->p1_profit_target . '% target | ' . $plan->funded_profit_split . '% profit split',
                'line_items[0][price_data][unit_amount]'         => $amount,
                'line_items[0][quantity]'                        => 1,
                'mode'                              => 'payment',
                'customer_email'                    => $user->user_email ?? '',
                'success_url'                       => $fe . '/dashboard?stripe=success',
                'cancel_url'                        => $fe . '/challenges?stripe=cancelled',
                'metadata[user_id]'                 => $user_id,
                'metadata[plan_id]'                 => $plan_id,
                'metadata[coupon_code]'             => $code_stored,
            ]),
        ]);

        if (is_wp_error($response)) {
            return ['success' => false, 'message' => 'Stripe connection failed: ' . $response->get_error_message()];
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['error'])) {
            return ['success' => false, 'message' => 'Stripe error: ' . ($body['error']['message'] ?? 'Unknown')];
        }

        if (empty($body['url'])) {
            return ['success' => false, 'message' => 'Stripe did not return a checkout URL.'];
        }

        return [
            'success'      => true,
            'checkout_url' => $body['url'],
            'session_id'   => $body['id'],
        ];
    }

    // ── Create a Stripe Checkout session for Competitions ────────────────────
    public static function create_competition_checkout(int $user_id, int $comp_id): array {
        $sk = FXSIM_Challenge_DB::get_setting('stripe_secret_key', '');
        if (!$sk) return ['success' => false, 'message' => 'Stripe not configured. Please contact support.'];

        global $wpdb;
        $comp = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_competitions WHERE id = %d", $comp_id));
        if (!$comp) return ['success' => false, 'message' => 'Competition not found.'];
        if ((float)$comp->entry_fee <= 0) return ['success' => false, 'message' => 'This competition is free.'];

        $amount = (int)round((float)$comp->entry_fee * 100);
        $user = get_userdata($user_id);
        $brand = FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System');
        $currency = 'usd';

        $fe = get_option('fxsim_frontend_url', '');
        if (!$fe && defined('FXSIM_FRONTEND_URL')) $fe = FXSIM_FRONTEND_URL;
        $fe = $fe ? untrailingslashit($fe) : untrailingslashit(home_url());

        $response = wp_remote_post('https://api.stripe.com/v1/checkout/sessions', [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'Bearer ' . $sk,
                'Content-Type'  => 'application/x-www-form-urlencoded',
            ],
            'body' => http_build_query([
                'payment_method_types[0]'           => 'card',
                'line_items[0][price_data][currency]'            => $currency,
                'line_items[0][price_data][product_data][name]'  => $brand . ' — Tournament Entry',
                'line_items[0][price_data][product_data][description]' => $comp->name . ' Entry Fee',
                'line_items[0][price_data][unit_amount]'         => $amount,
                'line_items[0][quantity]'                        => 1,
                'mode'                              => 'payment',
                'customer_email'                    => $user->user_email ?? '',
                'success_url'                       => $fe . '/dashboard/competitions?success=true',
                'cancel_url'                        => $fe . '/dashboard/competitions?cancelled=true',
                'metadata[user_id]'                 => $user_id,
                'metadata[competition_id]'          => $comp_id,
            ]),
        ]);

        if (is_wp_error($response)) {
            return ['success' => false, 'message' => 'Stripe connection failed: ' . $response->get_error_message()];
        }
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!empty($body['error'])) return ['success' => false, 'message' => 'Stripe error: ' . ($body['error']['message'] ?? 'Unknown')];
        if (empty($body['url'])) return ['success' => false, 'message' => 'Stripe did not return a checkout URL.'];

        return [
            'success'      => true,
            'checkout_url' => $body['url'],
            'session_id'   => $body['id'],
        ];
    }

    // ── Handle Stripe Webhook ─────────────────────────────────────────────────
    public static function handle_webhook(): void {
        $wh_secret = FXSIM_Challenge_DB::get_setting('stripe_webhook_secret', '');
        $payload   = file_get_contents('php://input');
        $sig       = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

        // Fail closed: reject webhook entirely if webhook secret is not configured
        // preventing anyone from fabricating fake checkout.session.completed events without payment
        if (empty($wh_secret)) {
            http_response_code(500);
            echo json_encode(['error' => 'Stripe webhook secret is not configured on server']);
            exit;
        }

        if (!$sig || !self::verify_signature($payload, $sig, $wh_secret)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signature']);
            exit;
        }

        $event = json_decode($payload, true);
        if (!$event || !isset($event['type'])) {
            http_response_code(400); exit;
        }

        if ($event['type'] === 'checkout.session.completed') {
            global $wpdb;
            $session    = $event['data']['object'];
            $user_id    = (int)($session['metadata']['user_id'] ?? 0);
            $plan_id    = (int)($session['metadata']['plan_id'] ?? 0);
            $comp_id    = (int)($session['metadata']['competition_id'] ?? 0);
            $coupon     = (string)($session['metadata']['coupon_code'] ?? '');
            $session_id = (string)($session['id'] ?? '');
            $paid       = ($session['payment_status'] ?? '') === 'paid' || ($session['status'] ?? '') === 'complete';

            if ($user_id && $plan_id && $paid) {
                // Idempotency via GET_LOCK: the old SELECT-then-check-then-act
                // was a race — two concurrent Stripe deliveries for the same
                // session_id (Stripe retries at ~1s intervals on any non-200)
                // could both find $already=0 before either committed
                // create_order(), causing two funded accounts + double
                // coupon/affiliate recording for a single payment.
                // GET_LOCK serialises all deliveries for this session_id; the
                // loser finds txn_id already written and exits harmlessly.
                $lock_key = 'stripe_wh_' . md5($session_id);
                $locked   = $session_id
                    ? (bool) $wpdb->get_var($wpdb->prepare("SELECT GET_LOCK(%s, 10)", $lock_key))
                    : true; // no session_id → no lock needed, proceed

                if ($locked) {
                    try {
                        // Re-check inside the lock: another delivery may have
                        // won the race and already written the txn_id.
                        $already = $session_id ? $wpdb->get_var($wpdb->prepare(
                            "SELECT id FROM {$wpdb->prefix}fxsim_payment_orders WHERE txn_id=%s", $session_id)) : 0;
                        if (!$already) {
                            // Create the order only now (payment confirmed), then auto-activate.
                            $res = FXSIM_Payments::create_order($user_id, $plan_id, 'stripe', $coupon);
                            $oid = (int)($res['order_id'] ?? 0);
                            if ($oid) {
                                if ($session_id) $wpdb->update($wpdb->prefix . 'fxsim_payment_orders', ['txn_id' => $session_id], ['id' => $oid]);
                                $approve = FXSIM_Payments::approve_order($oid, 0, 'Auto-approved via Stripe');
                                if (empty($approve['success'])) {
                                    error_log("[PropFirm] Stripe webhook: approve_order() failed for order #{$oid} (user {$user_id}, plan {$plan_id}) — " . ($approve['message'] ?? 'unknown error'));
                                    if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
                                        FXSIM_Database::log_admin(0, 'stripe_activation_failed', $user_id,
                                            "Order #{$oid} paid via Stripe but approve_order() failed: " . ($approve['message'] ?? 'unknown error') . '. Needs manual activation.');
                                    }
                                }
                            }
                        }
                    } finally {
                        if ($session_id) {
                            $wpdb->get_var($wpdb->prepare("SELECT RELEASE_LOCK(%s)", $lock_key));
                        }
                    }
                } else {
                    error_log("[PropFirm] Stripe webhook: failed to acquire lock for session {$session_id} — concurrent delivery?");
                }
            } elseif ($user_id && $comp_id && $paid) {
                // Competition entry fee paid
                $already = $wpdb->get_var($wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}fxsim_competition_participants WHERE competition_id = %d AND user_id = %d",
                    $comp_id, $user_id
                ));
                if (!$already) {
                    $comp = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_competitions WHERE id = %d", $comp_id));
                    if ($comp) {
                        $account_id = FXSIM_Challenge_DB::create_account(
                            $user_id,
                            'Tournament Account - ' . $comp->name,
                            (float)$comp->initial_balance,
                            1, 
                            [
                                'max_daily_loss' => 5,
                                'max_total_loss' => 10,
                                'profit_target'  => 0,
                                'max_days'       => 30
                            ]
                        );
                        if (!is_wp_error($account_id)) {
                            $wpdb->insert("{$wpdb->prefix}fxsim_competition_participants", [
                                'competition_id' => $comp_id,
                                'user_id'        => $user_id,
                                'account_id'     => $account_id,
                                'status'         => 'active',
                                'registered_at'  => current_time('mysql', 1)
                            ]);
                        }
                    }
                }
            }
        } elseif ($event['type'] === 'charge.refunded' || $event['type'] === 'charge.dispute.created') {
            // Log refund or dispute for admin review
            $charge = $event['data']['object'];
            $pi = $charge['payment_intent'] ?? '';
            $amt = ($charge['amount'] ?? 0) / 100;
            if ($pi && class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
                FXSIM_Database::log_admin(0, 'stripe_alert', 0, "Stripe event {$event['type']} for Payment Intent {$pi} (Amount: {$amt}). Check Stripe Dashboard.");
            }
        }

        http_response_code(200);
        echo json_encode(['received' => true]);
        exit;
    }

    // ── Verify Stripe webhook signature ──────────────────────────────────────
    private static function verify_signature(string $payload, string $sig_header, string $secret): bool {
        $parts     = explode(',', $sig_header);
        $timestamp = '';
        $signatures = [];

        foreach ($parts as $part) {
            [$key, $value] = explode('=', $part, 2);
            if ($key === 't') $timestamp = $value;
            if ($key === 'v1') $signatures[] = $value;
        }

        if (!$timestamp) return false;

        $signed_payload = $timestamp . '.' . $payload;
        $expected       = hash_hmac('sha256', $signed_payload, $secret);

        foreach ($signatures as $sig) {
            if (hash_equals($expected, $sig)) return true;
        }
        return false;
    }
}
