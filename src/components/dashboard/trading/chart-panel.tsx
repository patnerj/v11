'use client'

import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { Maximize2, Minimize2, Info, PencilRuler } from 'lucide-react'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { tvSymbol, tvInterval, symbolDigits, parseTvMap, pipSize } from '@/lib/symbol-meta'
import { useBranding } from '@/store/branding'
import { fmtPrice, toNum } from '@/lib/format'
import type { Position } from '@/types/api'
import { toast } from 'sonner'
import { useIsDarkTheme } from '@/hooks/use-theme-attribute'
import { ScalperExecutionHeader } from './scalper-execution-header'

interface Props {
  compact?: boolean
  /** Open positions — used to overlay live execution-feed levels on the chart. */
  positions?: Position[] | null
  /** Mobile: callback to open the market watch sheet */
  onOpenWatchlist?: () => void
  /** Trading Plan rules (e.g. stop loss requirement) */
  plan?: any | null
  /** Callback when positions / SLTP change */
  onChanged?: () => void
}

// Default interval the chart opens on. Users change timeframe with TradingView's
// own built-in controls (we no longer render a duplicate row), and because the
// widget is only rebuilt on symbol change, drawings persist across tf changes.
const DEFAULT_TF = '1h'

// V10.5 — session widget cache (desktop): keep up to N recent TradingView
// widget instances alive and toggle their visibility instead of destroying
// them on every symbol switch. Drawings live inside each widget's iframe, so
// while an instance survives, its drawings survive — SESSION-based retention
// only (refresh/logout/device change still reset; that requires the Charting
// Library). Uses only documented widget construction — no iframe access.
const WIDGET_CACHE_MAX = 3
const MOBILE_DRAW_KEY  = 'fxsim:chart:mobile-draw'

declare global {
  interface Window { TradingView?: { widget: new (cfg: Record<string, unknown>) => unknown } }
}

let tvScriptPromise: Promise<void> | null = null

function loadTvScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.TradingView) return Promise.resolve()
  if (tvScriptPromise) return tvScriptPromise
  tvScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src   = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload  = () => resolve()
    s.onerror = () => { tvScriptPromise = null; reject(new Error('TradingView script failed to load')) }
    document.head.appendChild(s)
  })
  return tvScriptPromise
}

export const ChartPanel = memo(function ChartPanel({ compact, positions, onOpenWatchlist, plan, onChanged }: Props) {
  const active  = useTerminal((s) => s.active)
  const meta    = useTerminal((s) => s.getMeta(active))
  const metaRef = useRef(meta)
  useEffect(() => { metaRef.current = meta }, [meta])
  const tick    = usePrices((s) => s.prices[active])
  const pending = usePrices((s) => s.pending)

  // Open positions and pending orders on the *active* symbol
  const symPositions = useMemo(() => (positions ?? []).filter((p) => p.symbol === active), [positions, active])
  const symPending   = useMemo(() => (pending ?? []).filter((o) => o.symbol === active && o.status === 'pending'), [pending, active])

  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef    = useRef<unknown>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)
  const chartHostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [fullscreen, setFs] = useState(false)

  // Admin chart-symbol overrides (Settings → Trading Feed), via the branding store.
  const rawTvMap = useBranding((s) => s.branding.tv_symbol_map)
  const tvMap    = useMemo(() => parseTvMap(rawTvMap), [rawTvMap])

  // Mobile drawing toolbar — user-controlled, persisted per device.
  const [mobileDraw, setMobileDraw] = useState(false)
  const mobileDrawRef = useRef(false)
  useEffect(() => {
    try {
      const v = localStorage.getItem(MOBILE_DRAW_KEY) === '1'
      mobileDrawRef.current = v
      setMobileDraw(v)
    } catch { /* private mode */ }
  }, [])
  const toggleMobileDraw = useCallback(() => {
    setMobileDraw((v) => {
      const next = !v
      mobileDrawRef.current = next
      try { localStorage.setItem(MOBILE_DRAW_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  // Session widget cache (desktop only): resolved TV symbol → host element.
  const cacheRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const orderRef = useRef<string[]>([])

  // Stable ref for compact — avoids re-creating buildWidget on every render
  const compactRef = useRef(compact)
  useEffect(() => { compactRef.current = compact }, [compact])

  // 1-Click visibility synchronized via useTerminal store
  const showOneClick = useTerminal((s) => s.showOneClick)
  const toggleOneClick = useTerminal((s) => s.toggleOneClick)
  const dragControls = useDragControls()

  const isSlRequired = Boolean(plan?.stop_loss_required || plan?.require_stop_loss)

  // Sync active symbol position count to terminal store (drives topbar badge)
  useEffect(() => {
    useTerminal.getState().setSymbolPositionsCount(symPositions.length)
  }, [symPositions.length])

  const isDark = useIsDarkTheme()

  /** Build a TradingView widget into the given host element. */
  const buildWidget = useCallback((host: HTMLElement, resolved: string, sideToolbarHidden: boolean) => {
    const isCompact = compactRef.current
    const id = `tv-chart-${Math.random().toString(36).slice(2, 9)}`
    const inner = document.createElement('div')
    inner.id = id
    inner.style.height = '100%'
    inner.style.width  = '100%'
    host.appendChild(inner)
    return new window.TradingView!.widget({
      container_id:        id,
      autosize:            true,
      symbol:              resolved,
      interval:            tvInterval(DEFAULT_TF),
      timezone:            'Etc/UTC',
      theme:               isDark ? 'dark' : 'light',
      style:               '1',
      locale:              'en',
      toolbar_bg:          isDark ? '#0F172A' : '#ffffff',
      enable_publishing:   false,
      hide_side_toolbar:   sideToolbarHidden,
      hide_top_toolbar:    false,
      hide_legend:         !!isCompact,
      allow_symbol_change: false,
      save_image:          false,
      withdateranges:      true,
      backgroundColor:     isDark ? '#0F172A' : '#ffffff',
      gridColor:           isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      disabled_features:   ['volume_force_overlay', 'create_volume_indicator_by_default'],
      enabled_features:    ['show_symbol_logos'],
    })
  }, [isDark])

  // Clear cache if theme changes so the widget rebuilds with new colors
  useEffect(() => {
    cacheRef.current.forEach((el) => {
      try {
        el.querySelectorAll('iframe').forEach((ifr) => {
          try { ifr.src = 'about:blank' } catch {}
        })
      } catch {}
      el.remove()
    })
    cacheRef.current.clear()
    orderRef.current = []
    if (containerRef.current) containerRef.current.innerHTML = ''
  }, [isDark])

  // Widget lifecycle.
  //  • Mobile (compact): single instance, rebuilt on symbol or toolbar-toggle
  //    change — caching multiple heavyweight iframes isn't worth it on phones.
  //  • Desktop: LRU cache of up to WIDGET_CACHE_MAX instances keyed by the
  //    RESOLVED TradingView symbol. Switching to a cached symbol reuses its
  //    live iframe (drawings intact); only cache-evicted, terminal-exit, or
  //    session-end destroys a widget. Timeframe changes use TradingView's own
  //    toolbar and never touch the widget at all.
  useEffect(() => {
    let cancelled = false
    setError(null)
    const category = (metaRef.current as { category?: string } | null | undefined)?.category
    const resolved = tvSymbol(active, tvMap, category)

    loadTvScript().then(() => {
      if (cancelled || !containerRef.current || !window.TradingView) return

      // ── Mobile: simple single-instance path ──
      if (compactRef.current) {
        setReady(false)
        containerRef.current.innerHTML = ''
        try {
          widgetRef.current = buildWidget(containerRef.current, resolved, !mobileDrawRef.current)
          setReady(true)
        } catch (e) { setError((e as Error).message || 'Chart failed to load') }
        return
      }

      // ── Desktop: session cache ──
      const cache = cacheRef.current
      const order = orderRef.current

      // Hide every cached host, then show (or create) the active one.
      for (const el of cache.values()) el.style.display = 'none'

      let host = cache.get(resolved)
      if (host) {
        host.style.display = 'block'
        // LRU touch
        orderRef.current = [...order.filter((k) => k !== resolved), resolved]
        // Hidden iframes can mis-measure; nudge TradingView's autosize.
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
        setReady(true)
        return
      }

      setReady(false)
      host = document.createElement('div')
      host.style.position = 'absolute'
      host.style.inset = '0'
      containerRef.current.appendChild(host)
      try {
        buildWidget(host, resolved, false)
        cache.set(resolved, host)
        orderRef.current = [...order, resolved]
        // Evict least-recently-used beyond the cap — true destruction.
        while (orderRef.current.length > WIDGET_CACHE_MAX) {
          const evict = orderRef.current.shift()!
          const el = cache.get(evict)
          if (el) {
            try {
              el.querySelectorAll('iframe').forEach((ifr) => {
                try { ifr.src = 'about:blank' } catch {}
              })
            } catch {}
            el.innerHTML = ''
            el.remove()
            cache.delete(evict)
          }
        }
        setReady(true)
      } catch (e) { setError((e as Error).message || 'Chart failed to load') }
    }).catch((e: Error) => {
      if (!cancelled) setError(e.message || 'Chart unavailable')
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tvMap, isDark])

  // Destroy everything only when the trader actually leaves the terminal
  // (component unmount) — never on symbol switches.
  useEffect(() => {
    const container = containerRef.current
    const cache = cacheRef.current
    return () => {
      cache.forEach((el) => {
        try {
          el.querySelectorAll('iframe').forEach((ifr) => {
            try { ifr.src = 'about:blank' } catch {}
          })
        } catch {}
        el.remove()
      })
      cache.clear()
      orderRef.current = []
      if (container) container.innerHTML = ''
      widgetRef.current = null
    }
  }, [])

  // Fullscreen toggle (desktop convenience)
  const toggleFs = useCallback(async () => {
    const el = wrapRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.()
        setFs(true)
        useTerminal.getState().setChartFs(true)
      } else {
        await document.exitFullscreen?.()
        setFs(false)
        useTerminal.getState().setChartFs(false)
      }
    } catch { /* user-denied or unsupported */ }
  }, [])

  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement
      setFs(isFs)
      useTerminal.getState().setChartFs(isFs)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Register fullscreen toggle handler with terminal store
  useEffect(() => {
    useTerminal.getState().registerChartFsHandler(toggleFs)
    return () => {
      useTerminal.getState().registerChartFsHandler(null)
    }
  }, [toggleFs])

  const digits = meta?.digits || symbolDigits(active)
  const bid = toNum(tick?.bid)
  const ask = toNum(tick?.ask)
  const mid = bid && ask ? (bid + ask) / 2 : 0

  return (
    <div ref={wrapRef} className="flex flex-col h-full min-h-0 bg-surface relative">
      {/* Mobile-only compact tap bar (on mobile viewports only) */}
      {compact && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border-subtle bg-bg-subtle/40">
          <button
            onClick={onOpenWatchlist}
            className="min-w-0 text-left hover:opacity-80 transition-opacity flex items-center gap-1.5 cursor-pointer"
          >
            <span className="text-terminal-title font-semibold terminal-num truncate">{active}</span>
            {meta && (
              <span className="text-terminal-body text-text-muted truncate hidden xs:inline">
                · {meta.display_name}
              </span>
            )}
            <span className="text-terminal-micro text-accent underline ml-1">change</span>
          </button>

          <button
            onClick={toggleMobileDraw}
            className={`shrink-0 h-6 px-2 inline-flex items-center gap-1 rounded text-terminal-micro focus-ring ${mobileDraw ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text'}`}
            aria-pressed={mobileDraw}
            aria-label="Toggle drawing tools"
          >
            <PencilRuler className="h-3 w-3" /> Draw
          </button>
        </div>
      )}

      {/* Fullscreen Floating Exit Button (when in browser native fullscreen) */}
      {fullscreen && (
        <button
          type="button"
          onClick={toggleFs}
          className="absolute top-3 right-3 z-30 h-8 px-2.5 rounded-lg bg-surface/90 border border-border text-text hover:text-accent backdrop-blur-md shadow-lg flex items-center gap-1.5 text-terminal-body font-semibold cursor-pointer"
          title="Exit Fullscreen"
        >
          <Minimize2 className="h-4 w-4" />
          <span>Exit Fullscreen</span>
        </button>
      )}

      {/* Chart host */}
      <div ref={chartHostRef} className="relative flex-1 min-h-0" style={{ touchAction: 'pan-y' }}>
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface z-[1]">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 text-terminal-body text-text-muted"
            >
              <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              Loading chart…
            </motion.div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <div>
              <div className="text-terminal-body text-text-muted">Chart temporarily unavailable</div>
              <div className="text-terminal-micro text-text-faint mt-1">{error}</div>
            </div>
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Floating Scalper Execution Header docked at bottom-center — Draggable across chart canvas */}
        {ready && showOneClick && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-[25] px-2">
            <motion.div
              drag
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={chartHostRef}
              dragMomentum={false}
              dragElastic={0.05}
              className="pointer-events-auto max-w-full"
              style={{ touchAction: 'none' }}
            >
              <ScalperExecutionHeader
                symbol={active}
                bid={bid || 0}
                ask={ask || 0}
                digits={digits}
                pipSize={pipSize(active, digits)}
                isSlRequired={isSlRequired}
                compact={compact}
                onChanged={onChanged}
                dragHandleProps={{
                  onPointerDown: (e) => dragControls.start(e),
                }}
              />
            </motion.div>
          </div>
        )}
      </div>

      {/* Chart data disclosure + session-retention note */}
      {compact ? (
        <div className="absolute bottom-1 left-1.5 z-10 pointer-events-auto">
          <button
            type="button"
            className="p-1 rounded bg-surface/85 hover:bg-surface border border-border/40 text-text-faint hover:text-text-muted shadow-xs transition-colors backdrop-blur-xs flex items-center justify-center cursor-pointer"
            title="Chart data is provided by TradingView reference feeds. Trade execution and challenge evaluation use platform pricing."
            aria-label="Feed disclaimer"
            onClick={() => {
              toast.info('Chart data is provided by TradingView reference feeds. Trade execution and challenge evaluation use platform pricing.')
            }}
          >
            <Info className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="shrink-0 px-3 py-1 border-t border-border-subtle bg-bg-subtle/30 text-terminal-micro leading-tight text-text-faint flex flex-wrap gap-x-3 gap-y-0.5">
          <span>Chart data is provided by TradingView reference feeds. Trade execution and challenge evaluation use platform pricing.</span>
          <span>Recent chart drawings remain available while working between your recent charts during the current session.</span>
        </div>
      )}
    </div>
  )
})
