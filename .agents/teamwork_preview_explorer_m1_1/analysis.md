# Trading Terminal Layout Analysis (`propfirm-frontend-v10.7.1`)

## Overview
This document provides a detailed layout analysis of the Trading Terminal (`src/app/dashboard/trading/page.tsx`) and its surrounding container hierarchy (`src/app/dashboard/layout.tsx`, `src/app/layout.tsx`). It identifies the exact CSS properties, Tailwind classes, panel size configurations, and component structures causing the left (**Market Watch**) and right (**Order Ticket**) side panels to be squished and compressed on desktop viewports.

---

## 1. Container Hierarchy & Layout Chain

| Component / Layer | File Path | Line Range | CSS / Tailwind Layout Classes | Purpose & Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Root Body** | `src/app/layout.tsx` | 129 | `min-h-screen antialiased font-sans` | Base root container. |
| **Dashboard Wrapper** | `src/app/dashboard/layout.tsx` | 74 | `min-h-screen bg-bg` | Outer dashboard wrapper. |
| **Sidebar Padding Wrapper** | `src/app/dashboard/layout.tsx` | 77 | `${collapsed ? 'lg:pl-16' : 'lg:pl-64'} min-h-screen flex flex-col transition-[padding] duration-200` | Allocates 256px (`lg:pl-64`) for expanded sidebar. |
| **Main Content Container** | `src/app/dashboard/layout.tsx` | 80 | `flex-1 w-full p-3 md:p-4` | Main wrapper for terminal. Horizontal padding = 32px total (`p-4`). |
| **Terminal Page Outer Div** | `src/app/dashboard/trading/page.tsx` | 176 | `flex flex-col gap-3 h-[calc(100dvh-6.5rem)] min-h-[640px]` | Flex column container holding Account Strip and PanelGroup. |
| **Horizontal PanelGroup** | `src/app/dashboard/trading/page.tsx` | 180 | `flex-1 min-h-0 w-full rounded-lg` | Resizable container for Market Watch, Chart, and Order Ticket. |

---

## 2. Quantitative Width Breakdown Across Viewports

`react-resizable-panels` calculates child panel widths as percentages of the `PanelGroup` container's available width.

### Calculation Formula:
$$\text{Available Width} = \text{Viewport Width} - \text{Sidebar Width (256px)} - \text{Main Padding (32px)} - \text{Panel Resize Handles (24px)}$$

| Viewport Width | Sidebar State | Available Container Width | Market Watch (default 20%) | Chart (default 60%) | Order Ticket (default 20%) | Min Side Panel Size (15%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1024px** (Desktop Breakpoint) | Expanded (256px) | **712px** | **142.4px** ❌ | 427.2px | **142.4px** ❌ | **106.8px** ❌ |
| **1280px** (13" Laptop) | Expanded (256px) | **968px** | **193.6px** ❌ | 580.8px | **193.6px** ❌ | **145.2px** ❌ |
| **1366px** (Common Laptop) | Expanded (256px) | **1054px** | **210.8px** | 632.4px | **210.8px** | **158.1px** ❌ |
| **1440px** (HD Monitor) | Expanded (256px) | **1128px** | **225.6px** | 676.8px | **225.6px** | **169.2px** ❌ |

> **Key Observation**: On viewports $\le 1280\text{px}$ (and any time a panel is resized toward its `minSize` of 15%), both Market Watch and Order Ticket fall **below 200px width**, violating Requirement R1.

---

## 3. Root Cause Identification & Evidence Chain

### Root Cause 1: Sub-200px Percentage Panel Sizing (`defaultSize={20}`, `minSize={15}`)
* **Location**: `src/app/dashboard/trading/page.tsx`
  * Line 182: `<Panel defaultSize={20} minSize={15} maxSize={30} collapsible={true} ...>` (Market Watch)
  * Line 281: `<Panel defaultSize={20} minSize={15} maxSize={30}>` (Order Ticket)
* **Evidence**:
  * On a 1280px viewport with an expanded 256px sidebar, 20% evaluates to `193.6px`. On 1024px, 20% evaluates to `142.4px`.
  * `minSize={15}` allows users or initial layout calculations to squeeze panels down to 106px–145px.
* **Impact**: Both side panels are mathematically restricted to dimensions where content cannot render correctly.

### Root Cause 2: Forced Initial Mount Collapse State Disconnect for Market Watch
* **Location**: `src/app/dashboard/trading/page.tsx`, lines 161–166, 183–212
* **Code Snippet**:
  ```tsx
  // lines 161-165
  const [mwCollapsed, setMwCollapsed] = useState(true)
  useEffect(() => {
    setMwCollapsed(true)
    try { localStorage.setItem('fxsim:term:mw', '1') } catch {}
  }, [])

  // lines 183-196
  {mwCollapsed ? (
    <aside className="rounded-lg border border-border bg-surface flex flex-col items-center pt-2 h-full">
      <button onClick={toggleMw} ...><PanelLeftOpen className="h-4 w-4" /></button>
      <span className="mt-3 text-2xs font-semibold uppercase tracking-wider text-text-faint [writing-mode:vertical-rl] rotate-180">
        Market watch
      </span>
    </aside>
  ) : ...
  ```
* **Evidence**:
  * `mwCollapsed` initializes to `true` and is forced `true` on mount.
  * When `mwCollapsed` is `true`, the inner React component renders a **32px wide vertical button strip**.
  * **However**, the surrounding `<Panel defaultSize={20}>` is **NOT collapsed** via `react-resizable-panels` API (`panelRef.current?.collapse()` is never invoked).
  * Consequently, the layout allocates 20% of total viewport width (193px–225px) to display a tiny 32px vertical strip, wasting ~160px+ of dead horizontal space!
  * When the user clicks to expand Market Watch, `mwCollapsed` becomes `false`, but the panel is still constrained to the squished 20% width.

### Root Cause 3: Inflexible Fixed Padding & Grid Layouts inside Component Content
* **Location 3A — Action Bar Buttons**: `src/components/dashboard/trading/order-ticket.tsx`, line 383
  * `grid grid-cols-2 gap-2` inside a `<div className="shrink-0 px-3 pb-3 pt-2 ...">`
  * Each `ActionButton` (line 467) has `px-4` (32px padding per button, 64px combined).
  * In a 142px–193px wide panel, total inner width for the buttons is ~110px–160px. Each button receives ~50px–75px of width. Subtracting 32px of padding leaves only **18px–43px** of content space for text ("SELL", "1.08500") and icon. This forces price numbers to wrap vertically or clip.
* **Location 3B — Volume Lot Presets**: `src/components/dashboard/trading/order-ticket.tsx`, line 254
  * `<div className="flex gap-1 mt-1.5">` rendering 5 preset buttons without flex wrapping. At < 200px width, buttons compress and overflow.
* **Location 3C — Market Watch Table Rows**: `src/components/dashboard/trading/market-watch.tsx`, line 156
  * `grid-cols-[1fr_auto_auto]` with `gap-2`. Symbol name, bid price, and `min-w-[42px]` spread tag overflow when total row width is under 180px.

---

## 4. Summary of Layout Deficiencies

1. **Panel Size Configuration**: `defaultSize={20}` is inadequate for resolutions $< 1366\text{px}$. `minSize={15}` allows severe compression.
2. **State Sync Bug**: `mwCollapsed` state replaces panel content with a vertical strip without resizing or collapsing the underlying `<Panel>` element.
3. **Internal Component Spacing**: Rigid padding (`px-4` on action buttons, no wrap on preset bars) amplifies panel squishing.

---

## 5. Verification Conditions
- On a 1280x800 desktop viewport, all 3 panels must have computed `clientWidth` > 200px when expanded.
- No vertical text wrapping on Order Ticket BUY/SELL buttons or Market Watch symbol rows.
- Build test (`npm run build`) must complete with 0 TypeScript/Next.js errors.
