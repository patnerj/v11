# Handoff Report — Core API Client & Global Standards (Milestone M1)

## 1. Observation

A detailed read-only investigation of `src/lib/api.ts`, `src/lib/fxsim.ts`, `src/types/api.ts`, and `src/hooks/useApi.ts` in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1` was performed to define core API client standards for Milestone M1.

### A. Current Implementation Findings

1. **API Surface Scope (`src/lib/api.ts`)**:
   - `src/lib/api.ts` (282 lines) exports a unified `api` namespace containing over **80 strongly-typed API call functions** divided into `auth`, `prices`, `banners`, `branding`, `symbols`, `challengePlans`, `leaderboard`, `account`, `positions`, `open`, `close`, `partialClose`, `sltp`, `history`, `pendingPlace`, `challengeMy`, `payouts`, `kyc`, `tickets`, `competitions`, `paymentConfig`, `notifications`, `apiKeys`, and `admin` sub-namespaces (lines 20–281).
   - Every function delegates execution to `fxsim<T>(path, opts)` defined in `src/lib/fxsim.ts`.

2. **Base URL Resolution (`src/lib/fxsim.ts`, lines 20–25)**:
   ```ts
   const RAW_BASE = (process.env.NEXT_PUBLIC_FXSIM_API ?? '').trim()
   if (!RAW_BASE && typeof window !== 'undefined') {
     console.warn('[fxsim] NEXT_PUBLIC_FXSIM_API not set — API calls will fail')
   }
   export const FXSIM_BASE = RAW_BASE.replace(/\/$/, '')
   ```
   *Observation*: `FXSIM_BASE` currently relies exclusively on `process.env.NEXT_PUBLIC_FXSIM_API`. It does not check `NEXT_PUBLIC_API_URL` (the primary standard specified in `PROJECT.md`), nor does it provide a fallback to `/api/wp`.

3. **Request Options & Header Construction (`src/lib/fxsim.ts`, lines 70–83, 260–274)**:
   ```ts
   const headers: Record<string, string> = {}
   if (!opts.form) headers['Content-Type'] = 'application/json'
   const currentSession = getSessionState()
   if (!opts.public && currentSession.nonce)  headers['X-WP-Nonce']    = currentSession.nonce
   if (currentSession.bearer)                 headers['Authorization'] = `Bearer ${currentSession.bearer}`

   const init: RequestInit = {
     method,
     credentials: 'include',
     headers,
     signal: opts.signal,
     cache:  'no-store',
   }
   ```
   *Observation*: `RequestOptions` lacks an explicit `headers?: Record<string, string>` property to accept custom headers from callers. Credentials (`credentials: 'include'`) are properly enabled for cross-origin cookie authentication, but `mode: 'cors'` is omitted from `RequestInit`.

4. **Transport Error Normalization (`src/lib/fxsim.ts`, lines 277–319)**:
   - Network timeouts (10,000ms via `AbortController`) and fetch exceptions (DNS failures, CORS blocks) are caught and normalized into `{ ok: false, status: 0, error: message }` rather than throwing unhandled exceptions.
   - HTTP non-2xx responses (4xx, 5xx) are parsed and converted to `ApiErr`: `{ ok: false, status: res.status, error: message, raw: parsed }`.
   - Expired cookie sessions containing `"cookie check failed"` messages are mapped to `"Your session has expired. Please sign in again."`.

5. **Incomplete Endpoints & Mocking**:
   - `fxsim.ts` currently lacks a built-in mock latency helper for unimplemented backend endpoints. When a component calls an unbuilt endpoint, the client returns a 404 `ApiErr`, which throws in React Query functions if unhandled.

---

## 2. Logic Chain

1. **Base URL Fallback Standard**:
   - High-availability deployments and Next.js environments frequently supply `NEXT_PUBLIC_API_URL` as the primary API host variable.
   - Checking `process.env.NEXT_PUBLIC_API_URL` first, falling back to `process.env.NEXT_PUBLIC_FXSIM_API`, and defaulting to `'/api/wp'` ensures seamless operation across development, staging, production, and reverse-proxy setups without configuration failure.

2. **Header Merging & CORS Hygiene**:
   - Allowing callers to supply optional custom headers via `opts.headers` in `RequestOptions` prevents header collisions while allowing custom headers (such as `X-Requested-With` or `X-Client-Version`).
   - Retaining `credentials: 'include'` is required for WordPress cookie/nonce authentication. Explicitly declaring `mode: 'cors'` clarifies cross-origin request handling.

3. **Non-Throwing Error Handling Guarantee**:
   - Because `fxsim<T>` guarantees returning an `ApiResult<T>` (`ApiOk<T> | ApiErr`), UI components can safely branch on `result.ok` without wrapping every API call in a `try/catch` block.
   - When HTML error pages (e.g., PHP 500 stack traces or Nginx 404 pages) are returned, sanitizing the error text into a clean message (e.g., `"Server Error (500)"` or `"API endpoint not found (404)"`) prevents raw 10KB HTML dumps from breaking UI toast notifications.

4. **Mocking Helper for Incomplete Endpoints**:
   - Providing `mockApiResult<T>(mockData: T, latencyMs = 800)` using `Promise.resolve` + `setTimeout` standardizes the mock pattern across all admin modules (Requirement R2 in `ORIGINAL_REQUEST.md`).
   - Annotating mocked calls with `// TODO: Real API` allows backend developers to locate and wire real endpoints quickly.

5. **UI State & Toast Conventions**:
   - Action buttons during network calls must use `disabled={isSubmitting}` or `loading={isSubmitting}`.
   - Toast notifications (`sonner`) should be fired automatically or via helper `handleApiResult()` upon response arrival, with `<Loader2 className="animate-spin" />` or `<Skeleton />` indicating loading state.

---

## 3. Caveats

- **Read-Only Investigation**: No source code files in `propfirm-frontend-v10.7.1` were altered during this audit. The proposed changes must be applied by the implementer.
- **Backend CORS Configuration**: While `credentials: 'include'` and `mode: 'cors'` are set on the Next.js client, the WordPress PHP backend must return valid CORS headers (`Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Origin: <origin>`, `Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, Authorization`) for cross-origin requests.
- **Session Security**: `nonce` tokens are stored in `localStorage` for session persistence across tab reloads, while `bearer` API tokens are maintained in-memory only to prevent XSS credential theft.

---

## 4. Conclusion & Recommended Code Changes

To standardize `src/lib/fxsim.ts` and `src/lib/api.ts` for Milestone M1, apply the following 5 refactorings:

### Proposed Refactoring 1: Standardized `getApiBaseUrl()` in `src/lib/fxsim.ts`

Replace lines 20–25 in `src/lib/fxsim.ts`:

```ts
/**
 * Resolves the primary API base URL with full fallback support:
 * 1. process.env.NEXT_PUBLIC_API_URL (Primary standard)
 * 2. process.env.NEXT_PUBLIC_FXSIM_API (Secondary / legacy)
 * 3. '/api/wp' (Default relative fallback)
 */
export function getApiBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_FXSIM_API ||
    '/api/wp'
  return envUrl.trim().replace(/\/$/, '')
}

export const FXSIM_BASE = getApiBaseUrl()
```

### Proposed Refactoring 2: Updated `RequestOptions` & `rawFetch` Header Merging in `src/lib/fxsim.ts`

Update `RequestOptions` interface (lines 70–83):

```ts
export interface RequestOptions {
  method?:  'GET' | 'POST' | 'PUT' | 'DELETE'
  body?:    unknown
  query?:   Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  signal?:  AbortSignal
  form?:    FormData
  public?:  boolean
  cache?:   number
  force?:   boolean
  retries?: number
}
```

Update `rawFetch` header construction (lines 260–274):

```ts
async function rawFetch<T>(
  url: string, method: string, opts: RequestOptions,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    ...(opts.headers || {}),
  }
  if (!opts.form && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const currentSession = getSessionState()
  if (!opts.public && currentSession.nonce && !headers['X-WP-Nonce']) {
    headers['X-WP-Nonce'] = currentSession.nonce
  }
  if (currentSession.bearer && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentSession.bearer}`
  }

  const init: RequestInit = {
    method,
    credentials: 'include',
    mode: 'cors',
    headers,
    signal: opts.signal,
    cache:  'no-store',
  }
  if (opts.form)      init.body = opts.form
  else if (opts.body) init.body = JSON.stringify(opts.body)
```

### Proposed Refactoring 3: Enhanced Error Parsing & HTML Error Sanitization in `src/lib/fxsim.ts`

Update non-2xx error handling in `rawFetch` (lines 301–316):

```ts
  if (!res.ok) {
    let message = `Request failed (${res.status})`

    if (parsed && typeof parsed === 'object' && parsed !== null) {
      const err = parsed as Record<string, unknown>
      message = (err.message as string) || (err.error as string) || message
    } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
      if (parsed.includes('<html') || parsed.includes('<!DOCTYPE')) {
        message = res.status === 404
          ? 'API endpoint not found (404)'
          : `Server error (${res.status}). Please try again later.`
      } else {
        message = parsed.slice(0, 150)
      }
    }

    if (/cookie/i.test(message) && /check failed/i.test(message)) {
      message = 'Your session has expired. Please sign in again.'
    }
    const out: ApiErr = { ok: false, status: res.status, error: message, raw: parsed }
    return out
  }
```

### Proposed Refactoring 4: `mockApiResult` Helper in `src/lib/fxsim.ts`

Add export to `src/lib/fxsim.ts`:

```ts
/**
 * Helper to simulate API responses with artificial latency for incomplete/unwired endpoints.
 * Returns an ApiOk<T> result wrapped in a Promise.
 *
 * Usage:
 *   mockApiResult({ success: true, items: [] }, 800) // TODO: Real API
 */
export function mockApiResult<T>(mockData: T, latencyMs = 800): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        status: 200,
        data: mockData,
      })
    }, latencyMs)
  })
}
```

### Proposed Refactoring 5: Global API Result & Toast Utility (`handleApiResult`) in `src/lib/api.ts`

Export `handleApiResult` utility in `src/lib/api.ts`:

```ts
import { toast } from 'sonner'
import type { ApiResult } from '@/types/api'

export function handleApiResult<T>(
  result: ApiResult<T>,
  options?: {
    successMessage?: string
    errorMessage?: string
    onSuccess?: (data: T) => void
    onError?: (error: string) => void
  }
): boolean {
  if (result.ok) {
    if (options?.successMessage) {
      toast.success(options.successMessage)
    }
    options?.onSuccess?.(result.data)
    return true
  } else {
    const errorMsg = options?.errorMessage || result.error || 'An error occurred'
    toast.error(errorMsg)
    options?.onError?.(result.error)
    return false
  }
}
```

---

## 5. Verification Method

To verify these changes after implementation:

1. **TypeScript Typecheck**:
   Run `npx tsc --noEmit` inside `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1` to confirm no type compilation errors.

2. **Base URL Resolution Test**:
   - Test without `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_FXSIM_API` set; verify `getApiBaseUrl()` returns `'/api/wp'`.
   - Test with `NEXT_PUBLIC_API_URL=https://api.example.com/`; verify `getApiBaseUrl()` returns `'https://api.example.com'`.

3. **Simulated Error Handling Verification**:
   - Simulate 500 HTML response: verify toast shows `"Server error (500). Please try again later."` instead of raw HTML.
   - Simulate 404 HTML response: verify toast shows `"API endpoint not found (404)"`.
   - Simulate network failure / offline: verify result returns `{ ok: false, status: 0, error: 'Network error' }` without throwing.

4. **Mock Helper Verification**:
   Call `mockApiResult({ test: 1 }, 800)`; verify it delays for 800ms and returns `{ ok: true, status: 200, data: { test: 1 } }`.
