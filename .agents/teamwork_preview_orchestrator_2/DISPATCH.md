## 2026-08-12T14:33:21Z

Fix the layout of the Trading Terminal (`src/app/dashboard/trading/page.tsx`). The left and right side panels (Market Watch and Order Ticket) are currently being squished/compressed, preventing their content from displaying correctly.

### Requirements:
- R1. Responsive Panel Layout: Three panels (Market Watch, Chart/Positions, Order Ticket) must render correctly without side panels being artificially squished.
- R2. Content Visibility: Content inside panels fully visible, accessible, no vertical text wrapping or overflow out of bounds.
- R3. Technical Flexibility: Refactor or replace `react-resizable-panels` / Flexbox constraints as needed.

### Acceptance Criteria:
- Layout Verification: Computed width > 200px for left, center, right panels on standard desktop viewport (1280px wide). No panels collapsed to 0px or text wrapping vertically.
- Functionality: Terminal page compiles (`npm run build`) without TypeScript or Next.js errors.
