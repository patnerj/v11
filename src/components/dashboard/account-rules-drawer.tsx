'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, X, ShieldAlert, ShieldCheck, CheckCircle2, Clock,
  TrendingDown, TrendingUp, DollarSign, Calendar, Zap, AlertTriangle,
  Scale, Lock, Newspaper, HelpCircle, Layers
} from 'lucide-react'
import { fmtUSD, fmtPct, toNum } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { ChallengeAccount, ChallengeMetrics } from '@/types/api'

interface AccountRulesDrawerProps {
  isOpen: boolean
  onClose: () => void
  challenge: ChallengeAccount | null
  metrics?: ChallengeMetrics | null
}

export function AccountRulesDrawer({
  isOpen,
  onClose,
  challenge,
  metrics,
}: AccountRulesDrawerProps) {
  const startingBalance = toNum(
    metrics?.starting_balance ||
    challenge?.starting_balance ||
    100000
  )

  const dailyDdPct = toNum(metrics?.daily_dd_pct || (challenge as any)?.custom_daily_dd || 5)
  const dailyDdVal = startingBalance * (dailyDdPct / 100)

  const maxDdPct = toNum(metrics?.max_dd_pct || (challenge as any)?.custom_max_dd || 10)
  const maxDdVal = startingBalance * (maxDdPct / 100)

  const profitTargetPct = toNum(metrics?.profit_target_pct || 10)
  const profitTargetVal = startingBalance * (profitTargetPct / 100)

  const minDays = Number(metrics?.min_trading_days ?? (challenge as any)?.custom_min_days ?? 5)
  const tradingDays = Number(challenge?.trading_days || 0)

  const isTrailing = challenge?.drawdown_type === 'trailing' || challenge?.drawdown_type === 'eod_trailing'
  const newsTradingAllowed = (challenge as any)?.custom_news_trading !== 0
  const weekendHoldingAllowed = (challenge as any)?.custom_weekend_holding !== 0
  const isFunded = challenge?.status === 'funded'

  return (
    <AnimatePresence>
      {isOpen && challenge && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="w-screen max-w-md bg-surface border-l border-border shadow-2xl flex flex-col justify-between"
          >
            {/* Header */}
            <div className="p-6 border-b border-border bg-surface-muted/50 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">
                    Official Plan Specifications
                  </span>
                </div>
                <h2 className="text-lg font-bold text-text">
                  {challenge.plan_name || 'Standard Plan'} · {fmtUSD(startingBalance)}
                </h2>
                <div className="flex items-center gap-2 pt-1">
                  <Badge tone={isFunded ? 'success' : 'accent'} size="sm" className="font-semibold uppercase tracking-wider">
                    {isFunded ? 'Funded Stage' : `Phase ${challenge.phase || 1}`}
                  </Badge>
                  <span className="text-2xs text-text-muted font-mono">
                    Account ID #{challenge.id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface border border-transparent hover:border-border transition-colors cursor-pointer"
                aria-label="Close rules sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Rules Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Core Risk Limits Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-danger" />
                  Drawdown & Risk Safeguards
                </h3>

                <div className="grid gap-3">
                  {/* Daily Drawdown Rule */}
                  <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text">Daily Drawdown Limit</span>
                      <span className="font-mono font-bold text-danger">{dailyDdPct}% ({fmtUSD(dailyDdVal)})</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-relaxed">
                      Resets every day at 00:00 UTC server midnight based on midnight equity or balance baseline.
                    </p>
                  </div>

                  {/* Max Drawdown Rule */}
                  <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text">Max Total Drawdown</span>
                      <span className="font-mono font-bold text-danger">{maxDdPct}% ({fmtUSD(maxDdVal)})</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-relaxed">
                      {isTrailing
                        ? 'Trailing drawdown ratchets upward with equity high-water mark, locking in profits.'
                        : 'Static floor fixed below initial starting capital.'}
                    </p>
                  </div>

                  {/* Profit Target */}
                  {!isFunded && (
                    <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-text">Profit Target</span>
                        <span className="font-mono font-bold text-profit">{profitTargetPct}% ({fmtUSD(profitTargetVal)})</span>
                      </div>
                      <p className="text-2xs text-text-muted leading-relaxed">
                        Achieve target with closed & open trades to unlock advancement to next phase or funding.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution & Trading Constraints */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-accent" />
                  Trading Constraints & Permitted Styles
                </h3>

                <div className="space-y-2.5">
                  {/* Minimum Days */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs">
                    <span className="text-text font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-text-muted" /> Minimum Trading Days
                    </span>
                    <span className="font-mono font-semibold text-text">
                      {tradingDays} / {minDays} Days
                    </span>
                  </div>

                  {/* News Trading */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs">
                    <span className="text-text font-medium flex items-center gap-2">
                      <Newspaper className="w-4 h-4 text-text-muted" /> High-Impact News Trading
                    </span>
                    <Badge tone={newsTradingAllowed ? 'success' : 'warn'} size="sm">
                      {newsTradingAllowed ? 'Allowed' : 'Restricted (±5m)'}
                    </Badge>
                  </div>

                  {/* Weekend Holding */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs">
                    <span className="text-text font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-text-muted" /> Weekend Holding
                    </span>
                    <Badge tone={weekendHoldingAllowed ? 'success' : 'warn'} size="sm">
                      {weekendHoldingAllowed ? 'Permitted' : 'Close by Fri 21:00 UTC'}
                    </Badge>
                  </div>

                  {/* Leverage Caps */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs">
                    <span className="text-text font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-text-muted" /> Account Leverage
                    </span>
                    <span className="font-mono font-semibold text-accent">
                      1:100 FX · 1:30 Metals · 1:5 Crypto
                    </span>
                  </div>

                  {/* Expert Advisors (EAs) */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs">
                    <span className="text-text font-medium flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-text-muted" /> Expert Advisors (EAs)
                    </span>
                    <Badge tone="success" size="sm">Allowed (No Arbitrage)</Badge>
                  </div>
                </div>
              </div>

              {/* Payout & Scaling Note */}
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <CheckCircle2 className="w-4 h-4" />
                  Profit Split & Scaling
                </div>
                <p className="text-2xs text-text-muted leading-relaxed">
                  Traders keep up to 80% to 90% profit splits with scheduled bi-weekly disbursements. Every 10% gain over 4 months qualifies for a 25% account scaling boost.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-surface-muted/30 flex justify-end">
              <Button onClick={onClose} variant="primary" size="sm" className="w-full">
                Got It
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    )}
  </AnimatePresence>
)
}
