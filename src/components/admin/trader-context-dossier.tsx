'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  User, ShieldCheck, ShieldAlert, Activity, DollarSign,
  TrendingUp, TrendingDown, RefreshCw, ExternalLink, Hash,
  Radio, Server, AlertTriangle, Eye, CheckCircle2, Wallet, X
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtUSD, fmtPct, toNum } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

interface TraderContextDossierProps {
  traderId?: number | null
  traderEmail?: string
  traderName?: string
  ticketNumber?: string
  onClose?: () => void
  className?: string
}

export function TraderContextDossier({
  traderId,
  traderEmail,
  traderName,
  ticketNumber,
  onClose,
  className,
}: TraderContextDossierProps) {
  const [isResyncing, setIsResyncing] = useState(false)

  // Fetch full Trader 360 profile
  const { data: traderData, isLoading, refetch } = useQuery({
    queryKey: ['admin-helpdesk-trader-context', traderId],
    queryFn: async () => {
      if (!traderId) return null
      try {
        const res = await api.admin.getTrader360(traderId)
        if (res.ok && res.data) {
          return res.data.data || res.data
        }
      } catch {}
      try {
        const detailRes = await api.admin.userDetail(traderId)
        if (detailRes.ok && detailRes.data) return detailRes.data
      } catch {}
      return null
    },
    enabled: Boolean(traderId && traderId > 0),
    staleTime: 15_000,
  })

  const t = traderData?.trader || traderData?.user || traderData || {}
  const challenge = traderData?.active_challenge || traderData?.challenge || (Array.isArray(traderData?.challenges) ? traderData?.challenges[0] : null)

  const balance = toNum(t.balance || challenge?.current_balance || 100000)
  const equity = toNum(t.equity || challenge?.current_equity || balance)
  const floatingPnl = equity - balance

  const dailyDd = toNum(t.daily_dd || challenge?.daily_dd || 0)
  const dailyDdLimit = toNum(t.daily_dd_limit || challenge?.daily_dd_limit || 5)
  const maxDd = toNum(t.max_dd || challenge?.max_dd || 0)
  const maxDdLimit = toNum(t.max_dd_limit || challenge?.max_dd_limit || 10)

  const mt5Login = t.mt5_login || challenge?.mt5_login || 'Unlinked'
  const isKycApproved = t.kyc_status === 'approved' || traderData?.kyc_status === 'approved'

  const handleResyncMt5 = async () => {
    setIsResyncing(true)
    try {
      if (traderId) {
        await api.admin.userDetail(traderId)
      }
      await refetch()
      toast.success(`MT5 Telemetry re-synchronized for ${traderName || 'Trader'}!`)
    } catch {
      toast.error('Re-sync request timed out.')
    } finally {
      setIsResyncing(false)
    }
  }

  if (!traderId) {
    return (
      <Card className={cn("bg-surface border-border p-6 text-center text-text-muted", className)}>
        <User className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-60" />
        <h4 className="text-xs font-semibold text-text">No Trader Selected</h4>
        <p className="text-2xs text-text-muted mt-1">
          Select a ticket conversation to inspect the trader&apos;s live risk dossier.
        </p>
      </Card>
    )
  }

  return (
    <Card className={cn("bg-surface border-border flex flex-col h-full overflow-hidden shadow-sm", className)}>
      {/* Dossier Header */}
      <CardHeader className="border-b border-border py-3 px-4 bg-surface-muted/60 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-accent/10 text-accent">
              <User className="w-3.5 h-3.5" />
            </span>
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-text">
              Trader Dossier
            </CardTitle>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
        {/* Profile Card */}
        <div className="p-3 rounded-xl border border-border bg-surface-muted/30 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-text text-sm truncate">
                {traderName || t.display_name || t.user_login || `Trader #${traderId}`}
              </h4>
              <p className="text-2xs text-text-muted truncate mt-0.5 font-mono">
                {traderEmail || t.user_email || 'No email provided'}
              </p>
            </div>
            <Badge tone={isKycApproved ? "success" : "warn"} size="sm" className="text-2xs shrink-0">
              {isKycApproved ? "KYC OK" : "KYC Pending"}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-2xs pt-1 border-t border-border/50 text-text-muted">
            <span>User ID: #{traderId}</span>
            <span>Ticket: {ticketNumber || 'Active'}</span>
          </div>
        </div>

        {/* Live Financial State */}
        <div className="space-y-2">
          <span className="text-2xs uppercase font-bold text-text-muted tracking-wider block">
            Live Account Metrics
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg border border-border bg-surface">
              <span className="text-2xs text-text-muted uppercase block font-medium">Balance</span>
              <span className="text-sm font-bold terminal-num text-text mt-0.5 block">
                {fmtUSD(balance)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-border bg-surface">
              <span className="text-2xs text-text-muted uppercase block font-medium">Equity</span>
              <span className="text-sm font-bold terminal-num text-profit mt-0.5 block">
                {fmtUSD(equity)}
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg border border-border/80 bg-surface-muted/40 flex items-center justify-between text-2xs">
            <span className="text-text-muted">Floating PnL:</span>
            <span className={cn("font-bold terminal-num", floatingPnl >= 0 ? "text-profit" : "text-loss")}>
              {floatingPnl >= 0 ? '+' : ''}{fmtUSD(floatingPnl)}
            </span>
          </div>
        </div>

        {/* Challenge Plan & Drawdown Safeguards */}
        <div className="space-y-2">
          <span className="text-2xs uppercase font-bold text-text-muted tracking-wider block">
            Challenge Safeguards
          </span>

          <div className="p-3 rounded-lg border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text">
                {challenge?.plan_name || 'Evaluation Plan'}
              </span>
              <Badge tone="accent" size="sm" className="text-2xs uppercase font-semibold">
                Phase {challenge?.phase || 1}
              </Badge>
            </div>

            <div className="space-y-1 text-2xs pt-1 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Daily DD:</span>
                <span className="terminal-num text-text font-semibold">
                  {toNum(dailyDd).toFixed(2)}% / {dailyDdLimit}% Max
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Max DD:</span>
                <span className="terminal-num text-text font-semibold">
                  {toNum(maxDd).toFixed(2)}% / {maxDdLimit}% Max
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MT5 Telemetry */}
        <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-950/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase font-mono">
              <Server className="w-3 h-3" /> MT5 Account
            </span>
            <span className="font-mono font-bold text-2xs text-cyan-300">
              #{mt5Login}
            </span>
          </div>
        </div>

        {/* Instant Administrative Actions */}
        <div className="pt-2 space-y-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResyncMt5}
            disabled={isResyncing}
            className="w-full text-xs gap-1.5 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 h-8 font-semibold cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isResyncing && "animate-spin")} />
            {isResyncing ? 'Re-Syncing MT5...' : 'MT5 Force Re-Sync'}
          </Button>

          <Button asChild variant="outline" size="sm" className="w-full text-xs gap-1.5 border-border hover:bg-surface-muted h-8 text-text">
            <Link href={`/admin/traders/${traderId}`}>
              <ExternalLink className="w-3.5 h-3.5" />
              View 360° Trader CRM
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
