# Task: close 5 remaining gaps from Phase 2

## Context

Phase 2 was independently verified the same way as Phase 0/1 — a fresh adversarial read of the actual code, not a review of the completion report. 3 of 8 items are genuinely solid: **2.3 Tournament Prize Breakdown, 2.6 Override Pre-fill, 2.8 Affiliate Config Hydration.** Don't touch these.

5 items have real, specific gaps. One of them (2.2) is still **completely non-functional** — the backend is correct but zero UI reaches it, which is worth knowing before reporting this phase as done in the future: "backend route exists and works in isolation" is not the same as "the feature works," and this pattern (real backend, dead/misrouted frontend) has now shown up multiple times across this audit — it's worth specifically re-checking for on every future item, not just trusting that a backend route existing means the feature is reachable.

---

## 1. Homepage Page Builder — publish still never reaches real visitors

**File:** `propfirm-frontend-v10.7.1/src/app/page.tsx`, ~line 25-35 (`getPageSchema()`)

**The bug:** Everything else about this fix is genuinely correct (routes exist, shapes match, XSS sink removed). But `page.tsx` resolves its API base URL directly from `process.env.NEXT_PUBLIC_FXSIM_API` instead of the shared `getApiBaseUrl()` helper in `src/lib/fxsim.ts`. This repo's actual `.env.local` sets `NEXT_PUBLIC_FXSIM_API=/api/wp` — a relative path meant for the browser-side same-origin proxy. `page.tsx` is a Server Component; its `fetch` runs in Node, not the browser. Node's `fetch` cannot resolve a relative URL with no base and throws — which the surrounding `try/catch` silently swallows, so `getPageSchema()` always falls back to the hardcoded `defaultData`. **Net effect: with this repo's actual current environment config, an admin can publish homepage edits successfully, and a real visitor will still never see them** — the exact bug this phase was supposed to close, still present via a different mechanism.

**Fix:** Use `getApiBaseUrl()` (or an equivalent that resolves a genuine absolute URL server-side, e.g. falling back to `NEXT_PUBLIC_FXSIM_API` only when it's already absolute, otherwise resolving against a known production origin) instead of reading the env var directly in a Server Component context. Verify by actually testing the SSR path — not just confirming the routes/shapes are correct in isolation, since that's what looked "fixed" last time too.

## 2. Tournament Enrollment — the entire feature is dead code, wired to something else entirely

**Files:** `propfirm-frontend-v10.7.1/src/app/tournaments/[id]/page.tsx`, `src/app/tournaments/page.tsx`

**The bug:** The backend (`tournament_join()`, the new `/tournaments/{id}/join` route, duplicate/capacity checks) is genuinely correct and complete in isolation. But **no UI anywhere calls it.** The actual trader-facing tournament pages are wired to a completely different, pre-existing "Competitions" feature — `api.competitions.register()`, `api.competitions.get()`, `api.competitions.list()`, `api.competitions.leaderboard()` — hitting `/competitions/{id}/join` and operating on entirely different tables (`fxsim_competitions`/`fxsim_competition_participants`, not `fxsim_tournaments`/`fxsim_tournament_participants`). `api.tournaments.join()` is defined in `src/lib/api.ts` (~line 144) but has zero call sites anywhere in the frontend.

**Fix:** This needs a real decision, not just a wiring fix — first determine whether "Tournaments" and "Competitions" are supposed to be the same feature (in which case reconcile which backend/tables are actually authoritative and delete the other), or genuinely two different features that both need their own working UI. Either way, the trader-facing `/tournaments` pages need to actually call the tournament endpoints (or the competitions ones need to be confirmed as the real intended path and the new tournament backend work should be understood in that context). Don't just point the button at the new endpoint without first understanding why two parallel systems exist — that's likely to just move the bug rather than fix it.

## 3. Traders list pagination — only half the data source was fixed

**File:** `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`, `admin_challenges()` (~line 3282-3290)

**The bug:** `admin_users()`'s pagination is genuinely correct and complete — real page/limit/offset, real COUNT for total, real pagination UI wired to it. But `admin_challenges()` — the other half of the data the Traders directory joins against — still has the original hard `LIMIT 200` with no pagination at all, and its method signature doesn't even accept a `WP_REST_Request`, so it structurally can't read page/limit params even if the frontend sent them. Since the Traders directory is built by joining paginated users with capped-at-200 challenges, any install with more than 200 challenge accounts can still silently show real traders as "no active challenge" once their challenge record falls outside that fixed window — the exact practical failure the original finding described, just for a higher and less obvious threshold now.

**Fix:** Apply the same pagination pattern already used in `admin_users()` to `admin_challenges()` — accept a `WP_REST_Request`, add real page/limit/offset and a COUNT-based total, and update the frontend's challenges query to paginate (or at minimum fetch enough pages to cover all challenges relevant to the currently-displayed user page) instead of a single uncapped-in-name-only call.

## 4. Freeze Trading switch — hydrates only half of what it saves

**File:** `propfirm-frontend-v10.7.1/src/app/admin/operations/page.tsx` (hydration effect, ~line 187-206), `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` (news-lock routes)

**The bug:** The Freeze Trading toggle's save action writes to **two** independent flags: `pause_trading` (via whitelabel save) and `fxsim_news_lock` (via a separate `POST /admin/news-lock`). Hydration on page load only reads `pause_trading` back — there is no `GET /admin/news-lock` route at all. If the two flags ever diverge (e.g. news-lock gets toggled by a different path, or a save partially fails), the switch will silently show a state that doesn't match what's actually enforced server-side for the news-lock half.

**Fix:** Add a `GET /admin/news-lock` route (or fold `fxsim_news_lock`'s value into the existing whitelabel GET response, matching the pattern already used for `pause_trading`), and hydrate the switch from both flags — or better, reconsider whether this single UI toggle should really be driving two independent backend flags at all, since that's the root cause of the asymmetry.

## 5. Pause Registrations switch — now correctly displays a value that does nothing

**File:** backend-wide — `propfirm-system.php` (`template_redirect` registration handler, ~line 464-518), `class-rest-api.php` (`admin_user_create`, `admin_team_invite`)

**The bug:** The switch's save/load round-trip through `pause_registrations` in the whitelabel settings is now genuinely correct — but this flag is **never checked anywhere in the actual registration flow.** `ops_paused()` (the gate function used for `pause_trading`/`pause_payouts`/`pause_purchases`) is never called with `'pause_registrations'`. The real public registration handler in `propfirm-system.php` calls `wp_create_user()` directly with no check of this flag at all. Toggling this switch fully ON has zero effect — new signups continue exactly as before. This is worse than before the hydration fix in one sense: the switch now looks more trustworthy (it faithfully reflects a real saved DB value) while still doing nothing.

**Fix:** Add the actual enforcement — check `pause_registrations` via `ops_paused()` (or equivalent) at the top of the real registration handler in `propfirm-system.php`, rejecting new signups with a clear message when it's on. Don't consider this item done until you've confirmed a real registration attempt is actually blocked while the switch is on.

---

## Deployment & verification rules (same as before)

- SSH-sync every backend fix to the live plugin paths and re-verify against the real production site.
- For item 1 specifically: verify the actual SSR fetch path succeeds against the real deployed environment variable value, not just that the routes/shapes match in isolation — that's exactly what looked fixed last time.
- For item 2: don't wire the button to the new endpoint without first resolving the Tournaments-vs-Competitions duplication — report back on what you find before implementing, since the right fix depends on which system is actually meant to be authoritative.
- Scope discipline unchanged: only `launchapropfirm.com` and its subdomains. Do not touch `walletrecovery.click` or `atlanticworldwide.io`.
- Report back per item: what you changed (file + line) and how you verified it — the specific failure mode described above, not just "it compiles" or "the route exists."
