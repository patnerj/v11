'use client'

import { memo, useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ShieldCheck, Target, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtPrice, fmtUSD, fmtLots, toNum } from '@/lib/format'
import { symbolDigits, pipSize, getSymbolMeta } from '@/lib/symbol-meta'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { playSltpUpdatedSound } from '@/lib/sound'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import type { Position } from '@/types/api'

export interface ModifySltpModalProps {
  open: boolean
  position: Position | null
  onClose: () => void
  onSuccess?: () => void
}

export const ModifySltpModal = memo(function ModifySltpModal({
  open,
  position,
  onClose,
  onSuccess,
}: ModifySltpModalProps) {
  const getMeta = useTerminal((s) => s.getMeta)
  const meta = position ? getMeta(position.symbol) : undefined
  const digits = meta?.digits || (position ? symbolDigits(position.symbol) : 2)

  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync draft inputs when position changes or modal opens
  useEffect(() => {
    if (position && open) {
      setSl(position.sl ? String(toNum(position.sl)) : '')
      setTp(position.tp ? String(toNum(position.tp)) : '')
    }
  }, [position, open])

  // Lock body scroll while open on mobile
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
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  const tick = usePrices((s) => (position ? s.prices[position.symbol] : undefined))
  const isMt5Synced = Boolean(position?.order_id && Number(position.order_id) > 0 && ((position as any).source === 'mt5' || (position as any).source === 'bridge'))

  const currentPx = isMt5Synced && toNum(position?.current_price) > 0
    ? toNum(position?.current_price)
    : position?.type === 'buy'
      ? (toNum(tick?.bid) || toNum(position?.current_price))
      : (toNum(tick?.ask) || toNum(position?.current_price))

  const symMeta = position ? getSymbolMeta(position.symbol, meta) : { pipSize: 0.0001, contractSize: 100000 }
  const pSize = symMeta.pipSize || (position ? pipSize(position.symbol, digits) : 0.0001)
  const contract = toNum(meta?.contract_size) || symMeta.contractSize
  const openPx = position ? toNum(position.open_price) : 0

  const slNum = sl.trim() ? toNum(sl) : null
  const tpNum = tp.trim() ? toNum(tp) : null

  const slMetrics = useMemo(() => {
    if (!slNum || openPx <= 0 || !position) return null
    const diff = Math.abs(slNum - openPx)
    if (diff <= 0) return null
    const pips = pSize > 0 ? diff / pSize : diff
    const loss = diff * contract * toNum(position.lot_size)
    const isTrailingStop = position.type === 'buy' ? slNum > openPx : slNum < openPx
    return { diff, pips, loss, isTrailingStop }
  }, [slNum, openPx, pSize, contract, position])

  const tpMetrics = useMemo(() => {
    if (!tpNum || openPx <= 0 || !position) return null
    const diff = Math.abs(tpNum - openPx)
    if (diff <= 0) return null
    const pips = pSize > 0 ? diff / pSize : diff
    const profit = diff * contract * toNum(position.lot_size)
    return { diff, pips, profit }
  }, [tpNum, openPx, pSize, contract, position])

  const handleSetBreakeven = useCallback(() => {
    if (!position || openPx <= 0) return
    setSl(String(openPx))
  }, [position, openPx])

  const handleSave = useCallback(async () => {
    if (!position || saving) return
    setSaving(true)
    try {
      const nextSl = sl.trim() ? toNum(sl) : null
      const nextTp = tp.trim() ? toNum(tp) : null

      const res = await api.sltp(position.id, nextSl, nextTp)
      if (res.ok && res.data.success) {
        playSltpUpdatedSound()
        toast.success(`SL/TP updated for ${position.symbol} #${position.id}`)
        invalidateFxsim('/positions')
        invalidateFxsim('/account')
        onSuccess?.()
        onClose()
      } else {
        toast.error(res.ok ? (res.data.message || 'Update failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }, [position, sl, tp, saving, onSuccess, onClose])

  if (!open || !position) return null

  const isBuy = position.type === 'buy'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!saving) onClose() }}
          className="fixed inset-0"
          aria-hidden="true"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-sm rounded-xl border border-border bg-surface shadow-2xl p-4 sm:p-5 text-foreground z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight">{position.symbol}</span>
              <Badge tone={isBuy ? 'success' : 'danger'}>
                {position.type.toUpperCase()} {fmtLots(position.lot_size)}
              </Badge>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Price Strip */}
          <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-surface-muted/50 border border-border-subtle/60 text-xs">
            <div>
              <span className="text-text-muted block text-2xs uppercase">Entry Price</span>
              <span className="font-semibold terminal-num text-sm">{fmtPrice(position.open_price, digits)}</span>
            </div>
            <div className="text-right">
              <span className="text-text-muted block text-2xs uppercase">Current Price</span>
              <span className="font-semibold terminal-num text-sm">{fmtPrice(currentPx, digits)}</span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3.5 my-2">
            {/* Stop Loss */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Stop Loss
                </label>
                <button
                  type="button"
                  onClick={handleSetBreakeven}
                  className="text-2xs text-accent hover:underline font-medium cursor-pointer"
                >
                  Set Breakeven ({fmtPrice(openPx, digits)})
                </button>
              </div>
              <div className="relative">
                <input
                  value={sl}
                  onChange={(e) => setSl(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder={`e.g. ${fmtPrice(isBuy ? openPx * 0.995 : openPx * 1.005, digits)}`}
                  inputMode="decimal"
                  className={cn(
                    "w-full h-9 px-3 rounded-md border bg-surface text-sm terminal-num focus-ring transition-colors",
                    slMetrics?.isTrailingStop
                      ? "border-emerald-500/60 text-emerald-500 focus:border-emerald-500"
                      : slMetrics
                      ? "border-rose-500/60 text-rose-500 focus:border-rose-500"
                      : "border-border text-foreground"
                  )}
                />
                {sl && (
                  <button
                    type="button"
                    onClick={() => setSl('')}
                    className="absolute right-2 top-2 text-text-muted hover:text-text p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {slMetrics && (
                <div className={cn(
                  "mt-1 text-2xs font-medium flex items-center justify-between px-1",
                  slMetrics.isTrailingStop ? "text-emerald-500" : "text-rose-500"
                )}>
                  <span>{slMetrics.isTrailingStop ? 'Profit Lock' : 'Projected Loss'}: {slMetrics.isTrailingStop ? '+' : '-'}{fmtUSD(slMetrics.loss)}</span>
                  <span>{slMetrics.pips.toFixed(1)} pips</span>
                </div>
              )}
            </div>

            {/* Take Profit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" /> Take Profit
                </label>
              </div>
              <div className="relative">
                <input
                  value={tp}
                  onChange={(e) => setTp(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder={`e.g. ${fmtPrice(isBuy ? openPx * 1.01 : openPx * 0.99, digits)}`}
                  inputMode="decimal"
                  className={cn(
                    "w-full h-9 px-3 rounded-md border bg-surface text-sm terminal-num focus-ring transition-colors",
                    tpMetrics
                      ? "border-emerald-500/60 text-emerald-500 focus:border-emerald-500"
                      : "border-border text-foreground"
                  )}
                />
                {tp && (
                  <button
                    type="button"
                    onClick={() => setTp('')}
                    className="absolute right-2 top-2 text-text-muted hover:text-text p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {tpMetrics && (
                <div className="mt-1 text-2xs font-medium text-emerald-500 flex items-center justify-between px-1">
                  <span>Projected Profit: +{fmtUSD(tpMetrics.profit)}</span>
                  <span>{tpMetrics.pips.toFixed(1)} pips</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gap-1.5"
            >
              {saving ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save SL / TP</span>
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
})
