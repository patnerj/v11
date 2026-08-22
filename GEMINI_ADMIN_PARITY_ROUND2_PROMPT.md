# Task: Round 2 — fix 7 remaining gaps from the /admin parity implementation

## Context

Your round-1 implementation (11 items closing the `/admin` vs `/dashboard/admin` feature gap) was independently verified by an 11-agent parallel code audit (Claude), checking each item against three specific failure patterns: (1) UI present but not wired to state, (2) wired to state but excluded from the actual save payload, (3) wired end-to-end on the frontend but silently dropped by the backend.

**Result: 6 of 11 items are genuinely solid with no gaps found** — banner scheduling/scope, the homepage builder, the affiliates ledger/payout queue, the operations health telemetry, the setup wizard, and the challenge lifecycle test tools. **Do not touch these six** — re-verification will flag any regression.

**5 of 11 items have real, specific gaps remaining**, two of which are "looks done but broken" — the kind that pass a casual glance (real state, real save call, success toast) but silently fail because the backend endpoint doesn't actually persist the field. This document lists exactly what's wrong and where, verified down to the backend PHP whitelist arrays. Fix these 7 concrete items only — don't re-touch anything else in these files beyond what's listed.

## Fix these — ordered by severity

### 1. MT5 Ingest Secret field silently discarded on save (highest priority — data loss with no error shown)

**File:** `src/app/admin/config/page.tsx`, MT5 tab, "Bridge Ingest Shared Secret / Webhook Secret" field (`mt5Form.bridge_secret`, currently ~lines 2860-2877).

**The bug:** This field calls `api.admin.mt5BridgeSave(payload)` (POST `/admin/mt5/bridge/save`). The backend handler `admin_mt5_bridge_save()` in `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` (~lines 5570-5581) only reads `server_ip`, `server_port`, `manager_login`, `manager_pass`, `demo_group`, `funded_group` from the request body — it never reads `bridge_secret`. Whatever the admin types is silently discarded; there's no error, no warning, it just vanishes on save/reload. The GET side (`admin_mt5_bridge_get()`, ~lines 5552-5568) doesn't return the field either, so it can never be pre-populated even if it were saved elsewhere.

**The actual working secret already exists** under a different name: `fxsim_mt5_ingest_secret`, handled by `admin_price_feed_save()` (class-rest-api.php ~lines 5017-5047, reads `$body['mt5_ingest_secret']`), exposed via `api.admin.priceFeedSave` (`src/lib/api.ts` ~line 364), with a `secret_set` boolean flag already returned by the price-feed GET (`class-price-feed.php` ~line 368: `'secret_set' => get_option('fxsim_mt5_ingest_secret','')!==''`). The existing `src/components/admin/price-feed-card.tsx` component already implements this correctly (with a "• configured" style indicator) but is not imported anywhere in `admin/config/page.tsx`.

**Fix:** Either (a) rewire the existing MT5-tab secret field to call `api.admin.priceFeedSave({ mt5_ingest_secret: value })` instead of `mt5BridgeSave`, reading initial state from the price-feed GET's `secret_set` flag (show "•••• configured" rather than the raw secret, matching the Stripe/Confirmo card pattern already used elsewhere in this same file), or (b) import and mount the existing `PriceFeedCard` component directly in the MT5/feed tab, matching how `PaymentsCenter` and `ChartSymbolMap` are already imported and mounted in this file. Prefer (b) if the existing component fits the tab's layout — it's already correct and tested elsewhere.

### 2. Theme border-radius selector — UI works, has zero effect anywhere, backend drops it

**File:** `src/app/admin/config/page.tsx`, Branding tab, border-radius selector (`brandingForm.radius`, currently ~lines 1984-2020).

**The bug, two independent breaks:**
- Nothing in the frontend ever applies `brandingForm.radius`/`whitelabelData.radius` to actual UI rounding. `src/lib/theme-accent.ts` has `applyThemeAccent()` (color) and `applyFontFamily()` (font) that inject live CSS custom-property overrides — there is no `applyRadius()` equivalent. `src/components/theme-loader.tsx`, which hydrates theme tokens on app boot, only applies `primary_color` and `font_family`, never `radius`. No `--radius` CSS variable exists anywhere in `globals.css` or elsewhere.
- The backend's `admin_whitelabel_save()` in `class-rest-api.php` (~lines 3662-3688) gates every field through a hardcoded `$allowed` whitelist array (~lines 3664-3671). `radius` is not in that list, so even if the frontend fix above is done, the value never reaches the database — it's silently dropped, and on reload the picker reverts to the hardcoded default `'md'`.

**Fix, both halves required:**
- Backend: add `'radius'` to the `$allowed` whitelist array in `admin_whitelabel_save()` (`class-rest-api.php` ~line 3664-3671) so `FXSIM_Challenge_DB::set_setting()` actually persists it, and confirm `admin_whitelabel_get()` returns it back out.
- Frontend: add an `applyRadius(value)` function to `src/lib/theme-accent.ts` (same pattern as `applyThemeAccent`/`applyFontFamily` — inject a CSS custom property, e.g. `--radius`, onto `:root` or `document.documentElement.style`), call it from `src/components/theme-loader.tsx` on boot alongside the existing color/font hydration, and make sure the actual component library (buttons/cards/inputs/modals) reads `var(--radius)` for their border-radius rather than a hardcoded Tailwind class — check `tailwind.config.ts` for whether `borderRadius` is already tokenized to a CSS variable (if not, this is the root cause and needs to be added there too, not just in the admin form).

### 3. Coupons — plan-restriction is a raw text input instead of the multi-select that already exists elsewhere

**File:** `src/app/admin/marketing/page.tsx`, Coupons tab modal (~lines 2251-2261, "Restricted Plan IDs (Optional)").

**The gap:** Currently a free-text `<Input>` where the admin must know and type numeric plan IDs comma-separated (e.g. "1, 2, 5") with no plan names shown and no validation — easy to typo into a silent no-op. `src/app/dashboard/admin/coupons/page.tsx` (a different, pre-existing page) already implements this correctly: it fetches `api.admin.plansList()` and renders clickable plan-name pill/chip buttons that toggle a `plan_ids_arr` array (see that file's lines ~36, 43, 50-54, 123-136 for the exact pattern).

**Fix:** Replace the free-text input in `admin/marketing/page.tsx`'s coupon modal with the same pill/chip multi-select pattern from `dashboard/admin/coupons/page.tsx` — fetch `api.admin.plansList()`, render each plan as a toggleable chip showing its real name, and store the selection as `couponForm.plan_ids` (the backend at `class-rest-api.php` ~lines 6488-6492 already accepts either an array or comma-separated string, so this is a pure frontend fix — no backend change needed here).

### 4. Coupons/Plans — `sort_order` has no UI control at all

**File:** `src/app/admin/config/page.tsx`, Plan Builder modal.

**The gap:** `sort_order` is read from the plan on modal-open (~line 795) and written back unchanged in the save payload (~line 899), but there is no input/select anywhere in the file for the admin to actually change it — confirmed via search for "Sort Order"/"sort-order"/"sortOrder" JSX, zero matches. It's silently carried through as a dead default.

**Fix:** Add a numeric input (or up/down reorder buttons, whichever fits the existing modal layout better) bound to `planForm.sort_order` in the same "basics" section as the other simple numeric plan fields (`account_size`, `price`), wired the same way those are.

### 5. Settings — "Manual Payment Instructions" textarea is completely absent from `/admin`

**File:** `src/app/admin/config/page.tsx` (or wherever it best fits among the existing tabs — likely the Payments/Gateway area alongside `PaymentsCenter`).

**The gap:** This field (`manual_payment_instructions`, shown to traders during manual/bank-transfer checkout) exists on a different, separate page (`src/app/dashboard/admin/settings/page.tsx`, field at ~line 32/169) but has zero presence anywhere in `admin/config/page.tsx` — no field, no import, no reference. The backend already whitelists `manual_payment_instructions` in `admin_whitelabel_save()`'s `$allowed` array, so this is a pure frontend addition.

**Fix:** Add a `<Textarea>` bound to `brandingForm.manual_payment_instructions` (or wherever makes sense in `whitelabelForm`/the relevant form object) in the config page, saved through the existing `whitelabelSave` mutation already used for other fields on this page. `Textarea` is already imported in this file (confirmed) but never instantiated — this fix uses that existing import.

### 6. Impersonation — missing self-impersonation guard (safety regression vs. the original)

**Files:** `src/app/admin/traders/page.tsx` (~lines 473-479, "View As Trader" `DropdownMenuItem`) and `src/app/admin/traders/[id]/page.tsx` (~lines 499-507, "View as Trader" `Button`).

**The gap:** The original (`src/app/dashboard/admin/users/page.tsx` ~lines 195-198) disables the impersonate action when `u.user_id === adminUser?.id` (`disabled={u.user_id === adminUser?.id}`). Neither new file has this check — an admin could click "View As Trader" on their own row/profile with no guard, no error, immediately starting a self-impersonation session and hard-navigating to `/dashboard`.

**Fix:** Add the same `adminUser?.id` comparison guard to both the `DropdownMenuItem`'s `disabled` prop (traders list) and the `Button`'s `disabled` prop (trader detail page) — `adminUser` should already be available via the same auth store hook (`useAuth`) used elsewhere in these files; if it isn't currently imported/read in one of them, add it.

### 7. Impersonation — missing confirmation dialog before starting a session

**Same two files as #6.**

**The gap:** The original (`src/app/dashboard/admin/users/page.tsx` ~lines 248-275) gates the actual `api.admin.impersonate()` call behind a confirm `Dialog` ("View as {user}? ... Start session" button) — the POST only fires after explicit confirmation. Both new implementations call `handleImpersonate` directly on click with zero confirmation step, so a stray click immediately starts impersonating and navigates away from the admin panel.

**Fix:** Add a confirm step before calling `handleImpersonate` — either reuse the existing `ConfirmDialog` component already used elsewhere in both these files (for the destructive challenge-tools actions, if `admin/traders/page.tsx` has one nearby to pattern-match, or the modal pattern from `dashboard/admin/users/page.tsx`'s own impersonate confirm dialog) so clicking the menu item/button opens a confirmation first, and the actual API call only fires on explicit confirm.

## Verification before you report back

For items 1 and 2 specifically (the "looks done but broken" ones), don't just confirm the UI renders — trace the save round-trip yourself: save a value, reload the page, confirm it's still there (not reverted/blank). For item 1, also grep the backend handler you're now calling to confirm it actually reads and persists the field you're sending. For item 2, confirm visually that changing the radius option actually changes a real button/card's corner rounding somewhere in the app after reload.

## Deliverable

Same format as before: for each of the 7 items, what you changed (files/lines) and how you verified it actually works end-to-end (not just "the code looks right"). I'll run another independent audit pass against this exact list once you're done.
