<?php
/**
 * FXSIM_Payments — Modular payment gateway system
 *
 * Gateways: manual (proof upload), coinpayments (prepared), stripe (prepared)
 * Flow: create_order → user pays → submit_proof → admin approves → challenge created
 */
defined('ABSPATH') || exit;

class FXSIM_Payments {

    // ── Create a pending payment order ────────────────────────────────────────
    public static function create_order(int $user_id, int $plan_id, string $gateway = 'manual', string $coupon_code = ''): array {
        global $wpdb;

        $plan = FXSIM_Challenge_DB::get_plan($plan_id);
        if (!$plan) return ['success' => false, 'message' => 'Plan not found.'];

        $price    = (float) $plan->price;
        $currency = $plan->currency ?? 'USD';

        // Validate + compute the discount SERVER-SIDE. If the code is missing or
        // no longer valid (changed since the client preview), we proceed at full
        // price rather than block the purchase.
        $coupon_id = 0; $discount = 0.0; $code_stored = null;
        if (class_exists('FXSIM_Coupons') && trim($coupon_code) !== '') {
            $v = FXSIM_Coupons::validate($coupon_code, $plan_id, $user_id);
            if (!empty($v['valid'])) {
                $coupon_id   = (int) $v['coupon_id'];
                $discount    = (float) $v['discount'];
                $code_stored = $v['code'];
            }
        }
        $final = max(0, round($price - $discount, 2)); // `amount` = final paid (affiliate-ready)

        // One pending order per user per plan at a time — refresh its pricing so
        // a freshly-applied coupon is reflected.
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_payment_orders
             WHERE user_id=%d AND plan_id=%d AND status='pending'",
            $user_id, $plan_id
        ));
        if ($existing) {
            $wpdb->update($wpdb->prefix . 'fxsim_payment_orders', [
                'amount'          => $final,
                'original_amount' => $price,
                'discount_amount' => $discount,
                'coupon_id'       => $coupon_id ?: null,
                'coupon_code'     => $code_stored,
                'currency'        => $currency,
            ], ['id' => (int) $existing]);
            return ['success' => true, 'order_id' => (int) $existing, 'existing' => true,
                    'amount' => $final, 'original' => $price, 'discount' => $discount, 'currency' => $currency];
        }

        $wpdb->insert($wpdb->prefix . 'fxsim_payment_orders', [
            'user_id'         => $user_id,
            'plan_id'         => $plan_id,
            'amount'          => $final,
            'original_amount' => $price,
            'discount_amount' => $discount,
            'coupon_id'       => $coupon_id ?: null,
            'coupon_code'     => $code_stored,
            'currency'        => $currency,
            'gateway'         => $gateway,
            'status'          => 'pending',
        ]);

        $order_id = (int)$wpdb->insert_id;
        if (class_exists('FXSIM_Database')) {
            FXSIM_Database::push_admin_notification('info', 'New challenge purchase',
                'A trader started checkout for the ' . ($plan->name ?? 'challenge') . ' plan.', $user_id);
        }
        return ['success' => true, 'order_id' => $order_id,
                'amount' => $final, 'original' => $price, 'discount' => $discount, 'currency' => $currency];
    }

    // ── Submit payment proof (manual gateway) ─────────────────────────────────
    public static function submit_proof(int $order_id, int $user_id, array $file, string $notes = ''): array {
        global $wpdb;

        $order = self::get_order($order_id);
        if (!$order || (int)$order->user_id !== $user_id) return ['success' => false, 'message' => 'Order not found.'];
        if ($order->status !== 'pending') return ['success' => false, 'message' => 'Order is no longer pending.'];

        // Handle file upload via WP media API
        if (empty($file['tmp_name'])) return ['success' => false, 'message' => 'No file uploaded.'];

        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        $mime = mime_content_type($file['tmp_name']);
        if (!in_array($mime, $allowed_types)) {
            return ['success' => false, 'message' => 'File must be an image (JPG, PNG, GIF, WebP) or PDF.'];
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            return ['success' => false, 'message' => 'File too large. Maximum 5MB.'];
        }

        // Move to WP uploads using WP file functions
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $upload_dir  = wp_upload_dir();
        $dest_dir    = $upload_dir['basedir'] . '/propfirm-proofs/' . $user_id . '/';
        $dest_url    = $upload_dir['baseurl'] . '/propfirm-proofs/' . $user_id . '/';
        wp_mkdir_p($dest_dir);

        // Protect directory from direct browse
        if (!file_exists($dest_dir . 'index.php')) {
            file_put_contents($dest_dir . 'index.php', '<?php // Silence is golden');
        }

        $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename = 'proof_' . $order_id . '_' . time() . '.' . $ext;
        $dest     = $dest_dir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            return ['success' => false, 'message' => 'Upload failed. Please try again.'];
        }

        $proof_url = $dest_url . $filename;

        $wpdb->update($wpdb->prefix . 'fxsim_payment_orders', [
            'proof_url'   => $proof_url,
            'proof_notes' => sanitize_textarea_field($notes),
        ], ['id' => $order_id]);

        // Defer admin notification to WP-Cron so the REST response is not blocked
        // by SMTP latency. The upload and DB update above are already complete.
        wp_schedule_single_event(time(), 'fxsim_notify_admin_proof', [(int)$order->id, $proof_url]);

        // Confirmation to the trader that their proof was received (J4).
        if (class_exists('FXSIM_Emails')) {
            FXSIM_Emails::send($user_id, 'payment_proof_submitted', [
                'plan' => $order->plan_name ?? ($order->plan ?? ''),
            ]);
        }
        if (class_exists('FXSIM_Database')) {
            FXSIM_Database::push_notification($user_id, 'info', 'Payment proof submitted',
                'We received your payment proof and it is pending review.', '/dashboard/challenges');
            FXSIM_Database::push_admin_notification('warning', 'Payment proof to review',
                'A trader uploaded payment proof awaiting approval.', $user_id);
        }

        return ['success' => true, 'message' => 'Payment proof submitted. Awaiting admin review.'];
    }

    // ── Admin: approve payment → create challenge account ─────────────────────
    public static function approve_order(int $order_id, int $admin_id, string $note = ''): array {
        global $wpdb;

        $order = self::get_order($order_id);
        if (!$order) return ['success' => false, 'message' => 'Order not found.'];
        if ($order->status === 'approved') return ['success' => false, 'message' => 'Already approved.'];

        $wpdb->update($wpdb->prefix . 'fxsim_payment_orders', [
            'status'      => 'approved',
            'admin_note'  => sanitize_text_field($note),
            'reviewed_by' => $admin_id,
            'reviewed_at' => current_time('mysql'),
        ], ['id' => $order_id]);

        // NOW create the challenge account
        $result = FXSIM_Challenge_Engine::create_challenge((int)$order->user_id, (int)$order->plan_id);

        if ($result['success']) {
            // Invalidate per-request account cache so next REST call fetches the new account
            FXSIM_REST_API::invalidate_account_cache((int)$order->user_id);
            // Coupon is now actually consumed (paid). Idempotent.
            if ((int) ($order->coupon_id ?? 0) > 0 && class_exists('FXSIM_Coupons')) {
                FXSIM_Coupons::record_redemption((int) $order->coupon_id, (int) $order->user_id, $order_id,
                    (float) $order->discount_amount, (float) $order->amount);
            }
            // Affiliate commission off the FINAL paid amount. Idempotent + self-referral safe.
            if (class_exists('FXSIM_Affiliates')) {
                FXSIM_Affiliates::record_commission((int) $order->user_id, $order_id, (float) $order->amount);
            }
            FXSIM_Database::log_admin($admin_id, 'payment_approved', (int)$order->user_id,
                "Order #{$order_id}, Plan #{$order->plan_id}, Note: {$note}");
            FXSIM_Emails::send((int)$order->user_id, 'challenge_purchased', [
                'plan_name'    => $result['plan']->name ?? '',
                'account_size' => $result['plan']->account_size ?? 0,
                'p1_profit_target' => $result['plan']->p1_profit_target ?? 0,
                'p1_max_dd'    => $result['plan']->p1_max_dd ?? 0,
            ]);
            FXSIM_Database::push_notification((int)$order->user_id, 'success', 'Challenge activated',
                'Your payment was approved and your challenge account is now active. Good luck!', '/dashboard');
        }

        return array_merge(['success' => true, 'order_id' => $order_id], $result);
    }

    // ── Admin: reject payment ─────────────────────────────────────────────────
    public static function reject_order(int $order_id, int $admin_id, string $note = ''): array {
        global $wpdb;

        $order = self::get_order($order_id);
        if (!$order) return ['success' => false, 'message' => 'Order not found.'];

        $wpdb->update($wpdb->prefix . 'fxsim_payment_orders', [
            'status'      => 'rejected',
            'admin_note'  => sanitize_text_field($note),
            'reviewed_by' => $admin_id,
            'reviewed_at' => current_time('mysql'),
        ], ['id' => $order_id]);

        FXSIM_Database::log_admin($admin_id, 'payment_rejected', (int)$order->user_id,
            "Order #{$order_id}, Note: {$note}");

        // Notify user of rejection
        $user = get_userdata((int)$order->user_id);
        if ($user) {
            $plan = FXSIM_Challenge_DB::get_plan((int)$order->plan_id);
            FXSIM_Emails::send((int)$order->user_id, 'payment_rejected', [
                'plan_name' => $plan->name ?? 'Challenge',
                'reason'    => $note,
            ]);
            FXSIM_Database::push_notification((int)$order->user_id, 'warning', 'Payment not approved',
                ($note ?: 'Your payment could not be approved. Please contact support.'), '/challenges');
        }

        return ['success' => true];
    }

    // ── CoinPayments: prepared gateway stub ───────────────────────────────────
    // Architecture ready for CoinPayments IPN webhook integration
    public static function coinpayments_create(int $order_id): array {
        $order = self::get_order($order_id);
        if (!$order) return ['success' => false, 'message' => 'Order not found.'];

        $pub_key = FXSIM_Challenge_DB::get_setting('coinpayments_pub_key', '');
        if (!$pub_key) {
            return ['success' => false, 'message' => 'CoinPayments not configured. Contact admin.'];
        }

        // TODO: Call CoinPayments API to create transaction
        // $response = self::coinpayments_api_call('create_transaction', [...]);
        // For now return structured response for future integration
        return [
            'success'      => false,
            'message'      => 'CoinPayments integration coming soon. Please use manual payment.',
            'gateway'      => 'coinpayments',
            'order_id'     => $order_id,
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    public static function get_order(int $order_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_payment_orders WHERE id=%d", $order_id
        ));
    }

    public static function get_user_orders(int $user_id): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT po.*, cp.name AS plan_name, cp.account_size
             FROM {$wpdb->prefix}fxsim_payment_orders po
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON po.plan_id = cp.id
             WHERE po.user_id = %d ORDER BY po.created_at DESC",
            $user_id
        )) ?: [];
    }

    public static function get_pending_orders(): array {
        global $wpdb;
        return $wpdb->get_results("
            SELECT po.*, u.user_login, u.user_email, cp.name AS plan_name, cp.account_size
            FROM {$wpdb->prefix}fxsim_payment_orders po
            JOIN {$wpdb->prefix}users u ON po.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON po.plan_id = cp.id
            WHERE po.status = 'pending'
            ORDER BY po.created_at ASC
        ") ?: [];
    }

    public static function get_all_orders(int $limit = 100): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare("
            SELECT po.*, u.user_login, u.user_email, cp.name AS plan_name, cp.account_size,
                   a.user_login AS reviewed_by_login
            FROM {$wpdb->prefix}fxsim_payment_orders po
            JOIN {$wpdb->prefix}users u ON po.user_id = u.ID
            JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON po.plan_id = cp.id
            LEFT JOIN {$wpdb->prefix}users a ON po.reviewed_by = a.ID
            ORDER BY po.created_at DESC LIMIT %d
        ", $limit)) ?: [];
    }

    public static function notify_admin_new_proof(object $order, string $proof_url): void {
        $admins = get_users(['role' => 'administrator', 'fields' => ['user_email']]);
        if (!$admins) return;
        $plan    = FXSIM_Challenge_DB::get_plan((int)$order->plan_id);
        $user    = get_userdata((int)$order->user_id);
        $subject = "Payment Proof Submitted — Order #{$order->id}";

        $fe   = class_exists('FXSIM_Emails') ? FXSIM_Emails::frontend_base() : home_url();
        $body = "<p style='font-size:12px;color:#7c6ef5;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px'>Admin notification</p>"
              . "<h1 style='font-size:21px;font-weight:800;color:#dde8f5;margin:0 0 12px'>Payment proof submitted</h1>"
              . "<p>A trader has submitted a payment proof for review.</p>"
              . "<p><strong>Order:</strong> #" . esc_html((string)$order->id) . "<br>"
              . "<strong>Trader:</strong> " . esc_html($user->user_login ?? '') . " (" . esc_html($user->user_email ?? '') . ")<br>"
              . "<strong>Plan:</strong> " . esc_html($plan->name ?? 'Unknown') . "<br>"
              . "<strong>Amount:</strong> $" . esc_html((string)$order->amount) . " " . esc_html((string)$order->currency) . "</p>"
              . "<p><a href='" . esc_url($proof_url) . "'>View submitted proof</a></p>"
              . "<div style='text-align:center;margin:24px 0'>" . (class_exists('FXSIM_Emails') ? FXSIM_Emails::btn('Review in admin dashboard', $fe . '/dashboard/admin/payments') : '') . "</div>";
        $html = class_exists('FXSIM_Emails') ? FXSIM_Emails::build_html($body) : $body;

        foreach ($admins as $admin) {
            wp_mail($admin->user_email, $subject, $html, ['Content-Type: text/html; charset=UTF-8']);
        }
    }
}
