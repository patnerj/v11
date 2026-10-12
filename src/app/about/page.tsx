'use client'

import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Building2, 
  ShieldCheck, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Zap, 
  Globe, 
  Coins, 
  ArrowRight,
  Terminal,
  Lock,
  Mail,
  CheckCircle2
} from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <MarketingHeader />

      <main className="relative pt-28 pb-24 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-[180px]" />
          <div className="absolute inset-0 bg-grid-overlay opacity-25" />
        </div>

        <div className="container max-w-7xl mx-auto px-4">
          
          {/* Hero Section */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-4 shadow-glow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Next-Gen Proprietary Trading Infrastructure</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tightest leading-[1.08] text-text">
              Empowering Traders With <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Institutional Capital</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              LaunchAPropFirm was established to solve the predatory practices plaguing retail prop firms. We back disciplined traders with transparent rules, real institutional liquidity, and zero drawdown gimmicks.
            </p>
          </div>

          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-20">
            <div className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/50 border border-border shadow-card backdrop-blur-md text-center flex flex-col justify-center overflow-hidden">
              <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 tracking-tight whitespace-nowrap mb-1">$50,000,000+</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider">Capital Allocation Pool</div>
              <div className="text-2xs text-text-muted mt-1">Institutional risk reserves</div>
            </div>
            <div className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/50 border border-border shadow-card backdrop-blur-md text-center flex flex-col justify-center overflow-hidden">
              <div className="text-2xl sm:text-3xl font-black text-teal-500 dark:text-teal-400 tracking-tight whitespace-nowrap mb-1">14ms</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider">Bridge Latency</div>
              <div className="text-2xs text-text-muted mt-1">Equinix LD4 direct fiber</div>
            </div>
            <div className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/50 border border-border shadow-card backdrop-blur-md text-center flex flex-col justify-center overflow-hidden">
              <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 tracking-tight whitespace-nowrap mb-1">100%</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider">Payout SLA Fulfillment</div>
              <div className="text-2xs text-text-muted mt-1">Guaranteed under 24 hours</div>
            </div>
            <div className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/50 border border-border shadow-card backdrop-blur-md text-center flex flex-col justify-center overflow-hidden">
              <div className="text-2xl sm:text-3xl font-black text-cyan-500 dark:text-cyan-400 tracking-tight whitespace-nowrap mb-1">120+</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider">Countries Supported</div>
              <div className="text-2xs text-text-muted mt-1">Worldwide trader network</div>
            </div>
          </div>

          {/* The LaunchAPropFirm Philosophy vs Traditional Prop Firms */}
          <div className="max-w-5xl mx-auto mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-text">The LaunchAPropFirm Advantage</h2>
              <p className="mt-2 text-text-muted text-sm">Why serious traders migrate from legacy prop firms to LaunchAPropFirm.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-7 rounded-3xl bg-surface/90 dark:bg-surface/40 border border-border shadow-card backdrop-blur-md space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-text">Static Drawdown Guarantee</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  We strictly reject trailing drawdown floor manipulation. When you make floating profits, your loss limit is NEVER dragged upwards to lock you into synthetic breaches.
                </p>
              </div>

              <div className="p-7 rounded-3xl bg-surface/90 dark:bg-surface/40 border border-border shadow-card backdrop-blur-md space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 dark:text-teal-400">
                  <Coins className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-text">Bi-Weekly 24h Payouts</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Withdraw your hard-earned profits every two weeks directly to your USDT TRC-20, ERC-20, or Bitcoin wallet with zero withdrawal fees, plus a 100% fee refund on your first payout.
                </p>
              </div>

              <div className="p-7 rounded-3xl bg-surface/90 dark:bg-surface/40 border border-border shadow-card backdrop-blur-md space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400">
                  <Terminal className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-text">MT5 &amp; WebTrader Freedom</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Trade using your favorite Expert Advisors (EAs), algorithmic bots, and macroeconomic news strategies on institutional Pepperstone feeds with 0.0 pip raw spreads.
                </p>
              </div>
            </div>
          </div>

          {/* Leadership & Platform Integrity */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-emerald-500/30 bg-surface/90 dark:bg-surface/50 backdrop-blur-xl p-8 sm:p-12 mb-20 shadow-card">
            <div className="grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Executive Governance &amp; Platform Integrity</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-text">
                  Led by Traders, Built for Performance
                </h2>
                <p className="text-sm sm:text-base text-text-muted leading-relaxed">
                  LaunchAPropFirm operates with strict fiduciary standards and institutional liquidity risk models. We treat our funded traders as long-term portfolio partners rather than statistics.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Transparent Capital Governance
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Direct Institutional Support Desk
                  </span>
                </div>
              </div>

              <div className="md:col-span-4 rounded-2xl bg-surface border border-emerald-500/30 dark:border-emerald-500/20 p-6 text-center space-y-4 shadow-card">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xl font-bold">
                  <ShieldCheck className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <div className="text-base font-bold text-text">LaunchAPropFirm Desk</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Institutional Trading Operations</div>
                  <div className="text-2xs font-mono text-text-muted mt-1 select-all">support@launchapropfirm.com</div>
                </div>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-xs"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Contact Operations Desk</span>
                </Link>
              </div>
            </div>
          </div>

          {/* CTA Card */}
          <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-surface/90 dark:bg-surface/40 p-8 sm:p-12 text-center backdrop-blur-md shadow-card">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text mb-4">
              Ready to Prove Your Trading Edge?
            </h2>
            <p className="text-sm sm:text-base text-text-muted max-w-xl mx-auto mb-8">
              Join thousands of qualified traders worldwide. Select your evaluation tier and start trading institutional capital today.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm">
                <Link href="/challenges" className="flex items-center gap-2">
                  <span>Explore Evaluation Models</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-6 rounded-xl border-border hover:border-emerald-500/40 text-text hover:text-emerald-500 text-sm font-semibold">
                <Link href="/contact">Contact Support Desk</Link>
              </Button>
            </div>
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
