/**
 * Pure order-ticket math — no store/React access, fully unit-testable.
 * Extracted from order-ticket.tsx.
 */

import type { PricesMap, PriceTick } from '@/types/api'

export interface LotBounds { minLot: number; maxLot: number }

/**
 * Returns the conversion rate from a given currency to USD using the provided prices map.
 * Example: getCrossRate('CHF', prices) checks for CHFUSD (returns ask) or USDCHF (returns 1 / ask).
 * Defaults to 1.0 if USD or if the symbol is missing.
 */
export function getCrossRate(currency: string, prices: PricesMap | Record<string, PriceTick>): number {
  if (currency === 'USD') return 1.0
  const direct = prices[`${currency}USD`]
  if (direct && (direct.ask || direct.bid)) return (Number(direct.ask) || Number(direct.bid))
  
  const inverse = prices[`USD${currency}`]
  if (inverse && (inverse.ask || inverse.bid)) {
    const val = (Number(inverse.ask) || Number(inverse.bid))
    if (val > 0) return 1 / val
  }
  return 1.0
}

type Px = { bid?: number | string; ask?: number | string; mid?: number | string }
const QUOTE_USD_FALLBACK: Record<string, number> = { JPY: 1 / 150, CAD: 1 / 1.36, CHF: 1 / 0.88, GBP: 1.27, EUR: 1.08, AUD: 0.65, NZD: 0.6 }

export function quoteToUsdRate(symbol: string, closePx: number, prices: Record<string, Px | undefined> = {}): number {
  const s = (symbol || '').toUpperCase()
  let quote = 'USD'
  if (s === 'GER40') quote = 'EUR'
  else if (s === 'UK100') quote = 'GBP'
  else if (/^[A-Z]{6}$/.test(s)) quote = s.slice(3)
  if (quote === 'USD') return 1
  if (s.startsWith('USD') && closePx > 0) return 1 / closePx
  const mid = (k: string) => {
    const p = prices?.[k]; if (!p) return 0
    const m = Number(p.mid) || (Number(p.bid) + Number(p.ask)) / 2
    return Number.isFinite(m) && m > 0 ? m : 0
  }
  const direct = mid(quote + 'USD'); if (direct > 0) return direct
  const inv = mid('USD' + quote); if (inv > 0) return 1 / inv
  return QUOTE_USD_FALLBACK[quote] ?? 1
}

/** Position size (lots) that risks `riskPct`% of balance across the SL distance. */
export function calcRecommendedLot(args: {
  balance: number
  riskPct: number
  entry: number
  sl: number
  contractSize: number
  bounds: LotBounds
  quoteToUsd?: number
}): number | null {
  const { balance, riskPct, entry, sl, contractSize, bounds, quoteToUsd = 1.0 } = args
  if (!balance || !sl || !entry) return null
  const riskAmt = balance * (riskPct / 100)
  const priceDiff = Math.abs(entry - sl)
  if (priceDiff <= 0) return null
  // perLotRisk needs to be converted back to USD
  const perLotRisk = priceDiff * contractSize * quoteToUsd
  if (perLotRisk <= 0) return null
  const rec = riskAmt / perLotRisk
  return Math.min(bounds.maxLot, Math.max(bounds.minLot, Math.round(rec * 100) / 100))
}

export function calcMargin(args: {
  lots: number
  contractSize: number
  leverage: number
  baseToUsd: number
}): number {
  const { lots, contractSize, leverage, baseToUsd } = args
  const notional = lots * contractSize * baseToUsd
  return leverage > 0 ? notional / leverage : 0
}

/**
 * P&L (or absolute risk magnitude in market mode) for an SL/TP level.
 * In market mode the side is unknown, so returns the unsigned magnitude.
 */
export function calcLevelPnL(args: {
  level: number | null
  entry: number
  lots: number
  contractSize: number
  mode: 'market' | 'pending'
  isBuy: boolean
  quoteToUsd?: number
}): number | null {
  const { level, entry, lots, contractSize, mode, isBuy, quoteToUsd = 1.0 } = args
  if (!level || !entry) return null
  let pnl: number
  if (mode === 'market') {
    pnl = Math.abs(level - entry) * contractSize * lots
  } else {
    const direction = isBuy ? 1 : -1
    pnl = (level - entry) * direction * contractSize * lots
  }
  return pnl * quoteToUsd
}

function toSafeNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/**
 * Universal live position PnL calculator:
 * Used identically across PositionRow, PositionsTable Net P&L header, and TradingTerminal footer stats.
 *
 * For external MT5 synced trades (order_id > 0 AND source === 'mt5'): returns MT5 reported pnl + swap - commission.
 * For internal WebTrader trades: computes live floating PnL dynamically from live tick and quote conversion rate.
 */
export function calculateLivePositionPnL(
  pos: {
    symbol: string
    type: string
    lot_size: number | string
    open_price: number | string
    current_price?: number | string
    pnl?: number | string
    swap?: number | string
    commission?: number | string
    order_id?: number | string | null
    source?: string | null
  },
  allPrices: Record<string, Px | undefined> = {},
  contractSize?: number | string
): number {
  // Real external MT5 synced position has an order_id > 0 and source === 'mt5'
  const isExternalMt5 = Boolean(
    pos.order_id &&
    Number(pos.order_id) > 0 &&
    pos.source === 'mt5'
  )

  if (isExternalMt5) {
    return toSafeNum(pos.pnl) + toSafeNum(pos.swap) - toSafeNum(pos.commission)
  }

  const tick = allPrices[pos.symbol]
  const currentPx = pos.type === 'buy'
    ? (toSafeNum(tick?.bid) || toSafeNum(pos.current_price))
    : (toSafeNum(tick?.ask) || toSafeNum(pos.current_price))

  const openPx = toSafeNum(pos.open_price)
  if (currentPx > 0 && openPx > 0) {
    const diff = pos.type === 'buy' ? currentPx - openPx : openPx - currentPx
    const cSize = toSafeNum(contractSize) || 100000
    const calcPnl = diff * cSize * toSafeNum(pos.lot_size)
    return calcPnl * quoteToUsdRate(pos.symbol, currentPx, allPrices) + toSafeNum(pos.swap) - toSafeNum(pos.commission)
  }

  return toSafeNum(pos.pnl)
}
