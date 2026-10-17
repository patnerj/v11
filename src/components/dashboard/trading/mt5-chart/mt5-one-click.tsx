'use client'

/**
 * MT5 Pro Chart Engine — Top-Left One-Click Trading Widget (Alt+T)
 * High-speed institutional execution panel with iconic MT5 big-pip typography,
 * lot steppers, quick SL/TP pips, and instant API connectivity.
 */

import React, { memo, useState, useCallback, useMemo } from 'react'
import { ChevronUp, ChevronDown, Plus, Minus, Zap, Shield, Target } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { toast } from 'sonner'
import {
  playOrderOpenClickSound,
  playOrderSuccessSound,
  playOrderLossThumpSound,
} from '@/lib/sound-effects'
import { usePrices, nextOptimisticId } from '@/store/prices'
import { isMarketOpen, getSymbolMeta } from '@/lib/symbol-meta'
import { fmtPrice } from '@/lib/format'
import { cn } from '@/lib/cn'

interface Mt5OneClickProps {
  symbol: string
  bid: number
  ask: number
  digits: number
  pipSize: number
  isSlRequired?: boolean
  onChanged?: () => void
}

/**
 * Parse price into MT5 parts: leading numbers, big pip figures, and trailing pipette
 */
function splitMt5Price(price: number, digits: number): { leading: string; bigPips: string; pipette: string } {
  if (!price || price <= 0) return { leading: '0.', bigPips: '00', pipette: '0' }
  const str = price.toFixed(digits)
  const len = str.length

  if (digits >= 4) {
    // Forex 5 digits e.g. 1.08542
    const leading = str.slice(0, len - 3)
    const bigPips = str.slice(len - 3, len - 1)
    const pipette = str.slice(len - 1)
    return { leading, bigPips, pipette }
  } else if (digits === 3) {
    // JPY 3 digits e.g. 154.238
    const leading = str.slice(0, len - 3)
    const bigPips = str.slice(len - 3, len - 1)
    const pipette = str.slice(len - 1)
    return { leading, bigPips, pipette }
  } else if (digits === 2) {
    // Gold / Crypto e.g. 2735.40
    const leading = str.slice(0, len - 2)
    const bigPips = str.slice(len - 2)
    return { leading, bigPips, pipette: '' }
  }
  return { leading: str, bigPips: '', pipette: '' }
}

export const Mt5OneClick = memo(function Mt5OneClick({
  symbol,
  bid,
  ask,
  digits,
  pipSize,
  isSlRequired = false,
  onChanged,
}: Mt5OneClickProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [lot, setLot] = useState('0.10')
  const [slPips, setSlPips] = useState('')
  const [tpPips, setTpPips] = useState('')
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null)

  const symMeta = useMemo(() => getSymbolMeta(symbol), [symbol])
  const effectivePipSize = symMeta.pipSize || pipSize || 0.0001

  const spreadPips = useMemo(() => {
    if (!bid || !ask || effectivePipSize <= 0) return 0
    return Math.max(0, (ask - bid) / effectivePipSize)
  }, [bid, ask, effectivePipSize])

  const bidParts = useMemo(() => splitMt5Price(bid, digits), [bid, digits])
  const askParts = useMemo(() => splitMt5Price(ask, digits), [ask, digits])

  const adjustLot = (delta: number) => {
    const curr = parseFloat(lot) || 0.1
    const next = Math.max(0.01, Math.min(100, parseFloat((curr + delta).toFixed(2))))
    setLot(next.toFixed(2))
  }

  const handleLotBlur = () => {
    const val = parseFloat(lot)
    if (isNaN(val) || val < 0.01) setLot('0.01')
    else if (val > 100) setLot('100.00')
    else setLot(val.toFixed(2))
  }

  const handleExecute = useCallback(
    async (side: 'buy' | 'sell') => {
      if (!isMarketOpen(symbol)) {
        toast.error('Market is Closed (Reopens Sunday 22:00 UTC)')
        playOrderLossThumpSound()
        return
      }

      const lotNum = parseFloat(lot)
      if (isNaN(lotNum) || lotNum < 0.01) {
        toast.error('Minimum allowed lot size is 0.01')
        playOrderLossThumpSound()
        return
      }

      const refPrice = side === 'buy' ? ask : bid
      let calculatedSl: number | null = null
      let calculatedTp: number | null = null

      const slP = parseFloat(slPips)
      if (!isNaN(slP) && slP > 0) {
        calculatedSl = side === 'buy'
          ? parseFloat((refPrice - slP * pipSize).toFixed(digits))
          : parseFloat((refPrice + slP * pipSize).toFixed(digits))
      } else if (isSlRequired) {
        toast.error('Mandatory Stop Loss required by plan (enter SL pips)')
        playOrderLossThumpSound()
        return
      }

      const tpP = parseFloat(tpPips)
      if (!isNaN(tpP) && tpP > 0) {
        calculatedTp = side === 'buy'
          ? parseFloat((refPrice + tpP * pipSize).toFixed(digits))
          : parseFloat((refPrice - tpP * pipSize).toFixed(digits))
      }

      setBusy(side)
      playOrderOpenClickSound()

      const optId = nextOptimisticId()
      const tCtx = usePrices.getState().tradingContext
      const currentAcc = usePrices.getState().account
      const activeAccId = tCtx?.kind === 'challenge' ? tCtx.accountId : (currentAcc && 'id' in currentAcc ? (currentAcc as any).id : 0)

      usePrices.getState().addOptimisticPosition({
        id: optId,
        account_id: activeAccId,
        margin: 0,
        symbol,
        type: side,
        lot_size: lotNum,
        open_price: refPrice,
        current_price: refPrice,
        sl: calculatedSl,
        tp: calculatedTp,
        pnl: 0,
        commission: 0,
        swap: 0,
        opened_at: new Date().toISOString(),
        isOptimistic: true,
      })

      try {
        const ctxParams = tCtx
          ? tCtx.kind === 'tournament'
            ? { tournament_id: tCtx.tournamentId }
            : tCtx.accountId ? { account_id: tCtx.accountId } : {}
          : {}

        const res = await api.open({
          symbol,
          type: side,
          lot_size: lotNum,
          sl: calculatedSl,
          tp: calculatedTp,
          ...ctxParams,
        })

        if (res.ok && res.data.success) {
          playOrderSuccessSound()
          toast.success(`Executed ${side.toUpperCase()} ${lotNum} ${symbol} @ ${fmtPrice(refPrice, digits)}`)
          usePrices.getState().removeOptimisticPosition(optId)
          invalidateFxsim('/positions')
          invalidateFxsim('/account')
          onChanged?.()
        } else {
          usePrices.getState().removeOptimisticPosition(optId)
          playOrderLossThumpSound()
          const errMsg = res.ok ? (res.data?.message || 'Order rejected by risk engine') : (res.error || 'Network error')
          toast.error(errMsg)
        }
      } catch (err: any) {
        usePrices.getState().removeOptimisticPosition(optId)
        playOrderLossThumpSound()
        toast.error(err?.message || 'Execution error')
      } finally {
        setBusy(null)
      }
    },
    [lot, slPips, tpPips, isSlRequired, symbol, ask, bid, pipSize, digits, onChanged]
  )

  return (
    <div className="absolute top-12 left-16 z-20 flex flex-col bg-surface/95 dark:bg-bg-subtle/95 backdrop-blur-md border border-border rounded-xl shadow-2xl select-none text-terminal-body overflow-hidden min-w-[200px] max-w-[230px] animate-in fade-in zoom-in-95 duration-150">
      {/* Title / Collapse Toggle Header */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-surface-muted/60 border-b border-border-subtle cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-1.5 text-terminal-micro font-semibold text-text">
          <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
          <span>One-Click Trading</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-terminal-micro font-normal text-text-muted">
            Spread: <strong className="text-text terminal-num">{spreadPips.toFixed(1)}</strong>
          </span>
          <button type="button" className="p-0.5 text-text-muted hover:text-text rounded">
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2 flex flex-col gap-1.5">
          {/* Centered Lot Stepper */}
          <div className="flex items-center justify-between bg-bg-subtle border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => adjustLot(-0.1)}
              className="px-1.5 py-0.5 rounded text-terminal-micro font-semibold text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
              title="-0.1 Lot"
            >
              -0.1
            </button>
            <button
              type="button"
              onClick={() => adjustLot(-0.01)}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
              title="-0.01 Lot"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="text"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              onBlur={handleLotBlur}
              className="w-14 text-center text-terminal-label font-bold terminal-num bg-transparent text-text focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => adjustLot(0.01)}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
              title="+0.01 Lot"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => adjustLot(0.1)}
              className="px-1.5 py-0.5 rounded text-terminal-micro font-semibold text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
              title="+0.1 Lot"
            >
              +0.1
            </button>
          </div>

          {/* Quick SL/TP in Pips row */}
          <div className="grid grid-cols-2 gap-1.5 text-terminal-micro">
            <div className="flex items-center gap-1 bg-bg-subtle border border-border rounded px-1.5 py-0.5">
              <Shield className="w-3 h-3 text-rose-500 shrink-0" />
              <input
                type="number"
                placeholder={isSlRequired ? 'SL req' : 'SL pips'}
                value={slPips}
                onChange={(e) => setSlPips(e.target.value)}
                className="w-full bg-transparent text-text font-medium text-terminal-micro focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-1 bg-bg-subtle border border-border rounded px-1.5 py-0.5">
              <Target className="w-3 h-3 text-emerald-500 shrink-0" />
              <input
                type="number"
                placeholder="TP pips"
                value={tpPips}
                onChange={(e) => setTpPips(e.target.value)}
                className="w-full bg-transparent text-text font-medium text-terminal-micro focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dual Action Execution Buttons (SELL / BUY) */}
          <div className="grid grid-cols-2 gap-1.5 mt-0.5">
            {/* SELL Button */}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => handleExecute('sell')}
              className={cn(
                'flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer',
                'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-500 hover:border-rose-500 active:scale-98',
                busy === 'sell' && 'animate-pulse opacity-75'
              )}
            >
              <span className="text-terminal-micro font-extrabold tracking-wider uppercase">SELL</span>
              <div className="flex items-baseline font-bold terminal-num mt-0.5 leading-none">
                <span className="text-terminal-micro opacity-80">{bidParts.leading}</span>
                <span className="text-base text-rose-400 font-black">{bidParts.bigPips}</span>
                <span className="text-terminal-micro opacity-80">{bidParts.pipette}</span>
              </div>
            </button>

            {/* BUY Button */}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => handleExecute('buy')}
              className={cn(
                'flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer',
                'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-500 hover:border-emerald-500 active:scale-98',
                busy === 'buy' && 'animate-pulse opacity-75'
              )}
            >
              <span className="text-terminal-micro font-extrabold tracking-wider uppercase">BUY</span>
              <div className="flex items-baseline font-bold terminal-num mt-0.5 leading-none">
                <span className="text-terminal-micro opacity-80">{askParts.leading}</span>
                <span className="text-base text-emerald-400 font-black">{askParts.bigPips}</span>
                <span className="text-terminal-micro opacity-80">{askParts.pipette}</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
