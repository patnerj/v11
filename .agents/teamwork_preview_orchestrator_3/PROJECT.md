# Project: Next.js Admin Panel & PHP Backend REST API Connection

## Architecture
- Frontend: Next.js 16 (App Router), React 18, TypeScript, TailwindCSS, Zustand, TanStack Query, sonner, Lucide React
- Backend: WordPress Plugin (PHP), REST API namespace `fxsim/v1`, MySQL
- API Base URL Standard: `NEXT_PUBLIC_API_URL` with fallback to `NEXT_PUBLIC_FXSIM_API` and `/api/wp` in `src/lib/api.ts`

## Feature Inventory
| # | Feature / Page / Component | Description | Milestone | Source |
|---|-----------------------------|-------------|-----------|--------|
| 1 | Core API Client & Env Vars | Standardize API client in `api.ts`, handle env vars (`NEXT_PUBLIC_API_URL`), CORS, error fallbacks, mock latency helper (`Promise.resolve` + 800ms `setTimeout`) | M1 | survey |
| 2 | Overview / Dashboard KPIs | `admin/page.tsx`, metrics cards, system stats, quick actions | M2 | survey |
| 3 | Users & Traders Management | `admin/users/page.tsx`, `users/[id]/page.tsx`, balance adjustments, user status, risk score, notes | M3 | survey |
| 4 | Challenge Accounts & Plans | `admin/challenges/page.tsx`, `admin/plans/page.tsx`, MT5 credentials, challenge approval/reset | M4 | survey |
| 5 | Risk, Exposure & Trades | `admin/risk/page.tsx`, `admin/trades/page.tsx`, exposure heatmap, toxic flow, pending order override | M5 | survey |
| 6 | Payments, Payouts & KYC | `admin/payments/page.tsx`, `admin/payouts/page.tsx`, `admin/kyc/page.tsx`, approval queues, document streaming | M6 | survey |
| 7 | Settings, System & Whitelabel | `admin/settings/page.tsx`, `email-settings-panel`, `branding-center`, whitelabel config, audit logs, system stats | M7 | survey |
| 8 | Trading Feed & Economic Calendar | `admin/trading-feed/page.tsx`, `price-feed-card`, symbol config, economic news calendar | M8 | survey |
| 9 | Marketing: Banners, Coupons, Affiliates | `admin/banners/page.tsx`, `admin/coupons/page.tsx`, `admin/affiliates/page.tsx` | M9 | survey |
| 10 | Tournaments, Analytics & Builder | `admin/tournaments/page.tsx`, `admin/analytics/page.tsx`, `admin/builder/page.tsx` | M10 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core API Client & Global Standards | Standardize `src/lib/api.ts`, env vars (`NEXT_PUBLIC_API_URL`), mock helper (`Promise.resolve` + 800ms `setTimeout`), fallback error handling, toast (`sonner`)/loader (`Loader2`) utilities | none | DONE |
| M2 | Overview & System KPIs Module | Wire `/dashboard/admin` main overview page & KPI metrics | M1 | DONE |
| M3 | Users & Trader Management Module | Wire `/dashboard/admin/users` and `/dashboard/admin/users/[id]` | M1 | PLANNED |
| M4 | Challenges & Plans Module | Wire `/dashboard/admin/challenges` and `/dashboard/admin/plans` | M1 | PLANNED |
| M5 | Risk, Exposure & Trades Module | Wire `/dashboard/admin/risk` and `/dashboard/admin/trades` | M1 | PLANNED |
| M6 | Payments, Payouts & KYC Module | Wire `/dashboard/admin/payments`, `/admin/payouts`, `/admin/kyc` | M1 | PLANNED |
| M7 | System Settings, Branding & Whitelabel | Wire `/dashboard/admin/settings` (email, branding, whitelabel, audit logs) | M1 | PLANNED |
| M8 | Symbols, Price Feed & Economic News | Wire `/dashboard/admin/trading-feed`, symbol config, news calendar | M1 | PLANNED |
| M9 | Banners, Coupons & Affiliates Module | Wire `/dashboard/admin/banners`, `/admin/coupons`, `/admin/affiliates` | M1 | PLANNED |
| M10 | Tournaments, Analytics & Plan Builder | Wire `/dashboard/admin/tournaments`, `/admin/analytics`, `/admin/builder` | M1 | PLANNED |

## Interface Contracts
### Admin API Client ↔ Next.js Pages
- Base URL: `process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_FXSIM_API || '/api/wp'`
- Authorization header: `Bearer <token>` or WordPress cookie / nonce
- Standard response format: `{ success: boolean, data?: any, error?: string, message?: string }`
- Error Handling: Catch 4xx/5xx/network errors, display `toast.error`, return clean fallback without throwing unhandled exceptions.
- Mocking Pattern: Missing endpoints return `new Promise(res => setTimeout(() => res(mockData), 800))` marked with `// TODO: Real API`.
- UI Polish Standard: Actions use `loading={isSubmitting}` or `disabled={isSubmitting}`, show `<Loader2 className="animate-spin" />` or `<Skeleton />`, trigger `toast.success` / `toast.error`, theme matches dark navy/slate + neon green accents (`#00FF66`).

## Code Layout
- Frontend Root: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1` (or `D:\Spark Propfirm\propfirm-frontend-v10.7.1`)
- Admin Pages: `src/app/dashboard/admin/`
- Admin Components: `src/components/admin/`
- API Wrapper: `src/lib/api.ts`
