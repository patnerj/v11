# Handoff Report: Milestone M1 Mock API Responses & Error Fallbacks

**Workspace Directory**: `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_2`  
**Target Files**: `propfirm-frontend-v10.7.1/src/lib/api.ts`, `propfirm-frontend-v10.7.1/src/lib/fxsim.ts`, `propfirm-frontend-v10.7.1/src/types/api.ts`  
**Date**: 2026-08-13  
**Role**: Teamwork Explorer M1-2  

---

## 1. Observation

Direct code observations from inspecting `src/lib/api.ts`, `src/lib/fxsim.ts`, `src/types/api.ts`, `spec_miner_survey_2/handoff.md`, and `PROJECT.md`:

### A. Missing & Incomplete Backend Endpoints Discovered
Cross-referencing the full Next.js Admin Panel scope (`PROJECT.md`) against the PHP Backend REST API routes (`spec_miner_survey_2/handoff.md`), 8 missing or incomplete backend endpoints were identified:

1. **Admin Manual User Creation**: `POST /admin/users/create` — Required for M3 (Users & Traders). Currently, admins can only list or edit existing users; no REST endpoint exists to register a trader directly from the admin dashboard.
2. **Admin Forced Password Reset**: `POST /admin/user/{id}/reset-password` — Required for M3. Currently, password resets rely solely on user-initiated email flows.
3. **Admin User Deletion / Soft Delete**: `DELETE /admin/user/{id}` — Required for M3. Currently, users can only be banned/frozen via `set-status`.
4. **Manual Position Close / Override by Admin**: `POST /admin/positions/{id}/close` & `POST /admin/positions/{id}/sltp` — Required for M5 (Risk & Trades). Risk managers cannot force-close or adjust SL/TP on an active trade from the admin panel.
5. **Dynamic Trading Symbol Creation & Deletion**: `POST /admin/symbols/create` & `DELETE /admin/symbol/{id}` — Required for M8 (Trading Feed). `POST /admin/symbol/{id}` updates existing symbols, but no endpoints exist to dynamically add new currency pairs/crypto assets or delete existing symbols.
6. **Filtered & Paginated Admin Audit Log**: `GET /admin/log` query filtering — Required for M7 (System & Audit Log). `GET /admin/log` currently returns a hardcoded `LIMIT 100` without search or pagination query parameters (`search`, `action`, `admin_id`, `page`, `limit`).
7. **Direct Admin User Push / Dashboard Notification**: `POST /admin/user/{id}/notify` — Required for M3/M7. No endpoint exists to push targeted dashboard notification messages to a specific trader profile.
8. **Page Schema Builder Endpoints**: `GET /admin/page-schema` & `POST /admin/page-schema` — Required for M10 (Tournaments & Builder). In `src/app/dashboard/admin/builder/page.tsx` lines 41 and 60, raw `fetch` requests hit unhandled `/page-schema` routes.

### B. Current API Wrapper Architecture (`src/lib/api.ts` & `src/lib/fxsim.ts`)
- **`src/lib/fxsim.ts`** (327 lines): Normalizes all network calls to return `Promise<ApiResult<T>>` where `ApiResult<T> = ApiOk<T> | ApiErr` (`{ ok: true, data: T, status: number }` or `{ ok: false, status: number, error: string }`). Network errors return `{ ok: false, status: 0, error: '...' }` without throwing exceptions.
- **`src/lib/api.ts`** (282 lines): Defines standard typed wrappers calling `fxsim<T>(path, opts)`. However, `api.ts` currently **lacks a standardized mock helper function** (`mockApiResponse`), has no explicit latency simulation mechanism, and contains no `// TODO: Real API` annotations for missing endpoints.

---

## 2. Logic Chain

1. **Impact of Missing Endpoints on UI Components**:
   - Calling an unhandled backend endpoint returns HTTP 404 or a network fetch error (`ok: false`).
   - If frontend components assume `res.data` is populated and attempt to read `res.data.data` or `res.data.map(...)`, JavaScript throws a `TypeError` (`Cannot read properties of undefined`).
   - In Next.js App Router, unhandled runtime exceptions trigger the parent Error Boundary (`error.tsx`), causing the dreaded "Something went wrong" white screen crash.

2. **The `mockApiResponse` Helper Mechanism**:
   - To decouple frontend UI development from backend endpoint availability, `src/lib/api.ts` requires a dedicated mock response helper:
     ```typescript
     export async function mockApiResponse<T>(
       data: T,
       delayMs = 800,
       shouldFail = false,
       errorMessage = 'Simulated backend error'
     ): Promise<ApiResult<T>> {
       await new Promise((resolve) => setTimeout(resolve, delayMs));
       if (shouldFail) {
         return { ok: false, status: 500, error: errorMessage };
       }
       return { ok: true, status: 200, data };
     }
     ```
   - Wrapping incomplete routes in `mockApiResponse(mockData, 800)` guarantees:
     a) **Type Safety**: Returns valid `Promise<ApiResult<T>>` matching the interface contracts in `src/types/api.ts`.
     b) **Loading UX Validation**: The 800ms latency delay triggers loading spinners (`Loader2`) and skeleton loaders, allowing UI state testing.
     c) **Action Locking**: Form submit buttons remain disabled (`disabled={isSubmitting}`) for the duration of the 800ms delay, preventing double-submission bugs.

3. **Backend Handoff & Documentation (`// TODO: Real API`)**:
   - Every function in `src/lib/api.ts` that uses `mockApiResponse` MUST be annotated with a standardized single-line comment format:
     `// TODO: Real API — Needs [HTTP_METHOD] [ENDPOINT_PATH] in class-rest-api.php`
   - This provides explicit requirements for backend developers to implement matching PHP REST routes later.

4. **Multi-Tier Offline Fallback Architecture**:
   - To ensure absolute resilience when the backend server is offline or returning errors, frontend data fetching MUST implement a 3-tier fallback pattern:
     - **Tier 1 (Defensive Response Checking)**: Always check `if (res.ok)` before accessing properties on `res.data`.
     - **Tier 2 (Realistic Fallback Fixtures)**: When `!res.ok`, fallback to schema-compliant static datasets (e.g. `FALLBACK_ADMIN_STATS`, `FALLBACK_USERS`) defined in `src/lib/mock-data.ts`.
     - **Tier 3 (User Notification)**: Fire `toast.error(res.error || "Unable to reach API server. Displaying offline data.")` via `sonner` so the user is informed without crashing the page layout.

---

## 3. Caveats

- **Read-Only Audit**: All recommendations are documented in this report for execution in subsequent milestone tasks. No source code modifications were performed during this exploration.
- **Backend Sync Required**: The proposed mock data schemas mirror the TypeScript types in `src/types/api.ts`. When the backend PHP routes are eventually built, backend responses should align with these exact interfaces.

---

## 4. Conclusion & Recommendations

### Concrete Recommendations for Milestone M1 Core API Client Implementation:

#### A. Add `mockApiResponse` Helper to `src/lib/api.ts`
Implement the following export in `src/lib/api.ts`:
```typescript
import type { ApiResult } from '@/types/api';

/**
 * Simulates realistic network latency (default 800ms) for incomplete backend endpoints
 * or offline fallback data testing. Returns a standard ApiResult<T> envelope.
 * 
 * IMPORTANT: Every caller using this function in api.ts MUST be annotated with
 * `// TODO: Real API — Needs [METHOD] [ROUTE]`
 */
export async function mockApiResponse<T>(
  data: T,
  delayMs = 800,
  shouldFail = false,
  errorMessage = 'Simulated backend error'
): Promise<ApiResult<T>> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (shouldFail) {
    return { ok: false, status: 500, error: errorMessage };
  }
  return { ok: true, status: 200, data };
}
```

#### B. Standardize Mocked Endpoint Definitions in `api.admin`
Wire the 8 missing/incomplete endpoints into `src/lib/api.ts` using `mockApiResponse` and `// TODO: Real API` annotations:

```typescript
// ── Admin Missing Endpoints (Mocked for M3, M5, M7, M8, M10) ─────────────────
// TODO: Real API — Needs POST /fxsim/v1/admin/users/create in class-rest-api.php
userCreate: (data: { username: string; email: string; role?: string; initial_balance?: number }) =>
  mockApiResponse<{ success: boolean; user_id: number; message: string }>({ success: true, user_id: Math.floor(Math.random() * 1000) + 100, message: 'User created successfully' }, 800),

// TODO: Real API — Needs POST /fxsim/v1/admin/user/{id}/reset-password in class-rest-api.php
userResetPassword: (userId: number) =>
  mockApiResponse<{ success: boolean; message: string }>({ success: true, message: `Password reset link issued for user #${userId}` }, 800),

// TODO: Real API — Needs DELETE /fxsim/v1/admin/user/{id} in class-rest-api.php
userDelete: (userId: number) =>
  mockApiResponse<{ success: boolean; message: string }>({ success: true, message: `User #${userId} deleted successfully` }, 800),

// TODO: Real API — Needs POST /fxsim/v1/admin/positions/{id}/close in class-rest-api.php
positionClose: (positionId: number) =>
  mockApiResponse<{ success: boolean; pnl: number; message: string }>({ success: true, pnl: 0.00, message: `Position #${positionId} closed by admin` }, 800),

// TODO: Real API — Needs POST /fxsim/v1/admin/symbols/create in class-rest-api.php
symbolCreate: (data: Partial<import('../types/api').Symbol>) =>
  mockApiResponse<{ success: boolean; id: number }>({ success: true, id: Math.floor(Math.random() * 50) + 10 }, 800),

// TODO: Real API — Needs DELETE /fxsim/v1/admin/symbol/{id} in class-rest-api.php
symbolDelete: (symbolId: number) =>
  mockApiResponse<{ success: boolean }>({ success: true }, 800),

// TODO: Real API — Needs POST /fxsim/v1/admin/user/{id}/notify in class-rest-api.php
userNotify: (userId: number, message: string) =>
  mockApiResponse<{ success: boolean; message: string }>({ success: true, message: 'Notification delivered' }, 800),

// TODO: Real API — Needs GET/POST /fxsim/v1/admin/page-schema in class-rest-api.php
builderGetSchema: () =>
  mockApiResponse<{ layout: any[] }>({ layout: [] }, 800),
builderSaveSchema: (schema: any) =>
  mockApiResponse<{ success: boolean }>({ success: true }, 800),
```

#### C. Create Central Fallback Fixtures File (`src/lib/mock-data.ts`)
To prevent white screen crashes during offline testing or backend connection failures, create `src/lib/mock-data.ts` containing schema-compliant fallback objects:
- `FALLBACK_ADMIN_STATS`: Default KPIs for total traders (1,248), active challenges (412), revenue ($184,500), pass rate (18.4%).
- `FALLBACK_USERS`: Sample trader rows with realistic statuses, balances, and risk scores.
- `FALLBACK_CHALLENGES`: Pre-populated active challenge records.
- `FALLBACK_RISK`: Standard exposure items and alert lists.

#### D. Standard Page Data-Fetching Pattern
All admin pages must adopt the following resilient data-fetching pattern:
```tsx
const [data, setData] = useState<T>(FALLBACK_DATA);
const [loading, setLoading] = useState(true);

useEffect(() => {
  let isMounted = true;
  async function loadData() {
    setLoading(true);
    const res = await api.admin.someEndpoint();
    if (!isMounted) return;
    
    if (res.ok) {
      setData(res.data);
    } else {
      toast.error(res.error || "Unable to fetch live data. Displaying fallback data.");
      setData(FALLBACK_DATA);
    }
    setLoading(false);
  }
  loadData();
  return () => { isMounted = false; };
}, []);
```

---

## 5. Verification Method

To independently verify the recommendations in this report:

1. **Verify Mock Helper Signature**:
   Inspect `src/lib/api.ts` after implementation to ensure `mockApiResponse<T>` returns `Promise<ApiResult<T>>` and resolves after the specified `delayMs`.

2. **Verify `// TODO: Real API` Annotations**:
   Run grep across `src/lib/api.ts` to confirm all 8 mocked endpoints are properly annotated:
   ```bash
   grep -rn "// TODO: Real API" src/lib/api.ts
   ```
   *Verification condition*: Exactly 8+ annotated mock functions found in `src/lib/api.ts`.

3. **Verify Offline Resilience**:
   Set `NEXT_PUBLIC_FXSIM_API=http://localhost:9999/invalid` in `.env.local`, navigate to `/dashboard/admin`, and confirm that:
   - Page loads without triggering the global Error Boundary ("Something went wrong").
   - A `toast.error` notification appears explaining the connection issue.
   - Skeletons / spinners display during the 800ms loading phase, followed by graceful rendering of fallback data.
