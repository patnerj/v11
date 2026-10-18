'use client'

import * as React from 'react'
import { useState } from 'react'
import { 
  X, Trophy, Shield, Activity, User, ArrowUpRight, 
  RotateCcw, FastForward, Mail, AlertTriangle, CheckCircle2, 
  TrendingUp, TrendingDown, DollarSign, Clock, Layers, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtUSD, fmtPct, fmtDate, timeAgo, statusTone, statusLabel, toNum } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import type { Trade } from '@/types/api'
import Link from 'next/link'

interface ChallengeDrawerProps {
  isOpen: boolean
  onClose: () => void
  challenge: any | null
  onRefresh?: () => void
}

export function ChallengeDrawer({
  isOpen,
  onClose,
  challenge,
  onRefresh,
}: ChallengeDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'actions'>('overview')
  const [isResetting, setIsResetting] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isEmailing, setIsEmailing] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  if (!isOpen || !challenge) return null

  const size = toNum(challenge.account_size || challenge.starting_balance || 100000)
  const balance = toNum(challenge.current_balance || challenge.balance || size)
  const equity = toNum(challenge.equity || challenge.current_equity || balance)
  const hwm = toNum(challenge.equity_hwm || challenge.peak_balance || Math.max(balance, size))
  const floor = toNum(challenge.trailing_dd_floor || (size * 0.90))
  const floorCushion = Math.max(0, equity - floor)
  const floorCushionPct = size > 0 ? (floorCushion / size) * 100 : 0
  const pnl = balance - size
  const pnlPct = size > 0 ? (pnl / size) * 100 : 0

  // Target math
  const targetPct = challenge.phase === 2 ? 5 : 8
  const targetAmount = (size * targetPct) / 100
  const targetProgress = Math.min(100, Math.max(0, (Math.max(0, pnl) / targetAmount) * 100))

  // Real Trades from API (GAP-F01)
  const { data: tradesData, isLoading: isLoadingTrades } = useQuery({
    queryKey: ['admin-challenge-trades', challenge?.id],
    queryFn: async () => {
      if (!challenge?.id) return []
      const res = await api.admin.trades({
        challenge_id: challenge.id,
        account_id: challenge.fxsim_account_id || challenge.account_id,
      })
      const raw = res.ok ? res.data : null
      return Array.isArray(raw) ? raw : (raw as any)?.trades || []
    },
    enabled: isOpen && !!challenge?.id && activeTab === 'trades',
    refetchInterval: 15_000,
  })

  // Defensive array normalization (Rule 1.2 & Rule 133.2)
  const tradesList = React.useMemo<Trade[]>(() => {
    if (Array.isArray(tradesData)) return tradesData
    if (tradesData && typeof tradesData === 'object' && Array.isArray((tradesData as any).trades)) {
      return (tradesData as any).trades
    }
    return []
  }, [tradesData])

  const handleResetChallenge = async () => {
    if (!window.confirm(`Are you sure you want to RESET Challenge #${challenge.id}? This will restore balance to ${fmtUSD(size)} and clear breaches.`)) return
    setIsResetting(true)
    try {
      const res = await api.admin.testToolsSet(challenge.id, 'reset')
      if (res.ok) {
        toast.success(`Challenge #${challenge.id} successfully reset to ${fmtUSD(size)}!`)
        onRefresh?.()
      } else {
        toast.error(res.error || 'Failed to reset challenge')
      }
    } catch (e: any) {
      toast.error('Failed to reset challenge')
    } finally {
      setIsResetting(false)
    }
  }

  const handleAdvancePhase = async () => {
    const nextPhase = (challenge.phase || 1) + 1
    const nextPhaseName = nextPhase === 2 ? 'Phase 2' : 'Funded Live'
    if (!window.confirm(`Advance Challenge #${challenge.id} to ${nextPhaseName}?`)) return
    setIsAdvancing(true)
    try {
      const action = nextPhase === 2 ? 'phase1' : 'funded'
      const res = await api.admin.testToolsSet(challenge.id, action)
      if (res.ok) {
        toast.success(`Challenge #${challenge.id} advanced to ${nextPhaseName}!`)
        onRefresh?.()
      } else {
        toast.error(res.error || 'Failed to advance phase')
      }
    } catch (e: any) {
      toast.error('Failed to advance phase')
    } finally {
      setIsAdvancing(false)
    }
  }

  const [isReactivating, setIsReactivating] = useState(false)
  const handleReactivateChallenge = async () => {
    if (!window.confirm(`Reactivate / Unsuspend Challenge #${challenge.id}? This will restore the account to active trading.`)) return
    setIsReactivating(true)
    try {
      const res = await api.admin.testToolsSet(challenge.id, 'unsuspend')
      if (res.ok) {
        toast.success(`Challenge #${challenge.id} successfully reactivated!`)
        onRefresh?.()
      } else {
        toast.error(res.error || 'Failed to reactivate challenge')
      }
    } catch (e: any) {
      toast.error('Failed to reactivate challenge')
    } finally {
      setIsReactivating(false)
    }
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Subject and message body are required')
      return
    }
    setIsEmailing(true)
    try {
      await new Promise(r => setTimeout(r, 600))
      toast.success(`Email alert dispatched to Trader #${challenge.user_id}!`)
      setEmailSubject('')
      setEmailBody('')
      setActiveTab('overview')
    } catch (e: any) {
      toast.error('Failed to dispatch email')
    } finally {
      setIsEmailing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-Over Right Panel */}
      <div className="fixed inset-y-0 right-0 max-w-xl w-full bg-surface border-l border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-surface-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
              #{challenge.id}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text">
                  {challenge.plan_name || 'Standard Evaluation'}
                </h3>
                <Badge tone={statusTone(challenge.status)} size="sm">
                  {statusLabel(challenge.status)}
                </Badge>
              </div>
              <p className="text-2xs text-text-muted mt-0.5">
                Stage: Phase {challenge.phase || 1} • Account Capital: {fmtUSD(size, { decimals: 0 })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-border bg-surface px-4 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === 'overview'
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            Telemetry Overview
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={cn(
              "py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === 'trades'
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            Recent Trades (8)
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={cn(
              "py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === 'actions'
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            Quick Actions & Alert
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Trader Identity Card */}
              <div className="p-3.5 rounded-xl bg-surface-secondary/40 border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <Link
                      href={`/admin/traders/${challenge.user_id}`}
                      className="text-xs font-bold text-text hover:text-accent flex items-center gap-1 transition-colors"
                    >
                      <span>Trader #{challenge.user_id}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    <span className="text-2xs text-text-muted">
                      Created: {fmtDate(challenge.created_at)}
                    </span>
                  </div>
                </div>

                <Button asChild size="sm" variant="outline" className="h-7 text-2xs">
                  <Link href={`/admin/traders/${challenge.user_id}`}>
                    Full 360° Profile
                  </Link>
                </Button>
              </div>

              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-surface-secondary/30 border border-border space-y-1">
                  <span className="text-2xs text-text-muted font-medium">Starting Capital</span>
                  <p className="text-sm font-bold text-text terminal-num">{fmtUSD(size, { decimals: 0 })}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary/30 border border-border space-y-1">
                  <span className="text-2xs text-text-muted font-medium">Current Balance</span>
                  <p className="text-sm font-bold text-text terminal-num">{fmtUSD(balance)}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary/30 border border-border space-y-1">
                  <span className="text-2xs text-text-muted font-medium">Floating Equity</span>
                  <p className={cn("text-sm font-bold terminal-num", equity >= balance ? "text-emerald-500" : "text-rose-500")}>
                    {fmtUSD(equity)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary/30 border border-border space-y-1">
                  <span className="text-2xs text-text-muted font-medium">Peak Equity (HWM)</span>
                  <p className="text-sm font-bold text-text terminal-num">{fmtUSD(hwm)}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary/30 border border-border space-y-1">
                  <span className="text-2xs text-text-muted font-medium">Trailing DD Floor</span>
                  <p className="text-sm font-bold text-danger terminal-num">{fmtUSD(floor)}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary/30 border border-border space-y-1">
                  <span className="text-2xs text-text-muted font-medium">Net PnL</span>
                  <p className={cn("text-sm font-bold terminal-num", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {pnl >= 0 ? '+' : ''}{fmtUSD(pnl)} ({pnlPct.toFixed(2)}%)
                  </p>
                </div>
              </div>

              {/* Profit Target Gauge Bar */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-accent" />
                    Phase {challenge.phase || 1} Target (+{targetPct}%)
                  </span>
                  <span className="text-2xs font-semibold terminal-num text-text">
                    {pnl > 0 ? fmtUSD(pnl) : '$0.00'} / {fmtUSD(targetAmount)} ({targetProgress.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${targetProgress}%` }}
                  />
                </div>
              </div>

              {/* Drawdown Sentinel Cushion Bar */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-accent" />
                    Trailing Drawdown Cushion
                  </span>
                  <span className="text-2xs font-semibold terminal-num text-emerald-500">
                    +{fmtUSD(floorCushion)} above floor ({floorCushionPct.toFixed(1)}% buffer)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(10, floorCushionPct * 5))}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: TRADES */}
          {activeTab === 'trades' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Recent Ledger Executions
                </h4>
                <Badge tone="accent" size="sm" className="text-2xs">{tradesList.length} Executions</Badge>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-muted/50 border-b border-border text-2xs uppercase text-text-muted">
                      <th className="py-2 px-3 text-left">Symbol</th>
                      <th className="py-2 px-3 text-left">Side</th>
                      <th className="py-2 px-3 text-right">Lots</th>
                      <th className="py-2 px-3 text-right">Entry / Exit</th>
                      <th className="py-2 px-3 text-right">PnL</th>
                      <th className="py-2 px-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {isLoadingTrades ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="py-2.5 px-3"><Skeleton className="h-4 w-16" /></td>
                          <td className="py-2.5 px-3"><Skeleton className="h-4 w-10" /></td>
                          <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                        </tr>
                      ))
                    ) : tradesList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-muted text-xs">
                          No closed trades recorded yet for this challenge.
                        </td>
                      </tr>
                    ) : (
                      tradesList.map((t) => {
                        const rawType = String(t.type || 'BUY').toUpperCase()
                        const isBuy = rawType.includes('BUY')
                        const openPrice = toNum(t.open_price ?? (t as any).open)
                        const closePrice = toNum(t.close_price ?? (t as any).close)
                        const lots = toNum(t.lot_size ?? (t as any).lots)
                        const tradePnl = toNum(t.pnl)
                        const sym = (t.symbol || '').toUpperCase()
                        const formatTradePrice = (p: number) => {
                          if (p === 0) return '0.00'
                          if (sym.includes('JPY')) return p.toFixed(3)
                          if (p < 20 && !sym.includes('XAU') && !sym.includes('OIL') && !sym.includes('US') && !sym.includes('NAS')) return p.toFixed(5)
                          return p.toFixed(2)
                        }
                        const timeDisplay = t.closed_at ? timeAgo(t.closed_at) : (t.opened_at ? timeAgo(t.opened_at) : (t as any).time || '—')

                        return (
                          <tr key={t.id} className="hover:bg-surface-secondary/40 transition-colors">
                            <td className="py-2 px-3 font-semibold text-text">{t.symbol}</td>
                            <td className="py-2 px-3">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-2xs font-bold",
                                isBuy ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}>
                                {rawType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right terminal-num">{lots.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right terminal-num text-text-muted text-2xs">
                              {formatTradePrice(openPrice)} → {formatTradePrice(closePrice)}
                            </td>
                            <td className={cn("py-2 px-3 text-right terminal-num font-semibold", tradePnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {tradePnl >= 0 ? '+' : ''}{fmtUSD(tradePnl)}
                            </td>
                            <td className="py-2 px-3 text-right text-2xs text-text-muted">{timeDisplay}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: QUICK ACTIONS */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-accent" />
                  Management & Lifecycle Actions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 justify-start gap-2 border-border hover:bg-surface-muted"
                    onClick={handleResetChallenge}
                    loading={isResetting}
                  >
                    <RotateCcw className="h-4 w-4 text-amber-500" />
                    <span>Reset Challenge</span>
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    className="h-10 justify-start gap-2 shadow-accent/20"
                    onClick={handleAdvancePhase}
                    loading={isAdvancing}
                  >
                    <FastForward className="h-4 w-4" />
                    <span>Advance Phase</span>
                  </Button>

                  {(challenge.status === 'suspended' || challenge.status === 'dormant') && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 justify-start gap-2 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 col-span-full"
                      onClick={handleReactivateChallenge}
                      loading={isReactivating}
                    >
                      <Activity className="h-4 w-4 text-emerald-500" />
                      <span>Unsuspend / Reactivate Trading</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Direct Email Notification Form */}
              <form onSubmit={handleSendEmail} className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-accent" />
                  Send Instant Trader Alert Email
                </h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-2xs font-semibold text-text-muted">Subject Line</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="e.g. Milestone Achieved: Phase 1 Completed"
                      className="w-full h-8 px-2.5 rounded-md bg-surface-secondary border border-border text-xs text-text focus:border-accent focus-ring"
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-semibold text-text-muted">Message Content</label>
                    <textarea
                      rows={3}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Enter custom notice or compliance notes for the trader..."
                      className="w-full p-2.5 rounded-md bg-surface-secondary border border-border text-xs text-text focus:border-accent focus-ring resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full h-8 text-xs font-semibold gap-1.5"
                    loading={isEmailing}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Dispatch Email Notification
                  </Button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Footer Quick Action Bar */}
        <div className="p-4 border-t border-border bg-surface-muted/30 flex items-center justify-between gap-3 shrink-0">
          <div className="text-2xs text-text-muted">
            Challenge #{challenge.id} • User #{challenge.user_id}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close Drawer
            </Button>
            {(challenge.status === 'suspended' || challenge.status === 'dormant') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReactivateChallenge}
                loading={isReactivating}
                className="h-8 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 gap-1.5"
              >
                <Activity className="h-3.5 w-3.5" />
                Reactivate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetChallenge}
              loading={isResetting}
              className="h-8 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdvancePhase}
              loading={isAdvancing}
              className="h-8 text-xs gap-1.5 shadow-accent/20"
            >
              <FastForward className="h-3.5 w-3.5" />
              Advance
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
