'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { 
  Wallet, DollarSign, ArrowUpRight, ArrowDownRight, Clock, 
  CheckCircle2, XCircle, Search, Filter, Download, RefreshCw,
  ExternalLink, Eye, Sliders, AlertTriangle, ShieldCheck,
  Building, CreditCard, Check, Copy, QrCode
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, ColumnDef } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PayoutManagementModal, PayoutItemTarget } from '@/components/admin/PayoutManagementModal'
import { PayoutQrModal } from '@/components/admin/payout-qr-modal'
import { toast } from 'sonner'
import { toNum } from '@/lib/format'
import { APP_DISPLAY_VERSION } from '@/lib/version'

function formatMoney(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function formatInt(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseInt(val, 10) : (val ?? 0)
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

export interface PayoutTableRow {
  id: string | number
  raw_id: number
  payout_code: string
  user_id: number
  trader_name: string
  email: string
  amount_requested: number
  trader_amount: number
  firm_amount: number
  profit_split_pct: number
  payment_method: string
  payment_address: string
  status: 'requested' | 'under_review' | 'approved' | 'rejected' | 'paid' | string
  tx_reference?: string | null
  proof_url?: string | null
  admin_note?: string | null
  requested_at: string
  processed_at?: string | null
}

function AddressCopyCell({ address, method }: { address: string; method: string }) {
  const [copied, setCopied] = useState(false)
  const previewAddr = address.length > 18 
    ? `${address.slice(0, 8)}...${address.slice(-6)}` 
    : address

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!address) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(address).catch(() => {})
      }
    } catch {}
    setCopied(true)
    toast.success('Payout destination address copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const isTrc = /trc/i.test(method) || address.startsWith('T')
  const isBep = /bep/i.test(method) || /bsc/i.test(method) || address.startsWith('0x')
  const isWise = /wise/i.test(method)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1.5 max-w-[240px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-accent shrink-0" />
            {method}
          </span>
          {isTrc && (
            <span className="text-2xs font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
              TRC20
            </span>
          )}
          {isBep && (
            <span className="text-2xs font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
              BEP20
            </span>
          )}
          {isWise && (
            <span className="text-2xs font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              WISE
            </span>
          )}
        </div>
        {address && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-2xs text-text-muted hover:text-emerald-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-muted transition-colors cursor-pointer select-none"
            title="Copy Destination Wallet"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 font-bold">✓ Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-2xs text-text-muted tabular truncate max-w-[220px] font-mono" title={address}>
        {previewAddr}
      </p>
    </div>
  )
}

function PayoutsHubContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const urlSearch = searchParams?.get('search')

  // Filter States
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<(string | number)[]>([])
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<'approved' | 'paid' | null>(null)
  const [bulkTxReference, setBulkTxReference] = useState('')
  const [bulkNote, setBulkNote] = useState('')
  const [bulkErrors, setBulkErrors] = useState<{ id: number; message: string }[]>([])
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [showBulkResultModal, setShowBulkResultModal] = useState(false)

  // Sync search query from URL parameter if present
  React.useEffect(() => {
    if (urlSearch) {
      setSearchTerm(urlSearch)
    }
  }, [urlSearch])

  // Modal State
  const [selectedPayout, setSelectedPayout] = useState<PayoutItemTarget | null>(null)
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false)
  const [qrPayout, setQrPayout] = useState<PayoutTableRow | null>(null)
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false)

  // API Query
  const { data: rawPayouts, isLoading: payoutsLoading, refetch } = useQuery({
    queryKey: ['admin-payouts-engine'],
    queryFn: () => api.admin.payoutsList().then(res => res.ok ? res.data : []),
    staleTime: 10000,
  })

  // Normalize API data or return authentic empty array (AGENTS.md Rule 1.2)
  const allPayouts: PayoutTableRow[] = useMemo(() => {
    const list = Array.isArray(rawPayouts)
      ? rawPayouts
      : (rawPayouts && typeof rawPayouts === 'object' && Array.isArray((rawPayouts as any).payouts))
      ? (rawPayouts as any).payouts
      : []

    if (list.length > 0) {
      return list.map((p: any, idx: number) => {
        const rawId = p.id || (idx + 1)
        const amt = Number(p.amount_requested || p.amount || 0)
        const split = Number(p.profit_split_pct || 80)
        const traderShare = p.trader_amount ? Number(p.trader_amount) : (amt * (split / 100))
        const firmShare = p.firm_amount ? Number(p.firm_amount) : (amt - traderShare)

        return {
          id: rawId,
          raw_id: rawId,
          payout_code: `PO-${rawId}`,
          // Never fabricate user_id — this drives the trader-profile link;
          // a fabricated id would point an admin at the wrong trader.
          user_id: p.user_id,
          trader_name: p.name || p.username || p.user_login || `Trader #${p.user_id || rawId}`,
          email: p.email || p.user_email || `${p.username || 'trader'}@example.com`,
          amount_requested: amt,
          trader_amount: traderShare,
          firm_amount: firmShare,
          profit_split_pct: split,
          payment_method: p.payment_method || p.gateway || 'Crypto TRC20',
          // Never fabricate a payout destination — a fake address with a
          // working Copy button risks real funds being sent to a wallet that
          // belongs to nobody involved. Pass through what's actually on file.
          payment_address: p.payment_address || '',
          status: (p.status || 'requested').toLowerCase(),
          tx_reference: p.tx_reference,
          proof_url: p.proof_url,
          admin_note: p.admin_note,
          requested_at: p.requested_at || p.created_at || new Date().toISOString(),
          processed_at: p.processed_at,
        }
      })
    }
    return []
  }, [rawPayouts])

  // Summary Metrics Computation
  const SLA_TARGET_HOURS = 6.0
  const metrics = useMemo(() => {
    const pendingList = allPayouts.filter(p => p.status === 'requested' || p.status === 'pending')
    const pendingGross = pendingList.reduce((acc, p) => acc + (toNum(p.amount_requested) || toNum((p as any).amount) || 0), 0)
    const pendingNet = pendingList.reduce((acc, p) => acc + (toNum(p.trader_amount) || ((toNum(p.amount_requested) || toNum((p as any).amount) || 0) * ((toNum(p.profit_split_pct) || 80) / 100))), 0)
    const avgSplitPct = pendingList.length > 0
      ? Math.round(pendingList.reduce((acc, p) => acc + (toNum(p.profit_split_pct) || 80), 0) / pendingList.length)
      : 80

    const approvedList = allPayouts.filter(p => p.status === 'approved' || p.status === 'paid')
    const approvedGross = approvedList.reduce((acc, p) => acc + (toNum(p.amount_requested) || toNum((p as any).amount) || 0), 0)
    const approvedNet = approvedList.reduce((acc, p) => acc + (toNum(p.trader_amount) || ((toNum(p.amount_requested) || toNum((p as any).amount) || 0) * ((toNum(p.profit_split_pct) || 80) / 100))), 0)

    const rejectedList = allPayouts.filter(p => p.status === 'rejected')

    // Real processing-time stats, computed from requested_at → processed_at on
    // every payout that has actually been resolved (approved, paid, or
    // rejected) and has both timestamps — not a fixed placeholder figure.
    const resolvedWithTimes = allPayouts
      .filter(p => p.status !== 'requested' && p.status !== 'pending' && p.status !== 'under_review')
      .map(p => {
        if (!p.requested_at || !p.processed_at) return null
        const start = new Date(p.requested_at).getTime()
        const end = new Date(p.processed_at).getTime()
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
        return (end - start) / 3_600_000
      })
      .filter((h): h is number => h !== null)

    const avgTimeHours = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((a, b) => a + b, 0) / resolvedWithTimes.length
      : null
    const slaPct = resolvedWithTimes.length > 0
      ? (resolvedWithTimes.filter(h => h <= SLA_TARGET_HOURS).length / resolvedWithTimes.length) * 100
      : null

    return {
      pendingCount: pendingList.length,
      pendingTotal: pendingGross,
      pendingGross,
      pendingNet,
      avgSplitPct,
      approvedCount: approvedList.length,
      approvedTotal: approvedGross,
      approvedGross,
      approvedNet,
      rejectedCount: rejectedList.length,
      avgTimeHours: avgTimeHours !== null ? `${toNum(avgTimeHours).toFixed(1)} Hours` : '--',
      slaSampleSize: resolvedWithTimes.length,
      slaPct,
    }
  }, [allPayouts])

  // Tab Filtering & Search
  const filteredPayouts = useMemo(() => {
    return allPayouts.filter((payout) => {
      // 1. Tab Status Filter
      if (activeTab === 'pending' && (payout.status !== 'requested' && payout.status !== 'pending')) {
        return false
      }
      if (activeTab === 'under_review' && payout.status !== 'under_review') {
        return false
      }
      if (activeTab === 'approved' && (payout.status !== 'approved' && payout.status !== 'paid')) {
        return false
      }
      if (activeTab === 'rejected' && payout.status !== 'rejected') {
        return false
      }

      // 2. Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchName = payout.trader_name.toLowerCase().includes(query)
        const matchEmail = payout.email.toLowerCase().includes(query)
        const matchId = payout.payout_code.toLowerCase().includes(query) || String(payout.id).includes(query)
        const matchAddress = payout.payment_address.toLowerCase().includes(query)
        const matchMethod = payout.payment_method.toLowerCase().includes(query)

        if (!matchName && !matchEmail && !matchId && !matchAddress && !matchMethod) {
          return false
        }
      }

      return true
    })
  }, [allPayouts, activeTab, searchTerm])

  // CSV Export Handler
  const handleExportCSV = (recordsToExport: PayoutTableRow[] = filteredPayouts) => {
    if (recordsToExport.length === 0) {
      toast.error('No payout records found to export.')
      return
    }

    const headers = [
      'Payout ID',
      'Trader Name',
      'Email',
      'Requested Amount ($)',
      'Trader Share ($)',
      'Firm Share ($)',
      'Split %',
      'Gateway Method',
      'Destination Address',
      'Status',
      'Tx Hash / Ref',
      'Requested Date'
    ]

    const rows = recordsToExport.map((p) => [
      `"${p.payout_code}"`,
      `"${p.trader_name.replace(/"/g, '""')}"`,
      `"${p.email}"`,
      toNum(p.amount_requested).toFixed(2),
      toNum(p.trader_amount).toFixed(2),
      toNum(p.firm_amount).toFixed(2),
      `${p.profit_split_pct}%`,
      `"${p.payment_method}"`,
      `"${p.payment_address.replace(/"/g, '""')}"`,
      p.status,
      `"${p.tx_reference || ''}"`,
      `"${new Date(p.requested_at).toLocaleDateString()}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `propfirm_payouts_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Exported ${recordsToExport.length} payout records to CSV`)
  }

  // Memoized selection totals for bulk operations (POLISH-1, POLISH-5, PAY-4)
  const pendingSelectedPayouts = useMemo(() => {
    return allPayouts.filter(
      p => selectedPayoutIds.includes(p.id) && (p.status === 'requested' || p.status === 'under_review')
    )
  }, [allPayouts, selectedPayoutIds])

  const approvedSelectedPayouts = useMemo(() => {
    return allPayouts.filter(
      p => selectedPayoutIds.includes(p.id) && p.status === 'approved'
    )
  }, [allPayouts, selectedPayoutIds])

  const selectedTotalAmount = useMemo(() => {
    return allPayouts
      .filter(p => selectedPayoutIds.includes(p.id))
      .reduce((sum, p) => sum + (Number(p.amount_requested) || 0), 0)
  }, [allPayouts, selectedPayoutIds])

  const pendingSelectedTotalAmount = useMemo(() => {
    return pendingSelectedPayouts
      .reduce((sum, p) => sum + (Number(p.amount_requested) || 0), 0)
  }, [pendingSelectedPayouts])

  const approvedSelectedTotalAmount = useMemo(() => {
    return approvedSelectedPayouts
      .reduce((sum, p) => sum + (Number(p.amount_requested) || 0), 0)
  }, [approvedSelectedPayouts])

  // Bulk Action Handler (PAY-4)
  const handleBulkExecute = async () => {
    if (!bulkActionType) return
    const targetPayouts = bulkActionType === 'approved' ? pendingSelectedPayouts : approvedSelectedPayouts
    if (targetPayouts.length === 0) {
      toast.info(`None of the selected payouts are in a valid status for "${bulkActionType}".`)
      setShowBulkConfirm(false)
      return
    }

    if (bulkActionType === 'paid' && !bulkTxReference.trim()) {
      toast.error('Transaction reference (batch hash/ref) is required to mark payouts as paid.')
      return
    }

    setIsBulkProcessing(true)
    const targetIds = targetPayouts.map(p => p.raw_id)
    try {
      const res = await api.admin.bulkPayouts(
        targetIds,
        bulkActionType,
        bulkNote.trim() || `Bulk ${bulkActionType} via admin toolbar`,
        bulkActionType === 'paid' ? bulkTxReference.trim() : undefined
      )
      if (res.ok && res.data) {
        const { processed, failed, errors } = res.data
        if (failed > 0 && errors && errors.length > 0) {
          setBulkErrors(errors)
          setShowBulkResultModal(true)
          toast.warning(`Processed ${processed} payout(s), but ${failed} failed. See error report.`)
        } else {
          toast.success(`Successfully ${bulkActionType === 'paid' ? 'marked paid' : 'approved'} ${processed} payout(s)!`)
        }
      } else {
        toast.error((res as any)?.error || 'Bulk operation failed')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Bulk operation failed')
    } finally {
      setIsBulkProcessing(false)
      setShowBulkConfirm(false)
      setSelectedPayoutIds([])
      setBulkTxReference('')
      setBulkNote('')
      setBulkActionType(null)
      refetch()
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    }
  }

  // DataTable Column Definitions
  const columns: ColumnDef<PayoutTableRow>[] = [
    {
      key: 'payout_code',
      header: 'Payout ID',
      render: (row) => (
        <span className="tabular text-xs font-bold text-text bg-surface-muted px-2.5 py-1 rounded-md border border-border">
          {row.payout_code}
        </span>
      )
    },
    {
      key: 'trader',
      header: 'Trader Info',
      render: (row) => {
        const initial = row.trader_name.charAt(0).toUpperCase()
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <Link 
                href={`/admin/traders/${row.user_id}`}
                className="font-semibold text-gray-100 hover:text-accent transition-colors text-sm truncate block"
              >
                {row.trader_name}
              </Link>
              <p className="text-xs text-gray-500 truncate">{row.email}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'amount_details',
      header: 'Amount Details',
      align: 'right',
      render: (row) => (
        <div className="text-right tabular space-y-0.5">
          <div className="text-sm font-bold text-accent">
            {formatMoney(row.amount_requested)}
          </div>
          <div className="text-2xs text-gray-400">
            Split: <span className="text-gray-200 font-semibold">{row.profit_split_pct}%</span> ({formatMoney(row.trader_amount)})
          </div>
        </div>
      )
    },
    {
      key: 'destination',
      header: 'Destination Gateway',
      render: (row) => <AddressCopyCell address={row.payment_address} method={row.payment_method} />
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => {
        if (row.status === 'approved' || row.status === 'paid') {
          return <Badge tone="success" size="sm" pulsing>Approved</Badge>
        }
        if (row.status === 'under_review') {
          return <Badge tone="info" size="sm" pulsing>Under Review</Badge>
        }
        if (row.status === 'rejected') {
          return <Badge tone="danger" size="sm">Rejected</Badge>
        }
        return <Badge tone="warning" size="sm" pulsing>Requested</Badge>
      }
    },
    {
      key: 'requested_date',
      header: 'Requested Date',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-gray-400 tabular">
          {new Date(row.requested_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
      )
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.payment_address && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQrPayout(row)
                setIsQrModalOpen(true)
              }}
              className="h-8 px-2 text-xs border-border text-text-muted hover:text-accent hover:border-accent gap-1"
              title="Open QR Code Disbursal Helper"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">QR</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedPayout(row)
              setIsManageModalOpen(true)
            }}
            className="h-8 text-xs border-accent/40 text-accent hover:bg-accent/10 hover:border-accent gap-1.5"
          >
            <Sliders className="h-3.5 w-3.5" />
            Manage Payout
          </Button>
        </div>
      )
    }
  ]

  const TAB_ITEMS = [
    { key: 'all', label: 'All Requests', count: allPayouts.length },
    { key: 'pending', label: 'Pending / Requested', count: metrics.pendingCount, tone: 'warning' as const },
    { key: 'under_review', label: 'Under Review', count: allPayouts.filter(p => p.status === 'under_review').length, tone: 'info' as const },
    { key: 'approved', label: 'Approved & Paid', count: metrics.approvedCount, tone: 'success' as const },
    { key: 'rejected', label: 'Rejected', count: metrics.rejectedCount, tone: 'danger' as const },
  ]

  return (
    <div className="space-y-8 pb-12">
      
      {/* ── Top Bar Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Payouts & Billing Engine
            </h1>
            <Badge tone="accent" size="sm" pulsing className="tabular font-semibold">
              Live Billing {APP_DISPLAY_VERSION}
            </Badge>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Audit profit split calculations, verify crypto destination addresses, and disburse withdrawals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExportCSV()}
            className="border-border text-text hover:bg-surface-muted gap-2 h-9"
          >
            <Download className="h-4 w-4 text-accent" />
            Export CSV
          </Button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => {
              refetch()
              toast.success('Payout records refreshed')
            }}
            className="gap-2 h-9 shadow-accent/20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* ── 1. Top Summary Metric Grid (4 Summary Cards) ──────────────────── */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Pending Requests */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Total Pending Requests
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold tabular text-text tracking-tight flex items-baseline gap-1.5">
                  {formatMoney(metrics.pendingGross)}
                  <span className="text-xs font-semibold uppercase text-text-muted">Gross</span>
                </h3>
                <p className="text-xs font-semibold text-accent mt-0.5 tabular">
                  {formatMoney(metrics.pendingNet)} Net (@ {metrics.avgSplitPct}% Share)
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-2xs text-text-muted leading-tight block flex-1">
                  Awaiting audit approval
                </span>
                <Badge tone={metrics.pendingCount > 0 ? "warning" : "neutral"} size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  {metrics.pendingCount} Requests
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Total Approved & Paid */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Total Approved & Paid
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold tabular text-accent tracking-tight flex items-baseline gap-1.5">
                  {formatMoney(metrics.approvedGross)}
                  <span className="text-xs font-semibold uppercase text-text-muted">Gross</span>
                </h3>
                <p className="text-xs font-semibold text-emerald-400 mt-0.5 tabular">
                  {formatMoney(metrics.approvedNet)} Net Disbursed
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-2xs text-text-muted leading-tight block flex-1">
                  Disbursed on-chain
                </span>
                <Badge tone="accent" size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  {metrics.approvedCount} Completed
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Rejected Requests */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Rejected Requests
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-red-400 group-hover:border-red-500/40 transition-colors">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold tabular text-text tracking-tight">
                  {metrics.rejectedCount}
                </h3>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-2xs text-text-muted leading-tight block flex-1">
                  Failed compliance check
                </span>
                <Badge tone={metrics.rejectedCount > 0 ? "danger" : "neutral"} size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  {metrics.rejectedCount > 0 ? "Breach Logged" : "0 Breaches"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Average Processing Time */}
          <Card className="bg-surface border-border hover:border-accent/40 hover:shadow-[0_0_15px_var(--accent-glow)] transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted group-hover:text-text transition-colors">
                  Avg Processing Speed
                </span>
                <div className="h-8 w-8 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold tabular text-accent tracking-tight">
                  {metrics.pendingCount > 0 || metrics.approvedCount > 0 ? metrics.avgTimeHours : '--'}
                </h3>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-2xs text-text-muted leading-tight block flex-1">
                  Target SLA &lt; {toNum(SLA_TARGET_HOURS).toFixed(1)} hrs {metrics.slaSampleSize > 0 && `(${metrics.slaSampleSize} resolved)`}
                </span>
                <Badge tone="accent" size="sm" className="shrink-0 font-semibold tabular text-2xs px-2 py-0.5">
                  {metrics.slaPct !== null ? `${toNum(metrics.slaPct).toFixed(1)}% SLA` : 'No data yet'}
                </Badge>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ── 2. Filter Tabs & Search Toolbar ───────────────────────────────── */}
      <div className="space-y-4">
        
        {/* Status Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-accent text-slate-950 shadow-sm font-bold'
                    : 'bg-surface text-text-muted hover:text-text hover:bg-surface-muted border border-border'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-2xs tabular px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-surface-muted text-text-muted'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search & Filter Bar */}
        <Card className="bg-surface border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search by Trader Name, Email, PO-3, or Wallet Address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-surface-muted border-border text-text text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs text-text-muted">
                <span>Showing <strong className="text-text tabular font-bold">{filteredPayouts.length}</strong> of {allPayouts.length} requests</span>
              </div>

            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── 3. Payout Requests Data Table ─────────────────────────────────── */}
      <Card className="bg-surface border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-text flex items-center gap-2">
              <Wallet className="h-4 w-4 text-accent" />
              Payout Requests Queue ({filteredPayouts.length})
            </CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Audit profit split calculation and approve on-chain disbursement
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <DataTable<PayoutTableRow>
            columns={columns}
            data={filteredPayouts}
            loading={payoutsLoading}
            selectable={true}
            selectedIds={selectedPayoutIds}
            onSelectionChange={setSelectedPayoutIds}
            emptyMessage={searchTerm || activeTab !== 'all' ? 'No payout requests match the selected filters.' : 'No payout requests found in queue.'}
            className="border-0 rounded-none bg-transparent"
          />
        </CardContent>
      </Card>

      {/* ── 4. Rich Payout Management Modal ───────────────────────────────── */}
      <PayoutManagementModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false)
          setSelectedPayout(null)
        }}
        payout={selectedPayout}
        onSuccess={() => {
          refetch()
          queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
        }}
      />

      {/* ── 4.5 Interactive Crypto Disbursal Helper with Dynamic QR (Phase 2) ── */}
      <PayoutQrModal
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false)
          setQrPayout(null)
        }}
        payout={qrPayout}
      />

      {/* ── Bulk Action Modal (PAY-4) ────────────────────────────────────── */}
      <Modal
        isOpen={showBulkConfirm}
        onClose={() => {
          if (!isBulkProcessing) {
            setShowBulkConfirm(false)
            setBulkActionType(null)
          }
        }}
        title={bulkActionType === 'paid' ? 'Confirm Bulk Disbursement (Mark Paid)' : 'Confirm Bulk Payout Approval'}
        description={
          bulkActionType === 'paid' ? (
            <span>
              You are about to mark <strong>{approvedSelectedPayouts.length}</strong> payout(s) totaling{' '}
              <strong className="text-emerald-400">{formatMoney(approvedSelectedTotalAmount)}</strong> as <strong>PAID</strong>. This permanently updates challenge accounts and records disbursement.
            </span>
          ) : (
            <span>
              You are about to approve <strong>{pendingSelectedPayouts.length}</strong> payout request(s) totaling{' '}
              <strong className="text-emerald-400">{formatMoney(pendingSelectedTotalAmount)}</strong>.
            </span>
          )
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              disabled={isBulkProcessing}
              onClick={() => {
                setShowBulkConfirm(false)
                setBulkActionType(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isBulkProcessing}
              disabled={bulkActionType === 'paid' && !bulkTxReference.trim()}
              onClick={handleBulkExecute}
            >
              {bulkActionType === 'paid'
                ? `Confirm Disbursement (${approvedSelectedPayouts.length})`
                : `Approve (${pendingSelectedPayouts.length})`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {bulkActionType === 'paid' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text flex items-center justify-between">
                <span>Batch / Transaction Reference <span className="text-rose-400">*</span></span>
                <span className="text-2xs text-text-muted">Required</span>
              </label>
              <Input
                placeholder="e.g. TX-BATCH-20261007-01 or Bank Wire Ref"
                value={bulkTxReference}
                onChange={(e) => setBulkTxReference(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text flex items-center justify-between">
              <span>Admin Note</span>
              <span className="text-2xs text-text-muted">Optional</span>
            </label>
            <Input
              placeholder={bulkActionType === 'paid' ? 'Disbursed via batch transfer' : 'Bulk approved via admin toolbar'}
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Bulk Errors Report Modal (PAY-4) ─────────────────────────────── */}
      <Modal
        isOpen={showBulkResultModal}
        onClose={() => {
          setShowBulkResultModal(false)
          setBulkErrors([])
        }}
        title={
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
            <span>Bulk Payout Processing Issues</span>
          </div>
        }
        description="The following payout requests could not be updated due to validation or safety guards."
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setShowBulkResultModal(false)
              setBulkErrors([])
            }}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {bulkErrors.map((err, i) => (
            <div key={i} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
              <div className="font-semibold text-rose-300">Payout #{err.id}</div>
              <div className="text-text-muted">{err.message}</div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── 5. Floating Bulk Action Toolbar (POLISH-1, POLISH-5, PAY-4) ───── */}
      {selectedPayoutIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold text-text">
              {selectedPayoutIds.length} payout{selectedPayoutIds.length > 1 ? 's' : ''} selected • {formatMoney(selectedTotalAmount)} total
            </span>
          </div>

          <div className="h-4 w-[1px] bg-border" />

          <div className="flex items-center gap-2">
            {pendingSelectedPayouts.length > 0 && (
              <Button
                size="sm"
                variant="primary"
                loading={isBulkProcessing && bulkActionType === 'approved'}
                onClick={() => {
                  setBulkActionType('approved')
                  setShowBulkConfirm(true)
                }}
                className="h-8 text-xs font-semibold gap-1.5 shadow-accent/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve Selected ({pendingSelectedPayouts.length})
              </Button>
            )}

            {approvedSelectedPayouts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                loading={isBulkProcessing && bulkActionType === 'paid'}
                onClick={() => {
                  setBulkActionType('paid')
                  setShowBulkConfirm(true)
                }}
                className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                Mark Paid ({approvedSelectedPayouts.length})
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const selectedRows = allPayouts.filter(p => selectedPayoutIds.includes(p.id))
                handleExportCSV(selectedRows)
              }}
              className="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-surface-muted"
            >
              <Download className="h-3.5 w-3.5 text-accent" />
              Export Selected CSV
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedPayoutIds([])}
              className="h-8 text-xs text-text-muted hover:text-text"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}

export default function PayoutsHubPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-text-muted">Loading payouts...</div>}>
      <PayoutsHubContent />
    </React.Suspense>
  )
}
