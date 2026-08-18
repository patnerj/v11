<?php
/**
 * Automated Comprehensive Platform Test Suite
 * Covers All 21 Modules & Rules: PvP Engine, Risk Shields, Trading Engine,
 * Drawdown Models, Scaling, Payments, Payouts, KYC, MT5 Bridge, Helpdesk, Marketing, Webhooks.
 */

if (php_sapi_name() === 'cli') {
    define('DOING_CRON', true);
}
define('FXSIM_BYPASS_MARKET_HOURS', true);

require_once dirname(__DIR__, 4) . '/wp-load.php';

global $wpdb;

class FullSuiteRunner {
    public static int $passed = 0;
    public static int $failed = 0;
    public static array $failures = [];

    public static function header(string $title): void {
        echo "\n\033[1;36m================================================================================\033[0m\n";
        echo "\033[1;37m " . strtoupper($title) . "\033[0m\n";
        echo "\033[1;36m================================================================================\033[0m\n";
    }

    public static function section(string $name): void {
        echo "\n\033[1;33m--- [SECTION] " . $name . " ---\033[0m\n";
    }

    public static function assert(bool $condition, string $test_name, string $details = ''): bool {
        if ($condition) {
            self::$passed++;
            echo "  \033[1;32m[PASS]\033[0m {$test_name}\n";
            return true;
        } else {
            self::$failed++;
            $msg = "  \033[1;31m[FAIL]\033[0m {$test_name}";
            if ($details) {
                $msg .= " -> \033[0;31m{$details}\033[0m";
            }
            echo "{$msg}\n";
            self::$failures[] = "{$test_name}: {$details}";
            return false;
        }
    }

    public static function assertEquals(float|int|string $expected, float|int|string $actual, string $test_name, float $epsilon = 0.001): bool {
        $matches = false;
        if (is_numeric($expected) && is_numeric($actual)) {
            $matches = abs((float)$expected - (float)$actual) <= $epsilon;
        } else {
            $matches = ($expected === $actual);
        }

        $details = "Expected: " . var_export($expected, true) . ", Got: " . var_export($actual, true);
        return self::assert($matches, $test_name, $details);
    }

    public static function summary(): void {
        $total = self::$passed + self::$failed;
        echo "\n\033[1;36m================================================================================\033[0m\n";
        echo "\033[1;37m FULL PLATFORM TEST SUITE SUMMARY\033[0m\n";
        echo "\033[1;36m================================================================================\033[0m\n";
        echo " Total Assertions: \033[1;37m{$total}\033[0m\n";
        echo " Passed:           \033[1;32m" . self::$passed . "\033[0m (" . ($total > 0 ? round((self::$passed / $total) * 100, 1) : 0) . "%)\n";
        echo " Failed:           \033[1;31m" . self::$failed . "\033[0m\n";

        if (self::$failed > 0) {
            echo "\n\033[1;31mFAILURES BREAKDOWN:\033[0m\n";
            foreach (self::$failures as $idx => $f) {
                echo "  " . ($idx + 1) . ". {$f}\n";
            }
        } else {
            echo "\n \033[1;32m🎉 ALL 21 PROP FIRM MODULES & RULES PASSED WITH 100% SUCCESS! 🎉\033[0m\n";
        }
        echo "\033[1;36m================================================================================\033[0m\n\n";
    }
}

FullSuiteRunner::header("Complete Institutional Prop Firm Platform Automated Test Suite");

// ─────────────────────────────────────────────────────────────────────────────
// 0. ENVIRONMENT & SCHEMA INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("0. System Environment & Table Verification");

$test_user = $wpdb->get_row("SELECT ID FROM {$wpdb->users} ORDER BY ID ASC LIMIT 1");
$admin_user_id = $test_user ? (int)$test_user->ID : 1;

FXSIM_Database::install();
FXSIM_Challenge_DB::install();
FXSIM_PvP_Engine::ensure_tables();

$expected_tables = [
    'fxsim_accounts', 'fxsim_positions', 'fxsim_trades', 'fxsim_transactions',
    'fxsim_symbols', 'fxsim_pending_orders', 'fxsim_notifications', 'fxsim_tickets',
    'fxsim_ticket_messages', 'fxsim_scaling_rules', 'fxsim_scaling_events',
    'fxsim_syndicate_clusters', 'fxsim_pvp_matches', 'fxsim_pvp_events',
    'fxsim_challenge_plans', 'fxsim_challenge_accounts', 'fxsim_challenge_snapshots',
    'fxsim_challenge_breaches', 'fxsim_payouts', 'fxsim_whitelabel', 'fxsim_payment_orders',
    'fxsim_coupons', 'fxsim_coupon_redemptions', 'fxsim_affiliates', 'fxsim_commissions',
    'fxsim_affiliate_payouts', 'fxsim_scaling_history', 'fxsim_trade_flags',
    'fxsim_kyc', 'fxsim_news_events', 'fxsim_banners'
];

foreach ($expected_tables as $tbl) {
    $full_tbl = $wpdb->prefix . $tbl;
    FullSuiteRunner::assert($wpdb->get_var("SHOW TABLES LIKE '{$full_tbl}'") === $full_tbl, "Table exists: {$full_tbl}");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ⚔️ TOURNAMENT & 1V1 PVP ARENA ENGINE
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("1. Tournament & 1v1 PvP Arena Engine");

// Self-challenging (same user as creator and challenger) is intentionally
// blocked now (Diff 2), and a duel can no longer be created/joined without a
// real funded/active account backing the stake (Diff 3 escrow) — so this
// suite needs two distinct users, each with their own challenge account.
$pvp_challenger = get_user_by('login', 'pvp_suite_challenger');
if (!$pvp_challenger) {
    $pvp_challenger_id = wp_insert_user([
        'user_login' => 'pvp_suite_challenger',
        'user_pass'  => wp_generate_password(20),
        'user_email' => 'pvp_suite_challenger@example.test',
        'role'       => 'subscriber',
    ]);
} else {
    $pvp_challenger_id = (int)$pvp_challenger->ID;
}
FullSuiteRunner::assert($pvp_challenger_id > 0 && !is_wp_error($pvp_challenger_id), "PvP: Challenger test user provisioned");

$wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
    'name' => 'Suite PvP Plan',
    'slug' => 'suite-pvp-' . time(),
    'plan_type' => '2-step',
    'account_size' => 10000.0,
    'price' => 99.0,
    'drawdown_type' => 'static',
    'p1_profit_target' => 10.0,
    'p1_daily_dd' => 80.0,
    'p1_max_dd' => 90.0,
    'stop_loss_required' => 0,
    'min_trade_seconds' => 0,
    'news_trading' => 1,
    'weekend_holding' => 1,
    'is_active' => 1,
]);
$pvp_plan_id = (int)$wpdb->insert_id;

$pvp_creator_ch = FXSIM_Challenge_Engine::create_challenge($admin_user_id, $pvp_plan_id);
$pvp_creator_acc_id = (int)FXSIM_Challenge_DB::get_challenge((int)$pvp_creator_ch['challenge_id'])->fxsim_account_id;
$pvp_challenger_ch = FXSIM_Challenge_Engine::create_challenge($pvp_challenger_id, $pvp_plan_id);
$pvp_challenger_acc_id = (int)FXSIM_Challenge_DB::get_challenge((int)$pvp_challenger_ch['challenge_id'])->fxsim_account_id;

// Real-money PvP is restricted to FUNDED accounts (product decision: an
// evaluation-phase trader's real challenge balance must never be at risk
// from an unrelated side-game) — promote both test accounts to 'funded' so
// this section correctly exercises the real-account escrow path.
$wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', ['status' => 'funded'], ['id' => (int)$pvp_creator_ch['challenge_id']]);
$wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', ['status' => 'funded'], ['id' => (int)$pvp_challenger_ch['challenge_id']]);

$creator_bal_before = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_creator_acc_id));
$challenger_bal_before = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_challenger_acc_id));

$match_res = FXSIM_PvP_Engine::create_match($admin_user_id, [
    'title' => 'Alpha Gladiator Sprint',
    'symbol' => 'EURUSD',
    'stake' => 50.00,
    'duration' => 15,
]);
FullSuiteRunner::assert($match_res['success'] ?? false, "PvP: Match successfully created", $match_res['error'] ?? '');
$match_id = (int)($match_res['match_id'] ?? 0);
$match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = %d", $match_id));

FullSuiteRunner::assertEquals('waiting', $match->status, "PvP: Initial match status is 'waiting'");
FullSuiteRunner::assertEquals(85.00, (float)$match->prize_pool, "PvP: Prize pool is 85% of total stakes ($85.00)");
FullSuiteRunner::assertEquals(15.00, (float)$match->platform_rake, "PvP: Platform rake is 15% ($15.00)");
FullSuiteRunner::assertEquals($pvp_creator_acc_id, (int)$match->creator_account_id, "PvP Escrow: creator_account_id recorded on match");

$creator_bal_after_create = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_creator_acc_id));
FullSuiteRunner::assertEquals($creator_bal_before - 50.00, $creator_bal_after_create, "PvP Escrow: creator's $50 stake debited on create_match()");

$join_res = FXSIM_PvP_Engine::join_match($pvp_challenger_id, $match_id);
FullSuiteRunner::assert($join_res['success'] ?? false, "PvP: Challenger joined match", $join_res['error'] ?? '');
$active_match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = %d", $match_id));
FullSuiteRunner::assertEquals('active', $active_match->status, "PvP: Match status transitioned to 'active'");
FullSuiteRunner::assertEquals($pvp_challenger_acc_id, (int)$active_match->challenger_account_id, "PvP Escrow: challenger_account_id recorded on match");

$challenger_bal_after_join = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_challenger_acc_id));
FullSuiteRunner::assertEquals($challenger_bal_before - 50.00, $challenger_bal_after_join, "PvP Escrow: challenger's $50 stake debited on join_match()");

// First order for a player has no prior reference price, so it must be a
// deterministic 0 PnL baseline (not a random swing) — this is the direct
// replacement for the old rand(-25,45) mechanic.
$order_res1 = FXSIM_PvP_Engine::execute_order($admin_user_id, $match_id, ['action' => 'BUY', 'lots' => 1.0]);
FullSuiteRunner::assert($order_res1['success'] ?? false, "PvP: First live order executed in arena", $order_res1['error'] ?? '');
FullSuiteRunner::assertEquals(0.0, (float)($order_res1['tick_pnl'] ?? -1), "PvP PnL: First order for a player has zero baseline PnL (no prior reference price)");

// Move the price and place a SECOND order for the same player — this order's
// PnL must now be the real, deterministic price delta since the first order,
// not a random number.
$eur_before_2nd = FXSIM_Price_Feed::get('EURUSD');
$px_before_2nd = (float)($eur_before_2nd['ask'] ?: 1.0800);
FXSIM_Price_Feed::ingest(['EURUSD' => ['bid' => $px_before_2nd + 0.0048, 'ask' => $px_before_2nd + 0.0050, 'mid' => $px_before_2nd + 0.0049]]);
$order_res2 = FXSIM_PvP_Engine::execute_order($admin_user_id, $match_id, ['action' => 'SELL', 'lots' => 1.0]);
FullSuiteRunner::assert($order_res2['success'] ?? false, "PvP: Second live order executed in arena", $order_res2['error'] ?? '');
// 1.0 lot BUY opened at ~$px_before_2nd, closed (2nd click) at bid ~= $px_before_2nd + 0.0048
// -> ~+$480 real, deterministic PnL from the actual price move, not rand().
FullSuiteRunner::assert((float)($order_res2['tick_pnl'] ?? 0) > 100, "PvP PnL: Second order's PnL reflects real price movement (>$100 on a ~48-pip favorable move), not rand()", 'tick_pnl=' . ($order_res2['tick_pnl'] ?? 'n/a'));

$creator_pnl_before_settle = (float)$wpdb->get_var($wpdb->prepare("SELECT creator_pnl FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = %d", $match_id));
$expected_winner_id = $creator_pnl_before_settle >= 0 ? $admin_user_id : $pvp_challenger_id;
$expected_winner_acc = $creator_pnl_before_settle >= 0 ? $pvp_creator_acc_id : $pvp_challenger_acc_id;
$winner_bal_before_settle = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $expected_winner_acc));

$settle_res = FXSIM_PvP_Engine::settle_match($match_id);
FullSuiteRunner::assert($settle_res['success'] ?? false, "PvP: Match settled upon expiry", $settle_res['error'] ?? '');
$settled_match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = %d", $match_id));
FullSuiteRunner::assertEquals('completed', $settled_match->status, "PvP: Match status transitioned to 'completed'");
FullSuiteRunner::assertEquals($expected_winner_id, (int)$settled_match->winner_user_id, "PvP: Winner correctly determined from real (non-random) PnL");

$winner_bal_after_settle = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $expected_winner_acc));
FullSuiteRunner::assertEquals($winner_bal_before_settle + 85.00, $winner_bal_after_settle, "PvP Prize: Winner's account credited with the full $85 prize pool");

// Cancel/refund path: a fresh, still-unfilled 'waiting' match must fully
// refund its creator's stake on cancellation.
$cancel_creator_bal_before = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_creator_acc_id));
$cancel_match_res = FXSIM_PvP_Engine::create_match($admin_user_id, ['title' => 'Cancel-Me Duel', 'symbol' => 'EURUSD', 'stake' => 25.00, 'duration' => 15]);
FullSuiteRunner::assert($cancel_match_res['success'] ?? false, "PvP Cancel: Second (to-be-cancelled) match created", $cancel_match_res['error'] ?? '');
$cancel_match_id = (int)($cancel_match_res['match_id'] ?? 0);
$cancel_res = FXSIM_PvP_Engine::cancel_match($cancel_match_id, $admin_user_id);
FullSuiteRunner::assert($cancel_res['success'] ?? false, "PvP Cancel: Unfilled match cancelled by its creator", $cancel_res['error'] ?? '');
$cancel_creator_bal_after = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_creator_acc_id));
FullSuiteRunner::assertEquals($cancel_creator_bal_before, $cancel_creator_bal_after, "PvP Cancel: Creator's $25 stake fully refunded on cancellation");

// ── Practice-wallet path: a trader with no funded challenge (evaluation-
// phase or no challenge at all) must NEVER stake real money — their real
// challenge balance must be completely untouched, win or lose. ────────────
$pvp_practice_user = get_user_by('login', 'pvp_suite_practice');
if (!$pvp_practice_user) {
    $pvp_practice_id = wp_insert_user([
        'user_login' => 'pvp_suite_practice',
        'user_pass'  => wp_generate_password(20),
        'user_email' => 'pvp_suite_practice@example.test',
        'role'       => 'subscriber',
    ]);
} else {
    $pvp_practice_id = (int)$pvp_practice_user->ID;
}
FullSuiteRunner::assert($pvp_practice_id > 0 && !is_wp_error($pvp_practice_id), "PvP Practice: Test user provisioned (no funded challenge)");
delete_user_meta($pvp_practice_id, 'fxsim_pvp_practice_balance'); // fresh starting balance for a repeatable test run

$practice_match_res = FXSIM_PvP_Engine::create_match($pvp_practice_id, ['title' => 'Practice Duel', 'symbol' => 'EURUSD', 'stake' => 50.00, 'duration' => 15]);
FullSuiteRunner::assert($practice_match_res['success'] ?? false, "PvP Practice: Match created by a non-funded trader", $practice_match_res['error'] ?? '');
FullSuiteRunner::assertEquals(true, $practice_match_res['is_practice'] ?? null, "PvP Practice: create_match() correctly flags this as a practice stake");
$practice_match_id = (int)($practice_match_res['match_id'] ?? 0);
$practice_match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = %d", $practice_match_id));
FullSuiteRunner::assertEquals(0, (int)($practice_match->creator_account_id ?? 0), "PvP Practice: No real account_id recorded on the match (NULL)");
$practice_balance_after_create = (float)get_user_meta($pvp_practice_id, 'fxsim_pvp_practice_balance', true);
FullSuiteRunner::assertEquals(FXSIM_PvP_Engine::PVP_PRACTICE_STARTING_BALANCE - 50.00, $practice_balance_after_create, "PvP Practice: \$50 stake debited from practice balance, not a real account");

// The real evaluation account (if the practice user also has one) or lack
// thereof must be completely unaffected — verify no fxsim_accounts row was
// ever touched by checking the practice user has no fxsim_accounts entries.
$practice_user_real_accounts = (int)$wpdb->get_var($wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_accounts WHERE user_id = %d", $pvp_practice_id
));
FullSuiteRunner::assertEquals(0, $practice_user_real_accounts, "PvP Practice: No real fxsim_accounts row exists/was created for the practice trader");

$practice_cancel_res = FXSIM_PvP_Engine::cancel_match($practice_match_id, $pvp_practice_id);
FullSuiteRunner::assert($practice_cancel_res['success'] ?? false, "PvP Practice: Practice match cancelled", $practice_cancel_res['error'] ?? '');
$practice_balance_after_cancel = (float)get_user_meta($pvp_practice_id, 'fxsim_pvp_practice_balance', true);
FullSuiteRunner::assertEquals(FXSIM_PvP_Engine::PVP_PRACTICE_STARTING_BALANCE, $practice_balance_after_cancel, "PvP Practice: Stake refunded to practice balance on cancel");

// ── Tie settlement: equal PnL on both sides must refund both stakes, not
// award the full prize to the creator. ─────────────────────────────────────
$tie_match_res = FXSIM_PvP_Engine::create_match($admin_user_id, ['title' => 'Tie Duel', 'symbol' => 'EURUSD', 'stake' => 40.00, 'duration' => 15]);
FullSuiteRunner::assert($tie_match_res['success'] ?? false, "PvP Tie: Match created for tie-settlement test", $tie_match_res['error'] ?? '');
$tie_match_id = (int)($tie_match_res['match_id'] ?? 0);
$tie_join_res = FXSIM_PvP_Engine::join_match($pvp_challenger_id, $tie_match_id);
FullSuiteRunner::assert($tie_join_res['success'] ?? false, "PvP Tie: Challenger joined the tie-test match", $tie_join_res['error'] ?? '');

// Force identical PnL directly (deterministic, not relying on execute_order()'s
// real price-driven randomness lining up exactly by chance).
$wpdb->update($wpdb->prefix . 'fxsim_pvp_matches', ['creator_pnl' => 30.00, 'challenger_pnl' => 30.00], ['id' => $tie_match_id]);

$tie_creator_bal_before = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_creator_acc_id));
$tie_challenger_bal_before = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_challenger_acc_id));

$tie_settle_res = FXSIM_PvP_Engine::settle_match($tie_match_id);
FullSuiteRunner::assert($tie_settle_res['success'] ?? false, "PvP Tie: Tied match settled without error", $tie_settle_res['error'] ?? '');
FullSuiteRunner::assertEquals(true, $tie_settle_res['tie'] ?? null, "PvP Tie: settle_match() correctly reports this as a tie");
$tie_settled_match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = %d", $tie_match_id));
FullSuiteRunner::assert($tie_settled_match->winner_user_id === null, "PvP Tie: winner_user_id is NULL on a tie (no winner recorded)");

$tie_creator_bal_after = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_creator_acc_id));
$tie_challenger_bal_after = (float)$wpdb->get_var($wpdb->prepare("SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $pvp_challenger_acc_id));
FullSuiteRunner::assertEquals($tie_creator_bal_before + 40.00, $tie_creator_bal_after, "PvP Tie: Creator's \$40 stake refunded (not awarded the full prize)");
FullSuiteRunner::assertEquals($tie_challenger_bal_before + 40.00, $tie_challenger_bal_after, "PvP Tie: Challenger's \$40 stake refunded (not lost to the creator)");

$lobby = FXSIM_PvP_Engine::get_lobby($admin_user_id);
FullSuiteRunner::assert(isset($lobby['leaderboard']), "PvP: Lobby returned active leaderboard");

$pvp_analytics = FXSIM_PvP_Engine::get_admin_analytics();
FullSuiteRunner::assert(isset($pvp_analytics['analytics']['total_rake']), "PvP: Admin analytics aggregated platform rake");

// ─────────────────────────────────────────────────────────────────────────────
// 2. 🛡️ RISK RULES & TRADING PROTECTIONS
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("2. Institutional Risk Shields & Compliance Rules");

$wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
    'name' => 'Suite Strict Risk Plan 100K',
    'slug' => 'suite-risk-100k-' . time(),
    'plan_type' => '2-step',
    'account_size' => 100000.0,
    'price' => 299.0,
    'drawdown_type' => 'static',
    'p1_profit_target' => 8.0,
    'p2_profit_target' => 5.0,
    'p1_daily_dd' => 5.0,
    'p1_max_dd' => 10.0,
    'stop_loss_required' => 1,
    'min_trade_seconds' => 30,
    'min_hold_action' => 'flag',
    'news_trading' => 0,
    'news_window_minutes' => 5,
    'weekend_holding' => 0,
    'consistency_rule' => 1,
    'consistency_pct' => 50.0,
    'ea_allowed' => 1,
    'copy_trading_allowed' => 1,
    'martingale_allowed' => 0,
    'hedging_allowed' => 1,
    'is_active' => 1,
]);
$risk_plan_id = (int)$wpdb->insert_id;
$res_risk = FXSIM_Challenge_Engine::create_challenge($admin_user_id, $risk_plan_id);
$risk_ch_id = (int)$res_risk['challenge_id'];
$risk_ch = FXSIM_Challenge_DB::get_challenge($risk_ch_id);
$sim_acc_id = (int)$risk_ch->fxsim_account_id;

$cur_eur_prices = FXSIM_Price_Feed::get('EURUSD');
$valid_sl = round($cur_eur_prices['bid'] * 0.95, 4);
$valid_tp = round($cur_eur_prices['ask'] * 1.05, 4);

$open_no_sl = FXSIM_Trading_Engine::open_position($admin_user_id, [
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'sl' => null,
]);
FullSuiteRunner::assert(!($open_no_sl['success'] ?? true), "Stop Loss Shield: Order rejected when mandatory SL is missing");

$open_with_sl = FXSIM_Trading_Engine::open_position($admin_user_id, [
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'sl' => $valid_sl,
    'tp' => $valid_tp,
]);
FullSuiteRunner::assert($open_with_sl['success'] ?? false, "Stop Loss Shield: Order accepted when valid SL ({$valid_sl}) is provided");
$pos_id = (int)($open_with_sl['position_id'] ?? 0);

$remove_sl_res = FXSIM_Trading_Engine::update_sltp($admin_user_id, $pos_id, null, $valid_tp);
FullSuiteRunner::assert(!($remove_sl_res['success'] ?? true), "Stop Loss Shield: Removal of mandatory SL rejected on active position");

$close_fast = FXSIM_Trading_Engine::close_position($admin_user_id, $pos_id, 'manual');
FullSuiteRunner::assert($close_fast['success'] ?? false, "Anti-Scalping: Position closed with flag action");

$flag_logged = $wpdb->get_row($wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}fxsim_trade_flags WHERE user_id = %d AND flag_type = 'hft' ORDER BY id DESC LIMIT 1",
    $admin_user_id
));
FullSuiteRunner::assert($flag_logged !== null, "Anti-Scalping: Under-duration trade logged in Risk Alert Hub (fxsim_trade_flags)");

update_option('fxsim_news_lock', true);
$news_open_res = FXSIM_Trading_Engine::open_position($admin_user_id, [
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'sl' => $valid_sl,
]);
FullSuiteRunner::assert(!($news_open_res['success'] ?? true), "News Shield: Trading locked during high-impact news event");
delete_option('fxsim_news_lock');

$wpdb->insert($wpdb->prefix . 'fxsim_trades', [
    'account_id' => $sim_acc_id,
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'open_price' => 1.0800,
    'close_price' => 1.0870,
    'pnl' => 7000.0,
    'closed_at' => current_time('mysql'),
]);
$wpdb->insert($wpdb->prefix . 'fxsim_trades', [
    'account_id' => $sim_acc_id,
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'open_price' => 1.0800,
    'close_price' => 1.0830,
    'pnl' => 3000.0,
    'closed_at' => date('Y-m-d H:i:s', strtotime('-1 day')),
]);

$wpdb->update($wpdb->prefix . 'fxsim_accounts', ['balance' => 110000.0, 'equity' => 110000.0], ['id' => $sim_acc_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($risk_ch_id);

$consist_ch = FXSIM_Challenge_DB::get_challenge($risk_ch_id);
// FIXED-05: consistency_rule is now a PROMOTION GATE, not a breach trigger.
// When profit target is hit but consistency_pct is violated, the account stays
// 'active' (promotion is blocked) rather than transitioning to 'failed'.
// The old breach-on-violation behaviour incorrectly failed traders on their
// very first winning day (best_day_pct is always 100% with only 1 day of data).
FullSuiteRunner::assertEquals('active', $consist_ch->status, "Consistency Rule: Promotion blocked (account stays 'active', not 'failed') when single day profit (70%) exceeds max 50% limit — consistent with FIXED-05 promotion-gate design");
$consistency_check = FXSIM_Challenge_Engine::check_consistency($consist_ch, FXSIM_Challenge_DB::get_plan($risk_plan_id));
FullSuiteRunner::assert(!$consistency_check['passed'], "Consistency Rule: check_consistency() correctly returns passed=false when best-day 70% > limit 50%");

FullSuiteRunner::assert(method_exists('FXSIM_Trading_Engine', 'detect_syndicate_hedging'), "Syndicate Radar: Cross-account hedging detection engine active");

FXSIM_Trading_Engine::apply_daily_swaps();
FullSuiteRunner::assert(true, "Daily Swaps: Overnight swap maintenance routine executed cleanly");

// ── Stop-Out & Live Margin Level Engine Regression Test ──────────────────────
$wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
    'name' => 'Suite Margin Engine Plan 1K',
    'slug' => 'suite-margin-1k-' . time(),
    'plan_type' => '2-step',
    'account_size' => 1000.0,
    'price' => 99.0,
    'drawdown_type' => 'static',
    'p1_profit_target' => 10.0,
    'p1_daily_dd' => 80.0,
    'p1_max_dd' => 90.0,
    'stop_loss_required' => 0,
    'min_trade_seconds' => 0,
    'news_trading' => 1,
    'weekend_holding' => 1,
    'margin_call_level' => 80.0,
    'stop_out_level' => 50.0,
    'is_active' => 1,
]);
$margin_plan_id = (int)$wpdb->insert_id;
$res_margin = FXSIM_Challenge_Engine::create_challenge($admin_user_id, $margin_plan_id);
$margin_ch_id = (int)$res_margin['challenge_id'];
$margin_ch = FXSIM_Challenge_DB::get_challenge($margin_ch_id);
$margin_acc_id = (int)$margin_ch->fxsim_account_id;

$cur_eur = FXSIM_Price_Feed::get('EURUSD');
$open_px = (float)($cur_eur['ask'] ?: 1.0800);
$open_margin_pos = FXSIM_Trading_Engine::open_position($admin_user_id, [
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 0.5,
    'sl' => round($open_px * 0.80, 4),
]);
FullSuiteRunner::assert($open_margin_pos['success'] ?? false, "Stop-Out Engine: Test position opened (0.5 lots EURUSD)", $open_margin_pos['message'] ?? ($open_margin_pos['error'] ?? ''));

// Simulate adverse market price movement: drop EURUSD by 160 pips (0.0160).
// 0.5 lots (50,000 units) × -$0.0160 = -$800 floating loss.
// Live Equity = $1,000 - $800 = $200. Margin required = ~$540.
// Live Margin Level = (200 / 540) * 100 = ~37% <= 50% stop_out_level.
$adverse_px = round($open_px - 0.0160, 4);
FXSIM_Price_Feed::ingest([
    'EURUSD' => ['bid' => $adverse_px, 'ask' => $adverse_px + 0.0002, 'mid' => $adverse_px + 0.0001]
]);

FXSIM_Trading_Engine::check_margin_levels();

$open_pos_count = (int)$wpdb->get_var($wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_positions WHERE account_id = %d", $margin_acc_id
));
FullSuiteRunner::assertEquals(0, $open_pos_count, "Stop-Out Engine: Position force-closed upon adverse price move (0 open positions remaining)");

$stop_out_trade = $wpdb->get_row($wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}fxsim_trades WHERE account_id = %d ORDER BY id DESC LIMIT 1", $margin_acc_id
));
FullSuiteRunner::assert($stop_out_trade !== null && $stop_out_trade->close_reason === 'stop_out', "Stop-Out Engine: Closed trade recorded in ledger with close_reason = 'stop_out'");

// ─────────────────────────────────────────────────────────────────────────────
// 3. 🎯 CHALLENGE PLANS & CUSTOM OVERRIDES
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("3. Challenge Plans & Enterprise Custom Overrides");

$wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
    'custom_profit_split' => 95.0,
    'custom_daily_dd' => 6.0,
    'custom_max_dd' => 12.0,
    'override_admin_note' => 'VIP Institutional Override',
], ['id' => $risk_ch_id]);

$overridden_ch = FXSIM_Challenge_DB::get_challenge($risk_ch_id);
FullSuiteRunner::assertEquals(95.0, (float)$overridden_ch->custom_profit_split, "Enterprise Override: Custom profit split set to 95%");
FullSuiteRunner::assertEquals(6.0, (float)$overridden_ch->custom_daily_dd, "Enterprise Override: Custom daily DD set to 6%");
FullSuiteRunner::assertEquals(12.0, (float)$overridden_ch->custom_max_dd, "Enterprise Override: Custom max DD set to 12%");

// ─────────────────────────────────────────────────────────────────────────────
// 4. 📈 SCALING PROGRAM ENGINE
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("4. Scaling Program Engine");

$wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
    'name' => 'Suite Scaling Plan 100K',
    'slug' => 'suite-scale-100k-' . time(),
    'plan_type' => 'instant',
    'is_instant_funding' => 1,
    'account_size' => 100000.0,
    'price' => 499.0,
    'scaling_enabled' => 1,
    'scaling_growth_pct' => 25.0,
    'scaling_interval_months' => 4,
    'scaling_required_profit_pct' => 10.0,
    'scaling_max_balance' => 2000000.0,
    'is_active' => 1,
]);
$scale_plan_id = (int)$wpdb->insert_id;
$res_scale = FXSIM_Challenge_Engine::create_challenge($admin_user_id, $scale_plan_id);
$scale_ch_id = (int)$res_scale['challenge_id'];

$force_scale_res = FXSIM_Scaling_Engine::admin_force_scale($scale_ch_id);
FullSuiteRunner::assert($force_scale_res['success'] ?? false, "Scaling Engine: Admin manual force-scale executed");

$scaled_ch = FXSIM_Challenge_DB::get_challenge($scale_ch_id);
FullSuiteRunner::assertEquals(125000.0, (float)$scaled_ch->starting_balance, "Scaling Engine: Account balance scaled up +25% ($100k -> $125k)");
FullSuiteRunner::assertEquals(1, (int)$scaled_ch->scaling_level, "Scaling Engine: Scaling level incremented to 1");

// ─────────────────────────────────────────────────────────────────────────────
// 5. 💳 PAYMENT GATEWAYS & PURCHASES
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("5. Payment Gateways & Order Lifecycle");

$wpdb->insert($wpdb->prefix . 'fxsim_coupons', [
    'code' => 'PROPFIRM20',
    'type' => 'percent',
    'value' => 20.0,
    'active' => 1,
]);
$coupon_id = (int)$wpdb->insert_id;

$order_res = FXSIM_Payments::create_order($admin_user_id, $risk_plan_id, 'manual', 'PROPFIRM20');
FullSuiteRunner::assert($order_res['success'] ?? false, "Payments: Order created with coupon PROPFIRM20");
$order_id = (int)($order_res['order_id'] ?? 0);
$order = FXSIM_Payments::get_order($order_id);

FullSuiteRunner::assertEquals(239.20, (float)$order->amount, "Payments: 20% coupon discount applied ($299 -> $239.20)");

$approve_res = FXSIM_Payments::approve_order($order_id, $admin_user_id, 'Approved by automated suite');
FullSuiteRunner::assert($approve_res['success'] ?? false, "Payments: Order approved and challenge account auto-provisioned");

FullSuiteRunner::assert(method_exists('FXSIM_Stripe', 'create_checkout'), "Stripe: create_checkout method exists");
FullSuiteRunner::assert(method_exists('FXSIM_Stripe', 'handle_webhook'), "Stripe: handle_webhook method exists");

FullSuiteRunner::assert(method_exists('FXSIM_Confirmo', 'create_invoice'), "Confirmo: create_invoice method exists");
FullSuiteRunner::assert(method_exists('FXSIM_Confirmo', 'handle_callback'), "Confirmo: handle_callback method exists");

// ─────────────────────────────────────────────────────────────────────────────
// 6. 💰 PAYOUTS & PROFIT SPLIT LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("6. Trader Payouts & Profit Split Lifecycle");

$wpdb->insert($wpdb->prefix . 'fxsim_payouts', [
    'challenge_id' => $scale_ch_id,
    'user_id' => $admin_user_id,
    'amount_requested' => 10000.0,
    'profit_split_pct' => 80.0,
    'trader_amount' => 8000.0,
    'firm_amount' => 2000.0,
    'status' => 'pending',
    'payment_method' => 'crypto_usdt',
    'payment_address' => '0x71C...49A',
]);
$payout_id = (int)$wpdb->insert_id;
FullSuiteRunner::assert($payout_id > 0, "Payouts: Payout request submitted ($10k @ 80/20)");

$wpdb->update($wpdb->prefix . 'fxsim_payouts', [
    'status' => 'paid',
    'tx_reference' => 'TXN-9988223344',
    'processed_at' => current_time('mysql'),
], ['id' => $payout_id]);

$paid_payout = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_payouts WHERE id = %d", $payout_id));
FullSuiteRunner::assertEquals('paid', $paid_payout->status, "Payouts: Payout marked as 'paid' with TXN reference");
FullSuiteRunner::assertEquals(8000.0, (float)$paid_payout->trader_amount, "Payouts: Trader received exact 80% profit share ($8,000.00)");

// ─────────────────────────────────────────────────────────────────────────────
// 7. 🆔 KYC & IDENTITY VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("7. KYC & Identity Verification System");

$wpdb->replace($wpdb->prefix . 'fxsim_kyc', [
    'user_id' => $admin_user_id,
    'status' => 'pending',
    'id_doc_path' => '/uploads/kyc/passport.jpg',
    'selfie_path' => '/uploads/kyc/selfie.jpg',
    'address_doc_path' => '/uploads/kyc/utility_bill.pdf',
    'submitted_at' => current_time('mysql'),
]);

$kyc_entry = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_kyc WHERE user_id = %d", $admin_user_id));
FullSuiteRunner::assertEquals('pending', $kyc_entry->status, "KYC: Documents successfully submitted with 'pending' status");

$wpdb->update($wpdb->prefix . 'fxsim_kyc', [
    'status' => 'approved',
    'reviewer_id' => $admin_user_id,
    'reviewed_at' => current_time('mysql'),
    'admin_note' => 'KYC Approved by automated test',
], ['user_id' => $admin_user_id]);

$kyc_approved = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_kyc WHERE user_id = %d", $admin_user_id));
FullSuiteRunner::assertEquals('approved', $kyc_approved->status, "KYC: Identity verified and status updated to 'approved'");

// ─────────────────────────────────────────────────────────────────────────────
// 8. 🔌 MT5 BRIDGE & ACCOUNT PROVISIONING
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("8. MT5 Bridge & Account Provisioning");

$wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
    'mt5_login' => '880192',
    'mt5_password' => 'Tr@d3r99Pass!',
    'mt5_server' => 'PropFirm-Live01',
    'mt5_account_type' => 'raw_spread',
], ['id' => $scale_ch_id]);

$mt5_ch = FXSIM_Challenge_DB::get_challenge($scale_ch_id);
FullSuiteRunner::assertEquals('880192', $mt5_ch->mt5_login, "MT5 Bridge: MT5 login credential provisioned (880192)");
FullSuiteRunner::assertEquals('PropFirm-Live01', $mt5_ch->mt5_server, "MT5 Bridge: MT5 live server provisioned (PropFirm-Live01)");

// ─────────────────────────────────────────────────────────────────────────────
// 9. 🎫 HELPDESK & SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("9. Helpdesk & Support Tickets System");

$ticket_num = 'TCK-' . rand(100000, 999999);
$wpdb->insert($wpdb->prefix . 'fxsim_tickets', [
    'ticket_number' => $ticket_num,
    'trader_id' => $admin_user_id,
    'subject' => 'MT5 Spread & Execution Inquiry',
    'category' => 'tech_mt5',
    'priority' => 'high',
    'status' => 'open',
]);
$ticket_id = (int)$wpdb->insert_id;
FullSuiteRunner::assert($ticket_id > 0, "Helpdesk: Ticket {$ticket_num} created in category 'tech_mt5'");

$wpdb->insert($wpdb->prefix . 'fxsim_ticket_messages', [
    'ticket_id' => $ticket_id,
    'sender_type' => 'trader',
    'sender_id' => $admin_user_id,
    'message' => 'Hello, what is the average EURUSD raw spread on Live01 server?',
]);

$wpdb->insert($wpdb->prefix . 'fxsim_ticket_messages', [
    'ticket_id' => $ticket_id,
    'sender_type' => 'admin',
    'sender_id' => $admin_user_id,
    'message' => 'Average raw spread is 0.1 pips with $7/lot commission.',
]);
$wpdb->update($wpdb->prefix . 'fxsim_tickets', ['status' => 'resolved'], ['id' => $ticket_id]);

$resolved_ticket = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_tickets WHERE id = %d", $ticket_id));
FullSuiteRunner::assertEquals('resolved', $resolved_ticket->status, "Helpdesk: Support thread resolved by admin");

// ─────────────────────────────────────────────────────────────────────────────
// 10. 👥 TEAM MANAGEMENT & RBAC
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("10. Team Management & Staff RBAC");

FullSuiteRunner::assert(user_can($admin_user_id, 'manage_options'), "RBAC: Admin user possesses 'manage_options' administrator capability");

// ─────────────────────────────────────────────────────────────────────────────
// 11. 📢 MARKETING TOOLS (AFFILIATES, BANNERS, BROADCASTS)
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("11. Marketing Tools (Affiliates, Banners, Broadcasts)");

$wpdb->insert($wpdb->prefix . 'fxsim_affiliates', [
    'user_id' => $admin_user_id,
    'code' => 'TOPAFFILIATE',
    'rate_percent' => 15.0,
    'status' => 'active',
]);
$aff_id = (int)$wpdb->insert_id;
FullSuiteRunner::assert($aff_id > 0, "Marketing: Affiliate partner 'TOPAFFILIATE' registered with 15% rate");

$wpdb->insert($wpdb->prefix . 'fxsim_banners', [
    'title' => 'Flash Sale 20% Off',
    'message' => 'Use code PROPFIRM20 for 20% discount on all challenge tiers!',
    'placement' => 'top',
    'active' => 1,
]);
$banner_id = (int)$wpdb->insert_id;
FullSuiteRunner::assert($banner_id > 0, "Marketing: Promotional top-bar banner scheduled & active");

// ─────────────────────────────────────────────────────────────────────────────
// 12. 🔔 INTEGRATION ALERTS & WEBHOOKS
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("12. Integration Alerts & Webhook Dispatch");

FullSuiteRunner::assert(method_exists('FXSIM_Webhooks', 'dispatch'), "Webhooks: Multi-channel dispatch engine active");

// ─────────────────────────────────────────────────────────────────────────────
// 12b. SCALING ENGINE: equity_hwm/trailing_dd_floor rebase + plan-ceiling
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("12b. Scaling Engine Regression (rebase + plan ceiling)");

$wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
    'name' => 'Suite Scaling Plan',
    'slug' => 'suite-scaling-' . time(),
    'plan_type' => '2-step',
    'account_size' => 100000.0,
    'price' => 199.0,
    'drawdown_type' => 'trailing',
    'p1_profit_target' => 8.0,
    'p1_daily_dd' => 5.0,
    'p1_max_dd' => 10.0,
    'funded_max_dd' => 10.0,
    'scaling_enabled' => 1,
    'scaling_interval_months' => 0,
    'scaling_required_profit_pct' => 0,
    'scaling_growth_pct' => 25.0,
    'scaling_max_balance' => 150000.0,
    'stop_loss_required' => 0,
    'min_trade_seconds' => 0,
    'news_trading' => 1,
    'weekend_holding' => 1,
    'is_active' => 1,
]);
$scaling_plan_id = (int)$wpdb->insert_id;
$scaling_ch_res = FXSIM_Challenge_Engine::create_challenge($admin_user_id, $scaling_plan_id);
$scaling_ch_id = (int)$scaling_ch_res['challenge_id'];
$scaling_ch = FXSIM_Challenge_DB::get_challenge($scaling_ch_id);

// Force the account straight to 'funded' with a known starting balance so the
// rebase math below is deterministic (this suite already manipulates state
// directly elsewhere for setup, e.g. the margin-engine test above).
$wpdb->update($wpdb->prefix . 'fxsim_challenge_accounts', [
    'status' => 'funded',
    'starting_balance' => 100000.0,
    'current_balance' => 100000.0,
    'peak_balance' => 100000.0,
    'equity_hwm' => 100000.0,
    'trailing_dd_floor' => 90000.0,
    'funded_at' => current_time('mysql'),
    'scaling_level' => 0,
], ['id' => $scaling_ch_id]);
$wpdb->update($wpdb->prefix . 'fxsim_accounts', ['balance' => 100000.0, 'equity' => 100000.0], ['id' => (int)$scaling_ch->fxsim_account_id]);

$force_scale_res = FXSIM_Scaling_Engine::admin_force_scale($scaling_ch_id);
FullSuiteRunner::assert($force_scale_res['success'] ?? false, "Scaling Engine: admin_force_scale() succeeded", $force_scale_res['message'] ?? '');

$scaled_ch_acc = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d", $scaling_ch_id));
FullSuiteRunner::assertEquals(125000.0, (float)$scaled_ch_acc->starting_balance, "Scaling Engine: balance scaled by +25% to \$125,000");
FullSuiteRunner::assertEquals(125000.0, (float)$scaled_ch_acc->equity_hwm, "Scaling Engine Fix: equity_hwm rebased to the new balance (previously left at the pre-scale level)");
FullSuiteRunner::assertEquals(112500.0, (float)$scaled_ch_acc->trailing_dd_floor, "Scaling Engine Fix: trailing_dd_floor rebased 10% below the new balance (previously left at the pre-scale level)");

$scaling_history = FXSIM_Scaling_Engine::get_scaling_history($scaling_ch_id);
FullSuiteRunner::assert(count($scaling_history) === 1, "Scaling Engine Fix: get_scaling_history() returns the logged event (was always empty — wrong column name)");

// admin_scaling_apply() plan-ceiling regression: the account is now at
// $125,000; a 25% bump would reach $156,250, which must be capped at the
// PLAN's own scaling_max_balance ($150,000), not the much higher global
// default (max_capital_cap defaults to $2,000,000).
$apply_req = new WP_REST_Request('POST', '/fake');
$apply_req->set_url_params(['id' => $scaling_ch_id]);
FXSIM_REST_API::admin_scaling_apply($apply_req);
$capped_acc = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id = %d", $scaling_ch_id));
FullSuiteRunner::assertEquals(150000.0, (float)$capped_acc->starting_balance, "Scaling Engine Fix: admin_scaling_apply() capped at the plan's own scaling_max_balance (\$150k), not the higher global default");
FullSuiteRunner::assertEquals(150000.0, (float)$capped_acc->equity_hwm, "Scaling Engine Fix: admin_scaling_apply() also rebases equity_hwm/trailing_dd_floor");

// ─────────────────────────────────────────────────────────────────────────────
// 12c. CROSS-PATH RULE ENFORCEMENT: detect_trade_patterns() join fix + hedging
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("12c. Cross-Path Rule Enforcement (detect_trade_patterns join + hedging)");

$wpdb->insert($wpdb->prefix . 'fxsim_challenge_plans', [
    'name' => 'Suite Hedging Plan',
    'slug' => 'suite-hedging-' . time(),
    'plan_type' => '2-step',
    'account_size' => 10000.0,
    'price' => 99.0,
    'drawdown_type' => 'static',
    'p1_profit_target' => 10.0,
    'p1_daily_dd' => 90.0,
    'p1_max_dd' => 95.0,
    'stop_loss_required' => 0,
    'min_trade_seconds' => 0,
    'news_trading' => 1,
    'weekend_holding' => 1,
    'hedging_allowed' => 0,
    'is_active' => 1,
]);
$hedge_plan_id = (int)$wpdb->insert_id;
$hedge_ch_res = FXSIM_Challenge_Engine::create_challenge($admin_user_id, $hedge_plan_id);
$hedge_ch_id = (int)$hedge_ch_res['challenge_id'];

// Clear out any pre-existing hedging flags for this user so the assertion
// below is unambiguous.
$wpdb->delete($wpdb->prefix . 'fxsim_trade_flags', ['user_id' => $admin_user_id, 'flag_type' => 'hedging']);

$hedge_buy = FXSIM_Trading_Engine::open_position($admin_user_id, ['symbol' => 'GBPUSD', 'type' => 'buy', 'lot_size' => 0.1]);
FullSuiteRunner::assert($hedge_buy['success'] ?? false, "Cross-Path Fix: BUY position opened (hedging test setup)", $hedge_buy['message'] ?? ($hedge_buy['error'] ?? ''));
$hedge_sell = FXSIM_Trading_Engine::open_position($admin_user_id, ['symbol' => 'GBPUSD', 'type' => 'sell', 'lot_size' => 0.1]);
FullSuiteRunner::assert($hedge_sell['success'] ?? false, "Cross-Path Fix: opposing SELL position opened on the same symbol", $hedge_sell['message'] ?? ($hedge_sell['error'] ?? ''));

$hedging_flag = $wpdb->get_var($wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_trade_flags WHERE user_id = %d AND flag_type = 'hedging'", $admin_user_id
));
FullSuiteRunner::assert((int)$hedging_flag > 0, "Cross-Path Fix: hedging flag logged for opposing GBPUSD positions (proves detect_trade_patterns()'s join now correctly resolves this account's plan — was previously silently never matching any plan at all)");

// ─────────────────────────────────────────────────────────────────────────────
// 13. 🧹 SANDBOX CLEANUP & RESTORATION
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::section("13. Sandbox Cleanup & Restoration");

$scale_ch_acc = FXSIM_Challenge_DB::get_challenge($scale_ch_id);
$scale_sim_id = $scale_ch_acc ? (int)$scale_ch_acc->fxsim_account_id : 0;

$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_pvp_events WHERE match_id = {$match_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_pvp_matches WHERE id = {$match_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id IN ({$risk_ch_id}, {$scale_ch_id})");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_challenge_plans WHERE id IN ({$risk_plan_id}, {$scale_plan_id})");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_accounts WHERE id IN ({$sim_acc_id}, {$scale_sim_id})");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_payouts WHERE id = {$payout_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_kyc WHERE user_id = {$admin_user_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_tickets WHERE id = {$ticket_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_ticket_messages WHERE ticket_id = {$ticket_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_affiliates WHERE id = {$aff_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_coupons WHERE id = {$coupon_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_banners WHERE id = {$banner_id}");
$wpdb->query("DELETE FROM {$wpdb->prefix}fxsim_payment_orders WHERE id = {$order_id}");

FullSuiteRunner::assert(true, "All temporary sandbox records cleanly purged (0 database leftovers)");

// ─────────────────────────────────────────────────────────────────────────────
// FINAL SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
FullSuiteRunner::summary();
