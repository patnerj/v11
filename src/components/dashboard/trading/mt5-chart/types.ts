/**
 * MT5 Pro Chart Engine — Core TypeScript Interfaces & Presets
 * Institutional MetaTrader 5 WebTerminal clone for AlphaCapital Enterprise.
 */

export interface Candle {
  time: number // Epoch milliseconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1'

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1:  60,
  M5:  300,
  M15: 900,
  M30: 1800,
  H1:  3600,
  H4:  14400,
  D1:  86400,
  W1:  604800,
}

export type ChartStyle = 'candlestick' | 'bar' | 'line' | 'heikin-ashi'
export type ThemePreset = 'classic' | 'cyber' | 'daylight'

export interface ThemeColors {
  background: string
  grid: string
  gridPeriod: string
  text: string
  textMuted: string
  border: string
  candleUp: string
  candleDown: string
  candleUpWick: string
  candleDownWick: string
  candleUpBorder: string
  candleDownBorder: string
  lineColor: string
  crosshair: string
  bidLine: string
  askLine: string
  volumeUp: string
  volumeDown: string
  goldenPocket: string
  rulerBg: string
  rulerBorder: string
}

export const THEMES: Record<ThemePreset, ThemeColors> = {
  classic: {
    // Classic MT5 Green on Black
    background: '#000000',
    grid: '#181818',
    gridPeriod: '#282828',
    text: '#CCCCCC',
    textMuted: '#777777',
    border: '#2A2A2A',
    candleUp: '#00E676',
    candleDown: '#FF5252',
    candleUpWick: '#00E676',
    candleDownWick: '#FF5252',
    candleUpBorder: '#00E676',
    candleDownBorder: '#FF5252',
    lineColor: '#00E676',
    crosshair: '#555555',
    bidLine: '#29B6F6',
    askLine: '#FF3D00',
    volumeUp: 'rgba(0, 230, 118, 0.35)',
    volumeDown: 'rgba(255, 82, 82, 0.35)',
    goldenPocket: 'rgba(255, 215, 0, 0.12)',
    rulerBg: 'rgba(20, 20, 20, 0.92)',
    rulerBorder: '#00E676',
  },
  cyber: {
    // Obsidian Cyber (Emerald / Rose on #050811)
    background: '#050811',
    grid: 'rgba(255, 255, 255, 0.04)',
    gridPeriod: 'rgba(255, 255, 255, 0.08)',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#1E293B',
    candleUp: '#10B981',
    candleDown: '#F43F5E',
    candleUpWick: '#10B981',
    candleDownWick: '#F43F5E',
    candleUpBorder: '#10B981',
    candleDownBorder: '#F43F5E',
    lineColor: '#38BDF8',
    crosshair: '#475569',
    bidLine: '#38BDF8',
    askLine: '#FB7185',
    volumeUp: 'rgba(16, 185, 129, 0.35)',
    volumeDown: 'rgba(244, 63, 94, 0.35)',
    goldenPocket: 'rgba(245, 158, 11, 0.15)',
    rulerBg: 'rgba(10, 15, 30, 0.92)',
    rulerBorder: '#38BDF8',
  },
  daylight: {
    // MT5 Daylight (Clean High Contrast Black-on-White)
    background: '#FFFFFF',
    grid: '#F1F5F9',
    gridPeriod: '#CBD5E1',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    candleUp: '#16A34A',
    candleDown: '#DC2626',
    candleUpWick: '#16A34A',
    candleDownWick: '#DC2626',
    candleUpBorder: '#16A34A',
    candleDownBorder: '#DC2626',
    lineColor: '#2563EB',
    crosshair: '#94A3B8',
    bidLine: '#2563EB',
    askLine: '#DC2626',
    volumeUp: 'rgba(22, 163, 74, 0.35)',
    volumeDown: 'rgba(220, 38, 38, 0.35)',
    goldenPocket: 'rgba(217, 119, 6, 0.15)',
    rulerBg: 'rgba(255, 255, 255, 0.95)',
    rulerBorder: '#2563EB',
  },
}

export type DrawingTool =
  | 'select'
  | 'crosshair'
  | 'hline'
  | 'vline'
  | 'trendline'
  | 'fibonacci'
  | 'rectangle'
  | 'channel'
  | 'risk-reward'
  | 'text'

export interface Point {
  time: number
  price: number
}

export interface DrawingObject {
  id: string
  symbol: string
  type: DrawingTool
  points: Point[]
  color: string
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
  locked: boolean
  visible: boolean
  text?: string
  extendRight?: boolean
  fiboLabelsAlign?: 'left' | 'right'
  isLong?: boolean // For risk-reward tool
  channelWidth?: number // For parallel channel (in price units)
  createdAt: number
}

export interface IndicatorsConfig {
  ema: {
    enabled: boolean
    p20: boolean
    p50: boolean
    p200: boolean
    c20: string
    c50: string
    c200: string
  }
  sma: {
    enabled: boolean
    period: number
    color: string
  }
  bb: {
    enabled: boolean
    period: number
    stdDev: number
    color: string
  }
  vwap: {
    enabled: boolean
    color: string
  }
  killzones: {
    enabled: boolean
    asian: boolean
    london: boolean
    ny: boolean
  }
  rsi: {
    enabled: boolean
    period: number
    overbought: number
    oversold: number
    color: string
  }
  macd: {
    enabled: boolean
    fast: number
    slow: number
    signal: number
  }
  volume: {
    enabled: boolean
  }
  tradeLevels?: {
    showPositions: boolean
    showBidAsk: boolean
    showCountdown: boolean
  }
}

export const DEFAULT_INDICATORS: IndicatorsConfig = {
  ema: {
    enabled: true,
    p20: true,
    p50: true,
    p200: false,
    c20: '#F59E0B',
    c50: '#3B82F6',
    c200: '#EC4899',
  },
  sma: {
    enabled: false,
    period: 20,
    color: '#8B5CF6',
  },
  bb: {
    enabled: false,
    period: 20,
    stdDev: 2,
    color: '#6366F1',
  },
  vwap: {
    enabled: false,
    color: '#06B6D4',
  },
  killzones: {
    enabled: false,
    asian: true,
    london: true,
    ny: true,
  },
  rsi: {
    enabled: false,
    period: 14,
    overbought: 70,
    oversold: 30,
    color: '#8B5CF6',
  },
  macd: {
    enabled: false,
    fast: 12,
    slow: 26,
    signal: 9,
  },
  volume: {
    enabled: true,
  },
  tradeLevels: {
    showPositions: true,
    showBidAsk: true,
    showCountdown: true,
  },
}

export interface PipRulerState {
  active: boolean
  startPoint: Point | null
  currentPoint: Point | null
  startScreen: { x: number; y: number } | null
  currentScreen: { x: number; y: number } | null
}

export interface Mt5CanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetScale: () => void
}
