'use client'

import React, { useEffect, useState, memo, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { Trophy, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Flame, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtUSD, fmtPct, toNum } from '@/lib/format'
import type { ChallengeAccount, ChallengeMetrics } from '@/types/api'
import Link from 'next/link'
import { playCelebrationVictorySound, playHapticFeedback } from '@/lib/sound'

interface Props {
  challenge?: ChallengeAccount | null
  metrics?: ChallengeMetrics | null
  isOpen?: boolean
  onClose?: () => void
}

/**
 * Fires multi-stage celebratory confetti cannons across the screen.
 */
export function fireCelebrationConfetti() {
  const duration = 3500
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  const interval: any = setInterval(function () {
    const timeLeft = animationEnd - Date.now()
    if (timeLeft <= 0) {
      return clearInterval(interval)
    }

    const particleCount = 50 * (timeLeft / duration)
    // Left cannon
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#FFFFFF'],
    })
    // Right cannon
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#FFFFFF'],
    })
  }, 250)
}

export const PhasePassCelebrationModal = memo(function PhasePassCelebrationModal({
  challenge,
  metrics,
  isOpen: explicitIsOpen,
  onClose: explicitOnClose,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const isPassed = challenge?.status === 'passed' || challenge?.status === 'funded' || (metrics && (metrics.profit_progress >= 100 || metrics.status === 'passed' || metrics.status === 'funded'))
  const challengeId = challenge?.id || metrics?.challenge?.id || 0
  const phase = challenge?.phase || metrics?.phase || 1
  const planName = challenge?.plan_name || metrics?.plan?.name || `Phase ${phase} Evaluation`
  const accountSize = toNum(challenge?.account_size || metrics?.plan?.account_size || metrics?.starting_balance || 0)
  const currentProfit = toNum(metrics?.current_profit || (challenge ? toNum(challenge.current_balance) - toNum(challenge.starting_balance) : 0))
  const profitTargetVal = toNum(metrics?.profit_target_val || 0)

  // Auto-detect passed status on mount
  useEffect(() => {
    if (explicitIsOpen !== undefined) {
      if (explicitIsOpen) {
        fireCelebrationConfetti()
        playCelebrationVictorySound()
        playHapticFeedback([300, 100, 300, 100, 300])
      }
      return
    }

    if (isPassed && challengeId > 0) {
      const storageKey = `celebration_dismissed_${challengeId}`
      if (typeof window !== 'undefined' && !sessionStorage.getItem(storageKey)) {
        setIsOpen(true)
        fireCelebrationConfetti()
        playCelebrationVictorySound()
        playHapticFeedback([300, 100, 300, 100, 300])
      }
    }
  }, [isPassed, challengeId, explicitIsOpen])

  const handleClose = useCallback(() => {
    if (challengeId > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem(`celebration_dismissed_${challengeId}`, 'true')
    }
    setIsOpen(false)
    explicitOnClose?.()
  }, [challengeId, explicitOnClose])

  const activeOpen = explicitIsOpen !== undefined ? explicitIsOpen : isOpen

  if (!activeOpen) return null

  return (
    <Dialog open={activeOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg bg-background/95 border border-emerald-500/40 shadow-2xl backdrop-blur-2xl rounded-2xl p-5 sm:p-7 overflow-hidden z-50">
        {/* Radiant Background Glows */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-52 h-52 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 w-52 h-52 bg-amber-500/15 rounded-full blur-3xl animate-pulse" />

        <DialogHeader className="relative z-10 text-center pb-2">
          {/* Trophy Crest */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center mb-3">
            <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center">
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mx-auto mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Target Achieved &amp; Rule Verified</span>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black text-text tracking-tight">
            Congratulations, Trader! 🎉
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-text-muted mt-1 max-w-sm mx-auto">
            You have successfully passed <strong className="text-emerald-400">{planName}</strong> with 100% adherence to all drawdown and discipline rules.
          </DialogDescription>
        </DialogHeader>

        {/* Milestone Performance Highlights */}
        <div className="relative z-10 grid grid-cols-3 gap-2.5 my-3">
          <div className="p-3 rounded-xl bg-surface/70 border border-border/80 text-center space-y-1">
            <span className="text-2xs text-text-muted uppercase font-semibold block">Capital Size</span>
            <span className="text-sm sm:text-base font-bold tabular text-text block">
              {fmtUSD(accountSize, { decimals: 0 })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface/70 border border-border/80 text-center space-y-1">
            <span className="text-2xs text-text-muted uppercase font-semibold block">Profit Target</span>
            <span className="text-sm sm:text-base font-bold tabular text-emerald-400 block">
              {profitTargetVal > 0 ? fmtUSD(profitTargetVal, { decimals: 0 }) : fmtUSD(currentProfit, { decimals: 0, sign: true })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface/70 border border-border/80 text-center space-y-1">
            <span className="text-2xs text-text-muted uppercase font-semibold block">Discipline</span>
            <span className="text-sm sm:text-base font-bold tabular text-cyan-400 block flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-cyan-400" /> 100% Clean
            </span>
          </div>
        </div>

        {/* Next Steps Guidance Card */}
        <div className="relative z-10 p-3.5 rounded-xl bg-surface-muted/60 border border-border space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-text">
              {phase === 1 ? 'Phase 2 Next Steps:' : 'Funded Account Next Steps:'}
            </span>
          </div>
          <p className="text-2xs sm:text-xs text-text-muted leading-relaxed">
            {phase === 1
              ? 'Your evaluation account is now certified passed. Our automated stage engine will provision your Phase 2 credentials directly in your dashboard and MT5 bridge.'
              : 'You have cleared all evaluation phases! Please verify your KYC documentation in Profile Settings to receive your official Funded Account contract and profit split.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <Button
            asChild
            className="w-full sm:flex-1 h-10 font-bold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/30 gap-1.5"
            onClick={handleClose}
          >
            <Link href="/dashboard/trading">
              <span>Go to WebTrader</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto h-10 text-xs font-semibold"
          >
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
