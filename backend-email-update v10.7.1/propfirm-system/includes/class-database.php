<?php
defined('ABSPATH') || exit;

class FXSIM_Database {

    // ── Install (activation) ──────────────────────────────────────────────────
    public static function install(): void {
        global $wpdb;
        $c = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_accounts (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id         BIGINT UNSIGNED NOT NULL,
            balance         DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
            equity          DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
            margin_used     DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
            leverage        INT             NOT NULL DEFAULT 100,
            status          ENUM('active','frozen','banned') NOT NULL DEFAULT 'active',
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_user (user_id), KEY idx_status (status)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_positions (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            account_id      BIGINT UNSIGNED NOT NULL,
            symbol          VARCHAR(20)     NOT NULL,
            type            ENUM('buy','sell') NOT NULL,
            lot_size        DECIMAL(10,2)   NOT NULL,
            open_price      DECIMAL(18,5)   NOT NULL,
            current_price   DECIMAL(18,5)   NOT NULL DEFAULT 0,
            sl              DECIMAL(18,5)   DEFAULT NULL,
            tp              DECIMAL(18,5)   DEFAULT NULL,
            margin          DECIMAL(15,2)   NOT NULL DEFAULT 0,
            commission      DECIMAL(10,2)   NOT NULL DEFAULT 0,
            pnl             DECIMAL(15,2)   NOT NULL DEFAULT 0,
            swap            DECIMAL(10,2)   NOT NULL DEFAULT 0,
            -- Order traceability: links position back to pending order (NULL = market order)
            order_id        BIGINT UNSIGNED DEFAULT NULL,
            order_type      ENUM('market','buy_limit','sell_limit','buy_stop','sell_stop')
                            NOT NULL DEFAULT 'market',
            opened_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_account (account_id), KEY idx_symbol (symbol), KEY idx_type (type)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_trades (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            account_id      BIGINT UNSIGNED NOT NULL,
            symbol          VARCHAR(20)     NOT NULL,
            type            ENUM('buy','sell') NOT NULL,
            lot_size        DECIMAL(10,2)   NOT NULL,
            open_price      DECIMAL(18,5)   NOT NULL,
            close_price     DECIMAL(18,5)   NOT NULL,
            sl              DECIMAL(18,5)   DEFAULT NULL,
            tp              DECIMAL(18,5)   DEFAULT NULL,
            margin          DECIMAL(15,2)   NOT NULL DEFAULT 0,
            commission      DECIMAL(10,2)   NOT NULL DEFAULT 0,
            swap            DECIMAL(10,2)   NOT NULL DEFAULT 0,
            pnl             DECIMAL(15,2)   NOT NULL DEFAULT 0,
            close_reason    VARCHAR(20)     NOT NULL DEFAULT 'manual',
            opened_at       DATETIME        NOT NULL,
            closed_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_toxic        TINYINT(1)      NOT NULL DEFAULT 0,
            KEY idx_account (account_id), KEY idx_symbol (symbol),
            KEY idx_closed (closed_at),
            -- Composite: covers WHERE account_id=X ORDER BY closed_at DESC (history pagination)
            KEY idx_account_closed (account_id, closed_at)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_transactions (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            account_id      BIGINT UNSIGNED NOT NULL,
            type            ENUM('deposit','withdrawal','commission','pnl','swap','adjustment') NOT NULL,
            amount          DECIMAL(15,2)   NOT NULL,
            balance_after   DECIMAL(15,2)   NOT NULL,
            note            VARCHAR(255)    DEFAULT NULL,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_account (account_id), KEY idx_type (type),
            -- Composite: covers WHERE account_id=X ORDER BY created_at DESC (transactions pagination)
            KEY idx_account_created (account_id, created_at)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_symbols (
            id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            symbol          VARCHAR(20)     NOT NULL UNIQUE,
            display_name    VARCHAR(50)     NOT NULL,
            category        ENUM('forex','metal','energy','crypto','index') NOT NULL DEFAULT 'forex',
            spread          DECIMAL(8,5)    NOT NULL DEFAULT 0.00020,
            commission      DECIMAL(6,2)    NOT NULL DEFAULT 7.00,
            min_lot         DECIMAL(6,2)    NOT NULL DEFAULT 0.01,
            max_lot         DECIMAL(6,2)    NOT NULL DEFAULT 50.00,
            contract_size   INT             NOT NULL DEFAULT 100000,
            swap_long       DECIMAL(8,4)    NOT NULL DEFAULT -0.50,
            swap_short      DECIMAL(8,4)    NOT NULL DEFAULT 0.30,
            is_active       TINYINT(1)      NOT NULL DEFAULT 1,
            KEY idx_category (category), KEY idx_active (is_active)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_admin_log (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_id        BIGINT UNSIGNED NOT NULL,
            action          VARCHAR(100)    NOT NULL,
            target_user_id  BIGINT UNSIGNED DEFAULT NULL,
            details         TEXT            DEFAULT NULL,
            ip_address      VARCHAR(45)     DEFAULT NULL,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_admin (admin_id), KEY idx_action (action)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_pending_orders (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            account_id      BIGINT UNSIGNED NOT NULL,
            symbol          VARCHAR(20)     NOT NULL,
            type            ENUM('buy_limit','sell_limit','buy_stop','sell_stop') NOT NULL,
            lot_size        DECIMAL(10,2)   NOT NULL,
            target_price    DECIMAL(18,5)   NOT NULL,
            sl              DECIMAL(18,5)   DEFAULT NULL,
            tp              DECIMAL(18,5)   DEFAULT NULL,
            -- Execution fields (NULL until filled)
            margin          DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
            commission      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
            filled_price    DECIMAL(18,5)   DEFAULT NULL,
            filled_at       DATETIME        DEFAULT NULL,
            position_id     BIGINT UNSIGNED DEFAULT NULL,
            -- Status includes 'rejected' for future admin override capability
            status          ENUM('pending','filled','cancelled','expired','rejected') NOT NULL DEFAULT 'pending',
            reject_reason   VARCHAR(255)    DEFAULT NULL,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at      DATETIME        DEFAULT NULL,
            -- Composite index covers the fill-loop query (status + symbol lookup)
            KEY idx_account  (account_id),
            KEY idx_symbol   (symbol),
            KEY idx_status   (status),
            KEY idx_process  (status, symbol)
        ) $c;");

        // ── API Keys ─────────────────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_api_keys (
            id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id     BIGINT UNSIGNED NOT NULL,
            -- SHA-256 hash of the raw key; raw key shown once at creation, never stored
            key_hash    VARCHAR(64)     NOT NULL UNIQUE,
            -- Human-readable label set by the user (e.g. 'My Trading Bot')
            name        VARCHAR(100)    NOT NULL,
            -- Comma-separated scope list: read, trade, challenge, stream, admin
            scopes      VARCHAR(255)    NOT NULL DEFAULT 'read',
            -- Environment: live or test (test keys ignored by trade execution)
            env         ENUM('live','test') NOT NULL DEFAULT 'live',
            -- Optional expiry; NULL = no expiry (GTC)
            expires_at  DATETIME        DEFAULT NULL,
            last_used   DATETIME        DEFAULT NULL,
            -- 0 = revoked
            is_active   TINYINT(1)      NOT NULL DEFAULT 1,
            created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_user   (user_id),
            KEY idx_active (is_active)
        ) $c;");

        // ── API Key usage log (lightweight, rotated to 1000 rows per key) ────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_api_key_log (
            id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            key_id      BIGINT UNSIGNED NOT NULL,
            endpoint    VARCHAR(100)    NOT NULL,
            method      VARCHAR(10)     NOT NULL,
            status_code SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            ts          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_key    (key_id),
            KEY idx_ts     (ts),
            -- Composite: covers WHERE key_id=X ORDER BY ts DESC (usage log query)
            KEY idx_key_ts (key_id, ts)
        ) $c;");

        // ── User notifications ────────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_notifications (
            id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id     BIGINT UNSIGNED NOT NULL,
            type        VARCHAR(40)  NOT NULL DEFAULT 'info',
            title       VARCHAR(120) NOT NULL,
            message     TEXT         NOT NULL,
            link        VARCHAR(255) DEFAULT NULL,
            is_read     TINYINT(1)   NOT NULL DEFAULT 0,
            ref_user_id    BIGINT UNSIGNED DEFAULT NULL,
            ref_user_label VARCHAR(120) DEFAULT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_user_read (user_id, is_read),
            KEY idx_user_time (user_id, created_at)
        ) $c;");

        // ── Trading Journal Notes ───────────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_trade_notes (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id         BIGINT UNSIGNED NOT NULL,
            trade_id        BIGINT UNSIGNED NOT NULL,
            note            TEXT            DEFAULT NULL,
            tags            VARCHAR(255)    DEFAULT NULL,
            screenshot_url  VARCHAR(255)    DEFAULT NULL,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY idx_trade (trade_id),
            KEY idx_user (user_id)
        ) $c;");

        // ── Promotional banners / announcements (headless v2) ─────────────────
        // V1 uses message/placement/scope/scheduling/CTA/colors/countdown.
        // `coupon_code` is reserved for the upcoming Coupon System (unused in V1).
        // `impressions`/`clicks` are reserved for V2 analytics (unused in V1) so
        // counters can be incremented later with no schema change. Granular
        // per-event analytics can also be added later via a separate
        // fxsim_banner_events table keyed on this row's id.
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_banners (
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title        VARCHAR(160) NOT NULL DEFAULT '',
            message      TEXT NOT NULL,
            placement    VARCHAR(16)  NOT NULL DEFAULT 'top',
            scope_type   VARCHAR(16)  NOT NULL DEFAULT 'global',
            scope_path   VARCHAR(191) DEFAULT NULL,
            bg_color     VARCHAR(32)  DEFAULT NULL,
            text_color   VARCHAR(32)  DEFAULT NULL,
            cta_label    VARCHAR(80)  DEFAULT NULL,
            cta_url      VARCHAR(255) DEFAULT NULL,
            coupon_code  VARCHAR(64)  DEFAULT NULL,
            starts_at    DATETIME DEFAULT NULL,
            ends_at      DATETIME DEFAULT NULL,
            countdown_to DATETIME DEFAULT NULL,
            active       TINYINT(1) NOT NULL DEFAULT 1,
            priority     INT NOT NULL DEFAULT 0,
            impressions  BIGINT UNSIGNED NOT NULL DEFAULT 0,
            clicks       BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT NULL,
            KEY idx_active (active),
            KEY idx_placement (placement)
        ) $c;");

        // One-time migration: fold any legacy single `fxsim_announcement` option
        // into a banner row, so existing installs keep their announcement.
        if (!get_option('fxsim_banner_seed_done')) {
            $legacy = get_option('fxsim_announcement');
            if (is_array($legacy) && !empty($legacy['message'])) {
                $ends = !empty($legacy['expires']) ? gmdate('Y-m-d H:i:s', (int) $legacy['expires']) : null;
                $wpdb->insert($wpdb->prefix . 'fxsim_banners', [
                    'title'      => 'Imported announcement',
                    'message'    => sanitize_text_field($legacy['message']),
                    'placement'  => 'both',
                    'scope_type' => 'global',
                    'ends_at'    => $ends,
                    'active'     => 1,
                    'priority'   => 0,
                ]);
            }
            update_option('fxsim_banner_seed_done', 1, false);
        }
        
        // ── Competitions / Tournaments ──────────────────────────────────────────
        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_competitions (
            id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name             VARCHAR(255)    NOT NULL,
            description      TEXT            DEFAULT NULL,
            start_date       DATETIME        NOT NULL,
            end_date         DATETIME        NOT NULL,
            prize_pool       VARCHAR(100)    NOT NULL DEFAULT '$0',
            entry_fee        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
            max_participants INT             NOT NULL DEFAULT 0,
            status           ENUM('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
            created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_status (status)
        ) $c;");

        dbDelta("CREATE TABLE {$wpdb->prefix}fxsim_competition_participants (
            id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            competition_id   BIGINT UNSIGNED NOT NULL,
            user_id          BIGINT UNSIGNED NOT NULL,
            account_id       BIGINT UNSIGNED NOT NULL,
            status           ENUM('active','disqualified') NOT NULL DEFAULT 'active',
            registered_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_competition (competition_id),
            KEY idx_user (user_id),
            KEY idx_account (account_id)
        ) $c;");

        // Required for per-challenge account isolation (multiple accounts per user)
        $has_unique = $wpdb->get_var("
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = '{$wpdb->prefix}fxsim_accounts'
            AND CONSTRAINT_TYPE = 'UNIQUE'
            AND CONSTRAINT_NAME = 'user_id'
        ");
        if ($has_unique) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}fxsim_accounts DROP INDEX user_id");
        }

        // ── Migration v4.2: pending_orders — add execution + status columns ──────
        // Each block checks column existence before ALTER to make re-runs safe (idempotent).
        $po = $wpdb->prefix . 'fxsim_pending_orders';
        $po_cols = $wpdb->get_col("SHOW COLUMNS FROM {$po}", 0);

        if (!in_array('margin', $po_cols)) {
            $wpdb->query("ALTER TABLE {$po} ADD COLUMN margin DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER tp");
        }
        if (!in_array('commission', $po_cols)) {
            $wpdb->query("ALTER TABLE {$po} ADD COLUMN commission DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER margin");
        }
        if (!in_array('filled_price', $po_cols)) {
            $wpdb->query("ALTER TABLE {$po} ADD COLUMN filled_price DECIMAL(18,5) DEFAULT NULL AFTER commission");
        }
        if (!in_array('filled_at', $po_cols)) {
            $wpdb->query("ALTER TABLE {$po} ADD COLUMN filled_at DATETIME DEFAULT NULL AFTER filled_price");
        }
        if (!in_array('position_id', $po_cols)) {
            $wpdb->query("ALTER TABLE {$po} ADD COLUMN position_id BIGINT UNSIGNED DEFAULT NULL AFTER filled_at");
        }
        if (!in_array('reject_reason', $po_cols)) {
            $wpdb->query("ALTER TABLE {$po} ADD COLUMN reject_reason VARCHAR(255) DEFAULT NULL AFTER status");
        }

        // Extend status ENUM to include 'rejected' for admin override capability
        // MySQL ALTER COLUMN on ENUM is safe and preserves existing data
        $wpdb->query(
            "ALTER TABLE {$po} MODIFY COLUMN status
             ENUM('pending','filled','cancelled','expired','rejected') NOT NULL DEFAULT 'pending'"
        );

        // Add composite index for the pending order process loop if absent
        $po_indexes = $wpdb->get_col("SHOW INDEX FROM {$po} WHERE Key_name='idx_process'", 2);
        if (empty($po_indexes)) {
            $wpdb->query("ALTER TABLE {$po} ADD INDEX idx_process (status, symbol)");
        }

        // ── Migration v4.2: positions — add order traceability columns ────────────
        $pos = $wpdb->prefix . 'fxsim_positions';
        $pos_cols = $wpdb->get_col("SHOW COLUMNS FROM {$pos}", 0);

        if (!in_array('order_id', $pos_cols)) {
            $wpdb->query("ALTER TABLE {$pos} ADD COLUMN order_id BIGINT UNSIGNED DEFAULT NULL AFTER swap");
        }
        if (!in_array('order_type', $pos_cols)) {
            $wpdb->query(
                "ALTER TABLE {$pos} ADD COLUMN order_type
                 ENUM('market','buy_limit','sell_limit','buy_stop','sell_stop')
                 NOT NULL DEFAULT 'market' AFTER order_id"
            );
        }

        // ── Migration v4.2: challenge_accounts — add weekend close guard column ───
        $ca = $wpdb->prefix . 'fxsim_challenge_accounts';
        $ca_cols = $wpdb->get_col("SHOW COLUMNS FROM {$ca}", 0);

        if (!in_array('weekend_close_week', $ca_cols)) {
            // Stores 'YYYY-WW' ISO week string. Prevents double weekend-close per week.
            $wpdb->query("ALTER TABLE {$ca} ADD COLUMN weekend_close_week VARCHAR(7) DEFAULT NULL AFTER funded_at");
        }

        // ── Migration: MT5 credentials columns ───────────────────────────────
        // Added when challenge reaches 'funded' status; admin assigns MT5 details manually.
        // Columns are nullable — existing funded rows simply have NULL until admin fills them.
        if (!in_array('mt5_login', $ca_cols)) {
            $wpdb->query("ALTER TABLE {$ca} ADD COLUMN mt5_login VARCHAR(50) DEFAULT NULL AFTER weekend_close_week");
        }
        if (!in_array('mt5_password', $ca_cols)) {
            $wpdb->query("ALTER TABLE {$ca} ADD COLUMN mt5_password VARCHAR(100) DEFAULT NULL AFTER mt5_login");
        }
        if (!in_array('mt5_server', $ca_cols)) {
            $wpdb->query("ALTER TABLE {$ca} ADD COLUMN mt5_server VARCHAR(100) DEFAULT NULL AFTER mt5_password");
        }
        if (!in_array('mt5_account_type', $ca_cols)) {
            $wpdb->query("ALTER TABLE {$ca} ADD COLUMN mt5_account_type VARCHAR(30) DEFAULT NULL AFTER mt5_server");
        }

        // ── Migration v4.4: consolidate individual price options into combined key ─
        // Old installs stored 14 separate fxsim_price_SYMBOL options (autoload=yes).
        // New system uses one fxsim_prices_all option (autoload=no) via FXSIM_Cache.
        // We migrate existing prices and remove the old autoloaded options.
        if (!get_option('fxsim_prices_all')) {
            $legacy_symbols = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD',
                               'NZDUSD','EURGBP','EURJPY','GBPJPY','XAUUSD','XAGUSD',
                               'BTCUSD','ETHUSD'];
            $combined = [];
            foreach ($legacy_symbols as $sym) {
                $val = get_option("fxsim_price_{$sym}");
                if ($val && is_array($val)) {
                    $combined[$sym] = $val;
                }
            }
            if (!empty($combined)) {
                // Store consolidated — autoload=false (price data not needed on every WP page)
                update_option('fxsim_prices_all', $combined, false);
            }
        }
        // Remove old individual options (reduce autoload payload on every WP load)
        // Only remove if the combined option now exists
        if (get_option('fxsim_prices_all')) {
            $legacy_symbols = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD',
                               'NZDUSD','EURGBP','EURJPY','GBPJPY','XAUUSD','XAGUSD',
                               'BTCUSD','ETHUSD'];
            foreach ($legacy_symbols as $sym) {
                delete_option("fxsim_price_{$sym}");
            }
        }

        // ── Migration v4.5: api_key_log composite index ──────────────────────────
        // Covers the per-key usage log query: WHERE key_id=X ORDER BY ts DESC
        $has = $wpdb->get_col("SHOW INDEX FROM {$wpdb->prefix}fxsim_api_key_log WHERE Key_name='idx_key_ts'", 2);
        if (empty($has)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}fxsim_api_key_log ADD INDEX idx_key_ts (key_id, ts)");
        }

        // ── Migration v4.4: composite indexes for query performance ──────────────
        // Each block uses SHOW INDEX to check existence before adding — fully idempotent.
        // These indexes eliminate filesort on history/transaction pagination and reduce
        // index intersection cost on the critical get_active_challenge_account() JOIN.

        // fxsim_trades: (account_id, closed_at) — covers paginated history query
        // Pattern: WHERE account_id=X ORDER BY closed_at DESC LIMIT 50
        $has = $wpdb->get_col("SHOW INDEX FROM {$wpdb->prefix}fxsim_trades WHERE Key_name='idx_account_closed'", 2);
        if (empty($has)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}fxsim_trades ADD INDEX idx_account_closed (account_id, closed_at)");
        }

        // fxsim_transactions: (account_id, created_at) — covers transaction list query
        $has = $wpdb->get_col("SHOW INDEX FROM {$wpdb->prefix}fxsim_transactions WHERE Key_name='idx_account_created'", 2);
        if (empty($has)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}fxsim_transactions ADD INDEX idx_account_created (account_id, created_at)");
        }

        // fxsim_challenge_accounts: (user_id, status) — covers get_active_challenge_account()
        // Pattern: WHERE user_id=X AND status IN ('active','funded') ORDER BY created_at DESC
        // Single composite replaces two separate index reads
        $has = $wpdb->get_col("SHOW INDEX FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE Key_name='idx_user_status'", 2);
        if (empty($has)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}fxsim_challenge_accounts ADD INDEX idx_user_status (user_id, status)");
        }

        // Seed symbols and update version
        FXSIM_Database::seed_symbols();
        FXSIM_Database::ensure_index_symbols();
        update_option('fxsim_db_version', FXSIM_VERSION);
    }

    public static function deactivate(): void {
        wp_clear_scheduled_hook('fxsim_price_update');
    }

    // ── Seed 19 instruments ───────────────────────────────────────────────────
    /**
     * V10.5 — make sure the five flagship prop-firm index CFDs exist in the
     * catalog. Idempotent INSERT-if-missing (no schema change). Seeded
     * is_active = 0: the bundled Yahoo fallback does not quote these, so the
     * operator enables each one once their MT5 price service pushes it —
     * adding them active-but-priceless would break the terminal, not help it.
     */
    public static function ensure_index_symbols(): void {
        global $wpdb;
        $t = $wpdb->prefix . 'fxsim_symbols';
        $indices = [
            ['US30',   'Wall Street 30', 2.5, -1.5, -1.0],
            ['NAS100', 'US Tech 100',    1.8, -1.5, -1.0],
            ['SPX500', 'S&P 500',        0.6, -1.2, -0.8],
            ['GER40',  'Germany 40',     1.5, -1.5, -1.0],
            ['UK100',  'UK 100',         1.5, -1.2, -0.8],
        ];
        foreach ($indices as [$sym, $name, $spread, $sl, $ss]) {
            $exists = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE symbol = %s", $sym));
            if ($exists) continue;
            $wpdb->insert($t, [
                'symbol' => $sym, 'display_name' => $name, 'category' => 'index',
                'spread' => $spread, 'commission' => 0, 'min_lot' => 0.1, 'max_lot' => 100,
                'contract_size' => 1, 'swap_long' => $sl, 'swap_short' => $ss,
                'is_active' => 0,
            ]);
        }
    }

    /**
     * V10.6.1 — additive instruments: energy (oil) and major forex cross pairs.
     * Idempotent INSERT-if-missing, no schema change, is_active = 0 (the operator
     * enables each once their MT5 price service quotes it). The challenge and
     * trading engines are untouched — these are catalog rows only.
     */
    public static function ensure_extra_symbols(): void {
        global $wpdb;
        $t = $wpdb->prefix . 'fxsim_symbols';
        // [symbol, display, category, spread, commission, min_lot, max_lot, contract_size, swap_long, swap_short]
        $rows = [
            // Energy
            ['USOIL',  'WTI Crude Oil', 'energy', 0.030, 0, 0.01, 50, 1000, -2.5, -2.0],
            ['XBRUSD', 'Brent Crude',   'energy', 0.035, 0, 0.01, 50, 1000, -2.5, -2.0],
            // Major forex cross pairs
            ['EURGBP', 'EUR/GBP', 'forex', 0.00016, 7, 0.01, 50, 100000, -0.40, 0.20],
            ['EURAUD', 'EUR/AUD', 'forex', 0.00030, 7, 0.01, 50, 100000, -0.50, 0.20],
            ['EURNZD', 'EUR/NZD', 'forex', 0.00040, 7, 0.01, 50, 100000, -0.50, 0.20],
            ['EURCAD', 'EUR/CAD', 'forex', 0.00028, 7, 0.01, 50, 100000, -0.45, 0.20],
            ['GBPJPY', 'GBP/JPY', 'forex', 0.01800, 7, 0.01, 50, 100000, -0.60, 0.30],
            ['GBPAUD', 'GBP/AUD', 'forex', 0.00045, 7, 0.01, 50, 100000, -0.55, 0.20],
            ['GBPCAD', 'GBP/CAD', 'forex', 0.00040, 7, 0.01, 50, 100000, -0.55, 0.20],
            ['GBPCHF', 'GBP/CHF', 'forex', 0.00030, 7, 0.01, 50, 100000, -0.45, 0.15],
            ['AUDJPY', 'AUD/JPY', 'forex', 0.01400, 7, 0.01, 50, 100000, -0.40, 0.20],
            ['AUDCAD', 'AUD/CAD', 'forex', 0.00026, 7, 0.01, 50, 100000, -0.40, 0.15],
            ['AUDCHF', 'AUD/CHF', 'forex', 0.00025, 7, 0.01, 50, 100000, -0.35, 0.10],
            ['NZDJPY', 'NZD/JPY', 'forex', 0.01500, 7, 0.01, 50, 100000, -0.40, 0.20],
            ['CADJPY', 'CAD/JPY', 'forex', 0.01400, 7, 0.01, 50, 100000, -0.40, 0.20],
            ['CHFJPY', 'CHF/JPY', 'forex', 0.01500, 7, 0.01, 50, 100000, -0.40, 0.20],
        ];
        foreach ($rows as $r) {
            $exists = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE symbol = %s", $r[0]));
            if ($exists) continue;
            $wpdb->insert($t, [
                'symbol' => $r[0], 'display_name' => $r[1], 'category' => $r[2],
                'spread' => $r[3], 'commission' => $r[4], 'min_lot' => $r[5], 'max_lot' => $r[6],
                'contract_size' => $r[7], 'swap_long' => $r[8], 'swap_short' => $r[9],
                'is_active' => 0,
            ]);
        }
    }

    public static function seed_symbols(): void {
        global $wpdb;
        $t = $wpdb->prefix . 'fxsim_symbols';
        if ((int) $wpdb->get_var("SELECT COUNT(*) FROM $t") > 0) return;

        $symbols = [
            // Forex
            ['EURUSD','EUR/USD','forex',0.00013,7,0.01,50,100000,-0.50, 0.30],
            ['GBPUSD','GBP/USD','forex',0.00015,7,0.01,50,100000,-0.60, 0.40],
            ['USDJPY','USD/JPY','forex',0.01300,7,0.01,50,100000,-0.40, 0.20],
            ['USDCHF','USD/CHF','forex',0.00012,7,0.01,50,100000,-0.30, 0.10],
            ['AUDUSD','AUD/USD','forex',0.00015,7,0.01,50,100000,-0.45, 0.25],
            ['USDCAD','USD/CAD','forex',0.00018,7,0.01,50,100000,-0.35, 0.15],
            ['NZDUSD','NZD/USD','forex',0.00018,7,0.01,50,100000,-0.40, 0.20],
            ['EURGBP','EUR/GBP','forex',0.00012,7,0.01,50,100000,-0.55, 0.35],
            ['EURJPY','EUR/JPY','forex',0.01500,7,0.01,50,100000,-0.65, 0.45],
            ['GBPJPY','GBP/JPY','forex',0.02000,7,0.01,50,100000,-0.70, 0.50],
            // Metals
            ['XAUUSD','Gold/USD','metal',0.18000,7,0.01,20,100,-2.00,  1.50],
            ['XAGUSD','Silver/USD','metal',0.02000,7,0.01,20,5000,-1.00, 0.70],
            // Crypto
            ['BTCUSD','Bitcoin/USD','crypto',15.00000,7,0.01,5,1,-3.00, 2.00],
            ['ETHUSD','Ethereum/USD','crypto',1.00000,7,0.01,5,1,-2.50, 1.80],
        ];

        foreach ($symbols as $s) {
            $wpdb->insert($t, [
                'symbol'        => $s[0],
                'display_name'  => $s[1],
                'category'      => $s[2],
                'spread'        => $s[3],
                'commission'    => $s[4],
                'min_lot'       => $s[5],
                'max_lot'       => $s[6],
                'contract_size' => $s[7],
                'swap_long'     => $s[8],
                'swap_short'    => $s[9],
            ]);
        }
    }

    // ── Account helpers ───────────────────────────────────────────────────────

    /**
     * Create a standalone trading account for a challenge.
     * Does NOT check for existing user accounts — each challenge gets its own row.
     * The UNIQUE constraint on user_id is intentionally bypassed by challenge accounts
     * being linked via fxsim_challenge_accounts.fxsim_account_id, not user_id.
     */
    public static function create_challenge_account(int $user_id, float $balance): int {
        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'fxsim_accounts', [
            'user_id' => $user_id,
            'balance' => $balance,
            'equity'  => $balance,
            'status'  => 'active',
        ]);
        return (int) $wpdb->insert_id;
    }

    /**
     * Legacy: create or return existing account for user.
     * Only used internally now — challenges use create_challenge_account().
     */
    public static function create_account(int $user_id, float $balance = 0.00): void {
        global $wpdb;
        $t = $wpdb->prefix . 'fxsim_accounts';
        if ($wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE user_id=%d LIMIT 1", $user_id))) return;
        $wpdb->insert($t, [
            'user_id' => $user_id,
            'balance' => $balance,
            'equity'  => $balance,
        ]);
        // No automatic deposit transaction — balance starts at 0 until challenge is assigned
    }

    public static function get_account(int $user_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_accounts WHERE user_id=%d ORDER BY id DESC LIMIT 1", $user_id
        ));
    }

    public static function get_account_by_id(int $account_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_accounts WHERE id=%d", $account_id
        ));
    }

    public static function log_transaction(int $acc_id, string $type, float $amount, float $balance_after, ?string $note = null): void {
        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'fxsim_transactions', [
            'account_id'    => $acc_id,
            'type'          => $type,
            'amount'        => $amount,
            'balance_after' => $balance_after,
            'note'          => $note,
        ]);
    }

    public static function log_admin(int $admin_id, string $action, ?int $target = null, ?string $details = null): void {
        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'fxsim_admin_log', [
            'admin_id'       => $admin_id,
            'action'         => $action,
            'target_user_id' => $target,
            'details'        => $details,
            'ip_address'     => sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? ''),
        ]);
    }

    /**
     * Push a notification to a user's notification feed.
     * Called from challenge engine, payments, admin tools.
     *
     * @param int    $user_id
     * @param string $type     info | success | warning | error
     * @param string $title    Short heading (< 80 chars)
     * @param string $message  Body text
     * @param string $link     Optional URL for "View" CTA
     */
    /** Resolve any link (absolute backend URL or relative path) to the frontend SPA base. */
    private static function frontend_link(string $link): ?string {
        $link = trim($link);
        if ($link === '') return null;
        $base = get_option('fxsim_frontend_url', '');
        if (!$base && defined('FXSIM_FRONTEND_URL')) $base = FXSIM_FRONTEND_URL;
        if (!$base) $base = home_url();
        $base = untrailingslashit($base);
        $path = $link;
        if (preg_match('#^https?://#i', $link)) {
            $p    = wp_parse_url($link);
            $path = ($p['path'] ?? '/')
                  . (isset($p['query']) ? '?' . $p['query'] : '')
                  . (isset($p['fragment']) ? '#' . $p['fragment'] : '');
        }
        if ($path === '') $path = '/';
        if ($path[0] !== '/') $path = '/' . $path;
        return $base . $path;
    }

    public static function push_notification(
        int $user_id, string $type, string $title, string $message, string $link = ''
    ): void {
        global $wpdb;
        $flink = self::frontend_link($link);
        $wpdb->insert($wpdb->prefix . 'fxsim_notifications', [
            'user_id'   => $user_id,
            'type'      => in_array($type, ['info','success','warning','error'], true) ? $type : 'info',
            'title'     => substr(sanitize_text_field($title), 0, 120),
            'message'   => sanitize_textarea_field($message),
            'link'      => $flink ? esc_url_raw($flink) : null,
            'is_read'   => 0,
            'created_at'=> current_time('mysql'),
        ]);
        // Keep per-user feed under 50 rows to prevent unbounded growth
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}fxsim_notifications
             WHERE user_id = %d
               AND id NOT IN (
                 SELECT id FROM (
                   SELECT id FROM {$wpdb->prefix}fxsim_notifications
                   WHERE user_id = %d ORDER BY id DESC LIMIT 50
                 ) AS k
               )",
            $user_id, $user_id
        ));
    }

    /**
     * Push a notification to the shared ADMIN feed (user_id = 0). Records a
     * reference to the user the event concerns. Pruned to the latest 200.
     */
    public static function push_admin_notification(
        string $type, string $title, string $message, int $ref_user_id = 0, string $link = ''
    ): void {
        global $wpdb;
        $label = '';
        if ($ref_user_id) {
            $u = get_userdata($ref_user_id);
            if ($u) $label = $u->display_name ?: $u->user_login;
        }
        $wpdb->insert($wpdb->prefix . 'fxsim_notifications', [
            'user_id'        => 0, // 0 = shared admin feed
            'type'           => in_array($type, ['info','success','warning','error'], true) ? $type : 'info',
            'title'          => substr(sanitize_text_field($title), 0, 120),
            'message'        => sanitize_textarea_field($message),
            'link'           => $link ? esc_url_raw(self::frontend_link($link) ?? '') : null,
            'is_read'        => 0,
            'ref_user_id'    => $ref_user_id ?: null,
            'ref_user_label' => $label ? substr($label, 0, 120) : null,
            'created_at'     => current_time('mysql'),
        ]);
        $wpdb->query(
            "DELETE FROM {$wpdb->prefix}fxsim_notifications
             WHERE user_id = 0
               AND id NOT IN (
                 SELECT id FROM (
                   SELECT id FROM {$wpdb->prefix}fxsim_notifications
                   WHERE user_id = 0 ORDER BY id DESC LIMIT 200
                 ) AS k
               )"
        );
        // Send a matching branded admin email (deferred to keep requests fast).
        if (function_exists('wp_schedule_single_event')) {
            wp_schedule_single_event(time(), 'fxsim_admin_email', [$title, $message]);
        }
    }
}
