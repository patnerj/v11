# Project: Dashboard Overview Crash Fix & Data Edge Case Safety

## Architecture
- Component: Propfirm Frontend (`d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`)
- Main Page: `src/app/dashboard/page.tsx`
- Section Error Isolation: `src/components/ui/section-error-boundary.tsx`
- UI Widgets: `challenge-progress-card.tsx`, `equity-chart.tsx`, `kyc-status-card.tsx`, `performance-insights.tsx`, `trader-badges.tsx`, `stat-card.tsx`
- Data Layer & Hooks: `src/hooks/useApi.ts`
- Backend API: `d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system\includes\challenge\class-challenge-engine.php`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Section Error Boundary Component | Reusable SectionErrorBoundary component with fallback card UI and retry button | M1 | Survey |
| 2 | Dashboard Page Widget Isolation | Wrap all dashboard widgets in SectionErrorBoundary in `page.tsx` | M1 | Survey |
| 3 | EquityChart Defensive Guards | Guard `data` prop with Array.isArray and fallback empty array | M2 | Survey |
| 4 | ChallengeProgressCard Null Safety | Optional chaining on `m.challenge` and fallback default values | M2 | Survey |
| 5 | KycStatusCard Status Lookup Fallback | Guard status lookup in `META` record with default `'not_started'` | M2 | Survey |
| 6 | TraderBadges & PerformanceInsights Protection | Replace unsafe iterations with Array.isArray checks | M2 | Survey |
| 7 | RecentTradesTable & OtherChallengesCard Guards | Replace strict `=== null` checks with `!Array.isArray` | M2 | Survey |
| 8 | Dashboard Page metrics Structural Guard | Implement `hasMetrics` structural validation in `page.tsx` | M2 | Survey |
| 9 | API Hooks Safe Fallback Returns | Update `useApi.ts` query functions to return safe fallbacks on domain errors | M3 | Survey |
| 10 | Backend get_metrics Response Normalization | Update `class-challenge-engine.php` to return `null` instead of empty array `[]` | M3 | Survey |
| 11 | Type Check & Build Verification | Run `npm run type-check` and `npm run build` | M4 | Survey |
| 12 | End-to-End Edge Case Testing | Test simulated null, malformed, empty, and partial data scenarios | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Error Boundary & Section Isolation | Create `SectionErrorBoundary` and wrap all dashboard widgets in `page.tsx` | none | IN_PROGRESS |
| M2 | Component Defensive Guards & Data Normalization | Add optional chaining, Array.isArray checks, safe dictionary lookups, and `hasMetrics` guard across all dashboard components | M1 | PLANNED |
| M3 | Data Layer & Backend Safety | Update `useApi.ts` and `class-challenge-engine.php` for safe default returns | M2 | PLANNED |
| M4 | Comprehensive Verification & Hardening | Execute `type-check`, `build`, simulated data testing, Challenger verification, and Forensic Audit | M1, M2, M3 | PLANNED |

## Code Layout
- Frontend codebase: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`
- Backend codebase: `d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system`
- Orchestrator folder: `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_orchestrator_1`
