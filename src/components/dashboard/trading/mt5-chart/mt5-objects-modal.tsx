'use client'

/**
 * MT5 Pro Chart Engine — Manage Objects & Drawings Modal (Ctrl+B)
 * Inspect, toggle visibility, lock, clone, or delete vector chart annotations.
 */

import React, { memo } from 'react'
import { X, Layers, Eye, EyeOff, Lock, Unlock, Trash2, Check } from 'lucide-react'
import type { DrawingObject } from './types'
import { fmtPrice } from '@/lib/format'
import { cn } from '@/lib/cn'

interface ObjectsModalProps {
  isOpen: boolean
  onClose: () => void
  symbol: string
  digits: number
  drawings: DrawingObject[]
  onUpdateDrawing: (id: string, patch: Partial<DrawingObject>) => void
  onDeleteDrawing: (id: string) => void
  onClearAll: () => void
}

export const Mt5ObjectsModal = memo(function Mt5ObjectsModal({
  isOpen,
  onClose,
  symbol,
  digits,
  drawings,
  onUpdateDrawing,
  onDeleteDrawing,
  onClearAll,
}: ObjectsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-muted/40">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-terminal-label text-text">
              Objects List ({symbol})
            </h3>
            <span className="px-2 py-0.5 rounded-full text-terminal-micro font-semibold bg-accent/15 text-accent border border-accent/30">
              {drawings.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawings List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-terminal-body">
          {drawings.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No vector drawings on {symbol}</p>
              <p className="text-terminal-micro mt-1 opacity-70">
                Use the left drawing toolbar to draw trendlines, Fibonacci, zones, or price lines.
              </p>
            </div>
          ) : (
            drawings.map((d, index) => {
              const primaryPrice = d.points[0]?.price ?? 0
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-bg-subtle/50 hover:bg-surface-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-terminal-micro font-mono text-text-muted w-4">
                      {index + 1}
                    </span>
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black/30 shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-text uppercase tracking-wider text-terminal-label truncate block">
                        {d.type.replace('-', ' ')}
                      </span>
                      <span className="text-terminal-micro text-text-muted terminal-num">
                        {d.points.length > 1
                          ? `${fmtPrice(d.points[0].price, digits)} → ${fmtPrice(d.points[1].price, digits)}`
                          : `@ ${fmtPrice(primaryPrice, digits)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Visibility Eye */}
                    <button
                      type="button"
                      onClick={() => onUpdateDrawing(d.id, { visible: !d.visible })}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors cursor-pointer',
                        d.visible
                          ? 'text-text-muted hover:text-text hover:bg-surface-muted'
                          : 'text-text-muted/40 hover:text-text-muted'
                      )}
                      title={d.visible ? 'Hide object' : 'Show object'}
                    >
                      {d.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Lock Toggle */}
                    <button
                      type="button"
                      onClick={() => onUpdateDrawing(d.id, { locked: !d.locked })}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors cursor-pointer',
                        d.locked
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-text-muted hover:text-text hover:bg-surface-muted'
                      )}
                      title={d.locked ? 'Unlock object' : 'Lock object'}
                    >
                      {d.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDeleteDrawing(d.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                      title="Delete object"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-muted/30">
          {drawings.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-terminal-label font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold text-terminal-label shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  )
})
