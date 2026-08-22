# Task: fix cross-domain login redirect (admin panel never opens after login)

## Symptom

On `demo.launchapropfirm.com` (frontend) logging in against `api.launchapropfirm.com` (backend): the login form submits, a "Welcome back" toast fires, but the app never navigates to `/dashboard` or `/dashboard/admin` — it silently stays on (or bounces back to) `/login`.

## Root cause (confirmed by direct code read, not a guess)

`propfirm-frontend-v10.7.1/src/middleware.ts` (lines 7-9) gates every `/dashboard/*` and `/admin/*` request like this:

```ts
const cookies = request.cookies.getAll()
const hasAuthCookie = cookies.some(c => c.name.startsWith('wordpress_logged_in_'))
```

That `wordpress_logged_in_*` cookie is WordPress's own httpOnly auth cookie, set by `wp_set_auth_cookie()` in `backend-email-update v10.7.1/protradefx-headless-bridge/protradefx-headless-bridge.php` (in `login()`, `verify_2fa()`, `register()`). It is scoped to **`api.launchapropfirm.com`** — the domain WordPress is actually running on. Nothing in the plugin widens that scope.

`demo.launchapropfirm.com` is a **different domain** from `api.launchapropfirm.com`. `request.cookies` in Next.js middleware only ever sees cookies that were set for the domain the request is hitting (the frontend's own domain). The WordPress auth cookie, scoped to `api.launchapropfirm.com`, is never present there — so `hasAuthCookie` is **always false**, and middleware bounces every dashboard/admin navigation back to `/login`, regardless of whether login actually succeeded on the backend. This is exactly why "Welcome back" fires (that toast only depends on the login API call succeeding, which it does) but nothing after it works.

**Do NOT try to fix this by widening WordPress's `COOKIE_DOMAIN` constant from inside the plugin.** `wp_cookie_constants()` runs in WordPress's own `wp-settings.php`, before any plugin code executes — even mu-plugins. A `define('COOKIE_DOMAIN', ...)` call anywhere in this plugin is a silent no-op; the constant is already locked by the time the plugin's code runs. This needs an application-level fix, not a WP-core-constant fix.

## The fix

Ship a second, explicit, non-httpOnly "I'm logged in" flag cookie that the plugin sets itself via plain `setcookie()` (which CAN take an arbitrary `domain` argument regardless of WP's own `COOKIE_DOMAIN`), with the domain driven by a new admin-configurable setting so this works correctly for every white-label client's own domain split (some deployments are same-domain, some are split like this one). The middleware checks that cookie instead.

### 1. Backend — `backend-email-update v10.7.1/protradefx-headless-bridge/protradefx-headless-bridge.php`

Add two private helpers (near `generate_csrf_token()`, ~line 127):

```php
private static function set_session_flag_cookie( int $user_id, bool $remember ): void {
    $domain = trim( (string) get_option( 'fxsim_cookie_domain', '' ) );
    $expire = $remember ? time() + 30 * DAY_IN_SECONDS : 0; // 0 = browser-session cookie
    $args = [
        'expires'  => $expire,
        'path'     => '/',
        'secure'   => is_ssl(),
        'httponly' => false, // carries no sensitive data — a presence flag for edge middleware only
        'samesite' => 'Lax',
    ];
    if ( $domain !== '' ) $args['domain'] = $domain;
    setcookie( 'fxsim_authed', '1', $args );
}

private static function clear_session_flag_cookie(): void {
    $domain = trim( (string) get_option( 'fxsim_cookie_domain', '' ) );
    $args = [ 'expires' => time() - HOUR_IN_SECONDS, 'path' => '/', 'secure' => is_ssl(), 'httponly' => false, 'samesite' => 'Lax' ];
    if ( $domain !== '' ) $args['domain'] = $domain;
    setcookie( 'fxsim_authed', '', $args );
}
```

Call `self::set_session_flag_cookie( $user->ID, $remember )` immediately after each existing `wp_set_auth_cookie(...)` call:
- `login()` (~line 282) — use the existing `$remember` param.
- `verify_2fa()` (~line 317) — this method already calls `wp_set_auth_cookie( $user->ID, true, is_ssl() )`, so pass `true`.
- `register()` (~line 384) — same, already passes `true`.

Find the `logout()` handler (registered at `/auth/logout`, near the other route handlers) and call `self::clear_session_flag_cookie()` there, alongside its existing `wp_clear_auth_cookie()`/`wp_logout()` call.

### 2. Backend — `backend-email-update v10.7.1/propfirm-system/includes/class-rest-api.php`

Make `fxsim_cookie_domain` an admin-configurable setting, same pattern as the existing `radius`/`brand_name` fields:
- In `admin_whitelabel_save()` (~line 3665), add `'cookie_domain'` to the `$allowed` whitelist array.
- In the whitelabel GET handler (~line 3598, the `$g(...)` block), add `'cookie_domain' => $g('cookie_domain', ''),` so it round-trips back out.

(Note: the option is stored as `fxsim_cookie_domain` via `FXSIM_Challenge_DB::get_setting()`/`set_setting()` — same storage layer the `radius` field uses. Confirm the exact option-name prefix convention this codebase uses for whitelabel settings before wiring it — match whatever `radius` or `brand_name` actually resolve to under the hood.)

### 3. Frontend — `propfirm-frontend-v10.7.1/src/app/admin/config/page.tsx`

Add a text input in the Whitelabel & Media tab (near wherever `fxsim_frontend_url`-style cross-domain settings live) bound to the new field, e.g.:

> **Auth Cookie Domain (optional)** — "Only needed if your login/API domain (e.g. `api.yoursite.com`) is on a different subdomain from your app (e.g. `app.yoursite.com`). Enter the shared parent domain with a leading dot, e.g. `.yoursite.com`. Leave blank if both are on the exact same domain."

Save it through the existing whitelabel-save mutation already used for other fields on this page.

### 4. Frontend — `propfirm-frontend-v10.7.1/src/middleware.ts`

Replace the cookie check (lines 7-9):

```ts
const hasAuthCookie = request.cookies.get('fxsim_authed')?.value === '1'
```

(Delete the now-unused `cookies` variable / `.some(...)` prefix-scan.)

## Deployment step for THIS site specifically (not a code change — tell the user)

After this ships and gets uploaded to `api.launchapropfirm.com`: go into **Config & Engine Hub → Whitelabel & Media**, set the new cookie-domain field to `.launchapropfirm.com`, save, then log out and log back in once — existing sessions won't retroactively pick up the new cookie.

## Verification before reporting back

1. `php -l` both changed PHP files.
2. Trace by reading the code (not assuming): confirm `set_session_flag_cookie()` is genuinely called in all three of `login()`/`verify_2fa()`/`register()`, and `clear_session_flag_cookie()` is genuinely called in `logout()`.
3. Confirm the new `cookie_domain` field genuinely round-trips: save a value via `admin_whitelabel_save`, then confirm `admin_whitelabel_get` (or whatever the GET route is) returns it back.
4. If you have a way to run this live (e.g. against the LocalWP dev site): log in, open DevTools → Application → Cookies, confirm a `fxsim_authed=1` cookie now exists (with the configured domain if `fxsim_cookie_domain` is set), and confirm `/dashboard` or `/admin` actually loads after login instead of bouncing back to `/login`.
5. Confirm you have NOT changed anything about the existing `wordpress_logged_in_*` / WP core auth cookie or the CSRF nonce system — those still fully gate the actual API calls. This new cookie is purely an additional, non-sensitive presence flag for the frontend's edge middleware; it must not become the thing that authorizes API requests.

## Deliverable

Same format as before: what you changed (files/lines), and how you verified it actually works end-to-end — not just "the code looks right."
