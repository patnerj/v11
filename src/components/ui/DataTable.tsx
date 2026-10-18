'use client'

import * as React from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './table'
import { Loader2, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ColumnDef<T> {
  key: string
  header: React.ReactNode
  render?: (row: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  hideOn?: 'sm' | 'md' | 'lg'
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  onRowClick?: (row: T) => void
  className?: string
  selectable?: boolean
  selectedIds?: (string | number)[]
  onSelectionChange?: (ids: (string | number)[]) => void
}

export function DataTable<T extends { id?: string | number } | Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found.',
  emptyIcon,
  onRowClick,
  className,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}: DataTableProps<T>) {
  // Defensive array normalization per Rule 1.2 and Rule 133.2
  const safeColumns: ColumnDef<T>[] = React.useMemo(() => {
    return Array.isArray(columns) ? columns : []
  }, [columns])

  const safeSelectedIds = React.useMemo(() => {
    return Array.isArray(selectedIds) ? selectedIds : []
  }, [selectedIds])

  const safeData: T[] = React.useMemo(() => {
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object') {
      const candidate = (data as any).data || (data as any).items || (data as any).rows || (data as any).trades || (data as any).results || (data as any).records || (data as any).list
      if (Array.isArray(candidate)) return candidate
    }
    return []
  }, [data])

  const allIds = React.useMemo(() => safeData.map((r, i) => r.id ?? i), [safeData])
  const allSelected = safeData.length > 0 && allIds.every((id) => safeSelectedIds.includes(id))
  const someSelected = safeSelectedIds.length > 0 && !allSelected

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange?.([])
    } else {
      onSelectionChange?.(allIds)
    }
  }

  const toggleSelectRow = (id: string | number) => {
    if (safeSelectedIds.includes(id)) {
      onSelectionChange?.(safeSelectedIds.filter((item) => item !== id))
    } else {
      onSelectionChange?.([...safeSelectedIds, id])
    }
  }

  const totalCols = safeColumns.length + (selectable ? 1 : 0)

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-12 px-3 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected
                }}
                onChange={toggleSelectAll}
                aria-label="Select all rows"
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer"
              />
            </TableHead>
          )}
          {safeColumns.map((col, cIdx) => (
            <TableHead 
              key={col.key || `head-${cIdx}`} 
              align={col.align} 
              hideOn={col.hideOn}
              className={col.className}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={totalCols} className="h-44 text-center">
              <div className="flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span className="text-xs text-text-muted font-sans font-medium">Loading data...</span>
              </div>
            </TableCell>
          </TableRow>
        ) : safeData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={totalCols} className="h-44 text-center">
              <div className="flex flex-col items-center justify-center gap-2 text-text-muted">
                {emptyIcon || <Inbox className="h-8 w-8 text-text-muted" />}
                <span className="text-sm font-medium text-text-muted">{emptyMessage}</span>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          safeData.map((row, idx) => {
            const rowId = row.id ?? idx
            const isSelected = safeSelectedIds.includes(rowId)

            return (
              <TableRow
                key={rowId}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors',
                  isSelected && 'bg-surface-muted/50 dark:bg-surface-muted/30',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted/60'
                )}
              >
                {selectable && (
                  <TableCell className="w-12 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelectRow(rowId)}
                      aria-label={`Select row ${rowId}`}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer"
                    />
                  </TableCell>
                )}
                {safeColumns.map((col, cIdx) => (
                  <TableCell 
                    key={col.key || `cell-${idx}-${cIdx}`} 
                    align={col.align} 
                    hideOn={col.hideOn}
                    className={col.className}
                  >
                    {col.render ? col.render(row, idx) : (row as any)[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
