<?php
defined('ABSPATH') || exit;

/**
 * Class FXSIM_Scaling_Engine
 *
 * Implements automated scaling plan logic for funded prop trading accounts.
 */
class FXSIM_Scaling_Engine {

    /**
     * Runs via daily cron. Checks all funded accounts with scaling enabled.
     * For each eligible account, increases balance by scaling_growth_pct.
     *
     * @return void
     */
    public static function daily_scaling_check(): void {
        global $wpdb;

        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';
        $cp_table = $wpdb->prefix . 'fxsim_challenge_plans';

        // 1. Query all funded challenge accounts WHERE their plan has scaling_enabled=1
        $query = "
            SELECT ca.*, cp.scaling_enabled, cp.scaling_interval_months, cp.scaling_required_profit_pct, cp.scaling_growth_pct, cp.scaling_max_balance, cp.p1_max_dd as max_drawdown_pct, cp.p1_daily_dd as daily_drawdown_pct, cp.drawdown_type
            FROM {$ca_table} ca
            INNER JOIN {$cp_table} cp ON ca.plan_id = cp.id
            WHERE ca.status = 'funded' AND cp.scaling_enabled = 1
        ";

        $accounts = $wpdb->get_results($query);

        if (empty($accounts)) {
            return;
        }

        foreach ($accounts as $account) {
            if (self::is_eligible($account, $account)) {
                self::scale_up($account, $account);
            }
        }
    }

    /**
     * Check if a funded account qualifies for scaling.
     *
     * @param object $account The joined account data.
     * @param object $plan The joined plan data.
     * @return bool
     */
    private static function is_eligible(object $account, object $plan): bool {
        // Requirements:
        // - Months since funded_at (or last_scaled_at) >= scaling_interval_months
        // - Cumulative profit % >= scaling_required_profit_pct
        // - Current balance < scaling_max_balance
        // - Account still has 'funded' status

        if ($account->status !== 'funded') {
            return false;
        }

        if (empty($plan->scaling_interval_months) || empty($plan->scaling_required_profit_pct)) {
            return false;
        }

        $last_date = !empty($account->last_scaled_at) ? $account->last_scaled_at : $account->funded_at;
        if (empty($last_date)) {
            return false;
        }

        $current_time = current_time('timestamp');
        $last_time = strtotime($last_date);
        $months_elapsed = ($current_time - $last_time) / (30 * 24 * 60 * 60);

        if ($months_elapsed < $plan->scaling_interval_months) {
            return false;
        }

        // Calculate profit percentage based on starting balance of current level
        if ($account->starting_balance > 0) {
            $profit = $account->current_balance - $account->starting_balance;
            $profit_pct = ($profit / $account->starting_balance) * 100;

            if ($profit_pct < $plan->scaling_required_profit_pct) {
                return false;
            }
        } else {
            return false;
        }

        if ($account->starting_balance >= $plan->scaling_max_balance) {
            return false;
        }

        return true;
    }

    /**
     * Scale up the account.
     *
     * @param object $account The joined account data.
     * @param object $plan The joined plan data.
     * @return void
     */
    private static function scale_up(object $account, object $plan): void {
        global $wpdb;

        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';
        $acc_table = $wpdb->prefix . 'fxsim_accounts';
        $history_table = $wpdb->prefix . 'fxsim_scaling_history';

        // Calculate new_balance
        $growth_pct = !empty($plan->scaling_growth_pct) ? (float) $plan->scaling_growth_pct : 0;
        if ($growth_pct <= 0) return;

        $new_starting_balance = $account->starting_balance * (1 + ($growth_pct / 100));

        // Cap at scaling_max_balance
        $max_balance = !empty($plan->scaling_max_balance) ? (float) $plan->scaling_max_balance : $new_starting_balance;
        if ($new_starting_balance > $max_balance) {
            $new_starting_balance = $max_balance;
        }

        // Don't scale if already at or above max
        if ($account->starting_balance >= $new_starting_balance) {
            return;
        }

        $new_balance = $new_starting_balance;
        $new_scaling_level = (int) $account->scaling_level + 1;
        $now = current_time('mysql');

        // Calculate new drawdown levels
        // Update challenge account
        $wpdb->update(
            $ca_table,
            [
                'starting_balance' => $new_starting_balance,
                'current_balance' => $new_balance,
                'peak_balance' => $new_balance,
                'scaling_level' => $new_scaling_level,
                'last_scaled_at' => $now
            ],
            ['id' => $account->id],
            ['%f', '%f', '%f', '%d', '%s'],
            ['%d']
        );

        // Update underlying account balance
        $wpdb->update(
            $acc_table,
            [
                'balance' => $new_balance,
                'equity' => $new_balance
            ],
            ['id' => $account->fxsim_account_id],
            ['%f', '%f'],
            ['%d']
        );

        // Log to scaling history
        $wpdb->insert(
            $history_table,
            [
                'account_id' => $account->id,
                'user_id' => $account->user_id,
                'previous_balance' => $account->starting_balance,
                'new_balance' => $new_starting_balance,
                'scaling_level' => $new_scaling_level,
                'scaled_at' => $now
            ],
            ['%d', '%d', '%f', '%f', '%d', '%s']
        );

        // Send notifications
        $user_id = $account->user_id;
        $brand_name = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        
        $notify_data = [
            'challenge_id' => $account->id,
            'old_balance' => $account->starting_balance,
            'new_balance' => $new_starting_balance,
            'level' => $new_scaling_level
        ];

        if (class_exists('FXSIM_Challenge_Engine') && method_exists('FXSIM_Challenge_Engine', 'notify_user')) {
            FXSIM_Challenge_Engine::notify_user($user_id, 'account_scaled', $notify_data);
        }

        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'push_notification')) {
            $title = 'Account Scaled Up!';
            $message = sprintf('Congratulations! Your funded account has been scaled to %s.', number_format($new_starting_balance, 2));
            FXSIM_Database::push_notification($user_id, 'success', $title, $message, '#');
        }

        // Discord Webhook
        if (class_exists('FXSIM_Challenge_DB')) {
            $discord_webhook = FXSIM_Challenge_DB::get_setting('discord_webhook');
            if (!empty($discord_webhook)) {
                $discord_msg = [
                    'content' => "🚀 **Account Scaled!**\nA trader just scaled their funded account to **$" . number_format($new_starting_balance, 2) . "** on {$brand_name}!"
                ];
                wp_remote_post($discord_webhook, [
                    'body' => json_encode($discord_msg),
                    'headers' => ['Content-Type' => 'application/json']
                ]);
            }
        }
    }

    /**
     * Get scaling history for an account.
     *
     * @param int $challenge_id The challenge account ID.
     * @return array
     */
    public static function get_scaling_history(int $challenge_id): array {
        global $wpdb;
        $history_table = $wpdb->prefix . 'fxsim_scaling_history';

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$history_table} WHERE challenge_id = %d ORDER BY scaled_at DESC",
                $challenge_id
            ),
            ARRAY_A
        ) ?: [];
    }

    /**
     * Get scaling status/preview for a funded account.
     *
     * @param int $challenge_id
     * @return array
     */
    public static function get_scaling_status(int $challenge_id): array {
        global $wpdb;
        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';
        $cp_table = $wpdb->prefix . 'fxsim_challenge_plans';

        $query = $wpdb->prepare("
            SELECT ca.*, cp.scaling_enabled, cp.scaling_interval_months, cp.scaling_required_profit_pct, cp.scaling_growth_pct, cp.scaling_max_balance
            FROM {$ca_table} ca
            INNER JOIN {$cp_table} cp ON ca.plan_id = cp.id
            WHERE ca.id = %d
        ", $challenge_id);

        $account = $wpdb->get_row($query);

        if (!$account || empty($account->scaling_enabled) || $account->status !== 'funded') {
            return [
                'eligible' => false,
                'message' => 'Account is not eligible for scaling.'
            ];
        }

        $last_date = !empty($account->last_scaled_at) ? $account->last_scaled_at : $account->funded_at;
        if (empty($last_date)) {
            $last_date = current_time('mysql');
        }

        $current_time = current_time('timestamp');
        $last_time = strtotime($last_date);
        
        // Calculate months elapsed
        $months_elapsed = ($current_time - $last_time) / (30 * 24 * 60 * 60);
        $time_progress_pct = min(100, ($months_elapsed / max(1, $account->scaling_interval_months)) * 100);

        // Calculate profit progress
        $profit_pct = 0;
        if ($account->starting_balance > 0) {
            $profit = $account->current_balance - $account->starting_balance;
            $profit_pct = ($profit / $account->starting_balance) * 100;
        }
        $profit_progress_pct = min(100, max(0, ($profit_pct / max(0.01, $account->scaling_required_profit_pct)) * 100));

        $next_scale_date = date('Y-m-d H:i:s', strtotime("+{$account->scaling_interval_months} months", $last_time));
        
        $new_starting_balance = $account->starting_balance * (1 + ($account->scaling_growth_pct / 100));
        $next_balance = min($new_starting_balance, $account->scaling_max_balance);

        return [
            'eligible' => true,
            'current_level' => (int) $account->scaling_level,
            'next_scale_date' => $next_scale_date,
            'time_progress_pct' => round($time_progress_pct, 2),
            'profit_progress_pct' => round($profit_progress_pct, 2),
            'current_profit_pct' => round($profit_pct, 2),
            'required_profit_pct' => (float) $account->scaling_required_profit_pct,
            'next_balance' => $next_balance,
            'max_balance' => (float) $account->scaling_max_balance,
            'is_ready' => ($time_progress_pct >= 100 && $profit_progress_pct >= 100 && $account->starting_balance < $account->scaling_max_balance)
        ];
    }

    /**
     * Admin: manually trigger scaling for an account (bypass time check).
     *
     * @param int $challenge_id
     * @return array
     */
    public static function admin_force_scale(int $challenge_id): array {
        global $wpdb;
        $ca_table = $wpdb->prefix . 'fxsim_challenge_accounts';
        $cp_table = $wpdb->prefix . 'fxsim_challenge_plans';

        $query = $wpdb->prepare("
            SELECT ca.*, cp.scaling_enabled, cp.scaling_interval_months, cp.scaling_required_profit_pct, cp.scaling_growth_pct, cp.scaling_max_balance, cp.p1_max_dd as max_drawdown_pct, cp.p1_daily_dd as daily_drawdown_pct, cp.drawdown_type
            FROM {$ca_table} ca
            INNER JOIN {$cp_table} cp ON ca.plan_id = cp.id
            WHERE ca.id = %d
        ", $challenge_id);

        $account = $wpdb->get_row($query);

        if (!$account) {
            return ['success' => false, 'message' => 'Account not found.'];
        }

        if (empty($account->scaling_enabled)) {
            return ['success' => false, 'message' => 'Scaling is not enabled for this plan.'];
        }

        if ($account->status !== 'funded') {
            return ['success' => false, 'message' => 'Only funded accounts can be scaled.'];
        }

        if ($account->starting_balance >= $account->scaling_max_balance) {
            return ['success' => false, 'message' => 'Account has already reached the maximum scaling balance.'];
        }

        self::scale_up($account, $account);

        return ['success' => true, 'message' => 'Account successfully scaled up.'];
    }
}
