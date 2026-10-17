'use client'

/**
 * MT5 Pro Chart Engine — Vector Drawing Toolbar & Floating Inspector
 * Full suite of institutional technical analysis drawing primitives.
 */

import React, { memo } from 'react'
import {
  MousePointer,
  Crosshair,
  Minus,
  MoveVertical,
  TrendingUp,
  Square,
  Type,
  Magnet,
  Layers,
  Trash2,
  Lock,
  Unlock,
  Copy,
  X,
  Target,
  Spline,
  Columns,
  ArrowRightToLine,
  AlignLeft,
  AlignRight,
} from 'lucide-react'
import type { DrawingTool, DrawingObject } from './types'
import { cn } from '@/lib/cn'

export interface DrawingToolbarProps {
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  magnetMode: boolean
  onToggleMagnet: () => void
  onOpenObjectsList: () => void
  onClearAll: () => void
  selectedDrawing?: DrawingObject | null
  onUpdateSelected?: (patch: Partial<DrawingObject>) => void
  onDeleteSelected?: () => void
  onCloneSelected?: () => void
  onDeselect?: () => void
}

export interface DrawingInspectorProps {
  selectedDrawing: DrawingObject | null
  onUpdateSelected: (patch: Partial<DrawingObject>) => void
  onDeleteSelected: () => void
  onCloneSelected: () => void
  onDeselect: () => void
}

const TOOLS: { id: DrawingTool; label: string; shortcut: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'select', label: 'Select / Move', shortcut: 'Esc', icon: MousePointer },
  { id: 'crosshair', label: 'Crosshair & Pip Ruler', shortcut: 'Ctrl+F', icon: Crosshair },
  { id: 'hline', label: 'Horizontal Line', shortcut: 'H', icon: Minus },
  { id: 'vline', label: 'Vertical Line', shortcut: 'V', icon: MoveVertical },
  { id: 'trendline', label: 'Trendline & Ray', shortcut: 'T', icon: TrendingUp },
  { id: 'fibonacci', label: 'Fibonacci Retracement', shortcut: 'F', icon: Spline },
  { id: 'rectangle', label: 'Supply / Demand Zone', shortcut: 'R', icon: Square },
  { id: 'channel', label: 'Parallel Channel', shortcut: 'C', icon: Columns },
  { id: 'risk-reward', label: 'Risk / Reward Box', shortcut: 'B', icon: Target },
  { id: 'text', label: 'Text Callout', shortcut: 'X', icon: Type },
]

const COLORS = [
  '#00E676', // Green
  '#FF5252', // Red
  '#38BDF8', // Cyan
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#E2E8F0', // White/Silver
]

export const Mt5DrawingToolbar = memo(function Mt5DrawingToolbar({
  activeTool,
  onSelectTool,
  magnetMode,
  onToggleMagnet,
  onOpenObjectsList,
  onClearAll,
  selectedDrawing,
  onUpdateSelected,
  onDeleteSelected,
  onCloneSelected,
  onDeselect,
}: DrawingToolbarProps) {
  return (
    <>
      {/* Docked Vertical Drawing Toolbar */}
      <div className="flex flex-col gap-1 p-1 w-full items-center select-none">
        {TOOLS.map((t) => {
          const Icon = t.icon
          const isActive = activeTool === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTool(t.id)}
              className={cn(
                'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus-ring cursor-pointer group',
                isActive
                  ? 'bg-accent/20 text-accent border border-accent/40 shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-muted/60'
              )}
              title={`${t.label} (${t.shortcut})`}
              aria-label={t.label}
              aria-pressed={isActive}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          )
        })}

        <div className="w-full h-px bg-border my-0.5" />

        {/* Magnet Mode Toggle */}
        <button
          type="button"
          onClick={onToggleMagnet}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus-ring cursor-pointer',
            magnetMode
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs'
              : 'text-text-muted hover:text-text hover:bg-surface-muted/60'
          )}
          title="Magnet Mode (Snap to OHLC, shortcut: M)"
          aria-label="Magnet Mode"
          aria-pressed={magnetMode}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>

        {/* Object List (Ctrl+B) */}
        <button
          type="button"
          onClick={onOpenObjectsList}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted/60 transition-colors focus-ring cursor-pointer"
          title="Manage Objects List (Ctrl+B)"
          aria-label="Manage Objects"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        {/* Clear All Drawings */}
        <button
          type="button"
          onClick={onClearAll}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/15 transition-colors focus-ring cursor-pointer"
          title="Clear all drawings on current symbol"
          aria-label="Clear all drawings"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Backward-compatible inline inspector if invoked with inspector props */}
      {selectedDrawing && onUpdateSelected && onDeleteSelected && onCloneSelected && onDeselect && (
        <Mt5DrawingInspector
          selectedDrawing={selectedDrawing}
          onUpdateSelected={onUpdateSelected}
          onDeleteSelected={onDeleteSelected}
          onCloneSelected={onCloneSelected}
          onDeselect={onDeselect}
        />
      )}
    </>
  )
})

export const Mt5DrawingInspector = memo(function Mt5DrawingInspector({
  selectedDrawing,
  onUpdateSelected,
  onDeleteSelected,
  onCloneSelected,
  onDeselect,
}: DrawingInspectorProps) {
  if (!selectedDrawing) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 bg-surface/95 dark:bg-bg-subtle/95 backdrop-blur-md border border-border rounded-xl shadow-xl select-none animate-in fade-in zoom-in-95 duration-150">
      <span className="text-terminal-micro font-semibold uppercase tracking-wider text-text-muted pr-1 border-r border-border">
        {selectedDrawing.type}
      </span>

      {/* Color Palette */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onUpdateSelected({ color: c })}
            className={cn(
              'w-4 h-4 rounded-full border transition-transform cursor-pointer',
              selectedDrawing.color === c ? 'scale-125 border-white ring-1 ring-accent' : 'border-black/30 hover:scale-110'
            )}
            style={{ backgroundColor: c }}
            title={`Color: ${c}`}
          />
        ))}
      </div>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Line Width */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onUpdateSelected({ lineWidth: w })}
            className={cn(
              'w-5 h-5 rounded text-terminal-micro font-semibold flex items-center justify-center transition-colors cursor-pointer',
              selectedDrawing.lineWidth === w
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'text-text-muted hover:text-text hover:bg-surface-muted'
            )}
            title={`Line Width: ${w}px`}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Line Style */}
      <div className="flex items-center gap-1 text-terminal-micro font-semibold">
        {(['solid', 'dashed', 'dotted'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => onUpdateSelected({ lineStyle: st })}
            className={cn(
              'px-1.5 py-0.5 rounded capitalize transition-colors cursor-pointer',
              selectedDrawing.lineStyle === st
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'text-text-muted hover:text-text hover:bg-surface-muted'
            )}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Extend Right Toggle for Fibonacci, Trendlines, Rectangles */}
      {(selectedDrawing.type === 'fibonacci' || selectedDrawing.type === 'trendline' || selectedDrawing.type === 'rectangle') && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            type="button"
            onClick={() => onUpdateSelected({ extendRight: !selectedDrawing.extendRight })}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-terminal-micro font-semibold transition-colors cursor-pointer border',
              selectedDrawing.extendRight
                ? 'bg-accent/20 border-accent/40 text-accent font-bold shadow-xs'
                : 'border-border text-text-muted hover:text-text hover:bg-surface-muted'
            )}
            title={selectedDrawing.extendRight ? 'Lines Extend to Right (Click for Bounded)' : 'Lines Bounded (Click to Extend to Right)'}
          >
            <ArrowRightToLine className="w-3 h-3" />
            <span>{selectedDrawing.extendRight ? 'Extended' : 'Bounded'}</span>
          </button>
        </>
      )}

      {/* Fibonacci Label Alignment Toggle (Left / Right) */}
      {selectedDrawing.type === 'fibonacci' && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            type="button"
            onClick={() =>
              onUpdateSelected({
                fiboLabelsAlign: selectedDrawing.fiboLabelsAlign === 'right' ? 'left' : 'right',
              })
            }
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-terminal-micro font-semibold transition-colors cursor-pointer border',
              selectedDrawing.fiboLabelsAlign === 'right'
                ? 'bg-accent/20 border-accent/40 text-accent font-bold shadow-xs'
                : 'border-border text-text-muted hover:text-text hover:bg-surface-muted'
            )}
            title={selectedDrawing.fiboLabelsAlign === 'right' ? 'Labels on Right (Click for Left)' : 'Labels on Left (Click for Right)'}
          >
            {selectedDrawing.fiboLabelsAlign === 'right' ? <AlignRight className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
            <span>{selectedDrawing.fiboLabelsAlign === 'right' ? 'Right Labels' : 'Left Labels'}</span>
          </button>
        </>
      )}

      <div className="w-px h-4 bg-border mx-1" />

      {/* Lock / Unlock */}
      <button
        type="button"
        onClick={() => onUpdateSelected({ locked: !selectedDrawing.locked })}
        className={cn(
          'p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer',
          selectedDrawing.locked && 'text-amber-400'
        )}
        title={selectedDrawing.locked ? 'Unlock object' : 'Lock object'}
      >
        {selectedDrawing.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>

      {/* Clone */}
      <button
        type="button"
        onClick={onCloneSelected}
        className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
        title="Clone / Duplicate"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={onDeleteSelected}
        className="p-1 rounded text-rose-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
        title="Delete drawing (Del/Backspace)"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Close inspector */}
      <button
        type="button"
        onClick={onDeselect}
        className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
        title="Deselect"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
})
