# Handoff Report — Milestone M2: Overview & System KPIs Module Review

**Author**: `teamwork_preview_reviewer_m2_1` (Reviewer & Critic)  
**Date**: 2026-08-13  
**Working Directory**: `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_reviewer_m2_1`  
**Target Project**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Observation

### Verification Executed
- **TypeScript Static Analysis**: Command `npx tsc --noEmit` executed in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`. Exit code: `0`, `0` errors.
- **Code Inspection**:
  - `src/types/api.ts` (lines 576-585, 753-771): Defines `HealthReport` (with optional `status`, `uptime`, `latencyMs`), `AdminRiskAlerts`, `RiskAlertUser`, `RiskExposureItem`.
  - `src/lib/api.ts` (lines 204-267): Implements `admin.riskAlerts()` and `admin.riskExposure()` using `mockApiResponse` with `// TODO: Real API — Needs GET /fxsim/v1/admin/risk/...` comments and 800ms delay. Implements `admin.health(refresh)` attempting `/admin/health` first and falling back to `mockApiResponse`.
  - `src/app/dashboard/admin/page.tsx` (725 lines):
    - Contains 10 KPI tiles: Total Revenue, Total Traders, Active Challenges, Funded Accounts, Total Payouts, Win Rate, Open Positions, Total Trades, Realised P&L, Pending Payments.
    - Contains dynamic System Health badge in header bar bound to `api.admin.health(false)`.
    - Contains **Refresh Data** button with loading spinner, `sonner` toast, and `queryClient.invalidateQueries({ queryKey: ['admin'] })`.
    - Contains Recharts trend charts with `#00FF66` neon green accents.

### Defect Observations
1. **Query Key Invalidation Mismatch (`src/app/dashboard/admin/page.tsx:82`)**:
   - `handleRefresh` executes `await queryClient.invalidateQueries({ queryKey: ['admin'] })`.
   - The query keys used throughout `page.tsx` are single-string array elements: `['admin.stats']` (line 28), `['admin.analyticsRevenue']` (line 39), `['admin.risk']` (line 50), `['admin.analyticsChallenges']` (line 60), `['admin.health']` (line 70), `['admin.payments']` (line 335), `['admin.challenges.recent']` (line 373), `['admin.whitelabel']` (line 448), `['admin.riskAlerts']` (line 574), `['admin.riskExposure']` (line 656).
   - In TanStack Query (React Query), `invalidateQueries({ queryKey: ['admin'] })` performs element-by-element equality checks starting at index 0. Because index 0 is `'admin.stats'` (not `'admin'`), **0 queries are matched or invalidated**. The toast notifies "Dashboard data refreshed", but no network refetch actually occurs.

2. **Hardcoded Fallback Metrics Displayed on API Failure/Null (`src/app/dashboard/admin/page.tsx:92, 116, 237`)**:
   - Line 92: `let winRateVal = '64.2%'` (hardcoded fallback when `challengeAnalyticsRes` is null).
   - Line 116 & 237: `riskRes ? fmtUSD(riskRes.approved_payout_value) : '$128,450'` (hardcoded fallback `$128,450` when `riskRes` is null).
   - Displaying static dummy numbers (`$128,450` payouts and `64.2%` win rate) when backend API data is unavailable misleads operators with fake data instead of displaying clean empty/loading indicators (e.g. `'—'`), which `Total revenue` correctly does (`revenue === null ? '—' : fmtUSD(revenue)`).

---

## 2. Logic Chain

1. **Static Analysis Verification**: Running `npx tsc --noEmit` verified that all imports, type definitions, and component property access compile cleanly with exit code 0.
2. **Adversarial Query Analysis**:
   - TanStack Query's matching logic for `{ queryKey: ['admin'] }` evaluates `key[0] === 'admin'`.
   - Since the keys are structured as `['admin.stats']` instead of tuple format `['admin', 'stats']`, index 0 is `'admin.stats'`.
   - Since `'admin.stats' !== 'admin'`, TanStack Query skips every dashboard query during invalidation.
   - Consequently, clicking **Refresh Data** gives false operator feedback (toast fires, spinner stops) without invalidating cached data.
3. **Data Integrity Analysis**:
   - `Total revenue` properly handles missing backend data via `revenue === null ? '—' : fmtUSD(revenue)`.
   - `Total payouts` and `Win rate` hardcode static dummy values (`$128,450` and `64.2%`).
   - If an API error occurs or the backend returns empty results, the UI presents hardcoded fake metrics rather than clean missing data indicators (`'—'`).

---

## 3. Caveats

- Backend endpoints `/fxsim/v1/admin/risk/alerts` and `/fxsim/v1/admin/risk/exposure` are correctly mocked in `src/lib/api.ts` with `// TODO: Real API` comments as requested in project specifications.
- `npx tsc --noEmit` passes without errors.

---

## 4. Conclusion

The M2 Overview & System KPIs implementation is well-structured and passes TypeScript compilation. However, **REQUEST_CHANGES** is issued due to two major findings:
1. **Query Invalidation Bug**: The Refresh Data button does not invalidate any dashboard queries due to a query key matching mismatch (`['admin']` vs `['admin.stats']`).
2. **Hardcoded Fallback Metrics**: Total Payouts (`$128,450`) and Win Rate (`64.2%`) display hardcoded dummy numbers when API queries return `null`.

### Required Actions for Worker
1. **Fix Query Invalidation in `src/app/dashboard/admin/page.tsx`**:
   Update `handleRefresh` to use a predicate or change query keys to array tuple format:
   ```ts
   await queryClient.invalidateQueries({
     predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('admin')
   })
   ```
2. **Fix Fallback Metrics in `src/app/dashboard/admin/page.tsx`**:
   Replace static fallback values (`'$128,450'` and `'64.2%'`) with clean `'—'` indicators when API queries return `null` or `undefined`.

---

## 5. Verification Method

To verify the requested changes after worker updates:
1. Run `npx tsc --noEmit` in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`.
2. Inspect `src/app/dashboard/admin/page.tsx` to confirm `handleRefresh` correctly invalidates all `admin.*` query keys.
3. Confirm `winRateVal` and `riskRes.approved_payout_value` default to `'—'` when queries return `null`.
