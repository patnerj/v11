# Task: Phase 3 — 8 real gaps out of 22 items, several are "fixed" in name only

Independently re-verified all 22 Phase 3 items. 17 are genuinely solid — no notes on: fee_disclosure, cancelled_banner, self_join_button, stadium_chat, rate_limit, leaderboard_stats, total_staked, ticket_categories, error_feedback, stale_status, note_race, screenshot_preserve, resend_verification, affiliate_downloads, certificate_plan_name, margin_threshold, ip_restriction_flag. Good work on those, especially the stadium chat, which is a genuinely real, persisted, cross-user feature now.

The miss rate on this round is higher than prior rounds — please slow down and re-test the ones below with the actual scenario in a browser/real request, not just a code read, before reporting them done again.

## 1. (Money-safety) Tournament duplicate-registration race — the atomic fix only covers half the problem

**File:** `class-rest-api.php`, `tournament_join()`

Your atomic balance-deduction UPDATE (`WHERE balance >= %f`) correctly prevents a concurrent join from driving a balance negative — verified, that part works. But it doesn't prevent the *other* race in the same function: the "already registered" check (`SELECT id FROM fxsim_tournament_participants WHERE tournament_id=%d AND user_id=%d`) runs, then separately, minutes of code later, the participant row gets inserted — with no DB constraint tying the two together. `fxsim_tournament_participants` has no `UNIQUE(tournament_id, user_id)`, only plain non-unique `KEY idx_tournament`/`idx_user`.

If a user has enough balance to cover the entry fee twice (the common case — most users aren't at the exact limit), two concurrent join requests for the *same* tournament both pass the "already registered" check, both pass the atomic balance deduction (each legitimately succeeds since balance still covers each individually), and both insert a participant row — the same user ends up registered twice, charged twice, with two separate tournament-isolated accounts.

**Fix:** Add a `UNIQUE KEY uniq_tournament_user (tournament_id, user_id)` to `fxsim_tournament_participants` (via the `fxsim_feature_level` ladder in `propfirm-system.php`, same pattern used for prior migrations — not the old `FXSIM_VERSION`-gated path). Then make the participant insert itself the atomic claim: attempt the insert, and if it fails on the unique constraint, treat that as "already registered" and refund the just-deducted fee (reuse the existing refund-on-failure block, just trigger it for a constraint violation too, not only a generic `$wpdb->insert()` failure).

## 2. `is_registered`/`is_joined` never actually reaches real users — the request that carries it strips auth

**File:** `propfirm-frontend-v10.7.1/src/lib/fxsim.ts` (`tournaments.get`, ~line 143)

The backend computation is correct. The bug is in how the frontend calls it: `tournaments.get` passes `{ public: true }`, and `rawFetch` only attaches the `Authorization`/`X-WP-Nonce` headers `if (!opts.public)`. WordPress's own `rest_cookie_check_errors` filter forces `get_current_user_id()` to 0 on any request that carries a valid login cookie but no `X-WP-Nonce` header — which is exactly this request's shape. So for a genuinely logged-in browser, `tournament_public_detail()` still sees `$uid = 0`, and `is_registered`/`is_joined` come back `false` even for someone who's actually registered. The exact bug this item was supposed to fix (button reappears after reload) is still live in practice.

**Fix:** Don't call this endpoint with `public: true` when a session exists — send the auth headers (bearer/nonce) on this request like any other authenticated call, while still allowing it to work logged-out (since anonymous users should still be able to view tournament details, just with `is_registered` always false for them). Verify by actually logging in as a real test user, joining a tournament, reloading the page, and confirming the button stays gone — not by reading the code in isolation.

## 3. 2FA "remember me" — frontend fixed, backend never reads it

**File:** `backend-email-update v10.7.1/protradefx-headless-bridge/protradefx-headless-bridge.php`, `verify_2fa()` (~line 425-467)

The frontend chain (`login/page.tsx` → `auth.ts` → `api.ts`) genuinely sends `remember` in the `/auth/2fa/verify` request body now — that part is real. But `verify_2fa()`'s registered route `args` schema only declares `uid`/`code`, and the handler body never calls `get_param('remember')` anywhere. Session establishment is hardcoded: `wp_set_auth_cookie($user->ID, true, is_ssl())` and `generate_auth_token(..., 30 * DAY_IN_SECONDS)` — always the "remembered" branch. Compare to the non-2FA `login()` in the same file, which correctly reads `$remember = (bool) $req->get_param('remember')` and branches on it. That logic was never copied into `verify_2fa()`.

**Fix:** Add `remember` to `verify_2fa()`'s route args schema, read it the same way `login()` does, and use it identically in `wp_set_auth_cookie()`/`set_session_flag_cookie()`/`generate_auth_token()`. Verify by actually unchecking "Keep me signed in", logging in through a 2FA-enabled account, and confirming the session is short-lived, not 30 days.

## 4. KYC document checkmarks — the fix is a no-op, and the field lookup is wrong anyway

**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/kyc/page.tsx`, `isDocUploaded()` (~line 447-489)

Current code ends with `return val ? true : true;` — that always returns `true` regardless of `val`, so this is functionally identical to the original bug (every document shows "Securely Encrypted" unconditionally). On top of that, even if the ternary were fixed, the lookup itself checks `kyc[`${k}_url`]`, `kyc[k]`, and `kyc.documents?.[k]` — none of which match the real API shape. The actual per-document status lives at `kyc.docs.id_doc` / `kyc.docs.selfie` / `kyc.docs.address_doc` (per the `KycInfo` type in `src/types/api.ts`).

**Fix:** Rewrite `isDocUploaded()` to read from `kyc.docs.{id_doc,selfie,address_doc}` (map whatever key `k` is used in this component to the matching `docs.*` field), and return that real boolean — not a hardcoded true. Verify by checking a KYC submission with a genuinely missing/rejected document and confirming that specific checkmark differs from the others.

## 5. Notifications pagination — real on the backend, invisible on the frontend

**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/notifications/page.tsx`, `src/components/layout/topbar.tsx`

The backend fix (`page`/`per_page`/`total`/`has_more` in the response) is genuinely correct. But both frontend call sites (`api.notifications()`) call it with zero arguments, defaulting to page 1 forever — no "Load more" button, no infinite scroll, nothing reads `has_more`/`total` from the response. A trader with more than 30 notifications still can't see or acknowledge notifications 31+, which is the exact original bug.

**Fix:** Add a "Load more" control (or infinite scroll) to the notifications page that increments `page` and appends results, using the `has_more` flag to know when to stop. The topbar dropdown can stay capped at the first page (that's reasonable for a small preview widget) but the full notifications page needs real access to the rest.

## 6. KYC webhook doc_type/country — fixed code, but no caller ever sends the data

**File:** `class-rest-api.php` (`kyc_submit()`), `propfirm-frontend-v10.7.1/src/app/dashboard/kyc/page.tsx`

The undefined-variable bug is genuinely fixed — `$r->get_param('doc_type')`/`$r->get_param('country')` is a legitimate, safe extraction now. But the KYC submit form (`kyc/page.tsx`) never appends `doc_type` or `country` to the upload — only `id_doc`/`id_doc_back`/`selfie`/`address_doc`. So in every real submission, both params come back empty and fall through to the same generic defaults ("Government ID (Front & Back)" / "Global") the old broken code effectively produced. The webhook still doesn't report real doc-type/country data — low priority (backend-only, doesn't affect the trader), but worth actually closing since you already touched this function.

**Fix:** Either have the frontend send real `doc_type`/`country` values (if this data is meaningfully collectable — e.g. country from the user's profile/address, doc_type from which upload slot was filled), or if there's no real source for this data right now, don't claim it's fixed — note it as "the crash is fixed, the data is still generic" instead.

## 7. Spectator count — one fake number replaced with a different fake number

**File:** `propfirm-frontend-v10.7.1/src/app/arena/[id]/page.tsx` (~line 127)

The literal `"42"` is gone, replaced with `Math.max(3, creator_trades_count + challenger_trades_count + 1 + (matchId % 7))` — this isn't a real spectator count, it's a deterministic formula with no relationship to actual viewers (no presence tracking, no WebSocket connection count, nothing). It's arguably better than a single hardcoded literal since it at least varies per match, but it's still fabricated and static per match (never fluctuates on its own).

**Fix (low priority, cosmetic):** Either implement genuine lightweight presence tracking (e.g. a Redis/transient-backed counter incremented on page view, decremented on unload/timeout) if this feature matters to the product, or just remove the "spectator count" claim entirely rather than displaying a fabricated number dressed up as real data.

## 8. Settings page — completely untouched, not partially done

**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/settings/page.tsx`

Confirmed via full file read: nothing changed. The Password section is still just a button that emails a reset link — no in-page old-password/new-password form. Zero preference controls exist anywhere, despite the page header still carrying a `badge={{ label: 'Preferences' }}`. This wasn't in your Phase 3 summary at all, and the code confirms why — it was skipped entirely, not partially addressed.

**Fix:** Add a real in-page password-change form (current password + new password + confirm, wired to a real change-password API call — check if one exists already for admin/other flows to reuse the pattern), and either build real preference controls or remove the "Preferences" badge if there's nothing to back it.

---

Same rules as always: SSH-sync, verify live with the actual scenario (log in as a real test user and click through it, or fire a genuinely concurrent request for the race conditions) — not just a code read. Given how many of this round's claims didn't hold up under a second read, please re-check your own work against the real running site before reporting back this time.
