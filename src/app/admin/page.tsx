'use client'

import * as React from 'react'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  DollarSign, Users, Target, Award, LineChart, Activity, Wallet, CreditCard,
  ArrowUpRight, ArrowDownRight, AlertTriangle, ArrowRight, BookOpen, Loader2,
  CheckCircle2, Clock, ShieldAlert, Zap, PlusCircle, ShieldCheck, RefreshCw,
  ExternalLink, Copy, Check, Filter, Layers, Flame, TrendingUp, HelpCircle, Rocket,
  PiggyBank, Scale
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, Legend
} from 'recharts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, ColumnDef } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Input, Label } from '@/components/ui/input'
import { FounderActionCenter } from '@/components/admin/founder-action-center'
import { Mt5GatewayMonitorCard } from '@/components/admin/mt5-gateway-monitor-card'
import { PriceFeedHealthCard } from '@/components/admin/price-feed-health-card'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import { toNum } from '@/lib/format'
import { APP_DISPLAY_VERSION } from '@/lib/version'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { Skeleton } from '@/components/ui/skeleton'

// Helper formatters
function formatCurrency(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatInt(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseInt(val, 10) : (val ?? 0)
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

// Default clean baseline series when no transaction data exists
const DEFAULT_REVENUE_SERIES: Array<{ name: string; revenue: number; payouts: number; profit: number }> = [
  { name: 'Mar', revenue: 0, payouts: 0, profit: 0 },
  { name: 'Apr', revenue: 0, payouts: 0, profit: 0 },
  { name: 'May', revenue: 0, payouts: 0, profit: 0 },
  { name: 'Jun', revenue: 0, payouts: 0, profit: 0 },
  { name: 'Jul', revenue: 0, payouts: 0, profit: 0 },
  { name: 'Aug', revenue: 0, payouts: 0, profit: 0 },
]

const DEFAULT_GROWTH_SERIES: Array<{ name: string; registrations: number; passes: number; passRate: string }> = [
  { name: 'Mar', registrations: 0, passes: 0, passRate: '0%' },
  { name: 'Apr', registrations: 0, passes: 0, passRate: '0%' },
  { name: 'May', registrations: 0, passes: 0, passRate: '0%' },
  { name: 'Jun', registrations: 0, passes: 0, passRate: '0%' },
  { name: 'Jul', registrations: 0, passes: 0, passRate: '0%' },
  { name: 'Aug', registrations: 0, passes: 0, passRate: '0%' },
]

export default function AdminCommandCenter() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // State for interactive modals
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false)
  const [payoutReviewModalOpen, setPayoutReviewModalOpen] = useState(false)
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null)
  const [isEmergencyPaused, setIsEmergencyPaused] = useState(false)
  const [emergencyReason, setEmergencyReason] = useState('High Impact Economic News Event - Temporary Trading Lock')
  
  // Issue Manual Challenge Form State
  // planId is a real fxsim_challenge_plans.id — 0 means "not yet chosen" (falls
  // back to the cheapest active plan server-side if left unset).
  const [issueForm, setIssueForm] = useState({
    email: '',
    planId: 0,
    phase: '1' as '1' | 'phase2' | 'funded',
    balance: '100000',
  })
  const [issuingLoading, setIssuingLoading] = useState(false)
  const [payoutActionLoading, setPayoutActionLoading] = useState(false)
  const [txRefInput, setTxRefInput] = useState('')
  const [payoutRejectReason, setPayoutRejectReason] = useState('')
  const [isPausingLoading, setIsPausingLoading] = useState(false)

  // Chart time range filter & SSR hydration mount guard
  const [chartRange, setChartRange] = useState<'7m' | '1y' | 'all'>('7m')
  const [chartsMounted, setChartsMounted] = useState(false)

  useEffect(() => {
    setChartsMounted(true)
  }, [])

  // Hydrate firm-wide emergency freeze state from backend
  useEffect(() => {
    Promise.all([
      api.admin.whitelabelGet(),
      api.admin.newsLockGet()
    ]).then(([wlRes, newsRes]) => {
      const wlData = wlRes.ok ? (wlRes.data as any) : {}
      const pauseTrading = wlData?.pause_trading === '1' || wlData?.pause_trading === 1 || wlData?.pause_trading === true
      const newsLocked = Boolean(newsRes.ok && newsRes.data?.locked)
      setIsEmergencyPaused(pauseTrading || newsLocked)
    }).catch(err => {
      console.error('Failed to hydrate emergency freeze state', err)
    })
  }, [])

  // API Queries with parallel fetching & defensive normalization (AGENTS.md Rule 1.2)
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.admin.stats().then(res => res.ok ? res.data : null),
    staleTime: 15000,
  })

  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => api.admin.analyticsRevenue().then(res => res.ok ? res.data : null),
    staleTime: 30000,
  })

  const { data: growth, isLoading: growthLoading } = useQuery({
    queryKey: ['admin-growth'],
    queryFn: () => api.admin.analyticsGrowth().then(res => res.ok ? res.data : null),
    staleTime: 30000,
  })

  const { data: riskData } = useQuery({
    queryKey: ['admin-risk'],
    queryFn: () => api.admin.risk().then(res => res.ok ? res.data : null),
    staleTime: 15000,
  })

  const { data: payoutsList, isLoading: payoutsLoading } = useQuery({
    queryKey: ['admin-payouts-list', 'pending'],
    queryFn: () => api.admin.payoutsList('pending').then(res => {
      if (!res.ok) return []
      if (Array.isArray(res.data)) return res.data
      if (res.data && Array.isArray((res.data as any).payouts)) return (res.data as any).payouts
      return []
    }),
    staleTime: 10000,
  })

  const { data: challengesData, isLoading: challengesLoading } = useQuery({
    queryKey: ['admin-challenges'],
    queryFn: () => api.admin.challenges().then(res => {
      if (!res.ok) return []
      if (Array.isArray(res.data)) return res.data
      if (res.data && Array.isArray((res.data as any).challenges)) return (res.data as any).challenges
      return []
    }),
    staleTime: 10000,
  })

  const { data: kycList } = useQuery({
    queryKey: ['admin-kyc-pending'],
    queryFn: () => api.admin.kycList('pending').then(res => {
      if (!res.ok) return []
      if (Array.isArray(res.data)) return res.data
      return []
    }),
    staleTime: 15000,
  })

  const { data: riskAlertsData } = useQuery({
    queryKey: ['admin-risk-alerts-action-center'],
    queryFn: () => api.admin.riskAlerts().then(res => res.ok ? res.data : null),
    staleTime: 10000,
  })

  const { data: ticketsList = [] } = useQuery({
    queryKey: ['admin-tickets-action-center'],
    queryFn: () => api.admin.tickets.list({ status: 'open' }).then(res => res.ok && Array.isArray(res.data) ? res.data : []),
    staleTime: 10000,
  })

  // Real challenge plans for the Issue Manual Challenge modal
  const { data: plansList = [] } = useQuery({
    queryKey: ['admin-plans-issue-modal'],
    queryFn: () => api.admin.plansList().then(res => {
      if (!res.ok) return []
      if (Array.isArray(res.data)) return res.data
      return []
    }),
    staleTime: 30000,
  })
  const activePlans = useMemo(() => {
    const list = Array.isArray(plansList) ? plansList : []
    return list.filter((p: any) => p && p.is_active !== false && p.is_active !== 0)
  }, [plansList])
  const selectedPlan = useMemo(() => activePlans.find((p: any) => p.id === issueForm.planId) || activePlans[0] || null, [activePlans, issueForm.planId])

  // Default to the first active plan once the list loads
  useEffect(() => {
    if (!issueForm.planId && activePlans.length > 0) {
      setIssueForm((f) => ({ ...f, planId: activePlans[0].id, balance: String(activePlans[0].account_size) }))
    }
  }, [activePlans, issueForm.planId])

  // Founder Action Center calculated values (defensively normalized)
  const safePayoutsList = useMemo(() => Array.isArray(payoutsList) ? payoutsList : [], [payoutsList])
  const pendingPayoutsCount = safePayoutsList.length
  const pendingPayoutsAmount = useMemo(() => {
    return safePayoutsList.reduce((acc: number, p: any) => acc + Number(p.amount_requested || p.amount || 0), 0)
  }, [safePayoutsList])

  const riskBreachesCount = riskAlertsData ? (riskAlertsData.open_flags ?? (((Array.isArray(riskAlertsData.hft_risks) ? riskAlertsData.hft_risks.length : 0)) + ((Array.isArray(riskAlertsData.gambling_risks) ? riskAlertsData.gambling_risks.length : 0)))) : 0
  const urgentTicketsCount = Array.isArray(ticketsList) ? ticketsList.length : 0

  // 1. Metric Grid Calculation
  const totalRev = Number(revenue?.total ?? (stats?.total_revenue ?? 0))
  const activeTraders = Number(stats?.users ?? 0)
  const activeChallenges = Number(stats?.active_challenges ?? 0)
  const fundedCapital = Number(riskData?.funded_capital ?? ((stats?.funded_accounts || 0) * 50000))
  const openPositions = Number(stats?.open_positions ?? 0)
  const totalTrades = Number(stats?.total_trades ?? 0)
  const realisedPnl = Number(stats?.total_pnl ?? 0)
  const pendingPayoutVal = Number(riskData?.pending_payout_value ?? pendingPayoutsAmount)

  // Executive Financial Health calculations
  const retainedMarginPct = totalRev > 0 
    ? `${Math.max(0, Math.min(100, Math.round(((totalRev - pendingPayoutVal) / totalRev) * 100)))}.0%` 
    : '100.0%'
  const coverageRatio = pendingPayoutVal > 0 
    ? `${(totalRev / pendingPayoutVal).toFixed(1)}x (${totalRev / pendingPayoutVal >= 2 ? 'Safe' : (totalRev / pendingPayoutVal >= 1 ? 'Adequate' : 'Low Reserve')})` 
    : (totalRev > 0 ? '10x+ (Safe)' : 'N/A')

  // Dynamic MoM Revenue Growth
  const revenueTrend = useMemo(() => {
    const monthly = (revenue && typeof revenue === 'object' && Array.isArray(revenue.monthly)) ? revenue.monthly : []
    if (monthly.length >= 2) {
      const cur = Number(monthly[monthly.length - 1]?.total || (monthly[monthly.length - 1] as any)?.amount || 0)
      const prev = Number(monthly[monthly.length - 2]?.total || (monthly[monthly.length - 2] as any)?.amount || 0)
      if (prev > 0) {
        const pct = ((cur - prev) / prev) * 100
        return `${pct >= 0 ? '+' : ''}${toNum(pct).toFixed(1)}% MoM`
      } else if (cur > 0) {
        return '+100% MoM'
      }
    }
    return totalRev > 0 ? 'Live' : '0.0%'
  }, [revenue, totalRev])

  const SUMMARY_METRICS = [
    {
      title: 'Total Revenue',
      value: formatCurrency(totalRev),
      subtitle: 'Net challenge fees & add-ons',
      trend: revenueTrend,
      tone: 'accent' as const,
      icon: DollarSign,
    },
    {
      title: 'Active Traders',
      value: formatInt(activeTraders),
      subtitle: 'Verified active user accounts',
      trend: activeTraders > 0 ? `${activeTraders} Active` : '0 Active',
      tone: 'accent' as const,
      icon: Users,
    },
    {
      title: 'Active Challenges',
      value: formatInt(activeChallenges),
      subtitle: 'Phase 1 & Phase 2 in progress',
      trend: activeChallenges > 0 ? `${activeChallenges} Active` : '0 Active',
      tone: 'accent' as const,
      icon: Target,
    },
    {
      title: 'Total Funded Capital',
      value: formatCurrency(fundedCapital),
      subtitle: 'Allocated to prop traders',
      trend: fundedCapital > 0 ? formatCurrency(fundedCapital) : '$0',
      tone: 'accent' as const,
      icon: Award,
    },
    {
      title: 'Open Positions',
      value: formatInt(openPositions),
      subtitle: 'Floating trades in market',
      trend: 'Live',
      tone: 'info' as const,
      icon: Activity,
    },
    {
      title: 'Total Trades Executed',
      value: formatInt(totalTrades),
      subtitle: 'Platform lifetime volume',
      trend: totalTrades > 0 ? formatInt(totalTrades) : '0 Trades',
      tone: 'accent' as const,
      icon: LineChart,
    },
    {
      title: 'Realised PnL (Firm)',
      value: `${realisedPnl >= 0 ? '+' : ''}${formatCurrency(realisedPnl)}`,
      subtitle: 'Net firm treasury result',
      trend: realisedPnl >= 0 ? '+0.0%' : '-0.0%',
      tone: realisedPnl >= 0 ? ('accent' as const) : ('danger' as const),
      icon: Wallet,
    },
    {
      title: 'Pending Payout Requests',
      value: formatCurrency(pendingPayoutVal),
      subtitle: 'Withdrawals in review queue',
      trend: `${pendingPayoutsCount} Pending`,
      tone: pendingPayoutsCount > 0 ? ('warning' as const) : ('neutral' as const),
      icon: CreditCard,
    },
  ]

  // 2. Charts Data Prep (Defensive Normalization - AGENTS.md Rule 1.2)
  const areaChartData = useMemo(() => {
    const monthly = Array.isArray(revenue?.monthly) ? revenue.monthly : []
    if (monthly.length > 0) {
      const sliceCount = chartRange === '7m' ? -7 : (chartRange === '1y' ? -12 : 0)
      const list = sliceCount === 0 ? monthly : monthly.slice(sliceCount)
      return list.map((m: any, idx: number) => {
        const rawRev = typeof m?.total === 'string' ? parseFloat(m.total) : (typeof m?.total === 'number' ? m.total : 0)
        const realPayout = typeof m?.payouts === 'number' ? m.payouts : 0
        return {
          name: m?.month ? m.month.split('-').slice(1).join('-') : `M${idx + 1}`,
          revenue: rawRev || 0,
          payouts: realPayout,
          profit: (rawRev || 0) - realPayout,
        }
      })
    }
    return DEFAULT_REVENUE_SERIES
  }, [revenue, chartRange])

  const barChartData = useMemo(() => {
    const newChallenges = Array.isArray(growth?.new_challenges) ? growth.new_challenges : []
    const fundedMonthly = Array.isArray(growth?.funded_monthly) ? growth.funded_monthly : []
    if (newChallenges.length > 0) {
      return newChallenges.map((item: any) => {
        const fundedMatch = fundedMonthly.find((f: any) => f?.month === item?.month)
        const passedCount = fundedMatch ? fundedMatch.count : 0
        const rate = (item?.count && item.count > 0) ? toNum((passedCount / item.count) * 100).toFixed(1) + '%' : '0%'
        return {
          name: item?.month ? item.month.split('-').slice(1).join('-') : 'Mo',
          registrations: item?.count || 0,
          passes: passedCount,
          passRate: rate,
        }
      }).slice(-6)
    }
    return DEFAULT_GROWTH_SERIES
  }, [growth])

  // Real aggregate pass-conversion rate across the months shown in the chart
  // above (sum of passes / sum of registrations) — not a fixed reference figure.
  const avgPassRate = useMemo(() => {
    const totals = barChartData.reduce(
      (acc, d) => ({ reg: acc.reg + (d.registrations || 0), pass: acc.pass + (d.passes || 0) }),
      { reg: 0, pass: 0 }
    )
    return totals.reg > 0 ? (totals.pass / totals.reg) * 100 : null
  }, [barChartData])

  interface PayoutRowItem {
    id: number
    challenge_id: number
    username?: string | null
    user_login?: string | null
    user_id?: number | null
    name?: string | null
    email?: string | null
    amount?: number | string | null
    amount_requested?: number | string | null
    method?: string | null
    payment_method?: string | null
    gateway?: string | null
    status?: string | null
    created_at?: string | null
    requested_at?: string | null
    profit_split_pct?: number | null
  }

  const payoutColumns: ColumnDef<PayoutRowItem>[] = [
    {
      key: 'trader',
      header: 'Trader',
      className: 'whitespace-nowrap',
      render: (row) => {
        const name = row.username || row.user_login || `Trader #${row.user_id || row.id}`
        const initial = name.charAt(0).toUpperCase()
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs">
              {initial}
            </div>
            <div>
              <p className="font-semibold text-text text-sm leading-tight">{name}</p>
              <p className="text-xs text-text-subtle tabular">ACC-{(row.challenge_id || row.id)}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'id',
      header: 'Payout ID',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="tabular font-medium text-xs text-text-muted bg-surface-muted px-2 py-1 rounded border border-border">
          #PAY-{row.id}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (row) => {
        const amt = row.amount_requested || row.amount || 0
        return (
          <div className="text-right terminal-num font-semibold text-sm text-profit">
            {formatCurrency(amt)}
          </div>
        )
      }
    },
    {
      key: 'gateway',
      header: 'Gateway',
      className: 'whitespace-nowrap',
      render: (row) => {
        const method = (row.payment_method || row.gateway || row.method || 'USDT TRC20').toUpperCase()
        return (
          <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-text-subtle" />
            {method}
          </span>
        )
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      className: 'whitespace-nowrap',
      render: (row) => (
        <Badge tone="warning" size="sm" pulsing>
          {row.status || 'Requested'}
        </Badge>
      )
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      className: 'whitespace-nowrap min-w-[80px]',
      render: (row) => (
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs border-accent/40 text-accent hover:bg-accent/10 hover:border-accent"
          onClick={() => {
            setSelectedPayout(row)
            setPayoutReviewModalOpen(true)
          }}
        >
          Review
        </Button>
      )
    }
  ]

  // 4. Recent Challenges Table Columns Definition
  interface ChallengeRowItem {
    id: number
    user_id?: number
    plan_name?: string
    starting_balance?: number | string
    balance?: number | string
    current_balance?: number | string
    phase?: number
    status?: string
    created_at?: string
  }

  const challengeColumns: ColumnDef<ChallengeRowItem>[] = [
    {
      key: 'trader',
      header: 'Trader Account',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center tabular font-bold text-xs">
            #{row.id}
          </div>
          <div>
            <p className="font-semibold text-text text-sm">ACC-{row.id}</p>
            <p className="text-xs text-text-subtle">User ID: {row.user_id ? `#${row.user_id}` : '—'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'plan',
      header: 'Plan Type',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-xs text-text-muted font-medium">
          {row.plan_name || '—'}
        </span>
      )
    },
    {
      key: 'capital',
      header: 'Capital',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (row) => {
        const cap = row.starting_balance || row.balance || row.current_balance
        return (
          <span className="terminal-num font-semibold text-xs text-text">
            {cap ? formatCurrency(cap) : '—'}
          </span>
        )
      }
    },
    {
      key: 'phase_status',
      header: 'Status',
      align: 'center',
      className: 'whitespace-nowrap',
      render: (row) => {
        const isFunded = row.status === 'funded' || row.phase === 3
        const isPhase2 = row.phase === 2
        return isFunded ? (
          <Badge tone="success" size="sm" pulsing>Funded</Badge>
        ) : isPhase2 ? (
          <Badge tone="info" size="sm">Phase 2</Badge>
        ) : (
          <Badge tone="accent" size="sm" pulsing>Phase 1</Badge>
        )
      }
    },
    {
      key: 'date',
      header: 'Registered',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (row) => {
        const dt = row.created_at ? new Date(row.created_at).toLocaleDateString() : 'Just now'
        return (
          <span className="text-xs text-text-muted tabular flex items-center justify-end gap-1">
            <Clock className="h-3 w-3 text-text-subtle" />
            {dt}
          </span>
        )
      }
    },
    {
      key: 'link',
      header: '',
      align: 'right',
      className: 'whitespace-nowrap w-8',
      render: (row) => (
        // Previously linked with row.id (the CHALLENGE id) into a route that
        // treats the param as a USER id — clicking through landed on an
        // unrelated trader's profile (or a phantom placeholder if that id
        // didn't exist as a user). row.user_id is the correct id for this route.
        row.user_id ? (
          <Link
            href={`/admin/traders/${row.user_id}`}
            className="text-text-muted hover:text-accent transition-colors p-1"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null
      )
    }
  ]

  // Handlers for quick actions
  const handleIssueChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueForm.email) {
      toast.error('Please specify a valid trader email address')
      return
    }
    setIssuingLoading(true)
    try {
      const res = await api.admin.createManualChallenge({
        email: issueForm.email,
        plan_id: issueForm.planId || undefined,
        starting_balance: Number(issueForm.balance) || undefined,
        initial_phase: issueForm.phase !== '1' ? issueForm.phase : undefined,
      })
      if (res.ok && res.data.success) {
        toast.success(res.data.message || `Challenge account #${res.data.account_id} issued to ${issueForm.email}`)
        setIssueModalOpen(false)
        setIssueForm({
          email: '',
          planId: activePlans[0]?.id || 0,
          phase: '1',
          balance: activePlans[0] ? String(activePlans[0].account_size) : '100000',
        })
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
        queryClient.invalidateQueries({ queryKey: ['admin-challenges'] })
        queryClient.invalidateQueries({ queryKey: ['admin-traders-list'] })
      } else {
        toast.error((!res.ok ? res.error : (res.data as any)?.message) || 'Failed to issue manual challenge')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to issue manual challenge')
    } finally {
      setIssuingLoading(false)
    }
  }

  const handleToggleEmergencyPause = async () => {
    const nextState = !isEmergencyPaused
    setIsPausingLoading(true)
    try {
      const [wlRes] = await Promise.all([
        api.admin.whitelabelSave({ pause_trading: nextState ? '1' : '0' }),
        api.admin.newsLock(nextState, emergencyReason)
      ])
      if (!wlRes.ok) {
        toast.error(wlRes.error || 'Failed to update emergency state')
        return
      }
      setIsEmergencyPaused(nextState)
      setEmergencyModalOpen(false)
      if (nextState) {
        toast.error('EMERGENCY PAUSE ACTIVATED: All live orders & trading execution halted firm-wide.', {
          duration: 5000,
        })
      } else {
        toast.success('TRADING RESUMED: Global execution locks released.', {
          duration: 4000,
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update emergency state')
    } finally {
      setIsPausingLoading(false)
    }
  }

  const handleProcessPayout = async (action: 'approve' | 'reject') => {
    if (!selectedPayout) return
    if (action === 'reject' && !payoutRejectReason.trim()) {
      toast.error('Please specify a rejection reason for the audit trail')
      return
    }
    setPayoutActionLoading(true)
    try {
      const note = payoutRejectReason.trim() || (action === 'approve' ? 'Approved from Command Center' : 'Rejected by Compliance Admin')
      const res = await api.admin.payoutStatus(
        selectedPayout.id,
        action === 'approve' ? 'approved' : 'rejected',
        note,
        txRefInput ? { tx_reference: txRefInput } : undefined
      )
      // fxsim() resolves { ok: false } rather than throwing, so a rejected
      // request (expired session, already-processed payout) never reached
      // the catch below — the modal closed and reported success while the
      // payout silently stayed pending. Mirrors the check PayoutManagementModal
      // already does correctly.
      if (!res.ok || (res.data as any)?.success === false) {
        toast.error((res as any).error || (res as any).data?.message || 'Failed to update payout status')
        return
      }
      toast.success(action === 'approve' ? `Payout #PAY-${selectedPayout.id} approved & queued for disbursement!` : `Payout #PAY-${selectedPayout.id} marked as rejected.`)
      setPayoutReviewModalOpen(false)
      setSelectedPayout(null)
      setTxRefInput('')
      setPayoutRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['admin-payouts-list'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payout status')
    } finally {
      setPayoutActionLoading(false)
    }
  }

  // Prepared data lists with authentic zero-data fallback
  const displayedPayouts = (payoutsList && Array.isArray(payoutsList) && payoutsList.length > 0) 
    ? payoutsList.slice(0, 5) 
    : []

  const displayedChallenges = (challengesData && Array.isArray(challengesData) && challengesData.length > 0)
    ? challengesData.slice(0, 5)
    : []

  return (
    <div className="space-y-8 pb-12">
      
      {/* ── Top Header Banner & Quick Refresh ──────────────────────────────── */}
      <PageHeader
        title="Command Center"
        description="Real-time operations, revenue stream, risk monitor, and fast execution dispatch."
        badge={{ label: `Live System ${APP_DISPLAY_VERSION}`, tone: 'accent' }}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isEmergencyPaused && (
              <Badge tone="danger" size="sm" pulsing>
                TRADING HALTED
              </Badge>
            )}
            <Link href="/admin/setup">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-border text-text-muted hover:text-text hover:bg-surface-muted gap-2 h-9"
              >
                <Rocket className="h-3.5 w-3.5 text-accent" />
                Setup Wizard
              </Button>
            </Link>

            <Button 
              variant="outline" 
              size="sm" 
              className="border-border text-text-muted hover:text-text hover:bg-surface-muted gap-2 h-9"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['admin'] })
                queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('admin') })
                refetchStats()
                toast.success('Command center metrics refreshed')
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 text-accent" />
              Refresh
            </Button>

            <Button 
              variant="primary" 
              size="sm" 
              className="gap-2 h-9 shadow-accent/20"
              onClick={() => setIssueModalOpen(true)}
            >
              <PlusCircle className="h-4 w-4" />
              Issue Challenge
            </Button>
          </div>
        }
      />

      {/* ── 0. Founder's Morning Action Center ───────────────────────────────── */}
      <SectionErrorBoundary sectionName="Founder Action Center">
        <FounderActionCenter
          pendingPayoutsCount={pendingPayoutsCount}
          pendingPayoutsAmount={pendingPayoutsAmount}
          riskBreachesCount={riskBreachesCount}
          urgentTicketsCount={urgentTicketsCount}
          onOpenPayoutReview={() => {
            if (displayedPayouts.length > 0) {
              setSelectedPayout(displayedPayouts[0])
              setPayoutReviewModalOpen(true)
            } else {
              toast.info('No pending payouts to review.')
            }
          }}
        />
      </SectionErrorBoundary>

      {/* ── 0.5 Executive Financial Health & Liability ──────────────────────── */}
      <SectionErrorBoundary sectionName="Executive Financial Health">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-accent" />
            Executive Financial Health & Liability
          </h2>
          <Badge tone="accent" size="sm" className="font-semibold text-2xs">Real-Time Treasury</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Gross Inflow */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Gross Capital Inflow
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold terminal-num text-text tracking-tight">
                  {formatCurrency(totalRev)}
                </h3>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-xs text-text-muted leading-tight block flex-1">
                  Challenge purchases & add-ons
                </span>
                <Badge tone="accent" size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  {revenueTrend}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Funded Payout Liability */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Funded Payout Liability
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-warn group-hover:border-warn/40 transition-colors">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold terminal-num text-warn tracking-tight">
                  {formatCurrency(pendingPayoutVal)}
                </h3>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-xs text-text-muted leading-tight block flex-1">
                  Pending & open profitable trades
                </span>
                <Badge tone={pendingPayoutsCount > 0 ? 'warning' : 'neutral'} size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  {pendingPayoutsCount} Pending
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Net Retained Firm Margin */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Retained Margin %
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-profit group-hover:border-profit/40 transition-colors">
                  <PiggyBank className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold terminal-num text-profit tracking-tight">
                  {retainedMarginPct}
                </h3>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-xs text-text-muted leading-tight block flex-1">
                  Retained after all payouts
                </span>
                <Badge tone="success" size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  Target &gt;85%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Net Exposure vs Bridge */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  A/B-Book Hedged Ratio
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors">
                  <Scale className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold terminal-num text-text tracking-tight">
                  {coverageRatio}
                </h3>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-xs text-text-muted leading-tight block flex-1">
                  Total exposure vs bridge
                </span>
                <Badge tone="neutral" size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  0 Flags
                </Badge>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>
      </SectionErrorBoundary>

      {/* ── 1. Top Metric Grid (8 Key Summary Cards) ─────────────────────────── */}
      <SectionErrorBoundary sectionName="Firm Performance KPIs">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            Firm Performance KPIs
          </h2>
          <span className="text-xs text-text-subtle">Updated real-time</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUMMARY_METRICS.map((metric, idx) => {
            const Icon = metric.icon
            return (
              <Card 
                key={idx} 
                className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                      {metric.title}
                    </span>
                    <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <h3 className="text-2xl font-bold terminal-num text-text tracking-tight">
                      {metric.value}
                    </h3>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-xs text-text-muted leading-tight block flex-1">
                      {metric.subtitle}
                    </span>
                    <Badge tone={metric.tone} size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                      {metric.trend}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
      </SectionErrorBoundary>

      {/* ── 2. Quick Action Grid (4 Operations Cards) ────────────────────────── */}
      <SectionErrorBoundary sectionName="Fast Dispatch Operations">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            Fast Dispatch Operations
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Action 1: Issue Manual Challenge */}
          <div 
            onClick={() => setIssueModalOpen(true)}
            className="cursor-pointer group block"
          >
            <Card className="bg-surface border-border hover:border-accent/60 hover:shadow-[0_0_20px_var(--accent-glow)] transition-all duration-200 h-full">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-accent/20 transition-all shadow-md shadow-accent/10">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-text group-hover:text-accent transition-colors flex items-center gap-1.5">
                    Issue Challenge
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                  </h4>
                  <p className="text-xs text-text-muted">Manual grant & bypass checkout</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action 2: Review KYC Queue */}
          <Link href="/admin/traders" className="group block">
            <Card className="bg-surface border-border hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-200 h-full">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-500/20 transition-all shadow-md shadow-blue-500/10">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-text group-hover:text-blue-400 transition-colors">
                      Review KYC Queue
                    </h4>
                    <span className="bg-blue-500/20 text-blue-400 text-2xs tabular font-bold px-1.5 py-0.2 rounded">
                      {kycList?.length ?? 0}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">ID & proof of address audits</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Action 3: Process Pending Payouts */}
          <Link href="/admin/payouts" className="group block">
            <Card className="bg-surface border-border hover:border-amber-500/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all duration-200 h-full">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-500/20 transition-all shadow-md shadow-amber-500/10">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-text group-hover:text-amber-400 transition-colors">
                      Process Payouts
                    </h4>
                    <span className="bg-amber-500/20 text-amber-400 text-2xs tabular font-bold px-1.5 py-0.2 rounded">
                      {payoutsList?.length ?? 0}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">Audit trader profit shares</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Action 4: Emergency Pause Trading */}
          <div 
            onClick={() => setEmergencyModalOpen(true)}
            className="cursor-pointer group block"
          >
            <Card className={`border-border transition-all duration-200 h-full ${
              isEmergencyPaused 
                ? 'bg-red-950/40 border-red-500/60 hover:bg-red-900/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                : 'bg-surface hover:border-red-500/60 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            }`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-all ${
                  isEmergencyPaused
                    ? 'bg-red-500 text-white'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400 group-hover:bg-red-500/20'
                }`}>
                  <Flame className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                    isEmergencyPaused ? 'text-red-300 font-bold' : 'text-text group-hover:text-red-400'
                  }`}>
                    {isEmergencyPaused ? 'Trading HALTED' : 'Emergency Pause'}
                  </h4>
                  <p className="text-xs text-text-muted">
                    {isEmergencyPaused ? 'Click to resume market' : 'Instant firm-wide freeze'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </section>
      </SectionErrorBoundary>

      {/* ── 2.5 Live MT5 Bridge Gateway & Price Feed SL/TP Sentinel ───────────── */}
      <SectionErrorBoundary sectionName="Price Feed Sentinel & MT5 Gateway">
      <section className="space-y-4">
        <PriceFeedHealthCard
          onConfigureClick={() => {
            router.push('/admin/operations?tab=feed')
          }}
        />
        <Mt5GatewayMonitorCard
          onConfigureClick={() => {
            router.push('/admin/operations?tab=mt5')
          }}
        />
      </section>
      </SectionErrorBoundary>

      {/* ── 3. Interactive Analytics Section (Recharts 2-Col) ────────────────── */}
      <SectionErrorBoundary sectionName="Interactive Analytics">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Revenue & Payout Trend (Area Chart) */}
        <Card className="bg-surface border-border text-text shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-text flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-accent" />
                Revenue & Payout Dynamics
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Monthly gross fee collections vs profit disbursements
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-lg border border-border-subtle">
              {(['7m', '1y', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase transition-all ${
                    chartRange === r
                      ? 'bg-accent text-slate-950 font-bold'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="h-[320px] w-full pt-2 relative">
            {!chartsMounted ? (
              <div className="h-full w-full flex items-center justify-center p-4">
                <Skeleton className="h-[270px] w-full rounded-xl bg-surface-muted/40 animate-pulse" />
              </div>
            ) : (
              <>
            {/* Zero State Telemetry Overlay */}
            {!areaChartData.some(d => d.revenue > 0 || d.payouts > 0) && (
              <div className="absolute inset-x-6 inset-y-10 z-10 flex flex-col items-center justify-center text-center space-y-2 pointer-events-none">
                <div className="h-11 w-11 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-xl shadow-accent/10">
                  <TrendingUp className="h-5 w-5 animate-pulse" />
                </div>
                <div className="space-y-0.5 max-w-xs">
                  <h4 className="text-xs font-bold text-text">Awaiting Billing Cycle Activity</h4>
                  <p className="text-xs text-text-muted leading-tight">Live revenue and payout streams will automatically populate as challenges are purchased.</p>
                </div>
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={areaChartData} 
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  {/* Dynamic Accent Revenue Gradient */}
                  <linearGradient id="neonRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-hex, #10B981)" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="var(--accent-hex, #10B981)" stopOpacity={0.0}/>
                  </linearGradient>
                  {/* Indigo Payouts Gradient */}
                  <linearGradient id="payoutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>

                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="var(--surface-muted)" 
                  vertical={false} 
                />

                <XAxis 
                  dataKey="name" 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'var(--surface-muted)' }} 
                />
                
                <YAxis 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'var(--surface-muted)' }} 
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />

                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const rev = payload.find(p => p.dataKey === 'revenue')?.value as number || 0
                      const pay = payload.find(p => p.dataKey === 'payouts')?.value as number || 0
                      const net = rev - pay
                      return (
                        <div className="bg-surface border border-border p-3 rounded-lg shadow-2xl text-xs space-y-1.5 min-w-[170px]">
                          <p className="font-bold text-text border-b border-border pb-1">
                            Month: {label}
                          </p>
                          <div className="flex justify-between items-center text-accent tabular">
                            <span>Revenue:</span>
                            <span className="font-bold">{formatCurrency(rev)}</span>
                          </div>
                          <div className="flex justify-between items-center text-indigo-500 dark:text-indigo-400 tabular">
                            <span>Payouts:</span>
                            <span className="font-bold">{formatCurrency(pay)}</span>
                          </div>
                          <div className="flex justify-between items-center text-text-muted tabular pt-1 border-t border-border">
                            <span>Net Retained:</span>
                            <span className="font-bold text-text">{formatCurrency(net)}</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />

                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Revenue" 
                  stroke="var(--accent-hex, #10B981)" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#neonRevenueGrad)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="payouts" 
                  name="Payouts" 
                  stroke="#6366F1" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#payoutGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
              </>
            )}
          </CardContent>

          <CardFooter className="pt-0 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Gross Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#6366F1]" />
                Disbursed Payouts
              </span>
            </div>
            <Link href="/admin/analytics" className="text-accent hover:underline flex items-center gap-1 text-xs">
              Full Financials <ArrowRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>

        {/* Chart 2: Platform Growth & Pass Rates (Bar Chart) */}
        <Card className="bg-surface border-border text-text shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-text flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Challenge Growth & Pass Rates
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                New challenge account signups vs successful trader evaluations
              </CardDescription>
            </div>
            <Badge tone="neutral" size="sm" className="tabular font-semibold text-2xs">
              {avgPassRate !== null ? `Avg Pass: ${toNum(avgPassRate).toFixed(1)}%` : 'Avg Pass: —'}
            </Badge>
          </CardHeader>

          <CardContent className="h-[320px] w-full pt-2 relative">
            {!chartsMounted ? (
              <div className="h-full w-full flex items-center justify-center p-4">
                <Skeleton className="h-[270px] w-full rounded-xl bg-surface-muted/40 animate-pulse" />
              </div>
            ) : (
              <>
            {/* Zero State Telemetry Overlay */}
            {!barChartData.some(d => d.registrations > 0 || d.passes > 0) && (
              <div className="absolute inset-x-6 inset-y-10 z-10 flex flex-col items-center justify-center text-center space-y-2 pointer-events-none">
                <div className="h-11 w-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
                  <Target className="h-5 w-5 animate-pulse" />
                </div>
                <div className="space-y-0.5 max-w-xs">
                  <h4 className="text-xs font-bold text-text">Awaiting Evaluation Funnel Data</h4>
                  <p className="text-xs text-text-muted leading-tight">Phase 1 registrations and pass conversion statistics will render dynamically.</p>
                </div>
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={barChartData} 
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="var(--surface-muted)" 
                  vertical={false} 
                />

                <XAxis 
                  dataKey="name" 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'var(--surface-muted)' }} 
                />

                <YAxis 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'var(--surface-muted)' }} 
                />

                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const reg = payload.find(p => p.dataKey === 'registrations')?.value as number || 0
                      const pass = payload.find(p => p.dataKey === 'passes')?.value as number || 0
                      const rate = reg > 0 ? toNum((pass / reg) * 100).toFixed(1) + '%' : '0%'
                      return (
                        <div className="bg-surface border border-border p-3 rounded-lg shadow-2xl text-xs space-y-1.5 min-w-[170px]">
                          <p className="font-bold text-text border-b border-border pb-1">
                            Month: {label}
                          </p>
                          <div className="flex justify-between items-center text-accent tabular">
                            <span>Registrations:</span>
                            <span className="font-bold">{formatInt(reg)}</span>
                          </div>
                          <div className="flex justify-between items-center text-blue-500 dark:text-blue-400 tabular">
                            <span>Passed / Funded:</span>
                            <span className="font-bold">{formatInt(pass)}</span>
                          </div>
                          <div className="flex justify-between items-center text-amber-500 dark:text-amber-400 tabular pt-1 border-t border-border">
                            <span>Pass Conversion:</span>
                            <span className="font-bold">{rate}</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />

                <Bar 
                  dataKey="registrations" 
                  name="Registrations" 
                  fill="var(--accent-hex, #10B981)" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="passes" 
                  name="Passed & Funded" 
                  fill="#38BDF8" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
              </>
            )}
          </CardContent>

          <CardFooter className="pt-0 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                New Registrations
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#38BDF8]" />
                Passed & Funded
              </span>
            </div>
            <Link href="/admin/traders" className="text-accent hover:underline flex items-center gap-1 text-xs">
              Traders Directory <ArrowRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>

      </section>
      </SectionErrorBoundary>

      {/* ── 4. Recent Activity Tables (DataTable side-by-side) ───────────────── */}
      <SectionErrorBoundary sectionName="Recent Activity Tables">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Table 1: Pending Payout Approvals */}
        <Card className="bg-surface border-border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-text flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                Pending Payout Approvals
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Trader profit share requests awaiting verification
              </CardDescription>
            </div>
            <Link href="/admin/payouts">
              <Button size="sm" variant="ghost" className="text-xs text-accent hover:text-accent-hover gap-1 h-7">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="overflow-x-auto min-w-0 w-full">
              <div className="min-w-[560px]">
                <DataTable<PayoutRowItem>
                  columns={payoutColumns}
                  data={displayedPayouts}
                  loading={payoutsLoading}
                  emptyMessage="No pending payouts currently in queue."
                  className="border-0 rounded-none bg-transparent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table 2: Recent Challenge Registrations */}
        <Card className="bg-surface border-border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-text flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Recent Challenge Accounts
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Latest evaluations started across all models
              </CardDescription>
            </div>
            <Link href="/admin/traders">
              <Button size="sm" variant="ghost" className="text-xs text-accent hover:text-accent-hover gap-1 h-7">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="overflow-x-auto min-w-0 w-full">
              <div className="min-w-[560px]">
                <DataTable<ChallengeRowItem>
                  columns={challengeColumns}
                  data={displayedChallenges}
                  loading={challengesLoading}
                  emptyMessage="No recent challenges recorded."
                  className="border-0 rounded-none bg-transparent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

      </section>
      </SectionErrorBoundary>

      {/* ── 5. Interactive Modal 1: Issue Manual Challenge ──────────────────── */}
      <Modal
        isOpen={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title={<span className="text-slate-100 font-bold text-lg">Issue Manual Challenge Account</span>}
        description={<span className="text-slate-400 text-xs">Grant a funded or evaluation account directly to a trader without requiring gateway checkout.</span>}
        className="dark bg-surface-muted border border-slate-800 text-slate-100 shadow-2xl ring-1 ring-accent/20"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button 
              variant="secondary" 
              onClick={() => setIssueModalOpen(false)}
              disabled={issuingLoading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleIssueChallenge}
              loading={issuingLoading}
              className="bg-accent hover:bg-accent/90 text-primary-foreground font-semibold shadow-md shadow-accent/20"
            >
              Grant Account
            </Button>
          </div>
        }
      >
        <form onSubmit={handleIssueChallenge} className="space-y-4 py-2">
          <div>
            <Label htmlFor="trader-email" className="text-xs font-semibold text-slate-300">Trader Email or Username</Label>
            <Input
              id="trader-email"
              type="text"
              placeholder="e.g. trader_pro@example.com"
              value={issueForm.email}
              onChange={(e) => setIssueForm({ ...issueForm, email: e.target.value })}
              required
              className="bg-surface border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-accent h-10 mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="plan-type" className="text-xs font-semibold text-slate-300">Challenge Plan</Label>
              <select
                id="plan-type"
                className="mt-1 flex h-10 w-full rounded-lg border border-slate-700 bg-surface px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-accent"
                value={issueForm.planId || ''}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  const plan = activePlans.find((p: any) => p.id === id)
                  setIssueForm({ ...issueForm, planId: id, balance: plan ? String(plan.account_size) : issueForm.balance })
                }}
              >
                {activePlans.length === 0 && <option value="" className="bg-surface text-slate-100">No active plans — create one in Config first</option>}
                {activePlans.map((p: any) => (
                  <option key={p.id} value={p.id} className="bg-surface text-slate-100">{p.name} — ${Number(p.account_size).toLocaleString()}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="account-phase" className="text-xs font-semibold text-slate-300">Initial Phase</Label>
              <select
                id="account-phase"
                className="mt-1 flex h-10 w-full rounded-lg border border-slate-700 bg-surface px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-accent"
                value={issueForm.phase}
                onChange={(e) => setIssueForm({ ...issueForm, phase: e.target.value as '1' | 'phase2' | 'funded' })}
              >
                <option value="1" className="bg-surface text-slate-100">Phase 1 (Evaluation)</option>
                <option value="phase2" disabled={!selectedPlan || selectedPlan.plan_type === '1-step' || selectedPlan.plan_type === 'instant'} className="bg-surface text-slate-100">
                  Phase 2 (Verification){(!selectedPlan || selectedPlan.plan_type === '1-step' || selectedPlan.plan_type === 'instant') ? ' — not available on this plan' : ''}
                </option>
                <option value="funded" className="bg-surface text-slate-100">Funded (Instant Live)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start-bal" className="text-xs font-semibold text-slate-300">Starting Balance ($)</Label>
              <Input
                id="start-bal"
                type="number"
                value={issueForm.balance}
                onChange={(e) => setIssueForm({ ...issueForm, balance: e.target.value })}
                className="bg-surface border-slate-700 text-slate-100 focus:border-accent h-10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-300">Max Leverage</Label>
              <div className="mt-1 flex h-10 w-full items-center rounded-lg border border-slate-700 bg-surface px-3 text-sm">
                <span className="font-semibold text-accent font-mono">{selectedPlan ? `1:${selectedPlan.max_leverage}` : '—'}</span>
                <span className="ml-2 text-xs font-normal text-slate-400">(set by the selected plan)</span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── 5. Interactive Modal 2: Emergency Trading Freeze ────────────────── */}
      <Modal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        title={<span className="text-slate-100 font-bold text-lg">{isEmergencyPaused ? "Deactivate Emergency Freeze" : "Activate Emergency Trading Freeze"}</span>}
        description={<span className="text-slate-400 text-xs">Global kill-switch for trading engine operations during catastrophic events or maintenance.</span>}
        className="dark bg-surface-muted border border-slate-800 text-slate-100 shadow-2xl ring-1 ring-red-500/20"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button 
              variant="secondary" 
              onClick={() => setEmergencyModalOpen(false)} 
              disabled={isPausingLoading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              Cancel
            </Button>
            <Button 
              variant={isEmergencyPaused ? "primary" : "destructive"}
              onClick={handleToggleEmergencyPause}
              loading={isPausingLoading}
              disabled={isPausingLoading}
              className={isEmergencyPaused ? "bg-profit hover:bg-profit/90 text-white font-semibold shadow-md shadow-profit/20" : "bg-red-600 hover:bg-red-500 text-white font-semibold"}
            >
              {isEmergencyPaused ? "Resume All Trading" : "Confirm Emergency Freeze"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className={`p-4 rounded-xl border ${
            isEmergencyPaused 
              ? 'bg-profit-subtle border-profit-subtle text-profit' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                {isEmergencyPaused ? (
                  <p>
                    <strong>Trading is currently PAUSED.</strong> Clicking confirm will reopen market execution, restore order acceptance, and broadcast live status to all connected web/mobile clients.
                  </p>
                ) : (
                  <p>
                    <strong>WARNING:</strong> This action will immediately block all new order placement, pending orders, and modifications across all active challenges and funded accounts.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="pause-reason" className="text-xs font-semibold text-slate-300">Audit Note / Reason</Label>
            <Input
              id="pause-reason"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              placeholder="Specify reason for audit logs..."
              className="bg-surface border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-accent h-10 mt-1"
            />
          </div>
        </div>
      </Modal>

      {/* ── 5. Interactive Modal 3: Quick Payout Review ─────────────────────── */}
      <Modal
        isOpen={payoutReviewModalOpen && !!selectedPayout}
        onClose={() => {
          setPayoutReviewModalOpen(false)
          setSelectedPayout(null)
          setTxRefInput('')
          setPayoutRejectReason('')
        }}
        title={<span className="text-slate-100 font-bold text-lg">{`Review Payout #PAY-${selectedPayout?.id}`}</span>}
        description={<span className="text-slate-400 text-xs">Audit profit split calculation and approve on-chain disbursement.</span>}
        className="dark bg-surface-muted border border-slate-800 text-slate-100 shadow-2xl ring-1 ring-accent/20"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button 
              variant="destructive" 
              onClick={() => handleProcessPayout('reject')}
              disabled={payoutActionLoading}
              className="bg-red-600/80 hover:bg-red-600 text-white font-semibold"
            >
              Reject Payout
            </Button>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setPayoutReviewModalOpen(false)
                  setSelectedPayout(null)
                  setTxRefInput('')
                  setPayoutRejectReason('')
                }}
                disabled={payoutActionLoading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Close
              </Button>
              <Button 
                variant="primary" 
                onClick={() => handleProcessPayout('approve')}
                loading={payoutActionLoading}
                disabled={payoutActionLoading}
                className="bg-profit hover:bg-profit/90 text-white font-semibold shadow-md shadow-profit/20"
              >
                Approve
              </Button>
            </div>
          </div>
        }
      >
        {selectedPayout && (
          <div className="space-y-4 py-2">
            <div className="bg-surface p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Trader:</span>
                <span className="font-semibold text-slate-100">{selectedPayout.username || selectedPayout.user_login || 'Trader'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account ID:</span>
                <span className="tabular text-slate-200">ACC-{selectedPayout.challenge_id || selectedPayout.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Profit Requested:</span>
                <span className="terminal-num font-bold text-profit text-sm">{formatCurrency(selectedPayout.amount_requested || selectedPayout.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gateway / Destination:</span>
                <span className="text-slate-200">{selectedPayout.payment_method || selectedPayout.gateway || 'USDT TRC20'}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="tx-ref" className="text-xs font-semibold text-slate-300">Transaction Reference / Tx Hash (Optional)</Label>
              <Input
                id="tx-ref"
                placeholder="e.g. 0x89f2a71d4..."
                value={txRefInput}
                onChange={(e) => setTxRefInput(e.target.value)}
                className="bg-surface border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-accent h-10 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="payout-reject-reason" className="text-xs font-semibold text-slate-300">Audit Note / Rejection Reason</Label>
              <textarea
                id="payout-reject-reason"
                rows={2}
                placeholder="Required if rejecting (e.g. Risk rule breach, invalid wallet)..."
                value={payoutRejectReason}
                onChange={(e) => setPayoutRejectReason(e.target.value)}
                className="w-full mt-1 rounded-lg border border-slate-700 bg-surface p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
