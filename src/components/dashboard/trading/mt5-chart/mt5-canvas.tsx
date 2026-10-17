'use client'

/**
 * MT5 Pro Chart Engine — High-Frequency HTML5 2D Canvas Core
 * 60 FPS requestAnimationFrame rendering with DPI awareness, MT5 camera & axis physics,
 * on-chart trade drag-and-drop lines, persistent vector drawings, and technical indicators.
 */

import React, { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
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
import { fmtPrice, toNum } from '@/lib/format'
import { pipSize } from '@/lib/symbol-meta'
import { calculateLivePositionPnL, calcLevelPnL, quoteToUsdRate } from '@/lib/order-math'
import type { Position, PendingOrder } from '@/types/api'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { toast } from 'sonner'
import { playOrderSuccessSound, playOrderLossThumpSound } from '@/lib/sound-effects'
import { usePrices } from '@/store/prices'

const PRICE_AXIS_WIDTH = 75
const TIME_AXIS_HEIGHT = 26
const SUB_PANE_HEIGHT = 100

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

export const Mt5Canvas = memo(function Mt5Canvas({
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
}: Mt5CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Camera & viewport physics
  const [candleWidth, setCandleWidth] = useState(8) // Zoom level (pixels per candle)
  const [scrollOffset, setScrollOffset] = useState(0) // Candles shifted into past (0 = latest on right)
  const [yScaleFactor, setYScaleFactor] = useState(1.0) // Manual Y-scale expansion factor
  const [yScaleOffset, setYScaleOffset] = useState(0) // Vertical pan offset in price units

  // Mouse & interaction states
  const mousePosRef = useRef<{ x: number; y: number; onAxis: boolean; onChart: boolean } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number; onAxis: boolean; onChart: boolean } | null>(null)
  const isDraggingChartRef = useRef(false)
  const isDraggingAxisRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number; scrollOffset: number; yScaleFactor: number; yScaleOffset: number } | null>(null)

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

  // Vector drawing creation & modification state
  const drawingInProgressRef = useRef<DrawingObject | null>(null)
  const draggingAnchorRef = useRef<{ drawingId: string; pointIndex: number } | null>(null)
  const draggingDrawingBodyRef = useRef<{ drawingId: string; startPoint: Point; initialPoints: Point[] } | null>(null)

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

  // Sub-pane active detection
  const hasSubPane = indicators.rsi.enabled || indicators.macd.enabled

  // Calculate coordinates and scales
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

  // Calculate visible price bounds with manual scale factor
  const getPriceBounds = useCallback(() => {
    const { visible } = getVisibleSlice()
    if (visible.length === 0) return { min: 1.0, max: 1.1, range: 0.1 }

    let min = Infinity
    let max = -Infinity

    for (const c of visible) {
      if (c.low < min) min = c.low
      if (c.high > max) max = c.high
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

  // Conversion helpers: Price to Y, Y to Price, Candle Index to X, X to Candle Index
  const priceToY = useCallback(
    (price: number): number => {
      const { mainH } = getLayout()
      const { min, max, range } = getPriceBounds()
      if (range <= 0) return mainH / 2
      return mainH - ((price - min) / range) * mainH
    },
    [getLayout, getPriceBounds]
  )

  const yToPrice = useCallback(
    (y: number): number => {
      const { mainH } = getLayout()
      const { min, max, range } = getPriceBounds()
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

  // Snap point to nearest candle OHLC if Magnet Mode is enabled
  const snapToCandle = useCallback(
    (p: Point): Point => {
      if (!magnetMode || candles.length === 0) return p
      const idx = candles.findIndex((c) => Math.abs(c.time - p.time) < TIMEFRAME_SECONDS[timeframe] * 1000)
      if (idx === -1) return p
      const c = candles[idx]
      const candidates = [c.open, c.high, c.low, c.close]
      let closest = candidates[0]
      let minDist = Math.abs(closest - p.price)
      for (let i = 1; i < candidates.length; i++) {
        const dist = Math.abs(candidates[i] - p.price)
        if (dist < minDist) {
          minDist = dist
          closest = candidates[i]
        }
      }
      return { time: c.time, price: closest }
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
    ctx.scale(dpr, dpr)

    const { mainH, subH, chartW } = getLayout()
    const { visible, startIndex, endIndex } = getVisibleSlice()
    const { min: minP, max: maxP, range: rangeP } = getPriceBounds()

    // 1. Background
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)

    // 2. Dotted Grid (G)
    if (showGrid && rangeP > 0) {
      ctx.save()
      ctx.strokeStyle = colors.grid
      ctx.lineWidth = 1
      ctx.setLineDash([1, 3])

      // Horizontal price grid lines
      const stepP = Math.pow(10, Math.floor(Math.log10(rangeP))) || pSize * 10
      const gridStep = rangeP / 6
      for (let p = Math.ceil(minP / gridStep) * gridStep; p < maxP; p += gridStep) {
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
      ctx.restore()
    }

    // 3. Period Separators (Y) — day or week boundaries
    if (showPeriodSeparators) {
      ctx.save()
      ctx.strokeStyle = colors.gridPeriod
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])

      for (let i = 1; i < visible.length; i++) {
        const prev = new Date(visible[i - 1].time)
        const curr = new Date(visible[i].time)
        // Detect day turnover
        if (prev.getUTCDate() !== curr.getUTCDate()) {
          const x = candleIndexToX(startIndex + i)
          ctx.beginPath()
          ctx.moveTo(Math.floor(x) + 0.5, 0)
          ctx.lineTo(Math.floor(x) + 0.5, mainH)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // 4. Killzone Sessions Overlay
    if (indicators.killzones.enabled) {
      ctx.save()
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
      ctx.restore()
    }

    // 5. Technical Overlays (SMA, EMA, Bollinger Bands, VWAP)
    if (indicators.bb.enabled) {
      const bb = calcBollingerBands(candles, indicators.bb.period, indicators.bb.stdDev)
      ctx.save()
      ctx.strokeStyle = indicators.bb.color
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(99, 102, 241, 0.05)'

      // Fill band cloud
      ctx.beginPath()
      let started = false
      for (let i = startIndex; i <= endIndex; i++) {
        const u = bb.upper[i]
        if (u !== null) {
          const x = candleIndexToX(i)
          const y = priceToY(u)
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
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

      // Draw upper and lower lines
      const drawLine = (arr: (number | null)[]) => {
        ctx.beginPath()
        let s = false
        for (let i = startIndex; i <= endIndex; i++) {
          const val = arr[i]
          if (val !== null) {
            const x = candleIndexToX(i)
            const y = priceToY(val)
            if (!s) { ctx.moveTo(x, y); s = true }
            else ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      }
      drawLine(bb.upper)
      drawLine(bb.middle)
      drawLine(bb.lower)
      ctx.restore()
    }

    // EMA overlays
    if (indicators.ema.enabled) {
      const renderEMA = (period: number, color: string) => {
        const emaValues = calcEMA(candles, period)
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        let s = false
        for (let i = startIndex; i <= endIndex; i++) {
          const val = emaValues[i]
          if (val !== null) {
            const x = candleIndexToX(i)
            const y = priceToY(val)
            if (!s) { ctx.moveTo(x, y); s = true }
            else ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        ctx.restore()
      }
      if (indicators.ema.p20) renderEMA(20, indicators.ema.c20)
      if (indicators.ema.p50) renderEMA(50, indicators.ema.c50)
      if (indicators.ema.p200) renderEMA(200, indicators.ema.c200)
    }

    // SMA overlay
    if (indicators.sma.enabled) {
      const smaValues = calcSMA(candles, indicators.sma.period)
      ctx.save()
      ctx.strokeStyle = indicators.sma.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let s = false
      for (let i = startIndex; i <= endIndex; i++) {
        const val = smaValues[i]
        if (val !== null) {
          const x = candleIndexToX(i)
          const y = priceToY(val)
          if (!s) { ctx.moveTo(x, y); s = true }
          else ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.restore()
    }

    // VWAP overlay
    if (indicators.vwap.enabled) {
      const vwapValues = calcVWAP(candles)
      ctx.save()
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
          if (!s) { ctx.moveTo(x, y); s = true }
          else ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.restore()
    }

    // 6. Volume Histogram at Bottom of Main Chart
    if (indicators.volume.enabled) {
      const maxVol = Math.max(...visible.map((c) => c.volume), 1)
      const volH = Math.min(60, mainH * 0.18)
      ctx.save()
      for (let i = 0; i < visible.length; i++) {
        const c = visible[i]
        const x = candleIndexToX(startIndex + i)
        const isUp = c.close >= c.open
        const h = (c.volume / maxVol) * volH
        ctx.fillStyle = isUp ? colors.volumeUp : colors.volumeDown
        ctx.fillRect(x - candleWidth * 0.4, mainH - h, candleWidth * 0.8, h)
      }
      ctx.restore()
    }

    // 7. Render Candles / Bars / Line / Heikin Ashi
    const renderCandles = chartStyle === 'heikin-ashi' ? calcHeikinAshi(candles).slice(startIndex, endIndex + 1) : visible

    if (chartStyle === 'line') {
      // Line chart
      ctx.save()
      ctx.strokeStyle = colors.lineColor
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < renderCandles.length; i++) {
        const c = renderCandles[i]
        const x = candleIndexToX(startIndex + i)
        const y = priceToY(c.close)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Gradient area under line
      const grad = ctx.createLinearGradient(0, 0, 0, mainH)
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)')
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)')
      ctx.fillStyle = grad
      ctx.lineTo(candleIndexToX(endIndex), mainH)
      ctx.lineTo(candleIndexToX(startIndex), mainH)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    } else if (chartStyle === 'bar') {
      // OHLC Bars
      ctx.save()
      ctx.lineWidth = 1.5
      for (let i = 0; i < renderCandles.length; i++) {
        const c = renderCandles[i]
        const x = candleIndexToX(startIndex + i)
        const isUp = c.close >= c.open
        const color = isUp ? colors.candleUp : colors.candleDown

        ctx.strokeStyle = color
        const yHigh = priceToY(c.high)
        const yLow = priceToY(c.low)
        const yOpen = priceToY(c.open)
        const yClose = priceToY(c.close)

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
      ctx.restore()
    } else {
      // Candlesticks (or Heikin Ashi)
      ctx.save()
      for (let i = 0; i < renderCandles.length; i++) {
        const c = renderCandles[i]
        const x = candleIndexToX(startIndex + i)
        const isUp = c.close >= c.open

        const yHigh = priceToY(c.high)
        const yLow = priceToY(c.low)
        const yOpen = priceToY(c.open)
        const yClose = priceToY(c.close)

        const topY = Math.min(yOpen, yClose)
        const botY = Math.max(yOpen, yClose)
        const bodyH = Math.max(1, botY - topY)
        const halfW = Math.max(1, candleWidth * 0.4)

        // High/Low Wick
        ctx.strokeStyle = isUp ? colors.candleUpWick : colors.candleDownWick
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(Math.floor(x) + 0.5, yHigh)
        ctx.lineTo(Math.floor(x) + 0.5, topY)
        ctx.moveTo(Math.floor(x) + 0.5, botY)
        ctx.lineTo(Math.floor(x) + 0.5, yLow)
        ctx.stroke()

        // Body
        ctx.fillStyle = isUp ? colors.candleUp : colors.candleDown
        ctx.strokeStyle = isUp ? colors.candleUpBorder : colors.candleDownBorder
        ctx.lineWidth = 1

        ctx.fillRect(x - halfW, topY, halfW * 2, bodyH)
        ctx.strokeRect(x - halfW, topY, halfW * 2, bodyH)
      }
      ctx.restore()
    }

    // 8. Vector Drawings (Persistent annotations)
    const allDrawingsToRender = [...drawings]
    if (drawingInProgressRef.current) allDrawingsToRender.push(drawingInProgressRef.current)

    for (const d of allDrawingsToRender) {
      if (!d.visible || d.points.length === 0) continue

      ctx.save()
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

        // Price badge on right
        ctx.fillStyle = d.color
        ctx.fillRect(chartW + 1, y - 9, PRICE_AXIS_WIDTH - 2, 18)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(fmtPrice(d.points[0].price, digits), chartW + PRICE_AXIS_WIDTH / 2, y + 4)
      } else if (d.type === 'vline') {
        const idx = candles.findIndex((c) => Math.abs(c.time - d.points[0].time) < TIMEFRAME_SECONDS[timeframe] * 1000)
        if (idx !== -1) {
          const x = candleIndexToX(idx)
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, mainH)
          ctx.stroke()
        }
      } else if (d.type === 'trendline' && d.points.length >= 2) {
        const idx0 = candles.findIndex((c) => Math.abs(c.time - d.points[0].time) < TIMEFRAME_SECONDS[timeframe] * 1000)
        const idx1 = candles.findIndex((c) => Math.abs(c.time - d.points[1].time) < TIMEFRAME_SECONDS[timeframe] * 1000)
        if (idx0 !== -1 && idx1 !== -1) {
          const x0 = candleIndexToX(idx0)
          const y0 = priceToY(d.points[0].price)
          const x1 = candleIndexToX(idx1)
          const y1 = priceToY(d.points[1].price)

          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          if (d.extendRight && x1 !== x0) {
            // Infinite ray extension to right border
            const slope = (y1 - y0) / (x1 - x0)
            const extendedY = y1 + slope * (chartW - x1)
            ctx.lineTo(chartW, extendedY)
          }
          ctx.stroke()

          // Render angle and pip count badge
          const deltaPips = Math.abs(d.points[1].price - d.points[0].price) / pSize
          const midX = (x0 + x1) / 2
          const midY = (y0 + y1) / 2
          ctx.fillStyle = 'rgba(0,0,0,0.75)'
          ctx.fillRect(midX - 25, midY - 18, 50, 16)
          ctx.fillStyle = d.color
          ctx.font = '10px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`${deltaPips.toFixed(1)}p`, midX, midY - 6)
        }
      } else if (d.type === 'fibonacci' && d.points.length >= 2) {
        // Fibonacci Retracement with Golden Pocket
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

        // Shaded Golden Pocket (50% - 61.8%)
        const y50 = priceToY(p0 + diff * 0.5)
        const y618 = priceToY(p0 + diff * 0.618)
        ctx.fillStyle = colors.goldenPocket
        ctx.fillRect(0, Math.min(y50, y618), chartW, Math.abs(y618 - y50))

        for (const item of levels) {
          const lvlPrice = p0 + diff * item.l
          const y = priceToY(lvlPrice)
          ctx.strokeStyle = item.l === 0.618 || item.l === 0.5 ? '#F59E0B' : d.color
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(chartW, y)
          ctx.stroke()

          // Level Label
          ctx.fillStyle = d.color
          ctx.font = '10px monospace'
          ctx.textAlign = 'left'
          ctx.fillText(`${item.label} (${fmtPrice(lvlPrice, digits)})`, 10, y - 4)
        }
      } else if (d.type === 'rectangle' && d.points.length >= 2) {
        // Supply / Demand zone
        const idx0 = candles.findIndex((c) => Math.abs(c.time - d.points[0].time) < TIMEFRAME_SECONDS[timeframe] * 1000)
        const idx1 = candles.findIndex((c) => Math.abs(c.time - d.points[1].time) < TIMEFRAME_SECONDS[timeframe] * 1000)
        if (idx0 !== -1 && idx1 !== -1) {
          const x0 = candleIndexToX(idx0)
          const y0 = priceToY(d.points[0].price)
          const x1 = candleIndexToX(idx1)
          const y1 = priceToY(d.points[1].price)

          const rectX = Math.min(x0, x1)
          const rectY = Math.min(y0, y1)
          const rectW = d.extendRight ? chartW - rectX : Math.abs(x1 - x0)
          const rectH = Math.abs(y1 - y0)

          ctx.fillStyle = d.color.startsWith('#') ? `${d.color}22` : 'rgba(56, 189, 248, 0.15)'
          ctx.fillRect(rectX, rectY, rectW, rectH)
          ctx.strokeRect(rectX, rectY, rectW, rectH)
        }
      } else if (d.type === 'risk-reward' && d.points.length >= 2) {
        // Risk-Reward Tool (Target / Stop Box with R:R Ratio)
        const entryP = d.points[0].price
        const slP = d.points[1].price
        const isLong = d.isLong !== false
        const riskDist = Math.abs(entryP - slP)
        const rewardDist = riskDist * 2 // Default 1:2 R:R
        const tpP = isLong ? entryP + rewardDist : entryP - rewardDist

        const yEntry = priceToY(entryP)
        const ySl = priceToY(slP)
        const yTp = priceToY(tpP)

        // Shaded Risk Box (Red)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.18)'
        ctx.strokeStyle = '#EF4444'
        ctx.fillRect(0, Math.min(yEntry, ySl), chartW, Math.abs(ySl - yEntry))
        ctx.strokeRect(0, Math.min(yEntry, ySl), chartW, Math.abs(ySl - yEntry))

        // Shaded Reward Box (Green)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)'
        ctx.strokeStyle = '#10B981'
        ctx.fillRect(0, Math.min(yEntry, yTp), chartW, Math.abs(yTp - yEntry))
        ctx.strokeRect(0, Math.min(yEntry, yTp), chartW, Math.abs(yTp - yEntry))

        // R:R Badge
        ctx.fillStyle = '#050811'
        ctx.fillRect(20, yEntry - 12, 120, 24)
        ctx.fillStyle = '#10B981'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`1 : 2.0 R (Long)`, 26, yEntry + 4)
      } else if (d.type === 'text' && d.text) {
        const y = priceToY(d.points[0].price)
        const idx = candles.findIndex((c) => Math.abs(c.time - d.points[0].time) < TIMEFRAME_SECONDS[timeframe] * 1000)
        const x = idx !== -1 ? candleIndexToX(idx) : 50

        ctx.fillStyle = 'rgba(5, 8, 17, 0.85)'
        ctx.fillRect(x - 4, y - 16, ctx.measureText(d.text).width + 12, 22)
        ctx.strokeStyle = d.color
        ctx.strokeRect(x - 4, y - 16, ctx.measureText(d.text).width + 12, 22)

        ctx.fillStyle = d.color
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(d.text, x + 2, y)
      }

      // If selected: render interactive anchor handles (circles)
      if (isSel) {
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = '#00E676'
        ctx.lineWidth = 2
        for (let ptIdx = 0; ptIdx < d.points.length; ptIdx++) {
          const pt = d.points[ptIdx]
          const y = priceToY(pt.price)
          const idx = candles.findIndex((c) => Math.abs(c.time - pt.time) < TIMEFRAME_SECONDS[timeframe] * 1000)
          const x = idx !== -1 ? candleIndexToX(idx) : chartW / 2
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // 9. Interactive On-Chart Trade & Pending Order Lines (Drag-and-Drop SL/TP)
    const activePrices = usePrices.getState().prices
    const symPositions = positions.filter((p) => p.symbol === symbol)
    const symPending = pendingOrders.filter((o) => o.symbol === symbol && o.status === 'pending')

    for (const pos of symPositions) {
      const openPrice = toNum(pos.open_price)
      const slPrice = pos.sl !== null ? toNum(pos.sl) : 0
      const tpPrice = pos.tp !== null ? toNum(pos.tp) : 0
      const livePnl = calculateLivePositionPnL(pos as any, activePrices)
      const isBuy = pos.type === 'buy'

      ctx.save()

      // (a) Entry Line (Dashed)
      const yEntry = priceToY(openPrice)
      ctx.strokeStyle = isBuy ? '#38BDF8' : '#F43F5E'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.beginPath()
      ctx.moveTo(0, yEntry)
      ctx.lineTo(chartW, yEntry)
      ctx.stroke()

      // Entry badge & floating PnL
      const pnlColor = livePnl >= 0 ? '#10B981' : '#EF4444'
      const entryText = `${pos.type.toUpperCase()} ${pos.lot_size} #${pos.id} @ ${fmtPrice(openPrice, digits)} (${livePnl >= 0 ? '+' : ''}$${livePnl.toFixed(2)})`
      ctx.fillStyle = 'rgba(10, 15, 30, 0.92)'
      ctx.fillRect(8, yEntry - 12, ctx.measureText(entryText).width + 36, 22)
      ctx.strokeStyle = isBuy ? '#38BDF8' : '#F43F5E'
      ctx.strokeRect(8, yEntry - 12, ctx.measureText(entryText).width + 36, 22)

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(entryText, 14, yEntry + 3)

      // [x] Close button on Entry Line
      ctx.fillStyle = '#EF4444'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('×', ctx.measureText(entryText).width + 28, yEntry + 3)

      // (b) Stop Loss (SL) Line
      const activeSlPrice = draggingSlTpPreview?.posId === pos.id && (draggingSlTpPreview.type === 'sl' || draggingSlTpPreview.type === 'new_sl')
        ? draggingSlTpPreview.price
        : slPrice

      if (activeSlPrice > 0) {
        const ySl = priceToY(activeSlPrice)
        ctx.strokeStyle = '#EF4444'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 2])
        ctx.beginPath()
        ctx.moveTo(0, ySl)
        ctx.lineTo(chartW, ySl)
        ctx.stroke()

        const distPips = Math.abs(openPrice - activeSlPrice) / pSize
        const projPnl = calcLevelPnL({
          level: activeSlPrice,
          entry: openPrice,
          lots: toNum(pos.lot_size),
          contractSize: 100000,
          mode: 'market',
          isBuy,
          quoteToUsd: quoteToUsdRate(symbol, openPrice, activePrices),
        }) || 0
        const pctBal = accountBalance > 0 ? (Math.abs(projPnl) / accountBalance) * 100 : 0

        const slText = `SL #${pos.id}: -${distPips.toFixed(1)}p (-$${Math.abs(projPnl).toFixed(2)} · ${pctBal.toFixed(1)}%)`
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)'
        ctx.fillRect(8, ySl - 11, ctx.measureText(slText).width + 30, 20)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 10px monospace'
        ctx.fillText(slText, 14, ySl + 3)

        // [x] Remove SL
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText('×', ctx.measureText(slText).width + 24, ySl + 3)
      }

      // (c) Take Profit (TP) Line
      const activeTpPrice = draggingSlTpPreview?.posId === pos.id && (draggingSlTpPreview.type === 'tp' || draggingSlTpPreview.type === 'new_tp')
        ? draggingSlTpPreview.price
        : tpPrice

      if (activeTpPrice > 0) {
        const yTp = priceToY(activeTpPrice)
        ctx.strokeStyle = '#10B981'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 2])
        ctx.beginPath()
        ctx.moveTo(0, yTp)
        ctx.lineTo(chartW, yTp)
        ctx.stroke()

        const distPips = Math.abs(activeTpPrice - openPrice) / pSize
        const projPnl = calcLevelPnL({
          level: activeTpPrice,
          entry: openPrice,
          lots: toNum(pos.lot_size),
          contractSize: 100000,
          mode: 'market',
          isBuy,
          quoteToUsd: quoteToUsdRate(symbol, openPrice, activePrices),
        }) || 0
        const pctBal = accountBalance > 0 ? (projPnl / accountBalance) * 100 : 0

        const tpText = `TP #${pos.id}: +${distPips.toFixed(1)}p (+$${projPnl.toFixed(2)} · ${pctBal.toFixed(1)}%)`
        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)'
        ctx.fillRect(8, yTp - 11, ctx.measureText(tpText).width + 30, 20)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 10px monospace'
        ctx.fillText(tpText, 14, yTp + 3)

        // [x] Remove TP
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText('×', ctx.measureText(tpText).width + 24, yTp + 3)
      }

      ctx.restore()
    }

    // Pending Orders Rendering
    for (const ord of symPending) {
      const tgtPrice = toNum(ord.target_price)
      if (tgtPrice <= 0) continue
      const yTgt = priceToY(tgtPrice)

      ctx.save()
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(0, yTgt)
      ctx.lineTo(chartW, yTgt)
      ctx.stroke()

      const ordText = `${ord.order_type.toUpperCase().replace('_', ' ')} ${ord.lot_size} @ ${fmtPrice(tgtPrice, digits)}`
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)'
      ctx.fillRect(8, yTgt - 11, ctx.measureText(ordText).width + 30, 20)
      ctx.fillStyle = '#050811'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(ordText, 14, yTgt + 3)

      // [x] Cancel Pending
      ctx.fillStyle = '#050811'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('×', ctx.measureText(ordText).width + 24, yTgt + 3)

      ctx.restore()
    }

    // 10. Real-time Bid & Ask Lines with Live Spread Badge
    const tick = activePrices[symbol]
    const liveBid = toNum(tick?.bid) || (visible.length > 0 ? visible[visible.length - 1].close : 0)
    const liveAsk = toNum(tick?.ask) || (liveBid > 0 ? liveBid + pSize * 1.5 : 0)

    if (liveBid > 0 && liveAsk > 0) {
      const yBid = priceToY(liveBid)
      const yAsk = priceToY(liveAsk)

      ctx.save()
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
      const spreadP = (liveAsk - liveBid) / pSize
      const midY = (yBid + yAsk) / 2
      ctx.fillStyle = 'rgba(10, 15, 30, 0.9)'
      ctx.fillRect(chartW + 2, midY - 8, PRICE_AXIS_WIDTH - 4, 16)
      ctx.strokeStyle = '#F59E0B'
      ctx.strokeRect(chartW + 2, midY - 8, PRICE_AXIS_WIDTH - 4, 16)
      ctx.fillStyle = '#F59E0B'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`Spread: ${spreadP.toFixed(1)}`, chartW + PRICE_AXIS_WIDTH / 2, midY + 3)

      // Active Price Tag with Countdown Timer on Right Scale
      ctx.fillStyle = colors.bidLine
      ctx.fillRect(chartW + 1, yBid - 10, PRICE_AXIS_WIDTH - 2, 20)
      ctx.fillStyle = '#050811'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(fmtPrice(liveBid, digits), chartW + PRICE_AXIS_WIDTH / 2, yBid + 3)

      // Countdown Timer Badge (e.g. 00:42) right next to price tag
      const cdText = formatCountdown(countdown)
      ctx.fillStyle = '#050811'
      ctx.fillRect(chartW - 48, yBid - 9, 44, 18)
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 1
      ctx.strokeRect(chartW - 48, yBid - 9, 44, 18)
      ctx.fillStyle = '#F59E0B'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(cdText, chartW - 26, yBid + 3)

      ctx.restore()
    }

    // 11. Crosshair & MT5 Pip Ruler
    const curMouse = mousePosRef.current
    if (curMouse && curMouse.onChart) {
      const curX = curMouse.x
      const curY = curMouse.y
      const curPrice = yToPrice(curY)

      ctx.save()
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

      // Cursor Price Tag on Right Axis
      ctx.fillStyle = colors.border
      ctx.fillRect(chartW + 1, curY - 9, PRICE_AXIS_WIDTH - 2, 18)
      ctx.fillStyle = colors.text
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(fmtPrice(curPrice, digits), chartW + PRICE_AXIS_WIDTH / 2, curY + 4)

      // Cursor Time Tag on Bottom Axis
      const cIdx = xToCandleIndex(curX)
      if (candles[cIdx]) {
        const timeStr = new Date(candles[cIdx].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        ctx.fillStyle = colors.border
        ctx.fillRect(curX - 35, mainH + 1, 70, 18)
        ctx.fillStyle = colors.text
        ctx.font = '10px monospace'
        ctx.fillText(timeStr, curX, mainH + 13)
      }
      ctx.restore()

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
        const deltaPips = Math.abs(deltaPrice) / pSize
        const deltaPct = (deltaPrice / p0) * 100
        const deltaBars = Math.abs(xToCandleIndex(x1) - xToCandleIndex(x0))
        const estPnL = deltaPips * activeLot * 10 // Approximate standard lot tick value

        ctx.save()
        ctx.strokeStyle = colors.rulerBorder
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()

        // Measurement Info Box
        const rulerText = `${deltaBars} Bars | ${deltaPips.toFixed(1)} Pips | Δ${fmtPrice(Math.abs(deltaPrice), digits)} (${deltaPct.toFixed(2)}%) | ~$${estPnL.toFixed(2)}`
        const boxW = ctx.measureText(rulerText).width + 24
        const boxX = Math.min(chartW - boxW - 10, Math.max(10, x1 + 10))
        const boxY = Math.max(20, Math.min(mainH - 40, y1 - 30))

        ctx.fillStyle = colors.rulerBg
        ctx.fillRect(boxX, boxY, boxW, 26)
        ctx.strokeStyle = colors.rulerBorder
        ctx.strokeRect(boxX, boxY, boxW, 26)

        ctx.fillStyle = colors.text
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(rulerText, boxX + 10, boxY + 16)
        ctx.restore()
      }
    }

    // 12. Right Y-Axis Price Scale
    ctx.save()
    ctx.fillStyle = colors.background
    ctx.fillRect(chartW, 0, PRICE_AXIS_WIDTH, mainH)
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(chartW + 0.5, 0)
    ctx.lineTo(chartW + 0.5, mainH)
    ctx.stroke()

    // Price scale labels
    const axisGridStep = rangeP / 6
    ctx.fillStyle = colors.textMuted
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    for (let p = Math.ceil(minP / axisGridStep) * axisGridStep; p < maxP; p += axisGridStep) {
      const y = priceToY(p)
      if (y > 10 && y < mainH - 10) {
        ctx.fillText(fmtPrice(p, digits), chartW + 6, y + 3)
      }
    }
    ctx.restore()

    // 13. Bottom X-Axis Time Scale
    ctx.save()
    ctx.fillStyle = colors.background
    ctx.fillRect(0, mainH, width, TIME_AXIS_HEIGHT)
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, mainH + 0.5)
    ctx.lineTo(width, mainH + 0.5)
    ctx.stroke()

    // Time scale labels
    ctx.fillStyle = colors.textMuted
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    const timeStep = Math.max(80, candleWidth * 10)
    for (let x = chartW % timeStep; x < chartW; x += timeStep) {
      const idx = xToCandleIndex(x)
      if (candles[idx]) {
        const d = new Date(candles[idx].time)
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ctx.fillText(`${dateStr} ${timeStr}`, x, mainH + 16)
      }
    }
    ctx.restore()

    // 14. Sub-Pane (RSI or MACD)
    if (hasSubPane) {
      const subTop = mainH + TIME_AXIS_HEIGHT
      ctx.save()
      ctx.fillStyle = colors.background
      ctx.fillRect(0, subTop, width, subH)
      ctx.strokeStyle = colors.border
      ctx.strokeRect(0, subTop, width, subH)

      if (indicators.rsi.enabled) {
        // RSI (14)
        const rsiVals = calcRSI(candles, indicators.rsi.period)
        const y70 = subTop + subH * 0.3
        const y30 = subTop + subH * 0.7

        // 70 & 30 lines
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(0, y70)
        ctx.lineTo(chartW, y70)
        ctx.moveTo(0, y30)
        ctx.lineTo(chartW, y30)
        ctx.stroke()

        // RSI Curve
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
            if (!s) { ctx.moveTo(x, y); s = true }
            else ctx.lineTo(x, y)
          }
        }
        ctx.stroke()

        // RSI Title & Value badge
        const lastRsi = rsiVals[endIndex] !== null ? rsiVals[endIndex]!.toFixed(1) : '—'
        ctx.fillStyle = colors.text
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`RSI (${indicators.rsi.period}): ${lastRsi}`, 10, subTop + 14)
      } else if (indicators.macd.enabled) {
        // MACD (12, 26, 9)
        const macdObj = calcMACD(candles, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal)
        const midY = subTop + subH / 2

        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.beginPath()
        ctx.moveTo(0, midY)
        ctx.lineTo(chartW, midY)
        ctx.stroke()

        // Histogram bars
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
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`MACD (${indicators.macd.fast},${indicators.macd.slow},${indicators.macd.signal})`, 10, subTop + 14)
      }
      ctx.restore()
    }

    // 15. Top-Left OHLCV Status Line
    const activeCandle = curMouse && curMouse.onChart
      ? candles[xToCandleIndex(curMouse.x)] || candles[candles.length - 1]
      : candles[candles.length - 1]

    if (activeCandle) {
      const deltaP = activeCandle.close - activeCandle.open
      const deltaPct = (deltaP / activeCandle.open) * 100
      const deltaColor = deltaP >= 0 ? '#10B981' : '#EF4444'

      const ohlcvText = `${symbol} • ${timeframe} • O: ${fmtPrice(activeCandle.open, digits)} H: ${fmtPrice(activeCandle.high, digits)} L: ${fmtPrice(activeCandle.low, digits)} C: ${fmtPrice(activeCandle.close, digits)} Δ: ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}% Vol: ${activeCandle.volume}`

      ctx.save()
      ctx.fillStyle = 'rgba(5, 8, 17, 0.75)'
      ctx.fillRect(6, 6, ctx.measureText(ohlcvText).width + 16, 20)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.strokeRect(6, 6, ctx.measureText(ohlcvText).width + 16, 20)

      ctx.fillStyle = colors.text
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(ohlcvText, 12, 20)
      ctx.restore()
    }

    ctx.restore()
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
    getLayout,
    getVisibleSlice,
    getPriceBounds,
    priceToY,
    yToPrice,
    candleIndexToX,
    xToCandleIndex,
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

  // Mouse Down Event (Panning, Scaling, SL/TP dragging, Vector Drawing)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { chartW, mainH } = getLayout()

    // 1. Right Click handled separately
    if (e.button === 2) return

    // 2. Middle Click activates Pip Ruler
    if (e.button === 1 || activeTool === 'crosshair') {
      const startP = snapToCandle({ time: candles[xToCandleIndex(x)]?.time || Date.now(), price: yToPrice(y) })
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

    // 4. Check if clicking on an interactive SL/TP line or Entry line close/drag
    const symPositions = positions.filter((p) => p.symbol === symbol)
    for (const pos of symPositions) {
      const openPrice = toNum(pos.open_price)
      const slPrice = pos.sl !== null ? toNum(pos.sl) : 0
      const tpPrice = pos.tp !== null ? toNum(pos.tp) : 0

      const yEntry = priceToY(openPrice)
      const ySl = slPrice > 0 ? priceToY(slPrice) : -999
      const yTp = tpPrice > 0 ? priceToY(tpPrice) : -999

      // Check click on [x] Close on Entry Line
      if (Math.abs(y - yEntry) < 12 && x > 150 && x < 260) {
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

      // Check drag existing SL Line
      if (slPrice > 0 && Math.abs(y - ySl) < 10) {
        draggingSlTpRef.current = {
          posId: pos.id,
          type: 'sl',
          currentPrice: slPrice,
          initialPrice: slPrice,
          pos,
        }
        return
      }

      // Check drag existing TP Line
      if (tpPrice > 0 && Math.abs(y - yTp) < 10) {
        draggingSlTpRef.current = {
          posId: pos.id,
          type: 'tp',
          currentPrice: tpPrice,
          initialPrice: tpPrice,
          pos,
        }
        return
      }

      // Drag from Entry Line to create NEW SL/TP if missing
      if (Math.abs(y - yEntry) < 10) {
        const isUp = y < yEntry
        const isBuy = pos.type === 'buy'
        const isNewSl = isBuy ? !isUp : isUp
        draggingSlTpRef.current = {
          posId: pos.id,
          type: isNewSl ? 'new_sl' : 'new_tp',
          currentPrice: openPrice,
          initialPrice: openPrice,
          pos,
        }
        return
      }
    }

    // 5. Check if clicking on Pending order [x] Cancel
    const symPending = pendingOrders.filter((o) => o.symbol === symbol && o.status === 'pending')
    for (const ord of symPending) {
      const tgtPrice = toNum(ord.target_price)
      const yTgt = priceToY(tgtPrice)
      if (Math.abs(y - yTgt) < 12 && x > 150 && x < 260) {
        api.pendingCancel(ord.id).then((r) => {
          if (r.ok && r.data.success) {
            playOrderSuccessSound()
            toast.success(`Cancelled pending order #${ord.id}`)
            invalidateFxsim('/pending-order/my')
            onChanged?.()
          } else {
            playOrderLossThumpSound()
            toast.error('Failed to cancel order')
          }
        })
        return
      }
    }

    // 6. Vector Drawing Tools
    if (activeTool !== 'select') {
      const clickPoint = snapToCandle({
        time: candles[xToCandleIndex(x)]?.time || Date.now(),
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
      const newObj: DrawingObject = {
        id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        symbol,
        type: activeTool,
        points: [clickPoint, clickPoint],
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
      const sel = drawings.find((d) => d.id === selectedDrawingId)
      if (sel) {
        for (let ptIdx = 0; ptIdx < sel.points.length; ptIdx++) {
          const pt = sel.points[ptIdx]
          const ptY = priceToY(pt.price)
          const ptX = candleIndexToX(candles.findIndex((c) => Math.abs(c.time - pt.time) < TIMEFRAME_SECONDS[timeframe] * 1000))
          if (Math.hypot(x - ptX, y - ptY) < 10) {
            draggingAnchorRef.current = { drawingId: sel.id, pointIndex: ptIdx }
            return
          }
        }
      }
    }

    // 8. Otherwise: Pan chart horizontally
    isDraggingChartRef.current = true
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
      const curPoint = snapToCandle({ time: candles[xToCandleIndex(x)]?.time || Date.now(), price: curPrice })
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
      const distPips = Math.abs(curPrice - openPrice) / pSize
      const isBuy = pos.type === 'buy'

      const projPnl = calcLevelPnL({
        level: curPrice,
        entry: openPrice,
        lots: toNum(pos.lot_size),
        contractSize: 100000,
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

    // 4. Vector Drawing in progress
    if (drawingInProgressRef.current) {
      const curPoint = snapToCandle({ time: candles[xToCandleIndex(x)]?.time || Date.now(), price: yToPrice(y) })
      const pts = [...drawingInProgressRef.current.points]
      pts[1] = curPoint
      drawingInProgressRef.current.points = pts
      return
    }

    // 5. Dragging Drawing Anchor Handle
    if (draggingAnchorRef.current) {
      const curPoint = snapToCandle({ time: candles[xToCandleIndex(x)]?.time || Date.now(), price: yToPrice(y) })
      const sel = drawings.find((d) => d.id === draggingAnchorRef.current?.drawingId)
      if (sel) {
        const nextPts = [...sel.points]
        nextPts[draggingAnchorRef.current.pointIndex] = curPoint
        onUpdateDrawing(sel.id, { points: nextPts })
      }
      return
    }

    // 6. Horizontal Chart Panning
    if (isDraggingChartRef.current && dragStartRef.current) {
      const deltaX = x - dragStartRef.current.x
      const candlesMoved = deltaX / candleWidth
      const newOffset = Math.max(0, dragStartRef.current.scrollOffset + candlesMoved)
      setScrollOffset(parseFloat(newOffset.toFixed(1)))
    }
  }

  // Mouse Up Event (Finalize Orders, Drawings, Scale)
  const handleMouseUp = () => {
    isDraggingChartRef.current = false
    isDraggingAxisRef.current = false
    dragStartRef.current = null
    draggingAnchorRef.current = null
    draggingDrawingBodyRef.current = null

    // 1. Finalize SL/TP modification
    if (draggingSlTpRef.current && draggingSlTpPreview) {
      const pos = draggingSlTpRef.current.pos
      const newPrice = parseFloat(draggingSlTpPreview.price.toFixed(digits))
      const isSl = draggingSlTpRef.current.type === 'sl' || draggingSlTpRef.current.type === 'new_sl'

      const finalSl = isSl ? newPrice : (pos.sl !== null ? toNum(pos.sl) : null)
      const finalTp = !isSl ? newPrice : (pos.tp !== null ? toNum(pos.tp) : null)

      api.sltp(pos.id, finalSl, finalTp).then((r) => {
        if (r.ok && r.data.success) {
          playOrderSuccessSound()
          toast.success(`Updated ${isSl ? 'Stop Loss' : 'Take Profit'} for #${pos.id} @ ${fmtPrice(newPrice, digits)}`)
          invalidateFxsim('/positions')
          onChanged?.()
        } else {
          playOrderLossThumpSound()
          toast.error(r.ok ? (r.data?.message || 'Failed to update SL/TP') : 'Network error')
        }
      })

      draggingSlTpRef.current = null
      setDraggingSlTpPreview(null)
    }

    // 2. Finalize Drawing in Progress
    if (drawingInProgressRef.current) {
      onAddDrawing(drawingInProgressRef.current)
      drawingInProgressRef.current = null
      onSelectTool('select')
    }

    // 3. Deactivate Pip Ruler if triggered via middle mouse
    if (rulerRef.current.active && activeTool !== 'crosshair') {
      rulerRef.current.active = false
      setRulerDisplay(null)
    }
  }

  // Double Click Right Price Axis (Reset Scale to Auto-fit)
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const { chartW } = getLayout()
    if (x >= chartW) {
      setYScaleFactor(1.0)
      setYScaleOffset(0)
      toast.info('Price scale auto-fitted')
    }
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

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-black select-none"
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
        className="w-full h-full block cursor-crosshair"
      />
    </div>
  )
})
