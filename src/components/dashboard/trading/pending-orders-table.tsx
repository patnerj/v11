'use client'

import { memo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { fmtPrice, fmtLots, toNum, timeAgo, fmtDate } from '@/lib/format'
import { symbolDigits } from '@/lib/symbol-meta'
import { useTerminal } from '@/store/terminal'
import { Badge } from '@/components/ui/badge'
import type { PendingOrder } from '@/types/api'
import { cn } from '@/lib/cn'

interface Props {
  orders: PendingOrder[] | null
  onChanged?: () => void
}

export const PendingOrdersTable = memo(function PendingOrdersTable({ orders, onChanged }: Props) {
  if (orders === null) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skel h-9 w-full" />)}
      </div>
    )
  }
  // Filter to active/pending only for the table; show full status as Badge
  const active = orders.filter((o) => o.status === 'pending')

  if (active.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-terminal-body text-text-muted">No pending orders</div>
        <div className="text-terminal-micro text-text-faint mt-1">
          Switch the order ticket to “Pending” to place a limit or stop order.
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-terminal-body">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-subtle/40">
            <Th>Symbol</Th>
            <Th>Type</Th>
            <Th align="right">Volume</Th>
            <Th align="right">Trigger</Th>
            <Th align="right" hideOn="md">SL / TP</Th>
            <Th align="right" hideOn="md">Placed</Th>
            <Th align="right">{''}</Th>
          </tr>
        </thead>
        <tbody>
          {active.map((o, i) => (
            <Row key={o.id} order={o} index={i} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
    </div>
  )
})

function Row({ order, index, onChanged }: { order: PendingOrder; index: number; onChanged?: () => void }) {
  const getMeta = useTerminal((s) => s.getMeta)
  const meta    = getMeta(order.symbol)
  const digits  = meta?.digits || symbolDigits(order.symbol)
  const [busy, setBusy] = useState(false)

  const cancel = useCallback(async () => {
    setBusy(true)
    const res = await api.pendingCancel(order.id)
    setBusy(false)
    if (res.ok && res.data.success) {
      toast.success('Order cancelled')
      invalidateFxsim('/pending-order'); invalidateFxsim('/account')
      onChanged?.()
    } else {
      toast.error(res.ok ? (res.data.message || 'Cancel failed') : res.error)
    }
  }, [order.id, onChanged])

  const isBuy = order.order_type.startsWith('buy')
  const placedRaw = order.created_at_iso || order.created_at

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: order.isOptimistic ? 0.6 : 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
      className={cn(
        "border-b border-border-subtle/40 last:border-0 hover:bg-surface-muted/30 transition-colors",
        order.isOptimistic && "animate-pulse pointer-events-none"
      )}
    >
      <Td><span className="font-semibold terminal-num">{order.symbol}</span></Td>
      <Td>
        <Badge tone={isBuy ? 'success' : 'danger'}>
          {order.order_type.replace('_', ' ').toUpperCase()}
        </Badge>
      </Td>
      <Td align="right"><span className="terminal-num text-text-muted">{fmtLots(order.lot_size)}</span></Td>
      <Td align="right"><span className="terminal-num">{fmtPrice(order.target_price, digits)}</span></Td>
      <Td align="right" hideOn="md">
        <span className="text-terminal-body terminal-num text-text-muted">
          {order.sl ? fmtPrice(order.sl, digits) : '—'} / {order.tp ? fmtPrice(order.tp, digits) : '—'}
        </span>
      </Td>
      <Td align="right" hideOn="md">
        <span
          title={placedRaw ? `${timeAgo(placedRaw)} · ${fmtDate(placedRaw, true)}` : undefined}
          className="text-terminal-micro text-text-muted whitespace-nowrap cursor-default terminal-num"
        >
          {placedRaw ? fmtDate(placedRaw) : '—'}
        </span>
      </Td>
      <Td align="right">
        <button
          onClick={cancel}
          disabled={busy}
          className="h-7 w-7 inline-flex items-center justify-center rounded text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 focus-ring disabled:opacity-50 transition-all cursor-pointer"
          aria-label="Cancel pending order"
        >
          {busy ? (
            <span className="h-3 w-3 rounded-full border-2 border-rose-400/40 border-t-rose-400 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </Td>
    </motion.tr>
  )
}

function Th({ children, align, hideOn }: { children: React.ReactNode; align?: 'right'; hideOn?: 'sm' | 'md' | 'lg' }) {
  return (
    <th className={cn(
      'px-3 py-2 text-terminal-micro uppercase tracking-wider text-text-faint font-semibold',
      align === 'right' ? 'text-right' : 'text-left',
      hideOn === 'md' && 'hidden md:table-cell',
    )}>{children}</th>
  )
}
function Td({ children, align, hideOn }: { children: React.ReactNode; align?: 'right'; hideOn?: 'sm' | 'md' | 'lg' }) {
  return (
    <td className={cn(
      'px-3 py-2.5 text-terminal-body',
      align === 'right' ? 'text-right' : 'text-left',
      hideOn === 'md' && 'hidden md:table-cell',
    )}>{children}</td>
  )
}
