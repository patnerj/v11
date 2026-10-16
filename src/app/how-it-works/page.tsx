'use client'

import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Coins, 
  TrendingUp, 
  AlertTriangle, 
  HelpCircle, 
  Clock, 
  Layers, 
  Award 
} from 'lucide-react'
import { useBranding } from '@/store/branding'

export default function HowItWorksPage() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'Prop Firm'
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
          
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-4 shadow-glow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Institutional Evaluation Protocol</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tightest leading-[1.08] text-text">
              How {brandName} <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Evaluation Works</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              A straightforward, rule-first evaluation designed for disciplined traders. No synthetic traps, zero trailing drawdown manipulation, and complete payout guarantees.
            </p>
          </div>

          {/* 3 Step Roadmap Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            
            {/* Step 1 */}
            <div className="rounded-3xl border border-border bg-surface/90 dark:bg-surface/50 backdrop-blur-xl p-8 relative flex flex-col justify-between group hover:border-emerald-500/40 transition-all shadow-card">
              <div className="absolute -top-4 left-8 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs font-mono">
                STAGE 01
              </div>
              <div className="space-y-4 pt-2">
                <h3 className="text-2xl font-bold text-text">Phase 1: Student</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Demonstrate your risk management discipline by reaching an <strong>8% profit target</strong> while respecting daily and static maximum drawdown thresholds.
                </p>
                <div className="space-y-2 pt-2 text-xs font-mono text-text-muted">
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Profit Target:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">8%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Daily Drawdown:</span>
                    <span className="text-text font-bold">5% (UTC 00:00)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Max Static Drawdown:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">10% (Fixed Floor)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Time Limit:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">Unlimited Days</span>
                  </div>
                </div>
              </div>
              <div className="pt-6">
                <span className="text-xs text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Min 5 Trading Days
                </span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl border border-border bg-surface/90 dark:bg-surface/50 backdrop-blur-xl p-8 relative flex flex-col justify-between group hover:border-teal-500/40 transition-all shadow-card">
              <div className="absolute -top-4 left-8 px-3 py-1 rounded-full bg-teal-400 text-slate-950 font-black text-xs font-mono">
                STAGE 02
              </div>
              <div className="space-y-4 pt-2">
                <h3 className="text-2xl font-bold text-text">Phase 2: Practitioner</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Confirm your statistical edge with a lower <strong>5% profit target</strong>. Once met without breaches, your funded live contract is issued immediately.
                </p>
                <div className="space-y-2 pt-2 text-xs font-mono text-text-muted">
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Profit Target:</span>
                    <span className="text-teal-500 dark:text-teal-400 font-bold">5%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Daily Drawdown:</span>
                    <span className="text-text font-bold">5% (UTC 00:00)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Max Static Drawdown:</span>
                    <span className="text-teal-500 dark:text-teal-400 font-bold">10% (Fixed Floor)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Time Limit:</span>
                    <span className="text-teal-500 dark:text-teal-400 font-bold">Unlimited Days</span>
                  </div>
                </div>
              </div>
              <div className="pt-6">
                <span className="text-xs text-teal-500 dark:text-teal-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Automated Stage Transition
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl border border-emerald-500/40 bg-surface/90 dark:bg-surface/60 backdrop-blur-xl p-8 relative flex flex-col justify-between group shadow-card">
              <div className="absolute -top-4 left-8 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black text-xs font-mono">
                STAGE 03
              </div>
              <div className="space-y-4 pt-2">
                <h3 className="text-2xl font-bold text-text">Funded Trader Master</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Trade institutional capital. Keep <strong>up to 90% of your profits</strong>, withdraw bi-weekly, and receive a <strong>100% refund of your evaluation fee</strong>.
                </p>
                <div className="space-y-2 pt-2 text-xs font-mono text-text-muted">
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Profit Split:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">80% to 90%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>First Payout:</span>
                    <span className="text-text font-bold">After 14 Days</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span>Subsequent Cycle:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">Bi-Weekly (Every 14d)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Fee Refund:</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-bold">100% on 1st Payout</span>
                  </div>
                </div>
              </div>
              <div className="pt-6">
                <span className="text-xs text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Award className="h-4 w-4" /> Scale up to $2,000,000
                </span>
              </div>
            </div>

          </div>

          {/* Static vs Trailing Drawdown Deep-Dive */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-emerald-500/30 bg-surface/90 dark:bg-surface/40 p-8 sm:p-12 mb-20 backdrop-blur-md shadow-card">
            <div className="max-w-3xl mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>The Core Difference</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-text">
                Static Drawdown Floor Explained
              </h2>
              <p className="mt-2 text-sm sm:text-base text-text-muted leading-relaxed">
                Why does {brandName} enforce static drawdown? Because traditional prop firms use <em>trailing drawdown</em> to artificially breach profitable traders during natural market retracements.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div className="p-6 rounded-2xl bg-surface border border-emerald-500/30 space-y-3 shadow-card">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{brandName} Static Drawdown Rule</span>
                </div>
                <p className="text-xs text-text leading-relaxed">
                  On a <strong>$100,000</strong> account with a 10% maximum drawdown, your breach floor is fixed permanently at <strong>$90,000</strong>.
                </p>
                <p className="text-xs text-text-muted leading-relaxed">
                  If your account grows to <strong>$110,000</strong>, your floor <em>STILL remains at $90,000</em>. You have a full $20,000 cushion to navigate market volatility without worrying about synthetic failure.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface border border-red-500/30 space-y-3 shadow-card">
                <div className="font-bold text-red-500 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Traditional Trailing Floor Trap</span>
                </div>
                <p className="text-xs text-text leading-relaxed">
                  On competitor firms, if your equity touches <strong>$110,000</strong>, the drawdown floor is dragged up to <strong>$100,000</strong>.
                </p>
                <p className="text-xs text-text-muted leading-relaxed">
                  If your trade pulls back to $99,990, <em>YOU ARE BREACHED INSTANTLY</em>—even though your account was never below the initial starting capital! We consider this predatory and forbid it.
                </p>
              </div>
            </div>
          </div>

          {/* Strategy Freedom Matrix */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-border bg-surface/90 dark:bg-surface/40 p-8 sm:p-12 mb-20 backdrop-blur-md shadow-card">
            <h2 className="text-2xl sm:text-3xl font-bold text-text mb-6 text-center">
              Permitted Trading Strategies
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-surface-muted/60 dark:bg-surface/60 border border-border text-center shadow-xs">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> EAs &amp; Algos
                </div>
                <div className="text-2xs text-text-muted">All algorithmic trading and Expert Advisors permitted.</div>
              </div>
              <div className="p-5 rounded-2xl bg-surface-muted/60 dark:bg-surface/60 border border-border text-center shadow-xs">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> News Trading
                </div>
                <div className="text-2xs text-text-muted">Execute through NFP, FOMC, and CPI releases.</div>
              </div>
              <div className="p-5 rounded-2xl bg-surface-muted/60 dark:bg-surface/60 border border-border text-center shadow-xs">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Weekend Holding
                </div>
                <div className="text-2xs text-text-muted">Hold swing positions across market closures (select models).</div>
              </div>
              <div className="p-5 rounded-2xl bg-surface-muted/60 dark:bg-surface/60 border border-border text-center shadow-xs">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> No Time Limits
                </div>
                <div className="text-2xs text-text-muted">Zero calendar pressure. Trade at your natural pace.</div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text">
              Start Your Evaluation Today
            </h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">
              Select your preferred capital tier from $10,000 to $200,000 with institutional Pepperstone raw spreads.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm">
                <Link href="/challenges" className="flex items-center gap-2">
                  <span>View Capital Tiers &amp; Pricing</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-6 rounded-xl border-border hover:border-emerald-500/40 text-text hover:text-emerald-500 text-sm font-semibold">
                <Link href="/payouts">Review Payout Proofs</Link>
              </Button>
            </div>
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
