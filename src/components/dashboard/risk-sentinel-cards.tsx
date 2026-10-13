'use client'

import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, AlertTriangle, Clock, ArrowUpRight, TrendingUp } from 'lucide-react'
import { fmtUSD, fmtPct, toNum } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ChallengeMetrics, Account } from '@/types/api'
import { DailyDdTimer } from '@/components/dashboard/trading/daily-dd-timer'

interface RiskSentinelCardsProps {
  metrics: ChallengeMetrics
  account?: Account | null
  className?: string
}

type Tone = 'safe' | 'warn' | 'danger'

export const RiskSentinelCards = memo(function RiskSentinelCards({
  metrics: m,
  account,
  className,
}: RiskSentinelCardsProps) {
  const startingBalance = toNum(m.starting_balance || (m.account as any)?.starting_balance || m.plan?.account_size || 100000)

  // ── 1. Daily Drawdown Calculations ──────────────────────────────────────
  const dailyLimitPct = toNum(m.daily_dd_pct || 5)
  const dailyLimitVal = toNum(m.daily_dd_val) || (startingBalance * dailyLimitPct / 100)
  const currentDailyLoss = Math.max(0, toNum(m.current_daily_loss))
  const dailyCushion = Math.max(0, dailyLimitVal - currentDailyLoss)
  const dailyBufferPct = dailyLimitVal > 0
    ? Math.max(0, Math.min(100, (dailyCushion / dailyLimitVal) * 100))
    : 100
  const dailyUsedPct = dailyLimitVal > 0 ? (currentDailyLoss / dailyLimitVal) * 100 : 0

  const dailyTone: Tone = dailyBufferPct > 60 ? 'safe' : dailyBufferPct >= 30 ? 'warn' : 'danger'

  // ── 2. Max Drawdown / Floor Calculations ────────────────────────────────
  const isTrailing = m.challenge?.drawdown_type === 'trailing'
  const isEodTrailing = m.challenge?.drawdown_type === 'eod_trailing'
  const maxLimitPct = toNum(m.max_dd_pct || 10)
  const maxLimitVal = toNum(m.max_dd_val) || (startingBalance * maxLimitPct / 100)
  const currentEquity = toNum(m.equity || account?.equity || m.balance || account?.balance || startingBalance)
  const peakHwm = toNum((m.challenge as any)?.equity_hwm || m.challenge?.current_balance || startingBalance)

  let floorPrice: number

  if (isTrailing || isEodTrailing) {
    floorPrice = toNum((m.challenge as any)?.trailing_dd_floor) || (startingBalance * (1 - maxLimitPct / 100))
  } else {
    floorPrice = startingBalance * (1 - maxLimitPct / 100)
  }

  const rawFloorDiff = currentEquity - floorPrice
  const isAboveFloor = rawFloorDiff >= 0
  const floorCushion = Math.max(0, rawFloorDiff)

  const maxBufferPct = maxLimitVal > 0
    ? Math.max(0, Math.min(100, (floorCushion / maxLimitVal) * 100))
    : 100

  const maxTone: Tone = maxBufferPct > 60 ? 'safe' : maxBufferPct >= 30 ? 'warn' : 'danger'

  return (
    <div className={cn("grid md:grid-cols-2 gap-4 sm:gap-6", className)}>
      {/* ── CARD 1: DAILY DRAWDOWN SENTINEL ─────────────────────────────── */}
      <div className={cn(
        "relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs",
        dailyTone === 'safe' && "bg-gradient-to-br from-emerald-500/10 via-surface/90 to-surface border-emerald-500/30",
        dailyTone === 'warn' && "bg-gradient-to-br from-amber-500/15 via-surface/90 to-surface border-amber-500/40 ring-1 ring-amber-500/20",
        dailyTone === 'danger' && "bg-gradient-to-br from-rose-500/20 via-surface/95 to-surface border-rose-500/50 ring-2 ring-rose-500/30 animate-pulse",
      )}>
        {/* Glow ambient background aura */}
        <div className={cn(
          "absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-40",
          dailyTone === 'safe' && "bg-emerald-500",
          dailyTone === 'warn' && "bg-amber-500",
          dailyTone === 'danger' && "bg-rose-500",
        )} />

        <div className="relative z-10 space-y-4">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                dailyTone === 'safe' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                dailyTone === 'warn' && "bg-amber-500/20 text-amber-400 border-amber-500/40",
                dailyTone === 'danger' && "bg-rose-500/20 text-rose-400 border-rose-500/40",
              )}>
                {dailyTone === 'safe' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <span className="text-terminal-micro uppercase tracking-wider text-text-muted font-semibold block">
                  Risk Sentinel · Daily Limit
                </span>
                <h3 className="text-terminal-title font-semibold text-text truncate">
                  🛡️ Daily DD Cushion
                </h3>
              </div>
            </div>

            <div className={cn(
              "px-2.5 py-1 rounded-full text-terminal-micro font-semibold border shrink-0 flex items-center gap-1.5",
              dailyTone === 'safe' && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
              dailyTone === 'warn' && "bg-amber-500/15 text-amber-400 border-amber-500/30",
              dailyTone === 'danger' && "bg-rose-500/20 text-rose-400 border-rose-500/40",
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                dailyTone === 'safe' && "bg-emerald-400",
                dailyTone === 'warn' && "bg-amber-400",
                dailyTone === 'danger' && "bg-rose-400 animate-ping",
              )} />
              <span>{dailyBufferPct.toFixed(1)}% Buffer</span>
            </div>
          </div>

          {/* Primary Dollar Cushion Metric */}
          <div className="space-y-1">
            <div className="text-terminal-micro uppercase tracking-wider text-text-muted font-medium">
              Cushion Remaining Before Daily Breach
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={cn(
                "text-2xl sm:text-3xl font-extrabold terminal-num tracking-tight",
                dailyTone === 'safe' && "text-emerald-400",
                dailyTone === 'warn' && "text-amber-400",
                dailyTone === 'danger' && "text-rose-400",
              )}>
                {fmtUSD(dailyCushion)}
              </span>
              <span className="text-terminal-label text-text-muted font-normal">
                {dailyCushion > 0
                  ? `remaining of ${fmtUSD(dailyLimitVal)} limit`
                  : `DAILY LIMIT REACHED (${fmtUSD(currentDailyLoss)} loss)`}
              </span>
            </div>
          </div>

          {/* Dual Horizon Buffer Track */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-terminal-micro text-text-muted font-medium">
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-rose-500 inline shrink-0" /> Breach Zone ($0 remaining)
              </span>
              <span className={cn(
                "terminal-num font-semibold",
                dailyTone === 'safe' ? "text-emerald-400" : dailyTone === 'warn' ? "text-amber-400" : "text-rose-400"
              )}>
                {dailyUsedPct.toFixed(1)}% used ({fmtUSD(currentDailyLoss)})
              </span>
            </div>

            <div className="h-3 w-full bg-surface-muted/90 rounded-full overflow-hidden p-0.5 border border-border-subtle relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dailyBufferPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  dailyTone === 'safe' && "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
                  dailyTone === 'warn' && "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
                  dailyTone === 'danger' && "bg-gradient-to-r from-rose-600 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]",
                )}
              />
            </div>
          </div>

          {/* Financial Telemetry Strip */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-subtle/70 text-terminal-micro">
            <div className="flex flex-col">
              <span className="text-text-muted">Daily Limit</span>
              <span className="terminal-num font-semibold text-text truncate">{fmtUSD(dailyLimitVal)}</span>
            </div>
            <div className="flex flex-col text-center">
              <span className="text-text-muted">Today&apos;s Loss</span>
              <span className="terminal-num font-semibold text-rose-400 truncate">{fmtUSD(currentDailyLoss)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-text-muted">Buffer Status</span>
              <span className={cn(
                "terminal-num font-semibold truncate",
                dailyTone === 'safe' ? "text-emerald-400" : dailyTone === 'warn' ? "text-amber-400" : "text-rose-400"
              )}>
                {dailyTone === 'safe' ? 'Protected 🛡️' : dailyTone === 'warn' ? 'Cautious ⚠️' : 'Critical 🚨'}
              </span>
            </div>
          </div>

          {/* Reset Timer Footer */}
          <div className="pt-2 flex items-center justify-between">
            <DailyDdTimer compact className="w-full justify-between bg-surface/70 border-border-subtle text-terminal-micro py-1" />
          </div>
        </div>
      </div>

      {/* ── CARD 2: MAX DRAWDOWN / FLOOR SENTINEL ───────────────────────── */}
      <div className={cn(
        "relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs",
        maxTone === 'safe' && "bg-gradient-to-br from-emerald-500/10 via-surface/90 to-surface border-emerald-500/30",
        maxTone === 'warn' && "bg-gradient-to-br from-amber-500/15 via-surface/90 to-surface border-amber-500/40 ring-1 ring-amber-500/20",
        maxTone === 'danger' && "bg-gradient-to-br from-rose-500/20 via-surface/95 to-surface border-rose-500/50 ring-2 ring-rose-500/30 animate-pulse",
      )}>
        {/* Glow ambient background aura */}
        <div className={cn(
          "absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-40",
          maxTone === 'safe' && "bg-emerald-500",
          maxTone === 'warn' && "bg-amber-500",
          maxTone === 'danger' && "bg-rose-500",
        )} />

        <div className="relative z-10 space-y-4">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                maxTone === 'safe' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                maxTone === 'warn' && "bg-amber-500/20 text-amber-400 border-amber-500/40",
                maxTone === 'danger' && "bg-rose-500/20 text-rose-400 border-rose-500/40",
              )}>
                {maxTone === 'safe' ? <TrendingUp className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <span className="text-terminal-micro uppercase tracking-wider text-text-muted font-semibold block">
                  {isTrailing ? 'Trailing DD Floor' : 'Max Drawdown Floor'}
                </span>
                <h3 className="text-terminal-title font-semibold text-text truncate">
                  🛡️ Max DD Floor
                </h3>
              </div>
            </div>

            <div className={cn(
              "px-2.5 py-1 rounded-full text-terminal-micro font-semibold border shrink-0 flex items-center gap-1.5",
              maxTone === 'safe' && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
              maxTone === 'warn' && "bg-amber-500/15 text-amber-400 border-amber-500/30",
              maxTone === 'danger' && "bg-rose-500/20 text-rose-400 border-rose-500/40",
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                maxTone === 'safe' && "bg-emerald-400",
                maxTone === 'warn' && "bg-amber-400",
                maxTone === 'danger' && "bg-rose-400 animate-ping",
              )} />
              <span>{isTrailing ? 'Trailing' : 'Static'} Floor</span>
            </div>
          </div>

          {/* Primary Dollar Floor Metric */}
          <div className="space-y-1">
            <div className="text-terminal-micro uppercase tracking-wider text-text-muted font-medium">
              Breach Floor Level · Current Distance
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold terminal-num tracking-tight text-text">
                {fmtUSD(floorPrice)}
              </span>
              {isAboveFloor ? (
                <span className={cn(
                  "text-terminal-label font-bold terminal-num",
                  maxTone === 'safe' && "text-emerald-400",
                  maxTone === 'warn' && "text-amber-400",
                  maxTone === 'danger' && "text-rose-400",
                )}>
                  (+{fmtUSD(floorCushion)} above floor)
                </span>
              ) : (
                <span className="text-terminal-label font-bold terminal-num text-rose-400">
                  (-{fmtUSD(Math.abs(rawFloorDiff))} below floor · BREACHED)
                </span>
              )}
            </div>
          </div>

          {/* Dual Horizon Buffer Track with Markers */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-terminal-micro text-text-muted font-medium">
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <span>Floor:</span> {fmtUSD(floorPrice)}
              </span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span>Peak:</span> {fmtUSD(peakHwm)}
              </span>
            </div>

            <div className="h-3 w-full bg-surface-muted/90 rounded-full overflow-hidden p-0.5 border border-border-subtle relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${maxBufferPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  maxTone === 'safe' && "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
                  maxTone === 'warn' && "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
                  maxTone === 'danger' && "bg-gradient-to-r from-rose-600 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]",
                )}
              />
            </div>
          </div>

          {/* Financial Telemetry Strip */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-subtle/70 text-terminal-micro">
            <div className="flex flex-col">
              <span className="text-text-muted">Current Equity</span>
              <span className="terminal-num font-semibold text-text truncate">{fmtUSD(currentEquity)}</span>
            </div>
            <div className="flex flex-col text-center">
              <span className="text-text-muted">Max Loss Limit</span>
              <span className="terminal-num font-semibold text-text truncate">{fmtUSD(maxLimitVal)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-text-muted">Floor Cushion</span>
              <span className={cn(
                "terminal-num font-semibold truncate",
                maxTone === 'safe' ? "text-emerald-400" : maxTone === 'warn' ? "text-amber-400" : "text-rose-400"
              )}>
                {fmtUSD(floorCushion)}
              </span>
            </div>
          </div>

          {/* Explanatory Callout Footer */}
          <div className="pt-2 text-terminal-micro text-text-muted/80 flex items-center justify-between border-t border-border-subtle/40">
            <span className="truncate">
              {isTrailing
                ? 'Floor ratchets upward with peak equity (High-Water Mark).'
                : 'Static floor remains anchored to starting evaluation balance.'}
            </span>
            <span className={cn(
              "font-semibold terminal-num shrink-0 ml-2",
              maxTone === 'safe' ? "text-emerald-400" : maxTone === 'warn' ? "text-amber-400" : "text-rose-400"
            )}>
              {maxBufferPct.toFixed(1)}% safe
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
