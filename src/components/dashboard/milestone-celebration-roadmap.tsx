'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Trophy, CheckCircle2, Circle, Target, Calendar,
  ShieldCheck, Sparkles, ArrowRight, Flame, Volume2, VolumeX
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtUSD, fmtPct, toNum } from '@/lib/format'
import type { ChallengeAccount, ChallengeMetrics } from '@/types/api'
import { playCelebrationVictorySound, playHapticFeedback } from '@/lib/sound'

interface Props {
  challenge?: ChallengeAccount | null
  metrics?: ChallengeMetrics | null
}

export function MilestoneCelebrationRoadmap({ challenge, metrics }: Props) {
  const [soundEnabled, setSoundEnabled] = useState(true)

  const isFunded = challenge?.status === 'funded'
  const isPassed = challenge?.status === 'passed' || isFunded
  const phase = challenge?.phase || metrics?.phase || 1
  const profitTargetPct = metrics?.profit_target_pct || 8
  const currentProfitPct = metrics?.current_profit_pct || 0
  const profitProgress = metrics?.profit_progress ?? Math.min(100, Math.max(0, (currentProfitPct / profitTargetPct) * 100))
  const isProfitTargetMet = profitProgress >= 100

  const daysCompleted = challenge?.trading_days || metrics?.trading_days_done || 0
  const minDaysRequired = metrics?.min_trading_days || (metrics?.plan?.p1_min_days) || 5
  const isDaysMet = daysCompleted >= minDaysRequired

  const ddProgress = metrics?.max_dd_progress || 0
  const isRiskClean = ddProgress < 80

  const fireMilestoneConfetti = () => {
    if (soundEnabled) {
      try {
        playCelebrationVictorySound()
        playHapticFeedback([200, 100, 200])
      } catch {}
    }

    const duration = 2500
    const end = Date.now() + duration
    const frame = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.7 },
        colors: ['#10B981', '#F59E0B', '#3B82F6', '#FFFFFF'],
        zIndex: 9999,
      })
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.7 },
        colors: ['#10B981', '#F59E0B', '#3B82F6', '#FFFFFF'],
        zIndex: 9999,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }

  const steps = [
    {
      id: 1,
      title: `Step 1: Profit Target (${profitTargetPct}%)`,
      desc: isProfitTargetMet
        ? `Target Hit: ${fmtPct(currentProfitPct, 1, true)} profit generated!`
        : `Progress: ${fmtPct(currentProfitPct, 1, true)} / ${fmtPct(profitTargetPct)} (${profitProgress.toFixed(0)}%)`,
      isDone: isProfitTargetMet,
      isCurrent: !isProfitTargetMet,
      icon: Target,
      badge: isProfitTargetMet ? 'Completed' : `${profitProgress.toFixed(0)}% Done`,
      tone: isProfitTargetMet ? 'success' : 'accent',
    },
    {
      id: 2,
      title: `Step 2: Minimum Trading Days (${minDaysRequired}d)`,
      desc: isDaysMet
        ? `Requirement met: ${daysCompleted} trading days completed.`
        : `${daysCompleted} of ${minDaysRequired} minimum trading days recorded.`,
      isDone: isDaysMet,
      isCurrent: isProfitTargetMet && !isDaysMet,
      icon: Calendar,
      badge: isDaysMet ? 'Completed' : `${daysCompleted}/${minDaysRequired} Days`,
      tone: isDaysMet ? 'success' : 'warn',
    },
    {
      id: 3,
      title: 'Step 3: Risk Compliance',
      desc: isRiskClean
        ? 'Drawdown strictly disciplined within risk rules.'
        : 'Approaching maximum drawdown safety limits.',
      isDone: isRiskClean && (isProfitTargetMet || isDaysMet),
      isCurrent: isProfitTargetMet && isDaysMet && !isPassed,
      icon: ShieldCheck,
      badge: isRiskClean ? 'Clean Risk' : 'Caution',
      tone: isRiskClean ? 'success' : 'danger',
    },
    {
      id: 4,
      title: isFunded ? 'Step 4: Funded Live Trader' : `Step 4: Phase ${phase + 1} / Funded`,
      desc: isFunded
        ? 'Fully funded account with up to 90% profit split!'
        : isPassed
        ? 'Phase passed! Ready for account upgrade.'
        : 'Final unlock upon completing evaluation criteria.',
      isDone: isFunded || isPassed,
      isCurrent: isProfitTargetMet && isDaysMet && isRiskClean,
      icon: Trophy,
      badge: isFunded ? 'Funded Live' : isPassed ? 'Pass Unlocked' : 'Upcoming',
      tone: isFunded ? 'success' : isPassed ? 'accent' : 'neutral',
    },
  ]

  return (
    <Card className="w-full border-border/80 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 bg-accent rounded-full inline-block" />
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Flame className="h-4 w-4 text-accent" />
                Challenge Milestone Journey &amp; Roadmap
              </CardTitle>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Visual roadmap to funded status. Complete all criteria to qualify for profit splits and account scale-ups.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-muted transition-colors text-xs flex items-center gap-1"
              title={soundEnabled ? 'Disable celebration sound' : 'Enable celebration sound'}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-accent" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={fireMilestoneConfetti}
              className="gap-1.5 text-xs h-8 border-accent/40 text-accent hover:bg-accent/10"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" /> Celebrate Milestones
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-6">
        {/* Roadmap Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
          {steps.map((s, idx) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={`relative rounded-xl p-4 border transition-all ${
                  s.isDone
                    ? 'border-profit/40 bg-profit/5 shadow-xs'
                    : s.isCurrent
                    ? 'border-accent/50 bg-accent/5 shadow-xs ring-1 ring-accent/30'
                    : 'border-border/60 bg-surface-muted/20 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      s.isDone
                        ? 'bg-profit/20 text-profit'
                        : s.isCurrent
                        ? 'bg-accent/20 text-accent'
                        : 'bg-surface-muted text-text-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge
                    tone={s.isDone ? 'success' : s.isCurrent ? 'accent' : 'neutral'}
                    size="sm"
                    className="font-mono text-3xs"
                  >
                    {s.badge}
                  </Badge>
                </div>

                <div className="font-bold text-xs text-text truncate">{s.title}</div>
                <div className="text-2xs text-text-muted mt-1 leading-relaxed line-clamp-2">{s.desc}</div>

                {/* Progress bar line for current step */}
                {s.isCurrent && (
                  <div className="mt-3 h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(10, profitProgress))}%` }}
                    />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
