/**
 * MT5 Pro Chart Engine — Pure TypeScript Technical Indicators Math
 * High-performance, zero-dependency, robust mathematical implementations.
 */

import type { Candle } from './types'

/**
 * Simple Moving Average (SMA)
 */
export function calcSMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null)
  if (candles.length < period || period <= 0) return result

  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += candles[i].close
  }
  result[period - 1] = sum / period

  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close
    result[i] = sum / period
  }
  return result
}

/**
 * Exponential Moving Average (EMA)
 */
export function calcEMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null)
  if (candles.length < period || period <= 0) return result

  // Initial SMA as first EMA seed
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += candles[i].close
  }
  const multiplier = 2 / (period + 1)
  let prevEma = sum / period
  result[period - 1] = prevEma

  for (let i = period; i < candles.length; i++) {
    const current = (candles[i].close - prevEma) * multiplier + prevEma
    result[i] = current
    prevEma = current
  }
  return result
}

/**
 * Bollinger Bands (Upper, Middle SMA, Lower)
 */
export function calcBollingerBands(
  candles: Candle[],
  period = 20,
  stdDevMultiplier = 2
): {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
} {
  const middle = calcSMA(candles, period)
  const upper: (number | null)[] = new Array(candles.length).fill(null)
  const lower: (number | null)[] = new Array(candles.length).fill(null)

  for (let i = period - 1; i < candles.length; i++) {
    const ma = middle[i]
    if (ma === null) continue

    let varianceSum = 0
    for (let j = 0; j < period; j++) {
      const diff = candles[i - j].close - ma
      varianceSum += diff * diff
    }
    const stdDev = Math.sqrt(varianceSum / period)
    upper[i] = ma + stdDevMultiplier * stdDev
    lower[i] = ma - stdDevMultiplier * stdDev
  }

  return { upper, middle, lower }
}

/**
 * Volume Weighted Average Price (VWAP)
 * Daily anchor resets at 00:00 UTC
 */
export function calcVWAP(candles: Candle[]): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null)
  if (candles.length === 0) return result

  let cumVolume = 0
  let cumTypicalVolume = 0
  let currentDay = -1

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const date = new Date(c.time)
    const day = date.getUTCDate()

    // Reset accumulator on new UTC day
    if (day !== currentDay) {
      currentDay = day
      cumVolume = 0
      cumTypicalVolume = 0
    }

    const typicalPrice = (c.high + c.low + c.close) / 3
    const vol = Math.max(1, c.volume)

    cumTypicalVolume += typicalPrice * vol
    cumVolume += vol

    result[i] = cumVolume > 0 ? cumTypicalVolume / cumVolume : typicalPrice
  }

  return result
}

/**
 * Relative Strength Index (RSI) using Wilder's Smoothing
 */
export function calcRSI(candles: Candle[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null)
  if (candles.length <= period || period <= 0) return result

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  result[period] = 100 - 100 / (1 + rs)

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result[i] = 100 - 100 / (1 + rs)
  }

  return result
}

/**
 * Moving Average Convergence Divergence (MACD)
 */
export function calcMACD(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): {
  macd: (number | null)[]
  signal: (number | null)[]
  hist: (number | null)[]
} {
  const fastEMA = calcEMA(candles, fast)
  const slowEMA = calcEMA(candles, slow)

  const macdLine: (number | null)[] = new Array(candles.length).fill(null)
  const syntheticCandlesForSignal: Candle[] = []
  const validIndices: number[] = []

  for (let i = 0; i < candles.length; i++) {
    const f = fastEMA[i]
    const s = slowEMA[i]
    if (f !== null && s !== null) {
      const val = f - s
      macdLine[i] = val
      syntheticCandlesForSignal.push({
        time: candles[i].time,
        open: val,
        high: val,
        low: val,
        close: val,
        volume: 0,
      })
      validIndices.push(i)
    }
  }

  const signalLineRaw = calcEMA(syntheticCandlesForSignal, signalPeriod)
  const signalLine: (number | null)[] = new Array(candles.length).fill(null)
  const hist: (number | null)[] = new Array(candles.length).fill(null)

  for (let j = 0; j < validIndices.length; j++) {
    const realIndex = validIndices[j]
    const sigVal = signalLineRaw[j]
    signalLine[realIndex] = sigVal
    if (sigVal !== null && macdLine[realIndex] !== null) {
      hist[realIndex] = macdLine[realIndex]! - sigVal
    }
  }

  return { macd: macdLine, signal: signalLine, hist }
}

/**
 * Heikin-Ashi transformed candles
 */
export function calcHeikinAshi(candles: Candle[]): Candle[] {
  if (candles.length === 0) return []
  const ha: Candle[] = []

  for (let i = 0; i < candles.length; i++) {
    const cur = candles[i]
    const haClose = (cur.open + cur.high + cur.low + cur.close) / 4
    let haOpen: number

    if (i === 0) {
      haOpen = (cur.open + cur.close) / 2
    } else {
      haOpen = (ha[i - 1].open + ha[i - 1].close) / 2
    }

    const haHigh = Math.max(cur.high, haOpen, haClose)
    const haLow = Math.min(cur.low, haOpen, haClose)

    ha.push({
      time: cur.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: cur.volume,
    })
  }

  return ha
}

/**
 * Check if a timestamp falls within an ICT Killzone session (UTC based)
 */
export function isSessionTime(
  timestampMs: number,
  session: 'asian' | 'london' | 'ny'
): boolean {
  const d = new Date(timestampMs)
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes()
  const timeDecimal = hours + minutes / 60

  switch (session) {
    case 'asian':
      // Asian Session: 00:00 - 08:00 UTC
      return timeDecimal >= 0 && timeDecimal < 8
    case 'london':
      // London Open Killzone: 07:00 - 10:00 UTC
      return timeDecimal >= 7 && timeDecimal < 10
    case 'ny':
      // New York Open Killzone: 12:00 - 15:00 UTC
      return timeDecimal >= 12 && timeDecimal < 15
    default:
      return false
  }
}
