'use client'

import React, { useState } from 'react'
import { Laptop, Smartphone, Sun, Moon, TrendingUp, ShieldCheck, Trophy, Wallet, BarChart3, Bell, User, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DeviceFrameMockupProps {
  brandName: string
  brandTagline?: string
  logoUrl?: string
  sidebarIconUrl?: string
  accentColor?: string
  className?: string
}

export function DeviceFrameMockup({
  brandName,
  brandTagline = 'The Funded Trader Platform',
  logoUrl,
  sidebarIconUrl,
  accentColor = '#10B981',
  className,
}: DeviceFrameMockupProps) {
  const [device, setDevice] = useState<'laptop' | 'mobile'>('laptop')
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark')

  const effectiveName = brandName?.trim() || 'Alpha Capital'
  const effectiveTagline = brandTagline?.trim() || 'The Funded Trader Platform'
  const effectiveAccent = accentColor || '#10B981'

  const isDark = previewTheme === 'dark'

  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted/30 p-4 sm:p-5', className)}>
      {/* Top Controls: Device Toggle & Dark/Light Preview Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Laptop className="h-4 w-4 text-accent" />
            Live Device Preview
          </span>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-3xs font-semibold text-accent border border-accent/20">
            Real-time Sync
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device toggle */}
          <div className="flex items-center rounded-lg border border-border-subtle bg-surface p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setDevice('laptop')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-semibold transition-all',
                device === 'laptop'
                  ? 'bg-accent text-accent-contrast shadow-xs'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>Laptop</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-semibold transition-all',
                device === 'mobile'
                  ? 'bg-accent text-accent-contrast shadow-xs'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile</span>
            </button>
          </div>

          {/* Theme preview toggle */}
          <div className="flex items-center rounded-lg border border-border-subtle bg-surface p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setPreviewTheme('dark')}
              className={cn(
                'p-1.5 rounded-md text-2xs transition-all',
                isDark ? 'bg-surface-muted text-text font-bold' : 'text-text-faint hover:text-text'
              )}
              title="Preview in Dark Mode"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme('light')}
              className={cn(
                'p-1.5 rounded-md text-2xs transition-all',
                !isDark ? 'bg-surface-muted text-text font-bold' : 'text-text-faint hover:text-text'
              )}
              title="Preview in Light Mode"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex justify-center items-center py-2 overflow-x-auto select-none">
        {device === 'laptop' ? (
          /* Laptop Frame */
          <div className="w-full max-w-[720px] rounded-xl border-4 border-[#27272A] bg-[#18181B] shadow-2xl overflow-hidden transition-all duration-300">
            {/* Laptop Display Header / Window Controls */}
            <div className="h-7 bg-[#27272A] flex items-center px-3 gap-2 justify-between border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56] inline-block" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E] inline-block" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F] inline-block" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/40 text-[10px] text-gray-400 font-mono max-w-[280px] truncate border border-white/5">
                <span className="text-emerald-400">https://</span>
                <span className="text-gray-200">{effectiveName.toLowerCase().replace(/\s+/g, '')}.com</span>
                <span className="text-gray-500">/dashboard</span>
              </div>
              <div className="w-10" />
            </div>

            {/* Laptop Inner Screen */}
            <div
              className={cn(
                'h-[420px] flex flex-col transition-colors duration-200 overflow-hidden text-xs',
                isDark ? 'bg-[#0B0F19] text-gray-100' : 'bg-gray-50 text-gray-900'
              )}
            >
              {/* Mock Top Nav */}
              <header
                className={cn(
                  'h-11 px-4 flex items-center justify-between border-b shrink-0',
                  isDark ? 'bg-[#0F172A]/90 border-gray-800' : 'bg-white/95 border-gray-200'
                )}
              >
                <div className="flex items-center gap-2.5">
                  {logoUrl || sidebarIconUrl ? (
                    <img
                      src={logoUrl || sidebarIconUrl}
                      alt={effectiveName}
                      className="h-6 w-auto max-w-[120px] object-contain"
                    />
                  ) : (
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center text-white font-extrabold text-2xs shadow-xs"
                      style={{ backgroundColor: effectiveAccent }}
                    >
                      {effectiveName.charAt(0)}
                    </div>
                  )}
                  <span className="font-bold text-xs tracking-tight truncate max-w-[140px]">{effectiveName}</span>
                  <span
                    className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${effectiveAccent}20`, color: effectiveAccent }}
                  >
                    Funded Trader
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
                    <span className="hidden md:inline">Account:</span>
                    <span
                      className="font-bold tabular px-2 py-0.5 rounded-md border"
                      style={{
                        borderColor: `${effectiveAccent}40`,
                        backgroundColor: `${effectiveAccent}10`,
                        color: effectiveAccent,
                      }}
                    >
                      $100,000.00
                    </span>
                  </div>
                  <div className="h-7 w-7 rounded-full bg-gray-800/40 flex items-center justify-center text-gray-400">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                </div>
              </header>

              {/* Mock Body: Sidebar + Main Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Mock Sidebar */}
                <aside
                  className={cn(
                    'w-40 p-3 border-r flex flex-col gap-1 shrink-0 hidden sm:flex',
                    isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200'
                  )}
                >
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: `${effectiveAccent}20`, color: effectiveAccent }}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>WebTrader</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Arena & Tourney</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Payouts</span>
                  </div>
                </aside>

                {/* Mock Content Workspace */}
                <main className="flex-1 p-4 overflow-y-auto space-y-3">
                  {/* Slogan Banner */}
                  <div
                    className={cn(
                      'p-3 rounded-xl border flex items-center justify-between gap-2',
                      isDark ? 'bg-[#111C33]/60 border-blue-500/20' : 'bg-blue-50/70 border-blue-200'
                    )}
                  >
                    <div>
                      <h4 className="text-xs font-bold leading-tight">{effectiveName} Portal</h4>
                      <p className="text-[10px] text-gray-400">{effectiveTagline}</p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-[11px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: effectiveAccent }}
                    >
                      Trade Now
                    </button>
                  </div>

                  {/* 3 Metrics Cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div
                      className={cn(
                        'p-2.5 rounded-xl border',
                        isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200 shadow-2xs'
                      )}
                    >
                      <span className="text-[10px] text-gray-400 block font-medium">Balance</span>
                      <span className="text-sm font-bold tabular">$108,450.00</span>
                      <span className="text-[9px] text-emerald-400 block mt-0.5">+8.45% all-time</span>
                    </div>

                    <div
                      className={cn(
                        'p-2.5 rounded-xl border',
                        isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200 shadow-2xs'
                      )}
                    >
                      <span className="text-[10px] text-gray-400 block font-medium">Daily DD Buffer</span>
                      <span className="text-sm font-bold tabular">$4,850.00</span>
                      <span className="text-[9px] text-emerald-400 block mt-0.5">4.85% of 5% max</span>
                    </div>

                    <div
                      className={cn(
                        'p-2.5 rounded-xl border',
                        isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200 shadow-2xs'
                      )}
                    >
                      <span className="text-[10px] text-gray-400 block font-medium">Profit Split</span>
                      <span
                        className="text-sm font-bold tabular"
                        style={{ color: effectiveAccent }}
                      >
                        80% Trader
                      </span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">Bi-weekly cycle</span>
                    </div>
                  </div>

                  {/* Simulated Chart Container */}
                  <div
                    className={cn(
                      'p-3 rounded-xl border h-36 flex flex-col justify-between',
                      isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200 shadow-2xs'
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold">Equity Performance Curve</span>
                      <span
                        className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${effectiveAccent}20`, color: effectiveAccent }}
                      >
                        + $8,450.00
                      </span>
                    </div>

                    {/* SVG Graphic with Dynamic Accent Curve */}
                    <div className="h-20 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="mockCurveGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={effectiveAccent} stopOpacity="0.35" />
                            <stop offset="100%" stopColor={effectiveAccent} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0,65 Q40,55 80,45 T160,35 T220,20 T300,10 L300,80 L0,80 Z"
                          fill="url(#mockCurveGrad)"
                        />
                        <path
                          d="M0,65 Q40,55 80,45 T160,35 T220,20 T300,10"
                          fill="none"
                          stroke={effectiveAccent}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </main>
              </div>
            </div>

            {/* Laptop Base Stand */}
            <div className="h-3 bg-[#1C1C1E] border-t border-black/60 flex items-center justify-center">
              <div className="h-1 w-16 bg-gray-600 rounded-full" />
            </div>
          </div>
        ) : (
          /* Mobile Phone Frame */
          <div className="w-[300px] rounded-[36px] border-[7px] border-[#27272A] bg-[#18181B] shadow-2xl overflow-hidden transition-all duration-300 relative">
            {/* Dynamic Island / Speaker Notch */}
            <div className="absolute top-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
              <div className="h-4 w-24 bg-black rounded-full flex items-center justify-center gap-1.5 px-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                <span className="h-2 w-2 rounded-full bg-gray-800" />
              </div>
            </div>

            {/* Mobile Screen */}
            <div
              className={cn(
                'h-[540px] pt-8 pb-5 px-3 flex flex-col justify-between transition-colors duration-200 overflow-y-auto text-xs',
                isDark ? 'bg-[#0B0F19] text-gray-100' : 'bg-gray-50 text-gray-900'
              )}
            >
              {/* Mobile Header */}
              <div className={cn('flex items-center justify-between pb-3 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}>
                <div className="flex items-center gap-2">
                  {logoUrl || sidebarIconUrl ? (
                    <img
                      src={logoUrl || sidebarIconUrl}
                      alt={effectiveName}
                      className="h-5 w-auto max-w-[90px] object-contain"
                    />
                  ) : (
                    <div
                      className="h-5 w-5 rounded flex items-center justify-center text-white font-extrabold text-3xs"
                      style={{ backgroundColor: effectiveAccent }}
                    >
                      {effectiveName.charAt(0)}
                    </div>
                  )}
                  <span className="font-bold text-xs truncate max-w-[110px]">{effectiveName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: `${effectiveAccent}20`, color: effectiveAccent }}
                  >
                    $100K
                  </span>
                </div>
              </div>

              {/* Mobile Content */}
              <div className="space-y-3 py-2">
                {/* Hero Balance Card */}
                <div
                  className="p-3.5 rounded-2xl border text-center space-y-1 shadow-xs"
                  style={{
                    backgroundColor: `${effectiveAccent}12`,
                    borderColor: `${effectiveAccent}35`,
                  }}
                >
                  <span className="text-[10px] text-gray-400 font-medium block">Net Account Equity</span>
                  <div className="text-xl font-black tabular tracking-tight">$109,210.00</div>
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>+$9,210.00 (+9.21%)</span>
                  </div>
                </div>

                {/* Quick 2-Col Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={cn(
                      'p-2.5 rounded-xl border',
                      isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200'
                    )}
                  >
                    <span className="text-[9px] text-gray-400 block font-medium">Daily Limit</span>
                    <span className="text-xs font-bold tabular text-emerald-400">$5,000 OK</span>
                  </div>
                  <div
                    className={cn(
                      'p-2.5 rounded-xl border',
                      isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200'
                    )}
                  >
                    <span className="text-[9px] text-gray-400 block font-medium">Max Drawdown</span>
                    <span className="text-xs font-bold tabular">$10,000 Static</span>
                  </div>
                </div>

                {/* Mobile Mini Chart */}
                <div
                  className={cn(
                    'p-2.5 rounded-xl border h-28 flex flex-col justify-between',
                    isDark ? 'bg-[#0E1524] border-gray-800' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={cn('font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>Live PnL Curve</span>
                    <span className="text-emerald-400 font-bold">12 Trades</span>
                  </div>
                  <div className="h-16 w-full relative">
                    <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                      <path
                        d="M0,50 Q30,40 60,30 T120,22 T160,15 T200,8 L200,60 L0,60 Z"
                        fill={`${effectiveAccent}25`}
                      />
                      <path
                        d="M0,50 Q30,40 60,30 T120,22 T160,15 T200,8"
                        fill="none"
                        stroke={effectiveAccent}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Action CTA */}
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-md active:scale-98 transition-transform"
                  style={{ backgroundColor: effectiveAccent }}
                >
                  Enter WebTrader Terminal
                </button>
              </div>

              {/* Mobile Home Indicator Bar */}
              <div className="flex justify-center pt-2">
                <div className="h-1 w-24 bg-gray-500 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
