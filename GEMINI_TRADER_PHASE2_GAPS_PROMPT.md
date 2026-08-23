# Task: Phase 2 — 3 real gaps out of 10 items

Independently re-verified all 10 Phase 2 items. 2.1, 2.2, 2.3, 2.4 (checked directly, backend) and 2.5, 2.6, 2.7 are genuinely solid — no notes, especially good work on 2.7 where both frontend AND backend independently enforce mandatory SL (confirmed a malicious client bypassing the UI still can't place an SL-less order when the plan requires one).

Three real gaps:

## 1. Drawdown/margin telemetry (`AccountStrip`) is desktop-only — mobile traders see nothing

**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/trading/page.tsx`

`AccountStrip` was correctly added to `DesktopLayout` with genuinely live data (polled every 4s via the `usePrices` store, `metrics` refetched every 15s) — that part is real, not decorative. But `MobileLayout` (same file, ~lines 578-719) was left untouched. Mobile traders currently see a separate hand-rolled bar showing only Equity/Balance/P&L — no daily-loss or max-drawdown progress bar at all. Since Phase 2's whole point for this item was "trader sees real-time daily loss & max drawdown while trading," that goal isn't met for anyone trading from a phone.

**Fix:** Render `<AccountStrip account={account} openPnL={openPnL} metrics={metrics} />` in `MobileLayout` too (same props pattern as desktop — check it fits the mobile layout's available vertical space, may need a more compact variant).

**Also clean up:** `src/components/dashboard/trading/terminal-desktop-layout.tsx` and `terminal-mobile-layout.tsx` also got `<AccountStrip>` added in this same commit, but neither file is imported anywhere in `src/` — they're dead/orphaned code (from an earlier abandoned refactor, it looks like). Either delete both files if they're truly unused, or if they're meant to replace the current live layout at some point, say so — but don't keep editing dead files as if they were the real fix, it wastes effort and risks confusion later.

## 2. `refreshAll` isn't actually wired into opening a position or placing a pending order

**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/trading/page.tsx`, `src/components/dashboard/trading/order-ticket.tsx`

The `refreshAll` callback (page.tsx:84-91) is genuinely wired to `PositionsTable`/`PendingOrdersTable` via `onChanged`, and close/modify/cancel actions all correctly call it. But `OrderTicket` (used for opening a market position and placing a pending order) has no `onChanged`/`refreshAll` prop at all — it's rendered as `<OrderTicket account={account} plan={plan} />` with nothing wired in. It happens to still refresh visible data today because `submitMarket`/`submitPending` separately call the store's `refreshUser()`, which turns out to alias the exact same underlying `refresh()` action — so there's no user-visible bug right now, just don't describe this as "refreshAll wired to PositionsTable and PendingOrdersTable" covering open/place, since it doesn't; it's two different refresh mechanisms happening to produce the same result. Worth consolidating onto one path (either pass `onChanged={refreshAll}` into `OrderTicket` and drop the separate `refreshUser()` call, or vice versa) so there's one clear mechanism, not two redundant ones that could drift apart later.

**Also fix while touching this:** `refreshAll`'s `invalidateFxsim('/pending-orders')` (page.tsx:89) doesn't match the real cache key, which is `/pending-order/my` (singular "order"). It's currently harmless — other invalidation paths already cover the correct key — but it's dead/typo'd code sitting in the exact function whose whole job is cache invalidation. Fix the string.

## 3. CSV export — unaddressed formula/CSV injection on the trade-notes field

**File:** `propfirm-frontend-v10.7.1/src/app/dashboard/history/page.tsx`, `handleExportCSV()`

The `note` field is free-text (user types it into a textarea, saved via `api.tradeNotesSave()` with no sanitization). The export only escapes embedded double-quotes for CSV-delimiter safety — it does not neutralize a leading `=`, `+`, `-`, `@`, tab, or CR. Excel/Google Sheets treat a cell as a formula based on its first character even inside quotes; a note like `=cmd|'/c calc.exe'!A1` gets exported as `"=cmd|'/c calc.exe'!A1"` and can execute when the CSV is opened. This is the standard CSV/Formula Injection class — real, if a self-inflicted-by-the-user-themselves risk in the common case, but genuinely exploitable if one trader's exported notes are ever viewed by someone else (e.g. an admin exporting/reviewing a trader's notes, or a trader sharing their export).

**Fix:** Before writing any string field to a CSV cell, if the first character is `=`, `+`, `-`, `@`, tab, or CR, prefix it with a single leading `'` (apostrophe) — the standard mitigation, which spreadsheet apps render as literal text instead of evaluating. Apply this to every string-typed exported column, not just `note`.

**Also fix while touching this:** only `note` is quote-wrapped/escaped right now — `symbol`, `opened_at`, `closed_at`, and other string columns are joined raw with `.join(',')`, so an embedded comma in any of those would misalign the row. Wrap and escape all string fields consistently, not just `note`.

---

Same rules as always: SSH-sync, verify live, launchapropfirm.com only. For item 3, test with a note value that actually starts with `=` and confirm the exported CSV cell is prefixed/neutralized, not just that quoting looks fine — a quote-only test would incorrectly look like a pass.
