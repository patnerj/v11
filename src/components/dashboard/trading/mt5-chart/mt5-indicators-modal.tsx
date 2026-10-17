'use client'

/**
 * MT5 Pro Chart Engine — Technical Indicators Settings Modal
 * Real-time math overlays (EMA, SMA, BB, VWAP, Killzones) and Sub-Panes (RSI, MACD, Volume).
 */

import React, { memo } from 'react'
import { X, Activity, RotateCcw, Check } from 'lucide-react'
import type { IndicatorsConfig } from './types'
import { DEFAULT_INDICATORS } from './types'
import { cn } from '@/lib/cn'

interface IndicatorsModalProps {
  isOpen: boolean
  onClose: () => void
  config: IndicatorsConfig
  onChangeConfig: (config: IndicatorsConfig) => void
}

export const Mt5IndicatorsModal = memo(function Mt5IndicatorsModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
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
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-terminal-label text-text">Technical Indicators</h3>
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
              Chart Overlays
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
