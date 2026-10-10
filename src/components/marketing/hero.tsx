'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Coins, 
  CheckCircle2, 
  TrendingUp, 
  Lock, 
  Activity,
} from 'lucide-react'
import dynamic from 'next/dynamic'
const LivePriceTicker = dynamic(
  () => import('./live-price-ticker').then((m) => m.LivePriceTicker),
  { ssr: false, loading: () => <div className="h-24 w-full skel rounded-xl" /> }
)
import { useBranding } from '@/store/branding'

export function Hero({ puckProps }: { puckProps?: { title?: string, highlight?: string, subtitle?: string, badge?: string } }) {
  const brandName = useBranding((s) => s.branding.brand_name) || "LaunchAPropFirm"
  
  const rawTitle = puckProps?.title
  const rawHighlight = puckProps?.highlight
  const isDefaultOrOld = !rawTitle || rawTitle === "Trade" || rawTitle === "Trade our capital" || rawTitle.trim() === ""

  const title = isDefaultOrOld ? "Funded by Professionals." : rawTitle
  const highlight = isDefaultOrOld ? "Built for Serious Traders." : (rawHighlight || "Built for Serious Traders.")
  const subtitle = (!puckProps?.subtitle || puckProps.subtitle.includes("Pass our two-phase evaluation, get funded with up to $200,000"))
    ? "Pass our low-target evaluation or trade directly with instant funding. Keep up to 90% of your profits with institutional Pepperstone spreads and bi-weekly crypto payouts."
    : puckProps.subtitle
  const badgeText = (!puckProps?.badge || puckProps.badge.includes("Now accepting traders worldwide") || puckProps.badge.includes("Scale up to $2,000,000"))
    ? "⚡ Institutional Funding • Scale to $2M"
    : puckProps.badge

  return (
    <section className="relative pt-20 pb-12 sm:pt-28 sm:pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
      {/* Dynamic atmospheric ambient glows */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-aurora opacity-70" />
        <div className="absolute inset-0 bg-grid-overlay opacity-40" />
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[140px]" />
      </div>

      <div className="container px-4 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center min-w-0 w-full">
          
          {/* Left Column: Hero Value Proposition */}
          <div className="lg:col-span-7 text-left space-y-4 sm:space-y-6 min-w-0">
            
            {/* Ambient Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 max-w-full"
            >
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-surface/80 border border-emerald-500/30 backdrop-blur-md shadow-glow-sm max-w-full">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-2xs sm:text-xs font-semibold tracking-wide text-emerald-400 truncate sm:whitespace-normal">
                  {badgeText}
                </span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tightest leading-[1.1] text-text"
            >
              {title}{' '}
              <span className="block mt-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                {highlight}
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="text-sm sm:text-lg md:text-xl text-text-muted max-w-2xl leading-relaxed"
            >
              {subtitle}
            </motion.p>

            {/* Institutional Pillars Pill Grid */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2 w-full min-w-0"
            >
              <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-surface/40 border border-border-subtle/80 backdrop-blur-sm min-w-0 overflow-hidden">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-2xs sm:text-xs font-semibold text-text truncate sm:whitespace-normal leading-tight">0.0 Pips Raw Spreads</div>
                  <div className="text-3xs sm:text-2xs text-text-muted truncate sm:whitespace-normal leading-tight mt-0.5">Pepperstone Tier-1 Feeds</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-surface/40 border border-border-subtle/80 backdrop-blur-sm min-w-0 overflow-hidden">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-2xs sm:text-xs font-semibold text-text truncate sm:whitespace-normal leading-tight">Bi-Weekly Payouts</div>
                  <div className="text-3xs sm:text-2xs text-text-muted truncate sm:whitespace-normal leading-tight mt-0.5">Direct USDT TRC-20 & Bank</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-surface/40 border border-border-subtle/80 backdrop-blur-sm min-w-0 overflow-hidden">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-2xs sm:text-xs font-semibold text-text truncate sm:whitespace-normal leading-tight">Automated Risk Engine</div>
                  <div className="text-3xs sm:text-2xs text-text-muted truncate sm:whitespace-normal leading-tight mt-0.5">Fair Trailing & Daily DD</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-surface/40 border border-border-subtle/80 backdrop-blur-sm min-w-0 overflow-hidden">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-2xs sm:text-xs font-semibold text-text truncate sm:whitespace-normal leading-tight">14ms Execution SLA</div>
                  <div className="text-3xs sm:text-2xs text-text-muted truncate sm:whitespace-normal leading-tight mt-0.5">WebTrader & MT5 Parity</div>
                </div>
              </div>
            </motion.div>

            {/* Action CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-4 items-stretch sm:items-center"
            >
              <Button 
                asChild 
                size="xl" 
                className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold shadow-glow hover:shadow-glow-success transition-all duration-300 group btn-shine rounded-xl"
              >
                <Link href="/challenges" prefetch={false} className="flex items-center justify-center gap-2">
                  <span>Start Challenge</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                asChild 
                size="xl" 
                variant="outline" 
                className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base bg-surface/50 hover:bg-surface-muted border-border hover:border-emerald-500/50 backdrop-blur-sm transition-all rounded-xl"
              >
                <Link href="/#challenges" prefetch={false}>View Challenge Models</Link>
              </Button>
            </motion.div>

            {/* Trust and Rating strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="pt-1 sm:pt-2 flex items-center gap-3 sm:gap-4 text-2xs sm:text-xs text-text-muted flex-wrap"
            >
              <div className="flex items-center text-amber-400">
                {"★★★★★"}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-text">4.9/5</span>
                <span>Trader Rating</span>
                <span className="text-border">·</span>
                <span className="text-emerald-400 font-medium">100% Payout SLA</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column: High-Impact Glassmorphic Terminal Card Showcase */}
          <div className="lg:col-span-5 relative min-w-0 w-full max-w-full overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto max-w-md lg:max-w-none"
            >
              {/* Outer Glow Ring */}
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-b from-emerald-500/20 to-teal-500/5 blur-xl pointer-events-none" />

              {/* Main Terminal Frame */}
              <div className="relative rounded-2xl border border-border bg-surface/95 dark:bg-background/95 backdrop-blur-2xl p-3 sm:p-5 shadow-2xl overflow-hidden transition-colors duration-200 min-w-0">
                
                {/* Window Traffic Lights & Status */}
                <div className="flex items-center justify-between pb-3 sm:pb-4 gap-2 border-b border-border-subtle/80">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-500/80 shrink-0" />
                    <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-500/80 shrink-0" />
                    <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500/80 shrink-0" />
                    <span className="text-2xs sm:text-2xs font-mono text-text-muted font-medium ml-1 sm:ml-2 truncate">
                      {brandName} Pro Terminal v11.5
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 text-3xs sm:text-2xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 sm:px-2 rounded-full border border-emerald-500/20 font-semibold shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    <span>Pepperstone Live</span>
                    <span className="hidden xs:inline">(14ms)</span>
                  </div>
                </div>

                {/* Trader Account Overview */}
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl bg-surface-secondary/70 dark:bg-surface/40 border border-border-subtle">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs mb-2">
                    <span className="text-text-muted font-medium text-2xs sm:text-xs">Funded Trader #61583264</span>
                    <Badge tone="accent" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-3xs sm:text-2xs py-0 px-2 font-semibold shrink-0">
                      🛡️ FUNDED ELITE
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-2xs sm:text-2xs text-text-muted">Account Equity</div>
                      <div className="text-xl sm:text-2xl font-bold font-mono text-text">$109,640.50</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xs sm:text-2xs text-text-muted">Floating Profit</div>
                      <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        +$9,640.50
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Market Feeds Mini-Table */}
                <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                  <div className="text-2xs font-bold uppercase tracking-wider text-text-muted px-1 flex justify-between">
                    <span>Institutional Raw Feeds</span>
                    <span>Spread</span>
                  </div>

                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg bg-surface-secondary/50 hover:bg-surface-secondary dark:bg-surface/30 dark:hover:bg-surface/50 border border-border-subtle/70 text-2xs sm:text-xs font-mono transition-colors">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-bold text-text">EURUSD</span>
                      <span className="text-3xs sm:text-2xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded font-semibold">+0.42%</span>
                    </div>
                    <div className="text-right flex items-center gap-2 sm:gap-3">
                      <span className="text-text font-semibold">1.08452</span>
                      <span className="text-3xs sm:text-2xs text-text-muted">0.1 pip</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg bg-surface-secondary/50 hover:bg-surface-secondary dark:bg-surface/30 dark:hover:bg-surface/50 border border-border-subtle/70 text-2xs sm:text-xs font-mono transition-colors">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-bold text-text">BTCUSD</span>
                      <span className="text-3xs sm:text-2xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded font-semibold">+2.85%</span>
                    </div>
                    <div className="text-right flex items-center gap-2 sm:gap-3">
                      <span className="text-text font-semibold">$84,920.00</span>
                      <span className="text-3xs sm:text-2xs text-text-muted">Raw</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg bg-surface-secondary/50 hover:bg-surface-secondary dark:bg-surface/30 dark:hover:bg-surface/50 border border-border-subtle/70 text-2xs sm:text-xs font-mono transition-colors">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-bold text-text">XAUUSD</span>
                      <span className="text-3xs sm:text-2xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded font-semibold">+1.18%</span>
                    </div>
                    <div className="text-right flex items-center gap-2 sm:gap-3">
                      <span className="text-text font-semibold">$2,654.80</span>
                      <span className="text-3xs sm:text-2xs text-text-muted">0.8 pip</span>
                    </div>
                  </div>
                </div>

                {/* Risk & Milestone Progress Gauges */}
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/60 grid grid-cols-2 gap-2 sm:gap-3 text-xs">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 min-w-0">
                    <div className="text-3xs sm:text-2xs text-text-muted truncate">Daily DD Buffer</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-2xs sm:text-xs mt-0.5 truncate">0.8% / 5.0% (Safe)</div>
                    <div className="w-full bg-border-subtle h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div className="bg-emerald-500 dark:bg-emerald-400 h-full w-[16%]" />
                    </div>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 min-w-0">
                    <div className="text-3xs sm:text-2xs text-text-muted truncate">Next Bi-Weekly Payout</div>
                    <div className="font-bold text-text text-2xs sm:text-xs mt-0.5 truncate">80% · $7,712.40</div>
                    <div className="w-full bg-border-subtle h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div className="bg-emerald-500 dark:bg-emerald-400 h-full w-[100%]" />
                    </div>
                  </div>
                </div>

                {/* Floating Verified Payout Ribbon */}
                <div className="mt-2.5 sm:mt-3 flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-surface-secondary/70 dark:bg-gradient-to-r dark:from-emerald-500/10 dark:to-teal-500/10 border border-emerald-500/30 text-2xs sm:text-2xs gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Instant USDT Payout Disbursal SLA</span>
                  </div>
                  <span className="font-mono text-text-muted shrink-0">⚡ &lt; 24h</span>
                </div>
              </div>
            </motion.div>
          </div>

        </div>

        {/* Live Market Price Ticker strip below fold */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32 }}
          className="mt-14 lg:mt-20"
        >
          <div className="rounded-2xl border border-border-subtle/80 bg-surface/40 backdrop-blur-md p-1 shadow-card overflow-hidden">
            <LivePriceTicker />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
