'use client'

import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Coins, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ExternalLink,
  Lock,
  Wallet,
  Building2,
  TrendingUp,
  FileCheck
} from 'lucide-react'

const VERIFIED_PAYOUTS = [
  { trader: 'Trader #61583264', amount: '$9,640.50', rail: 'USDT TRC-20', tx: '0x8f4b...112e', time: '18 mins ago' },
  { trader: 'Trader #51920381', amount: '$14,250.00', rail: 'Bank Wire', tx: 'SEPA-88419', time: '42 mins ago' },
  { trader: 'Trader #44019283', amount: '$6,800.00', rail: 'USDT ERC-20', tx: '0x3a9f...9c41', time: '1 hour ago' },
  { trader: 'Trader #77192048', amount: '$22,500.00', rail: 'Bitcoin', tx: 'bc1q9...44a7', time: '2 hours ago' },
  { trader: 'Trader #33918274', amount: '$4,150.00', rail: 'USDT TRC-20', tx: '0x7e2a...55f8', time: '3 hours ago' },
  { trader: 'Trader #91028341', amount: '$8,920.00', rail: 'USDT TRC-20', tx: '0x1c4d...88b2', time: '4 hours ago' },
]

export default function PayoutsPage() {
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
              <span>Institutional Disbursal SLA &amp; Treasury Ledger</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tightest leading-[1.08] text-white">
              Bi-Weekly Payouts in <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Under 24 Hours</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Transparent, reliable withdrawals processed with zero fees. Request your profits every two weeks via Crypto or Bank Wire, with 100% of your evaluation fee refunded on your first reward.
            </p>
          </div>

          {/* SLA Highlights Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-16">
            <div className="p-6 rounded-2xl bg-surface/50 border border-border-subtle/80 backdrop-blur-md text-center">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono mb-1">&lt; 24h</div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider">Processing SLA</div>
              <div className="text-2xs text-slate-400 mt-1">Guaranteed execution</div>
            </div>
            <div className="p-6 rounded-2xl bg-surface/50 border border-border-subtle/80 backdrop-blur-md text-center">
              <div className="text-3xl sm:text-4xl font-black text-teal-400 font-mono mb-1">0%</div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider">Withdrawal Fee</div>
              <div className="text-2xs text-slate-400 mt-1">We absorb network costs</div>
            </div>
            <div className="p-6 rounded-2xl bg-surface/50 border border-border-subtle/80 backdrop-blur-md text-center">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono mb-1">100%</div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider">Evaluation Fee Refund</div>
              <div className="text-2xs text-slate-400 mt-1">Returned on 1st payout</div>
            </div>
            <div className="p-6 rounded-2xl bg-surface/50 border border-border-subtle/80 backdrop-blur-md text-center">
              <div className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono mb-1">Up to 90%</div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider">Trader Profit Split</div>
              <div className="text-2xs text-slate-400 mt-1">Progressive scaling</div>
            </div>
          </div>

          {/* Disbursal Methods Grid */}
          <div className="max-w-5xl mx-auto mb-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 text-center">
              Flexible Multi-Rail Disbursal Methods
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="p-6 rounded-3xl bg-surface/40 border border-emerald-500/20 backdrop-blur-md space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <Coins className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">USDT (TRC-20)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Near-instant blockchain confirmation with zero slippage. Ideal for international traders.
                </p>
                <div className="text-2xs font-mono text-emerald-400 font-bold">Average: 8 mins</div>
              </div>

              <div className="p-6 rounded-3xl bg-surface/40 border border-teal-500/20 backdrop-blur-md space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center text-teal-400">
                  <Coins className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">USDT (ERC-20)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ethereum network settlement for institutional custody and web3 wallets.
                </p>
                <div className="text-2xs font-mono text-teal-400 font-bold">Average: 15 mins</div>
              </div>

              <div className="p-6 rounded-3xl bg-surface/40 border border-amber-500/20 backdrop-blur-md space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">Bitcoin (BTC)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Direct on-chain Bitcoin disbursals sent straight to your personal cold or hardware wallet.
                </p>
                <div className="text-2xs font-mono text-amber-400 font-bold">Average: 25 mins</div>
              </div>

              <div className="p-6 rounded-3xl bg-surface/40 border border-cyan-500/20 backdrop-blur-md space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">Direct Bank Wire</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  SEPA, SWIFT, and Wise domestic payouts direct to your local bank account.
                </p>
                <div className="text-2xs font-mono text-cyan-400 font-bold">Average: 24 hours</div>
              </div>

            </div>
          </div>

          {/* Treasury Ledger Live Stream */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-emerald-500/30 bg-surface/50 backdrop-blur-xl p-8 sm:p-10 mb-20 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-border-subtle/80">
              <div>
                <div className="text-2xs uppercase tracking-wider font-bold text-emerald-400 font-mono mb-1">
                  Treasury Ledger Proof
                </div>
                <h2 className="text-2xl font-bold text-white">Verified Trader Disbursals</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">$4,250,000+</div>
                <div className="text-2xs text-slate-400">Total Capital Disbursed to Date</div>
              </div>
            </div>

            <div className="divide-y divide-border-subtle/50">
              {VERIFIED_PAYOUTS.map((p, idx) => (
                <div key={idx} className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="text-white font-bold">{p.trader}</div>
                      <div className="text-slate-400 text-2xs">{p.rail} · {p.tx}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-emerald-400 font-bold text-sm sm:text-base">{p.amount}</div>
                    <span className="text-slate-500 text-2xs">{p.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border-subtle/60 text-center">
              <span className="text-xs text-slate-400">
                All payouts are confirmed on-chain or via banking gateway settlement. Treasury inquiries: <a href="mailto:support@massfunded.org" className="text-emerald-400 hover:underline">support@massfunded.org</a>
              </span>
            </div>
          </div>

          {/* Payout FAQs Card */}
          <div className="max-w-4xl mx-auto rounded-3xl border border-border-subtle/80 bg-surface/40 p-8 sm:p-10 mb-20 backdrop-blur-md">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Frequently Asked Payout Questions</h2>
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-2xl bg-black/40 border border-border-subtle/60 space-y-1">
                <div className="font-bold text-emerald-400">When am I eligible for my first withdrawal?</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your first withdrawal can be requested 14 calendar days after your funded trading account is activated. Subsequent payouts can be requested every 14 days (bi-weekly).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-border-subtle/60 space-y-1">
                <div className="font-bold text-emerald-400">How does the 100% Evaluation Fee Refund work?</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When you successfully pass your evaluation and request your very first profit payout, the full initial purchase fee for that challenge is automatically refunded and credited directly to your payout amount.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-border-subtle/60 space-y-1">
                <div className="font-bold text-emerald-400">Are there any minimum withdrawal limits?</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The minimum withdrawal amount is $100 for crypto (USDT TRC-20 / ERC-20 / BTC) and $500 for direct international bank wire.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Action */}
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Ready to Join Our Funded Roster?
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Select your capital tier, trade with static drawdown protection, and withdraw your first profits in 14 days.
            </p>
            <Button asChild className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm">
              <Link href="/challenges" className="flex items-center gap-2">
                <span>Start Your Evaluation Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
