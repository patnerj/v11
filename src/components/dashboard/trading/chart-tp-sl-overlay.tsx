'use client'

import { memo, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Pencil, Lock, Plus, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { usePrices } from '@/store/prices'
import { fmtPrice, fmtUSD, fmtLots, toNum, pnlClass } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { playOrderCloseSound, playSltpUpdatedSound } from '@/lib/sound'
import type { Position, PendingOrder } from '@/types/api'

interface Props {
  symbol: string
  positions: Position[]
  pendingOrders?: PendingOrder[]
  digits: number
  pipSize: number
  contractSize: number
  currentBid: number
  currentAsk: number
  isSlRequired?: boolean
  chartHostRef?: React.RefObject<HTMLDivElement | null>
  compact?: boolean
  onChanged?: () => void
  isVisible?: boolean
  onToggleVisible?: () => void
}

/** Defensive array normalizer (Rule 1.2 in AGENTS.md) */
function normalizeList<T>(arr: unknown): T[] {
  if (Array.isArray(arr)) return arr
  return []
}

export const ChartTpSlOverlay = memo(function ChartTpSlOverlay({
  symbol,
  positions: rawPositions,
  pendingOrders: rawPending,
  digits,
  pipSize: pSizeRaw,
  contractSize,
  currentBid,
  currentAsk,
  isSlRequired,
  compact,
  onChanged,
  isVisible = true,
}: Props) {
  const positions = useMemo(() => normalizeList<Position>(rawPositions), [rawPositions])
  const pendingOrders = useMemo(() => normalizeList<PendingOrder>(rawPending), [rawPending])

  const pSize = pSizeRaw > 0 ? pSizeRaw : 0.0001
  const contract = contractSize > 0 ? contractSize : 100000

  // Active selected position when multiple exist on this symbol
  const [selectedPosId, setSelectedPosId] = useState<number | null>(null)

  const activePos = useMemo(() => {
    if (positions.length === 0) return null
    if (selectedPosId) {
      const found = positions.find((p) => p.id === selectedPosId)
      if (found) return found
    }
    // Default to the position with highest lot size or latest ID
    return positions[positions.length - 1]
  }, [positions, selectedPosId])

  // Quick edit state
  const [isEditing, setIsEditing] = useState(false)
  const [draftSl, setDraftSl] = useState('')
  const [draftTp, setDraftTp] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const draftSlNum = draftSl.trim() ? toNum(draftSl) : null
  const draftTpNum = draftTp.trim() ? toNum(draftTp) : null

  const draftSlMetrics = useMemo(() => {
    if (!draftSlNum || !activePos) return null
    const openPx = toNum(activePos.open_price)
    const diff = Math.abs(draftSlNum - openPx)
    if (diff <= 0) return null
    const pips = pSize > 0 ? diff / pSize : diff
    const loss = diff * contract * toNum(activePos.lot_size)
    return { diff, pips, loss }
  }, [draftSlNum, activePos, pSize, contract])

  const draftTpMetrics = useMemo(() => {
    if (!draftTpNum || !activePos) return null
    const openPx = toNum(activePos.open_price)
    const diff = Math.abs(draftTpNum - openPx)
    if (diff <= 0) return null
    const pips = pSize > 0 ? diff / pSize : diff
    const profit = diff * contract * toNum(activePos.lot_size)
    return { diff, pips, profit }
  }, [draftTpNum, activePos, pSize, contract])

  // Open inline editor for a position
  const startEdit = useCallback((p: Position) => {
    setIsEditing((prev) => !prev)
    setDraftSl(p.sl ? String(toNum(p.sl)) : '')
    setDraftTp(p.tp ? String(toNum(p.tp)) : '')
  }, [])

  // Save modified SL/TP
  const handleSave = useCallback(async (p: Position) => {
    if (isSaving) return

    const nextSl = draftSl.trim() ? toNum(draftSl) : null
    const nextTp = draftTp.trim() ? toNum(draftTp) : null

    // Plan validation guard (Rule 9 in GEMINI.md)
    if (isSlRequired && (!nextSl || nextSl <= 0)) {
      toast.error('Stop Loss is mandatory for this trading plan and cannot be removed')
      return
    }

    const openPx = toNum(p.open_price)

    if (nextTp && nextTp > 0) {
      if (p.type === 'buy' && nextTp <= openPx) {
        toast.error('Take Profit must be above entry price for a BUY trade')
        return
      }
      if (p.type === 'sell' && nextTp >= openPx) {
        toast.error('Take Profit must be below entry price for a SELL trade')
        return
      }
    }

    if (nextSl && nextSl > 0) {
      if (p.type === 'buy' && nextSl >= openPx) {
        toast.warning('Stop Loss is above entry price (Trailing Profit Stop)')
      }
      if (p.type === 'sell' && nextSl <= openPx) {
        toast.warning('Stop Loss is below entry price (Trailing Profit Stop)')
      }
    }

    setIsSaving(true)
    try {
      const res = await api.sltp(p.id, nextSl, nextTp)
      if (res.ok && res.data.success) {
        playSltpUpdatedSound()
        toast.success(`SL/TP updated for ${p.symbol} #${p.id}`)
        setIsEditing(false)
        invalidateFxsim('/positions')
        usePrices.getState().refresh()
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Update failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update SL/TP')
    } finally {
      setIsSaving(false)
    }
  }, [draftSl, draftTp, isSlRequired, isSaving, onChanged])

  // 1-Click Break-Even action
  const handleBreakEven = useCallback(async (p: Position) => {
    const openPx = toNum(p.open_price)
    const curPx = p.type === 'buy' ? currentBid : currentAsk
    const inProfit = p.type === 'buy' ? curPx > openPx : curPx < openPx

    if (!inProfit) {
      const diffPips = ((p.type === 'buy' ? curPx - openPx : openPx - curPx) / pSize).toFixed(1)
      toast.warning(`Position must be in profit to set Break-Even (current: ${diffPips} pips)`)
      return
    }

    try {
      const currentTp = p.tp ? toNum(p.tp) : null
      const res = await api.sltp(p.id, openPx, currentTp)
      if (res.ok && res.data.success) {
        playSltpUpdatedSound()
        toast.success(`🛡️ Protected! SL set to Break-Even (${fmtPrice(openPx, digits)})`)
        invalidateFxsim('/positions')
        usePrices.getState().refresh()
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Break-even failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set break-even')
    }
  }, [currentBid, currentAsk, pSize, digits, onChanged])

  // 1-Click Close Position
  const handleClose = useCallback(async (p: Position) => {
    try {
      const res = await api.close(p.id)
      if (res.ok && res.data.success) {
        playOrderCloseSound()
        const closePnl = toNum(res.data.pnl)
        toast.success(`Closed ${p.symbol} #${p.id} · ${fmtUSD(closePnl, { sign: true })}`)
        invalidateFxsim('/positions')
        invalidateFxsim('/account')
        invalidateFxsim('/history')
        usePrices.getState().refresh()
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Close failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to close position')
    }
  }, [onChanged])

  // 1-Click Cancel Pending Order
  const handleCancelPending = useCallback(async (orderId: number) => {
    try {
      const res = await api.pendingCancel(orderId)
      if (res.ok && res.data.success) {
        toast.success(`Cancelled pending order #${orderId}`)
        invalidateFxsim('/positions')
        usePrices.getState().refresh()
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Cancel failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel order')
    }
  }, [onChanged])

  // Preset pip adjustments for editor
  const applyPipOffset = useCallback((p: Position, field: 'sl' | 'tp', pips: number) => {
    const openPx = toNum(p.open_price)
    const delta = pips * pSize

    if (field === 'sl') {
      const newSl = p.type === 'buy' ? openPx - delta : openPx + delta
      setDraftSl(newSl > 0 ? newSl.toFixed(digits) : '')
    } else {
      const newTp = p.type === 'buy' ? openPx + delta : openPx - delta
      setDraftTp(newTp > 0 ? newTp.toFixed(digits) : '')
    }
  }, [pSize, digits])

  if (!isVisible || (positions.length === 0 && pendingOrders.length === 0)) {
    return null
  }

  // Net metrics
  const totalNetPnl = positions.reduce((acc, pos) => {
    const openPx = toNum(pos.open_price)
    const lots = toNum(pos.lot_size)
    const isBuy = pos.type === 'buy'
    const curPx = isBuy ? (currentBid || openPx) : (currentAsk || openPx)
    const diff = isBuy ? curPx - openPx : openPx - curPx
    return acc + diff * contract * lots
  }, 0)

  const pos = activePos || positions[0]
  if (!pos) return null

  const openPx = toNum(pos.open_price)
  const slPx = toNum(pos.sl)
  const tpPx = toNum(pos.tp)
  const lots = toNum(pos.lot_size)
  const isBuy = pos.type === 'buy'
  const curPx = isBuy ? (currentBid || openPx) : (currentAsk || openPx)

  // Live Floating Metrics
  const liveDiff = isBuy ? curPx - openPx : openPx - curPx
  const livePnl = liveDiff * contract * lots
  const livePips = liveDiff / pSize

  // TP Metrics
  const hasTp = tpPx > 0
  const tpDiff = hasTp ? (isBuy ? tpPx - openPx : openPx - tpPx) : 0
  const tpPips = hasTp ? tpDiff / pSize : 0
  const tpReward = hasTp ? tpDiff * contract * lots : 0

  // SL Metrics
  const hasSl = slPx > 0
  const slDiff = hasSl ? (isBuy ? openPx - slPx : slPx - openPx) : 0
  const slPips = hasSl ? slDiff / pSize : 0
  const slRisk = hasSl ? slDiff * contract * lots : 0

  const canBE = isBuy ? curPx > openPx : curPx < openPx

  return (
    <div className="shrink-0 bg-surface/95 border-b border-border-subtle backdrop-blur-md z-20 select-none transition-all px-3 py-1.5 flex flex-col gap-1.5 shadow-sm">
      {/* ── Main Execution & Risk Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Position Identifier + Multi-trade Selector + Entry + PnL */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            className={`px-1.5 py-0.5 rounded text-terminal-micro font-semibold uppercase tracking-wider inline-flex items-center gap-1 shadow-sm ${
              isBuy
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pos.type.toUpperCase()} <span className="terminal-num">{fmtLots(lots)}</span>
          </span>

          <span className="text-terminal-body terminal-num text-text-muted">
            #{pos.id} @ <span className="text-text font-semibold terminal-num">{fmtPrice(openPx, digits)}</span>
          </span>

          {/* Live Floating PnL */}
          <span
            className={`text-terminal-body terminal-num font-semibold px-2 py-0.5 rounded ${pnlClass(
              livePnl
            )} bg-bg-subtle/80 border border-border-subtle shadow-sm`}
          >
            {fmtUSD(livePnl, { sign: true })} ({livePips >= 0 ? '+' : ''}
            {livePips.toFixed(1)}p)
          </span>

          {/* Multi-Position Switcher (If multiple trades exist on this symbol) */}
          {positions.length > 1 && (
            <div className="flex items-center gap-1 border-l border-border-subtle pl-2 ml-1">
              <span className="text-terminal-micro text-text-faint uppercase font-semibold">Trades:</span>
              {positions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPosId(p.id)
                    setIsEditing(false)
                  }}
                  className={`px-1.5 py-0.2 rounded text-terminal-micro terminal-num font-semibold transition-all cursor-pointer ${
                    p.id === pos.id
                      ? 'bg-accent text-accent-contrast shadow-sm'
                      : 'bg-surface-muted text-text-muted hover:text-text'
                  }`}
                  title={`Switch to trade #${p.id} (${fmtLots(p.lot_size)} lots)`}
                >
                  #{p.id}
                </button>
              ))}
              <span className="text-terminal-micro terminal-num text-text-muted ml-1 hidden md:inline">
                (Net: <b className={cn("terminal-num font-semibold", pnlClass(totalNetPnl))}>{fmtUSD(totalNetPnl, { sign: true })}</b>)
              </span>
            </div>
          )}
        </div>

        {/* Right: TP / SL Levels & Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          {/* Stop Loss Button */}
          <button
            type="button"
            onClick={() => startEdit(pos)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md terminal-num text-terminal-body transition-all cursor-pointer ${
              hasSl
                ? 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400'
                : 'bg-surface-muted/80 hover:bg-rose-500/15 border border-dashed border-rose-500/40 text-rose-300'
            }`}
            title={hasSl ? 'Click to modify Stop Loss' : 'Click to add Stop Loss'}
          >
            {hasSl ? (
              <>
                <span className="text-terminal-micro uppercase font-semibold text-rose-300">SL</span>
                <span className="font-semibold terminal-num">{fmtPrice(slPx, digits)}</span>
                <span className="text-terminal-micro opacity-75 hidden sm:inline">
                  (-{slPips.toFixed(1)}p · -{fmtUSD(Math.abs(slRisk))})
                </span>
                <Pencil className="h-2.5 w-2.5 ml-0.5 opacity-70" />
              </>
            ) : (
              <>
                <Plus className="h-2.5 w-2.5" />
                <span className="text-terminal-micro font-semibold">Add SL</span>
              </>
            )}
          </button>

          {/* Take Profit Button */}
          <button
            type="button"
            onClick={() => startEdit(pos)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md terminal-num text-terminal-body transition-all cursor-pointer ${
              hasTp
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                : 'bg-surface-muted/80 hover:bg-emerald-500/15 border border-dashed border-emerald-500/40 text-emerald-300'
            }`}
            title={hasTp ? 'Click to modify Take Profit' : 'Click to add Take Profit'}
          >
            {hasTp ? (
              <>
                <span className="text-terminal-micro uppercase font-semibold text-emerald-300">TP</span>
                <span className="font-semibold terminal-num">{fmtPrice(tpPx, digits)}</span>
                <span className="text-terminal-micro opacity-75 hidden sm:inline">
                  (+{tpPips.toFixed(1)}p · +{fmtUSD(tpReward)})
                </span>
                <Pencil className="h-2.5 w-2.5 ml-0.5 opacity-70" />
              </>
            ) : (
              <>
                <Plus className="h-2.5 w-2.5" />
                <span className="text-terminal-micro font-semibold">Add TP</span>
              </>
            )}
          </button>

          {/* 1-Click Break-Even Action */}
          <button
            type="button"
            onClick={() => handleBreakEven(pos)}
            disabled={!canBE}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-terminal-micro font-semibold border transition-all cursor-pointer ${
              canBE
                ? 'bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border-sky-500/40 shadow-sm'
                : 'bg-surface-muted/40 text-text-faint border-border-subtle opacity-40 cursor-not-allowed'
            }`}
            title={canBE ? 'Lock in profit with 1-click Break-Even (Zero Risk)' : 'Position must be in profit to set Break-Even'}
          >
            <Lock className="h-2.5 w-2.5" />
            <span>BE</span>
          </button>

          {/* 1-Click Close Position Action */}
          <button
            type="button"
            onClick={() => handleClose(pos)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-danger/15 hover:bg-danger text-rose-300 hover:text-white border border-danger/30 text-terminal-micro font-semibold transition-all shadow-sm cursor-pointer"
            title="Close Position at Market"
          >
            <X className="h-2.5 w-2.5" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* ── Inline Quick SL/TP Modifier ── */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-1.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* SL Input & Quick Offsets */}
              <div className="flex items-center gap-1.5 relative group">
                <span className="text-terminal-micro font-semibold text-rose-400 uppercase">SL:</span>
                <input
                  type="text"
                  value={draftSl}
                  onChange={(e) => setDraftSl(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder={openPx.toFixed(digits)}
                  title={draftSlMetrics ? `Calculated Loss: -${fmtUSD(draftSlMetrics.loss)} (-${draftSlMetrics.pips.toFixed(1)}p)` : undefined}
                  className={cn(
                    "w-20 h-6 px-1.5 text-terminal-body terminal-num font-semibold bg-bg border rounded text-right focus-ring transition-colors",
                    draftSlMetrics ? "border-rose-500/50 text-rose-300 focus:border-rose-500" : "border-border text-foreground"
                  )}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyPipOffset(pos, 'sl', 20)}
                    className="px-1.5 py-0.5 rounded text-terminal-micro bg-surface-muted hover:bg-surface-muted/80 text-text-muted cursor-pointer"
                  >
                    20p
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPipOffset(pos, 'sl', 35)}
                    className="px-1.5 py-0.5 rounded text-terminal-micro bg-surface-muted hover:bg-surface-muted/80 text-text-muted cursor-pointer"
                  >
                    35p
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftSl(openPx.toFixed(digits))}
                    className="px-1.5 py-0.5 rounded text-terminal-micro bg-sky-500/20 text-sky-300 font-semibold cursor-pointer"
                    title="Set to Break-Even"
                  >
                    BE
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftSl('')}
                    className="px-1 py-0.5 rounded text-terminal-micro text-text-faint hover:text-danger cursor-pointer inline-flex items-center justify-center"
                    title="Clear Stop Loss"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>

              {/* TP Input & Quick Offsets */}
              <div className="flex items-center gap-1.5 relative group">
                <span className="text-terminal-micro font-semibold text-emerald-400 uppercase">TP:</span>
                <input
                  type="text"
                  value={draftTp}
                  onChange={(e) => setDraftTp(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder={(openPx * 1.01).toFixed(digits)}
                  title={draftTpMetrics ? `Calculated Profit: +${fmtUSD(draftTpMetrics.profit)} (+${draftTpMetrics.pips.toFixed(1)}p)` : undefined}
                  className={cn(
                    "w-20 h-6 px-1.5 text-terminal-body terminal-num font-semibold bg-bg border rounded text-right focus-ring transition-colors",
                    draftTpMetrics ? "border-emerald-500/50 text-emerald-300 focus:border-emerald-500" : "border-border text-foreground"
                  )}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyPipOffset(pos, 'tp', 30)}
                    className="px-1.5 py-0.5 rounded text-terminal-micro bg-surface-muted hover:bg-surface-muted/80 text-text-muted cursor-pointer"
                  >
                    30p
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPipOffset(pos, 'tp', 60)}
                    className="px-1.5 py-0.5 rounded text-terminal-micro bg-surface-muted hover:bg-surface-muted/80 text-text-muted cursor-pointer"
                  >
                    60p
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPipOffset(pos, 'tp', 100)}
                    className="px-1.5 py-0.5 rounded text-terminal-micro bg-surface-muted hover:bg-surface-muted/80 text-text-muted cursor-pointer"
                  >
                    100p
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftTp('')}
                    className="px-1 py-0.5 rounded text-terminal-micro text-text-faint hover:text-danger cursor-pointer inline-flex items-center justify-center"
                    title="Clear Take Profit"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Live Calculated Loss / Profit Strip */}
            {(draftSlMetrics || draftTpMetrics) && (
              <div className="w-full flex items-center gap-2 pt-1 border-t border-border-subtle/40 text-terminal-micro terminal-num">
                {draftSlMetrics && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                    Est. Loss: -{fmtUSD(draftSlMetrics.loss)} (-{draftSlMetrics.pips.toFixed(1)}p)
                  </span>
                )}
                {draftTpMetrics && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Est. Profit: +{fmtUSD(draftTpMetrics.profit)} (+{draftTpMetrics.pips.toFixed(1)}p)
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2 py-0.5 rounded text-terminal-body text-text-muted hover:text-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(pos)}
                disabled={isSaving}
                className="px-2.5 py-0.5 rounded bg-accent text-accent-contrast font-semibold text-terminal-body shadow-sm hover:bg-accent-hover transition-colors flex items-center gap-1 cursor-pointer"
              >
                {isSaving ? (
                  <span className="h-2.5 w-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pending Orders (If any exist on active symbol) ── */}
      {pendingOrders.map((ord) => {
        const targetPx = toNum(ord.target_price)
        const slPx = toNum(ord.sl)
        const tpPx = toNum(ord.tp)
        const lots = toNum(ord.lot_size)

        return (
          <div
            key={ord.id}
            className="flex items-center justify-between gap-2 rounded bg-surface-muted/40 border border-border-subtle px-2 py-0.5 text-terminal-body terminal-num"
          >
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.2 rounded text-terminal-micro font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {ord.type.toUpperCase()} <span className="terminal-num">{fmtLots(lots)}</span>
              </span>
              <span className="text-text-muted">
                #{ord.id} @ <span className="text-text font-semibold terminal-num">{fmtPrice(targetPx, digits)}</span>
              </span>
              {slPx > 0 && <span className="text-rose-400">SL: {fmtPrice(slPx, digits)}</span>}
              {tpPx > 0 && <span className="text-emerald-400">TP: {fmtPrice(tpPx, digits)}</span>}
            </div>
            <button
              type="button"
              onClick={() => handleCancelPending(ord.id)}
              className="px-1.5 py-0.5 rounded text-terminal-micro font-semibold bg-danger/15 hover:bg-danger text-rose-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <X className="h-2.5 w-2.5" /> Cancel
            </button>
          </div>
        )
      })}
    </div>
  )
})
