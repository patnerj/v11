/**
 * PropFirm System — Service Worker
 *
 * Cache strategy:
 *
 *   STATIC ASSETS (terminal.css, terminal.js, dashboard.css, dashboard.js,
 *   Chart.js CDN, Google Fonts CDN):
 *     → Cache-first: serve from cache, refresh in background
 *     → Versioned URLs mean a new version always busts the cache
 *
 *   REST API requests (/wp-json/fxsim/v1/*):
 *     → Network-only: NEVER cache live trading data
 *     → SSE stream: pass through entirely (streaming response)
 *
 *   Navigation requests (page HTML):
 *     → Network-first: try network, fall back to offline shell on failure
 *     → Offline shell shows a "reconnecting" message on trading page
 *
 * This SW is intentionally conservative — it enhances load speed for assets
 * but never intercepts or modifies live trading data.
 *
 * Version is injected by PHP via fxsimSW.version when the SW is registered.
 * Change CACHE_VERSION to force all clients to update their cache.
 */

// Cache names — version suffix ensures old caches are cleaned up on SW update
const CACHE_VERSION = self.FXSIM_SW_VERSION || '3.0.0';
const CACHE_STATIC  = `fxsim-static-${CACHE_VERSION}`;
const CACHE_FONTS   = `fxsim-fonts-${CACHE_VERSION}`;

// Static asset URL patterns to cache (cache-first strategy)
const STATIC_PATTERNS = [
    /\/propfirm-system\/assets\/(css|js)\//,
    /cdn\.jsdelivr\.net\/npm\/chart\.js/,
];

// Font patterns (long-lived CDN resources)
const FONT_PATTERNS = [
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
];

// Never cache these — always network
const BYPASS_PATTERNS = [
    /\/wp-json\//,           // All WP REST API
    /\/_wpnonce/,            // Nonce-bearing requests
    /\/wp-admin\//,          // Admin
    /\/wp-login\.php/,       // Login
    /fxsim_key=/,            // API key auth requests
];

// Offline fallback HTML — shown when navigating while offline
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PropFirm System — Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #060b14; color: #8ba4c0; font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; text-align: center; padding: 20px; }
    .wrap { max-width: 400px; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { color: #dde8f5; font-size: 22px; margin-bottom: 12px; }
    p { font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    button { background: #00d4ff; color: #060b14; border: none; border-radius: 8px;
             padding: 12px 28px; font-size: 14px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">📡</div>
    <h1>No Connection</h1>
    <p>PropFirm System requires an internet connection for live trading data.
       Please check your connection and try again.</p>
    <button onclick="location.reload()">↺ Retry</button>
  </div>
</body>
</html>`;

// ── Install ───────────────────────────────────────────────────────────────────
// Pre-cache nothing on install — assets are cached on first use (lazy cache).
// This keeps the SW small and avoids blocking install on slow connections.
self.addEventListener('install', event => {
    // Skip waiting — become active immediately (new SW replaces old)
    self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
// Clean up old cache versions when a new SW activates.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key.startsWith('fxsim-') && key !== CACHE_STATIC && key !== CACHE_FONTS)
                    .map(key => {
                        console.debug(`[SW] Deleting old cache: ${key}`);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim()) // Take control of all open pages immediately
    );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = request.url;

    // Only handle GET requests — POST/PUT/DELETE always bypass SW
    if (request.method !== 'GET') return;

    // Bypass patterns — network only, no SW interception
    for (const pattern of BYPASS_PATTERNS) {
        if (pattern.test(url)) return;
    }

    // SSE stream: must not be intercepted — streaming responses are not cloneable
    if (url.includes('/stream')) return;

    // Static plugin assets — cache-first
    for (const pattern of STATIC_PATTERNS) {
        if (pattern.test(url)) {
            event.respondWith(cacheFirst(request, CACHE_STATIC));
            return;
        }
    }

    // Font resources — cache-first with long TTL
    for (const pattern of FONT_PATTERNS) {
        if (pattern.test(url)) {
            event.respondWith(cacheFirst(request, CACHE_FONTS));
            return;
        }
    }

    // Navigation requests (page HTML) — network-first with offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstWithOffline(request));
        return;
    }

    // Everything else — network only (don't intercept unknown requests)
});

// ── Cache strategies ──────────────────────────────────────────────────────────

/**
 * Cache-first strategy.
 * Serve from cache if available; fetch and cache if not.
 * On network failure when no cache exists, return a minimal error response.
 */
async function cacheFirst(request, cacheName) {
    const cache    = await caches.open(cacheName);
    const cached   = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        // Only cache successful opaque or 2xx responses
        if (response.ok || response.type === 'opaque') {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Network unavailable and no cache — return 503
        return new Response('Asset unavailable offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}

/**
 * Network-first with offline fallback for navigation requests.
 * Tries network; on failure returns a cached version or the offline HTML shell.
 */
async function networkFirstWithOffline(request) {
    try {
        const response = await fetch(request);
        // Cache the page shell for potential future offline access
        const cache = await caches.open(CACHE_STATIC);
        cache.put(request, response.clone()).catch(() => {}); // fire-and-forget
        return response;
    } catch {
        // Try cached version of this exact URL
        const cached = await caches.match(request);
        if (cached) return cached;

        // Fall back to offline HTML shell
        return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}
