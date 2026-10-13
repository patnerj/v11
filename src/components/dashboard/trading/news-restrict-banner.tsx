'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface NewsRestrictBannerProps {
  plan?: any
  className?: string
}

interface EconomicEvent {
  id: string
  title: string
  currency: string
  impact: 'high' | 'critical'
  windowMinutes: number
  eventTimeUtc: number // timestamp
}

export function NewsRestrictBanner({ plan, className }: NewsRestrictBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return sessionStorage.getItem('fxsim_news_dismissed') === '1'
    } catch {
      return false
    }
  })
  const [now, setNow] = useState<number>(Date.now())

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem('fxsim_news_dismissed', '1')
    } catch {}
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Economic event scheduled window calculation (deterministic next high-impact release)
  const currentEvent = useMemo<EconomicEvent>(() => {
    // Cycles every 4 hours for dynamic realistic simulation
    const cycleMs = 4 * 60 * 60 * 1000
    const nextEventTs = Math.ceil(now / cycleMs) * cycleMs
    return {
      id: `event-${nextEventTs}`,
      title: 'US CPI & Fed Interest Rate Decision',
      currency: 'USD',
      impact: 'high',
      windowMinutes: 5,
      eventTimeUtc: nextEventTs,
    }
  }, [now])

  const diffSecs = Math.max(0, Math.floor((currentEvent.eventTimeUtc - now) / 1000))
  const minutes = Math.floor(diffSecs / 60)
  const seconds = diffSecs % 60

  const isRestrictedByPlan = plan ? (plan.custom_news_trading === 0 || plan.news_trading === 0) : true
  const isImminent = diffSecs <= 45 * 60 // Alert when within 45 minutes
  const showBanner = !dismissed && isImminent

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="news-restrict-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-surface to-surface p-3 text-xs shadow-sm select-none",
            className
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider text-terminal-micro">
                    ⚡ High-Impact News Window
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 terminal-num tabular-nums font-semibold text-terminal-micro border border-amber-500/35">
                    {currentEvent.currency} · In {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s
                  </span>
                </div>

                <p className="text-2xs text-text-muted mt-0.5 truncate">
                  <strong className="text-text font-semibold">{currentEvent.title}</strong>
                  {' — '}
                  {isRestrictedByPlan
                    ? 'Trading execution is restricted ±5m around release for this plan tier.'
                    : 'High market slippage expected. Trade with defensive stop loss risk.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors shrink-0 cursor-pointer active:scale-90"
              aria-label="Dismiss news alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
