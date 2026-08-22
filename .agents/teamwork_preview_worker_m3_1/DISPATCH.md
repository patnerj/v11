## 2026-08-13T18:02:13Z
You are the M3 Implementation Worker for Milestone M3: Users & Trader Management Module.

Working metadata directory: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m3_1
Project Scope Document: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_orchestrator_3\PROJECT.md
Original User Request: d:\Full Propfirm System for antigravity\.agents\ORIGINAL_REQUEST.md

Please read the following Explorer handoff reports before starting:
1. d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m3_1\handoff.md
2. d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m3_2\handoff.md
3. d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m3_3\handoff.md

Your task is to implement/enhance the Users & Trader Management Module in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`:

1. **Target Files**:
   - `src/app/dashboard/admin/users/page.tsx`
   - `src/app/dashboard/admin/users/[id]/page.tsx`
   - `src/lib/api.ts`

2. **Deep-Link Impersonation**:
   - In `src/app/dashboard/admin/users/page.tsx`, parse `useSearchParams()` for `?impersonate={id}`. When present, resolve the user and automatically launch the impersonation confirmation dialog.

3. **User Action Triggers & Mock API Alignment (`src/lib/api.ts`)**:
   - Add UI action controls in `users/page.tsx` or `users/[id]/page.tsx` for:
     - **Create Trader**: Modal dialog calling `api.admin.userCreate(data)` (in `api.ts`, ensure `userCreate` uses `mockApiResponse` + 800ms delay with `// TODO: Real API — Needs POST /fxsim/v1/admin/users/create in class-rest-api.php`).
     - **Reset Password**: Action button calling `api.admin.userResetPassword(userId)` with confirmation and `toast.success('Password reset email sent')`.
     - **Delete User**: Action button calling `api.admin.userDelete(userId)` with danger confirmation dialog and `toast.success('User account deleted')`.
     - **Send Notification**: Modal dialog calling `api.admin.userNotify(userId, message)` with `toast.success('Notification sent to user')`.

4. **UI & Resilience Standard**:
   - All async actions must disable buttons (`disabled={isSubmitting}` / `loading={isSubmitting}`), render `<Loader2 className="animate-spin" />` spinners, and trigger `sonner` toasts (`toast.success`, `toast.error`).
   - Render `<Skeleton />` loading rows while data is fetching (`rows === null`).
   - Preserve dark navy/slate theme with neon green accents (`#00FF66`).

5. **Verification**:
   - Execute `npx tsc --noEmit` from `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1`. Verify exit code 0 with 0 errors.

6. **Reporting**:
   - Write your completion report to `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m3_1\handoff.md`.
   - Update `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_worker_m3_1\progress.md`.
   - Send completion message to parent Orchestrator `3f7a896f-22d9-49ba-8087-a17788fcf3b0`.
