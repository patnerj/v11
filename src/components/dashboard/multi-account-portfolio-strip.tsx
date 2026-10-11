'use client'

import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy, Sparkles, TrendingUp, TrendingDown, CheckCircle2,
  AlertTriangle, ShieldCheck, ArrowRight, Layers, ChevronRight,
  ChevronLeft, Award, Radio
} from 'lucide-react'
import { fmtUSD, fmtPct, toNum, statusTone, statusLabel } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePrices } from '@/store/prices'
import { cn } from '@/lib/cn'
import type { ChallengeAccount, TournamentMine } from '@/types/api'

interface MultiAccountPortfolioStripProps {
  challenges: ChallengeAccount[]
  tournaments?: TournamentMine[]
  activeAccountId?: number
  className?: string
}

export function MultiAccountPortfolioStrip({
  challenges,
  tournaments = [],
  activeAccountId,
  className,
}: MultiAccountPortfolioStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const tradingCtx = usePrices((s) => s.tradingContext)
  const isSwitching = usePrices((s) => s.contextSwitching)

  if (!challenges || challenges.length <= 1 && tournaments.length === 0) {
    return null
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return
    const offset = direction === 'left' ? -320 : 320
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  const handleSelectChallenge = async (ch: ChallengeAccount) => {
    if (isSwitching) return
    const accId = ch.fxsim_account_id || ch.id
    if (tradingCtx?.kind === 'challenge' && tradingCtx.accountId === accId) return

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('tournament')
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
    }

    await usePrices.getState().setTradingContext({
      kind: 'challenge',
      accountId: accId,
    })
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Layers className="h-3.5 w-3.5 text-accent" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
            Multi-Account Portfolio Strip
            <span className="text-2xs font-normal text-text-muted">
              ({challenges.length} Accounts Active)
            </span>
          </h3>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="h-7 w-7 rounded-lg border border-border bg-surface hover:bg-surface-muted flex items-center justify-center text-text-muted hover:text-text transition-colors cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="h-7 w-7 rounded-lg border border-border bg-surface hover:bg-surface-muted flex items-center justify-center text-text-muted hover:text-text transition-colors cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Strip */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-3.5 overflow-x-auto pb-2 pt-1 -mx-1 px-1 custom-scrollbar snap-x snap-mandatory"
      >
        {challenges.map((ch) => {
          const accId = ch.fxsim_account_id || ch.id
          const isActive = tradingCtx?.kind === 'challenge'
            ? tradingCtx.accountId === accId
            : activeAccountId === accId

          const equity = toNum(ch.current_balance || ch.starting_balance)
          const startBal = toNum(ch.starting_balance || 100000)
          const netPnl = equity - startBal
          const netPnlPct = startBal > 0 ? (netPnl / startBal) * 100 : 0
          const isFunded = ch.status === 'funded'
          const isPassed = ch.status === 'passed'
          const isFailed = ch.status === 'failed'

          return (
            <motion.div
              key={`strip-ch-${ch.id}`}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleSelectChallenge(ch)}
              className={cn(
                "w-72 sm:w-80 shrink-0 snap-start rounded-2xl border p-4.5 cursor-pointer transition-all duration-200 select-none flex flex-col justify-between shadow-xs",
                isActive
                  ? "bg-surface border-accent shadow-md ring-2 ring-accent/30 dark:ring-accent/40"
                  : "bg-surface/80 hover:bg-surface border-border hover:border-accent/40"
              )}
            >
              <div>
                {/* Header row: ID, Plan, Phase Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-surface-muted text-text border border-border">
                      #{ch.id}
                    </span>
                    <span className="text-xs font-semibold text-text truncate">
                      {ch.plan_name || 'Standard Account'}
                    </span>
                  </div>

                  <Badge
                    tone={isFunded ? 'success' : isPassed ? 'accent' : isFailed ? 'danger' : 'neutral'}
                    size="sm"
                    className="text-2xs uppercase tracking-wider shrink-0 font-semibold"
                  >
                    {isFunded ? 'Funded' : isPassed ? 'Passed' : isFailed ? 'Failed' : `Phase ${ch.phase || 1}`}
                  </Badge>
                </div>

                {/* Equity & PnL row */}
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-terminal-micro text-text-muted uppercase tracking-wider block font-medium">
                      Live Equity
                    </span>
                    <span className="text-lg font-bold terminal-num text-text">
                      {fmtUSD(equity)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-terminal-micro text-text-muted uppercase tracking-wider block font-medium">
                      Net Gain
                    </span>
                    <span className={cn("text-xs font-semibold terminal-num", netPnl >= 0 ? "text-profit" : "text-loss")}>
                      {netPnl >= 0 ? '+' : ''}{fmtUSD(netPnl)} ({netPnlPct >= 0 ? '+' : ''}{netPnlPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom footer: status / 1-click active state */}
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-2xs">
                <span className="text-text-muted flex items-center gap-1 font-mono">
                  Day {ch.trading_days || 1} • Start {fmtUSD(startBal)}
                </span>

                {isActive ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-accent">
                    <Radio className="w-2.5 h-2.5 animate-pulse text-accent" />
                    Active Account
                  </span>
                ) : (
                  <span className="text-text-muted hover:text-text font-medium flex items-center gap-0.5">
                    Switch <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
