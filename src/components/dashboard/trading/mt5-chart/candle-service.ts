/**
 * MT5 Pro Chart Engine — Candle & Live Tick Pipeline
 * Generates and streams realistic institutional multi-timeframe OHLCV candles
 * with real-time WebSocket tick absorption and precise countdown synchronization.
 */

import type { Candle, Timeframe } from './types'
import { TIMEFRAME_SECONDS } from './types'

// Memory cache to avoid flickering when toggling toolbars or themes
const candleCache = new Map<string, Candle[]>()

/**
 * Format remaining seconds into MT5 digital countdown clock (MM:SS or HH:MM:SS)
 */
export function formatCountdown(secondsLeft: number): string {
  if (secondsLeft < 0) return '00:00'
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = Math.floor(secondsLeft % 60)

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Compute seconds remaining until current candle closes
 */
export function getCandleCountdownSeconds(timeframe: Timeframe, nowMs = Date.now()): number {
  const durationSec = TIMEFRAME_SECONDS[timeframe] || 60
  const nowSec = Math.floor(nowMs / 1000)
  const passedInPeriod = nowSec % durationSec
  return Math.max(0, durationSec - passedInPeriod)
}

/**
 * Generate a realistic seed price if live price is not yet available
 */
function getSymbolDefaultAnchor(symbol: string): number {
  const s = (symbol || '').toUpperCase()
  if (s.includes('JPY')) return 154.25
  if (s === 'XAUUSD') return 2735.50
  if (s === 'XAGUSD') return 32.40
  if (s === 'BTCUSD') return 68450.00
  if (s === 'ETHUSD') return 2640.00
  if (s === 'US30') return 43200.0
  if (s === 'NAS100') return 20450.0
  if (s === 'SPX500') return 5860.0
  if (s === 'GER40') return 19580.0
  if (s === 'UK100') return 8240.0
  if (s === 'GBPUSD') return 1.3025
  if (s === 'EURUSD') return 1.0865
  if (s === 'USDCHF') return 0.8650
  if (s === 'AUDUSD') return 0.6680
  if (s === 'USDCAD') return 1.3820
  if (s === 'NZDUSD') return 0.6040
  return 1.1000
}

/**
 * Generate synthetic institutional candles anchored to the current market price
 */
export function generateRealisticCandles(args: {
  symbol: string
  timeframe: Timeframe
  anchorPrice?: number
  digits: number
  pipSize: number
  count?: number
}): Candle[] {
  const { symbol, timeframe, digits, pipSize, count = 280 } = args
  const anchor = args.anchorPrice && args.anchorPrice > 0
    ? args.anchorPrice
    : getSymbolDefaultAnchor(symbol)

  const tfSeconds = TIMEFRAME_SECONDS[timeframe] || 60
  const tfMs = tfSeconds * 1000
  const now = Date.now()
  const currentCandleTime = Math.floor(now / tfMs) * tfMs

  // Volatility scale per bar based on timeframe & pip size
  const pipMultiplier = Math.sqrt(tfSeconds / 60)
  const baseVolatility = Math.max(pipSize * 2, pipSize * 4 * pipMultiplier)

  const candles: Candle[] = []
  let prevClose = anchor

  // Seed pseudo-random walk backwards
  const tempWalk: Array<{ open: number; high: number; low: number; close: number; volume: number }> = []
  
  // Deterministic seed based on symbol name string
  let seed = 0
  for (let c = 0; c < symbol.length; c++) {
    seed = (seed * 31 + symbol.charCodeAt(c)) & 0xffffffff
  }
  const pseudoRand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 4294967296
  }

  // Generate walk backward from anchor
  let rollingClose = anchor
  for (let i = 0; i < count; i++) {
    const r1 = pseudoRand() - 0.495 // slight trend
    const r2 = pseudoRand()
    const r3 = pseudoRand()

    const change = r1 * baseVolatility * 1.5
    const open = rollingClose - change
    const close = rollingClose

    const wickHigh = Math.max(open, close) + r2 * baseVolatility * 0.8
    const wickLow = Math.min(open, close) - r3 * baseVolatility * 0.8

    const vol = Math.floor(100 + pseudoRand() * 800 * pipMultiplier)

    tempWalk.push({
      open: parseFloat(open.toFixed(digits)),
      high: parseFloat(wickHigh.toFixed(digits)),
      low: parseFloat(wickLow.toFixed(digits)),
      close: parseFloat(close.toFixed(digits)),
      volume: vol,
    })

    rollingClose = open
  }

  // Reverse so oldest is first, newest is last (at currentCandleTime)
  tempWalk.reverse()

  for (let i = 0; i < count; i++) {
    const time = currentCandleTime - (count - 1 - i) * tfMs
    const item = tempWalk[i]
    candles.push({
      time,
      open: item.open,
      high: Math.max(item.high, item.open, item.close),
      low: Math.min(item.low, item.open, item.close),
      close: item.close,
      volume: item.volume,
    })
  }

  // Ensure last candle closes exactly at anchor
  const last = candles[candles.length - 1]
  if (last) {
    last.close = anchor
    last.high = Math.max(last.high, anchor)
    last.low = Math.min(last.low, anchor)
  }

  return candles
}

/**
 * Fetch historical candles from public Binance API (for crypto) or generate
 */
export async function loadHistoricalCandles(args: {
  symbol: string
  timeframe: Timeframe
  anchorPrice?: number
  digits: number
  pipSize: number
}): Promise<Candle[]> {
  const { symbol, timeframe, anchorPrice, digits, pipSize } = args
  const cacheKey = `${symbol}_${timeframe}`

  const isCrypto = symbol.startsWith('BTC') || symbol.startsWith('ETH') || symbol.includes('USDT')

  if (isCrypto) {
    try {
      const pair = symbol.replace('USD', 'USDT')
      const intervalMap: Record<Timeframe, string> = {
        M1: '1m',
        M5: '5m',
        M15: '15m',
        M30: '30m',
        H1: '1h',
        H4: '4h',
        D1: '1d',
        W1: '1w',
      }
      const binanceInterval = intervalMap[timeframe] || '1h'
      const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${binanceInterval}&limit=280`

      const res = await fetch(url, { signal: AbortSignal.timeout(3500) })
      if (res.ok) {
        const raw = await res.json()
        if (Array.isArray(raw) && raw.length > 0) {
          const rawLastClose = Number(raw[raw.length - 1][4])
          let offset = 0
          if (anchorPrice && anchorPrice > 0 && rawLastClose > 0) {
            offset = anchorPrice - rawLastClose
          }

          const candles: Candle[] = raw.map((k: any) => ({
            time: Number(k[0]),
            open: parseFloat((Number(k[1]) + offset).toFixed(digits)),
            high: parseFloat((Number(k[2]) + offset).toFixed(digits)),
            low: parseFloat((Number(k[3]) + offset).toFixed(digits)),
            close: parseFloat((Number(k[4]) + offset).toFixed(digits)),
            volume: Math.round(Number(k[5])),
          }))
          if (anchorPrice && anchorPrice > 0 && candles.length > 0) {
            const last = candles[candles.length - 1]
            last.close = anchorPrice
            last.high = Math.max(last.high, anchorPrice)
            last.low = Math.min(last.low, anchorPrice)
          }
          candleCache.set(cacheKey, candles)
          return candles
        }
      }
    } catch {
      // Fall through to synthetic generation on network or timeout
    }
  }

  // Check cache first to avoid abrupt re-generation
  const cached = candleCache.get(cacheKey)
  if (cached && cached.length > 50) {
    // If live price has moved or diverged, smoothly realign the series
    if (anchorPrice && anchorPrice > 0) {
      const last = cached[cached.length - 1]
      const diff = anchorPrice - last.close
      if (Math.abs(diff) > anchorPrice * 0.0005) {
        for (const c of cached) {
          c.open = parseFloat((c.open + diff).toFixed(digits))
          c.high = parseFloat((c.high + diff).toFixed(digits))
          c.low = parseFloat((c.low + diff).toFixed(digits))
          c.close = parseFloat((c.close + diff).toFixed(digits))
        }
      }
      last.close = anchorPrice
      last.high = Math.max(last.high, anchorPrice)
      last.low = Math.min(last.low, anchorPrice)
    }
    return [...cached]
  }

  const generated = generateRealisticCandles({
    symbol,
    timeframe,
    anchorPrice,
    digits,
    pipSize,
    count: 280,
  })

  candleCache.set(cacheKey, generated)
  return generated
}

/**
 * Merge an incoming live tick into the active candle series
 */
export function updateCandlesWithLiveTick(
  candles: Candle[],
  tick: { bid: number; ask: number; time?: number },
  timeframe: Timeframe,
  digits: number
): Candle[] {
  if (!candles || candles.length === 0 || !tick.bid || tick.bid <= 0) {
    return candles
  }

  const tfSeconds = TIMEFRAME_SECONDS[timeframe] || 60
  const tfMs = tfSeconds * 1000
  const now = Date.now()
  const expectedCandleTime = Math.floor(now / tfMs) * tfMs

  const updated = [...candles]
  const lastIndex = updated.length - 1
  const last = { ...updated[lastIndex] }

  if (expectedCandleTime === last.time || (now >= last.time && now < last.time + tfMs) || expectedCandleTime < last.time) {
    // Same period — update current active candle
    last.close = parseFloat(tick.bid.toFixed(digits))
    last.high = parseFloat(Math.max(last.high, tick.bid).toFixed(digits))
    last.low = parseFloat(Math.min(last.low, tick.bid).toFixed(digits))
    last.volume = (last.volume || 0) + 1
    updated[lastIndex] = last
  } else if (expectedCandleTime > last.time) {
    // New candle timeframe rolled over — open from previous close
    const openPx = last.close
    const microTick = digits > 0 ? Math.pow(10, -digits) : 1
    const newCandle: Candle = {
      time: expectedCandleTime,
      open: openPx,
      high: parseFloat(Math.max(openPx, tick.bid, openPx + microTick).toFixed(digits)),
      low: parseFloat(Math.min(openPx, tick.bid, Math.max(0, openPx - microTick)).toFixed(digits)),
      close: parseFloat(tick.bid.toFixed(digits)),
      volume: 1,
    }
    updated.push(newCandle)
    // Keep max 400 candles in memory for lightweight memory footprint
    if (updated.length > 400) {
      updated.shift()
    }
  }

  return updated
}
