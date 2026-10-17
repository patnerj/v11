'use client'

/**
 * MT5 Pro Chart Engine — Right-Click Context Trading Menu
 * Institutional order dispatch at exact cursor price coordinate P.
 */

import React, { memo, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Layers,
  Settings,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { toast } from 'sonner'
import { playOrderSuccessSound, playOrderLossThumpSound } from '@/lib/sound-effects'
import { usePrices, nextOptimisticId } from '@/store/prices'
import { isMarketOpen } from '@/lib/symbol-meta'
import { fmtPrice } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  price: number
}

interface ContextMenuProps {
  state: ContextMenuState
  symbol: string
  bid: number
  ask: number
  digits: number
  lotSize?: number
  onClose: () => void
  onAddHorizontalLine: (price: number) => void
  onResetScale: () => void
  onOpenObjectsList: () => void
  onOpenProperties: () => void
  onChanged?: () => void
}

export const Mt5ContextMenu = memo(function Mt5ContextMenu({
  state,
  symbol,
  bid,
  ask,
  digits,
  lotSize = 0.1,
  onClose,
  onAddHorizontalLine,
  onResetScale,
  onOpenObjectsList,
  onOpenProperties,
  onChanged,
}: ContextMenuProps) {
  if (!state.visible) return null

  const p = state.price
  const isAboveAsk = p > ask
  const isBelowBid = p < bid

  const handlePlacePending = async (orderType: 'buy_stop' | 'sell_limit' | 'buy_limit' | 'sell_stop') => {
    onClose()
    if (!isMarketOpen(symbol)) {
      toast.error('Market is closed (Reopens Sunday 22:00 UTC)')
      playOrderLossThumpSound()
      return
    }

    const tCtx = usePrices.getState().tradingContext
    const ctxParams = tCtx
      ? tCtx.kind === 'tournament'
        ? { tournament_id: tCtx.tournamentId }
        : tCtx.accountId ? { account_id: tCtx.accountId } : {}
      : {}

    const side = orderType.startsWith('buy') ? 'buy' : 'sell'
    const optId = nextOptimisticId()

    usePrices.getState().injectOptimisticPending({
      id: optId,
      account_id: 0,
      symbol,
      order_type: orderType,
      type: side,
      lot_size: lotSize,
      target_price: p,
      sl: null,
      tp: null,
      margin: 0,
      status: 'pending',
      expires_at: null,
      reject_reason: null,
      created_at: new Date().toISOString(),
    } as any)

    try {
      const res = await api.pendingPlace({
        symbol,
        order_type: orderType,
        type: side,
        lot_size: lotSize,
        target_price: p,
        sl: null,
        tp: null,
        ...ctxParams,
      })

      if (res.ok && res.data.success) {
        playOrderSuccessSound()
        toast.success(`Placed ${orderType.toUpperCase().replace('_', ' ')} ${lotSize} ${symbol} @ ${fmtPrice(p, digits)}`)
        usePrices.getState().removeOptimisticPending(optId)
        invalidateFxsim('/pending-order/my')
        onChanged?.()
      } else {
        usePrices.getState().removeOptimisticPending(optId)
        playOrderLossThumpSound()
        toast.error(res.ok ? (res.data.message || 'Order rejected') : res.error)
      }
    } catch (err: any) {
      usePrices.getState().removeOptimisticPending(optId)
      playOrderLossThumpSound()
      toast.error(err?.message || 'Failed to place pending order')
    }
  }

  return (
    <div
      className="fixed z-50 min-w-[210px] bg-surface/95 dark:bg-bg-subtle/95 backdrop-blur-md border border-border rounded-xl shadow-2xl p-1 select-none text-terminal-body animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: Math.min(window.innerWidth - 230, state.x),
        top: Math.min(window.innerHeight - 280, state.y),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2.5 py-1 border-b border-border-subtle flex items-center justify-between text-terminal-micro text-text-muted">
        <span>Price: <strong className="text-text terminal-num">{fmtPrice(p, digits)}</strong></span>
        <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-surface-muted text-text-muted hover:text-text cursor-pointer">
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 py-1">
        {isAboveAsk && (
          <>
            <button
              type="button"
              onClick={() => handlePlacePending('buy_stop')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted hover:text-emerald-400 transition-colors cursor-pointer text-left font-medium"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Buy Stop {lotSize} @ {fmtPrice(p, digits)}</span>
            </button>
            <button
              type="button"
              onClick={() => handlePlacePending('sell_limit')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted hover:text-rose-400 transition-colors cursor-pointer text-left font-medium"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Sell Limit {lotSize} @ {fmtPrice(p, digits)}</span>
            </button>
          </>
        )}

        {isBelowBid && (
          <>
            <button
              type="button"
              onClick={() => handlePlacePending('buy_limit')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted hover:text-emerald-400 transition-colors cursor-pointer text-left font-medium"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Buy Limit {lotSize} @ {fmtPrice(p, digits)}</span>
            </button>
            <button
              type="button"
              onClick={() => handlePlacePending('sell_stop')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted hover:text-rose-400 transition-colors cursor-pointer text-left font-medium"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Sell Stop {lotSize} @ {fmtPrice(p, digits)}</span>
            </button>
          </>
        )}

        <div className="w-full h-px bg-border-subtle my-0.5" />

        <button
          type="button"
          onClick={() => {
            onAddHorizontalLine(p)
            onClose()
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted transition-colors cursor-pointer text-left"
        >
          <Minus className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>Add Horizontal Line @ {fmtPrice(p, digits)}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onResetScale()
            onClose()
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted transition-colors cursor-pointer text-left"
        >
          <RotateCcw className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>Reset Chart Scale</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenObjectsList()
            onClose()
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted transition-colors cursor-pointer text-left"
        >
          <Layers className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>Objects List (Ctrl+B)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenProperties()
            onClose()
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text hover:bg-surface-muted transition-colors cursor-pointer text-left"
        >
          <Settings className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>Chart Properties & Indicators</span>
        </button>
      </div>
    </div>
  )
})
