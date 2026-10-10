'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users2, Copy, Check, DollarSign, TrendingUp, Wallet, ArrowUpRight, ExternalLink, Send, MessageCircle, Share2, Sparkles, QrCode, Zap, Percent, Download } from 'lucide-react'
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
import { MarketingMediaKit } from '@/components/dashboard/marketing/marketing-media-kit'

import { FONT_PRESETS, hexToRgb } from '@/lib/theme-accent'

const tone = (s: Commission['status']) =>
  s === 'paid' ? 'success' : s === 'reversed' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const payoutTone = (s: AffiliatePayout['status']) =>
  s === 'paid' ? 'success' : s === 'rejected' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const METHOD_LABEL: Record<string, string> = { usdt_trc20: 'USDT (TRC20)', usdt_bep20: 'USDT (BEP20)', wise: 'Wise' }

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

      {/* ── ENHANCED ULTRA-HD MARKETING MEDIA KIT ────────────────────────────── */}
      <MarketingMediaKit
        affiliateCode={me?.code || 'PARTNER'}
        partnerLink={link || ''}
      />

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
                  a.download = `launchapropfirm-ref-${me?.code || 'qr'}.png`
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
