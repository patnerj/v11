'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users2, Copy, Check, DollarSign, TrendingUp, Wallet, ArrowUpRight, ExternalLink, Send, MessageCircle, Share2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import type { Commission, AffiliatePayout } from '@/types/api'
import { fmtUSD, timeAgo } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { AffiliateLeaderboard } from '@/components/affiliate-leaderboard'
import { Modal } from '@/components/ui/Modal'
import { useQuery } from '@tanstack/react-query'

import { FONT_PRESETS, hexToRgb } from '@/lib/theme-accent'

const tone = (s: Commission['status']) =>
  s === 'paid' ? 'success' : s === 'reversed' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const payoutTone = (s: AffiliatePayout['status']) =>
  s === 'paid' ? 'success' : s === 'rejected' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const METHOD_LABEL: Record<string, string> = { usdt_trc20: 'USDT (TRC20)', usdt_bep20: 'USDT (BEP20)', wise: 'Wise' }

function downloadBanner(type: '16:9' | '1:1', code: string, refLink: string) {
  if (typeof window === 'undefined') return
  const canvas = document.createElement('canvas')
  const width = type === '16:9' ? 1920 : 1080
  const height = 1080
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

  // Dark background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height)
  bgGrad.addColorStop(0, '#06080F')
  bgGrad.addColorStop(0.5, '#0B0F19')
  bgGrad.addColorStop(1, '#0F172A')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // Glow
  const glowGrad = ctx.createRadialGradient(width / 2, height / 3, 50, width / 2, height / 3, 500)
  glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`)
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, width, height)

  // Border frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 4
  ctx.strokeRect(40, 40, width - 80, height - 80)

  // Brand Name
  ctx.textAlign = 'center'
  ctx.fillStyle = activeAccent
  ctx.font = `bold 36px ${brandFont}`
  ctx.fillText('NEXT-GEN PROPFIRM', width / 2, type === '16:9' ? 240 : 280)

  // Heading
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 64px ${brandFont}`
  ctx.fillText('TRADE CAPITAL UP TO $200,000', width / 2, type === '16:9' ? 360 : 420)

  // Subtitle
  ctx.fillStyle = '#94A3B8'
  ctx.font = `500 32px ${brandFont}`
  ctx.fillText('Keep up to 90% profit split • Instant Payouts • Low Spreads', width / 2, type === '16:9' ? 450 : 520)

  // Pill
  const pillW = 560
  const pillH = 120
  const pillX = (width - pillW) / 2
  const pillY = type === '16:9' ? 560 : 660

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`
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

  ctx.fillStyle = activeAccent
  ctx.font = `bold 22px ${brandFont}`
  ctx.fillText('USE REFERRAL CODE', width / 2, pillY + 45)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 40px ${brandFont}`
  ctx.fillText((code || 'PROPFIRM').toUpperCase(), width / 2, pillY + 95)

  // Footer Link
  ctx.fillStyle = '#64748B'
  ctx.font = `500 24px ${brandFont}`
  ctx.fillText(refLink || 'yourbrand.com', width / 2, type === '16:9' ? 950 : 980)

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `propfirm-banner-${type === '16:9' ? '16x9' : '1x1'}-${code || 'partner'}.png`
  a.click()
  toast.success('Marketing asset PNG downloaded!')
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

  const requestPayout = async () => {
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

  const link = me?.code ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${me.code}` : ''
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
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
          <div className="flex gap-2">
            <input readOnly value={link} className="flex-1 h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm text-text font-mono" />
            <Button variant="outline" onClick={copy}>{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}</Button>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1.5 border-[#0088cc]/40 text-[#0088cc] hover:bg-[#0088cc]/10 hover:border-[#0088cc]"
              onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Trade up to $200K capital and keep up to 90% profits with AlphaCapital! Use code ' + (me?.code || ''))}`, '_blank')}
            >
              <Send className="h-3.5 w-3.5" /> Share on Telegram
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1.5 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Trade up to $200K capital and keep up to 90% profits with AlphaCapital! Use code ' + (me?.code || '') + ' 👉 ' + link)}`, '_blank')}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1.5 border-slate-500/40 text-slate-300 hover:bg-slate-700/20"
              onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Get funded up to $200,000 with @AlphaCapital Prop Firm! Use code ' + (me?.code || '') + ' for maximum discounts: ' + link)}`, '_blank')}
            >
              <Share2 className="h-3.5 w-3.5" /> Post on X / Twitter
            </Button>
          </div>
          <p className="text-2xs text-text-muted mt-2">Code: <span className="font-semibold text-text font-mono bg-surface-muted px-1.5 py-0.5 rounded border border-border-subtle">{me.code}</span></p>
        </CardContent>
      </Card>

      <StatGrid columns={4}>
        <StatCard label="Referrals" value={String(s.referrals)} icon={Users2} tone="accent" />
        <StatCard label="Conversions" value={String(s.conversions)} icon={TrendingUp} tone="info" />
        <StatCard label="Unpaid earnings" value={fmtUSD(s.unpaid)} icon={Wallet} tone="warn" />
        <StatCard label="Paid out" value={fmtUSD(s.paid)} icon={DollarSign} tone="success" />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle>Marketing Assets</CardTitle>
          <p className="text-xs text-text-muted mt-0.5">Use these official banners and graphics on your social media, blog, or videos to boost your conversions.</p>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border-subtle p-3 flex flex-col gap-3">
              <div className="aspect-video bg-surface-muted rounded border border-border flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-bg flex flex-col items-center justify-center p-4 text-center">
                  <span className="font-sans text-xs uppercase tracking-wider text-accent mb-1 font-bold">16:9 Promo Banner</span>
                  <span className="font-black text-lg tracking-tight text-text">TRADE UP TO $200K</span>
                  <span className="text-2xs text-text-muted font-sans font-medium mt-1">Code: {me?.code}</span>
                </div>
                <div className="absolute inset-0 bg-bg/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="outline" size="sm" onClick={() => downloadBanner('16:9', me?.code || '', link || '')}>Download PNG</Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-text">16:9 Youtube / Twitter Banner</div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-accent" onClick={() => downloadBanner('16:9', me?.code || '', link || '')}>Download</Button>
              </div>
            </div>
            
            <div className="rounded-lg border border-border-subtle p-3 flex flex-col gap-3">
              <div className="aspect-square bg-surface-muted rounded border border-border flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-info/20 to-bg flex flex-col items-center justify-center p-4 text-center">
                  <span className="font-sans text-xs uppercase tracking-wider text-info mb-1 font-bold">1:1 Square Post</span>
                  <span className="font-black text-base tracking-tight text-text">KEEP 90% PROFITS</span>
                  <span className="text-2xs text-text-muted font-sans font-medium mt-1">Code: {me?.code}</span>
                </div>
                <div className="absolute inset-0 bg-bg/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="outline" size="sm" onClick={() => downloadBanner('1:1', me?.code || '', link || '')}>Download PNG</Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-text">1:1 Instagram / Feed Post</div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-info" onClick={() => downloadBanner('1:1', me?.code || '', link || '')}>Download</Button>
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
                <span className="font-bold tabular text-success">{fmtUSD(me.available_balance ?? 0)}</span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-2xs text-text-muted font-mono">
                  <span>Minimum Payout Floor ($100.00)</span>
                  <span className={((me.available_balance ?? 0) >= 100) ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {fmtUSD(me.available_balance ?? 0)} / $100.00
                  </span>
                </div>
                <div className="h-2 w-52 bg-surface-muted rounded-full overflow-hidden border border-border-subtle">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${((me.available_balance ?? 0) >= 100) ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(((me.available_balance ?? 0) / 100) * 100, 100)}%` }}
                  />
                </div>
                {((me.available_balance ?? 0) < 100) && (
                  <p className="text-[11px] text-text-muted">Requires minimum $100.00 accumulated earnings to request disbursal.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveMethod} disabled={savingMethod}>Save method</Button>
              <Button onClick={requestPayout} disabled={requesting || (me.available_balance ?? 0) <= 0}>
                <ArrowUpRight className="h-4 w-4 mr-1" /> Request withdrawal
              </Button>
            </div>
          </div>

          {Array.isArray(payouts) && payouts.length > 0 && (
            <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm tabular text-text">{fmtUSD(Number(p.amount))}</span>
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
                    <div className="font-semibold text-sm tabular text-text">{fmtUSD(c.amount)}</div>
                    <div className="text-2xs text-text-muted">{c.rate_percent}% of {fmtUSD(c.base_amount)} · {timeAgo(c.created_at_iso || c.created_at)}</div>
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
        description="Accelerate your earnings as you refer more funded traders to AlphaCapital."
        maxWidth="2xl"
      >
        <div className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-[#cd7f32]">🥉 Bronze Partner</span>
                <Badge tone="neutral" size="sm">0 – 9 Sales</Badge>
              </div>
              <div className="text-xl font-mono font-bold text-white mb-2">10% <span className="text-xs font-normal text-text-muted">Commission</span></div>
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
              <div className="text-xl font-mono font-bold text-white mb-2">12% <span className="text-xs font-normal text-text-muted">Commission</span></div>
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
              <div className="text-xl font-mono font-bold text-white mb-2">15% <span className="text-xs font-normal text-text-muted">Commission</span></div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• 90-Day Extended Cookie Window</li>
                <li>• Priority 24-Hour Payout Approvals</li>
                <li>• Custom Promo Landing Pages</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-emerald-400">💎 Platinum VIP</span>
                <Badge tone="success" size="sm">100+ Sales</Badge>
              </div>
              <div className="text-xl font-mono font-bold text-white mb-2">20% <span className="text-xs font-normal text-text-muted">Commission</span></div>
              <ul className="text-xs text-text-muted space-y-1">
                <li>• Lifetime Cookie Attribution</li>
                <li>• Dedicated VIP Affiliate Manager</li>
                <li>• Custom Revenue Share Contracts</li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
