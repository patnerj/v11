'use client'

import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { Gauge, ShieldCheck, ShieldAlert, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { fmtUSD, toNum } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ChallengeMetrics, Account } from '@/types/api'

interface RiskCushionSpeedometerProps {
  metrics: ChallengeMetrics
  account?: Account | null
  className?: string
}

export const RiskCushionSpeedometer = memo(function RiskCushionSpeedometer({
  metrics: m,
  account,
  className,
}: RiskCushionSpeedometerProps) {
  const startingBalance = toNum(
    m.starting_balance || (m.account as any)?.starting_balance || m.plan?.account_size || 100000
  )

  // 1. Daily Drawdown Cushion
  const dailyLimitPct = toNum(m.daily_dd_pct || 5)
  const dailyLimitVal = toNum(m.daily_dd_val) || (startingBalance * dailyLimitPct) / 100
  const currentDailyLoss = Math.max(0, toNum(m.current_daily_loss))
  const dailyCushion = Math.max(0, dailyLimitVal - currentDailyLoss)
  const dailyBufferPct = dailyLimitVal > 0
    ? Math.max(0, Math.min(100, (dailyCushion / dailyLimitVal) * 100))
    : 100

  // 2. Max / Trailing Drawdown Cushion
  const maxLimitPct = toNum(m.max_dd_pct || 10)
  const maxLimitVal = toNum(m.max_dd_val) || (startingBalance * maxLimitPct) / 100
  const currentEquity = toNum(m.equity || account?.equity || m.balance || account?.balance || startingBalance)
  
  const isTrailing = m.challenge?.drawdown_type === 'trailing' || m.challenge?.drawdown_type === 'eod_trailing'
  const floorPrice = isTrailing
    ? toNum((m.challenge as any)?.trailing_dd_floor) || startingBalance * (1 - maxLimitPct / 100)
    : startingBalance * (1 - maxLimitPct / 100)

  const rawFloorDiff = currentEquity - floorPrice
  const floorCushion = Math.max(0, rawFloorDiff)
  const maxBufferPct = maxLimitVal > 0
    ? Math.max(0, Math.min(100, (floorCushion / maxLimitVal) * 100))
    : 100

  // Composite cushion score: minimum of daily and max buffer
  const compositeScore = Math.round(Math.min(dailyBufferPct, maxBufferPct))
  
  const statusLabel = compositeScore >= 70
    ? 'Optimal Buffer'
    : compositeScore >= 35
      ? 'Caution Zone'
      : 'Critical Risk'

  const tone = compositeScore >= 70
    ? 'safe'
    : compositeScore >= 35
      ? 'warn'
      : 'danger'

  // Speedometer arc calculations (240-degree sweep from 150deg to 390deg)
  const strokeDashoffset = 330 - (330 * (compositeScore / 100))

  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center border",
            tone === 'safe' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
            tone === 'warn' && "bg-amber-500/10 text-amber-400 border-amber-500/30",
            tone === 'danger' && "bg-rose-500/10 text-rose-400 border-rose-500/30"
          )}>
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">
              Risk Cushion Dial
            </h3>
            <span className="text-2xs text-text-muted">Distance to breach limits</span>
          </div>
        </div>

        <span className={cn(
          "text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border font-mono",
          tone === 'safe' && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          tone === 'warn' && "bg-amber-500/15 text-amber-400 border-amber-500/30",
          tone === 'danger' && "bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse"
        )}>
          {statusLabel}
        </span>
      </div>

      {/* Speedometer Radial Gauge */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
        <div className="relative flex items-center justify-center w-36 h-36">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
            {/* Background Track */}
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="transparent"
              stroke="hsl(var(--surface-muted))"
              strokeWidth="10"
              strokeDasharray="226"
              strokeDashoffset="75"
              strokeLinecap="round"
            />
            {/* Value Arc */}
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="transparent"
              stroke={
                tone === 'safe'
                  ? '#10B981'
                  : tone === 'warn'
                    ? '#F59E0B'
                    : '#EF4444'
              }
              strokeWidth="10"
              strokeDasharray="226"
              strokeDashoffset={226 - (151 * (compositeScore / 100))}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black terminal-num text-text">
              {compositeScore}%
            </span>
            <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">
              Cushion
            </span>
          </div>
        </div>

        {/* Dual Buffer Gauges */}
        <div className="flex-1 w-full space-y-3.5">
          {/* Daily Drawdown buffer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-2xs font-medium">
              <span className="text-text-muted">Daily DD Headroom</span>
              <span className="terminal-num text-text font-semibold">
                {fmtUSD(dailyCushion)} ({dailyBufferPct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  dailyBufferPct > 60 ? "bg-emerald-500" : dailyBufferPct >= 30 ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, dailyBufferPct))}%` }}
              />
            </div>
          </div>

          {/* Max / Trailing Drawdown buffer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-2xs font-medium">
              <span className="text-text-muted">Trailing Floor Buffer</span>
              <span className="terminal-num text-text font-semibold">
                {fmtUSD(floorCushion)} ({maxBufferPct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  maxBufferPct > 60 ? "bg-emerald-500" : maxBufferPct >= 30 ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, maxBufferPct))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
