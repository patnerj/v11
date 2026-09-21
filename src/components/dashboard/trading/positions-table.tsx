'use client'

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Pencil, X, Check, ChevronDown, Trash2, Share2 } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { fmtPrice, fmtUSD, fmtLots, toNum, timeAgo, pnlClass } from '@/lib/format'
import { symbolDigits } from '@/lib/symbol-meta'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { Position } from '@/types/api'
import { playOrderCloseSound } from '@/lib/sound'
import { SocialProfitShareModal, type ShareTradeData } from '@/components/dashboard/trading/social-profit-share-modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

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

  const totalPnL = useMemo(() => {
    if (!positions) return 0
    return positions.reduce((acc, p) => acc + toNum(p.pnl) + toNum(p.swap) - toNum(p.commission), 0)
  }, [positions])

  const handleCloseAll = useCallback(async () => {
    if (!positions || positions.length === 0 || isClosingAll) return
    setIsClosingAll(true)
    const toastId = toast.loading(`Closing ${positions.length} position(s)...`)
    try {
      const accId = positions[0]?.account_id
      const batchRes = await api.closeAll(accId ? { account_id: accId } : undefined)
      if (batchRes.ok && batchRes.data.success) {
        playOrderCloseSound()
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
    } catch (err: any) {
      toast.error(err?.message || 'Emergency close failed', { id: toastId })
    } finally {
      setIsClosingAll(false)
      setIsCloseAllConfirmOpen(false)
    }
  }, [positions, isClosingAll, onChanged])

  if (positions === null) {
    return <SkeletonRows />
  }
  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-sm text-text-muted">No open positions</div>
        <div className="text-2xs text-text-faint mt-1">
          Use the order ticket to open a trade.
        </div>
      </div>
    )
  }
  return (
    <>
      {/* Panic Bar / Summary Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle bg-bg-subtle/30 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text text-2xs uppercase tracking-wider">Open Positions</span>
          <span className="px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-surface-muted text-text-muted border border-border-subtle">
            {positions.length}
          </span>
          <span className="text-text-faint">·</span>
          <span className="text-2xs text-text-muted">Net P&L:</span>
          <span className={cn("text-2xs font-semibold tabular", pnlClass(totalPnL))}>
            {fmtUSD(totalPnL, { sign: true })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCloseAllConfirmOpen(true)}
          disabled={isClosingAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
          title="Emergency Close All open positions at live market price"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
          <span>{isClosingAll ? 'Closing All...' : `Close All (${positions.length})`}</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
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

function PositionRow({ pos, index, onChanged, compact, onShare }: {
  pos: Position; index: number; onChanged?: () => void; compact?: boolean; onShare?: (trade: ShareTradeData) => void
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
  const isMt5Synced = Boolean(pos.order_id && Number(pos.order_id) > 100000)

  const currentPx = isMt5Synced && toNum(pos.current_price) > 0
    ? toNum(pos.current_price)
    : pos.type === 'buy'
      ? (toNum(tick?.bid) || toNum(pos.current_price))
      : (toNum(tick?.ask) || toNum(pos.current_price))

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
      return calcPnl + toNum(pos.swap) - toNum(pos.commission)
    }
    return toNum(pos.pnl) + toNum(pos.swap) - toNum(pos.commission)
  }, [isMt5Synced, pos.pnl, tick, currentPx, pos.open_price, pos.type, meta?.contract_size, pos.lot_size, pos.swap, pos.commission])

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
          <span className="font-medium tabular">{pos.symbol}</span>
        </Td>
        <Td>
          <Badge tone={pos.type === 'buy' ? 'success' : 'danger'}>{pos.type.toUpperCase()}</Badge>
        </Td>
        <Td align="right" hideOn={compact ? 'sm' : undefined}>
          <span className="tabular text-text-muted">{fmtLots(pos.lot_size)}</span>
        </Td>
        <Td align="right" hideOn="md">
          <span className="tabular text-text-muted">{fmtPrice(pos.open_price, digits)}</span>
        </Td>
        <Td align="right" hideOn="sm">
          <span className="tabular">{fmtPrice(currentPx, digits)}</span>
        </Td>
        <Td align="right" hideOn="md">
          {editSltp ? (
            <div className="flex items-center gap-1 justify-end">
              <input
                value={slDraft}
                onChange={(e) => setSlDraft(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="SL"
                inputMode="decimal"
                className="w-16 h-7 px-1.5 text-2xs tabular bg-surface border border-border rounded focus-ring text-right"
              />
              <input
                value={tpDraft}
                onChange={(e) => setTpDraft(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="TP"
                inputMode="decimal"
                className="w-16 h-7 px-1.5 text-2xs tabular bg-surface border border-border rounded focus-ring text-right"
              />
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
              className="text-2xs tabular text-text-muted hover:text-text inline-flex items-center gap-1.5 group"
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
          <span className="text-2xs text-text-muted whitespace-nowrap">{timeAgo(pos.opened_at_iso || pos.opened_at)}</span>
        </Td>
        <Td align="right">
          <div className="flex justify-end items-center gap-1">
            <button
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
              title="Flex Trade / Share Profit Card"
              className={cn(
                "h-7 px-2 inline-flex items-center gap-1 rounded text-2xs font-medium transition-colors focus-ring",
                pnl > 0
                  ? "text-accent hover:bg-accent/10 border border-accent/30"
                  : "text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle"
              )}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Flex</span>
            </button>
            <button
              onClick={() => setShowPartial((v) => !v)}
              disabled={busy || !canPartial}
              title={!canPartial ? 'Micro-lot minimum (0.01) cannot be split' : 'Partial close (½)'}
              className={cn(
                "h-7 px-2 rounded text-2xs font-medium focus-ring",
                !canPartial
                  ? "text-text-muted/40 cursor-not-allowed opacity-50"
                  : "text-text-muted hover:text-text hover:bg-surface-muted"
              )}
            >
              ½
            </button>
            <button
              onClick={() => { if (countdown !== null) closePos(); else armClose() }}
              disabled={busy}
              title={countdown !== null ? `Click again to confirm close (${countdown}s)` : 'Close position'}
              className="h-7 px-2 inline-flex items-center justify-center gap-1 rounded text-danger hover:bg-danger-muted focus-ring disabled:opacity-50"
              aria-label={countdown !== null ? `Confirm close position ${pos.symbol} within ${countdown} seconds` : `Close position ${pos.symbol}`}
            >
              {busy ? (
                <span className="h-3 w-3 rounded-full border-2 border-danger/40 border-t-danger animate-spin" />
              ) : countdown !== null ? (
                <span className="text-2xs font-bold">{countdown}s</span>
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
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
              <div className="flex flex-wrap items-center gap-2 text-2xs">
                <span className="text-text-muted">Close how many lots? (max {fmtLots(pos.lot_size)})</span>
                <input
                  value={partialLots}
                  onChange={(e) => setPartialLots(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  className="w-20 h-7 px-2 rounded border border-border bg-surface text-2xs tabular text-center focus-ring"
                />
                <button
                  onClick={submitPartial}
                  disabled={busy}
                  className="h-7 px-3 rounded bg-danger text-white text-2xs font-medium hover:bg-danger-hover disabled:opacity-50"
                >
                  {busy ? 'Closing…' : 'Close partial'}
                </button>
                <button onClick={() => setShowPartial(false)} className="h-7 px-2 text-2xs text-text-muted hover:text-text">
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
      'px-3 py-2 text-2xs uppercase tracking-wider text-text-faint font-medium',
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
      'px-3 py-2.5',
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
    <span className={cn('tabular font-medium', pnlClass(value))}>
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
