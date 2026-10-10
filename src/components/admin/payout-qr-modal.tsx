'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wallet, Copy, Check, QrCode, ExternalLink, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { fmtUSD } from '@/lib/format'

interface PayoutQrModalProps {
  isOpen: boolean
  onClose: () => void
  payout: {
    id: string | number
    trader_name?: string
    amount?: number | string
    trader_amount?: number | string
    amount_requested?: number | string
    payment_method?: string
    payment_address?: string
    [key: string]: any
  } | null
}

export function PayoutQrModal({ isOpen, onClose, payout }: PayoutQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copiedAddr, setCopiedAddr] = useState(false)
  const [copiedAmt, setCopiedAmt] = useState(false)

  const destinationAddress = payout?.payment_address || ''
  const method = (payout?.payment_method || 'Crypto USDT TRC20').toUpperCase()
  const rawAmt = Number(payout?.trader_amount || payout?.amount_requested || payout?.amount || 0)
  const formattedAmt = rawAmt.toFixed(2)

  // Network Detection
  const network = React.useMemo(() => {
    if (/trc/i.test(method) || destinationAddress.startsWith('T')) return 'TRC-20'
    if (/bep|bsc/i.test(method)) return 'BEP-20'
    if (/erc|eth/i.test(method)) return 'ERC-20'
    if (/btc|bitcoin/i.test(method)) return 'BTC'
    if (/sol/i.test(method)) return 'SOL'
    return 'CRYPTO'
  }, [method, destinationAddress])

  useEffect(() => {
    if (destinationAddress && destinationAddress.trim().length > 5) {
      QRCode.toDataURL(destinationAddress.trim(), {
        width: 260,
        margin: 2,
        color: {
          dark: '#0B0F19',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null))
    } else {
      setQrDataUrl(null)
    }
  }, [destinationAddress])

  const copyAddress = () => {
    if (!destinationAddress) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(destinationAddress).catch(() => {})
      }
    } catch {}
    setCopiedAddr(true)
    toast.success('Wallet address copied to clipboard!')
    setTimeout(() => setCopiedAddr(false), 2000)
  }

  const copyAmount = () => {
    if (rawAmt <= 0) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(formattedAmt).catch(() => {})
      }
    } catch {}
    setCopiedAmt(true)
    toast.success(`Exact net amount (${formattedAmt} USD) copied!`)
    setTimeout(() => setCopiedAmt(false), 2000)
  }

  if (!payout) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Interactive Crypto Disbursal Helper"
      description="Scan QR code with your corporate hardware wallet or mobile exchange app for 2-second disbursal."
      className="max-w-lg"
    >
      <div className="space-y-4 py-2 select-none">
        {/* Header Summary */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
          <div>
            <span className="text-2xs text-text-muted font-medium">Beneficiary Trader</span>
            <p className="text-sm font-bold text-text">{payout.trader_name || `Trader #${payout.id}`}</p>
          </div>
          <div className="text-right">
            <span className="text-2xs text-text-muted font-medium">Net Disbursal</span>
            <p className="text-base font-extrabold text-emerald-500 terminal-num">{fmtUSD(rawAmt)}</p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-surface-secondary/50 border border-border/80">
          {qrDataUrl ? (
            <div className="relative group p-3 bg-white rounded-2xl shadow-xl border-2 border-border/40">
              <img
                src={qrDataUrl}
                alt={`Scan-to-pay QR for ${destinationAddress}`}
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
              />
              <div className="absolute inset-0 bg-black/5 rounded-2xl pointer-events-none" />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-2xl bg-surface-muted flex flex-col items-center justify-center text-text-muted text-xs gap-2">
              <QrCode className="h-10 w-10 opacity-40" />
              <span>No Destination Address</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Badge tone="accent" size="sm" className="font-mono font-bold text-2xs uppercase">
              {network}
            </Badge>
            <span className="text-2xs text-text-muted">
              Scan with TrustWallet, Binance, or Ledger
            </span>
          </div>
        </div>

        {/* Copy Address Row */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs">
            <span className="font-semibold text-text-muted flex items-center gap-1">
              <Wallet className="h-3 w-3 text-accent" /> Destination Address ({network})
            </span>
            <button
              type="button"
              onClick={copyAddress}
              className="font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedAddr ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">✓ Address Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>
          <div 
            onClick={copyAddress}
            className="p-2.5 rounded-lg bg-surface border border-border font-mono text-xs text-text break-all cursor-pointer hover:border-accent transition-colors"
          >
            {destinationAddress || 'No destination address provided'}
          </div>
        </div>

        {/* Copy Amount Row */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <div>
              <span className="text-2xs text-text-muted font-medium">Exact Net Amount</span>
              <p className="text-sm font-bold text-text terminal-num">{formattedAmt} USDT / USD</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyAmount}
            className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            {copiedAmt ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Amount</span>
              </>
            )}
          </Button>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            className="w-full h-10 font-semibold"
            onClick={onClose}
          >
            Done with Transfer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
