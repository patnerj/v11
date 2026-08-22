# BRIEFING — 2026-08-13T15:37:00Z

## Mission
Investigate `src/lib/api.ts` and `src/lib/fxsim.ts` for Milestone M1 (Core API Client & Global Standards). Formulate concrete proposals for API base URL standardization, header/auth hygiene, non-throwing error handling, mock latency helper, and global UI standards.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigation, codebase analysis, evidence chain generation, synthesis & handoff
- Working directory: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1
- Original parent: c05d7602-32f5-4022-b0b0-f51cfc6af36c
- Milestone: M1 — Core API Client & Global Standards

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code changes directly in source directory
- Standardize API base URL fallback order (`NEXT_PUBLIC_API_URL` -> `NEXT_PUBLIC_FXSIM_API` -> `/api/wp`)
- Ensure header initialization supports auth, JSON, and CORS without breaking cookie auth
- Detail clean error catching for 4xx, 5xx, CORS, network errors to prevent UI crashes
- Deliver detailed handoff.md in working directory
- Notify parent agent with summary and handoff path

## Current Parent
- Conversation ID: c05d7602-32f5-4022-b0b0-f51cfc6af36c
- Updated: 2026-08-13T15:37:00Z

## Investigation State
- **Explored paths**: `src/lib/api.ts`, `src/lib/fxsim.ts`, `src/types/api.ts`, `src/hooks/useApi.ts`
- **Key findings**:
  1. Base URL Resolution: `FXSIM_BASE` currently relies solely on `process.env.NEXT_PUBLIC_FXSIM_API`. Need to update to prioritize `NEXT_PUBLIC_API_URL`, fallback to `NEXT_PUBLIC_FXSIM_API`, and default to `/api/wp`.
  2. Request Options & Headers: `fxsim.ts` handles JSON headers, FormData omission, `X-WP-Nonce`, `Authorization` (Bearer), and `credentials: 'include'`. Missing support for custom caller-defined headers in `RequestOptions`.
  3. Error Prevention: `fxsim.ts` normalizes all network, HTTP (4xx/5xx), timeout, and auth errors into `ApiResult<T>` (`ApiOk<T>` or `ApiErr`).
  4. HTML Error Sanitization: Server 500/404 HTML responses should be parsed into concise error strings rather than raw HTML blocks.
  5. Mocking Pattern: Needs a standardized helper (`mockApiResult<T>`) using `Promise.resolve` + `setTimeout(..., 800)` for unbuilt/incomplete backend endpoints marked with `// TODO: Real API`.
  6. Toast & Loading Standards: Need global conventions using `sonner` (`toast.success`/`toast.error`) and `Loader2`/`Skeleton` spinners.
- **Unexplored areas**: None, full API client & transport layer examined.

## Key Decisions Made
- Prepared recommendations for refactoring `src/lib/fxsim.ts` and `src/lib/api.ts` to implement M1 standards.
- Documented findings in `handoff.md`.

## Artifact Index
- d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1\DISPATCH.md — Task instructions
- d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1\BRIEFING.md — Working memory
- d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1\progress.md — Progress heartbeat
- d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1\handoff.md — 5-component handoff report
