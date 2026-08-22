# Technical Analysis & Refactoring Strategy: Trading Terminal Layout Fix

**Author**: Explorer 3  
**Target Codebase**: `propfirm-frontend-v10.7.1`  
**Focus File**: `src/app/dashboard/trading/page.tsx`  
**Related Components**: `market-watch.tsx`, `order-ticket.tsx`, `chart-panel.tsx`, `positions-table.tsx`

---

## 1. Root Cause Analysis

### 1.1 Summary of Observed Issues
1. **Forced Collapse on Mount**:
   In `src/app/dashboard/trading/page.tsx` (lines 161–166), a `useEffect` hook forcefully ran `setMwCollapsed(true)` on every page mount. This caused the Market Watch panel to open in a collapsed state every time a user navigated to `/dashboard/trading`.
2. **Squished / Compressed Panel Sizes**:
   When Market Watch was collapsed or resized, `react-resizable-panels` percentage bounds (`defaultSize={20} minSize={15}`) resulted in effective widths below 200px on desktop resolutions (e.g. 15% of a 992px container is ~148px).
3. **Vertical Text Rendering ("MA WA" / "Market Watch")**:
   When collapsed, the panel rendered a vertical text label (`[writing-mode:vertical-rl] rotate-180`), which appeared as awkward vertically wrapped text inside a fixed percentage container.
4. **Child Content Clipping & Wrapping**:
   In `OrderTicket` (`order-ticket.tsx`) and `MarketWatch` (`market-watch.tsx`), button padding (`px-4`), missing `shrink-0` on SVG icons, and missing `min-w-0` on flex containers caused BUY/SELL prices, lot preset buttons, and symbol labels to clip or wrap when panel width fell below ~220px.

---

## 2. Evaluation of Technical Solutions

We evaluated two technical approaches to achieve guaranteed layout dimensions and responsive stability across desktop viewports (>=1280px).

### Solution Option A: Enhanced `react-resizable-panels` with CSS Pixel Guardrails
* **Mechanism**: Retain `react-resizable-panels` `PanelGroup`, but update default/min percentage sizes (`defaultSize={22} minSize={18}` for Market Watch; `defaultSize={24} minSize={20}` for Order Ticket) AND add Tailwind `min-w-[220px]` / `min-w-[260px]` CSS constraints directly to the panel container element.
* **Pros**: Preserves drag-to-resize functionality between panels.
* **Cons**: Potential CSS vs JS resizing constraint friction if resizer is dragged near limits.

### Solution Option B: Deterministic CSS Flexbox Layout (Recommended)
* **Mechanism**: Replace `PanelGroup` with a responsive Flexbox container (`flex gap-3 flex-1 min-h-0 w-full`). Side panels use fixed/responsive pixel widths (`w-[240px] xl:w-[280px]` for Left, `w-[280px] xl:w-[320px]` for Right), and the Center panel uses `flex-1 min-w-0` to absorb remaining dynamic width.
* **Pros**: 100% deterministic pixel widths guaranteed across all desktop resolutions. Eliminates resizer edge-cases. Toggling collapse transforms Left panel cleanly into a 40px icon rail (`w-10`).
* **Cons**: Removes manual handle dragging (which is rarely needed given standard fixed panel designs in trading terminals).

---

## 3. Recommended Refactoring Plan for Worker Agent

### Step 1: Update `src/app/dashboard/trading/page.tsx`
1. **Fix `mwCollapsed` mount state**:
   - Change `useState(true)` to `useState(false)` so Market Watch defaults to expanded.
   - Update `useEffect` to restore saved state from `localStorage.getItem('fxsim:term:mw')` without overriding it to `true`.
2. **Apply Layout Solution**:
   - **For Flexbox (Option B)**:
     Replace `PanelGroup` with standard flex layout:
     ```tsx
     <div className="flex gap-3 flex-1 min-h-0 w-full rounded-lg">
       {/* Left: Market Watch */}
       <aside className={cn("transition-all duration-200 shrink-0 h-full", mwCollapsed ? "w-10" : "w-[240px] xl:w-[280px]")}>
         ...
       </aside>

       {/* Center: Chart + Positions */}
       <section className="flex-1 min-w-0 flex flex-col gap-3 h-full">
         ...
       </section>

       {/* Right: Order Ticket */}
       <aside className="w-[280px] xl:w-[320px] shrink-0 h-full">
         <OrderTicket account={account} />
       </aside>
     </div>
     ```
   - **For `react-resizable-panels` (Option A)**:
     Set Left Panel `defaultSize={22}` `minSize={18}` `className="min-w-[220px]"`.
     Set Center Panel `defaultSize={54}` `minSize={35}` `className="min-w-[400px]"`.
     Set Right Panel `defaultSize={24}` `minSize={20}` `className="min-w-[260px]"`.

### Step 2: Refactor `src/components/dashboard/trading/order-ticket.tsx`
1. Add `shrink-0` to action button icons (`<ArrowDownRight className="h-4 w-4 shrink-0" />` and `<ArrowUpRight className="h-4 w-4 shrink-0" />`).
2. Add `min-w-0` to BUY/SELL text container and `truncate` to price label (`<span className="text-sm tabular font-semibold truncate">`).
3. Adjust button padding from `px-4` to `px-3` to grant more inline space for prices.

### Step 3: Refactor `src/components/dashboard/trading/market-watch.tsx`
1. Ensure tab button labels have `truncate` to handle count badges gracefully (`Watchlist (${watchlist.length})`).
2. Ensure `WatchRow` symbol text retains `min-w-0` and `truncate`.

---

## 4. Layout Math Verification Matrix

| Desktop Viewport | Sidebar Mode | Main Container Width | Left Panel Width | Right Panel Width | Center Panel Width | All >200px? |
|------------------|--------------|----------------------|------------------|-------------------|--------------------|-------------|
| 1280px           | Expanded (256px) | 992px            | 240px            | 280px             | 472px              | YES         |
| 1280px           | Collapsed (64px)  | 1184px           | 260px            | 300px             | 624px              | YES         |
| 1440px           | Collapsed (64px)  | 1344px           | 280px            | 320px             | 744px              | YES         |
| 1920px           | Collapsed (64px)  | 1824px           | 280px            | 320px             | 1224px             | YES         |
