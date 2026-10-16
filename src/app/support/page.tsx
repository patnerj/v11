'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  Rocket, 
  CreditCard, 
  Wallet, 
  ShieldCheck, 
  BarChart3, 
  HelpCircle, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink,
  Terminal,
  LifeBuoy,
  Clock,
  Sparkles,
  ArrowRight,
  Headphones,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { useBranding } from '@/store/branding'
import Link from 'next/link'

const SUPPORT_TOPICS = [
  {
    icon: Rocket,
    title: 'Evaluation Models & Rules',
    desc: 'Understand Phase 1 (8%) and Phase 2 (5%) targets, zero-trailing drawdown rules, and minimum trading days.',
    href: '/how-it-works',
    badge: 'Guide'
  },
  {
    icon: Wallet,
    title: 'Payouts & Treasury Disbursals',
    desc: 'Bi-weekly payout schedules, USDT TRC-20 / ERC-20 / BTC guides, and 100% evaluation fee refunds.',
    href: '/payouts',
    badge: 'Finance'
  },
  {
    icon: BarChart3,
    title: 'Funded Capital Challenges',
    desc: 'Select from $10,000 to $200,000 challenge plans with scaling up to $2,000,000 institutional allocation.',
    href: '/challenges',
    badge: 'Plans'
  },
  {
    icon: HelpCircle,
    title: 'Frequently Asked Questions',
    desc: 'In-depth answers to 20+ trading rules, overnight/weekend holding, EAs, and prohibited strategies.',
    href: '/faq',
    badge: 'Knowledge'
  },
  {
    icon: Terminal,
    title: 'MT5 & Platform Status',
    desc: 'Check live Equinix LD4 server latency (14ms), WebTrader uptime, and live liquidity feeds.',
    href: '/status',
    badge: 'Live Status'
  },
  {
    icon: Headphones,
    title: 'Interactive Contact Desk',
    desc: 'Direct ticket routing for technical inquiries, account credential resets, and billing clearance.',
    href: '/contact',
    badge: 'Direct Desk'
  },
]

const QUICK_FIXES = [
  {
    q: 'How do I connect to MetaTrader 5 with my evaluation credentials?',
    a: 'Use server "Pepperstone-Demo" with your assigned MT5 Login ID and Master Password provided in your Trader Dashboard. Ensure "Algo Trading" is enabled in MT5 if executing via WebTrader reverse copier.'
  },
  {
    q: 'How does our evaluation calculate drawdown differently from other prop firms?',
    a: 'We use 100% Static Drawdown based on your initial starting balance. Unlike trailing drawdown traps that lock in daily peak equity, our drawdown floor never trails up behind you.'
  },
  {
    q: 'When do I receive my 100% evaluation fee refund?',
    a: 'Your evaluation fee is credited back in full alongside your very first bi-weekly profit withdrawal on your funded account.'
  },
  {
    q: 'How long does KYC document verification take?',
    a: 'Our automated tier-1 identity verification engine processes passport, ID card, and proof of address submissions in under 15 minutes.'
  }
]

export default function SupportPage() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'Prop Firm'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@example.com'
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEmail(text)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedEmail(null), 2500)
  }

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <MarketingHeader />

      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-teal-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="container max-w-6xl mx-auto px-4">
          
          {/* Top Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>{brandName} Client Helpdesk</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tightest leading-[1.08] mb-6 text-text">
              How Can Our <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Desk Assist You?</span>
            </h1>

            <p className="text-base md:text-lg text-text-muted leading-relaxed">
              Access round-the-clock trading desk assistance, evaluation walkthroughs, payout clearance, and technical escalations.
            </p>
          </div>

          {/* High-Impact Support Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            
            {/* Payouts & Institutional Desk */}
            <div className="p-8 rounded-3xl bg-surface border border-emerald-500/30 shadow-card relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="h-24 w-24 text-emerald-400" />
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                  Treasury & Institutional Desk
                </span>
                <span className="text-xs text-text-muted font-mono flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  SLA: &lt; 1 Hour
                </span>
              </div>

              <h2 className="text-2xl font-bold text-text mb-2">Payouts & Allocations</h2>
              <div className="text-xs font-mono text-emerald-500 dark:text-emerald-400/90 mb-4 font-semibold uppercase tracking-wider">
                Profit Splits, KYC & Institutional Accounts
              </div>

              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                Direct channel for bi-weekly profit split withdrawals, institutional scale-up requests ($100K–$2,000,000+), and identity verification.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button 
                  asChild 
                  size="md" 
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm"
                >
                  <a href={`mailto:${supportEmail}?subject=Payout%20Inquiry%20-%20${encodeURIComponent(brandName)}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    {supportEmail}
                  </a>
                </Button>

                <Button
                  size="md"
                  variant="outline"
                  onClick={() => copyToClipboard(supportEmail, 'Support email')}
                  className="border-border-subtle hover:border-emerald-400 text-text hover:text-emerald-500 px-4"
                  title="Copy email address"
                >
                  {copiedEmail === supportEmail ? (
                    <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="ml-2 text-xs">Copy</span>
                </Button>
              </div>
            </div>

            {/* 24/7 Technical Operations Desk */}
            <div className="p-8 rounded-3xl bg-surface border border-teal-500/30 shadow-card relative overflow-hidden group hover:border-teal-500/50 transition-all">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Headphones className="h-24 w-24 text-teal-400" />
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-teal-500 dark:text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30">
                  24/7 Operations Desk
                </span>
                <span className="text-xs text-text-muted font-mono flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" />
                  SLA: &lt; 15 Minutes
                </span>
              </div>

              <h2 className="text-2xl font-bold text-text mb-2">Technical Support Operations</h2>
              <div className="text-xs font-mono text-teal-500 dark:text-teal-400/90 mb-4 font-semibold uppercase tracking-wider">
                MT5 Tech, WebTrader & Rules Engine
              </div>

              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                24/7 technical assistance for MetaTrader 5 credentials, WebTrader order execution, automated challenge phase evaluations, and account sync.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button 
                  asChild 
                  size="md" 
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-bold text-sm shadow-glow-sm"
                >
                  <a href={`mailto:${supportEmail}?subject=Technical%20Inquiry%20-%20${encodeURIComponent(brandName)}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    {supportEmail}
                  </a>
                </Button>

                <Button
                  size="md"
                  variant="outline"
                  onClick={() => copyToClipboard(supportEmail, 'Support email')}
                  className="border-border-subtle hover:border-teal-400 text-text hover:text-teal-500 px-4"
                  title="Copy email address"
                >
                  {copiedEmail === supportEmail ? (
                    <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="ml-2 text-xs">Copy</span>
                </Button>
              </div>
            </div>

          </div>

          {/* Categorized Topic Hub Grid */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold text-text">
                  Browse by Department & Topic
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  Access self-service guides, evaluation rules, and operational hubs
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SUPPORT_TOPICS.map((t) => {
                const Icon = t.icon
                return (
                  <Link 
                    key={t.title} 
                    href={t.href}
                    className="group block p-6 rounded-2xl bg-surface/80 border border-border-subtle/80 hover:border-emerald-500/50 hover:bg-surface-secondary/40 transition-all duration-300 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-300 group-hover:scale-110 transition-all">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-2xs font-mono font-bold text-text-muted uppercase tracking-wider bg-surface-secondary px-2 py-0.5 rounded border border-border-subtle">
                        {t.badge}
                      </span>
                    </div>

                    <h4 className="font-bold text-text group-hover:text-emerald-500 dark:group-hover:text-emerald-300 text-base mb-2 transition-colors">
                      {t.title}
                    </h4>
                    <p className="text-xs text-text-muted leading-relaxed mb-4">
                      {t.desc}
                    </p>

                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                      <span>Explore section</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Quick FAQ / Common Fixes Accordion */}
          <div className="p-8 rounded-3xl bg-surface/90 border border-border-subtle mb-16">
            <div className="max-w-2xl mb-8">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-500 dark:text-emerald-400 font-bold">
                Instant Resolution
              </span>
              <h3 className="text-2xl font-extrabold text-text mt-1">
                Frequently Resolved Questions
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Common questions answered immediately without waiting for an email response.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {QUICK_FIXES.map((item, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-surface-secondary/60 border border-border-subtle/80">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-sm text-text mb-1.5">{item.q}</h5>
                      <p className="text-xs text-text-muted leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center pt-6 border-t border-border-subtle/80">
              <Link 
                href="/faq" 
                className="text-xs text-text-muted hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 font-semibold"
              >
                <span>Have more questions? View the complete 20+ question Knowledge Base</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Bottom Fast Action CTA */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-surface to-teal-500/10 border border-emerald-500/30 text-center max-w-4xl mx-auto">
            <h3 className="text-2xl font-extrabold text-text mb-2">
              Ready to Prove Your Trading Edge?
            </h3>
            <p className="text-sm text-text-muted max-w-xl mx-auto mb-6">
              Select an institutional evaluation model with static drawdown, zero trailing traps, and receive up to 90% profit split.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm btn-shine">
                <Link href="/challenges">
                  <span>Explore Evaluation Plans</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border-subtle hover:border-emerald-400 text-text hover:text-emerald-500">
                <Link href="/contact">
                  <span>Submit Support Ticket</span>
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
