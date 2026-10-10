'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Layers, Check, ChevronDown, Monitor, LayoutTemplate } from 'lucide-react'
import { cn } from '@/lib/cn'

interface TemplateSwitcherProps {
  currentTemplate: 'classic' | 'terminal'
}

export function TemplateSwitcher({ currentTemplate }: TemplateSwitcherProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  const handleSelect = (tpl: 'classic' | 'terminal') => {
    // Persist to cookie for 30 days
    document.cookie = `fxsim_landing_template=${tpl}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    
    // Update URL query parameter and trigger refresh
    const params = new URLSearchParams(searchParams.toString())
    params.set('template', tpl)
    router.push(`/?${params.toString()}`)
    router.refresh()
    setOpen(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div className="relative">
        {/* Toggle trigger button */}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold shadow-xl backdrop-blur-md transition-all cursor-pointer',
            'bg-surface/95 hover:bg-surface text-text border-emerald-500/40 hover:border-emerald-500',
            'ring-1 ring-emerald-500/20 hover:shadow-emerald-500/10'
          )}
          title="Switch Landing Page Template"
          aria-label="Switch Landing Page Template"
        >
          <Layers className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>Template:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {currentTemplate === 'terminal' ? 'Institutional Pro (MassFunded Style)' : 'Classic Builder'}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {/* Dropdown Menu */}
        {open && (
          <div className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl bg-surface border border-border shadow-2xl p-2 z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-2 text-2xs font-mono uppercase tracking-wider text-text-muted border-b border-border/60">
              Select Landing Template
            </div>

            <div className="p-1 space-y-1">
              {/* Template A: Classic */}
              <button
                onClick={() => handleSelect('classic')}
                className={cn(
                  'w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer',
                  currentTemplate === 'classic'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-text'
                    : 'hover:bg-surface-secondary text-text-muted hover:text-text'
                )}
              >
                <LayoutTemplate className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text">Template A: Classic</span>
                    {currentTemplate === 'classic' && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
                    Visual Builder layout with modular cards, stats strip, and interactive challenges.
                  </p>
                </div>
              </button>

              {/* Template B: Terminal Pro (MassFunded Style) */}
              <button
                onClick={() => handleSelect('terminal')}
                className={cn(
                  'w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer',
                  currentTemplate === 'terminal'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-text'
                    : 'hover:bg-surface-secondary text-text-muted hover:text-text'
                )}
              >
                <Monitor className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text">Template B: Pro Terminal</span>
                    {currentTemplate === 'terminal' && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                  <div className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-3xs font-semibold my-0.5">
                    MassFunded.org Style
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
                    Institutional matrix style with live WebTrader preview frame &amp; comparison matrix.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
