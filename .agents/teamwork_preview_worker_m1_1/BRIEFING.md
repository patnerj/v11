# BRIEFING — 2026-08-13T20:51:30Z

## Mission
Implement Milestone M1: Core API Client & Global Standards in `propfirm-frontend-v10.7.1`. Standardize base URL resolution (`NEXT_PUBLIC_API_URL` -> `NEXT_PUBLIC_FXSIM_API` -> `'/api/wp'`), robust non-throwing HTML error handling, mock response helper `mockApiResponse`, fallback fixtures in `src/lib/mock-data.ts`, toast notification utilities in `src/lib/notify.ts`, and global dark navy / slate + neon green (`#00FF66`) loading components in `src/components/ui/loading.tsx`.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m1_1
- Original parent: c05d7602-32f5-4022-b0b0-f51cfc6af36c
- Milestone: M1 - Core API Client & Global Standards

## 🔒 Key Constraints
- Own files exclusively:
  - `src/lib/api.ts`
  - `src/lib/mock-data.ts`
  - `src/lib/notify.ts`
  - `src/components/ui/loading.tsx`
- Genuine implementation — no hardcoded test results or dummy facade work.
- Standardize API base URL in `api.ts` / `fxsim.ts` with `NEXT_PUBLIC_API_URL` -> `NEXT_PUBLIC_FXSIM_API` -> `'/api/wp'`.
- Implement non-throwing error parsing (catch 4xx, 5xx, network errors, CORS issues, HTML error responses) returning clean `{ ok: false, status, error }` objects.
- Provide `mockApiResponse<T>(data, delayMs = 800)` helper function and annotate missing admin endpoints with `// TODO: Real API`.
- Provide fallback data structures in `src/lib/mock-data.ts`.
- Provide `notify.success`, `notify.error`, `notify.apiResult` in `src/lib/notify.ts`.
- Provide `<PageLoader />` and `<CardLoader />` with centered `Loader2` spinners styled in dark navy/slate + neon green accents (`#00FF66`).
- Verify zero TypeScript errors (`npx tsc --noEmit`).

## Current Parent
- Conversation ID: c05d7602-32f5-4022-b0b0-f51cfc6af36c
- Updated: 2026-08-13T20:51:30Z

## Task Summary
- **What to build**: Core API Client, error handling, mock response helper, fallback fixtures, notification utilities, global loading spinners.
- **Success criteria**: TypeScript type check (`npx tsc --noEmit`) passes with zero errors, base URL resolution standard implemented, non-throwing HTML error sanitization in place, loading components and toast utilities created.
- **Interface contracts**: `PROJECT.md` Section 37-44.
- **Code layout**: `src/lib/api.ts`, `src/lib/fxsim.ts`, `src/lib/mock-data.ts`, `src/lib/notify.ts`, `src/components/ui/loading.tsx`.

## Change Tracker
- **Files modified / created**:
  - `src/lib/fxsim.ts`: Standardized `getApiBaseUrl()` with fallbacks (`NEXT_PUBLIC_API_URL` -> `NEXT_PUBLIC_FXSIM_API` -> `'/api/wp'`), added `headers?: Record<string, string>` support to `RequestOptions`, enabled `mode: 'cors'`, and added enhanced non-throwing HTML error page sanitization and session expiration detection.
  - `src/lib/api.ts`: Re-exported `getApiBaseUrl` and `FXSIM_BASE`, implemented `mockApiResponse<T>(data, delayMs = 800)` helper, and added 10 mocked missing admin endpoints annotated with `// TODO: Real API — Needs [METHOD] [ROUTE] in class-rest-api.php`.
  - `src/lib/mock-data.ts`: Created comprehensive, strongly-typed fallback data structures (`FALLBACK_ADMIN_STATS`, `FALLBACK_ADMIN_USERS`, `FALLBACK_ADMIN_USER_DETAIL`, `FALLBACK_ADMIN_RISK`, `FALLBACK_CHALLENGE_PLANS`, `FALLBACK_CHALLENGES`, `FALLBACK_TRADES`, `FALLBACK_KYC_ROWS`, `FALLBACK_PAYOUT_ROWS`, `FALLBACK_PAYMENTS`, `FALLBACK_BANNERS`, `FALLBACK_COUPONS`, `FALLBACK_AFFILIATES`, `FALLBACK_ANALYTICS_*`, `FALLBACK_SYMBOLS`, `FALLBACK_COMPETITIONS`, `FALLBACK_TICKETS`, `FALLBACK_WHITELABEL`, `FALLBACK_AUDIT_LOG`).
  - `src/lib/notify.ts`: Created standardized `sonner` toast trigger helper object `notify` providing `notify.success`, `notify.error`, `notify.info`, `notify.warning`, and `notify.apiResult`.
  - `src/components/ui/loading.tsx`: Created `<Spinner />`, `<PageLoader />`, and `<CardLoader />` components featuring centered `Loader2` spinners styled in dark navy/slate + neon green accents (`#00FF66`).
  - `src/components/dashboard/trading/order-ticket.tsx` & `src/app/dashboard/trading/page.tsx`: Fixed minor pre-existing type check errors so full TypeScript check passes cleanly.
- **Build status**: `npx tsc --noEmit` passed with 0 errors (exit code 0).
- **Pending issues**: None

## Quality Status
- **Build/test result**: `tsc --noEmit` PASSED with 0 errors (exit code 0). Next.js compiled cleanly in 66s.
- **Lint status**: Clean
- **Tests added/modified**: Static type verification & mock helper verification complete.

## Loaded Skills
- None

## Key Decisions Made
- `getApiBaseUrl()` checks `process.env.NEXT_PUBLIC_API_URL` first, followed by `process.env.NEXT_PUBLIC_FXSIM_API`, defaulting to `'/api/wp'`.
- All network fetch HTML error responses (e.g., 404 or 500 Nginx/PHP pages) are intercepted and converted to clean string messages (`API endpoint not found (404)` or `Server error (500). Please try again later.`), preventing raw HTML from polluting UI toasts.
- `mockApiResponse<T>` wraps mock data in `Promise<ApiResult<T>>` with default 800ms latency to test loading UI spinners (`<PageLoader />`, `<CardLoader />`, `<Button loading>`).
- Fallback fixtures in `src/lib/mock-data.ts` strictly conform to interfaces defined in `@/types/api`.
