# Phase 7 (remainder) + Phase 8 — Implementation Prompt for Gemini / Antigravity

## Context

This continues the work documented in `MASTER_AUDIT_IMPLEMENTATION_REPORT.md` and `SESSION_LOG_2026-08-15.md` (both in this folder — **read `SESSION_LOG_2026-08-15.md` first**, it has the critical note about 4 files that were missing from this repo and have since been recovered, plus the ground-truth on MT5). Phases 1 through 6 of the report's Part C plan are complete and live-tested (185/185 assertions passing across the 3 test suites). This prompt covers what's left: the rest of Phase 7, and all of Phase 8.

**Working mode for this pass**: work autonomously through the items below — the person who was reviewing diffs turn-by-turn is offline for now. Maintain the exact same rigor that was used for Phases 1-6:
- Read the current live code before changing it (line numbers in this prompt and the report may have drifted — always re-verify against the actual file).
- Follow existing codebase conventions: `GET_LOCK`/atomic-claim (`UPDATE ... WHERE <precondition>` + check `rows_affected`) for concurrency, `$wpdb->prepare()` for every query, `FXSIM_Database::log_admin()` for admin mutations, try/catch(`\Throwable`) + `error_log()` around anything that touches money or core state.
- After every change: verify PHP brace balance (no linter is available in this environment — track `{`/`}` depth through the file, skipping strings/comments), sync to both the LocalWP live copy (`C:\Users\Administrator\Local Sites\propfirm\app\public\wp-content\plugins\propfirm-system\`) and this repo, then run all three test suites (`test_full_platform_suite.php`, `test_ultimate_deep_suite.php`, `test_trading_suite.php` in `includes/`) and confirm 185/185 still passes before moving to the next item.
- For anything you fix that changes behavior in a way a live HTTP request would exercise (not just a PHP-level function call — auth, CORS, REST permission checks), verify it with a real `curl` request against `http://propfirm.local`, the same way the CSRF and rate-limit fixes were verified in Phase 5. The existing PHPUnit-style suites call engine methods directly and do **not** exercise the REST/CORS layer.
- Write a session log (append to `SESSION_LOG_2026-08-15.md` or create `SESSION_LOG_<date>.md`) documenting exactly what you found, what you changed, and what you verified — in the same level of detail as the existing entries — so it can be reviewed later without re-deriving everything from a diff.
- If you hit a genuine product/business decision (not a bug fix) — anything marked "**needs a decision**" below — do not guess. Document the options and your recommendation, but leave the code as-is and flag it clearly at the top of your session log.

---

## Part 1 — Remaining Phase 7 items

### 1a. Payout amount integrity (CRITICAL — do this first)
`challenge_payout()` (`class-rest-api.php`) computes `$profit = (float)$account->balance - (float)$ch->starting_balance` — i.e. payout eligibility is derived from the mutable `balance` column, not a verified sum of closed-trade PnL. Any bug that ever inflates `balance` incorrectly (this session already found and fixed two such bugs — the commission double-charge and the margin-engine staleness) becomes directly withdrawable. Investigate: can you compute (or at least cross-check) the requested profit against `SUM(pnl) FROM fxsim_trades WHERE account_id = ...` and reject/flag a payout request where the two diverge beyond a small tolerance (swaps/commissions account for minor legitimate drift)? This is the single highest-value remaining item — treat it as a real audit control, not just a sanity check.

### 1b. `class-payments.php::approve_order()` — no rollback on activation failure
Already discussed in the report as A.2/deferred: the order is marked `'approved'` before `create_challenge()` is attempted, and the guard at the top (`if ($order->status === 'approved') return 'Already approved.'`) then permanently blocks retry if `create_challenge()` failed. Fix: either use a distinct `'activation_failed'` status on failure (so the guard doesn't block retry), or wrap the status write and `create_challenge()` in a transaction and only commit `'approved'` on success.

### 1c. Email reliability + XSS
- 2FA codes, password reset, and breach notices send synchronously inline (`class-emails.php`) — blocking the API response on SMTP latency, worst on exactly the paths where availability matters most (login, breach). The codebase already has the right deferred pattern (`wp_schedule_single_event`) used for welcome/verification/payment-proof emails — apply it to these three too.
- User-controlled `display_name` and DB-stored template placeholders aren't `esc_html()`'d before HTML interpolation in email templates — fix before any email template renders user-controlled text.
- No retry on `wp_mail()` failure — failures are logged (admin-only) but never retried or resurfaced. Add a retry (e.g. via the same deferred-cron mechanism, 1-2 retries with backoff) for at least the security-critical ones (2FA, password reset).

### 1d. Frontend: WebSocket URL hardcoded to loopback
`propfirm-frontend-v10.7.1/src/lib/fxsim.ts` — `fxsimStream()` hardcodes `ws://127.0.0.1:8080/`. This can never work in any real deployment (browser-side loopback = the visitor's own machine). Derive it from `getApiBaseUrl()` or a `NEXT_PUBLIC_FXSIM_WS_URL` env var instead.

### 1e. Frontend: connection/staleness indicator not wired
`store/prices.ts` already tracks connection/staleness state correctly (`usePrices().connected`) but no UI component reads it — a trader sees a frozen price feed with no visual difference from live during an outage. Wire a small indicator into the trading terminal (near the price ticker or account strip is the natural spot).

### 1f. ws-server ingestion secret hardcoded default
`ws-server/index.js` has a hardcoded default secret matching the WP-side default — both sides ship the same known value with no admin UI to change it, visible in source. Add an admin settings field for this and remove the shared hardcoded fallback (or generate a random one on first install if none is set).

### 1g. `class-push.php` — investigate first
This is the 4th file that was missing from this repo and has been recovered (see `SESSION_LOG_2026-08-15.md`) but not yet read/audited at all. Read it in full before doing anything else in this list that might interact with push notifications — it may change what's understood about how `FXSIM_Database::push_notification()` actually gets delivered to a device.

---

## Part 2 — Phase 8

### 2a. Duplicate admin panel — resolve the architecture question FIRST (needs a decision)
The frontend ships **two separate, independently-implemented admin panels**: `src/app/admin/*` (own `layout.tsx`, own `Sidebar.tsx`) and `src/app/dashboard/admin/*`. Both are reachable, both call overlapping backend endpoints through separately-written components, and a fix applied to one (confirmed this session: the account-status-enum bug, the payout-approve/disburse bug) does not automatically apply to the other.

**Do this before fixing individual bugs in either tree** — otherwise work gets duplicated or lands in the tree that gets deleted later. Investigate which tree is actually linked from primary navigation / actually used, and which is orphaned or legacy. If it's genuinely ambiguous, document both options with your recommendation in the session log and pick the more complete/actively-used tree as canonical, but flag this decision clearly rather than silently picking one — this affects where all subsequent frontend admin fixes should go.

### 2b. Trading terminal error boundaries
`src/app/dashboard/trading/page.tsx`'s `DesktopLayout`/`MobileLayout` have zero `<SectionErrorBoundary>` coverage, unlike the rest of the dashboard (`src/app/dashboard/page.tsx` wraps every widget). A boundary-wrapped implementation of this exact component tree already exists as **dead code**: `src/components/dashboard/trading/terminal-desktop-layout.tsx` / `terminal-mobile-layout.tsx`. Either wire those in (replacing the live inline layout) or port the `<SectionErrorBoundary>` wrapping into the live file — whichever is less disruptive given how much `page.tsx` may have diverged from the dead-code version since it was written. Delete the dead files once no longer needed, or leave a comment explaining why they still exist if you keep them as reference.

### 2c. `GET /news-events` missing callback
`class-rest-api.php` registers this route against `[self::class, 'public_news_events_get']` — grep confirms that method is never defined anywhere. The order ticket's news-restriction warning banner silently never fires (server-side enforcement in `check_news_window()` still works, so orders are still correctly blocked — this is a UX/warning gap, not a safety gap). Implement `public_news_events_get` (a public or auth-gated read of the same news events `admin_news_events_get` exposes, shaped as `{success, events}` matching what `order-ticket.tsx` expects).

### 2d. PvP Arena frontend — wire the participant check that already exists server-side
`arena/[id]/page.tsx` renders BUY/SELL order buttons with no check of whether the logged-in user is actually a match participant — any visitor who loads the URL sees live, clickable order controls. The backend (`execute_order()`) already rejects non-participants correctly (fixed this session, Phase 2) — the frontend still needs to fetch the current user and gate/hide the controls (read-only spectator view) unless `user.id === match.creator_user_id || user.id === match.challenger_user_id`. Same treatment for the "Call Match Conclusion" settle button.

### 2e. SQL correctness + info disclosure
- `admin_users` in `class-rest-api.php` nests one `$wpdb->prepare()` call inside another (`$where = $wpdb->prepare(...)` gets embedded as literal text inside a second `$wpdb->prepare()` template) — a search term containing a literal `%`-format sequence (e.g. `%s`, `%d`) corrupts the query. Fix: build the query with a single `prepare()` call, merging all args into one array.
- `kyc_submit`, `admin_plan_save`, `admin_banner_save` all echo raw `$wpdb->last_error` to the client on a DB failure. Log server-side only; return a generic message to the client.

### 2f. Dead buttons + missing confirmations
- `admin/challenges/page.tsx`'s bulk Suspend/Reset/Upgrade buttons have no `onClick` handler at all — wire them to real bulk actions or remove them.
- `challenge-operations/page.tsx`'s "Reset" action fires instantly with zero confirmation and permanently deletes trade/position history — add a `ConfirmDialog` (the pattern already exists elsewhere in the codebase, e.g. tournament delete).
- Bulk plan activate/deactivate and the platform-wide emergency kill switches (freeze trading, pause payouts) also apply instantly with no confirmation — same fix.

### 2g. Affiliate dashboard broken fetch + dead code
`affiliate-leaderboard.tsx` and `payout-ticker.tsx` build their fetch URL from `process.env.NEXT_PUBLIC_API_URL` directly instead of the shared `getApiBaseUrl()` — this env var is never set in this deployment (only `NEXT_PUBLIC_FXSIM_API` is), so both permanently show empty state. Fix to use the shared client. Also delete (or properly wire and rename) the dead `api.admin.approvePayout` — it calls the legacy `admin_approve_payout` backend route which sets `status='approved'` and sends a "Payout Processed!" notification without ever deducting balance; it's currently unused by any button but is a landmine if someone wires it up later without knowing.

---

## When done

Update `MASTER_AUDIT_IMPLEMENTATION_REPORT.md`'s Part C phase list to mark completed items (same format as the existing Phase 1-6 entries — root cause, fix applied, test result), and produce a short punch-list summary (what's done, what needed a decision and is still open, current full-suite pass count) at the top of your session log.
