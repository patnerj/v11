'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Wallet, DollarSign, ArrowUpRight, Copy, Check, 
  Clock, ShieldCheck, AlertTriangle, ExternalLink, 
  CheckCircle2, XCircle, FileText, Send, Eye, QrCode
} from 'lucide-react'
import QRCode from 'qrcode'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { PayoutReconciliationCard, ReconciliationStatus } from './payout-reconciliation-card'

export interface PayoutItemTarget {
  id: number | string
  challenge_id?: number | string
  user_id?: number | string
  name?: string | null
  username?: string | null
  user_login?: string | null
  email?: string | null
  user_email?: string | null
  amount_requested?: number | string | null
  amount?: number | string | null
  trader_amount?: number | string | null
  firm_amount?: number | string | null
  profit_split_pct?: number | null
  status?: string | null
  payment_method?: string | null
  payment_address?: string | null
  gateway?: string | null
  tx_reference?: string | null
  proof_url?: string | null
  admin_note?: string | null
  requested_at?: string | null
  created_at?: string | null
  [key: string]: any
}

interface PayoutManagementModalProps {
  isOpen: boolean
  onClose: () => void
  payout: PayoutItemTarget | null
  onSuccess?: () => void
}

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

export function PayoutManagementModal({
  isOpen,
  onClose,
  payout,
  onSuccess,
}: PayoutManagementModalProps) {
  const [txHash, setTxHash] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [submittingAction, setSubmittingAction] = useState<string | null>(null)
  const [reconStatus, setReconStatus] = useState<ReconciliationStatus | null>(null)

  // Initialize modal state on payout selection
  useEffect(() => {
    if (payout) {
      setTxHash(payout.tx_reference || '')
      setProofUrl(payout.proof_url || '')
      setAdminNote(payout.admin_note || '')
      setCopied(false)
      setCopiedAddress(false)
      setCopiedAmount(false)
    }
  }, [payout])

  const destinationAddress = payout?.payment_address || null
  const method = (payout?.payment_method || payout?.gateway || 'Crypto TRC20').toUpperCase()
  const isCrypto = /crypto|usdt|btc|eth|trc|erc|sol|tron|bitcoin|ethereum/i.test(method) || !/bank|wire|paypal|deel|wise/i.test(method)

  // Generate QR code for crypto destination address - UNCONDITIONAL HOOK BEFORE EARLY RETURN
  useEffect(() => {
    if (payout && isCrypto && destinationAddress && destinationAddress.trim().length > 6) {
      QRCode.toDataURL(destinationAddress.trim(), {
        width: 220,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null))
    } else {
      setQrDataUrl(null)
    }
  }, [payout, destinationAddress, isCrypto])

  const WALLET_PATTERNS: Record<string, { regex: RegExp; label: string }> = {
    'TRC20': { regex: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, label: 'TRC20 (starts with T, 34 chars)' },
    'BEP20': { regex: /^0x[0-9a-fA-F]{40}$/, label: 'BEP20 (starts with 0x, 42 chars)' },
    'ERC20': { regex: /^0x[0-9a-fA-F]{40}$/, label: 'ERC20 (starts with 0x, 42 chars)' },
  }

  const detectedNetwork = React.useMemo(() => {
    if (/trc/i.test(method) || (destinationAddress && destinationAddress.startsWith('T'))) return 'TRC20'
    if (/bep|bsc/i.test(method)) return 'BEP20'
    if (/erc|eth/i.test(method)) return 'ERC20'
    if (destinationAddress && destinationAddress.startsWith('0x')) return 'BEP20'
    return null
  }, [method, destinationAddress])

  const isWalletFormatValid = React.useMemo(() => {
    if (!destinationAddress || !detectedNetwork) return true
    const pattern = WALLET_PATTERNS[detectedNetwork]
    if (!pattern) return true
    return pattern.regex.test(destinationAddress.trim())
  }, [destinationAddress, detectedNetwork])

  if (!payout) return null

  const payoutId = typeof payout.id === 'string' && payout.id.startsWith('PO-') 
    ? payout.id 
    : `PO-${payout.id}`

  const traderName = payout.name || payout.username || payout.user_login || `Trader #${payout.user_id || payout.id}`
  const traderEmail = payout.email || payout.user_email || `${payout.username || 'trader'}@example.com`
  
  // Never invent a payout amount — this figure drives the actual balance
  // deduction when the payout is marked paid, so a fabricated fallback here
  // would misstate real money moved.
  const requestedAmt = Number(payout.amount_requested || payout.amount || 0)
  const splitPct = Number(payout.profit_split_pct || 80)
  const traderShare = payout.trader_amount ? Number(payout.trader_amount) : (requestedAmt * (splitPct / 100))
  const firmShare = payout.firm_amount ? Number(payout.firm_amount) : (requestedAmt - traderShare)

  const dateFormatted = payout.requested_at || payout.created_at 
    ? new Date(payout.requested_at || payout.created_at || Date.now()).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Just now'

  const currentStatus = payout.status || 'requested'

  // Automated Founder Safety & AI Compliance Audit
  const isConsistencyOk = payout.consistency_ok !== false && !payout.consistency_breached
  const isHoldTimeClean = !payout.hft_flagged && !payout.anti_scalp_breached
  const isDrawdownSafe = !payout.near_drawdown_floor && !payout.dd_proximity_warning
  const breachesCount = Number(payout.breaches_count || 0)
  const isBreachesClean = breachesCount === 0
  const isAllClean = isConsistencyOk && isHoldTimeClean && isDrawdownSafe && isBreachesClean

  const handleCopy = () => {
    if (destinationAddress) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(destinationAddress).catch(() => {})
        }
      } catch {}
      setCopied(true)
      setCopiedAddress(true)
      toast.success('Payout destination wallet copied to clipboard!')
      setTimeout(() => {
        setCopied(false)
        setCopiedAddress(false)
      }, 2000)
    }
  }

  const handleCopyAmount = () => {
    if (traderShare > 0) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(traderShare.toFixed(2)).catch(() => {})
        }
      } catch {}
      setCopiedAmount(true)
      toast.success(`Exact amount (${traderShare.toFixed(2)} USD) copied to clipboard!`)
      setTimeout(() => setCopiedAmount(false), 2000)
    }
  }

  const handleAction = async (action: 'under_review' | 'approved' | 'rejected' | 'paid') => {
    if ((action === 'approved' || action === 'paid') && reconStatus && reconStatus.openPositionsCount > 0) {
      toast.error(`Cannot ${action} payout: Trader has ${reconStatus.openPositionsCount} active open market position(s). All positions must be closed before approval or disbursal.`)
      return
    }

    if (action === 'paid' && !txHash.trim()) {
      toast.error('Transaction ID / Tx Hash is required to mark this payout as paid and disburse.')
      return
    }

    if (action === 'paid' && requestedAmt <= 0) {
      toast.error('This payout has no amount on file — cannot mark as paid.')
      return
    }

    if (action === 'paid' && !destinationAddress) {
      toast.error('This payout has no destination address on file — confirm with the trader before disbursing.')
      return
    }

    if (action === 'paid' && destinationAddress && detectedNetwork && !isWalletFormatValid) {
      if (typeof window !== 'undefined') {
        const proceed = window.confirm(
          `⚠️ Warning: The destination address does not match standard ${WALLET_PATTERNS[detectedNetwork]?.label} format.\nAre you sure you want to mark this payout as paid?`
        )
        if (!proceed) return
      }
    }

    if (action === 'rejected' && !adminNote.trim()) {
      toast.error('Admin audit note is required to reject a payout.')
      return
    }

    setSubmittingAction(action)
    try {
      const rawId = typeof payout.id === 'string' ? parseInt(payout.id.replace(/\D/g, ''), 10) || 1 : payout.id
      const res = await api.admin.payoutStatus(
        rawId,
        action,
        adminNote.trim() || `Processed as ${action}`,
        {
          tx_reference: txHash.trim() || undefined,
          proof_url: proofUrl.trim() || undefined,
        }
      )

      if (res.ok && (res.data as any)?.success !== false) {
        if (action === 'paid') {
          toast.success(`Payout ${payoutId} marked as PAID & disbursed! (${formatMoney(traderShare)}) Balance deducted from trader account.`)
        } else if (action === 'approved') {
          toast.success(`Payout ${payoutId} approved for disbursement.`)
        } else if (action === 'rejected') {
          toast.success(`Payout ${payoutId} has been rejected with compliance note logged.`)
        } else {
          toast.success(`Payout ${payoutId} moved to Under Review queue.`)
        }
        onSuccess?.()
        onClose()
      } else {
        const errMsg = (res as any).data?.message || (res as any).error || 'Failed to update payout status.'
        toast.error(errMsg)
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error occurred while updating payout.')
    } finally {
      setSubmittingAction(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payout Request Management"
      description="Audit profit split calculation, verify destination wallet, and disburse withdrawal."
      className="max-w-2xl"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          {currentStatus === 'rejected' ? (
            <div className="text-2xs font-mono text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 w-full sm:w-auto">
              Terminal State: Payout has been rejected. Trader must submit a new request.
            </div>
          ) : currentStatus === 'paid' ? (
            <div className="text-2xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-full sm:w-auto">
              Terminal State: Payout has been paid & disbursed.
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleAction('rejected')}
                disabled={!adminNote.trim() || submittingAction !== null}
                loading={submittingAction === 'rejected'}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Reject Payout
              </Button>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {currentStatus === 'pending' && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleAction('under_review')}
                    disabled={submittingAction !== null}
                    loading={submittingAction === 'under_review'}
                  >
                    Move to Under Review
                  </Button>
                )}

                {(currentStatus === 'pending' || currentStatus === 'under_review') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAction('approved')}
                    disabled={submittingAction !== null || (reconStatus ? reconStatus.openPositionsCount > 0 : false)}
                    loading={submittingAction === 'approved'}
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    title={reconStatus && reconStatus.openPositionsCount > 0 ? "Blocked: All open market positions must be closed before approval" : undefined}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Approve (Pre-Clear)
                  </Button>
                )}

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleAction('paid')}
                  disabled={!txHash.trim() || submittingAction !== null || (reconStatus ? reconStatus.openPositionsCount > 0 : false)}
                  loading={submittingAction === 'paid'}
                  className="gap-1.5 shadow-emerald-500/20"
                  title={reconStatus && reconStatus.openPositionsCount > 0 ? "Blocked: All open market positions must be closed before disbursal" : undefined}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Paid & Disburse
                </Button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-5 py-2">
        
        {/* 1. Header Section */}
        <div className="bg-background rounded-xl border border-surface-muted p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center tabular font-bold text-sm shrink-0">
              {payoutId}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-100 text-sm">{traderName}</span>
                <span className="text-xs text-gray-500">({traderEmail})</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                <Clock className="h-3 w-3 text-gray-500" />
                <span>Requested {dateFormatted}</span>
              </div>
            </div>
          </div>

          <div>
            {currentStatus === 'paid' ? (
              <Badge tone="success" size="sm" pulsing>Paid & Disbursed</Badge>
            ) : currentStatus === 'approved' ? (
              <Badge tone="info" size="sm" pulsing>Approved</Badge>
            ) : currentStatus === 'under_review' ? (
              <Badge tone="info" size="sm" pulsing>Under Review</Badge>
            ) : currentStatus === 'rejected' ? (
              <Badge tone="danger" size="sm">Rejected</Badge>
            ) : (
              <Badge tone="warning" size="sm" pulsing>Requested</Badge>
            )}
          </div>
        </div>

        {/* 2. Financial Breakdown Grid (3 Metric Cards) */}
        <div className="grid grid-cols-3 gap-3">
          
          {/* Trader Amount */}
          <div className="bg-background border border-surface-muted rounded-xl p-3.5 space-y-1">
            <span className="text-2xs font-semibold text-gray-400 block">Trader Net Amount</span>
            <div className="text-lg sm:text-xl tabular font-bold text-emerald-400">
              {formatMoney(traderShare)}
            </div>
            <span className="text-2xs text-gray-500">Disbursed to Trader</span>
          </div>

          {/* Firm Amount */}
          <div className="bg-background border border-surface-muted rounded-xl p-3.5 space-y-1">
            <span className="text-2xs font-semibold text-gray-400 block">Firm Profit Share</span>
            <div className="text-lg sm:text-xl tabular font-bold text-gray-100">
              {formatMoney(firmShare)}
            </div>
            <span className="text-2xs text-gray-500">Retained by Firm</span>
          </div>

          {/* Split Percentage */}
          <div className="bg-background border border-surface-muted rounded-xl p-3.5 space-y-1">
            <span className="text-2xs font-semibold text-gray-400 block">Split Ratio</span>
            <div className="text-lg sm:text-xl tabular font-bold text-blue-400">
              {splitPct} / {100 - splitPct}
            </div>
            <span className="text-2xs text-gray-500">Trader / Firm</span>
          </div>

        </div>

        {/* 2.4 Pre-Flight Automated Ledger Reconciliation Card (Phase 2) */}
        <PayoutReconciliationCard payout={payout} onStatusCalculated={setReconStatus} />

        {/* 2.5 Founder Safety Audit & AI Compliance Verdict */}
        <div className="bg-background border border-surface-muted rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-muted/70 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Founder Safety Audit
              </span>
            </div>
            {isAllClean ? (
              <Badge tone="success" size="sm" className="font-sans font-bold flex items-center gap-1.5 w-fit">
                <CheckCircle2 className="h-3.5 w-3.5" />
                100% Clean - Recommended for Approval
              </Badge>
            ) : (
              <Badge tone="danger" size="sm" pulsing className="font-sans font-bold flex items-center gap-1.5 w-fit">
                <AlertTriangle className="h-3.5 w-3.5" />
                Risk Detected - Manual Review Required
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Consistency Status */}
            <div className="bg-surface border border-surface-muted p-2.5 rounded-lg flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-2xs text-gray-400 font-semibold block">Consistency Rule</span>
                <span className="text-2xs font-medium text-gray-200">Profit Distribution</span>
              </div>
              <Badge tone={isConsistencyOk ? 'success' : 'warning'} size="sm" className="tabular font-semibold text-2xs">
                {isConsistencyOk ? 'Verified' : 'Warning'}
              </Badge>
            </div>

            {/* Min Trade Duration */}
            <div className="bg-surface border border-surface-muted p-2.5 rounded-lg flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-2xs text-gray-400 font-semibold block">Min Hold Time</span>
                <span className="text-2xs font-medium text-gray-200">Anti-Scalp Filter</span>
              </div>
              <Badge tone={isHoldTimeClean ? 'success' : 'danger'} size="sm" className="tabular font-semibold text-2xs">
                {isHoldTimeClean ? 'Clean' : 'Toxic Flagged'}
              </Badge>
            </div>

            {/* Drawdown Proximity */}
            <div className="bg-surface border border-surface-muted p-2.5 rounded-lg flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-2xs text-gray-400 font-semibold block">Drawdown Room</span>
                <span className="text-2xs font-medium text-gray-200">Safety Buffer</span>
              </div>
              <Badge tone={isDrawdownSafe ? 'success' : 'warning'} size="sm" className="tabular font-semibold text-2xs">
                {isDrawdownSafe ? 'Safe' : 'Near Floor'}
              </Badge>
            </div>

            {/* Open Breaches */}
            <div className="bg-surface border border-surface-muted p-2.5 rounded-lg flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-2xs text-gray-400 font-semibold block">Rule Violations</span>
                <span className="text-2xs font-medium text-gray-200">Breach History</span>
              </div>
              <Badge tone={isBreachesClean ? 'success' : 'danger'} size="sm" className="tabular font-semibold text-2xs">
                {isBreachesClean ? '0 Breaches' : `${breachesCount} Breached`}
              </Badge>
            </div>
          </div>
        </div>

        {/* 3. Payout Destination Box with Scan-to-Pay QR Code (Point #5) */}
        <div className="bg-background border border-surface-muted rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-muted/70 pb-2.5">
            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Wallet className="h-4 w-4 text-emerald-400" />
              {isCrypto ? 'Crypto Disbursal Gateway' : 'Fiat / Banking Disbursal Gateway'}
            </span>
            <Badge tone="success" size="sm" className="font-mono font-bold text-xs uppercase px-2 py-0.5">
              {method}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
            {/* Scannable QR Code */}
            {qrDataUrl && destinationAddress ? (
              <div className="flex flex-col items-center gap-1.5 shrink-0 mx-auto sm:mx-0">
                <div className="p-2 rounded-xl bg-white shadow-lg border border-gray-200 flex items-center justify-center">
                  <img
                    src={qrDataUrl}
                    alt={`Scan-to-Pay QR Code for ${destinationAddress}`}
                    className="h-24 w-24 object-contain rounded-md"
                  />
                </div>
                <span className="text-2xs text-emerald-400 font-semibold flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Scan to Pay
                </span>
              </div>
            ) : null}

            {/* Destination Address & Copy Actions */}
            <div className="flex-1 space-y-2.5 w-full">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs text-gray-400 font-semibold">{isCrypto ? 'Trader Payout Wallet Address' : 'Trader Payout Destination / Account'}</span>
                  {destinationAddress && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        "text-xs font-semibold flex items-center gap-1.5 transition-all px-2.5 py-1 rounded-md active:scale-95 cursor-pointer select-none",
                        copiedAddress || copied
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                          : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      )}
                    >
                      {copiedAddress || copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedAddress || copied ? '✓ Copied!' : 'Copy Address'}
                    </button>
                  )}
                </div>
                <div className={`p-2.5 rounded-lg font-mono text-xs break-all select-all border ${destinationAddress ? 'bg-surface border-surface-muted text-gray-100' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  {destinationAddress || 'No destination address on file — confirm with the trader before marking this payout paid.'}
                </div>
                {destinationAddress && detectedNetwork && !isWalletFormatValid && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>⚠️ Invalid {detectedNetwork} address format. Expected: {WALLET_PATTERNS[detectedNetwork]?.label}</span>
                  </div>
                )}
                {destinationAddress && detectedNetwork && isWalletFormatValid && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-2xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>✓ Valid {WALLET_PATTERNS[detectedNetwork]?.label} checksum format verified</span>
                  </div>
                )}
              </div>

              {/* Exact Disbursal Amount 1-Click Copy */}
              {traderShare > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-surface-muted text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-gray-400">Exact Disbursal:</span>
                    <strong className="text-emerald-400 font-bold tabular">{formatMoney(traderShare)}</strong>
                    <span className="text-2xs text-gray-500 font-mono">({traderShare.toFixed(2)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAmount}
                    className={cn(
                      "text-xs font-semibold flex items-center gap-1.5 transition-all px-2.5 py-1 rounded active:scale-95 cursor-pointer select-none",
                      copiedAmount
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                        : "text-gray-300 hover:text-white bg-surface-muted hover:bg-gray-700"
                    )}
                  >
                    {copiedAmount ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedAmount ? '✓ Copied!' : 'Copy Amount'}
                  </button>
                </div>
              )}

              <p className="text-2xs text-gray-500 leading-tight">
                Scan QR or copy address & exact amount directly into your hardware wallet, Binance, or TronLink terminal to eliminate copy-paste errors.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Input Fields */}
        <div className="space-y-4">
          
          {/* Transaction ID / Reference (Required to Approve) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tx-hash" className="mb-0">
                Transaction ID / Reference Hash <span className="text-emerald-400 font-normal">(Required to Mark Paid)</span>
              </Label>
              <span className="text-2xs text-gray-500">TX Hash / Bank Ref</span>
            </div>
            <Input
              id="tx-hash"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="e.g. 0x89f2a71d4c8b08a54a94bc80521e6490fdbce2b1 or TX-889124"
              className="text-xs"
            />
          </div>

          {/* Proof URL (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="proof-url" className="mb-0">
              Payment Proof URL / Explorer Link <span className="text-gray-500 font-normal">(Optional)</span>
            </Label>
            <Input
              id="proof-url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="e.g. https://tronscan.org/#/transaction/..."
              className="text-xs"
            />
          </div>

          {/* Admin Note (Required to Reject) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="admin-note" className="mb-0">
                Administrative Note <span className="text-red-400 font-normal">(Required to Reject)</span>
              </Label>
              <span className="text-2xs text-gray-500">Logged to compliance trail</span>
            </div>
            <Textarea
              id="admin-note"
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Specify reason if rejecting, or add audit remarks for disbursements..."
              className="text-xs"
            />
          </div>

        </div>

      </div>
    </Modal>
  )
}
