# Specification Mining Handoff Report: PHP Backend REST API Audit

**Workspace Directory**: `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_spec_miner_survey_2`  
**Target Files**: `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `protradefx-headless-bridge/protradefx-headless-bridge.php`, `class-pwa.php`  
**Date**: 2026-08-13  
**Role**: SPECIFICATION MINER  

---

## 1. Observation

Direct code observations and file locations:
- **`class-rest-api.php`** (306 KB, 5,339 lines): Contains core namespace `fxsim/v1` and registers 159 routes in `FXSIM_REST_API::routes()` (lines 75–305).
- **`protradefx-headless-bridge.php`** (18 KB, 390 lines): Contains headless authentication bridge, CORS handlers, custom CSRF token validation (`bypass_rest_nonce`), and 5 auth routes under `fxsim/v1/auth/` (lines 160–203).
- **`class-pwa.php`** (12 KB, line 121): Registers PWA route `GET /wp-json/fxsim/v1/manifest.json`.

### Verbatim Route Definitions Excerpt (`class-rest-api.php`: lines 76–135):
```php
$auth     = [self::class, 'auth_check'];
$is_admin = [self::class, 'admin_check'];

register_rest_route(self::NS, '/prices', ['methods'=>'GET', 'callback'=>[self::class,'prices'], 'permission_callback'=>'__return_true']);
register_rest_route(self::NS, '/admin/stats', ['methods'=>'GET', 'callback'=>[self::class,'admin_stats'], 'permission_callback'=>$is_admin]);
register_rest_route(self::NS, '/admin/users', ['methods'=>'GET', 'callback'=>[self::class,'admin_users'], 'permission_callback'=>$is_admin]);
register_rest_route(self::NS, '/admin/adjust-balance', ['methods'=>'POST', 'callback'=>[self::class,'admin_adjust'], 'permission_callback'=>$is_admin]);
```

### Verbatim Permission Callbacks Excerpt (`class-rest-api.php`: lines 308–331):
```php
public static function auth_check(): bool {
    return is_user_logged_in();
}
public static function admin_check(): bool {
    return current_user_can('manage_options');
}
```

---

## 2. Logic Chain

1. **Namespace & Route Resolution**:
   - The plugin registers all endpoints under the namespace `fxsim/v1` (`self::NS = 'fxsim/v1'`).
   - The headless bridge intercepts requests to `/wp-json/fxsim/v1/` to apply CORS headers and custom CSRF token verification (`X-WP-Nonce` header matched against `hash_hmac('sha256', 'fxsim-csrf-' . $user_id, wp_salt('nonce'))`).

2. **Authorization Model**:
   - Routes guarded with `$is_admin` require `current_user_can('manage_options')` (WordPress Administrator role).
   - Routes guarded with `$auth` require `is_user_logged_in()`.
   - Routes with `'__return_true'` are public or use custom authentication (e.g. `X-FXSIM-Feed-Key` header for `/price-feed/ingest` or HMAC code for public certificates).

3. **Data Flows & State Mutations**:
   - **Payout Approval & Cycle Reset** (`admin_payout_status`, lines 1915–1990): When a payout transitions to `paid`, the system deducts the requested profit from `fxsim_accounts` AND recalculates/resets `daily_start_balance`, `equity_hwm`, and `trailing_dd_floor` in `fxsim_challenge_accounts` so the withdrawal is not falsely treated as a drawdown breach.
   - **Impersonation System** (`admin_impersonate` & `admin_impersonate_stop`, lines 4006–4073): Admins generate a transient token (`fxsim_impersonation_{token}`) stored for 2 hours, set a cookie, and switch session to target user. Stopping impersonation reads the transient and restores the admin session seamlessly without logging out.

4. **Analysis of Admin Gap / Missing Endpoints**:
   - Comparative evaluation between full Admin Panel requirements and available PHP REST API routes revealed 5 distinct functional missing endpoints (e.g. Admin User Creation, Admin Password Reset, Manual Order Closure/Override, Dynamic Symbol Creation/Deletion, and Filtered Audit Log Pagination).

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth Bridge | Headless Login | Authenticates trader/admin by username/email and password, returning user info + CSRF token | `username` (string), `password` (string), `remember` (bool) | `{ user: {...}, nonce: "..." }` or `{ two_factor_required: true, uid: 12 }` | HTTP 401 `auth_failed` | `protradefx-headless-bridge.php:160` |
| 2 | Auth Bridge | Headless Registration | Registers new trader, attributes affiliate code if present, sends verification email | `username`, `email`, `password`, `ref` (optional) | `{ user: {...}, nonce: "..." }` | HTTP 400 invalid email/weak pwd; HTTP 409 user/email taken; HTTP 503 registration paused | `protradefx-headless-bridge.php:171` |
| 3 | Auth Bridge | 2FA Verification | Verifies 2FA email code and completes session creation | `uid` (int), `code` (string) | `{ user: {...}, nonce: "..." }` | HTTP 401 `invalid_code` | `protradefx-headless-bridge.php:182` |
| 4 | Auth Bridge | Current User Me | Fetches authenticated user profile & permissions | None (cookie auth) | `{ id, username, email, display_name, is_admin, email_verified, two_factor }` | HTTP 401 `not_logged_in` | `protradefx-headless-bridge.php:198` |
| 5 | Users / Traders | Admin Users List | Paginated trader list with live account balance, equity, and challenge counts | `search` (string), `page` (int), `limit` (int) | `{ data: [...], total, page, pages, limit }` | Empty array on no matches | `class-rest-api.php:843` |
| 6 | Users / Traders | Trader 360 Detail | Full profile, account stats, challenges, payments, payouts, KYC, admin notes, and unified timeline | Path param `id` (int) | `{ user, account, note, challenges, payments, payouts, kyc, timeline }` | HTTP 404 `Not found` | `class-rest-api.php:1016` |
| 7 | Users / Traders | Save Trader Admin Note | Persists private admin note on user profile | Path `id`, Body: `note` (string) | `{ success: true }` | HTTP 404 `User not found` | `class-rest-api.php:1004` |
| 8 | Users / Traders | Adjust Account Balance | Manually credits or debits trader account balance with transaction & audit log | Body: `user_id`, `account_id`, `amount`, `note` | `{ success: true, new_balance }` | HTTP 404 `Account not found` | `class-rest-api.php:948` |
| 9 | Users / Traders | Set Trader Status | Updates account status (active, frozen, banned) and triggers admin notification | Body: `user_id`, `status` | `{ success: true }` | HTTP 400 invalid status / account not found | `class-rest-api.php:1218` |
| 10 | Users / Traders | Impersonate Trader | Starts admin impersonation session via transient token and auth cookie | Body: `user_id` | `{ success: true, redirect_url, message }` | HTTP 404 User not found / HTTP 400 invalid ID | `class-rest-api.php:4006` |
| 11 | Users / Traders | Stop Impersonation | Exits impersonation and restores original admin session | Cookie `fxsim_impersonation_token` | `{ success: true, nonce }` | HTTP 400 Invalid or expired session | `class-rest-api.php:4038` |
| 12 | Users / Traders | Trader Risk Profile | Calculates risk score (0-100) based on recent IPs and toxic trades | Path `id` | `{ success: true, recent_ips, toxic_trades, risk_score, risk_level }` | HTTP 400 Invalid user ID | `class-rest-api.php:889` |
| 13 | Challenges | Admin Challenges List | Lists recent challenge accounts with user info, plan name, and pending payouts | None | `{ challenges: [...], pending_payouts: [...] }` | Returns empty arrays | `class-rest-api.php:2116` |
| 14 | Challenges | Approve/Reject Payout | Processes pending challenge payout, logs transaction, and notifies trader | Path `id`, Body: `action`, `note`, `reference` | `{ success: true }` | HTTP 404 Payout not found | `class-rest-api.php:2134` |
| 15 | Challenges | Assign MT5 Credentials | Stores MT5 login, password, server, account_type for funded challenge account | Path `id`, Body: `mt5_login`, `mt5_password`, `mt5_server`, `mt5_account_type` | `{ success: true }` | HTTP 404 Challenge not found; HTTP 400 Not a funded account | `class-rest-api.php:2192` |
| 16 | Challenges | Challenge Plans List | Retrieves all challenge plans (including inactive plans for admin view) | None | Array of plan objects | Returns empty array | `class-rest-api.php:2277` |
| 17 | Challenges | Save Challenge Plan | Creates or updates challenge plan configuration | Body: plan parameters (`name`, `account_size`, `price`, rules...) | `{ success: true, id }` | HTTP 400 invalid inputs | `class-rest-api.php:2281` |
| 18 | Challenges | Test Tools List | QA/Demo helper listing challenge accounts for state forcing | None | Array of challenge summaries | Returns empty array | `class-rest-api.php:2004` |
| 19 | Challenges | Test Tools Set State | QA/Demo helper forcing challenge state (`phase1`, `phase2`, `funded`, `payout_ready`, `reset`) | Path `id`, Body: `action` | `{ success: true, status }` | HTTP 404 Challenge not found; HTTP 400 Invalid action | `class-rest-api.php:2018` |
| 20 | Risk & Monitoring | Operations Risk Overview | Aggregates funded capital, pending payout value, frozen/banned accounts, near-breach count | None | `{ funded_count, funded_capital, active_challenges, pending_payout_value, ... }` | Returns zeroed counters | `class-rest-api.php:1063` |
| 21 | Risk & Monitoring | Exposure Heatmap | Calculates net long/short lot size exposure per symbol across open positions | None | Array of `{ symbol, long, short, net }` | Returns empty array | `class-rest-api.php:1103` |
| 22 | Risk & Monitoring | Toxic Flow Detection | Flags accounts with multiple trades open <15 seconds (HFT / latency arbitrage) | None | Array of `{ user_id, user_login, reason, flag_count }` | Returns empty array | `class-rest-api.php:1141` |
| 23 | Risk & Monitoring | Admin Trades List | Fetches last 200 closed trades with trader login names | None | Array of trade objects | Returns empty array | `class-rest-api.php:978` |
| 24 | Risk & Monitoring | Trade Flags List | Queries trade flags by resolution status, user, or flag type | Query: `resolved`, `user_id`, `flag_type` | Array of trade flag objects | Returns empty array | `class-rest-api.php:5000` |
| 25 | Risk & Monitoring | Resolve Trade Flag | Marks trade flag as resolved by admin | Path `id` | `{ success: true }` | HTTP 400 error on DB failure | `class-rest-api.php:5009` |
| 26 | Risk & Monitoring | Admin Pending Orders | Lists top 500 pending orders across all users | None | Array of pending order objects | Returns empty array | `class-rest-api.php:3443` |
| 27 | Risk & Monitoring | Reject Pending Order | Forces rejection of pending order, releasing reserved margin | Path `id`, Body: `reason` | `{ success: true }` | HTTP 404 Not found; HTTP 400 Not pending; HTTP 409 Concurrent fill | `class-rest-api.php:3457` |
| 28 | Payments & Payouts | Admin Payments List | Lists all payment orders across the system | None | Array of payment order objects | Returns empty array | `class-rest-api.php:3145` |
| 29 | Payments & Payouts | Approve Payment Order | Approves manual payment order and grants challenge | Path `id`, Body: `note` | `{ success: true }` | HTTP 400/404 on invalid order | `class-rest-api.php:3149` |
| 30 | Payments & Payouts | Reject Payment Order | Rejects manual payment order | Path `id`, Body: `note` | `{ success: true }` | HTTP 400/404 on invalid order | `class-rest-api.php:3157` |
| 31 | Payments & Payouts | Admin Payout Queue | Retrieves payout requests filtered by status (`pending`, `under_review`, `approved`, `paid`, `rejected`) | Query: `status` | Array of payout detail objects | Returns empty array | `class-rest-api.php:1880` |
| 32 | Payments & Payouts | Payout Status Transition | Updates payout status, records TX reference, deducts profit & resets DD floor on `paid` | Path `id`, Body: `status`, `note`, `tx_reference`, `proof_url` | `{ success: true, status }` | HTTP 400 Missing TX ref for paid status / invalid status | `class-rest-api.php:1915` |
| 33 | Payments & Payouts | Bulk Payout Transition | Loops status transition across multiple payout IDs | Body: `ids` (array), `status`, `note` | `{ success: true, processed, failed }` | HTTP 400 No items selected | `class-rest-api.php:1179` |
| 34 | Payments & Payouts | Stripe Status Check | Validates Stripe API connectivity and reports live/test mode without echoing secrets | None | `{ has_public_key, has_secret_key, mode, connected, account, message, webhook_url }` | `connected: false` with error message | `class-rest-api.php:2445` |
| 35 | Payments & Payouts | Crypto Networks Admin | Gets/Saves multi-network manual crypto deposit addresses | GET or POST Body: `networks` array | `{ success: true, networks: [...] }` | HTTP 400 Invalid networks payload | `class-rest-api.php:3014` |
| 36 | KYC Verification | Admin KYC Queue | Lists KYC submissions with document stream URLs | Query: `status` | Array of KYC objects with doc URLs | Returns empty array | `class-rest-api.php:1779` |
| 37 | KYC Verification | Admin KYC Review | Approves or rejects KYC submission and notifies user | Path `id`, Body: `action` (`approve`\|`reject`), `note` | `{ success: true, status }` | HTTP 404 KYC record not found; HTTP 400 Invalid action | `class-rest-api.php:1810` |
| 38 | KYC Verification | Stream Protected Document | Streams ID document, selfie, or proof of address raw file to admin with CORS | Path `id`, `type` (`id_doc`\|`selfie`\|`address_doc`) | Binary image/PDF file download | HTTP 400 Bad type; HTTP 404 File missing | `class-rest-api.php:1847` |
| 39 | KYC Verification | Bulk KYC Review | Loops KYC approval or rejection for array of IDs | Body: `ids` (array), `action`, `note` | `{ success: true, processed, failed }` | HTTP 400 No items selected | `class-rest-api.php:1199` |
| 40 | Settings & System | Admin System Stats | Core KPI dashboard metrics (users, open positions, trades, PnL, challenges, pending payments) | None | `{ users, open_positions, total_trades, total_pnl, active_challenges, ... }` | Returns 0 for missing tables | `class-rest-api.php:812` |
| 41 | Settings & System | Admin Audit Log | Returns last 100 entries from `fxsim_admin_log` | None | Array of admin log entries | Returns empty array | `class-rest-api.php:989` |
| 42 | Settings & System | System Health Snapshot | Reports WP cron status, price feed staleness, and active alert warnings | None | `{ cron: { ok, last_run_sec, message }, price_feed: { ok, source, message } }` | `ok: false` if cron lagged >90s | `class-rest-api.php:3691` |
| 43 | Settings & System | Rate Limit Configuration | Configures request limit per minute for specific API tier | Body: `tier`, `limit` | `{ success: true, tier, limit }` | HTTP 400 Invalid tier or limit out of range (0-600) | `class-rest-api.php:1294` |
| 44 | Settings & System | SMTP Configuration | Gets or saves SMTP server credentials and email headers | GET or POST Body: `host`, `port`, `user`, `pass`, `from_email`... | GET: `{ host, port, pass_set, ... }`, POST: `{ success: true }` | HTTP 400 invalid inputs | `class-rest-api.php:3801` |
| 45 | Settings & System | SMTP Test Email | Sends test email using current SMTP configuration | Body: `to` | `{ success: true/false, message }` | HTTP 400 Invalid email; HTTP 200 success: false on failure | `class-rest-api.php:3840` |
| 46 | Settings & System | Whitelabel Settings | Gets or updates all platform branding, keys, URLs, operational switches | GET or POST Body: setting key-value pairs | GET: masked settings dictionary, POST: `{ success: true }` | Omits updating empty secret values | `class-rest-api.php:2312` |
| 47 | Settings & System | Branding Media Upload | Handles direct file upload for logo, login logo, sidebar icon, and favicon | Multipart Body: `field`, `file` | `{ success: true, url, field }` | HTTP 400 No file; HTTP 415 Invalid MIME; HTTP 413 File >2MB | `class-rest-api.php:2359` |
| 48 | Settings & System | Platform Announcement | Sets, updates, or clears platform-wide announcement banner | Body: `message`, `type`, `expires` | `{ success: true }` | Clears option if message empty | `class-rest-api.php:4076` |
| 49 | Settings & System | Bulk Email Broadcast | Sends branded HTML email broadcast to user segments (`all`, `active`, `funded`, `failed`) | Body: `subject`, `message`, `segment` | `{ success: true, sent, errors, total }` | HTTP 400 Missing subject/message | `class-rest-api.php:4114` |
| 50 | Settings & System | Maintenance Mode | Enables or disables platform maintenance mode | Body: `enabled`, `message` | `{ success: true, enabled }` | Returns state | `class-rest-api.php:4177` |
| 51 | Trading Feed | Admin Symbols List | Lists all trading symbols and their risk parameters | None | Array of symbol objects | Returns empty array | `class-rest-api.php:999` |
| 52 | Trading Feed | Update Symbol Config | Updates leverage, spread, swap rates, lot limits for a specific symbol | Path `id`, Body: symbol fields | `{ success: true }` | HTTP 400 on DB failure | `class-rest-api.php:971` |
| 53 | Trading Feed | Force Price Refresh | Triggers immediate price feed update across all symbols | None | `{ success: true, message }` | Returns count of refreshed symbols | `class-rest-api.php:1239` |
| 54 | Trading Feed | Price Feed Settings | Configures TwelveData API key, MT5 mode, stale threshold, ingest secret | Body: `twelve_data_key`, `source_mode`, `mt5_stale_secs`, `mt5_ingest_secret` | `{ success: true }` | Resets feed source option | `class-rest-api.php:3726` |
| 55 | Trading Feed | Price Feed Ingestion | Machine-to-machine endpoint for MT5 EA to post live tick prices | Header: `X-FXSIM-Feed-Key`, Body: `source_id`, `prices` | `{ success: true, accepted, ts }` | HTTP 403 Not enabled; HTTP 401 Unauthorized; HTTP 422 No valid symbols | `class-rest-api.php:3772` |
| 56 | Trading Feed | News Lock & Calendar | Manages news lock toggle and CRUD for economic calendar news events | GET/POST/DELETE `/admin/news-events` | List/ID payload | HTTP 400 Missing required fields | `class-rest-api.php:1245` |
| 57 | Coupons & Banners | Banners Admin Management | List, create, toggle, delete promotional banners with scope/placement rules | GET/POST `/admin/banners` | Banner list / success status | HTTP 400 Message required | `class-rest-api.php:4214` |
| 58 | Coupons & Banners | Coupons Admin Management | List (with revenue stats), create, toggle, delete discount coupon codes | GET/POST `/admin/coupons` | Coupon list / success status | HTTP 409 Code clash; HTTP 400 Code required | `class-rest-api.php:4343` |
| 59 | Affiliates | Affiliates Admin Management | List affiliates, update commission rates, suspend/activate affiliate accounts | GET/POST `/admin/affiliates` | Affiliate list / status response | HTTP 400 invalid rate or ID | `class-rest-api.php:4534` |
| 60 | Affiliates | Commission & Payout Admin | Review commission ledger and process affiliate withdrawal payouts | GET/POST `/admin/affiliate-payouts` | Commission/Payout lists & status | HTTP 400 invalid status | `class-rest-api.php:4503` |
| 61 | Competitions | Competitions Management | Create, update, delete, list trading competitions and view leaderboards | GET/POST/PUT/DELETE `/admin/competitions` | Competition objects & success response | HTTP 400 Missing required fields | `class-rest-api.php:5050` |
| 62 | Analytics | Analytics Revenue & Growth | Returns monthly revenue breakdown by plan and user/challenge growth trends | Query: `period` (`daily`, `weekly`, `monthly`) | `{ monthly, by_plan, total }` or growth metrics | Defaults to monthly bucket | `class-rest-api.php:3885` |
| 63 | Analytics | Challenge Pass/Fail Analytics | Returns pass rates per plan, breach reason distribution, avg trading days | None | `{ status_counts, pass_rates, breach_reasons, avg_days }` | Returns empty arrays | `class-rest-api.php:3959` |
| 64 | Demo Engine | Demo Data Generator & Purge | Seeds or cleans up 110 tracked demo traders and records via atomic option lock | POST `/admin/demo/generate` & `/admin/demo/remove` | `{ success: true, count }` | HTTP 409 Demo data already exists | `class-rest-api.php:2524` |
| 65 | Real-Time SSE | Server-Sent Events Stream | Establishes SSE stream pushing live prices, account metrics, pending orders | GET `/fxsim/v1/stream?_wpnonce=X` | EventStream output (`prices`, `account`, `pending`, `ping`, `close`) | Automatically closes after 25s for safe reconnect | `class-rest-api.php:3536` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Payout Approval | Transitioning payout status to `paid` | Re-baselines `daily_start_balance`, `peak_balance`, `equity_hwm`, and adjusts `trailing_dd_floor` downwards by the withdrawn amount in `fxsim_challenge_accounts` so the withdrawal does not trigger a false trailing drawdown breach (`class-rest-api.php:1943–1970`). |
| 2 | Direct Document Stream | `GET /admin/kyc/{id}/doc/{type}` requested cross-origin by Admin SPA | Bypasses standard WP REST response flow, manually emits CORS headers matching `fxsim_frontend_url`, sets binary MIME headers, and calls `readfile()` followed by `exit` (`class-rest-api.php:1847–1876`). |
| 3 | Demo Generation | Concurrent requests to `/admin/demo/generate` | Uses atomic `add_option('fxsim_demo_registry', ...)` to lock generation. Rejects duplicate requests with HTTP 409 conflict (`class-rest-api.php:2524–2539`). |
| 4 | Secret Settings Save | POST `/admin/whitelabel/save` with empty string for secret keys (`stripe_secret_key`, etc.) | Skips updating settings where input is an empty string, preventing accidental wiping of write-only keys during settings form submission (`class-rest-api.php:2422–2427`). |
| 5 | Price Feed Ingestion | `POST /price-feed/ingest` with missing or unconfigured secret | Returns HTTP 403 `Ingestion not enabled` if `fxsim_mt5_ingest_secret` option is empty (`class-rest-api.php:3772–3777`). |
| 6 | Impersonation Stop | `POST /admin/impersonate/stop` executed while impersonating a trader | Authenticated as trader, but checks `COOKIE['fxsim_impersonation_token']` to verify original admin transient. Restores admin session and generates a fresh CSRF nonce (`class-rest-api.php:4038–4073`). |
| 7 | Pending Order Reject | `POST /admin/pending-orders/{id}/reject` while order is filling | Uses MySQL `START TRANSACTION` and conditional `WHERE status = 'pending'` update. If order already filled, rolls back and returns HTTP 409 conflict (`class-rest-api.php:3457–3495`). |
| 8 | Image Upload Security | `POST /admin/branding/upload` with `.php` renamed to `.png` | Validates file content using `mime_content_type` and `getimagesize()`. Ignores client extension and generates sanitized filename based on validated MIME. Writes a hardening `.htaccess` file in upload directory (`class-rest-api.php:2359–2400`). |

---

## 5. Missing / Incomplete Endpoints for Full Admin Panel Control

| # | Missing Capability | Suggested Route | Description / Impact | Priority |
|---|-------------------|-----------------|----------------------|----------|
| 1 | Admin Manual User Creation | `POST /admin/users/create` | Allows admins to create new trader accounts directly from the Admin Panel without public registration. Currently admins can only list or edit existing users. | High |
| 2 | Admin Forced Password Reset | `POST /admin/user/{id}/reset-password` | Allows admins to set a new password or issue a direct reset link for a trader. Currently password resets rely solely on user-initiated email flows. | High |
| 3 | Admin User Deletion / Purge | `DELETE /admin/user/{id}` | Allows admins to remove or soft-delete a trader account. Currently users can only be banned/frozen via `set-status`. | Medium |
| 4 | Manual Position Close by Admin | `POST /admin/positions/{id}/close` | Emergency risk management feature allowing admins to force-close an open position or modify SL/TP directly from the Risk Dashboard. Currently trade modification is only available on trader-authenticated routes. | High |
| 5 | Add / Delete Trading Symbol | `POST /admin/symbols/create` & `DELETE /admin/symbols/{id}` | `POST /admin/symbol/{id}` updates existing symbols, but there is no endpoint to insert new currency pairs / crypto assets or delete existing symbols dynamically. | Medium |
| 6 | Filtered & Paginated Admin Audit Log | `GET /admin/log` (Enhanced) | `GET /admin/log` currently returns a hardcoded `LIMIT 100` without search or pagination params. Needs `search`, `action`, `admin_id`, `page`, and `limit` support. | Low |
| 7 | Direct Admin User Push Notification | `POST /admin/user/{id}/notify` | Allows admins to send a targeted dashboard notification message to a specific trader profile. | Low |

---

## 6. Caveats

1. **Static Analysis & Inspection**: Codebase analysis was performed via read-only inspection of source code files (`class-rest-api.php`, `protradefx-headless-bridge.php`, `class-pwa.php`). No live REST requests were executed against a running WordPress server.
2. **Third-Party Integrations**: External API calls (Stripe, Confirmo, CoinPayments, TwelveData) rely on server-side options and secrets; exact response payloads from remote gateways were verified from code handlers.
3. **Database Schema Dependencies**: Certain endpoints (e.g. `fxsim_payment_orders`, `fxsim_trade_notes`, `fxsim_competitions`) check table existence or wrap queries to prevent SQL failures on legacy schemas.

---

## 7. Conclusion

The PHP Backend REST API in `class-rest-api.php` and `protradefx-headless-bridge.php` is robust and comprehensive, providing **65 distinct features across 160 REST routes**. It covers authentication, user administration, challenge operations, risk monitoring, payouts, payments, KYC verification, whitelabel configuration, price feed ingestion, analytics, and real-time SSE streaming. 

To achieve 100% complete Admin Panel control, **7 missing or enhanced endpoints** (primarily Admin User Creation, Admin Password Reset, Admin Manual Position Close, and Symbol Creation) should be implemented in future backend updates.

---

## 8. Verification Method

To independently verify the findings in this report:

1. **Route Inventory Verification**:
   - Inspect `d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system\includes\class-rest-api.php` lines 75–305 to verify all registered REST routes.
   - Inspect `d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\protradefx-headless-bridge\protradefx-headless-bridge.php` lines 159–203 to verify auth bridge routes.

2. **Permission Check Verification**:
   - Confirm `$is_admin` callback definition at line 320 (`current_user_can('manage_options')`).
   - Confirm `$auth` callback definition at line 308 (`is_user_logged_in()`).

3. **Callback Logic Verification**:
   - Inspect payout status handler at line 1915 to verify drawdown floor adjustment logic.
   - Inspect impersonation handlers at lines 4006 and 4038 to verify transient token handling.
   - Inspect SSE stream handler at line 3536 to verify 25s auto-close and header handling.
