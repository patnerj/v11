'use client'

/**
 * MT5 Pro Chart Engine — Main Container & Architectural Integration
 * Unifies High-DPI 2D Canvas, Top Controls, Vector Drawing Toolbar, One-Click Execution Box,
 * Context Menu, Indicators Modal, and Objects List with full keyboard shortcut bindings.
 */

import React, { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { symbolDigits, pipSize } from '@/lib/symbol-meta'
import { toNum } from '@/lib/format'
import type { Position, PendingOrder } from '@/types/api'
import type {
  Timeframe,
  ChartStyle,
  ThemePreset,
  DrawingTool,
  DrawingObject,
  IndicatorsConfig,
  Mt5CanvasHandle,
} from './types'
import { DEFAULT_INDICATORS } from './types'
import { loadHistoricalCandles, updateCandlesWithLiveTick, getInitialCachedCandles } from './candle-service'
import { Mt5Canvas } from './mt5-canvas'
import { Mt5TopControls } from './mt5-top-controls'
import { Mt5DrawingToolbar, Mt5DrawingInspector } from './mt5-drawing-toolbar'
import { Mt5OneClick } from './mt5-one-click'
import { Mt5ContextMenu, type ContextMenuState } from './mt5-context-menu'
import { Mt5IndicatorsModal } from './mt5-indicators-modal'
import { Mt5ObjectsModal } from './mt5-objects-modal'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

export interface Mt5ChartPanelProps {
  compact?: boolean
  positions?: Position[] | null
  pendingOrders?: PendingOrder[] | null
  plan?: any | null
  onChanged?: () => void
  showTopControls?: boolean
  timeframe?: Timeframe
  onChangeTimeframe?: (tf: Timeframe) => void
  chartStyle?: ChartStyle
  onChangeChartStyle?: (style: ChartStyle) => void
  theme?: ThemePreset
  onChangeTheme?: (theme: ThemePreset) => void
  isIndicatorsModalOpen?: boolean
  onToggleIndicatorsModal?: (open: boolean) => void
  showGrid?: boolean
  onChangeShowGrid?: (show: boolean) => void
  showPeriodSeparators?: boolean
  onChangeShowPeriodSeparators?: (show: boolean) => void
}

export const Mt5ChartPanel = memo(function Mt5ChartPanel({
  compact,
  positions: propPositions,
  pendingOrders: propPending,
  plan,
  onChanged,
  showTopControls = true,
  timeframe: propTimeframe,
  onChangeTimeframe: propOnChangeTimeframe,
  chartStyle: propChartStyle,
  onChangeChartStyle: propOnChangeChartStyle,
  theme: propTheme,
  onChangeTheme: propOnChangeTheme,
  isIndicatorsModalOpen: propIsIndicatorsModalOpen,
  onToggleIndicatorsModal: propOnToggleIndicatorsModal,
  showGrid: propShowGrid,
  onChangeShowGrid: propOnChangeShowGrid,
  showPeriodSeparators: propShowPeriodSeparators,
  onChangeShowPeriodSeparators: propOnChangeShowPeriodSeparators,
}: Mt5ChartPanelProps) {
  const canvasRef = useRef<Mt5CanvasHandle>(null)
  const active = useTerminal((s) => s.active)
  const meta = useTerminal((s) => s.getMeta(active))
  const showOneClick = useTerminal((s) => s.showOneClick)
  const toggleOneClick = useTerminal((s) => s.toggleOneClick)
  const isChartFs = useTerminal((s) => s.isChartFs)
  const toggleChartFs = useTerminal((s) => s.toggleChartFs)

  const tick = usePrices((s) => s.prices[active])
  const storePositions = usePrices((s) => s.positions)
  const storePending = usePrices((s) => s.pending)
  const account = usePrices((s) => s.account)

  const positions = useMemo(() => propPositions ?? storePositions ?? [], [propPositions, storePositions])
  const pendingOrders = useMemo(() => propPending ?? storePending ?? [], [propPending, storePending])

  const digits = useMemo(() => symbolDigits(active, meta), [active, meta])
  const pSize = useMemo(() => pipSize(active, digits), [active, digits])

  // Persistent preferences: Timeframe, Style, Theme, Grid, Separators, Shift
  const [internalTimeframe, setInternalTimeframe] = useState<Timeframe>(() => {
    if (typeof window === 'undefined') return 'H1'
    try { return (localStorage.getItem('fxsim:mt5:tf') as Timeframe) || 'H1' } catch { return 'H1' }
  })
  const timeframe = propTimeframe ?? internalTimeframe

  const [internalChartStyle, setInternalChartStyle] = useState<ChartStyle>(() => {
    if (typeof window === 'undefined') return 'candlestick'
    try { return (localStorage.getItem('fxsim:mt5:style') as ChartStyle) || 'candlestick' } catch { return 'candlestick' }
  })
  const chartStyle = propChartStyle ?? internalChartStyle

  const [internalTheme, setInternalTheme] = useState<ThemePreset>(() => {
    if (typeof window === 'undefined') return 'cyber'
    try { return (localStorage.getItem('fxsim:mt5:theme') as ThemePreset) || 'cyber' } catch { return 'cyber' }
  })
  const theme = propTheme ?? internalTheme

  const [internalShowGrid, setInternalShowGrid] = useState(true)
  const showGrid = propShowGrid ?? internalShowGrid
  const setShowGrid = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof updater === 'function' ? updater(showGrid) : updater
    if (propOnChangeShowGrid) propOnChangeShowGrid(nextVal)
    else setInternalShowGrid(nextVal)
  }, [propOnChangeShowGrid, showGrid])

  const [internalShowPeriodSeparators, setInternalShowPeriodSeparators] = useState(() => timeframe !== 'D1' && timeframe !== 'W1')
  const showPeriodSeparators = propShowPeriodSeparators ?? internalShowPeriodSeparators
  const setShowPeriodSeparators = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof updater === 'function' ? updater(showPeriodSeparators) : updater
    if (propOnChangeShowPeriodSeparators) propOnChangeShowPeriodSeparators(nextVal)
    else setInternalShowPeriodSeparators(nextVal)
  }, [propOnChangeShowPeriodSeparators, showPeriodSeparators])

  const [autoScroll, setAutoScroll] = useState(true)
  const [chartShift, setChartShift] = useState(true)

  // Technical Indicators
  const [indicators, setIndicators] = useState<IndicatorsConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_INDICATORS
    try {
      const saved = localStorage.getItem('fxsim:mt5:indicators')
      return saved ? JSON.parse(saved) : DEFAULT_INDICATORS
    } catch {
      return DEFAULT_INDICATORS
    }
  })
  const [internalIndicatorsOpen, setInternalIndicatorsOpen] = useState(false)
  const isIndicatorsModalOpen = propIsIndicatorsModalOpen ?? internalIndicatorsOpen
  const setIsIndicatorsModalOpen = useCallback((open: boolean) => {
    if (propOnToggleIndicatorsModal) propOnToggleIndicatorsModal(open)
    else setInternalIndicatorsOpen(open)
  }, [propOnToggleIndicatorsModal])

  // Drawing tools & Objects list
  const [activeTool, setActiveTool] = useState<DrawingTool>('select')
  const [magnetMode, setMagnetMode] = useState(false)
  const [isObjectsModalOpen, setIsObjectsModalOpen] = useState(false)
  const [drawings, setDrawings] = useState<DrawingObject[]>([])
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    price: 0,
  })

  // Candles State - Synchronously initialized so chart renders instantly on mount!
  const [candles, setCandles] = useState<any[]>(() => {
    return getInitialCachedCandles({
      symbol: active,
      timeframe,
      anchorPrice: undefined,
      digits,
      pipSize: pSize,
    })
  })
  const [loading, setLoading] = useState(false)

  // Persist drawings per symbol
  const drawingsKey = `fxsim_mt5_drawings_v1_${active}`
  useEffect(() => {
    try {
      const saved = localStorage.getItem(drawingsKey)
      if (saved) {
        setDrawings(JSON.parse(saved))
      } else {
        setDrawings([])
      }
    } catch {
      setDrawings([])
    }
    setSelectedDrawingId(null)
  }, [drawingsKey])

  const saveDrawings = useCallback((nextDrawings: DrawingObject[]) => {
    setDrawings(nextDrawings)
    try {
      localStorage.setItem(drawingsKey, JSON.stringify(nextDrawings))
    } catch {}
  }, [drawingsKey])

  // Load initial historical candles for active symbol & timeframe
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const storeBid = usePrices.getState().prices[active]?.bid
    const anchorPrice = tick && tick.bid ? Number(tick.bid) : storeBid ? Number(storeBid) : undefined
    loadHistoricalCandles({
      symbol: active,
      timeframe,
      anchorPrice,
      digits,
      pipSize: pSize,
    }).then((loadedCandles) => {
      if (!cancelled) {
        const freshBid = usePrices.getState().prices[active]?.bid
        if (freshBid && Number(freshBid) > 0 && loadedCandles.length > 0) {
          const b = Number(freshBid)
          const last = loadedCandles[loadedCandles.length - 1]
          last.close = b
          last.high = Math.max(last.high, b)
          last.low = Math.min(last.low, b)
        }
        setCandles(loadedCandles)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [active, timeframe, digits, pSize])

  // Real-time live tick absorption
  useEffect(() => {
    if (!tick || !tick.bid || Number(tick.bid) <= 0) return
    setCandles((prevCandles) => {
      return updateCandlesWithLiveTick(
        prevCandles,
        { bid: Number(tick.bid), ask: Number(tick.ask || tick.bid), time: tick.ts ? Number(tick.ts) : undefined },
        timeframe,
        digits
      )
    })
  }, [tick, timeframe, digits])

  // Handlers for state updates with localStorage persistence
  const handleTimeframeChange = (tf: Timeframe) => {
    if (propOnChangeTimeframe) propOnChangeTimeframe(tf)
    else setInternalTimeframe(tf)
    try { localStorage.setItem('fxsim:mt5:tf', tf) } catch {}
  }

  const handleChartStyleChange = (st: ChartStyle) => {
    if (propOnChangeChartStyle) propOnChangeChartStyle(st)
    else setInternalChartStyle(st)
    try { localStorage.setItem('fxsim:mt5:style', st) } catch {}
  }

  const handleThemeChange = (th: ThemePreset) => {
    if (propOnChangeTheme) propOnChangeTheme(th)
    else setInternalTheme(th)
    try { localStorage.setItem('fxsim:mt5:theme', th) } catch {}
  }

  const handleUpdateIndicators = (cfg: IndicatorsConfig) => {
    setIndicators(cfg)
    try { localStorage.setItem('fxsim:mt5:indicators', JSON.stringify(cfg)) } catch {}
  }

  // Drawing manipulation callbacks
  const handleAddDrawing = useCallback((newObj: DrawingObject) => {
    setDrawings((prev) => {
      const next = [...prev, newObj]
      try { localStorage.setItem(drawingsKey, JSON.stringify(next)) } catch {}
      return next
    })
    setSelectedDrawingId(newObj.id)
  }, [drawingsKey])

  const handleUpdateDrawing = useCallback((id: string, patch: Partial<DrawingObject>) => {
    setDrawings((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
      try { localStorage.setItem(drawingsKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [drawingsKey])

  const handleDeleteDrawing = useCallback((id: string) => {
    setDrawings((prev) => {
      const next = prev.filter((d) => d.id !== id)
      try { localStorage.setItem(drawingsKey, JSON.stringify(next)) } catch {}
      return next
    })
    if (selectedDrawingId === id) setSelectedDrawingId(null)
  }, [drawingsKey, selectedDrawingId])

  const handleClearAllDrawings = useCallback(() => {
    saveDrawings([])
    setSelectedDrawingId(null)
    toast.info(`Cleared all drawings on ${active}`)
  }, [active, saveDrawings])

  const handleCloneSelected = useCallback(() => {
    if (!selectedDrawingId) return
    const sel = drawings.find((d) => d.id === selectedDrawingId)
    if (!sel) return
    const cloned: DrawingObject = {
      ...sel,
      id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      points: sel.points.map((p) => ({ time: p.time, price: p.price + pSize * 5 })),
      createdAt: Date.now(),
    }
    handleAddDrawing(cloned)
    toast.success('Cloned drawing object')
  }, [selectedDrawingId, drawings, pSize, handleAddDrawing])

  // Context Menu callbacks
  const handleRightClick = useCallback((coords: { x: number; y: number; price: number }) => {
    setContextMenu({
      visible: true,
      x: coords.x,
      y: coords.y,
      price: coords.price,
    })
  }, [])

  const handleAddHorizontalLineAtPrice = useCallback((price: number) => {
    const newHLine: DrawingObject = {
      id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      symbol: active,
      type: 'hline',
      points: [{ time: Date.now(), price }],
      color: '#38BDF8',
      lineWidth: 2,
      lineStyle: 'solid',
      locked: false,
      visible: true,
      createdAt: Date.now(),
    }
    handleAddDrawing(newHLine)
  }, [active, handleAddDrawing])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in inputs or textareas
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Chart styles: Alt+1, Alt+2, Alt+3
      if (e.altKey && e.key === '1') {
        e.preventDefault()
        handleChartStyleChange('bar')
      } else if (e.altKey && e.key === '2') {
        e.preventDefault()
        handleChartStyleChange('candlestick')
      } else if (e.altKey && e.key === '3') {
        e.preventDefault()
        handleChartStyleChange('line')
      } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        toggleOneClick()
      } else if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setIsObjectsModalOpen((v) => !v)
      } else if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setActiveTool((t) => (t === 'crosshair' ? 'select' : 'crosshair'))
      } else if (e.key === 'g' || e.key === 'G') {
        setShowGrid((v) => !v)
      } else if (e.key === 'y' || e.key === 'Y') {
        setShowPeriodSeparators((v) => !v)
      } else if (e.key === 'm' || e.key === 'M') {
        setMagnetMode((v) => !v)
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hline')
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('vline')
      } else if (e.key === 't' || e.key === 'T') {
        setActiveTool('trendline')
      } else if (e.key === 'f' || e.key === 'F') {
        setActiveTool('fibonacci')
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveTool('rectangle')
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveTool('risk-reward')
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool('channel')
      } else if (e.key === 'x' || e.key === 'X') {
        setActiveTool('text')
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        canvasRef.current?.zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        canvasRef.current?.zoomOut()
      } else if (e.key === 'Escape') {
        setActiveTool('select')
        setSelectedDrawingId(null)
        setContextMenu((prev) => ({ ...prev, visible: false }))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          handleDeleteDrawing(selectedDrawingId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedDrawingId, toggleOneClick, handleDeleteDrawing])

  const selectedDrawing = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingId) || null,
    [drawings, selectedDrawingId]
  )

  const liveBid = toNum(tick?.bid)
  const liveAsk = toNum(tick?.ask) || liveBid + pSize * 1.5

  return (
    <div
      className={cn(
        'relative flex flex-col w-full h-full min-h-0 overflow-hidden bg-black select-none',
        isChartFs && 'fixed inset-0 z-50 w-screen h-screen'
      )}
      onClick={() => {
        if (contextMenu.visible) setContextMenu((prev) => ({ ...prev, visible: false }))
      }}
    >
      {/* Top Controls Toolbar */}
      {(showTopControls || isChartFs) && (
        <Mt5TopControls
          timeframe={timeframe}
          onChangeTimeframe={handleTimeframeChange}
          chartStyle={chartStyle}
          onChangeChartStyle={handleChartStyleChange}
          theme={theme}
          onChangeTheme={handleThemeChange}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showPeriodSeparators={showPeriodSeparators}
          onTogglePeriodSeparators={() => setShowPeriodSeparators(!showPeriodSeparators)}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
          chartShift={chartShift}
          onToggleChartShift={() => setChartShift(!chartShift)}
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onOpenIndicators={() => setIsIndicatorsModalOpen(true)}
          showOneClick={showOneClick}
          onToggleOneClick={toggleOneClick}
          isFullscreen={isChartFs}
          onToggleFullscreen={toggleChartFs}
        />
      )}

      {/* Main Chart Area with Docked Left Rail */}
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden flex flex-row">
        {/* Dedicated Docked Left Drawing Rail (44px) — hidden in mobile/compact view so canvas is 100% width */}
        <div className={cn(
          "shrink-0 h-full border-r border-border bg-surface flex-col items-center py-2 z-10 overflow-y-auto no-scrollbar",
          compact ? "hidden" : "w-11 min-w-[44px] hidden md:flex"
        )}>
          <Mt5DrawingToolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            magnetMode={magnetMode}
            onToggleMagnet={() => setMagnetMode(!magnetMode)}
            onOpenObjectsList={() => setIsObjectsModalOpen(true)}
            onClearAll={handleClearAllDrawings}
          />
        </div>

        {/* Canvas & Floating Widgets Area */}
        <div className="relative flex-1 h-full min-w-0 overflow-hidden">
          {/* Top-Left One-Click Trading Widget (Alt+T) */}
          {showOneClick && (
            <Mt5OneClick
              symbol={active}
              bid={liveBid}
              ask={liveAsk}
              digits={digits}
              pipSize={pSize}
              isSlRequired={Boolean(plan?.stop_loss_required)}
              onChanged={onChanged}
            />
          )}

          {/* Floating Drawing Inspector */}
          <Mt5DrawingInspector
            selectedDrawing={selectedDrawing}
            onUpdateSelected={(patch) => {
              if (selectedDrawingId) handleUpdateDrawing(selectedDrawingId, patch)
            }}
            onDeleteSelected={() => {
              if (selectedDrawingId) handleDeleteDrawing(selectedDrawingId)
            }}
            onCloneSelected={handleCloneSelected}
            onDeselect={() => setSelectedDrawingId(null)}
          />

          {/* 60 FPS High-DPI Canvas Core */}
          <Mt5Canvas
            ref={canvasRef}
            symbol={active}
            digits={digits}
            candles={candles}
            timeframe={timeframe}
            chartStyle={chartStyle}
            theme={theme}
            showGrid={showGrid}
            showPeriodSeparators={showPeriodSeparators}
            autoScroll={autoScroll}
            chartShift={chartShift}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            magnetMode={magnetMode}
            drawings={drawings}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawing={setSelectedDrawingId}
            onUpdateDrawing={handleUpdateDrawing}
            onAddDrawing={handleAddDrawing}
            indicators={indicators}
            positions={positions}
            pendingOrders={pendingOrders}
            accountBalance={toNum(account?.balance) || 10000}
            activeLot={0.1}
            onRightClick={handleRightClick}
            onChanged={onChanged}
          />
        </div>
      </div>

      {/* Right-Click Context Menu */}
      <Mt5ContextMenu
        state={contextMenu}
        symbol={active}
        bid={liveBid}
        ask={liveAsk}
        digits={digits}
        lotSize={0.1}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        onAddHorizontalLine={handleAddHorizontalLineAtPrice}
        onResetScale={() => canvasRef.current?.resetScale()}
        onOpenObjectsList={() => setIsObjectsModalOpen(true)}
        onOpenProperties={() => setIsIndicatorsModalOpen(true)}
        onChanged={onChanged}
      />

      {/* Technical Indicators & Properties Settings Modal */}
      <Mt5IndicatorsModal
        isOpen={isIndicatorsModalOpen}
        onClose={() => setIsIndicatorsModalOpen(false)}
        config={indicators}
        onChangeConfig={handleUpdateIndicators}
        theme={theme}
        onChangeTheme={handleThemeChange}
        showGrid={showGrid}
        onChangeShowGrid={setShowGrid}
        showPeriodSeparators={showPeriodSeparators}
        onChangeShowPeriodSeparators={setShowPeriodSeparators}
      />

      {/* Manage Objects & Drawings Modal (Ctrl+B) */}
      <Mt5ObjectsModal
        isOpen={isObjectsModalOpen}
        onClose={() => setIsObjectsModalOpen(false)}
        symbol={active}
        digits={digits}
        drawings={drawings}
        onUpdateDrawing={handleUpdateDrawing}
        onDeleteDrawing={handleDeleteDrawing}
        onClearAll={handleClearAllDrawings}
      />
    </div>
  )
})
