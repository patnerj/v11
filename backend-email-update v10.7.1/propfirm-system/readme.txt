=== PropFirm System ===
Contributors: propfirm-system
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 8.0
Stable tag: 3.0.0
License: GPLv2 or later

Complete white-label prop firm platform for WordPress — challenge engine, payment verification, funded accounts, payout system, and full admin panel.

== Description ==

PropFirm System turns your WordPress site into a real funded trader platform. Users register, select a challenge plan, submit payment, and get a funded account after admin approval. The entire challenge flow — phase progression, drawdown tracking, breach detection, payouts — is automated.

**Platform Flow:**
1. User registers → lands on /dashboard/
2. No pre-funded balance — onboarding CTA to /challenges/
3. User selects plan → 3-step payment modal (plan → payment instructions → proof upload)
4. Admin reviews payment screenshot → approves or rejects
5. On approval: isolated challenge account created automatically
6. User accesses /trading/ (gated — requires active challenge)
7. Trades tracked against phase rules in real time
8. Auto-breach locks account on rule violation
9. Phase completion → auto-promote to next phase
10. All phases passed → funded status → payout requests enabled
11. Admin approves payout → profit split applied

**Key Features:**
* Multi-phase challenge system (Phase 1 → Phase 2 → Funded)
* Per-challenge isolated trading accounts (separate balance, PnL, history per challenge)
* Manual payment flow with screenshot/proof upload
* CoinPayments gateway architecture (prepared for integration)
* Admin payment review: approve/reject with screenshot preview
* Market hours enforcement (Forex/Metals weekdays only, Crypto 24/7)
* 14 live instruments: Forex, Metals, Crypto (Yahoo Finance, 30-second updates)
* TradingView professional charts with per-symbol drawing persistence (localStorage)
* Real-time rule evaluation: daily DD, max DD, profit target, trading days
* Auto-breach detection with force-close and account freeze
* Payout system with configurable profit split % and minimum trading days
* Professional HTML emails: welcome, challenge activated, phase passed, funded, failed, payment rejected
* Discord/Telegram webhook notifications
* White-label: brand name, colors, logo, payment instructions, bank/crypto details
* Terminal access gate — no challenge = no trading access
* Dashboard onboarding state — no fake balance for new users
* Admin panel: challenges, plans, payments, payouts, users, symbols, audit log, whitelabel

== Installation ==

1. Upload `propfirm-system/` to `/wp-content/plugins/`
2. Activate via Plugins > Installed Plugins
3. Set Permalinks to "Post name" under Settings > Permalinks
4. Pages auto-created on activation: /dashboard/, /challenges/, /trading/, /login/, /register/, /landing/
5. Configure challenge plans under PropFirm System > Plans
6. Set payment instructions under PropFirm System > White Label
7. Test: register an account → browse challenges → select plan → submit proof → approve in admin

== Challenge Rules ==

* Profit target (configurable % of starting balance)
* Daily drawdown limit (% of day-open balance, resets midnight UTC)
* Max drawdown limit (% of starting balance)
* Minimum trading days before payout eligible
* Maximum trading days (phase time limit)
* Leverage cap
* Market hours: Forex/Metals weekdays only, Crypto 24/7

== Payment Gateways ==

* Manual (default): user uploads payment screenshot, admin approves
* CoinPayments: architecture prepared, ready for API key configuration
* Stripe: stub prepared for future integration

== REST API Endpoints ==

Base: `/wp-json/fxsim/v1/`

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /prices | Public |
| GET | /account | User |
| GET | /positions | User |
| POST | /open | User |
| POST | /close/{id} | User |
| POST | /sltp/{id} | User |
| GET | /history | User |
| GET | /transactions | User |
| GET | /stats | User |
| GET | /symbols | User |
| GET | /challenge/plans | Public |
| POST | /challenge/start | User |
| GET | /challenge/my | User |
| GET | /challenge/{id}/metrics | User |
| POST | /challenge/{id}/payout | User |
| POST | /payment/create | User |
| POST | /payment/submit-proof | User |
| GET | /payment/my-orders | User |
| GET | /admin/stats | Admin |
| GET | /admin/users | Admin |
| POST | /admin/adjust-balance | Admin |
| POST | /admin/set-status | Admin |
| GET | /admin/challenges | Admin |
| POST | /admin/challenge/{id}/approve-payout | Admin |
| GET | /admin/plans | Admin |
| POST | /admin/plans/save | Admin |
| GET | /admin/payments | Admin |
| POST | /admin/payments/{id}/approve | Admin |
| POST | /admin/payments/{id}/reject | Admin |
| GET | /admin/whitelabel | Admin |
| POST | /admin/whitelabel/save | Admin |
| POST | /admin/force-prices | Admin |

== Changelog ==

= 3.0.0 =
* Renamed from "FX Simulation" to "PropFirm System"
* Registration blank page fixed — POST handled at template_redirect hook before HTML output
* No auto demo account on registration — users must purchase a challenge
* Per-challenge isolated accounts (separate balance, PnL, history per challenge)
* Manual payment system: proof upload, admin screenshot review, approve/reject
* Challenge_start gated behind payment approval (free plans bypass)
* CoinPayments gateway architecture prepared
* Market hours enforcement client + server side
* Terminal access gate (requires active challenge)
* Dashboard onboarding state (no fake balance)
* Professional HTML emails for all events including payment_rejected
* Admin: Payments menu with screenshot preview, approve/reject, reject reason modal
* Admin: Dashboard shows pending payments count with blink alert
* WhiteLabel: payment instructions, bank details, crypto address fields
* Terminal "Open Terminal" opens in new tab
* All REST endpoints use challenge-specific account IDs (no stale get_account(user_id))
