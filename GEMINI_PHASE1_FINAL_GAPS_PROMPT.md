# Task: close the final 2 gaps from Phase 1

## Context

Second round of independent verification. **3 of 5 are genuinely solid and confirmed — don't touch them:** Admin Notes migration (the `feature_level < 5` self-healing check genuinely works on an already-running site, verified by tracing `plugins_loaded` execution), Safety Audit drawdown (genuinely phase-branches through `p1_max_dd`/`p2_max_dd`/`p3_max_dd`/`funded_max_dd` correctly now), and Price Feed auto-failover/auto-freeze (`feed_guard_for_trading()` is genuinely called from all 3 real order-placement call sites, confirmed by exhaustive grep — this is real enforcement, not a dead function).

2 items still have a real, specific gap each — both traced to the exact remaining bug.

---

## 1. Risk Force Close still reports false success when every close attempt fails

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `admin_risk_force_close()` (~line 1568-1625)

**What's actually fixed (don't touch):** The account-targeting fix is genuine — the endpoint now correctly resolves and uses the real `account_id` sent from the frontend, and `close_position()`'s new `$explicit_account_id` parameter genuinely bypasses the old `status IN ('active','funded')` filter while still checking `a.user_id = %d` for ownership. This part works.

**What's still broken:** There's an upfront guard for "zero positions found" — but nothing after the close loop:

```php
$closed = 0;
foreach ($open_positions as $op) {
    $res = FXSIM_Trading_Engine::close_position($user_id, (int)$op->id, 'admin_force_close', true, $account_id);
    if (!empty($res['success'])) $closed++;
}
// ... unconditionally returns success:true here, regardless of $closed
return new WP_REST_Response([
    'success' => true,
    'message' => "Successfully liquidated {$closed} open positions...",
    'closed_count' => $closed
]);
```

If positions are found but every single `close_position()` call fails — which genuinely happens when `admin_risk_alerts()`'s breach-alert fallback (~line 1519) hands the frontend `'#ACC-' . $b->user_id` instead of a real account id (this happens when a breach's `challenge_id` fails to LEFT JOIN to an existing `fxsim_challenge_accounts` row), and that numeric value happens to collide with a different real account's id — the endpoint still returns `success: true` with `"Successfully liquidated 0 open positions"`. That's the exact "admin thinks it worked and it didn't" bug this was supposed to eliminate.

**Fix:**
1. In `admin_risk_force_close()`, check `$closed` after the loop: if `$closed === 0` (and positions were found), return `success: false` with a message that makes clear nothing was actually closed — don't let "0 closed" render as a success toast.
2. Fix the root cause in `admin_risk_alerts()`: the `'#ACC-' . $b->user_id` fallback for orphaned breach records is handing out a user_id disguised as an account_id, which `admin_risk_force_close()`'s `#ACC-(\d+)` branch accepts at face value with no ownership cross-check before querying positions. Either fix the fallback to genuinely resolve a real account id for the affected user (e.g. the same `ORDER BY id DESC LIMIT 1` lookup, but labeled so the frontend/backend both know it's a fallback, not a confirmed id), or have `admin_risk_force_close()` validate that the resolved account actually belongs to `user_id` before querying positions, not just rely on `close_position()`'s internal check to fail closed later.
3. `src/app/admin/risk/page.tsx`'s `handleForceClose` (~line 206-219) currently trusts `res.data.success`/`message` verbatim — once the backend genuinely reports failure on 0-closed, confirm the frontend surfaces it as an error toast, not a success one.

## 2. Emergency Pause doesn't stop already-queued pending orders from opening new positions

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-trading-engine.php`, `process_pending_orders()` (~line 1471) and `fill_pending_order()` (~line 1302)

**What's actually fixed (don't touch):** `open_position()` and `place_pending_order()` — the two direct "place a new order" entry points — both genuinely check `pause_trading` as their first substantive check now, confirmed by reading both functions in full. The REST route layer (`class-rest-api.php:856`) still independently checks it too, so market orders genuinely have 2 real layers.

**What's still broken:** Pending orders (buy/sell limit, buy/sell stop) don't open as live positions through `place_pending_order()` — they're queued (`status='pending'`), then triggered later by `process_pending_orders()`, which runs on every price tick via the `fxsim_price_update` action hook (`propfirm-system.php:197`), completely independent of any REST call or the pause flag. `process_pending_orders()` calls `fill_pending_order()`, which directly inserts a new row into `fxsim_positions` — a genuine new live position. **Neither function checks `pause_trading` anywhere.** Read both in full — `process_pending_orders()` only checks order expiry and the news-trading lock; `fill_pending_order()` only re-checks account status and symbol validity.

Net effect: an admin who activates Emergency Pause Trading mid-incident, expecting it to stop all new positions from opening, will still see live positions open from orders that were already queued before the pause — the "firm-wide" halt isn't actually firm-wide.

**Fix:** Add the same `pause_trading` check (`FXSIM_Challenge_DB::get_setting('pause_trading', '') === '1'`) to the top of `process_pending_orders()`, before it processes any queued order on that tick. This is the one remaining path that creates live positions without going through `open_position()`/`place_pending_order()`, so it needs its own explicit guard — it can't inherit the fix from those two functions since it never calls them.

**Also worth fixing while you're in this function:** there's a redundant, dead `get_option('fxsim_pause_trading', '')` check duplicated in both `open_position()` and `place_pending_order()` that reads a wp_options key nothing ever writes (the real save path only calls `FXSIM_Challenge_DB::set_setting('pause_trading', ...)`). Harmless but misleading — remove it or leave a comment noting it's intentionally inert, your call.

---

## Deployment & verification rules (same as before)

- SSH-sync every backend fix to the live plugin paths and re-verify against the real production site.
- For item 2 specifically: verify with a real test — place a pending order, activate pause_trading, manually trigger a price tick that would fill it (or wait for one), and confirm no new position opens. Confirming the code change alone isn't sufficient here since the whole point of the original bug was that this path runs on a hook, not a direct call you can unit-test by just reading the code.
- Scope discipline unchanged: only `launchapropfirm.com` and its subdomains.
- Report back per item: what you changed (file + line) and how you verified it.

Once both are closed, Phase 1 is genuinely done. Ready for Phase 2 after that.
