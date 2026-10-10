'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './dialog'
import { cn } from '@/lib/cn'

export interface ModalProps {
  isOpen?: boolean
  open?: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | string
}

export function Modal({
  isOpen,
  open,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  maxWidth = 'md'
}: ModalProps) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : (open !== undefined ? open : false)
  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen)
    if (!nextOpen && onClose) onClose()
  }

  const widthClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }
  const resolvedWidth = widthClasses[maxWidth] || (maxWidth.startsWith('max-w-') ? maxWidth : 'max-w-md')

  return (
    <Dialog open={isCurrentlyOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        resolvedWidth,
        'bg-surface border border-border text-foreground shadow-2xl flex flex-col overflow-hidden p-0',
        className
      )}>
        {(title || description) ? (
          <>
            <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-3.5 shrink-0 pr-12 sm:pr-14 border-b border-surface-muted/50">
              {title && <DialogTitle className="text-foreground font-bold text-base sm:text-lg min-w-0">{title}</DialogTitle>}
              {description && <DialogDescription className="text-muted-foreground text-2xs sm:text-xs mt-0.5">{description}</DialogDescription>}
            </DialogHeader>

            <div className="px-4 py-3 sm:px-6 sm:py-4 flex-1 overflow-y-auto min-h-0">
              {children}
            </div>
          </>
        ) : (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0">
            {children}
          </div>
        )}

        {footer && (
          <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 shrink-0 border-t border-surface-muted/50">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
}
