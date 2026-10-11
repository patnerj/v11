import { cache } from 'react'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { 
  Poppins, 
  JetBrains_Mono 
} from 'next/font/google'

import './globals.css'
import Script from 'next/script'
import { Providers } from '@/components/providers'
import { LiveChat } from '@/components/marketing/live-chat'
import { CommandPalette } from '@/components/ui/command-palette'
import { ThemeSettings } from '@/types/api'

// ── Google Font Initializations (Single Font Authority: Poppins + JetBrains Mono) ──
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jetbrains',
  display: 'swap',
})

// Memoized per-request and cached across SSR hits (5 min) to eliminate 10s+ WAN delays
const getCachedBranding = cache(async (apiPath: string) => {
  if (!apiPath || !apiPath.startsWith('http')) return null
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(`${apiPath}/branding`, {
      next: { revalidate: 300 },
      signal: controller.signal
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // fallback
  } finally {
    clearTimeout(timeoutId)
  }
  return null
})

export async function generateMetadata(): Promise<Metadata> {
  let brandName = 'LaunchAPropFirm'
  let brandTagline = 'Institutional High-Frequency Prop Trading'
  let googleSiteVerification = ''
  let bingSiteVerification = ''
  let customMetaTitle = ''
  let customMetaDescription = ''
  let customMetaKeywords: string[] = []
  let ogImageUrl = '/og-image.png'
  let robotsIndexing = 'index_follow'

  // P3: never fetch from a half-built URL.
  const rawApi = process.env.FXSIM_API_URL || process.env.LOCAL_WP_BACKEND_URL || (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://api.launchapropfirm.com/wp-json/fxsim/v1'
  const apiPath = rawApi.endsWith('/wp-json/fxsim/v1') ? rawApi : `${rawApi.replace(/\/$/, '')}/wp-json/fxsim/v1`
  if (!apiPath) return {
    title:       { default: `${brandName} — Trade Up to $200,000 in Funded Capital`, template: `%s | ${brandName}` },
    description: `${brandTagline}. Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits.`,
  }

  const data = await getCachedBranding(apiPath)
  if (data) {
    if (data.brand_name && data.brand_name.toLowerCase() !== 'propfirm system') {
      brandName = data.brand_name
    }
    if (data.brand_tagline) brandTagline = data.brand_tagline
    if (data.google_site_verification) googleSiteVerification = data.google_site_verification
    if (data.bing_site_verification) bingSiteVerification = data.bing_site_verification
    if (data.meta_title) customMetaTitle = data.meta_title
    if (data.meta_description) customMetaDescription = data.meta_description
    if (data.og_image_url) ogImageUrl = data.og_image_url
    if (data.robots_indexing) robotsIndexing = data.robots_indexing
    if (data.meta_keywords && typeof data.meta_keywords === 'string') {
      customMetaKeywords = data.meta_keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
    }
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '')

  const pageTitle = customMetaTitle || `${brandName} — Trade Up to $200,000 in Funded Capital`
  const pageDescription = customMetaDescription || `${brandTagline}. Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits.`
  const rawGoogleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || googleSiteVerification || ''
  const googleVerification = rawGoogleVerification
    ? rawGoogleVerification.replace(/^google-site-verification=/, '').replace(/^.*content=["']([^"']+)["'].*$/, '$1').trim()
    : undefined
  const bingVerification = bingSiteVerification || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || undefined

  const baseKeywords = [
    'Prop Firm',
    'Proprietary Trading',
    'Funded Account',
    'Forex Prop Firm',
    'Crypto Prop Firm',
    'Trading Challenge',
    'Instant Funding',
    'Funded Trader Program',
    brandName,
    'Institutional Liquidity',
    'MT5 Trading',
  ]
  const allKeywords = Array.from(new Set([...customMetaKeywords, ...baseKeywords]))

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : null,
    title:       { default: pageTitle, template: `%s | ${brandName}` },
    description: pageDescription,
    applicationName: brandName,
    keywords:    allKeywords,
    authors: siteUrl ? [{ name: brandName, url: siteUrl }] : [{ name: brandName }],
    creator: brandName,
    publisher: brandName,
    alternates: siteUrl ? {
      canonical: siteUrl,
    } : undefined,
    robots: {
      index: robotsIndexing !== 'noindex',
      follow: robotsIndexing !== 'noindex',
      googleBot: {
        index: robotsIndexing !== 'noindex',
        follow: robotsIndexing !== 'noindex',
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      ...(googleVerification ? { google: googleVerification } : {}),
      ...(bingVerification ? { other: { 'msvalidate.01': bingVerification } } : {}),
    },
    openGraph: {
      title:       pageTitle,
      description: pageDescription,
      url:         siteUrl,
      siteName:    brandName,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${brandName} — The Funded Trader Platform`,
          type: 'image/png',
        },
      ],
      locale:      'en_US',
      type:        'website',
    },
    twitter: {
      card:        'summary_large_image',
      title:       pageTitle,
      description: pageDescription,
      images:      [ogImageUrl],
    },
    icons: { icon: '/favicon.svg' },
    manifest: '/manifest.json',
  }
}

export const viewport: Viewport = {
  themeColor:   '#060a12',
  width:        'device-width',
  initialScale: 1,
}

// Simple HEX to HSL converter for SSR
function hexToHsl(hex: string): string {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').slice(0, 3).map(x => x + x).join('');
  } else if (hex.length > 6) {
    hex = hex.substring(0, 6);
  }
  if (hex.length !== 6) return { r: 16, g: 185, b: 129 };
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Sanitize a theme value before splicing it into a CSS string. The theme
 * cookie is client-writable, so an unsanitized fontFamily/primaryForeground
 * is a persistent CSS-injection sink (e.g. `x} body{background:url(//evil)}`).
 * Allow only a safe charset and cap length; anything else falls back.
 */
function safeCssValue(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^[a-zA-Z0-9 _#%(),.'"-]{1,120}$/.test(s) ? s : fallback
}

export function sanitizeThemeCss(css: string): string {
  if (!css) return ''
  return css.replace(/expression\s*\(/gi, '')
}

const FONT_MAP: Record<string, string> = {
  'poppins': "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'plus-jakarta': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  'plus_jakarta': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  'plus jakarta sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  'plus-jakarta-sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  'plus_jakarta_sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  'plus+jakarta+sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  'outfit': "'Outfit', system-ui, -apple-system, sans-serif",
  'inter': "'Inter', system-ui, -apple-system, sans-serif",
  'manrope': "'Manrope', system-ui, -apple-system, sans-serif",
  'space-grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
  'space_grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
  'space grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
  'space+grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
  'urbanist': "'Urbanist', system-ui, -apple-system, sans-serif",
}

function resolveFontFamily(rawFont?: string): string {
  if (!rawFont) return FONT_MAP['poppins']
  const clean = rawFont.toLowerCase().trim()
  if (FONT_MAP[clean]) return FONT_MAP[clean]
  const normalized = clean.replace(/[+_]/g, '-').replace(/\s+/g, '-')
  if (FONT_MAP[normalized]) return FONT_MAP[normalized]
  return safeCssValue(rawFont, FONT_MAP['poppins'])
}

function buildThemeCss(colorHex: string, rawFont?: string, rawForeground?: string): string {
  const cleanHex = colorHex.startsWith('#') ? colorHex : `#${colorHex}`;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(cleanHex)) return '';
  const { r, g, b } = hexToRgb(cleanHex);
  const hsl = hexToHsl(cleanHex);
  const glow = `rgba(${r}, ${g}, ${b}, 0.25)`;
  const safeFont = resolveFontFamily(rawFont);
  const safeFg = safeCssValue(rawForeground, '#ffffff');

  return `
    :root, [data-theme], .dark {
      --accent: ${hsl} !important;
      --accent-hover: ${hsl} !important;
      --accent-hex: ${cleanHex} !important;
      --accent-rgb: ${r}, ${g}, ${b} !important;
      --accent-glow: ${glow} !important;
      --primary: ${cleanHex} !important;
      --primary-rgb: ${r}, ${g}, ${b} !important;
      --primary-hover: ${cleanHex} !important;
      --font-sans: ${safeFont} !important;
      --font-poppins: ${safeFont} !important;
    }
    .text-accent,
    .text-emerald-400,
    .text-emerald-500 {
      color: ${cleanHex} !important;
    }
    .bg-accent,
    .bg-emerald-500,
    .bg-emerald-600 {
      background-color: ${cleanHex} !important;
    }
    .border-accent,
    .border-accent\\/40,
    .border-accent\\/30,
    .border-accent\\/20,
    .border-emerald-500,
    .border-emerald-500\\/40,
    .border-emerald-500\\/30,
    .border-emerald-500\\/20 {
      border-color: ${cleanHex} !important;
    }
    .bg-accent\\/20,
    .bg-emerald-500\\/20 {
      background-color: rgba(${r}, ${g}, ${b}, 0.2) !important;
    }
    .bg-accent\\/15,
    .bg-emerald-500\\/15,
    .bg-emerald-500\\/10,
    .bg-emerald-600\\/10 {
      background-color: rgba(${r}, ${g}, ${b}, 0.15) !important;
    }
    .bg-accent\\/10 {
      background-color: rgba(${r}, ${g}, ${b}, 0.1) !important;
    }
    .bg-accent\\/5 {
      background-color: rgba(${r}, ${g}, ${b}, 0.05) !important;
    }
    .hover\\:bg-emerald-500\\/20:hover,
    .hover\\:bg-emerald-500\\/10:hover {
      background-color: rgba(${r}, ${g}, ${b}, 0.2) !important;
    }
    .hover\\:border-emerald-500:hover,
    .hover\\:border-emerald-500\\/50:hover {
      border-color: ${cleanHex} !important;
    }
    .hover\\:text-emerald-300:hover,
    .hover\\:text-emerald-400:hover {
      color: ${cleanHex} !important;
    }
    .shadow-accent,
    .shadow-accent\\/20,
    .shadow-accent\\/10,
    .shadow-emerald-500\\/20,
    .shadow-emerald-500\\/10 {
      box-shadow: 0 0 15px ${glow} !important;
    }
    .focus-within\\:border-\\[\\#10B981\\]:focus-within {
      border-color: ${cleanHex} !important;
    }
    .focus-within\\:ring-\\[\\#10B981\\]:focus-within {
      --tw-ring-color: ${cleanHex} !important;
    }
    body, html { font-family: ${safeFont} !important; }
    *:not(code):not(pre):not(kbd):not(.font-preset-preview):not([data-font-preview]) {
      font-family: ${safeFont} !important;
    }
    code, pre, kbd, code *, pre *, kbd * {
      font-family: var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    }
    .tabular-nums, .tabular, .terminal-num {
      font-variant-numeric: tabular-nums;
    }
    .bg-primary { color: ${safeFg} !important; }
  `;
}

async function getThemeCSS(overrideFont?: string) {
  const rawApi = process.env.FXSIM_API_URL || process.env.LOCAL_WP_BACKEND_URL || (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://api.launchapropfirm.com/wp-json/fxsim/v1'
  const apiPath = rawApi.endsWith('/wp-json/fxsim/v1') ? rawApi : `${rawApi.replace(/\/$/, '')}/wp-json/fxsim/v1`
  if (!apiPath.startsWith('http')) return overrideFont ? buildThemeCss('#10B981', overrideFont) : ''

  const data = await getCachedBranding(apiPath)
  if (data) {
    const primary = data?.primary_color || data?.primaryColor || '#10B981';
    const font = overrideFont || data.font_family || data.fontFamily;
    const foreground = data.primary_foreground || data.primaryForeground;
    return buildThemeCss(primary, font, foreground);
  }
  return overrideFont ? buildThemeCss('#10B981', overrideFont) : '';
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let themeCss = '';
  try {
    const cookieStore = await cookies();
    const rawFontCookie = cookieStore.get('fxsim-theme-font')?.value;
    const fontCookie = rawFontCookie ? decodeURIComponent(rawFontCookie).trim() : undefined;
    const ssrFont = fontCookie ? resolveFontFamily(fontCookie) : undefined;

    const accentCookie = cookieStore.get('fxsim-theme-accent')?.value;
    if (accentCookie) {
      const decoded = decodeURIComponent(accentCookie).trim();
      if (/^#?[0-9a-fA-F]{3,8}$/.test(decoded)) {
        themeCss = buildThemeCss(decoded, ssrFont);
      }
    }

    if (!themeCss) {
      const rawCookie = cookieStore.get('fxsim-theme-data')?.value;
      if (rawCookie) {
        const decoded = decodeURIComponent(rawCookie);
        const data = JSON.parse(decoded);
        const color = data?.primary_color || data?.primaryColor;
        if (color && typeof color === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(color)) {
          const font = ssrFont || data.font_family || data.fontFamily;
          const foreground = data.primary_foreground || data.primaryForeground;
          themeCss = buildThemeCss(color, font, foreground);
        }
      }
    }

    if (!themeCss) {
      themeCss = await getThemeCSS(ssrFont);
    }

    if (!themeCss && ssrFont) {
      themeCss = buildThemeCss('#10B981', ssrFont);
    }
  } catch (e) {
    // silent fail
  }

  const rawApi = process.env.FXSIM_API_URL || process.env.LOCAL_WP_BACKEND_URL || (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://api.launchapropfirm.com/wp-json/fxsim/v1'
  const apiPath = rawApi.endsWith('/wp-json/fxsim/v1') ? rawApi : `${rawApi.replace(/\/$/, '')}/wp-json/fxsim/v1`
  const settings = await getCachedBranding(apiPath)

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || (settings as any)?.ga_measurement_id || ''
  const fbPixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || (settings as any)?.facebook_pixel_id || ''

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (settings as any)?.site_url ||
    ''
  ).replace(/\/$/, '')

  const brandName = (settings as any)?.brand_name || 'PropFirm'
  const brandTagline = (settings as any)?.brand_tagline || 'Institutional High-Frequency Prop Trading'
  const supportEmail = (settings as any)?.support_email || 'support@propfirm.com'
  const rawLogo = (settings as any)?.logo_url || '/branding/brand_logo_600x150.png'
  const logoUrl = rawLogo.startsWith('http') ? rawLogo : `${siteUrl}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: brandName,
        url: siteUrl,
        logo: logoUrl,
        sameAs: [
          (settings as any)?.youtube_url,
          (settings as any)?.instagram_url,
          (settings as any)?.tiktok_url,
          (settings as any)?.facebook_url,
          (settings as any)?.discord_url,
        ].filter(Boolean),
        contactPoint: {
          '@type': 'ContactPoint',
          email: supportEmail,
          contactType: 'customer support',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: brandName,
        description: `${brandTagline}. Pass the evaluation, trade institutional liquidity, and keep up to 90% profit split.`,
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
      },
      {
        '@type': 'FinancialService',
        '@id': `${siteUrl}/#financialservice`,
        name: `${brandName} Proprietary Trading`,
        url: siteUrl,
        logo: logoUrl,
        description: 'Proprietary trading evaluation firm offering funded accounts up to $200,000, bi-weekly payouts, MT5 institutional liquidity, and up to 90% profit split.',
        priceRange: '$$',
        currenciesAccepted: 'USD, USDT',
        paymentAccepted: 'Credit Card, Cryptocurrency',
      },
    ],
  }

  const fontVariables = [
    poppins.variable,
    jetbrainsMono.variable,
  ].join(' ')

  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Urbanist:wght@400;500;600;700&display=swap"
        />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://*.tradingview.com https://www.googletagmanager.com https://connect.facebook.net; frame-src 'self' https://tradingview-widget.com https://*.tradingview.com; img-src 'self' data: blob: https: https://www.facebook.com; connect-src 'self' https: wss:;"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <style id="fxsim-dynamic-theme-ssr" dangerouslySetInnerHTML={{ __html: sanitizeThemeCss(themeCss) || '' }} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var nextTheme = localStorage.getItem('theme');
              var theme = localStorage.getItem('user-theme');
              if (!theme) {
                theme = (nextTheme === 'light') ? 'clean-light' : 'midnight-obsidian';
              } else if (nextTheme === 'light' && theme !== 'clean-light') {
                theme = 'clean-light';
              }
              document.documentElement.setAttribute('data-theme', theme);
              if (theme === 'clean-light') {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              } else {
                document.documentElement.classList.remove('light');
                document.documentElement.classList.add('dark');
              }

              var fontMap = {
                'poppins': "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                'plus-jakarta': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                'plus_jakarta': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                'plus jakarta sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                'plus-jakarta-sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                'plus_jakarta_sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                'plus+jakarta+sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                'outfit': "'Outfit', system-ui, -apple-system, sans-serif",
                'inter': "'Inter', system-ui, -apple-system, sans-serif",
                'manrope': "'Manrope', system-ui, -apple-system, sans-serif",
                'space-grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
                'space_grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
                'space grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
                'space+grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
                'urbanist': "'Urbanist', system-ui, -apple-system, sans-serif"
              };

              var rawFont = null;
              try {
                rawFont = localStorage.getItem('fxsim:theme-font');
              } catch (e) {}

              var cookies = document.cookie ? document.cookie.split(';') : [];
              if (!rawFont) {
                for (var k = 0; k < cookies.length; k++) {
                  var ck = cookies[k].trim();
                  if (ck.indexOf('fxsim-theme-font=') === 0) {
                    try {
                      rawFont = decodeURIComponent(ck.substring('fxsim-theme-font='.length)).trim();
                    } catch (e) {}
                    break;
                  }
                }
              }

              if (!rawFont) {
                for (var j = 0; j < cookies.length; j++) {
                  var ck2 = cookies[j].trim();
                  if (ck2.indexOf('fxsim-theme-data=') === 0) {
                    try {
                      var parsedTd = JSON.parse(decodeURIComponent(ck2.substring('fxsim-theme-data='.length)));
                      rawFont = parsedTd.font_family || parsedTd.fontFamily;
                    } catch (e) {}
                    break;
                  }
                }
              }

              if (!rawFont) {
                try {
                  var savedLg = localStorage.getItem('fxsim-theme');
                  if (savedLg) {
                    var parsedLg = JSON.parse(savedLg);
                    rawFont = parsedLg.font_family || parsedLg.fontFamily;
                  }
                } catch (e) {}
              }

              var cleanFontId = rawFont ? String(rawFont).toLowerCase().trim().replace(/[+_]/g, '-').replace(/\s+/g, '-') : '';
              var chosenFont = fontMap[cleanFontId] || (rawFont && /^[a-zA-Z0-9 _#%(),.'"-]{1,120}$/.test(rawFont) ? rawFont : fontMap['poppins']);

              document.documentElement.style.setProperty('--font-sans', chosenFont);
              document.documentElement.style.setProperty('--font-poppins', chosenFont);
              document.documentElement.style.setProperty('font-family', chosenFont);
              var fontTag = document.getElementById('fxsim-live-theme-font');
              if (!fontTag) {
                fontTag = document.createElement('style');
                fontTag.id = 'fxsim-live-theme-font';
                document.head.appendChild(fontTag);
              }
              fontTag.innerHTML = ':root, [data-theme], .dark { --font-sans: ' + chosenFont + ' !important; --font-poppins: ' + chosenFont + ' !important; } html, body { font-family: ' + chosenFont + ' !important; } *:not(code):not(pre):not(kbd):not(.font-preset-preview):not([data-font-preview]) { font-family: ' + chosenFont + ' !important; } code, pre, kbd, code *, pre *, kbd * { font-family: var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; } .tabular-nums, .tabular, .terminal-num { font-variant-numeric: tabular-nums; }';

              var accent = null;
              try {
                accent = localStorage.getItem('fxsim:theme-accent');
              } catch (e) {}

              var cookies = document.cookie ? document.cookie.split(';') : [];
              if (!accent) {
                for (var i = 0; i < cookies.length; i++) {
                  var c = cookies[i].trim();
                  if (c.indexOf('fxsim-theme-accent=') === 0) {
                    try {
                      accent = decodeURIComponent(c.substring('fxsim-theme-accent='.length)).trim();
                    } catch (e) {}
                    break;
                  }
                }
              }

              var legacyFont = null;
              var legacyFg = '#ffffff';
              if (!accent) {
                for (var j = 0; j < cookies.length; j++) {
                  var ck = cookies[j].trim();
                  if (ck.indexOf('fxsim-theme-data=') === 0) {
                    try {
                      var val = ck.substring('fxsim-theme-data='.length);
                      var parsed = JSON.parse(decodeURIComponent(val));
                      accent = parsed.primary_color || parsed.primaryColor;
                      legacyFont = parsed.font_family || parsed.fontFamily;
                      legacyFg = parsed.primary_foreground || parsed.primaryForeground || legacyFg;
                    } catch (e) {}
                    break;
                  }
                }
              }

              if (!accent) {
                try {
                  var savedLegacy = localStorage.getItem('fxsim-theme');
                  if (savedLegacy) {
                    var parsedLegacy = JSON.parse(savedLegacy);
                    accent = parsedLegacy.primary_color || parsedLegacy.primaryColor;
                    legacyFont = parsedLegacy.font_family || parsedLegacy.fontFamily;
                    legacyFg = parsedLegacy.primary_foreground || parsedLegacy.primaryForeground || legacyFg;
                  }
                } catch (e) {}
              }

              if (accent && typeof accent === 'string') {
                var hex = accent.trim().replace(/^#/, '');
                if (/^[0-9a-fA-F]{3,4}$/.test(hex)) {
                  hex = hex.substring(0, 3).split('').map(function(x){ return x + x; }).join('');
                } else if (/^[0-9a-fA-F]{8}$/.test(hex)) {
                  hex = hex.substring(0, 6);
                }
                if (/^[0-9a-fA-F]{6}$/.test(hex)) {
                  var cleanHex = '#' + hex;
                  var r = parseInt(hex.substring(0, 2), 16);
                  var g = parseInt(hex.substring(2, 4), 16);
                  var b = parseInt(hex.substring(4, 6), 16);
                  var rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
                  var max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
                  var h = 0, s = 0, l = (max + min) / 2;
                  if (max !== min) {
                    var d = max - min;
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                    if (max === rNorm) h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
                    else if (max === gNorm) h = (bNorm - rNorm) / d + 2;
                    else h = (rNorm - gNorm) / d + 4;
                    h /= 6;
                  }
                  var accentHsl = Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%';
                  var glow = 'rgba(' + r + ', ' + g + ', ' + b + ', 0.25)';

                  var root = document.documentElement;
                  root.style.setProperty('--accent', accentHsl);
                  root.style.setProperty('--accent-hover', accentHsl);
                  root.style.setProperty('--accent-hex', cleanHex);
                  root.style.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);
                  root.style.setProperty('--accent-glow', glow);
                  root.style.setProperty('--primary', cleanHex);
                  root.style.setProperty('--primary-rgb', r + ', ' + g + ', ' + b);
                  root.style.setProperty('--primary-hover', cleanHex);

                  var safeFont = chosenFont;
                  var safeFgVal = (legacyFg && /^[a-zA-Z0-9 _#%(),.'"-]{1,120}$/.test(legacyFg)) ? legacyFg : '#ffffff';

                  var cssText = ':root, [data-theme], .dark {' +
                    '--accent: ' + accentHsl + ' !important;' +
                    '--accent-hover: ' + accentHsl + ' !important;' +
                    '--accent-hex: ' + cleanHex + ' !important;' +
                    '--accent-rgb: ' + r + ', ' + g + ', ' + b + ' !important;' +
                    '--accent-glow: ' + glow + ' !important;' +
                    '--primary: ' + cleanHex + ' !important;' +
                    '--primary-rgb: ' + r + ', ' + g + ', ' + b + ' !important;' +
                    '--primary-hover: ' + cleanHex + ' !important;' +
                    '--font-sans: ' + safeFont + ';' +
                    '--font-poppins: ' + safeFont + ';' +
                  '}' +
                  '.text-accent, .text-emerald-400, .text-emerald-500 { color: ' + cleanHex + ' !important; }' +
                  '.bg-accent, .bg-emerald-500, .bg-emerald-600 { background-color: ' + cleanHex + ' !important; }' +
                  '.border-accent, .border-accent\\\\/40, .border-accent\\\\/30, .border-accent\\\\/20, .border-emerald-500, .border-emerald-500\\\\/40, .border-emerald-500\\\\/30, .border-emerald-500\\\\/20 { border-color: ' + cleanHex + ' !important; }' +
                  '.bg-accent\\\\/20, .bg-emerald-500\\\\/20 { background-color: rgba(' + r + ', ' + g + ', ' + b + ', 0.2) !important; }' +
                  '.bg-accent\\\\/15, .bg-emerald-500\\\\/15, .bg-emerald-500\\\\/10, .bg-emerald-600\\\\/10 { background-color: rgba(' + r + ', ' + g + ', ' + b + ', 0.15) !important; }' +
                  '.bg-accent\\\\/10 { background-color: rgba(' + r + ', ' + g + ', ' + b + ', 0.1) !important; }' +
                  '.bg-accent\\\\/5 { background-color: rgba(' + r + ', ' + g + ', ' + b + ', 0.05) !important; }' +
                  '.hover\\\\:bg-emerald-500\\\\/20:hover, .hover\\\\:bg-emerald-500\\\\/10:hover { background-color: rgba(' + r + ', ' + g + ', ' + b + ', 0.2) !important; }' +
                  '.hover\\\\:border-emerald-500:hover, .hover\\\\:border-emerald-500\\\\/50:hover { border-color: ' + cleanHex + ' !important; }' +
                  '.hover\\\\:text-emerald-300:hover, .hover\\\\:text-emerald-400:hover { color: ' + cleanHex + ' !important; }' +
                  '.shadow-accent, .shadow-accent\\\\/20, .shadow-accent\\\\/10, .shadow-emerald-500\\\\/20, .shadow-emerald-500\\\\/10 { box-shadow: 0 0 15px ' + glow + ' !important; }' +
                  '.focus-within\\\\:border-\\\\[\\\\#10B981\\\\]:focus-within { border-color: ' + cleanHex + ' !important; }' +
                  '.focus-within\\\\:ring-\\\\[\\\\#10B981\\\\]:focus-within { --tw-ring-color: ' + cleanHex + ' !important; }' +
                  'body, html { font-family: ' + safeFont + '; }' +
                  '*:not(code):not(pre):not(kbd):not(.font-preset-preview):not([data-font-preview]), html, body { font-family: ' + safeFont + ' !important; }' +
                  'code, pre, kbd { font-family: var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }' +
                  '.tabular-nums, .tabular, .terminal-num { font-variant-numeric: tabular-nums; }' +
                  '.bg-primary { color: ' + safeFgVal + ' !important; }';

                  var ssrEl = document.getElementById('fxsim-dynamic-theme-ssr');
                  if (ssrEl) {
                    ssrEl.innerHTML = cssText;
                  }
                  var styleEl = document.getElementById('fxsim-dynamic-theme-local');
                  if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'fxsim-dynamic-theme-local';
                    document.head.appendChild(styleEl);
                  }
                  styleEl.innerHTML = cssText;
                }
              }
            } catch (e) {}
          })();
        ` }} suppressHydrationWarning />
      </head>
      <body className="min-h-screen antialiased font-sans" style={{ fontFamily: 'var(--font-sans), "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <LiveChat />
        <CommandPalette />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        {fbPixelId && (
          <>
            <Script id="facebook-pixel" strategy="lazyOnload">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${fbPixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  )
}
