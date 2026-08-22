# Task: fix the trader-facing panel — 52 findings, 4 phases

## Context

Same methodology as the admin panel audit: a full functional trace of every trader-facing page (dashboard, trading terminal, checkout, payouts, KYC, affiliate, support, tournaments, PvP arena, profile, auth) against the live backend — every button/action traced through frontend state → API payload → real backend handler. 172 features were checked; 52 are genuinely broken or fake. Most of the platform's core trading/payout logic is solid (order execution is properly scoped and server-validated, payout requests have real anti-fraud checks) — the problems below are specific and verified, not guessed.

**Work through phases in order. Finish Phase 0 completely, report back with exactly what you changed and how you verified it, before starting Phase 1.**

Same rules as every prior round: SSH-sync backend changes to the live plugin paths and verify against the real production site. Stay scoped to `launchapropfirm.com` and its subdomains only — do not touch `walletrecovery.click` or `atlanticworldwide.io` on the same hosting account, not even accidentally via a broad search command.

---

## PHASE 0 — Money-safety and security (fix first, no exceptions)

### 0.1 Stripe webhook signature verification is skipped entirely if the webhook secret isn't configured
**File:** `backend-email-update v10.7.1/propfirm-system/includes/stripe/class-stripe.php`, ~line 159
**Bug:** `if ($wh_secret) { verify signature or reject }` — when `stripe_webhook_secret` is simply not set in admin settings, verification is skipped completely rather than failing closed, and the same handler auto-creates and auto-approves a funded challenge account on `checkout.session.completed`. Anyone who discovers the webhook URL could POST a fake completed-checkout payload and get a free funded account, with zero payment.
**Fix:** Fail closed — reject the webhook entirely (don't process it) if no webhook secret is configured, and surface this clearly in the admin payments UI ("Stripe webhook secret not configured — Stripe checkouts will not auto-activate") so an admin can't silently leave this open.

### 0.2 Challenge redemption from an approved payment may not be atomic (possible double-provisioning race)
**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, ~line 2309 (`/challenge/start`)
**Bug:** The handler SELECTs an approved, not-yet-redeemed order, then separately calls `create_challenge()`, then separately UPDATEs the order to `status='redeemed'`. There's no atomic claim (e.g. `UPDATE ... SET status='redeemed' WHERE id=%d AND status='approved'` checked for affected-rows BEFORE creating the challenge). Two concurrent requests for the same approved order (double-click, two tabs, or a direct API replay) could both pass the SELECT check before either UPDATE lands, creating two challenge accounts from one payment.
**Fix:** Make the claim atomic — run the `UPDATE ... WHERE status='approved'` first, check `$wpdb->rows_affected`, and only proceed to `create_challenge()` if the claim succeeded. This is the same fix pattern already correctly used elsewhere in this codebase for payment approval (`admin_payment_approve()`'s atomic claim, mentioned in an earlier round).

### 0.3 Tournament join can silently hijack a trader's real funded/evaluation account
**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `tournament_join()`, ~line 8774
**Bug:** If a trader already has any account in `fxsim_accounts` (from `SELECT id FROM fxsim_accounts WHERE user_id=%d ORDER BY id DESC LIMIT 1`), that same row — their real, live challenge/funded account, used by the trading engine for every order and drawdown check — gets silently re-linked as "the tournament account." Trades a trader makes "for the tournament" execute against their real equity and count toward real drawdown-breach evaluation. A trader could genuinely breach a funded account they've been working toward, without realizing tournament trades and real trades share the same account.
**Fix:** Tournament participation needs its own dedicated account/balance, fully isolated from `fxsim_accounts` rows linked to real challenges (via `fxsim_challenge_accounts`). Never reuse an existing account for tournament purposes — always create a new, tournament-scoped account, and make sure the trading engine/drawdown logic can tell the two apart.

### 0.4 Tournament leaderboard is permanently frozen — no live ranking ever happens
**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, ~line 8539 (`admin_tournament_leaderboard`, shared by trader + admin routes)
**Bug:** `fxsim_tournament_participants.roi_pct`/`current_equity` are set once at join time (0.00 / starting balance) and never updated by anything — no UPDATE statement exists anywhere in the trading engine, challenge engine, or any cron. Every tournament leaderboard shows every participant frozen at 0% return forever, regardless of actual performance.
**Fix:** After resolving 0.3 (tournament accounts need to be real, isolated, tracked accounts), add a real recalculation of `roi_pct`/`current_equity` — either on every relevant trade close for a tournament account, or via a periodic job — so the leaderboard reflects actual standings.

---

## PHASE 1 — Checkout, payouts, and other money-adjacent bugs

### 1.1 "Pay with Crypto (Confirmo)" is shown as a real payment option but the backend never signals it exists
**File:** `class-rest-api.php`, `GET /payment/config`, ~line 4889
**Bug:** Frontend gates the Confirmo option on `config.has_confirmo`, but the backend's payment-config response never includes a `has_confirmo` key at all. Depending on how the frontend's truthiness check resolves an undefined field, this either always hides Confirmo (dead feature) or always shows it regardless of whether it's actually configured — verify which, then fix the response to genuinely reflect whether Confirmo is configured.
**Fix:** Add `has_confirmo` to the `/payment/config` response, computed from whether the Confirmo API key/secret are actually set (same pattern as `has_stripe`/`has_coinpayments`).

### 1.2 Manual payment proof — the transaction hash/ID a trader is required to enter is silently discarded
**File:** `class-rest-api.php`, ~line 4945 (manual proof submit handler)
**Bug:** The frontend requires `txnRef` (disables submit until filled) and sends it as `txn_reference` in the form data. The backend only reads `order_id` and `notes` from `$_POST` — `FXSIM_Payments::submit_proof()` has no txn-reference parameter at all. A required field the trader is forced to fill in never reaches the database.
**Fix:** Read `txn_reference` from the request and pass it through to `submit_proof()`, persisting it on the order record so admins reviewing manual payments can actually see it.

### 1.3 CoinPayments is offered as a real payment option but is an unimplemented stub
**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-payments.php`, ~line 271
**Bug:** `coinpayments_create()` is a TODO stub that always returns `success:false, "coming soon"` — but the frontend shows it as a fully-selectable option whenever the admin has configured CoinPayments API keys, and a pending order row is already written to the DB before the stub fails.
**Fix:** Either implement the real CoinPayments integration, or don't advertise it as available (`has_coinpayments` should reflect real implementation status, not just "keys are configured"). Clean up any orphaned pending orders this stub already created.

### 1.4 A 100%-off coupon still routes the trader through paid-checkout instead of the free path
**File:** `propfirm-frontend-v10.7.1/src/app/checkout/page.tsx`, ~line 111
**Bug:** `isFree` is computed from the raw plan price, never the coupon-adjusted total. A trader with a 100%-off coupon gets routed to Stripe, which then rejects the $0 order server-side (`amount < 50` minimum), forcing them through the manual crypto proof-upload flow (txn hash + file upload) just to redeem a free challenge.
**Fix:** Compute `isFree` from the coupon-adjusted final price, not the raw plan price.

### 1.5 Funded traders see stale profit/equity (up to 24h old), and the "Request Payout" button can be wrongly disabled
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/payouts/page.tsx` (~line 106, 128), `propfirm-system.php` (the `fxsim_trade_closed` hook)
**Bug:** `current_balance` for funded accounts is only refreshed by a once-daily cron — the real-time trade-close hook that keeps this fresh is filtered to `status='active'` only, which excludes funded accounts. A trader with real, current profit can see a stale (even negative-looking) balance and a permanently-disabled payout button until the next daily cron tick, even though the backend's own live-computed `available` figure (used by `GET /payouts`) would show money is genuinely available.
**Fix:** Extend the real-time balance-refresh hook to also cover `status='funded'` accounts, not just `active` ones — the daily cron then becomes a safety-net reconciliation rather than the only update mechanism.

### 1.6 Payout summary shows the wrong profit-split percentage for traders with a custom override
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/payouts/page.tsx`, ~line 262 (RequestPayoutDialog)
**Bug:** The pre-submit summary only reads the plan-default `funded_profit_split`, but the backend's actual payout calculation prioritizes a per-account `custom_profit_split` override when present. A trader on a bespoke split sees the wrong percentage/dollar amount before submitting a real payout request.
**Fix:** Read `custom_profit_split` (already returned by `GET /challenge/my`, just needs adding to the TypeScript type and used in this calculation) with the same override-priority logic the backend uses.

### 1.7 Payout certificates are generated with "Funded Trader" instead of the real trader's name, for every trader, every time
**File:** `class-rest-api.php`, `GET /payouts` (`payouts_list`), ~line 2681
**Bug:** The payout-history response never selects/joins a name field from `wp_users`. The frontend's certificate generator falls back to a hardcoded "Funded Trader" placeholder whenever `payout.name`/`payout.username` is undefined — which is always, since the field is never sent.
**Fix:** Join `wp_users` in the payouts-list query and include the trader's display name in the response.

### 1.8 Affiliate payout destination has no format validation
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/affiliate/page.tsx` (~line 65), `class-affiliates.php` (`set_payout_method`, ~line 132)
**Bug:** Neither frontend nor backend validates the destination address format against the selected method (TRC20/BEP20 wallet pattern, or email format for Wise) — only non-empty is checked. A malformed/truncated address could be saved and only discovered when an admin manually processes the payout and funds go to an invalid destination.
**Fix:** Add basic format validation matching the selected method (regex for wallet address patterns, email format for Wise) on both frontend and backend.

---

## PHASE 2 — Broken/missing features across the trader experience

### 2.1 Trade History hides real trades for any account that isn't currently active or funded
**File:** `class-rest-api.php`, `/history` handler, ~line 899 (`get_active_challenge_account()`)
**Bug:** Only returns trades for accounts with status `active`/`funded` — a trader whose account is `failed`, `passed`, or `suspended` gets a silent empty result, even though real closed trades exist. Directly contradicts the page's own subtitle ("All closed positions across your trading accounts").
**Fix:** Scope trade history to the trader's user_id across ALL their accounts/challenge statuses, not just currently-active ones — a trader should always be able to see their own trading history.

### 2.2 Public trader profile page is completely non-functional — the backend route doesn't exist
**File:** `propfirm-frontend-v10.7.1/src/app/profile/[id]/page.tsx`; backend: no `/profile/{id}` route registered anywhere
**Bug:** Every click from the leaderboard to a trader's public profile leads to a permanent "Profile Not Found" state, for every trader, always. Additionally, even if implemented, the page currently has a hardcoded "Funded Trader" badge shown unconditionally regardless of real status — a misleading public claim.
**Fix:** Implement the missing `GET /profile/{id}` route (name, total_payouts, real badges/achievements), and make the "Funded Trader" badge conditional on the trader's actual real status.

### 2.3 Affiliate leaderboard shows blank/wrong data — wired to the wrong backend endpoint
**File:** `propfirm-frontend-v10.7.1/src/components/affiliate-leaderboard.tsx`, ~line 22
**Bug:** Fetches `/stats/leaderboard`, which is the trader-profit leaderboard (wrong shape: no `name`/`earned` fields) — not affiliate earnings. A correctly-built `public_affiliate_leaderboard()` handler already exists in the backend but is never registered to any route (dead code).
**Fix:** Register `public_affiliate_leaderboard()` to a real route (e.g. `/stats/affiliate-leaderboard`) and point the frontend widget at it instead of `/stats/leaderboard`.

### 2.4 PvP: no way to cancel/withdraw an open challenge you created — stake stays escrowed indefinitely
**File:** `propfirm-frontend-v10.7.1/src/lib/api.ts`, ~line 502 (missing `cancel` method); `arena/page.tsx`, `arena/[id]/page.tsx`
**Bug:** The backend fully implements cancellation with a proper stake refund (`POST /pvp/match/{id}/cancel`), but the frontend's `api.pvp` client never defines a `cancel` method, and no UI control anywhere calls it. A trader who opens a challenge and wants to back out has no way to get their money back.
**Fix:** Add `cancel` to the `api.pvp` client and a real "Withdraw / Cancel Challenge" button on the creator's own waiting match.

### 2.5 Support ticket chat bubbles are misaligned/mislabeled due to a wrong string comparison
**File:** `propfirm-frontend-v10.7.1/src/components/dashboard/trader-support.tsx`, ~line 172
**Bug:** Checks `msg.sender_type === 'user'`, but the real DB/backend value is `'trader'` (enum is `'trader'`/`'admin'`) — so this check is always false, meaning every message (including the trader's own) renders on the "Support Agent" side with the wrong label.
**Fix:** Change the check to `msg.sender_type === 'trader'`, matching the admin-side helpdesk pages which already do this correctly.

### 2.6 Trading terminal — "Close All" reports success even when individual closes fail
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/trading/page.tsx`, ~line 277
**Bug:** `Promise.all(positions.map(p => api.close(p.id)))` wrapped in a bare `catch {}`, with an unconditional success toast after. `api.close()` resolves to `{ok:false,...}` on a real rejection (e.g. minimum-hold-time not met) rather than throwing, so a per-position failure is silently swallowed and the trader is told everything closed when it didn't.
**Fix:** Check each result's `res.ok && res.data.success` (the same pattern already correctly used by the single-position close in positions-table.tsx) and report which positions genuinely failed to close.

### 2.7 1-Click Trade panel always fails on plans that require a stop-loss
**File:** `propfirm-frontend-v10.7.1/src/components/dashboard/trading/chart-panel.tsx`, ~line 151
**Bug:** `ChartPanel` is never given the `plan` prop and always sends `sl: null`. On any plan with `stop_loss_required`, the backend rejects every single 1-Click trade attempt with a generic "Order rejected" — the panel has no way to know it needs an SL field, unlike the full Order Ticket which does receive `plan` and handles this correctly.
**Fix:** Pass `plan` into `ChartPanel` and either require a quick SL input for 1-Click trades on such plans, or clearly disable/hide 1-Click trading with an explanatory message when the plan requires a mandatory stop-loss.

### 2.8 Drawdown/margin-call risk telemetry is fetched but never rendered on the trading terminal
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/trading/page.tsx`, ~line 24
**Bug:** `metrics` (daily-loss/max-drawdown progress, refreshed every 15s) is fetched and passed into both desktop/mobile layouts, but `AccountStrip` — the only component that actually renders these bars — is never invoked anywhere in the file. Traders get zero on-page visibility into how close they are to a daily-loss or max-drawdown breach while actively trading.
**Fix:** Render `AccountStrip` (or equivalent) on the trading terminal so drawdown proximity is genuinely visible during live trading, not just on the separate Challenges page.

### 2.9 Positions/pending-orders table doesn't refresh promptly after actions — relies on a comment describing a push mechanism that doesn't exist
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/trading/page.tsx`, ~line 86
**Bug:** `refreshAll = () => {}` with a comment claiming a backend SSE push updates positions within 2 seconds — but the actual mechanism is a 4-second polling interval, and close/partial-close/SL-TP-save/cancel actions don't trigger an immediate refresh the way order placement correctly does elsewhere in the same file.
**Fix:** Have these action handlers call the same immediate-refresh mechanism (`usePrices.getState().refresh()` or equivalent) that order placement already uses correctly, instead of waiting for the next poll tick.

### 2.10 No trade history export/CSV exists at all
**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/history/page.tsx`
**Bug:** Fully absent capability — no button, no handler, no backend route. Expected on a paid platform's trade history page.
**Fix:** Add a real CSV export of the trader's own (already-fetched or freshly-queried) trade history.

---

## PHASE 3 — Smaller correctness/UX bugs

- **Journal note editor race condition** (`dashboard/history/page.tsx` ~line 218): shared (non-per-row) edit state means rapidly switching expanded rows while a note fetch is in flight can save trade A's note under trade B's record. Move to per-row state or cancel in-flight fetches on row-collapse.
- **`screenshot_url` silently cleared on every note save** (same file, ~line 58): hardcoded to `''` on every save, wiping any previously stored value. Either read/preserve the real value or remove the dead field.
- **Notifications list has no pagination** (`class-rest-api.php` ~line 7464): capped at 30 of the newest 50 stored — a trader with more than 30 notifications can have unread ones (ranks 31-50) they can never see or individually acknowledge. Add pagination or "load more."
- **Resend verification email always shows "Sent!" even on failure** (`dashboard/page.tsx` ~line 336): `res.ok` never checked.
- **"Keep me signed in" is ignored for 2FA logins** (`src/store/auth.ts` ~line 78): `verifyTwoFactor` never passes `remember`; backend always grants a 30-day session regardless of the checkbox.
- **Marketing asset "Download PNG" buttons do nothing** (`dashboard/affiliate/page.tsx` ~line 231): no onClick/href at all.
- **Support: wrong ticket categories accepted by the UI, silently reclassified as "general"** (`trader-support.tsx` ~line 124): frontend offers "Technical Issue"/"Trade Dispute", backend only accepts `billing/rules/tech_mt5/kyc/general` — breaks admin triage for exactly the ticket types needing fast routing.
- **Support: ticket create/reply failures show zero user feedback** (`trader-support.tsx` ~line 65): errors only `console.error`'d, no toast.
- **Support: stale ticket status inside an open thread** (`trader-support.tsx` ~line 45): if an admin closes a ticket while the trader has it open, the trader's view doesn't reflect it until they navigate away and back.
- **Tournament: "registered" state doesn't persist across reload** (`tournaments/[id]/page.tsx` ~line 19): shows "Enter Tournament" again after reload even if already joined; clicking surfaces only a generic error.
- **Tournament: entry fee never disclosed before joining** (`tournaments/[id]/page.tsx` ~line 132): fee is silently deducted server-side with zero on-page indication of the amount.
- **Tournament: balance-sufficiency check has a race condition** (`class-rest-api.php` ~line 8766): non-atomic check-then-deduct; concurrent joins could take a balance negative. Make it a single atomic conditional UPDATE.
- **Tournament: "Enter" button shown even for cancelled tournaments** (`tournaments/[id]/page.tsx` ~line 131): backend only allows joining `upcoming`/`active`.
- **PvP: self-join button rendered on your own open match** (`arena/page.tsx` ~line 441): backend correctly blocks it, but the UI presents a guaranteed-fail action to the user on their own listing.
- **PvP: "stadium chat" is 100% local, never sent/received** (`arena/[id]/page.tsx` ~line 110): no backend chat endpoint exists at all; messages vanish on refresh and are never seen by the opponent.
- **PvP: order placement has no rate limiting** (`class-rate-limiter.php` ~line 66): `/pvp/match/{id}/order` isn't classified into any rate-limit tier, unlike identical real-money order routes.
- **PvP: leaderboard "Win Rate" is hardcoded to 100% for everyone, "Streak" is really lifetime win count** (`class-pvp-engine.php` ~line 129): compute both for real.
- **PvP: "Total Staked" hero stat overcounts unfilled/cancelled matches** (`class-pvp-engine.php` ~line 136): sums `stake*2` with no status filter.
- **PvP: hardcoded "42 Spectators In Stadium"** (`arena/[id]/page.tsx` ~line 144): literal text, no real viewer count.
- **KYC: "Securely Encrypted" checkmarks shown for all 4 docs unconditionally** (`dashboard/kyc/page.tsx` ~line 450): decorative, not wired to the real per-document status the backend returns.
- **KYC webhook always reports hardcoded doc-type/country** (`class-rest-api.php` ~line 2632): `$doc_type`/`$country` referenced but never defined — cosmetic/backend-only, doesn't affect the trader.
- **Settings page promises "Preferences" and an in-page password-change form that don't exist** (`dashboard/settings/page.tsx` ~line 62): only a "Reset" button that emails a link; no actual preference controls anywhere.
- **Payout certificates never show the plan/program name** (`dashboard/certificates/page.tsx` ~line 165): `planName` prop never passed even though `challenge_id` is available to resolve it.
- **Trading terminal: margin-level danger color uses a hardcoded 120% threshold** instead of the plan's real configured `margin_call_level` (~line 460) — cosmetic only, real enforcement is server-side and correct.
- **Trading terminal: IP-restriction ("Strict Mode") indicator is hardcoded `false`**, never derived from real state (`order-ticket.tsx` ~line 82) — cosmetic only, backend enforces this independently and correctly.
- **Dead/orphaned duplicate terminal components** (`terminal-desktop-layout.tsx`, `terminal-mobile-layout.tsx`, `trading-lock-state.tsx`): unreachable, unused, safe to delete — maintenance risk for whoever inherits this codebase.

---

## Verification

Same standard as every prior round — trace the actual round-trip (click → real effect → reload → still correct), not just "the code compiles" or "the route exists." For Phase 0 items especially: these are money-safety and fraud-prevention fixes, verify them by actually reproducing the scenario (e.g. attempt the double-redemption race, confirm a tournament join doesn't touch a real challenge account) rather than just reading the code and asserting it's fixed.
