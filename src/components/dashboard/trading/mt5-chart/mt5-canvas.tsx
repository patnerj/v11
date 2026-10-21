'use client'

/**
 * MT5 Pro Chart Engine — High-Frequency HTML5 2D Canvas Core
 * 60 FPS requestAnimationFrame rendering with DPI awareness, MT5 camera & axis physics,
 * on-chart trade drag-and-drop lines, persistent vector drawings, and technical indicators.
 */

import React, {
  memo,
  forwardRef,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useImperativeHandle,
} from 'react'
import type {
  Candle,
  Timeframe,
  ChartStyle,
  ThemePreset,
  DrawingTool,
  DrawingObject,
  Point,
  IndicatorsConfig,
  PipRulerState,
  Mt5CanvasHandle,
} from './types'
import { THEMES, TIMEFRAME_SECONDS } from './types'
import {
  calcEMA,
  calcSMA,
  calcBollingerBands,
  calcVWAP,
  calcRSI,
  calcMACD,
  calcHeikinAshi,
  isSessionTime,
} from './mt5-indicators'
import { formatCountdown, getCandleCountdownSeconds } from './candle-service'
import { fmtPrice, fmtLots, toNum } from '@/lib/format'
import { pipSize, getSymbolMeta } from '@/lib/symbol-meta'
import { calculateLivePositionPnL, calcLevelPnL, quoteToUsdRate } from '@/lib/order-math'
import type { Position, PendingOrder } from '@/types/api'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { toast } from 'sonner'
import { playOrderSuccessSound, playOrderLossThumpSound } from '@/lib/sound-effects'
import { cn } from '@/lib/cn'
import { usePrices } from '@/store/prices'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

const PRICE_AXIS_WIDTH = 88
const TIME_AXIS_HEIGHT = 26
const SUB_PANE_HEIGHT = 100

const SANS_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif'
const FONT_MICRO = `9px ${SANS_STACK}`
const FONT_MICRO_BOLD = `bold 9px ${SANS_STACK}`
const FONT_LABEL = `11px ${SANS_STACK}`
const FONT_LABEL_BOLD = `bold 11px ${SANS_STACK}`
const FONT_BODY_BOLD = `bold 12px ${SANS_STACK}`
const FONT_CLOSE_BTN = `bold 14px ${SANS_STACK}`

function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x0, py - y0)
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

function distToRay(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x0, py - y0)
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq
  t = Math.max(0, t)
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

function getNicePriceStep(range: number, targetCount: number): number {
  if (range <= 0 || targetCount <= 0) return 1
  const rawStep = range / targetCount
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const fraction = rawStep / power
  let niceFraction: number
  if (fraction < 1.5) niceFraction = 1
  else if (fraction < 3) niceFraction = 2
  else if (fraction < 7) niceFraction = 5
  else niceFraction = 10
  return niceFraction * power
}

function getSymbolMinTriggerDist(sym: string): number {
  const s = sym.toUpperCase()
  if (s.includes('BTC') || s.includes('ETH')) return 10.0
  if (s.includes('US30') || s.includes('NAS100') || s.includes('SPX') || s.includes('GER40') || s.includes('UK100') || s.includes('DAX')) return 10.0
  if (s.includes('USOIL') || s.includes('UKOIL') || s.includes('OIL') || s.includes('BRENT')) return 0.10
  if (s.includes('SOL')) return 0.10
  if (s.includes('XAU') || s.includes('GOLD')) return 0.5
  if (s.includes('XAG') || s.includes('SILVER')) return 0.05
  if (s.includes('JPY')) return 0.1
  return 0.0010
}

interface Mt5CanvasProps {
  symbol: string
  digits: number
  candles: Candle[]
  timeframe: Timeframe
  chartStyle: ChartStyle
  theme: ThemePreset
  showGrid: boolean
  showPeriodSeparators: boolean
  autoScroll: boolean
  chartShift: boolean
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  magnetMode: boolean
  drawings: DrawingObject[]
  selectedDrawingId: string | null
  onSelectDrawing: (id: string | null) => void
  onUpdateDrawing: (id: string, patch: Partial<DrawingObject>) => void
  onAddDrawing: (drawing: DrawingObject) => void
  indicators: IndicatorsConfig
  positions: Position[]
  pendingOrders: PendingOrder[]
  accountBalance?: number
  activeLot?: number
  onRightClick: (coords: { x: number; y: number; price: number }) => void
  onChanged?: () => void
}

export const Mt5Canvas = memo(
  forwardRef<Mt5CanvasHandle, Mt5CanvasProps>(function Mt5Canvas(
    {
      symbol,
      digits,
      candles,
      timeframe,
      chartStyle,
      theme,
      showGrid,
      showPeriodSeparators,
      autoScroll,
      chartShift,
      activeTool,
      onSelectTool,
      magnetMode,
      drawings,
      selectedDrawingId,
      onSelectDrawing,
      onUpdateDrawing,
      onAddDrawing,
      indicators,
      positions,
      pendingOrders,
      accountBalance = 10000,
      activeLot = 0.1,
      onRightClick,
      onChanged,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Camera & viewport physics
    const [candleWidth, setCandleWidth] = useState(8) // Zoom level (pixels per candle)
    const [scrollOffset, setScrollOffset] = useState(0) // Candles shifted into past (0 = latest on right)
    const [yScaleFactor, setYScaleFactor] = useState(1.0) // Manual Y-scale expansion factor
    const [yScaleOffset, setYScaleOffset] = useState(0) // Vertical pan offset in price units
    const [canvasCursor, setCanvasCursor] = useState<'crosshair' | 'grab' | 'grabbing' | 'ns-resize'>('crosshair')

    // Mouse & interaction states
    const mousePosRef = useRef<{ x: number; y: number; onAxis: boolean; onChart: boolean } | null>(null)
    const [mousePos, setMousePos] = useState<{ x: number; y: number; onAxis: boolean; onChart: boolean } | null>(null)
    const isDraggingChartRef = useRef(false)
    const isDraggingAxisRef = useRef(false)
    const dragStartRef = useRef<{
      x: number
      y: number
      scrollOffset: number
      yScaleFactor: number
      yScaleOffset: number
    } | null>(null)

    // Live state synchronization refs for 60fps touch gestures
    const candleWidthRef = useRef(candleWidth)
    candleWidthRef.current = candleWidth
    const scrollOffsetRef = useRef(scrollOffset)
    scrollOffsetRef.current = scrollOffset
    const yScaleOffsetRef = useRef(yScaleOffset)
    yScaleOffsetRef.current = yScaleOffset
    const yScaleFactorRef = useRef(yScaleFactor)
    yScaleFactorRef.current = yScaleFactor
    const candlesRef = useRef(candles)
    candlesRef.current = candles
    const positionsRef = useRef(positions)
    positionsRef.current = positions
    const pendingOrdersRef = useRef(pendingOrders)
    pendingOrdersRef.current = pendingOrders
    const indicatorsRef = useRef(indicators)
    indicatorsRef.current = indicators

    // Touch & Multi-Touch Gesture Engine state
    const touchStateRef = useRef<{
      isDragging: boolean
      isPinching: boolean
      isDraggingSlTp: boolean
      isDraggingPending: boolean
      startX: number
      startY: number
      startScrollOffset: number
      startYScaleOffset: number
      startYScaleFactor: number
      initialPinchDistance: number
      initialCandleWidth: number
      lastTapTime: number
      isAxisDrag: boolean
    }>({
      isDragging: false,
      isPinching: false,
      isDraggingSlTp: false,
      isDraggingPending: false,
      startX: 0,
      startY: 0,
      startScrollOffset: 0,
      startYScaleOffset: 0,
      startYScaleFactor: 1.0,
      initialPinchDistance: 0,
      initialCandleWidth: 10,
      lastTapTime: 0,
      isAxisDrag: false,
    })

    // Interactive SL/TP drag state
    const draggingSlTpRef = useRef<{
      posId: number
      type: 'sl' | 'tp' | 'new_sl' | 'new_tp'
      currentPrice: number
      initialPrice: number
      pos: Position
    } | null>(null)
    const [draggingSlTpPreview, setDraggingSlTpPreview] = useState<{
      posId: number
      type: 'sl' | 'tp' | 'new_sl' | 'new_tp'
      price: number
      pips: number
      estPnL: number
    } | null>(null)

    // Interactive Pending order drag state
    const draggingPendingRef = useRef<{
      ordId: number
      order: PendingOrder
      currentPrice: number
      initialPrice: number
    } | null>(null)
    const [draggingPendingPreview, setDraggingPendingPreview] = useState<{
      ordId: number
      price: number
    } | null>(null)

    // Vector drawing creation & modification state
    const drawingInProgressRef = useRef<DrawingObject | null>(null)
    const draggingAnchorRef = useRef<{ drawingId: string; pointIndex: number } | null>(null)
    const draggingDrawingBodyRef = useRef<{
      drawingId: string
      startX: number
      startY: number
      initialPoints: Point[]
    } | null>(null)

    // Pip ruler measurement state
    const rulerRef = useRef<PipRulerState>({
      active: false,
      startPoint: null,
      currentPoint: null,
      startScreen: null,
      currentScreen: null,
    })
    const [rulerDisplay, setRulerDisplay] = useState<PipRulerState | null>(null)

    // Countdown clock state
    const [countdown, setCountdown] = useState(getCandleCountdownSeconds(timeframe))
    useEffect(() => {
      const timer = setInterval(() => {
        setCountdown(getCandleCountdownSeconds(timeframe))
      }, 1000)
      return () => clearInterval(timer)
    }, [timeframe])

    const pSize = useMemo(() => pipSize(symbol, digits), [symbol, digits])
    const colors = THEMES[theme] || THEMES.classic

    // Auto-scroll when new candles arrive if enabled
    useEffect(() => {
      if (autoScroll) {
        setScrollOffset(0)
      }
    }, [candles.length, autoScroll])

    // Auto-align camera when symbol or timeframe changes
    useEffect(() => {
      setScrollOffset(0)
      setYScaleOffset(0)
      setYScaleFactor(1.0)
    }, [symbol, timeframe])

    // Imperative Camera Controls
    const zoomIn = useCallback(() => {
      setCandleWidth((prev) => Math.min(48, parseFloat((prev * 1.2).toFixed(2))))
    }, [])

    const zoomOut = useCallback(() => {
      setCandleWidth((prev) => Math.max(2.5, parseFloat((prev * 0.83).toFixed(2))))
    }, [])

    const resetScale = useCallback(() => {
      setYScaleFactor(1.0)
      setYScaleOffset(0)
      setScrollOffset(0)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        zoomIn,
        zoomOut,
        resetScale,
      }),
      [zoomIn, zoomOut, resetScale]
    )

    // Sub-pane active detection
    const hasSubPane = indicators.rsi.enabled || indicators.macd.enabled

    // Calculate layout metrics
    const getLayout = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return { width: 800, height: 500, mainH: 500, subH: 0, chartW: 725 }
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const subH = hasSubPane ? SUB_PANE_HEIGHT : 0
      const mainH = height - TIME_AXIS_HEIGHT - subH
      const chartW = width - PRICE_AXIS_WIDTH
      return { width, height, mainH, subH, chartW }
    }, [hasSubPane])

    // Get visible slice of candles
    const getVisibleSlice = useCallback(() => {
      const { chartW } = getLayout()
      const totalCandles = candles.length
      if (totalCandles === 0) return { visible: [], startIndex: 0, endIndex: 0 }

      const shiftOffset = chartShift ? 8 : 0
      const visibleCount = Math.ceil(chartW / candleWidth) + 4
      const endIndex = Math.min(totalCandles - 1, totalCandles - 1 - Math.floor(scrollOffset) + shiftOffset)
      const startIndex = Math.max(0, endIndex - visibleCount)

      const visible = candles.slice(startIndex, endIndex + 1)
      return { visible, startIndex, endIndex }
    }, [candles, candleWidth, scrollOffset, chartShift, getLayout])

    // Price bounds with manual scale factor
    const getPriceBounds = useCallback(() => {
      const { visible } = getVisibleSlice()
      if (visible.length === 0) return { min: 1.0, max: 1.1, range: 0.1 }

      let min = Infinity
      let max = -Infinity

      for (const c of visible) {
        if (c.low < min) min = c.low
        if (c.high > max) max = c.high
      }

      // Ensure live Bid & Ask fit inside bounds smoothly
      const activeTick = usePrices.getState().prices[symbol]
      const curBid = toNum(activeTick?.bid)
      const curAsk = toNum(activeTick?.ask)
      if (curBid > 0) {
        if (curBid < min) min = curBid
        if (curBid > max) max = curBid
      }
      if (curAsk > 0) {
        if (curAsk < min) min = curAsk
        if (curAsk > max) max = curAsk
      }

      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        min = 1.0
        max = 1.1
      }

      // Add padding (7% top/bottom)
      const pad = (max - min) * 0.07 || pSize * 20
      const rawMin = min - pad
      const rawMax = max + pad
      const mid = (rawMin + rawMax) / 2
      const halfSpan = ((rawMax - rawMin) / 2) * (1 / yScaleFactor)

      const finalMin = mid - halfSpan + yScaleOffset
      const finalMax = mid + halfSpan + yScaleOffset

      return { min: finalMin, max: finalMax, range: finalMax - finalMin }
    }, [getVisibleSlice, yScaleFactor, yScaleOffset, pSize])

    // Coordinate conversions: Price <-> Y, Time/Index <-> X
    const priceToY = useCallback(
      (price: number): number => {
        const { mainH } = getLayout()
        const { min, range } = getPriceBounds()
        if (range <= 0) return mainH / 2
        return mainH - ((price - min) / range) * mainH
      },
      [getLayout, getPriceBounds]
    )

    const yToPrice = useCallback(
      (y: number): number => {
        const { mainH } = getLayout()
        const { min, range } = getPriceBounds()
        if (mainH <= 0) return min
        return min + ((mainH - y) / mainH) * range
      },
      [getLayout, getPriceBounds]
    )

    const candleIndexToX = useCallback(
      (index: number): number => {
        const { chartW } = getLayout()
        const total = candles.length
        const shiftOffset = chartShift ? 8 * candleWidth : 0
        const distFromEnd = total - 1 - index
        return chartW - shiftOffset - (distFromEnd - scrollOffset) * candleWidth
      },
      [getLayout, candles.length, chartShift, candleWidth, scrollOffset]
    )

    const xToCandleIndex = useCallback(
      (x: number): number => {
        const { chartW } = getLayout()
        const total = candles.length
        const shiftOffset = chartShift ? 8 * candleWidth : 0
        const pxFromRight = chartW - shiftOffset - x
        const distFromEnd = pxFromRight / candleWidth + scrollOffset
        return Math.round(total - 1 - distFromEnd)
      },
      [getLayout, candles.length, chartShift, candleWidth, scrollOffset]
    )

    // Continuous time to X coordinate conversion
    const timeToX = useCallback(
      (time: number): number => {
        const { chartW } = getLayout()
        const total = candles.length
        if (total === 0) return chartW / 2
        const tfMs = TIMEFRAME_SECONDS[timeframe] * 1000
        const lastTime = candles[total - 1].time
        const firstTime = candles[0].time

        let virtualIdx: number
        if (time >= lastTime) {
          virtualIdx = total - 1 + (time - lastTime) / tfMs
        } else if (time <= firstTime) {
          virtualIdx = (time - firstTime) / tfMs
        } else {
          let low = 0
          let high = total - 1
          let exactIdx: number | null = null
          while (low <= high) {
            const mid = (low + high) >> 1
            if (candles[mid].time === time) {
              exactIdx = mid
              break
            } else if (candles[mid].time < time) {
              low = mid + 1
            } else {
              high = mid - 1
            }
          }
          if (exactIdx !== null) {
            virtualIdx = exactIdx
          } else {
            const idx0 = Math.max(0, high)
            const idx1 = Math.min(total - 1, idx0 + 1)
            const t0 = candles[idx0].time
            const t1 = candles[idx1].time
            const span = t1 - t0 || tfMs
            const frac = Math.max(0, Math.min(1, (time - t0) / span))
            virtualIdx = idx0 + frac
          }
        }

        return candleIndexToX(virtualIdx)
      },
      [candles, timeframe, candleIndexToX, getLayout]
    )

    // Continuous X to time conversion
    const xToTime = useCallback(
      (x: number): number => {
        const { chartW } = getLayout()
        const total = candles.length
        if (total === 0) return Date.now()
        const tfMs = TIMEFRAME_SECONDS[timeframe] * 1000
        const shiftOffset = chartShift ? 8 * candleWidth : 0
        const pxFromRight = chartW - shiftOffset - x
        const distFromEnd = pxFromRight / candleWidth + scrollOffset
        const virtualIdx = total - 1 - distFromEnd

        const lastTime = candles[total - 1].time
        const firstTime = candles[0].time

        if (virtualIdx >= total - 1) {
          return lastTime + (virtualIdx - (total - 1)) * tfMs
        } else if (virtualIdx <= 0) {
          return firstTime + virtualIdx * tfMs
        } else {
          const i0 = Math.floor(virtualIdx)
          const frac = virtualIdx - i0
          const i1 = Math.min(total - 1, i0 + 1)
          const t0 = candles[i0].time
          const t1 = candles[i1].time
          return Math.round(t0 + frac * (t1 - t0))
        }
      },
      [candles, timeframe, candleWidth, scrollOffset, chartShift, getLayout]
    )

    // Snap point to nearest candle OHLC if Magnet Mode is enabled
    const snapToCandle = useCallback(
      (p: Point): Point => {
        if (!magnetMode || candles.length === 0) return p
        const tfMs = TIMEFRAME_SECONDS[timeframe] * 1000
        let closestIdx = 0
        let minTDiff = Math.abs(candles[0].time - p.time)
        for (let i = 1; i < candles.length; i++) {
          const diff = Math.abs(candles[i].time - p.time)
          if (diff < minTDiff) {
            minTDiff = diff
            closestIdx = i
          }
        }
        if (minTDiff > tfMs * 3) return p
        const c = candles[closestIdx]
        const candidates = [c.open, c.high, c.low, c.close]
        let closestP = candidates[0]
        let minDist = Math.abs(closestP - p.price)
        for (let i = 1; i < candidates.length; i++) {
          const dist = Math.abs(candidates[i] - p.price)
          if (dist < minDist) {
            minDist = dist
            closestP = candidates[i]
          }
        }
        return { time: c.time, price: closestP }
      },
      [magnetMode, candles, timeframe]
    )

    // Main Render Loop (60 FPS High-DPI Canvas)
    const renderChart = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
      }

      ctx.save()
      try {
        ctx.scale(dpr, dpr)

      const { mainH, subH, chartW } = getLayout()
      const { visible, startIndex, endIndex } = getVisibleSlice()
      const { min: minP, max: maxP, range: rangeP } = getPriceBounds()

      const activePrices = usePrices.getState().prices
      const activeTick = activePrices[symbol]
      const liveBid = toNum(activeTick?.bid) || (visible.length > 0 ? visible[visible.length - 1].close : 0)
      const liveAsk = toNum(activeTick?.ask) || (liveBid > 0 ? liveBid + pSize * 1.5 : 0)

      // 1. Background
      ctx.fillStyle = colors.background
      ctx.fillRect(0, 0, width, height)

      // 2. Dotted Grid (G)
      if (showGrid && rangeP > 0) {
        ctx.save()
        try {
        ctx.strokeStyle = colors.grid
        ctx.lineWidth = 1
        ctx.setLineDash([1, 3])

        // Horizontal price grid lines
        const targetTicks = Math.max(8, Math.floor(mainH / 45))
        const gridStep = getNicePriceStep(rangeP, targetTicks)
        const firstGrid = Math.ceil(minP / gridStep) * gridStep
        for (let p = firstGrid; p <= maxP; p += gridStep) {
          const y = priceToY(p)
          if (y > 0 && y < mainH) {
            ctx.beginPath()
            ctx.moveTo(0, Math.floor(y) + 0.5)
            ctx.lineTo(chartW, Math.floor(y) + 0.5)
            ctx.stroke()
          }
        }

        // Vertical time grid lines
        const xStep = Math.max(70, candleWidth * 8)
        for (let x = chartW % xStep; x < chartW; x += xStep) {
          ctx.beginPath()
          ctx.moveTo(Math.floor(x) + 0.5, 0)
          ctx.lineTo(Math.floor(x) + 0.5, mainH)
          ctx.stroke()
        }
        } finally {
          ctx.restore()
        }
      }

      // 3. Period Separators (Y) — smart multi-timeframe boundaries
      if (showPeriodSeparators) {
        ctx.save()
        try {
        ctx.strokeStyle = colors.gridPeriod
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])

        for (let i = 1; i < visible.length; i++) {
          const prev = new Date(visible[i - 1].time)
          const curr = new Date(visible[i].time)
          let isNewPeriod = false

          if (timeframe === 'D1') {
            // Separator on Month change (1st trading day of each month)
            isNewPeriod = prev.getUTCMonth() !== curr.getUTCMonth() || prev.getUTCFullYear() !== curr.getUTCFullYear()
          } else if (timeframe === 'W1') {
            // Separator on Year change
            isNewPeriod = prev.getUTCFullYear() !== curr.getUTCFullYear()
          } else if (timeframe === 'H4') {
            // Separator on Week change (Sunday / Monday boundary)
            const prevWeek = Math.floor(prev.getTime() / (7 * 86400000))
            const currWeek = Math.floor(curr.getTime() / (7 * 86400000))
            isNewPeriod = prevWeek !== currWeek || curr.getUTCDay() < prev.getUTCDay()
          } else {
            // Intraday (M1, M5, M15, M30, H1): Separator on Day change
            isNewPeriod = prev.getUTCDate() !== curr.getUTCDate()
          }

          if (isNewPeriod) {
            const x = candleIndexToX(startIndex + i)
            if (x > 0 && x < chartW) {
              ctx.beginPath()
              ctx.moveTo(Math.floor(x) + 0.5, 0)
              ctx.lineTo(Math.floor(x) + 0.5, mainH)
              ctx.stroke()
            }
          }
        }
        } finally {
          ctx.restore()
        }
      }

      // 4. Killzone Sessions Overlay
      if (indicators.killzones.enabled) {
        ctx.save()
        try {
        for (let i = 0; i < visible.length; i++) {
          const c = visible[i]
          const x = candleIndexToX(startIndex + i)
          if (indicators.killzones.asian && isSessionTime(c.time, 'asian')) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.04)'
            ctx.fillRect(x - candleWidth / 2, 0, candleWidth, mainH)
          } else if (indicators.killzones.london && isSessionTime(c.time, 'london')) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.05)'
            ctx.fillRect(x - candleWidth / 2, 0, candleWidth, mainH)
          } else if (indicators.killzones.ny && isSessionTime(c.time, 'ny')) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.05)'
            ctx.fillRect(x - candleWidth / 2, 0, candleWidth, mainH)
          }
        }
        } finally {
          ctx.restore()
        }
      }

      // 5. Technical Overlays (SMA, EMA, Bollinger Bands, VWAP)
      if (indicators.bb.enabled) {
        const bb = calcBollingerBands(candles, indicators.bb.period, indicators.bb.stdDev)
        ctx.save()
        try {
        ctx.strokeStyle = indicators.bb.color
        ctx.lineWidth = 1
        ctx.fillStyle = 'rgba(99, 102, 241, 0.05)'

        ctx.beginPath()
        let started = false
        for (let i = startIndex; i <= endIndex; i++) {
          const u = bb.upper[i]
          if (u !== null) {
            const x = candleIndexToX(i)
            const y = priceToY(u)
            if (!started) {
              ctx.moveTo(x, y)
              started = true
            } else ctx.lineTo(x, y)
          }
        }
        for (let i = endIndex; i >= startIndex; i--) {
          const l = bb.lower[i]
          if (l !== null) {
            const x = candleIndexToX(i)
            const y = priceToY(l)
            ctx.lineTo(x, y)
          }
        }
        ctx.closePath()
        ctx.fill()

        const drawLine = (arr: (number | null)[]) => {
          ctx.beginPath()
          let s = false
          for (let i = startIndex; i <= endIndex; i++) {
            const val = arr[i]
            if (val !== null) {
              const x = candleIndexToX(i)
              const y = priceToY(val)
              if (!s) {
                ctx.moveTo(x, y)
                s = true
              } else ctx.lineTo(x, y)
            }
          }
          ctx.stroke()
        }
        drawLine(bb.upper)
        drawLine(bb.middle)
        drawLine(bb.lower)
        } finally {
          ctx.restore()
        }
      }

      // EMA overlays
      if (indicators.ema.enabled) {
        const renderEMA = (period: number, color: string) => {
          const emaValues = calcEMA(candles, period)
          ctx.save()
          try {
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          let s = false
          for (let i = startIndex; i <= endIndex; i++) {
            const val = emaValues[i]
            if (val !== null) {
              const x = candleIndexToX(i)
              const y = priceToY(val)
              if (!s) {
                ctx.moveTo(x, y)
                s = true
              } else ctx.lineTo(x, y)
            }
          }
          ctx.stroke()
          } finally {
            ctx.restore()
          }
        }
        if (indicators.ema.p20) renderEMA(20, indicators.ema.c20)
        if (indicators.ema.p50) renderEMA(50, indicators.ema.c50)
        if (indicators.ema.p200) renderEMA(200, indicators.ema.c200)
      }

      // SMA overlay
      if (indicators.sma.enabled) {
        const smaValues = calcSMA(candles, indicators.sma.period)
        ctx.save()
        try {
        ctx.strokeStyle = indicators.sma.color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        let s = false
        for (let i = startIndex; i <= endIndex; i++) {
          const val = smaValues[i]
          if (val !== null) {
            const x = candleIndexToX(i)
            const y = priceToY(val)
            if (!s) {
              ctx.moveTo(x, y)
              s = true
            } else ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        } finally {
          ctx.restore()
        }
      }

      // VWAP overlay
      if (indicators.vwap.enabled) {
        const vwapValues = calcVWAP(candles)
        ctx.save()
        try {
        ctx.strokeStyle = indicators.vwap.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        let s = false
        for (let i = startIndex; i <= endIndex; i++) {
          const val = vwapValues[i]
          if (val !== null) {
            const x = candleIndexToX(i)
            const y = priceToY(val)
            if (!s) {
              ctx.moveTo(x, y)
              s = true
            } else ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        } finally {
          ctx.restore()
        }
      }

      // 6. Volume Histogram at Bottom of Main Chart
      if (indicators.volume.enabled) {
        const maxVol = Math.max(...visible.map((c) => c.volume), 1)
        const volH = Math.min(60, mainH * 0.18)
        ctx.save()
        try {
        for (let i = 0; i < visible.length; i++) {
          const c = visible[i]
          const x = candleIndexToX(startIndex + i)
          const isUp = c.close >= c.open
          const h = (c.volume / maxVol) * volH
          ctx.fillStyle = isUp ? colors.volumeUp : colors.volumeDown
          ctx.fillRect(x - candleWidth * 0.4, mainH - h, candleWidth * 0.8, h)
        }
        } finally {
          ctx.restore()
        }
      }

      // 7. Render Candles / Bars / Line / Heikin Ashi
      const renderCandles =
        chartStyle === 'heikin-ashi' ? calcHeikinAshi(candles).slice(startIndex, endIndex + 1) : visible

      if (chartStyle === 'line') {
        ctx.save()
        try {
        ctx.strokeStyle = colors.lineColor
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < renderCandles.length; i++) {
          const c = renderCandles[i]
          const isLatestCandle = (startIndex + i) === (candles.length - 1)
          const pxClose = isLatestCandle && liveBid > 0 ? liveBid : c.close
          const x = candleIndexToX(startIndex + i)
          const y = priceToY(pxClose)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        const grad = ctx.createLinearGradient(0, 0, 0, mainH)
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)')
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)')
        ctx.fillStyle = grad
        ctx.lineTo(candleIndexToX(endIndex), mainH)
        ctx.lineTo(candleIndexToX(startIndex), mainH)
        ctx.closePath()
        ctx.fill()
        } finally {
          ctx.restore()
        }
      } else if (chartStyle === 'bar') {
        ctx.save()
        try {
        ctx.lineWidth = 1.5
        for (let i = 0; i < renderCandles.length; i++) {
          const c = renderCandles[i]
          const isLatestCandle = (startIndex + i) === (candles.length - 1)
          const pxClose = isLatestCandle && liveBid > 0 ? liveBid : c.close
          const pxHigh = isLatestCandle && liveBid > 0 ? Math.max(c.high, liveBid) : c.high
          const pxLow = isLatestCandle && liveBid > 0 ? Math.min(c.low, liveBid) : c.low
          const x = candleIndexToX(startIndex + i)
          const isUp = pxClose >= c.open
          const color = isUp ? colors.candleUp : colors.candleDown

          ctx.strokeStyle = color
          const yHigh = priceToY(pxHigh)
          const yLow = priceToY(pxLow)
          const yOpen = priceToY(c.open)
          const yClose = priceToY(pxClose)

          // Vertical spine
          ctx.beginPath()
          ctx.moveTo(Math.floor(x) + 0.5, yHigh)
          ctx.lineTo(Math.floor(x) + 0.5, yLow)
          ctx.stroke()

          // Left open tick
          ctx.beginPath()
          ctx.moveTo(x - candleWidth * 0.45, Math.floor(yOpen) + 0.5)
          ctx.lineTo(x, Math.floor(yOpen) + 0.5)
          ctx.stroke()

          // Right close tick
          ctx.beginPath()
          ctx.moveTo(x, Math.floor(yClose) + 0.5)
          ctx.lineTo(x + candleWidth * 0.45, Math.floor(yClose) + 0.5)
          ctx.stroke()
        }
        } finally {
          ctx.restore()
        }
      } else {
        // Candlesticks
        ctx.save()
        try {
        for (let i = 0; i < renderCandles.length; i++) {
          const c = renderCandles[i]
          const isLatestCandle = (startIndex + i) === (candles.length - 1)
          const pxClose = isLatestCandle && liveBid > 0 ? liveBid : c.close
          const pxHigh = isLatestCandle && liveBid > 0 ? Math.max(c.high, liveBid) : c.high
          const pxLow = isLatestCandle && liveBid > 0 ? Math.min(c.low, liveBid) : c.low
          const x = candleIndexToX(startIndex + i)
          const isUp = pxClose >= c.open

          const yHigh = priceToY(pxHigh)
          const yLow = priceToY(pxLow)
          const yOpen = priceToY(c.open)
          const yClose = priceToY(pxClose)

          const centerX = Math.round(x)
          const rawBodyW = Math.max(1, Math.round(candleWidth * 0.72))
          const bodyW = rawBodyW > 2 ? (rawBodyW % 2 === 0 ? rawBodyW - 1 : rawBodyW) : rawBodyW
          const halfW = Math.floor(bodyW / 2)
          const bodyLeft = centerX - halfW

          const topY = Math.round(Math.min(yOpen, yClose))
          const botY = Math.round(Math.max(yOpen, yClose))
          const bodyH = Math.max(1, botY - topY)
          const yH = Math.round(yHigh)
          const yL = Math.round(yLow)

          // 1. Continuous razor-sharp 1px Wick from High to Low centered at centerX + 0.5
          ctx.strokeStyle = isUp ? colors.candleUpWick : colors.candleDownWick
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(centerX + 0.5, yH)
          ctx.lineTo(centerX + 0.5, yL)
          ctx.stroke()

          // 2. Solid Crisp Body: masks wick cleanly with exact pixel bounds
          ctx.fillStyle = isUp ? colors.candleUp : colors.candleDown
          ctx.fillRect(bodyLeft, topY, bodyW, bodyH)

          // Subtle border if configured and distinct
          if (colors.candleUpBorder && colors.candleUpBorder !== colors.candleUp) {
            ctx.strokeStyle = isUp ? colors.candleUpBorder : colors.candleDownBorder
            ctx.strokeRect(bodyLeft + 0.5, topY + 0.5, bodyW - 1, Math.max(0, bodyH - 1))
          }
        }
        } finally {
          ctx.restore()
        }
      }

      // 8. Vector Drawings (Persistent annotations using continuous coordinates)
      const safeDrawings = Array.isArray(drawings) ? drawings : []
      const allDrawingsToRender: any[] = []
      for (const d of safeDrawings) {
        if (d && typeof d === 'object') allDrawingsToRender.push(d)
      }
      if (drawingInProgressRef.current && typeof drawingInProgressRef.current === 'object') {
        allDrawingsToRender.push(drawingInProgressRef.current)
      }

      for (const d of allDrawingsToRender) {
        try {
          if (!d || !d.visible || !Array.isArray(d.points) || d.points.length === 0) continue

          ctx.save()
          try {
        ctx.strokeStyle = d.color
        ctx.lineWidth = d.lineWidth
        if (d.lineStyle === 'dashed') ctx.setLineDash([6, 4])
        else if (d.lineStyle === 'dotted') ctx.setLineDash([2, 3])
        else ctx.setLineDash([])

        const isSel = d.id === selectedDrawingId

        if (d.type === 'hline') {
          const y = priceToY(d.points[0].price)
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(chartW, y)
          ctx.stroke()

          ctx.fillStyle = d.color
          ctx.fillRect(chartW + 1, y - 9, PRICE_AXIS_WIDTH - 2, 18)
          ctx.fillStyle = '#000000'
          ctx.font = FONT_LABEL_BOLD
          ctx.textAlign = 'center'
          ctx.fillText(fmtPrice(d.points[0].price, digits), chartW + PRICE_AXIS_WIDTH / 2, y + 4)
        } else if (d.type === 'vline') {
          const x = timeToX(d.points[0].time)
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, mainH)
          ctx.stroke()
        } else if (d.type === 'trendline' && d.points.length >= 2) {
          const x0 = timeToX(d.points[0].time)
          const y0 = priceToY(d.points[0].price)
          const x1 = timeToX(d.points[1].time)
          const y1 = priceToY(d.points[1].price)

          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          if (d.extendRight && x1 !== x0) {
            const slope = (y1 - y0) / (x1 - x0)
            const extendedY = y1 + slope * (chartW - x1)
            ctx.lineTo(chartW, extendedY)
          }
          ctx.stroke()

          const deltaPips = Math.abs(d.points[1].price - d.points[0].price) / pSize
          const midX = (x0 + x1) / 2
          const midY = (y0 + y1) / 2
          ctx.fillStyle = 'rgba(0,0,0,0.75)'
          ctx.fillRect(midX - 25, midY - 18, 50, 16)
          ctx.fillStyle = d.color
          ctx.font = FONT_LABEL
          ctx.textAlign = 'center'
          ctx.fillText(`${deltaPips.toFixed(1)}p`, midX, midY - 6)
        } else if (d.type === 'channel' && d.points.length >= 2) {
          // MT5 Equidistant Parallel Channel
          const x0 = timeToX(d.points[0].time)
          const y0 = priceToY(d.points[0].price)
          const x1 = timeToX(d.points[1].time)
          const y1 = priceToY(d.points[1].price)
          const channelHeight =
            d.channelWidth !== undefined
              ? Math.abs(priceToY(d.points[0].price - d.channelWidth) - y0)
              : d.points[2]
              ? priceToY(d.points[2].price) - y0
              : 40

          const y0B = y0 + channelHeight
          const y1B = y1 + channelHeight

          // Shaded band
          ctx.fillStyle = d.color.startsWith('#') ? `${d.color}15` : 'rgba(56, 189, 248, 0.12)'
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.lineTo(x1, y1B)
          ctx.lineTo(x0, y0B)
          ctx.closePath()
          ctx.fill()

          // Parallel Lines
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.moveTo(x0, y0B)
          ctx.lineTo(x1, y1B)
          ctx.stroke()

          // Median Line
          ctx.save()
          try {
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(x0, (y0 + y0B) / 2)
          ctx.lineTo(x1, (y1 + y1B) / 2)
          ctx.stroke()
          } finally {
            ctx.restore()
          }
        } else if (d.type === 'fibonacci' && d.points.length >= 2) {
          const p0 = d.points[0].price
          const p1 = d.points[1].price
          const diff = p1 - p0
          const levels = [
            { l: 0.0, label: '0.0%' },
            { l: 0.236, label: '23.6%' },
            { l: 0.382, label: '38.2%' },
            { l: 0.5, label: '50.0%' },
            { l: 0.618, label: '61.8% (Golden)' },
            { l: 0.786, label: '78.6%' },
            { l: 1.0, label: '100.0%' },
          ]

          const x0 = timeToX(d.points[0].time)
          const x1 = timeToX(d.points[1].time)
          const y0 = priceToY(p0)
          const y1 = priceToY(p1)
          const leftX = Math.min(x0, x1)
          const rightX = d.extendRight ? chartW : Math.max(x0, x1)
          const spanW = Math.max(20, rightX - leftX)

          // Subtle diagonal swing baseline between anchor 0 and anchor 1
          ctx.save()
          try {
          ctx.strokeStyle = theme === 'daylight' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()
          } finally {
            ctx.restore()
          }

          // Shaded Golden Pocket (50% - 61.8%) bounded between leftX and rightX
          const y50 = priceToY(p0 + diff * 0.5)
          const y618 = priceToY(p0 + diff * 0.618)
          ctx.fillStyle = colors.goldenPocket
          ctx.fillRect(leftX, Math.min(y50, y618), spanW, Math.abs(y618 - y50))

          for (const item of levels) {
            const lvlPrice = p0 + diff * item.l
            const y = priceToY(lvlPrice)
            ctx.strokeStyle = item.l === 0.618 || item.l === 0.5 ? '#F59E0B' : d.color
            ctx.lineWidth = item.l === 0.618 || item.l === 0.5 ? 1.5 : (d.lineWidth || 1)
            ctx.setLineDash(d.lineStyle === 'dashed' ? [6, 4] : d.lineStyle === 'dotted' ? [2, 2] : [])
            ctx.beginPath()
            ctx.moveTo(leftX, Math.floor(y) + 0.5)
            ctx.lineTo(rightX, Math.floor(y) + 0.5)
            ctx.stroke()

            const isRight = d.fiboLabelsAlign === 'right'
            const labelX = isRight ? rightX - 6 : leftX + 6
            ctx.fillStyle = item.l === 0.618 || item.l === 0.5 ? '#F59E0B' : (theme === 'daylight' ? '#0F172A' : '#E2E8F0')
            ctx.font = FONT_MICRO_BOLD
            ctx.textAlign = isRight ? 'right' : 'left'
            ctx.fillText(`${item.label} (${fmtPrice(lvlPrice, digits)})`, labelX, y - 4)
          }
        } else if (d.type === 'rectangle' && d.points.length >= 2) {
          const x0 = timeToX(d.points[0].time)
          const y0 = priceToY(d.points[0].price)
          const x1 = timeToX(d.points[1].time)
          const y1 = priceToY(d.points[1].price)

          const rectX = Math.min(x0, x1)
          const rectY = Math.min(y0, y1)
          const rectW = d.extendRight ? chartW - rectX : Math.abs(x1 - x0)
          const rectH = Math.abs(y1 - y0)

          ctx.fillStyle = d.color.startsWith('#') ? `${d.color}22` : 'rgba(56, 189, 248, 0.15)'
          ctx.fillRect(rectX, rectY, rectW, rectH)
          ctx.strokeRect(rectX, rectY, rectW, rectH)
        } else if (d.type === 'risk-reward' && d.points.length >= 2) {
          const entryP = d.points[0].price
          const slP = d.points[1].price
          const isLong = d.isLong !== undefined ? d.isLong : entryP >= slP
          const riskDist = Math.abs(entryP - slP)
          const tpP = d.points[2] ? d.points[2].price : (isLong ? entryP + riskDist * 2 : entryP - riskDist * 2)
          const rewardDist = Math.abs(tpP - entryP)

          const x0 = timeToX(d.points[0].time)
          const x1 = d.points[1] ? timeToX(d.points[1].time) : x0 + 15 * candleWidth
          const leftX = Math.min(x0, x1)
          const boxW = Math.max(70, Math.abs(x1 - x0))

          const yEntry = priceToY(entryP)
          const ySl = priceToY(slP)
          const yTp = priceToY(tpP)

          // Shaded Risk Box (Red)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.20)'
          ctx.strokeStyle = '#EF4444'
          ctx.lineWidth = 1.5
          ctx.fillRect(leftX, Math.min(yEntry, ySl), boxW, Math.abs(ySl - yEntry))
          ctx.strokeRect(leftX, Math.min(yEntry, ySl), boxW, Math.abs(ySl - yEntry))

          // Shaded Reward Box (Green)
          ctx.fillStyle = 'rgba(16, 185, 129, 0.20)'
          ctx.strokeStyle = '#10B981'
          ctx.lineWidth = 1.5
          ctx.fillRect(leftX, Math.min(yEntry, yTp), boxW, Math.abs(yTp - yEntry))
          ctx.strokeRect(leftX, Math.min(yEntry, yTp), boxW, Math.abs(yTp - yEntry))

          // Dynamic R:R Ratio Badge (Anchored cleanly inside the box, NOT on yEntry)
          const rrRatio = riskDist > 0 ? (rewardDist / riskDist).toFixed(2) : '1.00'
          const symMeta = getSymbolMeta(symbol)
          const riskPips = riskDist / (symMeta.pipSize || pSize || 1)
          const rewardPips = rewardDist / (symMeta.pipSize || pSize || 1)
          const badgeText = `${isLong ? 'Long' : 'Short'} | R:R 1 : ${rrRatio} (Risk: ${riskPips.toFixed(1)}p · Reward: ${rewardPips.toFixed(1)}p)`

          const badgeY = isLong ? Math.min(yEntry, yTp) + 6 : Math.max(yEntry, yTp) - 24
          ctx.fillStyle = theme === 'daylight' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(5, 8, 17, 0.95)'
          const bW = ctx.measureText(badgeText).width + 16
          ctx.fillRect(leftX + 6, badgeY, bW, 20)
          ctx.strokeStyle = '#38BDF8'
          ctx.lineWidth = 1
          ctx.strokeRect(leftX + 6, badgeY, bW, 20)
          ctx.fillStyle = theme === 'daylight' ? '#0284C7' : '#38BDF8'
          ctx.font = FONT_LABEL_BOLD
          ctx.textAlign = 'left'
          ctx.fillText(badgeText, leftX + 12, badgeY + 14)
        } else if (d.type === 'text' && d.text) {
          const y = priceToY(d.points[0].price)
          const x = timeToX(d.points[0].time)

          ctx.fillStyle = 'rgba(5, 8, 17, 0.85)'
          ctx.fillRect(x - 4, y - 16, ctx.measureText(d.text).width + 12, 22)
          ctx.strokeStyle = d.color
          ctx.strokeRect(x - 4, y - 16, ctx.measureText(d.text).width + 12, 22)

          ctx.fillStyle = d.color
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText(d.text, x + 2, y)
        }

        // Selected anchor handles
        if (isSel) {
          ctx.fillStyle = '#FFFFFF'
          ctx.lineWidth = 2
          if (d.type === 'risk-reward') {
            const x0 = timeToX(d.points[0].time)
            const x1 = d.points[1] ? timeToX(d.points[1].time) : x0 + 15 * candleWidth
            const leftX = Math.min(x0, x1)
            const boxW = Math.max(70, Math.abs(x1 - x0))
            const centerX = leftX + boxW / 2
            const rightX = leftX + boxW
            const yEntry = priceToY(d.points[0].price)
            const ySl = priceToY(d.points[1].price)
            const isLong = d.isLong !== undefined ? d.isLong : d.points[0].price >= d.points[1].price
            const riskDist = Math.abs(d.points[0].price - d.points[1].price)
            const tpPrice = d.points[2] ? d.points[2].price : (isLong ? d.points[0].price + riskDist * 2 : d.points[0].price - riskDist * 2)
            const yTp = priceToY(tpPrice)

            const handles = [
              { x: centerX, y: yEntry, col: '#38BDF8' }, // Entry
              { x: centerX, y: ySl, col: '#EF4444' },    // SL
              { x: centerX, y: yTp, col: '#10B981' },    // TP
              { x: rightX, y: yEntry, col: '#F59E0B' },  // Width handle
            ]

            for (const h of handles) {
              ctx.strokeStyle = h.col
              ctx.beginPath()
              ctx.arc(h.x, h.y, 5, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
            }
          } else {
            ctx.strokeStyle = '#00E676'
            for (let ptIdx = 0; ptIdx < d.points.length; ptIdx++) {
              const pt = d.points[ptIdx]
              const y = priceToY(pt.price)
              const x = timeToX(pt.time)
              ctx.beginPath()
              ctx.arc(x, y, 4, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
            }
          }
        }
          } finally {
            ctx.restore()
          }
        } catch (err) {
          console.warn('[MT5Canvas] Drawing error:', err)
        }
      }

      // 9. Right Y-Axis Price Scale Scaffolding & Static Grid Ticks
      ctx.save()
      try {
      ctx.fillStyle = colors.background
      ctx.fillRect(chartW, 0, PRICE_AXIS_WIDTH, mainH)
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(chartW + 0.5, 0)
      ctx.lineTo(chartW + 0.5, mainH)
      ctx.stroke()

      const targetTicks = Math.max(8, Math.floor(mainH / 45))
      const axisGridStep = getNicePriceStep(rangeP, targetTicks)
      const firstTick = Math.ceil(minP / axisGridStep) * axisGridStep
      ctx.fillStyle = colors.textMuted
      ctx.font = FONT_LABEL
      ctx.textAlign = 'left'
      for (let p = firstTick; p <= maxP; p += axisGridStep) {
        const y = priceToY(p)
        if (y >= 8 && y <= mainH - 8) {
          ctx.fillText(fmtPrice(p, digits), chartW + 6, y + 3)
        }
      }
      } finally {
        ctx.restore()
      }

      // 10. Bottom X-Axis Time Scale Scaffolding & Static Time Ticks
      ctx.save()
      try {
      ctx.fillStyle = colors.background
      ctx.fillRect(0, mainH, width, TIME_AXIS_HEIGHT)
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, mainH + 0.5)
      ctx.lineTo(width, mainH + 0.5)
      ctx.stroke()

      ctx.fillStyle = colors.textMuted
      ctx.font = FONT_LABEL
      ctx.textAlign = 'center'
      const minStep = 85
      const timeStep = Math.max(minStep, Math.round(candleWidth * 8))
      const startX = Math.round(chartW % timeStep) || Math.round(timeStep / 2)
      for (let x = startX; x < chartW - 20; x += timeStep) {
        const t = xToTime(x)
        const ms = t < 1e11 ? t * 1000 : t
        const d = new Date(ms)
        let label = ''
        if (timeframe === 'D1' || timeframe === 'W1') {
          const dateStr = d.toLocaleDateString([], { day: '2-digit', month: 'short' })
          const yrStr = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''
          label = `${dateStr}${yrStr}`
        } else {
          // Intraday: clean time display (HH:mm); show date only if midnight/day boundary
          const hours = d.getHours()
          const minutes = d.getMinutes()
          if (hours === 0 && minutes === 0) {
            label = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
          } else {
            label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          }
        }
        ctx.fillText(label, x, mainH + 16)
      }
      } finally {
        ctx.restore()
      }

      // 11. Sub-Pane (RSI or MACD)
      if (hasSubPane) {
        const subTop = mainH + TIME_AXIS_HEIGHT
        ctx.save()
        try {
        ctx.fillStyle = colors.background
        ctx.fillRect(0, subTop, width, subH)
        ctx.strokeStyle = colors.border
        ctx.strokeRect(0, subTop, width, subH)

        if (indicators.rsi.enabled) {
          const rsiVals = calcRSI(candles, indicators.rsi.period)
          const y70 = subTop + subH * 0.3
          const y30 = subTop + subH * 0.7

          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.setLineDash([2, 2])
          ctx.beginPath()
          ctx.moveTo(0, y70)
          ctx.lineTo(chartW, y70)
          ctx.moveTo(0, y30)
          ctx.lineTo(chartW, y30)
          ctx.stroke()

          ctx.strokeStyle = indicators.rsi.color
          ctx.lineWidth = 1.5
          ctx.setLineDash([])
          ctx.beginPath()
          let s = false
          for (let i = startIndex; i <= endIndex; i++) {
            const val = rsiVals[i]
            if (val !== null) {
              const x = candleIndexToX(i)
              const y = subTop + (1 - val / 100) * subH
              if (!s) {
                ctx.moveTo(x, y)
                s = true
              } else ctx.lineTo(x, y)
            }
          }
          ctx.stroke()

          const lastRsi = rsiVals[endIndex] !== null ? rsiVals[endIndex]!.toFixed(1) : '—'
          ctx.fillStyle = colors.text
          ctx.font = FONT_LABEL_BOLD
          ctx.textAlign = 'left'
          ctx.fillText(`RSI (${indicators.rsi.period}): ${lastRsi}`, 10, subTop + 14)
        } else if (indicators.macd.enabled) {
          const macdObj = calcMACD(candles, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal)
          const midY = subTop + subH / 2

          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.beginPath()
          ctx.moveTo(0, midY)
          ctx.lineTo(chartW, midY)
          ctx.stroke()

          for (let i = startIndex; i <= endIndex; i++) {
            const h = macdObj.hist[i]
            if (h !== null) {
              const x = candleIndexToX(i)
              const barH = h * 500
              ctx.fillStyle = h >= 0 ? '#10B981' : '#EF4444'
              ctx.fillRect(x - candleWidth * 0.35, midY, candleWidth * 0.7, -barH)
            }
          }

          ctx.fillStyle = colors.text
          ctx.font = FONT_LABEL_BOLD
          ctx.textAlign = 'left'
          ctx.fillText(`MACD (${indicators.macd.fast},${indicators.macd.slow},${indicators.macd.signal})`, 10, subTop + 14)
        }
        } finally {
          ctx.restore()
        }
      }

      // 12. Interactive On-Chart Trade & Pending Order Lines (Drag-and-Drop SL/TP)
      const showTradePositions = indicators.tradeLevels?.showPositions ?? true
      const safePositions = Array.isArray(positions) ? positions : []
      const safePending = Array.isArray(pendingOrders) ? pendingOrders : []
      const symPositions = showTradePositions
        ? safePositions.filter((p) => p && typeof p === 'object' && p.symbol === symbol)
        : []
      const symPending = showTradePositions
        ? safePending.filter((o) => o && typeof o === 'object' && o.symbol === symbol && o.status === 'pending')
        : []

      const symMeta = getSymbolMeta(symbol)
      const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))

      for (const pos of symPositions) {
        try {
          if (!pos) continue
          const openPrice = toNum(pos.open_price)
          const slPrice = pos.sl !== null ? toNum(pos.sl) : 0
          const tpPrice = pos.tp !== null ? toNum(pos.tp) : 0
          const livePnl = calculateLivePositionPnL(pos as any, activePrices, symMeta.contractSize)
          const isBuy = pos.type === 'buy'

          ctx.save()
          try {
        // (a) Entry Line (Dashed)
        const yEntry = priceToY(openPrice)
        ctx.strokeStyle = isBuy ? '#38BDF8' : '#F43F5E'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 3])

        // Entry badge & floating PnL (Right-aligned before price axis)
        const posLots = pos.lot_size ?? (pos as any).lots ?? (pos as any).volume ?? 0.01
        const entryText = `${pos.type.toUpperCase()} ${posLots} @ ${fmtPrice(openPrice, digits)} · ${livePnl >= 0 ? '+' : ''}$${livePnl.toFixed(2)}`
        const badgeWidth = ctx.measureText(entryText).width + 36
        const badgeRight = chartW - 8
        const badgeX = badgeRight - badgeWidth

        // Line stops cleanly before badge with 6px clear margin
        ctx.beginPath()
        ctx.moveTo(0, Math.floor(yEntry) + 0.5)
        ctx.lineTo(badgeX - 6, Math.floor(yEntry) + 0.5)
        ctx.stroke()

        // 100% Solid High-Contrast Entry Badge
        const entryBg = isBuy ? '#0284C7' : '#E11D48'
        const entryBorder = isBuy ? '#38BDF8' : '#FB7185'
        ctx.fillStyle = entryBg
        ctx.fillRect(badgeX, yEntry - 12, badgeWidth, 24)
        ctx.strokeStyle = entryBorder
        ctx.lineWidth = 1.5
        ctx.strokeRect(badgeX, yEntry - 12, badgeWidth, 24)

        ctx.fillStyle = '#FFFFFF'
        ctx.font = FONT_LABEL_BOLD
        ctx.textAlign = 'left'
        ctx.fillText(entryText, badgeX + 8, yEntry + 4)

        // [x] Close button on Entry Line
        ctx.fillStyle = '#FFFFFF'
        ctx.font = FONT_CLOSE_BTN
        ctx.fillText('×', badgeRight - 14, yEntry + 4)

        // Right Price Axis Entry Tag
        ctx.fillStyle = isBuy ? '#0284C7' : '#E11D48'
        ctx.fillRect(chartW + 1, yEntry - 10, PRICE_AXIS_WIDTH - 2, 20)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = FONT_MICRO_BOLD
        ctx.textAlign = 'center'
        ctx.fillText(`${pos.type.toUpperCase()} ${fmtPrice(openPrice, digits)}`, chartW + PRICE_AXIS_WIDTH / 2, yEntry + 4)

        // Hover & Mobile handles [+ Drag SL] and [+ Drag TP] to the left of right-aligned badge
        const isHoveringEntry = isTouchDevice || (mousePos && Math.abs(mousePos.y - yEntry) < 18 && mousePos.x < chartW)
        if (isHoveringEntry) {
          if (!pos.sl || toNum(pos.sl) === 0) {
            const slHandleY = isBuy ? yEntry + 22 : yEntry - 22
            const slHandleX = badgeX - 78
            ctx.fillStyle = 'rgba(239, 68, 68, 0.95)'
            ctx.fillRect(slHandleX, slHandleY - 9, 72, 18)
            ctx.strokeStyle = '#FFFFFF'
            ctx.lineWidth = 1
            ctx.strokeRect(slHandleX, slHandleY - 9, 72, 18)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = FONT_MICRO_BOLD
            ctx.textAlign = 'center'
            ctx.fillText('+ Drag SL', slHandleX + 36, slHandleY + 3)
          }
          if (!pos.tp || toNum(pos.tp) === 0) {
            const tpHandleY = isBuy ? yEntry - 22 : yEntry + 22
            const tpHandleX = badgeX - 156
            ctx.fillStyle = 'rgba(16, 185, 129, 0.95)'
            ctx.fillRect(tpHandleX, tpHandleY - 9, 72, 18)
            ctx.strokeStyle = '#FFFFFF'
            ctx.lineWidth = 1
            ctx.strokeRect(tpHandleX, tpHandleY - 9, 72, 18)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = FONT_MICRO_BOLD
            ctx.textAlign = 'center'
            ctx.fillText('+ Drag TP', tpHandleX + 36, tpHandleY + 3)
          }
        }

        // (b) Stop Loss (SL) Line
        const activeSlPrice =
          draggingSlTpPreview?.posId === pos.id &&
          (draggingSlTpPreview.type === 'sl' || draggingSlTpPreview.type === 'new_sl')
            ? draggingSlTpPreview.price
            : slPrice

        if (activeSlPrice > 0) {
          const ySl = priceToY(activeSlPrice)
          const distPips = Math.abs(openPrice - activeSlPrice) / symMeta.pipSize
          const projPnl =
            calcLevelPnL({
              level: activeSlPrice,
              entry: openPrice,
              lots: toNum(pos.lot_size ?? (pos as any).lots ?? (pos as any).volume ?? 0.01),
              contractSize: symMeta.contractSize,
              mode: 'market',
              isBuy,
              quoteToUsd: quoteToUsdRate(symbol, openPrice, activePrices),
            }) || 0

          const slText = `SL · ${fmtPrice(activeSlPrice, digits)}  -$${Math.abs(projPnl).toFixed(2)} (-${distPips.toFixed(1)}p)`
          const slBadgeWidth = ctx.measureText(slText).width + 30
          const slBadgeRight = chartW - 8
          const slBadgeX = slBadgeRight - slBadgeWidth

          // Dotted red line across chart
          ctx.strokeStyle = '#EF4444'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 2])
          ctx.beginPath()
          ctx.moveTo(0, Math.floor(ySl) + 0.5)
          ctx.lineTo(chartW, Math.floor(ySl) + 0.5)
          ctx.stroke()

          // 100% Solid Opaque SL Badge — Positioned BELOW the red line (ySl + 3)
          const slBadgeBg = '#DC2626'
          ctx.fillStyle = slBadgeBg
          ctx.fillRect(slBadgeX, ySl + 3, slBadgeWidth, 22)
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1
          ctx.strokeRect(slBadgeX, ySl + 3, slBadgeWidth, 22)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_LABEL_BOLD
          ctx.fillText(slText, slBadgeX + 8, ySl + 18)

          // [x] Remove SL
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_CLOSE_BTN
          ctx.fillText('×', slBadgeRight - 14, ySl + 18)

          // Right Price Axis SL Tag
          ctx.fillStyle = '#DC2626'
          ctx.fillRect(chartW + 1, ySl - 10, PRICE_AXIS_WIDTH - 2, 20)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_MICRO_BOLD
          ctx.textAlign = 'center'
          ctx.fillText(`SL ${fmtPrice(activeSlPrice, digits)}`, chartW + PRICE_AXIS_WIDTH / 2, ySl + 4)
        }

        // (c) Take Profit (TP) Line
        const activeTpPrice =
          draggingSlTpPreview?.posId === pos.id &&
          (draggingSlTpPreview.type === 'tp' || draggingSlTpPreview.type === 'new_tp')
            ? draggingSlTpPreview.price
            : tpPrice

        if (activeTpPrice > 0) {
          const yTp = priceToY(activeTpPrice)
          const distPips = Math.abs(activeTpPrice - openPrice) / symMeta.pipSize
          const projPnl =
            calcLevelPnL({
              level: activeTpPrice,
              entry: openPrice,
              lots: toNum(pos.lot_size ?? (pos as any).lots ?? (pos as any).volume ?? 0.01),
              contractSize: symMeta.contractSize,
              mode: 'market',
              isBuy,
              quoteToUsd: quoteToUsdRate(symbol, openPrice, activePrices),
            }) || 0

          // Calculate dynamic R:R ratio if SL exists
          const riskPips = activeSlPrice > 0 ? Math.abs(openPrice - activeSlPrice) / symMeta.pipSize : 0
          const rrRatio = riskPips > 0 ? (distPips / riskPips).toFixed(1) : ''
          const rrTag = rrRatio ? ` · 1 : ${rrRatio} R:R` : ''
          const tpText = `TP · ${fmtPrice(activeTpPrice, digits)}  +$${projPnl.toFixed(2)} (+${distPips.toFixed(1)}p${rrTag})`
          const tpBadgeWidth = ctx.measureText(tpText).width + 30
          const tpBadgeRight = chartW - 8
          const tpBadgeX = tpBadgeRight - tpBadgeWidth

          // Dotted green line across chart
          ctx.strokeStyle = '#10B981'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 2])
          ctx.beginPath()
          ctx.moveTo(0, Math.floor(yTp) + 0.5)
          ctx.lineTo(chartW, Math.floor(yTp) + 0.5)
          ctx.stroke()

          // 100% Solid Opaque TP Badge — Positioned ABOVE the green line (yTp - 25)
          const tpBadgeBg = '#059669'
          ctx.fillStyle = tpBadgeBg
          ctx.fillRect(tpBadgeX, yTp - 25, tpBadgeWidth, 22)
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1
          ctx.strokeRect(tpBadgeX, yTp - 25, tpBadgeWidth, 22)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_LABEL_BOLD
          ctx.fillText(tpText, tpBadgeX + 8, yTp - 10)

          // [x] Remove TP
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_CLOSE_BTN
          ctx.fillText('×', tpBadgeRight - 14, yTp - 10)

          // Right Price Axis TP Tag
          ctx.fillStyle = '#059669'
          ctx.fillRect(chartW + 1, yTp - 10, PRICE_AXIS_WIDTH - 2, 20)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_MICRO_BOLD
          ctx.textAlign = 'center'
          ctx.fillText(`TP ${fmtPrice(activeTpPrice, digits)}`, chartW + PRICE_AXIS_WIDTH / 2, yTp + 4)
        }
          } finally {
            ctx.restore()
          }
        } catch (err) {
          console.warn('[MT5Canvas] Position item render error:', err)
        }
      }

      // Pending Orders Rendering (Right-aligned before price axis)
      for (const ord of symPending) {
        try {
          if (!ord) continue
          const activeTgtPrice =
            draggingPendingPreview?.ordId === ord.id ? draggingPendingPreview.price : toNum(ord.target_price)
          if (activeTgtPrice <= 0) continue
          const yTgt = priceToY(activeTgtPrice)

          ctx.save()
          try {
          ctx.strokeStyle = '#F59E0B'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])

          const rawType = String(ord.order_type || ord.type || 'buy_limit').toLowerCase()
          const isBuy = rawType.startsWith('buy')
          const displayType = isBuy
            ? (activeTgtPrice < liveAsk ? 'buy_limit' : 'buy_stop')
            : (activeTgtPrice > liveBid ? 'sell_limit' : 'sell_stop')
          const ordLots = toNum(ord.lot_size ?? (ord as any).lots ?? (ord as any).volume ?? 0.01)
          const ordText = `${displayType.toUpperCase().replace('_', ' ')} ${fmtLots(ordLots)} @ ${fmtPrice(activeTgtPrice, digits)}`
          const ordBadgeWidth = ctx.measureText(ordText).width + 30
          const ordBadgeRight = chartW - 8
          const ordBadgeX = ordBadgeRight - ordBadgeWidth

          // Dotted line stops cleanly before badge
          ctx.beginPath()
          ctx.moveTo(0, Math.floor(yTgt) + 0.5)
          ctx.lineTo(ordBadgeX - 4, Math.floor(yTgt) + 0.5)
          ctx.stroke()

          ctx.fillStyle = '#D97706'
          ctx.fillRect(ordBadgeX, yTgt - 11, ordBadgeWidth, 22)
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1
          ctx.strokeRect(ordBadgeX, yTgt - 11, ordBadgeWidth, 22)
          ctx.fillStyle = '#050811'
          ctx.font = FONT_LABEL_BOLD
          ctx.fillText(ordText, ordBadgeX + 6, yTgt + 3)

          // [x] Cancel Pending
          ctx.fillStyle = '#050811'
          ctx.font = FONT_CLOSE_BTN
          ctx.fillText('×', ordBadgeRight - 14, yTgt + 3)

          // Right Price Axis Tag for Pending
          ctx.fillStyle = '#D97706'
          ctx.fillRect(chartW + 1, yTgt - 9, PRICE_AXIS_WIDTH - 2, 18)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = FONT_MICRO_BOLD
          ctx.textAlign = 'center'
          ctx.fillText(fmtPrice(activeTgtPrice, digits), chartW + PRICE_AXIS_WIDTH / 2, yTgt + 3)

          // Render SL and TP for pending orders if specified (with live drag delta sync)
          const deltaPrice = activeTgtPrice - toNum(ord.target_price)
          const curSl = ord.sl && toNum(ord.sl) > 0 ? toNum(ord.sl) + (draggingPendingPreview?.ordId === ord.id ? deltaPrice : 0) : null
          const curTp = ord.tp && toNum(ord.tp) > 0 ? toNum(ord.tp) + (draggingPendingPreview?.ordId === ord.id ? deltaPrice : 0) : null

          if (curSl && curSl > 0) {
            const yOrdSl = priceToY(curSl)
            ctx.strokeStyle = '#EF4444'
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.moveTo(0, yOrdSl)
            ctx.lineTo(chartW, yOrdSl)
            ctx.stroke()
          }
          if (curTp && curTp > 0) {
            const yOrdTp = priceToY(curTp)
            ctx.strokeStyle = '#10B981'
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.moveTo(0, yOrdTp)
            ctx.lineTo(chartW, yOrdTp)
            ctx.stroke()
          }
        } finally {
          ctx.restore()
        }
      } catch (err) {
        console.warn('[MT5Canvas] Pending order item render error:', err)
      }
    }

      // 10. Real-time Bid & Ask Lines with Live Spread Badge
      const showBidAsk = indicators.tradeLevels?.showBidAsk ?? true
      const showCountdown = indicators.tradeLevels?.showCountdown ?? true

      if (showBidAsk && liveBid > 0 && liveAsk > 0) {
        const yBid = priceToY(liveBid)
        const yAsk = priceToY(liveAsk)

        ctx.save()
        try {
        // Bid Line
        ctx.strokeStyle = colors.bidLine
        ctx.lineWidth = 1
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.moveTo(0, Math.floor(yBid) + 0.5)
        ctx.lineTo(chartW, Math.floor(yBid) + 0.5)
        ctx.stroke()

        // Ask Line
        ctx.strokeStyle = colors.askLine
        ctx.lineWidth = 1
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.moveTo(0, Math.floor(yAsk) + 0.5)
        ctx.lineTo(chartW, Math.floor(yAsk) + 0.5)
        ctx.stroke()

        // Live Spread Badge between them on right scale
        const spreadP = (liveAsk - liveBid) / symMeta.pipSize
        const midY = (yBid + yAsk) / 2
        ctx.fillStyle = 'rgba(10, 15, 30, 0.9)'
        ctx.fillRect(chartW + 2, midY - 8, PRICE_AXIS_WIDTH - 4, 16)
        ctx.strokeStyle = '#F59E0B'
        ctx.strokeRect(chartW + 2, midY - 8, PRICE_AXIS_WIDTH - 4, 16)
        ctx.fillStyle = '#F59E0B'
        ctx.font = FONT_MICRO_BOLD
        ctx.textAlign = 'center'
        ctx.fillText(`Spread: ${spreadP.toFixed(1)}`, chartW + PRICE_AXIS_WIDTH / 2, midY + 3)
        } finally {
          ctx.restore()
        }
      }

      if (liveBid > 0) {
        const yBid = priceToY(liveBid)
        ctx.save()
        try {
        // Active Live Bid Price Tag on Right Scale (Dynamic Bullish / Bearish color)
        const isBullish = visible.length > 0 && visible[visible.length - 1].close >= visible[visible.length - 1].open
        const bidBg = theme === 'daylight' 
          ? (isBullish ? '#16A34A' : '#DC2626') 
          : (isBullish ? '#10B981' : '#F43F5E')
        
        ctx.fillStyle = bidBg
        ctx.fillRect(chartW + 2, yBid - 10, PRICE_AXIS_WIDTH - 4, 20)
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.strokeRect(chartW + 2, yBid - 10, PRICE_AXIS_WIDTH - 4, 20)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = FONT_BODY_BOLD
        ctx.textAlign = 'center'
        ctx.fillText(fmtPrice(liveBid, digits), chartW + PRICE_AXIS_WIDTH / 2, yBid + 4)

        // Candle Countdown Timer Pill right underneath on Right Scale (Zero overlap in plot area!)
        if (showCountdown) {
          const cdText = formatCountdown(countdown)
          ctx.fillStyle = theme === 'daylight' ? '#FFFFFF' : 'rgba(5, 8, 17, 0.95)'
          ctx.fillRect(chartW + 4, yBid + 12, PRICE_AXIS_WIDTH - 8, 16)
          ctx.strokeStyle = bidBg
          ctx.lineWidth = 1
          ctx.strokeRect(chartW + 4, yBid + 12, PRICE_AXIS_WIDTH - 8, 16)
          ctx.fillStyle = theme === 'daylight' ? '#0f172a' : '#F59E0B'
          ctx.font = FONT_MICRO_BOLD
          ctx.textAlign = 'center'
          ctx.fillText(cdText, chartW + PRICE_AXIS_WIDTH / 2, yBid + 24)
        }

        } finally {
          ctx.restore()
        }
      }

      // 11. Crosshair & MT5 Pip Ruler
      const curMouse = mousePosRef.current
      if (curMouse && curMouse.onChart) {
        const curX = curMouse.x
        const curY = curMouse.y
        const curPrice = yToPrice(curY)

        ctx.save()
        try {
        ctx.strokeStyle = colors.crosshair
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])

        // Horizontal dashed line
        ctx.beginPath()
        ctx.moveTo(0, Math.floor(curY) + 0.5)
        ctx.lineTo(chartW, Math.floor(curY) + 0.5)
        ctx.stroke()

        // Vertical dashed line
        ctx.beginPath()
        ctx.moveTo(Math.floor(curX) + 0.5, 0)
        ctx.lineTo(Math.floor(curX) + 0.5, mainH)
        ctx.stroke()

        // High-contrast Cursor Price Pill on Right Axis
        const curPillBg = theme === 'daylight' ? '#0F172A' : '#1E293B'
        const curPillBorder = theme === 'daylight' ? '#334155' : '#38BDF8'
        const curPillText = '#FFFFFF'

        ctx.fillStyle = curPillBg
        ctx.fillRect(chartW + 1, curY - 9, PRICE_AXIS_WIDTH - 2, 18)
        ctx.strokeStyle = curPillBorder
        ctx.lineWidth = 1
        ctx.strokeRect(chartW + 1, curY - 9, PRICE_AXIS_WIDTH - 2, 18)

        ctx.fillStyle = curPillText
        ctx.font = FONT_LABEL_BOLD
        ctx.textAlign = 'center'
        ctx.fillText(fmtPrice(curPrice, digits), chartW + PRICE_AXIS_WIDTH / 2, curY + 4)

        // Cursor Time Tag on Bottom Axis
        const curTime = xToTime(curX)
        const curD = new Date(curTime)
        let timeStr = ''
        if (timeframe === 'D1' || timeframe === 'W1') {
          timeStr = curD.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
        } else {
          timeStr = curD.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        }
        const tagW = Math.max(88, ctx.measureText(timeStr).width + 16)
        ctx.fillStyle = curPillBg
        ctx.fillRect(curX - tagW / 2, mainH + 1, tagW, 18)
        ctx.strokeStyle = curPillBorder
        ctx.lineWidth = 1
        ctx.strokeRect(curX - tagW / 2, mainH + 1, tagW, 18)

        ctx.fillStyle = curPillText
        ctx.font = FONT_LABEL_BOLD
        ctx.textAlign = 'center'
        ctx.fillText(timeStr, curX, mainH + 13)
        } finally {
          ctx.restore()
        }

        // Pip Ruler Box (Ctrl+F or Middle Drag)
        const ruler = rulerRef.current
        if (ruler.active && ruler.startPoint && ruler.startScreen) {
          const x0 = ruler.startScreen.x
          const y0 = ruler.startScreen.y
          const x1 = curX
          const y1 = curY

          const p0 = ruler.startPoint.price
          const p1 = curPrice
          const deltaPrice = p1 - p0
          const symMeta = getSymbolMeta(symbol)
          const deltaPips = Math.abs(deltaPrice) / (symMeta.pipSize || pSize || 1)
          const deltaPct = (deltaPrice / p0) * 100
          const deltaBars = Math.abs(xToCandleIndex(x1) - xToCandleIndex(x0))
          const estPnL = Math.abs(deltaPrice) * symMeta.contractSize * activeLot * quoteToUsdRate(symbol, p1, activePrices)

          ctx.save()
          try {
          ctx.strokeStyle = colors.rulerBorder
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()

          const rulerText = `${deltaBars} Bars | ${deltaPips.toFixed(1)} Pips | Δ${fmtPrice(Math.abs(deltaPrice), digits)} (${deltaPct.toFixed(2)}%) | ~$${estPnL.toFixed(2)}`
          const boxW = ctx.measureText(rulerText).width + 24
          const boxX = Math.min(chartW - boxW - 10, Math.max(10, x1 + 10))
          const boxY = Math.max(20, Math.min(mainH - 40, y1 - 30))

          ctx.fillStyle = colors.rulerBg
          ctx.fillRect(boxX, boxY, boxW, 26)
          ctx.strokeStyle = colors.rulerBorder
          ctx.strokeRect(boxX, boxY, boxW, 26)

          ctx.fillStyle = colors.text
          ctx.font = FONT_LABEL_BOLD
          ctx.textAlign = 'left'
          ctx.fillText(rulerText, boxX + 10, boxY + 16)
          } finally {
            ctx.restore()
          }
        }
      }

      // 15. Top-Left OHLCV Status Line
      const isHovering = curMouse && curMouse.onChart && curMouse.x < chartW
      const hoveredIndex = isHovering ? xToCandleIndex(curMouse.x) : -1
      const activeCandle =
        hoveredIndex >= 0 && hoveredIndex < candles.length
          ? candles[hoveredIndex]
          : candles[candles.length - 1]

      if (activeCandle) {
        const isLatest = activeCandle === candles[candles.length - 1]
        const openVal = activeCandle.open
        const closeVal = isLatest && liveBid > 0 ? liveBid : activeCandle.close
        const highVal = isLatest && liveBid > 0 ? Math.max(activeCandle.high, liveBid) : activeCandle.high
        const lowVal = isLatest && liveBid > 0 ? Math.min(activeCandle.low, liveBid) : activeCandle.low
        const deltaP = closeVal - openVal
        const deltaPct = openVal > 0 ? (deltaP / openVal) * 100 : 0

        const ohlcvText = `${symbol} • ${timeframe} • O: ${fmtPrice(openVal, digits)} H: ${fmtPrice(highVal, digits)} L: ${fmtPrice(lowVal, digits)} C: ${fmtPrice(closeVal, digits)} Δ: ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}% Vol: ${activeCandle.volume}`

        ctx.save()
        try {
        ctx.fillStyle = theme === 'daylight' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(5, 8, 17, 0.75)'
        ctx.fillRect(6, 6, ctx.measureText(ohlcvText).width + 16, 20)
        ctx.strokeStyle = theme === 'daylight' ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.08)'
        ctx.strokeRect(6, 6, ctx.measureText(ohlcvText).width + 16, 20)

        ctx.fillStyle = theme === 'daylight' ? '#0f172a' : colors.text
        ctx.font = FONT_BODY_BOLD
        ctx.textAlign = 'left'
        ctx.fillText(ohlcvText, 12, 20)
        } finally {
          ctx.restore()
        }
      }
      } catch (err) {
        console.error('[MT5 Pro Chart] Uncaught render exception:', err)
      } finally {
        ctx.restore()
      }
    }, [
      colors,
      candles,
      digits,
      timeframe,
      chartStyle,
      showGrid,
      showPeriodSeparators,
      indicators,
      drawings,
      selectedDrawingId,
      positions,
      pendingOrders,
      pSize,
      candleWidth,
      scrollOffset,
      yScaleFactor,
      yScaleOffset,
      countdown,
      hasSubPane,
      activeLot,
      accountBalance,
      draggingSlTpPreview,
      draggingPendingPreview,
      mousePos,
      getLayout,
      getVisibleSlice,
      getPriceBounds,
      priceToY,
      yToPrice,
      candleIndexToX,
      xToCandleIndex,
      timeToX,
      xToTime,
    ])

    // RequestAnimationFrame 60 FPS Render Dispatcher
    useEffect(() => {
      let animId: number
      const loop = () => {
        renderChart()
        animId = requestAnimationFrame(loop)
      }
      animId = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(animId)
    }, [renderChart])

    // Mouse wheel horizontal zoom centered on cursor
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = e.clientX - rect.left
      const { chartW } = getLayout()
      if (mouseX >= chartW) return

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87
      setCandleWidth((prev) => {
        const next = Math.max(2.5, Math.min(48, prev * zoomFactor))
        return parseFloat(next.toFixed(2))
      })
    }

    // Centralized Pending Order Drag & Drop handler (shared between Mouse and Touch)
    const handlePendingDrop = useCallback(
      (ord: PendingOrder, rawFinalPrice: number) => {
        const newTarget = parseFloat(rawFinalPrice.toFixed(digits))
        const oldTarget = toNum(ord.target_price)

        if (newTarget <= 0 || Math.abs(newTarget - oldTarget) <= pSize * 0.5) {
          draggingPendingRef.current = null
          setDraggingPendingPreview(null)
          return
        }

        const activePrices = usePrices.getState().prices
        const activeTick = activePrices[symbol]
        const visibleSlice = getVisibleSlice().visible
        const liveBid = toNum(activeTick?.bid) || (visibleSlice.length > 0 ? visibleSlice[visibleSlice.length - 1].close : 0)
        const liveAsk = toNum(activeTick?.ask) || (liveBid > 0 ? liveBid + pSize * 1.5 : 0)

        const rawType = String(ord.order_type || ord.type || 'buy_limit').toLowerCase()
        const isBuy = rawType.startsWith('buy')
        const targetType = isBuy
          ? (newTarget < liveAsk ? 'buy_limit' : 'buy_stop')
          : (newTarget > liveBid ? 'sell_limit' : 'sell_stop')

        const minDist = getSymbolMinTriggerDist(ord.symbol)
        const marketRefPx = isBuy ? liveAsk : liveBid
        if (marketRefPx > 0 && Math.abs(newTarget - marketRefPx) < minDist) {
          playOrderLossThumpSound()
          toast.error(`Target price too close to market (${fmtPrice(marketRefPx, digits)}). Minimum distance is ${minDist}.`)
          draggingPendingRef.current = null
          setDraggingPendingPreview(null)
          return
        }

        const delta = newTarget - oldTarget
        const newSl = ord.sl !== null && toNum(ord.sl) > 0 ? parseFloat((toNum(ord.sl) + delta).toFixed(digits)) : null
        const newTp = ord.tp !== null && toNum(ord.tp) > 0 ? parseFloat((toNum(ord.tp) + delta).toFixed(digits)) : null

        // Pre-validate SL/TP positive bounds before cancelling
        if (newSl !== null && newSl <= 0) {
          playOrderLossThumpSound()
          toast.error(`Adjusted Stop Loss (${fmtPrice(newSl, digits)}) must be greater than zero.`)
          draggingPendingRef.current = null
          setDraggingPendingPreview(null)
          return
        }
        if (newTp !== null && newTp <= 0) {
          playOrderLossThumpSound()
          toast.error(`Adjusted Take Profit (${fmtPrice(newTp, digits)}) must be greater than zero.`)
          draggingPendingRef.current = null
          setDraggingPendingPreview(null)
          return
        }

        // Directional boundary checks to prevent backend rejection
        if (newSl !== null) {
          if (isBuy && newSl >= newTarget) {
            playOrderLossThumpSound()
            toast.error('Adjusted Stop Loss must be below target price for Buy orders.')
            draggingPendingRef.current = null
            setDraggingPendingPreview(null)
            return
          }
          if (!isBuy && newSl <= newTarget) {
            playOrderLossThumpSound()
            toast.error('Adjusted Stop Loss must be above target price for Sell orders.')
            draggingPendingRef.current = null
            setDraggingPendingPreview(null)
            return
          }
        }
        if (newTp !== null) {
          if (isBuy && newTp <= newTarget) {
            playOrderLossThumpSound()
            toast.error('Adjusted Take Profit must be above target price for Buy orders.')
            draggingPendingRef.current = null
            setDraggingPendingPreview(null)
            return
          }
          if (!isBuy && newTp >= newTarget) {
            playOrderLossThumpSound()
            toast.error('Adjusted Take Profit must be below target price for Sell orders.')
            draggingPendingRef.current = null
            setDraggingPendingPreview(null)
            return
          }
        }

        const accountId = ord.account_id ? Number(ord.account_id) : undefined
        const tournamentId = (ord as any).tournament_id ? Number((ord as any).tournament_id) : undefined

        api.pendingCancel(ord.id).then((cancelRes) => {
          if (cancelRes.ok && cancelRes.data.success) {
            api
              .pendingPlace({
                symbol: ord.symbol,
                order_type: targetType as any,
                type: (isBuy ? 'buy' : 'sell') as any,
                lot_size: toNum(ord.lot_size ?? (ord as any).lots ?? (ord as any).volume ?? 0.01),
                target_price: newTarget,
                sl: newSl,
                tp: newTp,
                account_id: accountId,
                tournament_id: tournamentId,
              })
              .then((placeRes) => {
                if (placeRes.ok && placeRes.data.success) {
                  playOrderSuccessSound()
                  toast.success(`Updated ${targetType.toUpperCase().replace('_', ' ')} #${ord.id} to ${fmtPrice(newTarget, digits)}`)
                  invalidateFxsim('/pending-order/my')
                  onChanged?.()
                } else {
                  playOrderLossThumpSound()
                  toast.error(placeRes.ok ? placeRes.data.message || 'Failed to replace pending order' : placeRes.error)
                  // Rollback: Attempt to restore original order
                  api.pendingPlace({
                    symbol: ord.symbol,
                    order_type: (ord.order_type || ord.type || targetType) as any,
                    type: (String(ord.order_type || ord.type || targetType).toLowerCase().startsWith('buy') ? 'buy' : 'sell') as any,
                    lot_size: toNum(ord.lot_size ?? (ord as any).lots ?? (ord as any).volume ?? 0.01),
                    target_price: oldTarget,
                    sl: ord.sl !== null ? toNum(ord.sl) : null,
                    tp: ord.tp !== null ? toNum(ord.tp) : null,
                    account_id: accountId,
                    tournament_id: tournamentId,
                  }).then((restoreRes) => {
                    if (restoreRes.ok && restoreRes.data.success) {
                      toast.info(`Restored original pending order #${ord.id} at ${fmtPrice(oldTarget, digits)}`)
                      invalidateFxsim('/pending-order/my')
                      onChanged?.()
                    }
                  })
                }
              })
          } else {
            playOrderLossThumpSound()
            toast.error(cancelRes.ok ? cancelRes.data.message || 'Failed to cancel previous pending order' : cancelRes.error)
          }
        })

        draggingPendingRef.current = null
        setDraggingPendingPreview(null)
      },
      [digits, pSize, symbol, getVisibleSlice, onChanged]
    )

    // Mouse Down Event (Panning, Scaling, SL/TP dragging, Vector Drawing)
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const { chartW } = getLayout()

      // 1. Right Click handled separately
      if (e.button === 2) return

      // 2. Middle Click activates Pip Ruler
      if (e.button === 1 || activeTool === 'crosshair') {
        const startP = snapToCandle({ time: xToTime(x), price: yToPrice(y) })
        rulerRef.current = {
          active: true,
          startPoint: startP,
          currentPoint: startP,
          startScreen: { x, y },
          currentScreen: { x, y },
        }
        return
      }

      // 3. Right Price Axis Drag (Vertical Scale Compress/Expand)
      if (x >= chartW) {
        isDraggingAxisRef.current = true
        dragStartRef.current = {
          x,
          y,
          scrollOffset,
          yScaleFactor,
          yScaleOffset,
        }
        return
      }

      // 4. Interactive Trade Lines & Drag handles (Guarded by showPositions toggle)
      const showTradePositions = indicators.tradeLevels?.showPositions ?? true
      if (showTradePositions) {
        const safePositions = Array.isArray(positions) ? positions : []
        const symPositions = safePositions.filter((p) => p && typeof p === 'object' && p.symbol === symbol)
        for (const pos of symPositions) {
          try {
            if (!pos || typeof pos !== 'object') continue
            const openPrice = toNum(pos.open_price)
            const slPrice = pos.sl !== null ? toNum(pos.sl) : 0
            const tpPrice = pos.tp !== null ? toNum(pos.tp) : 0

            const yEntry = priceToY(openPrice)
            const ySl = slPrice > 0 ? priceToY(slPrice) : -999
            const yTp = tpPrice > 0 ? priceToY(tpPrice) : -999

            const isBuy = pos.type === 'buy'
            const badgeRight = chartW - 8
            const entryBadgeW = 140 + digits * 8 + 36
            const badgeX = badgeRight - entryBadgeW

            // (a) Click [x] Close on Entry Line (Right-aligned badge)
            if (Math.abs(y - yEntry) < 12 && x >= badgeRight - 22 && x <= badgeRight + 4) {
              api.close(pos.id).then((r) => {
                if (r.ok && r.data.success) {
                  playOrderSuccessSound()
                  toast.success(`Position #${pos.id} closed @ ${fmtPrice(yToPrice(y), digits)}`)
                  invalidateFxsim('/positions')
                  invalidateFxsim('/account')
                  onChanged?.()
                } else {
                  playOrderLossThumpSound()
                  toast.error('Failed to close position')
                }
              })
              return
            }

            // (b) Click [+ Drag SL] handle (Left of right-aligned badge)
            const slHandleY = isBuy ? yEntry + 22 : yEntry - 22
            const slHandleX = badgeX - 78
            if ((!pos.sl || toNum(pos.sl) === 0) && Math.abs(y - slHandleY) < 12 && x >= slHandleX - 4 && x <= slHandleX + 76) {
              draggingSlTpRef.current = {
                posId: pos.id,
                type: 'new_sl',
                currentPrice: openPrice,
                initialPrice: openPrice,
                pos,
              }
              return
            }

            // (c) Click [+ Drag TP] handle (Left of right-aligned badge)
            const tpHandleY = isBuy ? yEntry - 22 : yEntry + 22
            const tpHandleX = badgeX - 156
            if ((!pos.tp || toNum(pos.tp) === 0) && Math.abs(y - tpHandleY) < 12 && x >= tpHandleX - 4 && x <= tpHandleX + 76) {
              draggingSlTpRef.current = {
                posId: pos.id,
                type: 'new_tp',
                currentPrice: openPrice,
                initialPrice: openPrice,
                pos,
              }
              return
            }

            // (d) Click [x] Remove SL (Right-aligned [x] on SL badge, positioned below line)
            if (slPrice > 0 && Math.abs(y - (ySl + 12)) < 12 && x >= chartW - 28 && x <= chartW + 2) {
              api.sltp(pos.id, null, pos.tp !== null ? toNum(pos.tp) : null).then((r) => {
                if (r.ok && r.data.success) {
                  playOrderSuccessSound()
                  toast.success(`Removed Stop Loss from #${pos.id}`)
                  invalidateFxsim('/positions')
                  onChanged?.()
                }
              })
              return
            }

            // (e) Click [x] Remove TP (Right-aligned [x] on TP badge, positioned above line)
            if (tpPrice > 0 && Math.abs(y - (yTp - 14)) < 12 && x >= chartW - 28 && x <= chartW + 2) {
              api.sltp(pos.id, pos.sl !== null ? toNum(pos.sl) : null, null).then((r) => {
                if (r.ok && r.data.success) {
                  playOrderSuccessSound()
                  toast.success(`Removed Take Profit from #${pos.id}`)
                  invalidateFxsim('/positions')
                  onChanged?.()
                }
              })
              return
            }

            // (f) Drag existing SL Line or SL badge (below line)
            if (slPrice > 0 && (Math.abs(y - ySl) < 12 || (y >= ySl - 2 && y <= ySl + 26 && x >= badgeRight - 220)) && x < chartW - 28) {
              draggingSlTpRef.current = {
                posId: pos.id,
                type: 'sl',
                currentPrice: slPrice,
                initialPrice: slPrice,
                pos,
              }
              return
            }

            // (g) Drag existing TP Line or TP badge (above line)
            if (tpPrice > 0 && (Math.abs(y - yTp) < 12 || (y >= yTp - 2 && y <= yTp + 2 && x >= badgeRight - 220)) && x < chartW - 28) {
              draggingSlTpRef.current = {
                posId: pos.id,
                type: 'tp',
                currentPrice: tpPrice,
                initialPrice: tpPrice,
                pos,
              }
              return
            }
          } catch {
            continue
          }
        }

        // 5. Interactive Pending Orders (select closest order)
        const safePending = Array.isArray(pendingOrders) ? pendingOrders : []
        const symPending = safePending.filter((o) => o && typeof o === 'object' && o.symbol === symbol && o.status === 'pending')

        // Click [x] Cancel on closest pending order
        let closestCancel: PendingOrder | null = null
        let minCancelDist = 12
        for (const ord of symPending) {
          try {
            if (!ord || typeof ord !== 'object') continue
            const tgtPrice = toNum(ord.target_price)
            if (tgtPrice <= 0) continue
            const yTgt = priceToY(tgtPrice)
            const dY = Math.abs(y - yTgt)
            if (dY < minCancelDist && x >= chartW - 28 && x <= chartW + 2) {
              minCancelDist = dY
              closestCancel = ord
            }
          } catch {
            continue
          }
        }
        if (closestCancel) {
          api.pendingCancel(closestCancel.id).then((r) => {
            if (r.ok && r.data.success) {
              playOrderSuccessSound()
              toast.success(`Cancelled pending order #${closestCancel.id}`)
              invalidateFxsim('/pending-order/my')
              onChanged?.()
            } else {
              playOrderLossThumpSound()
              toast.error(r.ok ? r.data.message || 'Failed to cancel order' : r.error)
            }
          })
          return
        }

        // Drag closest pending order target line
        let closestDrag: PendingOrder | null = null
        let minDragDist = 10
        for (const ord of symPending) {
          try {
            if (!ord || typeof ord !== 'object') continue
            const tgtPrice = toNum(ord.target_price)
            if (tgtPrice <= 0) continue
            const yTgt = priceToY(tgtPrice)
            const dY = Math.abs(y - yTgt)
            if (dY < minDragDist && x < chartW) {
              minDragDist = dY
              closestDrag = ord
            }
          } catch {
            continue
          }
        }
        if (closestDrag) {
          const tgtPrice = toNum(closestDrag.target_price)
          draggingPendingRef.current = {
            ordId: closestDrag.id,
            order: closestDrag,
            currentPrice: tgtPrice,
            initialPrice: tgtPrice,
          }
          return
        }
      }

      // 6. Vector Drawing Tools Initiation
      if (activeTool !== 'select') {
        const clickPoint = snapToCandle({
          time: xToTime(x),
          price: yToPrice(y),
        })

        if (activeTool === 'hline' || activeTool === 'vline' || activeTool === 'text') {
          const newObj: DrawingObject = {
            id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            symbol,
            type: activeTool,
            points: [clickPoint],
            color: activeTool === 'hline' ? '#38BDF8' : '#00E676',
            lineWidth: 2,
            lineStyle: 'solid',
            locked: false,
            visible: true,
            text: activeTool === 'text' ? 'Note' : undefined,
            createdAt: Date.now(),
          }
          onAddDrawing(newObj)
          onSelectTool('select')
          return
        }

        // Multi-point tool initiation
        const initialPoints = activeTool === 'risk-reward'
          ? [clickPoint, clickPoint, clickPoint]
          : [clickPoint, clickPoint]
        const newObj: DrawingObject = {
          id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          symbol,
          type: activeTool,
          points: initialPoints,
          color: '#00E676',
          lineWidth: 2,
          lineStyle: 'solid',
          locked: false,
          visible: true,
          createdAt: Date.now(),
        }
        drawingInProgressRef.current = newObj
        return
      }

      // 7. Select tool: Check click on drawing anchor handles
      if (selectedDrawingId) {
        try {
          const safeDrawings = Array.isArray(drawings) ? drawings : []
          const sel = safeDrawings.find((d) => d && typeof d === 'object' && d.id === selectedDrawingId)
          if (sel && Array.isArray(sel.points) && sel.points.length > 0) {
          if (sel.type === 'risk-reward') {
            const x0 = timeToX(sel.points[0].time)
            const x1 = sel.points[1] ? timeToX(sel.points[1].time) : x0 + 15 * candleWidth
            const leftX = Math.min(x0, x1)
            const boxW = Math.max(70, Math.abs(x1 - x0))
            const centerX = leftX + boxW / 2
            const rightX = leftX + boxW
            const yEntry = priceToY(sel.points[0].price)
            const ySl = priceToY(sel.points[1].price)
            const isLong = sel.isLong !== undefined ? sel.isLong : sel.points[0].price >= sel.points[1].price
            const riskDist = Math.abs(sel.points[0].price - sel.points[1].price)
            const tpPrice = sel.points[2] ? sel.points[2].price : (isLong ? sel.points[0].price + riskDist * 2 : sel.points[0].price - riskDist * 2)
            const yTp = priceToY(tpPrice)

            const handles = [
              { x: centerX, y: yEntry, ptIdx: 0 },
              { x: centerX, y: ySl, ptIdx: 1 },
              { x: centerX, y: yTp, ptIdx: 2 },
              { x: rightX, y: yEntry, ptIdx: 3 },
            ]

            for (const h of handles) {
              if (Math.hypot(x - h.x, y - h.y) < 14) {
                draggingAnchorRef.current = { drawingId: sel.id, pointIndex: h.ptIdx }
                return
              }
            }
          } else {
            for (let ptIdx = 0; ptIdx < sel.points.length; ptIdx++) {
              const pt = sel.points[ptIdx]
              const ptY = priceToY(pt.price)
              const ptX = timeToX(pt.time)
              if (Math.hypot(x - ptX, y - ptY) < 12) {
                draggingAnchorRef.current = { drawingId: sel.id, pointIndex: ptIdx }
                return
              }
            }
          }
        }
        } catch {
          // Defensive: suppress anchor handle error on corrupt points
        }
      }

      // 8. Select tool: Geometric Hit-Testing to select drawing on canvas
      let hitDrawing: DrawingObject | null = null
      const safeDrawingsList = Array.isArray(drawings) ? drawings : []
      for (const d of safeDrawingsList) {
        try {
          if (!d || typeof d !== 'object' || !d.visible || !Array.isArray(d.points) || d.points.length === 0) continue
          if (d.type === 'hline') {
            if (d.points[0] && Math.abs(y - priceToY(d.points[0].price)) < 8) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'vline') {
            if (d.points[0] && Math.abs(x - timeToX(d.points[0].time)) < 8) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'trendline' && d.points.length >= 2 && d.points[0] && d.points[1]) {
            const x0 = timeToX(d.points[0].time)
            const y0 = priceToY(d.points[0].price)
            const x1 = timeToX(d.points[1].time)
            const y1 = priceToY(d.points[1].price)
            const dist = d.extendRight ? distToRay(x, y, x0, y0, x1, y1) : distToSegment(x, y, x0, y0, x1, y1)
            if (dist < 8) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'channel' && d.points.length >= 2 && d.points[0] && d.points[1]) {
            const x0 = timeToX(d.points[0].time)
            const y0 = priceToY(d.points[0].price)
            const x1 = timeToX(d.points[1].time)
            const y1 = priceToY(d.points[1].price)
            const cH = d.channelWidth !== undefined ? priceToY(d.points[0].price - d.channelWidth) - y0 : 40
            if (distToSegment(x, y, x0, y0, x1, y1) < 8 || distToSegment(x, y, x0, y0 + cH, x1, y1 + cH) < 8) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'fibonacci' && d.points.length >= 2 && d.points[0] && d.points[1]) {
            const p0 = d.points[0].price
            const diff = d.points[1].price - p0
            const x0 = timeToX(d.points[0].time)
            const x1 = timeToX(d.points[1].time)
            const leftX = Math.min(x0, x1)
            const rightX = d.extendRight ? chartW : Math.max(x0, x1)
            const lvls = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
            const isHit = (x >= leftX - 10 && x <= rightX + 10) && lvls.some((l) => Math.abs(y - priceToY(p0 + diff * l)) < 6)
            if (isHit) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'rectangle' && d.points.length >= 2 && d.points[0] && d.points[1]) {
            const x0 = timeToX(d.points[0].time)
            const y0 = priceToY(d.points[0].price)
            const x1 = timeToX(d.points[1].time)
            const y1 = priceToY(d.points[1].price)
            const minX = Math.min(x0, x1)
            const maxX = d.extendRight ? chartW : Math.max(x0, x1)
            const minY = Math.min(y0, y1)
            const maxY = Math.max(y0, y1)
            if (x >= minX - 6 && x <= maxX + 6 && y >= minY - 6 && y <= maxY + 6) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'risk-reward' && d.points.length >= 2 && d.points[0] && d.points[1]) {
            const x0 = timeToX(d.points[0].time)
            const x1 = d.points[1] ? timeToX(d.points[1].time) : x0 + 15 * candleWidth
            const leftX = Math.min(x0, x1)
            const rightX = leftX + Math.max(70, Math.abs(x1 - x0))
            const yEntry = priceToY(d.points[0].price)
            const ySl = priceToY(d.points[1].price)
            const riskDist = Math.abs(d.points[0].price - d.points[1].price)
            const isL = d.isLong !== undefined ? d.isLong : d.points[0].price >= d.points[1].price
            const tpPrice = d.points[2] ? d.points[2].price : (isL ? d.points[0].price + riskDist * 2 : d.points[0].price - riskDist * 2)
            const yTp = priceToY(tpPrice)
            const topY = Math.min(yEntry, ySl, yTp)
            const botY = Math.max(yEntry, ySl, yTp)
            if (x >= leftX - 6 && x <= rightX + 6 && y >= topY - 6 && y <= botY + 6) {
              hitDrawing = d
              break
            }
          } else if (d.type === 'text') {
            if (d.points[0]) {
              const ptX = timeToX(d.points[0].time)
              const ptY = priceToY(d.points[0].price)
              if (Math.abs(x - ptX) < 60 && Math.abs(y - ptY) < 15) {
                hitDrawing = d
                break
              }
            }
          }
        } catch {
          continue
        }
      }

      if (hitDrawing) {
        onSelectDrawing(hitDrawing.id)
        if (!hitDrawing.locked) {
          draggingDrawingBodyRef.current = {
            drawingId: hitDrawing.id,
            startX: x,
            startY: y,
            initialPoints: hitDrawing.points.map((p) => ({ ...p })),
          }
        }
        return
      } else {
        if (selectedDrawingId) onSelectDrawing(null)
      }

      // 9. Otherwise: Pan chart horizontally and vertically
      isDraggingChartRef.current = true
      setCanvasCursor('grabbing')
      dragStartRef.current = {
        x,
        y,
        scrollOffset,
        yScaleFactor,
        yScaleOffset,
      }
    }

    // Mouse Move Event
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const { chartW, mainH } = getLayout()

      const onAxis = x >= chartW
      const onChart = x < chartW && y < mainH

      mousePosRef.current = { x, y, onAxis, onChart }
      setMousePos({ x, y, onAxis, onChart })

      // Dynamic cursor update
      if (isDraggingAxisRef.current || onAxis) {
        setCanvasCursor('ns-resize')
      } else if (isDraggingChartRef.current) {
        setCanvasCursor('grabbing')
      } else if (draggingSlTpRef.current || draggingPendingRef.current) {
        setCanvasCursor('ns-resize')
      } else if (activeTool === 'select') {
        setCanvasCursor('grab')
      } else {
        setCanvasCursor('crosshair')
      }

      // 1. Right Axis Dragging (Y-Scale Factor)
      if (isDraggingAxisRef.current && dragStartRef.current) {
        const deltaY = dragStartRef.current.y - y
        const factorChange = deltaY * 0.005
        const newFactor = Math.max(0.2, Math.min(6.0, dragStartRef.current.yScaleFactor + factorChange))
        setYScaleFactor(parseFloat(newFactor.toFixed(3)))
        return
      }

      // 2. Pip Ruler Dragging
      if (rulerRef.current.active && rulerRef.current.startPoint) {
        const curPrice = yToPrice(y)
        const curPoint = snapToCandle({ time: xToTime(x), price: curPrice })
        rulerRef.current.currentPoint = curPoint
        rulerRef.current.currentScreen = { x, y }
        setRulerDisplay({ ...rulerRef.current })
        return
      }

      // 3. SL/TP Dragging
      if (draggingSlTpRef.current) {
        const curPrice = yToPrice(y)
        const pos = draggingSlTpRef.current.pos
        const openPrice = toNum(pos.open_price)
        const symMeta = getSymbolMeta(symbol)
        const distPips = Math.abs(curPrice - openPrice) / (symMeta.pipSize || pSize || 1)
        const isBuy = pos.type === 'buy'

        const projPnl =
          calcLevelPnL({
            level: curPrice,
            entry: openPrice,
            lots: toNum(pos.lot_size ?? (pos as any).lots ?? (pos as any).volume ?? 0.01),
            contractSize: symMeta.contractSize,
            mode: 'market',
            isBuy,
            quoteToUsd: quoteToUsdRate(symbol, openPrice, usePrices.getState().prices),
          }) || 0

        setDraggingSlTpPreview({
          posId: pos.id,
          type: draggingSlTpRef.current.type,
          price: curPrice,
          pips: distPips,
          estPnL: projPnl,
        })
        return
      }

      // 4. Pending Order Dragging
      if (draggingPendingRef.current) {
        const curPrice = yToPrice(y)
        draggingPendingRef.current.currentPrice = curPrice
        setDraggingPendingPreview({
          ordId: draggingPendingRef.current.ordId,
          price: curPrice,
        })
        return
      }

      // 5. Vector Drawing in progress
      if (drawingInProgressRef.current) {
        const curPoint = snapToCandle({ time: xToTime(x), price: yToPrice(y) })
        if (drawingInProgressRef.current.type === 'risk-reward') {
          const p0 = drawingInProgressRef.current.points[0]
          const p1 = curPoint
          const isLong = p0.price >= p1.price
          const riskDist = Math.abs(p0.price - p1.price)
          const p2Price = isLong ? p0.price + riskDist * 2 : p0.price - riskDist * 2
          drawingInProgressRef.current.points = [
            p0,
            p1,
            { time: p1.time, price: p2Price },
          ]
        } else {
          const pts = [...drawingInProgressRef.current.points]
          pts[1] = curPoint
          drawingInProgressRef.current.points = pts
        }
        return
      }

      // 6. Dragging Drawing Anchor Handle
      if (draggingAnchorRef.current) {
        const curPoint = snapToCandle({ time: xToTime(x), price: yToPrice(y) })
        const safeDrawings = Array.isArray(drawings) ? drawings : []
        const sel = safeDrawings.find((d) => d && typeof d === 'object' && d.id === draggingAnchorRef.current?.drawingId)
        if (sel) {
          const nextPts = [...sel.points]
          if (sel.type === 'risk-reward') {
            const ptIdx = draggingAnchorRef.current.pointIndex
            if (ptIdx === 0) {
              const oldEntry = nextPts[0].price
              const deltaP = curPoint.price - oldEntry
              nextPts[0] = { ...nextPts[0], price: curPoint.price }
              if (nextPts[1]) nextPts[1] = { ...nextPts[1], price: nextPts[1].price + deltaP }
              if (nextPts[2]) nextPts[2] = { ...nextPts[2], price: nextPts[2].price + deltaP }
            } else if (ptIdx === 1) {
              nextPts[1] = { ...nextPts[1], price: curPoint.price }
            } else if (ptIdx === 2) {
              nextPts[2] = { time: nextPts[0].time, price: curPoint.price }
            } else if (ptIdx === 3) {
              nextPts[1] = { ...nextPts[1], time: curPoint.time }
            }
          } else {
            nextPts[draggingAnchorRef.current.pointIndex] = curPoint
          }
          onUpdateDrawing(sel.id, { points: nextPts })
        }
        return
      }

      // 7. Dragging Drawing Body (Moving entire object)
      if (draggingDrawingBodyRef.current) {
        const { drawingId, startX, startY, initialPoints } = draggingDrawingBodyRef.current
        const deltaPrice = yToPrice(y) - yToPrice(startY)
        const deltaTime = xToTime(x) - xToTime(startX)

        const shifted = initialPoints.map((p) => ({
          time: p.time + deltaTime,
          price: parseFloat((p.price + deltaPrice).toFixed(digits)),
        }))
        onUpdateDrawing(drawingId, { points: shifted })
        return
      }

      // 8. 2D Chart Panning (Horizontal Time Pan + Vertical Price Pan)
      if (isDraggingChartRef.current && dragStartRef.current) {
        const deltaX = x - dragStartRef.current.x
        const candlesMoved = deltaX / candleWidth
        const visibleBars = Math.ceil(chartW / candleWidth)
        const minOffset = -Math.floor(visibleBars * 0.7)
        const maxOffset = Math.max(10, candles.length - 10)
        const newOffset = Math.max(minOffset, Math.min(maxOffset, dragStartRef.current.scrollOffset + candlesMoved))
        setScrollOffset(parseFloat(newOffset.toFixed(1)))

        const deltaY = y - dragStartRef.current.y
        const { range } = getPriceBounds()
        const pricePerPx = range / Math.max(1, mainH)
        const newYOffset = dragStartRef.current.yScaleOffset + deltaY * pricePerPx
        setYScaleOffset(parseFloat(newYOffset.toFixed(digits > 2 ? 2 : 5)))
      }
    }

    // Mouse Up Event (Finalize Orders, Drawings, Scale)
    const handleMouseUp = () => {
      isDraggingChartRef.current = false
      isDraggingAxisRef.current = false
      dragStartRef.current = null
      draggingAnchorRef.current = null
      draggingDrawingBodyRef.current = null
      setCanvasCursor(activeTool === 'select' ? 'grab' : 'crosshair')

      // 1. Finalize SL/TP modification
      if (draggingSlTpRef.current && draggingSlTpPreview) {
        const pos = draggingSlTpRef.current.pos
        const newPrice = parseFloat(draggingSlTpPreview.price.toFixed(digits))
        const isSl = draggingSlTpRef.current.type === 'sl' || draggingSlTpRef.current.type === 'new_sl'

        const finalSl = isSl ? newPrice : pos.sl !== null ? toNum(pos.sl) : null
        const finalTp = !isSl ? newPrice : pos.tp !== null ? toNum(pos.tp) : null

        api.sltp(pos.id, finalSl, finalTp).then((r) => {
          if (r.ok && r.data.success) {
            playOrderSuccessSound()
            toast.success(`Updated ${isSl ? 'Stop Loss' : 'Take Profit'} for #${pos.id} @ ${fmtPrice(newPrice, digits)}`)
            invalidateFxsim('/positions')
            onChanged?.()
          } else {
            playOrderLossThumpSound()
            toast.error(r.ok ? r.data?.message || 'Failed to update SL/TP' : 'Network error')
          }
        })

        draggingSlTpRef.current = null
        setDraggingSlTpPreview(null)
      }

      // 2. Finalize Pending order modification
      if (draggingPendingRef.current) {
        const ord = draggingPendingRef.current.order
        const finalPrice = draggingPendingRef.current.currentPrice || draggingPendingPreview?.price || toNum(ord.target_price)
        handlePendingDrop(ord, finalPrice)
      }

      // 3. Finalize Drawing in Progress
      if (drawingInProgressRef.current) {
        try {
          const d = { ...drawingInProgressRef.current, points: Array.isArray(drawingInProgressRef.current.points) ? [...drawingInProgressRef.current.points] : [] }
        const tfMs = TIMEFRAME_SECONDS[timeframe] * 1000
        const { range } = getPriceBounds()
        const symMeta = getSymbolMeta(symbol)
        const effPip = symMeta.pipSize || pSize || 1
        const defaultDist = Math.max(effPip * 30, range * 0.08)

        if (d.type === 'risk-reward') {
          const p0 = d.points[0]
          const p1 = d.points[1]
          // If single clicked without dragging or minimal drag distance
          if (!p1 || Math.abs(p0.price - p1.price) <= effPip * 2) {
            const slP = parseFloat((p0.price - defaultDist).toFixed(digits))
            const tpP = parseFloat((p0.price + defaultDist * 2).toFixed(digits))
            d.points = [
              p0,
              { time: p0.time + 18 * tfMs, price: slP },
              { time: p0.time, price: tpP },
            ]
          }
        } else if (d.type === 'fibonacci') {
          const p0 = d.points[0]
          const p1 = d.points[1]
          if (!p1 || Math.abs(p0.price - p1.price) <= effPip * 2) {
            const fibDist = Math.max(effPip * 50, range * 0.15)
            d.points = [
              { time: p0.time - 25 * tfMs, price: parseFloat((p0.price + fibDist).toFixed(digits)) },
              { time: p0.time, price: p0.price },
            ]
          }
        } else if (d.type === 'rectangle') {
          const p0 = d.points[0]
          const p1 = d.points[1]
          if (!p1 || Math.abs(p0.price - p1.price) <= effPip * 2) {
            const rectH = Math.max(effPip * 25, range * 0.05)
            d.points = [
              p0,
              { time: p0.time + 20 * tfMs, price: parseFloat((p0.price - rectH).toFixed(digits)) },
            ]
          }
        } else if (d.type === 'channel') {
          const p0 = d.points[0]
          const p1 = d.points[1]
          if (!p1 || Math.abs(p0.price - p1.price) <= effPip * 2) {
            const chanH = Math.max(effPip * 30, range * 0.06)
            d.points = [
              { time: p0.time - 20 * tfMs, price: parseFloat((p0.price + chanH).toFixed(digits)) },
              p0,
              { time: p0.time, price: parseFloat((p0.price - chanH).toFixed(digits)) },
            ]
          }
        }

        onAddDrawing(d)
        onSelectDrawing(d.id)
        } catch {
          // Defensive: suppress error on corrupt in-progress drawing points
        } finally {
          drawingInProgressRef.current = null
          onSelectTool('select')
        }
      }

      // 4. Deactivate Pip Ruler if triggered via middle mouse
      if (rulerRef.current.active && activeTool !== 'crosshair') {
        rulerRef.current.active = false
        setRulerDisplay(null)
      }
    }

    // Double Click (Reset Scale & Pan to Auto-fit)
    const handleDoubleClick = () => {
      resetScale()
    }

    // Context Menu Handler
    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const price = parseFloat(yToPrice(y).toFixed(digits))
      onRightClick({ x: e.clientX, y: e.clientY, price })
    }

    // Touch & Multi-Touch Gestures for 100% Mobile Panning (Left/Right/Up/Down) & Pinch Zoom
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const onTouchStart = (e: TouchEvent) => {
        const rect = canvas.getBoundingClientRect()
        if (e.touches.length === 1) {
          const touch = e.touches[0]
          const x = touch.clientX - rect.left
          const y = touch.clientY - rect.top
          const { chartW } = getLayout()

          // Double tap detection (< 300ms) to reset auto-fit scale
          const now = Date.now()
          if (now - touchStateRef.current.lastTapTime < 300) {
            resetScale()
            touchStateRef.current.lastTapTime = 0
            return
          }
          touchStateRef.current.lastTapTime = now

          const isAxis = x >= chartW
          const showTradePositions = indicatorsRef.current.tradeLevels?.showPositions ?? true

          if (showTradePositions) {
            const safePositions = Array.isArray(positionsRef.current) ? positionsRef.current : []
            const symPositions = safePositions.filter((p) => p && typeof p === 'object' && p.symbol === symbol)
            for (const pos of symPositions) {
              try {
                if (!pos || typeof pos !== 'object') continue
                const openPrice = toNum(pos.open_price)
                const slPrice = pos.sl !== null ? toNum(pos.sl) : 0
                const tpPrice = pos.tp !== null ? toNum(pos.tp) : 0
                const yEntry = priceToY(openPrice)
                const ySl = slPrice > 0 ? priceToY(slPrice) : -999
                const yTp = tpPrice > 0 ? priceToY(tpPrice) : -999
                const isBuy = pos.type === 'buy'
                const badgeRight = chartW - 8
                const entryBadgeW = 140 + digits * 8 + 36
                const badgeX = badgeRight - entryBadgeW

                // (a) Quick tap to close position [x] button on chart
                if (Math.abs(y - yEntry) < 20 && x >= badgeRight - 38 && x <= badgeRight + 12) {
                  api.close(pos.id).then((r) => {
                    if (r.ok && r.data.success) {
                      playOrderSuccessSound()
                      toast.success(`Position #${pos.id} closed @ ${fmtPrice(yToPrice(y), digits)}`)
                      invalidateFxsim('/positions')
                      invalidateFxsim('/account')
                      onChanged?.()
                    }
                  })
                  return
                }

                // (b) Touch [+ Drag SL] handle (Left of right-aligned badge)
                const slHandleY = isBuy ? yEntry + 22 : yEntry - 22
                const slHandleX = badgeX - 78
                if ((!pos.sl || toNum(pos.sl) === 0) && Math.abs(y - slHandleY) < 22 && x >= slHandleX - 14 && x <= slHandleX + 85) {
                  touchStateRef.current.isDragging = false
                  touchStateRef.current.isDraggingSlTp = true
                  draggingSlTpRef.current = {
                    posId: pos.id,
                    type: 'new_sl',
                    currentPrice: openPrice,
                    initialPrice: openPrice,
                    pos,
                  }
                  if (e.cancelable) e.preventDefault()
                  return
                }

                // (c) Touch [+ Drag TP] handle (Left of right-aligned badge)
                const tpHandleY = isBuy ? yEntry - 22 : yEntry + 22
                const tpHandleX = badgeX - 156
                if ((!pos.tp || toNum(pos.tp) === 0) && Math.abs(y - tpHandleY) < 22 && x >= tpHandleX - 14 && x <= tpHandleX + 85) {
                  touchStateRef.current.isDragging = false
                  touchStateRef.current.isDraggingSlTp = true
                  draggingSlTpRef.current = {
                    posId: pos.id,
                    type: 'new_tp',
                    currentPrice: openPrice,
                    initialPrice: openPrice,
                    pos,
                  }
                  if (e.cancelable) e.preventDefault()
                  return
                }

                // (d) Tap [x] Remove SL (Right-aligned [x] on SL badge, positioned below line)
                if (slPrice > 0 && Math.abs(y - (ySl + 12)) < 20 && x >= chartW - 32 && x <= chartW + 6) {
                  api.sltp(pos.id, null, pos.tp !== null ? toNum(pos.tp) : null).then((r) => {
                    if (r.ok && r.data.success) {
                      playOrderSuccessSound()
                      toast.success(`Removed Stop Loss from #${pos.id}`)
                      invalidateFxsim('/positions')
                      onChanged?.()
                    }
                  })
                  return
                }

                // (e) Tap [x] Remove TP (Right-aligned [x] on TP badge, positioned above line)
                if (tpPrice > 0 && Math.abs(y - (yTp - 14)) < 20 && x >= chartW - 32 && x <= chartW + 6) {
                  api.sltp(pos.id, pos.sl !== null ? toNum(pos.sl) : null, null).then((r) => {
                    if (r.ok && r.data.success) {
                      playOrderSuccessSound()
                      toast.success(`Removed Take Profit from #${pos.id}`)
                      invalidateFxsim('/positions')
                      onChanged?.()
                    }
                  })
                  return
                }

                // (f) Touch & Drag existing SL Line or SL badge (below line)
                if (slPrice > 0 && (Math.abs(y - ySl) < 18 || (y >= ySl - 4 && y <= ySl + 28 && x >= badgeRight - 220 && x <= chartW - 30))) {
                  touchStateRef.current.isDragging = false
                  touchStateRef.current.isDraggingSlTp = true
                  draggingSlTpRef.current = {
                    posId: pos.id,
                    type: 'sl',
                    currentPrice: slPrice,
                    initialPrice: slPrice,
                    pos,
                  }
                  if (e.cancelable) e.preventDefault()
                  return
                }

                // (g) Touch & Drag existing TP Line or TP badge (above line)
                if (tpPrice > 0 && (Math.abs(y - yTp) < 18 || (y >= yTp - 28 && y <= yTp + 4 && x >= badgeRight - 220 && x <= chartW - 30))) {
                  touchStateRef.current.isDragging = false
                  touchStateRef.current.isDraggingSlTp = true
                  draggingSlTpRef.current = {
                    posId: pos.id,
                    type: 'tp',
                    currentPrice: tpPrice,
                    initialPrice: tpPrice,
                    pos,
                  }
                  if (e.cancelable) e.preventDefault()
                  return
                }
              } catch {
                continue
              }
            }

            // (h) Pending orders touch cancellation & dragging (select closest order)
            const safePending = Array.isArray(pendingOrdersRef.current) ? pendingOrdersRef.current : []
            const symPending = safePending.filter((o) => o && typeof o === 'object' && o.symbol === symbol && o.status === 'pending')
            const ordBadgeRight = chartW - 8

            // Quick tap to cancel pending order [x] button on chart
            let closestTouchCancel: PendingOrder | null = null
            let minTouchCancelDist = 18
            for (const ord of symPending) {
              try {
                if (!ord || typeof ord !== 'object') continue
                const tgtPrice = toNum(ord.target_price)
                if (tgtPrice <= 0) continue
                const yTgt = priceToY(tgtPrice)
                const dY = Math.abs(y - yTgt)
                if (dY < minTouchCancelDist && x >= ordBadgeRight - 36 && x <= ordBadgeRight + 12) {
                  minTouchCancelDist = dY
                  closestTouchCancel = ord
                }
              } catch {
                continue
              }
            }
            if (closestTouchCancel) {
              api.pendingCancel(closestTouchCancel.id).then((r) => {
                if (r.ok && r.data.success) {
                  playOrderSuccessSound()
                  toast.success(`Cancelled pending order #${closestTouchCancel.id}`)
                  invalidateFxsim('/pending-order/my')
                  onChanged?.()
                } else {
                  playOrderLossThumpSound()
                  toast.error(r.ok ? r.data.message || 'Failed to cancel order' : r.error)
                }
              })
              return
            }

            // Touch & Drag closest pending order target price line
            let closestTouchDrag: PendingOrder | null = null
            let minTouchDragDist = 18
            for (const ord of symPending) {
              try {
                if (!ord || typeof ord !== 'object') continue
                const tgtPrice = toNum(ord.target_price)
                if (tgtPrice <= 0) continue
                const yTgt = priceToY(tgtPrice)
                const dY = Math.abs(y - yTgt)
                if (dY < minTouchDragDist && x < chartW) {
                  minTouchDragDist = dY
                  closestTouchDrag = ord
                }
              } catch {
                continue
              }
            }
            if (closestTouchDrag) {
              const tgtPrice = toNum(closestTouchDrag.target_price)
              touchStateRef.current.isDragging = false
              touchStateRef.current.isDraggingSlTp = false
              touchStateRef.current.isDraggingPending = true
              draggingPendingRef.current = {
                ordId: closestTouchDrag.id,
                order: closestTouchDrag,
                currentPrice: tgtPrice,
                initialPrice: tgtPrice,
              }
              if (e.cancelable) e.preventDefault()
              return
            }
          }

          touchStateRef.current.isDragging = true
          touchStateRef.current.isDraggingSlTp = false
          touchStateRef.current.isPinching = false
          touchStateRef.current.isAxisDrag = isAxis
          touchStateRef.current.startX = x
          touchStateRef.current.startY = y
          touchStateRef.current.startScrollOffset = scrollOffsetRef.current
          touchStateRef.current.startYScaleOffset = yScaleOffsetRef.current
          touchStateRef.current.startYScaleFactor = yScaleFactorRef.current

          mousePosRef.current = { x, y, onAxis: isAxis, onChart: !isAxis }
          setMousePos({ x, y, onAxis: isAxis, onChart: !isAxis })
        } else if (e.touches.length === 2) {
          const t0 = e.touches[0]
          const t1 = e.touches[1]
          const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
          touchStateRef.current.isDragging = false
          touchStateRef.current.isDraggingSlTp = false
          touchStateRef.current.isPinching = true
          touchStateRef.current.initialPinchDistance = Math.max(10, dist)
          touchStateRef.current.initialCandleWidth = candleWidthRef.current
        }
      }

      const onTouchMove = (e: TouchEvent) => {
        // Stop browser page scrolling / pull-to-refresh
        if (e.cancelable) {
          e.preventDefault()
        }

        const rect = canvas.getBoundingClientRect()
        if (e.touches.length === 1) {
          const touch = e.touches[0]
          const x = touch.clientX - rect.left
          const y = touch.clientY - rect.top
          const { chartW, mainH } = getLayout()

          mousePosRef.current = { x, y, onAxis: x >= chartW, onChart: x < chartW }
          setMousePos({ x, y, onAxis: x >= chartW, onChart: x < chartW })

          // Active Touch SL/TP Dragging
          if (touchStateRef.current.isDraggingSlTp && draggingSlTpRef.current) {
            const curPrice = yToPrice(y)
            const pos = draggingSlTpRef.current.pos
            const openPrice = toNum(pos.open_price)
            const symMeta = getSymbolMeta(symbol)
            const isBuy = pos.type === 'buy'
            const activePrices = usePrices.getState().prices

            const distPips = Math.abs(curPrice - openPrice) / symMeta.pipSize
            const projPnl =
              calcLevelPnL({
                level: curPrice,
                entry: openPrice,
                lots: toNum(pos.lot_size ?? (pos as any).lots ?? (pos as any).volume ?? 0.01),
                contractSize: symMeta.contractSize,
                mode: 'market',
                isBuy,
                quoteToUsd: quoteToUsdRate(symbol, openPrice, activePrices),
              }) || 0

            draggingSlTpRef.current.currentPrice = curPrice
            setDraggingSlTpPreview({
              posId: pos.id,
              type: draggingSlTpRef.current.type,
              price: curPrice,
              pips: distPips,
              estPnL: projPnl,
            })
            return
          }

          // Active Touch Pending Order Dragging
          if (touchStateRef.current.isDraggingPending && draggingPendingRef.current) {
            const curPrice = yToPrice(y)
            draggingPendingRef.current.currentPrice = curPrice
            setDraggingPendingPreview({
              ordId: draggingPendingRef.current.ordId,
              price: curPrice,
            })
            return
          }

          if (touchStateRef.current.isDragging) {
            if (touchStateRef.current.isAxisDrag) {
              const deltaY = touchStateRef.current.startY - y
              const factorChange = deltaY * 0.005
              const newFactor = Math.max(0.2, Math.min(6.0, touchStateRef.current.startYScaleFactor + factorChange))
              setYScaleFactor(parseFloat(newFactor.toFixed(3)))
              return
            }

            // 2D Pan (Horizontal Time Pan + Vertical Price Pan)
            const deltaX = x - touchStateRef.current.startX
            const curCandleW = candleWidthRef.current
            const candlesMoved = deltaX / curCandleW
            const visibleBars = Math.ceil(chartW / curCandleW)
            const minOffset = -Math.floor(visibleBars * 0.7)
            const maxOffset = Math.max(10, candlesRef.current.length - 10)
            const newOffset = Math.max(minOffset, Math.min(maxOffset, touchStateRef.current.startScrollOffset + candlesMoved))
            setScrollOffset(parseFloat(newOffset.toFixed(1)))

            const deltaY = y - touchStateRef.current.startY
            const { range } = getPriceBounds()
            const pricePerPx = range / Math.max(1, mainH)
            const newYOffset = touchStateRef.current.startYScaleOffset + deltaY * pricePerPx
            setYScaleOffset(parseFloat(newYOffset.toFixed(digits > 2 ? 2 : 5)))
          }
        } else if (e.touches.length === 2 && touchStateRef.current.isPinching) {
          const t0 = e.touches[0]
          const t1 = e.touches[1]
          const curDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
          const ratio = curDist / (touchStateRef.current.initialPinchDistance || 1)
          const newW = Math.max(2.5, Math.min(48, touchStateRef.current.initialCandleWidth * ratio))
          setCandleWidth(parseFloat(newW.toFixed(2)))
        }
      }

      const onTouchEnd = (e: TouchEvent) => {
        if (touchStateRef.current.isDraggingSlTp) {
          touchStateRef.current.isDraggingSlTp = false
          if (draggingSlTpRef.current) {
            const pos = draggingSlTpRef.current.pos
            const finalPrice = draggingSlTpRef.current.currentPrice
            const newPrice = parseFloat(finalPrice.toFixed(digits))
            const isSl = draggingSlTpRef.current.type === 'sl' || draggingSlTpRef.current.type === 'new_sl'

            const finalSl = isSl ? newPrice : pos.sl !== null ? toNum(pos.sl) : null
            const finalTp = !isSl ? newPrice : pos.tp !== null ? toNum(pos.tp) : null

            api.sltp(pos.id, finalSl, finalTp).then((r) => {
              if (r.ok && r.data.success) {
                playOrderSuccessSound()
                toast.success(
                  `Updated ${isSl ? 'Stop Loss' : 'Take Profit'} for #${pos.id} @ ${fmtPrice(newPrice, digits)}`
                )
                invalidateFxsim('/positions')
                onChanged?.()
              } else {
                playOrderLossThumpSound()
                toast.error(r.ok ? r.data?.message || 'Failed to update SL/TP' : 'Network error')
              }
            })
            draggingSlTpRef.current = null
            setDraggingSlTpPreview(null)
          }
          return
        }

        if (touchStateRef.current.isDraggingPending) {
          touchStateRef.current.isDraggingPending = false
          if (draggingPendingRef.current) {
            const ord = draggingPendingRef.current.order
            const finalPrice = draggingPendingRef.current.currentPrice
            handlePendingDrop(ord, finalPrice)
          }
          return
        }

        if (e.touches.length === 0) {
          touchStateRef.current.isDragging = false
          touchStateRef.current.isPinching = false
          touchStateRef.current.isAxisDrag = false
          touchStateRef.current.isDraggingPending = false
        } else if (e.touches.length === 1) {
          const touch = e.touches[0]
          const rect = canvas.getBoundingClientRect()
          const x = touch.clientX - rect.left
          const y = touch.clientY - rect.top
          touchStateRef.current.isDragging = true
          touchStateRef.current.isPinching = false
          touchStateRef.current.startX = x
          touchStateRef.current.startY = y
          touchStateRef.current.startScrollOffset = scrollOffsetRef.current
          touchStateRef.current.startYScaleOffset = yScaleOffsetRef.current
        }
      }

      canvas.addEventListener('touchstart', onTouchStart, { passive: false })
      canvas.addEventListener('touchmove', onTouchMove, { passive: false })
      canvas.addEventListener('touchend', onTouchEnd, { passive: false })
      canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })

      return () => {
        canvas.removeEventListener('touchstart', onTouchStart)
        canvas.removeEventListener('touchmove', onTouchMove)
        canvas.removeEventListener('touchend', onTouchEnd)
        canvas.removeEventListener('touchcancel', onTouchEnd)
      }
    }, [digits, symbol, onChanged, resetScale, getLayout, getPriceBounds, priceToY, yToPrice])

    return (
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-black select-none touch-none"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{ cursor: canvasCursor, touchAction: 'none' }}
          className="w-full h-full block touch-none"
        />

        {/* Bottom Floating Navigation & Zoom Dock ([-] [+] [Reset]) — Centered at bottom with Day/Night glassmorphism */}
        <div className={cn(
          "absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full select-none transition-all shadow-sm backdrop-blur-md",
          theme === 'daylight'
            ? "bg-white/50 hover:bg-white/85 border border-slate-300/70 text-slate-700 hover:text-slate-950 hover:shadow-md"
            : "bg-black/40 hover:bg-black/75 border border-white/10 text-white/70 hover:text-white hover:border-white/20 hover:shadow-md"
        )}>
          <button
            type="button"
            onClick={zoomOut}
            className="p-1 rounded-full hover:bg-white/15 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className={cn("w-px h-3.5", theme === 'daylight' ? "bg-slate-300/70" : "bg-white/15")} />
          <button
            type="button"
            onClick={zoomIn}
            className="p-1 rounded-full hover:bg-white/15 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className={cn("w-px h-3.5", theme === 'daylight' ? "bg-slate-300/70" : "bg-white/15")} />
          <button
            type="button"
            onClick={resetScale}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-terminal-micro font-medium hover:bg-white/15 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Reset Chart View & Scale"
            aria-label="Reset Chart"
          >
            <RotateCcw className="w-3 h-3 text-accent" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    )
  })
)
