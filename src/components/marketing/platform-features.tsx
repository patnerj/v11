'use client'

import { motion } from 'framer-motion'
import { 
  ShieldCheck, 
  Terminal, 
  Coins, 
  Swords, 
  Bot, 
  Sparkles, 
  TrendingUp, 
  Lock, 
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

export function PlatformFeatures({ puckProps }: { puckProps?: any }) {
  const rawTitle1 = puckProps?.titleText1
  const isDefault = !rawTitle1 || rawTitle1 === "Everything in"

  const titleText1 = isDefault ? "Engineered for" : rawTitle1
  const titleAccent = isDefault ? "Serious Trading" : (puckProps?.titleAccent || "Serious Trading")
  const description = (!puckProps?.description || puckProps.description.includes("A trading terminal, evaluation engine"))
    ? "A professional-grade prop trading ecosystem built with zero gimmicks, institutional execution, and complete trader protection."
    : puckProps.description

  return (
    <section className="py-14 sm:py-20 lg:py-28 relative overflow-hidden" id="features">
      {/* Background glow */}
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[160px] pointer-events-none" />

      <div className="container max-w-7xl mx-auto px-4 relative">
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-3 sm:mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Institutional Advantage</span>
          </div>

          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text">
            {titleText1}{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              {titleAccent}
            </span>
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg text-text-muted leading-relaxed">
            {description}
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* Bento Card 1: Static Drawdown Protection (Hero Bento Card - Span 8) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-8 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl bg-surface/50 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-300 shadow-card flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span className="text-2xs sm:text-2xs font-bold font-mono px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  CRITICAL ADVANTAGE
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-text tracking-tight mb-2">
                Static Drawdown (Zero Trailing Floor Traps)
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-text-muted leading-relaxed max-w-xl">
                Unlike predatory prop firms that drag your loss limit upwards during open floating profits—locking you into instant breach on natural market pullbacks—our evaluation relies strictly on a static balance floor. Your floating profits are always protected.
              </p>
            </div>

            {/* Visual Contrast Graphic */}
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1.5 sm:mb-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>LaunchAPropFirm Static Rules</span>
                </div>
                <div className="text-2xs sm:text-xs text-text-muted leading-relaxed">
                  Account $100,000 → Max DD Floor is fixed at $90,000. When your balance reaches $108,000, your floor stays at $90,000. You have an $18,000 safety cushion.
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 text-xs font-bold text-red-400 mb-1.5 sm:mb-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Traditional Trailing Traps</span>
                </div>
                <div className="text-2xs sm:text-xs text-text-muted leading-relaxed">
                  Floor trails high-water mark. When equity reaches $108,000, the floor moves to $98,000. A standard 1.5% pullback breaches the account unfairly.
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bento Card 2: MetaTrader 5 & WebTrader Parity (Span 4) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl bg-surface/50 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-300 shadow-card flex flex-col justify-between group"
          >
            <div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-4 sm:mb-6">
                <Terminal className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text tracking-tight mb-2">
                MT5 & WebTrader Parity
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Execute directly on our browser WebTrader with TradingView charting or connect your institutional MetaTrader 5 terminal with 14ms latency.
              </p>
            </div>

            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between font-mono">
              <span>Equinix LD4 Feed</span>
              <span className="text-emerald-400 font-bold">14ms SLA</span>
            </div>
          </motion.div>

          {/* Bento Card 3: Bi-Weekly Instant USDT Payouts (Span 4) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl bg-surface/50 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-300 shadow-card flex flex-col justify-between group"
          >
            <div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-4 sm:mb-6">
                <Coins className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text tracking-tight mb-2">
                Bi-Weekly Crypto Disbursals
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Direct to your USDT TRC-20, ERC-20, BTC wallet or Bank Wire. First payout after 14 days, then every two weeks like clockwork.
              </p>
            </div>

            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between font-mono">
              <span>Payout SLA</span>
              <span className="text-emerald-400 font-bold">&lt; 24 Hours</span>
            </div>
          </motion.div>

          {/* Bento Card 4: PvP Trading Arena & Tournaments (Span 4) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl bg-surface/50 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-300 shadow-card flex flex-col justify-between group"
          >
            <div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-4 sm:mb-6">
                <Swords className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text tracking-tight mb-2">
                PvP Arena & Tournaments
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Compete 1v1 against other traders or participate in monthly firm-wide tournaments to win free $100K evaluation accounts and prizes.
              </p>
            </div>

            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between font-mono">
              <span>Entry Fee</span>
              <span className="text-amber-400 font-bold">Free & Sponsored</span>
            </div>
          </motion.div>

          {/* Bento Card 5: AI Risk Copilot & Analytics (Span 4) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl bg-surface/50 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-300 shadow-card flex flex-col justify-between group"
          >
            <div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-4 sm:mb-6">
                <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text tracking-tight mb-2">
                AI Discipline & Risk Copilot
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Real-time drawdown danger alerts, lot size risk calculators, and automated discipline guidance directly inside your WebTrader terminal.
              </p>
            </div>

            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between font-mono">
              <span>Risk Management</span>
              <span className="text-cyan-400 font-bold">Automated Guardrails</span>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
