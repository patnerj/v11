'use client'

import Link from 'next/link'
import { useBranding } from '@/store/branding'
import { Logo } from '@/components/logo'
import { ShieldCheck, Lock, Terminal, BarChart3, Coins, ExternalLink } from 'lucide-react'

function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  )
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.96-4.52V8.04a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.96-.47z"/>
    </svg>
  )
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

const LINKS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: 'Trading Programs',
    items: [
      { href: '/challenges',        label: 'Evaluation Models' },
      { href: '/tournaments',       label: 'Trading Tournaments' },
      { href: '/how-it-works',      label: 'How It Works & Rules' },
      { href: '/payouts',           label: 'Payouts & Proof' },
      { href: '/leaderboard',       label: 'Trader Leaderboard' },
      { href: '/dashboard/trading', label: 'WebTrader Pro' },
    ],
  },
  {
    title: 'Platform & Support',
    items: [
      { href: '/about',       label: 'About LaunchAPropFirm' },
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
  const brand = useBranding((s) => s.branding.brand_name) || "LaunchAPropFirm"
  const footerText = useBranding((s) => s.branding.footer_text)
  const youtubeUrl = '#'
  const instagramUrl = 'https://www.instagram.com/yourswebsitemaker/'
  const tiktokUrl = '#'
  const facebookUrl = '#'
  const discordUrl = '#'
  const developerUrl = useBranding((s) => s.branding.developer_url) || ''

  return (
    <footer className="border-t border-border-subtle bg-surface/90 dark:bg-[#070C18]/90 relative overflow-hidden text-text transition-colors duration-200 pb-20 lg:pb-0">
      <div className="absolute inset-0 bg-grid-overlay opacity-20 pointer-events-none" />

      {/* Trust & Infrastructure Bar */}
      <div className="border-b border-border-subtle/80 bg-surface/30 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-6 text-xs text-text-muted">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-2xs uppercase tracking-wider font-bold text-emerald-400 font-mono">
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

      <div className="container max-w-7xl mx-auto px-4 py-10 sm:py-16">
        <div className="grid gap-8 sm:gap-12 lg:grid-cols-[1.3fr_2fr]">
          
          {/* Brand Info & Executive Channels */}
          <div className="space-y-4">
            <Logo />
            <p className="text-sm text-text-muted max-w-sm leading-relaxed">
              {brand} is an institutional proprietary trading firm. Pass our transparent evaluation, receive funded capital up to $2,000,000, and keep up to 90% of your generated profits.
            </p>
            
            <div className="flex items-center gap-2 pt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-xs text-text-muted font-mono">
                All Systems Operational · 14ms MT5 Server Ping
              </span>
            </div>

            {/* Direct Contact Pills */}
            <div className="pt-3 space-y-2 border-t border-border-subtle max-w-sm">
              <div className="text-2xs font-mono uppercase tracking-wider text-text-muted font-bold">
                Direct Support Desk:
              </div>
              <div className="flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex flex-wrap items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-emerald-500/20 gap-1">
                  <span className="text-emerald-500 dark:text-emerald-400 font-semibold shrink-0">24/7 Helpdesk:</span>
                  <a href="mailto:support@launchapropfirm.com" className="text-text hover:text-emerald-500 transition-colors truncate">
                    support@launchapropfirm.com
                  </a>
                </div>
              </div>
            </div>

            {/* Official Community & Social Media Channels */}
            <div className="pt-3 space-y-2 border-t border-border-subtle max-w-sm">
              <div className="text-2xs font-mono uppercase tracking-wider text-text-muted font-bold">
                Official Community & Channels:
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <a
                  href="#"
                  aria-label="YouTube Channel"
                  title="YouTube"
                  className="h-8 px-2.5 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border hover:border-red-500/50 hover:bg-red-500/10 text-text-muted hover:text-red-500 flex items-center gap-1.5 text-xs font-semibold transition-all group"
                >
                  <YouTubeIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
                  <span>YouTube</span>
                </a>
                <a
                  href="https://www.instagram.com/yourswebsitemaker/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram Profile"
                  title="Instagram"
                  className="h-8 px-2.5 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border hover:border-pink-500/50 hover:bg-pink-500/10 text-text-muted hover:text-pink-500 flex items-center gap-1.5 text-xs font-semibold transition-all group"
                >
                  <InstagramIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
                  <span>Instagram</span>
                </a>
                <a
                  href="#"
                  aria-label="TikTok Channel"
                  title="TikTok"
                  className="h-8 px-2.5 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border hover:border-cyan-500/50 hover:bg-cyan-500/10 text-text-muted hover:text-cyan-400 flex items-center gap-1.5 text-xs font-semibold transition-all group"
                >
                  <TikTokIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
                  <span>TikTok</span>
                </a>
                <a
                  href="#"
                  aria-label="Facebook Page"
                  title="Facebook"
                  className="h-8 px-2.5 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border hover:border-blue-500/50 hover:bg-blue-500/10 text-text-muted hover:text-blue-500 flex items-center gap-1.5 text-xs font-semibold transition-all group"
                >
                  <FacebookIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
                  <span>Facebook</span>
                </a>
                <a
                  href="#"
                  aria-label="Discord Server"
                  title="Discord"
                  className="h-8 px-2.5 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border hover:border-indigo-500/50 hover:bg-indigo-500/10 text-text-muted hover:text-indigo-400 flex items-center gap-1.5 text-xs font-semibold transition-all group"
                >
                  <DiscordIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
                  <span>Discord</span>
                </a>
              </div>
            </div>
          </div>

          {/* Links Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
            {LINKS.map((g) => (
              <div key={g.title}>
                <div className="text-xs font-bold uppercase tracking-wider text-text mb-3 sm:mb-4">
                  {g.title}
                </div>
                <ul className="space-y-2 sm:space-y-2.5">
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        prefetch={false}
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
        <div className="mt-12 pt-8 border-t border-border-subtle/80 space-y-4 text-2xs text-text-muted leading-relaxed">
          <p>
            <strong>Risk Disclaimer:</strong> Trading foreign exchange, CFDs, indices, commodities, and cryptocurrencies carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to participate in proprietary trading evaluations, you should carefully consider your trading objectives, level of experience, and risk appetite.
          </p>
          <p>
            All accounts provided to our clients are simulated evaluation environments with live quotation feeds. No actual live market funds are managed directly by retail participants during the evaluation phase until qualified for live institutional capital allocation.
          </p>
        </div>

        {/* Bottom copyright row */}
        <div className="mt-8 pt-6 border-t border-border-subtle/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-text-muted font-mono">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <p>
              {footerText || `© ${new Date().getFullYear()} ${brand}. All rights reserved.`}
            </p>
          </div>
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
