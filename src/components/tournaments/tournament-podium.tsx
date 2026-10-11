'use client'

import React from 'react'
import { Trophy, Crown, Medal, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PodiumParticipant {
  rank: number
  name: string
  returnPct?: number
  equity?: number
  prize?: string
}

interface TournamentPodiumProps {
  participants?: PodiumParticipant[]
  firstPrize?: string
  secondPrize?: string
  thirdPrize?: string
  title?: string
  className?: string
}

export function TournamentPodium({
  participants = [],
  firstPrize = '$10,000 + $100K Account',
  secondPrize = '$5,000 + $50K Account',
  thirdPrize = '$2,500 + $25K Account',
  title = 'Tournament Hall of Fame & Top Contenders',
  className,
}: TournamentPodiumProps) {
  const p1 = participants.find(p => p.rank === 1) || {
    rank: 1,
    name: 'Top Trader #1',
    prize: firstPrize,
    returnPct: 24.85,
  }
  const p2 = participants.find(p => p.rank === 2) || {
    rank: 2,
    name: 'Top Trader #2',
    prize: secondPrize,
    returnPct: 18.40,
  }
  const p3 = participants.find(p => p.rank === 3) || {
    rank: 3,
    name: 'Top Trader #3',
    prize: thirdPrize,
    returnPct: 14.15,
  }

  return (
    <div className={cn('w-full space-y-6', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-bold text-text">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-amber-500 font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Top 3 Podium
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end pt-4">
        {/* 🥈 #2 Silver Podium (Left) */}
        <div className="order-2 md:order-1 flex flex-col items-center">
          <div className="w-full relative rounded-2xl border border-slate-400/40 bg-gradient-to-b from-slate-400/15 via-surface/90 to-surface p-5 text-center shadow-[0_4px_25px_rgba(148,163,184,0.12)] hover:border-slate-300 transition-all duration-300 group">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950 font-black shadow-md border-2 border-surface">
              2
            </div>
            <div className="mt-2 inline-flex p-3 rounded-full bg-slate-400/15 text-slate-300 ring-4 ring-slate-400/10 mb-2">
              <Medal className="h-6 w-6 text-slate-300" />
            </div>
            <div className="text-2xs font-mono uppercase tracking-widest text-slate-400 font-bold">2nd Place</div>
            <div className="text-base font-extrabold text-text truncate mt-1 group-hover:text-slate-300 transition-colors">
              {p2.name}
            </div>
            {p2.returnPct !== undefined && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-mono font-bold text-profit">
                <TrendingUp className="h-3 w-3" /> +{p2.returnPct.toFixed(2)}%
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border/50 text-2xs font-semibold text-text-muted">
              Prize: <span className="text-text font-bold">{p2.prize || secondPrize}</span>
            </div>
          </div>
          <div className="hidden md:block w-full h-12 bg-gradient-to-b from-slate-400/20 to-slate-400/5 rounded-b-xl border-x border-b border-slate-400/20" />
        </div>

        {/* 🥇 #1 Gold Champion Podium (Center - Elevated) */}
        <div className="order-1 md:order-2 flex flex-col items-center">
          <div className="w-full relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/20 via-surface/95 to-surface p-6 text-center shadow-[0_8px_35px_rgba(245,158,11,0.22)] hover:border-amber-400 transition-all duration-300 group -translate-y-1 md:-translate-y-3">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-amber-950 font-black shadow-lg border-2 border-surface">
              <Crown className="h-6 w-6 fill-amber-950 text-amber-950" />
            </div>
            <div className="mt-3 inline-flex p-3.5 rounded-full bg-amber-500/20 text-amber-400 ring-4 ring-amber-500/15 mb-2 shadow-inner">
              <Trophy className="h-7 w-7 text-amber-400 drop-shadow" />
            </div>
            <div className="text-2xs font-mono uppercase tracking-widest text-amber-400 font-extrabold flex items-center justify-center gap-1">
              ★ Champion ★
            </div>
            <div className="text-lg font-black text-text truncate mt-1 group-hover:text-amber-400 transition-colors">
              {p1.name}
            </div>
            {p1.returnPct !== undefined && (
              <div className="mt-1 inline-flex items-center gap-1 text-sm font-mono font-black text-profit">
                <TrendingUp className="h-3.5 w-3.5" /> +{p1.returnPct.toFixed(2)}%
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs font-semibold text-text-muted">
              Grand Prize: <span className="text-amber-400 font-extrabold">{p1.prize || firstPrize}</span>
            </div>
          </div>
          <div className="hidden md:block w-full h-20 bg-gradient-to-b from-amber-500/25 to-amber-500/5 rounded-b-xl border-x border-b border-amber-500/30" />
        </div>

        {/* 🥉 #3 Bronze Podium (Right) */}
        <div className="order-3 md:order-3 flex flex-col items-center">
          <div className="w-full relative rounded-2xl border border-amber-700/40 bg-gradient-to-b from-amber-700/15 via-surface/90 to-surface p-5 text-center shadow-[0_4px_25px_rgba(180,83,9,0.12)] hover:border-amber-600 transition-all duration-300 group">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-black shadow-md border-2 border-surface">
              3
            </div>
            <div className="mt-2 inline-flex p-3 rounded-full bg-amber-700/15 text-amber-600 dark:text-amber-500 ring-4 ring-amber-700/10 mb-2">
              <Medal className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div className="text-2xs font-mono uppercase tracking-widest text-amber-600 dark:text-amber-500 font-bold">3rd Place</div>
            <div className="text-base font-extrabold text-text truncate mt-1 group-hover:text-amber-600 transition-colors">
              {p3.name}
            </div>
            {p3.returnPct !== undefined && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-mono font-bold text-profit">
                <TrendingUp className="h-3 w-3" /> +{p3.returnPct.toFixed(2)}%
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border/50 text-2xs font-semibold text-text-muted">
              Prize: <span className="text-text font-bold">{p3.prize || thirdPrize}</span>
            </div>
          </div>
          <div className="hidden md:block w-full h-8 bg-gradient-to-b from-amber-700/20 to-amber-700/5 rounded-b-xl border-x border-b border-amber-700/20" />
        </div>
      </div>
    </div>
  )
}
