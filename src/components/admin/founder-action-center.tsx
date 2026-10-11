'use client'

import * as React from 'react'
import Link from 'next/link'
import { Wallet, ShieldAlert, MessageSquare, ArrowRight, CheckCircle2, Sparkles, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ActionCenterProps {
  pendingPayoutsCount: number
  pendingPayoutsAmount: number
  pendingPayoutsGross?: number
  pendingPayoutsNet?: number
  riskBreachesCount: number
  totalRiskAlerts?: number
  urgentTicketsCount: number
  onOpenPayoutReview?: () => void
}

export function FounderActionCenter({
  pendingPayoutsCount = 0,
  pendingPayoutsAmount = 0,
  pendingPayoutsGross,
  pendingPayoutsNet,
  riskBreachesCount = 0,
  totalRiskAlerts,
  urgentTicketsCount = 0,
  onOpenPayoutReview,
}: ActionCenterProps) {
  const displayGross = pendingPayoutsGross ?? pendingPayoutsAmount
  const displayNet = pendingPayoutsNet ?? (displayGross * 0.8)
  const displayAlerts = totalRiskAlerts ?? riskBreachesCount
  const allClear = pendingPayoutsCount === 0 && riskBreachesCount === 0 && urgentTicketsCount === 0

  if (allClear) {
    return (
      <div className="bg-surface border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-text">All Systems Operational</h4>
              <Badge tone="success" size="sm">100% Caught Up</Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">0 pending payouts • 0 unhandled risk alerts across 0 accounts • Support queue cleared</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/traders"
            className="px-3.5 py-1.5 rounded-lg bg-surface-muted border border-border hover:border-emerald-500/40 text-xs font-semibold text-text-muted hover:text-text transition-colors flex items-center gap-1.5"
          >
            <span>View Traders Hub</span>
            <ExternalLink className="w-3.5 h-3.5 text-text-subtle" />
          </Link>
        </div>
      </div>
    )
  }

  const totalUrgentItems = (pendingPayoutsCount > 0 ? 1 : 0) + (riskBreachesCount > 0 ? 1 : 0) + (urgentTicketsCount > 0 ? 1 : 0)

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-text tracking-tight">Founder&apos;s Morning Action Center</h3>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            High-priority operational items requiring executive approval or review today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent" size="sm">
            {totalUrgentItems} Action {totalUrgentItems > 1 ? 'Categories' : 'Category'} Pending
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Treasury Card */}
        <div 
          onClick={onOpenPayoutReview}
          className="group p-4 rounded-xl bg-surface-muted border border-emerald-500/30 hover:border-emerald-500/70 cursor-pointer transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Treasury Action</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-text mt-1.5 tabular">
              ${displayGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Gross
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {pendingPayoutsCount > 0 ? (
                <span>
                  ${displayNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Net (@ 80%) • {pendingPayoutsCount} withdrawal{pendingPayoutsCount > 1 ? 's' : ''} in queue
                </span>
              ) : 'No pending payout requests'}
            </p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500">
            <span>Review & Approve Payouts</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 2. Risk Card */}
        <Link 
          href="/admin/risk"
          className="group p-4 rounded-xl bg-surface-muted border border-amber-500/30 hover:border-amber-500/70 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Risk Audit</span>
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-text mt-1.5 tabular">
              {displayAlerts} Active Alert{displayAlerts === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {displayAlerts > 0 ? `${displayAlerts} active alerts across ${riskBreachesCount} flagged account${riskBreachesCount === 1 ? '' : 's'}` : 'Zero active risk breaches detected'}
            </p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:text-amber-500">
            <span>Inspect Risk Alerts</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 3. Support Card */}
        <Link 
          href="/admin/helpdesk"
          className="group p-4 rounded-xl bg-surface-muted border border-blue-500/30 hover:border-blue-500/70 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Trader Support</span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-text mt-1.5 tabular">
              {urgentTicketsCount} Active Ticket{urgentTicketsCount === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {urgentTicketsCount > 0 ? 'Inquiries awaiting admin reply in helpdesk' : 'All trader support inquiries answered'}
            </p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-500">
            <span>Open Support Desk</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  )
}
