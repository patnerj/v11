'use client'

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Pencil, X, Check, ChevronDown, Trash2, Share2, MoreHorizontal, ShieldCheck } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { fmtPrice, fmtUSD, fmtLots, toNum, timeAgo, fmtDate, pnlClass } from '@/lib/format'
import { symbolDigits, pipSize } from '@/lib/symbol-meta'
import { quoteToUsdRate, calculateLivePositionPnL } from '@/lib/order-math'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { Position } from '@/types/api'
import { playOrderCloseSound, playOrderProfitChimeSound, playOrderLossThumpSound } from '@/lib/sound'
import { SocialProfitShareModal, type ShareTradeData } from '@/components/dashboard/trading/social-profit-share-modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ClosePositionModal } from '@/components/dashboard/trading/close-position-modal'

interface Props {
  positions: Position[] | null
  /** Called after a successful close/partial/sltp so parent can refresh. */
  onChanged?: () => void
  /** Hide some columns on tiny viewports. */
  compact?: boolean
}

export const PositionsTable = memo(function PositionsTable({ positions, onChanged, compact }: Props) {
  const [shareTrade, setShareTrade] = useState<ShareTradeData | null>(null)
  const [isCloseAllConfirmOpen, setIsCloseAllConfirmOpen] = useState(false)
  const [isClosingAll, setIsClosingAll] = useState(false)

  // Binance-style single position close modal state
  const [closingPosition, setClosingPosition] = useState<Position | null>(null)
  const [isClosingSingle, setIsClosingSingle] = useState(false)

  const handleConfirmSingleClose = useCallback(async () => {
    if (!closingPosition || isClosingSingle) return
    setIsClosingSingle(true)
    try {
      const res = await api.close(closingPosition.id)
      if (res.ok && res.data.success) {
        const closePnl = toNum(res.data.pnl)
        if (closePnl >= 0) {
          playOrderProfitChimeSound()
        } else {
          playOrderLossThumpSound()
        }
        // Optimistic removal from store for instant UI feedback
        usePrices.setState((state) => ({
          positions: (state.positions || []).filter((p) => p.id !== closingPosition.id)
        }))
        const digits = symbolDigits(closingPosition.symbol)
        toast.success(`Closed ${closingPosition.symbol} · ${fmtUSD(closePnl, { sign: true })}`, {
          action: closePnl > 0 ? {
            label: 'Flex Win 🚀',
            onClick: () => setShareTrade({
              symbol: closingPosition.symbol,
              type: closingPosition.type,
              lotSize: closingPosition.lot_size,
              openPrice: fmtPrice(closingPosition.open_price, digits),
              currentPrice: fmtPrice(toNum(closingPosition.current_price) || toNum(closingPosition.open_price), digits),
              pnl: closePnl,
              isClosed: true,
              accountId: closingPosition.account_id ? `ACC-${closingPosition.account_id}` : undefined,
              margin: closingPosition.margin,
            })
          } : undefined
        })
        invalidateFxsim('/positions'); invalidateFxsim('/account'); invalidateFxsim('/history')
        onChanged?.()
        setClosingPosition(null)
      } else {
        toast.error(res.ok ? (res.data.message || 'Close failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Close failed')
    } finally {
      setIsClosingSingle(false)
    }
  }, [closingPosition, isClosingSingle, onChanged])

  const getMeta = useTerminal((s) => s.getMeta)
  const allPrices = usePrices((s) => s.prices)

  const totalPnL = useMemo(() => {
    if (!positions || positions.length === 0) return 0
    return positions.reduce((acc, p) => {
      const isMt5 = Boolean(p.order_id && Number(p.order_id) > 0 && (p as any).source === 'mt5')
      const tick = allPrices[p.symbol]
      const curPx = p.type === 'buy' ? (toNum(tick?.bid) || toNum(p.current_price)) : (toNum(tick?.ask) || toNum(p.current_price))
      const openPx = toNum(p.open_price)
      if (!isMt5 && curPx > 0 && openPx > 0) {
        const meta = getMeta(p.symbol)
        const diff = p.type === 'buy' ? curPx - openPx : openPx - curPx
        const cSize = toNum(meta?.contract_size) || 100000
        const calcPnl = diff * cSize * toNum(p.lot_size) * quoteToUsdRate(p.symbol, curPx, allPrices) + toNum(p.swap) - toNum(p.commission)
        return acc + calcPnl
      }
      return acc + (isMt5 ? toNum(p.pnl) + toNum(p.swap) - toNum(p.commission) : toNum(p.pnl))
    }, 0)
  }, [positions, allPrices, getMeta])

  const handleCloseAll = useCallback(async () => {
    if (!positions || positions.length === 0 || isClosingAll) return
    setIsClosingAll(true)
    const toastId = toast.loading(`Closing ${positions.length} position(s)...`)
    try {
      const accId = positions[0]?.account_id
      const batchRes = await api.closeAll(accId ? { account_id: accId } : undefined)
      if (batchRes.ok && batchRes.data.success) {
        if (totalPnL >= 0) {
          playOrderProfitChimeSound()
        } else {
          playOrderLossThumpSound()
        }
        toast.success(`Closed all ${batchRes.data.closed_count || positions.length} position(s)!`, { id: toastId })
        invalidateFxsim('/positions'); invalidateFxsim('/account'); invalidateFxsim('/history')
        onChanged?.()
      } else {
        const closable = positions.filter((p) => p.id > 0)
        let succeeded = 0
        const failed: { symbol: string; error: string }[] = []
        for (const p of closable) {
          const r = await api.close(p.id)
          if (r.ok && (r.data as any)?.success) {
            succeeded++
          } else {
            failed.push({ symbol: p.symbol, error: !r.ok ? r.error : ((r.data as any)?.message || 'Close failed') })
          }
        }
        invalidateFxsim('/positions'); invalidateFxsim('/account'); invalidateFxsim('/history')
        onChanged?.()
        if (succeeded > 0) playOrderCloseSound()
        if (failed.length === 0) {
          toast.success(`Closed all ${positions.length} position(s)!`, { id: toastId })
        } else if (succeeded === 0) {
          toast.error(`Failed to close positions: ${failed[0]?.symbol || 'Order'} — ${failed[0]?.error || 'Unknown error'}`, { id: toastId })
        } else {
          toast.warning(`Closed ${succeeded} position(s), ${failed.length} failed.`, { id: toastId })
        }
      }
    } finally {
      setIsClosingAll(false)
      setIsCloseAllConfirmOpen(false)
    }
  }, [positions, isClosingAll, onChanged])

  const [isSettingBreakeven, setIsSettingBreakeven] = useState(false)
  const [isPartialClosingAll, setIsPartialClosingAll] = useState(false)

  const handleBreakevenAll = useCallback(async () => {
    if (!positions || positions.length === 0 || isSettingBreakeven) return
    setIsSettingBreakeven(true)
    const toastId = toast.loading('Securing winning positions at breakeven...')
    try {
      let secured = 0
      let skipped = 0
      const errors: string[] = []
      const livePrices = usePrices.getState().prices

      for (const p of positions) {
        if (!p.id || p.id <= 0) continue
        const isBuy = p.type === 'buy'
        const openPrice = toNum(p.open_price)
        const tick = livePrices[p.symbol]
        const currentPrice = isBuy
          ? (toNum(tick?.bid) || toNum(p.current_price))
          : (toNum(tick?.ask) || toNum(p.current_price))
        const sl = p.sl ? toNum(p.sl) : null

        const inProfit = isBuy ? (currentPrice > openPrice) : (currentPrice < openPrice)
        if (!inProfit) {
          skipped++
          continue
        }

        // Already at breakeven or better
        if (sl !== null) {
          if (isBuy && sl >= openPrice) {
            skipped++
            continue
          }
          if (!isBuy && sl <= openPrice) {
            skipped++
            continue
          }
        }

        const res = await api.sltp(p.id, openPrice, p.tp ? toNum(p.tp) : null)
        if (res.ok && res.data.success) {
          secured++
        } else {
          errors.push(`${p.symbol}: ${res.ok ? res.data.message : res.error}`)
        }
      }

      invalidateFxsim('/positions')
      invalidateFxsim('/account')
      await usePrices.getState().refresh()
      onChanged?.()

      if (secured > 0) {
        toast.success(`Secured ${secured} position(s) at Breakeven! ${skipped > 0 ? `(${skipped} in loss/already secured)` : ''}`, { id: toastId })
      } else if (skipped > 0 && errors.length === 0) {
        toast.info(`No winning positions currently eligible to set to breakeven (${skipped} skipped).`, { id: toastId })
      } else if (errors.length > 0) {
        toast.error(`Could not set breakeven: ${errors.join(', ')}`, { id: toastId })
      } else {
        toast.info('No eligible positions found.', { id: toastId })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set breakeven', { id: toastId })
    } finally {
      setIsSettingBreakeven(false)
    }
  }, [positions, isSettingBreakeven, onChanged])

  const handlePartialCloseAll50 = useCallback(async () => {
    if (!positions || positions.length === 0 || isPartialClosingAll) return
    setIsPartialClosingAll(true)
    const toastId = toast.loading('Closing 50% volume across eligible positions...')
    try {
      let closedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      for (const p of positions) {
        if (!p.id || p.id <= 0) continue
        const totalLots = toNum(p.lot_size)
        // Can only partially close if volume is at least 0.02 lots
        if (totalLots < 0.02) {
          skippedCount++
          continue
        }
        const halfLots = Math.round((totalLots / 2) * 100) / 100
        if (halfLots < 0.01) {
          skippedCount++
          continue
        }

        const res = await api.partialClose(p.id, halfLots)
        if (res.ok && res.data.success) {
          closedCount++
        } else {
          errors.push(`${p.symbol}: ${res.ok ? res.data.message : res.error}`)
        }
      }

      invalidateFxsim('/positions')
      invalidateFxsim('/account')
      await usePrices.getState().refresh()
      onChanged?.()

      if (closedCount > 0) {
        playOrderCloseSound()
        toast.success(`Partially closed 50% on ${closedCount} position(s)! ${skippedCount > 0 ? `(${skippedCount} too small to split)` : ''}`, { id: toastId })
      } else if (skippedCount > 0 && errors.length === 0) {
        toast.info(`Positions have volume under 0.02 lots; cannot split 50%.`, { id: toastId })
      } else if (errors.length > 0) {
        toast.error(`Partial close issues: ${errors.join(', ')}`, { id: toastId })
      } else {
        toast.info('No eligible positions found.', { id: toastId })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to partial close 50%', { id: toastId })
    } finally {
      setIsPartialClosingAll(false)
    }
  }, [positions, isPartialClosingAll, onChanged])

  if (positions === null) {
    return <SkeletonRows />
  }
  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-terminal-body text-text-muted">No open positions</div>
        <div className="text-terminal-micro text-text-faint mt-1">
          Use the order ticket to open a trade.
        </div>
      </div>
    )
  }
  return (
    <>
      {/* Rapid Actions Toolbar / Panic Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle bg-bg-subtle/30 text-terminal-label flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text text-terminal-micro uppercase tracking-wider">Open Positions</span>
          <span className="px-1.5 py-0.5 rounded-full text-terminal-micro font-semibold bg-surface-muted text-text-muted border border-border-subtle terminal-num">
            {positions.length}
          </span>
          <span className="text-text-faint">·</span>
          <span className="text-terminal-body text-text-muted">Net P&L:</span>
          <span className={cn("text-terminal-body font-semibold terminal-num", pnlClass(totalPnL))}>
            {fmtUSD(totalPnL, { sign: true })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBreakevenAll}
            disabled={isSettingBreakeven || isClosingAll || isPartialClosingAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-terminal-micro font-semibold bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-40"
            title="Set Stop Loss of all winning positions to entry price (breakeven)"
          >
            <span>🛡️</span>
            <span>{isSettingBreakeven ? 'Securing...' : 'Set All Breakeven'}</span>
          </button>
          <button
            type="button"
            onClick={handlePartialCloseAll50}
            disabled={isSettingBreakeven || isClosingAll || isPartialClosingAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-terminal-micro font-semibold bg-surface-muted hover:bg-surface-strong text-text-muted hover:text-text border border-border transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-40"
            title="Close 50% of position size across all open positions"
          >
            <span>½</span>
            <span>{isPartialClosingAll ? 'Closing 50%...' : 'Partial Close 50%'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCloseAllConfirmOpen(true)}
            disabled={isClosingAll || isSettingBreakeven || isPartialClosingAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-terminal-micro font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            title="Emergency Close All open positions at live market price"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>{isClosingAll ? 'Closing All...' : `Close All (${positions.length})`}</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-terminal-body">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-subtle/40">
              <Th>Symbol</Th>
              <Th>Side</Th>
              <Th align="right" hideOn={compact ? 'sm' : undefined}>Volume</Th>
              <Th align="right" hideOn="md">Open</Th>
              <Th align="right" hideOn="sm">Current</Th>
              <Th align="right" hideOn="md">SL / TP</Th>
              <Th align="right">P&L</Th>
              <Th align="right" hideOn="lg">Opened</Th>
              <Th align="right">{''}</Th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <PositionRow
                key={p.id}
                pos={p}
                index={i}
                onChanged={onChanged}
                compact={compact}
                onShare={setShareTrade}
                onRequestClose={setClosingPosition}
              />
            ))}
          </tbody>
        </table>
      </div>

      <SocialProfitShareModal
        open={Boolean(shareTrade)}
        onClose={() => setShareTrade(null)}
        trade={shareTrade}
      />

      <ClosePositionModal
        open={Boolean(closingPosition)}
        position={closingPosition}
        onClose={() => { if (!isClosingSingle) setClosingPosition(null) }}
        onConfirm={handleConfirmSingleClose}
        loading={isClosingSingle}
      />

      <ConfirmDialog
        isOpen={isCloseAllConfirmOpen}
        onCancel={() => setIsCloseAllConfirmOpen(false)}
        onConfirm={handleCloseAll}
        title="Emergency Close All Positions"
        description={`Are you sure you want to market-close all ${positions.length} active position(s) with net P&L of ${fmtUSD(totalPnL, { sign: true })}? This action executes immediately at current live bid/ask prices and cannot be undone.`}
        confirmText={`Close All (${positions.length}) Positions`}
        isDestructive={true}
        loading={isClosingAll}
      />
    </>
  )
})

function PositionRow({ pos, index, onChanged, compact, onShare, onRequestClose }: {
  pos: Position; index: number; onChanged?: () => void; compact?: boolean; onShare?: (trade: ShareTradeData) => void; onRequestClose?: (pos: Position) => void
}) {
  const getMeta = useTerminal((s) => s.getMeta)
  const meta    = getMeta(pos.symbol)
  const digits  = meta?.digits || symbolDigits(pos.symbol)

  const [editSltp, setEditSltp] = useState(false)
  const [slDraft, setSlDraft]   = useState(pos.sl ? String(toNum(pos.sl)) : '')
  const [tpDraft, setTpDraft]   = useState(pos.tp ? String(toNum(pos.tp)) : '')
  const [busy, setBusy]         = useState(false)

  const [showPartial, setShowPartial] = useState(false)
  const [partialLots, setPartialLots] = useState(() => (toNum(pos.lot_size) / 2).toFixed(2))

  const canPartial = toNum(pos.lot_size) > 0.01

  // Bug E Fix: Synchronize partialLots whenever pos.lot_size changes (e.g. after partial close)
  useEffect(() => {
    setPartialLots((toNum(pos.lot_size) / 2).toFixed(2))
  }, [pos.lot_size])

  useEffect(() => {
    if (!editSltp) {
      setSlDraft(pos.sl ? String(toNum(pos.sl)) : '')
      setTpDraft(pos.tp ? String(toNum(pos.tp)) : '')
    }
  }, [pos.sl, pos.tp, editSltp])

  const slDraftNum = slDraft.trim() ? toNum(slDraft) : null
  const tpDraftNum = tpDraft.trim() ? toNum(tpDraft) : null

  const pSize = pipSize(pos.symbol, digits)
  const contract = toNum(meta?.contract_size) || 100000
  const openPx = toNum(pos.open_price)

  const slDraftMetrics = useMemo(() => {
    if (!slDraftNum || openPx <= 0) return null
    const diff = Math.abs(slDraftNum - openPx)
    if (diff <= 0) return null
    const pips = pSize > 0 ? diff / pSize : diff
    const loss = diff * contract * toNum(pos.lot_size)
    return { diff, pips, loss }
  }, [slDraftNum, openPx, pSize, contract, pos.lot_size])

  const tpDraftMetrics = useMemo(() => {
    if (!tpDraftNum || openPx <= 0) return null
    const diff = Math.abs(tpDraftNum - openPx)
    if (diff <= 0) return null
    const pips = pSize > 0 ? diff / pSize : diff
    const profit = diff * contract * toNum(pos.lot_size)
    return { diff, pips, profit }
  }, [tpDraftNum, openPx, pSize, contract, pos.lot_size])

  // Ref-managed 3s countdown hook for 2-tap close with visual countdown (3s... 2s... 1s)
  // and timeout cleanup on unmount/re-click.
  const [countdown, setCountdown] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const armClose = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(3)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const saveSltp = useCallback(async () => {
    setBusy(true)
    try {
      const sl = slDraft.trim() ? toNum(slDraft) : null
      const tp = tpDraft.trim() ? toNum(tpDraft) : null
      const res = await api.sltp(pos.id, sl, tp)
      if (res.ok && res.data.success) {
        toast.success('SL/TP updated')
        setEditSltp(false)
        invalidateFxsim('/positions')
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Update failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }, [pos.id, slDraft, tpDraft, onChanged])

  // Live price tick subscription & real-time PnL calculation
  const tick = usePrices((s) => s.prices[pos.symbol])
  const allPrices = usePrices((s) => s.prices)
  const isMt5Synced = Boolean(pos.order_id && Number(pos.order_id) > 0 && (pos as any).source === 'mt5')

  const currentPx = isMt5Synced && toNum(pos.current_price) > 0
    ? toNum(pos.current_price)
    : pos.type === 'buy'
      ? (toNum(tick?.bid) || toNum(pos.current_price))
      : (toNum(tick?.ask) || toNum(pos.current_price))

  const handleRowBreakeven = useCallback(async () => {
    const isBuy = pos.type === 'buy'
    const openPrice = toNum(pos.open_price)
    const inProfit = isBuy ? (currentPx > openPrice) : (currentPx < openPrice)
    if (!inProfit) {
      toast.warning(`${pos.symbol} is not in profit. Stop Loss cannot be moved to entry price.`)
      return
    }
    const sl = pos.sl ? toNum(pos.sl) : null
    if (sl !== null) {
      if ((isBuy && sl >= openPrice) || (!isBuy && sl <= openPrice)) {
        toast.info(`${pos.symbol} Stop Loss is already at or better than breakeven (${sl}).`)
        return
      }
    }
    const toastId = toast.loading(`Securing ${pos.symbol} Stop Loss at Breakeven...`)
    try {
      const res = await api.sltp(pos.id, openPrice, pos.tp ? toNum(pos.tp) : null)
      if (res.ok && res.data.success) {
        invalidateFxsim('/positions')
        invalidateFxsim('/account')
        await usePrices.getState().refresh()
        onChanged?.()
        toast.success(`Secured ${pos.symbol} SL at Breakeven (${openPrice})!`, { id: toastId })
      } else {
        toast.error(res.ok ? (res.data.message || 'Breakeven failed') : res.error, { id: toastId })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set breakeven', { id: toastId })
    }
  }, [pos, currentPx, onChanged])

  const closePos = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setBusy(true)
    setCountdown(null)
    try {
      const res = await api.close(pos.id)
      if (res.ok && res.data.success) {
        playOrderCloseSound()
        const closePnl = toNum(res.data.pnl)
        // Optimistic removal from store for instant UI feedback
        usePrices.setState((state) => ({
          positions: (state.positions || []).filter((p) => p.id !== pos.id)
        }))
        toast.success(`Closed ${pos.symbol} · ${fmtUSD(closePnl, { sign: true })}`, {
          action: closePnl > 0 ? {
            label: 'Flex Win 🚀',
            onClick: () => onShare?.({
              symbol: pos.symbol,
              type: pos.type,
              lotSize: pos.lot_size,
              openPrice: fmtPrice(pos.open_price, digits),
              currentPrice: fmtPrice(currentPx, digits),
              pnl: closePnl,
              isClosed: true,
              accountId: pos.account_id ? `ACC-${pos.account_id}` : undefined,
              margin: pos.margin,
            })
          } : undefined
        })
        invalidateFxsim('/positions'); invalidateFxsim('/account'); invalidateFxsim('/history')
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Close failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Close failed')
    } finally {
      setBusy(false)
    }
  }, [pos.id, pos.symbol, pos.type, pos.lot_size, pos.open_price, pos.account_id, pos.margin, currentPx, digits, onChanged, onShare])

  const submitPartial = useCallback(async () => {
    const n = toNum(partialLots)
    const totalLots = toNum(pos.lot_size)
    if (!n || n >= totalLots) {
      toast.error('Enter a smaller lot size'); return
    }
    if (n < 0.01) {
      toast.error('Minimum partial close size is 0.01 lots'); return
    }
    setBusy(true)
    try {
      const res = await api.partialClose(pos.id, n)
      if (res.ok && res.data.success) {
        playOrderCloseSound()
        toast.success(`Closed ${n} of ${pos.symbol}`)
        setShowPartial(false)
        // Optimistically update positions in usePrices store so lot size reflects immediately
        usePrices.setState((state) => {
          const curPositions = state.positions || []
          const remaining = Math.max(0, Math.round((totalLots - n) * 100) / 100)
          if (remaining <= 0.001) {
            return { positions: curPositions.filter((p) => p.id !== pos.id) }
          }
          return {
            positions: curPositions.map((p) =>
              p.id === pos.id ? { ...p, lot_size: remaining } : p
            )
          }
        })
        invalidateFxsim('/positions'); invalidateFxsim('/account'); invalidateFxsim('/history')
        onChanged?.()
      } else {
        toast.error(res.ok ? (res.data.message || 'Partial close failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Partial close failed')
    } finally {
      setBusy(false)
    }
  }, [pos.id, pos.lot_size, pos.symbol, partialLots, onChanged])

  const pnl = useMemo(() => {
    if (isMt5Synced) {
      return toNum(pos.pnl) + toNum(pos.swap) - toNum(pos.commission)
    }
    if (tick && currentPx > 0 && toNum(pos.open_price) > 0) {
      const openPx = toNum(pos.open_price)
      const diff = pos.type === 'buy' ? currentPx - openPx : openPx - currentPx
      const contractSize = toNum(meta?.contract_size) || 100000
      const calcPnl = diff * contractSize * toNum(pos.lot_size)
      return calcPnl * quoteToUsdRate(pos.symbol, currentPx, allPrices) + toNum(pos.swap) - toNum(pos.commission)
    }
    return toNum(pos.pnl)
  }, [isMt5Synced, pos.pnl, tick, currentPx, pos.open_price, pos.type, meta?.contract_size, pos.lot_size, pos.swap, pos.commission, pos.symbol, allPrices])

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: pos.isOptimistic ? 0.6 : 1 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
        className={cn(
          "border-b border-border-subtle/40 last:border-0 hover:bg-surface-muted/30 transition-colors",
          pos.isOptimistic && "animate-pulse pointer-events-none"
        )}
      >
        <Td>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold terminal-num">{pos.symbol}</span>
            {pos.isOptimistic && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                In-Flight
              </span>
            )}
          </div>
        </Td>
        <Td>
          <Badge tone={pos.type === 'buy' ? 'success' : 'danger'}>{pos.type.toUpperCase()}</Badge>
        </Td>
        <Td align="right" hideOn={compact ? 'sm' : undefined}>
          <span className="terminal-num text-text-muted">{fmtLots(pos.lot_size)}</span>
        </Td>
        <Td align="right" hideOn="md">
          <span className="terminal-num text-text-muted">{fmtPrice(pos.open_price, digits)}</span>
        </Td>
        <Td align="right" hideOn="sm">
          <span className="terminal-num">{fmtPrice(currentPx, digits)}</span>
        </Td>
        <Td align="right" hideOn="md">
          {editSltp ? (
            <div className="flex items-center gap-1 justify-end relative">
              <div className="relative group">
                <input
                  value={slDraft}
                  onChange={(e) => setSlDraft(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="SL"
                  inputMode="decimal"
                  title={slDraftMetrics ? `Calculated Loss: -${fmtUSD(slDraftMetrics.loss)} (-${slDraftMetrics.pips.toFixed(1)}p)` : undefined}
                  className={cn(
                    "w-16 h-7 px-1.5 text-terminal-body terminal-num bg-surface border rounded focus-ring text-right transition-colors",
                    slDraftMetrics ? "border-rose-500/50 text-rose-600 dark:text-rose-300 focus:border-rose-500" : "border-border text-foreground"
                  )}
                />
              </div>
              <div className="relative group">
                <input
                  value={tpDraft}
                  onChange={(e) => setTpDraft(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="TP"
                  inputMode="decimal"
                  title={tpDraftMetrics ? `Calculated Profit: +${fmtUSD(tpDraftMetrics.profit)} (+${tpDraftMetrics.pips.toFixed(1)}p)` : undefined}
                  className={cn(
                    "w-16 h-7 px-1.5 text-terminal-body terminal-num bg-surface border rounded focus-ring text-right transition-colors",
                    tpDraftMetrics ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-300 focus:border-emerald-500" : "border-border text-foreground"
                  )}
                />
              </div>
              <button onClick={saveSltp} disabled={busy} className="p-1 rounded text-success hover:bg-success-muted focus-ring">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setEditSltp(false)} disabled={busy} className="p-1 rounded text-text-muted hover:bg-surface-muted focus-ring">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditSltp(true)}
              className="text-terminal-body terminal-num text-text-muted hover:text-text inline-flex items-center gap-1.5 group"
            >
              <span>{pos.sl ? fmtPrice(pos.sl, digits) : '—'}</span>
              <span className="text-text-faint">/</span>
              <span>{pos.tp ? fmtPrice(pos.tp, digits) : '—'}</span>
              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </Td>
        <Td align="right">
          <PnLCell value={pnl} />
        </Td>
        <Td align="right" hideOn="lg">
          <span
            title={pos.opened_at_iso || pos.opened_at ? `${timeAgo(pos.opened_at_iso || pos.opened_at)} · ${fmtDate(pos.opened_at_iso || pos.opened_at, true)}` : undefined}
            className="text-terminal-micro text-text-muted whitespace-nowrap cursor-default terminal-num"
          >
            {pos.opened_at_iso || pos.opened_at ? fmtDate(pos.opened_at_iso || pos.opened_at) : '—'}
          </span>
        </Td>
        <Td align="right">
          <div className="flex justify-end items-center gap-1.5">
            {/* Secondary actions consolidated inside kebab menu (TPOL-4) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="More actions"
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-terminal-body text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle focus-ring transition-colors"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onClick={() => onShare?.({
                    symbol: pos.symbol,
                    type: pos.type,
                    lotSize: pos.lot_size,
                    openPrice: fmtPrice(pos.open_price, digits),
                    currentPrice: fmtPrice(currentPx, digits),
                    pnl: pnl,
                    openedAt: pos.opened_at_iso || pos.opened_at,
                    accountId: pos.account_id ? `ACC-${pos.account_id}` : undefined,
                    margin: pos.margin,
                  })}
                  className="gap-2 text-terminal-body font-normal"
                >
                  <Share2 className="h-3.5 w-3.5 text-accent" />
                  <span>Flex Trade</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy}
                  onClick={handleRowBreakeven}
                  className="gap-2 text-terminal-body font-normal"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Set Breakeven</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy || !canPartial}
                  onClick={() => setShowPartial((v) => !v)}
                  className="gap-2 text-terminal-body font-normal"
                >
                  <span className="font-semibold text-text-muted text-terminal-body">½</span>
                  <span>Partial Close</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Primary Action: Direct Close Button */}
            <button
              onClick={() => {
                if (pos.isOptimistic || pos.id <= 0) return
                if (onRequestClose) {
                  onRequestClose(pos)
                } else if (countdown !== null) {
                  closePos()
                } else {
                  armClose()
                }
              }}
              disabled={busy || pos.isOptimistic || pos.id <= 0}
              title={pos.isOptimistic ? 'Order in-flight...' : countdown !== null ? `Click again to confirm close (${countdown}s)` : 'Close position'}
              className="h-7 px-2.5 inline-flex items-center justify-center gap-1 rounded-md text-terminal-label font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all focus-ring active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              aria-label={countdown !== null ? `Confirm close position ${pos.symbol} within ${countdown} seconds` : `Close position ${pos.symbol}`}
            >
              {busy ? (
                <span className="h-3 w-3 rounded-full border-2 border-rose-400/40 border-t-rose-400 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className={cn(countdown === null && "hidden sm:inline", "text-terminal-micro font-semibold")}>
                    {countdown !== null ? `${countdown}s` : 'Close'}
                  </span>
                </>
              )}
            </button>
          </div>
        </Td>
      </motion.tr>

      {/* Partial close drawer */}
      <AnimatePresence>
        {showPartial && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-b border-border-subtle/40"
          >
            <td colSpan={9} className="bg-bg-subtle/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-terminal-body">
                <span className="text-text-muted">Close how many lots? (max {fmtLots(pos.lot_size)})</span>
                <input
                  value={partialLots}
                  onChange={(e) => setPartialLots(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  className="w-20 h-7 px-2 rounded border border-border bg-surface text-terminal-body terminal-num text-center focus-ring"
                />
                <button
                  onClick={submitPartial}
                  disabled={busy}
                  className="h-7 px-3 rounded bg-danger text-white text-terminal-body font-semibold hover:bg-danger-hover disabled:opacity-50"
                >
                  {busy ? 'Closing…' : 'Close partial'}
                </button>
                <button onClick={() => setShowPartial(false)} className="h-7 px-2 text-terminal-body text-text-muted hover:text-text">
                  Cancel
                </button>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Utility cells ─────────────────────────────────────────────────────

function Th({ children, align, hideOn }: { children: React.ReactNode; align?: 'right'; hideOn?: 'sm' | 'md' | 'lg' }) {
  return (
    <th className={cn(
      'px-3 py-2 text-terminal-micro uppercase tracking-wider text-text-faint font-semibold',
      align === 'right' ? 'text-right' : 'text-left',
      hideOn === 'sm' && 'hidden sm:table-cell',
      hideOn === 'md' && 'hidden md:table-cell',
      hideOn === 'lg' && 'hidden lg:table-cell',
    )}>
      {children}
    </th>
  )
}
function Td({ children, align, hideOn }: { children: React.ReactNode; align?: 'right'; hideOn?: 'sm' | 'md' | 'lg' }) {
  return (
    <td className={cn(
      'px-3 py-2.5 text-terminal-body',
      align === 'right' ? 'text-right' : 'text-left',
      hideOn === 'sm' && 'hidden sm:table-cell',
      hideOn === 'md' && 'hidden md:table-cell',
      hideOn === 'lg' && 'hidden lg:table-cell',
    )}>
      {children}
    </td>
  )
}

function PnLCell({ value }: { value: number }) {
  return (
    <span className={cn('terminal-num font-semibold', pnlClass(value))}>
      {fmtUSD(value, { sign: true })}
    </span>
  )
}

function SkeletonRows() {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skel h-9 w-full" />
      ))}
    </div>
  )
}
