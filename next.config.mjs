/** @type {import('next').NextConfig} */
// P1: buyer can pin image hosts at build time via BRANDING_IMAGE_HOSTS
// (comma-separated). Default stays open (admin uploads come from any CDN)
// but protocol is pinned to https.
const brandingHosts = (process.env.BRANDING_IMAGE_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

// ── Content Security Policy (CSP) Dynamic Hosts ─────────────────────────────
// Dynamically extract allowed API and WebSocket endpoints from environment.
// Note for Production Release: Buyers can tighten the CSP policy by removing
// open 'https:' / 'wss:' fallbacks and specifying exact domain-specific origins
// (see Staging & Deployment Checklist).
const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_FXSIM_API || 'https://api.launchapropfirm.com/wp-json/fxsim/v1';
const wsUrl = process.env.NEXT_PUBLIC_FXSIM_WS_URL || '';

let apiHost = 'https://api.launchapropfirm.com';
if (apiUrl) {
  try {
    apiHost = new URL(apiUrl).origin;
  } catch {}
}

let wsHost = '';
if (wsUrl) {
  try {
    wsHost = new URL(wsUrl).origin;
  } catch {}
}

// connect-src: binds current origin, explicit API host, and WebSocket feed host (no broad wildcards)
const connectSrc = [
  "'self'",
  apiHost,
  'https://api.launchapropfirm.com',
  wsHost,
].filter(Boolean).join(' ');

// frame-src: explicitly whitelists TradingView chart widgets & embeds (no broad wildcards)
const frameSrc = [
  "'self'",
  "https://*.tradingview.com",
  "https://*.tradingview-widget.com",
].filter(Boolean).join(' ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns:
      brandingHosts.length > 0
        ? brandingHosts.map((hostname) => ({ protocol: 'https', hostname }))
        : [{ protocol: 'https', hostname: '**' }],
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
          // P1: HSTS (prod TLS) + COOP. No COEP require-corp — it would break
          // the TradingView iframe. CSP is set per-route in middleware-safe
          // form via `Content-Security-Policy-Report-Only` until buyer tunes it.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://s3.tradingview.com https://*.tradingview.com https://client.crisp.chat https://*.tawk.to",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https: data: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              `connect-src ${connectSrc}`,
              `frame-src ${frameSrc}`,
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  async rewrites() {
    // Dev-only fallback proxy for same-origin /api/wp/* calls when
    // NEXT_PUBLIC_FXSIM_API isn't set (see getApiBaseUrl() in src/lib/fxsim.ts,
    // which always prefers the real backend URL when it's configured). This
    // must never hardcode a real deployment's target — a machine-local
    // LocalWP hostname baked in here previously caused every production API
    // call to fail with DNS_HOSTNAME_NOT_FOUND, because Vercel can't resolve
    // a hostname that only exists on one developer's laptop.
    const localBackend = process.env.LOCAL_WP_BACKEND_URL || 'https://api.launchapropfirm.com'
    return [
      {
        source: '/api/wp/:path*',
        destination: `${localBackend}/wp-json/fxsim/v1/:path*`
      }
    ]
  },
};
export default nextConfig;
