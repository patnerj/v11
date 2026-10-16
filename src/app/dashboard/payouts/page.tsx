'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { fmtUSD, fmtDate, fmtPct, toNum, statusLabel, statusTone } from '@/lib/format'
import type { ChallengeAccount, PayoutsResp } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { PayoutSummary, PayoutHistory } from '@/components/dashboard/payout-history'
import { PayoutReadinessCard } from '@/components/dashboard/payout-readiness-card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Banknote, ArrowUpRight, AlertCircle, Wallet, CheckCircle2, ShieldAlert, Clock, Share2, Printer, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { ViralPayoutCardModal } from '@/components/dashboard/payouts/viral-payout-card-modal'
import { useAuth } from '@/store/auth'
import { useBranding } from '@/store/branding'

type PayoutMethod = 'crypto' | 'wise'

export default function PayoutsPage() {
  const user = useAuth((s) => s.user)
  const [requestFor, setRequestFor]   = useState<ChallengeAccount | null>(null)
  const [showCertificate, setShowCertificate] = useState(false)

  const { data, refetch: refresh, isPending } = useQuery({
    queryKey: ['payoutsData'],
    queryFn: async () => {
      const [ch, pm, po, kyc] = await Promise.all([api.challengeMy(), api.payoutMethodGet(), api.payouts(), api.kycGet()])
      return {
        funded: ch.ok && Array.isArray(ch.data) ? ch.data.filter((c) => c.status === 'funded') : [],
        savedMethod: pm.ok ? pm.data : null,
        pdata: po.ok ? po.data : null,
        kycApproved: po.ok ? po.data.kyc_approved : null,
        kycStatus: kyc.ok ? (kyc.data as any)?.status : null,
      }
    },
    refetchInterval: 30_000,
  })

  const loading = isPending && !data

  const funded = data?.funded ?? []
  const savedMethod = data?.savedMethod ?? null
  const kycApproved = data?.kycApproved ?? null
  const kycStatus = data?.kycStatus ?? null
  const pdata = data?.pdata ?? null

  const totalPaid = (Array.isArray(pdata?.history) ? pdata.history : [])
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + (p.trader_amount || 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        variant="hero"
        title="Your Payouts"
        description="Request a payout from a funded account and manage your payout method."
        icon={Banknote}
        badge={{ label: 'Withdrawals', tone: 'accent' }}
      />

      {/* Next Payout Readiness Countdown Timer Card */}
      {funded.length > 0 && (
        <PayoutReadinessCard
          fundedChallenges={funded}
          nextPayoutAt={pdata?.next_payout_at}
          savedMethod={savedMethod}
        />
      )}

      {/* Summary */}
      <PayoutSummary
        available={pdata?.available ?? 0}
        nextPayoutAt={pdata?.next_payout_at ?? null}
        cycleDays={pdata?.cycle_days ?? 14}
        totalPaid={totalPaid}
        loading={loading}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* KYC gate */}
          {kycApproved === false && (
            kycStatus === 'pending' ? (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardContent className="flex items-start gap-3 p-5">
                  <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-text">Identity Verification Under Review</span>
                      <Badge tone="warning" pulsing>Audit in Progress</Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Your KYC documents are currently being audited by our compliance desk. Payout requests will unlock automatically upon approval.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3 border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                      <Link href="/dashboard/kyc">View submission status <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-warn/40 bg-warn/5">
                <CardContent className="flex items-start gap-3 p-5">
                  <ShieldAlert className="h-5 w-5 text-warn shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-text">KYC Required</span>
                      <Badge tone="warn">Verification needed</Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Complete identity verification before requesting your first payout.
                    </p>
                    <Button asChild size="sm" className="mt-3">
                      <Link href="/dashboard/kyc">Complete verification <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
              <CardTitle>Funded accounts</CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0 border-accent/40 text-accent hover:bg-accent/10" onClick={() => setShowCertificate(true)}>
                <Sparkles className="h-4 w-4 text-accent" /> 1-Click Viral Social Card
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : funded.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">
                  <Banknote className="h-8 w-8 mx-auto text-text-faint mb-2" />
                  You need to pass an evaluation before you can request a payout.
                </div>
              ) : funded.map((c) => {
                const elig = c.payout_eligibility
                const profit = toNum(c.current_balance) - toNum(c.starting_balance)
                const splitPct = c.custom_profit_split !== null && c.custom_profit_split !== undefined ? toNum(c.custom_profit_split) : toNum(c.funded_profit_split ?? 80)
                const withdrawableProfit = elig ? elig.withdrawable_profit : Math.max(0, profit)
                const traderShare = elig ? elig.withdrawable_share : (profit > 0 ? (profit * splitPct) / 100 : 0)
                const hasOpenTrades = Boolean(elig && elig.open_positions_count > 0)
                const hasPendingOrders = Boolean(elig && elig.pending_orders_count > 0)
                const hasPendingPayout = Boolean(elig && elig.has_pending_payout)
                const isDaysIncomplete = Boolean(elig && elig.trading_days_completed < elig.min_days_required)
                const isUnderMinAmount = Boolean(elig && withdrawableProfit < elig.min_payout_amount)
                const isUnsettledGap = Boolean(elig && elig.unsettled_profit > 5.0 && withdrawableProfit < elig.min_payout_amount)

                return (
                  <div key={c.id} className="rounded-lg border border-border-subtle p-4 hover:border-accent transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-medium">{c.plan_name ?? `Challenge #${c.id}`}</div>
                        <div className="text-2xs text-text-muted tabular">{fmtUSD(c.account_size ?? 0, { decimals: 0 })} · Funded {c.funded_at && fmtDate(c.funded_at)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {hasPendingPayout && (
                          <Badge tone="warn">REVIEW</Badge>
                        )}
                        <Badge tone="success">FUNDED</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <Stat label="Total Profit"      value={fmtUSD(profit, { sign: true })} tone={profit >= 0 ? 'success' : 'danger'} />
                      <Stat label={`Withdrawable Share (${splitPct}%)`} value={fmtUSD(traderShare)} tone="success" />
                      <Stat label="Equity"      value={fmtUSD(c.current_balance)} />
                    </div>

                    {/* Dynamic Real-Time Warnings */}
                    {hasOpenTrades && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-warn/10 border border-warn/25 text-xs text-warn mb-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            You have <strong>{elig!.open_positions_count} open position{elig!.open_positions_count > 1 ? 's' : ''}</strong>. Close all market trades before requesting a payout.
                          </span>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 h-7 text-2xs">
                          <Link href="/dashboard/trading">WebTrader <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
                        </Button>
                      </div>
                    )}

                    {!hasOpenTrades && hasPendingOrders && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-warn/10 border border-warn/25 text-xs text-warn mb-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            You have <strong>{elig!.pending_orders_count} pending order{elig!.pending_orders_count > 1 ? 's' : ''}</strong>. Cancel all pending orders before requesting a payout.
                          </span>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 h-7 text-2xs">
                          <Link href="/dashboard/trading">WebTrader <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
                        </Button>
                      </div>
                    )}

                    {hasPendingPayout && (
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-accent/10 border border-accent/25 text-xs text-accent mb-3">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>A payout request for this account is currently being processed by finance.</span>
                      </div>
                    )}

                    {isUnsettledGap && (
                      <div className="p-2.5 rounded-md bg-surface-muted/60 border border-border-subtle text-xs text-text-muted mb-3 space-y-1">
                        <div className="font-semibold text-text flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-warn" />
                          <span>Trades Pending Settlement</span>
                        </div>
                        <div className="text-2xs">
                          Account profit includes floating or unsettled trades. Withdrawable settled profit: <strong>{fmtUSD(withdrawableProfit)}</strong> (Minimum payout: <strong>{fmtUSD(elig?.min_payout_amount ?? 50)}</strong>).
                        </div>
                      </div>
                    )}

                    {/* Action Button & Contextual State */}
                    {kycApproved === false ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/kyc">Complete KYC to request <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Link>
                      </Button>
                    ) : hasOpenTrades ? (
                      <Button size="sm" variant="outline" disabled className="opacity-80 cursor-not-allowed">
                        <AlertCircle className="h-3.5 w-3.5 mr-1 text-warn" /> Close Trades to Withdraw
                      </Button>
                    ) : hasPendingOrders ? (
                      <Button size="sm" variant="outline" disabled className="opacity-80 cursor-not-allowed">
                        <AlertCircle className="h-3.5 w-3.5 mr-1 text-warn" /> Cancel Orders to Withdraw
                      </Button>
                    ) : hasPendingPayout ? (
                      <Button size="sm" variant="outline" disabled className="opacity-80 cursor-not-allowed">
                        <Clock className="h-3.5 w-3.5 mr-1 text-accent" /> Payout Under Review
                      </Button>
                    ) : isDaysIncomplete ? (
                      <Button size="sm" variant="outline" disabled className="opacity-80 cursor-not-allowed">
                        {elig!.trading_days_completed}/{elig!.min_days_required} Days Traded
                      </Button>
                    ) : isUnderMinAmount || profit <= 0 ? (
                      <Button size="sm" variant="outline" disabled className="opacity-80 cursor-not-allowed">
                        Min Payout {fmtUSD(elig?.min_payout_amount ?? 50)}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => setRequestFor(c)}
                      >
                        {elig && elig.unsettled_profit > 5.0
                          ? `Request Settled Payout (${fmtUSD(traderShare)})`
                          : 'Request payout'} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    )}

                    {isDaysIncomplete && (
                      <div className="mt-2 text-2xs text-text-muted">
                        Minimum {elig!.min_days_required} trading days required before payout eligibility.
                      </div>
                    )}
                    {!isDaysIncomplete && (profit <= 0 || isUnderMinAmount) && !hasOpenTrades && !hasPendingOrders && (
                      <div className="mt-2 text-2xs text-text-muted">
                        {profit <= 0 
                          ? 'Your account needs to be in profit before you can request a payout.'
                          : `Available withdrawable profit (${fmtUSD(withdrawableProfit)}) is below the minimum payout amount of ${fmtUSD(elig?.min_payout_amount ?? 50)}.`}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <PayoutHistory items={pdata?.history ?? null} loading={loading} />

          <PayoutOrdersList />
        </div>

        <div className="lg:col-span-1">
          <PayoutMethodCard savedMethod={savedMethod} onSaved={refresh} />
        </div>
      </div>

      {requestFor && (
        <RequestPayoutDialog
          challenge={requestFor}
          savedMethod={savedMethod}
          onClose={() => setRequestFor(null)}
          onSuccess={() => { setRequestFor(null); refresh() }}
        />
      )}

      {showCertificate && (
        <ViralPayoutCardModal 
          isOpen={true}
          onClose={() => setShowCertificate(false)}
          amount={totalPaid > 0 ? totalPaid : (funded[0] ? Math.max(500, toNum(funded[0].current_balance) - toNum(funded[0].starting_balance)) : 1450)}
          date={funded[0]?.funded_at ? fmtDate(funded[0].funded_at) : new Date().toLocaleDateString()}
          method={savedMethod?.method ?? 'USDT - TRC20'}
          traderName={user?.display_name || user?.username || 'Pro Trader'}
          payoutId={pdata?.history?.[0]?.id || 101}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="p-2.5 rounded-md bg-surface-muted/50 border border-border-subtle">
      <div className="text-2xs text-text-muted truncate">{label}</div>
      <div className={`text-sm font-semibold terminal-num ${tone === 'success' ? 'text-profit' : tone === 'danger' ? 'text-loss' : 'text-text'}`}>{value}</div>
    </div>
  )
}

function PayoutMethodCard({ savedMethod, onSaved }: { savedMethod: { method: string; address: string; details: string } | null; onSaved: () => void }) {
  const [method,  setMethod]  = useState<PayoutMethod>((savedMethod?.method?.toLowerCase().includes('wise') ? 'wise' : 'crypto'))
  const [cryptoNetwork, setCryptoNetwork] = useState<'trc20' | 'bep20'>(
    savedMethod?.method?.toLowerCase().includes('bep') ? 'bep20' : 'trc20'
  )
  const [address, setAddress] = useState(savedMethod?.address ?? '')
  const [details, setDetails] = useState(savedMethod?.details ?? '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (savedMethod) {
      setMethod(savedMethod.method?.toLowerCase().includes('wise') ? 'wise' : 'crypto')
      setCryptoNetwork(savedMethod.method?.toLowerCase().includes('bep') ? 'bep20' : 'trc20')
      setAddress(savedMethod.address || '')
      setDetails(savedMethod.details || '')
    }
  }, [savedMethod])

  const isTrcValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim())
  const isBepValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim())
  const isWiseValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim())

  const isAddressValid = method === 'crypto'
    ? (cryptoNetwork === 'trc20' ? isTrcValid : isBepValid)
    : isWiseValid

  const save = async () => {
    if (!address.trim()) { toast.error('Enter your payout address or account number'); return }
    if (!isAddressValid) {
      toast.error(method === 'crypto' 
        ? `Please enter a valid ${cryptoNetwork === 'trc20' ? 'Tron (TRC20)' : 'BNB Smart Chain (BEP20)'} wallet address` 
        : 'Please enter a valid email address')
      return
    }
    setSaving(true)
    const effectiveMethod = method === 'crypto'
      ? (cryptoNetwork === 'trc20' ? 'USDT (TRC20)' : 'USDT (BEP20)')
      : 'Wise'
    const res = await api.payoutMethodSave(effectiveMethod, address.trim(), details.trim())
    setSaving(false)
    if (res.ok) { toast.success('Payout method saved'); onSaved() }
    else        toast.error(res.error)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'crypto', label: 'Crypto (USDT)', icon: Wallet },
            { id: 'wise',   label: 'Wise',          icon: Banknote },
          ] as const).map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => setMethod(opt.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-md border text-2xs font-medium transition-colors focus-ring ${
                  method === opt.id
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-surface text-text-muted hover:text-text hover:border-border-strong'
                }`}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
              </button>
            )
          })}
        </div>

        {method === 'crypto' && (
          <div className="space-y-1.5">
            <Label>Crypto Network</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCryptoNetwork('trc20')}
                className={`h-9 px-2 rounded-md border text-xs font-medium transition-colors focus-ring flex items-center justify-center gap-1.5 ${
                  cryptoNetwork === 'trc20'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-surface text-text-muted hover:text-text'
                }`}
              >
                <span>USDT - TRC20</span>
                <span className="text-2xs opacity-75 font-mono">(Tron)</span>
              </button>
              <button
                type="button"
                onClick={() => setCryptoNetwork('bep20')}
                className={`h-9 px-2 rounded-md border text-xs font-medium transition-colors focus-ring flex items-center justify-center gap-1.5 ${
                  cryptoNetwork === 'bep20'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-surface text-text-muted hover:text-text'
                }`}
              >
                <span>USDT - BEP20</span>
                <span className="text-2xs opacity-75 font-mono">(BSC)</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="addr">
            {method === 'crypto' 
              ? (cryptoNetwork === 'trc20' ? 'USDT (TRC20) wallet address' : 'USDT (BEP20) wallet address')
              : 'Wise email'}
          </Label>
          <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={
            method === 'crypto' 
              ? (cryptoNetwork === 'trc20' ? 'T... (Tron TRC20 address)' : '0x... (BNB Chain BEP20 address)')
              : 'you@example.com'
          } />
          {address.trim() && !isAddressValid && (
            <p className="text-2xs text-danger">
              {method === 'crypto'
                ? `Invalid format: ${cryptoNetwork === 'trc20' ? 'TRC20 addresses start with "T" and are 34 characters long.' : 'BEP20 addresses start with "0x" and are 42 characters long.'}`
                : 'Invalid email address format.'}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dets">Additional details (optional)</Label>
          <Textarea id="dets" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={
            method === 'crypto' ? 'Memo / Tag (if required by your exchange)' : 'Account holder name'
          } />
        </div>

        <Button onClick={save} loading={saving} className="w-full">Save payout method</Button>
      </CardContent>
    </Card>
  )
}

function RequestPayoutDialog({
  challenge, savedMethod, onClose, onSuccess,
}: {
  challenge: ChallengeAccount
  savedMethod: { method: string; address: string; details: string } | null
  onClose: () => void
  onSuccess: () => void
}) {
  const elig = challenge.payout_eligibility
  const [method,  setMethod]  = useState(savedMethod?.method || 'crypto')
  const [cryptoNetwork, setCryptoNetwork] = useState<'trc20' | 'bep20'>(
    savedMethod?.method?.toLowerCase().includes('bep') ? 'bep20' : 'trc20'
  )
  const [address, setAddress] = useState(savedMethod?.address ?? '')
  const [busy,    setBusy]    = useState(false)
  const [success, setSuccess] = useState(false)

  const isTrcValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim())
  const isBepValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim())
  const isWiseValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim())

  const isAddressValid = method === 'crypto'
    ? (cryptoNetwork === 'trc20' ? isTrcValid : isBepValid)
    : isWiseValid

  const balanceProfit = toNum(challenge.current_balance) - toNum(challenge.starting_balance)
  const maxWithdrawable = elig ? elig.withdrawable_profit : Math.max(0, balanceProfit)
  const minPayout = elig?.min_payout_amount ?? 50.0

  const [amountStr, setAmountStr] = useState<string>(maxWithdrawable > 0 ? maxWithdrawable.toFixed(2) : '0.00')

  const splitPct = challenge.custom_profit_split !== null && challenge.custom_profit_split !== undefined ? toNum(challenge.custom_profit_split) : toNum(challenge.funded_profit_split ?? 80)
  
  const currentNumAmt = Math.max(0, toNum(amountStr))
  const requestedProfit = Math.min(maxWithdrawable, currentNumAmt || maxWithdrawable)
  const traderShare = (requestedProfit * splitPct) / 100
  const firmShare   = requestedProfit - traderShare

  const submit = async () => {
    if (!address.trim()) { toast.error('Enter your payout address'); return }
    if (!isAddressValid) {
      toast.error(method === 'crypto' 
        ? `Please enter a valid ${cryptoNetwork === 'trc20' ? 'Tron (TRC20)' : 'BNB Smart Chain (BEP20)'} wallet address` 
        : 'Please enter a valid email address')
      return
    }
    const numAmt = toNum(amountStr)
    if (numAmt <= 0) { toast.error('Enter a valid payout amount'); return }
    if (numAmt > maxWithdrawable + 0.05) {
      toast.error(`Requested amount exceeds verified withdrawable profit (${fmtUSD(maxWithdrawable)})`)
      return
    }
    if (numAmt < minPayout) {
      toast.error(`Minimum payout amount is ${fmtUSD(minPayout)}`)
      return
    }

    setBusy(true)
    const effectiveMethod = method === 'crypto'
      ? (cryptoNetwork === 'trc20' ? 'USDT (TRC20)' : 'USDT (BEP20)')
      : 'Wise'

    try {
      const res = await api.challengePayout(challenge.id, effectiveMethod, address.trim(), numAmt)
      if (res.ok && res.data.success) {
        setSuccess(true)
        setTimeout(onSuccess, 1500)
      } else {
        toast.error(res.ok ? (res.data.message ?? 'Request failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while requesting payout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request payout</DialogTitle>
          <DialogDescription>From {challenge.plan_name ?? `Challenge #${challenge.id}`}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <div className="h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-text">Payout requested</h3>
            <p className="text-sm text-text-muted mt-2">
              We&apos;ll review and approve your payout within 1 business day.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-bg-subtle border border-border-subtle p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Total profit on account</span>
                <span className="tabular font-medium text-text">{fmtUSD(balanceProfit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Verified settled withdrawable</span>
                <span className="tabular font-semibold text-success">{fmtUSD(maxWithdrawable)}</span>
              </div>
              {elig && elig.unsettled_profit > 0 && (
                <div className="flex justify-between text-2xs text-warn">
                  <span>Unsettled / floating trades</span>
                  <span className="tabular font-medium">{fmtUSD(elig.unsettled_profit)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-border-subtle/60 flex justify-between text-sm">
                <span className="text-text-muted">Your share ({splitPct}%)</span>
                <span className="tabular font-semibold text-success">{fmtUSD(traderShare)}</span>
              </div>
              <div className="flex justify-between text-2xs text-text-muted">
                <span>Firm share ({fmtPct(100 - splitPct, 0)})</span>
                <span className="tabular">{fmtUSD(firmShare)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="reqamount">Withdrawal amount (USD)</Label>
                <button
                  type="button"
                  onClick={() => setAmountStr(maxWithdrawable.toFixed(2))}
                  className="text-2xs font-semibold text-accent hover:underline"
                >
                  Max: {fmtUSD(maxWithdrawable)}
                </button>
              </div>
              <Input
                id="reqamount"
                type="number"
                step="any"
                max={maxWithdrawable}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['crypto', 'wise'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`h-9 rounded-md border text-xs font-medium transition-colors focus-ring ${
                      method === m ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-border bg-surface text-text-muted hover:text-text'
                    }`}
                  >
                    {m === 'crypto' ? 'USDT (CRYPTO)' : 'WISE TRANSFER'}
                  </button>
                ))}
              </div>
            </div>

            {method === 'crypto' && (
              <div className="space-y-1.5">
                <Label>Crypto Network</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCryptoNetwork('trc20')}
                    className={`h-9 px-2 rounded-md border text-xs font-medium transition-colors focus-ring flex items-center justify-center gap-1.5 ${
                      cryptoNetwork === 'trc20'
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-border bg-surface text-text-muted hover:text-text'
                    }`}
                  >
                    <span>USDT - TRC20</span>
                    <span className="text-2xs opacity-75 font-mono">(Tron)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCryptoNetwork('bep20')}
                    className={`h-9 px-2 rounded-md border text-xs font-medium transition-colors focus-ring flex items-center justify-center gap-1.5 ${
                      cryptoNetwork === 'bep20'
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-border bg-surface text-text-muted hover:text-text'
                    }`}
                  >
                    <span>USDT - BEP20</span>
                    <span className="text-2xs opacity-75 font-mono">(BNB Chain)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="payaddr">
                  {method === 'crypto' 
                    ? (cryptoNetwork === 'trc20' ? 'TRC20 Wallet Address (Tron)' : 'BEP20 Wallet Address (BNB Smart Chain)') 
                    : 'Wise Account Email'}
                </Label>
                {address.trim().length > 0 && (
                  <span className={`text-2xs font-medium flex items-center gap-1 ${isAddressValid ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isAddressValid ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Valid format
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 shrink-0" /> Invalid format
                      </>
                    )}
                  </span>
                )}
              </div>
              <Input
                id="payaddr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={
                  method === 'crypto'
                    ? (cryptoNetwork === 'trc20' ? 'Starts with T (34 characters)...' : 'Starts with 0x (42 characters)...')
                    : 'account@example.com'
                }
              />
              {address.trim().length > 0 && !isAddressValid && (
                <p className="text-2xs text-rose-500 mt-0.5">
                  {method === 'crypto'
                    ? (cryptoNetwork === 'trc20'
                        ? 'Invalid Tron address. Must start with "T" and contain exactly 34 alphanumeric characters.'
                        : 'Invalid BSC address. Must start with "0x" followed by 40 hex characters.')
                    : 'Please enter a valid email address.'}
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 text-2xs text-text-muted">
              <AlertCircle className="h-3.5 w-3.5 text-warn shrink-0 mt-0.5" />
              <span>Payouts are reviewed within 1 business day. Once approved, funds typically arrive within 24h.</span>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="success" onClick={submit} loading={busy} disabled={!address.trim() || !isAddressValid || currentNumAmt <= 0}>
                Request {fmtUSD(traderShare)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PayoutOrdersList() {
  const { data: orders = null, isPending } = useQuery({
    queryKey: ['paymentMyOrders'],
    queryFn: async () => {
      const res = await api.paymentMyOrders()
      if (!res.ok) throw new Error('Failed to load orders')
      return res.data
    },
    refetchInterval: 30_000,
  })

  const loading = isPending && !orders
  const safeOrders = Array.isArray(orders) ? orders : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase order history</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : safeOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No purchase orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-subtle/40">
                  <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-muted font-semibold">Order</th>
                  <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-muted font-semibold hidden sm:table-cell">Gateway</th>
                  <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-muted font-semibold">Amount</th>
                  <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-muted font-semibold">Status</th>
                  <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-muted font-semibold hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {safeOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border-subtle/40 last:border-0">
                    <td className="px-4 py-3 tabular text-text-muted">#{o.id}</td>
                    <td className="px-4 py-3 capitalize hidden sm:table-cell">{o.gateway}</td>
                    <td className="px-4 py-3 text-right terminal-num font-semibold text-text">{fmtUSD(o.amount)}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge></td>
                    <td className="px-4 py-3 text-right text-2xs text-text-muted hidden md:table-cell">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PayoutCertificateModal({
  onClose,
  traderName = 'Prop Firm Trader',
  amount = 1450,
  date = 'Current Season',
  method = 'USDT - TRC20',
}: {
  onClose: () => void
  traderName?: string
  amount?: number
  date?: string
  method?: string
}) {
  const brandName = useBranding((s) => s.branding.brand_name) || 'Prop Firm'
  const shareText = `Just secured ${fmtUSD(amount)} payout with @${brandName.replace(/\s+/g, '')}! Seamless ${method} withdrawal. 🚀 Prop firm trading made real. #${brandName.replace(/\s+/g, '')} #Payout #Forex`

  const handleCopyShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText)
    }
    toast.success('Social share text copied to clipboard!')
  }

  const handlePrint = () => {
    if (typeof window === 'undefined') return
    const printContent = document.getElementById('payout-certificate')
    if (!printContent) {
      window.print()
      return
    }
    const printWindow = window.open('', '_blank', 'width=800,height=700')
    if (!printWindow) {
      window.print()
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${brandName} Payout Certificate - ${traderName}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0b0f19;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .cert-wrapper {
      max-width: 560px;
      width: 100%;
      border-radius: 16px;
      border: 2px solid rgba(245, 158, 11, 0.4);
      background: linear-gradient(135deg, #111827 0%, #1e293b 50%, #064e3b 100%);
      padding: 32px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      position: relative;
    }
    .cert-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; font-size: 11px; }
    .brand-name { font-family: monospace; text-transform: uppercase; letter-spacing: 2px; color: #f59e0b; font-weight: bold; }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 9999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-weight: 600; font-size: 11px; }
    .title { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 600; }
    .amount { font-size: 44px; font-weight: 900; color: #34d399; margin: 16px 0 4px; }
    .method { font-size: 12px; color: #94a3b8; font-family: monospace; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 380px; margin: 24px auto 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); padding: 14px; border-radius: 12px; text-align: left; font-size: 12px; }
    .details-label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .details-val { font-weight: 600; color: #f8fafc; }
    .footer-note { font-size: 11px; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 6px; }
  </style>
</head>
<body>
  <div class="cert-wrapper">
    <div class="cert-header">
      <span class="brand-name">${brandName} Enterprise</span>
      <span class="badge">&#128737;&#65039; Verified Disbursal</span>
    </div>
    <div class="title">Official Certificate of Payout</div>
    <div class="amount">${fmtUSD(amount)}</div>
    <div class="method">Disbursed via ${method}</div>
    <div class="details-grid">
      <div>
        <div class="details-label">Trader Handle</div>
        <div class="details-val">${traderName}</div>
      </div>
      <div>
        <div class="details-label">Disbursed On</div>
        <div class="details-val">${date}</div>
      </div>
    </div>
    <div class="footer-note">
      &#128737;&#65039; Prop Firm Authenticity Verified · Anti-Arbitrage Cleared
    </div>
  </div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`)
    printWindow.document.close()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl bg-surface border-border p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <DialogTitle className="text-lg font-bold">Proof of Payout Certificate</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-muted">
            Official verified social certificate for community proof of payout.
          </DialogDescription>
        </DialogHeader>

        <div id="payout-certificate" className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-surface via-surface-muted to-emerald-950/20 p-8 text-center shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-400 to-accent" />
          
          <div className="flex justify-between items-center mb-6">
            <span className="text-2xs font-mono uppercase tracking-widest text-amber-500 font-bold">{brandName} Enterprise</span>
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-2xs font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Disbursal
            </div>
          </div>

          <div className="text-xs uppercase tracking-widest text-text-muted font-semibold">Official Certificate of Payout</div>
          
          <div className="my-6">
            <div className="text-3xl sm:text-5xl font-black tabular tracking-tight text-emerald-400">
              {fmtUSD(amount)}
            </div>
            <div className="text-xs text-text-muted mt-1 font-mono">Disbursed via {method}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left bg-surface/70 border border-border p-3.5 rounded-xl mb-4 text-xs">
            <div>
              <div className="text-2xs text-text-muted uppercase">Trader Handle</div>
              <div className="font-semibold text-text truncate">{traderName}</div>
            </div>
            <div>
              <div className="text-2xs text-text-muted uppercase">Disbursed On</div>
              <div className="font-semibold text-text tabular">{date}</div>
            </div>
          </div>

          <div className="text-2xs text-text-faint flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Prop Firm Authenticity Verified · Anti-Arbitrage Cleared
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 flex-1 sm:flex-initial text-xs">
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyShare} className="gap-1.5 flex-1 sm:flex-initial text-xs">
              <Share2 className="h-3.5 w-3.5" /> Copy Share Text
            </Button>
          </div>
          <Button variant="primary" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
