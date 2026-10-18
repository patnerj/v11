'use client'

import React, { useEffect, useRef, useState, useId, memo } from 'react'
import { Activity, ShieldCheck, AlertCircle, Clock, Maximize2, Radio, Zap, BarChart3 } from 'lucide-react'
import { useIsDarkTheme } from '@/hooks/use-theme-attribute'
import { cn } from '@/lib/cn'
import { Mt5ChartPanel } from '@/components/dashboard/trading/mt5-chart'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'

interface ArenaChartProps {
  symbol: string
  height?: number
  currentPrice?: number
}

function resolveTvSymbol(sym: string): string {
  const s = (sym || 'EURUSD').toUpperCase()
  if (s === 'BTCUSD' || s === 'BTCUSDT') return 'BINANCE:BTCUSDT'
  if (s === 'ETHUSD' || s === 'ETHUSDT') return 'BINANCE:ETHUSDT'
  if (s === 'EURUSD') return 'FX:EURUSD'
  if (s === 'GBPUSD') return 'FX:GBPUSD'
  if (s === 'USDJPY') return 'FX:USDJPY'
  if (s === 'XAUUSD' || s === 'GOLD') return 'OANDA:XAUUSD'
  if (s === 'US30') return 'TVC:DJI'
  if (s === 'NAS100') return 'NASDAQ:NDX'
  return `FX:${s}`
}

function isCryptoSymbol(sym: string): boolean {
  const s = (sym || '').toUpperCase()
  return s.includes('BTC') || s.includes('ETH') || s.includes('SOL')
}

export const ArenaChart = memo(function ArenaChart({
  symbol,
  height = 420,
  currentPrice,
}: ArenaChartProps) {
  const isDark = useIsDarkTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const reactId = useId()
  const cleanId = reactId.replace(/[^a-zA-Z0-9_-]/g, '')
  const containerId = useRef(`tv_arena_chart_${cleanId}`)
  const [mounted, setMounted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [chartEngine, setChartEngine] = useState<'mt5' | 'tv'>(() => {
    if (typeof window === 'undefined') return 'mt5'
    try {
      return (localStorage.getItem('fxsim:arena:chart_engine') as 'mt5' | 'tv') || 'mt5'
    } catch {
      return 'mt5'
    }
  })

  const handleEngineChange = (engine: 'mt5' | 'tv') => {
    setChartEngine(engine)
    try {
      localStorage.setItem('fxsim:arena:chart_engine', engine)
    } catch {}
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Market hours status (UTC based) - guarded for client mount to eliminate SSR divergence
  const isCrypto = isCryptoSymbol(symbol)
  const isForexClosed = mounted && !isCrypto && (() => {
    const now = new Date()
    const utcDay = now.getUTCDay() // 0=Sun, 6=Sat
    const utcHours = now.getUTCHours()
    return (
      utcDay === 6 || // Saturday
      (utcDay === 0 && utcHours < 22) || // Sunday before 22:00 UTC
      (utcDay === 5 && utcHours >= 22) // Friday after 22:00 UTC
    )
  })()

  const resolved = resolveTvSymbol(symbol)

  useEffect(() => {
    if (chartEngine !== 'tv') return
    let active = true
    setError(null)
    setLoaded(false)

    // Load TradingView library if needed
    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).TradingView) {
          resolve()
          return
        }
        const existing = document.getElementById('tradingview-widget-script')
        if (existing) {
          existing.addEventListener('load', () => resolve())
          return
        }
        const s = document.createElement('script')
        s.id = 'tradingview-widget-script'
        s.src = 'https://s3.tradingview.com/tv.js'
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('Failed to load TradingView script'))
        document.head.appendChild(s)
      })
    }

    loadScript()
      .then(() => {
        if (!active || !containerRef.current) return

        // Clear existing children
        containerRef.current.innerHTML = ''
        const targetDiv = document.createElement('div')
        targetDiv.id = containerId.current
        targetDiv.style.width = '100%'
        targetDiv.style.height = `${height}px`
        containerRef.current.appendChild(targetDiv)

        try {
          new (window as any).TradingView.widget({
            container_id: containerId.current,
            autosize: true,
            symbol: resolved,
            interval: '5',
            timezone: 'Etc/UTC',
            theme: isDark ? 'dark' : 'light',
            style: '1', // Candlestick
            locale: 'en',
            toolbar_bg: isDark ? '#0F172A' : '#F8FAFC',
            enable_publishing: false,
            allow_symbol_change: false,
            save_image: false,
            hide_side_toolbar: false,
            hide_top_toolbar: false,
            hide_legend: false,
            withdateranges: true,
            studies: [
              'MASimple@tv-basicstudies',
              'RSI@tv-basicstudies',
            ],
            disabled_features: [
              'header_symbol_search',
              'header_compare',
              'symbol_info',
            ],
            enabled_features: [
              'study_templates',
              'side_toolbar_in_fullscreen_mode',
            ],
            overrides: {
              'paneProperties.background': isDark ? '#0F172A' : '#FFFFFF',
              'paneProperties.vertGridProperties.color': isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              'paneProperties.horzGridProperties.color': isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              'mainSeriesProperties.candleStyle.upColor': '#10B981',
              'mainSeriesProperties.candleStyle.downColor': '#EF4444',
              'mainSeriesProperties.candleStyle.drawWick': true,
              'mainSeriesProperties.candleStyle.drawBorder': true,
              'mainSeriesProperties.candleStyle.borderColor': '#374151',
              'mainSeriesProperties.candleStyle.borderUpColor': '#10B981',
              'mainSeriesProperties.candleStyle.borderDownColor': '#EF4444',
              'mainSeriesProperties.candleStyle.wickUpColor': '#10B981',
              'mainSeriesProperties.candleStyle.wickDownColor': '#EF4444',
            },
          })
          setLoaded(true)
        } catch (e: any) {
          setError(e?.message || 'Widget initialization failed')
        }
      })
      .catch((err) => {
        if (active) setError(err?.message || 'TradingView script error')
      })

    return () => {
      active = false
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [resolved, isDark, height, chartEngine])

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xl">
      {/* Institutional Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-surface-muted/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
            <Activity className="h-4 w-4 text-cyan-500 animate-pulse" />
            <span className="text-xs font-black tracking-wider uppercase text-text tabular">
              {symbol}
            </span>
          </div>

          {/* Real-time Market Status Indicator */}
          {isForexClosed ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-2xs font-bold tabular">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>Market Closed (Weekend) · Reopens Sun 22:00 UTC</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-2xs font-bold tabular">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{isCrypto ? '🟢 24/7 Weekend Market Live' : '🟢 Market Open · ECN Feed Active'}</span>
            </div>
          )}
        </div>

        {/* Live Market Price Level & Dual-Engine Switcher */}
        <div className="flex items-center gap-3 tabular">
          {currentPrice && currentPrice > 0 && (
            <div className="text-right">
              <span className="text-2xs uppercase font-semibold text-text-muted mr-1.5">Live Feed:</span>
              <span className="text-sm font-black text-text">
                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: symbol.includes('JPY') ? 3 : symbol.includes('BTC') ? 2 : 4 })}
              </span>
            </div>
          )}

          {/* Dual-Mode Chart Engine Switcher */}
          <div className="inline-flex items-center bg-surface dark:bg-bg-subtle p-0.5 rounded-lg border border-border shadow-xs">
            <button
              type="button"
              onClick={() => handleEngineChange('mt5')}
              className={cn(
                "px-2.5 py-1 rounded-md text-terminal-micro font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                chartEngine === 'mt5'
                  ? "bg-accent text-accent-fg shadow-xs font-bold"
                  : "text-text-muted hover:text-text hover:bg-surface-muted/50"
              )}
              title="Switch to MT5 Pro Native Canvas Chart"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>MT5 Pro</span>
            </button>
            <button
              type="button"
              onClick={() => handleEngineChange('tv')}
              className={cn(
                "px-2.5 py-1 rounded-md text-terminal-micro font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                chartEngine === 'tv'
                  ? "bg-accent text-accent-fg shadow-xs font-bold"
                  : "text-text-muted hover:text-text hover:bg-surface-muted/50"
              )}
              title="Switch to TradingView Chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>TradingView</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Host */}
      <div className="relative w-full bg-bg overflow-hidden" style={{ minHeight: `${height}px`, height: `${height}px` }}>
        {chartEngine === 'mt5' ? (
          <SectionErrorBoundary sectionName="ArenaMt5Chart">
            <Mt5ChartPanel
              symbol={symbol}
              compact={false}
              positions={null}
              pendingOrders={null}
              hideOneClick={true}
            />
          </SectionErrorBoundary>
        ) : (
          <>
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <div className="text-sm font-bold text-text">Live Chart Initializing</div>
                <div className="text-xs text-text-muted max-w-sm">{error}</div>
              </div>
            ) : null}
            <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />
          </>
        )}
      </div>
    </div>
  )
})
