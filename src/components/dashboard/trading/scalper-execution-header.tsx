'use client'

import React, { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Plus, Minus, GripVertical } from 'lucide-react'
import { fmtPrice } from '@/lib/format'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { toast } from 'sonner'
import {
  playOrderOpenClickSound,
  playOrderSuccessSound,
  playOrderLossThumpSound,
} from '@/lib/sound-effects'
import { usePrices, nextOptimisticId } from '@/store/prices'
import { isMarketOpen } from '@/lib/symbol-meta'
import { SoundToggle } from './sound-toggle'
import { cn } from '@/lib/cn'

interface ScalperExecutionHeaderProps {
  symbol: string
  bid: number
  ask: number
  digits: number
  pipSize: number
  isSlRequired?: boolean
  compact?: boolean
  onChanged?: () => void
  className?: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export const ScalperExecutionHeader = memo(function ScalperExecutionHeader({
  symbol,
  bid,
  ask,
  digits,
  pipSize,
  isSlRequired = false,
  compact = false,
  onChanged,
  className,
  dragHandleProps,
}: ScalperExecutionHeaderProps) {
  const [lot, setLot] = useState('1.00')
  const [slPips, setSlPips] = useState('30')
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null)
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen(symbol))

  useEffect(() => {
    setMarketOpen(isMarketOpen(symbol))
    const interval = setInterval(() => {
      setMarketOpen(isMarketOpen(symbol))
    }, 5000)
    return () => clearInterval(interval)
  }, [symbol])

  // Live spread calculation in pips
  const spreadPips = useMemo(() => {
    if (!bid || !ask || !pipSize || pipSize <= 0) return 0
    return Math.max(0, (ask - bid) / pipSize)
  }, [bid, ask, pipSize])

  const adjustLot = (delta: number) => {
    const curr = parseFloat(lot) || 0.1
    const next = Math.max(0.01, Math.min(100, parseFloat((curr + delta).toFixed(2))))
    setLot(next.toFixed(2))
  }

  const handleLotBlur = () => {
    const val = parseFloat(lot)
    if (isNaN(val) || val < 0.01) {
      setLot('0.01')
    } else if (val > 100) {
      setLot('100.00')
    } else {
      setLot(val.toFixed(2))
    }
  }

  const handleExecute = useCallback(
    async (side: 'buy' | 'sell') => {
      if (!isMarketOpen(symbol)) {
        toast.error('Market Closed (Reopens Sun 22:00 UTC)')
        playOrderLossThumpSound()
        return
      }

      const lotNum = parseFloat(lot)
      if (isNaN(lotNum) || lotNum <= 0) {
        toast.error('Invalid lot size entered')
        playOrderLossThumpSound()
        return
      }

      if (lotNum < 0.01) {
        toast.error('Minimum allowed lot size is 0.01')
        playOrderLossThumpSound()
        return
      }

      if (lotNum > 100) {
        toast.error('Maximum allowed lot size is 100.00')
        playOrderLossThumpSound()
        return
      }

      const slPipsNum = parseFloat(slPips)
      let calculatedSl: number | undefined = undefined

      if (isSlRequired) {
        if (isNaN(slPipsNum) || slPipsNum <= 0) {
          toast.error('Mandatory Stop Loss required by plan (enter pips)')
          playOrderLossThumpSound()
          return
        }
        const refPrice = side === 'buy' ? ask : bid
        calculatedSl =
          side === 'buy'
            ? parseFloat((refPrice - slPipsNum * pipSize).toFixed(digits))
            : parseFloat((refPrice + slPipsNum * pipSize).toFixed(digits))
      }

      setBusy(side)
      playOrderOpenClickSound()

      const optId = nextOptimisticId()
      const execPrice = side === 'buy' ? ask : bid

      const tCtx = usePrices.getState().tradingContext
      const currentAcc = usePrices.getState().account
      const activeAccId = tCtx?.kind === 'challenge' ? tCtx.accountId : (currentAcc && 'id' in currentAcc ? (currentAcc as any).id : 0)

      // Optimistic position addition with Rule 95 quarantine flag
      usePrices.getState().addOptimisticPosition({
        id: optId,
        account_id: activeAccId,
        margin: 0,
        symbol,
        type: side,
        lot_size: lotNum,
        open_price: execPrice,
        current_price: execPrice,
        sl: calculatedSl ?? null,
        tp: null,
        pnl: 0,
        commission: 0,
        swap: 0,
        opened_at: new Date().toISOString(),
        isOptimistic: true,
      })

      try {
        const tCtx = usePrices.getState().tradingContext
        const ctxParams = tCtx
          ? tCtx.kind === 'tournament'
            ? { tournament_id: tCtx.tournamentId }
            : tCtx.accountId ? { account_id: tCtx.accountId } : {}
          : {}

        const res = await api.open({
          symbol,
          type: side,
          lot_size: lotNum,
          sl: calculatedSl ?? null,
          tp: null,
          ...ctxParams,
        })
        if (res.ok && res.data.success) {
          playOrderSuccessSound()
          toast.success(
            `Executed ${side.toUpperCase()} ${lotNum} ${symbol} @ ${fmtPrice(execPrice, digits)}`
          )
          usePrices.getState().removeOptimisticPosition(optId)
          invalidateFxsim('/positions')
          invalidateFxsim('/account')
          onChanged?.()
        } else {
          usePrices.getState().removeOptimisticPosition(optId)
          playOrderLossThumpSound()
          const errMsg = res.ok
            ? (res.data?.message || 'Execution rejected by risk manager')
            : (res.error || 'Network error during execution')
          toast.error(errMsg)
        }
      } catch (err: any) {
        usePrices.getState().removeOptimisticPosition(optId)
        playOrderLossThumpSound()
        toast.error(err?.message || 'Network execution error')
      } finally {
        setBusy(null)
      }
    },
    [lot, slPips, isSlRequired, symbol, ask, bid, pipSize, digits, onChanged]
  )

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 py-1.5 bg-surface/95 dark:bg-bg-subtle/95 backdrop-blur-md border border-border rounded-xl shadow-lg select-none text-terminal-body transition-all",
        className
      )}
    >
      {/* Tactile Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-text-muted hover:text-text hover:bg-surface-muted/60 rounded flex items-center justify-center transition-colors touch-none shrink-0"
          title="Drag to reposition anywhere on chart"
          aria-label="Drag to reposition 1-Click execution"
        >
          <GripVertical className="w-4 h-4 text-text-muted hover:text-text" />
        </div>
      )}

      {/* Quick Sell Button */}
      <button
        type="button"
        onClick={() => handleExecute('sell')}
        disabled={busy !== null || !bid || !marketOpen}
        title={!marketOpen ? 'Market Closed (Reopens Sun 22:00 UTC)' : undefined}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 h-8 sm:h-9 bg-danger hover:bg-danger-hover text-white font-semibold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          compact ? "min-w-[70px] text-terminal-micro" : "min-w-[85px] sm:min-w-[95px] text-terminal-body"
        )}
      >
        {busy === 'sell' ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            <span className="uppercase tracking-wider font-semibold text-terminal-micro">Submitting</span>
          </span>
        ) : (
          <>
            <span className="uppercase tracking-wider">Sell</span>
            <span className="terminal-num tabular-nums font-semibold">
              {bid ? fmtPrice(bid, digits) : '—'}
            </span>
          </>
        )}
      </button>

      {/* Spread & Stepper Center Pill */}
      <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2">
        {/* Spread Badge / Market Closed State */}
        {!marketOpen ? (
          <div className="flex items-center px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-terminal-micro font-semibold whitespace-nowrap">
            Market Closed
          </div>
        ) : (
          <div className="hidden xs:flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-surface-muted border border-border/80">
            <span className="text-terminal-micro uppercase tracking-tighter text-text-muted font-semibold">
              Spread
            </span>
            <span className="text-terminal-micro font-semibold text-accent terminal-num tabular-nums">
              {spreadPips.toFixed(1)}
            </span>
          </div>
        )}

        {/* Lot Stepper & Custom Input Controls */}
        <div className="flex items-center border border-border bg-surface rounded-lg overflow-hidden h-8 sm:h-9">
          <button
            type="button"
            onClick={() => adjustLot(-0.1)}
            disabled={busy !== null}
            className="px-1.5 sm:px-2 h-full text-text-muted hover:text-text hover:bg-surface-muted active:bg-surface-strong transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
            title="-0.1 Lot"
          >
            <Minus className="w-3 h-3" />
          </button>

          <input
            type="text"
            value={lot}
            disabled={busy !== null}
            onChange={(e) => setLot(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={handleLotBlur}
            className="w-12 sm:w-14 text-center bg-transparent border-none outline-none font-semibold text-terminal-body text-text terminal-num tabular-nums"
            title="Type custom lot size (0.01 - 100.00)"
            placeholder="1.00"
          />

          <button
            type="button"
            onClick={() => adjustLot(0.1)}
            disabled={busy !== null}
            className="px-1.5 sm:px-2 h-full text-text-muted hover:text-text hover:bg-surface-muted active:bg-surface-strong transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
            title="+0.1 Lot"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Quick Stepper Pills (Desktop) */}
        {!compact && (
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLot('0.10')}
              disabled={busy !== null}
              className="px-1.5 py-0.5 rounded text-terminal-micro font-semibold bg-surface-muted hover:bg-surface border border-border text-text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-40 terminal-num tabular-nums"
            >
              0.1
            </button>
            <button
              type="button"
              onClick={() => setLot('0.50')}
              disabled={busy !== null}
              className="px-1.5 py-0.5 rounded text-terminal-micro font-semibold bg-surface-muted hover:bg-surface border border-border text-text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-40 terminal-num tabular-nums"
            >
              0.5
            </button>
            <button
              type="button"
              onClick={() => setLot('1.00')}
              disabled={busy !== null}
              className="px-1.5 py-0.5 rounded text-terminal-micro font-semibold bg-surface-muted hover:bg-surface border border-border text-text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-40 terminal-num tabular-nums"
            >
              1.0
            </button>
          </div>
        )}

        {/* Stop Loss Input if required by plan */}
        {isSlRequired && (
          <div className="flex items-center gap-1 border-l border-border pl-1.5">
            <div className="flex flex-col items-center">
              <input
                type="text"
                value={slPips}
                disabled={busy !== null}
                onChange={(e) => setSlPips(e.target.value.replace(/[^\d.]/g, ''))}
                className="w-10 sm:w-11 h-8 sm:h-9 text-center bg-surface border border-rose-500/50 rounded-lg font-semibold text-terminal-body text-rose-600 dark:text-rose-400 terminal-num tabular-nums"
                placeholder="30"
                title="Stop Loss (Pips)"
              />
              <span className="text-terminal-micro uppercase font-semibold text-rose-600 dark:text-rose-400 tracking-tighter">
                SL Pip
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Buy Button */}
      <button
        type="button"
        onClick={() => handleExecute('buy')}
        disabled={busy !== null || !ask || !marketOpen}
        title={!marketOpen ? 'Market Closed (Reopens Sun 22:00 UTC)' : undefined}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 h-8 sm:h-9 bg-success hover:bg-success-hover text-white font-semibold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          compact ? "min-w-[70px] text-terminal-micro" : "min-w-[85px] sm:min-w-[95px] text-terminal-body"
        )}
      >
        {busy === 'buy' ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            <span className="uppercase tracking-wider font-semibold text-terminal-micro">Submitting</span>
          </span>
        ) : (
          <>
            <span className="uppercase tracking-wider">Buy</span>
            <span className="terminal-num tabular-nums font-semibold">
              {ask ? fmtPrice(ask, digits) : '—'}
            </span>
          </>
        )}
      </button>

      {/* Audio Sound Toggle */}
      <SoundToggle compact={true} className="shrink-0" />
    </div>
  )
})
