# Task: Verify and close the /admin vs /dashboard/admin feature gap

## Background

This Next.js + WordPress prop-trading-firm platform currently has **two separate admin panel implementations** living side by side in the frontend:

- `/admin/*` (`src/app/admin/`) — was accidentally deleted earlier in a prior session, then rebuilt from scratch by you (Gemini) in a later session. Richer visual design on the pages it has (Command Center overview, Traders directory, etc.), and consolidates many things into fewer "hub" pages with internal tabs (e.g. `admin/config` has 8 tabs, `admin/marketing` has 5 tabs).
- `/dashboard/admin/*` (`src/app/dashboard/admin/`) — the older, more fragmented tree, one route per feature (28 top-level pages vs `/admin`'s 14).

The plan is to eventually make `/admin` the only admin panel and delete `/dashboard/admin` — but only once every real capability in `/dashboard/admin` has an equivalent in `/admin`. A prior audit (Claude, using a 15-agent parallel code review) compared all 14 `/dashboard/admin`-exclusive pages against the entire `/admin` tree and found 4 fully covered, 9 partially covered, and 2 not covered at all. One of the most severe findings — that editing an existing scheduled/page-scoped promotional banner through `/admin/marketing` silently wipes its scheduling and page-targeting on save — was independently reproduced live (real DB before/after check, not just code reading) and **confirmed genuinely real**, so treat the rest of this list as high-confidence, not speculative.

## Your task

1. **Independently verify** each item below against the actual code (and live-test where practical — this app runs via `npm run dev` with a WordPress REST backend). Don't just trust this document; read the real files and confirm or refute each claim with your own evidence (file/line references, or a live before/after DB check like the banner one). If you find a claim is wrong, say so explicitly with your evidence — the goal is truth, not agreement.
2. For everything you confirm as a genuine gap, **produce a prioritized implementation plan** to close it inside `/admin` (adapting to `/admin`'s existing tab/hub conventions — don't just copy-paste `/dashboard/admin` pages wholesale; match the surrounding page's patterns, e.g. `admin/marketing/page.tsx`'s tab structure, `admin/config/page.tsx`'s modal sections).
3. Do **not** touch or delete `/dashboard/admin` — it stays as the working reference/fallback until every item below is closed and independently re-verified.

## Items to verify

### Confirmed real (already reproduced live — implement the fix, no need to re-verify)

**Banner scheduling/scope wiped on save.** `admin/marketing/page.tsx`'s banner edit form has no `scope_type`, `scope_path`, `starts_at`, `ends_at`, or `countdown_to` fields. `admin_banner_save()` in `class-rest-api.php` (~line 6337) unconditionally builds these keys into the `$data` array passed to `$wpdb->update()` (defaulting `scope_type` to `'global'`, others to `null`), so saving an existing banner that had real scheduling/page-targeting data silently erases it. Fix: add the missing fields to the edit form (a 3-column Starts/Ends/Countdown row + a Scope select with conditional Page-path input, matching `dashboard/admin/banners/page.tsx`'s `BannerEditor` for the exact field set), and make sure `openEditBanner()` populates them from the fetched banner.

### Needs your independent verification

For each, the original audit's claim is summarized — confirm or refute, then plan the fix if real:

1. **Homepage builder — nothing exists in `/admin`.** `dashboard/admin/builder/page.tsx` is a full drag-and-drop page builder (`@measured/puck` library) that edits the actual public homepage content (Hero, Testimonials, HowItWorks, etc.) via a `/admin/page-schema` GET/POST endpoint — confirmed this is what `src/app/page.tsx` (the live public homepage) actually renders. Claim: no equivalent UI exists anywhere in `/admin` — `admin/config`'s "Whitelabel & Media" tab only edits brand name/colors/logo, not page layout/content. If confirmed, this is probably the highest-priority item — right now there would be no way to edit the homepage at all if `/dashboard/admin` were removed.

2. **Plans — Phase 2 force-synced to Phase 1, Phase 3 has no UI at all.** In `admin/config/page.tsx`'s Plan Builder modal (drawdown section), claim: changing Phase 1's daily DD / max DD / min days silently overwrites the Phase 2 equivalents to match (and max days to double), with no separate Phase 2 row; Phase 3 fields (`p3_profit_target`, `p3_daily_dd`, etc.) have zero input anywhere despite "3-Step Sovereign" being a selectable plan type. Also claimed missing: `margin_call_level`, `ip_matching_required`, `max_lot_size`, `sort_order` fields, and bulk Set-Active/Inactive + multi-field bulk-edit (only bulk-delete and factory-reset exist).

3. **Coupons — Edit is dead code.** Claim: `admin/marketing/page.tsx` declares `editingCoupon` state and has an "Edit Coupon" modal title branch, but `setEditingCoupon` is only ever called with `null` — there's no code path that populates it from a real coupon, and the Actions column only has Delete. Also claimed missing: active/inactive toggle, per-user limit field, plan-restriction selector, per-coupon revenue reporting.

4. **Affiliates — no per-affiliate rate edit, no suspend, no commission ledger, no payout-request queue.** Claim: `admin/marketing/page.tsx`'s Affiliates tab shows commission rate read-only, has no suspend/activate action, fetches commissions but never renders them as a manageable list, and its "Execute Affiliate Payout" modal creates a fresh admin-initiated payout rather than reviewing/approving affiliate-submitted payout requests (a different backend flow: `affiliatePayoutCreate` vs `affiliatePayouts`/`affiliatePayoutStatus`).

5. **Health dashboard shows fake data.** Claim: `admin/operations/page.tsx`'s health tab fetches the real `api.admin.health(true)` response but only ever reads `.score` — the "Core Infrastructure & Service Nodes" grid is a hardcoded array with fixed fake `status: 'operational'` and fake latency/uptime strings, not derived from the real per-check `items` (mt5_feed, stripe, smtp, ssl, cron, etc.) that the API actually returns.

6. **Settings — several config surfaces missing.** Claim: no manual-crypto wallet-address management (per network: TRC20/BEP20/ERC20/BTC/ETH address+label+instructions), no Confirmo gateway config, no manual-payment-instructions text field, no MT5 price-feed ingest-secret field, no chart/symbol map (per-instrument TradingView override + enable/disable), and only 2 of 4 branding media slots (missing distinct login-page logo and sidebar icon).

7. **Setup wizard gaps** — same Confirmo/crypto gaps as #6 (the wizard shares the `PaymentsCenter` component), plus no `setup_completed` onboarding-flag tracking anywhere in `/admin`.

8. **Theme — no custom color entry, no border-radius control.** Claim: `admin/config`'s branding tab only offers 8 fixed accent-color presets (confirmed: Midnight Obsidian/Electric Blue/Gold Sovereign/Crimson Edge/Cyberpunk Violet/Nordic Cyan/Rose Gold/Solar Flare), no free-text hex entry, and no UI-wide border-radius setting anywhere.

9. **User detail — no "View as user" impersonation button.** Claim: `admin/traders/[id]/page.tsx` covers KYC/financials/notes/timeline but has no impersonation trigger, unlike `dashboard/admin/users/[id]/page.tsx`.

10. **Challenge Operations — no per-account test tools.** Claim: `dashboard/admin/challenge-operations/page.tsx` lets an admin force one existing challenge account's lifecycle state (mark phase1/phase2 complete, force-fund, force payout-ready, or reset to Phase 1 clearing breaches) via `testToolsSet()`. Claim: nothing in `/admin` does this — the closest features (rule overrides, freeze/unfreeze, bulk demo-seed/purge) are different capabilities, not per-account phase/status forcing.

## Deliverable

A single report: for each of the 10 items above, your verdict (confirmed / partially confirmed / refuted) with your own evidence, followed by a prioritized implementation plan (file-by-file, matching `/admin`'s existing conventions) for everything confirmed. Flag anything you're not fully confident about rather than guessing.
