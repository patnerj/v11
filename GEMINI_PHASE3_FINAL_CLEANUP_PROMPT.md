# Task: close 3 small remaining gaps from Phase 3

8 of 11 Phase 3 items are genuinely solid, no notes: P3.5, P3.3, P3.4, P3.6, P3.7, P3.8, P3.9, P3.11. Don't touch these.

3 items have small, specific, easy-to-fix gaps:

## 1. A second hardcoded `+14.8%` badge was missed

**File:** `propfirm-frontend-v10.7.1/src/app/admin/page.tsx`, ~line 720

The dashboard actually had TWO hardcoded `'+14.8%'` badges before this round — the Summary Metrics card (now genuinely fixed with real MoM math) and a separate one in the "Gross Capital Inflow" card (Real-Time Treasury section, labeled "Challenge purchases & add-ons"). Only the first was fixed. Line 720 still reads:
```
{totalRev > 0 ? '+14.8%' : '0.0%'}
```
**Fix:** Apply the same `revenueTrend` value (already computed and working elsewhere on this same page) to this second badge too.

## 2. Analytics "Refresh" still shows success on partial/total failure

**File:** `propfirm-frontend-v10.7.1/src/app/admin/analytics/page.tsx`, `handleRefreshAll` (~line 46-53) and the three query `queryFn`s (~line 28, 34, 40)

The `await Promise.all(...)` fix is genuine and correct. But each query's `queryFn` is written as `api.admin.analyticsX(...).then(res => res.ok ? res.data : null)` — a failed API response resolves successfully with `null` instead of rejecting. Since `fxsim()` itself never throws on a failed response either, `Promise.all` in `handleRefreshAll` never actually rejects on a real failure, so the success toast still fires even when one or all three refetches genuinely failed.

**Fix:** Have `handleRefreshAll` check each `refetch()` result directly (react-query's `refetch()` returns `{data, error, isError}` or similar) rather than relying on the `queryFn`'s own success/failure — show `toast.error` if any of the three genuinely failed, only `toast.success` if all three genuinely succeeded.

## 3. Favicon upload still lets you pick a file type the backend rejects

**File:** `propfirm-frontend-v10.7.1/src/app/admin/config/page.tsx`, ~line 2328

The display copy was correctly fixed to no longer mention SVG. But the file input itself is still `accept=".ico,.png,.svg,.webp"` — the OS file picker still lets an admin select an SVG, which the backend will then reject with a 415. Change it to `accept=".ico,.png,.webp"` to match both the copy and the backend whitelist.

---

Two things worth knowing but not blocking (no fix needed, just noting for awareness):
- The SMTP test feature (P3.3) is genuinely solid, but `admin/config/page.tsx` renders a fully fabricated "SMTP handshake log" (fake EHLO/STARTTLS/AUTH LOGIN lines with hardcoded byte counts) that has no relation to what the real test actually did — cosmetic theater layered on a real, working test. Not urgent, just misleading if anyone looks closely.
- The KYC compliance gate (P3.9) has 4 dead, always-false disjuncts referencing columns that don't exist in the schema (`id_front`, `id_back`, `selfie`, `proof_address` vs the real `id_doc_path` etc. columns) — harmless, just redundant code worth a cleanup pass sometime.

Same verification/deployment rules as every prior round: SSH-sync, verify live, stay scoped to launchapropfirm.com only.
