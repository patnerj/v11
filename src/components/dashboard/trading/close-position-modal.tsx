'use client'

import { memo, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtPrice, fmtUSD, fmtLots, toNum, pnlClass } from '@/lib/format'
import { symbolDigits } from '@/lib/symbol-meta'
import { quoteToUsdRate } from '@/lib/order-math'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { cn } from '@/lib/cn'
import type { Position } from '@/types/api'

export interface ClosePositionModalProps {
  open: boolean
  position: Position | null
  onClose: () => void
  onConfirm: () => void | Promise<void>
  loading?: boolean
}

export const ClosePositionModal = memo(function ClosePositionModal({
  open,
  position,
  onClose,
  onConfirm,
  loading = false,
}: ClosePositionModalProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onClose])

  const getMeta = useTerminal((s) => s.getMeta)
  const meta = position ? getMeta(position.symbol) : undefined
  const digits = meta?.digits || (position ? symbolDigits(position.symbol) : 2)

  // Real-time market tick subscription
  const tick = usePrices((s) => (position ? s.prices[position.symbol] : undefined))
  const allPrices = usePrices((s) => s.prices)
  const isMt5Synced = Boolean(position?.order_id && Number(position.order_id) > 100000)

  const currentPx = isMt5Synced && toNum(position?.current_price) > 0
    ? toNum(position?.current_price)
    : position?.type === 'buy'
      ? (toNum(tick?.bid) || toNum(position?.current_price))
      : (toNum(tick?.ask) || toNum(position?.current_price))

  const pnl = useMemo(() => {
    if (!position) return 0
    if (isMt5Synced) {
      return toNum(position.pnl) + toNum(position.swap) - toNum(position.commission)
    }
    if (tick && currentPx > 0 && toNum(position.open_price) > 0) {
      const openPx = toNum(position.open_price)
      const diff = position.type === 'buy' ? currentPx - openPx : openPx - currentPx
      const contractSize = toNum(meta?.contract_size) || 100000
      const calcPnl = diff * contractSize * toNum(position.lot_size)
      return calcPnl * quoteToUsdRate(position.symbol, currentPx, allPrices) + toNum(position.swap) - toNum(position.commission)
    }
    return toNum(position.pnl)
  }, [isMt5Synced, position, tick, currentPx, meta?.contract_size, allPrices])

  if (!open || !position) return null

  const isBuy = position.type === 'buy'
  const isProfit = pnl >= 0

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        {/* Backdrop click dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!loading) onClose() }}
          className="fixed inset-0"
          aria-hidden="true"
        />

        {/* Modal Window (Binance / OKX Futures Style) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-pos-title"
          className={cn(
            "relative w-full max-w-md rounded-2xl border shadow-2xl p-5 sm:p-6 select-none",
            "bg-surface border-border text-foreground dark:bg-[#0B0F19] dark:border-slate-800"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button (top right) */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cancel"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header with warning icon & title */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className="h-11 w-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-0.5 pr-6">
              <h3 id="close-pos-title" className="text-terminal-title font-semibold text-text tracking-tight flex items-center gap-2">
                <span>Confirm Position Close</span>
              </h3>
              <p className="text-terminal-label text-text-muted">
                Do you really want to close this position at current market price?
              </p>
            </div>
          </div>

          {/* Binance-Inspired Position Details Card */}
          <div className="rounded-xl border border-border-subtle bg-bg-subtle/50 p-4 space-y-3.5 mb-4">
            {/* Top row: Symbol, Side Badge, Volume */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-terminal-title font-semibold text-text tracking-tight terminal-num">
                  {position.symbol}
                </span>
                <span
                  className={cn(
                    "text-terminal-micro font-semibold px-2 py-0.5 rounded uppercase tracking-wider border",
                    isBuy
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  )}
                >
                  {position.type.toUpperCase()}
                </span>
              </div>
              <div className="text-terminal-label font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border-subtle text-text terminal-num">
                {fmtLots(position.lot_size)}
              </div>
            </div>

            {/* Price Row: Entry -> Market */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50">
              <div className="space-y-0.5">
                <span className="text-terminal-micro text-text-muted uppercase tracking-wider block">Entry Price</span>
                <span className="text-terminal-label font-semibold terminal-num text-text">
                  {fmtPrice(position.open_price, digits)}
                </span>
              </div>
              <div className="space-y-0.5 text-right">
                <span className="text-terminal-micro text-text-muted uppercase tracking-wider block flex items-center justify-end gap-1">
                  <span>Current Price</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </span>
                <span className="text-terminal-label font-semibold terminal-num text-text">
                  {fmtPrice(currentPx, digits)}
                </span>
              </div>
            </div>

            {/* Floating P&L Hero Display */}
            <div className="rounded-lg bg-surface border border-border-subtle p-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-terminal-micro text-text-muted uppercase tracking-wider block">Estimated P&L</span>
                <span className="text-terminal-micro text-text-faint">
                  {isProfit ? 'Profit (Realized on Close)' : 'Loss (Realized on Close)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isProfit ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span className={cn("text-terminal-title font-semibold terminal-num tracking-tight", pnlClass(pnl))}>
                  {fmtUSD(pnl, { sign: true })}
                </span>
              </div>
            </div>

            {/* Ticket & Account Footnote */}
            {(position.order_id || position.account_id) && (
              <div className="flex items-center justify-between text-terminal-micro text-text-faint pt-1">
                <span>Account: #{position.account_id || 'Active'}</span>
                {position.order_id && <span>Ticket: #{position.order_id}</span>}
              </div>
            )}
          </div>

          {/* Execution Warning Notice */}
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-terminal-micro text-amber-300 leading-relaxed mb-5">
            ⚠️ <strong className="font-semibold">Market Execution:</strong> This position will be immediately liquidated at the best available live price. This action cannot be reversed.
          </div>

          {/* Two Prominent Action Buttons (Binance Style) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 px-4 rounded-xl border border-border bg-surface-muted/60 hover:bg-surface-muted text-text font-semibold text-terminal-label transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              No, Keep Position
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-terminal-label shadow-lg shadow-rose-600/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>Closing...</span>
                </>
              ) : (
                <span>Yes, Close Position</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
})
