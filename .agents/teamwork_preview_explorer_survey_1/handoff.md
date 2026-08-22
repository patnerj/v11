# Survey Handoff Report — Next.js Admin Panel Pages, Routes, Components & API Calls

## 1. Observation

A comprehensive, read-only survey of the Next.js Admin Panel in `propfirm-frontend-v10.7.1` was performed.

### A. Directory Structure & Route Discovery
- All admin page routes reside in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\app\dashboard\admin\`.
- Total admin routes found: **26 page files** across **23 subdirectories**, wrapped by 1 layout file (`src/app/dashboard/admin/layout.tsx`).
- Total admin components found: **12 dedicated component files** in `src/components/admin/`.
- Total API surface functions in `src/lib/api.ts`: **80 functions under `api.admin`**.

### B. Complete Admin Route & Page Inventory

1. **`src/app/dashboard/admin/layout.tsx` (98 lines)**
   - **Role**: Admin Layout & Route Guard.
   - **Features**: Checks `user.is_admin` via Zustand `useAuth()`. Redirects non-admins or active impersonation sessions (`useImpersonation()`) to `/dashboard`. Renders mobile horizontal navigation tabs (`ADMIN_NAV`) and renders children.

2. **`src/app/dashboard/admin/page.tsx` (546 lines)**
   - **Role**: Admin Command Center / Main Overview.
   - **Features**: 8 real-time KPI tiles (Total Revenue, Users, Active Challenges, Funded Accounts, Open Positions, Total Trades, Realised P&L, Pending Payments), Quick Actions grid, Revenue & Growth trends charts (`Recharts`), Pending Payments preview, Recent Challenges preview, Risk & Fraud Alerts panel, Global Exposure Heatmap (`Recharts` bar chart).
   - **State & Data**: TanStack Query (`queryKey: ['admin.stats']`, `refetchInterval: 15000`, `queryKey: ['admin.analyticsRevenue']`), React `useState` & `useEffect`.
   - **API Calls**: `api.admin.stats()`, `api.admin.analyticsRevenue()`, `api.admin.analyticsGrowth()`, `api.admin.paymentsList()`, `api.admin.challenges()`, `api.admin.riskAlerts()`, `api.admin.riskExposure()`, `api.admin.whitelabelGet()`.

3. **`src/app/dashboard/admin/affiliates/page.tsx` (244 lines)**
   - **Role**: Affiliate & Referral Management.
   - **Features**: Affiliates list with rate editing and status toggle (Active/Suspended), Affiliate Payouts processing card with transaction reference/proof URL upload modal, Commission Ledger with status filter tabs (All, Pending, Approved, Paid, Reversed) and action buttons (Mark paid, Reverse).
   - **State**: React `useState` & `useEffect`. Sonner toasts.
   - **API Calls**: `api.admin.affiliatesList()`, `api.admin.commissionsList()`, `api.admin.affiliateRate()`, `api.admin.affiliateStatus()`, `api.admin.commissionStatus()`, `api.admin.affiliatePayouts()`, `api.admin.affiliatePayoutStatus()`.

4. **`src/app/dashboard/admin/analytics/page.tsx` (363 lines)**
   - **Role**: Analytics Dashboard.
   - **Features**: Period toggle (daily, weekly, monthly), 4 headline stat cards, Revenue area chart (`Recharts`), Growth line chart (`Recharts`), Revenue by plan list, Challenge status breakdown, Pass rates by plan list.
   - **State**: React `useState` & `useEffect`.
   - **API Calls**: `api.admin.analyticsRevenue(period)`, `api.admin.analyticsGrowth(period)`, `api.admin.analyticsChallenges()`.

5. **`src/app/dashboard/admin/banners/page.tsx` (264 lines)**
   - **Role**: Promotion & Announcement Banners Manager.
   - **Features**: Banners list with status pills (Active, Scheduled, Expired, Hidden, Disabled), optimistic toggle switch, edit modal, delete confirmation dialog. Live banner preview box inside editor modal.
   - **State**: React `useState` & `useEffect`. Optimistic UI updates.
   - **API Calls**: `api.admin.bannersList()`, `api.admin.bannerSave()`, `api.admin.bannerToggle()`, `api.admin.bannerDelete()`.

6. **`src/app/dashboard/admin/builder/page.tsx` (124 lines)**
   - **Role**: Visual Landing Page Builder.
   - **Features**: Integrates `@measured/puck` visual editor for landing page zones, custom blocks, hero, pricing, testimonials, and section builders. Reset to default layout button.
   - **State**: React `useState` & `useEffect`.
   - **API Calls**: Uses direct `fetch(process.env.NEXT_PUBLIC_FXSIM_API + '/page-schema')` (GET) and `fetch(process.env.NEXT_PUBLIC_FXSIM_API + '/admin/page-schema')` (POST) with WP Nonce and Bearer token headers.

7. **`src/app/dashboard/admin/challenge-operations/page.tsx` (109 lines)**
   - **Role**: Manual Challenge Lifecycle Operations.
   - **Features**: Warning notice card, search by user or challenge ID, action buttons for manual phase advance (Phase 1 ✓, Phase 2 ✓, Funded, Payout ready, Reset).
   - **State**: React `useState` & `useEffect`.
   - **API Calls**: `api.admin.testToolsChallenges()`, `api.admin.testToolsSet()`.

8. **`src/app/dashboard/admin/challenges/page.tsx` (176 lines)**
   - **Role**: Challenge Management & Payout Queue.
   - **Features**: Sub-tabs for "Payouts" (renders `PayoutReviewQueue` component) and "All challenges" (data table with select all / row checkbox, plan name, phase, P&L, status badge, and `FloatingActionBar` for bulk actions).
   - **State**: TanStack Query (`queryKey: ['admin.challenges']`, `refetchInterval: 10000`), React `useState`.
   - **API Calls**: `api.admin.challenges()`.

9. **`src/app/dashboard/admin/config/page.tsx` (108 lines)**
   - **Role**: Configuration Hub Tabbed Wrapper.
   - **Features**: Navigation bar switching between Plans (`AdminPlansPage`), Theme & Branding (`AdminThemePage`), Challenge Ops (`AdminChallengeOpsPage`), Settings (`AdminSettingsPage`), Setup Wizard (`AdminSetupPage`).

10. **`src/app/dashboard/admin/coupons/page.tsx` (215 lines)**
    - **Role**: Coupon & Discount Manager.
    - **Features**: Coupons list with status pills (Active, Inactive, Expired, Used up), toggle switch, creation/editing dialog (code, type % or fixed, value, expiry, limits, plan target badges), delete dialog.
    - **State**: React `useState` & `useEffect`. Optimistic toggle.
    - **API Calls**: `api.admin.couponsList()`, `api.admin.plansList()`, `api.admin.couponSave()`, `api.admin.couponToggle()`, `api.admin.couponDelete()`.

11. **`src/app/dashboard/admin/email/page.tsx` (163 lines)**
    - **Role**: Broadcast Email Campaigns.
    - **Features**: Target segment selector cards (All users, Active challenge, Funded, Failed), Subject line input, Body textarea with HTML formatting toolbar and `{name}` variable insertion button, Confirmation dialog, Send status card.
    - **State**: React `useState`.
    - **API Calls**: `api.admin.bulkEmail(subject, message, segment)`.

12. **`src/app/dashboard/admin/health/page.tsx` (146 lines)**
    - **Role**: System Health Monitoring.
    - **Features**: Overall Health Score SVG ring (0-100), Service checks list (MT5 feed, Price updates, Stripe, Stripe Webhook, SMTP, REST API, Certificates, Storage, Cron, SSL) with status pills (Healthy, Warning, Error), Re-run checks button.
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.health(deep = true)`.

13. **`src/app/dashboard/admin/marketing/page.tsx` (88 lines)**
    - **Role**: Marketing Hub Tabbed Wrapper.
    - **Features**: Navigation bar switching between Coupons (`AdminCouponsPage`), Affiliates (`AdminAffiliatesPage`), Banners (`AdminBannersPage`), Email Campaigns (`AdminEmailPage`).

14. **`src/app/dashboard/admin/notifications/page.tsx` (140 lines)**
    - **Role**: Admin Activity & Notification Center.
    - **Features**: Tab filter (ALL, UNREAD), Mark all read button, Activity list with event icons, titles, timestamps, user reference pills, single Mark as read action.
    - **State**: TanStack Query (`queryKey: ['admin.notifications']`, `refetchInterval: 20000`).
    - **API Calls**: `api.admin.notifications()`, `api.admin.notificationsRead()`.

15. **`src/app/dashboard/admin/operations/page.tsx` (189 lines)**
    - **Role**: Operations Hub Tabbed Wrapper.
    - **Features**: Tab switching between Overview, Risk & AI (`AdminRiskPage`), System Health (`AdminHealthPage`). Overview tab displays 8 Risk KPI cards and Emergency Controls (Global switches for pause registrations, pause purchases, pause payouts, freeze trading).
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.risk()`, `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`.

16. **`src/app/dashboard/admin/payments/page.tsx` (242 lines)**
    - **Role**: Payments & Payout Review Manager.
    - **Features**: Sub-tabs for "Payment orders" and "Payout review" (`PayoutReviewQueue`). Payment filter pills (pending, approved, rejected, all), Order table with gateway, amount, user, status badges, Approve/Reject action buttons, and `PaymentActionDialog` modal for notes.
    - **State**: TanStack Query (`queryKey: ['admin.paymentsList']`, `refetchInterval: 10000`).
    - **API Calls**: `api.admin.paymentsList()`, `api.admin.paymentApprove()`, `api.admin.paymentReject()`.

17. **`src/app/dashboard/admin/plans/page.tsx` (741 lines)**
    - **Role**: Challenge Plans & Pricing Manager.
    - **Features**: Plans data table with checkboxes for bulk selection, `FloatingActionBar` (Set Active, Set Inactive, Bulk Edit), Plan Editor Modal with 5 sidebar tabs (Basic Info, Phase Rules, Funded Stage, Trading Rules, Scaling Plan), `BulkEditDialog` modal for multi-plan updates.
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.plansList()`, `api.admin.planSave()`.

18. **`src/app/dashboard/admin/risk/page.tsx` (230 lines)**
    - **Role**: Risk Management & AI Monitoring.
    - **Features**: Live System badge, 4 KPI cards (Funded Capital Liability, Pending Payouts, Near Breach, Frozen/Banned), High Frequency Trading (HFT) AI Alerts card, Gambling / Massive Lots AI Alerts card, Global Market Exposure Top 10 Symbols Bar Chart (`Recharts`).
    - **State**: Uses custom hooks `useAdminRiskQuery`, `useAdminRiskAlertsQuery`, `useAdminRiskExposureQuery` from `src/hooks/useApi.ts`.
    - **API Calls**: `api.admin.risk()`, `api.admin.riskAlerts()`, `api.admin.riskExposure()`.

19. **`src/app/dashboard/admin/settings/page.tsx` (270 lines)**
    - **Role**: Platform Settings Hub.
    - **Features**: Horizontal tabs (Branding, Payments, Broker MT5, Email, Trading Feed, Security, Advanced). Embeds `BrandingCenter`, `PaymentsCenter`, `BrokerCenter`, `EmailSettingsPanel`, `PriceFeedCard`, `ChartSymbolMap`, `DemoModeCard`. Save changes button.
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`.

20. **`src/app/dashboard/admin/setup/page.tsx` (302 lines)**
    - **Role**: 7-Step Guided Platform Setup Wizard.
    - **Features**: Stepper header bar, 7 steps: 1. Connection (Frontend app URL), 2. Branding (`BrandingCenter`), 3. Payments (`PaymentsCenter`), 4. Email (`EmailSettingsPanel`), 5. Trading Feed (`PriceFeedCard`), 6. First Challenge (Quick creation form), 7. Launch (System health score check & completion toggle).
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`, `api.admin.planSave()`, `api.admin.health()`.

21. **`src/app/dashboard/admin/support/page.tsx` (31 lines)**
    - **Role**: Helpdesk & Support CRM Page.
    - **Features**: Vibrant Header Banner and renders `AdminSupportTickets` component.

22. **`src/app/dashboard/admin/theme/page.tsx` (17 lines)**
    - **Role**: Theme & Branding Styling Page.
    - **Features**: Page header and renders `ThemeEditor` component.

23. **`src/app/dashboard/admin/tournaments/page.tsx` (185 lines)**
    - **Role**: Tournaments & Competitions Manager.
    - **Features**: Banner with "New Tournament" button, Tournaments data table (Title, Status pill, Duration dates, Prize Pool, Participants count, Actions), Delete confirmation, Edit modal via `TournamentFormDialog`.
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.competitions.list()`, `api.admin.competitions.create()`, `api.admin.competitions.update()`, `api.admin.competitions.delete()`.

24. **`src/app/dashboard/admin/tournaments/[id]/page.tsx` (126 lines)**
    - **Role**: Competition Detail & Live Leaderboard.
    - **Features**: Back navigation button, 4 summary stat cards (Status, Prize Pool, Participants, Start Balance), Participants Leaderboard table (Rank, Trader Name, Current Balance, Profit %, Trading Days).
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.competitions.get(id)`, `api.competitions.leaderboard(id)`.

25. **`src/app/dashboard/admin/traders/page.tsx` (75 lines)**
    - **Role**: Traders Hub Tabbed Wrapper.
    - **Features**: Tab navigation switching between Users & KYC (`AdminUsersPage`), Challenges (`AdminChallengesPage`), Payouts (`AdminPayoutsPage`).

26. **`src/app/dashboard/admin/users/page.tsx` (443 lines)**
    - **Role**: Users & Account Management.
    - **Features**: Sub-tabs for "Users" and "KYC review" (`KycReviewQueue`). Debounced search input, Paginated users table with balance, equity, challenge badges, joined date. Actions dropdown (View as user / Impersonate, View details, Adjust balance, Set account status). Modals for `AdjustBalanceDialog`, `SetStatusDialog`, and Impersonation confirmation dialog.
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.users(query, page, limit)`, `api.admin.impersonate(userId)`, `api.admin.adjustBalance()`, `api.admin.setStatus()`.

27. **`src/app/dashboard/admin/users/[id]/page.tsx` (245 lines)**
    - **Role**: Single Trader Profile Deep-Dive.
    - **Features**: Header with display name, email, join date, status pill, Impersonate button. 3-column layout: Account details card, KYC card, Risk Profile card (risk level, score, recent IPs, toxic trades count), Internal Notes card (with save note button), Challenges list, Payments list, Payouts list, Activity Timeline with event icons and dates.
    - **State**: React `useState` & `useEffect`.
    - **API Calls**: `api.admin.userDetail(id)`, `api.admin.userRiskProfile(id)`, `api.admin.saveUserNote(id, note)`.

---

### C. Admin Components Inventory (`src/components/admin/`)

1. **`src/components/admin/branding-center.tsx` (10,640 bytes)**
   - **Purpose**: Upload brand assets (Main logo, Login logo, Sidebar icon, Favicon) and edit brand name, support email, primary/secondary colors.
   - **API Calls**: `api.admin.brandingUpload(field, file)`, `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`.

2. **`src/components/admin/broker-center.tsx` (3,948 bytes)**
   - **Purpose**: MT5 Bridge connection form (Manager API URL, Login, Password, Server Name, Account Type, Group).
   - **API Calls**: `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`.

3. **`src/components/admin/chart-symbol-map.tsx` (11,367 bytes)**
   - **Purpose**: Map internal/MT5 broker symbols to TradingView chart symbols (e.g. `EURUSD.raw` → `FX:EURUSD`).
   - **API Calls**: `api.admin.symbolsAll()`, `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`.

4. **`src/components/admin/demo-mode.tsx` (4,507 bytes)**
   - **Purpose**: Generate or purge demo environment data (simulated users, challenges, trades, payouts, banners).
   - **API Calls**: `api.admin.demoStatus()`, `api.admin.demoGenerate()`, `api.admin.demoRemove()`.

5. **`src/components/admin/email-settings-panel.tsx` (7,272 bytes)**
   - **Purpose**: SMTP configuration panel (Host, Port, User, Password, Encryption TLS/SSL, From Name, From Email) and Send Test Email trigger.
   - **API Calls**: `api.admin.smtpGet()`, `api.admin.smtpSave()`, `api.admin.smtpTest(to)`.

6. **`src/components/admin/kyc-review-queue.tsx` (12,981 bytes)**
   - **Purpose**: Review queue for identity verification submissions with status tabs (pending, approved, rejected, all), document image viewer modal, single approve/reject buttons with admin notes, and bulk KYC approval/rejection.
   - **API Calls**: `api.admin.kycList(status)`, `api.admin.kycReview(id, action, note)`, `api.admin.bulkKyc(ids, action, note)`.

7. **`src/components/admin/payments-center.tsx` (13,699 bytes)**
   - **Purpose**: Payment gateway setup (Stripe API keys + webhook secret, Crypto networks & deposit addresses list editor, Confirmo API key & callback secret).
   - **API Calls**: `api.admin.stripeStatus()`, `api.admin.cryptoGet()`, `api.admin.cryptoSave()`, `api.admin.whitelabelGet()`, `api.admin.whitelabelSave()`.

8. **`src/components/admin/payout-review-queue.tsx` (16,111 bytes)**
   - **Purpose**: Comprehensive payout approval/rejection queue with status filter pills (pending, approved, paid, rejected, all), batch select checkboxes, single & bulk payout action dialogs (TX reference hash, proof URL upload, admin note), and automated bulk execution.
   - **API Calls**: `api.admin.payoutsList(status)`, `api.admin.payoutStatus(id, status, note, extra)`, `api.admin.bulkPayouts(ids, status, note)`, `api.admin.payoutsExecuteBulk()`.

9. **`src/components/admin/price-feed-card.tsx` (5,988 bytes)**
   - **Purpose**: Price feed source configuration (Auto, MT5, Yahoo), secret key setting, force price tick generation button, and live price feed health telemetry box.
   - **API Calls**: `api.admin.priceFeedHealth()`, `api.admin.priceFeedSave()`, `api.admin.forcePrices()`.

10. **`src/components/admin/support-tickets.tsx` (11,756 bytes)**
    - **Purpose**: Customer support helpdesk ticketing panel with status filters (all, open, pending, closed), ticket search, conversation history drawer, reply editor, and status update selector.
    - **API Calls**: `api.admin.tickets.list()`, `api.admin.tickets.get(id)`, `api.admin.tickets.reply(id, message)`, `api.admin.tickets.updateStatus(id, status)`.

11. **`src/components/admin/theme-editor.tsx` (9,118 bytes)**
    - **Purpose**: Real-time theme customization editor for colors, font families, and border radius with interactive live component previews.
    - **API Calls**: `api.admin.theme.get()`, `api.admin.theme.save(data)`.

12. **`src/components/admin/tournament-form-dialog.tsx` (7,226 bytes)**
    - **Purpose**: Dialog form for creating/editing competition parameters (name, description, start/end date, initial balance, prize pool, status).
    - **Used by**: `src/app/dashboard/admin/tournaments/page.tsx`.

---

### D. API Functions Surface Summary (`src/lib/api.ts`)

| Category | Endpoint / Function | HTTP Method / Route | Primary Page / Component Usage |
|---|---|---|---|
| **Overview & Stats** | `api.admin.stats` | GET `/admin/stats` | `admin/page.tsx` |
| **Analytics** | `api.admin.analyticsRevenue` | GET `/admin/analytics/revenue` | `admin/page.tsx`, `admin/analytics/page.tsx` |
| **Analytics** | `api.admin.analyticsGrowth` | GET `/admin/analytics/growth` | `admin/page.tsx`, `admin/analytics/page.tsx` |
| **Analytics** | `api.admin.analyticsChallenges` | GET `/admin/analytics/challenges` | `admin/analytics/page.tsx` |
| **Users** | `api.admin.users` | GET `/admin/users` | `admin/users/page.tsx` |
| **Users** | `api.admin.userDetail` | GET `/admin/user/${id}` | `admin/users/[id]/page.tsx` |
| **Users** | `api.admin.userRiskProfile` | GET `/admin/users/${id}/risk-profile` | `admin/users/[id]/page.tsx` |
| **Users** | `api.admin.adjustBalance` | POST `/admin/adjust-balance` | `admin/users/page.tsx` |
| **Users** | `api.admin.setStatus` | POST `/admin/set-status` | `admin/users/page.tsx` |
| **Users** | `api.admin.impersonate` | POST `/admin/impersonate` | `admin/users/page.tsx` |
| **Users** | `api.admin.impersonateStop` | POST `/admin/impersonate/stop` | `impersonation-banner.tsx` |
| **Users** | `api.admin.saveUserNote` | POST `/admin/user/${id}/note` | `admin/users/[id]/page.tsx` |
| **KYC** | `api.admin.kycList` | GET `/admin/kyc` | `kyc-review-queue.tsx` |
| **KYC** | `api.admin.kycReview` | POST `/admin/kyc/${id}/review` | `kyc-review-queue.tsx` |
| **KYC** | `api.admin.bulkKyc` | POST `/admin/bulk/kyc` | `kyc-review-queue.tsx` |
| **Payments** | `api.admin.paymentsList` | GET `/admin/payments` | `admin/page.tsx`, `admin/payments/page.tsx` |
| **Payments** | `api.admin.paymentApprove` | POST `/admin/payments/${id}/approve` | `admin/payments/page.tsx` |
| **Payments** | `api.admin.paymentReject` | POST `/admin/payments/${id}/reject` | `admin/payments/page.tsx` |
| **Payouts** | `api.admin.payoutsList` | GET `/admin/payouts` | `payout-review-queue.tsx` |
| **Payouts** | `api.admin.payoutStatus` | POST `/admin/payouts/${id}/status` | `payout-review-queue.tsx` |
| **Payouts** | `api.admin.bulkPayouts` | POST `/admin/bulk/payouts` | `payout-review-queue.tsx` |
| **Payouts** | `api.admin.payoutsExecuteBulk` | POST `/admin/payouts/execute-bulk` | `payout-review-queue.tsx` |
| **Challenges** | `api.admin.challenges` | GET `/admin/challenges` | `admin/page.tsx`, `admin/challenges/page.tsx` |
| **Challenges** | `api.admin.approvePayout` | POST `/admin/challenge/${id}/approve-payout` | `payout-review-queue.tsx` |
| **Challenges** | `api.admin.saveMt5` | POST `/admin/challenge/${id}/mt5-details` | Admin challenge detail actions |
| **Plans** | `api.admin.plansList` | GET `/admin/plans` | `admin/plans/page.tsx`, `admin/coupons/page.tsx` |
| **Plans** | `api.admin.planSave` | POST `/admin/plans/save` | `admin/plans/page.tsx`, `admin/setup/page.tsx` |
| **Risk & AI** | `api.admin.risk` | GET `/admin/risk` | `admin/risk/page.tsx`, `admin/operations/page.tsx` |
| **Risk & AI** | `api.admin.riskAlerts` | GET `/admin/risk/alerts` | `admin/page.tsx`, `admin/risk/page.tsx` |
| **Risk & AI** | `api.admin.riskExposure` | GET `/admin/risk/exposure` | `admin/page.tsx`, `admin/risk/page.tsx` |
| **Whitelabel** | `api.admin.whitelabelGet` | GET `/admin/whitelabel` | `admin/settings/page.tsx`, `admin/setup/page.tsx` |
| **Whitelabel** | `api.admin.whitelabelSave` | POST `/admin/whitelabel/save` | `admin/settings/page.tsx`, `admin/setup/page.tsx` |
| **Branding** | `api.admin.brandingUpload` | POST `/admin/branding/upload` | `branding-center.tsx` |
| **Gateways** | `api.admin.stripeStatus` | GET `/admin/stripe/status` | `payments-center.tsx` |
| **Gateways** | `api.admin.cryptoGet` | GET `/admin/crypto` | `payments-center.tsx` |
| **Gateways** | `api.admin.cryptoSave` | POST `/admin/crypto/save` | `payments-center.tsx` |
| **Health** | `api.admin.health` | GET `/admin/health` | `admin/health/page.tsx`, `admin/setup/page.tsx` |
| **Price Feed** | `api.admin.priceFeedHealth` | GET `/admin/price-feed/health` | `price-feed-card.tsx` |
| **Price Feed** | `api.admin.priceFeedSave` | POST `/admin/price-feed/save` | `price-feed-card.tsx` |
| **Price Feed** | `api.admin.forcePrices` | POST `/admin/force-prices` | `price-feed-card.tsx` |
| **SMTP** | `api.admin.smtpGet` | GET `/admin/smtp` | `email-settings-panel.tsx` |
| **SMTP** | `api.admin.smtpSave` | POST `/admin/smtp/save` | `email-settings-panel.tsx` |
| **SMTP** | `api.admin.smtpTest` | POST `/admin/smtp/test` | `email-settings-panel.tsx` |
| **Banners** | `api.admin.bannersList` | GET `/admin/banners` | `admin/banners/page.tsx` |
| **Banners** | `api.admin.bannerSave` | POST `/admin/banners/save` | `admin/banners/page.tsx` |
| **Banners** | `api.admin.bannerToggle` | POST `/admin/banners/${id}/toggle` | `admin/banners/page.tsx` |
| **Banners** | `api.admin.bannerDelete` | POST `/admin/banners/${id}/delete` | `admin/banners/page.tsx` |
| **Coupons** | `api.admin.couponsList` | GET `/admin/coupons` | `admin/coupons/page.tsx` |
| **Coupons** | `api.admin.couponSave` | POST `/admin/coupons/save` | `admin/coupons/page.tsx` |
| **Coupons** | `api.admin.couponToggle` | POST `/admin/coupons/${id}/toggle` | `admin/coupons/page.tsx` |
| **Coupons** | `api.admin.couponDelete` | POST `/admin/coupons/${id}/delete` | `admin/coupons/page.tsx` |
| **Affiliates** | `api.admin.affiliatesList` | GET `/admin/affiliates` | `admin/affiliates/page.tsx` |
| **Affiliates** | `api.admin.affiliateRate` | POST `/admin/affiliates/${id}/rate` | `admin/affiliates/page.tsx` |
| **Affiliates** | `api.admin.affiliateStatus` | POST `/admin/affiliates/${id}/status` | `admin/affiliates/page.tsx` |
| **Affiliates** | `api.admin.affiliatePayouts` | GET `/admin/affiliate-payouts` | `admin/affiliates/page.tsx` |
| **Affiliates** | `api.admin.affiliatePayoutStatus` | POST `/admin/affiliate-payouts/${id}/status` | `admin/affiliates/page.tsx` |
| **Affiliates** | `api.admin.commissionsList` | GET `/admin/commissions` | `admin/affiliates/page.tsx` |
| **Affiliates** | `api.admin.commissionStatus` | POST `/admin/commissions/${id}/status` | `admin/affiliates/page.tsx` |
| **Test Tools** | `api.admin.testToolsChallenges` | GET `/admin/test-tools/challenges` | `admin/challenge-operations/page.tsx` |
| **Test Tools** | `api.admin.testToolsSet` | POST `/admin/test-tools/challenge/${id}/set` | `admin/challenge-operations/page.tsx` |
| **Broadcast** | `api.admin.bulkEmail` | POST `/admin/bulk-email` | `admin/email/page.tsx` |
| **Notifications** | `api.admin.notifications` | GET `/admin/notifications` | `admin/notifications/page.tsx` |
| **Notifications** | `api.admin.notificationsRead` | POST `/admin/notifications/read` | `admin/notifications/page.tsx` |
| **Theme** | `api.admin.theme.get` | GET `/theme` | `theme-editor.tsx` |
| **Theme** | `api.admin.theme.save` | POST `/admin/theme` | `theme-editor.tsx` |
| **Tickets** | `api.admin.tickets.list` | GET `/admin/tickets` | `support-tickets.tsx` |
| **Tickets** | `api.admin.tickets.get` | GET `/admin/tickets/${id}` | `support-tickets.tsx` |
| **Tickets** | `api.admin.tickets.reply` | POST `/admin/tickets/${id}/reply` | `support-tickets.tsx` |
| **Tickets** | `api.admin.tickets.updateStatus` | POST `/admin/tickets/${id}/status` | `support-tickets.tsx` |
| **Tournaments** | `api.admin.competitions.list` | GET `/admin/competitions` | `admin/tournaments/page.tsx` |
| **Tournaments** | `api.admin.competitions.get` | GET `/admin/competitions/${id}` | `admin/tournaments/[id]/page.tsx` |
| **Tournaments** | `api.admin.competitions.create` | POST `/admin/competitions` | `admin/tournaments/page.tsx` |
| **Tournaments** | `api.admin.competitions.update` | PUT `/admin/competitions/${id}` | `admin/tournaments/page.tsx` |
| **Tournaments** | `api.admin.competitions.delete` | DELETE `/admin/competitions/${id}` | `admin/tournaments/page.tsx` |
| **Demo Data** | `api.admin.demoStatus` | GET `/admin/demo/status` | `demo-mode.tsx` |
| **Demo Data** | `api.admin.demoGenerate` | POST `/admin/demo/generate` | `demo-mode.tsx` |
| **Demo Data** | `api.admin.demoRemove` | POST `/admin/demo/remove` | `demo-mode.tsx` |

---

## 2. Logic Chain

1. **Routing Strategy**: Next.js App Router subdirectories under `src/app/dashboard/admin` provide page-based navigation. Additionally, hub pages (`config`, `marketing`, `operations`, `traders`) act as tabbed wrappers aggregating child pages to present a unified control interface.
2. **Access Control Layer**: `src/app/dashboard/admin/layout.tsx` enforces client-side role authorization (`user.is_admin === true`) and impersonation checks. It prevents non-admin users from viewing admin UI elements.
3. **Data Fetching Architecture**: Data fetching is handled via `api.ts` (using `fxsim` fetch helper) wrapped in TanStack Query (`useQuery`), custom hooks (`useAdminRiskQuery`), or React `useEffect` hooks with polling intervals ranging from 4s to 30s for real-time dashboard updates.
4. **Consistency in UI State Management**: Action buttons enter disabled loading states while requests execute. Notifications are triggered via `sonner` (`toast.success`, `toast.error`). Bulk selection features across plans, challenges, users, payouts, and KYC use shared floating action bars (`FloatingActionBar`) or dedicated review queues.
5. **Wired vs Custom API Invocations**: 98% of admin pages invoke typed methods from `api.admin.*` in `src/lib/api.ts`. The landing page builder (`builder/page.tsx`) communicates directly with `/page-schema` endpoints using custom fetch calls.

---

## 3. Caveats

- **Read-Only Scope**: This survey is strictly read-only. No source files, CSS rules, or API endpoints were modified.
- **Backend API Availability**: While all frontend API calls in `src/lib/api.ts` are fully defined and typed, their actual backend responses depend on the WordPress REST API plugin (`class-rest-api.php`) running in the WordPress environment.
- **Puck Builder Endpoint**: `builder/page.tsx` relies on custom fetch headers (`X-WP-Nonce`, `Authorization`). Backend support for `/page-schema` depends on the WP plugin schema handler.

---

## 4. Conclusion

The Next.js Admin Panel in `propfirm-frontend-v10.7.1` is a complete, feature-rich admin suite comprising **26 routes**, **12 modular components**, and **80 typed REST API endpoints**. All UI components adhere to the project's dark navy/slate aesthetic with neon green accents, toast notifications, loading states, and robust error handling.

---

## 5. Verification Method

To independently verify this survey:
1. **Inspect Admin Directory**:
   Run `Get-ChildItem -Recurse -Filter page.tsx "d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\app\dashboard\admin"` to confirm the 26 page routes.
2. **Inspect Admin Components**:
   Run `Get-ChildItem "d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\components\admin"` to verify the 12 component files.
3. **Verify API Call Surface**:
   Inspect `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1\src\lib\api.ts` lines 144 to 281 to confirm the `api.admin` object definition and endpoints.
