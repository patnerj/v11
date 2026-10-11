'use client'

import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TrendingUp, ShieldAlert, Activity, ShieldCheck } from 'lucide-react'
import { fmtUSD, fmtDate, toNum } from '@/lib/format'
import { useIsDarkTheme } from '@/hooks/use-theme-attribute'
import { cn } from '@/lib/cn'

interface EquityDrawdownOverlayChartProps {
  trades?: any[]
  startingBalance?: number
  maxDdPct?: number
  currentEquity?: number
  currentBalance?: number
  isTrailing?: boolean
  className?: string
}

export function EquityDrawdownOverlayChart({
  trades = [],
  startingBalance = 100000,
  maxDdPct = 10,
  currentEquity,
  currentBalance,
  isTrailing = true,
  className,
}: EquityDrawdownOverlayChartProps) {
  const isDark = useIsDarkTheme()
  const theme = isDark ? 'dark' : 'light'

  // Generate chart data series from closed trades history
  const seriesData = useMemo(() => {
    const start = toNum(startingBalance || 100000)
    const baseFloor = start * (1 - maxDdPct / 100)
    let runningBal = start
    let hwm = start

    const points: Array<{
      date: string
      balance: number
      equity: number
      floor: number
      cushion: number
    }> = [
      {
        date: 'Start',
        balance: start,
        equity: start,
        floor: baseFloor,
        cushion: start - baseFloor,
      },
    ]

    const sortedTrades = [...(Array.isArray(trades) ? trades : [])].sort(
      (a, b) => new Date(a.closed_at || 0).getTime() - new Date(b.closed_at || 0).getTime()
    )

    sortedTrades.forEach((t, idx) => {
      const pnl = toNum(t.pnl)
      runningBal += pnl
      if (runningBal > hwm) hwm = runningBal

      // Trailing floor ratchets with equity/balance HWM
      const floor = isTrailing
        ? Math.max(baseFloor, hwm * (1 - maxDdPct / 100))
        : baseFloor

      const dateLabel = t.closed_at
        ? new Date(t.closed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `T${idx + 1}`

      points.push({
        date: dateLabel,
        balance: Math.round(runningBal),
        equity: Math.round(runningBal),
        floor: Math.round(floor),
        cushion: Math.round(runningBal - floor),
      })
    })

    // Append latest live point if available
    if (currentEquity !== undefined && currentBalance !== undefined && points.length > 1) {
      const liveBal = toNum(currentBalance)
      const liveEq = toNum(currentEquity)
      if (liveBal > hwm) hwm = liveBal
      const liveFloor = isTrailing
        ? Math.max(baseFloor, hwm * (1 - maxDdPct / 100))
        : baseFloor

      points.push({
        date: 'Now',
        balance: Math.round(liveBal),
        equity: Math.round(liveEq),
        floor: Math.round(liveFloor),
        cushion: Math.round(liveEq - liveFloor),
      })
    }

    return points
  }, [trades, startingBalance, maxDdPct, currentEquity, currentBalance, isTrailing])

  const chartTextColor = theme === 'dark' ? '#94a3b8' : '#64748b'
  const gridColor = theme === 'dark' ? '#1e293b' : '#e2e8f0'

  return (
    <Card className={cn("bg-surface border-border", className)}>
      <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base text-text flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Equity vs. Trailing Drawdown Floor Curve
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Live multi-line trajectory overlaying Realized Balance, Floating Equity, and Risk Floor
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-2">
        <div className="h-80 w-full">
          {seriesData.length <= 1 ? (
            <div className="h-full flex items-center justify-center text-text-muted text-xs">
              Execute trades to generate the multi-layer equity & drawdown floor trajectory.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData} margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartTextColor, fontSize: 11 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartTextColor, fontSize: 11 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '10px',
                    color: 'hsl(var(--text))',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    fontSize: '12px',
                  }}
                  formatter={(val: number, name: string) => [
                    fmtUSD(val),
                    name === 'balance'
                      ? 'Realized Balance'
                      : name === 'equity'
                        ? 'Live Equity'
                        : 'Drawdown Floor',
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="plainline"
                  formatter={(val) => (
                    <span className="text-2xs font-semibold text-text uppercase tracking-wider">
                      {val === 'balance'
                        ? 'Balance'
                        : val === 'equity'
                          ? 'Live Equity'
                          : 'Drawdown Floor (Breach line)'}
                    </span>
                  )}
                />

                {/* 1. Realized Balance Line (Cyan/Blue) */}
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06B6D4' }}
                  activeDot={{ r: 5 }}
                />

                {/* 2. Live Equity Line (Emerald Green) */}
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#10B981' }}
                  activeDot={{ r: 6 }}
                />

                {/* 3. Trailing Floor Breach Line (Red/Rose Dashed) */}
                <Line
                  type="stepAfter"
                  dataKey="floor"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
