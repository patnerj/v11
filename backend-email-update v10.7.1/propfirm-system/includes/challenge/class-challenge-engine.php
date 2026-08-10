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

            $wpdb->insert($wpdb->prefix . 'fxsim_challenge_accounts', [
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

            FXSIM_Database::log_transaction(
                $account_id, 'deposit', $start, $start,
                "Instant Funding: {$plan->name} (#{$challenge_id})"
            );

            self::record_snapshot($challenge_id, $start);
            self::notify_user($user_id, 'challenge_passed', ['challenge_id' => $challenge_id]);

            return ['success' => true, 'challenge_id' => $challenge_id, 'plan' => $plan, 'instant' => true];
        }

        // ── Standard evaluation challenge ────────────────────────────────────
        $phase_ends = date('Y-m-d H:i:s', strtotime("+{$plan->p1_max_days} days"));

        $wpdb->insert($wpdb->prefix . 'fxsim_challenge_accounts', [
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

        // Get rules for current phase
        $phase = (int)$challenge->phase;
        [$profit_target, $daily_dd_pct, $max_dd_pct, $min_days, $max_days] = self::get_phase_rules($plan, $phase);

        // ── Drawdown calculation based on type ────────────────────────────────
        $dd_type = $challenge->drawdown_type ?? 'static';
        $current_equity = min($balance, $equity); // Use the lower of balance/equity

        switch ($dd_type) {
            case 'trailing':
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
                // EOD Trailing: floor only updates at end of day (in daily_tasks)
                // Here we just check against the stored floor
                $dd_breach_level = (float)$challenge->trailing_dd_floor;
                break;

            case 'static':
            default:
                // Static: fixed from starting balance
                $dd_breach_level = $start * (1 - $max_dd_pct / 100);
                break;
        }

        // ── Check 1: Max Drawdown ──────────────────────────────────────────────
        if ($current_equity <= $dd_breach_level) {
            $dd_fmt    = number_format($start - $current_equity, 2);
            $start_fmt = number_format($start, 2);
            $type_label = $dd_type === 'static' ? 'Static' : ($dd_type === 'trailing' ? 'Trailing' : 'EOD Trailing');
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

        // ── Check 3: Consistency rule ──────────────────────────────────────────
        if ((int)$plan->consistency_rule) {
            $pct = (float)$plan->consistency_pct;
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
                if ($best_day_pct > $pct) {
                    $bp_fmt = number_format($best_day_pct, 1);
                    self::breach($challenge_id, (int)$challenge->user_id, 'consistency',
                        $pct, $best_day_pct,
                        "Consistency rule violated: best single day ({$bp_fmt}%) exceeds {$pct}% of total profit.");
                    return;
                }
            }
        }

        // ── Check 4: Profit target reached → promote (only for evaluation phases) ──
        if ($challenge->status === 'active' && $phase >= 1) {
            $profit_needed = $start * ($profit_target / 100);
            $current_profit = $balance - $start;
            if ($current_profit >= $profit_needed) {
                $trading_days = (int)$challenge->trading_days;
                if ($trading_days >= $min_days) {
                    self::promote($challenge_id, $challenge, $plan);
                }
            }
        }
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
            [$pt, $dd, $max_dd_pct, $min_d, $max_d] = self::get_phase_rules($plan, $phase);

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

            // Check time limit exceeded (only for evaluation phases)
            if ($ch->status === 'active' && $ch->phase_ends_at && strtotime($ch->phase_ends_at) < time()) {
                $profit = $balance - (float)$ch->starting_balance;
                $profit_needed = (float)$ch->starting_balance * ($pt / 100);
                if ($profit < $profit_needed) {
                    self::breach((int)$ch->id, (int)$ch->user_id, 'time_limit',
                        $max_d, 0,
                        "Phase {$ch->phase} time limit of {$max_d} days exceeded without reaching profit target.");
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
        $total_phases  = (int)$plan->phases;
        $user_id       = (int)$challenge->user_id;
        $dd_type       = $challenge->drawdown_type ?? 'static';

        if ($current_phase < $total_phases) {
            // ── Advance to next phase ────────────────────────────────────────
            $next_phase = $current_phase + 1;
            $start      = (float)$challenge->starting_balance;

            // Get max_days for next phase dynamically
            [$next_pt, $next_dd, $next_mdd, $next_min, $next_max] = self::get_phase_rules($plan, $next_phase);
            $phase_end = date('Y-m-d H:i:s', strtotime("+{$next_max} days"));

            // Calculate new DD floor for next phase
            $current_balance = (float)$challenge->current_balance;
            $new_dd_floor = ($dd_type === 'static')
                ? $start * (1 - $next_mdd / 100)
                : $current_balance * (1 - $next_mdd / 100);

            $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
                'phase'               => $next_phase,
                'status'              => 'active',
                'starting_balance'    => $start,
                'peak_balance'        => max((float)$challenge->peak_balance, $current_balance),
                'daily_start_balance' => $current_balance,
                'equity_hwm'          => $current_balance,
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
                if ($u) {
                    FXSIM_Webhooks::notify_funded($u->display_name ?: $u->user_login, (float)$challenge->starting_balance);
                }
            }
        }
    }

    // ── Breach ────────────────────────────────────────────────────────────────
    private static function breach(int $challenge_id, int $user_id, string $rule, $limit, $actual, string $description): void {
        global $wpdb;

        // Lock the challenge account
        $wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
            'status'       => 'failed',
            'breach_reason'=> $description,
            'breach_at'    => current_time('mysql'),
            'failed_at'    => current_time('mysql'),
        ], ['id' => $challenge_id]);

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

        // Close all open positions
        self::force_close_all_positions($challenge_id, $user_id);

        // Notify
        self::notify_user($user_id, 'challenge_failed', [
            'reason' => $description,
            'rule'   => $rule,
        ]);
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
            FXSIM_Trading_Engine::close_position($user_id, (int)$pos->id, 'breach');
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
        [$pt, $daily_dd, $max_dd, $min_d, $max_d] = self::get_phase_rules($plan, $phase);

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
        $current_max_dd     = $start - min($balance, $equity);
        $current_daily_loss = max(0, $daily_start - min($balance, $equity));

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
            'dd_remaining'      => round($max_dd_val - $current_max_dd, 2),
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

    // ── Phase rule helper (supports phases 1, 2, 3 + funded) ─────────────────
    private static function get_phase_rules(object $plan, int $phase): array {
        if ($phase === 1) return [(float)$plan->p1_profit_target, (float)$plan->p1_daily_dd, (float)$plan->p1_max_dd, (int)$plan->p1_min_days, (int)$plan->p1_max_days];
        if ($phase === 2) return [(float)$plan->p2_profit_target, (float)$plan->p2_daily_dd, (float)$plan->p2_max_dd, (int)$plan->p2_min_days, (int)$plan->p2_max_days];
        if ($phase === 3 && isset($plan->p3_profit_target)) return [(float)$plan->p3_profit_target, (float)$plan->p3_daily_dd, (float)$plan->p3_max_dd, (int)$plan->p3_min_days, (int)$plan->p3_max_days];
        // Phase 0 = instant funded, use funded rules
        if ($phase === 0) return [0, (float)($plan->p1_daily_dd ?? 5), (float)($plan->funded_max_dd ?? 10), 0, 0];
        // Fallback to last defined phase
        return [(float)$plan->p2_profit_target, (float)$plan->p2_daily_dd, (float)$plan->p2_max_dd, (int)$plan->p2_min_days, (int)$plan->p2_max_days];
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
        // Use the dedicated email class for HTML emails
        FXSIM_Emails::send($user_id, $event, $data);

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
}
