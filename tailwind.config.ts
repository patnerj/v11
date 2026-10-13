import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

// ── Legacy color bridge ─────────────────────────────────────────────────
// Admin/legacy pages were built with stock Tailwind palette colors. Remap
// every stock shade onto the dynamic theme tokens so admin branding config
// (accent/warn/danger/info) drives the ENTIRE site — no per-file rewrites.
const t = {
  text:    'hsl(var(--text) / <alpha-value>)',
  muted:   'hsl(var(--text-muted) / <alpha-value>)',
  subtle:  'hsl(var(--text-subtle) / <alpha-value>)',
  surface: 'hsl(var(--surface) / <alpha-value>)',
  surfaceMuted: 'hsl(var(--surface-muted) / <alpha-value>)',
  surfaceStrong: 'hsl(var(--surface-strong) / <alpha-value>)',
  bg:      'hsl(var(--bg) / <alpha-value>)',
  border:  'hsl(var(--border) / <alpha-value>)',
  accent:  'hsl(var(--accent) / <alpha-value>)',
  accentTint: 'hsl(var(--accent) / 0.12)',
  warn:    'hsl(var(--warn) / <alpha-value>)',
  warnTint: 'hsl(var(--warn) / 0.12)',
  danger:  'hsl(var(--danger) / <alpha-value>)',
  dangerTint: 'hsl(var(--danger) / 0.12)',
  info:    'hsl(var(--info) / <alpha-value>)',
  infoTint: 'hsl(var(--info) / 0.12)',
}

const stockBridge = {
  green:  { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent, 700: t.accent },
  teal:   { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent, 700: t.accent },
  lime:   { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent },
  yellow: { 200: t.warn, 300: t.warn, 400: t.warn, 500: t.warn, 600: t.warn, 700: t.warn },
  amber:  { 200: t.warn, 300: t.warn, 400: t.warn, 500: t.warn, 600: t.warn, 700: t.warn, 800: t.warn },
  orange: { 300: t.warn, 400: t.warn, 500: t.warn, 600: t.warn, 700: t.warn },
  red:    { 200: t.danger, 300: t.danger, 400: t.danger, 500: t.danger, 600: t.danger, 700: t.danger, 800: t.danger },
  rose:   { 300: t.danger, 400: t.danger, 500: t.danger, 600: t.danger, 700: t.danger },
  pink:   { 300: t.danger, 400: t.danger, 500: t.danger, 600: t.danger },
  fuchsia: { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent },
  purple: { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent, 700: t.accent, 800: t.accent, 900: t.accent },
  violet: { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent, 700: t.accent },
  indigo: { 300: t.accent, 400: t.accent, 500: t.accent, 600: t.accent, 700: t.accent },
  blue:   { 200: t.info, 300: t.info, 400: t.info, 500: t.info, 600: t.info, 700: t.info },
  sky:    { 300: t.info, 400: t.info, 500: t.info, 600: t.info, 700: t.info },
  cyan:   { 200: t.info, 300: t.info, 400: t.info, 500: t.info, 600: t.info, 700: t.info },
}

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        ...stockBridge,
        // ── Design tokens ─────────────────────────────────────────────
        bg:        { DEFAULT: 'hsl(var(--bg) / <alpha-value>)', subtle: 'hsl(var(--bg-subtle) / <alpha-value>)', raised: 'hsl(var(--bg-raised) / <alpha-value>)' },
        surface:   { DEFAULT: 'hsl(var(--surface) / <alpha-value>)', muted: 'hsl(var(--surface-muted) / <alpha-value>)', strong: 'hsl(var(--surface-strong) / <alpha-value>)', subtle: 'hsl(var(--surface-subtle, var(--surface-muted)) / <alpha-value>)' },
        'surface-subtle': 'hsl(var(--surface-subtle, var(--surface-muted)) / <alpha-value>)',
        border:    { DEFAULT: 'hsl(var(--border) / <alpha-value>)', strong: 'hsl(var(--border-strong) / <alpha-value>)', subtle: 'hsl(var(--border-subtle) / <alpha-value>)' },
        text:      { DEFAULT: 'hsl(var(--text) / <alpha-value>)', muted: 'hsl(var(--text-muted) / <alpha-value>)', subtle: 'hsl(var(--text-subtle) / <alpha-value>)' },
        accent:    { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', hover: 'hsl(var(--accent-hover, var(--accent)) / <alpha-value>)', muted: 'hsl(var(--accent) / 0.14)' },
        success:   { DEFAULT: 'hsl(var(--success) / <alpha-value>)', hover: 'hsl(var(--success-hover) / <alpha-value>)', muted: 'hsl(var(--success) / 0.14)' },
        danger:    { DEFAULT: 'hsl(var(--danger) / <alpha-value>)', hover: 'hsl(var(--danger-hover) / <alpha-value>)', muted: 'hsl(var(--danger) / 0.14)' },
        warn:      { DEFAULT: 'hsl(var(--warn) / <alpha-value>)', hover: 'hsl(var(--warn) / <alpha-value>)', muted: 'hsl(var(--warn) / 0.14)' },
        info:      { DEFAULT: 'hsl(var(--info) / <alpha-value>)', hover: 'hsl(var(--info) / <alpha-value>)', muted: 'hsl(var(--info) / 0.14)' },
        // Permanent financial invariants
        profit:    { DEFAULT: '#10B981', subtle: 'rgba(16, 185, 129, 0.12)' },
        loss:      { DEFAULT: '#EF4444', subtle: 'rgba(239, 68, 68, 0.12)' },
        // shadcn aliases (used by ported primitives)
        background:  'hsl(var(--bg) / <alpha-value>)',
        foreground:  'hsl(var(--text) / <alpha-value>)',
        primary:     { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', foreground: 'hsl(var(--surface) / <alpha-value>)' },
        secondary:   { DEFAULT: 'hsl(var(--surface-muted) / <alpha-value>)', foreground: 'hsl(var(--text) / <alpha-value>)' },
        destructive: { DEFAULT: 'hsl(var(--danger) / <alpha-value>)', foreground: 'hsl(var(--surface) / <alpha-value>)' },
        muted:       { DEFAULT: 'hsl(var(--surface-muted) / <alpha-value>)', foreground: 'hsl(var(--text-muted) / <alpha-value>)' },
        popover:     { DEFAULT: 'hsl(var(--surface) / <alpha-value>)', foreground: 'hsl(var(--text) / <alpha-value>)' },
        card:        { DEFAULT: 'hsl(var(--surface) / <alpha-value>)', foreground: 'hsl(var(--text) / <alpha-value>)' },
        input:       'hsl(var(--border) / <alpha-value>)',
        ring:        'hsl(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        poppins: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        inter: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        jakarta: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        outfit: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        manrope: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        space: ['var(--font-sans)', 'Poppins', 'sans-serif'],
        urbanist: ['var(--font-sans)', 'Poppins', 'sans-serif'],
      },
      fontSize: {
        '3xs': ['0.5rem', { lineHeight: '0.75rem' }],                   // 8px — ultra-compact tags & badges (resolves phantom text-3xs)
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],                 // 10px — compact tooltips, subtitle meta
        'terminal-micro': ['0.5625rem', { lineHeight: '0.75rem' }],    // 9px — chart axis, badges only
        'terminal-body':  ['0.6875rem', { lineHeight: '1rem' }],       // 11px — ALL data cells, inputs, labels  
        'terminal-label': ['0.75rem',   { lineHeight: '1.125rem' }],   // 12px — column headers, section titles
        'terminal-title': ['0.875rem',  { lineHeight: '1.25rem' }],    // 14px — panel titles, account name
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      borderRadius: {
        none: '0px',
        sm: 'calc(var(--radius, 8px) * 0.5)',
        DEFAULT: 'var(--radius, 8px)',
        md: 'var(--radius, 8px)',
        lg: 'calc(var(--radius, 8px) * 1.5)',
        xl: 'calc(var(--radius, 8px) * 2)',
        '2xl': 'calc(var(--radius, 8px) * 2.5)',
        full: '9999px',
      },
      boxShadow: {
        'card':      '0 1px 2px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.02) inset',
        'card-lg':   '0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset',
        'glow-sm':   '0 0 10px rgba(var(--accent-rgb, 16, 185, 129), 0.2)',
        'glow':      '0 0 0 1px rgba(var(--accent-rgb, 16, 185, 129), .4), 0 0 24px rgba(var(--accent-rgb, 16, 185, 129), .25)',
        'glow-success': '0 0 0 1px rgba(16,185,129,.4), 0 0 24px rgba(16,185,129,.25)',
      },
      backgroundImage: {
        'grid':      'linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)',
        'noise':     'url("data:image/svg+xml;utf8,<svg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'.9\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.4\'/></svg>")',
        'aurora':    'radial-gradient(circle at 20% 0%, rgba(var(--accent-rgb, 16, 185, 129), .18) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(16,185,129,.12) 0%, transparent 50%)',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(var(--accent-rgb, 16, 185, 129), .4)' },
          '50%':     { boxShadow: '0 0 0 8px rgba(var(--accent-rgb, 16, 185, 129), 0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathingGlow: {
          '0%, 100%': { boxShadow: '0 0 0 1px hsl(var(--accent) / 0.2), 0 0 12px hsl(var(--accent) / 0.1)' },
          '50%': { boxShadow: '0 0 0 1px hsl(var(--accent) / 0.5), 0 0 24px hsl(var(--accent) / 0.25)' },
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'slide-up':   'slideUp .4s cubic-bezier(.16,1,.3,1) both',
        'shimmer':    'shimmer 2s linear infinite',
        'breathing-glow': 'breathingGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
}
export default config
