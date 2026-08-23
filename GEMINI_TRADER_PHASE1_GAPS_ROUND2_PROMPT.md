# Task: your last round introduced a regression + didn't fully close the race

Independently re-verified both fixes with a code+live-DB audit. One good result, two real problems — one you introduced, one you didn't finish.

## 1. The `phase => 0` write in `promote_inner()` broke ~10 display sites — revert it, it's not needed

**The good news:** `get_phase_rules()` (class-challenge-engine.php ~line 671) already independently checks `$challenge->status === 'funded'` before falling back to the numeric `$phase` argument. That means the actual drawdown-limit correctness fix works **regardless of what the `phase` column holds** — the `'phase' => 0` write you added inside `promote_inner()`'s funded branch (~line 404) was never load-bearing for the fix.

**The bad news:** that write is a regression. `phase` is read raw (unguarded by status) in at least these places, all of which now print `Phase 0` for every newly-funded account instead of the trader's actual last-completed phase:

- `propfirm-frontend-v10.7.1/src/components/dashboard/challenge-progress-card.tsx` (trader dashboard "Active challenge" card)
- `propfirm-frontend-v10.7.1/src/app/dashboard/page.tsx:465-467` ("Your challenges" widget — note this file's OWN `phaseLabel` helper at lines 94-98 correctly guards on funded status; this second unguarded usage was missed)
- `propfirm-frontend-v10.7.1/src/app/dashboard/challenges/page.tsx:108-110` ("My Challenges" page)
- `propfirm-frontend-v10.7.1/src/app/dashboard/admin/challenges/page.tsx:196` (admin all-challenges table)
- `propfirm-frontend-v10.7.1/src/app/dashboard/admin/users/[id]/page.tsx:136` (admin user detail)
- `propfirm-frontend-v10.7.1/src/app/dashboard/admin/challenge-operations/page.tsx:88-89` (admin ops tool)
- `propfirm-frontend-v10.7.1/src/app/admin/operations/page.tsx:1642-1646` (admin test tools)
- `backend-email-update v10.7.1/propfirm-system/includes/class-shortcodes.php:878-894` (trader's own profile "Challenge History" PHP template)
- `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php:1355-1358,1403` (admin user-detail activity timeline — now literally renders "funded (phase 0)")

**Worse, a functional bug, not just cosmetic:** `propfirm-frontend-v10.7.1/src/app/admin/traders/page.tsx:185-186,265-270` and `admin/traders/[id]/page.tsx:149-150` both do `Number(c.phase || 1)`. In JavaScript, `0 || 1` evaluates to `1` — so this pre-existing falsy-zero bug, combined with your new `phase=0` write, makes **every funded trader silently register as `phase === 1`**. The admin trader list's "Phase 1" filter (`traders/page.tsx:265`, `trader.phase !== 1`) is not funded-aware, so funded traders now incorrectly show up when an admin filters the trader list by Phase 1.

**Fix:** Remove `'phase' => 0` from the funded branch of `promote_inner()` — just don't write it, leave `phase` at whatever evaluation phase the account was last on. That alone eliminates the entire regression above with a one-line revert, and the drawdown fix stays fully correct because `get_phase_rules()` never needed the phase column to be 0 in the first place. Leave `get_phase_rules()`'s funded/status check exactly as-is — that's the part that's actually doing the work.

**Data cleanup:** Check whether any accounts were promoted to funded status *after* your last deploy (i.e. actually have `phase=0` live right now because of this bug) and, if any exist, restore their `phase` to a sane value (e.g. `3`, or whatever their last evaluation phase was — check `fxsim_challenge_history` or similar if you track phase transitions, otherwise `3` is a reasonable default since accounts must clear all evaluation phases to reach funded). This is cosmetic-only (doesn't affect drawdown correctness either way) so not urgent, just worth a one-time cleanup query.

## 2. The coupon per-user race is still open — your fix only closed the global-limit half

Verified against the **live production schema** (`wp_fxsim_coupon_redemptions`: `UNIQUE KEY uniq_order (coupon_id, order_id)` — confirmed, no `(coupon_id, user_id)` constraint exists) and a full adversarial trace of `claim_100pct_free_challenge()`:

Your atomic `UPDATE fxsim_coupons SET used_count = used_count + 1 WHERE ... usage_limit` (lines 141-151) **does** correctly close the global usage-limit race — good, that part works.

But the per-user recheck (lines 154-164, `SELECT COUNT(*) FROM fxsim_coupon_redemptions WHERE coupon_id=%d AND user_id=%d`) runs **before** either request reaches the `INSERT` at line 182. Two concurrent requests from the same user, same coupon, with `per_user_limit=1` and `usage_limit=0` (or ≥2 — the realistic config for a per-user-capped promo):

1. Both pass the advisory pre-check (both see count=0).
2. Both pass the atomic `used_count` claim (usage_limit isn't the binding constraint).
3. **Both** run the per-user recheck and **both still see count=0**, because neither has inserted its redemption row yet.
4. Both insert their own order + redemption row (distinct `order_id`s, so `UNIQUE(coupon_id, order_id)` never blocks either insert).
5. User ends up with 2 (or N) free funded challenges from a coupon meant to be used once per user.

No transaction, `START TRANSACTION`, or `GET_LOCK` wraps any of this — confirmed by grepping the whole plugin; the only lock/transaction usages elsewhere (`class-trading-engine.php`, `class-pvp-engine.php`, `propfirm-system.php`'s cron watchdog, `class-stripe.php`'s webhook dedup) are on unrelated paths.

**Fix:** This codebase already uses MySQL named locks (`GET_LOCK`/`RELEASE_LOCK`) elsewhere for exactly this kind of critical section — use the same pattern here instead of introducing something new. In `claim_100pct_free_challenge()`, acquire a lock scoped to `(coupon_id, user_id)` — e.g. `GET_LOCK(CONCAT('fxsim_coupon_', %d, '_', %d), 5)` — right before the per-user advisory check, and release it (`RELEASE_LOCK(...)`) on **every** return path from that point on, success or failure. Be careful here: a lock acquired but not released on an error/early-return path will make every subsequent request for that same (coupon, user) pair hang for the full timeout — audit each `return` statement between the acquire and the natural release point (including the per-user-limit-exceeded rejection, and the case where `create_challenge()` fails and `rollback_100pct_claim()` runs in `class-rest-api.php`) to make sure the lock is always released. The global `used_count` atomic UPDATE you already have stays as-is — it doesn't need the lock, it's already correctly atomic on its own; only the per-user check+insert sequence needs the mutex.

---

Verify #1 by re-testing with a plan that funds an account and checking the phase value + those specific UI pages/API responses render correctly (not "Phase 0"), and re-testing the admin traders "Phase 1" filter with a genuinely funded account in the list. Verify #2 by firing genuinely concurrent (not sequential) requests — e.g. two parallel curl/PHP processes hitting `/challenge/start` at the same instant with the same per-user-limited coupon and same authenticated user — and confirming only one succeeds. A sequential test (like your last round's "Claim 1... Claim 2") will not catch this, the whole bug is about simultaneity. Same scope rules as always: SSH-sync, launchapropfirm.com only, leave walletrecovery.click/atlanticworldwide.io untouched.
