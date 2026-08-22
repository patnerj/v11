# Task: close 5 remaining gaps from Phase 1

## Context

Phase 1 was independently verified by an adversarial trace (fresh read of the actual code, not a review of your report). 4 of 9 items are genuinely solid and need no further work: **1.1 Ban/Freeze, 1.7 Plan fields (anti-scalping/eval-share), 1.11 Factory Reset preserves plans, 1.8 Broadcast fatal fix.** Don't touch these — re-verification will flag any regression.

5 items have real, specific gaps — each verified by reading the actual code end-to-end, with exact evidence. Fix these before starting Phase 2.

---

## 1. Admin Notes table has no migration path — will silently lose data on any other deployment

**Files:** `backend-email-update v10.7.1/propfirm-system/propfirm-system.php`, `includes/class-database.php`, `includes/class-rest-api.php`

**The bug:** You added the `fxsim_admin_notes` table to `class-database.php`'s `install()`, but `FXSIM_VERSION` in `propfirm-system.php` (~line 16) was never bumped, and `install()` is only invoked on fresh activation or when `get_option('fxsim_db_version') !== FXSIM_VERSION` (propfirm-system.php ~lines 123-127). On the live site right now, the table exists **only because a manual `wp eval 'FXSIM_Database::init_tables()'` was run by hand over SSH during this deployment** — that's not a real fix, it's a one-time patch. Any future deployment of this same plugin update to an already-running site (a different client, or this same site after another change) will silently skip table creation. `admin_user_note_save()` (class-rest-api.php ~line 1216-1234) also never checks `$wpdb->insert()`'s return value and always responds `success:true` — so on an affected site, an admin sees "note saved" while the row never persists.

**Fix:**
1. This codebase already has the correct pattern for this exact problem — the `fxsim_feature_level` ladder in `propfirm-system.php` (~line 129+), which you correctly used elsewhere in this same round for `ensure_kyc_columns`. Add an equivalent step: bump the feature level and add a step that calls `FXSIM_Database::install()` (or a targeted `ensure_admin_notes_table()` helper) so it runs on every already-deployed site on next page load, not just fresh installs.
2. Fix `admin_user_note_save()` to check the insert's return value and return a real error (not `success:true`) if it fails, so a future version of this exact bug fails loudly instead of silently.
3. Verify on the LIVE site: drop or rename the table temporarily in a way you can undo (or better, just confirm the version-bump logic would fire by checking `fxsim_db_version` against the new `FXSIM_VERSION` directly), to prove the migration path genuinely runs on an already-running install — don't rely on the table already existing from the manual patch to call this "verified."

## 2. Safety Audit's drawdown check reads a column that doesn't exist

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `admin_payouts_list()`, the `near_drawdown_floor` calculation (~line 2823-2832)

**The bug:** `$max_dd_pct = (float) ($ch->custom_max_dd ?: $plan->max_total_loss_pct ?: 10.0);` — `max_total_loss_pct` does not exist anywhere in the `fxsim_challenge_plans` schema. The real columns are phase-specific: `p1_max_dd`, `p2_max_dd`, `p3_max_dd`, `funded_max_dd`. Since `$plan` is a plain object from `SELECT *`, this always reads `NULL`, so every payout without a `custom_max_dd` override (i.e. the common case) silently uses a hardcoded flat 10% instead of the plan's real, phase-appropriate drawdown limit.

**Fix:** Use the engine's own `get_phase_rules()` helper (`class-challenge-engine.php` ~line 660-688) to resolve the correct max-drawdown column for the challenge's actual phase, the same way the rest of the engine already does it — don't hardcode a fallback percentage.

**Also fix:** `breaches_count` is computed correctly by the backend but is never read or rendered anywhere in `PayoutManagementModal.tsx` (~line 105-165) — add it to the panel so the real breach count the backend already provides actually reaches the admin.

## 3. Risk Force Close can silently act on the wrong account and still report success

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `admin_risk_force_close()` (~line 1565-1599)

**The bug:** The frontend only ever sends `{user_id}` (risk/page.tsx ~line 208), never the `account_id` that's actually on the alert row it's a real field. The endpoint then independently derives "the account" via `SELECT id FROM fxsim_accounts WHERE user_id=%d ORDER BY id DESC LIMIT 1` — the trader's most-recently-created account. Then `close_position()` (`class-trading-engine.php`) *independently re-derives the account again* via `get_user_active_account()`, filtered to `status IN ('active','funded')`. Neither of these is guaranteed to be the specific account the flagged alert is actually about. For any trader with more than one concurrent account (normal — multiple evaluations/funded accounts), if the flagged violation isn't on that one most-recent account, the position lookup matches nothing, 0 positions close, and the endpoint still returns `success: true` with "Successfully liquidated 0 open positions." Separately, toxic-trade alert rows reference already-*closed* trades, so Force Close on those rows doesn't target anything relevant at all.

**Fix:** Have the frontend send the alert row's real `account_id` (it's already populated on `ViolationAlertRow`, just not sent) and have `admin_risk_force_close()` require and use it directly rather than re-deriving "an" account for the user. If the resolved close count is 0, return a clear message saying so rather than a generic success — an admin needs to know the click didn't do anything.

## 4. Price Feed auto-failover/auto-freeze save correctly but do nothing

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-price-feed.php` (and wherever trading execution guards live)

**The bug:** `fxsim_feed_auto_failover`/`fxsim_feed_auto_freeze` are now genuinely persisted by `admin_price_feed_save()` — that part of the fix is correct. But a full-repo grep confirms **zero** read sites for either option anywhere in the backend. Toggling them has no runtime effect.

**Fix:** Implement real enforcement — wire `fxsim_feed_auto_failover` into the actual failover-source-selection logic (`mt5_is_fresh()`/`feed_health()` area) and `fxsim_feed_auto_freeze` into `feed_guard_for_trading()` so a stale feed with this toggle on actually blocks new trades. If this is out of scope for this round, at minimum grey out both toggles in the UI with a note that they're not yet enforced — do not leave them looking functional when they're inert.

## 5. pause_trading check is in the wrong layer — no defense-in-depth

**Files:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` (the `/open` REST handler, ~line 856) and `includes/class-trading-engine.php` (`open_position()`)

**The bug:** The `pause_trading` check genuinely exists and genuinely works today — but it's in the REST route handler (`class-rest-api.php`'s `open()`), not inside `FXSIM_Trading_Engine::open_position()` itself as claimed. It only works because `/open` currently happens to be the sole real caller of `open_position()`. Any other code path that calls `open_position()` directly (an admin manual-trade tool, a bulk script, a future feature) would silently bypass the pause entirely.

**Fix:** Move the check (or duplicate it) into `open_position()` itself, at the top, before any order logic runs — so the safety property holds regardless of caller, not just for the one route that currently happens to be the only one.

---

## Deployment & verification rules (same as before)

- SSH-sync every backend fix to the live plugin paths and re-verify against the real production site — not just `tsc --noEmit` / local review.
- For item 1 specifically: don't consider it fixed until you've proven the migration path runs on an *already-deployed* site, not just confirmed the table currently exists (it exists right now only from the manual patch).
- Scope discipline unchanged: only `launchapropfirm.com` and its subdomains. Do not touch `walletrecovery.click` or `atlanticworldwide.io` on the same hosting account.
- Report back per item: what you changed (file + line) and how you verified it — the specific failure mode described above, not just "it compiles."
