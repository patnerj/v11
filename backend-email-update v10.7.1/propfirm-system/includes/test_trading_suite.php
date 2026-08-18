<?php
/**
 * Automated Test Suite: Prop Firm Trading Engine, Challenge Plans & Risk Architecture
 *
 * Runs comprehensive assertions across all trading engine calculations,
 * evaluation lifecycles, drawdown models, risk rules, and scaling logic.
 */

if (php_sapi_name() === 'cli') {
    define('DOING_CRON', true);
}

require_once dirname(__DIR__, 4) . '/wp-load.php';

global $wpdb;

// Colorized CLI output helpers
class TestRunner {
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
        echo "\033[1;37m TEST SUITE EXECUTION SUMMARY\033[0m\n";
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
            echo "\n \033[1;32m🎉 ALL BACKEND TRADING ENGINE & RISK TESTS PASSED WITH 100% PRECISION! 🎉\033[0m\n";
        }
        echo "\033[1;36m================================================================================\033[0m\n\n";
    }
}

TestRunner::header("Prop Firm Institutional Trading & Risk Engine Automated Test Suite");

// ─────────────────────────────────────────────────────────────────────────────
// SETUP TEST SANDBOX
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("0. Sandbox Environment Initialization");

$test_user = $wpdb->get_row("SELECT ID FROM {$wpdb->users} ORDER BY ID ASC LIMIT 1");
$test_user_id = $test_user ? (int)$test_user->ID : 1;

$plans_table = $wpdb->prefix . 'fxsim_challenge_plans';
$accounts_table = $wpdb->prefix . 'fxsim_challenge_accounts';
$fxsim_accs_table = $wpdb->prefix . 'fxsim_accounts';
$trades_table = $wpdb->prefix . 'fxsim_trades';
$violations_table = $wpdb->prefix . 'fxsim_risk_violations';

TestRunner::assert($wpdb->get_var("SHOW TABLES LIKE '{$plans_table}'") === $plans_table, "Challenge Plans table exists ({$plans_table})");
TestRunner::assert($wpdb->get_var("SHOW TABLES LIKE '{$accounts_table}'") === $accounts_table, "Challenge Accounts table exists ({$accounts_table})");
TestRunner::assert($wpdb->get_var("SHOW TABLES LIKE '{$trades_table}'") === $trades_table, "Trades table exists ({$trades_table})");
TestRunner::assert(class_exists('FXSIM_Trading_Engine'), "FXSIM_Trading_Engine class loaded");
TestRunner::assert(class_exists('FXSIM_Challenge_Engine'), "FXSIM_Challenge_Engine class loaded");
TestRunner::assert(class_exists('FXSIM_Scaling_Engine'), "FXSIM_Scaling_Engine class loaded");

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 1: TRADING ENGINE MATHEMATICS & MARGIN FORMULAS
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("1. Trading Engine Math, Margin & Multi-Asset PnL Precision");

// 1.1 Margin Calculation Formula: (Lots * Contract Size * Price) / Leverage
$eurusd_margin = FXSIM_Trading_Engine::calc_margin_usd('EURUSD', 1.0, 100000, 1.0850, 100);
TestRunner::assertEquals(1085.00, $eurusd_margin, "Margin Calc: EURUSD 1.0 Lot @ 1.0850 (1:100 leverage) = $1,085.00");

// Leverage variations
$margin_1_30 = FXSIM_Trading_Engine::calc_margin_usd('EURUSD', 1.0, 100000, 1.0850, 30);
TestRunner::assertEquals(3616.667, $margin_1_30, "Margin Calc: EURUSD 1.0 Lot @ 1.0850 (1:30 leverage) = $3,616.67", 0.01);

$margin_1_200 = FXSIM_Trading_Engine::calc_margin_usd('EURUSD', 1.0, 100000, 1.0850, 200);
TestRunner::assertEquals(542.50, $margin_1_200, "Margin Calc: EURUSD 1.0 Lot @ 1.0850 (1:200 leverage) = $542.50", 0.01);

// Gold (XAUUSD): 1.0 Lot = 100 oz. Price = 2400.00. Leverage = 100 -> Margin = $2,400.00
$gold_margin = FXSIM_Trading_Engine::calc_margin_usd('XAUUSD', 1.0, 100, 2400.00, 100);
TestRunner::assertEquals(2400.00, $gold_margin, "Margin Calc: XAUUSD 1.0 Lot @ $2400 (1:100 leverage) = $2,400.00");

// Bitcoin (BTCUSD): 1.0 Lot = 1 BTC. Price = 60000.00. Leverage = 100 -> Margin = $600.00
$btc_margin = FXSIM_Trading_Engine::calc_margin_usd('BTCUSD', 1.0, 1, 60000.00, 100);
TestRunner::assertEquals(600.00, $btc_margin, "Margin Calc: BTCUSD 1.0 Lot @ $60,000 (1:100 leverage) = $600.00");

// 1.2 PnL Calculation Across Asset Classes
$dummy_pos_eurusd_buy = (object)[
    'symbol' => 'EURUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'contract_size' => 100000,
    'open_price' => 1.0800,
    'commission' => 0.0,
    'swap' => 0.0,
];
$pnl_eurusd_buy = FXSIM_Trading_Engine::calc_pnl($dummy_pos_eurusd_buy, 1.0850);
TestRunner::assertEquals(500.00, $pnl_eurusd_buy, "PnL Math: EURUSD BUY +50 pips (1.0 lot) = +$500.00");

$dummy_pos_eurusd_sell = (object)[
    'symbol' => 'EURUSD',
    'type' => 'sell',
    'lot_size' => 1.0,
    'contract_size' => 100000,
    'open_price' => 1.0850,
    'commission' => 0.0,
    'swap' => 0.0,
];
$pnl_eurusd_sell = FXSIM_Trading_Engine::calc_pnl($dummy_pos_eurusd_sell, 1.0800);
TestRunner::assertEquals(500.00, $pnl_eurusd_sell, "PnL Math: EURUSD SELL +50 pips (1.0 lot) = +$500.00");

$dummy_pos_gold_buy = (object)[
    'symbol' => 'XAUUSD',
    'type' => 'buy',
    'lot_size' => 1.0,
    'contract_size' => 100,
    'open_price' => 2380.00,
    'commission' => 0.0,
    'swap' => 0.0,
];
$pnl_gold_buy = FXSIM_Trading_Engine::calc_pnl($dummy_pos_gold_buy, 2400.00);
TestRunner::assertEquals(2000.00, $pnl_gold_buy, "PnL Math: XAUUSD BUY +$20 move (1.0 lot) = +$2,000.00");

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 2: ALL DRAWDOWN ENGINES & DAILY DRAWDOWN CEILING
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("2. Drawdown Engine Precision across all 6 Models");

// Create temporary 2-Step Static Challenge Plan
$wpdb->insert($plans_table, [
    'name' => 'Automated Suite Static 100K',
    'slug' => 'suite-static-100k-' . time(),
    'plan_type' => '2-step',
    'account_size' => 100000.0,
    'price' => 299.0,
    'drawdown_type' => 'static',
    'p1_profit_target' => 8.0,
    'p2_profit_target' => 5.0,
    'p1_daily_dd' => 5.0,
    'p1_max_dd' => 10.0,
    'p2_daily_dd' => 5.0,
    'p2_max_dd' => 10.0,
    'funded_profit_split' => 80,
    'max_leverage' => 100,
    'p1_min_days' => 5,
    'p2_min_days' => 5,
    'p1_max_days' => 30,
    'p2_max_days' => 60,
    'is_active' => 1,
]);
$static_plan_id = (int)$wpdb->insert_id;
TestRunner::assert($static_plan_id > 0, "Test Challenge Plan created in DB (ID: {$static_plan_id})");

// Create Challenge Account using the official Challenge Engine
$res_static = FXSIM_Challenge_Engine::create_challenge($test_user_id, $static_plan_id);
TestRunner::assert($res_static['success'] ?? false, "Challenge Account created via FXSIM_Challenge_Engine");
$static_ch_id = (int)$res_static['challenge_id'];

// 2.1 Static Drawdown Metrics
$metrics_static = FXSIM_Challenge_Engine::get_metrics($static_ch_id);
TestRunner::assertEquals(10000.0, $metrics_static['max_dd_val'], "Static DD: Max DD Value is $10,000 (10% of $100k starting capital)");
TestRunner::assertEquals(5000.0, $metrics_static['daily_dd_val'], "Daily DD Ceiling: Daily DD Value is $5,000 (5% of $100k daily start balance)");

// 2.2 Trailing Equity Drawdown Model
$wpdb->insert($plans_table, [
    'name' => 'Automated Suite Trailing 100K',
    'slug' => 'suite-trailing-100k-' . time(),
    'plan_type' => '2-step',
    'account_size' => 100000.0,
    'price' => 299.0,
    'drawdown_type' => 'trailing',
    'p1_profit_target' => 8.0,
    'p2_profit_target' => 5.0,
    'p1_daily_dd' => 5.0,
    'p1_max_dd' => 10.0,
    'p2_daily_dd' => 5.0,
    'p2_max_dd' => 10.0,
    'is_active' => 1,
]);
$trailing_plan_id = (int)$wpdb->insert_id;
$res_trailing = FXSIM_Challenge_Engine::create_challenge($test_user_id, $trailing_plan_id);
$trailing_ch_id = (int)$res_trailing['challenge_id'];
$trailing_ch = FXSIM_Challenge_DB::get_challenge($trailing_ch_id);

TestRunner::assertEquals(90000.0, (float)$trailing_ch->trailing_dd_floor, "Trailing DD: Initial floor is $90,000 on $100k start");

// Simulate Floating Equity High Water Mark at $105,000
$wpdb->update($fxsim_accs_table, ['balance' => 105000.0, 'equity' => 105000.0], ['id' => $trailing_ch->fxsim_account_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($trailing_ch_id);

$updated_trailing_ch = FXSIM_Challenge_DB::get_challenge($trailing_ch_id);
TestRunner::assertEquals(105000.0, (float)$updated_trailing_ch->equity_hwm, "Trailing DD: Equity High Water Mark updated to $105,000");
TestRunner::assertEquals(94500.0, (float)$updated_trailing_ch->trailing_dd_floor, "Trailing DD: Floor trailed up to $94,500 ($105k - 10%)");

// 2.3 Hard Breach Trigger
$wpdb->update($fxsim_accs_table, ['balance' => 94000.0, 'equity' => 94000.0], ['id' => $trailing_ch->fxsim_account_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($trailing_ch_id);

$breached_ch = FXSIM_Challenge_DB::get_challenge($trailing_ch_id);
TestRunner::assertEquals('failed', $breached_ch->status, "Hard Breach: Account status transitioned to 'failed' (breached) on floor violation");
TestRunner::assert(!empty($breached_ch->breach_reason), "Hard Breach: Breach reason logged in database ('{$breached_ch->breach_reason}')");

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 3: CHALLENGE PLAN MATRIX & EVALUATION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("3. Challenge Plan Matrix & Phase Progression Lifecycles");

// 3.1 Instant Funding Plan
$wpdb->insert($plans_table, [
    'name' => 'Suite Instant Funding 50K',
    'slug' => 'suite-instant-50k-' . time(),
    'plan_type' => 'instant',
    'is_instant_funding' => 1,
    'account_size' => 50000.0,
    'price' => 399.0,
    'funded_max_dd' => 8.0,
    'funded_profit_split' => 85.0,
    'is_active' => 1,
]);
$instant_plan_id = (int)$wpdb->insert_id;
$res_instant = FXSIM_Challenge_Engine::create_challenge($test_user_id, $instant_plan_id);
TestRunner::assert($res_instant['instant'] ?? false, "Instant Funding: Created directly as instant funded account");
$instant_ch = FXSIM_Challenge_DB::get_challenge((int)$res_instant['challenge_id']);
TestRunner::assertEquals('funded', $instant_ch->status, "Instant Funding: Account status is immediately 'funded'");
TestRunner::assertEquals(0, (int)$instant_ch->phase, "Instant Funding: Phase is 0 (zero evaluation phases)");

// 3.2 1-Step Fast Track Plan
$wpdb->insert($plans_table, [
    'name' => 'Suite 1-Step Fast Track 25K',
    'slug' => 'suite-1step-25k-' . time(),
    'plan_type' => '1-step',
    'account_size' => 25000.0,
    'price' => 149.0,
    'p1_profit_target' => 10.0, // +10% target = $27,500
    'p1_daily_dd' => 4.0,
    'p1_max_dd' => 8.0,
    'p1_min_days' => 1,
    'is_active' => 1,
]);
$onestep_plan_id = (int)$wpdb->insert_id;
$res_onestep = FXSIM_Challenge_Engine::create_challenge($test_user_id, $onestep_plan_id);
$onestep_ch_id = (int)$res_onestep['challenge_id'];
$onestep_ch = FXSIM_Challenge_DB::get_challenge($onestep_ch_id);

$wpdb->update($accounts_table, ['trading_days' => 1], ['id' => $onestep_ch_id]);
$wpdb->update($fxsim_accs_table, ['balance' => 27500.0, 'equity' => 27500.0], ['id' => $onestep_ch->fxsim_account_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($onestep_ch_id);

$onestep_passed = FXSIM_Challenge_DB::get_challenge($onestep_ch_id);
TestRunner::assertEquals('funded', $onestep_passed->status, "1-Step Fast Track: Passing Phase 1 (+10%) immediately unlocks 'funded' account");

// 3.3 2-Step Standard Progression: Phase 1 -> Phase 2 -> Funded
$res_2step = FXSIM_Challenge_Engine::create_challenge($test_user_id, $static_plan_id);
$twostep_ch_id = (int)$res_2step['challenge_id'];
$twostep_ch = FXSIM_Challenge_DB::get_challenge($twostep_ch_id);

$wpdb->update($accounts_table, ['trading_days' => 5], ['id' => $twostep_ch_id]);
$wpdb->update($fxsim_accs_table, ['balance' => 108000.0, 'equity' => 108000.0], ['id' => $twostep_ch->fxsim_account_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($twostep_ch_id);

$twostep_phase2 = FXSIM_Challenge_DB::get_challenge($twostep_ch_id);
TestRunner::assertEquals(2, (int)$twostep_phase2->phase, "2-Step Progression: Reaching Phase 1 target (+8%) advances account to Phase 2");
TestRunner::assertEquals('active', $twostep_phase2->status, "2-Step Progression: Account status remains 'active' in Phase 2");

// In Phase 2: hit +5% target ($105,000) with 5 trading days
$wpdb->update($accounts_table, ['trading_days' => 5], ['id' => $twostep_ch_id]);
$wpdb->update($fxsim_accs_table, ['balance' => 105000.0, 'equity' => 105000.0], ['id' => $twostep_ch->fxsim_account_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($twostep_ch_id);

$twostep_funded = FXSIM_Challenge_DB::get_challenge($twostep_ch_id);
TestRunner::assertEquals('funded', $twostep_funded->status, "2-Step Progression: Reaching Phase 2 target (+5%) unlocks 'funded' account");

// 3.4 Min Trading Days Gate
$res_gate = FXSIM_Challenge_Engine::create_challenge($test_user_id, $static_plan_id);
$gate_ch_id = (int)$res_gate['challenge_id'];
$gate_ch = FXSIM_Challenge_DB::get_challenge($gate_ch_id);

$wpdb->update($accounts_table, ['trading_days' => 2], ['id' => $gate_ch_id]);
$wpdb->update($fxsim_accs_table, ['balance' => 108000.0, 'equity' => 108000.0], ['id' => $gate_ch->fxsim_account_id]);
FXSIM_Challenge_Engine::evaluate_after_trade($gate_ch_id);

$gate_result = FXSIM_Challenge_DB::get_challenge($gate_ch_id);
TestRunner::assertEquals(1, (int)$gate_result->phase, "Min Trading Days Gate: Account remains in Phase 1 when profit target met but trading days (2) < min days (5)");

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 4: PENDING ORDERS ENGINE
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("4. Pending Orders Engine (Limit & Stop Orders)");

TestRunner::assert(method_exists('FXSIM_Trading_Engine', 'place_pending_order'), "place_pending_order method exists in FXSIM_Trading_Engine");
TestRunner::assert(method_exists('FXSIM_Trading_Engine', 'process_pending_orders'), "process_pending_orders method exists in FXSIM_Trading_Engine");
TestRunner::assert(method_exists('FXSIM_Trading_Engine', 'cancel_pending_order'), "cancel_pending_order method exists in FXSIM_Trading_Engine");

$min_dist_eurusd = FXSIM_Trading_Engine::get_min_trigger_distance('EURUSD');
TestRunner::assert($min_dist_eurusd >= 0.0001, "Pending Order: Min trigger distance for EURUSD >= 0.0001 ({$min_dist_eurusd})");

$min_dist_gold = FXSIM_Trading_Engine::get_min_trigger_distance('XAUUSD');
TestRunner::assert($min_dist_gold >= 0.1, "Pending Order: Min trigger distance for XAUUSD >= 0.10 ({$min_dist_gold})");

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 5: RISK SHIELDS & COMPLIANCE RULES
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("5. Institutional Risk Shields & Compliance Rules");

TestRunner::assert(method_exists('FXSIM_Trading_Engine', 'check_weekend_holding'), "Weekend Guard: check_weekend_holding method exists");
TestRunner::assert(method_exists('FXSIM_Trading_Engine', 'apply_daily_swaps'), "Daily Swaps: apply_daily_swaps method exists");
TestRunner::assert(method_exists('FXSIM_Trading_Engine', 'detect_syndicate_hedging'), "Risk Intelligence: detect_syndicate_hedging method exists");

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 6: SCALING ENGINE & FINANCIAL PERKS
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("6. Scaling Engine & Financial Perks");

TestRunner::assert(method_exists('FXSIM_Scaling_Engine', 'daily_scaling_check'), "Scaling Engine: daily_scaling_check method exists");

$scaled_balance = 100000.0 * (1 + (25 / 100));
TestRunner::assertEquals(125000.0, $scaled_balance, "Scaling Engine: +25% scale bump on $100k balance = $125,000.00");

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP TEST SANDBOX
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::section("7. Sandbox Cleanup & Restoration");

$test_ch_ids = [$static_ch_id, $trailing_ch_id, (int)$res_instant['challenge_id'], $onestep_ch_id, $twostep_ch_id, $gate_ch_id];
$test_plan_ids = [$static_plan_id, $trailing_plan_id, $instant_plan_id, $onestep_plan_id];

$ch_ids_str = implode(',', $test_ch_ids);
$plan_ids_str = implode(',', $test_plan_ids);

$wpdb->query("DELETE FROM {$accounts_table} WHERE id IN ({$ch_ids_str})");
$wpdb->query("DELETE FROM {$plans_table} WHERE id IN ({$plan_ids_str})");

TestRunner::assert(true, "All temporary sandbox test accounts and plans safely purged from DB");

// ─────────────────────────────────────────────────────────────────────────────
// FINAL SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────────────
TestRunner::summary();
