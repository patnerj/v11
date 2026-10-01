'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  LifeBuoy, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  Copy, 
  Check, 
  Send, 
  ArrowRight, 
  Terminal, 
  Building2,
  Lock,
  Headphones
} from 'lucide-react'
import { toast } from 'sonner'

export default function ContactPage() {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    category: 'support',
    orderRef: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEmail(text)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedEmail(null), 2500)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState.email || !formState.message) {
      toast.error('Please enter your email and message.')
      return
    }
    const targetEmail = formState.category === 'executive' ? 'bahadur@massfunded.org' : 'support@massfunded.org'
    const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(`[${formState.category.toUpperCase()}] Inquiry from ${formState.name || 'Trader'}`)}&body=${encodeURIComponent(
      `Name: ${formState.name}\nEmail: ${formState.email}\nOrder/Account Ref: ${formState.orderRef || 'N/A'}\n\nMessage:\n${formState.message}`
    )}`
    window.location.href = mailtoUrl
    setSubmitted(true)
    toast.success('Opening your email client to dispatch message...')
  }

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <MarketingHeader />

      <main className="relative pt-28 pb-24 overflow-hidden">
        {/* Background glow ambiance */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/5 blur-[160px]" />
          <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-[140px]" />
          <div className="absolute inset-0 bg-grid-overlay opacity-25" />
        </div>

        <div className="container max-w-7xl mx-auto px-4">
          
            {/* Section Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4 shadow-glow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Institutional Support & Direct Escalations</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tightest leading-[1.08] text-text">
              Connect With <span className="bg-gradient-to-r from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">MassFunded</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              Direct communication lines to our 24/7 technical desk and executive management. Zero synthetic bots — talk directly to prop firm decision makers.
            </p>
          </div>

          {/* Primary 2 Executive & Support Channel Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
            
            {/* Card 1: Executive Desk (Owner / Founder) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-3xl border border-emerald-500/30 bg-surface/90 dark:bg-surface/50 backdrop-blur-xl p-8 shadow-card flex flex-col justify-between group hover:border-emerald-500/60 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Executive Desk & VIP Allocations</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> SLA &lt; 2h
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-text mb-2">Bahadur — Managing Director</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-6">
                  Direct escalation channel to the platform owner. Reserved for institutional partnerships, large capital scaling requests ($100,000 to $2,000,000), and critical compliance reviews.
                </p>

                {/* Email Box */}
                <div className="p-4 rounded-2xl bg-surface-secondary/70 dark:bg-black/40 border border-emerald-500/30 dark:border-emerald-500/20 shadow-sm flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-sm sm:text-base font-bold text-text truncate select-all">
                      bahadur@massfunded.org
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('bahadur@massfunded.org', 'Executive Email')}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted border border-border shadow-xs hover:border-emerald-500/40 text-xs font-semibold text-text hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail === 'bahadur@massfunded.org' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <a
                href="mailto:bahadur@massfunded.org?subject=Executive%20Escalation%20Inquiry%20-%20MassFunded"
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-sm font-bold transition-all"
              >
                <span>Email Executive Desk Directly</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>

            {/* Card 2: 24/7 Client Support Helpdesk */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative rounded-3xl border border-teal-500/30 bg-surface/90 dark:bg-surface/50 backdrop-blur-xl p-8 shadow-card flex flex-col justify-between group hover:border-teal-500/60 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-xs font-bold text-teal-600 dark:text-teal-400">
                    <Headphones className="h-3.5 w-3.5" />
                    <span>24/7 Operations &amp; Trader Care</span>
                  </div>
                  <span className="text-xs font-mono text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> SLA &lt; 15m
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-text mb-2">Global Support Desk</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-6">
                  Round-the-clock technical support for live challenge credentials, MT5 bridge synchronization, KYC identity verification, and crypto/wire payout confirmations.
                </p>

                {/* Email Box */}
                <div className="p-4 rounded-2xl bg-surface-secondary/70 dark:bg-black/40 border border-teal-500/30 dark:border-teal-500/20 shadow-sm flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                      <LifeBuoy className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-sm sm:text-base font-bold text-text truncate select-all">
                      support@massfunded.org
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('support@massfunded.org', 'Support Email')}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted border border-border shadow-xs hover:border-teal-500/40 text-xs font-semibold text-text hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail === 'support@massfunded.org' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                        <span className="text-teal-600 dark:text-teal-400 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <a
                href="mailto:support@massfunded.org?subject=Trader%20Support%20Request%20-%20MassFunded"
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm transition-all"
              >
                <span>Launch Direct Support Ticket</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>

          </div>

          {/* Quick Inquiry Form & Verification Checklist Grid */}
          <div className="grid lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
            
            {/* Left: Quick Form (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl border border-border bg-surface/70 dark:bg-surface/40 shadow-card p-8 backdrop-blur-md">
              <h2 className="text-xl font-bold text-text mb-2">Send Direct Message</h2>
              <p className="text-xs text-text-muted mb-6">
                Fill out the form below to route your ticket immediately to the appropriate department.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:border-emerald-500 text-sm text-text placeholder:text-text-faint outline-none transition-colors shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">Account Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="trader@domain.com"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:border-emerald-500 text-sm text-text placeholder:text-text-faint outline-none transition-colors shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">Department Route</label>
                    <select
                      value={formState.category}
                      onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:border-emerald-500 text-sm text-text outline-none transition-colors shadow-xs"
                    >
                      <option value="support" className="bg-surface text-text">Client Support (support@massfunded.org)</option>
                      <option value="payouts" className="bg-surface text-text">Payout Treasury (support@massfunded.org)</option>
                      <option value="mt5" className="bg-surface text-text">MT5 Bridge &amp; Feeds (support@massfunded.org)</option>
                      <option value="executive" className="bg-surface text-text">Executive Desk (bahadur@massfunded.org)</option>
                      <option value="vip" className="bg-surface text-text">VIP Capital Allocation (bahadur@massfunded.org)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1.5">Challenge / Order # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. #CHAL-10492"
                      value={formState.orderRef}
                      onChange={(e) => setFormState({ ...formState, orderRef: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:border-emerald-500 text-sm text-text placeholder:text-text-faint outline-none transition-colors shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">Message / Case Details *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe your inquiry, MT5 account login, or transaction hash..."
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border focus:border-emerald-500 text-sm text-text placeholder:text-text-faint outline-none transition-colors leading-relaxed shadow-xs"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-glow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Ticket to {formState.category === 'executive' || formState.category === 'vip' ? 'Bahadur (Executive Desk)' : 'Support Desk'}</span>
                </Button>
              </form>
            </div>

            {/* Right: SLA & Guidance (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              
              <div className="rounded-3xl border border-border bg-surface/70 dark:bg-surface/40 shadow-card p-6 backdrop-blur-md">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-3">
                  <ShieldCheck className="h-4 w-4" />
                  <span>What to Include for 15-Minute Resolution</span>
                </div>
                <ul className="text-xs text-text-muted space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span>Your registered account email address.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span>Active MT5 account number or WebTrader Challenge ID.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span>For payout queries: your USDT TRC-20 wallet address and TxID.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-border bg-surface/70 dark:bg-surface/40 shadow-card p-6 backdrop-blur-md">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-sm mb-3">
                  <Terminal className="h-4 w-4" />
                  <span>Operational Status &amp; Bridge Infrastructure</span>
                </div>
                <div className="space-y-2 text-xs text-text-muted font-mono">
                  <div className="flex items-center justify-between">
                    <span>Equinix LD4 Server Bridge:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">14ms Online</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>MT5 Quotation Engine:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Raw Tier-1 Live</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Crypto Treasury Disbursal:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active (USDT/BTC)</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
