'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Rocket, Trophy, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const DEFAULT_STEPS = [
  {
    n: '01',
    icon: Rocket,
    title: 'Select Your Capital Tier',
    body: 'Choose from $10,000 up to $200,000 account size. Clear evaluation targets (8% Phase 1, 5% Phase 2) with zero calendar time limits.',
    badges: ['Zero Time Pressure', 'Raw Pepperstone Spreads', '1:100 Leverage'],
  },
  {
    n: '02',
    icon: ShieldCheck,
    title: 'Trade With Your Edge',
    body: 'Execute on MetaTrader 5 or WebTrader. News trading, Expert Advisors (EAs), and weekend holding are fully supported with static drawdown protection.',
    badges: ['EAs & Algos Permitted', 'News Trading Allowed', 'Static Drawdown Floor'],
  },
  {
    n: '03',
    icon: Trophy,
    title: 'Keep Up To 90% & Scale',
    body: 'Receive funded credentials instantly. Withdraw your profits bi-weekly via USDT TRC-20 or Bank Wire with your 100% evaluation fee refunded on first reward.',
    badges: ['Up to 90% Profit Split', '100% Fee Refund Included', 'Bi-Weekly Disbursals'],
  },
]

export function HowItWorks({ puckProps }: { puckProps?: any }) {
  const rawBadge = puckProps?.badge
  const rawTitle1 = puckProps?.titleText1
  const rawAccent = puckProps?.titleAccent
  const isDefault = !rawBadge || rawBadge === "The process"

  const badge = isDefault ? "Evaluation Roadmap" : rawBadge
  const titleText1 = isDefault ? "Three simple steps to" : (rawTitle1 || "Three simple steps to")
  const titleAccent = isDefault ? "institutional capital" : (rawAccent || "institutional capital")
  const description = (!puckProps?.description || puckProps.description.includes("A clear, transparent evaluation"))
    ? "A transparent, rule-first evaluation designed for disciplined traders. No hidden traps, no synthetic delays."
    : puckProps.description
  const steps = (!puckProps?.steps || puckProps.steps.length === 0 || puckProps.steps[0]?.title === "Take the challenge")
    ? DEFAULT_STEPS
    : puckProps.steps

  return (
    <section className="relative py-14 sm:py-20 lg:py-28 overflow-hidden" id="how-it-works">
      {/* Subtle backdrop grid */}
      <div className="absolute inset-0 bg-grid-overlay opacity-20 pointer-events-none" />

      <div className="container max-w-7xl mx-auto px-4 relative">
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 mb-3 sm:mb-4"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{badge}</span>
            </div>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text"
          >
            {titleText1}{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              {titleAccent}
            </span>
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg text-text-muted leading-relaxed"
          >
            {description}
          </motion.p>
        </div>

        <div className="relative">
          {/* Connecting gradient line on desktop */}
          <div className="hidden lg:block absolute top-[56px] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/40 to-emerald-500/10 pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {steps.map((step: any, i: number) => {
              const Icon = step.icon || Rocket
              return (
                <motion.div
                  key={step.n || i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="relative group"
                >
                  <div className="relative h-full p-5 sm:p-7 rounded-2xl bg-surface/50 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-300 hover:shadow-card-lg overflow-hidden flex flex-col justify-between">
                    
                    {/* Background Step Number Watermark */}
                    <div className="absolute -top-3 -right-2 text-7xl sm:text-8xl font-black tracking-tighter select-none opacity-[0.04] text-emerald-400">
                      {step.n}
                    </div>

                    <div>
                      {/* Step Header with Icon Badge */}
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow-sm">
                          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <span className="text-2xs sm:text-xs font-mono font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-surface border border-border text-emerald-400">
                          STEP {step.n}
                        </span>
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-text mb-2 sm:mb-3">
                        {step.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-text-muted leading-relaxed mb-4 sm:mb-6">
                        {step.body}
                      </p>
                    </div>

                    {/* Step Feature Pills / Items */}
                    <div className="pt-4 border-t border-border-subtle/60">
                      <div className="flex flex-wrap gap-2">
                        {step.badges ? (
                          step.badges.map((badgeText: string, idx: number) => (
                            <span 
                              key={idx}
                              className="text-2xs font-medium px-2.5 py-1 rounded-md bg-surface/80 border border-border-subtle text-text-muted flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>{badgeText}</span>
                            </span>
                          ))
                        ) : step.items ? (
                          step.items.map((it: any, idx: number) => (
                            <span 
                              key={idx}
                              className="text-2xs font-medium px-2.5 py-1 rounded-md bg-surface/80 border border-border-subtle text-text-muted flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>{it.itemText || it}</span>
                            </span>
                          ))
                        ) : null}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
