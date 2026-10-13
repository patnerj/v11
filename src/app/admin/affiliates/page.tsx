'use client'

import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import {
  Users2, DollarSign, Sparkles, Sliders, Search, Download, Eye,
  ArrowUpRight, ExternalLink, Check, Ban, Play, Send, Copy, QrCode,
  CheckCircle2, RotateCcw, SlidersHorizontal, RefreshCw
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import type { AdminAffiliate, Commission, AffiliatePayout } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'

export default function AdminAffiliatesPage() {
  return (
    <SectionErrorBoundary sectionName="Admin Affiliates">
      <AdminAffiliatesContent />
    </SectionErrorBoundary>
  )
}

function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data
  return []
}

function AdminAffiliatesContent() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'list' | 'commissions' | 'payouts' | 'config'>('list')

  // ─────────────────────────────────────────────────────────────────
  // TAB 1: AFFILIATES LIST STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────
  const { data: rawAffiliates, isLoading: isAffiliatesLoading, refetch: refetchAffiliates } = useQuery({
    queryKey: ['admin-affiliates'],
    queryFn: async () => {
      const res = await api.admin.affiliatesList()
      return res.ok && Array.isArray(res.data) ? res.data : []
    },
  })
  const affiliates: AdminAffiliate[] = useMemo(() => normalizeArray<AdminAffiliate>(rawAffiliates), [rawAffiliates])

  const [rateEdits, setRateEdits] = useState<Record<number, string>>({})
  const [affiliateSearch, setAffiliateSearch] = useState('')
  const [affiliateStatusFilter, setAffiliateStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter((a) => {
      const matchesSearch =
        !affiliateSearch.trim() ||
        (a.code && a.code.toLowerCase().includes(affiliateSearch.toLowerCase())) ||
        (a.user_login && a.user_login.toLowerCase().includes(affiliateSearch.toLowerCase())) ||
        (a.display_name && a.display_name.toLowerCase().includes(affiliateSearch.toLowerCase())) ||
        (a.user_email && a.user_email.toLowerCase().includes(affiliateSearch.toLowerCase()))
      const matchesStatus = affiliateStatusFilter === 'all' || a.status === affiliateStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [affiliates, affiliateSearch, affiliateStatusFilter])

  const affiliateMetrics = useMemo(() => {
    const totalAffiliates = affiliates.length
    const totalPaid = affiliates.reduce((acc, curr) => acc + Number(curr.paid || 0), 0)
    const totalUnpaid = affiliates.reduce((acc, curr) => acc + Number(curr.unpaid || 0), 0)
    return { totalAffiliates, totalPaid, totalUnpaid }
  }, [affiliates])

  const handleSetAffiliateRate = async (a: AdminAffiliate) => {
    const rawVal = rateEdits[a.id]
    const v = Number(rawVal !== undefined ? rawVal : a.rate_percent)
    if (isNaN(v) || v < 0 || v > 100) {
      toast.error('Please enter a valid commission rate percentage between 0 and 100.')
      return
    }
    try {
      const r = await api.admin.affiliateRate(a.id, v)
      if (r.ok) {
        toast.success(`Commission rate for ${a.display_name || a.code} set to ${v}%.`)
        queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
      } else {
        toast.error(r.error || 'Failed to update commission rate.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update commission rate.')
    }
  }

  const handleToggleAffiliateStatus = async (a: AdminAffiliate) => {
    const next = a.status === 'active' ? 'suspended' : 'active'
    try {
      const r = await api.admin.affiliateStatus(a.id, next)
      if (r.ok) {
        toast.success(`Affiliate account is now ${next}.`)
        queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
      } else {
        toast.error(r.error || 'Failed to update affiliate status.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update affiliate status.')
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TAB 2: COMMISSION LEDGER STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────
  const [commissionFilter, setCommissionFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'reversed'>('all')

  const { data: rawCommissions, isLoading: isCommissionsLoading, refetch: refetchCommissions } = useQuery({
    queryKey: ['admin-commissions', commissionFilter],
    queryFn: async () => {
      const res = await api.admin.commissionsList(commissionFilter === 'all' ? undefined : commissionFilter)
      return res.ok && Array.isArray(res.data) ? res.data : []
    },
  })
  const commissions: Commission[] = useMemo(() => normalizeArray<Commission>(rawCommissions), [rawCommissions])

  const handleSetCommissionStatus = async (c: Commission, status: 'approved' | 'paid' | 'reversed') => {
    try {
      const r = await api.admin.commissionStatus(c.id, status)
      if (r.ok) {
        toast.success(`Commission #${c.id} marked as ${status}.`)
        queryClient.invalidateQueries({ queryKey: ['admin-commissions'] })
        queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
      } else {
        toast.error(r.error || 'Failed to update commission status.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update commission status.')
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TAB 3: PAYOUT QUEUE STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────
  const [payoutsFilter, setPayoutsFilter] = useState<'pending' | 'approved' | 'paid' | 'rejected' | 'all'>('pending')
  const [activePayoutRow, setActivePayoutRow] = useState<AffiliatePayout | null>(null)
  const [payoutTx, setPayoutTx] = useState('')
  const [payoutProof, setPayoutProof] = useState('')
  const [payoutNoteText, setPayoutNoteText] = useState('')
  const [isProcessingPayout, setIsProcessingPayout] = useState(false)

  const { data: rawPayouts, isLoading: isPayoutsQueueLoading, refetch: refetchPayouts } = useQuery({
    queryKey: ['admin-affiliate-payouts-queue', payoutsFilter],
    queryFn: async () => {
      const res = await api.admin.affiliatePayouts(payoutsFilter === 'all' ? undefined : payoutsFilter)
      return res.ok && Array.isArray(res.data) ? res.data : []
    },
  })
  const affiliatePayoutsQueue: AffiliatePayout[] = useMemo(() => normalizeArray<AffiliatePayout>(rawPayouts), [rawPayouts])

  const openProcessPayoutRow = (p: AffiliatePayout) => {
    setActivePayoutRow(p)
    setPayoutTx(p.tx_reference || '')
    setPayoutProof(p.proof_url || '')
    setPayoutNoteText(p.admin_note || '')
  }

  const handleProcessPayoutStatus = async (status: 'approved' | 'rejected' | 'paid') => {
    if (!activePayoutRow) return
    if (status === 'paid' && !payoutTx.trim()) {
      toast.error('Please provide a blockchain TX hash or payment reference for completed payouts.')
      return
    }
    setIsProcessingPayout(true)
    try {
      const r = await api.admin.affiliatePayoutStatus(activePayoutRow.id, {
        status,
        tx_reference: payoutTx.trim() || undefined,
        proof_url: payoutProof.trim() || undefined,
        note: payoutNoteText.trim() || undefined,
      })
      if (r.ok && r.data.success) {
        toast.success(`Affiliate payout request #${activePayoutRow.id} marked as ${status}!`)
        setActivePayoutRow(null)
        queryClient.invalidateQueries({ queryKey: ['admin-affiliate-payouts-queue'] })
        queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
      } else {
        toast.error((r.ok ? r.data.message : r.error) || 'Failed to process payout.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process payout.')
    } finally {
      setIsProcessingPayout(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TAB 4: PROGRAM CONFIG STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────
  const [tier1Rate, setTier1Rate] = useState<number>(15)
  const [cookieDays, setCookieDays] = useState<number>(60)
  const [minPayout, setMinPayout] = useState<number>(100)

  const { data: affiliateConfig } = useQuery({
    queryKey: ['admin-affiliate-config'],
    queryFn: () => api.admin.affiliateConfigGet().then((res) => (res.ok ? res.data : null)),
    staleTime: 30000,
  })

  useEffect(() => {
    if (affiliateConfig) {
      if (affiliateConfig.tier_1_pct !== undefined) setTier1Rate(Number(affiliateConfig.tier_1_pct))
      if (affiliateConfig.cookie_days !== undefined) setCookieDays(Number(affiliateConfig.cookie_days))
      if (affiliateConfig.min_payout !== undefined) setMinPayout(Number(affiliateConfig.min_payout))
    }
  }, [affiliateConfig])

  const saveAffiliateConfigMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await api.admin.affiliateConfigSave(data)
      if (!res.ok) throw new Error(res.error || 'Failed to save affiliate settings.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Affiliate program parameters successfully updated!')
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-config'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Config save failed.')
    },
  })

  // ─────────────────────────────────────────────────────────────────
  // MANUAL DISBURSAL PAYOUT MODAL WITH QR
  // ─────────────────────────────────────────────────────────────────
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [selectedAffiliate, setSelectedAffiliate] = useState<AdminAffiliate | null>(null)
  const [payoutAmount, setPayoutAmount] = useState<number>(0)
  const [payoutMethod, setPayoutMethod] = useState<string>('crypto')
  const [payoutDest, setPayoutDest] = useState<string>('')
  const [payoutNote, setPayoutNote] = useState<string>('')
  const [payoutTxId, setPayoutTxId] = useState<string>('')
  const [payoutQrDataUrl, setPayoutQrDataUrl] = useState<string | null>(null)

  const generateTRC20QR = (address: string) => {
    if (!address || !address.startsWith('T') || address.length < 30) {
      setPayoutQrDataUrl(null)
      return
    }
    QRCode.toDataURL(address, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setPayoutQrDataUrl(url))
      .catch(() => setPayoutQrDataUrl(null))
  }

  const openPayoutModal = (aff: AdminAffiliate) => {
    setSelectedAffiliate(aff)
    const unpaid = Number(aff.unpaid || 0)
    setPayoutAmount(unpaid > 0 ? unpaid : 0)
    const dest = aff.payout_destination || aff.payment_destination || ''
    setPayoutDest(dest)
    setPayoutNote(`Manual admin payout to ${aff.code} (${aff.display_name || aff.user_login})`)
    setPayoutTxId('')
    generateTRC20QR(dest)
    setIsPayoutModalOpen(true)
  }

  const handleDestChange = (v: string) => {
    setPayoutDest(v)
    generateTRC20QR(v)
  }

  const executePayoutMutation = useMutation({
    mutationFn: async (payload: { affiliate_id: number; amount: number; method: string; destination: string; note: string }) => {
      const res = await api.admin.affiliatePayoutCreate(payload)
      if (!res.ok || !res.data.success) {
        throw new Error((res.ok ? res.data.message : res.error) || 'Disbursal failed')
      }
      return res.data
    },
    onSuccess: () => {
      toast.success('Affiliate payout recorded and processed!')
      setIsPayoutModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-payouts-queue'] })
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to process payout.')
    },
  })

  // ─────────────────────────────────────────────────────────────────
  // AFFILIATE DETAIL DRAWER
  // ─────────────────────────────────────────────────────────────────
  const [selectedAffiliateDetail, setSelectedAffiliateDetail] = useState<AdminAffiliate | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)

  const openDetailDrawer = (aff: AdminAffiliate) => {
    setSelectedAffiliateDetail(aff)
    setIsDetailDrawerOpen(true)
  }

  // ─────────────────────────────────────────────────────────────────
  // CSV EXPORT HELPERS
  // ─────────────────────────────────────────────────────────────────
  const exportAffiliatesCSV = () => {
    if (affiliates.length === 0) {
      toast.error('No affiliate records available to export.')
      return
    }
    const headers = ['Affiliate ID', 'User ID', 'Login', 'Email', 'Code', 'Commission Rate %', 'Referrals', 'Conversions', 'Total Earned USD', 'Unpaid USD', 'Paid USD', 'Status']
    const rows = affiliates.map((a) => [
      a.id,
      a.user_id,
      `"${a.user_login || ''}"`,
      `"${a.user_email || ''}"`,
      `"${a.code}"`,
      a.rate_percent,
      a.referrals || 0,
      a.conversions || 0,
      Number(a.total || 0).toFixed(2),
      Number(a.unpaid || 0).toFixed(2),
      Number(a.paid || 0).toFixed(2),
      a.status,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `affiliates_directory_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Affiliates directory CSV exported successfully.')
  }

  const exportCommissionsCSV = () => {
    if (commissions.length === 0) {
      toast.error('No commission records available to export.')
      return
    }
    const headers = ['Commission ID', 'Affiliate ID', 'Affiliate Login', 'Order ID', 'Base Amount USD', 'Rate %', 'Amount USD', 'Status', 'Created At', 'Paid At']
    const rows = commissions.map((c) => [
      c.id,
      c.affiliate_id,
      `"${c.affiliate_login || ''}"`,
      c.order_id,
      Number(c.base_amount || 0).toFixed(2),
      c.rate_percent,
      Number(c.amount || 0).toFixed(2),
      c.status,
      `"${c.created_at || ''}"`,
      `"${c.paid_at || ''}"`,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `commission_ledger_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Commission ledger CSV exported successfully.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="hero"
        title="Affiliate Program Hub"
        description="Comprehensive management of affiliate partners, commission attribution ledger, withdrawal disbursals, and program settings."
        icon={Users2}
        badge={{ label: 'Partner Program Hub', tone: 'accent' }}
      />

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <Card className="bg-surface border-surface-muted">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Total Partners</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Users2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
              {affiliateMetrics.totalAffiliates}
            </div>
            <span className="text-2xs text-text-muted">Active partners driving traffic</span>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-muted">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Lifetime Paid</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
              ${affiliateMetrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-2xs text-text-muted">Disbursed referral rewards</span>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-muted">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Pending Balance</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
              ${affiliateMetrics.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-2xs text-text-muted">Awaiting payout claims</span>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-muted pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'list'
              ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
              : 'text-text-muted hover:text-text hover:bg-surface-muted'
          }`}
        >
          <Users2 className="h-4 w-4" />
          Affiliates Roster ({affiliates.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'commissions'
              ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
              : 'text-text-muted hover:text-text hover:bg-surface-muted'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Commission Ledger ({commissions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'payouts'
              ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
              : 'text-text-muted hover:text-text hover:bg-surface-muted'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          Payout Requests Queue ({affiliatePayoutsQueue.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'config'
              ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
              : 'text-text-muted hover:text-text hover:bg-surface-muted'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Program Configuration
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 1: AFFILIATES ROSTER */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <Card className="bg-surface border-surface-muted">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-muted/60 pb-3">
            <div>
              <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                <Users2 className="h-4 w-4 text-emerald-400" />
                Affiliate Directory & Performance
              </CardTitle>
              <CardDescription className="text-xs text-gray-400 mt-0.5">
                Manage partner rates, review referral traffic, and execute manual commission disbursals.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search partner or code..."
                  value={affiliateSearch}
                  onChange={(e) => setAffiliateSearch(e.target.value)}
                  className="h-8 pl-8 text-xs w-48 bg-background border-surface-muted"
                />
              </div>

              <select
                value={affiliateStatusFilter}
                onChange={(e) => setAffiliateStatusFilter(e.target.value as any)}
                className="h-8 px-2.5 rounded-md bg-background border border-surface-muted text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={exportAffiliatesCSV}
                className="h-8 text-xs gap-1.5 border-surface-muted hover:bg-surface-muted text-gray-300"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchAffiliates()}
                className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-400"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isAffiliatesLoading ? (
              <div className="p-8 text-center text-xs text-gray-400 font-mono">Loading affiliates roster...</div>
            ) : filteredAffiliates.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 font-mono">No affiliate records matched your search.</div>
            ) : (
              <DataTable
                data={filteredAffiliates}
                columns={[
                  {
                    key: 'partner',
                    header: 'Affiliate Partner',
                    render: (a: AdminAffiliate) => (
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailDrawer(a)}
                            className="font-semibold text-slate-900 dark:text-gray-100 text-sm hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors flex items-center gap-1.5"
                          >
                            {a.display_name || a.user_login}
                            <Eye className="h-3 w-3 text-slate-500 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 inline" />
                          </button>
                          <Badge tone={a.status === 'active' ? 'success' : 'neutral'} size="sm">
                            {a.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                          User #{a.user_id} • {a.user_email || 'No email registered'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'code',
                    header: 'Ref Code',
                    render: (a: AdminAffiliate) => (
                      <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {a.code}
                      </span>
                    ),
                  },
                  {
                    key: 'conversions',
                    header: 'Traffic & Sales',
                    render: (a: AdminAffiliate) => (
                      <div className="text-xs font-mono text-gray-300">
                        <span className="font-bold text-white">{a.conversions || 0}</span> sales / {a.referrals || 0} clicks
                      </div>
                    ),
                  },
                  {
                    key: 'split',
                    header: 'Commission Split (%)',
                    render: (a: AdminAffiliate) => (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={rateEdits[a.id] !== undefined ? rateEdits[a.id] : String(a.rate_percent ?? 15)}
                          onChange={(e) => setRateEdits((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          className="w-16 h-8 text-xs font-mono"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetAffiliateRate(a)}
                          className="h-8 px-2 text-2xs"
                        >
                          Set
                        </Button>
                      </div>
                    ),
                  },
                  {
                    key: 'unpaid',
                    header: 'Unpaid / Paid',
                    render: (a: AdminAffiliate) => (
                      <div className="text-xs font-mono">
                        <span className="text-amber-400 font-bold">${Number(a.unpaid || 0).toLocaleString()}</span>
                        <span className="text-gray-500"> / ${Number(a.paid || 0).toLocaleString()}</span>
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    align: 'right',
                    render: (a: AdminAffiliate) => (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetailDrawer(a)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-400"
                          title="View Profile & Transactions"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleAffiliateStatus(a)}
                          className={`h-8 w-8 p-0 ${a.status === 'active' ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                          title={a.status === 'active' ? 'Suspend Affiliate' : 'Activate Affiliate'}
                        >
                          {a.status === 'active' ? <Ban className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>

                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => openPayoutModal(a)}
                          className="h-8 text-xs gap-1.5 shadow-emerald-500/10"
                        >
                          <Send className="h-3 w-3" />
                          Pay
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 2: COMMISSION TRANSACTION LEDGER */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'commissions' && (
        <Card className="bg-surface border-surface-muted">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-muted/60 pb-3">
            <div>
              <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Commissions Transaction Ledger ({commissions.length})
              </CardTitle>
              <CardDescription className="text-xs text-gray-400 mt-0.5">
                Real-time audit trail of all partner earnings generated across challenge checkout orders.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCommissionsCSV}
                className="h-8 text-xs gap-1.5 border-surface-muted hover:bg-surface-muted text-gray-300"
              >
                <Download className="h-3 w-3" /> Export Ledger (CSV)
              </Button>

              <div className="flex flex-wrap gap-1">
                {(['all', 'pending', 'approved', 'paid', 'reversed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCommissionFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono capitalize transition-all ${
                      commissionFilter === f
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-text-muted hover:text-text bg-surface hover:bg-surface-muted border border-border'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchCommissions()}
                className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-400"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isCommissionsLoading ? (
              <div className="p-8 text-center text-xs text-gray-400 font-mono">Loading commission ledger...</div>
            ) : commissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 font-mono">No commissions found for this filter.</div>
            ) : (
              <div className="divide-y divide-surface-muted/60">
                {commissions.map((c) => {
                  const statusTone = c.status === 'paid' ? 'success' : c.status === 'reversed' ? 'danger' : c.status === 'approved' ? 'accent' : 'warning'

                  return (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#1A2234]/30 text-xs">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono text-sm">${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <Badge tone={statusTone as any} size="sm" className="capitalize font-mono">{c.status}</Badge>
                          <span className="text-gray-400 font-mono">#{c.id}</span>
                        </div>
                        <div className="text-2xs text-gray-400 font-mono">
                          Partner: <strong className="text-gray-200">{c.affiliate_login || `ID #${c.affiliate_id}`}</strong> ← Buyer: <span className="text-gray-300">{c.referred_login || 'Trader'}</span> • Order #{c.order_id} • {c.rate_percent}% of ${Number(c.base_amount || 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.status !== 'paid' && c.status !== 'reversed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetCommissionStatus(c, 'paid')}
                            className="h-7 text-2xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                          >
                            <Check className="h-3 w-3 mr-1 text-emerald-400" /> Mark Paid
                          </Button>
                        )}
                        {c.status !== 'reversed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetCommissionStatus(c, 'reversed')}
                            className="h-7 text-2xs text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Reverse Commission"
                          >
                            <RotateCcw className="h-3 w-3 mr-1 text-red-400" /> Reverse
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PAYOUT REQUESTS QUEUE */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'payouts' && (
        <Card className="bg-surface border-surface-muted">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-muted/60 pb-3">
            <div>
              <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                Affiliate Payout Requests Queue ({affiliatePayoutsQueue.length})
              </CardTitle>
              <CardDescription className="text-xs text-gray-400 mt-0.5">
                Review withdrawal requests submitted by affiliates reaching the minimum payout threshold.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-wrap gap-1">
                {(['pending', 'approved', 'paid', 'rejected', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPayoutsFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono capitalize transition-all ${
                      payoutsFilter === f
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-text-muted hover:text-text bg-surface hover:bg-surface-muted border border-border'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchPayouts()}
                className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-400"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isPayoutsQueueLoading ? (
              <div className="p-8 text-center text-xs text-gray-400 font-mono">Loading payout queue...</div>
            ) : affiliatePayoutsQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 font-mono">No {payoutsFilter !== 'all' ? payoutsFilter : ''} payout requests found.</div>
            ) : (
              <div className="divide-y divide-surface-muted/60">
                {affiliatePayoutsQueue.map((p) => {
                  const isExpanded = activePayoutRow?.id === p.id
                  const statusTone = p.status === 'paid' ? 'success' : p.status === 'rejected' ? 'danger' : p.status === 'approved' ? 'accent' : 'warning'

                  return (
                    <div key={p.id} className="transition-colors hover:bg-[#1A2234]/30">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white font-mono text-sm">${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <Badge tone={statusTone as any} size="sm" className="capitalize font-mono">{p.status}</Badge>
                            <span className="text-gray-400 font-mono">#{p.id}</span>
                          </div>
                          <div className="text-2xs text-gray-400 font-mono">
                            <strong>{p.display_name || p.user_login}</strong> • Method: <span className="text-gray-200">{p.method}</span> • Dest: <span className="text-gray-300 font-mono">{p.destination}</span>
                            {p.tx_reference && <> • Tx Ref: <span className="text-emerald-400">{p.tx_reference}</span></>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {p.proof_url && (
                            <a
                              href={p.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-emerald-400 p-1"
                              title="View Proof Link"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}

                          {p.status !== 'paid' && p.status !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => (isExpanded ? setActivePayoutRow(null) : openProcessPayoutRow(p))}
                              className="h-7 text-2xs gap-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              {isExpanded ? 'Close' : 'Process'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline Processing Drawer */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-background/80 border-t border-surface-muted space-y-3 animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="space-y-1">
                              <Label className="text-2xs text-gray-400">Transaction Hash / Ref</Label>
                              <Input
                                value={payoutTx}
                                onChange={(e) => setPayoutTx(e.target.value)}
                                placeholder="e.g. 0xabc... or Wise TX ID"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-2xs text-gray-400">Proof URL (Optional)</Label>
                              <Input
                                value={payoutProof}
                                onChange={(e) => setPayoutProof(e.target.value)}
                                placeholder="https://tronscan.org/#/transaction/..."
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-2xs text-gray-400">Admin Note</Label>
                              <Input
                                value={payoutNoteText}
                                onChange={(e) => setPayoutNoteText(e.target.value)}
                                placeholder="e.g. Disbursed via TRC20"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-end pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActivePayoutRow(null)}
                              className="h-7 text-xs text-gray-400"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isProcessingPayout}
                              onClick={() => handleProcessPayoutStatus('rejected')}
                              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Ban className="h-3 w-3 mr-1" /> Reject Request
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessingPayout}
                              onClick={() => handleProcessPayoutStatus('approved')}
                              className="h-7 text-xs border-surface-muted hover:border-emerald-500/50 hover:text-emerald-400"
                            >
                              Approve Request
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={isProcessingPayout}
                              onClick={() => handleProcessPayoutStatus('paid')}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            >
                              <Check className="h-3 w-3 mr-1" /> Mark as Paid
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 4: PROGRAM CONFIGURATION */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <Card className="bg-surface border-surface-muted">
          <CardHeader className="border-b border-surface-muted/60 pb-4">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              Affiliate Program Engine Configuration
            </CardTitle>
            <CardDescription className="text-xs text-gray-400">
              Configure baseline commission percentages, attribution cookie window, and minimum withdrawal thresholds.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tier1-rate">Direct Referral Commission (%)</Label>
                <Input
                  id="tier1-rate"
                  type="number"
                  value={tier1Rate}
                  onChange={(e) => setTier1Rate(Number(e.target.value))}
                />
                <span className="text-2xs text-gray-500">Default rate earned on referred purchases</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cookie-days">Attribution Cookie Window (Days)</Label>
                <Input
                  id="cookie-days"
                  type="number"
                  value={cookieDays}
                  onChange={(e) => setCookieDays(Number(e.target.value))}
                />
                <span className="text-2xs text-gray-500">Tracking duration for referral links</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min-payout">Minimum Payout Floor ($)</Label>
                <Input
                  id="min-payout"
                  type="number"
                  value={minPayout}
                  onChange={(e) => setMinPayout(Number(e.target.value))}
                />
                <span className="text-2xs text-gray-500">Threshold required before withdrawal request</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-surface-muted/60 p-4 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                saveAffiliateConfigMutation.mutate({
                  tier_1_pct: tier1Rate,
                  cookie_days: cookieDays,
                  min_payout: minPayout,
                })
              }
              loading={saveAffiliateConfigMutation.isPending}
              className="gap-1.5 shadow-emerald-500/20"
            >
              <CheckCircle2 className="h-4 w-4" />
              Save Configuration
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MANUAL DISBURSAL PAYOUT MODAL */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <Modal
        open={isPayoutModalOpen}
        onOpenChange={setIsPayoutModalOpen}
        title={`Execute Affiliate Payout: ${selectedAffiliate?.display_name || selectedAffiliate?.user_login || ''}`}
        description="Release accrued commission earnings to the affiliate partner's designated payout account."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="payout-amt">Payout Amount ($ USD)</Label>
            <div className="flex gap-2">
              <Input
                id="payout-amt"
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(Number(e.target.value))}
                className="font-mono text-sm font-bold text-emerald-400 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 text-xs px-2.5 gap-1 border-surface-muted hover:bg-surface-muted"
                onClick={() => {
                  navigator.clipboard.writeText(String(payoutAmount))
                  toast.success('Payout amount copied!')
                }}
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payout-method">Payment Rail</Label>
            <select
              id="payout-method"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none focus:border-accent"
            >
              <option value="crypto" className="bg-surface text-text">USDT (TRC-20 / ERC-20)</option>
              <option value="bank" className="bg-surface text-text">Direct Bank Wire / SWIFT</option>
              <option value="wise" className="bg-surface text-text">Wise / PayPal Transfer</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="payout-dest">Wallet Address / Account Info</Label>
              {payoutDest && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(payoutDest)
                    toast.success('Wallet address copied!')
                  }}
                  className="text-2xs text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <Copy className="h-2.5 w-2.5" /> Copy Address
                </button>
              )}
            </div>
            <Input
              id="payout-dest"
              placeholder="e.g. TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
              value={payoutDest}
              onChange={(e) => handleDestChange(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {/* Scan-to-Pay QR Code Box */}
          {payoutDest && payoutQrDataUrl && payoutMethod === 'crypto' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-emerald-500/20">
              <div className="bg-white p-1 rounded-md shrink-0">
                <img src={payoutQrDataUrl} alt="TRC-20 QR Code" className="w-20 h-20" />
              </div>
              <div className="space-y-1 min-w-0">
                <span className="text-2xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Scan-to-Pay QR
                </span>
                <p className="text-2xs text-gray-400 leading-tight">Scan with TrustWallet or Binance App for 1-click mobile transfer.</p>
                <div className="text-2xs text-gray-500 font-mono truncate">{payoutDest}</div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="payout-txid">Transaction Hash / TxID (Proof of Disbursal)</Label>
            <Input
              id="payout-txid"
              placeholder="e.g. 7f9a1b2c3d4e5f6... (optional blockchain hash)"
              value={payoutTxId}
              onChange={(e) => setPayoutTxId(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payout-note">Internal Audit Note</Label>
            <Input
              id="payout-note"
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-muted">
            <Button variant="outline" size="sm" onClick={() => setIsPayoutModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!selectedAffiliate || payoutAmount <= 0) {
                  toast.error('Invalid payout amount.')
                  return
                }
                executePayoutMutation.mutate({
                  affiliate_id: selectedAffiliate.id,
                  amount: payoutAmount,
                  method: payoutMethod,
                  destination: payoutDest,
                  note: payoutNote + (payoutTxId ? ` (TxID: ${payoutTxId})` : ''),
                })
              }}
              loading={executePayoutMutation.isPending}
              className="shadow-emerald-500/20"
            >
              Confirm & Release Payout
            </Button>
          </div>
        </div>
      </Modal>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* AFFILIATE DETAIL DRILL-DOWN DRAWER */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <Modal
        open={isDetailDrawerOpen}
        onOpenChange={setIsDetailDrawerOpen}
        title={`Affiliate Profile & Activity: ${selectedAffiliateDetail?.display_name || selectedAffiliateDetail?.user_login || ''}`}
        description="Comprehensive drill-down of referral traffic, commission splits, and customer transactions."
        maxWidth="2xl"
      >
        {selectedAffiliateDetail && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-background border border-surface-muted">
                <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">Ref Code</div>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{selectedAffiliateDetail.code}</div>
              </div>
              <div className="p-3 rounded-lg bg-background border border-surface-muted">
                <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">Commission Split</div>
                <div className="text-sm font-mono font-bold text-white mt-0.5">{selectedAffiliateDetail.rate_percent ?? 15}%</div>
              </div>
              <div className="p-3 rounded-lg bg-background border border-surface-muted">
                <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">Unpaid Balance</div>
                <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">
                  ${Number(selectedAffiliateDetail.unpaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-background border border-surface-muted">
                <div className="text-2xs uppercase tracking-wider text-gray-400 font-semibold">Lifetime Paid</div>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                  ${Number(selectedAffiliateDetail.paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-background border border-surface-muted space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-gray-200">Registered Payout Destination</div>
              <div className="flex items-center justify-between gap-2 p-2 rounded bg-surface border border-surface-muted text-xs font-mono">
                <span className="truncate text-slate-700 dark:text-gray-300">
                  {selectedAffiliateDetail.payout_destination || selectedAffiliateDetail.payment_destination || 'No payout destination configured by user yet.'}
                </span>
                {(selectedAffiliateDetail.payout_destination || selectedAffiliateDetail.payment_destination) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-2xs px-2 text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedAffiliateDetail.payout_destination || selectedAffiliateDetail.payment_destination || '')
                      toast.success('Wallet address copied!')
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-gray-200">Affiliate Orders & Commission Ledger</span>
                <span className="text-2xs font-mono text-gray-400">
                  {commissions.filter((c) => c.affiliate_code === selectedAffiliateDetail.code || c.affiliate_id === selectedAffiliateDetail.id).length} transactions
                </span>
              </div>

              {commissions.filter((c) => c.affiliate_code === selectedAffiliateDetail.code || c.affiliate_id === selectedAffiliateDetail.id).length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 font-mono rounded-lg border border-surface-muted bg-background">
                  No challenge purchase orders attributed to code {selectedAffiliateDetail.code} yet.
                </div>
              ) : (
                <div className="rounded-lg border border-surface-muted overflow-hidden divide-y divide-surface-muted max-h-48 overflow-y-auto">
                  {commissions
                    .filter((c) => c.affiliate_code === selectedAffiliateDetail.code || c.affiliate_id === selectedAffiliateDetail.id)
                    .map((c) => (
                      <div key={c.id} className="p-2.5 flex items-center justify-between text-xs bg-background hover:bg-surface">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-gray-200">Order #{c.order_id || c.id} • {c.buyer_user || 'Trader'}</div>
                          <div className="text-2xs text-gray-500">{c.created_at || 'Recent'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-400">+${Number(c.amount || 0).toLocaleString()}</div>
                          <Badge tone={c.status === 'paid' ? 'success' : 'warn'} size="sm">{c.status}</Badge>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsDetailDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
