'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const [hasScrolled, setHasScrolled] = React.useState(false)

  const checkScroll = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 6)
    setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 6)
  }, [])

  React.useEffect(() => {
    checkScroll()
    const el = containerRef.current
    if (!el) return
    const resizeObserver = new ResizeObserver(() => checkScroll())
    resizeObserver.observe(el)
    window.addEventListener('resize', checkScroll)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    checkScroll()
    if (!hasScrolled && e.currentTarget.scrollLeft > 15) {
      setHasScrolled(true)
    }
  }

  return (
    <div className="relative w-full rounded-xl border border-border bg-surface shadow-sm group/table">
      {/* Mobile Scroll Gradient Edge Overlays (Option 5) */}
      {canScrollLeft && (
        <div 
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-surface to-transparent transition-opacity duration-300 z-10 sm:hidden" 
        />
      )}
      {canScrollRight && (
        <div 
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-l from-surface to-transparent transition-opacity duration-300 z-10 sm:hidden" 
        />
      )}

      {/* Subtle Mobile Swipe Hint (disappears on scroll) */}
      {canScrollRight && !hasScrolled && (
        <div 
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-2.5 z-20 px-2 py-0.5 rounded-full bg-surface/90 border border-border/80 text-[10px] font-semibold text-text-muted shadow-xs backdrop-blur-xs flex items-center gap-1 sm:hidden animate-pulse"
        >
          <span>↔ Swipe</span>
        </div>
      )}

      {/* Overflow Scroll Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full overflow-auto rounded-xl scrollbar-none"
      >
        <table
          ref={ref}
          className={cn('w-full caption-bottom text-sm text-text', className)}
          {...props}
        />
      </div>
    </div>
  )
})
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn('bg-surface-muted/80 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider', className)} 
    {...props} 
  />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-border/60 [&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border/50 transition-colors hover:bg-surface-muted/50 data-[state=selected]:bg-surface-muted',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right'; hideOn?: 'sm' | 'md' | 'lg' }
>(({ className, align = 'left', hideOn, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle text-2xs font-semibold uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0',
      align === 'center' && 'text-center',
      align === 'right' && 'text-right',
      hideOn === 'sm' && 'hidden sm:table-cell',
      hideOn === 'md' && 'hidden md:table-cell',
      hideOn === 'lg' && 'hidden lg:table-cell',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right'; hideOn?: 'sm' | 'md' | 'lg' }
>(({ className, align = 'left', hideOn, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'p-4 align-middle text-sm text-foreground [&:has([role=checkbox])]:pr-0',
      align === 'center' && 'text-center',
      align === 'right' && 'text-right',
      hideOn === 'sm' && 'hidden sm:table-cell',
      hideOn === 'md' && 'hidden md:table-cell',
      hideOn === 'lg' && 'hidden lg:table-cell',
      className
    )}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
}
