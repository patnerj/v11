# Task: close remaining Phase 2 cleanup items (low severity, but real)

## Context

Phase 2's 5 gap-fixes were independently re-verified. 4 of 5 are genuinely solid with no notes (Page Builder SSR, Freeze Trading/News-Lock hydration, Pause Registrations enforcement — plus the pagination fix works correctly). This round is smaller, lower-severity cleanup — no money/security risk, but real inconsistencies worth closing before calling the platform done.

---

## 1. Tournaments/Competitions "reconciliation" was incomplete — a second live UI still exists

**The gap:** The route-level aliasing (`/competitions/*` → the same tournament handlers) is genuinely correct — confirmed no data-divergence risk there. But:

1. **A second, fully live "Competitions" UI still exists and is nav-linked**, unrelated to the two files that were actually fixed:
   - `propfirm-frontend-v10.7.1/src/components/layout/sidebar.tsx` (~line 33) — a real sidebar entry `{ href: '/dashboard/competitions', label: 'Competitions', icon: Swords, badge: 'WIN' }`
   - `src/app/dashboard/competitions/page.tsx` and `src/app/dashboard/competitions/[id]/page.tsx` — call `api.competitions.list()`/`.register()`/`.getById()`/`.leaderboard()` with their own separate "Register" button.
   - This still *works* (because of the backend aliasing), but traders now see two differently-branded flows for the same underlying tournament system. Pick one: either remove this page tree and nav entry, or make it the canonical one and remove `/tournaments/*` instead — don't leave both live.

2. **A third, orphaned admin tournament page tree is broken outright:**
   - `src/app/dashboard/admin/tournaments/page.tsx` and `.../[id]/page.tsx` — not linked from any nav, but still in the repo, calling `api.admin.competitions.get(id)` (GET `/admin/competitions/{id}`) and `api.admin.competitions.update(id, data)` (PUT `/admin/competitions/{id}`) — **neither route was ever registered, not even as an alias.** If anyone ever re-links this page it 404s immediately.
   - Delete this page tree, or if there's a reason to keep it, register the missing routes it depends on.

3. **7 old competition-specific backend handlers are dead code:** `admin_get_competitions`, `admin_create_competition`, `get_competitions`, `join_competition`, `admin_update_competition`, `admin_delete_competition`, `competition_leaderboard` in `class-rest-api.php` (~line 8042-8241) are no longer referenced by any registered route. Remove them, or if step 1 above ends up keeping the Competitions branding as canonical, re-point the aliasing the other direction instead.

4. **No migration path for old data:** `fxsim_competitions`/`fxsim_competition_participants` tables still exist via `dbDelta` in `class-database.php` but nothing can read or write them anymore except the now-dead handlers above. If either table has real rows on the live site, write a one-time migration into `fxsim_tournaments`/`fxsim_tournament_participants` before removing the dead handlers — check the live DB first (`SELECT COUNT(*) FROM wp_fxsim_competitions`, `wp_fxsim_competition_participants`) to know whether this is actually needed or the tables are empty.

**Fix:** Decide which branding/UI is canonical (Tournaments or Competitions), remove the other page tree and its nav entry, delete the orphaned broken admin page tree (or register its missing routes), remove the now-genuinely-dead backend handlers, and migrate any real data found in step 4 first.

## 2. Removing the old `LIMIT 200` cap introduced an unbounded-fetch regression

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `admin_challenges()`

**The gap:** The Traders page fix (calling with `user_ids` and no `limit`) is correct. But removing the old unconditional `LIMIT 200` without adding a default cap for callers that omit `limit` altogether means these existing, unrelated callers now fetch the **entire** `fxsim_challenge_accounts` table (joined with users/plans) on every request:
- `src/app/dashboard/admin/page.tsx`'s `RecentChallenges` widget — polls every 15s, only ever displays 5 rows (`.slice(0, 5)`)
- `src/app/dashboard/admin/challenges/page.tsx` — polls every 10s

**Fix:** Add a default `limit` (e.g. 200, matching the old behavior) that applies only when BOTH `user_ids` and `limit` are omitted — so the traders-page scoped-by-user_ids call stays uncapped (correct, that's the actual fix), but these two polling widgets get a sane bound again instead of pulling the whole table every 10-15 seconds.

## 3. Cross-page emergency-freeze switch drift (lower priority, note for awareness)

**Files:** `propfirm-frontend-v10.7.1/src/app/admin/page.tsx` (`handleToggleEmergencyPause`, ~line 515), `src/app/dashboard/admin/operations/page.tsx` (`EmergencyControls`/`SWITCHES`, ~line 118-150)

**The gap:** `admin/operations/page.tsx`'s Freeze Trading switch (fixed in the last round) now correctly reflects `pause_trading OR news_lock`. But these two OTHER pages each have their own independent freeze-trading control that only reads/writes `pause_trading` and never touches `news_lock` — and the Command Center one (`admin/page.tsx`) has no backend hydration at all, so it always renders as "off" on page load regardless of real state. If an admin sets `news_lock` via the fixed Operations page, then later toggles "off" via either of these other two, the flags can end up out of sync — the fixed page will correctly still show frozen, the other two will incorrectly show unfrozen.

**Fix (optional, lower priority than 1 and 2):** Either give both of these pages the same `pause_trading OR news_lock` hydration+display logic already implemented correctly in `operations/page.tsx`, or better, consolidate to a single shared component/hook for this control so there's only one implementation to keep correct.

---

## Verification

- For item 1: check the live DB for real rows in the competitions tables before deciding whether a migration is actually needed.
- For item 2: confirm the two polling widgets get bounded results again without breaking the traders-page scoped call (test both paths).
- Same deployment rules as before — SSH-sync backend changes, re-verify live, stay scoped to launchapropfirm.com only.
