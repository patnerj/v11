'use client'

/**
 * MT5 Pro Chart Engine — Technical Indicators Settings Modal
 * Real-time math overlays (EMA, SMA, BB, VWAP, Killzones) and Sub-Panes (RSI, MACD, Volume).
 */

import React, { memo } from 'react'
import { X, Activity, RotateCcw, Check, Sliders, Palette, Grid, SeparatorVertical } from 'lucide-react'
import type { IndicatorsConfig, ThemePreset } from './types'
import { DEFAULT_INDICATORS } from './types'
import { cn } from '@/lib/cn'

interface IndicatorsModalProps {
  isOpen: boolean
  onClose: () => void
  config: IndicatorsConfig
  onChangeConfig: (config: IndicatorsConfig) => void
  theme?: ThemePreset
  onChangeTheme?: (theme: ThemePreset) => void
  showGrid?: boolean
  onChangeShowGrid?: (show: boolean) => void
  showPeriodSeparators?: boolean
  onChangeShowPeriodSeparators?: (show: boolean) => void
}

export const Mt5IndicatorsModal = memo(function Mt5IndicatorsModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  theme = 'cyber',
  onChangeTheme,
  showGrid = true,
  onChangeShowGrid,
  showPeriodSeparators = true,
  onChangeShowPeriodSeparators,
}: IndicatorsModalProps) {
  if (!isOpen) return null

  const update = (patch: Partial<IndicatorsConfig>) => {
    onChangeConfig({ ...config, ...patch })
  }

  const reset = () => {
    onChangeConfig(DEFAULT_INDICATORS)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-muted/40">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-terminal-label text-text">Chart Properties & Indicators</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-terminal-body">
          {/* Main Chart Overlays */}
          <div>
            <h4 className="text-terminal-micro font-bold uppercase tracking-wider text-text-muted mb-2">
              Chart Overlays (EMA, SMA, BB, VWAP, ICT)
            </h4>
            <div className="space-y-2 bg-bg-subtle/60 border border-border rounded-xl p-3">
              {/* Exponential Moving Averages */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Exponential Moving Average (EMA)</span>
                  <div className="flex items-center gap-3 mt-1 text-terminal-micro text-text-muted">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.ema.p20}
                        onChange={(e) => update({ ema: { ...config.ema, p20: e.target.checked } })}
                        className="rounded accent-accent"
                      />
                      <span>EMA 20</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.ema.p50}
                        onChange={(e) => update({ ema: { ...config.ema, p50: e.target.checked } })}
                        className="rounded accent-accent"
                      />
                      <span>EMA 50</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.ema.p200}
                        onChange={(e) => update({ ema: { ...config.ema, p200: e.target.checked } })}
                        className="rounded accent-accent"
                      />
                      <span>EMA 200</span>
                    </label>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.ema.enabled}
                  onChange={(e) => update({ ema: { ...config.ema, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Simple Moving Average (SMA) */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Simple Moving Average (SMA 20)</span>
                  <p className="text-terminal-micro text-text-muted">Standard 20-period baseline</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.sma.enabled}
                  onChange={(e) => update({ sma: { ...config.sma, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Bollinger Bands */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Bollinger Bands (20, 2)</span>
                  <p className="text-terminal-micro text-text-muted">Upper, middle SMA, and lower bands</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.bb.enabled}
                  onChange={(e) => update({ bb: { ...config.bb, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* VWAP */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Volume Weighted Average Price (VWAP)</span>
                  <p className="text-terminal-micro text-text-muted">Daily anchored institutional benchmark</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.vwap.enabled}
                  onChange={(e) => update({ vwap: { ...config.vwap, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Killzone Sessions */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">ICT Killzone Session Boxes</span>
                  <p className="text-terminal-micro text-text-muted">Asian (00-08), London (07-10), NY (12-15) UTC</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.killzones.enabled}
                  onChange={(e) => update({ killzones: { ...config.killzones, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Chart Display & Theme Properties */}
          <div>
            <h4 className="text-terminal-micro font-bold uppercase tracking-wider text-text-muted mb-2">
              Chart Display & Theme Properties
            </h4>
            <div className="space-y-3 bg-bg-subtle/60 border border-border rounded-xl p-3">
              {/* Theme Preset Switcher */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Color Theme Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'cyber', label: 'Obsidian Cyber 🌙', desc: 'Emerald & Rose' },
                    { id: 'classic', label: 'MT5 Classic 🟢', desc: 'Green on Black' },
                    { id: 'daylight', label: 'Daylight ☀️', desc: 'Clean High Contrast' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChangeTheme?.(t.id as any)}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center',
                        theme === t.id
                          ? 'border-accent bg-accent/15 text-accent shadow-xs'
                          : 'border-border bg-surface hover:bg-surface-muted text-text-muted hover:text-text'
                      )}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="text-[10px] font-normal text-text-muted mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Grid Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Dotted Chart Grid (G)</span>
                  <p className="text-terminal-micro text-text-muted">Display horizontal price and vertical time dotted grid lines</p>
                </div>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => onChangeShowGrid?.(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Period Separators */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Period Separators (Y)</span>
                  <p className="text-terminal-micro text-text-muted">Multi-timeframe session boundaries (Day, Week, Month, Year)</p>
                </div>
                <input
                  type="checkbox"
                  checked={showPeriodSeparators}
                  onChange={(e) => onChangeShowPeriodSeparators?.(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Trade Levels & Visibility (Positions, SL/TP, Bid/Ask, Countdown) */}
          <div>
            <h4 className="text-terminal-micro font-bold uppercase tracking-wider text-text-muted mb-2">
              Trade Levels & Price Visibility
            </h4>
            <div className="space-y-3 bg-bg-subtle/60 border border-border rounded-xl p-3">
              {/* Show Positions & Order Levels */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Positions & Trade Levels</span>
                  <p className="text-terminal-micro text-text-muted">Display open trades, Stop Loss (SL), Take Profit (TP), and pending orders</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.tradeLevels?.showPositions ?? true}
                  onChange={(e) =>
                    update({
                      tradeLevels: {
                        showPositions: e.target.checked,
                        showBidAsk: config.tradeLevels?.showBidAsk ?? true,
                        showCountdown: config.tradeLevels?.showCountdown ?? true,
                      },
                    })
                  }
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Show Bid / Ask Price Lines */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Bid & Ask Price Lines</span>
                  <p className="text-terminal-micro text-text-muted">Display real-time Bid / Ask horizontal lines and live spread badge</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.tradeLevels?.showBidAsk ?? true}
                  onChange={(e) =>
                    update({
                      tradeLevels: {
                        showPositions: config.tradeLevels?.showPositions ?? true,
                        showBidAsk: e.target.checked,
                        showCountdown: config.tradeLevels?.showCountdown ?? true,
                      },
                    })
                  }
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Show Candle Countdown Timer */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Candle Countdown Timer</span>
                  <p className="text-terminal-micro text-text-muted">Display bar remaining countdown badge on price axis</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.tradeLevels?.showCountdown ?? true}
                  onChange={(e) =>
                    update({
                      tradeLevels: {
                        showPositions: config.tradeLevels?.showPositions ?? true,
                        showBidAsk: config.tradeLevels?.showBidAsk ?? true,
                        showCountdown: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Sub-Panes */}
          <div>
            <h4 className="text-terminal-micro font-bold uppercase tracking-wider text-text-muted mb-2">
              Oscillators & Sub-Panes
            </h4>
            <div className="space-y-2 bg-bg-subtle/60 border border-border rounded-xl p-3">
              {/* RSI */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Relative Strength Index (RSI 14)</span>
                  <p className="text-terminal-micro text-text-muted">With 70/30 overbought/oversold levels</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.rsi.enabled}
                  onChange={(e) => update({ rsi: { ...config.rsi, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* MACD */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">MACD (12, 26, 9)</span>
                  <p className="text-terminal-micro text-text-muted">MACD line, signal line & histogram</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.macd.enabled}
                  onChange={(e) => update({ macd: { ...config.macd, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>

              <div className="w-full h-px bg-border-subtle" />

              {/* Volume */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text">Volume Histogram</span>
                  <p className="text-terminal-micro text-text-muted">Color-coded tick volume bars at chart bottom</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.volume.enabled}
                  onChange={(e) => update({ volume: { ...config.volume, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-muted/30">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer text-terminal-label font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold text-terminal-label shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  )
})
