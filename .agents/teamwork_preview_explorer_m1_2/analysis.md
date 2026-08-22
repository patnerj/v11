# Comprehensive Technical Analysis: Trading Terminal Panel Squeezing & Layout Investigation

**Target Page**: `src/app/dashboard/trading/page.tsx`  
**Project Root**: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`  
**Date**: 2026-08-12  
**Investigator**: Explorer 2  

---

## 1. Executive Summary

The Trading Terminal page suffers from severe panel squeezing and vertical text wrapping (e.g. "MA WA" or vertically stacked text) affecting both the Market Watch (left panel) and Order Ticket (right panel). 

The primary root causes are:
1. **Flawed Panel Collapse State & Layout Disconnect**: On initial page mount, `mwCollapsed` and `posCollapsed` state are forcibly set to `true`. When `mwCollapsed` is `true`, `react-resizable-panels` does **not** collapse the left panel to 0px/rail width; it retains its 20% percentage width allocation (`~200px-250px`). Inside this wide space, it renders a vertical text rail with `[writing-mode:vertical-rl]`, causing vertical letter wrapping and massive wasted screen real estate.
2. **Sub-optimal Percentage Allocations in `react-resizable-panels`**: The panel group assigns 20% width to Market Watch, 60% to Chart/Positions, and 20% to Order Ticket. On standard desktop screens (1280px viewport with a 256px sidebar, leaving ~992px main content width), 20% computes to **198.4px**, which violates the >200px usable width requirement. At `minSize={15}`, panels shrink down to **148.8px**.
3. **Fixed Padding & Flex Overflow in Order Ticket Buttons**: Action buttons (`BUY`/`SELL`) inside `OrderTicket` have `px-4` padding (32px total horizontal padding per button) and `overflow-hidden` in a 2-column grid. When panel width is under 220px, each button has only ~53px inner content space, causing prices and labels to overflow or get clipped.
4. **Market Watch Row Grid Tightness**: The non-compact Market Watch row uses `grid-cols-[1fr_auto_auto]` with fixed spread column widths (`min-w-[42px]`). At panel widths under 220px, symbol names get squeezed to under 40px width and truncate heavily.
5. **Center Positions Panel Vertical Space Drain**: `posCollapsed` defaults to `true` on mount, hiding the positions table but leaving the vertical `Panel` at `defaultSize={30}` (30% height), squeezing the chart panel vertically while leaving 30% of center space empty.

---

## 2. Detailed Findings by Component & Line Number

### A. Layout Container & Viewport Width Context
- **Files**: `src/app/dashboard/layout.tsx` (lines 77, 80)
- **Code Context**:
  ```tsx
  77: <div className={`${collapsed ? 'lg:pl-16' : 'lg:pl-64'} min-h-screen flex flex-col transition-[padding] duration-200`}>
  80: <main className={isTerminal ? 'flex-1 w-full p-3 md:p-4' : ...}>
  ```
- **Impact**: On a 1280px screen with an expanded sidebar (`lg:pl-64` = 256px) and page padding (`p-4` = 32px), the remaining available width for `TradingTerminalPage` is `1280 - 256 - 32 = 992px`.

---

### B. Trading Terminal `PanelGroup` & `Panel` Configurations
- **File**: `src/app/dashboard/trading/page.tsx`
- **Line Numbers**: 160-173, 180-289
- **Code Inspection**:
  ```tsx
  160: const [mwCollapsed, setMwCollapsed] = useState(true)
  162: useEffect(() => {
  164:   setMwCollapsed(true) // ALWAYS starts collapsed on terminal open!
  165:   try { localStorage.setItem('fxsim:term:mw', '1') } catch { }
  166: }, [])
  ...
  180: <PanelGroup orientation="horizontal" className="flex-1 min-h-0 w-full rounded-lg">
  182:   <Panel defaultSize={20} minSize={15} maxSize={30} collapsible={true} onResize={(size) => setMwCollapsed(size.asPercentage === 0)}>
  183:     {mwCollapsed ? (
  184:       <aside className="rounded-lg border border-border bg-surface flex flex-col items-center pt-2 h-full">
  185:         <button onClick={toggleMw} ...><PanelLeftOpen className="h-4 w-4" /></button>
  186:         <span className="mt-3 text-2xs font-semibold uppercase tracking-wider text-text-faint [writing-mode:vertical-rl] rotate-180">
  187:           Market watch
  188:         </span>
  189:       </aside>
  190:     ) : (
  191:       <aside className="rounded-lg border border-border bg-surface flex flex-col h-full min-h-0 overflow-hidden">
  192:         ...
  193:         <MarketWatch />
  194:       </aside>
  195:     )}
  196:   </Panel>
  ...
  220:   <Panel defaultSize={60} minSize={40}>
  ...
  281:   <Panel defaultSize={20} minSize={15} maxSize={30}>
  282:     <aside className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col h-full min-h-0">
  ...
  286:       <OrderTicket account={account} />
  287:     </aside>
  288:   </Panel>
  ```
- **Defects Identified**:
  1. **Percentage Width Violation**: `defaultSize={20}` on a 992px container yields `198.4px` width. `minSize={15}` permits resizing down to `148.8px` width. Both violate the >200px requirement.
  2. **Disconnect between State and `react-resizable-panels`**:
     - `mwCollapsed` is set to `true` on mount.
     - When `mwCollapsed` is `true`, `react-resizable-panels` DOES NOT shrink the panel. The panel stays at 20% width (~200px wide).
     - Inside this 20% box, `mwCollapsed ? (...) : (...)` renders a centered vertical text string `"Market watch"` with CSS `[writing-mode:vertical-rl]`.
     - In narrow boxes, vertical writing mode causes words like "Market watch" to split letters vertically into stacked text, appearing as "MA WA".
     - Clicking the toggle button `toggleMw` only toggles state `mwCollapsed`. It does NOT call `panelRef.current?.expand()` or `panelRef.current?.resize()`.

---

### C. Order Ticket Component CSS & Layout Issues
- **File**: `src/components/dashboard/trading/order-ticket.tsx`
- **Line Numbers**: 196-213, 217-230, 254-269, 383-427, 457-489
- **Code Inspection**:
  - **Lines 196-213** (Pending Order Types):
    ```tsx
    <div className="grid grid-cols-2 gap-1 text-2xs">
      {(['buy_limit', 'sell_limit', 'buy_stop', 'sell_stop'] as const).map((t) => (
        <button className="...">
          {t.replace('_', ' ')}
        </button>
      ))}
    </div>
    ```
    In an 80px column, `"SELL LIMIT"` lacks `truncate` or `whitespace-nowrap`, causing "SELL" and "LIMIT" to wrap vertically.
  - **Lines 217-230** (Market Info Strip - Bid/Spread/Ask):
    ```tsx
    <div className="grid grid-cols-3 gap-1.5 rounded-md bg-bg-subtle/60 border border-border-subtle p-2 text-2xs">
    ```
    3 columns inside ~180px–200px panel leave ~50px per cell. Prices with 5 decimals (e.g. `1.08542`) overflow or clip.
  - **Lines 383-408 & 457-489** (BUY / SELL Action Buttons):
    ```tsx
    383: <div className="grid grid-cols-2 gap-2">
    ...
    471: <button ... className={cn('group relative h-12 rounded-md font-semibold text-white px-4 flex items-center justify-between gap-1.5 transition-all focus-ring overflow-hidden', ...)}>
    ```
    In a panel under 220px, each grid cell is ~85px wide. Subtracting `px-4` padding (32px total) leaves only 53px inner width. Icon (16px) + gap (6px) + Price text (~55px) = 77px required width. With `overflow-hidden`, the price is clipped or wrapped vertically.

---

### D. Market Watch Component Grid & Layout Tightness
- **File**: `src/components/dashboard/trading/market-watch.tsx`
- **Line Numbers**: 53-84, 156-161, 178-208
- **Code Inspection**:
  - **Lines 156-161**:
    ```tsx
    compact ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_auto_auto]'
    ```
  - **Lines 178-208**:
    Column 1: Symbol (`min-w-0`, Star icon + name)
    Column 2: Bid price (`text-xs tabular whitespace-nowrap`)
    Column 3: Spread (`min-w-[42px] whitespace-nowrap`)
    In desktop non-compact mode, Bid + Spread columns consume ~100px. In a 180px-200px panel, the symbol name column gets compressed to under 40px, squeezing symbol names against the star icon.

---

### E. Vertical Positions Panel Height Allocation
- **File**: `src/app/dashboard/trading/page.tsx`
- **Line Numbers**: 147-159, 221-273
- **Code Inspection**:
  ```tsx
  147: const [posCollapsed, setPosCollapsed] = useState(true)
  149: useEffect(() => {
  150:   setPosCollapsed(true) // Starts collapsed on mount
  151: }, [])
  ...
  232: <Panel defaultSize={30} minSize={10} collapsible={true} onResize={(size) => setPosCollapsed(size.asPercentage === 0)}>
  233:   <section className="...">
  234:     <div className="shrink-0 flex items-center gap-1 px-3 pt-2 border-b border-border-subtle">
  ...
  263:     {!posCollapsed && (
  264:       <div className="flex-1 overflow-y-auto min-h-0">
  265:         <PositionsTable ... />
  266:       </div>
  267:     )}
  268:   </section>
  269: </Panel>
  ```
- **Defects Identified**:
  When `posCollapsed` is `true`, `!posCollapsed` hides the table content, BUT the vertical `Panel` STILL occupies 30% of the center column height. The Chart panel above is squished to 70% height while 30% of vertical height is left completely empty.

---

## 3. Component Interaction Matrix & Summary of Defect Root Causes

| Issue | Affected File(s) & Line(s) | Component Interaction | Direct Cause |
|-------|----------------------------|-----------------------|--------------|
| **Side Panel Compression (<200px width)** | `src/app/dashboard/trading/page.tsx`:182, 281 | `PanelGroup` -> `Panel` | `defaultSize={20}` gives 198.4px width on 1280px viewport (992px net content width); `minSize={15}` allows shrinking to 148.8px. |
| **Vertical Text Wrapping ("MA WA")** | `src/app/dashboard/trading/page.tsx`:164, 183-189 | `mwCollapsed` state -> `Panel` render | `mwCollapsed` defaults to `true` on mount. Panel remains at 20% width while rendering `[writing-mode:vertical-rl]` text inside a 200px wide box. |
| **BUY/SELL Button Price Clipping** | `src/components/dashboard/trading/order-ticket.tsx`:383, 471 | `OrderTicket` -> `ActionButton` | `grid-cols-2` in narrow panel + `px-4` padding (32px) + `overflow-hidden` clips price content requiring >70px. |
| **Market Info Strip Overflow** | `src/components/dashboard/trading/order-ticket.tsx`:217 | `OrderTicket` -> Market Strip | `grid-cols-3` in <200px panel leaves ~50px per cell, squeezing 5-decimal prices. |
| **Pending Type Label Wrapping** | `src/components/dashboard/trading/order-ticket.tsx`:196 | `OrderTicket` -> Pending Types | `grid-cols-2` without `truncate` or `whitespace-nowrap` wraps "SELL LIMIT" onto 2 lines. |
| **Market Watch Symbol Squeezing** | `src/components/dashboard/trading/market-watch.tsx`:156, 204 | `MarketWatch` -> `WatchRow` | `grid-cols-[1fr_auto_auto]` with `min-w-[42px]` spread cell starves symbol column when panel width is under 220px. |
| **Chart Height Squeezing** | `src/app/dashboard/trading/page.tsx`:150, 232 | `PanelGroup` vertical -> Positions `Panel` | `posCollapsed` defaults to `true` on mount, hiding positions table while `Panel` still steals 30% vertical height from Chart. |

---

## 4. Recommended Fix Strategy

1. **Panel Size Configuration (`src/app/dashboard/trading/page.tsx`)**:
   - Update `PanelGroup` horizontal panel sizes:
     - Left Panel (Market Watch): `defaultSize={22}`, `minSize={18}` (or `220px` equivalent).
     - Center Panel (Chart/Positions): `defaultSize={56}`, `minSize={45}`.
     - Right Panel (Order Ticket): `defaultSize={22}`, `minSize={18}` (or `minSize={20}` ~240px).
   - At 22% of 992px container, side panels get **218.2px** default width (and on 1440px collapsed sidebar they get **260px** width), ensuring >200px usable width across all desktop resolutions.

2. **Default Open & Imperative Panel Collapse (`src/app/dashboard/trading/page.tsx`)**:
   - Change `mwCollapsed` and `posCollapsed` initial state to `false` (default open) so trading terminal opens with full Market Watch and Positions visible.
   - Use `useRef<ImperativePanelHandle>(null)` for Market Watch and Positions panels.
   - Connect toggle buttons to `panelRef.current?.collapse()` / `expand()` so `react-resizable-panels` handles physical panel size collapsing correctly.

3. **Order Ticket Spacing & Padding Adjustments (`src/components/dashboard/trading/order-ticket.tsx`)**:
   - In `ActionButton`: change `px-4` to `px-2.5`, reduce `gap-1.5` to `gap-1`, and ensure inner container has `min-w-0`.
   - In Pending Type buttons: add `truncate` or `whitespace-nowrap` to prevent awkward word breaks.
   - In Market Info Strip: use `px-1.5` and `text-[11px]` tabular formatting to fit 5-decimal prices cleanly.

4. **Market Watch Row Layout Optimization (`src/components/dashboard/trading/market-watch.tsx`)**:
   - Reduce spread column min-width from `min-w-[42px]` to `min-w-[36px]` in non-compact mode and adjust row gap to `gap-1.5`.
   - Ensure symbol name container uses `min-w-0 flex-1` and `truncate`.

5. **Center Vertical Positions Panel Collapse Handling (`src/app/dashboard/trading/page.tsx`)**:
   - Imperatively collapse the vertical `Panel` when `posCollapsed` is true so ChartPanel takes 100% (or ~95%) of the center height when positions are collapsed.
