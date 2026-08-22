# Scope: Trading Terminal Layout Fix

## Overview
Fix the layout of the Trading Terminal (`src/app/dashboard/trading/page.tsx`). The left and right side panels (Market Watch and Order Ticket) are currently being squished/compressed, preventing their content from displaying correctly.

## Target Codebase
- Path: `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`
- Main Page File: `src/app/dashboard/trading/page.tsx`

## Requirements
- R1. Responsive Panel Layout: Market Watch, Chart/Positions, and Order Ticket panels must maintain usable dimensions (>200px computed width on desktop) and not be squished.
- R2. Content Visibility: Panel content (search input, order buttons, table headers, text) fully visible without vertical wrapping or clipping.
- R3. Technical Flexibility: Refactor layout, flexbox rules, container sizing, or `react-resizable-panels` implementation as needed.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Trading Terminal Layout Fix | Fix flex container / panel width constraints in `src/app/dashboard/trading/page.tsx` and related components | None | DONE |

## Interface Contracts
- Page route: `/dashboard/trading`
- Responsive layout across desktop viewports (e.g. 1280px wide and above). Left and Right panels compute to ~238px width, Center panel computes to ~516px width.
