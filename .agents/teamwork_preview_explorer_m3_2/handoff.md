# Handoff Report: PHP WordPress REST API User Endpoints Investigation

**Module**: Users & Trader Management (Milestone M3)  
**Target File**: `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`  
**Frontend Client File**: `propfirm-frontend-v10.7.1/src/lib/api.ts`  
**Frontend Pages**: `src/app/dashboard/admin/users/page.tsx`, `src/app/dashboard/admin/users/[id]/page.tsx`  
**Investigator**: Teamwork Explorer M3_2  
**Date**: 2026-08-13  

---

## 1. Observation

Direct code examination of `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` and `propfirm-frontend-v10.7.1/src/lib/api.ts` revealed the following registered routes and corresponding callback implementations:

### Registered Backend User Routes (`class-rest-api.php`)
- **Line 100**: `register_rest_route(self::NS, '/admin/users', ['methods'=>'GET', 'callback'=>[self::class,'admin_users'], 'permission_callback'=>$is_admin]);`
- **Line 101**: `register_rest_route(self::NS, '/admin/users/(?P<id>\d+)/risk-profile', ['methods'=>'GET', 'callback'=>[self::class,'admin_user_risk_profile'], 'permission_callback'=>$is_admin]);`
- **Line 102**: `register_rest_route(self::NS, '/admin/adjust-balance', ['methods'=>'POST', 'callback'=>[self::class,'admin_adjust'], 'permission_callback'=>$is_admin]);`
- **Line 107**: `register_rest_route(self::NS, '/admin/set-status', ['methods'=>'POST', 'callback'=>[self::class,'admin_set_status'], 'permission_callback'=>$is_admin]);`
- **Line 113**: `register_rest_route(self::NS, '/admin/user/(?P<id>\d+)/note', ['methods'=>'POST', 'callback'=>[self::class,'admin_user_note_save'], 'permission_callback'=>$is_admin]);`
- **Line 114**: `register_rest_route(self::NS, '/admin/user/(?P<id>\d+)', ['methods'=>'GET', 'callback'=>[self::class,'admin_user_detail'], 'permission_callback'=>$is_admin]);`
- **Line 138**: `register_rest_route(self::NS, '/admin/impersonate', ['methods'=>'POST', 'callback'=>[self::class,'admin_impersonate'], 'permission_callback'=>$is_admin]);`
- **Line 139**: `register_rest_route(self::NS, '/admin/impersonate/stop', ['methods'=>'POST', 'callback'=>[self::class,'admin_impersonate_stop'], 'permission_callback'=>$auth]);`
- **Line 142**: `register_rest_route(self::NS, '/admin/bulk-email', ['methods'=>'POST', 'callback'=>[self::class,'admin_bulk_email'], 'permission_callback'=>$is_admin]);`

### Detailed Breakdown of Backend User Endpoints

#### 1. User Listing (`GET /fxsim/v1/admin/users`)
- **Callback**: `admin_users` (`class-rest-api.php:843-887`)
- **Query Parameters**:
  - `search` (string, optional): Sanitized via `sanitize_text_field`. Matches against `user_login` or `user_email`.
  - `page` (int, optional, default: 1): Page index.
  - `limit` (int, optional, default: 25, range: 10–100): Items per page.
- **SQL Queries**:
  - Total count:
    ```sql
    SELECT COUNT(*) FROM wp_users u WHERE 1=1 AND (u.user_login LIKE '%search%' OR u.user_email LIKE '%search%')
    ```
  - Result set (with LEFT JOIN to include users without trading accounts):
    ```sql
    SELECT
        u.ID        AS user_id,
        u.user_login,
        u.user_email,
        u.user_registered,
        COALESCE(a.balance,    0)        AS balance,
        COALESCE(a.equity,     0)        AS equity,
        COALESCE(a.margin_used,0)        AS margin_used,
        COALESCE(a.status,     'no_account') AS status,
        a.id        AS account_id,
        (SELECT COUNT(*) FROM wp_fxsim_challenge_accounts ca
         WHERE ca.user_id = u.ID AND ca.status = 'active')   AS active_challenges,
        (SELECT COUNT(*) FROM wp_fxsim_challenge_accounts ca2
         WHERE ca2.user_id = u.ID AND ca2.status = 'funded') AS funded_challenges
    FROM wp_users u
    LEFT JOIN wp_fxsim_accounts a ON a.user_id = u.ID
    WHERE 1=1 [WHERE_CLAUSE]
    ORDER BY u.ID DESC
    LIMIT %d OFFSET %d
    ```
- **Response Format**:
  - `{ data: Array<Row>, total: int, page: int, pages: int, limit: int }`

#### 2. Trader 360 Detail (`GET /fxsim/v1/admin/user/{id}`)
- **Callback**: `admin_user_detail` (`class-rest-api.php:1016-1060`)
- **Path Parameter**: `id` (int): WordPress User ID.
- **SQL Queries & Aggregation**:
  - `get_userdata($uid)`: Retrieves WP user record (returns 404 if user does not exist).
  - `SELECT id, plan_id, phase, status, starting_balance, current_balance, trading_days, created_at, phase_started_at FROM wp_fxsim_challenge_accounts WHERE user_id=%d ORDER BY created_at DESC`
  - `SELECT id, plan_id, amount, gateway, status, created_at, reviewed_at FROM wp_fxsim_payment_orders WHERE user_id=%d ORDER BY created_at DESC`
  - `SELECT id, challenge_id, amount_requested, trader_amount, status, admin_note, requested_at, reviewed_at FROM wp_fxsim_payouts WHERE user_id=%d ORDER BY requested_at DESC`
  - `SELECT id, status, admin_note, reviewed_at FROM wp_fxsim_kyc WHERE user_id=%d ORDER BY id DESC LIMIT 1`
  - `SELECT a.status, a.balance, a.equity FROM wp_fxsim_accounts a WHERE a.user_id=%d ORDER BY a.id DESC LIMIT 1`
  - `SELECT action, details, created_at FROM wp_fxsim_admin_log WHERE target_user_id=%d ORDER BY created_at DESC LIMIT 50`
  - Admin note retrieved via `get_user_meta($uid, 'fxsim_admin_note', true)`.
  - Merges events into unified `timeline` array sorted by timestamp descending.
- **Response Format**:
  - `{ user: { id, username, email, display_name, registered }, account: Object|null, note: string, challenges: Array, payments: Array, payouts: Array, kyc: Object|null, timeline: Array }`

#### 3. Balance Adjustment (`POST /fxsim/v1/admin/adjust-balance`)
- **Callback**: `admin_adjust` (`class-rest-api.php:948-969`)
- **Request Body Parameters**:
  - `user_id` (int, optional if `account_id` present)
  - `account_id` (int, optional if `user_id` present)
  - `amount` (float, required): Positive to add, negative to deduct.
  - `note` (string, optional, default: 'Admin adjustment')
- **SQL Queries & Logic**:
  - Account resolution: If `account_id` provided, calls `FXSIM_Database::get_account_by_id($account_id)`. Otherwise calls `self::get_active_challenge_account($user_id)`.
  - Calculates `$new_bal = max(0, (float)$acc->balance + $amount)`.
  - Updates database: `$wpdb->update('wp_fxsim_accounts', ['balance' => $new_bal, 'equity' => $new_bal], ['id' => $acc->id])`.
  - Logs transaction in `wp_fxsim_transactions` via `FXSIM_Database::log_transaction` and admin audit log via `FXSIM_Database::log_admin`.
- **Response Format**:
  - `{ success: true, new_balance: float }` (or `{ error: 'Account not found' }` 404).

#### 4. Account Status Update (`POST /fxsim/v1/admin/set-status`)
- **Callback**: `admin_set_status` (`class-rest-api.php:1218-1237`)
- **Request Body Parameters**:
  - `user_id` (int, required)
  - `status` (string, required): Strictly validated against `['active', 'frozen', 'banned']`.
- **SQL Queries & Logic**:
  - Invokes `FXSIM_Trading_Engine::set_account_status($user_id, $status)` which updates `wp_fxsim_accounts` setting `status = $status` where `user_id = $user_id`.
  - Audits action in `wp_fxsim_admin_log`.
  - If status is `frozen` or `banned`, calls `FXSIM_Database::push_admin_notification('warning', ...)` to notify admin dashboard.
- **Response Format**:
  - `{ success: true }` (or `{ success: false, message: string }` 400).

#### 5. User Risk Profile (`GET /fxsim/v1/admin/users/{id}/risk-profile`)
- **Callback**: `admin_user_risk_profile` (`class-rest-api.php:889-946`)
- **Path Parameter**: `id` (int): WordPress User ID.
- **SQL Queries & Heuristics**:
  - Retrieves login IPs from user meta `fxsim_recent_ips`.
  - Queries toxic trades:
    ```sql
    SELECT id, symbol, type, opened_at, close_price, is_toxic FROM wp_fxsim_trades WHERE account_id IN (SELECT id FROM wp_fxsim_accounts WHERE user_id = %d) AND is_toxic = 1 ORDER BY id DESC LIMIT 50
    ```
    and toxic challenge trades:
    ```sql
    SELECT id, symbol, type, opened_at, close_price, is_toxic FROM wp_fxsim_challenge_trades WHERE account_id IN (SELECT id FROM wp_fxsim_challenge_accounts WHERE user_id = %d) AND is_toxic = 1 ORDER BY id DESC LIMIT 50
    ```
  - Heuristic score calculation: `min(100, count(toxic_trades) * 10 + max(0, unique_ips - 2) * 5)`.
  - Risk Level: `< 40` Low, `40 - 79` Medium, `>= 80` High.
- **Response Format**:
  - `{ success: true, recent_ips: Array, toxic_trades: Array, risk_score: number, risk_level: string }`

#### 6. Admin User Note (`POST /fxsim/v1/admin/user/{id}/note`)
- **Callback**: `admin_user_note_save` (`class-rest-api.php:1004-1012`)
- **Path Parameter**: `id` (int): WordPress User ID.
- **Request Body Parameter**: `note` (string, sanitized via `sanitize_textarea_field`).
- **WP & DB Logic**:
  - Validates user via `get_userdata($uid)`.
  - Updates meta: `update_user_meta($uid, 'fxsim_admin_note', $note)`.
  - Audits in `wp_fxsim_admin_log`.
- **Response Format**:
  - `{ success: true }`

---

## 2. Logic Chain

1. **Route Mapping Comparison**:
   - The user request specified assessing endpoints for user management (`GET /fxsim/v1/admin/users`, `GET /fxsim/v1/admin/users/{id}`, `POST /fxsim/v1/admin/users/adjust-balance`, status updates, user risk scores, notes).
   - Comparing backend `class-rest-api.php` registrations with frontend `src/lib/api.ts` shows complete functional alignment, but with specific endpoint naming conventions:
     - User detail is registered as singular `/admin/user/{id}`. Frontend `api.ts` correctly targets `/admin/user/${userId}`.
     - Balance adjustment is registered at root `/admin/adjust-balance` (without `/users/` prefix). Frontend `api.ts` correctly targets `/admin/adjust-balance`.
     - Account status update is registered at root `/admin/set-status`. Frontend `api.ts` correctly targets `/admin/set-status`.
     - User risk profile is registered at `/admin/users/{id}/risk-profile`. Frontend `api.ts` targets `/admin/users/${userId}/risk-profile`.
     - User note is registered as singular `/admin/user/{id}/note`. Frontend `api.ts` targets `/admin/user/${userId}/note`.

2. **Missing Endpoints Identification**:
   - Examination of frontend `src/lib/api.ts` (lines 337–348) revealed three explicitly commented missing backend endpoints (`// TODO: Real API`):
     - `POST /fxsim/v1/admin/users/create` (`userCreate`): Missing in `class-rest-api.php`. No admin endpoint exists to create a user account directly.
     - `POST /fxsim/v1/admin/user/{id}/reset-password` (`userResetPassword`): Missing in `class-rest-api.php`. Only public self-service `/auth/request-reset` exists.
     - `DELETE /fxsim/v1/admin/user/{id}` (`userDelete`): Missing in `class-rest-api.php`. No endpoint exists to delete a user.
   - Also, risk management frontend methods `riskAlerts` (`/admin/risk/alerts`) and `riskExposure` (`/admin/risk/exposure`) use mocks; backend provides `/admin/risk/toxic` and `/admin/risk/heatmap` instead.

3. **SQL Query & Parameter Integrity**:
   - In `admin_users`, the search condition uses `$wpdb->prepare` for `%search%` wildcards, preventing SQL injection. Page limit is bounded (`max(10, min(100, ...))`).
   - In `admin_adjust`, amount calculation uses `max(0, balance + amount)` preventing negative account balances.
   - In `admin_set_status`, status input is strictly sanitized and validated against `['active', 'frozen', 'banned']`.

---

## 3. Caveats

- **No Code Changes Made**: This report is strictly read-only analysis in compliance with investigation protocol.
- **Frontend Fallbacks**: The frontend client `api.ts` handles missing endpoints via `mockApiResponse(..., 800)`.
- **Database Table Dependencies**: `admin_users` relies on `wp_fxsim_accounts` and `wp_fxsim_challenge_accounts`. If a user has no row in `wp_fxsim_accounts`, `LEFT JOIN` returns default values (`balance = 0`, `status = 'no_account'`).

---

## 4. Conclusion

The PHP WordPress REST API plugin (`class-rest-api.php`) implements core user management endpoints. 

### Summary Matrix: Requested vs Actual Endpoints

| Requested Feature / Endpoint | Registered Backend Route | Backend Callback Method | Frontend Status | Match Type |
|---|---|---|---|---|
| List Users (`GET /admin/users`) | `/fxsim/v1/admin/users` | `admin_users` | `api.admin.users` | **EXACT MATCH** |
| User Detail (`GET /admin/users/{id}`) | `/fxsim/v1/admin/user/{id}` | `admin_user_detail` | `api.admin.userDetail` | **PATH CONVENTION MATCH** (Singular `/user/{id}`) |
| Adjust Balance (`POST /admin/users/adjust-balance`) | `/fxsim/v1/admin/adjust-balance` | `admin_adjust` | `api.admin.adjustBalance` | **PATH CONVENTION MATCH** (Root `/admin/adjust-balance`) |
| Set Status (`POST /admin/set-status`) | `/fxsim/v1/admin/set-status` | `admin_set_status` | `api.admin.setStatus` | **EXACT MATCH** |
| User Risk Profile (`GET /admin/users/{id}/risk-profile`) | `/fxsim/v1/admin/users/{id}/risk-profile` | `admin_user_risk_profile` | `api.admin.userRiskProfile` | **EXACT MATCH** |
| Save User Note (`POST /admin/user/{id}/note`) | `/fxsim/v1/admin/user/{id}/note` | `admin_user_note_save` | `api.admin.saveUserNote` | **EXACT MATCH** |
| Create User (`POST /admin/users/create`) | *None* | *None* | Mocked in `api.ts` | **MISSING IN BACKEND** |
| Reset Password (`POST /admin/user/{id}/reset-password`) | *None* | *None* | Mocked in `api.ts` | **MISSING IN BACKEND** |
| Delete User (`DELETE /admin/user/{id}`) | *None* | *None* | Mocked in `api.ts` | **MISSING IN BACKEND** |

---

## 5. Verification Method

To verify these observations independently:

1. **Inspect Route Registrations**:
   Open `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php` lines 100–115 to verify route registrations.

2. **Inspect Callback Logic & Queries**:
   - `admin_users`: lines 843–887
   - `admin_user_risk_profile`: lines 889–946
   - `admin_adjust`: lines 948–969
   - `admin_user_note_save`: lines 1004–1012
   - `admin_user_detail`: lines 1016–1060
   - `admin_set_status`: lines 1218–1237

3. **Inspect Frontend API Calls**:
   Open `propfirm-frontend-v10.7.1/src/lib/api.ts` lines 183–203 and 337–348.
