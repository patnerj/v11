/**
 * Symbol metadata helpers — digit count, pip size, and TradingView mapping.
 *
 * The backend's /symbols endpoint returns lot specs (min_lot, max_lot, contract_size,
 * spread, commission) but does NOT include digit count or pip_size — those follow
 * fixed industry conventions per instrument class. These helpers encode the same
 * conventions the existing terminal.js uses, so values render consistently across
 * the dashboard and the terminal.
 */

import type { Symbol as SymbolMeta } from '@/types/api'

/** Decimal digits used for the price ticker for a given symbol. */
export function symbolDigits(sym: string, fallback?: SymbolMeta): number {
  // If the backend gave us digits explicitly, trust it
  if (fallback?.digits) return fallback.digits
  // Otherwise infer from the symbol name (matches existing WP terminal conventions)
  const s = sym.toUpperCase()
  if (s.includes('JPY')) return 3
  if (s === 'XAUUSD' || s === 'XAGUSD') return 2
  if (s === 'BTCUSD' || s === 'ETHUSD') return 2
  // Indices: typically 1 decimal
  if (/^(US\d|NAS\d|GER\d|UK\d|SPX|DJI)/.test(s)) return 1
  // Default for FX majors
  return 5
}

/**
 * Pip size — the smallest price increment users think in.
 * 5-digit forex: 0.0001 (pip is at the 4th decimal, the 5th is a pipette)
 * 3-digit JPY:   0.01
 * Gold:          0.01
 * Indices:       0.1
 */
export function pipSize(sym: string, digits?: number): number {
  const d = digits ?? symbolDigits(sym)
  if (d === 5) return 0.0001
  if (d === 3) return 0.01
  if (d === 2) return 0.01
  if (d === 1) return 0.1
  return Math.pow(10, -d)
}

/**
 * TradingView symbol resolution (V10.5) — canonical chain:
 *   MT5 broker symbol → platform symbol (price service) → TradingView symbol (here).
 *
 * Resolution cascade:
 *   1. Admin override   — `tv_symbol_map` JSON from Settings → Trading Feed
 *   2. Official mapping — curated multi-provider defaults below
 *   3. Category heuristic — forex/metal/crypto/index conventions
 *   4. Last resort      — the plain symbol (TradingView search-resolves many)
 *
 * Index defaults prefer Pepperstone/Capital.com feeds because their tickers
 * match prop-industry naming 1:1 and have proven stable; OANDA kept as the
 * documented alternate. (OANDA's old DE30EUR DAX ticker is deprecated — the
 * Germany 40 contract is DE40EUR there now.)
 */
const TV_SYMBOLS: Record<string, string> = {
  // Forex — Pepperstone institutional feeds
  EURUSD: 'PEPPERSTONE:EURUSD', GBPUSD: 'PEPPERSTONE:GBPUSD', USDJPY: 'PEPPERSTONE:USDJPY', USDCHF: 'PEPPERSTONE:USDCHF',
  AUDUSD: 'PEPPERSTONE:AUDUSD', USDCAD: 'PEPPERSTONE:USDCAD', NZDUSD: 'PEPPERSTONE:NZDUSD', EURGBP: 'PEPPERSTONE:EURGBP',
  EURJPY: 'PEPPERSTONE:EURJPY', GBPJPY: 'PEPPERSTONE:GBPJPY',
  // Metals — Pepperstone institutional feeds
  XAUUSD: 'PEPPERSTONE:XAUUSD', XAGUSD: 'PEPPERSTONE:XAGUSD',
  // Energy
  USOIL: 'PEPPERSTONE:USOIL', XBRUSD: 'PEPPERSTONE:UKOIL',
  // Forex cross pairs — Pepperstone institutional feeds
  EURAUD: 'PEPPERSTONE:EURAUD', EURNZD: 'PEPPERSTONE:EURNZD', EURCAD: 'PEPPERSTONE:EURCAD',
  GBPAUD: 'PEPPERSTONE:GBPAUD', GBPCAD: 'PEPPERSTONE:GBPCAD', GBPCHF: 'PEPPERSTONE:GBPCHF',
  AUDJPY: 'PEPPERSTONE:AUDJPY', AUDCAD: 'PEPPERSTONE:AUDCAD', AUDCHF: 'PEPPERSTONE:AUDCHF',
  NZDJPY: 'PEPPERSTONE:NZDJPY', CADJPY: 'PEPPERSTONE:CADJPY', CHFJPY: 'PEPPERSTONE:CHFJPY',
  // Crypto — Pepperstone institutional feeds
  BTCUSD: 'PEPPERSTONE:BTCUSD', ETHUSD: 'PEPPERSTONE:ETHUSD',
  // Indices — Pepperstone institutional feeds
  US30:   'PEPPERSTONE:US30',
  NAS100: 'PEPPERSTONE:NAS100',
  SPX500: 'PEPPERSTONE:US500',
  GER40:  'PEPPERSTONE:GER40',
  UK100:  'PEPPERSTONE:UK100',
}

export type SymbolCategory = 'forex' | 'metal' | 'crypto' | 'index' | 'energy' | string

/** Step 3 — convention-based guess when a symbol isn't in any table. */
function tvHeuristic(sym: string, category?: SymbolCategory): string {
  const s = sym.toUpperCase()
  const cat = category
    || (/^X(AU|AG|PT|PD)/.test(s) ? 'metal'
      : /^(BTC|ETH|SOL|XRP|LTC|ADA|DOGE)/.test(s) ? 'crypto'
      : /^[A-Z]{6}$/.test(s) ? 'forex'
      : 'index')
  switch (cat) {
    case 'forex':  return `PEPPERSTONE:${s}`
    case 'metal':  return `PEPPERSTONE:${s}`
    case 'crypto': return `PEPPERSTONE:${s}`
    case 'index':
    case 'energy': return `PEPPERSTONE:${s}`
    default:       return `PEPPERSTONE:${s}`
  }
}

/**
 * Resolve a platform symbol to a TradingView symbol.
 * `overrides` is the parsed admin `tv_symbol_map`; pass the instrument's
 * `category` when known for a smarter heuristic.
 */
export function tvSymbol(sym: string, overrides?: Record<string, string> | null, category?: SymbolCategory): string {
  const key = sym.toUpperCase()
  const ov = overrides?.[key]?.trim()
  if (ov) return ov                                   // 1. admin override
  if (TV_SYMBOLS[key]) return TV_SYMBOLS[key]         // 2. official table
  return tvHeuristic(key, category)                   // 3. heuristic → 4. plain
}

/** Parse the admin tv_symbol_map setting (JSON object string) safely. */
export function parseTvMap(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(obj)) if (typeof v === 'string' && v.trim()) out[k.toUpperCase()] = v.trim()
      return out
    }
  } catch { /* malformed JSON — ignore, cascade continues */ }
  return {}
}

/** Group label for the watchlist. Cheap categorisation by symbol shape. */
export function symbolCategory(sym: string): 'forex' | 'commodity' | 'crypto' | 'index' {
  const s = sym.toUpperCase()
  if (s === 'XAUUSD' || s === 'XAGUSD') return 'commodity'
  if (s === 'BTCUSD' || s === 'ETHUSD') return 'crypto'
  if (/^(US\d|NAS\d|GER\d|UK\d|SPX|DJI)/.test(s)) return 'index'
  return 'forex'
}

/** Human-readable category label. */
export const CATEGORY_LABEL: Record<ReturnType<typeof symbolCategory>, string> = {
  forex:     'Forex',
  commodity: 'Metals',
  crypto:    'Crypto',
  index:     'Indices',
}

/** Sort priority for category display order. */
export const CATEGORY_ORDER: ReturnType<typeof symbolCategory>[] = [
  'forex', 'commodity', 'index', 'crypto',
]

/**
 * Compute estimated pip value for a 1-lot position in account currency (USD).
 * Used by the risk calculator. This is a simplification — for JPY pairs the
 * actual pip value depends on the JPY→USD rate, but for the rough-cut shown
 * in the order ticket, contract_size × pip_size is close enough.
 */
export function estimatedPipValue(sym: string, contractSize: number, lotSize: number): number {
  const pip = pipSize(sym)
  return contractSize * pip * lotSize
}

/** Build a TradingView interval string from a short timeframe code. */
export function tvInterval(tf: string): string {
  // TF code → TradingView interval value
  const map: Record<string, string> = {
    '1m':  '1',   '5m':  '5',   '15m': '15', '30m': '30',
    '1h':  '60',  '4h':  '240',
    '1d':  'D',   '1w':  'W',   '1M':  'M',
  }
  return map[tf] || '60'
}

export const TIMEFRAMES: { code: string; label: string }[] = [
  { code: '1m',  label: '1m' },
  { code: '5m',  label: '5m' },
  { code: '15m', label: '15m' },
  { code: '30m', label: '30m' },
  { code: '1h',  label: '1h' },
  { code: '4h',  label: '4h' },
  { code: '1d',  label: '1D' },
  { code: '1w',  label: '1W' },
]

/**
 * Map symbols (forex, indices, commodities, crypto) to their relevant currencies
 * for economic calendar news restriction matching.
 * Matches backend mapping in class-challenge-engine.php:1014-1022:
 * US30/NAS100/SPX500 -> USD; GER40 -> EUR; UK100 -> GBP; JPN225 -> JPY;
 * XAUUSD/XAGUSD/USOIL -> USD; Forex pairs -> [base, quote].
 */
export function symbolCurrencies(sym: string): string[] {
  if (!sym) return []
  const s = sym.toUpperCase()
  if (['US30', 'NAS100', 'SPX500', 'DJI', 'US2000', 'USOIL', 'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD'].includes(s)) {
    return ['USD']
  }
  if (['GER40', 'GER30', 'FRA40', 'EUSTX50'].includes(s)) {
    return ['EUR']
  }
  if (['UK100', 'FTSE100'].includes(s)) {
    return ['GBP']
  }
  if (['JPN225', 'NKY225'].includes(s)) {
    return ['JPY']
  }
  if (['AUS200'].includes(s)) {
    return ['AUD']
  }
  if (s.length === 6) {
    return [s.slice(0, 3), s.slice(3, 6)]
  }
  return []
}
