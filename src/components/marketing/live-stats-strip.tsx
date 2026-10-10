'use client'

import { motion } from 'framer-motion'
import { Terminal, ShieldCheck, Clock, Award, Globe, Zap, CheckCircle2 } from 'lucide-react'

const DEFAULT_METRICS = [
  {
    icon: Award,
    value: '$4,250,000+',
    label: 'Capital Allocated',
    subtext: 'To qualified prop traders worldwide',
    tone: 'text-emerald-400',
    bgTone: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Zap,
    value: '14ms',
    label: 'Execution Latency',
    subtext: 'Equinix LD4 ultra-low latency bridging',
    tone: 'text-teal-400',
    bgTone: 'bg-teal-500/10 border-teal-500/20',
  },
  {
    icon: Clock,
    value: '100%',
    label: 'Payout Fulfillment SLA',
    subtext: 'Bi-weekly crypto & bank under 24 hours',
    tone: 'text-emerald-400',
    bgTone: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Globe,
    value: '120+',
    label: 'Active Countries',
    subtext: 'Global multi-currency community',
    tone: 'text-cyan-400',
    bgTone: 'bg-cyan-500/10 border-cyan-500/20',
  },
]

interface StatItem {
  label: string
  value: string
  subtext?: string
}

export function LiveStatsStrip({ puckProps }: { puckProps?: { items?: StatItem[] } }) {
  const customItems = puckProps?.items && puckProps.items.length > 0 ? puckProps.items : null

  return (
    <section className="relative py-8 sm:py-12 border-y border-border-subtle/80 bg-surface/20 backdrop-blur-md">
      <div className="container max-w-7xl mx-auto px-4">
        {customItems ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {customItems.map((stat, i) => (
              <motion.div
                key={stat.label + i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="group relative p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-surface/50 border border-border-subtle/70 hover:border-emerald-500/40 backdrop-blur-sm transition-all duration-300 hover:shadow-glow-sm"
              >
                <div className="flex flex-col xs:flex-row items-start gap-2.5 sm:gap-4">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Award className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl sm:text-2xl font-extrabold tracking-tight font-mono text-text">
                      {stat.value}
                    </div>
                    <div className="text-2xs sm:text-xs font-semibold text-text mt-0.5 truncate">{stat.label}</div>
                    {stat.subtext && <div className="text-2xs sm:text-2xs text-text-muted mt-0.5 sm:mt-1 leading-snug line-clamp-2 xs:line-clamp-none">{stat.subtext}</div>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {DEFAULT_METRICS.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-surface/40 hover:bg-surface/60 border border-border-subtle/80 hover:border-emerald-500/40 backdrop-blur-sm transition-all duration-300 hover:shadow-[0_4px_20px_rgba(16,185,129,0.08)]"
                >
                  <div className="flex flex-col xs:flex-row items-start gap-2.5 sm:gap-4">
                    <div className={`h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl ${item.bgTone} border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.tone}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-mono text-text">
                        {item.value}
                      </div>
                      <div className="text-2xs sm:text-xs font-bold text-text mt-0.5 truncate">{item.label}</div>
                      <div className="text-2xs sm:text-2xs text-text-muted mt-0.5 sm:mt-1 leading-snug line-clamp-2 xs:line-clamp-none">{item.subtext}</div>
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
