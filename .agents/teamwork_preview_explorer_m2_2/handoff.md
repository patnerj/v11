# Handoff Report — Milestone M2 Overview & System KPIs API Integration Strategy

## 1. Observation

Direct investigation of the frontend and backend files revealed the following exact route mappings, method signatures, file locations, line numbers, and implementation gaps:

### A. Frontend Admin Overview File Structure
- **Page File**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\app\dashboard\admin\page.tsx` (546 lines)
- **API Client File**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\lib\api.ts` (343 lines)
- **API Types File**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\types\api.ts` (818 lines)
- **Format Helper File**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\lib\format.ts` (87 lines)

### B. Backend REST API Implementation
- **Backend File**: `d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system\includes\class-rest-api.php` (5339 lines)

### C. Route-by-Route Findings Matrix
1. `api.admin.stats()`
   - **Route**: `GET /fxsim/v1/admin/stats`
   - **Backend Callback**: `admin_stats()` at `class-rest-api.php:812`
   - **Returned Object**: `{ users: int, open_positions: int, total_trades: int, total_pnl: float, active_challenges: int, funded_accounts: int, pending_payments: int }`
   - **Status**: **Fully Available** in PHP backend.

2. `api.admin.analyticsRevenue()`
   - **Route**: `GET /fxsim/v1/admin/analytics/revenue`
   - **Backend Callback**: `analytics_revenue()` at `class-rest-api.php:3885`
   - **Returned Object**: `{ monthly: Array<{ month: string, count: number, total: number|string }>, by_plan: Array<{ plan_name: string, sales: number, revenue: number|string }>, total: number }`
   - **Status**: **Fully Available** in PHP backend.

3. `api.admin.analyticsGrowth()`
   - **Route**: `GET /fxsim/v1/admin/analytics/growth`
   - **Backend Callback**: `analytics_growth()` at `class-rest-api.php:3921`
   - **Returned Object**: `{ new_users: Array<{ month: string, count: number }>, new_challenges: Array<{ month: string, count: number }>, funded_monthly: Array<{ month: string, count: number }>, total_users: number, total_challenges: number, total_funded: number }`
   - **Status**: **Fully Available** in PHP backend.

4. `api.admin.paymentsList()`
   - **Route**: `GET /fxsim/v1/admin/payments`
   - **Backend Callback**: `admin_payments_list()` at `class-rest-api.php:3145`
   - **Returned Object**: `Array<PaymentOrder>`
   - **Status**: **Fully Available** in PHP backend.

5. `api.admin.challenges()`
   - **Route**: `GET /fxsim/v1/admin/challenges`
   - **Backend Callback**: `admin_challenges()` at `class-rest-api.php:2116`
   - **Returned Object**: `{ challenges: Array<ChallengeAccount>, pending_payouts: Array<unknown> }`
   - **Status**: **Fully Available** in PHP backend.

6. `api.admin.whitelabelGet()`
   - **Route**: `GET /fxsim/v1/admin/whitelabel`
   - **Backend Callback**: `admin_whitelabel_get()` at `class-rest-api.php:2312`
   - **Returned Object**: `Record<string, string>` (e.g. `{ setup_completed: "1" }`)
   - **Status**: **Fully Available** in PHP backend.

7. `api.admin.riskAlerts()`
   - **Route**: `GET /fxsim/v1/admin/risk/alerts`
   - **Backend Callback**: **MISSING** in `class-rest-api.php`.
   - **Status**: **Unwired / Incomplete in Backend**.

8. `api.admin.riskExposure()`
   - **Route**: `GET /fxsim/v1/admin/risk/exposure`
   - **Backend Callback**: **MISMATCH / MISSING** in `class-rest-api.php`. Backend has `/admin/risk/heatmap` (`class-rest-api.php:1103`) which returns `{ symbol, long, short, net }`, whereas frontend component `GlobalExposureHeatmap` expects `RiskExposureItem[]` (`{ symbol, cmd, total_lots, trade_count }`).
   - **Status**: **Unwired / Incomplete in Backend**.

### D. Identified Error Handling / UI Crash Bugs in `page.tsx`
- **Line 336 (`DashboardTrends`)**: `api.admin.analyticsRevenue().then(...)` has no `else` branch. On network error / 500, state remains `null` and `<Skeleton className="h-48 w-full" />` renders indefinitely.
- **Line 340 (`DashboardTrends`)**: `api.admin.analyticsGrowth().then((r) => { if (!r.ok) return; ... })`. On network error / 500, state remains `null` and `<Skeleton className="h-48 w-full" />` renders indefinitely.
- **Line 418 (`RiskAlerts`)**: `api.admin.riskAlerts().then(...)` has no `else` branch. When endpoint returns 404/500, `alerts` remains `null` and the section returns `null` (vanishes without fallback).
- **Line 489 (`GlobalExposureHeatmap`)**: `api.admin.riskExposure().then(...)` has no `else` branch. When endpoint returns 404/500, `exposure` remains `null` and `<Skeleton className="h-48 w-full" />` renders indefinitely.

---

## 2. Logic Chain

1. **From Observation A & B**: The Admin Overview page (`src/app/dashboard/admin/page.tsx`) queries 8 distinct endpoints under `api.admin.*` in `src/lib/api.ts`.
2. **From Observation C**: 6 of the 8 endpoints (`stats`, `analyticsRevenue`, `analyticsGrowth`, `paymentsList`, `challenges`, `whitelabelGet`) are fully supported by PHP endpoints in `class-rest-api.php`.
3. **From Observation C (7 & 8)**: The remaining 2 endpoints (`riskAlerts` and `riskExposure`) are not implemented or mismatched in `class-rest-api.php`. To prevent frontend 404 errors, these 2 endpoints must be mocked in `src/lib/api.ts` using `mockApiResponse` with simulated 800ms latency and `// TODO: Real API` comments per project requirements.
4. **From Observation D**: If an API endpoint fails or returns a 404/500 error, `page.tsx` currently leaves state variables (`rev`, `growth`, `exposure`, `alerts`) as `null`. Because `null` is used as the loading indicator for skeleton UI, failed network calls cause perpetual loading skeletons ("Eternal Skeleton" bug) instead of showing empty states or clean error fallbacks.
5. **Synthesis**:
   - Implement realistic mock fallbacks for `riskAlerts` and `riskExposure` in `src/lib/api.ts`.
   - Update `page.tsx` state handlers to explicitly reset state on error (`else setRev([])`, `else setGrowth([])`, `else setExposure([])`, `else setAlerts(...)`), guaranteeing that the UI never hangs or displays a blank screen.

---

## 3. Caveats

- **Backend Risk Endpoints**: `class-rest-api.php` contains `/admin/risk/heatmap` and `/admin/risk/toxic` which are structurally close to `riskExposure` and `riskAlerts`. Once backend developer adds endpoints for `/admin/risk/alerts` and `/admin/risk/exposure`, the mock helper `mockApiResponse` in `src/lib/api.ts` can be replaced with real `fxsim` calls.
- **Cache Invalidation**: Stat queries like `api.admin.stats()` use 10s-15s auto-refetch intervals (`refetchInterval: 15_000`). This ensures real-time updates without overwhelming the server.

---

## 4. Conclusion

Milestone M2 (Overview & System KPIs Module) requires wiring 8 API endpoints. 6 backend endpoints are production-ready in `class-rest-api.php`. The 2 missing endpoints (`riskAlerts` and `riskExposure`) can be seamlessly mocked in `src/lib/api.ts`. Applying defensive state fallbacks in `page.tsx` guarantees 100% resilience against network failures, 500 errors, and missing backend endpoints.

### Proposed Code Changes (For Implementer Agent)

#### 1. Mock Additions in `src/lib/api.ts`
```typescript
// TODO: Real API — Needs GET /fxsim/v1/admin/risk/alerts in class-rest-api.php
riskAlerts: () =>
  mockApiResponse<import('../types/api').AdminRiskAlerts>({
    hft_risks: [
      { user_id: 101, user_email: "scalper_alex@trading.io", count: 14 },
      { user_id: 105, user_email: "algo_dev_99@propfirm.com", count: 9 }
    ],
    gambling_risks: [
      { user_id: 112, user_email: "maxlot_trader@fxmarket.com", count: 4 }
    ],
    open_flags: 3
  }, 800),

// TODO: Real API — Needs GET /fxsim/v1/admin/risk/exposure in class-rest-api.php
riskExposure: () =>
  mockApiResponse<import('../types/api').RiskExposureItem[]>([
    { symbol: 'EURUSD', cmd: 'buy',  total_lots: 124.50, trade_count: 42 },
    { symbol: 'EURUSD', cmd: 'sell', total_lots: 85.20,  trade_count: 28 },
    { symbol: 'GBPUSD', cmd: 'buy',  total_lots: 64.00,  trade_count: 19 },
    { symbol: 'XAUUSD', cmd: 'sell', total_lots: 45.80,  trade_count: 15 },
    { symbol: 'BTCUSD', cmd: 'buy',  total_lots: 12.30,  trade_count: 8  }
  ], 800),
```

#### 2. Defensive Fallback Adjustments in `src/app/dashboard/admin/page.tsx`
```typescript
// In DashboardTrends:
useEffect(() => {
  api.admin.analyticsRevenue().then((r) => {
    if (r.ok) setRev((r.data.monthly ?? []).map((d) => ({ month: d.month, total: toNum(d.total) })))
    else setRev([])
  })
  api.admin.analyticsGrowth().then((r) => {
    if (!r.ok) { setGrowth([]); return }
    const by: Record<string, { month: string; users: number; challenges: number; funded: number }> = {}
    const get = (m: string) => (by[m] ??= { month: m, users: 0, challenges: 0, funded: 0 })
    for (const x of r.data.new_users ?? [])      get(x.month).users = x.count
    for (const x of r.data.new_challenges ?? []) get(x.month).challenges = x.count
    for (const x of r.data.funded_monthly ?? []) get(x.month).funded = x.count
    setGrowth(Object.values(by).sort((a, b) => a.month.localeCompare(b.month)))
  })
}, [])

// In RiskAlerts:
useEffect(() => {
  api.admin.riskAlerts().then(r => {
    if (r.ok) setAlerts(r.data)
    else setAlerts({ hft_risks: [], gambling_risks: [], open_flags: 0 })
  })
}, [])

// In GlobalExposureHeatmap:
useEffect(() => {
  api.admin.riskExposure().then(r => {
    if (r.ok) setExposure(r.data)
    else setExposure([])
  })
}, [])
```

---

## 5. Verification Method

1. **Build & Type Check**:
   - Run `npm run build` inside `propfirm-frontend-v10.7.1` to confirm zero TypeScript compilation errors.
2. **Offline Fallback Simulation**:
   - Set `NEXT_PUBLIC_API_URL` to an unreachable URL (e.g. `http://localhost:9999`) and load `/dashboard/admin`.
   - Verify that stat cards display skeletons with a top danger error banner, and trend charts / heatmaps transition gracefully to empty states without crashing or hanging in perpetual loading state.
3. **Mocking Verification**:
   - Verify that `RiskAlerts` and `GlobalExposureHeatmap` render mock telemetry after an 800ms loading skeleton phase.
