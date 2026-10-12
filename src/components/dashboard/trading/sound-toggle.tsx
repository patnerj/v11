'use client'

import React, { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

interface SoundToggleProps {
  className?: string
  compact?: boolean
}

export function SoundToggle({ className, compact = false }: SoundToggleProps) {
  const [enabled, setEnabled] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setEnabled(isSoundEnabled())
    setMounted(true)
  }, [])

  const handleToggle = () => {
    const next = !enabled
    setEnabled(next)
    setSoundEnabled(next)
    toast.info(next ? 'Audio Chimes Enabled 🔊' : 'Audio Chimes Muted 🔇')
  }

  if (!mounted) return null

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border text-terminal-body font-medium transition-all cursor-pointer focus-ring",
        compact ? "h-7 px-2" : "h-8 px-2.5",
        enabled
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "border-border text-text-muted hover:text-text hover:bg-surface-muted",
        className
      )}
      title={enabled ? "Tactile Audio Chimes: Enabled (Click to Mute)" : "Tactile Audio Chimes: Muted (Click to Enable)"}
      aria-label="Toggle audio chimes"
      aria-pressed={enabled}
    >
      {enabled ? (
        <>
          <Volume2 className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
          {!compact && <span className="hidden sm:inline">Sound</span>}
        </>
      ) : (
        <>
          <VolumeX className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
          {!compact && <span className="hidden sm:inline">Muted</span>}
        </>
      )}
    </button>
  )
}
