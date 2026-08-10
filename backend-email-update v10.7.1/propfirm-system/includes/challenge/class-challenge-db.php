<?php
/**
 * Challenge Engine — Database Schema
 * Adds 6 tables to existing fxsim schema without touching existing ones.
 */
defined('ABSPATH') || exit;

class FXSIM_Challenge_DB {

    public static function install(): void {
        global $wpdb;
        $c = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        // ── 1. Challenge Plans (the products admin creates) ──────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_challenge_plans (
            id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name            VARCHAR(100)    NOT NULL,
            slug            VARCHAR(100)    NOT NULL UNIQUE,
            account_size    DECIMAL(12,2)   NOT NULL DEFAULT 10000.00,
            price           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
            currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
            phases          TINYINT         NOT NULL DEFAULT 2,
            -- Challenge type: 0=instant funding (no eval), 1/2/3=number of phases
            is_instant_funding  TINYINT(1)  NOT NULL DEFAULT 0,
            -- Drawdown calculation method for this plan
            drawdown_type   ENUM('static','trailing','eod_trailing') NOT NULL DEFAULT 'static',
            -- Phase 1 rules
            p1_profit_target    DECIMAL(5,2) NOT NULL DEFAULT 8.00,
            p1_daily_dd         DECIMAL(5,2) NOT NULL DEFAULT 5.00,
            p1_max_dd           DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            p1_min_days         INT          NOT NULL DEFAULT 5,
            p1_max_days         INT          NOT NULL DEFAULT 30,
            -- Phase 2 rules
            p2_profit_target    DECIMAL(5,2) NOT NULL DEFAULT 5.00,
            p2_daily_dd         DECIMAL(5,2) NOT NULL DEFAULT 5.00,
            p2_max_dd           DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            p2_min_days         INT          NOT NULL DEFAULT 5,
            p2_max_days         INT          NOT NULL DEFAULT 60,
            -- Phase 3 rules (for 3-step challenges)
            p3_profit_target    DECIMAL(5,2) NOT NULL DEFAULT 3.00,
            p3_daily_dd         DECIMAL(5,2) NOT NULL DEFAULT 5.00,
            p3_max_dd           DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            p3_min_days         INT          NOT NULL DEFAULT 5,
            p3_max_days         INT          NOT NULL DEFAULT 60,
            -- Funded rules
            funded_profit_split DECIMAL(5,2) NOT NULL DEFAULT 80.00,
            funded_max_dd       DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            -- Global rules
            max_leverage        INT          NOT NULL DEFAULT 100,
            max_lot_size        DECIMAL(8,2) NOT NULL DEFAULT 50.00,
            news_trading        TINYINT(1)   NOT NULL DEFAULT 1,
            weekend_holding     TINYINT(1)   NOT NULL DEFAULT 0,
            consistency_rule    TINYINT(1)   NOT NULL DEFAULT 0,
            consistency_pct     DECIMAL(5,2) NOT NULL DEFAULT 50.00,
            min_trade_seconds   INT          NOT NULL DEFAULT 0,
            margin_call_level   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            -- Scaling plan settings
            scaling_enabled         TINYINT(1)   NOT NULL DEFAULT 0,
            scaling_growth_pct      DECIMAL(5,2) NOT NULL DEFAULT 25.00,
            scaling_interval_months INT          NOT NULL DEFAULT 4,
            scaling_required_profit_pct DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            scaling_max_balance     DECIMAL(15,2) NOT NULL DEFAULT 2000000.00,
            -- Meta
            is_active           TINYINT(1)   NOT NULL DEFAULT 1,
            sort_order          INT          NOT NULL DEFAULT 0,
            created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_active (is_active), KEY idx_slug (slug)
        ) $c;");

        // ── 2. Challenge Accounts (one per user attempt) ─────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_challenge_accounts (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id         BIGINT UNSIGNED NOT NULL,
            plan_id         INT UNSIGNED    NOT NULL,
            fxsim_account_id BIGINT UNSIGNED NOT NULL,
            phase           TINYINT         NOT NULL DEFAULT 1,
            status          ENUM('active','passed','failed','funded','suspended') NOT NULL DEFAULT 'active',
            -- Snapshot on creation
            starting_balance    DECIMAL(15,2) NOT NULL,
            current_balance     DECIMAL(15,2) NOT NULL,
            peak_balance        DECIMAL(15,2) NOT NULL,
            daily_start_balance DECIMAL(15,2) NOT NULL,
            -- Drawdown tracking (inherits from plan at creation time)
            drawdown_type       ENUM('static','trailing','eod_trailing') NOT NULL DEFAULT 'static',
            equity_hwm          DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Equity High Water Mark for trailing DD',
            trailing_dd_floor   DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Current trailing DD breach level',
            -- Scaling tracking
            scaling_level       INT          NOT NULL DEFAULT 0,
            last_scaled_at      DATETIME     DEFAULT NULL,
            -- Rule tracking
            trading_days        INT  NOT NULL DEFAULT 0,
            last_trade_date     DATE DEFAULT NULL,
            breach_reason       VARCHAR(255) DEFAULT NULL,
            breach_at           DATETIME    DEFAULT NULL,
            -- Timestamps
            phase_started_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            phase_ends_at       DATETIME DEFAULT NULL,
            passed_at           DATETIME DEFAULT NULL,
            failed_at           DATETIME DEFAULT NULL,
            funded_at           DATETIME DEFAULT NULL,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_user   (user_id),
            KEY idx_plan   (plan_id),
            KEY idx_status (status),
            KEY idx_phase  (phase),
            -- Composite: covers WHERE user_id=X AND status IN ('active','funded') in get_active_challenge_account()
            KEY idx_user_status (user_id, status)
        ) $c;");

        // ── 3. Challenge Evaluations (daily snapshot for drawdown tracking) ──────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_challenge_snapshots (
            id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            challenge_id        BIGINT UNSIGNED NOT NULL,
            snapshot_date       DATE            NOT NULL,
            opening_balance     DECIMAL(15,2)   NOT NULL,
            closing_balance     DECIMAL(15,2)   NOT NULL DEFAULT 0,
            daily_pnl           DECIMAL(15,2)   NOT NULL DEFAULT 0,
            floating_pnl        DECIMAL(15,2)   NOT NULL DEFAULT 0,
            trades_count        INT             NOT NULL DEFAULT 0,
            lots_traded         DECIMAL(10,2)   NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_challenge_date (challenge_id, snapshot_date),
            KEY idx_challenge (challenge_id)
        ) $c;");

        // ── 4. Challenge Breach Log ──────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_challenge_breaches (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            challenge_id    BIGINT UNSIGNED NOT NULL,
            user_id         BIGINT UNSIGNED NOT NULL,
            rule_type       VARCHAR(50)     NOT NULL,
            rule_value      DECIMAL(15,5)   DEFAULT NULL,
            actual_value    DECIMAL(15,5)   DEFAULT NULL,
            description     VARCHAR(500)    NOT NULL,
            created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_challenge (challenge_id),
            KEY idx_user      (user_id)
        ) $c;");

        // ── 5. Payout Requests ───────────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_payouts (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            challenge_id    BIGINT UNSIGNED NOT NULL,
            user_id         BIGINT UNSIGNED NOT NULL,
            amount_requested DECIMAL(15,2)  NOT NULL,
            profit_split_pct DECIMAL(5,2)   NOT NULL DEFAULT 80.00,
            trader_amount   DECIMAL(15,2)   NOT NULL,
            firm_amount     DECIMAL(15,2)   NOT NULL,
            status          ENUM('pending','approved','rejected','paid') NOT NULL DEFAULT 'pending',
            payment_method  VARCHAR(50)     DEFAULT NULL,
            payment_address VARCHAR(255)    DEFAULT NULL,
            tx_reference    VARCHAR(255)    DEFAULT NULL,
            proof_url       VARCHAR(500)    DEFAULT NULL,
            admin_note      VARCHAR(500)    DEFAULT NULL,
            requested_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processed_at    DATETIME DEFAULT NULL,
            KEY idx_challenge (challenge_id),
            KEY idx_user      (user_id),
            KEY idx_status    (status)
        ) $c;");

        // ── 6. White-label settings ──────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_whitelabel (
            id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            setting_key     VARCHAR(100) NOT NULL UNIQUE,
            setting_value   TEXT         DEFAULT NULL,
            updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) $c;");

        // ── 7. Payment Orders ─────────────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_payment_orders (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id         BIGINT UNSIGNED NOT NULL,
            plan_id         INT UNSIGNED    NOT NULL,
            amount          DECIMAL(10,2)   NOT NULL,
            currency        VARCHAR(10)     NOT NULL DEFAULT 'USD',
            gateway         ENUM('manual','coinpayments','stripe','confirmo') NOT NULL DEFAULT 'manual',
            status          ENUM('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
            proof_url       VARCHAR(500)    DEFAULT NULL,
            proof_notes     TEXT            DEFAULT NULL,
            txn_id          VARCHAR(255)    DEFAULT NULL,
            admin_note      VARCHAR(500)    DEFAULT NULL,
            reviewed_by     BIGINT UNSIGNED DEFAULT NULL,
            original_amount DECIMAL(10,2)   DEFAULT NULL,
            discount_amount DECIMAL(10,2)   NOT NULL DEFAULT 0,
            coupon_id       BIGINT UNSIGNED DEFAULT NULL,
            coupon_code     VARCHAR(64)     DEFAULT NULL,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at     DATETIME        DEFAULT NULL,
            KEY idx_user    (user_id),
            KEY idx_plan    (plan_id),
            KEY idx_status  (status),
            KEY idx_gateway (gateway)
        ) $c;");
        // NOTE: `amount` stores the FINAL paid amount (after discount). The
        // future Affiliate System computes commissions from `amount` directly.

        // ── Coupons / promotions ─────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_coupons (
            id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            code           VARCHAR(64)   NOT NULL,
            type           ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
            value          DECIMAL(10,2) NOT NULL DEFAULT 0,
            currency       VARCHAR(10)   NOT NULL DEFAULT 'USD',
            expires_at     DATETIME      DEFAULT NULL,
            usage_limit    INT UNSIGNED  NOT NULL DEFAULT 0,
            per_user_limit INT UNSIGNED  NOT NULL DEFAULT 0,
            plan_ids       VARCHAR(255)  DEFAULT NULL,
            active         TINYINT(1)    NOT NULL DEFAULT 1,
            used_count     INT UNSIGNED  NOT NULL DEFAULT 0,
            created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     DATETIME      DEFAULT NULL,
            UNIQUE KEY uniq_code (code),
            KEY idx_active (active)
        ) $c;");

        // Redemptions: source of truth for analytics + one-time-per-user. The
        // unique(coupon_id, order_id) key makes redemption idempotent so Stripe
        // webhook retries / re-approvals can never double-count a use.
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_coupon_redemptions (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            coupon_id       BIGINT UNSIGNED NOT NULL,
            user_id         BIGINT UNSIGNED NOT NULL,
            order_id        BIGINT UNSIGNED NOT NULL,
            discount_amount DECIMAL(10,2)   NOT NULL DEFAULT 0,
            final_amount    DECIMAL(10,2)   NOT NULL DEFAULT 0,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_order (coupon_id, order_id),
            KEY idx_coupon (coupon_id),
            KEY idx_user (user_id)
        ) $c;");

        // ── Affiliates / referrals ───────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_affiliates (
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id      BIGINT UNSIGNED NOT NULL,
            code         VARCHAR(64)   NOT NULL,
            rate_percent DECIMAL(5,2)  NOT NULL DEFAULT 10.00,
            status       ENUM('active','suspended') NOT NULL DEFAULT 'active',
            payout_method      VARCHAR(20)  DEFAULT NULL,
            payout_destination VARCHAR(255) DEFAULT NULL,
            created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user (user_id),
            UNIQUE KEY uniq_code (code)
        ) $c;");

        // Commissions: one per paid order (unique order_id → idempotent creation).
        // `amount` = rate_percent% of `base_amount`, where base_amount is the
        // order's FINAL paid total (after coupon discounts). `payout_id` links a
        // commission to the affiliate withdrawal that settles it.
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_commissions (
            id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            affiliate_id     BIGINT UNSIGNED NOT NULL,
            referred_user_id BIGINT UNSIGNED NOT NULL,
            order_id         BIGINT UNSIGNED NOT NULL,
            base_amount      DECIMAL(10,2)   NOT NULL DEFAULT 0,
            rate_percent     DECIMAL(5,2)    NOT NULL DEFAULT 0,
            amount           DECIMAL(10,2)   NOT NULL DEFAULT 0,
            status           ENUM('pending','approved','paid','reversed') NOT NULL DEFAULT 'pending',
            payout_id        BIGINT UNSIGNED DEFAULT NULL,
            created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            paid_at          DATETIME        DEFAULT NULL,
            UNIQUE KEY uniq_order (order_id),
            KEY idx_aff (affiliate_id),
            KEY idx_status (status),
            KEY idx_payout (payout_id)
        ) $c;");

        // Affiliate withdrawal requests (crypto / Wise only — no bank transfers).
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_affiliate_payouts (
            id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            affiliate_id  BIGINT UNSIGNED NOT NULL,
            amount        DECIMAL(10,2)   NOT NULL DEFAULT 0,
            method        VARCHAR(20)     NOT NULL,
            destination   VARCHAR(255)    NOT NULL,
            status        ENUM('pending','approved','rejected','paid') NOT NULL DEFAULT 'pending',
            tx_reference  VARCHAR(255)    DEFAULT NULL,
            proof_url     VARCHAR(500)    DEFAULT NULL,
            admin_note    VARCHAR(500)    DEFAULT NULL,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processed_at  DATETIME        DEFAULT NULL,
            KEY idx_aff (affiliate_id),
            KEY idx_status (status)
        ) $c;");

        // ── Scaling history (tracks each scale-up event) ─────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_scaling_history (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id         BIGINT UNSIGNED NOT NULL,
            account_id      BIGINT UNSIGNED NOT NULL,
            previous_balance DECIMAL(15,2)  NOT NULL,
            new_balance     DECIMAL(15,2)   NOT NULL,
            scaling_level   INT             NOT NULL DEFAULT 0,
            scaled_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_user    (user_id),
            KEY idx_account (account_id)
        ) $c;");

        // ── Trade pattern flags (HFT, copy-trade, martingale detection) ──────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_trade_flags (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id         BIGINT UNSIGNED NOT NULL,
            account_id      BIGINT UNSIGNED NOT NULL,
            flag_type       VARCHAR(30)     NOT NULL COMMENT 'hft|martingale|gambling|copy_trade|news_exploit',
            details         TEXT            DEFAULT NULL,
            flagged_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved        TINYINT(1)      NOT NULL DEFAULT 0,
            resolved_by     BIGINT UNSIGNED DEFAULT NULL,
            resolved_at     DATETIME        DEFAULT NULL,
            KEY idx_user    (user_id),
            KEY idx_unresolved (resolved, flagged_at)
        ) $c;");

        // ── 8. KYC submissions (identity verification) ───────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_kyc (
            id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id          BIGINT UNSIGNED NOT NULL,
            status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
            id_doc_path      VARCHAR(255)    DEFAULT NULL,
            selfie_path      VARCHAR(255)    DEFAULT NULL,
            address_doc_path VARCHAR(255)    DEFAULT NULL,
            admin_note       VARCHAR(500)    DEFAULT NULL,
            reviewer_id      BIGINT UNSIGNED DEFAULT NULL,
            submitted_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at      DATETIME        DEFAULT NULL,
            UNIQUE KEY uniq_user (user_id),
            KEY idx_status   (status)
        ) $c;");

        // Extend payout status enum with 'under_review' (additive; dbDelta can't
        // reliably alter ENUMs, so guard with SHOW COLUMNS and ALTER once).
        $payouts_tbl = $wpdb->prefix . 'fxsim_payouts';
        $status_col  = $wpdb->get_row("SHOW COLUMNS FROM $payouts_tbl LIKE 'status'");
        if ($status_col && strpos($status_col->Type, 'under_review') === false) {
            $wpdb->query("ALTER TABLE $payouts_tbl
                MODIFY status ENUM('pending','under_review','approved','rejected','paid')
                NOT NULL DEFAULT 'pending'");
        }

        // Seed default white-label settings
        self::seed_whitelabel();

        // Seed default challenge plans
        self::seed_plans();
    }

    private static function seed_whitelabel(): void {
        global $wpdb;
        $t = $wpdb->prefix . 'fxsim_whitelabel';
        if ((int) $wpdb->get_var("SELECT COUNT(*) FROM $t") > 0) return;

        $defaults = [
            'brand_name'                  => 'PropFirm System',
            'brand_tagline'               => 'The Funded Trader Platform',
            'primary_color'               => '#7c6ef5',
            'secondary_color'             => '#00e5a0',
            'logo_url'                    => '',
            'favicon_url'                 => '',
            'support_email'               => 'support@example.com',
            'discord_webhook'             => '',
            'telegram_bot'                => '',
            'telegram_chat'               => '',
            'footer_text'                 => '© ' . date('Y') . ' PropFirm System. Simulation platform only.',
            'challenge_label'             => 'Challenge',
            'funded_label'                => 'Funded Account',
            // Payment settings
            'manual_payment_instructions' => 'Transfer the exact challenge fee to one of the payment methods below, then upload a clear screenshot of your payment confirmation.',
            'manual_crypto_address'       => '',
            'coinpayments_pub_key'        => '',
            'coinpayments_priv_key'       => '',  // Private key — never exposed to frontend
            'stripe_public_key'           => '',
            'stripe_secret_key'           => '',
            'stripe_webhook_secret'       => '',
            // Confirmo crypto gateway
            'confirmo_api_key'            => '',
            'confirmo_callback_secret'    => '',
            // Slippage simulation
            'slippage_enabled'            => '0',
            'slippage_max_pips'           => '1.5',
        ];

        foreach ($defaults as $key => $value) {
            $wpdb->insert($t, ['setting_key' => $key, 'setting_value' => $value]);
        }
    }

    private static function seed_plans(): void {
        global $wpdb;
        $t = $wpdb->prefix . 'fxsim_challenge_plans';
        if ((int) $wpdb->get_var("SELECT COUNT(*) FROM $t") > 0) return;

        $plans = [
            [
                'name' => 'Starter Challenge', 'slug' => 'starter-10k',
                'account_size' => 10000, 'price' => 99, 'phases' => 2,
                'p1_profit_target' => 8, 'p1_daily_dd' => 5, 'p1_max_dd' => 10, 'p1_min_days' => 5, 'p1_max_days' => 30,
                'p2_profit_target' => 5, 'p2_daily_dd' => 5, 'p2_max_dd' => 10, 'p2_min_days' => 5, 'p2_max_days' => 60,
                'funded_profit_split' => 80, 'max_leverage' => 100, 'sort_order' => 1,
            ],
            [
                'name' => 'Pro Challenge', 'slug' => 'pro-25k',
                'account_size' => 25000, 'price' => 199, 'phases' => 2,
                'p1_profit_target' => 8, 'p1_daily_dd' => 5, 'p1_max_dd' => 10, 'p1_min_days' => 5, 'p1_max_days' => 30,
                'p2_profit_target' => 5, 'p2_daily_dd' => 5, 'p2_max_dd' => 10, 'p2_min_days' => 5, 'p2_max_days' => 60,
                'funded_profit_split' => 80, 'max_leverage' => 100, 'sort_order' => 2,
            ],
            [
                'name' => 'Elite Challenge', 'slug' => 'elite-50k',
                'account_size' => 50000, 'price' => 349, 'phases' => 2,
                'p1_profit_target' => 8, 'p1_daily_dd' => 5, 'p1_max_dd' => 10, 'p1_min_days' => 5, 'p1_max_days' => 30,
                'p2_profit_target' => 5, 'p2_daily_dd' => 5, 'p2_max_dd' => 10, 'p2_min_days' => 5, 'p2_max_days' => 60,
                'funded_profit_split' => 85, 'max_leverage' => 100, 'sort_order' => 3,
            ],
        ];

        foreach ($plans as $plan) {
            $wpdb->insert($t, $plan);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────
    public static function get_plan(int $plan_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_challenge_plans WHERE id=%d", $plan_id
        ));
    }

    public static function get_all_plans(bool $active_only = true): array {
        global $wpdb;
        $where = $active_only ? 'WHERE is_active=1' : '';
        return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}fxsim_challenge_plans $where ORDER BY sort_order ASC") ?: [];
    }

    public static function get_challenge(int $challenge_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE id=%d", $challenge_id
        ));
    }

    public static function get_user_challenges(int $user_id): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT ca.*, cp.name AS plan_name, cp.account_size, cp.funded_profit_split,
                    cp.p1_profit_target, cp.p1_daily_dd, cp.p1_max_dd, cp.p1_min_days, cp.p1_max_days,
                    cp.p2_profit_target, cp.p2_daily_dd, cp.p2_max_dd, cp.p2_min_days, cp.p2_max_days,
                    cp.p3_profit_target, cp.p3_daily_dd, cp.p3_max_dd, cp.p3_min_days, cp.p3_max_days,
                    cp.drawdown_type AS plan_drawdown_type, cp.is_instant_funding,
                    cp.scaling_enabled, cp.scaling_growth_pct, cp.scaling_max_balance,
                    cp.phases AS total_phases
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_challenge_plans cp ON ca.plan_id = cp.id
             WHERE ca.user_id = %d
             ORDER BY ca.created_at DESC",
            $user_id
        )) ?: [];
    }

    // ── Trade Flag Helpers ───────────────────────────────────────────────────────
    public static function log_trade_flag(int $user_id, int $account_id, string $type, string $details): void {
        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'fxsim_trade_flags', [
            'user_id'    => $user_id,
            'account_id' => $account_id,
            'flag_type'  => $type,
            'details'    => $details,
        ]);
    }

    public static function get_trade_flags(array $filters = []): array {
        global $wpdb;
        $where = '1=1';
        $args  = [];
        if (!empty($filters['resolved'])) {
            $where .= ' AND resolved = %d';
            $args[] = (int)$filters['resolved'];
        }
        if (!empty($filters['user_id'])) {
            $where .= ' AND user_id = %d';
            $args[] = (int)$filters['user_id'];
        }
        if (!empty($filters['flag_type'])) {
            $where .= ' AND flag_type = %s';
            $args[] = $filters['flag_type'];
        }
        $sql = "SELECT f.*, u.user_login, u.user_email
                FROM {$wpdb->prefix}fxsim_trade_flags f
                LEFT JOIN {$wpdb->users} u ON f.user_id = u.ID
                WHERE $where ORDER BY f.flagged_at DESC LIMIT 100";
        return $wpdb->get_results(empty($args) ? $sql : $wpdb->prepare($sql, ...$args)) ?: [];
    }

    public static function resolve_trade_flag(int $flag_id, int $admin_id): bool {
        global $wpdb;
        return (bool)$wpdb->update($wpdb->prefix . 'fxsim_trade_flags', [
            'resolved'    => 1,
            'resolved_by' => $admin_id,
            'resolved_at' => current_time('mysql'),
        ], ['id' => $flag_id]);
    }

    public static function get_setting(string $key, string $default = ''): string {
        global $wpdb;
        $val = $wpdb->get_var($wpdb->prepare(
            "SELECT setting_value FROM {$wpdb->prefix}fxsim_whitelabel WHERE setting_key=%s", $key
        ));
        return $val ?? $default;
    }

    public static function set_setting(string $key, string $value): void {
        global $wpdb;
        $wpdb->query($wpdb->prepare(
            "INSERT INTO {$wpdb->prefix}fxsim_whitelabel (setting_key, setting_value)
             VALUES (%s, %s)
             ON DUPLICATE KEY UPDATE setting_value=%s",
            $key, $value, $value
        ));
    }

    public static function get_all_settings(): array {
        global $wpdb;
        $rows = $wpdb->get_results("SELECT setting_key, setting_value FROM {$wpdb->prefix}fxsim_whitelabel");
        $out  = [];
        foreach ($rows as $r) $out[$r->setting_key] = $r->setting_value;
        return $out;
    }
}
