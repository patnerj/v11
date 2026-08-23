# Task: Phase 3 — smaller correctness/UX bugs (22 items)

Phase 0, 1, and 2 are done and independently verified clean. Start Phase 3 now, using the full item list already written out in `GEMINI_TRADER_PANEL_AUDIT_FIX_PLAN.md` under the "PHASE 3 — Smaller correctness/UX bugs" heading — every item there already has the exact file, line, bug description, and fix. Work through all 22.

Two notes before you start:

**One of these isn't actually "smaller" — treat it with Phase-0/1 rigor:** "Tournament: balance-sufficiency check has a race condition" (`class-rest-api.php` ~line 8766, non-atomic check-then-deduct). This is a real money-safety bug, not cosmetic — it's filed under Phase 3 only because it was found late, not because it's low-stakes. Fix it the same way every other race in this codebase has been correctly fixed: a single atomic conditional `UPDATE ... WHERE balance >= %f` checked for `rows_affected`, not a SELECT-then-UPDATE. Verify by actually attempting the race (two concurrent joins against a balance that can only cover one), not just reading the code.

**Dead-file cleanup item is partially done already:** `terminal-desktop-layout.tsx` and `terminal-mobile-layout.tsx` were already deleted during the Phase 2 gaps round. Only `src/components/dashboard/trading/trading-lock-state.tsx` remains — confirmed still present and confirmed genuinely unreferenced anywhere in `src/`. Delete it.

For the rest — support ticket categories/feedback/stale-status, tournament persistence/fee-disclosure/cancelled-state, PvP self-join/chat/rate-limit/leaderboard-stats/spectator-count, KYC checkmarks/webhook fields, notifications pagination, 2FA remember-me, resend-verification error handling, affiliate download buttons, settings page, certificate plan name, and the two cosmetic hardcoded indicators (margin-color threshold, IP-restriction flag) — follow the plan document's fix guidance as written.

Same rules as every round: SSH-sync, verify live (reproduce the actual scenario, not just "the code compiles"), stay scoped to `launchapropfirm.com` only, leave `walletrecovery.click`/`atlanticworldwide.io` untouched. Given the batch size, feel free to report back in a couple of natural sub-batches if that's cleaner than one giant report — just don't skip verification on any individual item to get through the list faster.
