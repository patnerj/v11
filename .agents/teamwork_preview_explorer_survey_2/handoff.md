# Handoff Report — Dashboard Overview Data Handling & Crash Survey

## 1. Observation

### System & Scope
- **Component**: Propfirm Frontend (`propfirm-frontend-v10.7.1`)
- **Page Under Survey**: Trader Dashboard Overview (`src/app/dashboard/page.tsx`)
- **Data Layer & Dependencies**:
  - API Client: `src/lib/api.ts` & `src/lib/fxsim.ts`
  - React Query Hooks: `src/hooks/useApi.ts`
  - Types: `src/types/api.ts`
  - Format Helpers: `src/lib/format.ts`
  - Auth Store: `src/store/auth.ts`
  - Dashboard UI Components:
    - `src/components/dashboard/equity-chart.tsx`
    - `src/components/dashboard/challenge-progress-card.tsx`
    - `src/components/dashboard/kyc-status-card.tsx`
    - `src/components/dashboard/performance-insights.tsx`
    - `src/components/dashboard/trader-badges.tsx`
    - `src/components/dashboard/quick-actions.tsx`
    - `src/components/dashboard/stat-card.tsx`
  - Backend API Endpoints: `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` and `includes/challenge/class-challenge-engine.php`

### Direct File & Line Observations

1. **`EquityChart` missing guard on `data` prop**:
   - File: `src/components/dashboard/equity-chart.tsx`, lines 18–24
   - Code snippet:
     ```tsx
     const seriesData = useMemo(() => {
       return data
         .map((p) => ({
           time: Math.floor(new Date(p.date).getTime() / 1000),
           value: toNum(p.balance),
         }))
     ```
   - In `src/app/dashboard/page.tsx`, line 284:
     `<EquityChart data={metrics.equity_chart} height={280} />`

2. **`ChallengeProgressCard` unsafe property access on `metrics.challenge`**:
   - File: `src/components/dashboard/challenge-progress-card.tsx`, lines 17, 27, 33, 39:
     ```tsx
     const planSize = toNum(m.plan?.account_size ?? m.challenge.account_size ?? 0)
     ...
     {m.plan?.name ?? `Challenge #${m.challenge.id}`}
     ...
     {m.challenge.drawdown_type && (...)}
     ...
     {(m.challenge.scaling_level ?? 0) > 0 && (...)}
     ```

3. **`KycStatusCard` unsafe lookup in `META` mapping**:
   - File: `src/components/dashboard/kyc-status-card.tsx`, lines 60–62:
     ```tsx
     const status = kyc.status
     const m = META[status]
     const Icon = m.icon
     ```

4. **`PerformanceInsights` non-array check for `trades`**:
   - File: `src/components/dashboard/performance-insights.tsx`, lines 13 & 31:
     ```tsx
     if (!trades || trades.length === 0) { ... }
     ...
     trades.forEach((t) => { ... })
     ```

5. **`TraderBadges` non-array check & non-iterable loop for `trades`**:
   - File: `src/components/dashboard/trader-badges.tsx`, lines 39–40:
     ```tsx
     if (trades) {
       for (const t of trades) { ... }
     }
     ```

6. **`RecentTradesTable` and `OtherChallengesCard` strict null checks**:
   - File: `src/app/dashboard/page.tsx`, lines 394 & 442:
     ```tsx
     if (trades === null) return <Skeleton />
     if (trades.length === 0) return ...
     ```
     ```tsx
     if (challenges === null) return <Skeleton />
     const list = challenges.slice(0, 5)
     ```

7. **TanStack Query hooks throwing errors on non-200 domain API responses**:
   - File: `src/hooks/useApi.ts`, lines 12–15:
     ```tsx
     export function useAccountQuery() {
       return useQuery({
         queryKey: ['account'],
         queryFn: async () => {
           const res = await api.account();
           if (!res.ok) throw new Error(res.error || 'Failed to fetch account');
           return res.data;
         },
         refetchInterval: POLLING_INTERVAL,
       });
     }
     ```
   - In `class-rest-api.php`, lines 484–487:
     ```php
     if (!$acc) return new WP_REST_Response(
         ['error' => 'No active challenge account. Purchase a challenge to start trading.', 'no_challenge' => true],
         404
     );
     ```

## 2. Logic Chain

1. **Root Cause of Dashboard Crash ('Something went wrong')**:
   - When a user purchases a challenge, they are redirected to `/dashboard`.
   - On initial load of a fresh challenge account:
     - `metrics.equity_chart` can be `null`, `undefined`, or an empty array (since 0 trade snapshots exist).
     - `DashboardOverview` passes `metrics.equity_chart` to `<EquityChart data={metrics.equity_chart} />`.
     - `EquityChart` attempts `data.map(...)` without validating that `data` is an Array.
     - JS throws `TypeError: Cannot read properties of undefined (reading 'map')` or `data.map is not a function`.
     - Because this render error is uncaught, React unmounts the dashboard tree and triggers the global Error Boundary.

2. **Cascading Failure 1: Unsafe Array/Object Expectations across Dashboard Components**:
   - **`PerformanceInsights`**: Assumes `trades` is either falsy or an Array. If `trades` is a non-array object (e.g. `{ error: "..." }`), `!trades || trades.length === 0` evaluates to `false`. Execution reaches `trades.forEach(...)` which throws `TypeError: trades.forEach is not a function`.
   - **`TraderBadges`**: Evaluates `if (trades)`. If `trades` is an object `{ error: "..." }`, `if (trades)` is truthy. Execution reaches `for (const t of trades)` which throws `TypeError: trades is not iterable`.
   - **`RecentTradesTable`**: Only checks `if (trades === null)`. If `trades` is `undefined` (because `useHistoryQuery` errored or returned undefined), `trades === null` is false, leading to `trades.length` throwing `TypeError: Cannot read properties of undefined (reading 'length')`.
   - **`OtherChallengesCard`**: Only checks `if (challenges === null)`. If `challenges` is `undefined`, `challenges.slice(0, 5)` throws `TypeError: Cannot read properties of undefined (reading 'slice')`.

3. **Cascading Failure 2: Incomplete or Missing API Data Structures**:
   - **`ChallengeProgressCard`**: Relies on `m.challenge.account_size`, `m.challenge.id`, `m.challenge.drawdown_type`, `m.challenge.scaling_level`. If `metrics` is non-null but `metrics.challenge` is undefined/null (e.g. partial response or backend engine error), property access on `m.challenge` throws `TypeError: Cannot read properties of undefined`.
   - **`KycStatusCard`**: Looks up `META[kyc.status]`. If `kyc` is an empty object `{}` or has an unexpected `status` string, `META[status]` returns `undefined`. Accessing `m.icon` throws `TypeError: Cannot read properties of undefined (reading 'icon')`.

4. **Cascading Failure 3: TanStack Query Hook Error Handling Mismatch**:
   - Backend endpoint `/account` returns HTTP 404 when no active account exists. `api.account()` returns `{ ok: false, status: 404, error: "..." }`.
   - In `useApi.ts`, `useAccountQuery` throws an `Error` on `!res.ok`. TanStack Query marks the query state as errored and leaves `data` as `undefined`.
   - In `dashboard/page.tsx`:
     ```ts
     const acc = account && isAccount(account) ? account : null
     const noChallenge = ready && challenges !== null && challenges.length === 0
     const isError = ready && challenges === null
     ```
   - If `useChallengeMyQuery` succeeds (returning 1 challenge item), `challenges` is `[ch]`. Therefore `noChallenge` is `false` and `isError` is `false`.
   - The page attempts to render the dashboard, but `account` is `undefined` (`acc = null`), `recent` is `undefined`, `metrics` is `undefined`.
   - Sub-components expecting array props (or `null` for loading skeletons) receive `undefined` instead, triggering the crashes described in Issues 1–5.

## 3. Caveats

- **Backend Runtime Environment**: Analysis was conducted via read-only inspection of source code files (`src/`, `includes/`). Live execution tests were not run, but logic paths and type signatures were verified deterministically against TypeScript types and PHP endpoints.
- **WebSocket Price Feeds**: `src/store/prices.ts` feeds live ticking prices to trading pages, but Dashboard Overview operates entirely on REST polling hooks (`POLLING_INTERVAL = 4000ms`).

## 4. Conclusion

The Dashboard Overview crash ('Something went wrong' Error Boundary) is caused by **unprotected data mapping and missing default fallbacks** across multiple frontend UI components and custom React Query hooks:

1. **Primary Crash Trigger**: `EquityChart` attempts `data.map()` when `metrics.equity_chart` is `undefined` or `null` (standard for fresh challenge accounts with no trading history).
2. **Secondary Crash Triggers**: `PerformanceInsights`, `TraderBadges`, `RecentTradesTable`, `OtherChallengesCard`, `ChallengeProgressCard`, and `KycStatusCard` lack defensive checks (`Array.isArray`, optional chaining `?.`, default fallback objects) against missing, undefined, or unexpected API responses.
3. **Data Hook Flaw**: `useApi.ts` hooks unconditionally throw `Error` objects inside `queryFn` rather than mapping domain error states (like 404 No Challenge or network timeouts) into safe default fallback states (`null`, `[]`, or structured fallback objects).

### Expected vs. Actual Data Structures for Fresh/New Challenge Accounts

| Endpoint | Expected Fresh Account Return | Actual Potential Edge Return | Current UI Handling Result |
|---|---|---|---|
| `GET /challenge/my` | `[{ id: 1, phase: 1, status: 'active', ... }]` | `[]` or `{}` | Handles `[]` (shows NoChallengeCTA). If `{}` or `undefined`, crashes `OtherChallengesCard`. |
| `GET /account` | `{ id: 1, balance: 10000, equity: 10000, ... }` | 404 `{ no_challenge: true }` or `undefined` | Hook throws error. `acc` becomes `null`. StatCards render fallback card if ready. |
| `GET /challenge/{id}/metrics` | `{ balance: 10000, equity_chart: [], ... }` | `{}` or `equity_chart: null/undefined` | `EquityChart` crashes on `data.map()`. `ChallengeProgressCard` crashes on `m.challenge.id`. |
| `GET /history` | `{ trades: [], has_more: false }` | `undefined` or `{ error: '...' }` | `PerformanceInsights` crashes on `trades.forEach`. `TraderBadges` crashes on `for (const t of trades)`. |
| `GET /kyc` | `{ status: 'not_started', docs: {...} }` | `{}` or `{ status: null }` | `KycStatusCard` crashes on `META[status].icon`. |

---

### Recommended Fixes

1. **Fix `EquityChart` (`src/components/dashboard/equity-chart.tsx`)**:
   - Guard `data` prop with a default fallback array:
     ```tsx
     export function EquityChart({ data = [], height = 280 }: Props) {
       const seriesData = useMemo(() => {
         const safeData = Array.isArray(data) ? data : []
         return safeData.map((p) => ({ ... }))
       }, [data])
     ```

2. **Fix `ChallengeProgressCard` (`src/components/dashboard/challenge-progress-card.tsx`)**:
   - Add early guard at top of component:
     ```tsx
     if (!m || !m.challenge) return null;
     ```
   - Use optional chaining for `m.challenge?.account_size`, `m.challenge?.id`, `m.challenge?.drawdown_type`, `m.challenge?.scaling_level`.

3. **Fix `KycStatusCard` (`src/components/dashboard/kyc-status-card.tsx`)**:
   - Fallback `status` lookup to `META.not_started`:
     ```tsx
     const status = kyc?.status ?? 'not_started'
     const m = META[status] ?? META.not_started
     ```

4. **Fix `PerformanceInsights` & `TraderBadges` (`src/components/dashboard/performance-insights.tsx`, `trader-badges.tsx`)**:
   - Validate array using `Array.isArray(trades)`:
     ```tsx
     if (!Array.isArray(trades) || trades.length === 0) { ... }
     ```

5. **Fix `RecentTradesTable` & `OtherChallengesCard` (`src/app/dashboard/page.tsx`)**:
   - Replace strict `=== null` checks with `!Array.isArray(...)`:
     ```tsx
     function RecentTradesTable({ trades }: { trades: Trade[] | null }) {
       if (!trades) return <div className="p-5 space-y-2">{...}</div>
       if (!Array.isArray(trades) || trades.length === 0) return <EmptyState />
     ```

6. **Fix React Query Hooks (`src/hooks/useApi.ts`)**:
   - Handle error states gracefully without letting unhandled throws break query data:
     ```tsx
     export function useHistoryQuery() {
       return useQuery({
         queryKey: ['history'],
         queryFn: async () => {
           const res = await api.history();
           if (!res.ok) return [];
           return Array.isArray(res.data?.trades) ? res.data.trades : [];
         },
         refetchInterval: POLLING_INTERVAL,
       });
     }
     ```

## 5. Verification Method

1. **Codebase Inspection**:
   - View `src/components/dashboard/equity-chart.tsx`: Confirm `Array.isArray(data)` or default `data = []`.
   - View `src/components/dashboard/challenge-progress-card.tsx`: Confirm optional chaining on `m.challenge`.
   - View `src/components/dashboard/kyc-status-card.tsx`: Confirm fallback to `META.not_started`.
   - View `src/components/dashboard/performance-insights.tsx` & `trader-badges.tsx`: Confirm `Array.isArray(trades)` checks.
   - View `src/app/dashboard/page.tsx`: Confirm `RecentTradesTable` and `OtherChallengesCard` check `!Array.isArray`.
   - View `src/hooks/useApi.ts`: Confirm safe return fallbacks (`[]` / `null`).

2. **Simulated Fresh Account Scenario**:
   - Mock API responses with `equity_chart: null`, `trades: []`, `kyc: { status: 'not_started' }`, and `metrics: {}`.
   - Verify that navigating to `/dashboard` renders individual card empty/skeleton states without triggering the global Error Boundary.
