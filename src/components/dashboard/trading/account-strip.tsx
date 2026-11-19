'use client'

import { memo } from 'react'
import type { Account, ChallengeMetrics } from '@/types/api'
import { toNum, fmtUSD, fmtPct } from '@/lib/format'
import { ShieldAlert, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  account: Account | null
  /** Sum of open-position PnL - passed in so the parent owns the data flow. */
  openPnL?: number
  metrics?: ChallengeMetrics | null
  compact?: boolean
  className?: string
}

export const AccountStrip = memo(function AccountStrip({
  account,
  openPnL = 0,
  metrics,
  compact = false,
  className,
}: Props) {
  if (!account) return null

  const bal = toNum(account.balance)
  // Rule 114 & Neon Tweak 1: Live Tick Equity Parity - ticks in lockstep with openPnL on every WS frame
  const eq = bal + openPnL
  const usedMargin = toNum(account.margin_used)
  const marginLevel = usedMargin > 0 ? (eq / usedMargin) * 100 : null

  // Drawdown Headroom Calculations
  const dailyMax = toNum(metrics?.daily_dd_val)
  const dailyLoss = toNum(metrics?.current_daily_loss)
  const dailyLeft = dailyMax > 0 ? Math.max(0, dailyMax - dailyLoss) : null
  const dailyPctLeft = dailyMax > 0 ? (dailyLeft! / dailyMax) * 100 : 100

  const maxTotal = toNum(metrics?.max_dd_val)
  const maxLeft = toNum(metrics?.dd_remaining)
  const maxPctLeft = maxTotal > 0 ? (maxLeft / maxTotal) * 100 : 100

  const isDailyWarning = dailyLeft !== null && dailyPctLeft <= 25
  const isMaxWarning = maxTotal > 0 && maxPctLeft <= 25
  const isCritical = (dailyLeft !== null && dailyPctLeft <= 12) || (maxTotal > 0 && maxPctLeft <= 12)

  return (
    <div
      className={cn(
        'w-full flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-surface/90 backdrop-blur-sm select-none text-terminal-micro transition-colors',
        isCritical && 'border-loss-subtle bg-loss-subtle',
        !isCritical && (isDailyWarning || isMaxWarning) && 'border-amber-500/40 bg-amber-500/5',
        className
      )}
      role="region"
      aria-label="Drawdown Headroom & Account Telemetry HUD"
    >
      {/* Left: Balance, Equity, Open PnL */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-terminal-micro font-medium uppercase tracking-wider">Equity</span>
          <span className="font-semibold terminal-num text-text">{fmtUSD(eq)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-terminal-micro font-medium uppercase tracking-wider">Balance</span>
          <span className="terminal-num text-text-muted">{fmtUSD(bal)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-terminal-micro font-medium uppercase tracking-wider">Open P&L</span>
          <div className="flex items-center gap-1">
            {openPnL >= 0 ? (
              <TrendingUp className="h-3 w-3 text-profit" />
            ) : (
              <TrendingDown className="h-3 w-3 text-loss" />
            )}
            <span
              className={cn(
                'font-semibold terminal-num',
                openPnL >= 0 ? 'text-profit' : 'text-loss'
              )}
            >
              {fmtUSD(openPnL, { sign: true })}
            </span>
          </div>
        </div>
      </div>

      {/* Center / Right: Headroom Cushions */}
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
        {/* Daily Drawdown Cushion */}
        {dailyLeft !== null && (
          <div
            className="flex items-center gap-2"
            title={`Daily Drawdown Cushion: ${fmtUSD(dailyLeft)} remaining before daily limit breach`}
          >
            <span className="text-text-muted text-terminal-micro font-medium uppercase tracking-wider hidden sm:inline">
              Daily Floor
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'font-medium terminal-num text-terminal-micro',
                  isDailyWarning ? 'text-loss font-semibold' : 'text-text'
                )}
              >
                {fmtUSD(dailyLeft)}
              </span>
              <div className="w-12 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    dailyPctLeft > 50 ? 'bg-emerald-500' : dailyPctLeft > 25 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, dailyPctLeft))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Max / Trailing Drawdown Cushion */}
        {maxTotal > 0 && (
          <div
            className="flex items-center gap-2"
            title={`Overall Drawdown Cushion: ${fmtUSD(maxLeft)} remaining before maximum/trailing loss breach`}
          >
            <span className="text-text-muted text-terminal-micro font-medium uppercase tracking-wider hidden sm:inline">
              Max Floor
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'font-medium terminal-num text-terminal-micro',
                  isMaxWarning ? 'text-loss font-semibold' : 'text-text'
                )}
              >
                {fmtUSD(maxLeft)}
              </span>
              <div className="w-12 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    maxPctLeft > 50 ? 'bg-emerald-500' : maxPctLeft > 25 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, maxPctLeft))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Margin Level */}
        {marginLevel !== null && !compact && (
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-text-muted text-terminal-micro font-medium uppercase tracking-wider">Margin Lvl</span>
            <span
              className={cn(
                'terminal-num font-medium text-terminal-micro',
                marginLevel <= 120 ? 'text-loss font-bold' : marginLevel <= 200 ? 'text-amber-500' : 'text-text-muted'
              )}
            >
              {fmtPct(marginLevel, 0)}
            </span>
          </div>
        )}

        {/* Warning Indicator Badge */}
        {isCritical ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-loss-subtle text-loss text-[10px] font-bold uppercase tracking-wider animate-pulse">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Danger Floor</span>
          </div>
        ) : isDailyWarning || isMaxWarning ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-medium uppercase tracking-wider">
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span>Low Cushion</span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-1 text-profit text-[10px] font-medium">
            <ShieldCheck className="h-3 w-3" />
            <span>Safe</span>
          </div>
        )}
      </div>
    </div>
  )
})
