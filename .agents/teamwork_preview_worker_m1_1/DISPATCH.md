## 2026-08-13T20:37:40Z

Task: Implement Milestone M1: Core API Client & Global Standards

Required reading:
- Original User Request: d:\Full Propfirm System for antigravity\.agents\ORIGINAL_REQUEST.md
- Scope Document: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_orchestrator_3\PROJECT.md
- Explorer Reports:
  - d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1\handoff.md
  - d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_2\handoff.md
  - d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_3\handoff.md

Write Ownership:
Exclusive file ownership for this task:
- `src/lib/api.ts`
- `src/lib/mock-data.ts`
- `src/lib/notify.ts`
- `src/components/ui/loading.tsx`
in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1` (or `D:\Spark Propfirm\propfirm-frontend-v10.7.1`).

Implementation Objectives:
1. Refactor `src/lib/api.ts` to standardize base URL resolution:
   - Primary: `process.env.NEXT_PUBLIC_API_URL`
   - Fallbacks: `process.env.NEXT_PUBLIC_FXSIM_API` -> `'/api/wp'`
2. Implement robust non-throwing error handling in `api.ts` (catch 4xx, 5xx, network errors, CORS issues) so that API calls return clean `{ success: false, error: '...' }` objects instead of throwing unhandled exceptions.
3. Implement `mockApiResponse<T>(data: T, delayMs: number = 800)` helper function in `src/lib/api.ts` using `Promise.resolve` and `setTimeout`. Mark all mock functions/endpoints with `// TODO: Real API`.
4. Create fallback data structures in `src/lib/mock-data.ts` for offline/missing endpoints.
5. Create `src/lib/notify.ts` for standardized `sonner` toast triggers (`notify.success`, `notify.error`, `notify.apiResult`).
6. Create `src/components/ui/loading.tsx` providing `<PageLoader />` and `<CardLoader />` with centered `Loader2 className="animate-spin"` spinners styled in dark navy/slate + neon green accents (`#00FF66`).
7. Run build and tests (`npm run build` or `npx tsc --noEmit`) to verify zero TypeScript errors.

Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Record results and build verification in `handoff.md` in `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m1_1`.
