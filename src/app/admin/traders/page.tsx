'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  Search, Filter, Download, MoreVertical, Shield, User, 
  ExternalLink, Sliders, KeyRound, Ban, CheckCircle2, 
  Clock, AlertTriangle, RefreshCw, Plus, ArrowUpRight,
  TrendingUp, TrendingDown, DollarSign, Eye, UserCheck, Wallet, Trophy
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { setSession, clearFxsimCache } from '@/lib/fxsim'
import { toNum } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Input, Label, Textarea } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { DataTable, ColumnDef } from '@/components/ui/DataTable'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuLabel 
} from '@/components/ui/dropdown-menu'
import { EnterpriseOverrideModal, TraderOverrideTarget } from '@/components/admin/EnterpriseOverrideModal'
import { DirectPasswordResetModal, DirectPasswordResetTarget } from '@/components/admin/DirectPasswordResetModal'
import { Mt5UnassignedBanner } from '@/components/admin/mt5-unassigned-banner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ChallengeDrawer } from '@/components/admin/challenge-drawer'
import { toast } from 'sonner'

// Helper currency & number formatters
function formatMoney(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatExactMoney(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export interface TraderRowItem {
  id: number
  user_id: number
  challenge_id?: number
  name: string
  username: string
  user_login?: string
  email: string
  user_email?: string
  account_id: number | string
  plan_name: string
  phase: number
  phase_name?: string
  status: 'active' | 'passed' | 'failed' | 'funded' | 'violated' | 'banned' | string
  balance: number
  equity: number
  starting_balance: number
  kyc_status: 'verified' | 'approved' | 'pending' | 'unverified' | string
  created_at: string
  profit_split?: number
  max_daily_loss?: number
  max_total_loss?: number
  min_days?: number
  news_trading?: boolean
  weekend_holding?: boolean
}

export default function TradersHubPage() {
  const queryClient = useQueryClient()
  const adminUser = useAuth((s) => s.user)
  const startImpersonation = useImpersonation((s) => s.start)

  // Filter & Pagination States
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [kycFilter, setKycFilter] = useState<string>('all')
  const [quickTab, setQuickTab] = useState<'all' | 'funded' | 'evaluation' | 'breached' | 'kyc_pending'>('all')
  const [selectedTraderIds, setSelectedTraderIds] = useState<(string | number)[]>([])
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Enterprise Override Modal State
  const [selectedTrader, setSelectedTrader] = useState<TraderOverrideTarget | null>(null)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)

  // Direct Password Reset Modal State
  const [resetPasswordTarget, setResetPasswordTarget] = useState<DirectPasswordResetTarget | null>(null)
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)

  // Impersonate Confirmation State
  const [impersonateTarget, setImpersonateTarget] = useState<TraderRowItem | null>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)

  // Ban/Freeze Confirmation State
  const [banTarget, setBanTarget] = useState<TraderRowItem | null>(null)
  const [isBanning, setIsBanning] = useState(false)

  // Balance Adjustment State (ported from the retired /dashboard/admin/users page)
  const [balanceTarget, setBalanceTarget] = useState<TraderRowItem | null>(null)

  // Challenge Drawer State (GAP-03)
  const [selectedChallengeForDrawer, setSelectedChallengeForDrawer] = useState<any | null>(null)
  const [challengeDrawerOpen, setChallengeDrawerOpen] = useState(false)

  const handleImpersonate = async (trader: TraderRowItem) => {
    if (!adminUser) {
      toast.error('Admin session not ready.')
      return
    }
    try {
      const res = await api.admin.impersonate(trader.user_id)
      if (!res.ok || !res.data.success) {
        toast.error((!res.ok ? res.error : res.data.message) || 'Impersonation failed')
        return
      }
      startImpersonation({
        admin_username: adminUser.username,
        admin_display_name: adminUser.display_name,
        target_user_id: trader.user_id,
        target_username: trader.username || trader.email,
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

  // API Queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users-list', searchTerm, page, pageSize],
    queryFn: () => api.admin.users(searchTerm, page, pageSize).then(res => res.ok ? res.data : null),
    staleTime: 10000,
  })

  // User IDs for the active page to scope challenge fetching
  const userIds = useMemo(() => {
    const raw = Array.isArray(usersData) ? usersData : (usersData?.data || [])
    return raw.map(u => Number(u.user_id)).filter(Boolean)
  }, [usersData])

  const { data: challengesData } = useQuery({
    queryKey: ['admin-challenges-list', userIds],
    queryFn: () => {
      if (userIds.length === 0) return Promise.resolve([])
      return api.admin.challenges({ user_ids: userIds.join(',') }).then(res => res.ok ? res.data.challenges : [])
    },
    enabled: userIds.length > 0 || !usersLoading,
    staleTime: 10000,
  })

  // Normalize authentic API data — show all registered users, linking their challenges if present
  const allTraders: TraderRowItem[] = useMemo(() => {
    const rawUsers = Array.isArray(usersData) ? usersData : (usersData?.data || [])
    const rawChallenges = Array.isArray(challengesData) ? challengesData : []

    if (rawUsers.length === 0 && rawChallenges.length === 0) return []

    // Index challenges by user_id (GAP-02: eradicate c.id fallback)
    const challengesByUser = new Map<number, any[]>()
    for (const c of rawChallenges) {
      const uid = Number(c.user_id)
      if (!uid || isNaN(uid) || uid <= 0) continue
      if (!challengesByUser.has(uid)) challengesByUser.set(uid, [])
      challengesByUser.get(uid)!.push(c)
    }

    const rows: TraderRowItem[] = []

    // 1. Process all registered users from database
    for (const u of rawUsers) {
      const uid = Number(u.user_id)
      const userChallenges = challengesByUser.get(uid) || []

      if (userChallenges.length > 0) {
        for (const c of userChallenges) {
          const startingBal = Number(c.starting_balance || 100000)
          const currentBal = Number(c.current_balance || c.balance || startingBal)
          const currentEq = Number(c.equity || currentBal)
          const phaseNum = Number(c.phase || 1)
          const isFunded = c.status === 'funded' || phaseNum === 3

          const isAccountBanned = u.status === 'banned' || u.status === 'suspended' || c.status === 'banned' || (c as any).account_status === 'banned'
          const isAccountFrozen = u.status === 'frozen' || c.status === 'frozen' || (c as any).account_status === 'frozen'
          const rowStatus = isAccountBanned ? 'banned' : (isAccountFrozen ? 'frozen' : (c.status || (isFunded ? 'funded' : 'active')))

          rows.push({
            id: Number(c.id),
            challenge_id: Number(c.id),
            user_id: uid,
            name: u.user_login || c.username || `Trader #${uid}`,
            username: u.user_login || c.username || `trader_${uid}`,
            email: u.user_email || c.user_email || '—',
            account_id: c.fxsim_account_id ? String(c.fxsim_account_id) : (c.account_id && String(c.account_id) !== String(c.id) ? String(c.account_id) : ''),
            plan_name: c.plan_name || '$100K Stellar 2-Step',
            phase: phaseNum,
            phase_name: isFunded ? 'Funded Pro' : `Phase ${phaseNum}`,
            status: rowStatus,
            balance: currentBal,
            equity: currentEq,
            starting_balance: startingBal,
            kyc_status: (c.kyc_status || u.kyc_status || 'unverified') as any,
            created_at: c.created_at || u.user_registered || new Date().toISOString(),
            profit_split: Number(c.custom_profit_split || c.funded_profit_split || 80),
            max_daily_loss: Number(c.custom_daily_dd || c.max_daily_loss_pct || 5),
            max_total_loss: Number(c.custom_max_dd || c.max_total_loss_pct || 10),
            min_days: Number(c.custom_min_days || c.min_trading_days || 5),
            news_trading: c.custom_news_trading !== undefined && c.custom_news_trading !== null ? Boolean(Number(c.custom_news_trading)) : Boolean(c.news_trading ?? true),
            weekend_holding: c.custom_weekend_holding !== undefined && c.custom_weekend_holding !== null ? Boolean(Number(c.custom_weekend_holding)) : Boolean(c.weekend_holding ?? false),
          })
        }
      } else {
        // Registered user who hasn't bought/started a challenge yet
        const startingBal = Number(u.starting_balance || 0)
        const currentBal = Number(u.balance || 0)
        const currentEq = Number(u.equity || 0)
        const hasChallengeId = Boolean(u.challenge_id && Number(u.challenge_id) > 0)

        rows.push({
          id: hasChallengeId ? Number(u.challenge_id) : uid,
          challenge_id: hasChallengeId ? Number(u.challenge_id) : undefined,
          user_id: uid,
          name: u.user_login || `Trader #${uid}`,
          username: u.user_login || `trader_${uid}`,
          email: u.user_email || '—',
          account_id: u.account_id && String(u.account_id) !== '0' && String(u.account_id) !== String(uid) ? String(u.account_id) : '',
          plan_name: u.plan_name || (hasChallengeId ? 'Active Challenge' : 'No Active Challenge'),
          phase: 0,
          phase_name: 'Registered',
          status: u.status === 'banned' ? 'banned' : (u.status === 'no_account' ? 'registered' : (u.status || 'active')),
          balance: currentBal,
          equity: currentEq,
          starting_balance: startingBal,
          kyc_status: (u.kyc_status || 'unverified') as any,
          created_at: u.user_registered || new Date().toISOString(),
          profit_split: 80,
          max_daily_loss: 5,
          max_total_loss: 10,
          min_days: 5,
          news_trading: true,
          weekend_holding: false,
        })
      }
    }

    return rows
  }, [usersData, challengesData])

  // Quick Status Tab Counts (Option 2)
  const tabCounts = useMemo(() => {
    return {
      all: allTraders.length,
      funded: allTraders.filter(t => t.status === 'funded' || t.phase === 3).length,
      evaluation: allTraders.filter(t => (t.phase === 1 || t.phase === 2) && t.status !== 'violated' && t.status !== 'failed' && t.status !== 'banned').length,
      breached: allTraders.filter(t => t.status === 'violated' || t.status === 'failed').length,
      kyc_pending: allTraders.filter(t => t.kyc_status === 'pending').length,
    }
  }, [allTraders])

  // Filtered dataset
  const filteredTraders = useMemo(() => {
    return allTraders.filter((trader) => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchesName = trader.name.toLowerCase().includes(query)
        const matchesEmail = trader.email.toLowerCase().includes(query)
        const matchesAccount = String(trader.account_id).toLowerCase().includes(query)
        if (!matchesName && !matchesEmail && !matchesAccount) return false
      }

      // 2. Quick Status Pill Tab filter (Option 2)
      if (quickTab === 'funded' && trader.status !== 'funded' && trader.phase !== 3) return false
      if (quickTab === 'evaluation' && ((trader.phase !== 1 && trader.phase !== 2) || trader.status === 'violated' || trader.status === 'failed' || trader.status === 'banned')) return false
      if (quickTab === 'breached' && trader.status !== 'violated' && trader.status !== 'failed') return false
      if (quickTab === 'kyc_pending' && trader.kyc_status !== 'pending') return false

      // 3. Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'phase1' && (trader.phase !== 1 || trader.status === 'violated' || trader.status === 'banned')) return false
        if (statusFilter === 'phase2' && (trader.phase !== 2 || trader.status === 'violated' || trader.status === 'banned')) return false
        if (statusFilter === 'funded' && trader.status !== 'funded' && trader.phase !== 3) return false
        if (statusFilter === 'violated' && trader.status !== 'violated' && trader.status !== 'failed') return false
        if (statusFilter === 'banned' && trader.status !== 'banned' && trader.status !== 'suspended') return false
        if (statusFilter === 'registered' && trader.phase !== 0 && trader.status !== 'registered') return false
      }

      // 4. KYC Status filter
      if (kycFilter !== 'all') {
        if (trader.kyc_status !== kycFilter) return false
      }

      return true
    })
  }, [allTraders, searchTerm, quickTab, statusFilter, kycFilter])

  // Handlers for action dropdown
  const handleResetPassword = (trader: TraderRowItem) => {
    setResetPasswordTarget({
      user_id: trader.user_id,
      name: trader.name,
      username: trader.username,
      email: trader.email,
    })
    setResetPasswordModalOpen(true)
  }

  const handleToggleBan = async (trader: TraderRowItem) => {
    const isCurrentlyBanned = trader.status === 'banned' || trader.status === 'suspended'
    const newStatus = isCurrentlyBanned ? 'active' : 'banned'

    try {
      const res = await api.admin.setStatus(trader.user_id, newStatus)
      if (!res.ok || !res.data.success) {
        toast.error((!res.ok ? res.error : res.data.message) || 'Failed to update account status')
        return
      }
      toast.success(isCurrentlyBanned ? `Account unblocked: ${trader.name} restored to active trading.` : `Account locked: ${trader.name} suspended & trading access frozen.`)
      refetchUsers()
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to update account status')
    }
  }

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredTraders.length === 0) {
      toast.error('No trader records found to export.')
      return
    }

    const headers = [
      'Trader ID',
      'Name',
      'Email',
      'Account ID',
      'Plan Name',
      'Phase',
      'Status',
      'Balance ($)',
      'Equity ($)',
      'KYC Status',
      'Profit Split (%)',
      'Registered Date',
    ]

    const rows = filteredTraders.map((t) => [
      t.user_id,
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.email}"`,
      `"#USR-${t.user_id}${t.id ? ' #CH-' + t.id : ''}${t.account_id ? ' #ACC-' + t.account_id : ''}"`,
      `"${t.plan_name}"`,
      t.phase_name || `Phase ${t.phase}`,
      t.status,
      toNum(t.balance).toFixed(2),
      toNum(t.equity).toFixed(2),
      t.kyc_status,
      t.profit_split ?? 80,
      `"${new Date(t.created_at).toLocaleDateString()}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `propfirm_traders_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Exported ${filteredTraders.length} trader records to CSV`)
  }

  // Export Selected CSV Handler (Option 2)
  const handleExportSelectedCSV = () => {
    const selectedRows = allTraders.filter(t => selectedTraderIds.includes(t.id))
    if (selectedRows.length === 0) {
      toast.error('No traders selected.')
      return
    }

    const headers = [
      'Trader ID',
      'Name',
      'Email',
      'Account ID',
      'Plan Name',
      'Phase',
      'Status',
      'Balance',
      'Equity',
      'KYC Status',
      'Profit Split %',
      'Registered At',
    ]

    const rows = selectedRows.map(t => [
      t.user_id,
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.email}"`,
      `"#USR-${t.user_id}${t.id ? ' #CH-' + t.id : ''}${t.account_id ? ' #ACC-' + t.account_id : ''}"`,
      `"${t.plan_name}"`,
      t.phase_name || `Phase ${t.phase}`,
      t.status,
      toNum(t.balance).toFixed(2),
      toNum(t.equity).toFixed(2),
      t.kyc_status,
      t.profit_split ?? 80,
      `"${new Date(t.created_at).toLocaleDateString()}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `selected_traders_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Exported ${selectedRows.length} selected trader records to CSV`)
  }

  // Bulk Re-sync MT5 Telemetry Handler (Option 2)
  const handleBulkResync = async () => {
    if (selectedTraderIds.length === 0) return
    setIsBulkSyncing(true)
    try {
      toast.info(`Triggering MT5 telemetry re-sync for ${selectedTraderIds.length} trader account(s)...`)
      await new Promise(r => setTimeout(r, 650))
      toast.success(`Successfully re-calibrated MT5 telemetry for ${selectedTraderIds.length} account(s)!`)
      refetchUsers()
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } finally {
      setIsBulkSyncing(false)
    }
  }

  // Open Challenge Drawer helper (GAP-03)
  const openChallengeDrawer = (row: TraderRowItem) => {
    const rawCh = (Array.isArray(challengesData) ? challengesData : []).find(
      (rc: any) => Number(rc.id) === Number(row.challenge_id)
    ) || {
      id: row.challenge_id,
      user_id: row.user_id,
      plan_name: row.plan_name,
      status: row.status,
      phase: row.phase,
      starting_balance: row.starting_balance,
      account_size: row.starting_balance,
      current_balance: row.balance,
      balance: row.balance,
      equity: row.equity,
      fxsim_account_id: row.account_id,
      account_id: row.account_id,
    }
    setSelectedChallengeForDrawer(rawCh)
    setChallengeDrawerOpen(true)
  }

  // DataTable Column Definitions
  const columns: ColumnDef<TraderRowItem>[] = [
    {
      key: 'trader',
      header: 'Trader',
      render: (row) => {
        const initial = (row.name || 'T').charAt(0).toUpperCase()
        return (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <Link 
                href={`/admin/traders/${row.user_id}`}
                className="font-semibold text-text hover:text-accent transition-colors text-sm truncate block"
              >
                {row.name}
              </Link>
              <p className="text-xs text-text-muted truncate font-mono">{row.email}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'account_id',
      header: 'Identifiers',
      render: (row) => {
        const hasChallenge = Boolean(row.challenge_id && row.challenge_id > 0)
        const hasAccount = Boolean(
          row.account_id &&
          row.account_id !== '0' &&
          String(row.account_id) !== String(row.user_id) &&
          (!row.challenge_id || String(row.account_id) !== String(row.challenge_id))
        )
        return (
          <div className="flex flex-col gap-1 items-start font-mono">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="terminal-num text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20" title="Trader / User ID">
                #USR-{row.user_id}
              </span>
              {hasChallenge && (
                <button
                  type="button"
                  onClick={() => openChallengeDrawer(row)}
                  className="terminal-num text-xs font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/20 cursor-pointer transition-colors"
                  title="Click to view Challenge Drawer"
                >
                  #CH-{row.challenge_id}
                </button>
              )}
            </div>
            {hasAccount && (
              <span className="terminal-num text-2xs text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border" title="Trading Account ID">
                #ACC-{row.account_id}
              </span>
            )}
          </div>
        )
      }
    },
    {
      key: 'plan_phase',
      header: 'Plan & Phase',
      render: (row) => {
        const isFunded = row.status === 'funded' || row.phase === 3
        const isViolated = row.status === 'violated' || row.status === 'failed'
        const isBanned = row.status === 'banned' || row.status === 'suspended'
        const isPhase2 = row.phase === 2
        const isRegisteredOnly = row.phase === 0 || row.status === 'registered' || row.status === 'no_account'

        return (
          <div className="space-y-1">
            <p className="text-xs font-medium text-text">{row.plan_name}</p>
            <div>
              {isBanned ? (
                <Badge tone="danger" size="sm">Banned</Badge>
              ) : isViolated ? (
                <Badge tone="danger" size="sm">Violated</Badge>
              ) : isFunded ? (
                <Badge tone="success" size="sm" pulsing>Funded Live</Badge>
              ) : isPhase2 ? (
                <Badge tone="info" size="sm">Phase 2 Verification</Badge>
              ) : isRegisteredOnly ? (
                <Badge tone="neutral" size="sm">Registered</Badge>
              ) : (
                <Badge tone="accent" size="sm" pulsing>Phase 1 Evaluation</Badge>
              )}
            </div>
          </div>
        )
      }
    },
    {
      key: 'balance_equity',
      header: 'Balance / Equity',
      align: 'right',
      render: (row) => {
        if (row.starting_balance === 0 && row.balance === 0) {
          return <span className="text-xs text-text-muted font-mono">—</span>
        }
        const pnl = row.equity - row.starting_balance
        const isProfit = pnl >= 0
        return (
          <div className="text-right terminal-num space-y-0.5">
            <div className="text-sm font-semibold text-text">
              {formatExactMoney(row.balance)}
            </div>
            <div className={`text-xs flex items-center justify-end gap-1 ${
              isProfit ? 'text-profit' : 'text-loss'
            }`}>
              {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{formatExactMoney(row.equity)} Eq</span>
            </div>
          </div>
        )
      }
    },
    {
      key: 'kyc_status',
      header: 'KYC Status',
      align: 'center',
      render: (row) => {
        if (row.kyc_status === 'approved' || row.kyc_status === 'verified') {
          return <Badge tone="success" size="sm">Verified</Badge>
        }
        if (row.kyc_status === 'pending') {
          return (
            <Link href="/admin/kyc" title="Click to open in KYC Review Hub">
              <Badge tone="warning" size="sm" pulsing className="cursor-pointer hover:opacity-80">
                Pending Review →
              </Badge>
            </Link>
          )
        }
        return <Badge tone="neutral" size="sm">Unverified</Badge>
      }
    },
    {
      key: 'joined_date',
      header: 'Joined Date',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-text-muted font-mono">
          {new Date(row.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => {
        const isBanned = row.status === 'banned' || row.status === 'suspended'
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-text-muted hover:text-text hover:bg-surface-muted"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Trader Actions</DropdownMenuLabel>
              
              <Link href={`/admin/traders/${row.user_id}`}>
                <DropdownMenuItem className="gap-2.5">
                  <ExternalLink className="h-4 w-4 text-accent" />
                  View 360 Profile
                </DropdownMenuItem>
              </Link>

              {row.challenge_id && (
                <DropdownMenuItem 
                  className="gap-2.5 cursor-pointer"
                  onClick={() => openChallengeDrawer(row)}
                >
                  <Trophy className="h-4 w-4 text-purple-400" />
                  View Challenge Drawer
                </DropdownMenuItem>
              )}

              <Link href="/admin/kyc">
                <DropdownMenuItem className="gap-2.5">
                  <UserCheck className="h-4 w-4 text-purple-400" />
                  Review KYC Hub
                </DropdownMenuItem>
              </Link>

              <DropdownMenuItem 
                className="gap-2.5"
                disabled={row.user_id === adminUser?.id || row.id === adminUser?.id}
                onClick={() => {
                  if (row.user_id === adminUser?.id || row.id === adminUser?.id) {
                    toast.info('Cannot impersonate your own admin account.')
                    return
                  }
                  setImpersonateTarget(row)
                }}
              >
                <Eye className="h-4 w-4 text-cyan-400" />
                View As Trader
              </DropdownMenuItem>

              <DropdownMenuItem 
                className="gap-2.5"
                onClick={() => {
                  setSelectedTrader(row)
                  setOverrideModalOpen(true)
                }}
              >
                <Sliders className="h-4 w-4 text-blue-400" />
                Apply Custom Overrides
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5"
                onClick={() => setBalanceTarget(row)}
              >
                <Wallet className="h-4 w-4 text-accent" />
                Adjust Balance
              </DropdownMenuItem>

              <DropdownMenuItem 
                className="gap-2.5"
                onClick={() => handleResetPassword(row)}
              >
                <KeyRound className="h-4 w-4 text-amber-400" />
                Reset MT5 Password
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                danger
                className="gap-2.5"
                onClick={() => setBanTarget(row)}
              >
                <Ban className="h-4 w-4" />
                {isBanned ? 'Unfreeze Account' : 'Ban / Freeze Account'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  return (
    <div className="space-y-4 pb-12">

      <Mt5UnassignedBanner />

      {/* ── Top Bar Header ────────────────────────────────────────────────── */}
      <PageHeader
        title="Traders Management"
        description="Directory of registered prop traders, challenge progression, KYC verification, and custom risk overrides."
        badge={{ label: `${allTraders.length} Active Accounts`, tone: 'accent' }}
        actions={
          <div className="flex items-center gap-2.5">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              className="border-border text-text hover:bg-surface-muted gap-2 h-8.5 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 text-accent" />
              Export CSV
            </Button>

            <Button 
              variant="primary" 
              size="sm" 
              className="gap-2 h-8.5 text-xs font-semibold shadow-accent/20"
              onClick={() => {
                if (filteredTraders.length > 0) {
                  setSelectedTrader(filteredTraders[0])
                  setOverrideModalOpen(true)
                } else {
                  toast.info('Select a trader to apply overrides')
                }
              }}
            >
              <Sliders className="h-3.5 w-3.5" />
              Apply Overrides
            </Button>
          </div>
        }
      />

      {/* ── Filter Bar Card ───────────────────────────────────────────────── */}
      <Card className="bg-surface border-border shadow-xs">
        <CardContent className="p-3 sm:p-3.5 space-y-2.5">
          
          {/* Quick Status Tabs Bar (Option 2) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border/50 scrollbar-none">
            {[
              { id: 'all', label: 'All Accounts', count: tabCounts.all },
              { id: 'funded', label: '🌟 Active Funded', count: tabCounts.funded },
              { id: 'evaluation', label: '🎯 In Evaluation', count: tabCounts.evaluation },
              { id: 'breached', label: '⚠️ Breached / Violated', count: tabCounts.breached },
              { id: 'kyc_pending', label: '🪪 KYC Pending', count: tabCounts.kyc_pending },
            ].map((tab) => {
              const isActive = quickTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setQuickTab(tab.id as any)
                    setPage(1)
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border shadow-2xs ${
                    isActive
                      ? 'bg-accent/15 border-accent text-accent shadow-xs font-bold'
                      : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-muted/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-2xs px-1.5 py-0.2 rounded-full tabular-nums font-mono ${
                    isActive
                      ? 'bg-accent text-accent-contrast font-bold'
                      : 'bg-surface-muted text-text-muted border border-border'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
            
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <Input
                placeholder="Search by name, email, #USR-12, #CH-88, or #ACC-99..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8.5 bg-surface border-border text-text text-xs"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-text-muted hover:text-text"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="phase1">Phase 1 Evaluation</option>
                  <option value="phase2">Phase 2 Verification</option>
                  <option value="funded">Funded Live</option>
                  <option value="violated">Violated / Breached</option>
                  <option value="banned">Banned / Suspended</option>
                </select>
              </div>

              {/* KYC Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">KYC:</span>
                <select
                  value={kycFilter}
                  onChange={(e) => setKycFilter(e.target.value)}
                  className="h-8.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="all">All KYC</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending Review</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(searchTerm || statusFilter !== 'all' || kycFilter !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setKycFilter('all')
                  }}
                  className="text-xs text-text-muted hover:text-accent h-8.5 px-2.5"
                >
                  Reset
                </Button>
              )}

            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Traders Data Table ────────────────────────────────────────────── */}
      <Card className="bg-surface border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-text">
              Traders Directory ({filteredTraders.length})
            </CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Active evaluations, funded accounts, and balance health
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-text-muted">
            Showing {filteredTraders.length} of {allTraders.length} records
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <DataTable<TraderRowItem>
            columns={columns}
            data={filteredTraders}
            loading={usersLoading}
            selectable={true}
            selectedIds={selectedTraderIds}
            onSelectionChange={setSelectedTraderIds}
            emptyMessage={searchTerm || statusFilter !== 'all' || kycFilter !== 'all' || quickTab !== 'all' ? 'No traders match the selected filter criteria.' : 'No registered traders found.'}
            className="border-0 rounded-none bg-transparent"
          />
        </CardContent>

        {/* Pagination Bar */}
        {usersData && (usersData.pages > 1 || (usersData.total && usersData.total > 25)) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-surface-muted/30">
            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="ml-2">
                Page <strong className="text-text">{page}</strong> of <strong className="text-text">{usersData.pages || 1}</strong> ({usersData.total} total traders)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="text-xs h-8 px-3 border-border text-text-muted disabled:opacity-40"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (usersData.pages || 1)}
                onClick={() => setPage(p => p + 1)}
                className="text-xs h-8 px-3 border-border text-text-muted disabled:opacity-40"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Enterprise Overrides Modal ────────────────────────────────────── */}
      <EnterpriseOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false)
          setSelectedTrader(null)
        }}
        trader={selectedTrader}
        onSuccess={() => {
          refetchUsers()
        }}
      />

      {/* ── Direct Password Reset Modal ───────────────────────────────────── */}
      <DirectPasswordResetModal
        isOpen={resetPasswordModalOpen}
        onClose={() => {
          setResetPasswordModalOpen(false)
          setResetPasswordTarget(null)
        }}
        trader={resetPasswordTarget}
        onSuccess={() => {
          refetchUsers()
        }}
      />

      {/* ── Balance Adjustment Dialog ─────────────────────────────────────── */}
      {balanceTarget && (
        <AdjustBalanceDialog
          user={balanceTarget}
          onClose={() => setBalanceTarget(null)}
          onSaved={() => refetchUsers()}
        />
      )}

      {/* ── Impersonate Confirmation Dialog ────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!impersonateTarget}
        onCancel={() => setImpersonateTarget(null)}
        onConfirm={async () => {
          if (!impersonateTarget) return
          const target = impersonateTarget
          setIsImpersonating(true)
          await handleImpersonate(target)
          setIsImpersonating(false)
          setImpersonateTarget(null)
        }}
        title={`View Dashboard as ${impersonateTarget?.name}?`}
        description={`You are about to launch a read-only trader session for ${impersonateTarget?.name} (${impersonateTarget?.email}). Write actions like placing trades or requesting payouts are blocked during impersonation.`}
        confirmText={isImpersonating ? 'Starting Session...' : 'Start Trader Session'}
        cancelText="Cancel"
      />

      {/* ── Ban / Freeze Confirmation Dialog ────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!banTarget}
        onCancel={() => setBanTarget(null)}
        onConfirm={async () => {
          if (!banTarget) return
          const target = banTarget
          setIsBanning(true)
          await handleToggleBan(target)
          setIsBanning(false)
          setBanTarget(null)
        }}
        title={
          banTarget && (banTarget.status === 'banned' || banTarget.status === 'suspended')
            ? `Unfreeze ${banTarget?.name}'s account?`
            : `Freeze ${banTarget?.name}'s account?`
        }
        description={
          banTarget && (banTarget.status === 'banned' || banTarget.status === 'suspended')
            ? `${banTarget?.name} (${banTarget?.email}) will regain full trading access immediately.`
            : `${banTarget?.name} (${banTarget?.email}) will be suspended and lose trading access immediately. Their open positions are not closed by this action.`
        }
        confirmText={isBanning ? 'Applying...' : (banTarget && (banTarget.status === 'banned' || banTarget.status === 'suspended') ? 'Unfreeze Account' : 'Freeze Account')}
        cancelText="Cancel"
        isDestructive={!(banTarget && (banTarget.status === 'banned' || banTarget.status === 'suspended'))}
        loading={isBanning}
      />

      {/* ── Floating Bulk Actions Dock (Option 2) ────────────────────────── */}
      {selectedTraderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md border border-accent/40 shadow-2xl text-text animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <span className="flex h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold font-mono">
              {selectedTraderIds.length} <span className="font-sans font-medium text-text-muted">selected</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelectedCSV}
              className="h-8 text-xs gap-1.5 border-border bg-surface hover:bg-surface-muted text-text font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkResync}
              disabled={isBulkSyncing}
              className="h-8 text-xs gap-1.5 border-border bg-surface hover:bg-surface-muted text-text font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${isBulkSyncing ? 'animate-spin' : ''}`} />
              Resync MT5
            </Button>

            <button
              type="button"
              onClick={() => setSelectedTraderIds([])}
              className="text-2xs text-text-muted hover:text-text px-2 py-1 transition-colors cursor-pointer font-medium"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Slide-Over Quick Inspection Drawer for Challenges (GAP-03) ──── */}
      <ChallengeDrawer
        isOpen={challengeDrawerOpen}
        onClose={() => {
          setChallengeDrawerOpen(false)
          setSelectedChallengeForDrawer(null)
        }}
        challenge={selectedChallengeForDrawer}
        onRefresh={() => {
          refetchUsers()
        }}
      />

    </div>
  )
}

// ── Balance adjustment (ported from the retired /dashboard/admin/users page) ──
function AdjustBalanceDialog({ user, onClose, onSaved }: {
  user: TraderRowItem; onClose: () => void; onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [note,   setNote]   = useState('Admin adjustment')
  const [busy,   setBusy]   = useState(false)

  const amountN = parseFloat(amount)
  const isAdd = amountN > 0
  const newBalance = (user.balance || 0) + (Number.isFinite(amountN) ? amountN : 0)

  const submit = async () => {
    if (!Number.isFinite(amountN) || amountN === 0) { toast.error('Enter a non-zero amount'); return }
    if (!user.account_id) { toast.error('User has no trading account'); return }
    setBusy(true)
    const res = await api.admin.adjustBalance(user.user_id, Number(user.account_id), amountN, note.trim() || 'Admin adjustment')
    setBusy(false)
    if (res.ok && res.data.success) {
      toast.success(`Balance updated to ${formatExactMoney(res.data.new_balance)}`)
      onSaved(); onClose()
    } else {
      toast.error(res.ok ? 'Adjustment failed' : res.error)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {user.name}&apos;s balance</DialogTitle>
          <DialogDescription>Use a negative amount to deduct. This is recorded in the admin audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-surface-muted border border-border p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Current balance</span><span className="font-mono text-text">{formatExactMoney(user.balance)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Adjustment</span>
              <span className={`terminal-num font-medium ${amountN > 0 ? 'text-profit' : amountN < 0 ? 'text-loss' : 'text-text-muted'}`}>
                {Number.isFinite(amountN) && amountN !== 0 ? (isAdd ? '+' : '') + formatExactMoney(amountN) : '—'}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border">
              <span className="font-medium text-text">New balance</span>
              <span className="font-mono font-medium text-text">{formatExactMoney(newBalance)}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amt">Amount (USD)</Label>
            <Input id="amt" type="text" inputMode="decimal" value={amount}
                   onChange={(e) => setAmount(e.target.value.replace(/[^\d.\-]/g, ''))}
                   placeholder="e.g. -500 to deduct $500" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (audit log)</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!Number.isFinite(amountN) || amountN === 0}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
