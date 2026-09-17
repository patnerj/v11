import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { 
  Poppins, 
  Inter, 
  Plus_Jakarta_Sans, 
  Outfit, 
  Manrope, 
  Space_Grotesk, 
  Urbanist,
  JetBrains_Mono 
} from 'next/font/google'

import './globals.css'
import { Providers } from '@/components/providers'
import { LiveChat } from '@/components/marketing/live-chat'
import { CommandPalette } from '@/components/ui/command-palette'
import { ThemeSettings } from '@/types/api'

// ── Google Font Initializations (Zero layout shift & optimized) ──
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-urbanist',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  let brandName = 'Alpha Capital'
  let brandTagline = 'The Funded Trader Platform'

  // P3: never fetch from a half-built URL. Old code ran
  const rawApi = process.env.FXSIM_API_URL || process.env.LOCAL_WP_BACKEND_URL || (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://api.launchapropfirm.com/wp-json/fxsim/v1'
  const apiPath = rawApi.endsWith('/wp-json/fxsim/v1') ? rawApi : `${rawApi.replace(/\/$/, '')}/wp-json/fxsim/v1`
  if (!apiPath) return {
    title:       { default: brandName, template: `%s | ${brandName}` },
    description: `${brandTagline}. Pass the evaluation, trade our capital, keep up to 90% of your profits.`,
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    // apiPath is already the absolute backend base (…/wp-json/fxsim/v1) —
    // the site URL is irrelevant here. Old code concatenated both and, with
    // envs empty, fetched the meaningless relative path "/branding".
    const res = await fetch(`${apiPath}/branding`, {
      next: { revalidate: 60 },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data.brand_name && data.brand_name.toLowerCase() !== 'launchapropfirm' && data.brand_name.toLowerCase() !== 'propfirm system') {
        brandName = data.brand_name
      }
      if (data.brand_tagline) brandTagline = data.brand_tagline
    }
  } catch (e) {
    // silently fallback on timeout or fetch error
  }

  return {
    title:       { default: brandName, template: `%s | ${brandName}` },
    description: `${brandTagline}. Pass the evaluation, trade our capital, keep up to 90% of your profits.`,
    applicationName: brandName,
    openGraph: {
      title:       brandName,
      description: `${brandTagline}. Pass the evaluation, trade our capital, keep up to 90% of your profits.`,
      type:        'website',
    },
    twitter: { card: 'summary_large_image' },
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

function buildThemeCss(colorHex: string, rawFont?: string, rawForeground?: string): string {
  const cleanHex = colorHex.startsWith('#') ? colorHex : `#${colorHex}`;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(cleanHex)) return '';
  const { r, g, b } = hexToRgb(cleanHex);
  const hsl = hexToHsl(cleanHex);
  const glow = `rgba(${r}, ${g}, ${b}, 0.25)`;
  const safeFont = safeCssValue(rawFont, 'var(--font-poppins), Poppins, sans-serif');
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
      --font-sans: ${safeFont};
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
    .bg-primary { color: ${safeFg} !important; }
  `;
}

async function getThemeCSS() {
  const rawApi = process.env.FXSIM_API_URL || process.env.LOCAL_WP_BACKEND_URL || (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://api.launchapropfirm.com/wp-json/fxsim/v1'
  const apiPath = rawApi.endsWith('/wp-json/fxsim/v1') ? rawApi : `${rawApi.replace(/\/$/, '')}/wp-json/fxsim/v1`
  if (!apiPath.startsWith('http')) return ''

  const urlsToTry: string[] = [`${apiPath}/theme`, `${apiPath}/branding`]

  for (const fetchUrl of urlsToTry) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      
      const res = await fetch(fetchUrl, { 
        next: { revalidate: 10 },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (res.ok) {
        const data = await res.json()
        const primary = data?.primary_color || data?.primaryColor;
        if (primary) {
          const font = data.font_family || data.fontFamily;
          const foreground = data.primary_foreground || data.primaryForeground;
          return buildThemeCss(primary, font, foreground);
        }
      }
    } catch (e) {
      // try next url in fallback list
    }
  }
  return '';
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let themeCss = '';
  try {
    const cookieStore = await cookies();
    const accentCookie = cookieStore.get('fxsim-theme-accent')?.value;
    if (accentCookie) {
      const decoded = decodeURIComponent(accentCookie).trim();
      if (/^#?[0-9a-fA-F]{3,8}$/.test(decoded)) {
        themeCss = buildThemeCss(decoded);
      }
    }

    if (!themeCss) {
      const rawCookie = cookieStore.get('fxsim-theme-data')?.value;
      if (rawCookie) {
        const decoded = decodeURIComponent(rawCookie);
        const data = JSON.parse(decoded);
        const color = data?.primary_color || data?.primaryColor;
        if (color && typeof color === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(color)) {
          const font = data.font_family || data.fontFamily;
          const foreground = data.primary_foreground || data.primaryForeground;
          themeCss = buildThemeCss(color, font, foreground);
        }
      }
    }
  } catch (e) {
    // silent fail
  }

  if (!themeCss) {
    themeCss = await getThemeCSS();
  }

  const fontVariables = [
    poppins.variable,
    plusJakarta.variable,
    outfit.variable,
    inter.variable,
    manrope.variable,
    spaceGrotesk.variable,
    urbanist.variable,
    jetbrainsMono.variable,
  ].join(' ')

  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <style id="fxsim-dynamic-theme-ssr" dangerouslySetInnerHTML={{ __html: themeCss || '' }} suppressHydrationWarning />
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

              var savedFont = localStorage.getItem('fxsim:theme-font') || 'poppins';
              var fontMap = {
                'poppins': 'var(--font-poppins), Poppins, system-ui, sans-serif',
                'plus-jakarta': 'var(--font-plus-jakarta), Plus Jakarta Sans, system-ui, sans-serif',
                'outfit': 'var(--font-outfit), Outfit, system-ui, sans-serif',
                'inter': 'var(--font-inter), Inter, system-ui, sans-serif',
                'manrope': 'var(--font-manrope), Manrope, system-ui, sans-serif',
                'space-grotesk': 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                'urbanist': 'var(--font-urbanist), Urbanist, system-ui, sans-serif'
              };
              var chosenFont = fontMap[savedFont] || fontMap['poppins'];
              document.documentElement.style.setProperty('--font-sans', chosenFont);

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

                  var safeFont = (legacyFont && /^[a-zA-Z0-9 _#%(),.'"-]{1,120}$/.test(legacyFont)) ? legacyFont : chosenFont;
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
                  'body, html { font-family: ' + safeFont + ' !important; }' +
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
      <body className={`min-h-screen antialiased font-sans ${poppins.className}`} style={{ fontFamily: 'var(--font-sans, var(--font-poppins))' }} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <LiveChat />
        <CommandPalette />
      </body>
    </html>
  )
}
