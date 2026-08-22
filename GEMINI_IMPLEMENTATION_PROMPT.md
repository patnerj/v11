# Prop Firm Platform — Remaining Fix Implementation (for Gemini / Antigravity)

## Context

You are working in `D:\Full Propfirm System for antigravity\` — a WordPress plugin backend (`backend-email-update v10.7.1\propfirm-system\`) plus a Next.js frontend (`propfirm-frontend-v10.7.1\`). A prior audit session (Claude) already read the entire codebase across 18 dimensions, fixed 20 CRITICAL/HIGH bugs directly, and left a full report at:

`D:\Full Propfirm System for antigravity\MASTER_AUDIT_IMPLEMENTATION_REPORT.md`

**Read that report in full before doing anything else.** It contains:
- **Part A.1** — 20 bugs already fixed this session (root cause + exact fix applied for each — do NOT redo these, verify they're still in place)
- **Part A.2** — 2 items intentionally left for product/business judgment (read these and make a call, or ask the human operator)
- **Part A.3 / A.4** — ~85 further confirmed or plausible findings, organized by dimension, each with file:line, root cause, and a specific proposed fix
- **Part B** — prioritized architectural improvements
- **Part C** — a phased, dependency-ordered implementation plan (Phase 1 through Phase 8)

**Critical limitation the prior session had, which you may not have:** no PHP CLI, MySQL, or WordPress runtime was available, so every fix in Part A.1 was verified by careful code reading only, never by actual execution. **Your first job, if you have real infrastructure access, is to stand up (or connect to) a staging WordPress + MySQL environment and confirm the 20 already-applied fixes actually work as intended** — don't assume they're correct just because they're documented as "fixed."

## Your task

1. **Verify environment access.** Confirm you can run PHP, connect to the MySQL database this plugin uses, and ideally spin up a local WordPress instance (or use whatever staging environment already exists for this project — check for one before creating a new one).

2. **Regression-test the 20 existing fixes** (Part A.1, FIXED-01 through FIXED-20). For each: locate the code, confirm it matches what the report says was applied, and if a test harness exists, run it. A PHPUnit/`WP_UnitTestCase` scaffold pattern already exists in the sibling codebase at `D:\Spark Propfirm\backend-email-update v10.7.1\propfirm-system\tests\` — port that scaffold into this codebase's `tests\` directory if one doesn't already exist here, and write a regression test per fix as you verify it.

3. **Implement Part C's Phase 1 through Phase 8, in order.** Each phase has specific numbered items with exact file/function references. Follow the report's own ground rules:
   - Follow this codebase's existing conventions: `GET_LOCK`/atomic-claim for concurrency, `$wpdb->prepare()` for every query, `FXSIM_Database::log_admin()` for admin mutations, the deferred-email pattern (`wp_schedule_single_event`) for anything in a hot request path.
   - One fix per commit, message format `fix(area): <short description>`.
   - Write or extend a regression test for every fix before moving to the next item.
   - Do NOT skip Phase 2 (PvP engine) even though it's effort-heavy — it currently has zero real money movement (no escrow, no real payout) while the UI claims otherwise; treat this as a money-safety/trust issue, not a nice-to-have.
   - Phase 1 items 6b and 6c are already done (marked with strikethrough in the report) — skip them, but verify they're actually in place as part of step 2 above.

4. **For Part A.2's two ambiguous items** (the two payout-approval endpoints; Confirmo `'paid'` vs `'confirmed'` activation trigger): these need a human product decision or external API docs you may have access to that the prior session didn't. Investigate and propose a resolution, but flag it clearly rather than silently picking one if genuine ambiguity remains.

5. **As you go, keep a running log** of: what you verified as correct, what you found was actually broken/different from the report's description (code drifts fast — line numbers in the report may already be stale), what you fixed, and what test confirms each fix. This matters because the report itself flags that some Round 2 findings never got adversarially re-verified (hit a rate limit) — if you find one of those was actually wrong (a false positive), say so explicitly rather than fixing something that isn't broken.

6. **Do not touch anything outside the scope of a specific documented finding.** No refactors, no "while I'm here" cleanups, no new features. This is a bug-fix and hardening pass, not a redesign — except where the report explicitly calls out an architectural decision (e.g., the duplicate `/app/admin/*` vs `/app/dashboard/admin/*` panel, which the report recommends resolving before further admin-panel work).

## Deliverable

When done (or when you've made as much progress as time/scope allows), produce a short status report back:
- Which Phase 1-8 items are done, with commit references
- Which items you found were already fine (false positives / already fixed elsewhere)
- Which items are still open and why (blocked on a product decision, needs more investigation, out of scope for this pass)
- Results of any regression test suite run
- Any NEW issues you discovered while implementing that weren't in the original report

Keep this status report itself concise (it will be read by a human, not another AI) — a punch list, not a narrative.
