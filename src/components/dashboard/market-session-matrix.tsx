'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Globe, Clock, Zap, Sun, Moon, ArrowRight, Activity, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

interface MarketSession {
  id: string
  name: string
  city: string
  openUtcHour: number
  closeUtcHour: number
  volatility: 'high' | 'medium' | 'low'
  keyAssets: string[]
}

const SESSIONS: MarketSession[] = [
  {
    id: 'sydney',
    name: 'Sydney',
    city: 'Australia',
    openUtcHour: 22,
    closeUtcHour: 7,
    volatility: 'medium',
    keyAssets: ['AUD/USD', 'NZD/USD'],
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    city: 'Asian Session',
    openUtcHour: 0,
    closeUtcHour: 9,
    volatility: 'medium',
    keyAssets: ['USD/JPY', 'AUD/JPY'],
  },
  {
    id: 'london',
    name: 'London',
    city: 'European Session',
    openUtcHour: 8,
    closeUtcHour: 17,
    volatility: 'high',
    keyAssets: ['EUR/USD', 'GBP/USD', 'XAU/USD'],
  },
  {
    id: 'newyork',
    name: 'New York',
    city: 'US Session',
    openUtcHour: 13,
    closeUtcHour: 22,
    volatility: 'high',
    keyAssets: ['NAS100', 'US30', 'EUR/USD'],
  },
]

export function MarketSessionMatrix({ className }: { className?: string }) {
  const [utcNow, setUtcNow] = useState<Date>(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setUtcNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const currentUtcHours = mounted ? (utcNow.getUTCHours() + utcNow.getUTCMinutes() / 60) : 12
  const currentUtcString = mounted ? (utcNow.toISOString().substring(11, 19) + ' UTC') : '--:--:-- UTC'

  // Session state calculation
  const sessionStates = useMemo(() => {
    return SESSIONS.map((s) => {
      let isOpen = false
      if (s.openUtcHour < s.closeUtcHour) {
        isOpen = currentUtcHours >= s.openUtcHour && currentUtcHours < s.closeUtcHour
      } else {
        // Crosses UTC midnight (e.g. Sydney 22:00 -> 07:00)
        isOpen = currentUtcHours >= s.openUtcHour || currentUtcHours < s.closeUtcHour
      }

      // Time to next event
      let hoursUntil = 0
      if (isOpen) {
        hoursUntil =
          s.closeUtcHour > currentUtcHours
            ? s.closeUtcHour - currentUtcHours
            : 24 - currentUtcHours + s.closeUtcHour
      } else {
        hoursUntil =
          s.openUtcHour > currentUtcHours
            ? s.openUtcHour - currentUtcHours
            : 24 - currentUtcHours + s.openUtcHour
      }

      const h = Math.floor(hoursUntil)
      const m = Math.floor((hoursUntil - h) * 60)

      return {
        ...s,
        isOpen,
        countdownStr: `${h}h ${m}m`,
      }
    })
  }, [currentUtcHours])

  // Golden Overlap: London & New York (13:00 - 17:00 UTC)
  const isGoldenOverlap = currentUtcHours >= 13 && currentUtcHours < 17

  return (
    <Card className={cn("bg-surface border-border", className)}>
      <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base text-text flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            Global Market Session Matrix
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Live worldwide liquidity sessions, active market hours, and major overlaps
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {isGoldenOverlap && (
            <Badge tone="success" size="sm" pulsing className="font-bold text-2xs uppercase tracking-wider">
              🔥 London / NY Overlap Active
            </Badge>
          )}
          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-surface-muted text-accent border border-border" suppressHydrationWarning>
            {currentUtcString}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Session Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sessionStates.map((s) => (
            <div
              key={s.id}
              className={cn(
                "p-3.5 rounded-xl border transition-all duration-200 select-none",
                s.isOpen
                  ? "bg-emerald-500/10 border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/30"
                  : "bg-surface-muted/30 border-border text-text-muted"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-text flex items-center gap-1.5">
                  {s.isOpen ? (
                    <Sun className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-text-muted" />
                  )}
                  {s.name}
                </span>

                {s.isOpen ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Active Now
                  </span>
                ) : (
                  <Badge tone="neutral" size="sm" className="text-3xs uppercase font-medium">
                    Closed
                  </Badge>
                )}
              </div>

              <div className="text-2xs text-text-muted space-y-1">
                <div className="flex items-center justify-between">
                  <span>Hours (UTC):</span>
                  <span className="terminal-num tabular-nums text-text font-medium">
                    {String(s.openUtcHour).padStart(2, '0')}:00 - {String(s.closeUtcHour).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{s.isOpen ? 'Closes In:' : 'Opens In:'}</span>
                  <span className={cn("terminal-num tabular-nums font-bold", s.isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-text")}>
                    {s.countdownStr}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-3xs">
                <span className="text-text-muted uppercase">Pairs</span>
                <span className="text-text font-semibold">{s.keyAssets.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 24-Hour Visual Cycle Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-3xs uppercase text-text-muted font-bold">
            <span>00:00 UTC (Asia)</span>
            <span>08:00 UTC (London)</span>
            <span>13:00 UTC (NY Open)</span>
            <span>22:00 UTC (Sydney)</span>
          </div>

          <div className="relative h-2.5 rounded-full bg-surface-muted border border-border overflow-hidden">
            {/* London Bar */}
            <div className="absolute top-0 bottom-0 bg-blue-500/30 left-[33.3%] w-[37.5%]" />
            {/* New York Bar */}
            <div className="absolute top-0 bottom-0 bg-amber-500/30 left-[54.1%] w-[37.5%]" />
            {/* Golden Overlap Highlight */}
            <div className="absolute top-0 bottom-0 bg-emerald-500/70 left-[54.1%] w-[16.6%]" />

            {/* Current Time Cursor Marker */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-accent z-10 rounded-full shadow-md"
              style={{ left: `${(currentUtcHours / 24) * 100}%` }}
              title={`Current Time: ${currentUtcString}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
