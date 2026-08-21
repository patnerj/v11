<?php
defined('ABSPATH') || exit;

class FXSIM_PvP_Engine {

    /**
     * Ensure PvP database tables exist
     */
    public static function ensure_tables(): void {
        global $wpdb;
        $table = $wpdb->prefix . 'fxsim_pvp_matches';
        $exists = $wpdb->get_var("SHOW TABLES LIKE '{$table}'");

        if (!$exists) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            $charset_collate = $wpdb->get_charset_collate();

            $sql1 = "CREATE TABLE {$wpdb->prefix}fxsim_pvp_matches (
                id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                match_code             VARCHAR(32) NOT NULL,
                title                  VARCHAR(128) NOT NULL,
                symbol                 VARCHAR(32) NOT NULL DEFAULT 'EURUSD',
                stake_amount           DECIMAL(10,2) NOT NULL DEFAULT 50.00,
                prize_pool             DECIMAL(10,2) NOT NULL DEFAULT 85.00,
                platform_rake          DECIMAL(10,2) NOT NULL DEFAULT 15.00,
                starting_balance       DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
                duration_minutes       INT NOT NULL DEFAULT 15,
                creator_user_id        BIGINT UNSIGNED NOT NULL,
                challenger_user_id     BIGINT UNSIGNED NULL,
                creator_account_id     BIGINT UNSIGNED NULL,
                challenger_account_id  BIGINT UNSIGNED NULL,
                creator_pnl            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                challenger_pnl         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                creator_trades_count   INT NOT NULL DEFAULT 0,
                challenger_trades_count INT NOT NULL DEFAULT 0,
                winner_user_id         BIGINT UNSIGNED NULL,
                status                 ENUM('waiting','active','completed','cancelled') NOT NULL DEFAULT 'waiting',
                started_at             DATETIME NULL,
                expires_at             DATETIME NULL,
                completed_at           DATETIME NULL,
                created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_code (match_code),
                KEY idx_creator (creator_user_id),
                KEY idx_challenger (challenger_user_id),
                KEY idx_status (status)
            ) {$charset_collate};";

            $sql2 = "CREATE TABLE {$wpdb->prefix}fxsim_pvp_events (
                id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                match_id   BIGINT UNSIGNED NOT NULL,
                user_id    BIGINT UNSIGNED NULL,
                event_type VARCHAR(32) NOT NULL,
                message    TEXT NOT NULL,
                payload    LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_match (match_id),
                KEY idx_type (event_type)
            ) {$charset_collate};";

            dbDelta($sql1);
            dbDelta($sql2);
        }
    }

    /**
     * Get PvP Lobby overview: active challenges, live duels, completed matches, and gladiator leaderboard.
     */
    public static function get_lobby(int $user_id = 0): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        // 1. Open Matches (Waiting for Challenger)
        $waiting = $wpdb->get_results("
            SELECT m.*, 
                   u1.display_name AS creator_name, u1.user_email AS creator_email
            FROM {$table} m
            LEFT JOIN {$wpdb->users} u1 ON m.creator_user_id = u1.ID
            WHERE m.status = 'waiting'
            ORDER BY m.id DESC LIMIT 20
        ", ARRAY_A) ?: [];

        // 2. Live Active Duels
        $active = $wpdb->get_results("
            SELECT m.*, 
                   u1.display_name AS creator_name, u1.user_email AS creator_email,
                   u2.display_name AS challenger_name, u2.user_email AS challenger_email
            FROM {$table} m
            LEFT JOIN {$wpdb->users} u1 ON m.creator_user_id = u1.ID
            LEFT JOIN {$wpdb->users} u2 ON m.challenger_user_id = u2.ID
            WHERE m.status = 'active'
            ORDER BY m.started_at DESC LIMIT 20
        ", ARRAY_A) ?: [];

        // 3. Completed Matches
        $completed = $wpdb->get_results("
            SELECT m.*, 
                   u1.display_name AS creator_name,
                   u2.display_name AS challenger_name,
                   uw.display_name AS winner_name
            FROM {$table} m
            LEFT JOIN {$wpdb->users} u1 ON m.creator_user_id = u1.ID
            LEFT JOIN {$wpdb->users} u2 ON m.challenger_user_id = u2.ID
            LEFT JOIN {$wpdb->users} uw ON m.winner_user_id = uw.ID
            WHERE m.status = 'completed'
            ORDER BY m.completed_at DESC LIMIT 15
        ", ARRAY_A) ?: [];

        // 4. Hall of Fame / Leaderboard from real completed duels
        $leaderboard_rows = $wpdb->get_results("
            SELECT m.winner_user_id as user_id, u.display_name as name,
                   COUNT(*) as wins,
                   SUM(m.prize_pool) as earnings
            FROM {$table} m
            JOIN {$wpdb->users} u ON m.winner_user_id = u.ID
            WHERE m.status = 'completed' AND m.winner_user_id IS NOT NULL AND m.winner_user_id > 0
            GROUP BY m.winner_user_id
            ORDER BY wins DESC, earnings DESC LIMIT 10
        ", ARRAY_A) ?: [];

        $leaderboard = [];
        $rank = 1;
        foreach ($leaderboard_rows as $lr) {
            $leaderboard[] = [
                'rank'      => $rank++,
                'name'      => $lr['name'] ?: 'Trader #' . $lr['user_id'],
                'avatar'    => '⚔️',
                'wins'      => (int)$lr['wins'],
                'win_rate'  => 100.0,
                'earnings'  => (float)$lr['earnings'],
                'streak'    => (int)$lr['wins'],
            ];
        }

        // Real database metrics (true zeroes when empty)
        $total_staked = (float) $wpdb->get_var("SELECT SUM(stake_amount * 2) FROM {$table}") ?: 0.00;
        $total_rake = (float) $wpdb->get_var("SELECT SUM(platform_rake) FROM {$table} WHERE status = 'completed'") ?: 0.00;
        $total_matches = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}") ?: 0;

        // Tell the caller which wallet they'll stake from if they create/join
        // a match — only funded traders use their real account; everyone
        // else stakes from an isolated practice balance that can never
        // affect a real evaluation challenge.
        $my_wallet = $user_id > 0 ? self::resolve_pvp_wallet($user_id) : null;

        return [
            'success'     => true,
            'stats'       => [
                'total_staked'   => $total_staked,
                'total_rake'     => $total_rake,
                'total_matches'  => $total_matches,
                'active_count'   => count($active),
                'waiting_count'  => count($waiting),
            ],
            'my_wallet'   => $my_wallet ? [
                'is_practice' => $my_wallet['is_practice'],
                'balance'     => $my_wallet['balance'],
            ] : null,
            'waiting'     => $waiting,
            'active'      => $active,
            'completed'   => $completed,
            'leaderboard' => $leaderboard,
        ];
    }

    /**
     * Resolve a user's currently usable trading account (active or funded
     * challenge), mirroring the same lookup pattern used elsewhere in the
     * plugin (e.g. FXSIM_Trading_Engine's private get_user_active_account()).
     */
    private static function resolve_active_account(int $user_id): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT a.* FROM {$wpdb->prefix}fxsim_accounts a
             JOIN {$wpdb->prefix}fxsim_challenge_accounts ca ON ca.fxsim_account_id = a.id
             WHERE ca.user_id = %d AND ca.status IN ('active','funded')
             ORDER BY ca.created_at DESC, ca.id DESC LIMIT 1",
            $user_id
        ));
    }

    // ── PvP wallet: real money for funded traders, practice money for
    // everyone else ──────────────────────────────────────────────────────
    // Product decision: PvP stakes must never be able to breach a trader's
    // real evaluation challenge — an unrelated side-game shouldn't end their
    // evaluation. Only a FUNDED account's real balance is ever staked here.
    // Evaluation-phase traders (or anyone with no challenge at all) get a
    // separate practice balance, tracked in user_meta, completely isolated
    // from any real challenge account — win or lose, it never touches
    // fxsim_accounts/fxsim_challenge_accounts.
    const PVP_PRACTICE_STARTING_BALANCE = 1000.00;
    const PVP_PRACTICE_META_KEY = 'fxsim_pvp_practice_balance';

    /**
     * Resolve which wallet a user stakes PvP matches from.
     * Returns ['is_practice' => bool, 'account_id' => int (0 if practice),
     *          'user_id' => int, 'balance' => float].
     */
    private static function resolve_pvp_wallet(int $user_id): array {
        global $wpdb;
        $ch = $wpdb->get_row($wpdb->prepare(
            "SELECT ca.status, a.id AS account_id, a.balance
             FROM {$wpdb->prefix}fxsim_challenge_accounts ca
             JOIN {$wpdb->prefix}fxsim_accounts a ON a.id = ca.fxsim_account_id
             WHERE ca.user_id = %d AND ca.status IN ('active','funded')
             ORDER BY ca.created_at DESC, ca.id DESC LIMIT 1",
            $user_id
        ));

        if ($ch && $ch->status === 'funded') {
            return ['is_practice' => false, 'account_id' => (int)$ch->account_id, 'user_id' => $user_id, 'balance' => (float)$ch->balance];
        }

        $balance = get_user_meta($user_id, self::PVP_PRACTICE_META_KEY, true);
        if ($balance === '' || $balance === false) {
            $balance = self::PVP_PRACTICE_STARTING_BALANCE;
            update_user_meta($user_id, self::PVP_PRACTICE_META_KEY, $balance);
        }
        return ['is_practice' => true, 'account_id' => 0, 'user_id' => $user_id, 'balance' => (float)$balance];
    }

    /**
     * Atomically debit a wallet (real account or practice balance). Returns
     * false (no changes made) if the balance is insufficient.
     */
    private static function debit_pvp_wallet(array $wallet, float $amount): bool {
        global $wpdb;
        if (!$wallet['is_practice']) {
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts SET balance = balance - %f, equity = equity - %f WHERE id = %d AND balance >= %f",
                $amount, $amount, $wallet['account_id'], $amount
            ));
            return (bool)$claimed && $wpdb->rows_affected > 0;
        }
        // Practice wallet: not a real financial claim, so a plain re-check
        // (rather than a DB-row atomic UPDATE) is an acceptable trade-off —
        // the worst case of a lost race here is fake money, never real.
        $current = (float) get_user_meta($wallet['user_id'], self::PVP_PRACTICE_META_KEY, true);
        if ($current < $amount) return false;
        update_user_meta($wallet['user_id'], self::PVP_PRACTICE_META_KEY, round($current - $amount, 2));
        return true;
    }

    /** Credit a wallet (real account or practice balance) — winnings or a refund. */
    private static function credit_pvp_wallet_by_account(int $account_id, float $amount, string $txn_type, string $note): void {
        global $wpdb;
        $acc = $wpdb->get_row($wpdb->prepare("SELECT balance, equity FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $account_id));
        if (!$acc) return;
        $new_bal = round((float)$acc->balance + $amount, 2);
        $new_eq  = round((float)$acc->equity + $amount, 2);
        $wpdb->update($wpdb->prefix . 'fxsim_accounts', ['balance' => $new_bal, 'equity' => $new_eq], ['id' => $account_id]);
        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
            FXSIM_Database::log_transaction($account_id, $txn_type, $amount, $new_bal, $note);
        }
    }

    /**
     * Credit a practice wallet directly by user_id. Auto-replenishes back to
     * the starting balance if it would otherwise fall below the platform's
     * minimum stake — a losing streak should never permanently lock an
     * evaluation trader out of practice PvP.
     */
    private static function credit_pvp_practice_wallet(int $user_id, float $amount): void {
        $current = (float) get_user_meta($user_id, self::PVP_PRACTICE_META_KEY, true);
        $new_balance = round($current + $amount, 2);
        if ($new_balance < 10.00) $new_balance = self::PVP_PRACTICE_STARTING_BALANCE;
        update_user_meta($user_id, self::PVP_PRACTICE_META_KEY, $new_balance);
    }

    /**
     * Create a new 1v1 PvP Duel Lobby
     */
    public static function create_match(int $user_id, array $data): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        if ($user_id <= 0) {
            return ['success' => false, 'error' => 'Invalid caller.'];
        }

        $stake = max(10.00, (float)($data['stake_amount'] ?? ($data['stake'] ?? 50.00)));
        $raw_duration = (int)($data['duration_minutes'] ?? ($data['duration'] ?? 15));
        $duration = in_array($raw_duration, [5, 15, 30, 60], true) ? $raw_duration : 15;
        $symbol = strtoupper(sanitize_text_field($data['symbol'] ?? 'EURUSD'));
        $title = sanitize_text_field($data['title'] ?? ($symbol . ' ' . $duration . 'M Gladiator Sprint'));
        $starting_balance = 10000.00;

        $prize_pool = $stake * 2 * 0.85;
        $platform_rake = $stake * 2 * 0.15;
        $match_code = 'PVP-' . strtoupper(substr(md5(uniqid((string)time(), true)), 0, 6));

        // ── Stake escrow: resolve the creator's wallet (real balance if
        // funded, isolated practice balance otherwise — see
        // resolve_pvp_wallet()'s docblock) and atomically debit the stake
        // before the match lobby exists, so a match is never created
        // without money actually backing it.
        $wallet = self::resolve_pvp_wallet($user_id);

        if ($wallet['is_practice']) {
            if (!self::debit_pvp_wallet($wallet, $stake)) {
                return ['success' => false, 'error' => 'Insufficient practice balance to stake $' . number_format($stake, 2) . '.'];
            }
            $inserted = $wpdb->insert($table, [
                'match_code'         => $match_code,
                'title'              => $title,
                'symbol'             => $symbol,
                'stake_amount'       => $stake,
                'prize_pool'         => $prize_pool,
                'platform_rake'      => $platform_rake,
                'starting_balance'   => $starting_balance,
                'duration_minutes'   => $duration,
                'creator_user_id'    => $user_id,
                'creator_account_id' => null, // NULL = staked from practice wallet, not a real account
                'creator_pnl'        => 0.00,
                'challenger_pnl'     => 0.00,
                'status'             => 'waiting',
                'created_at'         => current_time('mysql'),
            ]);
            if (!$inserted) {
                self::credit_pvp_practice_wallet($user_id, $stake); // compensating refund — not inside a SQL transaction
                return ['success' => false, 'error' => 'Failed to create battle arena.'];
            }
            $match_id = (int)$wpdb->insert_id;
            goto pvp_create_match_logged;
        }

        $account_id = $wallet['account_id'];
        $wpdb->query('START TRANSACTION');
        try {
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts
                 SET balance = balance - %f, equity = equity - %f
                 WHERE id = %d AND balance >= %f",
                $stake, $stake, $account_id, $stake
            ));
            if (!$claimed || $wpdb->rows_affected === 0) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'error' => 'Insufficient balance to stake $' . number_format($stake, 2) . '.'];
            }

            $new_bal = (float)$wpdb->get_var($wpdb->prepare(
                "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $account_id
            ));

            $inserted = $wpdb->insert($table, [
                'match_code'         => $match_code,
                'title'              => $title,
                'symbol'             => $symbol,
                'stake_amount'       => $stake,
                'prize_pool'         => $prize_pool,
                'platform_rake'      => $platform_rake,
                'starting_balance'   => $starting_balance,
                'duration_minutes'   => $duration,
                'creator_user_id'    => $user_id,
                'creator_account_id' => $account_id,
                'creator_pnl'        => 0.00,
                'challenger_pnl'     => 0.00,
                'status'             => 'waiting',
                'created_at'         => current_time('mysql'),
            ]);

            if (!$inserted) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'error' => 'Failed to create battle arena.'];
            }

            $match_id = (int)$wpdb->insert_id;

            if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
                FXSIM_Database::log_transaction($account_id, 'pvp_stake', -$stake, $new_bal, "PvP Match Stake: {$match_code}");
            }

            $wpdb->query('COMMIT');
        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            error_log('[PropFirm] create_match() escrow failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Could not create battle arena — please try again.'];
        }

        pvp_create_match_logged:
        // Log event
        $wpdb->insert($wpdb->prefix . 'fxsim_pvp_events', [
            'match_id'   => $match_id,
            'user_id'    => $user_id,
            'event_type' => 'lobby_created',
            'message'    => "Arena {$match_code} opened: {$title} (\${$stake} stake • {$duration} mins).",
        ]);

        // Push notification
        if (class_exists('FXSIM_Database') && $user_id > 0) {
            FXSIM_Database::push_notification(
                $user_id,
                'success',
                '1v1 Battle Arena Created',
                "Your {$symbol} duel lobby ({$match_code}) is live. Waiting for an opponent to enter the ring.",
                "/arena/{$match_id}"
            );
        }

        return [
            'success'      => true,
            'match_id'     => $match_id,
            'match_code'   => $match_code,
            'is_practice'  => $wallet['is_practice'],
            'message'      => $wallet['is_practice']
                ? '1v1 Battle Arena created with your practice balance — not your real evaluation account.'
                : '1v1 Battle Arena created successfully.',
        ];
    }

    /**
     * Join an open 1v1 PvP Duel
     */
    public static function join_match(int $user_id, int $match_id): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        if ($user_id <= 0) {
            return ['success' => false, 'error' => 'Invalid caller.'];
        }

        $match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $match_id));
        if (!$match) {
            return ['success' => false, 'error' => 'Match not found.'];
        }
        if ($match->status !== 'waiting') {
            return ['success' => false, 'error' => 'Match is no longer open for registration.'];
        }
        if ((int)$match->creator_user_id === $user_id) {
            return ['success' => false, 'error' => 'You cannot challenge your own match.'];
        }

        $wallet = self::resolve_pvp_wallet($user_id);
        $stake = (float)$match->stake_amount;
        $now = current_time('mysql');
        $expires = date('Y-m-d H:i:s', time() + ($match->duration_minutes * 60));

        if ($wallet['is_practice']) {
            if (!self::debit_pvp_wallet($wallet, $stake)) {
                return ['success' => false, 'error' => 'Insufficient practice balance to stake $' . number_format($stake, 2) . '.'];
            }
            // Atomic claim on the match slot. If lost (someone else joined a
            // split-second earlier), refund the practice debit — this isn't
            // wrapped in a SQL transaction (user_meta isn't transactable), so
            // the refund is an explicit compensating action instead.
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$table}
                 SET challenger_user_id    = %d,
                     challenger_account_id = NULL,
                     status                = 'active',
                     started_at            = %s,
                     expires_at            = %s
                 WHERE id = %d
                   AND status = 'waiting'
                   AND challenger_user_id IS NULL",
                $user_id, $now, $expires, $match_id
            ));
            if (!$claimed || $wpdb->rows_affected === 0) {
                self::credit_pvp_practice_wallet($user_id, $stake);
                return ['success' => false, 'error' => 'Another challenger has already joined this duel.'];
            }
            goto pvp_join_match_logged;
        }

        $account_id = $wallet['account_id'];
        $wpdb->query('START TRANSACTION');
        try {
            // Debit the challenger's stake first — if this fails (insufficient
            // balance) the match row is never touched at all.
            $debited = $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_accounts
                 SET balance = balance - %f, equity = equity - %f
                 WHERE id = %d AND balance >= %f",
                $stake, $stake, $account_id, $stake
            ));
            if (!$debited || $wpdb->rows_affected === 0) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'error' => 'Insufficient balance to stake $' . number_format($stake, 2) . '.'];
            }

            $new_bal = (float)$wpdb->get_var($wpdb->prepare(
                "SELECT balance FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $account_id
            ));

            // Atomic claim: check-then-act race prevention. If two concurrent
            // users attempt to join the same match, only one caller's UPDATE
            // affects a row. The loser's stake debit above is rolled back by
            // the transaction, so no money is lost on a lost race.
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$table}
                 SET challenger_user_id    = %d,
                     challenger_account_id = %d,
                     status                = 'active',
                     started_at            = %s,
                     expires_at            = %s
                 WHERE id = %d
                   AND status = 'waiting'
                   AND challenger_user_id IS NULL",
                $user_id,
                $account_id,
                $now,
                $expires,
                $match_id
            ));

            if (!$claimed || $wpdb->rows_affected === 0) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'error' => 'Another challenger has already joined this duel.'];
            }

            if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
                FXSIM_Database::log_transaction($account_id, 'pvp_stake', -$stake, $new_bal, "PvP Match Stake: {$match->match_code}");
            }

            $wpdb->query('COMMIT');
        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            error_log('[PropFirm] join_match() escrow failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Could not join battle — please try again.'];
        }

        pvp_join_match_logged:

        // Log duel start
        $wpdb->insert($wpdb->prefix . 'fxsim_pvp_events', [
            'match_id'   => $match_id,
            'user_id'    => $user_id,
            'event_type' => 'battle_started',
            'message'    => "⚡ Challenger entered the ring! 1v1 Battle is now LIVE for {$match->duration_minutes} minutes.",
        ]);

        // Notify fighters
        if (class_exists('FXSIM_Database')) {
            FXSIM_Database::push_notification(
                (int)$match->creator_user_id,
                'warning',
                '⚔️ 1v1 Duel Commenced!',
                "An opponent has accepted your challenge on {$match->symbol}! The countdown timer is ticking.",
                "/arena/{$match_id}"
            );
            FXSIM_Database::push_notification(
                $user_id,
                'warning',
                '⚔️ Entering the Arena!',
                "You joined {$match->match_code}! Good luck in the 1v1 duel.",
                "/arena/{$match_id}"
            );
        }

        return [
            'success'     => true,
            'match_id'    => $match_id,
            'status'      => 'active',
            'is_practice' => $wallet['is_practice'],
            'message'     => 'Challenger registered. Duel is now LIVE!',
        ];
    }

    /**
     * Get live state of a battle in real-time
     */
    public static function get_live_state(int $match_id, int $user_id = 0): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        $match = $wpdb->get_row($wpdb->prepare("
            SELECT m.*,
                   u1.display_name AS creator_name, u1.user_email AS creator_email,
                   u2.display_name AS challenger_name, u2.user_email AS challenger_email,
                   uw.display_name AS winner_name
            FROM {$table} m
            LEFT JOIN {$wpdb->users} u1 ON m.creator_user_id = u1.ID
            LEFT JOIN {$wpdb->users} u2 ON m.challenger_user_id = u2.ID
            LEFT JOIN {$wpdb->users} uw ON m.winner_user_id = uw.ID
            WHERE m.id = %d
        ", $match_id), ARRAY_A);

        if (!$match) {
            return ['success' => false, 'error' => 'Battle not found.'];
        }

        // Check timer expiration and auto-settle if needed
        $now_ts = time();
        $expires_ts = !empty($match['expires_at']) ? strtotime($match['expires_at']) : 0;
        $seconds_remaining = max(0, $expires_ts - $now_ts);

        if ($match['status'] === 'active' && $seconds_remaining <= 0 && $expires_ts > 0) {
            self::settle_match($match_id);
            // Re-fetch settled match
            return self::get_live_state($match_id, $user_id);
        }

        // Live prices & tick feed
        $prices = ['bid' => 1.0845, 'ask' => 1.0847];
        if (class_exists('FXSIM_Price_Feed')) {
            $feed = FXSIM_Price_Feed::get($match['symbol'] ?: 'EURUSD');
            if (!empty($feed['bid'])) {
                $prices = $feed;
            }
        }

        // Events feed
        $events = $wpdb->get_results($wpdb->prepare("
            SELECT e.*, u.display_name AS author_name
            FROM {$wpdb->prefix}fxsim_pvp_events e
            LEFT JOIN {$wpdb->users} u ON e.user_id = u.ID
            WHERE e.match_id = %d
            ORDER BY e.id DESC LIMIT 30
        ", $match_id), ARRAY_A) ?: [];

        // Dynamic live stats
        $creator_pnl = (float)$match['creator_pnl'];
        $challenger_pnl = (float)$match['challenger_pnl'];
        $lead_delta = $creator_pnl - $challenger_pnl;

        return [
            'success'           => true,
            'match'             => $match,
            'seconds_remaining' => $seconds_remaining,
            'prices'            => $prices,
            'events'            => $events,
            'creator'           => [
                'user_id'      => (int)$match['creator_user_id'],
                'name'         => $match['creator_name'] ?: 'Creator Gladiator',
                'equity'       => (float)$match['starting_balance'] + $creator_pnl,
                'pnl'          => $creator_pnl,
                'trades_count' => (int)$match['creator_trades_count'],
            ],
            'challenger'        => [
                'user_id'      => (int)$match['challenger_user_id'],
                'name'         => $match['challenger_name'] ?: 'Waiting for Opponent...',
                'equity'       => (float)$match['starting_balance'] + $challenger_pnl,
                'pnl'          => $challenger_pnl,
                'trades_count' => (int)$match['challenger_trades_count'],
            ],
            'lead_delta'        => $lead_delta,
            'leader'            => $lead_delta > 0 ? 'creator' : ($lead_delta < 0 ? 'challenger' : 'tied'),
        ];
    }

    /**
     * In-Arena 1-Click Fast Market Order Execution
     */
    public static function execute_order(int $user_id, int $match_id, array $data): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        if ($user_id <= 0) {
            return ['success' => false, 'error' => 'Invalid caller.'];
        }

        $match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $match_id));
        if (!$match || $match->status !== 'active') {
            return ['success' => false, 'error' => 'Battle is not active.'];
        }

        // Match expiration check: reject order execution if match timer has expired
        $now_ts = time();
        $expires_ts = !empty($match->expires_at) ? strtotime($match->expires_at) : 0;
        if ($expires_ts > 0 && $now_ts >= $expires_ts) {
            self::settle_match($match_id, 0);
            return ['success' => false, 'error' => 'Battle has expired and is now concluding.'];
        }

        $is_creator = ((int)$match->creator_user_id === $user_id);
        $is_challenger = ((int)$match->challenger_user_id === $user_id);

        if (!$is_creator && !$is_challenger) {
            return ['success' => false, 'error' => 'You are not a participant in this duel.'];
        }

        $action = strtoupper(sanitize_text_field($data['action'] ?? 'BUY'));
        $lots = max(0.1, min(10.0, (float)($data['lot_size'] ?? 1.0)));
        
        $prices = ['bid' => 1.0845, 'ask' => 1.0847];
        if (class_exists('FXSIM_Price_Feed')) {
            $feed = FXSIM_Price_Feed::get($match->symbol);
            if (!empty($feed['bid'])) $prices = $feed;
        }
        $exec_price = ($action === 'BUY') ? $prices['ask'] : $prices['bid'];

        // Deterministic PnL tied to real price movement, not rand(). No
        // schema change needed: each order's own execution price/direction/
        // size is stored in its event payload, and read back here as the
        // reference for evaluating the price move since this player's LAST
        // order (i.e. the implicit position that order opened is marked to
        // market and closed at the current click's price). A player's very
        // first order in a match has no prior reference, so it opens a
        // position with zero PnL rather than fabricating a comparison.
        $direction = strtolower($action) === 'sell' ? 'sell' : 'buy';
        $last_event = $wpdb->get_row($wpdb->prepare(
            "SELECT payload FROM {$wpdb->prefix}fxsim_pvp_events
             WHERE match_id = %d AND user_id = %d AND event_type = 'trade_executed'
             ORDER BY id DESC LIMIT 1",
            $match_id, $user_id
        ));
        $last_price = 0.0;
        $last_direction = null;
        $last_lots = 0.0;
        if ($last_event && $last_event->payload) {
            $decoded = json_decode($last_event->payload, true);
            $last_price = (float)($decoded['exec_price'] ?? 0);
            $last_direction = $decoded['direction'] ?? null;
            $last_lots = (float)($decoded['lot_size'] ?? 0);
        }

        if ($last_price > 0 && $last_direction !== null && $last_lots > 0 && class_exists('FXSIM_Trading_Engine')) {
            $fake_pos = (object)[
                'symbol'     => $match->symbol,
                'type'       => $last_direction,
                'lot_size'   => $last_lots,
                'open_price' => $last_price,
                'commission' => 0.0,
                'swap'       => 0.0,
            ];
            $tick_pnl = FXSIM_Trading_Engine::calc_pnl($fake_pos, $exec_price);
        } else {
            $tick_pnl = 0.0;
        }

        if ($is_creator) {
            $new_pnl = (float)$match->creator_pnl + $tick_pnl;
            $wpdb->update($table, [
                'creator_pnl'          => $new_pnl,
                'creator_trades_count' => (int)$match->creator_trades_count + 1,
            ], ['id' => $match_id]);
        } else {
            $new_pnl = (float)$match->challenger_pnl + $tick_pnl;
            $wpdb->update($table, [
                'challenger_pnl'          => $new_pnl,
                'challenger_trades_count' => (int)$match->challenger_trades_count + 1,
            ], ['id' => $match_id]);
        }

        $user_obj = get_userdata($user_id);
        $fighter_name = $user_obj ? $user_obj->display_name : 'Gladiator';

        // Clean string concatenation to prevent PHP parser syntax errors
        $sign = ($tick_pnl > 0) ? '+' : '';
        $event_msg = "🔥 " . $fighter_name . " executed " . $action . " " . $lots . "L on " . $match->symbol . " @ " . $exec_price . " (" . $sign . "$" . $tick_pnl . " PnL)";

        // Log trade event to live arena feed — payload carries this order's
        // price/direction/size so the NEXT order from this same player can
        // use it as the reference for its own PnL calculation above.
        $wpdb->insert($wpdb->prefix . 'fxsim_pvp_events', [
            'match_id'   => $match_id,
            'user_id'    => $user_id,
            'event_type' => 'trade_executed',
            'message'    => $event_msg,
            'payload'    => json_encode(['exec_price' => $exec_price, 'direction' => $direction, 'lot_size' => $lots]),
        ]);

        return [
            'success'    => true,
            'action'     => $action,
            'lot_size'   => $lots,
            'exec_price' => $exec_price,
            'tick_pnl'   => $tick_pnl,
            'new_pnl'    => $new_pnl,
            'message'    => "Executed {$action} {$lots} Lots successfully.",
        ];
    }

    /**
     * Settle Match & Award Winner Prize Pool
     */
    /**
     * @param int $requesting_user_id Pass 0 for trusted/system callers (the
     *   internal auto-settle-on-expiry path). Any non-zero value is treated
     *   as an end-user request and must be one of the match's two
     *   participants or a site admin — settle_match() previously had no
     *   authorization check at all, so any authenticated trader could
     *   force-settle any other pair's match on demand.
     */
    public static function settle_match(int $match_id, int $requesting_user_id = 0): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        $match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $match_id));
        if (!$match) return ['success' => false, 'error' => 'Match not found.'];

        if ($requesting_user_id !== 0) {
            $is_participant = in_array($requesting_user_id, [(int)$match->creator_user_id, (int)$match->challenger_user_id], true);
            if (!$is_participant && !user_can($requesting_user_id, 'manage_options')) {
                return ['success' => false, 'error' => 'Only the match participants or an admin may settle this match.'];
            }
        }
        if ($match->status === 'completed') return ['success' => true, 'message' => 'Already settled.'];

        // Atomic claim: status is an ENUM('waiting','active','completed',
        // 'cancelled') with no separate in-progress value to stage through,
        // so the claim IS the transition straight to 'completed' — the
        // WHERE clause is what makes only one concurrent caller's UPDATE
        // actually match the row. The winner/margin below are computed from
        // creator_pnl/challenger_pnl already read above, which don't change
        // once a match is no longer 'active', so it's safe to compute them
        // after winning the claim. The previous "check status in PHP, then
        // unconditionally UPDATE" let two concurrent settle calls both pass
        // the check and both fire the win/loss notifications and prize
        // side-effects for the same match.
        $claimed = $wpdb->query($wpdb->prepare(
            "UPDATE {$table} SET status = 'completed' WHERE id = %d AND status != 'completed'",
            $match_id
        ));
        if (!$claimed || $wpdb->rows_affected === 0) return ['success' => false, 'error' => 'Match is already being settled.'];

        $creator_pnl = (float)$match->creator_pnl;
        $challenger_pnl = (float)$match->challenger_pnl;
        // Float-safe equality: PnL is accumulated across many small
        // calc_pnl() additions, so an exact tie can arrive as e.g.
        // 12.000000001 vs 12.0 rather than bit-identical values.
        $is_tie = abs($creator_pnl - $challenger_pnl) < 0.005;

        if ($is_tie) {
            // Tie: no winner. Per product decision, ties refund both
            // participants' stakes rather than awarding the full prize to
            // the creator — a coin-flip-adjacent outcome shouldn't hand one
            // side the whole pot.
            $winner_id = 0;
            $loser_id = 0;
            $win_margin = 0.0;
        } elseif ($creator_pnl > $challenger_pnl) {
            $winner_id = (int)$match->creator_user_id;
            $loser_id = (int)$match->challenger_user_id;
            $win_margin = $creator_pnl - $challenger_pnl;
        } else {
            $winner_id = (int)$match->challenger_user_id;
            $loser_id = (int)$match->creator_user_id;
            $win_margin = $challenger_pnl - $creator_pnl;
        }

        $now = current_time('mysql');
        $wpdb->update($table, [
            'winner_user_id' => $is_tie ? null : $winner_id,
            'status'         => 'completed',
            'completed_at'   => $now,
        ], ['id' => $match_id]);

        // ── Money settlement ────────────────────────────────────────────
        // Both participants' stakes were already debited at create/join time
        // (stake * 2 total removed). Non-tie: credit prize_pool (85% of that
        // total) to the winner — the other 15% (platform_rake) stays
        // uncredited to anyone, which IS the intended rake, no separate
        // bookkeeping needed. Tie: refund each participant their own
        // stake_amount instead (no rake taken on a tie — nobody won). Legacy
        // matches created before escrow existed have NULL account ids and
        // are safely skipped (nothing was ever taken from them).
        if ($is_tie) {
            $stake = (float)$match->stake_amount;
            // Pair each side's account_id with its user_id — a NULL
            // account_id means that side staked from a practice wallet
            // (see resolve_pvp_wallet()), which must still be refunded, not
            // silently skipped just because there's no real account row.
            $sides = [
                [(int)$match->creator_account_id, (int)$match->creator_user_id],
                [(int)$match->challenger_account_id, (int)$match->challenger_user_id],
            ];
            foreach ($sides as [$acc_id, $side_user_id]) {
                if ($side_user_id <= 0) continue; // no participant on this side (e.g. never-joined match)
                if ($acc_id <= 0) {
                    self::credit_pvp_practice_wallet($side_user_id, $stake);
                    continue;
                }
                $wpdb->query('START TRANSACTION');
                try {
                    $acc = $wpdb->get_row($wpdb->prepare(
                        "SELECT balance, equity FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $acc_id
                    ));
                    if ($acc) {
                        $new_bal = round((float)$acc->balance + $stake, 2);
                        $new_eq  = round((float)$acc->equity + $stake, 2);
                        $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                            ['balance' => $new_bal, 'equity' => $new_eq],
                            ['id' => $acc_id]
                        );
                        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
                            FXSIM_Database::log_transaction($acc_id, 'pvp_refund', $stake, $new_bal, "PvP Match Tie Refund: {$match->match_code}");
                        }
                    }
                    $wpdb->query('COMMIT');
                } catch (\Throwable $e) {
                    $wpdb->query('ROLLBACK');
                    error_log("[PropFirm] settle_match(): tie refund failed for match #{$match_id}, account #{$acc_id}: " . $e->getMessage());
                }
            }
        } else {
            $winner_account_id = ($winner_id === (int)$match->creator_user_id)
                ? (int)$match->creator_account_id
                : (int)$match->challenger_account_id;

            if ($winner_account_id > 0) {
                $wpdb->query('START TRANSACTION');
                try {
                    $prize = (float)$match->prize_pool;
                    $acc = $wpdb->get_row($wpdb->prepare(
                        "SELECT balance, equity FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $winner_account_id
                    ));
                    if ($acc) {
                        $new_bal = round((float)$acc->balance + $prize, 2);
                        $new_eq  = round((float)$acc->equity + $prize, 2);
                        $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                            ['balance' => $new_bal, 'equity' => $new_eq],
                            ['id' => $winner_account_id]
                        );
                        if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
                            FXSIM_Database::log_transaction($winner_account_id, 'pvp_prize', $prize, $new_bal, "PvP Match Prize: {$match->match_code}");
                        }
                    }
                    $wpdb->query('COMMIT');
                } catch (\Throwable $e) {
                    $wpdb->query('ROLLBACK');
                    error_log("[PropFirm] settle_match(): prize disbursement failed for match #{$match_id}, winner account #{$winner_account_id}: " . $e->getMessage());
                }
            } elseif ($winner_id > 0) {
                // NULL account_id but a real winner — they staked from a
                // practice wallet, not a legacy/unfilled match. Credit it
                // directly rather than logging this as an anomaly.
                self::credit_pvp_practice_wallet($winner_id, (float)$match->prize_pool);
            } else {
                error_log("[PropFirm] settle_match(): match #{$match_id} has no winner user id — prize not credited (spectator-triggered settle on an unfilled match?).");
            }
        }

        // Log final event + notifications
        if ($is_tie) {
            $wpdb->insert($wpdb->prefix . 'fxsim_pvp_events', [
                'match_id'   => $match_id,
                'user_id'    => 0,
                'event_type' => 'match_settled',
                'message'    => "🤝 MATCH TIED! Both gladiators fought to a dead heat — stakes refunded, no rake taken.",
            ]);
            if (class_exists('FXSIM_Database')) {
                foreach ([(int)$match->creator_user_id, (int)$match->challenger_user_id] as $uid) {
                    if ($uid <= 0) continue;
                    FXSIM_Database::push_notification(
                        $uid, 'info', "🤝 Duel Tied — Stake Refunded",
                        "Match {$match->match_code} ended in a tie. Your \${$match->stake_amount} stake has been refunded.",
                        "/arena/{$match_id}"
                    );
                }
            }
            return [
                'success'    => true,
                'winner_id'  => 0,
                'tie'        => true,
                'prize_pool' => 0.0,
                'rake'       => 0.0,
                'message'    => 'Match tied — both stakes refunded.',
            ];
        }

        $winner_obj = get_userdata($winner_id);
        $winner_name = $winner_obj ? $winner_obj->display_name : 'Winner';

        $wpdb->insert($wpdb->prefix . 'fxsim_pvp_events', [
            'match_id'   => $match_id,
            'user_id'    => $winner_id,
            'event_type' => 'match_settled',
            'message'    => "🏆 MATCH CONCLUDED! {$winner_name} wins the \${$match->prize_pool} prize pool by a lead of +\${$win_margin}!",
        ]);

        if (class_exists('FXSIM_Database')) {
            if ($winner_id > 0) {
                FXSIM_Database::push_notification(
                    $winner_id,
                    'success',
                    '🏆 VICTORY! You Won the 1v1 Duel',
                    "Congratulations! You won \${$match->prize_pool} USDC on your {$match->symbol} sprint duel.",
                    "/arena/{$match_id}"
                );
            }
            if ($loser_id > 0) {
                FXSIM_Database::push_notification(
                    $loser_id,
                    'info',
                    'Battle Concluded',
                    "Match {$match->match_code} has ended. Better luck in your next arena duel!",
                    "/arena/{$match_id}"
                );
            }
        }

        return [
            'success'    => true,
            'winner_id'  => $winner_id,
            'tie'        => false,
            'prize_pool' => (float)$match->prize_pool,
            'rake'       => (float)$match->platform_rake,
            'message'    => "Match settled. {$winner_name} crowned champion!",
        ];
    }

    /**
     * Cancel a still-open (unfilled) match and refund the creator's stake.
     * Only the creator or an admin may cancel, and only while status is
     * still 'waiting' (no challenger has joined yet) — an active duel must
     * be settled via settle_match(), never simply cancelled.
     */
    public static function cancel_match(int $match_id, int $requesting_user_id): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        $match = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $match_id));
        if (!$match) return ['success' => false, 'error' => 'Match not found.'];

        $is_creator = ((int)$match->creator_user_id === $requesting_user_id);
        if (!$is_creator && !user_can($requesting_user_id, 'manage_options')) {
            return ['success' => false, 'error' => 'Only the match creator or an admin may cancel this duel.'];
        }

        $wpdb->query('START TRANSACTION');
        try {
            // Atomic claim: only cancel a match still sitting unfilled — if a
            // challenger joined in the same instant, this correctly fails
            // rather than cancelling a now-active duel out from under them.
            $claimed = $wpdb->query($wpdb->prepare(
                "UPDATE {$table} SET status = 'cancelled', completed_at = %s
                 WHERE id = %d AND status = 'waiting'",
                current_time('mysql'), $match_id
            ));
            if (!$claimed || $wpdb->rows_affected === 0) {
                $wpdb->query('ROLLBACK');
                return ['success' => false, 'error' => 'This duel can no longer be cancelled (already joined or settled).'];
            }

            // A NULL creator_account_id means the stake came from a practice
            // wallet (see resolve_pvp_wallet()) — refund that after the
            // transaction commits (user_meta isn't part of this SQL
            // transaction), not skip it.
            $account_id = (int)$match->creator_account_id;
            if ($account_id > 0) {
                $stake = (float)$match->stake_amount;
                $acc = $wpdb->get_row($wpdb->prepare(
                    "SELECT balance, equity FROM {$wpdb->prefix}fxsim_accounts WHERE id = %d", $account_id
                ));
                if ($acc) {
                    $new_bal = round((float)$acc->balance + $stake, 2);
                    $new_eq  = round((float)$acc->equity + $stake, 2);
                    $wpdb->update($wpdb->prefix . 'fxsim_accounts',
                        ['balance' => $new_bal, 'equity' => $new_eq],
                        ['id' => $account_id]
                    );
                    if (class_exists('FXSIM_Database') && method_exists('FXSIM_Database', 'log_transaction')) {
                        FXSIM_Database::log_transaction($account_id, 'pvp_refund', $stake, $new_bal, "PvP Match Cancelled — Stake Refunded: {$match->match_code}");
                    }
                }
            }

            $wpdb->query('COMMIT');
        } catch (\Throwable $e) {
            $wpdb->query('ROLLBACK');
            error_log('[PropFirm] cancel_match() failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Could not cancel duel — please try again.'];
        }

        if ((int)$match->creator_account_id <= 0) {
            self::credit_pvp_practice_wallet((int)$match->creator_user_id, (float)$match->stake_amount);
        }

        $wpdb->insert($wpdb->prefix . 'fxsim_pvp_events', [
            'match_id'   => $match_id,
            'user_id'    => $requesting_user_id,
            'event_type' => 'lobby_cancelled',
            'message'    => "Arena {$match->match_code} was cancelled by its creator. Stake refunded.",
        ]);

        return ['success' => true, 'message' => 'Duel cancelled and stake refunded.'];
    }

    /**
     * Admin PvP Overview & Rake Revenue Analytics
     */
    public static function get_admin_analytics(): array {
        global $wpdb;
        self::ensure_tables();
        $table = $wpdb->prefix . 'fxsim_pvp_matches';

        $total_staked = (float) $wpdb->get_var("SELECT SUM(stake_amount * 2) FROM {$table}") ?: 0;
        $total_rake = (float) $wpdb->get_var("SELECT SUM(platform_rake) FROM {$table} WHERE status = 'completed'") ?: 0;
        $total_matches = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}") ?: 0;
        $active_matches = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE status = 'active'") ?: 0;
        $completed_matches = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE status = 'completed'") ?: 0;

        $recent_matches = $wpdb->get_results("
            SELECT m.*, 
                   u1.display_name AS creator_name,
                   u1.user_email   AS creator_email,
                   u1.user_login   AS creator_login,
                   u2.display_name AS challenger_name,
                   u2.user_email   AS challenger_email,
                   u2.user_login   AS challenger_login,
                   uw.display_name AS winner_name,
                   uw.user_email   AS winner_email
            FROM {$table} m
            LEFT JOIN {$wpdb->users} u1 ON m.creator_user_id = u1.ID
            LEFT JOIN {$wpdb->users} u2 ON m.challenger_user_id = u2.ID
            LEFT JOIN {$wpdb->users} uw ON m.winner_user_id = uw.ID
            ORDER BY m.id DESC LIMIT 30
        ", ARRAY_A) ?: [];

        return [
            'success'   => true,
            'analytics' => [
                'total_staked'      => $total_staked,
                'total_rake'        => $total_rake,
                'total_matches'     => $total_matches,
                'active_matches'    => $active_matches,
                'completed_matches' => $completed_matches,
            ],
            'matches'   => $recent_matches,
        ];
    }
}
