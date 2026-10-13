'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Users2, Copy, Check, DollarSign, TrendingUp, Wallet, ArrowUpRight, ExternalLink, Send, MessageCircle, Share2, Sparkles, QrCode, Zap, Percent, Download, Megaphone } from 'lucide-react'
import QRCode from 'qrcode'
import { api } from '@/lib/api'
import type { Commission, AffiliatePayout } from '@/types/api'
import { fmtUSD, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { AffiliateLeaderboard } from '@/components/affiliate-leaderboard'
import { Modal } from '@/components/ui/Modal'
import { useQuery } from '@tanstack/react-query'
import { useBranding } from '@/store/branding'

import { FONT_PRESETS, hexToRgb } from '@/lib/theme-accent'

const tone = (s: Commission['status']) =>
  s === 'paid' ? 'success' : s === 'reversed' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const payoutTone = (s: AffiliatePayout['status']) =>
  s === 'paid' ? 'success' : s === 'rejected' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const METHOD_LABEL: Record<string, string> = { usdt_trc20: 'USDT (TRC20)', usdt_bep20: 'USDT (BEP20)', wise: 'Wise' }

function downloadBanner(type: '16:9' | '1:1' | '9:16', code: string, refLink: string, brandName: string = 'LaunchAPropFirm') {
  if (typeof window === 'undefined') return
  const canvas = document.createElement('canvas')
  const width = type === '16:9' ? 1920 : 1080
  const height = type === '9:16' ? 1920 : 1080
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Dynamic Whitelabel Font Resolution
  const activeFontId = localStorage.getItem('fxsim:theme-font') || 'poppins'
  const activePreset = FONT_PRESETS.find((f) => f.id === activeFontId) || FONT_PRESETS[0]
  const brandFont = `"${activePreset.name}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

  // Dynamic Whitelabel Accent Resolution
  const activeAccent = localStorage.getItem('fxsim:theme-accent') || '#10B981'
  const { r, g, b } = hexToRgb(activeAccent)

  // Dark background gradient (Fixed: Valid hex colors, no invalid var(--background) syntax)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height)
  bgGrad.addColorStop(0, '#06080F')
  bgGrad.addColorStop(0.4, '#0B0F19')
  bgGrad.addColorStop(1, '#0F172A')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // Glowing radial aura
  const glowCenterY = type === '9:16' ? height * 0.4 : height * 0.45
  const glowGrad = ctx.createRadialGradient(width / 2, glowCenterY, 50, width / 2, glowCenterY, width * 0.6)
  glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.22)`)
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, width, height)

  // Outer border frame
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`
  ctx.lineWidth = 4
  ctx.strokeRect(36, 36, width - 72, height - 72)

  // Inner subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, width - 96, height - 96)

  ctx.textAlign = 'center'

  // Brand Name & Tagline
  const brandY = type === '9:16' ? 320 : type === '16:9' ? 220 : 250
  ctx.fillStyle = activeAccent
  ctx.font = `bold ${type === '9:16' ? '40px' : '36px'} ${brandFont}`
  ctx.fillText(`★ ${brandName.toUpperCase()} · OFFICIAL PARTNER`, width / 2, brandY)

  // Main Heading
  const headingY = type === '9:16' ? 520 : type === '16:9' ? 360 : 410
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 ${type === '9:16' ? '70px' : type === '16:9' ? '64px' : '60px'} ${brandFont}`
  ctx.fillText('TRADE CAPITAL UP TO $200,000', width / 2, headingY)

  // Subtitle / Features
  const subY = type === '9:16' ? 640 : type === '16:9' ? 450 : 510
  ctx.fillStyle = '#94A3B8'
  ctx.font = `500 ${type === '9:16' ? '36px' : type === '16:9' ? '30px' : '28px'} ${brandFont}`
  ctx.fillText('Keep up to 90% profit split • Instant Payouts • Low Spreads', width / 2, subY)

  // Referral Code Pill
  const pillW = type === '9:16' ? 700 : 620
  const pillH = type === '9:16' ? 220 : 130
  const pillX = (width - pillW) / 2
  const pillY = type === '9:16' ? 820 : type === '16:9' ? 560 : 630

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`
  ctx.strokeStyle = activeAccent
  ctx.lineWidth = 3
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(pillX, pillY, pillW, pillH, 20)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillRect(pillX, pillY, pillW, pillH)
    ctx.strokeRect(pillX, pillY, pillW, pillH)
  }

  // Pill Title
  ctx.fillStyle = activeAccent
  ctx.font = `bold ${type === '9:16' ? '28px' : '22px'} ${brandFont}`
  ctx.fillText('⚡ USE PARTNER CODE AT CHECKOUT', width / 2, pillY + (type === '9:16' ? 65 : 45))

  // Promo Code
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 ${type === '9:16' ? '62px' : '46px'} ${brandFont}`
  ctx.fillText((code || 'PARTNER').toUpperCase(), width / 2, pillY + (type === '9:16' ? 140 : 96))

  if (type === '9:16') {
    ctx.fillStyle = activeAccent
    ctx.font = `600 24px ${brandFont}`
    ctx.fillText('GET 25% DISCOUNT ON EVALUATION', width / 2, pillY + 185)
  }

  // Footer Link
  const footY = type === '9:16' ? 1650 : type === '16:9' ? 950 : 960
  ctx.fillStyle = '#64748B'
  ctx.font = `500 ${type === '9:16' ? '32px' : '24px'} ${brandFont}`
  ctx.fillText(refLink || 'launchapropfirm.com', width / 2, footY)

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${brandName.toLowerCase()}-banner-${type.replace(':', 'x')}-${code || 'partner'}.png`
  a.click()
  toast.success(`Marketing asset (${type}) downloaded!`)
}

export default function AffiliatePage() {
  const { data, refetch: load, isPending } = useQuery({
    queryKey: ['affiliateData'],
    queryFn: async () => {
      const r = await api.affiliateMe()
      if (!r.ok) return null
      
      let comms = null
      let payoutsList = null

      if (r.data.enrolled) {
        const [c, p] = await Promise.all([api.affiliateCommissions(), api.affiliatePayouts()])
        if (c.ok) comms = c.data
        if (p.ok) payoutsList = p.data
      }

      return { me: r.data, comms, payoutsList }
    }
  })

  const loading = isPending && !data

  const me = data?.me ?? null
  const commissions = data?.comms ?? null
  const payouts = data?.payoutsList ?? null

  const [enrolling, setEnrolling] = useState(false)
  const [copied, setCopied] = useState(false)
  const [method, setMethod] = useState<'usdt_trc20' | 'usdt_bep20' | 'wise'>('usdt_trc20')
  const [destination, setDestination] = useState('')
  const [savingMethod, setSavingMethod] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [isTiersModalOpen, setIsTiersModalOpen] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'

  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin)
    }
  }, [])

  const link = me?.code
    ? `${origin || (typeof window !== 'undefined' ? window.location.origin : '')}/register?ref=${me.code}`
    : ''

  useEffect(() => {
    if (link) {
      QRCode.toDataURL(link, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null))
    }
  }, [link])

  useEffect(() => {
    if (me) {
      if (me.payout_method) setMethod(me.payout_method as 'usdt_trc20' | 'usdt_bep20' | 'wise')
      if (me.payout_destination) setDestination(me.payout_destination)
    }
  }, [me?.payout_method, me?.payout_destination])

  const saveMethod = async () => {
    const dest = destination.trim()
    if (!dest) { toast.error('Enter your payout destination.'); return }
    if (method === 'usdt_trc20' && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(dest)) {
      toast.error('Invalid TRC20 address. Must start with T and be 34 characters.')
      return
    }
    if (method === 'usdt_bep20' && !/^0x[a-fA-F0-9]{40}$/.test(dest)) {
      toast.error('Invalid BEP20 address. Must be a valid 42-character 0x hex address.')
      return
    }
    if (method === 'wise' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) {
      toast.error('Invalid Wise email address.')
      return
    }
    setSavingMethod(true)
    const r = await api.affiliateSetPayout(method, dest)
    setSavingMethod(false)
    if (r.ok && r.data.success) { toast.success('Payout method saved.'); load() }
    else toast.error(r.ok ? (r.data.message || 'Could not save.') : r.error)
  }

  const minPayout = (typeof me?.min_payout === 'number' && me.min_payout > 0) ? me.min_payout : 100

  const requestPayout = async () => {
    if ((me?.available_balance ?? 0) < minPayout) {
      toast.error(`Minimum withdrawal amount is $${minPayout.toFixed(2)}. Your balance is $${(me?.available_balance ?? 0).toFixed(2)}.`)
      return
    }
    setRequesting(true)
    const r = await api.affiliateRequestPayout()
    setRequesting(false)
    if (r.ok && r.data.success) { toast.success(`Withdrawal requested${r.data.amount ? ` · ${fmtUSD(r.data.amount)}` : ''}.`); load() }
    else toast.error(r.ok ? (r.data.message || 'Could not request withdrawal.') : r.error)
  }

  const enroll = async () => {
    setEnrolling(true)
    const r = await api.affiliateEnroll()
    setEnrolling(false)
    if (r.ok && r.data.enrolled) { toast.success('You’re in! Here’s your referral link.'); load() }
    else toast.error('Could not enroll right now.')
  }

  const copy = () => {
    if (!link) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).catch(() => {})
      }
    } catch {}
    setCopied(true)
    toast.success('Referral link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !me) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>
  }

  if (!me.enrolled) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          variant="hero"
          title="Affiliate Program"
          description="Earn by referring traders to our prop firm."
          icon={Users2}
          badge={{ label: 'Partner Program', tone: 'accent' }}
        />

        <Card>
          <CardContent className="p-10 text-center">
            <div className="inline-flex h-12 w-12 rounded-xl bg-accent/10 text-accent items-center justify-center mb-4">
              <Users2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-text">Become an Affiliate</h2>
            <p className="text-sm text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
              Get a unique link, share it, and earn a commission on every challenge your referrals purchase.
            </p>
            <div className="mt-4 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-profit/10 border border-profit/25 text-profit text-xs font-semibold shadow-xs select-none">
                <Zap className="h-3.5 w-3.5 text-profit shrink-0" />
                <span>⚡ Payouts processed every Tuesday &amp; Friday via USDT TRC-20</span>
              </div>
            </div>
            <Button className="mt-6" onClick={enroll} disabled={enrolling}>
              {enrolling ? 'Setting up…' : 'Join the affiliate program'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = me.stats ?? {
    referrals: 0,
    conversions: 0,
    total: 0,
    unpaid: 0,
    paid: 0,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        variant="hero"
        title="Affiliate Dashboard"
        description={`Your current commission rate is ${me.rate_percent}% of each referred purchase.`}
        icon={Users2}
        badge={{ label: 'Partner Program', tone: 'accent' }}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-accent/20">
          <CardContent className="p-6">
            {(() => {
              const c = s.conversions;
              let currentTier = 'Bronze (10%)', nextTier = 'Silver (12%)', nextGoal = 10, progress = 0;
              let color = 'text-[#cd7f32]';
              
              if (c >= 100) {
                currentTier = 'Platinum (20%)'; nextTier = 'MAX Level Reached'; nextGoal = 100; progress = 100;
                color = 'text-text font-bold';
              } else if (c >= 50) {
                currentTier = 'Gold (15%)'; nextTier = 'Platinum (20%)'; nextGoal = 100; progress = 50 + ((c - 50) / 50) * 50;
                color = 'text-warn font-bold';
              } else if (c >= 10) {
                currentTier = 'Silver (12%)'; nextTier = 'Gold (15%)'; nextGoal = 50; progress = 20 + ((c - 10) / 40) * 80;
                color = 'text-text-muted font-bold';
              } else {
                progress = (c / 10) * 100;
              }

              return (
                <>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <div className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Current Tier</div>
                      <div className={`text-xl font-bold ${color}`}>
                        {currentTier}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsTiersModalOpen(true)}
                        className="h-6 px-1.5 text-2xs text-accent hover:text-accent-hover hover:bg-accent/10 mb-1 gap-1"
                      >
                        <Sparkles className="h-3 w-3" /> View All Tiers & Perks
                      </Button>
                      <div className="text-2xs text-text-muted">Next Tier: <span className="font-semibold text-text">{nextTier}</span></div>
                    </div>
                  </div>
                  
                  <div className="h-3 w-full bg-surface-muted rounded-full overflow-hidden border border-border-subtle relative">
                    <div 
                      className="h-full bg-accent transition-all duration-1000 ease-out relative rounded-full" 
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  
                  <div className="mt-3 text-xs text-text-muted text-center">
                    {c >= 100 ? (
                      <span className="text-success font-semibold">You have reached the maximum commission tier! Incredible work. 🏆</span>
                    ) : (
                      <><strong>{nextGoal - c}</strong> more sales to unlock {nextTier}!</>
                    )}
                  </div>
                </>
              )
            })()}
          </CardContent>
        </Card>

        <AffiliateLeaderboard />
      </div>

      <Card>
        <CardHeader><CardTitle>Your referral link</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 min-w-0">
            <input readOnly value={link} className="flex-1 min-w-0 h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm text-text font-mono truncate" />
            <Button
              variant="outline"
              onClick={copy}
              className={cn(
                "transition-all active:scale-95 font-semibold shrink-0 gap-1.5",
                copied && "bg-profit/20 text-profit border-profit/40 hover:bg-profit/25 shadow-xs"
              )}
            >
              {copied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
              {copied ? '✓ Copied!' : 'Copy'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsQrModalOpen(true)}
              className="gap-1.5 shrink-0 select-none cursor-pointer"
              title="Show scannable QR Code for in-person or mobile referral sharing"
            >
              <QrCode className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Show QR Code</span>
              <span className="sm:hidden">QR</span>
            </Button>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1.5 border-[#0088cc]/40 text-[#0088cc] hover:bg-[#0088cc]/10 hover:border-[#0088cc]"
              onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Trade up to $200K capital and keep up to 90% profits with ${brandName}! Use code ` + (me?.code || ''))}`, '_blank')}
            >
              <Send className="h-3.5 w-3.5" /> Share on Telegram
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1.5 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Trade up to $200K capital and keep up to 90% profits with ${brandName}! Use code ` + (me?.code || '') + ' 👉 ' + link)}`, '_blank')}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1.5 border-border text-text-muted hover:text-text hover:bg-surface-muted"
              onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Get funded up to $200,000 with ${brandName}! Use code ` + (me?.code || '') + ' for maximum discounts: ' + link)}`, '_blank')}
            >
              <Share2 className="h-3.5 w-3.5" /> Post on X / Twitter
            </Button>
          </div>
          <p className="text-2xs text-text-muted mt-2">Code: <span className="font-semibold text-text font-mono bg-surface-muted px-1.5 py-0.5 rounded border border-border-subtle">{me.code}</span></p>
        </CardContent>
      </Card>

      <StatGrid columns={5}>
        <StatCard label="Referrals" value={String(s.referrals)} icon={Users2} tone="accent" />
        <StatCard label="Conversions" value={String(s.conversions)} icon={TrendingUp} tone="info" />
        <StatCard 
          label="Conversion Rate" 
          value={s.referrals > 0 ? `${((s.conversions / s.referrals) * 100).toFixed(1)}%` : '0%'} 
          icon={Percent} 
          tone="accent" 
        />
        <StatCard label="Unpaid earnings" value={fmtUSD(s.unpaid)} icon={Wallet} tone="warn" />
        <StatCard label="Paid out" value={fmtUSD(s.paid)} icon={DollarSign} tone="success" />
      </StatGrid>

      {/* ── MARKETING ASSETS & PROMOTIONAL MEDIA KIT ────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" /> Official Marketing Media Kit
              </CardTitle>
              <p className="text-xs text-text-muted mt-0.5">
                High-conversion promotional assets, social media banners, and copy templates tailored with your unique referral code.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Link href="/dashboard/marketing">
                <Button variant="primary" size="sm" className="gap-1.5 text-xs h-8">
                  <Megaphone className="h-3.5 w-3.5" /> Open Full Studio
                </Button>
              </Link>
              <Badge tone="accent" size="sm">
                Ultra-HD Graphics
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* ── 1. 16:9 Landscape Banner ── */}
            <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-3.5 flex flex-col justify-between gap-4">
              <div>
                <div className="dark h-56 bg-[#070A12] rounded-lg border border-white/10 relative overflow-hidden group shadow-lg flex items-center justify-center p-3 select-none" data-theme="midnight-obsidian">
                  {/* Subtle Grid & Glow Background */}
                  <div className="absolute inset-0 bg-[radial-gradient(#10b98115_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Mini Mockup Canvas */}
                  <div className="w-full aspect-[16/9] rounded-lg border border-accent/50 bg-gradient-to-br from-[#06080F] via-[#0C1220] to-[#0A1628] p-3 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-accent/25 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-2xs font-extrabold text-accent tracking-wider flex items-center gap-1">
                        ★ {brandName.toUpperCase()}
                      </span>
                      <span className="bg-accent/25 text-accent text-3xs font-bold px-1.5 py-0.5 rounded-full border border-accent/40">
                        90% PROFIT SPLIT
                      </span>
                    </div>
                    <div className="text-center my-auto py-1 relative z-10">
                      <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        TRADE UP TO $200,000
                      </div>
                      <div className="text-3xs text-slate-300 font-medium mt-0.5">
                        Instant Disbursals · Lowest Spreads · Zero Time Limit
                      </div>
                    </div>
                    <div className="bg-accent/20 border border-accent/50 rounded-md px-2 py-1 flex items-center justify-between relative z-10">
                      <span className="text-3xs text-accent font-bold tracking-wider">AFFILIATE CODE:</span>
                      <span className="text-terminal-body font-mono font-black text-white tracking-widest">{me?.code || 'PARTNER'}</span>
                      <span className="text-3xs text-profit font-black bg-profit/20 px-1 py-0.2 rounded border border-profit/30">25% OFF</span>
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-4 text-center backdrop-blur-xs">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="w-full h-8 text-xs font-semibold gap-1.5 bg-accent hover:bg-accent-hover text-primary-foreground shadow-sm"
                      onClick={() => downloadBanner('16:9', me?.code || '', link || '', brandName)}
                    >
                      <Download className="h-3.5 w-3.5" /> Download 1920×1080
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-8 text-xs font-semibold gap-1.5 border-white/20 text-white hover:bg-white/10"
                      onClick={copy}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Partner Link
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text">16:9 Landscape Banner</h4>
                    <span className="text-2xs font-mono text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border-subtle">
                      1920 × 1080
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                    Optimized for Twitter/X headers, YouTube banners, and website reviews.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-7 text-xs gap-1.5 font-medium"
                  onClick={() => downloadBanner('16:9', me?.code || '', link || '', brandName)}
                >
                  <Download className="h-3.5 w-3.5 text-accent" /> Download PNG
                </Button>
              </div>
            </div>

            {/* ── 2. 1:1 Square Feed Post ── */}
            <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-3.5 flex flex-col justify-between gap-4">
              <div>
                <div className="dark h-56 bg-[#070A12] rounded-lg border border-white/10 relative overflow-hidden group shadow-lg flex items-center justify-center p-3 select-none" data-theme="midnight-obsidian">
                  {/* Subtle Grid & Glow Background */}
                  <div className="absolute inset-0 bg-[radial-gradient(#38bdf815_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-info/20 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Mini Mockup Canvas */}
                  <div className="h-full aspect-square max-h-52 rounded-lg border border-info/50 bg-gradient-to-tr from-[#06080F] via-[#0A1326] to-[#0D1B36] p-3 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-info/25 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-2xs font-extrabold text-info tracking-wider flex items-center gap-1">
                        ★ {brandName.toUpperCase()}
                      </span>
                      <span className="bg-info/25 text-info text-3xs font-bold px-1.5 py-0.5 rounded-full border border-info/40">
                        INSTANT PASS
                      </span>
                    </div>
                    <div className="text-center my-auto py-1 relative z-10">
                      <div className="text-3xs uppercase tracking-widest text-slate-300 font-bold">PROP FIRM CAPITAL</div>
                      <div className="text-lg font-black text-white tracking-tight leading-tight mt-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        KEEP 90% PROFITS
                      </div>
                      <div className="text-xs font-mono font-extrabold text-accent mt-0.5">$200K ACCOUNT</div>
                    </div>
                    <div className="bg-info/20 border border-info/50 rounded-md px-2 py-1 flex items-center justify-between relative z-10">
                      <span className="text-3xs text-info font-bold">CODE:</span>
                      <span className="text-terminal-body font-mono font-black text-white tracking-widest">{me?.code || 'PARTNER'}</span>
                      <span className="text-3xs text-profit font-black bg-profit/20 px-1 py-0.2 rounded border border-profit/30">25% OFF</span>
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-4 text-center backdrop-blur-xs">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="w-full h-8 text-xs font-semibold gap-1.5 bg-info hover:bg-info/90 text-white shadow-sm"
                      onClick={() => downloadBanner('1:1', me?.code || '', link || '', brandName)}
                    >
                      <Download className="h-3.5 w-3.5" /> Download 1080×1080
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-8 text-xs font-semibold gap-1.5 border-white/20 text-white hover:bg-white/10"
                      onClick={copy}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Partner Link
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text">1:1 Square Feed Post</h4>
                    <span className="text-2xs font-mono text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border-subtle">
                      1080 × 1080
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                    Designed for Instagram feed posts, Discord community sharing, and Telegram broadcasts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-7 text-xs gap-1.5 font-medium"
                  onClick={() => downloadBanner('1:1', me?.code || '', link || '', brandName)}
                >
                  <Download className="h-3.5 w-3.5 text-info" /> Download PNG
                </Button>
              </div>
            </div>

            {/* ── 3. 9:16 Vertical Story & Reel ── */}
            <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-3.5 flex flex-col justify-between gap-4">
              <div>
                <div className="dark h-56 bg-[#070A12] rounded-lg border border-white/10 relative overflow-hidden group shadow-lg flex items-center justify-center p-3 select-none" data-theme="midnight-obsidian">
                  {/* Subtle Grid & Glow Background */}
                  <div className="absolute inset-0 bg-[radial-gradient(#a855f715_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Mini Mockup Canvas */}
                  <div className="h-full aspect-[9/16] max-h-52 rounded-lg border border-purple-500/50 bg-gradient-to-b from-[#06080F] via-[#100C1F] to-[#1A1033] p-2.5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-20 h-20 bg-purple-500/25 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-terminal-micro font-extrabold text-purple-300 tracking-wider">
                        ★ {brandName.toUpperCase()}
                      </span>
                      <span className="bg-purple-500/25 text-purple-300 text-3xs font-bold px-1 py-0.2 rounded-full border border-purple-500/40">
                        VIP
                      </span>
                    </div>
                    <div className="text-center my-auto py-1 relative z-10">
                      <div className="text-3xs uppercase tracking-widest text-slate-300 font-bold">EVALUATION PASS</div>
                      <div className="text-sm font-black text-white tracking-tight leading-tight mt-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        GET FUNDED
                      </div>
                      <div className="text-lg font-mono font-black text-accent mt-0.5 leading-none">$200K</div>
                      <div className="text-3xs text-slate-300 mt-1">Keep 90% Profits</div>
                    </div>
                    <div className="bg-purple-500/20 border border-purple-500/50 rounded-md px-1.5 py-1 text-center relative z-10">
                      <div className="text-3xs text-purple-300 font-bold">PARTNER CODE:</div>
                      <div className="text-2xs font-mono font-black text-white tracking-widest">{me?.code || 'PARTNER'}</div>
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-4 text-center backdrop-blur-xs">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="w-full h-8 text-xs font-semibold gap-1.5 bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                      onClick={() => downloadBanner('9:16', me?.code || '', link || '', brandName)}
                    >
                      <Download className="h-3.5 w-3.5" /> Download 1080×1920
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-8 text-xs font-semibold gap-1.5 border-white/20 text-white hover:bg-white/10"
                      onClick={copy}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Partner Link
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text">9:16 Mobile Story & Reel</h4>
                    <span className="text-2xs font-mono text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border-subtle">
                      1080 × 1920
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                    Full-screen vertical story template for Instagram Stories, TikTok, and YouTube Shorts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-7 text-xs gap-1.5 font-medium"
                  onClick={() => downloadBanner('9:16', me?.code || '', link || '', brandName)}
                >
                  <Download className="h-3.5 w-3.5 text-purple-400" /> Download PNG
                </Button>
              </div>
            </div>

          </div>

          {/* ── Ready-to-Post Copy Templates ── */}
          <div className="pt-4 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-accent" /> Ready-to-Post Promotional Captions
              </span>
              <span className="text-2xs text-text-muted">1-Click Copy &amp; Share</span>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border-subtle bg-surface-muted/40 flex flex-col justify-between gap-2.5">
                <p className="text-xs text-text-muted leading-relaxed font-sans">
                  &ldquo;Looking for serious funding? Trade up to $200,000 in simulated capital with <span className="text-text font-semibold">{brandName}</span>. Keep up to 90% profit split, enjoy instant crypto payouts and zero time limits. Use my code <span className="font-mono text-accent font-bold">{me?.code || 'PARTNER'}</span> for 25% off! 🚀&rdquo;
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs self-start gap-1.5"
                  onClick={() => {
                    const text = `Looking for serious funding? Trade up to $200,000 with ${brandName}. Keep up to 90% profit split and instant crypto payouts. Use code ${me?.code || ''} for 25% off: ${link}`
                    navigator.clipboard.writeText(text)
                    toast.success('Social caption copied to clipboard!')
                  }}
                >
                  <Copy className="h-3 w-3" /> Copy Caption &amp; Link
                </Button>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface-muted/40 flex flex-col justify-between gap-2.5">
                <p className="text-xs text-text-muted leading-relaxed font-sans">
                  &ldquo;Stop risking personal savings. Pass the <span className="text-text font-semibold">{brandName}</span> evaluation and get access to up to $200K capital. Fast execution, institutional spreads, no hidden rules. Use partner code <span className="font-mono text-accent font-bold">{me?.code || 'PARTNER'}</span> at checkout: 📈&rdquo;
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs self-start gap-1.5"
                  onClick={() => {
                    const text = `Stop risking personal savings. Pass the ${brandName} evaluation and get access to up to $200K capital. Fast execution, institutional spreads. Use code ${me?.code || ''} for 25% off: ${link}`
                    navigator.clipboard.writeText(text)
                    toast.success('Social caption copied to clipboard!')
                  }}
                >
                  <Copy className="h-3 w-3" /> Copy Caption &amp; Link
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawals</CardTitle>
          <p className="text-2xs text-text-muted mt-1">Paid via crypto (USDT) or Wise. Set your destination, then request a withdrawal of your available balance.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Payout method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'usdt_trc20' | 'usdt_bep20' | 'wise')}
                className="w-full h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm text-text"
              >
                <option value="usdt_trc20">USDT — TRC20</option>
                <option value="usdt_bep20">USDT — BEP20</option>
                <option value="wise">Wise</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-2xs text-text-muted uppercase tracking-wider font-semibold">{method === 'wise' ? 'Wise email' : 'Wallet address'}</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={method === 'wise' ? 'you@example.com' : method === 'usdt_trc20' ? 'T…' : '0x…'}
                className="w-full h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm text-text"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div>
                <span className="text-text-muted">Available to withdraw: </span>
                <span className="font-semibold terminal-num text-profit">{fmtUSD(me.available_balance ?? 0)}</span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-2xs text-text-muted font-mono">
                  <span>Minimum Payout Floor (${minPayout.toFixed(2)})</span>
                  <span className={cn("terminal-num font-semibold", ((me.available_balance ?? 0) >= minPayout) ? 'text-profit' : 'text-warn')}>
                    {fmtUSD(me.available_balance ?? 0)} / ${minPayout.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 w-52 bg-surface-muted rounded-full overflow-hidden border border-border-subtle">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", ((me.available_balance ?? 0) >= minPayout) ? 'bg-profit' : 'bg-warn')}
                    style={{ width: `${Math.min(((me.available_balance ?? 0) / minPayout) * 100, 100)}%` }}
                  />
                </div>
                {((me.available_balance ?? 0) < minPayout) && (
                  <p className="text-xs text-text-muted">Requires minimum ${minPayout.toFixed(2)} accumulated earnings to request disbursal.</p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full border-t border-border-subtle pt-3">
              {/* Affiliate Payout Release Schedule Notice */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-profit/10 border border-profit/25 text-profit text-xs font-semibold shadow-xs select-none">
                <Zap className="h-3.5 w-3.5 text-profit shrink-0" />
                <span>⚡ Payouts processed every Tuesday &amp; Friday via USDT TRC-20</span>
              </div>
              <div className="flex flex-col items-end gap-1 self-end sm:self-center">
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={saveMethod} disabled={savingMethod}>Save method</Button>
                  <Button onClick={requestPayout} disabled={requesting || (me.available_balance ?? 0) < minPayout}>
                    <ArrowUpRight className="h-4 w-4 mr-1" /> Request withdrawal
                  </Button>
                </div>
                <p className="text-2xs text-text-muted">Minimum withdrawal: ${minPayout.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {Array.isArray(payouts) && payouts.length > 0 && (
            <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm terminal-num text-text">{fmtUSD(Number(p.amount))}</span>
                      <Badge tone={payoutTone(p.status)}>{p.status}</Badge>
                    </div>
                    <div className="text-2xs text-text-muted mt-0.5">
                      {METHOD_LABEL[p.method] || p.method} · {timeAgo(p.created_at_iso || p.created_at)}
                      {p.tx_reference ? <> · ref <span className="font-medium text-text">{p.tx_reference}</span></> : null}
                      {p.admin_note ? <> · {p.admin_note}</> : null}
                    </div>
                  </div>
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text shrink-0" title="Payment proof">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commission history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!commissions ? (
            <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !Array.isArray(commissions) || commissions.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="inline-flex h-12 w-12 rounded-xl bg-accent/10 text-accent items-center justify-center mb-4">
                <DollarSign className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-text">No commissions yet</h2>
              <p className="text-sm text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
                Share your link to start earning.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {commissions.map((c) => (
                 <div key={c.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
                   <div className="min-w-0">
                     <div className="font-semibold text-sm terminal-num text-text">{fmtUSD(c.amount)}</div>
                     <div className="text-2xs text-text-muted">{c.rate_percent}% of <span className="terminal-num">{fmtUSD(c.base_amount)}</span> · {timeAgo(c.created_at_iso || c.created_at)}</div>
                   </div>
                   <Badge tone={tone(c.status)}>{c.status}</Badge>
                 </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── TIER ROADMAP & PERKS MODAL ── */}
      <Modal
        open={isTiersModalOpen}
        onOpenChange={setIsTiersModalOpen}
        title="Affiliate Commission Tiers & Perks"
        description={`Accelerate your earnings as you refer more funded traders to ${brandName}.`}
        maxWidth="2xl"
      >
        <div className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-[#cd7f32]">🥉 Bronze Partner</span>
                <Badge tone="neutral" size="sm">0 – 9 Sales</Badge>
              </div>
              <div className="text-xl font-bold terminal-num text-white mb-2">10% <span className="text-xs font-normal text-text-muted font-sans">Commission</span></div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• 60-Day Cookie Tracking Window</li>
                <li>• Real-Time Dashboard Analytics</li>
                <li>• Standard Monthly Disbursals</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-400/20 bg-slate-400/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-slate-300">🥈 Silver Partner</span>
                <Badge tone="info" size="sm">10 – 49 Sales</Badge>
              </div>
              <div className="text-xl font-bold terminal-num text-white mb-2">12% <span className="text-xs font-normal text-text-muted font-sans">Commission</span></div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• 60-Day Cookie Tracking Window</li>
                <li>• Custom Marketing Asset Watermarks</li>
                <li>• Bi-Weekly Crypto Payout Option</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-yellow-400">🥇 Gold Partner</span>
                <Badge tone="warn" size="sm">50 – 99 Sales</Badge>
              </div>
              <div className="text-xl font-bold terminal-num text-white mb-2">15% <span className="text-xs font-normal text-text-muted font-sans">Commission</span></div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• 90-Day Extended Cookie Window</li>
                <li>• Priority 24-Hour Payout Approvals</li>
                <li>• Custom Promo Landing Pages</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-profit/20 bg-profit/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-profit">💎 Platinum VIP</span>
                <Badge tone="success" size="sm">100+ Sales</Badge>
              </div>
              <div className="text-xl font-bold terminal-num text-white mb-2">20% <span className="text-xs font-normal text-text-muted font-sans">Commission</span></div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• Lifetime Cookie Attribution</li>
                <li>• Dedicated VIP Affiliate Manager</li>
                <li>• Custom Revenue Share Contracts</li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>

      {/* Trader Affiliate QR Code Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Your Referral QR Code"
        description="Scan with a mobile camera or share at in-person events to register referrals instantly."
        className="max-w-sm"
      >
        <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
          {qrDataUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-xl border border-gray-200 flex items-center justify-center">
              <img src={qrDataUrl} alt="Affiliate Referral QR Code" className="w-56 h-56 object-contain rounded-lg" />
            </div>
          ) : (
            <div className="w-56 h-56 bg-surface-muted rounded-2xl animate-pulse flex items-center justify-center text-xs text-text-muted">
              Generating QR Code...
            </div>
          )}

          <div className="space-y-1">
            <span className="text-2xs uppercase tracking-wider font-semibold text-text-muted">Partner Referral Code</span>
            <div className="font-mono text-sm font-bold text-text bg-surface-muted px-3 py-1 rounded-md border border-border-subtle inline-block">
              {me?.code}
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Directs scanners to your unique partner landing page with your commission code pre-applied.
          </p>

          <div className="flex items-center gap-2 w-full pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                if (qrDataUrl) {
                  const a = document.createElement('a')
                  a.href = qrDataUrl
                  a.download = `ref-${me?.code || 'qr'}.png`
                  a.click()
                  toast.success('QR Code downloaded!')
                }
              }}
            >
              Download PNG
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(
                "flex-1 font-semibold transition-all",
                copied && "bg-profit hover:bg-profit/90 text-white"
              )}
              onClick={copy}
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
