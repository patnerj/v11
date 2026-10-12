'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useBranding } from '@/store/branding'
import { Button } from '@/components/ui/button'
import { 
  Terminal, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  BarChart3, 
  ChevronRight, 
  SlidersHorizontal, 
  Sparkles, 
  Coins, 
  Layers, 
  HelpCircle,
  Activity,
  Check
} from 'lucide-react'
import { cn } from '@/lib/cn'

const SYMBOLS = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', bid: '1.08452', ask: '1.08454', spread: '0.2', change: '+0.18%', up: true },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', bid: '2654.80', ask: '2654.95', spread: '0.15', change: '+0.64%', up: true },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', bid: '65420.00', ask: '65421.50', spread: '1.5', change: '+1.92%', up: true },
  { symbol: 'NAS100', name: 'US Tech 100 Cash', bid: '19842.20', ask: '19843.00', spread: '0.8', change: '-0.31%', up: false },
]

const MOCK_POSITIONS = [
  { id: '#89241', symbol: 'XAUUSD', type: 'BUY', lots: '2.50', openPrice: '2642.10', currentPrice: '2654.80', pnl: '+$3,175.00', profit: true },
  { id: '#89242', symbol: 'EURUSD', type: 'BUY', lots: '5.00', openPrice: '1.08120', currentPrice: '1.08452', pnl: '+$1,660.00', profit: true },
  { id: '#89243', symbol: 'BTCUSD', type: 'BUY', lots: '1.00', openPrice: '64200.00', currentPrice: '65420.00', pnl: '+$1,220.00', profit: true },
  { id: '#89244', symbol: 'NAS100', type: 'SELL', lots: '3.00', openPrice: '19890.00', currentPrice: '19842.20', pnl: '+$1,434.00', profit: true },
]

const COMPARISONS = [
  {
    feature: 'Maximum Drawdown Calculation',
    us: '100% Static Floor (Fixed to Initial Balance)',
    others: 'Trailing High-Water Mark (Floor moves up with floating profits)',
    better: true
  },
  {
    feature: 'Daily Drawdown Reset',
    us: 'Static Balance at 00:00 UTC (No intra-day peaks)',
    others: 'Floating Peak Trailing (Locks in open profit spikes)',
    better: true
  },
  {
    feature: 'Maximum Time Limits',
    us: 'Zero Limits (Trade at your own pace)',
    others: '30 to 60 Days (Forced high-risk overtrading)',
    better: true
  },
  {
    feature: 'Profit Split Potential',
    us: 'Up to 90% (80% default, escalates with milestones)',
    others: '70% - 80% (Capped with high withdrawal tiers)',
    better: true
  },
  {
    feature: 'Evaluation Fee Refund',
    us: '100% Refund with First Eligible Payout',
    others: 'Partial or Non-Refundable',
    better: true
  },
  {
    feature: 'Execution Spreads & Bridge',
    us: 'Raw Institutional 0.0 Pips • 14ms LD4 Direct',
    others: 'Retail Markups (1.5–3.0 pips with execution delay)',
    better: true
  },
  {
    feature: 'News Trading & Weekend Holding',
    us: 'Fully Permitted (No arbitrary bans)',
    others: 'Strict Gaps & News Restrictions',
    better: true
  }
]

const PLANS = [
  { size: '$10,000', target1: '$800 (8%)', target2: '$500 (5%)', maxDd: '$600 (6%)', maxDdPct: '6%', dailyDd: '$300 (3%)', dailyDdPct: '3%', price: '$89', popular: false },
  { size: '$25,000', target1: '$2,000 (8%)', target2: '$1,250 (5%)', maxDd: '$1,500 (6%)', maxDdPct: '6%', dailyDd: '$750 (3%)', dailyDdPct: '3%', price: '$189', popular: false },
  { size: '$50,000', target1: '$4,000 (8%)', target2: '$2,500 (5%)', maxDd: '$3,000 (6%)', maxDdPct: '6%', dailyDd: '$1,500 (3%)', dailyDdPct: '3%', price: '$299', popular: false },
  { size: '$100,000', target1: '$8,000 (8%)', target2: '$5,000 (5%)', maxDd: '$6,000 (6%)', maxDdPct: '6%', dailyDd: '$3,000 (3%)', dailyDdPct: '3%', price: '$499', popular: true },
  { size: '$200,000', target1: '$16,000 (8%)', target2: '$10,000 (5%)', maxDd: '$12,000 (6%)', maxDdPct: '6%', dailyDd: '$6,000 (3%)', dailyDdPct: '3%', price: '$949', popular: false },
]

export function TemplateTerminal() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const brandTagline = useBranding((s) => s.branding.brand_tagline) || 'Institutional High-Frequency Prop Trading'
  const [activeSymbol, setActiveSymbol] = useState(SYMBOLS[0])
  const [lotSize, setLotSize] = useState('1.00')

  return (
    <div className="w-full bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      
      {/* ── 1. Institutional Hero Section ────────────────────────────── */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-grid-overlay opacity-25 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[160px] pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-secondary/80 border border-emerald-500/30 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-6 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Institutional Pro Matrix • Equinix LD4 14ms Fiber</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tightest leading-[1.08] max-w-4xl mx-auto"
          >
            Trade With <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Institutional Power.</span>
            <br />
            Keep Up To <span className="underline decoration-emerald-500/50 underline-offset-8">90% Of The Profits.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-base sm:text-lg md:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed"
          >
            {brandName} empowers disciplined traders with up to $200,000 in funded capital.
            Raw 0.0 pip spreads, 100% static drawdown limits, and bi-weekly instant crypto disbursals.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Button asChild size="lg" className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/20 text-sm">
              <Link href="/challenges" className="flex items-center gap-2">
                <span>Start Evaluation</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-xl border-border hover:border-emerald-500/40 text-text hover:text-emerald-500 text-sm font-semibold">
              <Link href="/dashboard/trading">Open Live WebTrader</Link>
            </Button>
          </motion.div>

          {/* Quick Stats Bar */}
          <div className="mt-14 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-surface/80 border border-border/80 shadow-xs backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 terminal-num">$2,000,000</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider mt-0.5">Scaling Ceiling</div>
            </div>
            <div className="p-4 rounded-2xl bg-surface/80 border border-border/80 shadow-xs backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-teal-500 dark:text-teal-400 terminal-num">14ms</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider mt-0.5">Execution Bridge</div>
            </div>
            <div className="p-4 rounded-2xl bg-surface/80 border border-border/80 shadow-xs backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-cyan-500 dark:text-cyan-400 terminal-num">100%</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider mt-0.5">Static DD Floor</div>
            </div>
            <div className="p-4 rounded-2xl bg-surface/80 border border-border/80 shadow-xs backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 terminal-num">90%</div>
              <div className="text-xs font-semibold text-text uppercase tracking-wider mt-0.5">Profit Share</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Interactive Pro Terminal Preview Frame ────────────────── */}
      <section className="py-16 sm:py-24 bg-surface-secondary/40 border-b border-border/60">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold mb-3">
              <Terminal className="h-3.5 w-3.5" />
              <span>Pro Trader Workstation Preview</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-text">
              Real-Time Institutional Terminal
            </h2>
            <p className="mt-2 text-sm sm:text-base text-text-muted">
              Built for precision executions. Experience our zero-latency WebTrader terminal directly in your browser.
            </p>
          </div>

          {/* Terminal Mockup Window */}
          <div className="max-w-5xl mx-auto rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            {/* Terminal Title Bar */}
            <div className="px-4 py-3 bg-surface-secondary border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 font-bold text-text">{brandName} Institutional WebTrader v11.5</span>
              </div>
              <div className="flex items-center gap-4 text-text-muted text-2xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Pepperstone-Live (LD4)
                </span>
                <span>Latency: 14ms</span>
                <span className="font-bold text-emerald-500">Live Quoting</span>
              </div>
            </div>

            {/* Symbol Ticker Row */}
            <div className="px-4 py-2.5 bg-surface border-b border-border/80 flex items-center gap-2 overflow-x-auto">
              {SYMBOLS.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => setActiveSymbol(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-all shrink-0 cursor-pointer',
                    activeSymbol.symbol === s.symbol
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'bg-surface-secondary/60 hover:bg-surface-secondary text-text-muted border border-border/60'
                  )}
                >
                  <span>{s.symbol}</span>
                  <span className="terminal-num font-semibold">{s.bid}</span>
                  <span className={cn('text-2xs', s.up ? 'text-profit' : 'text-loss')}>{s.change}</span>
                </button>
              ))}
            </div>

            {/* Trading Desk Workspace Grid */}
            <div className="p-4 sm:p-6 grid lg:grid-cols-12 gap-6">
              {/* Left Order Ticket Panel (4 cols) */}
              <div className="lg:col-span-4 rounded-xl bg-surface-secondary/70 border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-text uppercase tracking-wider">Order Ticket</div>
                  <div className="text-2xs font-mono text-text-muted">Spread: {activeSymbol.spread} pts</div>
                </div>

                <div>
                  <div className="text-2xs font-medium text-text-muted mb-1">Volume (Lots)</div>
                  <div className="flex items-center gap-2">
                    {['0.50', '1.00', '2.50', '5.00'].map((l) => (
                      <button
                        key={l}
                        onClick={() => setLotSize(l)}
                        className={cn(
                          'flex-1 py-1 text-xs font-mono rounded border transition-all cursor-pointer',
                          lotSize === l 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold' 
                            : 'border-border text-text-muted hover:bg-surface'
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                    <div className="text-2xs font-bold text-red-500 uppercase">Sell by Market</div>
                    <div className="text-lg font-black terminal-num text-red-500 mt-0.5">{activeSymbol.bid}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <div className="text-2xs font-bold text-emerald-500 uppercase">Buy by Market</div>
                    <div className="text-lg font-black terminal-num text-emerald-500 mt-0.5">{activeSymbol.ask}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-2 text-2xs font-mono text-text-muted">
                  <div className="flex justify-between">
                    <span>Account Equity:</span>
                    <span className="font-bold text-text terminal-num">$107,489.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Static Max DD Floor:</span>
                    <span className="font-bold text-emerald-500 terminal-num">$90,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Buffer:</span>
                    <span className="font-bold text-text terminal-num">+$17,489.00</span>
                  </div>
                </div>
              </div>

              {/* Right Open Positions Stream (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Live Open Positions (4 Active)</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-profit flex items-center gap-1 terminal-num">
                    Total Floating PnL: +$7,489.00
                  </div>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-surface">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-surface-secondary text-2xs uppercase text-text-muted border-b border-border font-mono">
                        <tr>
                          <th className="py-2.5 px-3">Ticket</th>
                          <th className="py-2.5 px-3">Symbol</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Lots</th>
                          <th className="py-2.5 px-3">Open</th>
                          <th className="py-2.5 px-3">Current</th>
                          <th className="py-2.5 px-3 text-right">PnL (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono text-2xs">
                        {MOCK_POSITIONS.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-secondary/50 transition-colors">
                            <td className="py-2.5 px-3 text-text-muted">{p.id}</td>
                            <td className="py-2.5 px-3 font-bold text-text">{p.symbol}</td>
                            <td className="py-2.5 px-3">
                              <span className={cn('px-1.5 py-0.5 rounded text-3xs font-bold', p.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500')}>
                                {p.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 terminal-num">{p.lots}</td>
                            <td className="py-2.5 px-3 text-text-muted terminal-num">{p.openPrice}</td>
                            <td className="py-2.5 px-3 terminal-num">{p.currentPrice}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-profit terminal-num">{p.pnl}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-text-muted flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Real-time Sentinel is protecting these trades against trailing drawdown manipulation.</span>
                  </div>
                  <Link href="/challenges" className="text-emerald-500 font-bold hover:underline shrink-0 text-2xs">
                    Get Funded →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. High-Contrast Side-by-Side Comparison Matrix ──────────── */}
      <section className="py-16 sm:py-24 border-b border-border/60">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Full Fiduciary Transparency</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-text">
              Traditional Prop Firms vs {brandName}
            </h2>
            <p className="mt-3 text-base text-text-muted">
              Compare our rules directly against legacy industry prop firms. We eliminate trailing floor traps entirely.
            </p>
          </div>

          <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="grid grid-cols-12 bg-surface-secondary py-3.5 px-4 sm:px-6 border-b border-border text-xs font-bold uppercase tracking-wider text-text font-mono">
              <div className="col-span-5 sm:col-span-4">Evaluation Rule</div>
              <div className="col-span-4 sm:col-span-4 text-emerald-500 font-extrabold flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                {brandName}
              </div>
              <div className="col-span-3 sm:col-span-4 text-text-muted flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500/80" />
                Traditional Firms
              </div>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {COMPARISONS.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 py-4 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                  <div className="col-span-5 sm:col-span-4 font-semibold text-text pr-2">
                    {row.feature}
                  </div>
                  <div className="col-span-4 sm:col-span-4 text-emerald-600 dark:text-emerald-400 font-bold pr-2 flex items-start gap-1.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span>{row.us}</span>
                  </div>
                  <div className="col-span-3 sm:col-span-4 text-text-muted text-2xs sm:text-xs">
                    {row.others}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Challenge Plans & Pricing Tier Cards ──────────────────── */}
      <section id="pricing" className="scroll-mt-28 sm:scroll-mt-36 py-16 sm:py-24 bg-surface-secondary/40 border-b border-border/60">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-text">
              Select Your Funded Capital
            </h2>
            <p className="mt-2 text-sm sm:text-base text-text-muted">
              Choose your account size. 100% evaluation fee refunded on your first payout.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
            {PLANS.map((p) => (
              <div
                key={p.size}
                className={cn(
                  'rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 border',
                  p.popular
                    ? 'bg-surface border-emerald-500/50 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/20 relative'
                    : 'bg-surface/80 border-border hover:border-emerald-500/30'
                )}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-3xs uppercase tracking-wider shadow-sm">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="text-2xl font-black text-text terminal-num">{p.size}</div>
                  <div className="text-xs text-text-muted mt-0.5">Funded Account</div>

                  <div className="my-5 border-t border-border pt-4 space-y-2.5 text-2xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Phase 1 (8%):</span>
                      <span className="font-semibold text-text terminal-num">{p.target1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Phase 2 (5%):</span>
                      <span className="font-semibold text-text terminal-num">{p.target2}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Max DD ({p.maxDdPct || '6%'}):</span>
                      <span className="font-semibold text-emerald-500 terminal-num">{p.maxDd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Daily DD ({p.dailyDdPct || '3%'}):</span>
                      <span className="font-semibold text-text terminal-num">{p.dailyDd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Profit Split:</span>
                      <span className="font-bold text-profit">80% → 90%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="text-2xs text-text-muted">One-time fee:</span>
                    <span className="text-xl font-black text-text terminal-num">{p.price}</span>
                  </div>
                  <Button asChild className="w-full h-10 font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm">
                    <Link href={`/checkout?plan=${encodeURIComponent(p.size)}`}>
                      Get Account
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. High-Converting Final Call to Action ──────────────────── */}
      <section className="py-20 bg-gradient-to-b from-surface to-surface-secondary/70">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-text mb-4">
            Ready to Prove Your Edge with <span className="text-emerald-500">{brandName}</span>?
          </h2>
          <p className="text-base text-text-muted max-w-xl mx-auto mb-8">
            Join thousands of traders worldwide. Zero time pressure, guaranteed static drawdown floor, and bi-weekly payouts directly to your wallet.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm">
              <Link href="/challenges" className="flex items-center gap-2">
                <span>Start Your Evaluation</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-xl border-border hover:border-emerald-500/40 text-text hover:text-emerald-500 text-sm font-semibold">
              <Link href="/faq">Read Trading Rules</Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  )
}
