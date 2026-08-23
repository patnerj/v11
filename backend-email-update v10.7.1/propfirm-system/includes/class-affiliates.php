<?php
/**
 * Affiliate / referral engine.
 *
 * Payment-layer + registration only — never touches the trading or challenge
 * engines. Commissions are computed from the order's FINAL paid amount (after
 * coupon discounts) and created idempotently (unique order_id). Self-referral
 * is blocked. Payout is manual in V1 (admin marks commissions paid).
 */
if (!defined('ABSPATH')) exit;

class FXSIM_Affiliates {

    /** Default commission rate (%) for new affiliates. */
    public static function default_rate(): float {
        $r = (float) FXSIM_Challenge_DB::get_setting('affiliate_default_rate', 10);
        return $r > 0 ? $r : 10.0;
    }

    public static function get_by_user(int $user_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_affiliates WHERE user_id = %d", $user_id)) ?: null;
    }

    public static function get_by_code(string $code): ?object {
        global $wpdb;
        $code = strtoupper(trim($code));
        if ($code === '') return null;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_affiliates WHERE code = %s AND status = 'active'", $code)) ?: null;
    }

    /** Enroll a user as an affiliate (idempotent — returns existing if present). */
    public static function enroll(int $user_id): object {
        $existing = self::get_by_user($user_id);
        if ($existing) return $existing;

        global $wpdb;
        $code = self::generate_code($user_id);
        $wpdb->insert($wpdb->prefix . 'fxsim_affiliates', [
            'user_id'      => $user_id,
            'code'         => $code,
            'rate_percent' => self::default_rate(),
            'status'       => 'active',
        ]);
        if (class_exists('FXSIM_Database')) {
            FXSIM_Database::push_admin_notification('info', 'New affiliate joined',
                'A user enrolled in the affiliate program.', $user_id);
        }
        return self::get_by_user($user_id);
    }

    private static function generate_code(int $user_id): string {
        global $wpdb;
        $base = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', (string) (get_userdata($user_id)->user_login ?? 'REF')), 0, 8));
        if ($base === '') $base = 'REF';
        $code = $base;
        $i = 0;
        while ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}fxsim_affiliates WHERE code = %s", $code))) {
            $i++;
            $code = $base . $i;
            if ($i > 50) { $code = $base . wp_generate_password(4, false, false); break; }
        }
        return strtoupper($code);
    }

    /**
     * Create a commission when a referred user's order is PAID. Idempotent via
     * unique(order_id). base = order final paid amount (after discounts).
     */
    public static function record_commission(int $referred_user_id, int $order_id, float $base_amount): void {
        if ($order_id <= 0) return;
        $affiliate_id = (int) get_user_meta($referred_user_id, 'fxsim_referred_by', true);
        if ($affiliate_id <= 0) return;

        $aff = null;
        global $wpdb;
        $aff = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_affiliates WHERE id = %d", $affiliate_id));
        if (!$aff || $aff->status !== 'active') return;
        // Self-referral protection: an affiliate never earns on their own purchase.
        if ((int) $aff->user_id === (int) $referred_user_id) return;

        // Gamified Tier Evaluation
        $conversions = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_commissions WHERE affiliate_id = %d", $affiliate_id));
        $total_after_this = $conversions + 1;

        $rate = (float) $aff->rate_percent;
        $new_rate = $rate;
        
        if ($total_after_this >= 100) $new_rate = max($rate, 20.0);       // Platinum
        elseif ($total_after_this >= 50) $new_rate = max($rate, 15.0);    // Gold
        elseif ($total_after_this >= 10) $new_rate = max($rate, 12.0);    // Silver

        if ($new_rate > $rate) {
            $rate = $new_rate;
            $wpdb->update($wpdb->prefix . 'fxsim_affiliates', ['rate_percent' => $rate], ['id' => $affiliate_id]);
            if (class_exists('FXSIM_Database')) {
                FXSIM_Database::push_notification((int)$aff->user_id, 'success', 'Affiliate Tier Upgrade! 🚀',
                    "Congratulations! You reached a new affiliate tier. Your commission rate is now {$rate}%.", '/dashboard/affiliate');
            }
        }

        $amount = round($base_amount * ($rate / 100), 2);

        $inserted = $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->prefix}fxsim_commissions
                (affiliate_id, referred_user_id, order_id, base_amount, rate_percent, amount, status, created_at)
             VALUES (%d, %d, %d, %f, %f, %f, 'pending', %s)",
            $affiliate_id, $referred_user_id, $order_id, $base_amount, $rate, $amount, current_time('mysql')));

        if ($inserted) {
            if (class_exists('FXSIM_Database')) {
                FXSIM_Database::push_admin_notification('success', 'New affiliate commission',
                    'A referral converted — commission of ' . number_format($amount, 2) . ' recorded.', $referred_user_id);
            }
            if (class_exists('FXSIM_Emails')) {
                FXSIM_Emails::send((int) $aff->user_id, 'affiliate_commission', [
                    'amount' => number_format($amount, 2),
                    'rate'   => $rate,
                ]);
            }
        }
    }

    /** Supported affiliate payout methods (no bank transfers). */
    const PAYOUT_METHODS = ['usdt_trc20', 'usdt_bep20', 'wise'];

    /** Save the affiliate's payout method + destination with format validation. */
    public static function set_payout_method(int $user_id, string $method, string $destination): array {
        $aff = self::get_by_user($user_id);
        if (!$aff) return ['success' => false, 'message' => 'Not an affiliate.'];
        if (!in_array($method, self::PAYOUT_METHODS, true)) return ['success' => false, 'message' => 'Unsupported payout method.'];
        $destination = trim($destination);
        if ($destination === '') return ['success' => false, 'message' => 'Payout destination is required.'];

        // Format validation per method
        if ($method === 'usdt_trc20') {
            if (!preg_match('/^T[1-9A-HJ-NP-Za-km-z]{33}$/', $destination)) {
                return ['success' => false, 'message' => 'Invalid TRC20 USDT address. Must start with T and be 34 characters.'];
            }
        } elseif ($method === 'usdt_bep20') {
            if (!preg_match('/^0x[a-fA-F0-9]{40}$/', $destination)) {
                return ['success' => false, 'message' => 'Invalid BEP20 USDT address. Must be a valid 42-character 0x hex address.'];
            }
        } elseif ($method === 'wise') {
            if (!filter_var($destination, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'message' => 'Invalid Wise email address.'];
            }
        }

        global $wpdb;
        $wpdb->update($wpdb->prefix . 'fxsim_affiliates', [
            'payout_method'      => $method,
            'payout_destination' => substr(sanitize_text_field($destination), 0, 255),
        ], ['id' => $aff->id]);
        return ['success' => true];
    }

    /** Amount available to withdraw (unpaid commissions not already in a payout). */
    public static function available_balance(int $affiliate_id): float {
        global $wpdb;
        return (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(amount),0) FROM {$wpdb->prefix}fxsim_commissions
             WHERE affiliate_id=%d AND status IN ('pending','approved') AND payout_id IS NULL", $affiliate_id));
    }

    /** Affiliate requests a withdrawal of their available balance. (W5 Fix: transacted + row-locked) */
    public static function request_payout(int $user_id): array {
        global $wpdb;
        $aff = self::get_by_user($user_id);
        if (!$aff) return ['success' => false, 'message' => 'Not an affiliate.'];
        if ($aff->status !== 'active') return ['success' => false, 'message' => 'Affiliate account is suspended.'];
        if (!$aff->payout_method || !$aff->payout_destination) return ['success' => false, 'message' => 'Set your payout method first.'];

        $wpdb->query('START TRANSACTION');
        try {
            $open = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_affiliate_payouts 
                 WHERE affiliate_id=%d AND status IN ('pending','approved') FOR UPDATE", 
                $aff->id
            ));
            if ($open > 0) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'message' => 'You already have a withdrawal in progress.'];
            }
            $available = self::available_balance((int) $aff->id);
            if ($available <= 0) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'message' => 'No commissions available to withdraw.'];
            }

            $wpdb->insert($wpdb->prefix . 'fxsim_affiliate_payouts', [
                'affiliate_id' => $aff->id,
                'amount'       => $available,
                'method'       => $aff->payout_method,
                'destination'  => $aff->payout_destination,
                'status'       => 'pending',
            ]);
            $pid = (int) $wpdb->insert_id;
            // Lock the contributing commissions to this payout atomically.
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_commissions SET payout_id=%d, status='approved'
                 WHERE affiliate_id=%d AND status IN ('pending','approved') AND payout_id IS NULL", 
                $pid, $aff->id
            ));

            $wpdb->query('COMMIT');

            FXSIM_Database::push_admin_notification('info', 'Affiliate withdrawal requested',
                'An affiliate requested a withdrawal of ' . number_format($available, 2) . '.', $user_id);
            FXSIM_Database::push_notification($user_id, 'info', 'Withdrawal requested',
                'Your affiliate withdrawal of $' . number_format($available, 2) . ' was submitted and is pending review.', '/dashboard/affiliate');
            if (class_exists('FXSIM_Emails')) FXSIM_Emails::send($user_id, 'payout_requested', ['amount' => number_format($available, 2)]);
            return ['success' => true, 'amount' => round($available, 2), 'payout_id' => $pid];
        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            return ['success' => false, 'message' => 'Withdrawal request failed: ' . $e->getMessage()];
        }
    }

    /** Admin processes a payout: approved | rejected | paid (with tx ref / proof / note). */
    public static function process_payout(int $payout_id, string $status, string $tx = '', string $proof = '', string $note = ''): array {
        global $wpdb;
        $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_affiliate_payouts WHERE id=%d", $payout_id));
        if (!$p) return ['success' => false, 'message' => 'Payout not found.'];
        if (!in_array($status, ['approved', 'rejected', 'paid'], true)) return ['success' => false, 'message' => 'Invalid status.'];

        if ($status === 'paid') {
            // ATOMIC CLAIM: Only update if not already paid
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_affiliate_payouts 
                 SET status = 'paid', admin_note = %s, tx_reference = %s, proof_url = %s, processed_at = %s 
                 WHERE id = %d AND status != 'paid'",
                substr(sanitize_text_field($note ?: $p->admin_note), 0, 500),
                $tx !== '' ? substr(sanitize_text_field($tx), 0, 255) : $p->tx_reference,
                $proof !== '' ? esc_url_raw($proof) : $p->proof_url,
                current_time('mysql'),
                $payout_id
            ));
            if ($claimed !== 1) {
                return ['success' => false, 'message' => 'Payout has already been marked as paid.'];
            }

            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_commissions SET status='paid', paid_at=%s WHERE payout_id=%d",
                current_time('mysql'), $payout_id
            ));
        } else {
            $data = ['status' => $status, 'admin_note' => substr(sanitize_text_field($note), 0, 500)];
            if ($tx !== '')    $data['tx_reference'] = substr(sanitize_text_field($tx), 0, 255);
            if ($proof !== '') $data['proof_url']    = esc_url_raw($proof);
            if ($status === 'rejected') $data['processed_at'] = current_time('mysql');
            $wpdb->update($wpdb->prefix . 'fxsim_affiliate_payouts', $data, ['id' => $payout_id]);

            if ($status === 'rejected') {
                // Release commissions back to available
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->prefix}fxsim_commissions SET payout_id=NULL, status='approved' WHERE payout_id=%d",
                    $payout_id
                ));
            }
        }

        $aff = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}fxsim_affiliates WHERE id=%d", $p->affiliate_id));
        $uid = (int) ($aff->user_id ?? 0);

        if ($status === 'paid' && $uid) {
            FXSIM_Database::push_notification($uid, 'success', 'Affiliate payout sent',
                'Your withdrawal of $' . number_format((float) $p->amount, 2) . ' has been paid.' . ($tx ? ' Ref: ' . $tx : ''), '/dashboard/affiliate');
            if (class_exists('FXSIM_Emails')) FXSIM_Emails::send($uid, 'affiliate_payout_paid', ['amount' => number_format((float) $p->amount, 2), 'reference' => $tx]);
        } elseif ($status === 'rejected' && $uid) {
            FXSIM_Database::push_notification($uid, 'warning', 'Affiliate payout rejected',
                ($note ?: 'Your withdrawal request was rejected.'), '/dashboard/affiliate');
        } elseif ($status === 'approved' && $uid) {
            FXSIM_Database::push_notification($uid, 'info', 'Affiliate payout approved',
                'Your withdrawal of $' . number_format((float) $p->amount, 2) . ' was approved and is being processed.', '/dashboard/affiliate');
        }
        return ['success' => true, 'status' => $status];
    }

    /** Aggregate earnings + referral/conversion counts for an affiliate. */
    public static function stats(int $affiliate_id, int $user_id): array {
        global $wpdb;
        $referrals = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'fxsim_referred_by' AND meta_value = %d", $affiliate_id));
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) AS conversions,
                COALESCE(SUM(amount),0) AS total,
                COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0) AS unpaid,
                COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS paid
             FROM {$wpdb->prefix}fxsim_commissions WHERE affiliate_id = %d", $affiliate_id));
        return [
            'referrals'   => $referrals,
            'conversions' => $row ? (int) $row->conversions : 0,
            'total'       => $row ? round((float) $row->total, 2) : 0.0,
            'unpaid'      => $row ? round((float) $row->unpaid, 2) : 0.0,
            'paid'        => $row ? round((float) $row->paid, 2) : 0.0,
        ];
    }
}
