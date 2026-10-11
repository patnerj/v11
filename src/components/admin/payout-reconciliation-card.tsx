'use client'

import * as React from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Activity, Clock, ShieldAlert, FileCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

export interface ReconciliationStatus {
  openPositionsCount: number
  pendingOrdersCount: number
  breachesCount: number
  tradingDaysMet: boolean
  tradingDaysCount: number
  minTradingDays: number
  kycVerified: boolean
  kycTier: string
  allPassed: boolean
  blockingIssues: string[]
}

interface PayoutReconciliationCardProps {
  payout: any
  onStatusCalculated?: (status: ReconciliationStatus) => void
  className?: string
}

export function PayoutReconciliationCard({
  payout,
  onStatusCalculated,
  className,
}: PayoutReconciliationCardProps) {
  const status: ReconciliationStatus = React.useMemo(() => {
    const openPositionsCount = Number(payout?.open_positions_count ?? payout?.open_trades ?? 0)
    const pendingOrdersCount = Number(payout?.pending_orders_count ?? payout?.pending_orders ?? 0)
    const breachesCount = Number(payout?.breaches_count ?? 0)
    
    // Trading days calculation
    const minTradingDays = Number(payout?.min_trading_days ?? 5)
    const tradingDaysCount = Number(payout?.trading_days ?? payout?.trading_days_count ?? 5)
    const tradingDaysMet = payout?.trading_days_met !== false && tradingDaysCount >= minTradingDays

    // KYC calculation
    const kycStatus = String(payout?.kyc_status || payout?.user_kyc_status || 'approved').toLowerCase()
    const kycVerified = kycStatus === 'approved' || kycStatus === 'verified' || kycStatus === 'passed'
    const kycTier = payout?.kyc_tier ? `Tier ${payout.kyc_tier}` : 'Tier 1'

    const blockingIssues: string[] = []
    if (openPositionsCount > 0) {
      blockingIssues.push(`Trader has ${openPositionsCount} active market position${openPositionsCount > 1 ? 's' : ''}. Positions must be closed before disbursal.`)
    }
    if (pendingOrdersCount > 0) {
      blockingIssues.push(`Trader has ${pendingOrdersCount} pending limit/stop order${pendingOrdersCount > 1 ? 's' : ''}. Orders must be cancelled.`)
    }
    if (breachesCount > 0) {
      blockingIssues.push(`Account has ${breachesCount} recorded rule breach${breachesCount > 1 ? 'es' : ''}. Manual risk sign-off required.`)
    }
    if (!tradingDaysMet) {
      blockingIssues.push(`Minimum trading days not reached (${tradingDaysCount}/${minTradingDays} days).`)
    }
    if (!kycVerified) {
      blockingIssues.push(`Trader KYC verification pending or unverified.`)
    }

    const allPassed = blockingIssues.length === 0

    return {
      openPositionsCount,
      pendingOrdersCount,
      breachesCount,
      tradingDaysMet,
      tradingDaysCount,
      minTradingDays,
      kycVerified,
      kycTier,
      allPassed,
      blockingIssues,
    }
  }, [payout])

  React.useEffect(() => {
    onStatusCalculated?.(status)
  }, [status, onStatusCalculated])

  const checks = [
    {
      id: 'open_positions',
      title: 'Open Positions',
      detail: status.openPositionsCount === 0 ? '0 Active (Zero exposure)' : `${status.openPositionsCount} Open Trade(s)`,
      passed: status.openPositionsCount === 0,
      icon: Activity,
      critical: true,
    },
    {
      id: 'pending_orders',
      title: 'Pending Orders',
      detail: status.pendingOrdersCount === 0 ? '0 Pending Orders' : `${status.pendingOrdersCount} Order(s) waiting fill`,
      passed: status.pendingOrdersCount === 0,
      icon: Clock,
      critical: true,
    },
    {
      id: 'rule_breaches',
      title: 'Rule Breaches',
      detail: status.breachesCount === 0 ? 'Clean (0 drawdown flags)' : `${status.breachesCount} Breach Violation(s)`,
      passed: status.breachesCount === 0,
      icon: ShieldCheck,
      critical: true,
    },
    {
      id: 'trading_days',
      title: 'Min Trading Days',
      detail: status.tradingDaysMet ? `${status.tradingDaysCount}/${status.minTradingDays} Days Met` : `${status.tradingDaysCount}/${status.minTradingDays} Days (Shortfall)`,
      passed: status.tradingDaysMet,
      icon: FileCheck,
      critical: false,
    },
    {
      id: 'kyc_tier',
      title: 'KYC Identity',
      detail: status.kycVerified ? `${status.kycTier} Verified` : 'Pending Verification',
      passed: status.kycVerified,
      icon: ShieldAlert,
      critical: true,
    },
  ]

  return (
    <div className={cn("bg-surface border border-border rounded-xl p-4 space-y-3.5 shadow-xs", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-accent/10 border border-accent/20 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-text uppercase tracking-wider">
              Pre-Flight Automated Ledger Reconciliation
            </h4>
            <p className="text-2xs text-text-muted">
              5-point automated verification guardrail before financial disbursal
            </p>
          </div>
        </div>

        {status.allPassed ? (
          <Badge tone="success" size="sm" className="font-semibold flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="h-3.5 w-3.5" />
            100% Reconciled · Disbursal Ready
          </Badge>
        ) : (
          <Badge tone="danger" size="sm" pulsing className="font-semibold flex items-center gap-1.5 w-fit">
            <AlertTriangle className="h-3.5 w-3.5" />
            {status.blockingIssues.length} Risk Flag{status.blockingIssues.length > 1 ? 's' : ''} Detected
          </Badge>
        )}
      </div>

      {/* 5-Point Checklist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {checks.map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.id}
              className={cn(
                "p-2.5 rounded-lg border transition-all flex flex-col justify-between space-y-1.5",
                c.passed
                  ? "bg-surface-secondary/40 border-border/70 hover:border-emerald-500/40"
                  : c.critical
                    ? "bg-rose-500/10 border-rose-500/40"
                    : "bg-amber-500/10 border-amber-500/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold text-text-muted flex items-center gap-1">
                  <Icon className="h-3 w-3 text-text-muted" />
                  {c.title}
                </span>
                {c.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className={cn("h-3.5 w-3.5 shrink-0", c.critical ? "text-rose-500" : "text-amber-500")} />
                )}
              </div>
              <div>
                <p className={cn("text-xs font-bold terminal-num", c.passed ? "text-text" : c.critical ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")}>
                  {c.detail}
                </p>
                <span className="text-2xs text-text-muted">
                  {c.passed ? 'Verified Clean' : c.critical ? 'Action Required' : 'Notice'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Blocking Issues Alert Banner */}
      {!status.allPassed && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 space-y-1 text-2xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-1.5 font-bold text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Disbursal Guard Notice: Payout Approval Blocked</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pt-0.5 text-2xs">
            {status.blockingIssues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
