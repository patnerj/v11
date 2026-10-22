'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/cn'
import { useBranding } from '@/store/branding'

/**
 * Dynamic Brand Initial Mark — Modern avatar lockup with active accent
 * color and bold initial letter, matching the Whitelabel Live Preview.
 */
export function BrandInitialMark({ name, className }: { name: string; className?: string }) {
  const initial = (name || 'P').trim().charAt(0).toUpperCase() || 'P'
  return (
    <div 
      className={cn(
        'h-8 w-8 rounded-lg bg-accent text-slate-950 font-extrabold flex items-center justify-center text-sm shrink-0 shadow-sm select-none transition-colors',
        className
      )}
    >
      {initial}
    </div>
  )
}

/**
 * General brand lockup. Used on the login page (login_logo_url) and anywhere a
 * horizontal logo is appropriate. Falls back to mark + brand name.
 *
 * @param variant 'login' prefers login_logo_url; 'dashboard' uses logo_url.
 */
export function Logo({
  className,
  wordmark = true,
  variant = 'dashboard',
}: {
  className?: string
  wordmark?: boolean
  variant?: 'dashboard' | 'login'
}) {
  const branding = useBranding((s) => s.branding)
  const loaded = useBranding((s) => s.loaded)
  const load = useBranding((s) => s.load)
  useEffect(() => { load() }, [load])

  const imageUrl = variant === 'login'
    ? (branding.login_logo_url || branding.logo_url)
    : branding.logo_url
  const name = branding.brand_name || 'Prop Firm'

  const isDefaultInstitutionalVector =
    !imageUrl ||
    imageUrl.endsWith('/branding/brand_logo.svg') ||
    imageUrl.endsWith('/branding/login_logo.svg')

  if (isDefaultInstitutionalVector && (name.toLowerCase() === 'alphacapital' || name.toLowerCase() === 'institutional' || name.toLowerCase() === 'massfunded')) {
    const gradId = variant === 'login' ? 'mfEmeraldGradLogin' : 'mfEmeraldGradMain'
    const textGradId = variant === 'login' ? 'mfTextGradLogin' : 'mfTextGradMain'
    return (
      <div className={cn('flex items-center select-none', className)}>
        <svg
          viewBox="0 0 600 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-9 md:h-10 w-auto max-w-[220px] overflow-visible"
          role="img"
          aria-label={name}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#00F5A0" />
            </linearGradient>
            <linearGradient id={textGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <style>{`
              .mf-brand-title {
                fill: #0F172A;
              }
              .dark .mf-brand-title,
              [data-theme="midnight-obsidian"] .mf-brand-title,
              [data-theme="vscode-dark"] .mf-brand-title,
              [data-theme="cyberpunk-neon"] .mf-brand-title,
              [data-theme="tokyo-night"] .mf-brand-title {
                fill: #FFFFFF;
              }
              .mf-brand-sub {
                fill: #475569;
              }
              .dark .mf-brand-sub,
              [data-theme="midnight-obsidian"] .mf-brand-sub,
              [data-theme="vscode-dark"] .mf-brand-sub,
              [data-theme="cyberpunk-neon"] .mf-brand-sub,
              [data-theme="tokyo-night"] .mf-brand-sub {
                fill: #94A3B8;
              }
              .mf-emblem-bg {
                fill: #070C1B;
              }
            `}</style>
          </defs>

          {/* Institutional Emblem */}
          <g transform="translate(10, 20)">
            <rect
              width="110"
              height="110"
              rx="28"
              fill="#070C1B"
              stroke={`url(#${gradId})`}
              strokeWidth="3"
              className="mf-emblem-bg"
            />
            <g transform="translate(14, 14) scale(0.16)">
              <path
                d="M 120 380 L 120 160 L 195 160 L 256 280 L 317 160 L 392 160 L 392 380 L 332 380 L 332 245 L 282 345 L 230 345 L 180 245 L 180 380 Z"
                fill={`url(#${gradId})`}
              />
              <polygon points="256,110 276,135 256,160 236,135" fill="#00F5A0" />
            </g>
          </g>

          {/* Theme-Adaptive Wordmark: Dark Slate in Daylight Mode, Pure White in Night Mode */}
          {wordmark && (
            <>
              <text
                x="142"
                y="86"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="54"
                fontWeight="800"
                letterSpacing="-1"
                className="mf-brand-title transition-colors duration-200"
              >
                Alpha<tspan fill={`url(#${textGradId})`}>Capital</tspan>
              </text>
              <text
                x="145"
                y="114"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="12.5"
                fontWeight="700"
                letterSpacing="3.2"
                className="mf-brand-sub transition-colors duration-200"
              >
                PROPRIETARY TRADING INFRASTRUCTURE
              </text>
            </>
          )}
        </svg>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        <div className="h-8 w-8 rounded-lg skel shrink-0" aria-hidden />
        {wordmark && <span className="h-4 w-28 rounded skel" aria-hidden />}
      </div>
    )
  }

  if (imageUrl) {
    const isSvg = imageUrl.endsWith('.svg') || imageUrl.includes('.svg?')
    return (
      <div className={cn('flex items-center', className)}>
        <Image 
          src={imageUrl} 
          alt={name} 
          width={220} 
          height={40} 
          priority
          unoptimized={isSvg}
          className="h-9 md:h-10 w-auto max-w-[220px] object-contain rounded-lg" 
        />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandInitialMark name={name} className="h-8 w-8" />
      {wordmark && (
        <span className={cn('font-extrabold tracking-tight text-text transition-opacity duration-200 text-base', loaded ? 'opacity-100' : 'opacity-0')}>
          {loaded ? name : '\u00A0'}
        </span>
      )}
    </div>
  )
}

/**
 * Sidebar brand lockup — purpose-built for a narrow sidebar.
 *   Expanded:  [Brand Initial Avatar] Company Name
 *   Collapsed: [Brand Initial Avatar]
 * Uses a dedicated square Sidebar Icon (sidebar_icon_url) or Primary Logo (logo_url).
 * If none is set it falls back to the dynamic Brand Initial Mark + brand name.
 */
export function SidebarBrand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  const branding = useBranding((s) => s.branding)
  const loaded = useBranding((s) => s.loaded)
  const load = useBranding((s) => s.load)
  useEffect(() => { load() }, [load])

  const icon = branding.sidebar_icon_url || branding.logo_url
  const name = branding.brand_name || 'Prop Firm'

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      {icon ? (
        <Image 
          src={icon} 
          alt={name} 
          width={32} 
          height={32} 
          unoptimized={icon.endsWith('.svg') || icon.includes('.svg?')}
          className="h-8 w-8 rounded-lg object-contain shrink-0 bg-surface-muted/40" 
        />
      ) : loaded ? (
        <BrandInitialMark name={name} className="h-8 w-8" />
      ) : (
        <div className="h-8 w-8 rounded-lg skel shrink-0" aria-hidden />
      )}
      {!collapsed && (
        <span className={cn('font-bold tracking-tight text-text truncate text-sm transition-opacity duration-200', loaded ? 'opacity-100' : 'opacity-0')}>
          {loaded ? name : '\u00A0'}
        </span>
      )}
    </div>
  )
}
