'use client'

import Link from 'next/link'
import { useBranding } from '@/store/branding'
import { Logo } from '@/components/logo'
import { ShieldCheck, Lock, Terminal, BarChart3, Coins } from 'lucide-react'

const LINKS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: 'Trading Programs',
    items: [
      { href: '/challenges',        label: 'Evaluation Models' },
      { href: '/how-it-works',      label: 'How It Works & Rules' },
      { href: '/payouts',           label: 'Payouts & Proof' },
      { href: '/leaderboard',       label: 'Trader Leaderboard' },
      { href: '/dashboard/trading', label: 'WebTrader Pro' },
    ],
  },
  {
    title: 'Platform & Support',
    items: [
      { href: '/about',       label: 'About MassFunded' },
      { href: '/contact',     label: 'Contact Hub' },
      { href: '/support',     label: 'Support Desk 24/7' },
      { href: '/faq',         label: 'Knowledge Base & FAQ' },
      { href: '/status',      label: 'Infrastructure Status' },
    ],
  },
  {
    title: 'Regulatory & Legal',
    items: [
      { href: '/terms',       label: 'Terms of Service' },
      { href: '/privacy',     label: 'Privacy Policy' },
      { href: '/refund',      label: '100% Refund Policy' },
      { href: '/risk',        label: 'Risk Disclosure' },
      { href: '/cookies',     label: 'Cookie Policy' },
    ],
  },
]

export function MarketingFooter() {
  const brand = useBranding((s) => s.branding.brand_name) || "MassFunded"
  const footerText = useBranding((s) => s.branding.footer_text)

  return (
    <footer className="border-t border-border-subtle bg-surface/90 dark:bg-[#070C18]/90 relative overflow-hidden text-text transition-colors duration-200 pb-20 lg:pb-0">
      <div className="absolute inset-0 bg-grid-overlay opacity-20 pointer-events-none" />

      {/* Trust & Infrastructure Bar */}
      <div className="border-b border-border-subtle/80 bg-surface/30 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-6 text-xs text-text-muted">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 font-mono">
                Institutional Infrastructure
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>MetaTrader 5 Bridge</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-teal-400" />
                <span>TradingView Advanced Charts</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-400" />
                <span>USDT TRC-20 / ERC-20 / Wire</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>256-bit Encrypted Banking SLA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          
          {/* Brand Info & Executive Channels */}
          <div className="space-y-4">
            <Logo />
            <p className="text-sm text-text-muted max-w-sm leading-relaxed">
              {brand} is an institutional proprietary trading firm. Pass our transparent evaluation, receive funded capital up to $2,000,000, and keep up to 90% of your generated profits.
            </p>
            
            <div className="flex items-center gap-2 pt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-text-muted font-mono">
                All Systems Operational · 14ms MT5 Server Ping
              </span>
            </div>

            {/* Direct Contact Pills */}
            <div className="pt-3 space-y-2 border-t border-border-subtle max-w-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-bold">
                Direct Executive & Support Desks:
              </div>
              <div className="flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-amber-500/20">
                  <span className="text-amber-500 dark:text-amber-400 font-semibold">Executive (Owner):</span>
                  <a href="mailto:bahadur@massfunded.org" className="text-text hover:text-amber-500 transition-colors">
                    bahadur@massfunded.org
                  </a>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-emerald-500/20">
                  <span className="text-emerald-500 dark:text-emerald-400 font-semibold">24/7 Helpdesk:</span>
                  <a href="mailto:support@massfunded.org" className="text-text hover:text-emerald-500 transition-colors">
                    support@massfunded.org
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Links Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {LINKS.map((g) => (
              <div key={g.title}>
                <div className="text-xs font-bold uppercase tracking-wider text-text mb-4">
                  {g.title}
                </div>
                <ul className="space-y-2.5">
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className="text-xs text-text-muted hover:text-emerald-400 transition-colors"
                      >
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>

        {/* Legal Risk Disclosure */}
        <div className="mt-12 pt-8 border-t border-border-subtle/80 space-y-4 text-[11px] text-text-muted leading-relaxed">
          <p>
            <strong>Risk Disclaimer:</strong> Trading foreign exchange, CFDs, indices, commodities, and cryptocurrencies carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to participate in proprietary trading evaluations, you should carefully consider your trading objectives, level of experience, and risk appetite.
          </p>
          <p>
            All accounts provided to our clients are simulated evaluation environments with live quotation feeds. No actual live market funds are managed directly by retail participants during the evaluation phase until qualified for live institutional capital allocation.
          </p>
        </div>

        {/* Bottom copyright row */}
        <div className="mt-8 pt-6 border-t border-border-subtle/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-text-muted font-mono">
          <p>
            {footerText || `© ${new Date().getFullYear()} ${brand}. All rights reserved.`}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/refund" className="hover:text-emerald-400 transition-colors">Refunds</Link>
            <span>·</span>
            <Link href="/status" className="hover:text-emerald-400 transition-colors">Server Status</Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
