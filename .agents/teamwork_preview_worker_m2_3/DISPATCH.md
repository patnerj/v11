## 2026-08-13T17:34:09Z

You are the M2 Remediation Worker (Iteration 2) for Milestone M2: Overview & System KPIs Module.

Working metadata directory: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m2_3
Project Scope Document: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_orchestrator_3\PROJECT.md
Original User Request: d:\Full Propfirm System for antigravity\.agents\ORIGINAL_REQUEST.md
Gate Status / Review Feedback: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_orchestrator_3\GATE_STATUS.md

Please apply the following 3 precise fixes to `src/app/dashboard/admin/page.tsx`:

1. **Fix Query Invalidation Predicate (`src/app/dashboard/admin/page.tsx`)**:
   In `handleRefresh`, update `queryClient.invalidateQueries` to use a predicate matching all `admin.*` keys:
   ```typescript
   await queryClient.invalidateQueries({
     predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('admin')
   })
   ```

2. **Fix Stats Error Fallback (`src/app/dashboard/admin/page.tsx`)**:
   In `useQuery` for `admin.stats`, update `queryFn` so it returns a safe fallback stats object on `!res.ok` or `!res.data` instead of throwing an Error:
   ```typescript
   queryFn: async () => {
     const res = await api.admin.stats()
     if (!res.ok || !res.data) {
       return { users: 0, active_challenges: 0, funded_accounts: 0, open_positions: 0, total_trades: 0, total_pnl: 0, pending_payments: 0 }
     }
     return res.data
   }
   ```
   This ensures `stats` is set to default zeros on network error rather than staying `undefined`, preventing the 10 KPI stat tiles from being trapped in infinite loading skeletons.

3. **Fix Hardcoded Fallback Metrics (`src/app/dashboard/admin/page.tsx`)**:
   Replace static fallback values (`'$128,450'` for total payouts and `'64.2%'` for win rate) with clean `'—'` indicators when query results (`riskRes` or `challengeAnalyticsRes`) are `null` or `undefined`.

Verification:
Run `npx tsc --noEmit` from `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`. Verify exit code 0.

Write your completion report to `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m2_3\handoff.md` and send completion message to parent Orchestrator `3f7a896f-22d9-49ba-8087-a17788fcf3b0`.
