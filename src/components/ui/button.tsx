'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Loader2 } from 'lucide-react'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:     'bg-accent hover:bg-accent-hover text-slate-950 font-semibold shadow-sm hover:shadow-[0_0_20px_var(--accent-glow)]',
        secondary:   'bg-surface-muted hover:bg-surface text-foreground border border-border shadow-sm',
        destructive: 'bg-red-600 hover:bg-red-500 text-white shadow-sm',
        danger:      'bg-red-600 hover:bg-red-500 text-white shadow-sm',
        ghost:       'text-muted-foreground hover:text-foreground hover:bg-surface-muted',
        outline:     'bg-transparent text-foreground border border-border hover:bg-surface-muted hover:border-border-strong',
        success:     'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
        buy:         'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-semibold',
        sell:        'bg-red-600 hover:bg-red-500 text-white shadow-sm font-semibold',
        link:        'text-accent hover:text-accent-hover underline-offset-4 hover:underline px-0',
      },
      size: {
        xs: 'h-7 px-2.5 text-2xs',
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        default: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  isPending?: boolean
  isSubmitting?: boolean
}

function hasLoader2(node: React.ReactNode): boolean {
  if (!node) return false
  if (Array.isArray(node)) {
    return node.some(hasLoader2)
  }
  if (React.isValidElement(node)) {
    if (
      node.type === Loader2 ||
      (node.props as any)?.['data-spinner'] ||
      (typeof node.type === 'object' && (node.type as any)?.displayName === 'Loader2')
    ) {
      return true
    }
    if ((node.props as any)?.children) {
      return hasLoader2((node.props as any).children)
    }
  }
  return false
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, isPending, isSubmitting, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const isLoading = Boolean(loading || isPending || isSubmitting)
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isLoading && !hasLoader2(children) && (
              <Loader2
                className={cn(
                  'animate-spin shrink-0',
                  size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5 mr-1.5' : 'h-4 w-4 mr-2'
                )}
                data-spinner="true"
              />
            )}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
