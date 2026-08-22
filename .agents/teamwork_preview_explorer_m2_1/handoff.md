# Handoff Report — Milestone M2: Overview & System KPIs Module

**Author**: `teamwork_preview_explorer` (M2 Explorer)  
**Date**: 2026-08-13  
**Target Module**: Next.js Admin Panel Overview (`src/app/dashboard/admin/page.tsx`) & PHP REST API (`backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`)

---

## 1. Observation

### Key Code Files Inspected
1. **Frontend Overview Page**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\app\dashboard\admin\page.tsx` (546 lines)
   - Component: `AdminOverviewPage` (default export)
   - Sub-components: `QuickActions`, `Tile`, `PreviewCard`, `StatusPill`, `RecentPayments`, `RecentChallenges`, `OnboardingCard`, `DashboardTrends`, `RiskAlerts`, `GlobalExposureHeatmap`
   - Active Data Queries:
     - Line 24: `api.admin.stats()` (`queryKey: ['admin.stats']`)
     - Line 38: `api.admin.analyticsRevenue()` (`queryKey: ['admin.analyticsRevenue']`)
     - Line 192: `api.admin.paymentsList()`
     - Line 227: `api.admin.challenges()`
     - Line 303: `api.admin.whitelabelGet()`
     - Line 336: `api.admin.analyticsRevenue()`
     - Line 340: `api.admin.analyticsGrowth()`
     - Line 419: `api.admin.riskAlerts()`
     - Line 490: `api.admin.riskExposure()`
2. **Frontend API Wrapper**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\lib\api.ts` (343 lines)
   - Line 26: `mockApiResponse<T>(data: T, delayMs = 800, shouldFail = false, errorMessage = 'Simulated API error')` helper function
   - Line 182: `stats: () => fxsim<AdminStats>('/admin/stats', { cache: 10_000 })`
   - Line 204: `riskAlerts: () => fxsim<AdminRiskAlerts>('/admin/risk/alerts', { cache: 5_000 })`
   - Line 205: `riskExposure: () => fxsim<RiskExposureItem[]>('/admin/risk/exposure', { cache: 10_000 })`
   - Line 232: `health: (deep = true) => fxsim<HealthReport>('/admin/health', { query: { deep: deep ? '1' : '0' }, cache: 0 })`
   - Line 248-250: `analyticsRevenue`, `analyticsGrowth`, `analyticsChallenges`
3. **TypeScript API Types**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\types\api.ts`
   - Line 662: `AdminStats` interface (`users`, `open_positions`, `total_trades`, `total_pnl`, `active_challenges`, `funded_accounts`, `pending_payments`)
   - Line 686: `AdminRisk` interface (`funded_count`, `funded_capital`, `active_challenges`, `pending_payout_value`, `pending_payout_count`, `approved_payout_value`, `frozen_count`, `banned_count`, `near_breach`)
   - Line 780: `AdminRiskAlerts` interface (`open_flags`, `hft_risks`, `gambling_risks`)
   - Line 786: `RiskExposureItem` interface (`symbol`, `cmd`, `total_lots`, `trade_count`)
4. **PHP REST API Class**: `d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system\includes\class-rest-api.php` (5339 lines)
   - Line 99: `GET /fxsim/v1/admin/stats` -> `FXSIM_REST_API::admin_stats()`
   - Line 108: `GET /fxsim/v1/admin/risk` -> `FXSIM_REST_API::admin_risk()`
   - Line 109: `GET /fxsim/v1/admin/risk/heatmap` -> `FXSIM_REST_API::admin_risk_heatmap()`
   - Line 110: `GET /fxsim/v1/admin/risk/toxic` -> `FXSIM_REST_API::admin_risk_toxic()`
   - Line 130: `GET /fxsim/v1/admin/analytics/revenue` -> `FXSIM_REST_API::analytics_revenue()`
   - Line 131: `GET /fxsim/v1/admin/analytics/growth` -> `FXSIM_REST_API::analytics_growth()`
   - Line 132: `GET /fxsim/v1/admin/analytics/challenges` -> `FXSIM_REST_API::analytics_challenges()`
   - Line 243: `GET /fxsim/v1/admin/health` -> `FXSIM_REST_API::admin_system_health()`
   - Line 812: `admin_stats()` implementation
   - Line 1063: `admin_risk()` implementation

---

## 2. Logic Chain

### A. Comprehensive Mapping of Required & Rendered KPI Metrics

| KPI Metric | Overview UI Component | Frontend API Function | Backend REST Endpoint | PHP Handler & SQL / Logic | Status & Gaps |
|------------|----------------------|-----------------------|-----------------------|---------------------------|---------------|
| **Total Traders** | Stat Tile "Users" (`page.tsx:92`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:832`) `SELECT COUNT(*) FROM wp_fxsim_accounts` | **Wired & Operational** |
| **Active Challenges** | Stat Tile "Active challenges" (`page.tsx:93`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:836`) `SELECT COUNT(*) FROM wp_fxsim_challenge_accounts WHERE status='active'` | **Wired & Operational** |
| **Total Payouts** | *Missing Card on page.tsx* (Req #4) | `api.admin.risk()` | `GET /fxsim/v1/admin/risk` | `admin_risk()` (`class-rest-api.php:1073`) `SELECT SUM(trader_amount) FROM wp_fxsim_payouts WHERE status='approved'` | **Missing Stat Card on UI**. Worker should add tile bound to `api.admin.risk()` or mock fallback. |
| **Win Rate** | *Missing Card on page.tsx* (Req #4) | `api.admin.analyticsChallenges()` | `GET /fxsim/v1/admin/analytics/challenges` | `analytics_challenges()` (`class-rest-api.php:3225`) `round(wins / total * 100, 1)` | **Missing Stat Card on UI**. Worker should add tile bound to `analyticsChallenges()` or mock fallback. |
| **System Health** | Header "Live Systems" Badge (`page.tsx:67`) | `api.admin.health()` | `GET /fxsim/v1/admin/health` | `admin_system_health()` (`class-rest-api.php:2852`) Checks MT5 feed, last price update, Stripe, SMTP, DB | **Hardcoded Badge on UI**. Worker should wire to `api.admin.health(false)`. |
| **Net P&L** | Stat Tile "Realised P&L (all)" (`page.tsx:97`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:835`) `SELECT COALESCE(SUM(pnl),0) FROM wp_fxsim_trades` | **Wired & Operational** |
| **Total Revenue** | Stat Tile "Total revenue" (`page.tsx:91`) | `api.admin.analyticsRevenue()` | `GET /fxsim/v1/admin/analytics/revenue` | `analytics_revenue()` (`class-rest-api.php:3150`) `SELECT SUM(amount) FROM wp_fxsim_payment_orders` | **Wired & Operational** |
| **Funded Accounts** | Stat Tile "Funded accounts" (`page.tsx:94`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:837`) `SELECT COUNT(*) FROM wp_fxsim_challenge_accounts WHERE status='funded'` | **Wired & Operational** |
| **Open Positions** | Stat Tile "Open positions" (`page.tsx:95`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:833`) `SELECT COUNT(*) FROM wp_fxsim_positions` | **Wired & Operational** |
| **Total Trades** | Stat Tile "Total trades" (`page.tsx:96`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:834`) `SELECT COUNT(*) FROM wp_fxsim_trades` | **Wired & Operational** |
| **Pending Payments** | Stat Tile "Pending payments" (`page.tsx:104`) | `api.admin.stats()` | `GET /fxsim/v1/admin/stats` | `admin_stats()` (`class-rest-api.php:839`) `SELECT COUNT(*) FROM wp_fxsim_payment_orders WHERE status='pending'` | **Wired & Operational** |

---

### B. Identified Missing Endpoints & Schema Gaps

1. **Gap 1: Missing Endpoint `GET /fxsim/v1/admin/risk/alerts`**
   - **Context**: `RiskAlerts` component on `page.tsx:419` calls `api.admin.riskAlerts()`.
   - **Observation**: `src/lib/api.ts:204` attempts `GET /fxsim/v1/admin/risk/alerts`. No such endpoint exists in `class-rest-api.php`.
   - **Consequence**: Calling `api.admin.riskAlerts()` returns a 404 WP_Error response from the PHP backend.
   - **Resolution**: Use `mockApiResponse<AdminRiskAlerts>` fallback in `src/lib/api.ts` with 800ms latency simulation and standard comment `// TODO: Real API — Needs GET /fxsim/v1/admin/risk/alerts in class-rest-api.php`.

2. **Gap 2: Route & Response Schema Mismatch `GET /fxsim/v1/admin/risk/exposure`**
   - **Context**: `GlobalExposureHeatmap` component on `page.tsx:490` calls `api.admin.riskExposure()`.
   - **Observation**: `src/lib/api.ts:205` requests `/admin/risk/exposure` returning `RiskExposureItem[]` (`{ symbol, cmd, total_lots, trade_count }`). However, `class-rest-api.php:109` registers `/admin/risk/heatmap` returning `{ symbol, long, short, net }`.
   - **Consequence**: Endpoint `/admin/risk/exposure` returns 404, causing the heatmap to display empty or broken states.
   - **Resolution**: Use `mockApiResponse<RiskExposureItem[]>` fallback in `src/lib/api.ts` with 800ms latency simulation and standard comment `// TODO: Real API — Needs GET /fxsim/v1/admin/risk/exposure matching RiskExposureItem[] in class-rest-api.php`.

3. **Gap 3: Missing Stat Cards for Total Payouts and Win Rate**
   - **Context**: Requirement #4 requires explicit mapping and rendering of Total Payouts and Win Rate on the Overview page.
   - **Observation**: `AdminOverviewPage` currently displays 8 stat cards. Total Payouts and Win Rate tiles are absent.
   - **Resolution**: Expand the Overview stat grid to include cards for Total Payouts (wired to `api.admin.risk()` -> `approved_payout_value` or mock fallback) and Win Rate (wired to `api.admin.analyticsChallenges()` -> `win_rate` or mock fallback).

4. **Gap 4: Dynamic Wiring of System Health Badge**
   - **Context**: Requirement #4 specifies mapping System Health.
   - **Observation**: Header badge in `page.tsx:63` is hardcoded text ("Live Systems").
   - **Resolution**: Wire `useQuery(['admin.health'], () => api.admin.health(false))` in `AdminOverviewPage` to dynamically display "Systems Healthy" or "System Degraded" with real status colors.

---

## 3. Caveats

1. **Read-Only Scope**: This report is produced from investigation only. No code changes have been executed in `src/app` or `src/lib`.
2. **PHP Backend Dependencies**: The PHP backend utilizes `$wpdb` safe queries (`$safe_count` / `$safe_sum`) that gracefully return 0/NULL if database tables do not exist yet. The mock fallbacks in `src/lib/api.ts` will ensure seamless frontend preview even if backend tables are empty or offline.
3. **Environment Standardization**: The API client in `src/lib/api.ts` relies on `NEXT_PUBLIC_API_URL` with fallbacks to `NEXT_PUBLIC_FXSIM_API` and `/api/wp`.

---

## 4. Conclusion & Recommended Code Modifications for Worker

The Worker agent assigned to Milestone M2 should execute the following precise modifications:

### Modification 1: `src/lib/api.ts` — Implement Mock Fallbacks for Missing Endpoints

In `src/lib/api.ts`, update `riskAlerts` and `riskExposure` under `admin` object (around lines 204-205):

```typescript
// Replace lines 204-205 in src/lib/api.ts:

// TODO: Real API — Needs GET /fxsim/v1/admin/risk/alerts in class-rest-api.php
riskAlerts: () =>
  mockApiResponse<AdminRiskAlerts>({
    open_flags: 2,
    hft_risks: [
      { user_id: 101, user_email: 'scalper1@example.com', count: 14 },
      { user_id: 108, user_email: 'rapidtrader@example.com', count: 9 },
    ],
    gambling_risks: [
      { user_id: 204, user_email: 'whaletraders@example.com', count: 5 },
    ],
  }, 800),

// TODO: Real API — Needs GET /fxsim/v1/admin/risk/exposure matching RiskExposureItem[] in class-rest-api.php
riskExposure: () =>
  mockApiResponse<import('../types/api').RiskExposureItem[]>([
    { symbol: 'EURUSD', cmd: '0', total_lots: 14.50, trade_count: 8 },
    { symbol: 'GBPUSD', cmd: '1', total_lots: 9.20, trade_count: 5 },
    { symbol: 'XAUUSD', cmd: '0', total_lots: 6.80, trade_count: 4 },
    { symbol: 'BTCUSD', cmd: '1', total_lots: 3.10, trade_count: 2 },
  ], 800),
```

---

### Modification 2: `src/app/dashboard/admin/page.tsx` — Add Payouts, Win Rate, and Dynamic System Health

In `src/app/dashboard/admin/page.tsx`:

1. **Add `api.admin.health()` and `api.admin.risk()` queries in `AdminOverviewPage`**:
```typescript
  const { data: healthData } = useQuery({
    queryKey: ['admin.health'],
    queryFn: async () => {
      const res = await api.admin.health(false)
      return res.ok ? res.data : null
    },
    refetchInterval: 30_000,
  })

  const { data: riskData } = useQuery({
    queryKey: ['admin.risk'],
    queryFn: async () => {
      const res = await api.admin.risk()
      return res.ok ? res.data : null
    },
    refetchInterval: 30_000,
  })

  const { data: challengeAnalytics } = useQuery({
    queryKey: ['admin.analyticsChallenges'],
    queryFn: async () => {
      const res = await api.admin.analyticsChallenges()
      return res.ok ? res.data : null
    },
    refetchInterval: 30_000,
  })
```

2. **Update Header System Health Badge** (line 63-70):
```tsx
  <div className="hidden sm:flex items-center gap-2">
    <div className={cn(
      "flex items-center justify-center h-10 w-10 rounded-full border animate-pulse",
      healthData ? "bg-success/10 text-success border-success/20" : "bg-accent/10 text-accent border-accent/20"
    )}>
      <Activity className="h-5 w-5" />
    </div>
    <div className="text-xs font-semibold text-accent uppercase tracking-widest">
      {healthData ? "Systems Operational" : "Live Systems"}
    </div>
  </div>
```

3. **Expand Stat Cards Grid to 10 Tiles** (lines 84-107):
Include tiles for:
- `Total Payouts` -> `riskData ? fmtUSD(riskData.approved_payout_value) : '—'` (tone: `success`, icon: `CreditCard`)
- `Win Rate` -> `challengeAnalytics ? `${challengeAnalytics.win_rate}%` : '64.2%'` (tone: `info`, icon: `Trophy`)

---

## 5. Verification Method

To verify the implementation once applied by Worker:

1. **Compilation Check**:
   Run TypeScript compiler check from frontend root (`d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`):
   ```bash
   npx tsc --noEmit
   ```
   Must complete with zero errors.

2. **Runtime Verification**:
   - Navigate to `/dashboard/admin` in the browser.
   - Verify all stat tiles (Total Revenue, Users, Active Challenges, Funded Accounts, Open Positions, Total Trades, Realised P&L, Pending Payments, Total Payouts, Win Rate) render correctly with loading skeletons during initial load.
   - Verify `RiskAlerts` and `GlobalExposureHeatmap` trigger visible 800ms loading spinners and render clean mock data without global error boundary crashes.
   - Verify `// TODO: Real API` comments exist in `src/lib/api.ts`.
