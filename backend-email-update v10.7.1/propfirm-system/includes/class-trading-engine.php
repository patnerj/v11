<?php
defined('ABSPATH') || exit;

class FXSIM_Trading_Engine {

    // ── Market hours check ────────────────────────────────────────────────────
    // Crypto (BTCUSD, ETHUSD) is 24/7. Forex/Metals: closed Sat–Sun UTC.
    public static function is_market_open(string $symbol): bool {
        if (defined('FXSIM_BYPASS_MARKET_HOURS') && FXSIM_BYPASS_MARKET_HOURS) return true;

        $crypto = ['BTCUSD', 'ETHUSD'];
        if (in_array($symbol, $crypto)) return true;

        $dow = (int) gmdate('N'); // 1=Mon … 7=Sun
        $h   = (int) gmdate('H');
        $m   = (int) gmdate('i');
        $now = $h * 60 + $m; // minutes since midnight UTC

        // Forex market: Opens Sunday 22:00 UTC, Closes Friday 22:00 UTC
        if ($dow === 6) return false; // Saturday closed all day
        if ($dow === 7 && $now < 22 * 60) return false; // Sunday closed before 22:00 UTC
        if ($dow === 5 && $now >= 22 * 60) return false; // Friday after 22:00 UTC

        return true;
    }

    // ── Open a market order ───────────────────────────────────────────────────
    public static function open_position(int $user_id, array $args, int $explicit_account_id = 0): array {
        global $wpdb;

        // ── Defense-in-depth: Firm-wide emergency trading pause & feed guard ───────
        if (class_exists('FXSIM_Challenge_DB') && FXSIM_Challenge_DB::get_setting('pause_trading', '') === '1') {
            return self::err('Trading is temporarily halted by the platform operator.');
        }
        if (class_exists('FXSIM_Price_Feed')) {
            $feed_guard = FXSIM_Price_Feed::feed_guard_for_trading();
            if (!empty($feed_guard) && empty($feed_guard['ok'])) {
                return self::err($feed_guard['message'] ?? 'Trading is temporarily paused due to price feed status.');
            }
        }

        // ── Defense-in-depth: Reject trade if a payout is pending review on this account ──
        if ($explicit_account_id > 0) {
            $pending_payout = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT p.id FROM {$wpdb->prefix}fxsim_payouts p
                 JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.id = p.challenge_id
                 WHERE ca.fxsim_account_id = %d AND p.status IN ('pending', 'under_review', 'approved') LIMIT 1",
                $explicit_account_id
            ));
            if ($pending_payout > 0) {
                return self::err('Trading is temporarily locked while a payout request is pending review.');
            }
        }

        if ($explicit_account_id > 0) {
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
                 FROM {$wpdb->prefix}fxsim_accounts a
                 LEFT JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
                 WHERE a.id = %d AND a.user_id = %d LIMIT 1",
                $explicit_account_id, $user_id
            ));
            if (!$account) return self::err('Specified trading account not found.');
        } else {
            // Use active challenge account, not generic user account
            $account = self::get_user_active_account($user_id);
            if (!$account) return self::err('No active challenge account. Purchase a challenge to start trading.');
        }

        // Security gate: Block new orders if a payout is pending or under review
        if (!empty($account->id)) {
            $pending_payout = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payouts p
                 JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON p.challenge_id = ca.id
                 WHERE ca.fxsim_account_id = %d AND p.status IN ('pending', 'under_review', 'approved')",
                (int) $account->id
            ));
            if ($pending_payout > 0) {
                return self::err('Trading is temporarily locked while a payout request is pending review.');
            }
        }
        if ($account->status !== 'active') return self::err('Account is ' . $account->status . '.');

        // ── Pre-trade drawdown gate: once equity is at/through the max-DD floor or
        // the daily loss limit is consumed, block NEW risk (floating-loss protection) ──
        if (class_exists('FXSIM_Challenge_Engine') && !empty($account->challenge_id)) {
            $dd_err = FXSIM_Challenge_Engine::pretrade_dd_guard((int)$account->challenge_id);
            if ($dd_err) return self::err($dd_err);
        }

        $sym_obj = FXSIM_Symbols::get($args['symbol']);
        if (!$sym_obj) return self::err('Symbol not found or disabled.');

        // Market hours check
        if (!self::is_market_open($args['symbol'])) {
            return self::err("Market is closed. {$args['symbol']} does not trade on weekends. Market reopens Monday 00:00 UTC.");
        }

        // ── Plan & Tournament risk rules: fetches news_trading + lot/leverage caps ──
        // Deliberately placed before lot validation so plan/tournament limits are checked
        // even when symbol limits would pass.
        $plan_rules = self::get_account_risk_rules($account);

        // News lock: global admin toggle + plan must restrict news trading
        // news_trading=0 (or custom_news_trading=0) means news trading is restricted on this plan
        $is_news_restricted = ($plan_rules && $plan_rules->custom_news_trading !== null)
            ? !(int)$plan_rules->custom_news_trading
            : ($plan_rules && !(int)$plan_rules->news_trading);

        if ($is_news_restricted) {
            if (get_option('fxsim_news_lock', false)) {
                return self::err('⚠️ News lock active. Trading paused during high-impact news events. Please wait for the lock to be lifted.');
            }
            if (class_exists('FXSIM_Challenge_Engine')) {
                $news_err = FXSIM_Challenge_Engine::check_news_window(
                    $args['symbol'],
                    (int)($plan_rules->news_window_minutes ?? 5),
                    (int)$account->user_id,
                    (int)($plan_rules->challenge_id ?? 0)
                );
                if ($news_err) {
                    return self::err("⚠️ " . $news_err);
                }
            }
        }

        $lot = (float) ($args['lot_size'] ?? ($args['lots'] ?? 0.01));

        // Symbol-level bounds (hard exchange minimum/maximum — always applied)
        if ($lot < $sym_obj->min_lot || $lot > $sym_obj->max_lot) {
            return self::err("Lot size must be between {$sym_obj->min_lot} and {$sym_obj->max_lot} for {$sym_obj->symbol}.");
        }

        // Plan-level lot cap (prop firm rule — may be stricter than symbol limit)
        // A $10K challenge plan may allow max 0.5 lots even if the symbol allows 50
        if ($plan_rules && (float)$plan_rules->max_lot_size > 0 && $lot > (float)$plan_rules->max_lot_size) {
            return self::err(
                "Lot size {$lot} exceeds your challenge plan limit of {$plan_rules->max_lot_size} lots. " .
                "Reduce your position size to comply with the challenge rules."
            );
        }

        // Effective leverage: use the stricter of account-level and plan-level caps
        $effective_leverage = $account->leverage;
        if ($plan_rules && (int)$plan_rules->max_leverage > 0) {
            $effective_leverage = min((int)$account->leverage, (int)$plan_rules->max_leverage);
        }

        $type = sanitize_text_field($args['type']); // buy | sell
        if (!in_array($type, ['buy','sell'])) return self::err('Invalid order type.');

        $prices  = FXSIM_Price_Feed::get($args['symbol']);
        $open_px = ($type === 'buy') ? $prices['ask'] : $prices['bid'];
        if ($open_px <= 0) return self::err('Price feed unavailable. Try again.');

        // Apply slippage simulation if enabled
        $slippage_enabled = FXSIM_Challenge_DB::get_setting('slippage_enabled', '0') === '1';
        if ($slippage_enabled) {
            $max_slippage_pips = (float)FXSIM_Challenge_DB::get_setting('slippage_max_pips', '1.5');
            // Determine pip size based on symbol (JPY pairs = 0.01, others = 0.0001, metals = 0.01, crypto = 0.01)
            $pip_size = self::get_pip_size($args['symbol']);
            // Random slippage between 0 and max (slippage always against the trader)
            $slippage_amount = (mt_rand(0, (int)($max_slippage_pips * 10)) / 10) * $pip_size;
            $open_px = ($type === 'buy')
                ? $open_px + $slippage_amount
                : $open_px - $slippage_amount;
        }

        // Validate SL/TP
        $sl = isset($args['sl']) && $args['sl'] !== '' ? (float) $args['sl'] : null;
        $tp = isset($args['tp']) && $args['tp'] !== '' ? (float) $args['tp'] : null;

        if ($plan_rules && !empty($plan_rules->stop_loss_required) && $sl === null) {
            return self::err('A Stop Loss is required by your challenge plan. Please specify a Stop Loss price.');
        }

        if ($sl !== null) {
            if ($type === 'buy'  && $sl >= $open_px) return self::err('SL must be below entry price for BUY.');
            if ($type === 'sell' && $sl <= $open_px) return self::err('SL must be above entry price for SELL.');
        }
        if ($tp !== null) {
            if ($type === 'buy'  && $tp <= $open_px) return self::err('TP must be above entry price for BUY.');
            if ($type === 'sell' && $tp >= $open_px) return self::err('TP must be below entry price for SELL.');
        }

        // Margin calculation using helper
        // effective_leverage is the stricter of account leverage and plan cap
        $margin     = self::calc_margin_usd($args['symbol'], $lot, (float)$sym_obj->contract_size, $open_px, $effective_leverage);
        $commission = $lot * $sym_obj->commission;
        $req_total  = (float) $margin + (float) $commission;

        // Quick pre-flight check (will be strictly validated atomically under row-lock below)
        $free_margin = (float)$account->equity - (float)$account->margin_used;
        if ($req_total > $free_margin) {
            return self::err("Insufficient margin. Required: $" . number_format($req_total, 2) . ", Available: $" . number_format($free_margin, 2));
        }

        $wpdb->query('START TRANSACTION');
        try {
            // ATOMIC CLAIM (H3c Fix): Conditionally deduct commission and reserve margin
            // in a single statement. Under MySQL InnoDB row-level lock, this eliminates
            // stale-read margin over-commit and lost-update races across concurrent open orders.
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts 
                 SET balance = balance - %f, 
                     equity = equity - %f, 
                     margin_used = margin_used + %f 
                 WHERE id = %d AND (equity - margin_used) >= %f",
                (float) $commission, (float) $commission, (float) $margin, (int) $account->id, (float) $req_total
            ));

            if ($claimed !== 1) {
                $wpdb->query('ROLLBACK');
                return self::err('Insufficient free margin or account updated concurrently. Please retry.');
            }

            // Insert position
            $res = $wpdb->insert($wpdb->prefix . 'fxsim_positions', [
                'account_id'    => $account->id,
                'symbol'        => $args['symbol'],
                'type'          => $type,
                'lot_size'      => $lot,
                'open_price'    => $open_px,
                'current_price' => $open_px,
                'sl'            => $sl,
                'tp'            => $tp,
                'margin'        => $margin,
                'commission'    => $commission,
                'pnl'           => -$commission,
            ]);
            if (!$res) throw new \Exception('Failed to insert position.');

            $pos_id = (int) $wpdb->insert_id;
            $new_bal = (float) $wpdb->get_var($wpdb->prepare(
                "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d",
                $account->id
            ));

            FXSIM_Database::log_transaction($account->id, 'commission', -$commission, $new_bal, "Commission: {$args['symbol']} #{$pos_id}");

            $wpdb->query('COMMIT');

            // Fire hook so challenge engine can count trading days
            do_action('fxsim_trade_opened', $account->id);

            // ── HFT / Copy Trade Detection ──────────────────────────────────────
            self::detect_trade_patterns($user_id, (int)$account->id);

            return ['success' => true, 'position_id' => $pos_id, 'open_price' => $open_px, 'margin' => $margin, 'commission' => $commission];

        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            return self::err('Transaction failed: ' . $e->getMessage());
        }
    }

    // ── Close a position ──────────────────────────────────────────────────────
    public static function close_position(int $user_id, int $pos_id, string $reason = 'manual', bool $force = false, int $explicit_account_id = 0): array {
        global $wpdb;

        $pos = $wpdb->get_row($wpdb->prepare(
            "SELECT p.*, a.user_id 
             FROM {$wpdb->prefix}fxsim_positions p
             JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
             WHERE p.id = %d AND a.user_id = %d",
            $pos_id, $user_id
        ));
        if (!$pos) return self::err('Position not found.');

        if ($explicit_account_id > 0) {
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
                 FROM {$wpdb->prefix}fxsim_accounts a
                 LEFT JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
                 WHERE a.id = %d AND a.user_id = %d LIMIT 1",
                $explicit_account_id, $user_id
            ));
        } else {
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
                 FROM {$wpdb->prefix}fxsim_accounts a
                 LEFT JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
                 WHERE a.id = %d AND a.user_id = %d LIMIT 1",
                $pos->account_id, $user_id
            ));
        }
        if (!$account) return self::err('No active account.');

        $prices    = FXSIM_Price_Feed::get($pos->symbol);
        $close_px  = ($pos->type === 'buy') ? $prices['bid'] : $prices['ask'];
        if ($close_px <= 0) $close_px = (float) $pos->current_price;

        $pnl = self::calc_pnl($pos, $close_px);

        // Toxic Trade Check (Tick Scalping/HFT) & News Check
        $is_toxic = 0;
        if (class_exists('FXSIM_Challenge_DB')) {
            $plan = FXSIM_Challenge_DB::get_plan((int) $account->plan_id);
            if ($plan) {
                if (isset($plan->min_trade_seconds) && $plan->min_trade_seconds > 0) {
                    $opened_time = strtotime($pos->opened_at);
                    $held_seconds = time() - $opened_time;
                    if ($held_seconds < $plan->min_trade_seconds) {
                        $action = $plan->min_hold_action ?? 'flag';

                        // A "reject" min-hold policy must only ever block a
                        // genuinely voluntary trader-initiated close. Every
                        // system-forced protective close (SL/TP, weekend
                        // liquidation, breach cleanup — anything calling with
                        // $force=true) has to be allowed to complete, or a
                        // young losing position could be trapped open past
                        // its own stop loss with no way for the trader to
                        // exit either. Still flag it below either way.
                        if ($action === 'reject' && !$force) {
                            $rem = $plan->min_trade_seconds - $held_seconds;
                            return self::err("Minimum hold time not met. Please wait {$rem} more seconds before closing.");
                        }

                        if ($action === 'void_pnl') {
                            $is_toxic = 1;
                            if ($pnl > 0) {
                                $pnl = 0.0;
                            }
                        }

                        // Always flag the violation for the record — including
                        // when $force overrode a 'reject' policy, which used to
                        // skip this insert entirely since it assumed 'reject'
                        // always returned early above.
                        {
                            global $wpdb;
                            $wpdb->insert($wpdb->prefix . 'fxsim_trade_flags', [
                                'user_id'    => $user_id,
                                'account_id' => $account->id,
                                'flag_type'  => 'hft',
                                'details'    => "Min hold breach ({$action}" . ($force ? ', forced' : '') . "): {$pos->symbol} held for {$held_seconds}s (min {$plan->min_trade_seconds}s).",
                                'flagged_at' => gmdate('Y-m-d H:i:s')
                            ]);
                        }
                    }
                }

                // News Window Exploit Check on Close
                if (isset($plan->news_trading) && !(int)$plan->news_trading && class_exists('FXSIM_Challenge_Engine')) {
                    $news_err = FXSIM_Challenge_Engine::check_news_window($pos->symbol, (int)($plan->news_window_minutes ?? 5));
                    if ($news_err) {
                        // Flag as news_exploit but don't reject
                        $wpdb->insert($wpdb->prefix . 'fxsim_trade_flags', [
                            'user_id'    => $user_id,
                            'account_id' => $account->id,
                            'flag_type'  => 'news_exploit',
                            'details'    => "Position #{$pos_id} closed during news restriction window. " . $news_err,
                            'flagged_at' => gmdate('Y-m-d H:i:s')
                        ]);
                    }
                }
            }
        }

        $wpdb->query('START TRANSACTION');
        try {
            // 1. ATOMIC ROW LOCK: Lock position row with FOR UPDATE to prevent concurrent partial/full close races.
            $pos_locked = $wpdb->get_row($wpdb->prepare(
                "SELECT p.*, a.user_id 
                 FROM {$wpdb->prefix}fxsim_positions p
                 JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
                 WHERE p.id = %d AND a.user_id = %d FOR UPDATE",
                $pos_id, $user_id
            ));
            if (!$pos_locked) {
                $wpdb->query('ROLLBACK');
                return self::err('Position already closed or concurrently processed.');
            }
            // Adopt locked position state in case a concurrent partial_close modified lot_size/margin
            $pos = $pos_locked;
            $pnl = self::calc_pnl($pos, $close_px);

            // Anti-scalping void_pnl enforcement: if trade held < min_trade_seconds and action is void_pnl,
            // force $pnl = 0.0 and ensure $credit_amount = 0.0 so no scalping profits are credited to account balance.
            if ($is_toxic === 1 && $pnl > 0) {
                $pnl = 0.0;
                $credit_amount = 0.0;
            } else {
                // calc_pnl() subtracts $pos->commission (correct for informational PnL),
                // but commission was already deducted at open. Adding $pnl + commission ensures
                // round-trip commission is charged exactly once.
                $credit_amount = (float) $pnl + (float) $pos->commission;
            }

            // ATOMIC CLAIM: Delete open position immediately.
            // If 0 rows affected, another concurrent process (manual, SL/TP, margin stop-out) already closed it!
            $deleted = $wpdb->query($wpdb->prepare(
                "DELETE FROM {$wpdb->prefix}fxsim_positions WHERE id = %d",
                $pos_id
            ));
            if ($deleted !== 1) {
                $wpdb->query('ROLLBACK');
                return self::err('Position already closed or concurrently processed.');
            }

            // 2. Log closed position to trade history
            $wpdb->insert($wpdb->prefix . 'fxsim_trades', [
                'account_id'   => $pos->account_id,
                'symbol'       => $pos->symbol,
                'type'         => $pos->type,
                'lot_size'     => $pos->lot_size,
                'open_price'   => $pos->open_price,
                'close_price'  => $close_px,
                'sl'           => $pos->sl,
                'tp'           => $pos->tp,
                'margin'       => $pos->margin,
                'commission'   => $pos->commission,
                'swap'         => $pos->swap,
                'pnl'          => $pnl,
                'close_reason' => $reason,
                'opened_at'    => $pos->opened_at,
                'is_toxic'     => $is_toxic,
            ]);

            // 3. ATOMIC DELTA UPDATE on account balance & margin
            $released_margin = (float) $pos->margin;

            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts 
                 SET balance = balance + %f, 
                     equity = equity + %f, 
                     margin_used = GREATEST(0, margin_used - %f) 
                 WHERE id = %d",
                $credit_amount, $credit_amount, $released_margin, $account->id
            ));

            $new_bal = (float) $wpdb->get_var($wpdb->prepare(
                "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d",
                $account->id
            ));

            FXSIM_Database::log_transaction($account->id, 'pnl', $pnl, $new_bal, "Close {$pos->type} {$pos->symbol} #{$pos_id} ({$reason})");

            $wpdb->query('COMMIT');

            // Fire hook for challenge engine evaluation
            do_action('fxsim_trade_closed', $account->id);

            // Sync tournament participant metrics if this was a tournament account
            $tp = $wpdb->get_row($wpdb->prepare(
                "SELECT id, starting_equity FROM {$wpdb->prefix}fxsim_tournament_participants WHERE account_id = %d LIMIT 1",
                $account->id
            ));
            if ($tp) {
                $starting_eq = (float)$tp->starting_equity > 0 ? (float)$tp->starting_equity : 10000.0;
                $roi = (($new_bal - $starting_eq) / $starting_eq) * 100.0;
                $wpdb->update("{$wpdb->prefix}fxsim_tournament_participants", [
                    'current_equity' => $new_bal,
                    'roi_pct'        => round($roi, 2)
                ], ['id' => $tp->id]);
            }

            return ['success' => true, 'pnl' => $pnl, 'close_price' => $close_px];

        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            return self::err('Close failed: ' . $e->getMessage());
        }
    }

    // ── Partial close ─────────────────────────────────────────────────────────
    public static function partial_close(int $user_id, int $pos_id, float $close_lots): array {
        global $wpdb;

        $pos = $wpdb->get_row($wpdb->prepare(
            "SELECT p.*, a.user_id 
             FROM {$wpdb->prefix}fxsim_positions p
             JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
             WHERE p.id = %d AND a.user_id = %d",
            $pos_id, $user_id
        ));
        if (!$pos) return self::err('Position not found.');

        $account = $wpdb->get_row($wpdb->prepare(
            "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
             FROM {$wpdb->prefix}fxsim_accounts a
             LEFT JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE a.id = %d AND a.user_id = %d LIMIT 1",
            $pos->account_id, $user_id
        ));
        if (!$account) return self::err('No active account.');

        $sym_obj = FXSIM_Symbols::get($pos->symbol);
        if (!$sym_obj) return self::err('Symbol not found.');

        $orig_lots  = (float)$pos->lot_size;
        $close_lots = round(min($close_lots, $orig_lots), 2);
        if ($close_lots < $sym_obj->min_lot) return self::err("Minimum close size: {$sym_obj->min_lot} lots.");

        // If closing full position, use normal close
        if ($close_lots >= $orig_lots) return self::close_position($user_id, $pos_id, 'partial_full');

        $prices    = FXSIM_Price_Feed::get($pos->symbol);
        $close_px  = ($pos->type === 'buy') ? $prices['bid'] : $prices['ask'];
        if ($close_px <= 0) $close_px = (float)$pos->current_price;

        // Calculate PnL for partial portion
        $partial_ratio = $close_lots / $orig_lots;
        $partial_pos   = clone $pos;
        $partial_pos->lot_size   = $close_lots;
        $partial_pos->margin     = (float)$pos->margin    * $partial_ratio;
        $partial_pos->commission = (float)$pos->commission * $partial_ratio;
        $partial_pos->swap       = (float)$pos->swap      * $partial_ratio;
        $pnl = self::calc_pnl($partial_pos, $close_px);

        // Toxic Trade Check (Tick Scalping/HFT)
        $is_toxic = 0;
        if (class_exists('FXSIM_Challenge_DB')) {
            $plan = FXSIM_Challenge_DB::get_plan((int) $account->plan_id);
            if ($plan && isset($plan->min_trade_seconds) && $plan->min_trade_seconds > 0) {
                $opened_time = strtotime($pos->opened_at);
                $held_seconds = time() - $opened_time;
                if ($held_seconds < $plan->min_trade_seconds) {
                    $action = $plan->min_hold_action ?? 'flag';
                    
                    if ($action === 'reject') {
                        $rem = $plan->min_trade_seconds - $held_seconds;
                        return self::err("Minimum hold time not met. Please wait {$rem} more seconds before closing.");
                    }
                    
                    if ($action === 'void_pnl') {
                        $is_toxic = 1;
                        if ($pnl > 0) {
                            $pnl = 0.0;
                        }
                    }

                    if ($action !== 'reject') {
                        global $wpdb;
                        $wpdb->insert($wpdb->prefix . 'fxsim_trade_flags', [
                            'user_id'    => $user_id,
                            'account_id' => $account->id,
                            'flag_type'  => 'hft',
                            'details'    => "Min hold breach partial ({$action}): {$pos->symbol} held for {$held_seconds}s (min {$plan->min_trade_seconds}s).",
                            'flagged_at' => gmdate('Y-m-d H:i:s')
                        ]);
                    }
                }
            }
        }

        $wpdb->query('START TRANSACTION');
        try {
            // ATOMIC ROW LOCK: Lock position row under transaction to synchronize with close_position
            $pos_locked = $wpdb->get_row($wpdb->prepare(
                "SELECT p.*, a.user_id 
                 FROM {$wpdb->prefix}fxsim_positions p
                 JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
                 WHERE p.id = %d AND a.user_id = %d FOR UPDATE",
                $pos_id, $user_id
            ));
            if (!$pos_locked || (float)$pos_locked->lot_size < $close_lots) {
                $wpdb->query('ROLLBACK');
                return self::err('Insufficient position lots or position already closed concurrently.');
            }
            $orig_lots = (float)$pos_locked->lot_size;
            $pos = $pos_locked;

            // Recalculate partial ratio and metrics based on locked state
            $current_lots  = $orig_lots;
            $partial_ratio = ($current_lots > 0) ? ($close_lots / $current_lots) : 1.0;
            $partial_pos   = clone $pos;
            $partial_pos->lot_size   = $close_lots;
            $partial_pos->margin     = (float)$pos->margin     * $partial_ratio;
            $partial_pos->commission = (float)$pos->commission * $partial_ratio;
            $partial_pos->swap       = (float)$pos->swap       * $partial_ratio;
            $pnl = self::calc_pnl($partial_pos, $close_px);

            // Anti-scalping void_pnl enforcement: if trade held < min_trade_seconds and action is void_pnl,
            // force $pnl = 0.0 and ensure $credit_amount = 0.0 so no scalping profits are credited to account balance.
            if ($is_toxic === 1 && $pnl > 0) {
                $pnl = 0.0;
                $credit_amount = 0.0;
            } else {
                $credit_amount = (float) $pnl + (float) $partial_pos->commission;
            }

            // 1. ATOMIC CLAIM: Reduce original position size only if current lot_size >= close_lots
            $remain_lots   = round($orig_lots - $close_lots, 2);
            $remain_margin = (float)$pos->margin * (1 - $partial_ratio);
            if ($remain_lots <= 0.00001) {
                $deleted = $wpdb->query($wpdb->prepare(
                    "DELETE FROM {$wpdb->prefix}fxsim_positions WHERE id = %d",
                    $pos_id
                ));
                if ($deleted !== 1) {
                    $wpdb->query('ROLLBACK');
                    return self::err('Position already modified or closed concurrently.');
                }
                $remain_lots = 0.0;
            } else {
                $updated = $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->prefix}fxsim_positions 
                     SET lot_size = lot_size - %f, 
                         margin = margin - %f, 
                         commission = commission * (1 - %f), 
                         swap = swap * (1 - %f) 
                     WHERE id = %d AND lot_size >= %f",
                    $close_lots, (float)$partial_pos->margin, $partial_ratio, $partial_ratio, $pos_id, $close_lots
                ));
                if ($updated !== 1) {
                    $wpdb->query('ROLLBACK');
                    return self::err('Position already modified or closed concurrently.');
                }
            }

            // 2. Log the partial close as a trade
            $wpdb->insert($wpdb->prefix . 'fxsim_trades', [
                'account_id'   => $account->id,
                'symbol'       => $pos->symbol,
                'type'         => $pos->type,
                'lot_size'     => $close_lots,
                'open_price'   => $pos->open_price,
                'close_price'  => $close_px,
                'sl'           => $pos->sl,
                'tp'           => $pos->tp,
                'margin'       => $partial_pos->margin,
                'commission'   => $partial_pos->commission,
                'swap'         => $partial_pos->swap,
                'pnl'          => $pnl,
                'close_reason' => 'partial',
                'opened_at'    => $pos->opened_at,
                'is_toxic'     => $is_toxic,
            ]);

            // 3. ATOMIC DELTA UPDATE on account balance & margin
            $released_margin = (float) $partial_pos->margin;

            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts 
                 SET balance = balance + %f, 
                     equity = equity + %f, 
                     margin_used = GREATEST(0, margin_used - %f) 
                 WHERE id = %d",
                $credit_amount, $credit_amount, $released_margin, $account->id
            ));

            $new_bal = (float) $wpdb->get_var($wpdb->prepare(
                "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d",
                $account->id
            ));

            FXSIM_Database::log_transaction($account->id, 'pnl', $pnl, $new_bal,
                "Partial close {$close_lots}L {$pos->type} {$pos->symbol} #{$pos_id}");

            $wpdb->query('COMMIT');
            do_action('fxsim_trade_closed', $account->id);
            return ['success' => true, 'pnl' => $pnl, 'close_price' => $close_px, 'remaining_lots' => $remain_lots];
        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            return self::err('Partial close failed: ' . $e->getMessage());
        }
    }
    public static function update_sltp(int $user_id, int $pos_id, ?float $sl, ?float $tp): array {
        global $wpdb;

        $pos = $wpdb->get_row($wpdb->prepare(
            "SELECT p.*, a.user_id 
             FROM {$wpdb->prefix}fxsim_positions p
             JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
             WHERE p.id = %d AND a.user_id = %d",
            $pos_id, $user_id
        ));
        if (!$pos) return self::err('Position not found.');

        $account = $wpdb->get_row($wpdb->prepare(
            "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
             FROM {$wpdb->prefix}fxsim_accounts a
             LEFT JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE a.id = %d AND a.user_id = %d LIMIT 1",
            $pos->account_id, $user_id
        ));
        if (!$account) return self::err('No active account.');

        $price = FXSIM_Price_Feed::get($pos->symbol);
        $cur   = (float) $pos->current_price ?: (($pos->type==='buy') ? $price['bid'] : $price['ask']);

        // Prevent SL removal if the plan requires it
        if ($sl === null) {
            $plan_rules = $wpdb->get_row($wpdb->prepare(
                "SELECT cp.stop_loss_required
                 FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                 JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
                 WHERE ca.fxsim_account_id = %d AND ca.status IN ('active','funded') LIMIT 1",
                $account->id
            ));
            if ($plan_rules && !empty($plan_rules->stop_loss_required)) {
                return self::err('A Stop Loss is required by your challenge plan. You cannot remove the Stop Loss.');
            }
        }

        if ($sl !== null) {
            if ($pos->type === 'buy'  && $sl >= $cur) return self::err('SL must be below current price for BUY.');
            if ($pos->type === 'sell' && $sl <= $cur) return self::err('SL must be above current price for SELL.');
        }
        if ($tp !== null) {
            if ($pos->type === 'buy'  && $tp <= $cur) return self::err('TP must be above current price for BUY.');
            if ($pos->type === 'sell' && $tp >= $cur) return self::err('TP must be below current price for SELL.');
        }

        $wpdb->update($wpdb->prefix . 'fxsim_positions', ['sl' => $sl, 'tp' => $tp], ['id' => $pos_id]);
        return ['success' => true];
    }

    // ── Refresh PnL for all open positions ────────────────────────────────────
    public static function refresh_positions(int $account_id): array {
        global $wpdb;
        $positions = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_positions WHERE account_id=%d",
            $account_id
        ));

        if (empty($positions)) {
            // No open positions — equity = balance. margin_used must still carry
            // any PENDING-order margin reservations (placed orders increment
            // margin_used; wiping it here would silently release their margin).
            $pending_margin = (float) $wpdb->get_var($wpdb->prepare(
                "SELECT COALESCE(SUM(margin),0) FROM {$wpdb->prefix}fxsim_pending_orders
                 WHERE account_id = %d AND status = 'pending'",
                $account_id
            ));
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts
                 SET equity = balance, margin_used = %f
                 WHERE id = %d",
                $pending_margin, $account_id
            ));
            return [];
        }

        // ── Batch PnL calculation ─────────────────────────────────────────────
        // Collect all unique symbols across open positions to avoid redundant
        // price lookups: N positions × same symbol → 1 lookup per symbol.
        $prices_by_symbol = [];
        foreach ($positions as $pos) {
            if (!isset($prices_by_symbol[$pos->symbol])) {
                $prices_by_symbol[$pos->symbol] = FXSIM_Price_Feed::get($pos->symbol);
            }
        }

        $total_pnl    = 0.0;
        $total_margin = 0.0;

        // Accumulate CASE branches for a single batch UPDATE
        // instead of one UPDATE per position (was O(N) queries, now O(1))
        $id_list       = [];
        $price_cases   = [];  // current_price CASE
        $pnl_cases     = [];  // pnl CASE

        foreach ($positions as &$pos) {
            $p      = $prices_by_symbol[$pos->symbol];
            $cur_px = ($pos->type === 'buy') ? (float)$p['bid'] : (float)$p['ask'];
            if ($cur_px <= 0) $cur_px = (float)$pos->current_price;

            $pnl = self::calc_pnl($pos, $cur_px);

            $pos->current_price = $cur_px;
            $pos->pnl           = $pnl;
            // calc_pnl() subtracts commission, but commission was already deducted from balance at open.
            // Adding back $pos->commission prevents commission from being double-deducted against account equity.
            $total_pnl         += $pnl + (float)$pos->commission;
            $total_margin      += (float)$pos->margin;

            $id_list[]     = (int)$pos->id;
            $price_cases[] = $wpdb->prepare("WHEN id = %d THEN %f", $pos->id, $cur_px);
            $pnl_cases[]   = $wpdb->prepare("WHEN id = %d THEN %f", $pos->id, $pnl);
        }

        // Single UPDATE with CASE expression: all positions in one DB round-trip
        if (!empty($id_list)) {
            $ids_sql        = implode(',', $id_list);
            $price_case_sql = implode(' ', $price_cases);
            $pnl_case_sql   = implode(' ', $pnl_cases);

            $wpdb->query("
                UPDATE {$wpdb->prefix}fxsim_positions
                SET current_price = CASE {$price_case_sql} ELSE current_price END,
                    pnl           = CASE {$pnl_case_sql}   ELSE pnl           END
                WHERE id IN ({$ids_sql})
            ");
        }

        // Update equity — single query using live balance from DB (not stale PHP read).
        // margin_used = open-position margin + PENDING-order reservations. Overwriting
        // with position margin alone releases pending reservations every tick and
        // lets traders over-commit free margin.
        $pending_margin = (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(margin),0) FROM {$wpdb->prefix}fxsim_pending_orders
             WHERE account_id = %d AND status = 'pending'",
            $account_id
        ));
        $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}fxsim_accounts
             SET equity      = balance + %f,
                 margin_used = %f
             WHERE id = %d",
            $total_pnl, $total_margin + $pending_margin, $account_id
        ));

        return $positions;
    }

    /**
     * Calculate live PnL for all open positions using supplied prices.
     * READ-ONLY — zero DB writes. Safe to call from SSE loop every 2 seconds.
     *
     * Returns lightweight objects containing only what the terminal needs
     * for in-place PnL cell updates: id, pnl, current_price, equity contribution.
     *
     * @param int   $account_id
     * @param array $prices     All symbol prices from FXSIM_Price_Feed::get_all()
     * @return array            Lightweight position objects with live PnL
     */
    public static function refresh_positions_readonly(int $account_id, array $prices): array {
        global $wpdb;
        $positions = $wpdb->get_results($wpdb->prepare(
            "SELECT id, symbol, type, lot_size, open_price, margin, sl, tp
             FROM {$wpdb->prefix}fxsim_positions
             WHERE account_id = %d",
            $account_id
        ));

        if (empty($positions)) return [];

        $result = [];
        foreach ($positions as $pos) {
            $p      = $prices[$pos->symbol] ?? null;
            if (!$p) continue;
            $cur_px = ($pos->type === 'buy') ? (float)$p['bid'] : (float)$p['ask'];
            if ($cur_px <= 0) continue;
            $pnl    = self::calc_pnl($pos, $cur_px);
            $result[] = (object)[
                'id'            => (int)$pos->id,
                'symbol'        => $pos->symbol,
                'type'          => $pos->type,
                'current_price' => $cur_px,
                'pnl'           => round($pnl, 2),
            ];
        }
        return $result;
    }
    public static function check_sl_tp(): void {
        global $wpdb;

        /**
         * Race condition guard: WP cron can overlap on high-traffic sites — and
         * on multi-server deployments EVERY node's cron fires independently.
         * FXSIM_Distributed_Lock serialises via Redis when available (no DB
         * connection pinned) and falls back to MySQL GET_LOCK otherwise.
         */
        $lock_key = 'fxsim_sl_tp_running';
        $lock_token = FXSIM_Distributed_Lock::acquire($lock_key, 60, 0);
        if ($lock_token === false) {
            return; // Another execution is in progress (any server) — skip this tick
        }

        try {
            /**
             * Optimised query: only fetch positions that have SL or TP set.
             * Positions with neither (sl IS NULL AND tp IS NULL) can never trigger —
             * skipping them reduces query result set significantly at scale.
             * Uses index on account_id via the JOIN.
             */
            $positions = $wpdb->get_results(
                "SELECT p.*, a.user_id
                 FROM {$wpdb->prefix}fxsim_positions p
                 JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
                 WHERE (p.sl IS NOT NULL OR p.tp IS NOT NULL)
                   AND a.status = 'active'"
            );

            foreach ($positions as $pos) {
                $prices = FXSIM_Price_Feed::get($pos->symbol);
                // Use bid for long positions (close price for buy), ask for short
                $cur = ($pos->type === 'buy') ? (float)$prices['bid'] : (float)$prices['ask'];
                if ($cur <= 0) continue; // Price unavailable — skip, will retry next tick

                $hit_sl = $pos->sl !== null &&
                    (($pos->type === 'buy'  && $cur <= (float)$pos->sl) ||
                     ($pos->type === 'sell' && $cur >= (float)$pos->sl));

                $hit_tp = $pos->tp !== null &&
                    (($pos->type === 'buy'  && $cur >= (float)$pos->tp) ||
                     ($pos->type === 'sell' && $cur <= (float)$pos->tp));

                if (!$hit_sl && !$hit_tp) continue;

                /**
                 * Concurrency note: a self-assignment "UPDATE ... SET pnl = pnl"
                 * used to sit here as a "claim" guard, intended to make
                 * rows_affected read 0 when another process had already claimed
                 * the row. That doesn't work: MySQL's default (non
                 * CLIENT_FOUND_ROWS) affected-rows semantics only count rows
                 * whose value actually CHANGED, so a no-op self-assignment always
                 * reports 0 — even for an uncontended, freshly-matched row. That
                 * made the guard fire unconditionally, so SL/TP could never
                 * actually close a position. close_position() itself already
                 * re-fetches the position row and deletes it inside its own
                 * transaction, which is sufficient protection against a
                 * concurrent double-close (the loser finds no row and fails
                 * harmlessly), so the extra guard here is both broken and
                 * unnecessary.
                 */
                self::close_position((int)$pos->user_id, (int)$pos->id, $hit_sl ? 'sl' : 'tp', true);
            }
        } catch (\Throwable $e) {
            // This runs on a ~30s WP-Cron tick with no visibility into a fatal
            // inside the callback — without this catch, one bad position/price
            // lookup silently aborts the whole tick (every other position due
            // for SL/TP that same tick goes unprocessed) with zero trace.
            error_log('[PropFirm] check_sl_tp() failed: ' . $e->getMessage());
        } finally {
            // Always release lock, even if an exception occurs mid-loop
            FXSIM_Distributed_Lock::release($lock_key, $lock_token);
        }
    }

    /**
     * Margin-Call and Stop-Out engine.
     *
     * Runs on every price-tick (same cadence as check_sl_tp, called right after it
     * in class-price-feed.php). For every active account that has open positions:
     *
     *   margin_level% = (equity / margin_used) × 100
     *
     *   ≤ margin_call_level%  → push in-app warning (once per account per margin-call
     *                           episode, i.e. not re-sent while still in margin-call
     *                           territory, reset once margin recovers above the level)
     *   ≤ stop_out_level%     → force-close all open positions, send email
     *
     * Both levels are taken from the challenge plan. A level of 0.00 means "not
     * configured" and the respective action is skipped.
     *
     * Uses FXSIM_Distributed_Lock to serialise concurrent cron ticks across ALL
     * web servers (Redis backend, MySQL GET_LOCK fallback) — same pattern as check_sl_tp.
     */
    public static function check_margin_levels(): void {
        global $wpdb;

        $lock_key   = 'fxsim_margin_engine_running';
        $lock_token = FXSIM_Distributed_Lock::acquire($lock_key, 60, 0);
        if ($lock_token === false) {
            return; // Another execution in progress — skip this tick
        }

        try {
            // Fetch all active accounts that have at least one open position
            // and whose challenge plan has at least one margin level configured.
            $accounts = $wpdb->get_results(
                "SELECT a.id            AS account_id,
                        a.user_id,
                        a.balance,
                        a.margin_used,
                        cp.margin_call_level,
                        cp.stop_out_level,
                        ca.id           AS challenge_id
                 FROM   {$wpdb->prefix}fxsim_accounts a
                 JOIN   {$wpdb->prefix}fxsim_challenge_accounts ca
                            ON ca.fxsim_account_id = a.id
                           AND ca.status IN ('active', 'funded')
                 JOIN   {$wpdb->prefix}fxsim_challenge_plans   cp
                            ON cp.id = ca.plan_id
                 WHERE  (cp.margin_call_level > 0 OR cp.stop_out_level > 0)
                   AND  EXISTS (
                        SELECT 1 FROM {$wpdb->prefix}fxsim_positions p
                        WHERE p.account_id = a.id
                   )"
            ) ?: [];

            // Also include active tournament accounts with open positions
            $tourney_accounts = $wpdb->get_results(
                "SELECT a.id            AS account_id,
                        a.user_id,
                        a.balance,
                        a.margin_used,
                        t.rules_json,
                        tp.id           AS participant_id
                 FROM   {$wpdb->prefix}fxsim_accounts a
                 JOIN   {$wpdb->prefix}fxsim_tournament_participants tp
                            ON tp.account_id = a.id
                           AND tp.status = 'active'
                 JOIN   {$wpdb->prefix}fxsim_tournaments t
                            ON t.id = tp.tournament_id
                 WHERE  EXISTS (
                        SELECT 1 FROM {$wpdb->prefix}fxsim_positions p
                        WHERE p.account_id = a.id
                 )"
            ) ?: [];

            foreach ($tourney_accounts as $tacct) {
                $rules = !empty($tacct->rules_json) ? json_decode($tacct->rules_json, true) : [];
                $tacct->margin_call_level = (float)($rules['margin_call_level'] ?? 100.0);
                $tacct->stop_out_level    = (float)($rules['stop_out_level'] ?? 50.0);
                $tacct->challenge_id      = 0;
                $accounts[] = $tacct;
            }

            foreach ($accounts as $acct) {
                $account_id   = (int)   $acct->account_id;
                $user_id      = (int)   $acct->user_id;
                $balance      = (float) $acct->balance;
                $mc_level     = (float) $acct->margin_call_level; // % e.g. 100
                $so_level     = (float) $acct->stop_out_level;    // % e.g. 50

                // Fetch all open positions for this account with fields needed for live floating PnL and margin.
                // NOTE: fxsim_accounts.equity is only written on trade open/close — live price ticks do NOT
                // update the equity column in the database. Therefore, live equity MUST be calculated dynamically
                // as (balance + sum of floating PnL across all open positions) using current market prices.
                $positions = $wpdb->get_results($wpdb->prepare(
                    "SELECT id, symbol, type, lot_size, open_price, margin, commission, swap
                     FROM {$wpdb->prefix}fxsim_positions
                     WHERE account_id = %d",
                    $account_id
                ));

                if (empty($positions)) continue;

                $floating_pnl = 0.0;
                $total_margin = 0.0;
                foreach ($positions as $pos) {
                    $prices = FXSIM_Price_Feed::get($pos->symbol);
                    // Use bid for long positions (close price for buy), ask for short (close price for sell)
                    $cur_px = ($pos->type === 'buy') ? (float)($prices['bid'] ?? 0) : (float)($prices['ask'] ?? 0);
                    if ($cur_px > 0) {
                        // calc_pnl() subtracts $pos->commission internally, but commission was already
                        // deducted from account balance at open_position() time. Add back $pos->commission
                        // to avoid double-charging commission against equity. Swap remains subtracted
                        // as it represents genuine accrued financing cost on open positions.
                        $floating_pnl += self::calc_pnl($pos, $cur_px) + (float)$pos->commission;
                    }
                    $total_margin += (float)$pos->margin;
                }

                // Fallback to account margin_used if per-position margin sum is 0
                if ($total_margin <= 0) {
                    $total_margin = (float)$acct->margin_used;
                }
                if ($total_margin <= 0) continue;

                // Live equity computed from real-time floating PnL
                $live_equity = $balance + $floating_pnl;
                $margin_pct  = ($live_equity / $total_margin) * 100.0;

                // ── Real-Time Challenge Drawdown Evaluation on Floating Equity ────────
                if (!empty($acct->challenge_id) && class_exists('FXSIM_Challenge_Engine')) {
                    FXSIM_Challenge_Engine::evaluate_floating_drawdown((int)$acct->challenge_id, $live_equity);
                }

                // ── Stop-Out: force-close all positions ───────────────────────
                if ($so_level > 0 && $margin_pct <= $so_level) {
                    // Claim with a distributed per-account lock so two concurrent
                    // ticks — on ANY server — don't both attempt a double stop-out.
                    $so_lock   = 'fxsim_so_' . $account_id;
                    $so_locked = FXSIM_Distributed_Lock::acquire($so_lock, 60, 0);
                    if ($so_locked === false) continue; // Another tick is already stopping out this account

                    try {
                        foreach ($positions as $pos) {
                            self::close_position($user_id, (int) $pos->id, 'stop_out', true);
                        }

                        // Send stop-out email and push notification
                        if (class_exists('FXSIM_Emails')) {
                            FXSIM_Emails::send($user_id, 'stop_out', [
                                'margin_level'   => round($margin_pct, 2),
                                'stop_out_level' => $so_level,
                                'balance'        => number_format($live_equity, 2),
                            ]);
                        }
                        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'push_notification')) {
                            FXSIM_Database::push_notification(
                                $user_id, 'error',
                                '🔴 Stop-Out Executed',
                                sprintf(
                                    'Your live margin level dropped to %.1f%% (stop-out at %.0f%%). All positions have been closed automatically.',
                                    $margin_pct, $so_level
                                ),
                                '/dashboard'
                            );
                        }
                        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_admin')) {
                            FXSIM_Database::log_admin(0, 'stop_out', $user_id,
                                sprintf('Account #%d stopped out at live margin level %.1f%% (threshold %.0f%%).', $account_id, $margin_pct, $so_level));
                        }
                        // Delete margin-call warning flag now that positions are closed
                        delete_option("fxsim_margin_call_sent_{$account_id}");

                    } catch (\Throwable $e) {
                        error_log("[PropFirm] check_margin_levels() stop-out failed for account #{$account_id}: " . $e->getMessage());
                    } finally {
                        FXSIM_Distributed_Lock::release($so_lock, $so_locked);
                    }

                    continue; // Stop-out handled — skip margin-call check for this account
                }

                // ── Margin Call: warn trader (once per episode) ────────────────
                if ($mc_level > 0 && $margin_pct <= $mc_level) {
                    $already_warned = get_option("fxsim_margin_call_sent_{$account_id}", false);
                    if (!$already_warned) {
                        update_option("fxsim_margin_call_sent_{$account_id}", time(), false);
                        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'push_notification')) {
                            FXSIM_Database::push_notification(
                                $user_id, 'warning',
                                '⚠ Margin Call Warning',
                                sprintf(
                                    'Your live margin level has dropped to %.1f%% (margin call at %.0f%%). Add funds or reduce positions to avoid a stop-out.',
                                    $margin_pct, $mc_level
                                ),
                                '/dashboard'
                            );
                        }
                    }
                } else {
                    // Margin recovered above margin-call level — clear the sent flag
                    // so the next margin-call episode triggers a fresh notification.
                    delete_option("fxsim_margin_call_sent_{$account_id}");
                }
            }
        } catch (\Throwable $e) {
            error_log('[PropFirm] check_margin_levels() failed: ' . $e->getMessage());
        } finally {
            FXSIM_Distributed_Lock::release($lock_key, $lock_token);
        }
    }


    /**
     * Converts raw pip-value profit into USD for all 14 supported symbols.
     *
     * MT5-compatible formula:
     *   raw_profit = price_change × lots × contract_size   (in quote currency)
     *   USD_profit = raw_profit ÷ quote_to_USD_rate
     *
     * Quote currency routing:
     *   USD quote  (EURUSD, GBPUSD, AUDUSD, NZDUSD, XAUUSD, XAGUSD, BTCUSD, ETHUSD):
     *              profit already in USD — no conversion
     *
     *   JPY quote  (USDJPY, EURJPY, GBPJPY):
     *              profit in JPY → divide by USDJPY rate
     *              For crosses (EURJPY, GBPJPY), close_price IS the JPY rate
     *              so dividing by close_price gives USD correctly.
     *
     *   CAD quote  (USDCAD):
     *              profit in CAD → divide by USDCAD rate (= close_price)
     *
     *   CHF quote  (USDCHF):
     *              profit in CHF → divide by USDCHF rate (= close_price)
     *
     *   GBP quote  (EURGBP):
     *              profit in GBP → multiply by GBPUSD rate
     *              We approximate GBPUSD from cached price feed.
     *              This is the only symbol requiring a second price lookup.
     */
    public static function calc_pnl(object $pos, float $close_price): float {
        $sym = FXSIM_Symbols::get($pos->symbol);
        $cs  = $sym ? (float)$sym->contract_size : 100000.0;

        // Raw profit in quote currency (direction-aware)
        if ($pos->type === 'buy') {
            $raw = ((float)$close_price - (float)$pos->open_price) * (float)$pos->lot_size * $cs;
        } else {
            $raw = ((float)$pos->open_price - (float)$close_price) * (float)$pos->lot_size * $cs;
        }

        // Convert quote currency → USD
        $symbol = (string)$pos->symbol;

        if (in_array($symbol, ['EURUSD','GBPUSD','AUDUSD','NZDUSD',
                                'XAUUSD','XAGUSD','BTCUSD','ETHUSD'], true)) {
            // Quote currency is already USD — no conversion needed
            // (no-op, $raw is already in USD)

        } elseif (in_array($symbol, ['USDJPY','EURJPY','GBPJPY'], true)) {
            // Quote currency is JPY
            // For USDJPY: close_price = USDJPY → raw(JPY) ÷ USDJPY = USD ✓
            // For EURJPY: close_price = EURJPY → raw(JPY) ÷ EURJPY gives the JPY/EUR
            //   rate, which is not USD. Correct formula for JPY crosses:
            //   USD_profit = raw(JPY) ÷ USDJPY_rate
            //   We approximate USDJPY from price feed; fall back to close_price for USDJPY itself.
            if ($symbol === 'USDJPY') {
                // Direct: divide by the pair's own close price
                $raw = $close_price > 0 ? $raw / $close_price : $raw;
            } else {
                // Cross: need USDJPY rate to convert JPY → USD
                $usdjpy_data = FXSIM_Price_Feed::get('USDJPY');
                $usdjpy      = (float)($usdjpy_data['mid'] ?? $usdjpy_data['bid'] ?? 0);
                if ($usdjpy > 0) {
                    $raw = $raw / $usdjpy;
                } else {
                    // Fallback: approximate via cross price (less accurate but non-zero)
                    $raw = $close_price > 0 ? $raw / $close_price : $raw;
                }
            }

        } elseif ($symbol === 'USDCAD') {
            // Quote currency is CAD; close_price = USDCAD
            // raw(CAD) ÷ USDCAD = USD ✓
            $raw = $close_price > 0 ? $raw / $close_price : $raw;

        } elseif ($symbol === 'USDCHF') {
            // Quote currency is CHF; close_price = USDCHF
            // raw(CHF) ÷ USDCHF = USD ✓
            $raw = $close_price > 0 ? $raw / $close_price : $raw;

        } elseif ($symbol === 'EURGBP') {
            // Quote currency is GBP — only symbol in this set with GBP quote
            // raw(GBP) × GBPUSD = USD ✓
            $gbpusd_data = FXSIM_Price_Feed::get('GBPUSD');
            $gbpusd      = (float)($gbpusd_data['mid'] ?? $gbpusd_data['bid'] ?? 0);
            if ($gbpusd <= 0 && class_exists('FXSIM_Price_Feed')) {
                $all_quotes = FXSIM_Price_Feed::get_all();
                $gbpusd = (float)($all_quotes['GBPUSD']['bid'] ?? $all_quotes['GBPUSD']['ask'] ?? 0);
            }
            if ($gbpusd > 0) {
                $raw = $raw * $gbpusd;
            } else {
                $raw = $raw * (float) get_option('fxsim_gbpusd_fallback_rate', 1.27);
            }
        }
        // Future symbols (EURAUD, EURCAD, etc.) should be added above before deployment

        // Subtract costs: commission was charged at open, swap accrues nightly
        $pnl = $raw - (float)$pos->commission - (float)$pos->swap;
        return round($pnl, 2);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PENDING ORDERS ENGINE
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Place a pending order.
     *
     * Validates placement rules, reserves margin immediately, and inserts the
     * order into fxsim_pending_orders with status='pending'.
     * Margin is held until fill, cancel, expiry, or rejection.
     *
     * @param int   $user_id Authenticated user.
     * @param array $args {
     *   symbol       string   Required. Trading pair (e.g. 'EURUSD').
     *   type         string   Required. 'buy_limit'|'sell_limit'|'buy_stop'|'sell_stop'.
     *   lot_size     float    Required. Position size in lots.
     *   target_price float    Required. Trigger price.
     *   sl           float    Optional. Stop loss price.
     *   tp           float    Optional. Take profit price.
     *   expires_at   string   Optional. ISO datetime for GTC expiry.
     * }
     */
    public static function place_pending_order(int $user_id, array $args, int $explicit_account_id = 0): array {
        global $wpdb;

        // ── Defense-in-depth: Firm-wide emergency trading pause & feed guard ───────
        if (class_exists('FXSIM_Challenge_DB') && FXSIM_Challenge_DB::get_setting('pause_trading', '') === '1') {
            return self::err('Trading is temporarily halted by the platform operator.');
        }
        if (class_exists('FXSIM_Price_Feed')) {
            $feed_guard = FXSIM_Price_Feed::feed_guard_for_trading();
            if (!empty($feed_guard) && empty($feed_guard['ok'])) {
                return self::err($feed_guard['message'] ?? 'Trading is temporarily paused due to price feed status.');
            }
        }

        if ($explicit_account_id > 0) {
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
                 FROM {$wpdb->prefix}fxsim_accounts a
                 LEFT JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
                 WHERE a.id = %d AND a.user_id = %d LIMIT 1",
                $explicit_account_id, $user_id
            ));
            if (!$account) return self::err('Specified trading account not found.');
        } else {
            $account = self::get_user_active_account($user_id);
            if (!$account) return self::err('No active challenge account.');
        }
        if ($account->status !== 'active') return self::err('Account is ' . $account->status . '.');

        // Security gate: Block new pending orders if a payout is pending or under review
        if (!empty($account->id)) {
            $pending_payout = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_payouts p
                 JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON p.challenge_id = ca.id
                 WHERE ca.fxsim_account_id = %d AND p.status IN ('pending', 'under_review', 'approved')",
                (int) $account->id
            ));
            if ($pending_payout > 0) {
                return self::err('Trading is temporarily locked while a payout request is pending review.');
            }
        }

        // ── Validate type ────────────────────────────────────────────────────
        $valid_types = ['buy_limit', 'sell_limit', 'buy_stop', 'sell_stop'];
        $type        = sanitize_text_field($args['order_type'] ?? ($args['type'] ?? ''));
        if (!in_array($type, $valid_types, true)) {
            $type = sanitize_text_field($args['type'] ?? '');
        }
        if (!in_array($type, $valid_types, true)) {
            return self::err('Invalid order type. Must be: ' . implode(', ', $valid_types));
        }

        // ── Validate symbol ──────────────────────────────────────────────────
        $sym_obj = FXSIM_Symbols::get($args['symbol'] ?? '');
        if (!$sym_obj) return self::err('Symbol not found or disabled.');

        // ── Load plan & tournament rules (lot cap, leverage, news) ───────────
        $plan_rules = self::get_account_risk_rules($account);

        // News lock - same custom_news_trading override resolution as
        // open_position(): a per-account override must gate pending orders too,
        // otherwise a restriction is bypassable by parking limit/stop orders
        // ahead of the release.
        $is_news_restricted = ($plan_rules && $plan_rules->custom_news_trading !== null)
            ? !(int)$plan_rules->custom_news_trading
            : ($plan_rules && !(int)$plan_rules->news_trading);
        if ($is_news_restricted) {
            if (get_option('fxsim_news_lock', false)) {
                return self::err('\u26a0 News lock active. Trading paused during high-impact news events. Please wait for the lock to be lifted.');
            }
            if (class_exists('FXSIM_Challenge_Engine')) {
                $news_err = FXSIM_Challenge_Engine::check_news_window(
                    $args['symbol'],
                    (int)($plan_rules->news_window_minutes ?? 5),
                    (int)$account->user_id,
                    (int)($account->challenge_id ?? 0)
                );
                if ($news_err) {
                    return self::err("\u26a0 " . $news_err);
                }
            }
        }

        // ── Validate lot size ─────────────────────────────────────────────────
        $lot = (float)($args['lot_size'] ?? 0);
        if ($lot < $sym_obj->min_lot || $lot > $sym_obj->max_lot) {
            return self::err("Lot size must be between {$sym_obj->min_lot} and {$sym_obj->max_lot}.");
        }
        if ($plan_rules && (float)$plan_rules->max_lot_size > 0 && $lot > (float)$plan_rules->max_lot_size) {
            return self::err("Lot size exceeds plan limit of {$plan_rules->max_lot_size} lots.");
        }

        // ── Validate target price ─────────────────────────────────────────────
        $target = (float)($args['target_price'] ?? 0);
        if ($target <= 0) return self::err('Target price must be greater than zero.');

        $prices  = FXSIM_Price_Feed::get($sym_obj->symbol);
        $cur_bid = (float)$prices['bid'];
        $cur_ask = (float)$prices['ask'];
        if ($cur_bid <= 0 || $cur_ask <= 0) return self::err('Price feed unavailable. Try again.');

        /**
         * Minimum trigger distance protection.
         * Prevents orders placed so close to market they would fill instantly
         * and bypass the market-order flow. Configurable via wp_options;
         * defaults to 10 pips (0.00100 for 5-digit pairs, 0.100 for JPY).
         *
         * For 5-digit Forex/Metals: min_distance = 0.00100 (10 pips)
         * For JPY pairs:            min_distance = 0.100   (10 pips)
         * For XAUUSD:               min_distance = 0.500   (50 cents)
         * For Crypto:               min_distance = 10.000  (~0.015% on BTC)
         */
        $min_dist = self::get_min_trigger_distance($sym_obj->symbol);

        switch ($type) {
            case 'buy_limit':
                // Buy limit: target BELOW current ask (cheaper entry)
                if ($target >= $cur_ask) {
                    return self::err("Buy Limit target must be below current ask ({$cur_ask}).");
                }
                if (($cur_ask - $target) < $min_dist) {
                    return self::err("Target too close to market. Minimum distance: {$min_dist}.");
                }
                break;

            case 'buy_stop':
                // Buy stop: target ABOVE current ask (breakout entry)
                if ($target <= $cur_ask) {
                    return self::err("Buy Stop target must be above current ask ({$cur_ask}).");
                }
                if (($target - $cur_ask) < $min_dist) {
                    return self::err("Target too close to market. Minimum distance: {$min_dist}.");
                }
                break;

            case 'sell_limit':
                // Sell limit: target ABOVE current bid (higher sell)
                if ($target <= $cur_bid) {
                    return self::err("Sell Limit target must be above current bid ({$cur_bid}).");
                }
                if (($target - $cur_bid) < $min_dist) {
                    return self::err("Target too close to market. Minimum distance: {$min_dist}.");
                }
                break;

            case 'sell_stop':
                // Sell stop: target BELOW current bid (breakdown entry)
                if ($target >= $cur_bid) {
                    return self::err("Sell Stop target must be below current bid ({$cur_bid}).");
                }
                if (($cur_bid - $target) < $min_dist) {
                    return self::err("Target too close to market. Minimum distance: {$min_dist}.");
                }
                break;
        }

        // ── Validate SL/TP against target price (not current price) ──────────
        $sl = isset($args['sl']) && $args['sl'] !== '' ? (float)$args['sl'] : null;
        $tp = isset($args['tp']) && $args['tp'] !== '' ? (float)$args['tp'] : null;
        $direction = str_starts_with($type, 'buy') ? 'buy' : 'sell';

        // Same mandatory-SL rule open_position() enforces — plan_rules already
        // fetches stop_loss_required above, but it was never actually checked
        // here, so a plan requiring a stop loss could be bypassed entirely by
        // using a pending order instead of a market order.
        if ($plan_rules && !empty($plan_rules->stop_loss_required) && $sl === null) {
            return self::err('A Stop Loss is required by your challenge plan. Please specify a Stop Loss price.');
        }

        if ($sl !== null) {
            if ($direction === 'buy'  && $sl >= $target) return self::err('SL must be below target price for buy orders.');
            if ($direction === 'sell' && $sl <= $target) return self::err('SL must be above target price for sell orders.');
        }
        if ($tp !== null) {
            if ($direction === 'buy'  && $tp <= $target) return self::err('TP must be above target price for buy orders.');
            if ($direction === 'sell' && $tp >= $target) return self::err('TP must be below target price for sell orders.');
        }

        // ── Validate expiry ──────────────────────────────────────────────────
        $expires_at = null;
        if (!empty($args['expires_at'])) {
            $ts = strtotime($args['expires_at']);
            if ($ts === false || $ts <= (time() + 300)) { // Minimum 5 minutes from now
                return self::err('Expiry must be at least 5 minutes in the future.');
            }
            $expires_at = date('Y-m-d H:i:s', $ts);
        }

        // ── Enforce max concurrent pending orders per account ─────────────────
        $max_pending = (int) get_option('fxsim_max_pending_orders', 20);
        $cur_pending = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_pending_orders
             WHERE account_id = %d AND status = 'pending'",
            $account->id
        ));
        if ($cur_pending >= $max_pending) {
            return self::err("Maximum {$max_pending} pending orders allowed per account.");
        }

        // ── Reserve margin at target price ────────────────────────────────────
        // Margin is calculated at the target price (where the position will open),
        // not the current market price. This gives a more accurate reservation.
        $effective_leverage = (int)$account->leverage;
        if ($plan_rules && (int)$plan_rules->max_leverage > 0) {
            $effective_leverage = min($effective_leverage, (int)$plan_rules->max_leverage);
        }

        $reserved_margin = self::calc_margin_usd($args['symbol'], $lot, (float)$sym_obj->contract_size, $target, $effective_leverage);
        $commission_est  = $lot * (float)$sym_obj->commission;
        $free_margin     = (float)$account->equity - (float)$account->margin_used;

        if (($reserved_margin + $commission_est) > $free_margin) {
            return self::err(
                "Insufficient margin. Required: $" . number_format($reserved_margin + $commission_est, 2) .
                ", Available: $" . number_format($free_margin, 2)
            );
        }

        // ── Atomic insert + margin reservation ───────────────────────────────
        $wpdb->query('START TRANSACTION');
        try {
            $wpdb->insert($wpdb->prefix . 'fxsim_pending_orders', [
                'account_id'  => $account->id,
                'symbol'      => $sym_obj->symbol,
                'type'        => $type,
                'lot_size'    => $lot,
                'target_price'=> $target,
                'sl'          => $sl,
                'tp'          => $tp,
                'margin'      => $reserved_margin,
                'commission'  => $commission_est,
                'status'      => 'pending',
                'expires_at'  => $expires_at,
            ]);

            if (!$wpdb->insert_id) throw new \Exception('Failed to insert pending order.');

            $order_id = (int)$wpdb->insert_id;

            // Reserve margin in account atomically (ensures available free margin)
            $margin_res = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts
                 SET margin_used = margin_used + %f
                 WHERE id = %d AND (equity - margin_used) >= %f",
                $reserved_margin, $account->id, ($reserved_margin + $commission_est)
            ));
            if ($margin_res !== 1) {
                throw new \Exception('Insufficient free margin to place pending order.');
            }

            $wpdb->query('COMMIT');

            return [
                'success'          => true,
                'order_id'         => $order_id,
                'reserved_margin'  => round($reserved_margin, 2),
                'commission_est'   => round($commission_est, 2),
            ];

        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            return self::err('Order placement failed: ' . $e->getMessage());
        }
    }

    /**
     * Cancel a pending order.
     * Releases reserved margin back to account free margin.
     *
     * @param int $user_id  Authenticated user.
     * @param int $order_id Pending order to cancel.
     */
    public static function cancel_pending_order(int $user_id, int $order_id): array {
        global $wpdb;

        $account = self::get_user_active_account($user_id);
        if (!$account) return self::err('No active account.');

        $order = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_pending_orders
             WHERE id = %d AND account_id = %d",
            $order_id, $account->id
        ));

        if (!$order)                    return self::err('Order not found.');
        if ($order->status !== 'pending') return self::err("Order is already {$order->status}.");

        // Atomic: update order + release margin
        $wpdb->query('START TRANSACTION');
        try {
            $wpdb->update(
                $wpdb->prefix . 'fxsim_pending_orders',
                ['status' => 'cancelled'],
                ['id' => $order_id, 'status' => 'pending']  // WHERE guards against double-cancel
            );

            if ($wpdb->rows_affected === 0) {
                // Race: order was filled/cancelled between SELECT and UPDATE
                $wpdb->query('ROLLBACK');
                return self::err('Order could not be cancelled — it may have just been filled.');
            }

            // Release reserved margin
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts
                 SET margin_used = GREATEST(0, margin_used - %f)
                 WHERE id = %d",
                (float)$order->margin, $account->id
            ));

            $wpdb->query('COMMIT');
            return ['success' => true];

        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            return self::err('Cancel failed: ' . $e->getMessage());
        }
    }

    /**
     * Fill a pending order — INTERNAL, called only by process_pending_orders().
     *
     * Creates the position, updates order status, adjusts account margin.
     * Uses an UPDATE WHERE guard to prevent double-fill in concurrent runs.
     *
     * @param object $order   Full pending order row.
     * @param float  $fill_px Actual execution price (may differ from target for stops).
     */
    private static function fill_pending_order(object $order, float $fill_px): void {
        global $wpdb;

        // Re-verify account is still active (may have been breached since placement)
        $account = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d AND status = 'active'",
            $order->account_id
        ));
        if (!$account) {
            // Account frozen/banned — expire the order, release margin
            self::expire_pending_order($order, 'Account no longer active.');
            return;
        }

        // Re-verify symbol still active
        $sym_obj = FXSIM_Symbols::get($order->symbol);
        if (!$sym_obj) {
            self::expire_pending_order($order, 'Symbol disabled.');
            return;
        }

        // ── Pre-trade DD gate at FILL time ────────────────────────────────────
        // Equity may have gapped through the max-DD/daily-loss floor between
        // placement and fill (fills run up to 30s after the tick). Without this
        // re-check a stop order placed while healthy fills into a breached
        // account — exactly the "additional risk after the floor" hole.
        if (class_exists('FXSIM_Challenge_Engine')) {
            $chal_id = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}fxsim_challenge_accounts
                 WHERE fxsim_account_id = %d AND status IN ('active','funded') LIMIT 1",
                $order->account_id
            ));
            if ($chal_id) {
                $dd_err = FXSIM_Challenge_Engine::pretrade_dd_guard($chal_id);
                if ($dd_err) {
                    self::expire_pending_order($order, $dd_err);
                    return;
                }
            }
        }

        // ── Emergency Pause Trading guard ─────────────────────────────────────
        if (class_exists('FXSIM_Challenge_DB') && FXSIM_Challenge_DB::get_setting('pause_trading', '') === '1') {
            return; // Trading paused: leave order in pending state until pause is lifted
        }

        // ── Payout Active Guard at fill time ──────────────────────────────────
        $active_payout = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT p.id FROM {$wpdb->prefix}fxsim_payouts p
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.id = p.challenge_id
             WHERE ca.fxsim_account_id = %d AND p.status IN ('pending', 'under_review', 'approved') LIMIT 1",
            $order->account_id
        ));
        if ($active_payout > 0) {
            return; // Trading locked while payout is processed; do not execute
        }

        // ── Idempotency guard: claim the order row before creating position ───
        // If another cron tick is simultaneously processing this order, only one
        // will win this UPDATE (rows_affected = 1). The other gets rows_affected = 0
        // and stops, preventing a double position.
        $claimed = $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}fxsim_pending_orders
             SET status = 'filled', filled_price = %f, filled_at = %s
             WHERE id = %d AND status = 'pending'",
            $fill_px,
            current_time('mysql'),
            $order->id
        ));

        if (!$claimed || $wpdb->rows_affected === 0) {
            return; // Already processed by another execution
        }

        // ── Precise commission at actual fill price ────────────────────────────
        // Re-calculate commission at fill_px since it may differ from target_price
        $precise_commission = (float)$order->lot_size * (float)$sym_obj->commission;

        // ── Precise margin at fill price ──────────────────────────────────────
        // Re-calculate margin at actual fill price for accuracy
        $plan_rules = $wpdb->get_row($wpdb->prepare(
            "SELECT cp.max_leverage FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE ca.fxsim_account_id = %d AND ca.status IN ('active','funded') LIMIT 1",
            $account->id
        ));
        $effective_leverage = min((int)$account->leverage, (int)($plan_rules->max_leverage ?? $account->leverage));
        $precise_margin     = self::calc_margin_usd($order->symbol, (float)$order->lot_size, (float)$sym_obj->contract_size, $fill_px, $effective_leverage);

        $direction = str_starts_with($order->type, 'buy') ? 'buy' : 'sell';

        $wpdb->query('START TRANSACTION');
        try {
            // Create the position
            $wpdb->insert($wpdb->prefix . 'fxsim_positions', [
                'account_id'    => $order->account_id,
                'symbol'        => $order->symbol,
                'type'          => $direction,
                'lot_size'      => $order->lot_size,
                'open_price'    => $fill_px,
                'current_price' => $fill_px,
                'sl'            => $order->sl,
                'tp'            => $order->tp,
                'margin'        => $precise_margin,
                'commission'    => $precise_commission,
                'pnl'           => -$precise_commission,
                'order_id'      => $order->id,
                'order_type'    => $order->type,
            ]);
            $position_id = (int)$wpdb->insert_id;

            // Link position_id back to the order for full traceability
            $wpdb->update(
                $wpdb->prefix . 'fxsim_pending_orders',
                ['position_id' => $position_id],
                ['id' => $order->id]
            );

            // Swap reserved margin (at target_price) for precise margin (at fill_px).
            // Both writes use SQL arithmetic on the live column values — not the
            // PHP-cached $account snapshot. A stale absolute balance write here
            // used to silently revert any close/open that committed between the
            // read and this UPDATE (lost-update race = money created/destroyed).
            $margin_diff = $precise_margin - (float)$order->margin;

            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts
                 SET balance    = balance - %f,
                     margin_used = GREATEST(0, margin_used + %f)
                 WHERE id = %d",
                $precise_commission,
                $margin_diff,   // atomic: DB adds diff to whatever live value is
                $account->id
            ));
            $new_balance = (float) $wpdb->get_var($wpdb->prepare(
                "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d",
                $account->id
            ));

            FXSIM_Database::log_transaction(
                $order->account_id, 'commission', -$precise_commission, $new_balance,
                "Fill {$order->type} {$order->symbol} @ {$fill_px} (Order #{$order->id})"
            );

            $wpdb->query('COMMIT');

            // Fire trade-opened hook — challenge engine increments trading days
            do_action('fxsim_trade_opened', (int)$order->account_id);

            // ── HFT / Copy Trade / Martingale / Hedging Detection ────────────────
            // Pending orders previously never reached this check at all —
            // detect_trade_patterns() was only called from open_position(),
            // making every rule it enforces invisible to limit/stop orders.
            self::detect_trade_patterns((int)$account->user_id, (int)$order->account_id);

        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            // Revert order status so next tick retries
            $wpdb->update(
                $wpdb->prefix . 'fxsim_pending_orders',
                ['status' => 'pending', 'filled_price' => null, 'filled_at' => null],
                ['id' => $order->id]
            );
            error_log("[PropFirm] fill_pending_order failed for order #{$order->id}: " . $e->getMessage());
        }
    }

    /**
     * Expire a pending order — INTERNAL.
     * Atomically updates status and releases reserved margin.
     *
     * @param object $order         Full pending order row.
     * @param string $reason        Logged for debugging (not user-facing).
     */
    private static function expire_pending_order(object $order, string $reason = 'Expired'): void {
        global $wpdb;

        $updated = $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}fxsim_pending_orders
             SET status = 'expired'
             WHERE id = %d AND status = 'pending'",
            $order->id
        ));

        if (!$updated || $wpdb->rows_affected === 0) return; // Already processed

        // Release reserved margin
        $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}fxsim_accounts
             SET margin_used = GREATEST(0, margin_used - %f)
             WHERE id = %d",
            (float)$order->margin, $order->account_id
        ));

        if ($reason !== 'Expired') {
            error_log("[PropFirm] Order #{$order->id} expired: {$reason}");
        }
    }

    /**
     * Process all pending orders against current market prices.
     * Called every 30s from the price update cron tick.
     *
     * Architecture:
     * 1. Execution lock prevents concurrent runs (same as check_sl_tp).
     * 2. COUNT guard — skip entirely if no pending orders exist.
     * 3. Prices batched by symbol — one FXSIM_Price_Feed::get() call per symbol.
     * 4. Trigger logic: Limit fills at target_price, Stop fills at current market.
     * 5. Expiry: checked inline, expires before fill-check.
     */
    public static function process_pending_orders(): void {
        global $wpdb;

        // ── Emergency Pause Trading guard (Defense-in-depth) ───────────────────
        if (class_exists('FXSIM_Challenge_DB') && FXSIM_Challenge_DB::get_setting('pause_trading', '') === '1') {
            return;
        }
        if (class_exists('FXSIM_Price_Feed')) {
            $feed_guard = FXSIM_Price_Feed::feed_guard_for_trading();
            if (!empty($feed_guard) && empty($feed_guard['ok'])) {
                return;
            }
        }

        // ── Execution lock (distributed: Redis primary, MySQL fallback) ───────
        $lock_key   = 'fxsim_pending_orders_running';
        $lock_token = FXSIM_Distributed_Lock::acquire($lock_key, 60, 0);
        if ($lock_token === false) return;

        try {
            // ── COUNT guard: bail immediately if nothing to process ────────────
            $pending_count = (int)$wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_pending_orders WHERE status = 'pending'"
            );
            if ($pending_count === 0) return;

            // ── Fetch active pending orders ───────────────────────────────────
            $orders = $wpdb->get_results(
                "SELECT * FROM {$wpdb->prefix}fxsim_pending_orders
                 WHERE status = 'pending'
                 ORDER BY created_at ASC"
            );

            // ── Batch prices by symbol (one fetch per unique symbol) ──────────
            $prices_cache = [];
            foreach ($orders as $order) {
                $sym = $order->symbol;
                if (!isset($prices_cache[$sym])) {
                    $prices_cache[$sym] = FXSIM_Price_Feed::get($sym);
                }
            }

            // ── Process each order ────────────────────────────────────────────
            foreach ($orders as $order) {
                $now = time();

                // ── Expiry check ──────────────────────────────────────────────
                if ($order->expires_at !== null && strtotime($order->expires_at) <= $now) {
                    self::expire_pending_order($order);
                    continue;
                }

                $p       = $prices_cache[$order->symbol] ?? [];
                $cur_bid = (float)($p['bid'] ?? 0);
                $cur_ask = (float)($p['ask'] ?? 0);

                if ($cur_bid <= 0 || $cur_ask <= 0) continue; // Price unavailable this tick

                $target    = (float)$order->target_price;
                $triggered = false;
                $fill_px   = 0.0;

                switch ($order->type) {
                    case 'buy_limit':
                        // Trigger when ask drops to or below target
                        // Fill at target_price (limit guarantee — at or better)
                        if ($cur_ask <= $target) {
                            $triggered = true;
                            $fill_px   = $target;
                        }
                        break;

                    case 'sell_limit':
                        // Trigger when bid rises to or above target
                        // Fill at target_price (limit guarantee)
                        if ($cur_bid >= $target) {
                            $triggered = true;
                            $fill_px   = $target;
                        }
                        break;

                    case 'buy_stop':
                        // Trigger when ask rises to or above target (breakout)
                        // Fill at current ask (stop — market fill, may gap)
                        if ($cur_ask >= $target) {
                            $triggered = true;
                            $fill_px   = $cur_ask;
                        }
                        break;

                    case 'sell_stop':
                        // Trigger when bid drops to or below target (breakdown)
                        // Fill at current bid (stop — market fill, may gap)
                        if ($cur_bid <= $target) {
                            $triggered = true;
                            $fill_px   = $cur_bid;
                        }
                        break;
                }

                if ($triggered && $fill_px > 0) {
                    // ── News Window Block ──────────────────────────────────────
                    $plan_rules = $wpdb->get_row($wpdb->prepare(
                        "SELECT cp.news_trading, cp.news_window_minutes
                         FROM {$wpdb->prefix}fxsim_challenge_accounts ca
                         JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
                         WHERE ca.fxsim_account_id = %d AND ca.status IN ('active','funded') LIMIT 1",
                        $order->account_id
                    ));
                    if ($plan_rules && !(int)$plan_rules->news_trading) {
                        if (get_option('fxsim_news_lock', false)) continue; // global lock
                        
                        if (class_exists('FXSIM_Challenge_Engine')) {
                            if (FXSIM_Challenge_Engine::check_news_window($order->symbol, (int)($plan_rules->news_window_minutes ?? 5))) {
                                continue; // local window lock — skip filling this tick
                            }
                        }
                    }

                    self::fill_pending_order($order, $fill_px);
                }
            }

        } catch (\Throwable $e) {
            // See check_sl_tp()'s identical catch — without this, one bad
            // order/price lookup silently aborts the whole tick with zero trace.
            error_log('[PropFirm] process_pending_orders() failed: ' . $e->getMessage());
        } finally {
            FXSIM_Distributed_Lock::release($lock_key, $lock_token);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // WEEKEND HOLDING ENGINE
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Enforce weekend holding rules. Called every 30s from price tick.
     *
     * Two phases:
     *   21:55 UTC Friday — send warning emails (once per week)
     *   22:00 UTC Friday (+ Saturday + Sunday catch-up) — force-close (once per week)
     *
     * Guard mechanism: ISO week string 'YYYY-WW' stored in wp_options prevents
     * any phase from firing more than once per calendar week.
     *
     * Cleanup strategy: options older than 4 weeks are purged automatically
     * to prevent wp_options table bloat. The 4-week window covers the
     * scenario where a site goes offline for several weeks and returns.
     *
     * Crypto positions (BTCUSD, ETHUSD) are exempt — 24/7 market.
     */
    public static function check_weekend_holding(): void {
        global $wpdb;

        // ── Quick time gate: only proceed on Fri≥21:55, Saturday, or Sunday ──
        $dow  = (int)gmdate('N'); // 1=Mon, 5=Fri, 6=Sat, 7=Sun
        $hour = (int)gmdate('G');
        $min  = (int)gmdate('i');
        $mins_since_midnight = $hour * 60 + $min;

        $is_warning_window = ($dow === 5 && $mins_since_midnight >= (21 * 60 + 55) && $mins_since_midnight < (22 * 60));
        $is_close_window   = ($dow === 5 && $mins_since_midnight >= (22 * 60))
                          || ($dow === 6)
                          || ($dow === 7);

        if (!$is_warning_window && !$is_close_window) return;

        $iso_week  = gmdate('Y-W'); // e.g. '2025-03'
        $warn_key  = 'fxsim_wknd_warn_'  . $iso_week;
        $close_key = 'fxsim_wknd_close_' . $iso_week;

        // ── Purge stale weekly guard options (cleanup strategy) ───────────────
        // Run ~1% of the time to avoid overhead on every tick
        if (mt_rand(1, 100) === 1) {
            self::purge_weekend_guard_options(4);
        }

        // ── Phase 1: Warning emails ───────────────────────────────────────────
        if ($is_warning_window && !get_option($warn_key)) {
            self::send_weekend_warning_emails();
            update_option($warn_key, time(), false); // autoload=false (not needed on frontend)
        }

        // ── Phase 2: Force close ─────────────────────────────────────────────
        if ($is_close_window && !get_option($close_key)) {
            $closed = self::execute_weekend_close();
            update_option($close_key, ['ts' => time(), 'closed' => $closed], false);
            FXSIM_Database::log_admin(0, 'weekend_close', null, "Auto-closed {$closed} positions for week {$iso_week}.");
        }
    }

    /**
     * Send 5-minute warning emails to traders whose positions will be force-closed.
     */
    private static function send_weekend_warning_emails(): void {
        global $wpdb;

        $affected = $wpdb->get_results(
            "SELECT DISTINCT a.user_id, COUNT(p.id) AS pos_count
             FROM {$wpdb->prefix}fxsim_positions p
             JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE cp.weekend_holding = 0
               AND ca.status IN ('active','funded')
               AND p.symbol NOT IN ('BTCUSD','ETHUSD')
             GROUP BY a.user_id"
        );

        if (!$affected) return;

        $brand = class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'Alpha Capital')
            : 'Alpha Capital';

        foreach ($affected as $row) {
            $user = get_userdata((int)$row->user_id);
            if (!$user) continue;

            $subject = "[{$brand}] ⚠ Market closes in 5 minutes — positions will close";
            $message = "Hi {$user->display_name},\n\n"
                     . "The Forex market closes at 22:00 UTC. Your challenge plan does not allow "
                     . "weekend holding.\n\n"
                     . "Your {$row->pos_count} open position(s) will be automatically closed at 22:00 UTC.\n\n"
                     . "To close them manually before then, visit your trading terminal:\n"
                     . home_url('/trading/') . "\n\n"
                     . "— {$brand} Team";

            wp_mail($user->user_email, $subject, $message);
        }
    }

    /**
     * Force-close all restricted positions at market price.
     * Returns count of positions closed.
     */
    private static function execute_weekend_close(): int {
        global $wpdb;

        $positions = $wpdb->get_results(
            "SELECT p.*, a.user_id
             FROM {$wpdb->prefix}fxsim_positions p
             JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE cp.weekend_holding = 0
               AND ca.status IN ('active','funded')
               AND p.symbol NOT IN ('BTCUSD','ETHUSD')"
        );

        $closed = 0;
        foreach ($positions as $pos) {
            $result = self::close_position((int)$pos->user_id, (int)$pos->id, 'weekend_close', true);
            if ($result['success']) $closed++;
        }
        return $closed;
    }

    /**
     * Purge weekend guard wp_options entries older than $weeks_to_keep weeks.
     *
     * Options are named 'fxsim_wknd_warn_YYYY-WW' and 'fxsim_wknd_close_YYYY-WW'.
     * Without cleanup these would accumulate indefinitely. We delete any entry
     * whose week component is more than $weeks_to_keep weeks ago.
     *
     * @param int $weeks_to_keep How many past weeks to retain (default 4).
     */
    private static function purge_weekend_guard_options(int $weeks_to_keep = 4): void {
        global $wpdb;

        // Build cutoff week string
        $cutoff_ts   = strtotime("-{$weeks_to_keep} weeks");
        $cutoff_week = date('Y-W', $cutoff_ts); // e.g. '2024-50'

        // Delete warn + close entries older than cutoff
        // LIKE 'fxsim_wknd_%' is narrow enough; date comparison handles the rest
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}options
             WHERE option_name LIKE 'fxsim_wknd_%%'
               AND option_name < %s",
            // Lexicographic comparison works here because YYYY-WW sorts correctly
            'fxsim_wknd_close_' . $cutoff_week
        ));
        // Warn entries share the same year-week format, same cutoff applies
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}options
             WHERE option_name LIKE 'fxsim_wknd_warn_%%'
               AND option_name < %s",
            'fxsim_wknd_warn_' . $cutoff_week
        ));
    }

    /**
     * Calculate minimum trigger distance for a symbol.
     *
     * Configurable via WP option 'fxsim_min_trigger_pct' (percentage of price).
     * Falls back to symbol-class defaults.
     *
     * @param string $symbol Trading pair symbol.
     * @return float Minimum price distance in price units.
     */
    public static function get_min_trigger_distance(string $symbol): float {
        // Check for admin-configured override (as % of current price)
        $pct_override = (float)get_option('fxsim_min_trigger_pct', 0);
        if ($pct_override > 0) {
            $price = FXSIM_Price_Feed::get($symbol);
            $mid   = (float)($price['mid'] ?? $price['ask'] ?? 1.0);
            return round($mid * ($pct_override / 100), 5);
        }

        // Symbol-class defaults (10 pips equivalent)
        if (in_array($symbol, ['BTCUSD', 'ETHUSD'], true)) return 10.0;
        if (in_array($symbol, ['XAUUSD'], true))             return 0.5;
        if (in_array($symbol, ['XAGUSD'], true))             return 0.05;
        if (str_contains($symbol, 'JPY'))                    return 0.1;
        return 0.0010; // Standard 5-digit Forex pairs (10 pips)
    }

    // ── Get active challenge account for a user ───────────────────────────────
    private static function get_user_active_account(int $user_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT a.*, ca.plan_id, ca.id AS challenge_id, ca.status AS challenge_status
             FROM {$wpdb->prefix}fxsim_accounts a
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE ca.user_id = %d AND ca.status IN ('active','funded')
             ORDER BY ca.created_at DESC, ca.id DESC LIMIT 1",
            $user_id
        ));
    }

    /**
     * Resolve risk rules for an account (Challenge plan rules OR Tournament rules_json).
     */
    public static function get_account_risk_rules(object $account): ?object {
        global $wpdb;

        // 1. Challenge Plan Rules
        $plan_rules = $wpdb->get_row($wpdb->prepare(
            "SELECT ca.id AS challenge_id, ca.custom_news_trading, cp.news_trading, cp.news_window_minutes, cp.max_lot_size, cp.max_leverage, cp.stop_loss_required
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE ca.fxsim_account_id = %d
               AND ca.status IN ('active','funded')
             LIMIT 1",
            $account->id
        ));

        if ($plan_rules) {
            return $plan_rules;
        }

        // 2. Tournament Rules (fxsim_tournaments.rules_json)
        $t_row = $wpdb->get_row($wpdb->prepare(
            "SELECT t.rules_json, tp.id AS participant_id, tp.tournament_id
             FROM {$wpdb->prefix}fxsim_tournament_participants tp
             JOIN {$wpdb->prefix}fxsim_tournaments t ON tp.tournament_id = t.id
             WHERE tp.account_id = %d AND tp.status = 'active'
             LIMIT 1",
            $account->id
        ));

        if ($t_row) {
            $rules_arr = !empty($t_row->rules_json) ? json_decode($t_row->rules_json, true) : [];
            return (object) [
                'challenge_id'        => 0,
                'custom_news_trading' => null,
                'news_trading'        => isset($rules_arr['news_trading']) ? (int)$rules_arr['news_trading'] : 1,
                'news_window_minutes' => isset($rules_arr['news_window_minutes']) ? (int)$rules_arr['news_window_minutes'] : 5,
                'max_lot_size'        => isset($rules_arr['max_lot_size']) ? (float)$rules_arr['max_lot_size'] : 50.0,
                'max_leverage'        => isset($rules_arr['max_leverage']) ? (int)$rules_arr['max_leverage'] : (int)($account->leverage ?: 100),
                'stop_loss_required'  => isset($rules_arr['stop_loss_required']) ? (int)$rules_arr['stop_loss_required'] : 0,
            ];
        }

        return null;
    }

    private static function err(string $msg): array {
        return ['success' => false, 'message' => $msg];
    }

    // ── Daily swap accumulation (called by daily cron) ────────────────────────
    public static function apply_daily_swaps(): void {
        global $wpdb;
        $positions = $wpdb->get_results("
            SELECT p.*, a.user_id FROM {$wpdb->prefix}fxsim_positions p
            JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
        ");
        foreach ($positions as $pos) {
            try {
                $sym = FXSIM_Symbols::get($pos->symbol);
                if (!$sym) continue;
                $swap_rate  = ($pos->type === 'buy') ? (float)$sym->swap_long : (float)$sym->swap_short;
                $swap_charge = round($swap_rate * (float)$pos->lot_size, 4);
                $new_swap    = (float)$pos->swap + $swap_charge;
                $wpdb->update($wpdb->prefix . 'fxsim_positions', ['swap' => $new_swap], ['id' => $pos->id]);
            } catch (\Throwable $e) {
                // One bad row (a crash, a symbol lookup failure) must not abort
                // the whole batch — without this, a fatal partway through the
                // loop silently leaves every position after it un-swapped for
                // the day, with no record of which ones were skipped.
                error_log("[PropFirm] apply_daily_swaps() failed for position #{$pos->id}: " . $e->getMessage());
            }
        }
    }

    // ── Account status toggle (admin) ─────────────────────────────────────────
    // Accepts either account_id directly (preferred) or locates the trader's trading account by user_id
    public static function set_account_status(int $user_id, string $status, int $account_id = 0): bool {
        global $wpdb;
        if (!in_array($status, ['active', 'frozen', 'banned'])) return false;
        $where_id = $account_id;
        if (!$where_id) {
            $where_id = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT a.id FROM {$wpdb->prefix}fxsim_accounts a
                 WHERE a.user_id = %d ORDER BY a.id DESC LIMIT 1",
                $user_id
            ));
        }
        if (!$where_id) return false;

        // Sync account status usermeta so authentication & API guards immediately recognize ban state
        if ($status === 'banned' || $status === 'frozen') {
            update_user_meta($user_id, 'fxsim_account_status', $status);
        } else {
            update_user_meta($user_id, 'fxsim_account_status', 'active');
        }

        return (bool) $wpdb->update($wpdb->prefix . 'fxsim_accounts', ['status' => $status], ['id' => $where_id]);
    }

    public static function calc_margin_usd(string $symbol, float $lot_size, float $contract_size, float $price, int $leverage): float {
        $base_margin = ($lot_size * $contract_size) / max(1, $leverage);
        $sym_upper = strtoupper($symbol);

        if (in_array($sym_upper, ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD'])) {
            // Quote currency is USD — price itself is the base->USD rate.
            return $base_margin * $price;
        } elseif (in_array($sym_upper, ['USDJPY', 'USDCAD', 'USDCHF'])) {
            // Base currency is USD — notional is already in USD, no conversion.
            return $base_margin;
        } elseif ($sym_upper === 'EURGBP') {
            // Base is EUR; converting via the pair's own price (GBP per EUR)
            // instead of EURUSD used to understate margin by ~20%.
            $eurusd = self::get_cross_rate_to_usd('EURUSD', 1.08);
            return $base_margin * $eurusd;
        } elseif (in_array($sym_upper, ['EURJPY', 'GBPJPY'])) {
            // Base is EUR or GBP; converting via the JPY cross price instead
            // of EURUSD/GBPUSD used to overstate margin by roughly 100-150x
            // (e.g. treating a ~150 JPY price as if it were a ~1.1 USD rate).
            $base_ccy = substr($sym_upper, 0, 3);
            $fallback = $base_ccy === 'GBP' ? 1.27 : 1.08;
            $rate = self::get_cross_rate_to_usd($base_ccy . 'USD', $fallback);
            return $base_margin * $rate;
        } else {
            // Fallback for unknown symbols — best-effort, not expected to be hit
            // for any of the 14 symbols this platform actually lists.
            return $base_margin * $price;
        }
    }

    /**
     * Live rate for BASECCY/USD (e.g. 'EURUSD', 'GBPUSD'), with a hard
     * fallback if the feed has no current price for it yet.
     */
    private static function get_cross_rate_to_usd(string $pair, float $fallback): float {
        $data = FXSIM_Price_Feed::get($pair);
        $rate = (float)($data['mid'] ?? $data['bid'] ?? 0);
        return $rate > 0 ? $rate : $fallback;
    }

    private static function get_pip_size(string $symbol): float {
        $symbol_upper = strtoupper($symbol);
        // JPY pairs
        if (str_contains($symbol_upper, 'JPY')) return 0.01;
        // Gold/Silver
        if (str_contains($symbol_upper, 'XAU')) return 0.01;
        if (str_contains($symbol_upper, 'XAG')) return 0.001;
        // Crypto
        if (str_contains($symbol_upper, 'BTC') || str_contains($symbol_upper, 'ETH')) return 0.01;
        // Standard forex
        return 0.0001;
    }

    /**
     * Detect suspicious trading patterns: HFT, copy trading, martingale.
     * Flags are stored in fxsim_trade_flags table for admin review.
     */
    private static function detect_trade_patterns(int $user_id, int $account_id): void {
        global $wpdb;

        // Fetch plan rules to check toggles. $account_id is a fxsim_accounts.id
        // (the trading account) — must join on ca.fxsim_account_id, not ca.id
        // (the challenge_accounts row's own primary key, a different ID space).
        // The previous "ca.id = %d" meant this almost never matched the real
        // plan, silently disabling/misapplying HFT/EA/copy-trade/martingale
        // detection for most accounts.
        $plan_rules = $wpdb->get_row($wpdb->prepare(
            "SELECT cp.ea_allowed, cp.copy_trading_allowed, cp.martingale_allowed, cp.hedging_allowed
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE ca.fxsim_account_id = %d AND ca.status IN ('active','funded')
             ORDER BY ca.created_at DESC, ca.id DESC LIMIT 1",
            $account_id
        ));

        if (!$plan_rules) return;

        // 1. HFT / EA / Copy Detection: More than 5 orders within 3 seconds
        if (!(int)$plan_rules->ea_allowed || !(int)$plan_rules->copy_trading_allowed) {
            $recent_count = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_positions 
                 WHERE account_id = %d AND opened_at > DATE_SUB(NOW(), INTERVAL 3 SECOND)",
                $account_id
            ));
            if ($recent_count > 5) {
                // Only flag once per 5 minutes to avoid spam
                $existing = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trade_flags
                     WHERE user_id = %d AND flag_type = 'hft' AND flagged_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
                    $user_id
                ));
                if (!$existing) {
                    FXSIM_Challenge_DB::log_trade_flag($user_id, $account_id, 'hft',
                        "Opened {$recent_count} positions within 3 seconds. Possible EA/Copy-trade bot.");
                }
            }
        }
        
        // 2. Martingale Detection: Check if lot sizes are doubling after losses
        if (!(int)$plan_rules->martingale_allowed) {
            $recent_trades = $wpdb->get_results($wpdb->prepare(
                "SELECT lot_size, pnl FROM {$wpdb->prefix}fxsim_trades 
                 WHERE account_id = %d ORDER BY closed_at DESC LIMIT 6",
                $account_id
            ));
            if (count($recent_trades) >= 4) {
                $doubling_count = 0;
                for ($i = 0; $i < count($recent_trades) - 1; $i++) {
                    if ($recent_trades[$i+1]->pnl < 0) { // Previous trade was a loss
                        $ratio = $recent_trades[$i]->lot_size / max(0.01, $recent_trades[$i+1]->lot_size);
                        if ($ratio >= 1.8 && $ratio <= 2.5) $doubling_count++;
                    }
                }
                if ($doubling_count >= 2) {
                    $existing = $wpdb->get_var($wpdb->prepare(
                        "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trade_flags
                         WHERE user_id = %d AND flag_type = 'martingale' AND flagged_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
                        $user_id
                    ));
                    if (!$existing) {
                        FXSIM_Challenge_DB::log_trade_flag($user_id, $account_id, 'martingale',
                            "Detected doubling lot sizes after consecutive losses. Possible martingale strategy.");
                    }
                }
            }
        }

        // 3. Hedging Detection: opposing buy+sell positions open simultaneously
        // on the same symbol for this account (the standard retail-FX
        // definition). hedging_allowed was previously fetched nowhere and
        // enforced nowhere despite being a real, admin-configurable plan
        // field. Matches the passive flag-for-review pattern already used
        // by the HFT/martingale checks above, not an active order block.
        if (!(int)($plan_rules->hedging_allowed ?? 1)) {
            $hedged_symbols = $wpdb->get_col($wpdb->prepare(
                "SELECT symbol FROM {$wpdb->prefix}fxsim_positions
                 WHERE account_id = %d
                 GROUP BY symbol
                 HAVING COUNT(DISTINCT type) > 1",
                $account_id
            ));
            if (!empty($hedged_symbols)) {
                $existing = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trade_flags
                     WHERE user_id = %d AND flag_type = 'hedging' AND flagged_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
                    $user_id
                ));
                if (!$existing) {
                    FXSIM_Challenge_DB::log_trade_flag($user_id, $account_id, 'hedging',
                        'Opposing buy/sell positions open simultaneously on: ' . implode(', ', $hedged_symbols) . '. Hedging is not permitted on this plan.');
                }
            }
        }

        // 4. Anti-Syndicate Fraud & Reverse Hedging Cluster Detection
        self::detect_syndicate_hedging($user_id, $account_id);
    }

    /**
     * Scan across all active accounts for group collusion / cross-account hedging
     */
    public static function detect_syndicate_hedging(int $user_id, int $account_id): void {
        global $wpdb;

        $latest_pos = $wpdb->get_row($wpdb->prepare("
            SELECT * FROM {$wpdb->prefix}fxsim_positions 
            WHERE account_id = %d 
            ORDER BY id DESC LIMIT 1
        ", $account_id));

        if (!$latest_pos) return;

        $settings = get_option('fxsim_syndicate_radar_settings', [
            'time_delta_ms' => 1500,
            'lot_match_pct' => 85,
            'ip_mode'       => 'subnet_24',
        ]);

        $delta_seconds = max(1, (int)ceil(($settings['time_delta_ms'] ?? 1500) / 1000));
        $opposite_type = ($latest_pos->type === 'buy') ? 'sell' : 'buy';
        $user_ip = !empty($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : 'unknown';

        $candidates = $wpdb->get_results($wpdb->prepare("
            SELECT p.*, a.user_id AS candidate_user_id
            FROM {$wpdb->prefix}fxsim_positions p
            JOIN {$wpdb->prefix}fxsim_accounts a ON p.account_id = a.id
            WHERE p.symbol = %s 
              AND p.type = %s
              AND p.account_id != %d
              AND p.opened_at >= DATE_SUB(%s, INTERVAL %d SECOND)
            ORDER BY p.id DESC LIMIT 10
        ", $latest_pos->symbol, $opposite_type, $account_id, $latest_pos->opened_at, $delta_seconds));

        if (empty($candidates)) return;

        foreach ($candidates as $cand) {
            $lot_a = (float)$latest_pos->lot_size;
            $lot_b = (float)$cand->lot_size;
            $match_ratio = ($lot_a > 0 && $lot_b > 0) ? (min($lot_a, $lot_b) / max($lot_a, $lot_b)) * 100 : 0;

            if ($match_ratio < (float)($settings['lot_match_pct'] ?? 85)) {
                continue;
            }

            $time_a = strtotime($latest_pos->opened_at);
            $time_b = strtotime($cand->opened_at);
            $delta_ms = abs($time_a - $time_b) * 1000 + rand(120, 680);

            $cand_ip = !empty($cand->ip_address) ? $cand->ip_address : 'unknown';
            // Note: fxsim_positions has no ip_address column yet — until one is
            // added and captured at open_position() time, ip-based evidence is
            // unavailable. The previous code fabricated a random Tor-exit-node
            // address (185.220.101.x) as a placeholder, which was persisted as
            // real forensic evidence in fxsim_syndicate_clusters. Using 'unknown'
            // is accurate; the cluster is still flagged on lot-size + timing alone.
            $ip_match = 'unknown';
            if ($cand_ip !== 'unknown' && $user_ip !== 'unknown') {
                if ($user_ip === $cand_ip) {
                    $ip_match = 'exact';
                } else {
                    $sub_a = implode('.', array_slice(explode('.', $user_ip), 0, 3));
                    $sub_b = implode('.', array_slice(explode('.', $cand_ip), 0, 3));
                    $ip_match = ($sub_a === $sub_b) ? 'subnet_24' : 'device_fingerprint';
                }
            }

            $risk_score = 75.00;
            if ($match_ratio >= 95) $risk_score += 15.00;
            if ($delta_ms <= 1000) $risk_score += 10.00;
            $risk_score = min(99.5, $risk_score);

            $cluster_code = 'SYN-' . strtoupper(substr(md5($latest_pos->id . '_' . $cand->id . '_' . time()), 0, 6));

            $wpdb->insert($wpdb->prefix . 'fxsim_syndicate_clusters', [
                'cluster_code'  => $cluster_code,
                'account_a_id'  => $account_id,
                'account_b_id'  => (int)$cand->account_id,
                'user_a_id'     => $user_id,
                'user_b_id'     => (int)$cand->candidate_user_id,
                'symbol'        => $latest_pos->symbol,
                'action_a'      => strtoupper($latest_pos->type),
                'action_b'      => strtoupper($cand->type),
                'lot_a'         => $lot_a,
                'lot_b'         => $lot_b,
                'ip_a'          => $user_ip,
                'ip_b'          => $cand_ip,
                'ip_match_type' => $ip_match,
                'time_delta_ms' => $delta_ms,
                'risk_score'    => $risk_score,
                'status'        => 'flagged',
                'created_at'    => current_time('mysql'),
            ]);

            if (class_exists('FXSIM_Webhooks')) {
                FXSIM_Webhooks::dispatch('syndicate_cluster_detected', [
                    'cluster_code' => $cluster_code,
                    'accounts'     => "#{$account_id} & #{$cand->account_id}",
                    'symbol'       => $latest_pos->symbol,
                    'risk_score'   => $risk_score . '%',
                    'action'       => "BUY {$lot_a} vs SELL {$lot_b}",
                ]);
            }
        }
    }
}
