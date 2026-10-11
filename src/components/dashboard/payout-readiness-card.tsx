'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Banknote, Clock, Sparkles, ArrowRight, Wallet, CheckCircle2,
  ShieldCheck, AlertCircle, ArrowUpRight
} from 'lucide-react'
import { fmtUSD, toNum } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { ChallengeAccount } from '@/types/api'

interface PayoutReadinessCardProps {
  fundedChallenges?: ChallengeAccount[]
  nextPayoutAt?: string | null
  savedMethod?: any
  className?: string
}

export function PayoutReadinessCard({
  fundedChallenges = [],
  nextPayoutAt,
  savedMethod,
  className,
}: PayoutReadinessCardProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    totalSecs: number
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSecs: 0 })

  // Defensive normalization per Rule 1.2
  const safeFundedChallenges = useMemo<ChallengeAccount[]>(() => {
    if (Array.isArray(fundedChallenges)) return fundedChallenges
    if (fundedChallenges && typeof fundedChallenges === 'object' && Array.isArray((fundedChallenges as any).challenges)) {
      return (fundedChallenges as any).challenges
    }
    return []
  }, [fundedChallenges])

  // Calculate target payout timestamp
  const targetTs = useMemo(() => {
    if (nextPayoutAt) {
      const parsed = new Date(nextPayoutAt).getTime()
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    // Inspect earliest funded account to establish 14-day cycle
    const earliestFunded = safeFundedChallenges.find(
      (c) => c.funded_at || c.phase_started_at || c.created_at
    )
    if (earliestFunded) {
      const startStr = earliestFunded.funded_at || earliestFunded.phase_started_at || earliestFunded.created_at
      const startMs = new Date(startStr).getTime()
      if (!isNaN(startMs) && startMs > 0) {
        return startMs + 14 * 24 * 60 * 60 * 1000
      }
    }
    // Default fallback: 14-day cycle from earliest funded creation or 7 days from now
    return Date.now() + 7 * 24 * 60 * 60 * 1000
  }, [nextPayoutAt, safeFundedChallenges])

  // Live 1-second countdown interval
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((targetTs - now) / 1000))
      const days = Math.floor(diff / (24 * 3600))
      const hours = Math.floor((diff % (24 * 3600)) / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60

      setTimeLeft({ days, hours, minutes, seconds, totalSecs: diff })
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [targetTs])

  // Total eligible profit across funded accounts
  const totalFundedStats = useMemo(() => {
    let eligibleProfit = 0
    let totalFundedBal = 0
    let totalStartingBal = 0

    safeFundedChallenges.forEach((c: ChallengeAccount) => {
      const curr = toNum(c.current_balance || c.starting_balance)
      const start = toNum(c.starting_balance || 100000)
      totalFundedBal += curr
      totalStartingBal += start
      const profit = Math.max(0, curr - start)
      const splitPct = toNum((c as any)?.profit_split || (c as any)?.custom_profit_split || 80)
      eligibleProfit += (profit * splitPct) / 100
    })

    return {
      eligibleProfit,
      totalFundedBal,
      totalStartingBal,
      hasProfit: eligibleProfit > 0,
    }
  }, [safeFundedChallenges])

  // Defensive Zero-state handling for 0 funded accounts or no payout history
  if (!safeFundedChallenges || safeFundedChallenges.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-border/80 bg-surface/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none", className)}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Wallet className="h-4.5 w-4.5 text-accent" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-text">No Funded Accounts Active Yet</h4>
            <p className="text-2xs text-text-muted mt-0.5">Pass your evaluation stage to unlock automated bi-weekly profit split disbursals.</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 text-xs">
          <Link href="/dashboard">View Challenge Goals</Link>
        </Button>
      </div>
    )
  }

  // Active celebration state when countdown reaches 0 or next payout date is past/today
  const isReady = timeLeft.totalSecs <= 0 || targetTs <= Date.now()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all duration-300 shadow-md select-none",
        isReady
          ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 via-surface to-surface ring-2 ring-emerald-500/30"
          : "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-surface to-surface",
        className
      )}
    >
      {/* Background radial shimmer */}
      <div className={cn(
        "absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl pointer-events-none opacity-30",
        isReady ? "bg-emerald-500" : "bg-amber-400"
      )} />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Left Side: Countdown & Status Badges */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-terminal-micro font-bold uppercase tracking-wider flex items-center gap-1.5",
              isReady ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"
            )}>
              <Sparkles className="w-3.5 h-3.5" />
              {isReady ? "🎉 Payout Ready Now! Claim Profit Split" : "Funded Trader Payout Readiness"}
            </span>
            <Badge
              tone={isReady ? "success" : "warn"}
              size="sm"
              pulsing={isReady}
              className="text-2xs font-semibold uppercase tracking-wider font-mono shadow-xs"
            >
              {isReady ? "🎉 Eligible Now" : "Cycle In Progress"}
            </Badge>
          </div>

          <div className="flex items-baseline gap-3">
            <div className="text-2xl sm:text-3xl font-extrabold terminal-num text-text tracking-tight flex items-center gap-2">
              <Clock className={cn("w-6 h-6", isReady ? "text-emerald-500 animate-pulse" : "text-amber-500")} />
              {isReady ? (
                <span className="text-emerald-500 dark:text-emerald-400">00:00:00 • Unlocked</span>
              ) : (
                <span>
                  {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-text-muted leading-relaxed max-w-xl">
            {isReady ? (
              <span className="text-emerald-600 dark:text-emerald-300 font-medium">
                Your scheduled 14-day cycle is complete! Eligible profit splits can now be requested directly to your verified payout wallet.
              </span>
            ) : (
              <span>
                Bi-weekly profit split countdown. Eligible profit splits are disbursed directly to your verified payout wallet.
              </span>
            )}
          </p>
        </div>

        {/* Right Side: Estimated Eligible Profit & Action CTA */}
        <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-4 border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6 shrink-0">
          <div className="text-left md:text-right">
            <span className="text-terminal-micro uppercase tracking-wider text-text-muted font-medium block">
              Estimated Net Split (80%)
            </span>
            <div className="text-xl sm:text-2xl font-bold terminal-num text-profit mt-0.5">
              {fmtUSD(totalFundedStats.eligibleProfit)}
            </div>
            <span className="text-2xs text-text-muted block mt-0.5">
              Across {safeFundedChallenges.length} funded {safeFundedChallenges.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {isReady ? (
              <Button asChild variant="primary" size="sm" className="w-full sm:w-auto shadow-md shadow-emerald-500/25 bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                <Link href="/dashboard/payouts">
                  Request Payout <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            ) : savedMethod ? (
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto border-amber-500/30 text-text hover:bg-amber-500/10">
                <Link href="/dashboard/payouts">
                  <Banknote className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  View Payout Hub
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto border-amber-500/30 text-text hover:bg-amber-500/10">
                <Link href="/dashboard/payouts">
                  <Wallet className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  Setup Disbursal Method
                </Link>
              </Button>
            )}
          </div>

        </div>

      </div>
    </motion.div>
  )
}
