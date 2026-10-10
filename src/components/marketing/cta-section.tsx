'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

export function CTASection({ puckProps }: { puckProps?: { title?: string, highlight?: string, description?: string } }) {
  const rawTitle = puckProps?.title
  const isDefault = !rawTitle || rawTitle === "Ready to trade"

  const title = isDefault ? "Ready to Trade Up to $2,000,000" : rawTitle
  const highlight = isDefault ? "in Institutional Capital?" : (puckProps?.highlight || "in Institutional Capital?")
  const description = (!puckProps?.description || puckProps.description.includes("Free account in 30 seconds"))
    ? "Select your challenge tier today. Pass our fair evaluation, receive funded credentials instantly, and withdraw up to 90% of your profits bi-weekly."
    : puckProps.description

  return (
    <section className="py-14 sm:py-20 lg:py-28 relative overflow-hidden">
      {/* Dynamic background atmospheric effects */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-grid-overlay opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/10 blur-[140px]" />
      </div>

      <div className="container max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-5xl mx-auto rounded-2xl sm:rounded-3xl border border-border-subtle/80 bg-surface/50 backdrop-blur-xl px-4 py-10 sm:px-12 sm:py-20 text-center overflow-hidden shadow-card-lg"
        >
          {/* Subtle light beams & top gradient highlight */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 beam-top" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-3/4 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          </div>

          <div className="relative max-w-3xl mx-auto space-y-4 sm:space-y-6">
            
            {/* Top pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-2xs sm:text-xs font-semibold text-emerald-400 shadow-glow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Join Over 2,400+ Funded Traders Worldwide</span>
            </div>

            {/* Headline */}
            <h2 className="text-2xl sm:text-5xl md:text-6xl font-black tracking-tightest leading-[1.12] sm:leading-[1.08] text-text">
              {title}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                {highlight}
              </span>
            </h2>

            {/* Subtitle */}
            <p className="text-sm sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              {description}
            </p>

            {/* CTAs */}
            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Button 
                asChild 
                size="xl" 
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 sm:py-6 px-6 sm:px-8 rounded-xl shadow-glow hover:shadow-glow-success transition-all duration-300 btn-shine"
              >
                <Link href="/challenges" className="flex items-center justify-center gap-2">
                  <span>Start Your Challenge Now</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button 
                asChild 
                size="xl" 
                variant="outline" 
                className="w-full sm:w-auto bg-surface/60 hover:bg-surface-muted border-border hover:border-emerald-500/40 backdrop-blur-sm py-4 sm:py-6 px-6 sm:px-8 rounded-xl transition-all"
              >
                <Link href="/#challenges">Explore Challenge Models</Link>
              </Button>
            </div>

            {/* Value Guarantees Strip */}
            <div className="pt-6 sm:pt-8 border-t border-border-subtle/80 flex flex-col xs:flex-row flex-wrap justify-center items-center gap-x-6 gap-y-2.5 text-xs text-text-muted font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>100% Fee Refund on 1st Payout</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Static Drawdown Protection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Instant Account Credentials</span>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  )
}
