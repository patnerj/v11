'use client'

import { motion } from 'framer-motion'
import { Users, DollarSign, Award, Clock } from 'lucide-react'
import { NumberTicker } from '@/components/ui/number-ticker'

/* Stats are zeroed by default — operators configure real numbers via the
   whitelabel admin panel or by editing these defaults after launch.
   Fabricated marketing stats ($48M, 12.4K etc.) have been removed. */
const STATS = [
  { icon: DollarSign, value: 0,    decimals: 0, suffix: '',   label: 'Profits paid out',       tone: 'text-success' },
  { icon: Users,      value: 0,    decimals: 0, suffix: '',   label: 'Funded traders',          tone: 'text-accent'  },
  { icon: Award,      value: 0,    decimals: 0, suffix: '%',  label: 'On-time payout rate',     tone: 'text-info'    },
  { icon: Clock,      value: 24,   decimals: 0, suffix: 'h',  label: 'Avg. payout processing',  tone: 'text-warn'    },
]

export function LiveStatsStrip() {
  /* Hide the strip entirely when no real stats have been configured yet.
     The 24h processing time is a static default, so we only check the
     operator-configurable values (paid out, funded traders, payout rate). */
  const hasRealStats = STATS.some((s) => s.label !== 'Avg. payout processing' && s.value > 0)
  if (!hasRealStats) return null

  return (
    <section className="relative py-12 border-y border-border-subtle bg-bg-subtle/40">
      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border-subtle">
          {STATS.map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="group px-6 py-4 lift rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-surface-muted flex items-center justify-center transition-colors group-hover:bg-accent/10">
                    <Icon className={`h-4 w-4 ${stat.tone}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tracking-tight tabular">
                      <NumberTicker value={stat.value} decimals={stat.decimals} />
                      <span className={stat.tone}>{stat.suffix}</span>
                    </div>
                    <div className="text-xs text-text-muted">{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
