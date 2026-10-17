'use client'

import { create } from 'zustand'
import { api } from '@/lib/api'
import { STORAGE_KEYS, storageGet, storageSet } from '@/lib/storage'
import type { Symbol as SymbolMeta } from '@/types/api'

interface TerminalState {
  symbols:       SymbolMeta[]
  symbolsLoaded: boolean
  /** Active symbol — drives chart + order ticket. */
  active:        string
  setActive:     (sym: string) => void
  /** Watchlist (subset of symbols pinned by the user). Empty = show all. */
  watchlist:     string[]
  toggleWatch:   (sym: string) => void
  /** Pull /symbols and persist active-symbol from localStorage. */
  bootstrap:     () => Promise<void>
  /** Re-fetch the active symbol set (bypasses cache). Called periodically and
   *  when the tab regains focus so the terminal never needs a manual refresh or
   *  a Disable/Enable cycle to reflect admin activation changes. */
  refreshSymbols: () => Promise<void>
  /** Get the Symbol meta record for a given ticker. */
  getMeta:       (sym: string) => SymbolMeta | undefined
  /** TP/SL levels overlay visibility */
  showLevels:    boolean
  toggleLevels:  () => void
  /** Floating 1-Click execution panel visibility */
  showOneClick:  boolean
  toggleOneClick: () => void
  /** Chart Fullscreen toggle handler & state */
  isChartFs:     boolean
  setChartFs:    (fs: boolean) => void
  chartFsHandler: (() => void) | null
  registerChartFsHandler: (fn: (() => void) | null) => void
  toggleChartFs: () => void
  /** Number of active positions on current symbol */
  symbolPositionsCount: number
  setSymbolPositionsCount: (count: number) => void
  /** Active chart engine: 'mt5' pro canvas or 'tradingview' widget */
  chartEngine:   'mt5' | 'tradingview'
  setChartEngine: (engine: 'mt5' | 'tradingview') => void
}

function loadLevels(): boolean {
  if (typeof window === 'undefined') return true
  try { return localStorage.getItem('fxsim:term:levels') !== '0' } catch { return true }
}
function loadOneClick(): boolean {
  if (typeof window === 'undefined') return true
  try { return localStorage.getItem('fxsim:term:oneclick') !== '0' } catch { return true }
}

function loadChartEngine(): 'mt5' | 'tradingview' {
  const val = storageGet(STORAGE_KEYS.chartEngine)
  return val === 'tradingview' ? 'tradingview' : 'mt5'
}

function loadActive(): string {
  return storageGet(STORAGE_KEYS.termActive) || 'EURUSD'
}
function saveActive(sym: string) {
  storageSet(STORAGE_KEYS.termActive, sym)
}
function loadWatch(): string[] {
  const raw = storageGet(STORAGE_KEYS.termWatch)
  try { return raw ? JSON.parse(raw) : [] } catch { return [] }
}
function saveWatch(arr: string[]) {
  storageSet(STORAGE_KEYS.termWatch, JSON.stringify(arr))
}

function sanitizeSymbols(list: SymbolMeta[]): SymbolMeta[] {
  if (!Array.isArray(list)) return []
  return list.filter((s) => !/_[0-9]+$/.test(s.symbol || ''))
}

let bootstrapPromise: Promise<void> | null = null

export const useTerminal = create<TerminalState>((set, get) => ({
  symbols: [],
  symbolsLoaded: false,
  active: 'EURUSD',
  watchlist: [],
  showLevels: loadLevels(),
  toggleLevels: () => {
    const next = !get().showLevels
    try { localStorage.setItem('fxsim:term:levels', next ? '1' : '0') } catch {}
    set({ showLevels: next })
  },
  showOneClick: loadOneClick(),
  toggleOneClick: () => {
    const next = !get().showOneClick
    try { localStorage.setItem('fxsim:term:oneclick', next ? '1' : '0') } catch {}
    set({ showOneClick: next })
  },
  isChartFs: false,
  setChartFs: (fs) => set({ isChartFs: fs }),
  chartFsHandler: null,
  registerChartFsHandler: (fn) => set({ chartFsHandler: fn }),
  toggleChartFs: () => {
    const handler = get().chartFsHandler
    if (handler) handler()
  },
  symbolPositionsCount: 0,
  setSymbolPositionsCount: (count) => set({ symbolPositionsCount: count }),
  chartEngine: loadChartEngine(),
  setChartEngine: (engine) => {
    storageSet(STORAGE_KEYS.chartEngine, engine)
    set({ chartEngine: engine })
  },

  setActive: (sym) => { saveActive(sym); set({ active: sym }) },

  toggleWatch: (sym) => {
    const cur = get().watchlist
    const next = cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym]
    saveWatch(next)
    set({ watchlist: next })
  },

  bootstrap: async () => {
    if (get().symbolsLoaded) return
    if (bootstrapPromise) return bootstrapPromise
    bootstrapPromise = (async () => {
      const res = await api.symbols()
      if (res.ok) {
        const cleanSymbols = sanitizeSymbols(res.data)
        set({
          symbols:       cleanSymbols,
          symbolsLoaded: true,
          active:        loadActive(),
          watchlist:     loadWatch(),
          showLevels:    loadLevels(),
          showOneClick:  loadOneClick(),
          chartEngine:   loadChartEngine(),
        })
      } else {
        // Don't fail hard — leave symbolsLoaded false so the page can show
        // an error state if it cares. Active/watchlist are still hydrated.
        set({
          active: loadActive(),
          watchlist: loadWatch(),
          showLevels: loadLevels(),
          showOneClick: loadOneClick(),
          chartEngine:  loadChartEngine(),
        })
      }
    })().finally(() => { bootstrapPromise = null })
    return bootstrapPromise
  },

  refreshSymbols: async () => {
    // Force-bypass the 5-min cache so the terminal reflects the CURRENT active
    // set (BUG-011 Defect A). Only the symbol list is replaced; the user's
    // active selection and watchlist are preserved. If the active symbol was
    // disabled by an admin, fall back to the first available symbol.
    const res = await api.symbols(true)
    if (!res.ok) return
    const list = sanitizeSymbols(res.data)
    const cur  = get().active
    const stillActive = list.some((s) => s.symbol === cur)
    set({
      symbols:       list,
      symbolsLoaded: true,
      active:        stillActive ? cur : (list[0]?.symbol ?? cur),
    })
  },

  getMeta: (sym) => get().symbols.find((s) => s.symbol === sym),
}))
