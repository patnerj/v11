'use client'

import { motion } from 'framer-motion'
import { Terminal, BarChart3, Clock, ShieldCheck, Award } from 'lucide-react'

/* Default platform highlights — authentic ecosystem capabilities that are true
   for all operators out of the box (no fabricated trader metrics or fake revenue).
   Operators can override these via the Puck page builder or by providing custom stats. */
const DEFAULT_HIGHLIGHTS = [
  { icon: Terminal,    title: 'MetaTrader 5', label: 'Institutional execution', tone: 'text-accent' },
  { icon: BarChart3,   title: 'TradingView',  label: 'Real-time charts & feeds', tone: 'text-info' },
  { icon: ShieldCheck, title: 'Raw Spreads',  label: 'From 0.0 pips spread', tone: 'text-success' },
  { icon: Clock,       title: '24h Payouts',  label: 'Bi-weekly crypto & bank', tone: 'text-warn' },
]

interface StatItem {
  label: string
  value: string
  subtext?: string
}

export function LiveStatsStrip({ puckProps }: { puckProps?: { items?: StatItem[] } }) {
  const customItems = puckProps?.items && puckProps.items.length > 0 ? puckProps.items : null

  return (
    <section className="relative py-10 border-y border-border-subtle bg-bg-subtle/40">
      <div className="container">
        {customItems ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border-subtle">
            {customItems.map((stat, i) => (
              <motion.div
                key={stat.label + i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="group px-6 py-4 lift rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-surface-muted flex items-center justify-center transition-colors group-hover:bg-accent/10">
                    <Award className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tracking-tight tabular">
                      {stat.value}
                    </div>
                    <div className="text-xs text-text-muted">{stat.label}</div>
                    {stat.subtext && <div className="text-[10px] text-text-faint">{stat.subtext}</div>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle">
            {DEFAULT_HIGHLIGHTS.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="group px-6 py-4 lift rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-surface-muted flex items-center justify-center transition-colors group-hover:bg-accent/10">
                      <Icon className={`h-4 w-4 ${item.tone}`} />
                    </div>
                    <div>
                      <div className="text-base sm:text-lg font-bold tracking-tight">
                        {item.title}
                      </div>
                      <div className="text-xs text-text-muted">{item.label}</div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
