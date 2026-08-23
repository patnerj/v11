<?php
/**
 * Challenge Engine
 * Handles: rule evaluation, breach detection, phase promotion, daily snapshots
 */
defined('ABSPATH') || exit;

class FXSIM_Challenge_Engine {

    // ── Create a new isolated challenge account for a user ────────────────────
    public static function create_challenge(int $user_id, int $plan_id): array {
        global $wpdb;

        $plan = FXSIM_Challenge_DB::get_plan($plan_id);
        if (!$plan) return ['success' => false, 'message' => 'Plan not found.'];

        $start = (float) $plan->account_size;

        // ISOLATION: create a brand-new trading account for this challenge only
        $account_id = FXSIM_Database::create_challenge_account($user_id, $start);
        if (!$account_id) return ['success' => false, 'message' => 'Failed to create challenge account.'];

        // Determine drawdown type and initial DD floor
        $dd_type = $plan->drawdown_type ?? 'static';
        $max_dd_pct = (float)($plan->p1_max_dd ?? 10);
        $initial_dd_floor = $start * (1 - $max_dd_pct / 100);

        // ── Instant Funding: skip evaluation, go directly to funded ──────────
        if (!empty($plan->is_instant_funding)) {
            $funded_max_dd = (float)($plan->funded_max_dd ?? 10);
            $funded_dd_floor = $start * (1 - $funded_max_dd / 100);

            $inserted = $wpdb->insert($wpdb->prefix . 'fxsim_challenge_accounts', [
                'user_id'             => $user_id,
                'plan_id'             => $plan_id,
                'fxsim_account_id'    => $account_id,
                'phase'               => 0,  // 0 = no evaluation phase
                'status'              => 'funded',
                'starting_balance'    => $start,
                'current_balance'     => $start,
                'peak_balance'        => $start,
                'daily_start_balance' => $start,
                'drawdown_type'       => $dd_type,
                'equity_hwm'          => $start,
                'trailing_dd_floor'   => $funded_dd_floor,
                'phase_started_at'    => current_time('mysql'),
                'funded_at'           => current_time('mysql'),
            ]);

            $challenge_id = (int) $wpdb->insert_id;
            if (!$inserted || !$challenge_id) {
                return ['success' => false, 'message' => 'Database error provisioning instant funded challenge: ' . $wpdb->last_error];
            }

            FXSIM_Database::log_transaction(
                $account_id, 'deposit', $start, $start,
                "Instant Funding: {$plan->name} (#{$challenge_id})"
            );

            self::record_snapshot($challenge_id, $start);
            self::notify_user($user_id, 'challenge_passed', ['challenge_id' => $challenge_id]);

            return ['success' => true, 'challenge_id' => $challenge_id, 'plan' => $plan, 'instant' => true];
        }

        // ── Standard evaluation challenge ────────────────────────────────────
        $phase_ends = ((int)$plan->p1_max_days > 0)
            ? date('Y-m-d H:i:s', strtotime("+{$plan->p1_max_days} days"))
            : NULL;

        $inserted = $wpdb->insert($wpdb->prefix . 'fxsim_challenge_accounts', [
            'user_id'             => $user_id,
            'plan_id'             => $plan_id,
            'fxsim_account_id'    => $account_id,
            'phase'               => 1,
            'status'              => 'active',
            'starting_balance'    => $start,
            'current_balance'     => $start,
            'peak_balance'        => $start,
            'daily_start_balance' => $start,
            'drawdown_type'       => $dd_type,
            'equity_hwm'          => $start,
            'trailing_dd_floor'   => $initial_dd_floor,
            'phase_started_at'    => current_time('mysql'),
            'phase_ends_at'       => $phase_ends,
        ]);

        $challenge_id = (int) $wpdb->insert_id;
        if (!$inserted || !$challenge_id) {
            return ['success' => false, 'message' => 'Database error provisioning challenge account: ' . $wpdb->last_error];
        }

        FXSIM_Database::log_transaction(
            $account_id, 'deposit', $start, $start,
            "Challenge funded: {$plan->name} (#{$challenge_id})"
        );

        self::record_snapshot($challenge_id, $start);

        return ['success' => true, 'challenge_id' => $challenge_id, 'plan' => $plan];
    }

    // ── Evaluate rules after every trade close ────────────────────────────────
    public static function evaluate_after_trade(int $challenge_id): void {
        global $wpdb;
        $challenge = FXSIM_Challenge_DB::get_challenge($challenge_id);
        if (!$challenge || !in_array($challenge->status, ['active', 'funded'])) return;

        $plan    = FXSIM_Challenge_DB::get_plan((int)$challenge->plan_id);
        $account = FXSIM_Database::get_account_by_id((int)$challenge->fxsim_account_id);
        if (!$plan || !$account) return;

        $balance = (float)$account->balance;
        $equity  = (float)$account->equity;
        $start   = (float)$challenge->starting_balance;
        $peak    = max((float)$challenge->peak_balance, $balance);

        // Update peak + current balance
        self::update_challenge_balance($challenge_id, $balance, $peak);

        // Get rules for current phase (including custom enterprise overrides)
        $phase = ($challenge->status === 'funded') ? 0 : (int)$challenge->phase;
        [$profit_target, $daily_dd_pct, $max_dd_pct, $min_days, $max_days] = self::get_phase_rules($plan, $phase, $challenge);

        // ── Drawdown calculation based on type ────────────────────────────────
        $dd_type = $challenge->drawdown_type ?? ($plan->drawdown_type ?? 'static');
        $current_equity = min($balance, $equity); // Use the lower of balance/equity

        switch ($dd_type) {
            case 'trailing':
            case 'trailing_equity':
                // Trailing DD: floor moves up with equity high-water mark
                $hwm = max((float)$challenge->equity_hwm, $current_equity);
                $new_floor = $hwm * (1 - $max_dd_pct / 100);
                // Floor can only go UP (never down)
                $trailing_floor = max((float)$challenge->trailing_dd_floor, $new_floor);

                // Update HWM and trailing floor
                $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                    'equity_hwm'        => $hwm,
                    'trailing_dd_floor' => $trailing_floor,
                ], ['id' => $challenge_id]);

                $dd_breach_level = $trailing_floor;
                break;

            case 'eod_trailing':
            case 'trailing_balance':
                // EOD Trailing: floor only updates at end of day (in daily_tasks)
                // Here we just check against the stored floor
                $dd_breach_level = (float)$challenge->trailing_dd_floor;
                if ($dd_breach_level <= 0) {
                    $dd_breach_level = $start * (1 - $max_dd_pct / 100);
                }
                break;

            case 'static':
            case 'static_balance':
            default:
                // Static: fixed from starting balance
                $dd_breach_level = $start * (1 - $max_dd_pct / 100);
                break;
        }

        // ── Check 1: Max Drawdown ──────────────────────────────────────────────
        if ($current_equity <= $dd_breach_level) {
            $dd_fmt    = number_format($start - $current_equity, 2);
            $start_fmt = number_format($start, 2);
            $type_label = (in_array($dd_type, ['trailing', 'trailing_equity'], true)) ? 'Trailing Equity' : ((in_array($dd_type, ['eod_trailing', 'trailing_balance'], true)) ? 'EOD Trailing Balance' : 'Static');
            self::breach($challenge_id, (int)$challenge->user_id, 'max_drawdown',
                $max_dd_pct, round(($start - $current_equity) / $start * 100, 2),
                "{$type_label} max drawdown breached: equity dropped to \$" . number_format($current_equity, 2) . " (floor: \$" . number_format($dd_breach_level, 2) . ")");
            return;
        }

        // ── Check 2: Daily Drawdown ────────────────────────────────────────────
        $daily_start  = (float)$challenge->daily_start_balance;
        $daily_dd_val = $daily_start * ($daily_dd_pct / 100);
        $daily_loss   = $daily_start - $current_equity;
        if ($daily_loss >= $daily_dd_val) {
            $dl_fmt  = number_format($daily_loss, 2);
            $ds_fmt  = number_format($daily_start, 2);
            self::breach($challenge_id, (int)$challenge->user_id, 'daily_drawdown',
                $daily_dd_pct, round(($daily_loss / $daily_start) * 100, 2),
                "Daily drawdown breached: lost \${$dl_fmt} today (limit: {$daily_dd_pct}% of \${$ds_fmt})");
            return;
        }

        // ── Check 3 & 4: Profit target reached & consistency rule → promote ────
        // Consistency used to run unconditionally after every single trade
        // close and call breach() directly. With only one profitable day on
        // record — which is true by definition on a trader's very first
        // winning trade — best_day_pct is mathematically always 100%,
        // exceeding any realistic consistency_pct threshold. That failed
        // every trader on day one whenever the rule was enabled. It's now a
        // promotion gate instead: it blocks advancing to the next phase
        // rather than permanently failing the account, and only gets
        // evaluated once there's actually a promotion to gate.
        if ($challenge->status === 'active' && $phase >= 1) {
            $profit_needed = $start * ($profit_target / 100);
            $current_profit = $balance - $start;
            if ($current_profit >= $profit_needed) {
                $trading_days = (int)$challenge->trading_days;
                if ($trading_days >= $min_days) {
                    $open_positions = (int)$wpdb->get_var($wpdb->prepare(
                        "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_positions WHERE account_id=%d",
                        $challenge->fxsim_account_id
                    ));
                    if ($open_positions === 0) {
                        $consistency = self::check_consistency($challenge, $plan);
                        if ($consistency['passed']) {
                            self::promote($challenge_id, $challenge, $plan);
                        }
                    }
                }
            }
        }
    }

    /**
     * Evaluate the consistency rule (best single day must not exceed
     * consistency_pct of total profit) as a pass/fail check — never a
     * breach. Used to gate phase promotion.
     *
     * @return array{passed: bool, best_day_pct: float, limit_pct: float}
     */
    public static function check_consistency(object $challenge, object $plan): array {
        $result = ['passed' => true, 'best_day_pct' => 0.0, 'limit_pct' => 0.0];
        if (!(int)$plan->consistency_rule) return $result;

        global $wpdb;
        $pct = (float)$plan->consistency_pct;
        $result['limit_pct'] = $pct;

        $daily_stats = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(closed_at) as trade_date, SUM(CASE WHEN pnl>0 THEN pnl ELSE 0 END) as day_profit
             FROM {$wpdb->prefix}fxsim_trades
             WHERE account_id=%d AND pnl > 0
             GROUP BY trade_date",
            $challenge->fxsim_account_id
        ));
        $total_profit = array_sum(array_column($daily_stats, 'day_profit'));
        if ($total_profit > 0 && count($daily_stats) > 0) {
            $best_day = max(array_column($daily_stats, 'day_profit'));
            $best_day_pct = ($best_day / $total_profit) * 100;
            $result['best_day_pct'] = round($best_day_pct, 2);
            if ($best_day_pct > $pct) $result['passed'] = false;
        }
        return $result;
    }

    // ── Daily tasks: reset daily DD tracking, check time limits, EOD trailing ─
    public static function daily_tasks(): void {
        global $wpdb;
        $challenges = $wpdb->get_results(
            "SELECT ca.*, a.balance, a.equity FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_accounts a ON ca.fxsim_account_id = a.id
             WHERE ca.status IN ('active', 'funded')"
        );

        foreach ($challenges as $ch) {
            $balance  = (float)$ch->balance;
            $equity   = (float)($ch->equity ?? $balance);
            $plan     = FXSIM_Challenge_DB::get_plan((int)$ch->plan_id);
            if (!$plan) continue;

            $phase = (int)$ch->phase;
            [$pt, $dd, $max_dd_pct, $min_d, $max_d] = self::get_phase_rules($plan, $phase, $ch);

            // ── EOD Trailing Drawdown: update trailing floor at day's end ─────
            if (($ch->drawdown_type ?? 'static') === 'eod_trailing') {
                $current_equity = min($balance, $equity);
                $hwm = max((float)$ch->equity_hwm, $current_equity);
                $new_floor = $hwm * (1 - $max_dd_pct / 100);
                $trailing_floor = max((float)$ch->trailing_dd_floor, $new_floor);

                $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                    'equity_hwm'        => $hwm,
                    'trailing_dd_floor' => $trailing_floor,
                ], ['id' => $ch->id]);
            }

            // Update daily_start_balance for next day
            $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts',
                ['daily_start_balance' => $balance],
                ['id' => $ch->id]
            );

            // Update peak
            $peak = max((float)$ch->peak_balance, $balance);
            self::update_challenge_balance((int)$ch->id, $balance, $peak);

            // Check time limit exceeded (only for evaluation phases with configured limit)
            if ($ch->status === 'active' && $ch->phase_ends_at && (int)$max_d > 0 && strtotime($ch->phase_ends_at) < time()) {
                $profit = $balance - (float)$ch->starting_balance;
                $profit_needed = (float)$ch->starting_balance * ($pt / 100);
                if ($profit < $profit_needed) {
                    self::breach((int)$ch->id, (int)$ch->user_id, 'time_limit',
                        $max_d, 0,
                        "Phase {$ch->phase} time limit of {$max_d} days exceeded without reaching profit target.");
                    continue;
                }
            }

            // Check Inactivity limit
            if (isset($plan->max_inactivity_days) && (int)$plan->max_inactivity_days > 0) {
                $max_inactive = (int)$plan->max_inactivity_days;
                $last_trade = $wpdb->get_var($wpdb->prepare("SELECT MAX(opened_at) FROM {$wpdb->prefix}fxsim_trades WHERE account_id = %d", $ch->fxsim_account_id));
                $last_pos = $wpdb->get_var($wpdb->prepare("SELECT MAX(opened_at) FROM {$wpdb->prefix}fxsim_positions WHERE account_id = %d", $ch->fxsim_account_id));
                
                $last_activity = $ch->created_at;
                if (!empty($ch->phase_started_at) && strtotime($ch->phase_started_at) > strtotime($last_activity)) $last_activity = $ch->phase_started_at;
                if (!empty($ch->funded_at) && strtotime($ch->funded_at) > strtotime($last_activity)) $last_activity = $ch->funded_at;
                if ($last_trade && strtotime($last_trade) > strtotime($last_activity)) $last_activity = $last_trade;
                if ($last_pos && strtotime($last_pos) > strtotime($last_activity)) $last_activity = $last_pos;
                
                $days_inactive = (time() - strtotime($last_activity)) / 86400;
                
                if ($days_inactive > $max_inactive) {
                    self::breach((int)$ch->id, (int)$ch->user_id, 'inactivity',
                        $max_inactive, 0,
                        "Inactivity limit reached: No trades placed in {$max_inactive} days.");
                    continue;
                }
            }

            // Record daily snapshot
            self::record_snapshot((int)$ch->id, $balance);
        }

        // ── Run scaling check for funded accounts ─────────────────────────────
        if (class_exists('FXSIM_Scaling_Engine')) {
            FXSIM_Scaling_Engine::daily_scaling_check();
        }
    }

    // ── Phase promotion logic (supports 1/2/3-step challenges) ────────────────
    private static function promote(int $challenge_id, object $challenge, object $plan): void {
        global $wpdb;
        $current_phase = (int)$challenge->phase;
        $total_phases  = (!empty($plan->plan_type) && $plan->plan_type === '1-step') ? 1 : ((!empty($plan->plan_type) && $plan->plan_type === '3-step') ? 3 : ((!empty($plan->plan_type) && $plan->plan_type === 'instant') ? 0 : (int)($plan->phases ?? 2)));
        $user_id       = (int)$challenge->user_id;
        $dd_type       = $challenge->drawdown_type ?? 'static';
        $start         = (float)$challenge->starting_balance;

        try {
            self::promote_inner($challenge_id, $challenge, $plan, $current_phase, $total_phases, $user_id, $start);
        } catch (\Throwable $e) {
            error_log("[PropFirm] promote() failed for challenge #{$challenge_id} (phase={$current_phase}): " . $e->getMessage());
        }
    }

    private static function promote_inner(int $challenge_id, object $challenge, object $plan, int $current_phase, int $total_phases, int $user_id, float $start): void {
        global $wpdb;

        // Force close any remaining positions to be completely safe
        self::force_close_all_positions($challenge_id, $user_id);

        // Reset account balance to starting balance
        $wpdb->update($wpdb->prefix . 'fxsim_accounts', [
            'balance'     => $start,
            'equity'      => $start,
            'margin_used' => 0,
        ], ['id' => $challenge->fxsim_account_id]);

        // Log a reset transaction
        FXSIM_Database::log_transaction(
            (int)$challenge->fxsim_account_id,
            'adjustment',
            0.0,
            $start,
            "Phase {$current_phase} passed. Resetting to initial balance."
        );

        if ($current_phase < $total_phases) {
            // ── Advance to next phase ────────────────────────────────────────
            $next_phase = $current_phase + 1;

            // Get max_days for next phase dynamically
            [$next_pt, $next_dd, $next_mdd, $next_min, $next_max] = self::get_phase_rules($plan, $next_phase);
            $phase_end = ((int)$next_max > 0) ? date('Y-m-d H:i:s', strtotime("+{$next_max} days")) : NULL;

            // Calculate new DD floor for next phase
            $new_dd_floor = $start * (1 - $next_mdd / 100);

            $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                'phase'               => $next_phase,
                'status'              => 'active',
                'current_balance'     => $start,
                'peak_balance'        => $start,
                'daily_start_balance' => $start,
                'equity_hwm'          => $start,
                'trailing_dd_floor'   => $new_dd_floor,
                'trading_days'        => 0,
                'phase_started_at'    => current_time('mysql'),
                'phase_ends_at'       => $phase_end,
                'passed_at'           => NULL,
            ], ['id' => $challenge_id]);

            self::notify_user($user_id, 'phase_passed', [
                'phase' => $current_phase,
                'next'  => "Phase {$next_phase}",
            ]);

        } else {
            // ── All phases passed → Funded ────────────────────────────────────
            $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                'status'    => 'funded',
                'funded_at' => current_time('mysql'),
                'passed_at' => current_time('mysql'),
            ], ['id' => $challenge_id]);

            self::notify_user($user_id, 'challenge_passed', ['challenge_id' => $challenge_id]);

            if (class_exists('FXSIM_Webhooks')) {
                $u = get_userdata($user_id);
                if (method_exists('FXSIM_Webhooks', 'notify_funded')) {
                    FXSIM_Webhooks::notify_funded($u ? ($u->display_name ?: $u->user_login) : "Trader #{$user_id}", (float)$challenge->starting_balance);
                } else {
                    FXSIM_Webhooks::dispatch('purchase', [
                        'user' => $u ? ($u->display_name ?: $u->user_login) : "Trader #{$user_id}",
                        'plan' => $plan->name ?? 'Funded Account',
                        'amount' => (float)$challenge->starting_balance,
                    ]);
                }
            }
        }
    }

    // ── Breach ────────────────────────────────────────────────────────────────
    private static function breach(int $challenge_id, int $user_id, string $rule, $limit, $actual, string $description): void {
        global $wpdb;

        try {
            // Atomic claim: makes breach() idempotent under cron overlap (e.g.
            // fxsim_daily_tasks firing again before a slow prior run finished).
            // Without this, two concurrent callers could both pass a prior
            // status check, both force-close positions, both insert a breach
            // row, and both fire the notification/webhook for the same
            // breach. close_position() itself is unaffected by claiming the
            // CHALLENGE status here — it gates on fxsim_accounts.status
            // ('active'), which this function only flips to 'frozen' further
            // below, after positions are closed (see the comment there).
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_challenge_accounts
                 SET status = 'failed', breach_reason = %s, breach_at = %s, failed_at = %s
                 WHERE id = %d AND status NOT IN ('failed', 'passed', 'cancelled')",
                $description, current_time('mysql'), current_time('mysql'), $challenge_id
            ));
            if (!$claimed || $wpdb->rows_affected === 0) {
                return; // Already breached (or otherwise terminal) — nothing to do
            }

            // Close all open positions BEFORE freezing the account, otherwise close_position fails
            // to find an 'active' account and leaves the positions orphaned.
            self::force_close_all_positions($challenge_id, $user_id);

            // Log breach
            $wpdb->insert($wpdb->prefix . 'fxsim_challenge_breaches', [
                'challenge_id' => $challenge_id,
                'user_id'      => $user_id,
                'rule_type'    => $rule,
                'rule_value'   => $limit,
                'actual_value' => $actual,
                'description'  => $description,
            ]);

            // Freeze the underlying trading account
            $challenge = FXSIM_Challenge_DB::get_challenge($challenge_id);
            if ($challenge) {
                $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                    ['status' => 'frozen'],
                    ['id' => (int)$challenge->fxsim_account_id]
                );
            }

            // Notify
            self::notify_user($user_id, 'challenge_failed', [
                'reason' => $description,
                'rule'   => $rule,
            ]);

            if (class_exists('FXSIM_Webhooks')) {
                $user_info = get_userdata($user_id);
                FXSIM_Webhooks::dispatch('breach', [
                    'account_id'  => $challenge_id,
                    'trader_name' => $user_info ? $user_info->display_name : "Trader #$user_id",
                    'reason'      => $description,
                    'equity'      => (float)$actual,
                ]);
            }
        } catch (\Throwable $e) {
            error_log("[PropFirm] breach() failed for challenge #{$challenge_id} (rule={$rule}): " . $e->getMessage());
        }
    }

    // ── Force-close all open positions on breach ──────────────────────────────
    private static function force_close_all_positions(int $challenge_id, int $user_id): void {
        global $wpdb;
        $challenge = FXSIM_Challenge_DB::get_challenge($challenge_id);
        if (!$challenge) return;
        
        $positions = $wpdb->get_results($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_positions WHERE account_id=%d",
            $challenge->fxsim_account_id
        ));
        foreach ($positions as $pos) {
            FXSIM_Trading_Engine::close_position($user_id, (int)$pos->id, 'breach', true);
        }

        $pending = $wpdb->get_results($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}fxsim_pending_orders WHERE account_id=%d",
            $challenge->fxsim_account_id
        ));
        foreach ($pending as $order) {
            FXSIM_Trading_Engine::cancel_pending_order($user_id, (int)$order->id, 'breach');
        }
    }

    // ── Record daily snapshot ─────────────────────────────────────────────────
    private static function record_snapshot(int $challenge_id, float $balance): void {
        global $wpdb;
        $today = current_time('Y-m-d');
        $wpdb->query($wpdb->prepare(
            "INSERT INTO {$wpdb->prefix}fxsim_challenge_snapshots
             (challenge_id, snapshot_date, opening_balance, closing_balance)
             VALUES (%d, %s, %f, %f)
             ON DUPLICATE KEY UPDATE closing_balance=%f",
            $challenge_id, $today, $balance, $balance, $balance
        ));
    }

    // ── Update trading days counter ───────────────────────────────────────────
    public static function increment_trading_days(int $challenge_id): void {
        global $wpdb;
        $ch = FXSIM_Challenge_DB::get_challenge($challenge_id);
        if (!$ch) return;
        $today = current_time('Y-m-d');
        if ($ch->last_trade_date === $today) return; // already counted today
        $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
            'trading_days'    => (int)$ch->trading_days + 1,
            'last_trade_date' => $today,
        ], ['id' => $challenge_id]);
    }

    // ── Get live challenge metrics for dashboard ──────────────────────────────
    public static function get_metrics(int $challenge_id): array {
        global $wpdb;
        $ch  = FXSIM_Challenge_DB::get_challenge($challenge_id);
        if (!$ch) return [];
        $plan = FXSIM_Challenge_DB::get_plan((int)$ch->plan_id);
        if (!$plan) return [];
        $acc = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_accounts WHERE id=%d", $ch->fxsim_account_id
        ));
        if (!$acc) return [];

        $phase = (int)$ch->phase;
        [$pt, $daily_dd, $max_dd, $min_d, $max_d] = self::get_phase_rules($plan, $phase, $ch);

        if ($ch->status === 'funded' && isset($plan->scaling_enabled) && (int)$plan->scaling_enabled === 1) {
            $pt = (float)($plan->scaling_required_profit_pct ?? 10);
        }

        $balance      = (float)$acc->balance;
        $equity       = (float)$acc->equity;
        $start        = (float)$ch->starting_balance;
        $daily_start  = (float)$ch->daily_start_balance;
        $peak         = (float)$ch->peak_balance;

        $profit_target_val  = $start * ($pt / 100);
        $max_dd_val         = $start * ($max_dd / 100);
        $daily_dd_val       = $daily_start * ($daily_dd / 100);

        $current_profit     = $balance - $start;
        $current_daily_loss = max(0, $daily_start - min($balance, $equity));

        $is_trailing = in_array($ch->drawdown_type ?? 'static', ['trailing', 'trailing_equity', 'eod_trailing', 'trailing_balance'], true);
        if ($is_trailing && !empty($ch->trailing_dd_floor)) {
            $effective_val  = min($balance, $equity);
            $dd_remaining   = max(0.0, round($effective_val - (float)$ch->trailing_dd_floor, 2));
            $current_max_dd = max(0.0, round($start - $effective_val, 2));
        } else {
            $current_max_dd = max(0.0, round($start - min($balance, $equity), 2));
            $dd_remaining   = round($max_dd_val - $current_max_dd, 2);
        }

        $profit_pct    = $start > 0 ? round(($current_profit / $start) * 100, 2) : 0;
        $max_dd_used   = $start > 0 ? round(($current_max_dd / $start) * 100, 2) : 0;
        $daily_dd_used = $daily_start > 0 ? round(($current_daily_loss / $daily_start) * 100, 2) : 0;

        // Days remaining
        $days_remaining = 0;
        if ($ch->phase_ends_at) {
            $days_remaining = max(0, (int)ceil((strtotime($ch->phase_ends_at) - time()) / 86400));
        }

        // Equity chart data (last 14 days)
        $snapshots = $wpdb->get_results($wpdb->prepare(
            "SELECT snapshot_date, closing_balance FROM {$wpdb->prefix}fxsim_challenge_snapshots
             WHERE challenge_id=%d ORDER BY snapshot_date ASC LIMIT 60",
            $challenge_id
        ));

        // Trade stats
        $trade_stats = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) as total,
                    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
                    SUM(pnl) as net_pnl,
                    SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as gross_profit,
                    ABS(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)) as gross_loss
             FROM {$wpdb->prefix}fxsim_trades
             WHERE account_id=%d",
            $ch->fxsim_account_id
        ));

        $win_rate = ($trade_stats->total > 0)
            ? round(($trade_stats->wins / $trade_stats->total) * 100, 1) : 0;
        $profit_factor = ($trade_stats->gross_loss > 0)
            ? round($trade_stats->gross_profit / $trade_stats->gross_loss, 2) : 0;

        return [
            'challenge'         => $ch,
            'plan'              => $plan,
            'account'           => $acc,
            'phase'             => $phase,
            'status'            => $ch->status,
            'breach_reason'     => $ch->breach_reason,
            // Balance
            'balance'           => $balance,
            'equity'            => $equity,
            'starting_balance'  => $start,
            // Profit target
            'profit_target_pct' => $pt,
            'profit_target_val' => round($profit_target_val, 2),
            'current_profit'    => round($current_profit, 2),
            'current_profit_pct'=> $profit_pct,
            'profit_progress'   => min(100, round(max(0, $current_profit) / max(1, $profit_target_val) * 100, 1)),
            // Max drawdown
            'max_dd_pct'        => $max_dd,
            'max_dd_val'        => round($max_dd_val, 2),
            'current_dd'        => round($current_max_dd, 2),
            'current_dd_pct'    => $max_dd_used,
            'dd_remaining'      => $dd_remaining,
            'max_dd_progress'   => min(100, round($current_max_dd / max(1, $max_dd_val) * 100, 1)),
            // Daily drawdown
            'daily_dd_pct'      => $daily_dd,
            'daily_dd_val'      => round($daily_dd_val, 2),
            'current_daily_loss'=> round($current_daily_loss, 2),
            'daily_dd_used_pct' => $daily_dd_used,
            'daily_dd_progress' => min(100, round($current_daily_loss / max(1, $daily_dd_val) * 100, 1)),
            // Days
            'min_trading_days'  => $min_d,
            'max_trading_days'  => $max_d,
            'trading_days_done' => (int)$ch->trading_days,
            'days_remaining'    => $days_remaining,
            'days_progress'     => min(100, round((int)$ch->trading_days / max(1, $min_d) * 100, 1)),
            // Stats
            'win_rate'          => $win_rate,
            'profit_factor'     => $profit_factor,
            'total_trades'      => (int)$trade_stats->total,
            'net_pnl'           => round($trade_stats->net_pnl ?? 0, 2),
            // Chart data
            'equity_chart'      => array_map(fn($s) => [
                'date'    => $s->snapshot_date,
                'balance' => (float)$s->closing_balance,
            ], $snapshots),
            // Drawdown type info
            'drawdown_type'     => $ch->drawdown_type ?? 'static',
            'equity_hwm'        => (float)($ch->equity_hwm ?? $start),
            'trailing_dd_floor' => (float)($ch->trailing_dd_floor ?? 0),
            // Scaling info
            'scaling_level'     => (int)($ch->scaling_level ?? 0),
        ];
    }

    // ── Phase rule helper (supports phases 1, 2, 3 + funded + bespoke overrides) 
    private static function get_phase_rules(object $plan, int $phase, ?object $challenge = null): array {
        $pt = 0; $daily_dd = 5; $max_dd = 10; $min_days = 5; $max_days = 30;
        
        // Funded accounts (phase 0 or status 'funded') use funded rules
        if (($challenge && ($challenge->status ?? '') === 'funded') || $phase === 0) {
            $pt = 0;
            $daily_dd = (float)($plan->funded_daily_dd ?? ($plan->p1_daily_dd ?? 5));
            $max_dd = (float)($plan->funded_max_dd ?? 10);
            $min_days = 0;
            $max_days = 0;
        } elseif ($phase === 1) {
            $pt = (float)$plan->p1_profit_target; $daily_dd = (float)$plan->p1_daily_dd; $max_dd = (float)$plan->p1_max_dd; $min_days = (int)$plan->p1_min_days; $max_days = (int)$plan->p1_max_days;
        } elseif ($phase === 2) {
            $pt = (float)$plan->p2_profit_target; $daily_dd = (float)$plan->p2_daily_dd; $max_dd = (float)$plan->p2_max_dd; $min_days = (int)$plan->p2_min_days; $max_days = (int)$plan->p2_max_days;
        } elseif ($phase === 3 && isset($plan->p3_profit_target)) {
            $pt = (float)$plan->p3_profit_target; $daily_dd = (float)$plan->p3_daily_dd; $max_dd = (float)$plan->p3_max_dd; $min_days = (int)$plan->p3_min_days; $max_days = (int)$plan->p3_max_days;
        } else {
            $pt = (float)$plan->p2_profit_target; $daily_dd = (float)$plan->p2_daily_dd; $max_dd = (float)$plan->p2_max_dd; $min_days = (int)$plan->p2_min_days; $max_days = (int)$plan->p2_max_days;
        }

        // Apply account-level enterprise overrides if present
        if ($challenge) {
            if (isset($challenge->custom_daily_dd) && $challenge->custom_daily_dd !== null && (float)$challenge->custom_daily_dd > 0) {
                $daily_dd = (float)$challenge->custom_daily_dd;
            }
            if (isset($challenge->custom_max_dd) && $challenge->custom_max_dd !== null && (float)$challenge->custom_max_dd > 0) {
                $max_dd = (float)$challenge->custom_max_dd;
            }
            if (isset($challenge->custom_min_days) && $challenge->custom_min_days !== null && (int)$challenge->custom_min_days >= 0) {
                $min_days = (int)$challenge->custom_min_days;
            }
        }

        return [$pt, $daily_dd, $max_dd, $min_days, $max_days];
    }

    private static function update_challenge_balance(int $id, float $balance, float $peak): void {
        global $wpdb;
        $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
            'current_balance' => $balance,
            'peak_balance'    => $peak,
        ], ['id' => $id]);
    }

    // ── Notifications (Discord/Telegram/Email hooks) ──────────────────────────
    public static function notify_user(int $user_id, string $event, array $data = []): void {
        // Use the dedicated email class for HTML emails. 'challenge_failed'
        // fires from breach(), a money-safety path — deferred via WP-Cron
        // (send_async, with retry) so a slow SMTP host doesn't add latency
        // to the request that's flipping a trading account to frozen.
        if ($event === 'challenge_failed' && method_exists('FXSIM_Emails', 'send_async')) {
            FXSIM_Emails::send_async($user_id, $event, $data);
        } else {
            FXSIM_Emails::send($user_id, $event, $data);
        }

        // In-app notification bell
        $dash = home_url('/dashboard/');
        $chall = home_url('/challenges/');
        match($event) {
            'phase_passed'      => FXSIM_Database::push_notification($user_id, 'success',
                "🎉 Phase {$data['phase']} Passed!",
                "You've passed Phase {$data['phase']}. Now advancing to Phase {$data['next']}.",
                $dash),
            'challenge_passed'  => FXSIM_Database::push_notification($user_id, 'success',
                '✅ Funded Account Activated!',
                'Congratulations — all phases passed. Your funded account is now active.',
                $dash),
            'challenge_failed'  => FXSIM_Database::push_notification($user_id, 'error',
                '❌ Challenge Failed',
                "Your challenge has ended due to {$data['reason']}. Start a new one anytime.",
                $chall),
            'challenge_purchased' => FXSIM_Database::push_notification($user_id, 'info',
                '🚀 Challenge Started',
                "Your {$data['plan_name']} challenge is live. Good luck!",
                $dash),
            'payment_approved'  => FXSIM_Database::push_notification($user_id, 'success',
                '✅ Payment Approved',
                'Your payment was approved and your challenge account has been activated.',
                $dash),
            'payment_rejected'  => FXSIM_Database::push_notification($user_id, 'warning',
                '⚠ Payment Not Approved',
                'Your payment could not be approved. Please contact support.',
                $chall),
            default             => null,
        };

        // Discord webhook
        $user    = get_userdata($user_id);
        $brand   = FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System');
        $subject = match($event) {
            'phase_passed'     => "Phase {$data['phase']} Passed → {$data['next']}",
            'challenge_passed' => 'Challenge Passed — Funded!',
            'challenge_failed' => 'Challenge Failed',
            default            => $event,
        };

        $webhook = FXSIM_Challenge_DB::get_setting('discord_webhook');
        if ($webhook && $user) {
            wp_remote_post($webhook, [
                'body'    => wp_json_encode(['content' => "**[{$brand}]** {$subject} — {$user->user_login}"]),
                'headers' => ['Content-Type' => 'application/json'],
                'blocking'=> false,
            ]);
        }

        // Telegram
        $bot  = FXSIM_Challenge_DB::get_setting('telegram_bot');
        $chat = FXSIM_Challenge_DB::get_setting('telegram_chat');
        if ($bot && $chat && $user) {
            wp_remote_get("https://api.telegram.org/bot{$bot}/sendMessage?" . http_build_query([
                'chat_id' => $chat,
                'text'    => "[{$brand}] {$subject} — {$user->user_login}",
            ]), ['blocking' => false]);
        }

        do_action('fxsim_challenge_event', $event, $user_id, $data);
    }

    // ── News Engine Check ─────────────────────────────────────────────────────
    public static function check_news_window(string $symbol, int $window_minutes, ?int $user_id = null, ?int $challenge_id = null): ?string {
        $settings = get_option('fxsim_news_guard_settings', []);
        $guard_enabled = $settings['enabled'] ?? true;
        if (!$guard_enabled) {
            return null;
        }

        $mode = $settings['mode'] ?? 'hard_gate';
        $buffer_before = (int)($settings['buffer_before_minutes'] ?? ($window_minutes > 0 ? $window_minutes : 2));
        $buffer_after  = (int)($settings['buffer_after_minutes'] ?? ($window_minutes > 0 ? $window_minutes : 2));

        global $wpdb;
        $now_utc = gmdate('Y-m-d H:i:s');
        
        $currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];
        $matched_currencies = [];
        foreach ($currencies as $c) {
            if (stripos($symbol, $c) !== false) {
                $matched_currencies[] = $c;
            }
        }
        // Indices / commodities mapping
        if (empty($matched_currencies)) {
            if (preg_match('/(US30|US500|NAS100|SPX500|DOW|XAU|XAG|WTI|BRENT)/i', $symbol)) {
                $matched_currencies[] = 'USD';
            } elseif (preg_match('/(GER30|GER40|DAX|FRA40|EU50)/i', $symbol)) {
                $matched_currencies[] = 'EUR';
            } elseif (preg_match('/(UK100|FTSE)/i', $symbol)) {
                $matched_currencies[] = 'GBP';
            } elseif (preg_match('/(JPN225|NIKKEI)/i', $symbol)) {
                $matched_currencies[] = 'JPY';
            }
        }

        if (empty($matched_currencies)) return null;

        $curr_placeholders = implode(',', array_fill(0, count($matched_currencies), '%s'));
        
        // Window check: Event Time is within [NOW - buffer_after] to [NOW + buffer_before]
        $sql = $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_news_events
             WHERE impact IN ('high', 'red')
               AND currency IN ($curr_placeholders)
               AND event_time_utc >= DATE_SUB(%s, INTERVAL %d MINUTE)
               AND event_time_utc <= DATE_ADD(%s, INTERVAL %d MINUTE)
             ORDER BY event_time_utc ASC
             LIMIT 1",
            ...array_merge($matched_currencies, [$now_utc, $buffer_after, $now_utc, $buffer_before])
        );

        $event = $wpdb->get_row($sql);
        if (!$event) return null;

        $event_name = $event->title ?: ($event->event_name ?? 'High Impact Release');
        $curr = $event->currency;

        if ($mode === 'soft_breach') {
            // Soft violation: Log breach audit without rejecting trade ticket
            if ($user_id && $challenge_id) {
                $wpdb->insert($wpdb->prefix . 'fxsim_challenge_breaches', [
                    'challenge_id' => $challenge_id,
                    'user_id'      => $user_id,
                    'rule_type'    => 'news_trading_soft',
                    'rule_value'   => $buffer_before,
                    'actual_value' => 0,
                    'description'  => "Soft Violation: Trade executed on {$symbol} during high-impact news '{$event_name}' ({$curr}) at {$event->event_time_utc} UTC.",
                ]);
            }
            return null; // Allowed with soft flag
        }

        // Hard Gate: Return rejection message
        return "Trading Blocked by Macro News Guard: High impact event '{$event_name}' ({$curr}) is within restriction window (±{$buffer_before}m).";
    }
}
