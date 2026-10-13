'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold tabular tracking-tight transition-colors',
  {
    variants: {
      tone: {
        default:     'bg-primary/10 text-emerald-800 dark:text-primary border-primary/20',
        secondary:   'bg-surface-muted text-slate-700 dark:text-muted-foreground border-border',
        success:     'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20',
        warning:     'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20',
        warn:        'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20',
        danger:      'bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-500/20',
        destructive: 'bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-500/20',
        info:        'bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-500/20',
        accent:      'bg-accent/15 text-teal-900 dark:text-accent border-accent/30',
        neutral:     'bg-surface-muted text-slate-700 dark:text-muted-foreground border-border',
        outline:     'bg-transparent text-slate-900 dark:text-foreground border-border',
      },
      size: {
        xs: 'text-3xs px-1.5 py-0.5',
        sm: 'text-2xs px-2 py-0.5',
        md: 'text-2xs px-2.5 py-0.5',
        lg: 'text-xs px-3 py-1',
      }
    },
    defaultVariants: { tone: 'default', size: 'md' },
  },
)

export interface BadgeProps 
  extends React.HTMLAttributes<HTMLSpanElement>, 
    VariantProps<typeof badgeVariants> {
  variant?: VariantProps<typeof badgeVariants>['tone']
  pulsing?: boolean
}

const PULSE_TONES: Record<string, string> = {
  default:     'bg-primary',
  secondary:   'bg-muted-foreground',
  success:     'bg-emerald-400',
  warning:     'bg-amber-400',
  warn:        'bg-amber-400',
  danger:      'bg-rose-400',
  destructive: 'bg-rose-400',
  info:        'bg-blue-400',
  accent:      'bg-accent',
  neutral:     'bg-muted-foreground',
  outline:     'bg-foreground',
}

export function Badge({ className, tone, variant, size, pulsing, children, ...props }: BadgeProps) {
  const selectedTone = (tone || variant || 'default') as keyof typeof PULSE_TONES
  const pulseClass = PULSE_TONES[selectedTone] || PULSE_TONES.default

  return (
    <span className={cn(badgeVariants({ tone: selectedTone as any, size }), className)} {...props}>
      {pulsing && (
        <span className="relative flex h-1.5 w-1.5 shrink-0 mr-0.5">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", pulseClass)}></span>
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", pulseClass)}></span>
        </span>
      )}
      {children}
    </span>
  )
}