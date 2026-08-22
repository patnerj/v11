# Task: 3 residual items — not urgent, no live security hole, but real

## Good news first

The highest-stakes question from last round — can a client-supplied `account_id` be used to trade on someone else's account — was independently re-verified and is **genuinely closed**. `open_position()`, `place_pending_order()`, and `close_position()` all resolve ownership server-side via `WHERE a.id=%d AND a.user_id=%d` with `user_id` always taken from `get_current_user_id()`, never from the request body. Tried to construct an attack request that defeats this and couldn't. Good work — no changes needed on that front.

Also confirmed directly on the live database: the `fxsim_payment_orders.status` ENUM genuinely includes `'redeemed'` right now. That part is live and correct.

Three real things remain, none of them urgent (no live exploit, no money at risk today), but worth closing:

## 1. Tournament trades run with essentially zero risk enforcement

**Files:** `class-trading-engine.php` — `open_position()`/`place_pending_order()` (plan-rule lookups ~line 69-77 / 1098-1104), `check_margin_levels()` (~line 778, 798-804); `class-database.php` (`fxsim_tournaments.rules_json` column, unused)

**The gap:** Because tournament accounts deliberately have no linked `fxsim_challenge_accounts` row (that's what makes them isolated), every plan-derived safety check silently no-ops for them: no max lot size, no max leverage beyond a hardcoded 100x set at account creation, no mandatory stop-loss, no news-trading lock. Worse, the background margin-call/stop-out sweep and the drawdown-breach engine both also require that same join, so tournament accounts are entirely outside automatic risk intervention — a trader could open a massive, unhedged, SL-less position and the platform will never step in even as it moves deeply against them.

This doesn't touch real money (isolated virtual balance), but it defeats the purpose of a tournament having configured rules — `fxsim_tournaments.rules_json` already exists as a column for exactly this (daily DD %, max DD %, leverage) but nothing anywhere reads it.

**Fix:** Either read `rules_json` and apply it as a tournament-specific rule set inside `open_position()`/`place_pending_order()`/`check_margin_levels()` when trading on a tournament account (the more correct fix), or at minimum apply the same sane conservative defaults used for real accounts (a real max leverage, a real mandatory-SL check) rather than none at all.

**Also, smaller:** `trading_eligibility()`'s tournament branch checks that the user is a participant of the given `tournament_id`, but never checks that the `account_id` in the same request actually belongs to that tournament — it currently stays safe only because `open_position()` re-derives ownership independently downstream. Add the explicit check so this isn't relying on a second, unrelated function to catch what should be validated at the gate itself.

## 2. The ENUM migration is wired to a mechanism the codebase's own comments call unreliable

**File:** `class-challenge-db.php` (the guarded ALTER for `fxsim_payment_orders.status`), `propfirm-system.php`

**The gap:** The migration code itself is correct and idempotent (matches the `fxsim_payouts` pattern exactly). But it only runs inside `FXSIM_Database::install()`, gated by `FXSIM_VERSION !== fxsim_db_version` — and `FXSIM_VERSION` has been pinned at `11.0.3` since an earlier round without a bump. On a normal file-replacement deploy (not a full plugin deactivate/reactivate), this exact migration would be silently skipped, because `fxsim_db_version` is already stamped to the current version. It appears to have been applied to production via a direct manual `ALTER TABLE` this round rather than through this mechanism — confirmed live, so today's fine — but the mechanism itself isn't something future deploys can rely on.

**Fix:** Move this migration (and any other logic gated the same fragile way) onto the `fxsim_feature_level` ladder in `propfirm-system.php` — the mechanism this codebase already built specifically to solve this exact problem (its own comment explains why: additive migrations gated behind a version check that doesn't change don't run on file-replacement upgrades). Add a new feature-level step that calls the ENUM migration, so it's genuinely self-healing on any future deploy, not dependent on a one-time manual patch.

## 3. `create_challenge_account()` doesn't check its own insert's success

**File:** `class-database.php`, `create_challenge_account()` (~line 930-939)

**The gap:** `create_challenge()`'s new check (`if (!$account_id) return failure`) looks like it validates account creation, but the helper it calls never checks `$wpdb->insert()`'s return value — it just returns `(int)$wpdb->insert_id`, which WordPress leaves stale (non-zero, from a prior successful insert) after a failed query rather than resetting to 0. A failing insert here could be silently reported as success, corrupting the `fxsim_account_id` foreign key on the challenge account row created right after it.

**Fix:** Check `$wpdb->insert()`'s actual return value inside `create_challenge_account()` itself and return `0` (or throw) on failure, so the caller's existing `if (!$account_id)` guard actually catches this case instead of being fooled by a stale `insert_id`.

---

No verification urgency on any of these — none are live exploits. Same rules as always when you do get to them: SSH-sync, verify live, stay scoped to launchapropfirm.com.
