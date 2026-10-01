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
        isAdmin && 'dark bg-[#0A0E17] border border-slate-800 text-slate-100 shadow-2xl ring-1 ring-emerald-500/20',
        className
      )}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle className={isAdmin ? 'text-slate-100 font-bold' : undefined}>{title}</DialogTitle>}
            {description && <DialogDescription className={isAdmin ? 'text-slate-400' : undefined}>{description}</DialogDescription>}
          </DialogHeader>
        )}

        <div className="py-2">
          {children}
        </div>

        {footer && (
          <DialogFooter>
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
