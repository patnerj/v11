'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, Check, Coins, ShieldCheck, Clock, ExternalLink, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function PayoutsSection({ puckProps }: { puckProps?: any }) {
  const rawBadge = puckProps?.badge
  const isDefault = !rawBadge || rawBadge === "Payouts"

  const badge = isDefault ? "Disbursal SLA" : rawBadge
  const titleText1 = isDefault ? "Bi-Weekly Payouts in" : (puckProps?.titleText1 || "Bi-Weekly Payouts in")
  const titleAccent = isDefault ? "Under 24 Hours" : (puckProps?.titleAccent || "Under 24 Hours")
  const description = (!puckProps?.description || puckProps.description.includes("First payout 14 days after funding"))
    ? "Request your first withdrawal 14 days after receiving your funded account, and bi-weekly thereafter. Zero withdrawal fees, flexible crypto and wire rails, and a 100% evaluation fee refund on your first payout."
    : puckProps.description
  
  const items = puckProps?.items || [
    { itemText: 'Bi-weekly payout cycle — regular, predictable withdrawals' },
    { itemText: 'Crypto (USDT TRC-20, ERC-20, BTC) & Bank Wire supported' },
    { itemText: '100% Evaluation Fee Refund included with your very first payout' },
    { itemText: 'Profit split up to 90% with progressive scaling milestones' },
    { itemText: 'Guaranteed 24-hour processing SLA from request to blockchain confirmation' },
  ]

  return (
    <section className="py-20 lg:py-28 relative overflow-hidden" id="payouts">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 bg-aurora opacity-40 pointer-events-none" />

      <div className="container max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Payout Propositions & SLA Guarantee */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{badge}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text">
              {titleText1}{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {titleAccent}
              </span>
            </h2>

            <p className="text-base sm:text-lg text-text-muted leading-relaxed">
              {description}
            </p>

            <ul className="space-y-3.5 pt-2">
              {items.map((it: any, idx: number) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-text font-medium leading-snug">
                    {it.itemText || it}
                  </span>
                </li>
              ))}
            </ul>

            {/* SLA Badge */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-surface/60 border border-border-subtle flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-text truncate">24-Hour Payout SLA</div>
                  <div className="text-[11px] text-text-muted truncate">Guaranteed disbursal timeframe</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-surface/60 border border-border-subtle flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-text truncate">0% Withdrawal Fees</div>
                  <div className="text-[11px] text-text-muted truncate">We absorb transfer costs</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Live Payout Ledger Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative"
          >
            <PayoutLedgerVisual />
          </motion.div>

        </div>
      </div>
    </section>
  )
}

function PayoutLedgerVisual() {
  const verifiedPayouts = [
    { id: 'TX-94821', address: 'TLq8x...39Fk', method: 'USDT TRC-20', amount: '$8,450.00', time: '18m ago', account: '$100K Elite' },
    { id: 'TX-94820', address: 'GB82...4019', method: 'Wise Wire', amount: '$4,220.00', time: '1h ago', account: '$50K Tier' },
    { id: 'TX-94819', address: 'TZa71...11Mb', method: 'USDT TRC-20', amount: '$11,940.00', time: '2h ago', account: '$200K Master' },
    { id: 'TX-94818', address: 'bc1q9...8xkp', method: 'Bitcoin', amount: '$6,180.00', time: '3h ago', account: '$100K Elite' },
    { id: 'TX-94817', address: '0x3Fe...72B1', method: 'USDT ERC-20', amount: '$3,890.00', time: '5h ago', account: '$50K Tier' },
  ]

  return (
    <div className="relative rounded-3xl border border-border/80 bg-surface/60 backdrop-blur-xl overflow-hidden shadow-card-lg p-6 sm:p-7">
      <div className="absolute inset-0 bg-grid-overlay opacity-30 pointer-events-none" />

      {/* Header bar */}
      <div className="relative flex items-center justify-between pb-4 border-b border-border-subtle/80 mb-5">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Treasury Ledger
          </span>
          <h3 className="text-base font-bold text-text mt-1">Verified Trader Disbursals</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Automated Queue Active</span>
        </div>
      </div>

      {/* Total Historical Payouts Banner */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-surface/80 to-surface/40 border border-emerald-500/20 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-text-muted">Total Capital Disbursed to Date</div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-0.5">
            $4,250,000+
          </div>
        </div>
        <Badge tone="success" className="font-semibold text-xs py-1 px-3">
          <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
          100% Fulfillment
        </Badge>
      </div>

      {/* Verified Transactions Stream */}
      <div className="relative space-y-2.5">
        {verifiedPayouts.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-3 rounded-xl bg-surface/40 hover:bg-surface/70 border border-border-subtle/60 text-xs transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <div className="font-mono font-bold text-text flex items-center gap-1.5">
                  <span>{tx.amount}</span>
                  <span className="text-[10px] font-normal text-text-muted">({tx.account})</span>
                </div>
                <div className="text-[11px] text-text-muted font-mono">
                  {tx.method} · {tx.address}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <Check className="h-3 w-3" />
                <span>Paid</span>
              </span>
              <div className="text-[10px] text-text-muted mt-0.5">{tx.time}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="relative mt-5 pt-4 border-t border-border-subtle/80 flex items-center justify-between text-[11px] text-text-muted">
        <span>Crypto Rails: TRC-20, ERC-20, BTC</span>
        <span className="text-emerald-400 font-medium">Fee Refund on 1st Payout: 100%</span>
      </div>
    </div>
  )
}
