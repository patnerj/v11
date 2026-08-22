# Task: Fix the full sellability audit — 83 findings, 4 phases

## Context

A full functional trace was run against the LIVE production backend (`api.launchapropfirm.com`) and frontend (`demo.launchapropfirm.com`) — every admin panel section, every button/toggle/save, traced through state → payload → real backend handler. 16 of 17 admin sections were covered in full (the Setup wizard wasn't reached — audit it yourself before touching it, don't assume it's fine).

Most of the platform's core data plumbing is genuinely solid (Payments, KYC review, Payouts, Banners/Coupons/Affiliates, Helpdesk, Challenge Lifecycle tools, MT5 Bridge, Scaling — all verified working end-to-end). The problems below are real, specific, and were each verified by reading the actual code on both sides — not guessed.

**Work through the phases IN ORDER. Finish Phase 0 completely, report back with what you changed and how you verified it, before starting Phase 1.** Do not skip ahead — Phase 0 is security/access-control and matters more than anything else here.

**You have SSH access to the live server** (same account the audit was run from). After fixing each backend file, sync it to the live plugin paths and verify against the real live site, not just localhost:
- Backend plugin (propfirm-system): `/home/u845028218/domains/launchapropfirm.com/public_html/api/wp-content/plugins/propfirm-system/`
- Headless bridge: `/home/u845028218/domains/launchapropfirm.com/public_html/api/wp-content/plugins/protradefx-headless-bridge/`
- The frontend's live deployment mechanism wasn't confirmed during the audit (there's a `public_html/app` directory on the same account, but the frontend also has a GitHub repo — `github.com/patnerj/propfirm-frontend.git`, mirrored to `github.com/patnerj/v11.git` — that may deploy via Vercel/git push instead). **Figure out which one is actually live before assuming a fix has shipped** — check whether editing files under `public_html/app` directly changes what demo.launchapropfirm.com serves, or whether it only redeploys on a git push.

**IMPORTANT — scope discipline:** Only touch `launchapropfirm.com` (and its `api`/`demo` subdomains) on this hosting account. The same account also hosts `walletrecovery.click` and `atlanticworldwide.io` — unrelated, do not touch, do not browse into those directories for any reason.

**Verification standard for every item:** don't just confirm the code compiles/lints. Trace the actual save → reload / actual click → real effect round-trip, the same way this audit did. For anything you can't verify live, say so explicitly rather than marking it done.

---

## PHASE 0 — Access control & security (fix first, no exceptions)

### 0.1 Team invite always grants full WordPress admin, regardless of selected role
**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` — `admin_team_invite()`, ~line 5739
**Bug:** Calls `$user->set_role('administrator')` unconditionally, then stores the chosen role (Support Agent / Risk Officer / Accountant / Super Admin) as a cosmetic `fxsim_admin_role` usermeta label that no route ever checks.
**Fix:** Build a real capability mapping per role (e.g. a custom WP capability per role, or a role→allowed-route-prefix map), assign the WordPress role/capabilities that actually match the selection, and gate every `/admin/*` route's `permission_callback` against the specific capability needed — not just "is any admin."
**Also fix:** `src/app/admin/team/page.tsx` (~line 130) — the "Role-Based Permission Matrix" table is a hardcoded static array with zero enforcement behind it. Once real enforcement exists, make this table reflect it (or clearly label it as informational only, if full per-route enforcement is out of scope for this round).

### 0.2 Deactivating a staff member doesn't revoke access
**File:** `class-rest-api.php` — `admin_team_delete()`, ~line 5773
**Bug:** Only sets `fxsim_account_status` usermeta to `'suspended'`. Never strips the WP role, resets the password, or invalidates sessions. Nothing checks this flag at login.
**Fix:** On deactivate: strip administrator role/capabilities, invalidate existing auth cookies/sessions for that user (`wp_destroy_user_sessions($id)`), and check the status flag in the login flow (`login()` in the headless bridge) to reject suspended accounts outright.

### 0.3 MT5 broker password stored and returned in plaintext
**File:** `class-rest-api.php` — `admin_user_detail()`, ~line 1143 (returns `ca.*` verbatim including raw `mt5_password`)
**Fix:** Stop returning the raw column to the frontend. Either encrypt at rest, or follow the same pattern already used for the MT5 ingest secret elsewhere in this codebase — return only a `mt5_password_set` boolean, never the value itself.

### 0.4 Impersonation doesn't clear the admin's own bearer token
**File:** `propfirm-frontend-v10.7.1/src/app/admin/traders/[id]/page.tsx`, ~line 285
**Bug:** `setSession({nonce: null})` only clears the nonce; `fxsim:bearer` stays in localStorage because the clearing branch in `lib/fxsim.ts`'s `setSession` is gated on `bearer !== undefined`, which is never passed.
**Fix:** Pass `{nonce: null, bearer: null}` explicitly on both impersonation start and exit, on this page and the traders-list page's impersonate flow.

---

## PHASE 1 — Money, safety, and things that fatal on first real use

### 1.1 Ban/Freeze Account is broken end-to-end
**Files:** `src/app/admin/traders/page.tsx:186`, `src/app/admin/traders/[id]/page.tsx:251`, `backend-email-update v10.7.1/propfirm-system/includes/class-trading-engine.php:1788` (`set_account_status()`)
**Bug:** The status badge reads CHALLENGE PHASE (`active`/`passed`/`failed`/`funded`), which never contains `banned`/`suspended` — so a banned trader still shows Active and can never be unbanned again from this page. Separately, `set_account_status()`'s account lookup requires `ca.status IN ('active','funded')`, so freezing fails outright for any failed/violated trader — exactly who admins most need to freeze.
**Fix:** Add/use a real account-level status field independent of challenge phase (check whether `fxsim_accounts` already has a usable status column before adding one). Badge and toggle logic on both pages should read that field. `set_account_status()`'s WHERE clause should locate the account by `user_id` alone, not gated on challenge status.

### 1.2 Founder Safety Audit panel (Payouts) always shows "100% Clean"
**File:** `src/components/admin/PayoutManagementModal.tsx`, ~line 118
**Bug:** Reads `payout.consistency_ok`, `hft_flagged`, `anti_scalp_breached`, `near_drawdown_floor`, `dd_proximity_warning` — none exist in the `fxsim_payouts` schema or API response. Every field is `undefined`; every payout shows green "Clean — Recommended for Approval" regardless of real trading behavior.
**Fix:** Either compute these three checks for real at approval time (query the trader's actual trade history / consistency metrics), or remove the panel. A fabricated compliance badge next to a money-release button is worse than none — do not ship this as-is.

### 1.3 Risk panel's Force Close / Flag Account are toast-only, zero backend call
**File:** `src/app/admin/risk/page.tsx:205,211`
**Bug:** Both handlers are a single `toast.error()`/`toast.warning()` with the account ID interpolated into a fabricated confirmation message. Nothing is closed or flagged.
**Fix:** Wire Force Close to the same position-closing logic already implemented and working for `syndicate_freeze` (same file's Syndicate Radar tab — copy that pattern). Wire Flag Account to a real compliance-flag write. If not implementing this round, remove both buttons — do not leave fake risk controls live.

### 1.4 Risk violation-alerts table can never populate (array/object mismatch)
**File:** `src/app/admin/risk/page.tsx:186`, backend `admin_risk_alerts()`
**Bug:** Backend returns `{open_flags, breaches, hft_risks, gambling_risks, toxic_trades}` (an object). Frontend does `Array.isArray(alertsData) ? ... : []` — always false, table always empty.
**Fix:** Either return a flat array of alert rows from the backend, or fix the frontend to read the real object shape and render each category.

### 1.5 Price Feed & Failover tab — all 4 settings silently fail to save
**File:** `src/app/admin/operations/page.tsx:286-289`, backend `admin_price_feed_save()` (`class-rest-api.php:5042`)
**Bug:** Frontend sends `price_source_mode`, `stale_threshold_sec`, `auto_failover`, `auto_freeze`. Backend only reads `source_mode` and `mt5_stale_secs` (different names) — silent no-op on those two. `auto_failover`/`auto_freeze` have **no backend implementation under any name** — grep confirms zero matches. The save handler unconditionally returns `{success:true}` regardless.
**Fix:** Rename the two frontend payload keys to match (`source_mode`, `mt5_stale_secs`). For auto-failover/auto-freeze: implement real enforcement in `class-price-feed.php`/the trading engine, or remove both toggles and their claimed guarantees from the UI copy until they do something real.

### 1.6 Confirmo crypto gateway save is a silent no-op
**File:** `class-rest-api.php` — `admin_whitelabel_save()`, ~line 3685, `$allowed` array
**Bug:** `confirmo_api_key`/`confirmo_callback_secret` aren't in the hardcoded allow-list, so they're never even inspected, let alone persisted, despite the save returning success.
**Fix:** Add both keys to the `$allowed` array — same fix pattern already applied this engagement for the `radius` and `cookie_domain` fields in this exact array. Also fix `payments-center.tsx` (~line 208) — its `ConfirmoCard` reads the raw (masked/emptied) API fields directly instead of the `_set` boolean the backend actually returns, so the "Configured" badge is always blank too.

### 1.7 Anti-scalping rules & eval profit share silently reset on every plan save
**File:** `src/app/admin/config/page.tsx` — `openEditPlan()` and `handleSavePlanSubmit()`, ~line 901
**Bug:** `min_trade_seconds`/`min_hold_action` are never loaded into the form on edit (always show fallback defaults) and never included in the save payload. `evaluation_profit_share` is loaded correctly but also dropped from the save payload. Both are real, backend-enforced fields — every save of an existing plan silently wipes them back to defaults.
**Fix:** Add all three fields to both the pre-fill in `openEditPlan()` and the payload object in `handleSavePlanSubmit()`. Pure frontend fix — backend already handles all three correctly.

### 1.8 Trader Email Broadcast fatals on send
**File:** `class-rest-api.php` — `admin_marketing_broadcast()`, ~line 5517
**Bug:** Calls `FXSIM_Database::log_notification()` inside the recipient loop — that method does not exist anywhere in the codebase. Fatals on the first recipient for any non-empty audience.
**Fix:** Implement `log_notification()` (likely should just call the existing `push_notification()` in `class-database.php`) or replace the dead call with the correct existing method. **Test with a real, non-empty audience before marking this done** — this is exactly the kind of bug that only surfaces on first real use.

### 1.9 Emergency Pause Trading / Issue Manual Challenge / Pause Registrations — client-side theater
**File:** `src/app/admin/page.tsx:483,511` (Command Center), `src/app/admin/operations/page.tsx:240` (Operations)
**Bug:** All three: local `useState` flip + `toast.success/error()`, zero API call. `Pause New Registrations` has no case at all in the emergency-switch handler. `Emergency Pause Trading` has no matching backend concept anywhere in the codebase (grepped for kill_switch/trading_halt/emergency_pause — nothing). `Issue Manual Challenge` shows a fabricated random account number and never calls a create-challenge endpoint.
**Fix:** For Pause Registrations: wire to a real flag checked in the headless bridge's `register()`. For Emergency Pause Trading: implement a real firm-wide halt check at the top of order execution in `class-trading-engine.php`, or remove the control. For Issue Manual Challenge: wire to the real challenge-creation logic already used elsewhere (`FXSIM_Challenge_Engine::create_challenge()`), or remove the button. Do not ship confirmation toasts for actions with no backend effect.

### 1.10 Admin Notes overwrite instead of append — fake audit trail
**File:** `class-rest-api.php` — `admin_user_note_save()`, ~line 1125
**Bug:** `update_user_meta($uid, 'fxsim_admin_note', $note)` fully overwrites the previous note. The "Audit History" list on the frontend is built by prepending to local React state — reload the page and all prior history is gone, and the real prior note text is already destroyed.
**Fix:** Create an append-only `fxsim_admin_notes` table (id, user_id, author_id, note, created_at) and switch both the save handler and the frontend history list to use it.

### 1.11 Sandbox "Factory Reset Test Data" wipes challenge plans despite promising it won't
**File:** `class-rest-api.php` — `admin_demo_purge()`, ~line 5453
**Bug:** UI copy in two places explicitly promises "challenge plans will remain intact" / "preserves configured challenge plans." The handler calls `admin_plans_purge_and_reset()`, which truncates the plans table.
**Fix:** Remove the plan-truncating call from the purge path so the on-screen promise is true, or rewrite the modal/card copy to accurately describe what it does. Do not ship a false promise on a destructive action.

---

## PHASE 2 — Real backend logic exists, but the frontend can't reach it

### 2.1 Homepage Page Builder — save/load/live-render all point at nonexistent routes
**Files:** `src/app/admin/builder/page.tsx:48,67`, `src/app/page.tsx:25`
**Bug:** Builder loads/saves via `/admin/page-schema` (not registered anywhere — grepped exhaustively). The public homepage fetches a *different* nonexistent route (`/page-schema`, no admin prefix) expecting a differently-shaped response (`.schema` vs `.content`).
**Fix:** Implement one real route pair — `GET/POST /admin/page-schema` storing the Puck JSON via the existing `FXSIM_Challenge_DB::set_setting()` pattern — and point the public homepage fetch at the same shape. Until this ships, hide the Page Builder nav entry rather than let admins believe their edits are saved.
**Also note:** `src/components/puck/basic-blocks.tsx:21`'s Text block uses `dangerouslySetInnerHTML` on admin-entered content — once this route exists, that's a stored-XSS surface if a lower-trust admin account is ever compromised. Sanitize before rendering.

### 2.2 Tournament participant enrollment doesn't exist
**File:** backend-wide — no INSERT into `fxsim_tournament_participants` anywhere
**Bug:** The table is created, truncated, counted, and deleted from, but never inserted into. There is no join/enroll endpoint on the frontend or backend. Enrolled-trader counts and the leaderboard can never show real data for any tournament.
**Fix:** Add a real trader-facing "Join Tournament" endpoint (entry-fee handling, eligibility checks, insert the participant row) plus a frontend join action wherever traders browse tournaments.

### 2.3 Tournament prize fields — unreachable in the form, hardcoded in the leaderboard
**File:** `src/app/admin/tournaments/page.tsx:974` (form), `~907` (leaderboard)
**Bug:** `first_prize`/`second_prize`/`third_prize` have state and are sent on save, but no `<Input>` anywhere exposes them in the Create/Edit modal. The Leaderboard modal hardcodes its own prize strings instead of reading the real `prizes_breakdown` the backend already returns correctly.
**Fix:** Add the three missing inputs to the tournament form; change the leaderboard to read `tournament.prizes_breakdown` instead of hardcoded strings.

### 2.4 KYC status never joined into the trader list
**File:** `src/app/admin/traders/page.tsx:190,220`, backend `admin_users()`/`admin_challenges()`
**Bug:** Neither query selects a `kyc_status` column — KYC lives in a separate `fxsim_kyc` table keyed by `user_id`. Every trader shows "Unverified" always; the KYC filter can never match.
**Fix:** `LEFT JOIN fxsim_kyc` into both queries and select the real status.

### 2.5 Traders list has no pagination — silently hides everyone past 25/200 records
**File:** `src/lib/api.ts:209`, backend `admin_users()` (25-row default), `admin_challenges()` (200-row hard cap)
**Fix:** Add real page/limit controls to the Traders page UI and wire them through to the existing backend params (the backend already supports page/limit — the frontend just never sends them).

### 2.6 Apply Custom Overrides shows wrong pre-fill on both list and detail pages
**Files:** `src/app/admin/traders/page.tsx:192-197`, `src/app/admin/traders/[id]/page.tsx:1140`
**Bug:** List page pre-fills from plan-level defaults instead of the trader's real `custom_*` columns. Detail page hardcodes 3 of 6 fields (min trading days, news trading, weekend holding) and never reads them from the API response at all.
**Fix:** Read all six `custom_*` columns from the challenge record on both pages before opening the override modal.

### 2.7 Emergency switches never sync initial state — always show OFF on load
**File:** `src/app/admin/operations/page.tsx:165-169`
**Fix:** Fetch `GET /admin/maintenance` and the news-lock option on mount; hydrate the three switches from real state instead of a static `false` default.

### 2.8 Affiliate Commission Tier config has no GET to hydrate it
**File:** `src/app/admin/marketing/page.tsx:580-583`
**Bug:** Save genuinely persists via `admin_affiliate_config_save()`, but the four inputs are plain `useState(15)` etc. with no fetch — always shows defaults, risking an admin unknowingly reverting real config to 15/5/60/100 on save.
**Fix:** Add a `GET /admin/affiliates/config` fetch and sync it into state on load.

---

## PHASE 3 — Correctness polish, error handling, honest UI

Work through these as a batch — each is small and independent.

- **Fake trend badges shown as live data:** `src/app/admin/page.tsx:174` and `src/app/admin/analytics/page.tsx:232` both show a hardcoded `+14.8%` revenue-growth badge regardless of real trend. Compute real period-over-period change from the existing monthly series, or remove the badge.
- **False-success-on-failure pattern (repeats across pages — audit for more instances beyond these):**
  - `src/app/admin/activity/page.tsx:94` (Mark All Read) — network failure shows success toast; non-ok response shows nothing.
  - `src/app/admin/activity/page.tsx:112` (Mark One Read) — same pattern, empty catch block.
  - `src/app/admin/traders/[id]/page.tsx:205` (Save Note) — no `res.ok` check before showing success.
  - `src/app/admin/analytics/page.tsx:46` (Refresh) — toasts success without awaiting/checking any of the three refetches.
- **SMTP "Send Test Email" tests the last SAVED config, not the on-screen form** (`api.ts:363`, `admin_smtp_test()`) — an admin editing credentials and testing before saving gets a misleading result. Either send the on-screen form values to the test endpoint, or warn the admin to save first.
- **Bulk Activate/Deactivate plans always fails while reporting success** (`src/app/admin/config/page.tsx:594`) — the bulk payload only sends `{id, is_active}`, but `admin_plan_save()` requires a non-empty `name` and 400s. Either send the full plan object or have the backend accept a partial-update payload for this specific bulk action.
- **Analytics "Challenge Passes" chart is mislabeled** (`src/app/admin/analytics/page.tsx:461`) — plots newly-created challenges, not passed ones. Rename the label or change the underlying query.
- **Analytics growth chart pairs months by array index, not by date** (`page.tsx:100`) — can silently mismatch one month's user count with a different month's challenge count when either series has a gap. Pair by date key instead of index.
- **PvP match table always shows "trader@propfirm.com"** instead of real emails — `admin_pvp_analytics_get()` never selects `creator_email`/`challenger_email`. Add both to the query.
- **Marketing affiliate payout destination field reads the wrong column** (`payment_destination` vs real `payout_destination`) — `src/app/admin/marketing/page.tsx:610`. Fix the field name.
- **Helpdesk "SLA Response Speed" card is a hardcoded literal** (`1.4h` / `99.2%`) — either compute it for real from ticket timestamps or remove it.
- **KYC search matches nothing for country/doc_type** — those columns don't exist in `fxsim_kyc`. Either add them or remove the dead search fields.
- **KYC "has documents" compliance gate disagrees between frontend and backend** — frontend checks 4 document fields, backend's gate in `admin_kyc_review()` only checks 3 (omits back-ID). Align both to the same 4 fields.
- **Logo/favicon SVG upload is advertised in the UI but rejected server-side** (intentional, XSS-motivated) — update the UI copy to not claim SVG support, rather than let admins hit a confusing 415.
- **Tournament slug field sent on save with no input in the UI** — either add the input or stop sending the dead field.
- **A fully-wired tournament status-update mutation is never called from anywhere in the UI** (`updateStatusMutation`, `src/app/admin/tournaments/page.tsx:141`) — either wire it to a real control or remove the dead mutation.

---

## Deliverable format (same as prior rounds)

For each phase: list exactly what you changed (file + line), and how you verified it actually works — save → reload / click → real effect, on the LIVE site via SSH sync, not just "the code looks right" or "it compiles." Flag anything you couldn't fully verify rather than guessing. Report back after each phase before starting the next.
