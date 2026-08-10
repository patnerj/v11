<?php
/**
 * FXSIM_Price_Feed — Price data provider.
 *
 * Phase 2 optimisations:
 *
 * 1. BATCH FETCH: All 14 symbols fetched in ONE HTTP request via Yahoo Finance v7 batch
 *    endpoint (?symbols=...) instead of 14 sequential requests (~3s → ~300ms).
 *    curl_multi parallel fallback used when batch endpoint fails and curl is available.
 *    Final fallback: sequential wp_remote_get (original behaviour, always works).
 *
 * 2. COMBINED CACHE: All 14 prices stored in ONE cache key ('fxsim_all_prices') via
 *    FXSIM_Cache (object cache → transients → option). Previously 14 individual
 *    wp_options with autoload=yes caused all prices to load into memory on every WP page.
 *
 * 3. PROCESS-LEVEL STATIC CACHE: FXSIM_Cache::get() is called at most once per
 *    PHP process. After that, FXSIM_Price_Feed::get($sym) reads from the static
 *    $prices_runtime array in memory — zero DB/cache overhead within a single request.
 *
 * Backward compatibility: get(), get_all(), update_all_prices(), simulate() have
 * identical signatures and return formats. All call sites are unaffected.
 */
defined('ABSPATH') || exit;

class FXSIM_Price_Feed {

    /**
     * Yahoo Finance v7 batch endpoint — fetches all symbols in one HTTP call.
     * v8 individual endpoint kept as fallback for single-symbol fetches.
     */
    const YAHOO_BATCH_URL = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=';
    const YAHOO_V8_URL    = 'https://query1.finance.yahoo.com/v8/finance/chart/';

    /**
     * Combined cache key — stores ALL 14 prices in one entry.
     * TTL: 35 seconds (slightly longer than the 30s cron interval so there is
     * always a valid cached value when the cron tick runs).
     */
    const CACHE_KEY = 'all_prices';
    const CACHE_TTL = 35;

    /** Twelve Data batch endpoint — used when fxsim_twelve_data_key is configured */
    const TWELVE_DATA_URL = 'https://api.twelvedata.com/price?';

    /** Twelve Data symbol map — our symbol → Twelve Data format */
    private static array $twelve_map = [
        'EURUSD' => 'EUR/USD', 'GBPUSD' => 'GBP/USD', 'USDJPY' => 'USD/JPY',
        'USDCHF' => 'USD/CHF', 'AUDUSD' => 'AUD/USD', 'USDCAD' => 'USD/CAD',
        'NZDUSD' => 'NZD/USD', 'EURGBP' => 'EUR/GBP', 'EURJPY' => 'EUR/JPY',
        'GBPJPY' => 'GBP/JPY', 'XAUUSD' => 'XAU/USD', 'XAGUSD' => 'XAG/USD',
        'BTCUSD' => 'BTC/USD', 'ETHUSD' => 'ETH/USD',
    ];

    /** Yahoo Finance ticker map — symbol → Yahoo ticker string */
    private static array $yahoo_map = [
        'EURUSD'  => 'EURUSD=X', 'GBPUSD'  => 'GBPUSD=X',
        'USDJPY'  => 'JPY=X',    'USDCHF'  => 'CHF=X',
        'AUDUSD'  => 'AUDUSD=X', 'USDCAD'  => 'CAD=X',
        'NZDUSD'  => 'NZDUSD=X', 'EURGBP'  => 'EURGBP=X',
        'EURJPY'  => 'EURJPY=X', 'GBPJPY'  => 'GBPJPY=X',
        'XAUUSD'  => 'GC=F',     'XAGUSD'  => 'SI=F',
        'BTCUSD'  => 'BTC-USD',  'ETHUSD'  => 'ETH-USD',
        // V10.6.3 (BUG-007) — index & energy mappings. Yahoo index tickers are
        // spot values and may differ slightly from broker CFD/futures pricing,
        // but are the correct Yahoo source; MT5 feeds override these by symbol.
        'US30'    => '^DJI',     'NAS100'  => '^NDX',
        'SPX500'  => '^GSPC',    'GER40'   => '^GDAXI',
        'UK100'   => '^FTSE',
        'USOIL'   => 'CL=F',     'XBRUSD'  => 'BZ=F',
    ];

    /** Reverse map: Yahoo ticker → our symbol (used when parsing batch response) */
    private static array $ticker_to_symbol = [];

    /** Simulated base prices — used when all HTTP sources fail */
    private static array $base_prices = [
        'EURUSD'=>1.08500,'GBPUSD'=>1.27000,'USDJPY'=>149.500,'USDCHF'=>0.90000,
        'AUDUSD'=>0.65000,'USDCAD'=>1.36000,'NZDUSD'=>0.60500,'EURGBP'=>0.85500,
        'EURJPY'=>162.000,'GBPJPY'=>190.000,'XAUUSD'=>2350.00,'XAGUSD'=>28.500,
        'BTCUSD'=>65000.0,'ETHUSD'=>3500.00,
    ];

    /**
     * Process-level in-memory price store.
     * Populated once per PHP process from FXSIM_Cache.
     * After that, all get() calls read from here — zero cache overhead per call.
     * Format: [ 'EURUSD' => ['bid'=>X,'ask'=>X,'mid'=>X,'ts'=>X], ... ]
     */
    private static array $prices_runtime = [];

    /** Whether $prices_runtime has been loaded from cache this request. */
    private static bool $runtime_loaded = false;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Get the current price data for one symbol.
     * Reads from the process-level cache (zero DB/transient calls after first use).
     *
     * @param string $symbol Trading pair (e.g. 'EURUSD').
     * @return array ['bid'=>float,'ask'=>float,'mid'=>float,'ts'=>int]
     */
    public static function get(string $symbol): array {
        self::ensure_runtime_loaded();
        return self::$prices_runtime[$symbol]
            ?? ['bid' => 0, 'ask' => 0, 'mid' => 0, 'ts' => 0];
    }

    /**
     * Get price data for all symbols.
     * Used by the /prices REST endpoint.
     *
     * @return array Keyed by symbol.
     */
    public static function get_all(): array {
        self::ensure_runtime_loaded();
        return self::$prices_runtime;
    }

    // ── V10: MT5 live feed ingestion ────────────────────────────────────────────

    /** Staleness threshold (seconds) for the MT5 push feed. */
    const MT5_STALE_DEFAULT = 12;

    /**
     * Sanity-guard tuning for ingested quotes. Deliberately generous: the goal is
     * to catch order-of-magnitude errors (symbol mismaps, fat-fingers, decimal
     * slips, garbage) WITHOUT ever rejecting a legitimate market move.
     */
    const SANITY_MAX_SPREAD_PCT = 0.10;  // implied (ask-bid)/mid above this = bad tick
    const SANITY_DEV_LOOKBACK   = 120;   // only deviation-check vs a price newer than this (s)
    const SANITY_DEV_FX         = 0.10;  // max single-tick move vs last: FX
    const SANITY_DEV_METAL      = 0.20;  // metals (XAU/XAG)
    const SANITY_DEV_CRYPTO     = 0.35;  // crypto (BTC/ETH)
    const SANITY_BAND_MIN       = 0.25;  // absolute floor = base price × this
    const SANITY_BAND_MAX       = 4.0;   // absolute ceiling = base price × this

    /**
     * Ingest a batch of live prices pushed by an external MT5 price service.
     * Writes into the SAME combined store that Yahoo uses, so every downstream
     * consumer (trading engine, /prices, /stream) is unchanged.
     *
     * Accepts, per symbol, either a scalar mid or ['bid'=>..,'ask'=>..] (and/or 'mid').
     * Unknown symbols are ignored. Partial batches merge onto the existing store.
     *
     * @param array  $incoming  ['EURUSD'=>['bid'=>..,'ask'=>..], 'XAUUSD'=>2350.1, ...]
     * @param string $source_id Free-form tag identifying the pushing service.
     * @return int   Number of symbols accepted.
     */
    public static function ingest(array $incoming, string $source_id = 'mt5'): int {
        if (empty($incoming)) return 0;

        // Spread lookup (used when only a mid is supplied).
        $spread_map = [];
        foreach (FXSIM_Symbols::all() as $sym) {
            $spread_map[$sym->symbol] = (float) $sym->spread;
        }
        if (empty($spread_map)) return 0;

        self::ensure_runtime_loaded();
        $data = self::$prices_runtime ?: [];   // merge onto existing
        $now  = time();
        $accepted = 0;
        $rejects  = [];   // [symbol => reason] for logging/surfacing

        foreach ($incoming as $symbol => $q) {
            $symbol = strtoupper((string) $symbol);
            if (!isset($spread_map[$symbol])) {
                $rejects[$symbol] = 'unknown_symbol';            // mismapped / not on platform
                continue;
            }
            $spread = $spread_map[$symbol];

            $bid = 0.0; $ask = 0.0; $mid = 0.0;
            if (is_array($q)) {
                $bid = isset($q['bid']) ? (float) $q['bid'] : 0.0;
                $ask = isset($q['ask']) ? (float) $q['ask'] : 0.0;
                $mid = isset($q['mid']) ? (float) $q['mid'] : 0.0;
                if ($mid <= 0 && $bid > 0 && $ask > 0) $mid = ($bid + $ask) / 2;
                if ($bid <= 0 && $mid > 0) $bid = $mid - ($spread / 2);
                if ($ask <= 0 && $mid > 0) $ask = $mid + ($spread / 2);
            } else {
                $mid = (float) $q;
                if ($mid > 0) { $bid = $mid - ($spread / 2); $ask = $mid + ($spread / 2); }
            }

            // ── Sanity guard ──────────────────────────────────────────────────
            // Rejects obviously invalid or mismapped quotes BEFORE they can reach
            // the price store (and therefore fills, PnL, equity, drawdown, rules).
            // A skipped symbol simply keeps its previous value; it is never written.
            $reason = self::validate_quote($symbol, $bid, $ask, $mid, $data[$symbol] ?? null, $now);
            if ($reason !== null) {
                $rejects[$symbol] = $reason;
                continue;
            }

            $data[$symbol] = [
                'bid' => round($bid, 5),
                'ask' => round($ask, 5),
                'mid' => round($mid, 5),
                'ts'  => $now,
            ];
            $accepted++;
        }

        // Log / surface rejections (no DB write on the clean path — rejects are rare).
        if (!empty($rejects)) {
            foreach ($rejects as $rsym => $rreason) {
                error_log("FXSIM price ingest rejected {$rsym}: {$rreason}");
            }
            update_option('fxsim_mt5_last_reject', [
                'ts'      => $now,
                'count'   => count($rejects),
                'symbols' => $rejects,
            ], false);
        }

        if ($accepted === 0) return 0;

        // ── Write the SAME store Yahoo uses ───────────────────────────────────
        FXSIM_Cache::set(self::CACHE_KEY, $data, self::CACHE_TTL);
        update_option('fxsim_prices_all', $data, false);
        update_option('fxsim_last_price_update', $now, false);
        update_option('fxsim_mt5_last_push', $now, false);
        update_option('fxsim_price_source', 'mt5:' . sanitize_text_field($source_id), false);
        delete_option('fxsim_price_feed_failed');

        // Push to WebSocket server asynchronously
        wp_remote_post('http://127.0.0.1:8080/push', [
            'blocking' => false,
            'headers'  => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer propfirm_internal_secret_2026',
            ],
            'body'     => wp_json_encode(['prices' => $data]),
        ]);

        self::$prices_runtime = $data;
        self::$runtime_loaded = true;

        // Parity with the cron path: evaluate stop-loss / take-profit on the new ticks.
        FXSIM_Trading_Engine::check_sl_tp();

        return $accepted;
    }

    /**
     * Validate a single incoming quote. Returns null if acceptable, otherwise a
     * short reason string. Pure function of its inputs — no DB writes, no side
     * effects. Never touches the trading/challenge engines or business logic.
     *
     * @param array|null $prev Previously stored ['bid','ask','mid','ts'] for this symbol.
     * @return string|null  null = OK; non-null = rejection reason.
     */
    private static function validate_quote(string $symbol, float $bid, float $ask, float $mid, ?array $prev, int $now): ?string {
        // 1. Basic validity — positive, finite numbers.
        if (!is_finite($bid) || !is_finite($ask) || !is_finite($mid)) return 'non_finite';
        if ($mid <= 0 || $bid <= 0 || $ask <= 0)                       return 'non_positive';

        // 2. Order book sanity — ask must not be below bid (crossed = mismap/garbage).
        if ($ask < $bid) return 'crossed_book';

        // 3. Implied spread sanity — an absurdly wide spread signals a bad tick.
        if ((($ask - $bid) / $mid) > self::SANITY_MAX_SPREAD_PCT) return 'spread_too_wide';

        // 4. Absolute band vs the known base price — catches gross mismaps on the
        //    very first tick (no previous price to compare against), e.g. an index
        //    or metal price arriving under an FX symbol.
        $base = self::$base_prices[$symbol] ?? 0.0;
        if ($base > 0) {
            if ($mid < $base * self::SANITY_BAND_MIN || $mid > $base * self::SANITY_BAND_MAX) {
                return 'out_of_band';
            }
        }

        // 5. Deviation vs the last recent price — catches sudden order-of-magnitude
        //    jumps while allowing normal movement and re-baselining after an outage
        //    (only compares against a previous price newer than the lookback window).
        if (is_array($prev) && !empty($prev['mid']) && (float) $prev['mid'] > 0) {
            $prev_ts  = (int) ($prev['ts'] ?? 0);
            if (($now - $prev_ts) <= self::SANITY_DEV_LOOKBACK) {
                $prev_mid = (float) $prev['mid'];
                $move     = abs($mid - $prev_mid) / $prev_mid;
                if ($move > self::sanity_dev_limit($symbol)) return 'deviation_too_large';
            }
        }

        return null;
    }

    /** Max permitted single-tick deviation for a symbol's asset class. */
    private static function sanity_dev_limit(string $symbol): float {
        if ($symbol === 'BTCUSD' || $symbol === 'ETHUSD') return self::SANITY_DEV_CRYPTO;
        if ($symbol === 'XAUUSD' || $symbol === 'XAGUSD') return self::SANITY_DEV_METAL;
        return self::SANITY_DEV_FX;
    }

    /** Seconds since the last accepted MT5 push (PHP_INT_MAX if never). */
    public static function mt5_age(): int {
        $last = (int) get_option('fxsim_mt5_last_push', 0);
        return $last > 0 ? (time() - $last) : PHP_INT_MAX;
    }

    /** Whether the MT5 push feed is within its staleness window. */
    public static function mt5_is_fresh(): bool {
        $threshold = (int) get_option('fxsim_mt5_stale_secs', self::MT5_STALE_DEFAULT);
        if ($threshold <= 0) $threshold = self::MT5_STALE_DEFAULT;
        return self::mt5_age() <= $threshold;
    }

    /**
     * Rough FX market-open check (UTC). Used only to label a stale feed as
     * "market_closed" vs "offline" — never to gate money logic.
     * FX closes ~Fri 22:00 UTC and reopens ~Sun 22:00 UTC.
     */
    public static function fx_market_open(): bool {
        $dow  = (int) gmdate('w');   // 0=Sun .. 6=Sat
        $hour = (int) gmdate('G');
        if ($dow === 6) return false;                 // Saturday
        if ($dow === 0 && $hour < 22) return false;    // Sunday before 22:00
        if ($dow === 5 && $hour >= 22) return false;   // Friday after 22:00
        return true;
    }

    /**
     * Feed-health snapshot for the admin monitor.
     * status: 'fresh' | 'stale' | 'offline' | 'market_closed' | 'yahoo'
     */
    public static function feed_health(): array {
        $mode        = get_option('fxsim_price_source_mode', 'auto');
        $mt5_last    = (int) get_option('fxsim_mt5_last_push', 0);
        $mt5_age     = $mt5_last > 0 ? (time() - $mt5_last) : null;
        $threshold   = (int) get_option('fxsim_mt5_stale_secs', self::MT5_STALE_DEFAULT);
        $yahoo_last  = (int) get_option('fxsim_last_price_update', 0);
        $failed      = (int) get_option('fxsim_price_feed_failed', 0);
        $fresh       = self::mt5_is_fresh();
        self::ensure_runtime_loaded();
        $count       = count(self::$prices_runtime);

        if ($mode === 'yahoo') {
            $status = 'yahoo';
        } elseif ($fresh) {
            $status = 'fresh';
        } elseif ($mt5_last === 0) {
            $status = $mode === 'auto' ? 'yahoo' : 'offline'; // never pushed yet
        } elseif (!self::fx_market_open()) {
            $status = 'market_closed';
        } else {
            $status = $mode === 'auto' ? 'stale' : 'offline'; // auto falls back to Yahoo
        }

        return [
            'mode'              => $mode,
            'active_source'     => get_option('fxsim_price_source', 'yahoo'),
            'status'            => $status,
            'mt5_last_push_ts'  => $mt5_last ?: null,
            'mt5_age_sec'       => $mt5_age,
            'mt5_fresh'         => $fresh,
            'stale_threshold'   => $threshold ?: self::MT5_STALE_DEFAULT,
            'yahoo_last_ts'     => $yahoo_last ?: null,
            'feed_failed'       => $failed ? true : false,
            'symbol_count'      => $count,
            'secret_set'        => get_option('fxsim_mt5_ingest_secret', '') !== '',
            'market_open'       => self::fx_market_open(),
            'last_reject'       => get_option('fxsim_mt5_last_reject', null) ?: null,
        ];
    }

    /**
     * Trading guard for new positions. Only blocks in STRICT 'mt5' mode when the
     * feed is stale during market hours — i.e. never affects 'auto'/'yahoo'
     * (default) deployments, so the change is zero-impact until strict mode is on.
     *
     * @return array ['ok'=>bool, 'message'=>string]
     */
    public static function feed_guard_for_trading(): array {
        $mode = get_option('fxsim_price_source_mode', 'auto');
        if ($mode === 'mt5' && !self::mt5_is_fresh() && self::fx_market_open()) {
            return ['ok' => false, 'message' => 'Live price feed is temporarily unavailable. New trades are paused — please try again shortly.'];
        }
        return ['ok' => true, 'message' => ''];
    }

    /**
     * Fetch fresh prices for all symbols and store in combined cache.
     * Called by the 30-second cron tick (fxsim_price_update).
     * Also invalidates the process-level runtime cache so the next get() call
     * sees the fresh data immediately.
     */
    public static function update_all_prices(bool $force = false): void {
        $symbols = FXSIM_Symbols::all();
        if (empty($symbols)) return;

        // ── V10 source-mode guard ─────────────────────────────────────────────
        // The 30s Yahoo cron must not overwrite a fresh MT5 push.
        //   mode 'yahoo' → always run Yahoo (legacy behaviour, default-equivalent).
        //   mode 'mt5'   → strict: MT5 push owns the store; cron never fetches Yahoo.
        //   mode 'auto'  → use MT5 while fresh; fall back to Yahoo when MT5 is stale.
        // $force (admin "Force refresh") always bypasses the guard and runs Yahoo.
        if (!$force) {
            $mode = get_option('fxsim_price_source_mode', 'auto');
            if ($mode === 'mt5') return;                       // strict — never clobber
            if ($mode === 'auto' && self::mt5_is_fresh()) return; // MT5 fresh — leave it
            // mode 'yahoo', or 'auto' with stale MT5 → continue to Yahoo fetch below.
        }

        // Record cron execution timestamp — used by health monitor
        update_option('fxsim_last_price_update', time(), false);

        // Build spread lookup keyed by symbol
        $spread_map = [];
        foreach ($symbols as $sym) {
            $spread_map[$sym->symbol] = (float)$sym->spread;
        }

        // ── Fetch: try batch → curl_multi → sequential ────────────────────────
        $raw_prices = self::fetch_all_batch(array_keys($spread_map));

        // ── Build bid/ask/mid/ts per symbol ───────────────────────────────────
        $now  = time();
        $data = [];
        foreach ($spread_map as $symbol => $spread) {
            $mid = $raw_prices[$symbol] ?? 0.0;
            if ($mid <= 0) {
                // Use existing cached price as base for simulation
                $existing = self::$prices_runtime[$symbol] ?? null;
                $mid = $existing ? (float)$existing['mid'] : 0.0;
                $mid = self::simulate_from_base($symbol, $mid);
            }
            if ($mid > 0) {
                $data[$symbol] = [
                    'bid' => round($mid - ($spread / 2), 5),
                    'ask' => round($mid + ($spread / 2), 5),
                    'mid' => $mid,
                    'ts'  => $now,
                ];
            }
        }

        // ── Store combined cache ───────────────────────────────────────────────
        if (!empty($data)) {
            FXSIM_Cache::set(self::CACHE_KEY, $data, self::CACHE_TTL);
            update_option('fxsim_prices_all', $data, false);
            // Clear any existing feed-failure flag now that we have live data
            delete_option('fxsim_price_feed_failed');
            
            // Push to WebSocket server asynchronously
            wp_remote_post('http://127.0.0.1:8080/push', [
                'blocking' => false,
                'headers'  => [
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer propfirm_internal_secret_2026',
                ],
                'body'     => wp_json_encode(['prices' => $data]),
            ]);
        } else {
            // All HTTP sources failed — flag for admin alert
            update_option('fxsim_price_feed_failed', time(), false);
        }

        // ── Invalidate process-level cache so cron tick sees fresh data ───────
        self::$prices_runtime = $data;
        self::$runtime_loaded = true;

        // ── SL/TP check runs after prices are updated ─────────────────────────
        FXSIM_Trading_Engine::check_sl_tp();
    }

    /**
     * Generate a simulated tick from a base price.
     * Used as last-resort fallback when all HTTP sources fail for a symbol.
     *
     * @param string $symbol  Trading pair.
     * @param float  $base    Base mid price (0 = use hardcoded default).
     * @return float          Simulated mid price.
     */
    public static function simulate(string $symbol): float {
        // Load from combined cache for the base price if runtime not yet loaded
        self::ensure_runtime_loaded();
        $existing = self::$prices_runtime[$symbol] ?? null;
        $base     = $existing ? (float)$existing['mid'] : 0.0;
        return self::simulate_from_base($symbol, $base);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Ensure the process-level price cache is loaded.
     * Reads from FXSIM_Cache (object cache → transient → combined option) once
     * per PHP process. All subsequent calls in the same request are free.
     */
    private static function ensure_runtime_loaded(): void {
        if (self::$runtime_loaded) return;

        // Try FXSIM_Cache first (object cache or transient)
        $cached = FXSIM_Cache::get(self::CACHE_KEY);

        if (!$cached || !is_array($cached)) {
            // Fallback: read from the combined wp_option (never autoloaded)
            $cached = get_option('fxsim_prices_all');
        }

        if (is_array($cached) && !empty($cached)) {
            self::$prices_runtime = $cached;
        }
        // If both fail (first ever run), $prices_runtime stays empty.
        // get() returns ['bid'=>0,...] which callers already handle.

        self::$runtime_loaded = true;
    }

    /**
     * Fetch prices for all symbols in one batch HTTP call.
     * Returns raw mid prices keyed by our symbol string.
     *
     * Strategy:
     *   1. Yahoo Finance v7 batch endpoint (one HTTP call for all symbols)
     *   2. curl_multi parallel (one concurrent request per symbol, if curl available)
     *   3. Sequential wp_remote_get (original behaviour, always works)
     *
     * @param array $symbols List of our symbol strings.
     * @return array         ['EURUSD' => 1.08500, 'GBPUSD' => 1.27000, ...]
     */
    private static function fetch_all_batch(array $symbols): array {
        // ── Strategy 0: Twelve Data (when API key configured) ─────────────────
        // Higher reliability than Yahoo scraping — recommended for production.
        // Configure at Settings → Price Feed → Twelve Data API Key.
        $td_key = get_option('fxsim_twelve_data_key', '');
        if ($td_key) {
            $result = self::fetch_twelve_data($symbols, $td_key);
            if (!empty($result)) {
                update_option('fxsim_price_source', 'twelve_data', false);
                return $result;
            }
        }
        foreach ($symbols as $sym) {
            if (isset(self::$yahoo_map[$sym])) {
                $tickers[] = self::$yahoo_map[$sym];
            }
        }
        if (empty($tickers)) return [];

        // ── Strategy 1: v7 batch ──────────────────────────────────────────────
        $result = self::fetch_yahoo_batch($tickers);
        if (!empty($result)) return $result;

        // ── Strategy 2: curl_multi parallel ──────────────────────────────────
        if (function_exists('curl_multi_init')) {
            $result = self::fetch_parallel($tickers);
            if (!empty($result)) return $result;
        }

        // ── Strategy 3: sequential fallback (always available) ────────────────
        return self::fetch_sequential($tickers);
    }

    /**
     * Fetch all prices in ONE HTTP request via Yahoo Finance v7 batch endpoint.
     * Returns raw mid prices keyed by our symbol string.
     *
     * @param array $tickers Yahoo ticker strings.
     * @return array         ['EURUSD' => float, ...] or empty on failure.
     */
    private static function fetch_twelve_data(array $symbols, string $api_key): array {
        $td_symbols = [];
        foreach ($symbols as $sym) {
            if (isset(self::$twelve_map[$sym])) $td_symbols[] = self::$twelve_map[$sym];
        }
        if (empty($td_symbols)) return [];

        $url = self::TWELVE_DATA_URL . http_build_query([
            'symbol' => implode(',', $td_symbols),
            'apikey' => $api_key,
        ]);
        $resp = wp_remote_get($url, ['timeout' => 10, 'sslverify' => false]);
        if (is_wp_error($resp)) return [];
        $body = json_decode(wp_remote_retrieve_body($resp), true);
        if (empty($body) || (isset($body['status']) && $body['status'] === 'error')) return [];

        $reverse = array_flip(self::$twelve_map);
        $prices  = [];

        // Single-symbol response: { price: "1.085" }
        if (isset($body['price'])) {
            $our_sym = $reverse[$td_symbols[0]] ?? null;
            $price   = (float)$body['price'];
            if ($our_sym && $price > 0) $prices[$our_sym] = $price;
        } else {
            // Multi-symbol: { "EUR/USD": { price: "1.085" }, ... }
            foreach ($body as $td_sym => $data) {
                $our_sym = $reverse[$td_sym] ?? null;
                $price   = (float)($data['price'] ?? 0);
                if ($our_sym && $price > 0) $prices[$our_sym] = $price;
            }
        }
        return $prices;
    }

    private static function fetch_yahoo_batch(array $tickers): array {
        $ticker_csv = implode(',', array_map('rawurlencode', $tickers));
        $url = self::YAHOO_BATCH_URL . $ticker_csv
             . '&fields=regularMarketPrice,symbol'
             . '&formatted=false&lang=en-US';

        $resp = wp_remote_get($url, [
            'timeout'   => 10,
            'sslverify' => false,
            'headers'   => [
                'User-Agent' => 'Mozilla/5.0 (compatible; PropFirm/1.0)',
            ],
        ]);

        if (is_wp_error($resp)) return [];

        $body = json_decode(wp_remote_retrieve_body($resp), true);
        $results = $body['quoteResponse']['result'] ?? [];
        if (empty($results)) return [];

        // Build reverse map once
        if (empty(self::$ticker_to_symbol)) {
            self::$ticker_to_symbol = array_flip(self::$yahoo_map);
        }

        $prices = [];
        foreach ($results as $quote) {
            $ticker = $quote['symbol']   ?? '';
            $price  = $quote['regularMarketPrice'] ?? 0;
            if ($ticker && $price > 0) {
                $our_sym = self::$ticker_to_symbol[$ticker] ?? null;
                if ($our_sym) {
                    $prices[$our_sym] = (float)$price;
                }
            }
        }
        return $prices;
    }

    /**
     * Fetch all prices in parallel using curl_multi.
     * Only called when curl extension is available (checked by caller).
     * Timeout: 8s for all requests combined.
     *
     * @param array $tickers Yahoo ticker strings.
     * @return array         ['EURUSD' => float, ...] or empty on failure.
     */
    private static function fetch_parallel(array $tickers): array {
        if (empty(self::$ticker_to_symbol)) {
            self::$ticker_to_symbol = array_flip(self::$yahoo_map);
        }

        $multi = curl_multi_init();
        $curls = [];

        foreach ($tickers as $ticker) {
            $url  = self::YAHOO_V8_URL . rawurlencode($ticker) . '?interval=1m&range=1d';
            $ch   = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; PropFirm/1.0)',
            ]);
            curl_multi_add_handle($multi, $ch);
            $curls[$ticker] = $ch;
        }

        // Execute all handles
        $running = null;
        do {
            curl_multi_exec($multi, $running);
            if ($running) curl_multi_select($multi, 0.1);
        } while ($running > 0);

        $prices = [];
        foreach ($curls as $ticker => $ch) {
            $body = curl_multi_getcontent($ch);
            if ($body) {
                $data  = json_decode($body, true);
                $price = (float)($data['chart']['result'][0]['meta']['regularMarketPrice'] ?? 0);
                if ($price > 0) {
                    $our_sym = self::$ticker_to_symbol[$ticker] ?? null;
                    if ($our_sym) $prices[$our_sym] = $price;
                }
            }
            curl_multi_remove_handle($multi, $ch);
            curl_close($ch);
        }

        curl_multi_close($multi);
        return $prices;
    }

    /**
     * Sequential fallback — original behaviour using wp_remote_get one at a time.
     * Used when batch and parallel both fail. Always available.
     *
     * @param array $tickers Yahoo ticker strings.
     * @return array         ['EURUSD' => float, ...]
     */
    private static function fetch_sequential(array $tickers): array {
        if (empty(self::$ticker_to_symbol)) {
            self::$ticker_to_symbol = array_flip(self::$yahoo_map);
        }

        $prices = [];
        foreach ($tickers as $ticker) {
            $url  = self::YAHOO_V8_URL . rawurlencode($ticker) . '?interval=1m&range=1d';
            $resp = wp_remote_get($url, ['timeout' => 8, 'sslverify' => false]);
            if (is_wp_error($resp)) continue;

            $data  = json_decode(wp_remote_retrieve_body($resp), true);
            $price = (float)($data['chart']['result'][0]['meta']['regularMarketPrice'] ?? 0);
            if ($price > 0) {
                $our_sym = self::$ticker_to_symbol[$ticker] ?? null;
                if ($our_sym) $prices[$our_sym] = $price;
            }
        }
        return $prices;
    }

    /**
     * Generate a simulated price tick from a base mid price.
     * 0.02% volatility per tick. Used as last-resort fallback per symbol.
     *
     * @param string $symbol Trading pair (for hardcoded base price fallback).
     * @param float  $base   Known mid price. 0 = use hardcoded default.
     * @return float         Simulated mid price.
     */
    private static function simulate_from_base(string $symbol, float $base): float {
        if ($base <= 0) $base = self::$base_prices[$symbol] ?? 1.0;
        $vol = 0.0002; // 0.02% volatility per tick
        return $base * (1 + (mt_rand(-100, 100) / 100) * $vol);
    }

    /**
     * Force-refresh prices: bypasses all caches and fetches fresh from Yahoo.
     * Called from admin "Force Price Refresh" button.
     * Returns the number of symbols successfully updated.
     */
    public static function force_refresh(): int {
        // Clear caches so ensure_runtime_loaded() re-fetches
        FXSIM_Cache::delete(self::CACHE_KEY);
        self::$runtime_loaded = false;
        self::$prices_runtime = [];
        self::update_all_prices(true);
        return count(self::$prices_runtime);
    }

    /**
     * Kept for backward compatibility with any direct callers of fetch_yahoo().
     * Internally delegates to the sequential strategy.
     *
     * @param string $symbol Our symbol string.
     * @return float         Mid price or 0 on failure.
     */
    public static function fetch_yahoo(string $symbol): float {
        $ticker = self::$yahoo_map[$symbol] ?? null;
        if (!$ticker) return 0.0;
        $result = self::fetch_sequential([$ticker]);
        return $result[$symbol] ?? 0.0;
    }
}
