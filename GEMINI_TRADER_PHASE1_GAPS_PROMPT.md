# Task: close 2 real gaps from trader-panel Phase 1

6 of 8 items are genuinely solid, no notes: 1.1, 1.2, 1.3, 1.6, 1.8. Item 1.7 works correctly end-to-end but the description was inaccurate (it uses `get_userdata()`, not a SQL JOIN as claimed — harmless, just don't restate that detail next time).

Two real, verified gaps:

## 1. Funded accounts can be wrongly breach-checked against the wrong drawdown limit

**File:** `backend-email-update v10.7.1/propfirm-system/includes/challenge/class-challenge-engine.php`, `evaluate_after_trade()`

**The bug:** The real-time balance-sync fix is correct and working — but it just activated a previously-dormant bug. `evaluate_after_trade()` correctly skips the evaluation-only logic (profit target/consistency/promotion) for `status='funded'` accounts (gated on `$challenge->status === 'active'`). But the two drawdown-breach checks (max drawdown, daily drawdown) have **no such gate** — they derive limits via `get_phase_rules($plan, $phase, $challenge)`, keyed off `$challenge->phase`.

The problem: `phase` is only ever reset to `0` (which makes `get_phase_rules()` correctly return `funded_max_dd`) for **instant-funding** accounts. For accounts that reach funded status the normal way (`promote_inner()`, "All phases passed → Funded"), only `status`/`funded_at`/`passed_at` get updated — `phase` keeps its last evaluation-phase value (1, 2, or 3). `get_phase_rules()` then returns that phase's `p1_max_dd`/`p2_max_dd`/`p3_max_dd` instead of the account's actual `funded_max_dd`.

This is currently invisible because the seeded default plans happen to set `p1_max_dd = p2_max_dd = funded_max_dd = 10.00`. The moment an operator configures a genuinely different `funded_max_dd` (which is the entire point of that field existing separately — funded traders typically get different drawdown room than evaluation phases), this newly-live real-time hook will incorrectly flag/breach funded accounts using the stale evaluation-phase limit instead.

**Fix:** Either reset `phase` to `0` when an account is promoted to funded via `promote_inner()` (matching what instant-funding already does), or have `get_phase_rules()`/`evaluate_after_trade()` explicitly check `status === 'funded'` and use `funded_max_dd`/`funded_daily_dd` directly regardless of the stale `phase` value. Prefer the first — it fixes the root cause (phase should reflect funded status) rather than patching every consumer of `phase` individually. Verify with a plan whose `funded_max_dd` is deliberately set different from `p1_max_dd`/`p2_max_dd`, not the default seeded plans where the bug is invisible.

## 2. 100%-off coupon redemption has a concurrency race that can bypass usage limits

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `challenge_start()`'s coupon branch; `includes/class-coupons.php`

**The bug:** `FXSIM_Coupons::validate()` correctly checks `usage_limit`/`per_user_limit` via a SELECT before any write — but that check isn't atomic with the redemption. Each `/challenge/start` call creates its own fresh `fxsim_payment_orders` row first, and the redemption's uniqueness constraint is `UNIQUE(coupon_id, order_id)` — not `UNIQUE(coupon_id, user_id)`. Since every concurrent request gets its own distinct `order_id`, they never collide on that key. A burst of simultaneous requests carrying the same still-valid, limited coupon can all pass `validate()` before any of them commits, each write their own order+redemption row, and each successfully call `create_challenge()` — minting more free challenges than the coupon's `usage_limit`/`per_user_limit` was meant to allow. The `used_count` column itself stays correctly capped, but that counter no longer bounds how many free challenges actually got granted, since challenge creation already happened before the counter could gate anything.

**Fix:** Make the check-and-redeem sequence atomic. The cleanest fix, matching the pattern already used correctly elsewhere in this codebase (the earlier atomic payment-order redemption fix): do the usage-limit check as part of a single atomic UPDATE (e.g. `UPDATE coupons SET used_count = used_count + 1 WHERE id=%d AND (usage_limit=0 OR used_count < usage_limit)`, checking rows-affected) rather than SELECT-then-decide-then-insert. For `per_user_limit`, either add a real `UNIQUE(coupon_id, user_id)` constraint on the redemptions table (if a coupon is genuinely meant to be single-use per user) or wrap the whole validate+redeem sequence in a transaction with appropriate row locking.

---

Not urgent — both require deliberate exploitation (concurrent requests, or an operator configuring differing drawdown percentages) rather than being live today, but both are real and worth closing. Same rules as always: SSH-sync, verify live with a scenario that would actually surface each bug (not the default config where it's invisible), stay scoped to launchapropfirm.com.
