'use client'

import { useState, useEffect, useMemo, memo } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ChallengeMetrics } from '@/types/api'

/**
 * Calculates time remaining until Server Midnight (00:00 UTC).
 */
export function getUtcMidnightRemaining(): { hours: number; minutes: number; seconds: number; formatted: string } {
  const now = new Date()
  const nextMidnightUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ))
  const diffMs = Math.max(0, nextMidnightUtc.getTime() - now.getTime())
  const totalSec = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    hours,
    minutes,
    seconds,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  }
}

/**
 * Live countdown timer pill displaying time remaining until server midnight (00:00 UTC):
 * ⏳ Daily DD Resets in: [HH:MM:SS]
 */
export const DailyDdTimer = memo(function DailyDdTimer({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const [remaining, setRemaining] = useState<string>('00:00:00')

  useEffect(() => {
    // Initial sync
    setRemaining(getUtcMidnightRemaining().formatted)

    const timer = setInterval(() => {
      setRemaining(getUtcMidnightRemaining().formatted)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-terminal-body font-normal',
        'bg-surface-muted/90 border border-border/80 text-text-muted shadow-xs select-none',
        className
      )}
      title="Server Daily Drawdown reset occurs daily at 00:00 UTC."
    >
      <span className="text-terminal-body shrink-0 select-none">⏳</span>
      <span className="text-terminal-micro text-text-muted hidden sm:inline">
        {compact ? 'Resets in:' : 'Daily DD Resets in:'}
      </span>
      <span className="font-semibold tabular terminal-num text-text tracking-wider">{remaining}</span>
      <span className="text-terminal-micro text-text-muted/70 font-sans hidden sm:inline">UTC</span>
    </div>
  )
})

/**
 * Drawdown "Danger Zone" Warning Glow / Alert.
 * Triggered when trader's daily or max drawdown reaches >= 80% of limit (or within 1.0% of breach).
 */
export const DrawdownAlertBadge = memo(function DrawdownAlertBadge({
  metrics,
  className,
}: {
  metrics?: ChallengeMetrics | null
  className?: string
}) {
  if (!metrics) return null

  const dailyUsedPct = Number(metrics.daily_dd_used_pct || 0)
  const dailyLimitPct = Number(metrics.daily_dd_pct || 0)
  const dailyProgress = Number(metrics.daily_dd_progress || 0)

  // Daily DD danger zone condition: >= 80% of daily limit used OR within 1.0% of breach
  const isDailyEightyPct =
    (dailyLimitPct > 0 && dailyUsedPct >= dailyLimitPct * 0.8) ||
    dailyProgress >= 80
  const isDailyWithinOnePct =
    dailyLimitPct > 0 && (dailyLimitPct - dailyUsedPct) <= 1.0 && dailyUsedPct > 0
  const isDailyDanger = isDailyEightyPct || isDailyWithinOnePct

  // Max DD danger zone condition: >= 80% of max limit used OR within 1.0% of breach
  const maxUsedPct = Number(metrics.current_dd_pct || 0)
  const maxLimitPct = Number(metrics.max_dd_pct || 0)
  const maxProgress = Number(metrics.max_dd_progress || 0)
  const isMaxEightyPct =
    (maxLimitPct > 0 && maxUsedPct >= maxLimitPct * 0.8) ||
    maxProgress >= 80
  const isMaxWithinOnePct =
    maxLimitPct > 0 && (maxLimitPct - maxUsedPct) <= 1.0 && maxUsedPct > 0
  const isMaxDanger = isMaxEightyPct || isMaxWithinOnePct

  if (!isDailyDanger && !isMaxDanger) return null

  // Prioritize Max DD alert if it is closer to terminal failure
  const isMaxMoreCritical = isMaxDanger && (!isDailyDanger || maxProgress >= dailyProgress)

  return (
    <div
      role="alert"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-terminal-body font-semibold shadow-xs select-none',
        'bg-rose-500/15 border border-rose-500/50 text-rose-300 animate-pulse',
        'shadow-[0_0_12px_rgba(244,63,94,0.25)]',
        className
      )}
      title={isMaxMoreCritical ? "Danger: You are approaching your maximum account drawdown limit!" : "Caution: You are approaching your daily drawdown maximum limit!"}
    >
      <span className="text-terminal-body shrink-0 select-none">{isMaxMoreCritical ? '🚨' : '⚠️'}</span>
      <span className="font-semibold tracking-tight">
        {isMaxMoreCritical
          ? `Danger: Max Drawdown at ${maxUsedPct.toFixed(1)}% (Limit: ${maxLimitPct.toFixed(1)}%)`
          : `Caution: Daily Drawdown at ${dailyUsedPct.toFixed(1)}% (Limit: ${dailyLimitPct.toFixed(1)}%)`}
      </span>
    </div>
  )
})
