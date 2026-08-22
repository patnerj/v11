# Task: close 3 real gaps in trader-panel Phase 0 — one is critical

## Context

Phase 0 was independently re-verified. Item 0.1 (Stripe webhook fail-closed) is genuinely solid and confirmed live on production — good work, no changes needed there (one small note: the "admin warning banner" wasn't actually new, it already existed before this fix — not a problem, just don't re-claim it next time). Two other items have real, verified gaps.

**Also, separately and not urgent:** the fix for 0.1 only exists in this working directory (`D:\Full Propfirm System for antigravity\...`), not in the git repo at `D:\Spark Propfirm\...` (a different, stale local checkout). This doesn't affect production — confirmed the live site is protected — but if that other directory is ever used as a source for anything, it still has the old vulnerable code. Not something to act on now, just flagging so it doesn't cause confusion later.

---

## 1. CRITICAL: tournament trades still never reach the isolated account — the isolation fix is inert

**Files:** `backend-email-update v10.7.1/propfirm-system/includes/class-trading-engine.php` — `open_position()` (~line 42-43, via `get_user_active_account()`, ~line 1792-1799) and `close_position()` (~line 206); `class-rest-api.php` — `open()` (~line 858-870) and `close()` (~line 872-874)

**The bug:** The account-isolation fix from last round is correctly built — `tournament_join()` genuinely creates a new, dedicated account with no linked `fxsim_challenge_accounts` row, so it's structurally invisible to breach/drawdown checking. The leaderboard fix is also genuinely correct — it reads live equity from that same dedicated account.

But **nothing routes actual trades to that account.** `open_position()` resolves the account to trade against exclusively via `get_user_active_account()`, which INNER JOINs to `fxsim_challenge_accounts` filtered to `status IN ('active','funded')` — a query that, by the isolation fix's own design, can *never* return the tournament account (it deliberately has no such row). The result:

- A trader who **has** a real active/funded challenge: every trade placed "in the tournament" still silently executes against their **real account** — exactly the original bug, just now dressed up with an isolated account that never gets used.
- A trader who has **no** real active challenge: `open_position()` returns "No active challenge account. Purchase a challenge to start trading." — they can't place a single tournament trade at all.

Either way, the isolated account never accrues a single position, so the leaderboard's "live" ROI will show ~0% for every participant forever, and tournaments as a feature don't actually work yet. `close_position()` already has an unused `$explicit_account_id` parameter that's never supplied by its only caller — a ready-made hook that just needs wiring up.

**Fix:** Thread a tournament-context parameter (e.g. `account_id` or `tournament_id`) from the frontend's tournament order-placement flow through `open()`/`close()` REST handlers into `open_position()`/`close_position()`, so that when a trader is placing an order specifically within a tournament context, the engine uses the tournament's dedicated account instead of `get_user_active_account()`. This needs real frontend work too — the trading terminal/order form used during a tournament needs to know it's in tournament mode and pass the right account context. Given the scope, treat this as its own small project: confirm with a live test that a tournament trade genuinely lands on the isolated account's `fxsim_positions`, not the trader's real account.

## 2. `fxsim_payment_orders.status` ENUM never had `'redeemed'` added — fragile, and misreports revenue

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-challenge-db.php` (schema), `class-rest-api.php` (`challenge_start()`, the atomic redemption UPDATE)

**The bug:** The column is `ENUM('pending','approved','rejected','expired')` — confirmed on the live database directly, `'redeemed'` was never added despite the atomic-redemption fix writing that exact value. This is a pre-existing issue (the old code had the same problem), not something the redemption fix introduced, but the fix didn't catch it either, and it now matters more since the whole double-redemption guard depends on this UPDATE behaving as described.

Right now the live database is in non-strict SQL mode, so the out-of-range ENUM write silently stores an empty string instead of erroring — the double-redemption guard still accidentally works (the row no longer matches `'approved'`), but the persisted status is wrong, and the admin revenue query (`SUM(amount) WHERE status='approved'`) permanently drops the order's amount from reported revenue the moment it's redeemed. **On any deployment with strict SQL mode enabled** (common on hardened hosting, managed DB services, or if this hosting's defaults ever change), this exact UPDATE would fail on every single legitimate purchase — a false "already redeemed" 409 on a customer's very first attempt, blocking all paid signups outright.

**Fix:** Add a guarded migration adding `'redeemed'` to this ENUM, following the exact same pattern already used for `fxsim_payouts` in `class-challenge-db.php` (~line 378-386) — `ALTER TABLE ... MODIFY status ENUM(...)`.

## 3. `create_challenge()` doesn't check its own insert failures — narrow but real "payment claimed, nothing delivered" risk

**File:** `backend-email-update v10.7.1/propfirm-system/includes/challenge/class-challenge-engine.php`, `create_challenge()` (~line 11-93)

**The bug:** The redemption rollback added last round (order reverts to `'approved'` if `create_challenge()` reports failure) is a genuine improvement. But `create_challenge()` never checks the return value of its own `$wpdb->insert()` calls into `fxsim_challenge_accounts` (~line 33-48, 66-81). If that specific insert silently fails (DB error, disk full, etc.) after the trading account row was already created, the function still returns `success:true` with a stale/zero challenge_id — so the rollback in `challenge_start()` never fires, and the order stays permanently `'redeemed'` with no usable challenge account. Low-probability (requires a DB error on that specific insert), but a real "customer paid, got nothing" scenario if it happens.

**Fix:** Check `$wpdb->insert()`'s return value in `create_challenge()` and return `success:false` with a real error if the challenge-account insert fails, so the existing rollback path in `challenge_start()` actually catches this case.

---

## Verification

Item 1 especially: don't consider this fixed until you've actually placed a test trade in tournament context and confirmed via direct DB query that it landed on the dedicated tournament account's positions, not the trader's real account. Same SSH/deploy/scope rules as every prior round.
