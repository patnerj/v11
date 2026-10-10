'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Button } from '@/components/ui/button'
import { useBranding } from '@/store/branding'
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
  Headphones,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'

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

export default function ContactPage() {
  const brand = useBranding((s) => s.branding.brand_name) || "LaunchAPropFirm"
  const youtubeUrl = useBranding((s) => s.branding.youtube_url) || 'https://www.youtube.com/@LaunchAPropFirm'
  const instagramUrl = useBranding((s) => s.branding.instagram_url) || 'https://www.instagram.com/launchapropfirm/'
  const tiktokUrl = useBranding((s) => s.branding.tiktok_url) || 'https://www.tiktok.com/@launchapropfirm.com'
  const facebookUrl = useBranding((s) => s.branding.facebook_url) || 'https://www.facebook.com/profile.php?id=61591803448831'
  const discordUrl = useBranding((s) => s.branding.discord_url) || 'https://discord.com/channels/1555893909496799312/1555893997103484969'
  const developerUrl = useBranding((s) => s.branding.developer_url) || ''

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
    if (formState.category === 'developer') {
      window.open(developerUrl, '_blank')
      toast.success('Opening Platform Architecture Portal (launchapropfirm.com)...')
      return
    }
    const targetEmail = formState.category === 'executive' || formState.category === 'vip' ? 'vip@launchapropfirm.com' : 'support@launchapropfirm.com'
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
              Connect With <span className="bg-gradient-to-r from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">LaunchAPropFirm</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              Direct communication lines to our 24/7 technical desk and executive management. Zero synthetic bots — talk directly to prop firm decision makers.
            </p>
          </div>

          {/* Primary 3 Executive, Support & Developer Channel Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
            
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

                <h3 className="text-2xl font-bold text-text mb-2">Managing Director & VIP Capital Desk</h3>
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
                      vip@launchapropfirm.com
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('vip@launchapropfirm.com', 'Executive Email')}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted border border-border shadow-xs hover:border-emerald-500/40 text-xs font-semibold text-text hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail === 'vip@launchapropfirm.com' ? (
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
                href="mailto:vip@launchapropfirm.com?subject=Executive%20Escalation%20Inquiry%20-%20LaunchAPropFirm"
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
                      support@launchapropfirm.com
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('support@launchapropfirm.com', 'Support Email')}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted border border-border shadow-xs hover:border-teal-500/40 text-xs font-semibold text-text hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail === 'support@launchapropfirm.com' ? (
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
                href="mailto:support@launchapropfirm.com?subject=Trader%20Support%20Request%20-%20LaunchAPropFirm"
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-glow-sm transition-all"
              >
                <span>Launch Direct Support Ticket</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>

            {/* Card 3: Institutional Trading Infrastructure & Liquidity Desk */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative rounded-3xl border border-blue-500/30 bg-surface/90 dark:bg-surface/50 backdrop-blur-xl p-8 shadow-card flex flex-col justify-between group hover:border-blue-500/60 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Technology &amp; Infrastructure</span>
                  </div>
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Institutional Tier-1
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-text mb-2">Institutional Trading Desk</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-6">
                  Direct MetaTrader 5 ultra-low latency execution gateway, deep institutional liquidity aggregation, real-time risk controls, and automated settlement infrastructure.
                </p>

                {/* Email Box */}
                <div className="p-4 rounded-2xl bg-surface-secondary/70 dark:bg-black/40 border border-blue-500/30 dark:border-blue-500/20 shadow-sm flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-sm sm:text-base font-bold text-text truncate select-all">
                      support@launchapropfirm.com
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('support@launchapropfirm.com', 'Institutional Desk Email')}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted border border-border shadow-xs hover:border-blue-500/40 text-xs font-semibold text-text hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail === 'support@launchapropfirm.com' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-600 dark:text-blue-400 font-bold">Copied</span>
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
                href="mailto:support@launchapropfirm.com?subject=Institutional%20Desk%20Inquiry%20-%20LaunchAPropFirm"
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-sm font-bold transition-all"
              >
                <span>Contact Institutional Desk</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>

          </div>

          {/* Official Community & Social Media Channels Section */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-text">Official Community &amp; Social Desks</h2>
              <p className="mt-2 text-text-muted text-xs sm:text-sm">
                Follow our official verified channels for trading announcements, podcasts, payout proofs, and community trading rooms.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* YouTube */}
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-surface/80 dark:bg-surface/40 border border-border hover:border-red-500/50 hover:bg-red-500/5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-3 group-hover:scale-110 transition-transform">
                    <YouTubeIcon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-bold text-text group-hover:text-red-500 transition-colors">YouTube</div>
                  <div className="text-2xs text-text-muted mt-1 leading-snug">Podcasts, trading guides &amp; masterclasses</div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-2xs font-mono text-red-500 font-semibold">
                  <span>@LaunchAPropFirm</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </a>

              {/* Instagram */}
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-surface/80 dark:bg-surface/40 border border-border hover:border-pink-500/50 hover:bg-pink-500/5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 mb-3 group-hover:scale-110 transition-transform">
                    <InstagramIcon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-bold text-text group-hover:text-pink-500 transition-colors">Instagram</div>
                  <div className="text-2xs text-text-muted mt-1 leading-snug">Payout certificates &amp; daily updates</div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-2xs font-mono text-pink-500 font-semibold">
                  <span>@launchapropfirmorg</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </a>

              {/* TikTok */}
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-surface/80 dark:bg-surface/40 border border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform">
                    <TikTokIcon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-bold text-text group-hover:text-cyan-400 transition-colors">TikTok</div>
                  <div className="text-2xs text-text-muted mt-1 leading-snug">Quick rules, strategies &amp; insights</div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-2xs font-mono text-cyan-400 font-semibold">
                  <span>@launchapropfirm.com</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </a>

              {/* Facebook */}
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-surface/80 dark:bg-surface/40 border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-3 group-hover:scale-110 transition-transform">
                    <FacebookIcon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-bold text-text group-hover:text-blue-500 transition-colors">Facebook</div>
                  <div className="text-2xs text-text-muted mt-1 leading-snug">Community hub &amp; announcements</div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-2xs font-mono text-blue-500 font-semibold">
                  <span>LaunchAPropFirm</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </a>

              {/* Discord */}
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-surface/80 dark:bg-surface/40 border border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
                    <DiscordIcon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-bold text-text group-hover:text-indigo-400 transition-colors">Discord</div>
                  <div className="text-2xs text-text-muted mt-1 leading-snug">24/7 live trading floor &amp; rooms</div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-2xs font-mono text-indigo-400 font-semibold">
                  <span>Join Server</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            </div>
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
                      <option value="support" className="bg-surface text-text">Client Support (support@launchapropfirm.com)</option>
                      <option value="payouts" className="bg-surface text-text">Payout Treasury (support@launchapropfirm.com)</option>
                      <option value="mt5" className="bg-surface text-text">MT5 Bridge &amp; Feeds (support@launchapropfirm.com)</option>
                      <option value="executive" className="bg-surface text-text">Executive Desk (vip@launchapropfirm.com)</option>
                      <option value="vip" className="bg-surface text-text">VIP Capital Allocation (vip@launchapropfirm.com)</option>
                      <option value="developer" className="bg-surface text-text">Platform Architecture / Developer (launchapropfirm.com)</option>
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
                  <span>Send Ticket to {formState.category === 'executive' || formState.category === 'vip' ? 'Executive Desk' : 'Support Desk'}</span>
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
