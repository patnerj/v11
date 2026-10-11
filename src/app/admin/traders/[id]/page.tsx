'use client'

import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, User, Mail, Calendar, Hash, ShieldCheck, ShieldAlert,
  Sliders, KeyRound, Ban, DollarSign, TrendingUp, TrendingDown,
  Activity, Target, Award, CheckCircle2, Clock, FileText,
  CreditCard, Wallet, AlertTriangle, Loader2, ExternalLink,
  Lock, RefreshCw, Send, Check, X, Shield, Sparkles, Server,
  Radio, Terminal, Eye, EyeOff, Save, Layers
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { setSession, clearFxsimCache } from '@/lib/fxsim'
import { toNum } from '@/lib/format'
import { cn } from '@/lib/cn'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { DataTable, ColumnDef } from '@/components/ui/DataTable'
import { EnterpriseOverrideModal, TraderOverrideTarget } from '@/components/admin/EnterpriseOverrideModal'
import { DirectPasswordResetModal, DirectPasswordResetTarget } from '@/components/admin/DirectPasswordResetModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'

// Helper currency formatters
function formatCurrency(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatExactCurrency(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export default function Trader360ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const adminUser = useAuth((s) => s.user)
  const startImpersonation = useImpersonation((s) => s.start)
  // A missing/invalid id must NOT silently fall back to user #1 — that's a
  // real account (often the primary admin) whose data would render as if it
  // belonged to whatever trader the operator meant to open.
  const parsedId = Number(params?.id)
  const userId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0

  // Modals & form states
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)
  const [impersonateConfirmOpen, setImpersonateConfirmOpen] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [freezeConfirmOpen, setFreezeConfirmOpen] = useState(false)
  const [isFreezing, setIsFreezing] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  
  // Note list state
  const [adminNotesList, setAdminNotesList] = useState<Array<{ id: number; author: string; role: string; content: string; date: string }>>([])

  // MT5 Broker Connection State
  const [mt5Form, setMt5Form] = useState({
    login: '',
    password: '',
    server: 'MetaQuotes-Demo',
    account_type: 'demo',
  })
  const [isSavingMt5, setIsSavingMt5] = useState(false)
  const [showMt5Password, setShowMt5Password] = useState(false)

  // Active Challenge Selection State for Multi-Account Switching
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null)

  // Fetch trader 360 data
  const { data: traderApiData, isLoading, refetch } = useQuery({
    queryKey: ['admin-trader-360', userId],
    queryFn: async () => {
      try {
        const res = await api.admin.getTrader360(userId)
        if (res.ok && res.data) {
          return res.data.data || res.data
        }
      } catch {
        // graceful fallback to detail endpoint
      }
      try {
        const detailRes = await api.admin.userDetail(userId)
        if (detailRes.ok && detailRes.data) {
          return detailRes.data
        }
      } catch {
        // fallback
      }
      return null
    },
    staleTime: 10000,
    enabled: userId > 0,
  })

  // Normalize all challenge accounts for this trader
  const challengesList = useMemo(() => {
    const list = Array.isArray(traderApiData?.challenges) ? traderApiData.challenges : []
    if (list.length === 0 && traderApiData?.challenge) {
      return [traderApiData.challenge]
    }
    return list
  }, [traderApiData])

  // Auto-select primary challenge on initial load
  useEffect(() => {
    if (challengesList.length > 0 && selectedChallengeId === null) {
      const active = challengesList.find((c: any) => c.status === 'active' || c.status === 'funded') || challengesList[0]
      setSelectedChallengeId(active.id)
    }
  }, [challengesList, selectedChallengeId])

  // Fetch real-time challenge metrics for the selected challenge account
  const { data: selectedChallengeMetrics } = useQuery({
    queryKey: ['admin-challenge-metrics', selectedChallengeId],
    queryFn: async () => {
      if (!selectedChallengeId) return null
      const res = await api.challengeMetrics(selectedChallengeId)
      return res.ok ? res.data : null
    },
    enabled: !!selectedChallengeId,
    staleTime: 6000,
  })

  const notFound = userId === 0 || (!isLoading && !traderApiData)

  // Normalized Profile Data Model with strict real calculations
  const trader = useMemo(() => {
    const apiUser = traderApiData?.user || traderApiData
    const activeChallengeFromList = challengesList.find((c: any) => c.id === selectedChallengeId)
    const challenge = activeChallengeFromList || traderApiData?.challenge || challengesList[0]
    const metrics = (selectedChallengeId && selectedChallengeMetrics)
      ? selectedChallengeMetrics
      : (selectedChallengeId && selectedChallengeId === traderApiData?.challenge?.id ? traderApiData?.metrics : null)

    const startingBal = Number(metrics?.starting_balance || challenge?.starting_balance || traderApiData?.account?.starting_balance || 0)
    const currentBal = Number(metrics?.balance || challenge?.current_balance || traderApiData?.account?.balance || startingBal || 0)
    const currentEq = Number(metrics?.equity || traderApiData?.account?.equity || currentBal || startingBal || 0)
    const pnl = metrics?.current_profit !== undefined ? Number(metrics.current_profit) : (currentEq - startingBal)
    const pnlPct = metrics?.current_profit_pct !== undefined ? Number(metrics.current_profit_pct) : (startingBal > 0 ? (pnl / startingBal) * 100 : 0)

    const profitSplit = Number(challenge?.custom_profit_split || challenge?.plan_profit_split || 80)
    const dailyDDLimit = Number(metrics?.daily_dd_pct || challenge?.custom_daily_dd || 5.0)
    const maxDDLimit = Number(metrics?.max_dd_pct || challenge?.custom_max_dd || 10.0)
    const minDays = Number(metrics?.min_trading_days || challenge?.custom_min_days || challenge?.min_trading_days || 5)

    // Accurate Daily Drawdown (from metrics or authoritative fallback formula)
    const dailyStartBal = Number(challenge?.daily_start_balance || startingBal)
    const fallbackDailyLoss = Math.max(0, dailyStartBal - Math.min(currentBal, currentEq))
    const fallbackDailyDdUsed = dailyStartBal > 0 ? (fallbackDailyLoss / dailyStartBal) * 100 : 0
    const dailyDD = metrics?.daily_dd_used_pct !== undefined ? Number(metrics.daily_dd_used_pct) : fallbackDailyDdUsed
    const dailyDDProgress = metrics?.daily_dd_progress !== undefined ? Number(metrics.daily_dd_progress) : (dailyDD / (dailyDDLimit || 1)) * 100

    // Accurate Max Drawdown (from metrics or authoritative fallback formula)
    let fallbackMaxLoss = Math.max(0, startingBal - Math.min(currentBal, currentEq))
    const isTrailing = ['trailing', 'trailing_equity', 'eod_trailing', 'trailing_balance'].includes(challenge?.drawdown_type || '')
    if (isTrailing && challenge?.trailing_dd_floor && Number(challenge.trailing_dd_floor) > 0) {
      const hwm = Math.max(Number(challenge.equity_hwm || startingBal), Math.min(currentBal, currentEq))
      fallbackMaxLoss = Math.max(0, hwm - Math.min(currentBal, currentEq))
    }
    const fallbackMaxDdUsed = startingBal > 0 ? (fallbackMaxLoss / startingBal) * 100 : 0
    const maxDD = metrics?.max_dd_used_pct !== undefined ? Number(metrics.max_dd_used_pct) : fallbackMaxDdUsed
    const maxDDProgress = metrics?.max_dd_progress !== undefined ? Number(metrics.max_dd_progress) : (maxDD / (maxDDLimit || 1)) * 100

    // Profit Target & Trading Days
    const profitTargetPct = Number(metrics?.profit_target_pct || challenge?.p1_profit_target || 8.0)
    const profitTargetVal = Number(metrics?.profit_target_val || (startingBal * profitTargetPct / 100))
    const profitProgress = metrics?.profit_progress !== undefined ? Number(metrics.profit_progress) : (profitTargetPct > 0 ? Math.min(100, Math.max(0, (pnlPct / profitTargetPct) * 100)) : 0)

    const tradingDays = Number(metrics?.trading_days_done || challenge?.trading_days || 0)
    const tradingDaysProgress = minDays > 0 ? Math.min(100, (tradingDays / minDays) * 100) : 100

    const newsTrading = challenge?.custom_news_trading !== undefined && challenge?.custom_news_trading !== null
      ? Boolean(Number(challenge.custom_news_trading))
      : Boolean(challenge?.news_trading ?? true)
    const weekendHolding = challenge?.custom_weekend_holding !== undefined && challenge?.custom_weekend_holding !== null
      ? Boolean(Number(challenge.custom_weekend_holding))
      : Boolean(challenge?.weekend_holding ?? false)

    const tradesList = (traderApiData?.trades || []).filter((t: any) => {
      if (challenge?.fxsim_account_id) {
        return Number(t.account_id) === Number(challenge.fxsim_account_id)
      }
      return true
    })
    const wins = tradesList.filter((t: any) => Number(t.pnl || t.profit || 0) > 0).length
    const losses = tradesList.filter((t: any) => Number(t.pnl || t.profit || 0) < 0).length
    const totalTrades = tradesList.length
    const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0

    const mt5Login = String(challenge?.mt5_login || apiUser?.mt5_login || '')
    const mt5Server = String(challenge?.mt5_server || apiUser?.mt5_server || 'MetaQuotes-Demo')
    const mt5AccountType = String(challenge?.mt5_account_type || apiUser?.mt5_account_type || 'demo')

    return {
      id: userId,
      user_id: userId,
      name: apiUser?.display_name || apiUser?.name || apiUser?.username || `Trader #${userId}`,
      email: apiUser?.email || apiUser?.user_email || '',
      username: apiUser?.username || apiUser?.user_login || `user_${userId}`,
      account_id: challenge?.fxsim_account_id || challenge?.id || traderApiData?.account?.account_id || `${userId}`,
      plan_name: challenge?.plan_name || 'Standard Evaluation',
      phase: Number(challenge?.phase || 1),
      phase_label: challenge?.status === 'funded' ? 'Funded Live' : (challenge?.phase ? `Phase ${challenge.phase}` : (challenge?.status || 'Active')),
      status: apiUser?.status || (isBanned ? 'suspended' : (challenge?.status || 'active')),
      joined_date: apiUser?.registered ? new Date(apiUser.registered).toLocaleDateString() : 'Recent',
      balance: currentBal,
      equity: currentEq,
      starting_balance: startingBal,
      pnl: pnl,
      pnl_pct: pnlPct,
      daily_dd: dailyDD,
      daily_dd_limit: dailyDDLimit,
      daily_dd_progress: dailyDDProgress,
      max_dd: maxDD,
      max_dd_limit: maxDDLimit,
      max_dd_progress: maxDDProgress,
      profit_target_pct: profitTargetPct,
      profit_target_val: profitTargetVal,
      profit_progress: profitProgress,
      trading_days: tradingDays,
      min_trading_days: minDays,
      trading_days_progress: tradingDaysProgress,
      min_days: minDays,
      news_trading: newsTrading,
      weekend_holding: weekendHolding,
      win_rate: winRate,
      wins: wins,
      losses: losses,
      total_trades: totalTrades,
      risk_level: traderApiData?.breaches?.length ? 'High Risk' : 'Normal',
      profit_split: profitSplit,
      kyc_status: traderApiData?.kyc?.status || 'unverified',
      kyc_submitted: traderApiData?.kyc?.created_at ? new Date(traderApiData.kyc.created_at).toLocaleDateString() : 'N/A',
      kyc_reviewer: traderApiData?.kyc?.reviewed_at ? 'Compliance Team' : 'Pending Review',
      mt5_login: mt5Login,
      mt5_server: mt5Server,
      mt5_account_type: mt5AccountType,
    }
  }, [traderApiData, userId, isBanned, challengesList, selectedChallengeId, selectedChallengeMetrics])

  // Sync initial note from API (ADMINUI-28: keep noteInput empty for new entry)
  useEffect(() => {
    if (traderApiData?.note && typeof traderApiData.note === 'string') {
      setAdminNotesList([
        {
          id: 1,
          author: 'System Compliance Log',
          role: 'Audit Record',
          content: traderApiData.note,
          date: 'Active',
        }
      ])
    }
  }, [traderApiData?.note])

  // Sync MT5 form credentials when selected challenge changes
  useEffect(() => {
    const ch = challengesList.find((c: any) => c.id === selectedChallengeId) || traderApiData?.challenge || challengesList[0]
    const u = traderApiData?.user || traderApiData
    if (ch || u) {
      setMt5Form({
        login: String(ch?.mt5_login || u?.mt5_login || ''),
        password: '',
        server: String(ch?.mt5_server || u?.mt5_server || 'MetaQuotes-Demo'),
        account_type: String(ch?.mt5_account_type || u?.mt5_account_type || 'demo'),
      })
    }
  }, [selectedChallengeId, challengesList, traderApiData])

  // Handlers
  const handleSaveNote = async () => {
    if (!noteInput.trim()) {
      toast.error('Please enter note text before saving.')
      return
    }

    setIsSavingNote(true)
    try {
      const res = await api.admin.saveUserNote(userId, noteInput.trim())
      if (!res.ok) {
        toast.error(res.error || 'Failed to save note')
        return
      }
      const authorName = adminUser?.display_name || adminUser?.username || 'Staff'
      const newEntry = {
        id: Date.now(),
        author: authorName,
        role: 'Risk Audit',
        content: noteInput.trim(),
        date: new Date().toLocaleString(),
      }
      setAdminNotesList([newEntry, ...adminNotesList])
      toast.success('Private administrative note saved to compliance trail.')
      setNoteInput('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save note')
    } finally {
      setIsSavingNote(false)
    }
  }

  const handleSaveMt5 = async () => {
    if (!mt5Form.login.trim()) {
      toast.error('MT5 Account Login ID is required.')
      return
    }

    setIsSavingMt5(true)
    try {
      const res = await api.admin.saveUserMt5(userId, {
        mt5_login: mt5Form.login.trim(),
        mt5_password: mt5Form.password.trim() || undefined,
        mt5_server: mt5Form.server.trim(),
        mt5_account_type: mt5Form.account_type,
        challenge_id: selectedChallengeId || undefined,
      })
      if (res.ok) {
        toast.success(`MT5 Account #${mt5Form.login.trim()} linked & credentials saved!`)
        refetch()
        queryClient.invalidateQueries({ queryKey: ['admin-traders-list'] })
      } else {
        toast.error(res.error || 'Failed to save MT5 details')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save MT5 credentials')
    } finally {
      setIsSavingMt5(false)
    }
  }

  useEffect(() => {
    if (traderApiData) {
      const accStatus = traderApiData.account?.status || traderApiData.account_status
      const userStatus = traderApiData.user?.status
      if (accStatus === 'banned' || accStatus === 'frozen' || userStatus === 'banned' || userStatus === 'suspended') {
        setIsBanned(true)
      } else {
        setIsBanned(false)
      }

      if (traderApiData.notes && Array.isArray(traderApiData.notes)) {
        setAdminNotesList(traderApiData.notes)
      } else if (traderApiData.note) {
        setAdminNotesList([{
          id: 1,
          author: 'System Admin',
          role: 'Compliance',
          content: traderApiData.note,
          date: 'Audit Record',
        }])
      }
    }
  }, [traderApiData])

  const handleToggleFreeze = async () => {
    const nextState = !isBanned
    setIsBanned(nextState)
    try {
      const res = await api.admin.setStatus(userId, nextState ? 'banned' : 'active')
      if (!res.ok || !res.data?.success) {
        setIsBanned(!nextState)
        toast.error((!res.ok ? res.error : res.data?.message) || 'Failed to update account status')
        return
      }
      if (nextState) {
        toast.error(`Account frozen: ${trader.name} suspended & MT5 access disabled.`)
      } else {
        toast.success(`Account unlocked: ${trader.name} restored to active live trading.`)
      }
      queryClient.invalidateQueries({ queryKey: ['admin-traders-list'] })
      queryClient.invalidateQueries({ queryKey: ['admin-trader-360', userId] })
    } catch (err: any) {
      setIsBanned(!nextState)
      toast.error(err.message || 'Failed to update account status')
    }
  }

  const handleImpersonate = async () => {
    if (!adminUser) {
      toast.error('Admin session not ready.')
      return
    }
    try {
      const res = await api.admin.impersonate(userId)
      if (!res.ok || !res.data.success) {
        toast.error((!res.ok ? res.error : res.data.message) || 'Impersonation failed')
        return
      }
      startImpersonation({
        admin_username: adminUser.username,
        admin_display_name: adminUser.display_name,
        target_user_id: userId,
        target_username: trader.name || trader.email,
        started_at: Date.now(),
      })
      setSession({ nonce: null, bearer: null })
      clearFxsimCache()
      toast.success(`Switching to view dashboard as ${trader.name}...`)
      window.location.href = '/dashboard'
    } catch (err: any) {
      toast.error(err.message || 'Impersonation failed')
    }
  }

  // Transactions DataTable definition
  interface TxHistoryRow {
    id: string
    type: string
    amount: number
    gateway: string
    status: string
    date: string
  }

  const txColumns: ColumnDef<TxHistoryRow>[] = [
    {
      key: 'id',
      header: 'Reference',
      render: (row) => (
        <span className="tabular font-medium text-xs text-text bg-surface-muted px-2 py-0.5 rounded border border-border">
          {row.id}
        </span>
      )
    },
    {
      key: 'type',
      header: 'Transaction Type',
      render: (row) => (
        <span className="text-xs text-gray-200 font-medium">
          {row.type}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => {
        const isPayout = row.type.includes('Payout') || row.type.includes('Withdrawal')
        return (
          <span className={`terminal-num text-xs font-bold ${
            isPayout ? 'text-profit' : 'text-text'
          }`}>
            {formatExactCurrency(row.amount)}
          </span>
        )
      }
    },
    {
      key: 'gateway',
      header: 'Gateway',
      render: (row) => (
        <span className="text-xs text-gray-400">
          {row.gateway}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => {
        const s = String(row.status || '').toLowerCase()
        const tone = 
          s === 'completed' || s === 'approved' || s === 'paid' || s === 'success' ? 'success' :
          s === 'pending' || s === 'processing' || s === 'in_review' ? 'warning' :
          s === 'failed' || s === 'rejected' || s === 'cancelled' ? 'danger' : 'neutral'
        return (
          <Badge tone={tone} size="sm" className="capitalize">
            {row.status}
          </Badge>
        )
      }
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-text-muted tabular">
          {row.date}
        </span>
      )
    }
  ]

  const txData: TxHistoryRow[] = useMemo(() => {
    if (traderApiData?.payouts?.length || traderApiData?.payments?.length) {
      const rows: TxHistoryRow[] = []
      traderApiData.payouts?.forEach((p: any) => {
        rows.push({
          id: `#PAY-${p.id}`,
          type: 'Profit Split Withdrawal',
          amount: Number(p.trader_amount || p.amount_requested || 0),
          gateway: p.gateway || 'USDT / Crypto',
          status: p.status === 'approved' || p.status === 'paid' ? 'Completed' : p.status,
          date: p.requested_at ? new Date(p.requested_at).toLocaleDateString() : 'Recent',
        })
      })
      traderApiData.payments?.forEach((p: any) => {
        rows.push({
          id: `#ORD-${p.id}`,
          type: 'Challenge Purchase',
          amount: Number(p.amount || 0),
          gateway: p.gateway || 'Card',
          status: p.status === 'approved' ? 'Completed' : p.status,
          date: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent',
        })
      })
      return rows
    }
    return []
  }, [traderApiData])

  // Timeline events definition
  const timelineEvents = useMemo(() => {
    if (traderApiData?.timeline && Array.isArray(traderApiData.timeline) && traderApiData.timeline.length > 0) {
      return traderApiData.timeline.map((item: any) => {
        let icon = Activity
        let tone: 'success' | 'accent' | 'info' | 'neutral' = 'neutral'
        if (item.type === 'challenge') { icon = Target; tone = 'accent'; }
        else if (item.type === 'payment') { icon = CreditCard; tone = 'info'; }
        else if (item.type === 'payout') { icon = Wallet; tone = 'success'; }
        else if (item.type === 'kyc') { icon = ShieldCheck; tone = 'success'; }
        else if (item.type === 'breach') { icon = ShieldAlert; tone = 'info'; }
        else if (item.type === 'admin') { icon = Sliders; tone = 'info'; }

        return {
          title: item.label,
          description: item.type === 'breach' ? 'Risk rule violation registered' : 'Activity milestone',
          date: item.at ? new Date(item.at).toLocaleString() : 'Recent',
          icon,
          tone,
        }
      })
    }

    // Defensive fallback synthesis when backend timeline is empty or not yet aggregated
    const synthesized: Array<{
      title: string
      description: string
      date: string
      timestamp: number
      icon: any
      tone: 'success' | 'accent' | 'info' | 'neutral'
    }> = []

    // 1. Account registration milestone
    const regDate = traderApiData?.user?.registered || traderApiData?.trader?.joined_date || traderApiData?.created_at
    if (regDate) {
      const ts = new Date(regDate).getTime()
      synthesized.push({
        title: 'Trader Account Registered',
        description: `Verified email onboarding completed (${traderApiData?.user?.email || 'Portal User'})`,
        date: isNaN(ts) ? String(regDate) : new Date(ts).toLocaleString(),
        timestamp: isNaN(ts) ? 0 : ts,
        icon: User,
        tone: 'neutral',
      })
    }

    // 2. Challenge evaluations milestones
    if (Array.isArray(traderApiData?.challenges)) {
      traderApiData.challenges.forEach((ch: any) => {
        const cDate = ch.created_at || ch.phase_started_at
        const ts = cDate ? new Date(cDate).getTime() : 0
        synthesized.push({
          title: `Challenge Enrolled: ${ch.plan_name || 'Standard Account'} #${ch.id}`,
          description: `Stage: Phase ${ch.phase || 1} • Status: ${(ch.status || 'active').toUpperCase()} • Balance: ${formatCurrency(toNum(ch.starting_balance || 100000))}`,
          date: ts ? new Date(ts).toLocaleString() : 'Recent',
          timestamp: ts,
          icon: Target,
          tone: ch.status === 'funded' ? 'success' : 'accent',
        })
      })
    }

    // 3. Payments milestones
    if (Array.isArray(traderApiData?.payments)) {
      traderApiData.payments.forEach((pm: any) => {
        const pDate = pm.created_at
        const ts = pDate ? new Date(pDate).getTime() : 0
        synthesized.push({
          title: `Order Payment ${pm.status === 'completed' || pm.status === 'paid' ? 'Completed' : 'Initiated'} (${pm.gateway || 'Gateway'})`,
          description: `Amount: ${formatCurrency(toNum(pm.amount))} • Status: ${pm.status}`,
          date: ts ? new Date(ts).toLocaleString() : 'Recent',
          timestamp: ts,
          icon: CreditCard,
          tone: 'info',
        })
      })
    }

    // 4. KYC compliance milestones
    if (traderApiData?.kyc) {
      const k = traderApiData.kyc
      const kDate = k.reviewed_at || k.created_at
      const ts = kDate ? new Date(kDate).getTime() : 0
      synthesized.push({
        title: `KYC Compliance Status: ${(k.status || 'under_review').toUpperCase()}`,
        description: k.admin_note ? `Note: ${k.admin_note}` : 'Identity verification audit record',
        date: ts ? new Date(ts).toLocaleString() : 'Recent',
        timestamp: ts,
        icon: ShieldCheck,
        tone: k.status === 'approved' ? 'success' : 'neutral',
      })
    }

    // 5. Payout disbursements milestones
    if (Array.isArray(traderApiData?.payouts)) {
      traderApiData.payouts.forEach((po: any) => {
        const poDate = po.requested_at || po.created_at
        const ts = poDate ? new Date(poDate).getTime() : 0
        synthesized.push({
          title: `Profit Split Payout ${po.status === 'paid' ? 'Disbursed' : 'Requested'}: ${formatCurrency(toNum(po.amount_requested))}`,
          description: `Trader share: ${formatCurrency(toNum(po.trader_amount || po.amount_requested))} • Status: ${po.status}`,
          date: ts ? new Date(ts).toLocaleString() : 'Recent',
          timestamp: ts,
          icon: Wallet,
          tone: po.status === 'paid' ? 'success' : 'accent',
        })
      })
    }

    // Sort descending by timestamp (newest first)
    synthesized.sort((a, b) => b.timestamp - a.timestamp)
    return synthesized
  }, [traderApiData])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 text-accent animate-spin" />
        <p className="text-text-muted font-medium text-sm animate-pulse">
          Loading Trader Profile for #{userId}...
        </p>
      </div>
    )
  }

  // Both API calls above previously failed silently into a fully synthesized
  // placeholder profile ("Trader #N", plan "Standard Evaluation", $0
  // balances) with no error state — an admin auditing a bad link had no way
  // to tell a genuinely-empty new account apart from a profile that never
  // loaded at all, or a userId that came from a broken link.
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <p className="text-text font-semibold">
          {userId === 0 ? 'Invalid trader link.' : `Trader #${userId} could not be loaded.`}
        </p>
        <p className="text-text-subtle text-sm max-w-md">
          {userId === 0
            ? 'The link that brought you here is missing a valid trader id.'
            : 'This account may not exist, or the server request failed.'}
        </p>
        <button onClick={() => router.push('/admin/traders')} className="text-sm text-accent hover:underline">
          Back to Traders
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      
      {/* ── 1. Trader Hero Header ─────────────────────────────────────────── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Traders Hub', href: '/admin/traders' },
          { label: trader.name },
        ]}
        title={trader.name}
        description={`${trader.email || 'No email registered'} • Joined ${trader.joined_date} • ${trader.plan_name}`}
        badge={{
          label: `#TRD-${trader.account_id} · ${isBanned ? 'Account Frozen' : trader.phase_label}`,
          tone: isBanned ? 'danger' : 'accent',
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {trader.mt5_login && (
              <Badge tone="accent" size="sm" className="tabular font-semibold gap-1">
                <Server className="h-3 w-3 text-cyan-400" />
                MT5: {trader.mt5_login}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(adminUser?.id && (adminUser.id === userId || adminUser.id === trader.user_id))}
              onClick={() => {
                if (adminUser?.id && (adminUser.id === userId || adminUser.id === trader.user_id)) {
                  toast.info('Cannot impersonate your own admin account.')
                  return
                }
                setImpersonateConfirmOpen(true)
              }}
              className="border-cyan-500/30 text-cyan-600 dark:text-cyan-300 hover:text-cyan-700 dark:hover:text-white hover:bg-cyan-500/20 gap-2 h-9 disabled:opacity-40 disabled:cursor-not-allowed"
              title={adminUser?.id && (adminUser.id === userId || adminUser.id === trader.user_id) ? 'Cannot impersonate own admin account' : undefined}
            >
              <Eye className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              View as Trader
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetPasswordModalOpen(true)}
              className="border-amber-500/30 text-amber-600 dark:text-amber-300 hover:text-amber-700 dark:hover:text-white hover:bg-amber-500/20 gap-2 h-9"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              Direct Password Reset
            </Button>

            <Button
              variant={isBanned ? 'primary' : 'destructive'}
              size="sm"
              onClick={() => setFreezeConfirmOpen(true)}
              className="gap-2 h-9"
            >
              <Ban className="h-3.5 w-3.5" />
              {isBanned ? 'Unfreeze Account' : 'Freeze Account'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setOverrideModalOpen(true)}
              className="gap-2 h-9 shadow-accent/20"
            >
              <Sliders className="h-4 w-4" />
              Apply Override
            </Button>
          </div>
        }
      />

      {/* ── Multi-Challenge Account Switcher (Task 2.4) ────────────────────── */}
      {challengesList.length > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-surface-muted/60 border border-border rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              Challenge Accounts ({challengesList.length})
            </span>
            <span className="text-2xs text-text-subtle">
              Select an account to inspect specific metrics, risk state & MT5 credentials
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {challengesList.map((ch: any) => {
              const isSelected = selectedChallengeId === ch.id
              const balanceStr = ch.starting_balance ? `$${Number(ch.starting_balance).toLocaleString()}` : ''
              const planTitle = ch.plan_name || 'Standard'
              const status = ch.status || 'active'
              const isFunded = status === 'funded'
              const isPassed = status === 'passed'
              const isFailed = status === 'failed' || status === 'breached'

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChallengeId(ch.id)}
                  className={cn(
                    'px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border whitespace-nowrap cursor-pointer',
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 dark:text-cyan-200 shadow-sm shadow-cyan-500/10'
                      : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-muted'
                  )}
                >
                  <span className="font-semibold text-text">#{ch.id}</span>
                  <span className="text-text-muted">· {planTitle} {balanceStr ? `(${balanceStr})` : ''}</span>
                  <Badge
                    tone={isFunded ? 'success' : isPassed ? 'info' : isFailed ? 'danger' : 'accent'}
                    size="sm"
                    className="text-2xs px-1.5 py-0 h-4 border uppercase tracking-wider font-semibold"
                  >
                    {isFunded ? 'Funded' : isPassed ? 'Passed' : isFailed ? 'Failed' : `Phase ${ch.phase || 1}`}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 2. Performance & Financial Metrics Grid (8 KPI Cards) ─────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Live Financial & Risk Metrics
          </h2>
          <span className="text-xs text-text-subtle font-medium">Real-time Account State</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Balance */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Current Balance</span>
              <div className="mt-2 text-xl sm:text-2xl font-bold terminal-num text-text">
                {formatExactCurrency(trader.balance)}
              </div>
              <p className="text-2xs text-text-muted mt-1 terminal-num font-medium">
                Start: {formatCurrency(trader.starting_balance)}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Equity */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Live Equity</span>
              <div className="mt-2 text-xl sm:text-2xl font-bold terminal-num text-profit flex items-center gap-1.5">
                {formatExactCurrency(trader.equity)}
              </div>
              <p className="text-2xs text-profit mt-1 flex items-center gap-1 terminal-num">
                <TrendingUp className="h-3 w-3" />
                {trader.equity >= trader.balance ? '+' : ''}{formatExactCurrency(trader.equity - trader.balance)} Floating
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Realised PnL */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Realised PnL ($)</span>
              <div className={`mt-2 text-xl sm:text-2xl font-bold terminal-num ${trader.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {trader.pnl >= 0 ? '+' : ''}{formatExactCurrency(trader.pnl)}
              </div>
              <Badge tone={trader.pnl >= 0 ? 'success' : 'danger'} size="sm" className="mt-1 terminal-num font-semibold text-2xs">
                {trader.pnl_pct >= 0 ? '+' : ''}{toNum(trader.pnl_pct).toFixed(2)}% Net Yield
              </Badge>
            </CardContent>
          </Card>

          {/* Card 4: Daily Drawdown */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Daily Drawdown</span>
              <div className="mt-2 text-xl sm:text-2xl font-bold terminal-num text-text">
                {toNum(trader.daily_dd).toFixed(2)}% <span className="text-xs text-text-muted">/ {trader.daily_dd_limit}% Max</span>
              </div>
              <Badge tone={trader.daily_dd > trader.daily_dd_limit * 0.8 ? 'danger' : 'accent'} size="sm" className="mt-1 terminal-num font-semibold text-2xs">
                {Math.max(0, toNum(trader.daily_dd_limit) - toNum(trader.daily_dd)).toFixed(2)}% Headroom
              </Badge>
            </CardContent>
          </Card>

          {/* Card 5: Max Drawdown */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Total Trailing DD</span>
              <div className="mt-2 text-xl sm:text-2xl font-bold terminal-num text-text">
                {toNum(trader.max_dd).toFixed(2)}% <span className="text-xs text-text-muted">/ {trader.max_dd_limit}% Max</span>
              </div>
              <Badge tone={trader.max_dd > trader.max_dd_limit * 0.8 ? 'danger' : 'accent'} size="sm" className="mt-1 terminal-num font-semibold text-2xs">
                {Math.max(0, toNum(trader.max_dd_limit) - toNum(trader.max_dd)).toFixed(2)}% Headroom
              </Badge>
            </CardContent>
          </Card>

          {/* Card 6: Win Rate */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Win Rate</span>
              <div className="mt-2 text-xl sm:text-2xl font-bold terminal-num text-profit">
                {trader.win_rate}%
              </div>
              <p className="text-2xs text-text-muted mt-1 terminal-num font-medium">
                {trader.wins} Wins • {trader.losses} Losses
              </p>
            </CardContent>
          </Card>

          {/* Card 7: Total Trades */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Total Executions</span>
              <div className="mt-2 text-xl sm:text-2xl font-bold terminal-num text-text">
                {trader.total_trades} Trades
              </div>
              <p className="text-2xs text-text-muted mt-1">
                Closed positions history
              </p>
            </CardContent>
          </Card>

          {/* Card 8: Risk Rating */}
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <span className="text-xs text-text-muted font-medium">Calculated Risk Level</span>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={trader.risk_level === 'High Risk' ? 'danger' : 'success'} size="md" pulsing className="font-bold text-xs px-2.5 py-1">
                  {trader.risk_level}
                </Badge>
              </div>
              <p className="text-2xs text-text-muted mt-1">
                {traderApiData?.breaches?.length ? 'Infractions logged' : 'Compliant profile'}
              </p>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ── 3. Detailed Sections (2-Column Grid) ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: MT5 Connection, Challenge Progression & Tx History */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── MT5 BROKER TELEMETRY & ACCOUNT BRIDGE CARD ────────────────────── */}
          <Card className="bg-surface border-cyan-500/30 shadow-lg shadow-cyan-950/20">
            <CardHeader className="border-b border-cyan-500/20 pb-4 bg-gradient-to-r from-cyan-950/30 via-transparent to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base text-text flex items-center gap-2">
                    <Server className="h-5 w-5 text-cyan-400" />
                    <span>MetaTrader 5 Account & Telemetry Bridge</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    Assign and bind MT5 broker credentials so the local Python Sync Daemon streams live equity and closed deals to this trader.
                  </CardDescription>
                </div>
                {trader.mt5_login ? (
                  <Badge tone="success" size="sm" className="font-semibold tabular gap-1.5 self-start sm:self-center">
                    <Radio className="h-3 w-3 animate-ping text-profit" />
                    Bridge Bound: #{trader.mt5_login}
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm" className="font-medium self-start sm:self-center">
                    Unlinked / Standalone
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* MT5 Login */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-cyan-400" />
                    MT5 Account Number / Login ID
                  </Label>
                  <Input
                    placeholder="e.g. 10048291"
                    value={mt5Form.login}
                    onChange={(e) => setMt5Form({ ...mt5Form, login: e.target.value })}
                    className="bg-surface-muted border-border tabular font-medium text-sm text-cyan-500 dark:text-cyan-300"
                  />
                  <span className="text-2xs text-text-subtle">Your broker demo or live login ID</span>
                </div>

                {/* MT5 Server */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-cyan-400" />
                    Broker Server Name
                  </Label>
                  <Input
                    placeholder="e.g. MetaQuotes-Demo or Exness-Trial"
                    value={mt5Form.server}
                    onChange={(e) => setMt5Form({ ...mt5Form, server: e.target.value })}
                    className="bg-surface-muted border-border font-medium text-sm text-text"
                  />
                  <span className="text-2xs text-text-subtle">Exact MT5 broker server name</span>
                </div>

                {/* MT5 Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
                    MT5 Master Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showMt5Password ? 'text' : 'password'}
                      placeholder={trader.mt5_login ? '•••••••• (Leave blank to keep unchanged)' : 'Enter broker trader password'}
                      value={mt5Form.password}
                      onChange={(e) => setMt5Form({ ...mt5Form, password: e.target.value })}
                      className="bg-surface-muted border-border font-medium text-sm text-text pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMt5Password(!showMt5Password)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      {showMt5Password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <span className="text-2xs text-text-subtle">Used by Python sync daemon to authenticate</span>
                </div>

                {/* Account Environment */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-cyan-400" />
                    Account Type / Environment
                  </Label>
                  <select
                    value={mt5Form.account_type}
                    onChange={(e) => setMt5Form({ ...mt5Form, account_type: e.target.value })}
                    className="w-full h-10 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-text focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="demo">Demo / Evaluation Simulation</option>
                    <option value="real">Real / Funded Live Broker</option>
                  </select>
                  <span className="text-2xs text-text-subtle">Demo accounts run through simulated risk rules</span>
                </div>

              </div>

              {/* Sync Daemon Status Box */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3.5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <Terminal className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-cyan-300">
                      Telemetry Ingestion Endpoint: POST /wp-json/fxsim/v1/mt5/sync
                    </p>
                    <p className="text-2xs text-slate-400">
                      Run <code className="text-cyan-300 bg-black/40 px-1 py-0.5 rounded font-mono">python mt5-account-syncer.py</code> on your local PC or VPS to stream real-time broker ticks and trades.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveMt5}
                  disabled={isSavingMt5}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5 shrink-0 shadow-cyan-500/20 font-semibold"
                >
                  {isSavingMt5 ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save MT5 Credentials
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Active Challenge Parameters & Progress Bars */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-text flex items-center gap-2">
                    <Target className="h-4 w-4 text-accent" />
                    Account Progression & Rule Guardrails
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    Live target attainment, drawdown limits, and trading days tracking
                  </CardDescription>
                </div>
                <Badge tone="accent" size="sm" className="tabular font-semibold self-start sm:self-center">
                  Profit Split: {trader.profit_split}%
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              
              {/* Progress 1: Profit Target */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text">Profit Target Progress</span>
                  <span className={cn("terminal-num font-bold", trader.pnl >= 0 ? "text-profit" : "text-loss")}>
                    {formatExactCurrency(trader.pnl)} ({toNum(trader.pnl_pct).toFixed(2)}%)
                  </span>
                </div>
                <Progress value={trader.profit_progress} tone={trader.profit_progress >= 100 ? "success" : "accent"} className="h-2.5" />
                <div className="text-2xs text-text-subtle flex justify-between items-center">
                  <span>Starting Balance: {formatCurrency(trader.starting_balance)}</span>
                  <span className="text-profit font-medium">
                    Target: +{trader.profit_target_pct}% ({formatCurrency(trader.profit_target_val)})
                  </span>
                </div>
              </div>

              {/* Progress 2: Daily Drawdown Limit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text">Daily Drawdown Ceiling (Max {trader.daily_dd_limit}%)</span>
                  <span className="tabular font-semibold text-text-muted">
                    {toNum(trader.daily_dd).toFixed(2)}% used • {Math.max(0, toNum(trader.daily_dd_limit) - toNum(trader.daily_dd)).toFixed(2)}% remaining
                  </span>
                </div>
                <Progress 
                  value={trader.daily_dd_progress} 
                  tone={trader.daily_dd >= trader.daily_dd_limit * 0.8 ? "danger" : trader.daily_dd >= trader.daily_dd_limit * 0.5 ? "warn" : "accent"} 
                  className="h-2.5" 
                />
                <div className="text-2xs text-text-subtle flex justify-between items-center">
                  <span>Daily Loss: {formatCurrency(Math.max(0, (toNum(trader.starting_balance) * toNum(trader.daily_dd) / 100)))}</span>
                  <span className="text-text-muted">Headroom: {Math.max(0, toNum(trader.daily_dd_limit) - toNum(trader.daily_dd)).toFixed(2)}%</span>
                </div>
              </div>

              {/* Progress 3: Total Trailing Drawdown */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text">Max Trailing Drawdown (Max {trader.max_dd_limit}%)</span>
                  <span className="tabular font-semibold text-text-muted">
                    {toNum(trader.max_dd).toFixed(2)}% used • {Math.max(0, toNum(trader.max_dd_limit) - toNum(trader.max_dd)).toFixed(2)}% remaining
                  </span>
                </div>
                <Progress 
                  value={trader.max_dd_progress} 
                  tone={trader.max_dd >= trader.max_dd_limit * 0.8 ? "danger" : trader.max_dd >= trader.max_dd_limit * 0.5 ? "warn" : "accent"} 
                  className="h-2.5" 
                />
                <div className="text-2xs text-text-subtle flex justify-between items-center">
                  <span>Max Loss: {formatCurrency(Math.max(0, (toNum(trader.starting_balance) * toNum(trader.max_dd) / 100)))}</span>
                  <span className="text-text-muted">Headroom: {Math.max(0, toNum(trader.max_dd_limit) - toNum(trader.max_dd)).toFixed(2)}%</span>
                </div>
              </div>

              {/* Progress 4: Minimum Trading Days */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text">Minimum Trading Days</span>
                  <span className="tabular font-semibold text-text-muted">
                    {trader.trading_days} / {trader.min_trading_days} Days ({trader.trading_days_progress.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={trader.trading_days_progress} tone={trader.trading_days >= trader.min_trading_days ? "success" : "info"} className="h-2.5" />
                <div className="text-2xs text-text-subtle flex justify-between items-center">
                  <span>Phase: {trader.phase_label}</span>
                  <span className={trader.trading_days >= trader.min_trading_days ? "text-profit font-medium" : "text-text-muted"}>
                    {trader.trading_days >= trader.min_trading_days ? "✓ Requirement Met" : `${Math.max(0, trader.min_trading_days - trader.trading_days)} days needed`}
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* KYC Document Verification Status */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-text flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-profit" />
                  KYC & Identity Verification
                </CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Status of identity documentation
                </CardDescription>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge tone={trader.kyc_status === 'verified' ? 'success' : trader.kyc_status === 'pending' ? 'warning' : 'neutral'} size="sm">
                  {trader.kyc_status === 'verified' ? 'Verified' : trader.kyc_status === 'pending' ? 'Pending Review' : 'Unverified'}
                </Badge>
                <Button size="sm" asChild variant="outline" className="border-border text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1.5 h-7 text-xs">
                  <Link href="/admin/kyc">
                    <ExternalLink className="h-3 w-3" />
                    Review in KYC Hub
                  </Link>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(() => {
                  const isVerified = trader.kyc_status === 'verified' || trader.kyc_status === 'approved'
                  const isRejected = trader.kyc_status === 'rejected'
                  const isPending = trader.kyc_status === 'pending'
                  
                  const iconBoxClass = isVerified
                    ? 'bg-profit-subtle text-profit'
                    : isRejected
                    ? 'bg-loss-subtle text-loss'
                    : isPending
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-surface-muted text-text-muted'

                  const IconComp = isVerified ? Check : isRejected ? X : isPending ? Clock : AlertTriangle
                  const statusLabel = isVerified ? 'Approved' : isRejected ? 'Rejected' : isPending ? 'Pending Review' : 'Not Submitted'

                  return (
                    <>
                      <div className="p-3 rounded-lg border border-border bg-surface-muted flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", iconBoxClass)}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text">Government ID</p>
                          <p className="text-2xs text-text-muted">{statusLabel}</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-border bg-surface-muted flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", iconBoxClass)}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text">Biometric Selfie</p>
                          <p className="text-2xs text-text-muted">{statusLabel}</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-border bg-surface-muted flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", iconBoxClass)}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text">Review Status</p>
                          <p className="text-2xs text-text-muted">{trader.kyc_reviewer}</p>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Payment & Payout History Table */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-text flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-accent" />
                  Financial History ({txData.length})
                </CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Challenge purchases, fee settlements, and profit split payouts
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <DataTable<TxHistoryRow>
                columns={txColumns}
                data={txData}
                emptyMessage="No payments or payout records found for this account."
                className="border-0 rounded-none bg-transparent"
              />
            </CardContent>
          </Card>

          {/* Hard Breach Violations (if any) */}
          {traderApiData?.breaches && traderApiData.breaches.length > 0 && (
            <Card className="bg-surface border-red-500/30">
              <CardHeader className="border-b border-red-500/20 pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    Breach Audit Trail ({traderApiData.breaches.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    Hard risk violations and auto-liquidation records
                  </CardDescription>
                </div>
                <Badge tone="danger" size="sm">
                  Violations Logged
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {traderApiData.breaches.map((b: any, idx: number) => (
                    <div key={idx} className="p-3 bg-surface-muted rounded-xl border border-red-500/20 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-red-400 uppercase tracking-wide">{b.rule_type || b.reason}</span>
                          <span className="text-2xs text-text-muted tabular font-medium">Challenge #{b.challenge_id}</span>
                        </div>
                        <p className="text-xs text-text mt-0.5">{b.description || 'Threshold breached'}</p>
                      </div>
                      <span className="text-2xs text-text-muted tabular font-medium">{b.created_at ? new Date(b.created_at).toLocaleString() : 'Recent'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column: Private Admin Notes & Activity Timeline */}
        <div className="space-y-6">
          
          {/* Private Administrative Notes */}
          <Card className="bg-surface border-border flex flex-col">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base text-text flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Private Admin Notes
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Internal compliance logs (hidden from trader)
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              
              {/* Note Input Box */}
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add internal audit note, compliance remarks, or override rationale..."
                  className="text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveNote}
                    loading={isSavingNote}
                    className="gap-1.5 text-xs h-8 shadow-accent/20"
                  >
                    <Send className="h-3 w-3" />
                    Save Note
                  </Button>
                </div>
              </div>

              {/* Note History */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <span className="text-2xs font-bold uppercase tracking-wider text-text-muted block">
                  Audit History ({adminNotesList.length})
                </span>
                
                {adminNotesList.length === 0 ? (
                  <p className="text-xs text-text-muted italic py-2">No administrative notes recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {adminNotesList.map((note) => (
                      <div 
                        key={note.id}
                        className="p-3 rounded-lg border border-border bg-surface-muted space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-accent">{note.author}</span>
                          <span className="text-2xs text-text-muted tabular font-medium">{note.date}</span>
                        </div>
                        <p className="text-xs text-text leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Activity Audit Timeline */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base text-text flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Account Audit Timeline
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Chronological system & trading milestones
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5">
              {timelineEvents.length === 0 ? (
                <p className="text-xs text-text-muted italic">No milestone events recorded yet.</p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                  {timelineEvents.map((event: any, idx: number) => {
                    const Icon = event.icon
                    return (
                      <div key={idx} className="relative">
                        {/* Timeline node icon */}
                        <div className={`absolute -left-[30px] top-0 h-6 w-6 rounded-full border flex items-center justify-center ${
                          event.tone === 'success' 
                            ? 'bg-profit-subtle border-profit-subtle text-profit'
                            : event.tone === 'accent'
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : event.tone === 'info'
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                            : 'bg-surface border-border text-text-muted'
                        }`}>
                          <Icon className="h-3 w-3" />
                        </div>

                        {/* Timeline event content */}
                        <div>
                          <p className="text-xs font-semibold text-text">{event.title}</p>
                          <p className="text-2xs text-text-muted mt-0.5">{event.description}</p>
                          <span className="text-2xs text-text-muted/80 tabular font-medium mt-1 block">
                            {event.date}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

      {/* ── 4. Enterprise Overrides Modal Integration ─────────────────────── */}
      <EnterpriseOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        trader={{
          id: trader.id,
          user_id: trader.user_id,
          name: trader.name,
          username: trader.username,
          account_id: trader.account_id,
          plan_name: trader.plan_name,
          profit_split: trader.profit_split,
          max_daily_loss: trader.daily_dd_limit,
          max_total_loss: trader.max_dd_limit,
          min_days: trader.min_days,
          news_trading: trader.news_trading,
          weekend_holding: trader.weekend_holding,
        }}
        onSuccess={() => {
          refetch()
        }}
      />

      {/* ── 5. Direct Password Reset Modal ────────────────────────────────── */}
      <DirectPasswordResetModal
        isOpen={resetPasswordModalOpen}
        onClose={() => setResetPasswordModalOpen(false)}
        trader={{
          user_id: trader.user_id,
          name: trader.name,
          username: trader.username,
          email: trader.email,
        }}
        onSuccess={() => {
          refetch()
        }}
      />

      {/* ── 6. Impersonate Confirmation Dialog ──────────────────────────────── */}
      <ConfirmDialog
        isOpen={impersonateConfirmOpen}
        onCancel={() => setImpersonateConfirmOpen(false)}
        onConfirm={async () => {
          setIsImpersonating(true)
          setImpersonateConfirmOpen(false)
          await handleImpersonate()
          setIsImpersonating(false)
        }}
        title={`View Dashboard as ${trader.name}?`}
        description={`You are about to launch a read-only trader session for ${trader.name} (${trader.email}). You will be redirected to the trader dashboard to inspect account metrics and trading history.`}
        confirmText={isImpersonating ? 'Starting Session...' : 'Start Trader Session'}
        cancelText="Cancel"
      />

      {/* ── 7. Freeze / Unfreeze Confirmation Dialog ────────────────────────── */}
      <ConfirmDialog
        isOpen={freezeConfirmOpen}
        onCancel={() => setFreezeConfirmOpen(false)}
        onConfirm={async () => {
          setIsFreezing(true)
          setFreezeConfirmOpen(false)
          await handleToggleFreeze()
          setIsFreezing(false)
        }}
        title={isBanned ? `Unfreeze ${trader.name}'s account?` : `Freeze ${trader.name}'s account?`}
        description={
          isBanned
            ? `${trader.name} (${trader.email}) will regain full trading access and MT5 access immediately.`
            : `${trader.name} (${trader.email}) will be suspended and MT5 access disabled immediately. Their open positions are not closed by this action.`
        }
        confirmText={isFreezing ? 'Applying...' : (isBanned ? 'Unfreeze Account' : 'Freeze Account')}
        cancelText="Cancel"
        isDestructive={!isBanned}
        loading={isFreezing}
      />

    </div>
  )
}
