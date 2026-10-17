'use client'

/**
 * MT5 Pro Chart Engine — Top Control Bar
 * Timeframes, Chart Styles, Zoom, Auto-Scroll/Shift, Grid, Period Separators, Themes, Indicators
 */

import React, { memo, useState } from 'react'
import {
  CandlestickChart,
  BarChart2,
  Activity,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Grid,
  Sliders,
  Palette,
  Zap,
  Maximize2,
  Minimize2,
  ArrowRightToLine,
  ChevronDown,
} from 'lucide-react'
import type { Timeframe, ChartStyle, ThemePreset } from './types'
import { cn } from '@/lib/cn'

interface TopControlsProps {
  timeframe: Timeframe
  onChangeTimeframe: (tf: Timeframe) => void
  chartStyle: ChartStyle
  onChangeChartStyle: (style: ChartStyle) => void
  theme: ThemePreset
  onChangeTheme: (theme: ThemePreset) => void
  showGrid: boolean
  onToggleGrid: () => void
  showPeriodSeparators: boolean
  onTogglePeriodSeparators: () => void
  autoScroll: boolean
  onToggleAutoScroll: () => void
  chartShift: boolean
  onToggleChartShift: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onOpenIndicators: () => void
  showOneClick: boolean
  onToggleOneClick: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']

export const CHART_STYLES: { id: ChartStyle; label: string; shortcut: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'bar', label: 'OHLC Bars', shortcut: 'Alt+1', icon: BarChart2 },
  { id: 'candlestick', label: 'Candlesticks', shortcut: 'Alt+2', icon: CandlestickChart },
  { id: 'line', label: 'Line Chart', shortcut: 'Alt+3', icon: Activity },
  { id: 'heikin-ashi', label: 'Heikin Ashi', shortcut: 'HA', icon: Sparkles },
]

export const Mt5TopControls = memo(function Mt5TopControls({
  timeframe,
  onChangeTimeframe,
  chartStyle,
  onChangeChartStyle,
  theme,
  onChangeTheme,
  showGrid,
  onToggleGrid,
  showPeriodSeparators,
  onTogglePeriodSeparators,
  autoScroll,
  onToggleAutoScroll,
  chartShift,
  onToggleChartShift,
  onZoomIn,
  onZoomOut,
  onOpenIndicators,
  showOneClick,
  onToggleOneClick,
  isFullscreen,
  onToggleFullscreen,
}: TopControlsProps) {
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)

  return (
    <div className="shrink-0 flex items-center justify-between gap-1 sm:gap-2 px-2 py-1 bg-surface border-b border-border select-none text-terminal-body overflow-x-auto no-scrollbar">
      {/* Left section: Timeframes & Chart Styles */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Timeframe Segmented Switcher */}
        <div className="flex items-center bg-bg-subtle/80 p-0.5 rounded-lg border border-border-subtle">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onChangeTimeframe(tf)}
              className={cn(
                'px-1.5 py-0.5 rounded text-terminal-micro font-semibold transition-all cursor-pointer',
                timeframe === tf
                  ? 'bg-accent text-accent-fg shadow-xs font-bold'
                  : 'text-text-muted hover:text-text hover:bg-surface-muted/50'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border/80 mx-0.5" />

        {/* Chart Style Switcher */}
        <div className="flex items-center bg-bg-subtle/80 p-0.5 rounded-lg border border-border-subtle">
          {CHART_STYLES.map((cs) => {
            const Icon = cs.icon
            const isSel = chartStyle === cs.id
            return (
              <button
                key={cs.id}
                type="button"
                onClick={() => onChangeChartStyle(cs.id)}
                className={cn(
                  'p-1 rounded transition-all cursor-pointer',
                  isSel
                    ? 'bg-accent text-accent-fg shadow-xs'
                    : 'text-text-muted hover:text-text hover:bg-surface-muted/50'
                )}
                title={`${cs.label} (${cs.shortcut})`}
                aria-label={cs.label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>

        <div className="w-px h-4 bg-border/80 mx-0.5" />

        {/* Zoom In / Zoom Out */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1 rounded hover:bg-surface-muted text-text-muted hover:text-text transition-colors cursor-pointer"
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1 rounded hover:bg-surface-muted text-text-muted hover:text-text transition-colors cursor-pointer"
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-border/80 mx-0.5" />

        {/* Auto Scroll & Chart Shift */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleAutoScroll}
            className={cn(
              'px-1.5 py-0.5 rounded text-terminal-micro font-semibold transition-colors cursor-pointer',
              autoScroll
                ? 'bg-accent/20 text-accent border border-accent/40 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-surface-muted'
            )}
            title="Auto-Scroll to latest tick on incoming price"
          >
            Auto-Scroll
          </button>
          <button
            type="button"
            onClick={onToggleChartShift}
            className={cn(
              'p-1 rounded transition-colors cursor-pointer',
              chartShift
                ? 'bg-accent/20 text-accent border border-accent/40 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-surface-muted'
            )}
            title="Chart Shift (Right margin offset buffer)"
            aria-label="Chart Shift"
          >
            <ArrowRightToLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right section: Grid, Separators, Indicators, Theme, 1-Click, Fullscreen */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Grid Toggle (G) */}
        <button
          type="button"
          onClick={onToggleGrid}
          className={cn(
            'p-1 rounded transition-colors cursor-pointer',
            showGrid
              ? 'text-accent bg-accent/15 border border-accent/30'
              : 'text-text-muted hover:text-text hover:bg-surface-muted'
          )}
          title="Toggle Grid (G)"
          aria-label="Toggle Grid"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Period Separators (Y) */}
        <button
          type="button"
          onClick={onTogglePeriodSeparators}
          className={cn(
            'p-1 rounded transition-colors cursor-pointer',
            showPeriodSeparators
              ? 'text-accent bg-accent/15 border border-accent/30'
              : 'text-text-muted hover:text-text hover:bg-surface-muted'
          )}
          title="Period Separators (Y)"
          aria-label="Period Separators"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Technical Indicators Modal Trigger */}
        <button
          type="button"
          onClick={onOpenIndicators}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-terminal-micro font-semibold text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle transition-colors cursor-pointer"
          title="Technical Indicators (EMA, BB, VWAP, RSI, MACD)"
        >
          <Activity className="w-3.5 h-3.5 text-accent" />
          <span>Indicators</span>
        </button>

        {/* Theme Preset Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeDropdownOpen((v) => !v)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-terminal-micro font-semibold text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle transition-colors cursor-pointer"
            title="Chart Theme Preset"
          >
            <Palette className="w-3 h-3 text-amber-400" />
            <span className="capitalize hidden md:inline">{theme}</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {themeDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-surface border border-border rounded-lg shadow-xl p-1 flex flex-col gap-0.5">
              {(['classic', 'cyber', 'daylight'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChangeTheme(t)
                    setThemeDropdownOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1 rounded text-terminal-micro font-semibold capitalize transition-colors cursor-pointer flex items-center justify-between',
                    theme === t ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-muted'
                  )}
                >
                  <span>{t === 'classic' ? 'MT5 Classic' : t === 'cyber' ? 'Obsidian Cyber' : 'Daylight'}</span>
                  {theme === t && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 1-Click Execution Box Toggle (Alt+T) */}
        <button
          type="button"
          onClick={onToggleOneClick}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-terminal-micro font-semibold transition-all cursor-pointer',
            showOneClick
              ? 'text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 shadow-xs'
              : 'text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle'
          )}
          title="Toggle 1-Click Trading Box (Alt+T)"
        >
          <Zap className={cn('w-3 h-3', showOneClick && 'fill-emerald-500')} />
          <span>1-Click</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
})
