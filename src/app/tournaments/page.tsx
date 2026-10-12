'use client'

import { useState, useEffect } from 'react'
import { Trophy, Clock, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Competition, PaymentOrder } from '@/types/api'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { TournamentPodium } from '@/components/tournaments/tournament-podium'

export default function PublicTournamentsPage() {
  const [tournaments, setTournaments] = useState<Competition[]>([])
  const [pendingOrders, setPendingOrders] = useState<Map<number, PaymentOrder>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const [res, ord] = await Promise.all([
          api.tournaments.list(),
          api.paymentMyOrders(true).catch(() => ({ ok: false as const, data: [] as PaymentOrder[] }))
        ])
        if (res.ok) setTournaments(res.data)
        if (ord.ok && Array.isArray(ord.data)) {
          const map = new Map<number, PaymentOrder>()
          for (const o of ord.data) {
            if (o.status === 'pending' || o.status === 'submitted') {
              const tid = (o as PaymentOrder & { tournament_id?: number }).tournament_id 
                ? Number((o as PaymentOrder & { tournament_id?: number }).tournament_id) 
                : (o.admin_note?.match(/tournament_entry:(\d+)/)?.[1] ? Number(o.admin_note.match(/tournament_entry:(\d+)/)![1]) : null)
              if (tid && !isNaN(tid)) map.set(tid, o)
            }
          }
          setPendingOrders(map)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchTournaments()
  }, [])

  const activeTournaments = tournaments.filter(t => t.status === 'active')
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming')
  const completedTournaments = tournaments.filter(t => t.status === 'completed')

  const formatPrizePool = (val: unknown) => {
    const raw = String(val ?? '').trim()
    if (!raw) return '$1,000'
    const cleaned = raw.replace(/[$€£,\s]/g, '')
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      return `$${Number(cleaned).toLocaleString()}`
    }
    return raw
  }

  const cleanTitle = (val?: string | null) => {
    const raw = String(val || 'Tournament').trim()
    return raw.replace(/^[\s🏆]+/u, '').trim() || raw
  }

  const cleanDescription = (val?: string | null) => {
    const raw = String(val || 'Global trading tournament.').trim()
    return raw.replace(/\*\*/g, '').replace(/###?/g, '').trim() || raw
  }

  const renderCard = (t: Competition, isActive: boolean) => {
    const tid = Number(t.id)
    const pendingOrder = pendingOrders.get(tid)
    return (
    <div key={t.id} className={`relative group rounded-2xl border ${pendingOrder ? 'border-amber-500/40 bg-surface shadow-amber-500/5' : 'border-border bg-surface'} p-6 overflow-hidden hover:shadow-lg transition-all duration-300`}>
      {isActive && (
        <div className="absolute -top-16 -right-16 h-32 w-32 bg-accent/20 rounded-full blur-2xl group-hover:bg-accent/30 transition-all duration-500 pointer-events-none" />
      )}

      {/* Top Header Bar with Icon & Status Badge (Clean flex, zero overlap) */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${isActive ? 'bg-accent/10 text-accent' : 'bg-surface-muted text-text-muted'}`}>
          <Trophy className="h-5 w-5" />
        </div>
        {pendingOrder ? (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3 mr-1" />
            Payment Pending
          </span>
        ) : isActive ? (
          <span className="inline-flex items-center rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-accent mr-1.5"></span>
            LIVE NOW
          </span>
        ) : t.status === 'upcoming' ? (
          <span className="inline-flex items-center rounded-full bg-info/10 border border-info/20 px-2.5 py-0.5 text-xs font-semibold text-info">
            <Clock className="h-3 w-3 mr-1" />
            Upcoming
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-surface-muted border border-border px-2.5 py-0.5 text-xs font-semibold text-text-muted">
            Completed
          </span>
        )}
      </div>

      <div className="mb-4">
        <Link href={`/tournaments/${tid}`} className="block group/link">
          <h3 className="text-lg font-bold text-text group-hover/link:text-accent group-hover/link:underline transition-colors line-clamp-1">
            {cleanTitle(t.name || t.title)}
          </h3>
        </Link>
        <p className="text-sm text-text-muted mt-1 line-clamp-2">{cleanDescription(t.description)}</p>
      </div>

      {/* Stats Grid: 2x2 layout so Enrolled/Cap and Starting Equity never wrap awkwardly */}
      <div className="grid grid-cols-2 gap-2.5 my-5">
        <div className="bg-surface-muted/50 p-2.5 rounded-lg border border-border/50">
          <div className="text-2xs text-text-muted mb-0.5">Prize Pool</div>
          <div className="text-sm font-bold text-accent truncate">{formatPrizePool(t.prize_pool)}</div>
        </div>
        <div className="bg-surface-muted/50 p-2.5 rounded-lg border border-border/50">
          <div className="text-2xs text-text-muted mb-0.5">Entry Fee</div>
          <div className="text-sm font-bold text-text">
            {Number(t.entry_fee) > 0 ? `$${Number(t.entry_fee).toFixed(0)}` : 'FREE'}
          </div>
        </div>
        <div className="bg-surface-muted/50 p-2.5 rounded-lg border border-border/50">
          <div className="text-2xs text-text-muted mb-0.5">Enrolled / Cap</div>
          <div className="text-sm font-bold text-text flex items-center gap-1.5 font-mono whitespace-nowrap">
            <Users className="h-3.5 w-3.5 text-info shrink-0" />
            <span>{t.participants_count ?? t.current_participants ?? 0} / {t.max_participants || 1000}</span>
          </div>
        </div>
        <div className="bg-surface-muted/50 p-2.5 rounded-lg border border-border/50">
          <div className="text-2xs text-text-muted mb-0.5">Starting Equity</div>
          <div className="text-sm font-bold text-text font-mono whitespace-nowrap">
            ${Number(t.starting_balance || 10000).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="text-xs text-text-muted flex items-center flex-wrap gap-x-2 gap-y-1">
          {t.start_date && (
            <span>Starts: <strong className="text-text font-semibold">{new Date(String(t.start_date).replace(' ', 'T')).toLocaleDateString()}</strong></span>
          )}
          {t.start_date && t.end_date && <span className="text-text-faint">·</span>}
          {t.end_date && (
            <span>Ends: <strong className="text-text font-semibold">{new Date(String(t.end_date).replace(' ', 'T')).toLocaleDateString()}</strong></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tournaments/${tid}`}
            className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-muted"
          >
            Details
          </Link>
          {pendingOrder ? (
            <Link 
              href={`/checkout?tournament=${tid}&order=${pendingOrder.id}`}
              className="inline-flex items-center justify-center rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-sm gap-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
            >
              Payment Pending <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link 
              href={`/dashboard/tournaments`}
              className={`inline-flex items-center justify-center rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors shadow-sm gap-1.5 ${
                isActive 
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90 font-semibold' 
                  : t.status === 'upcoming'
                  ? 'bg-info/15 border border-info/30 text-info hover:bg-info/25 font-semibold'
                  : 'bg-surface border border-border text-text hover:bg-surface-muted'
              }`}
            >
              {isActive ? 'Enter Arena' : t.status === 'upcoming' ? 'Pre-Register Now' : 'View Results'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Unlike /challenges, /leaderboard, and /faq, this page had no site
          header or footer — a visitor landing here had no navigation back to
          the rest of the site except the browser back button. */}
      <MarketingHeader />
      {/* Hero Section with Rule 86.2 Top Clearance for Fixed Navigation */}
      <div className="relative overflow-hidden bg-surface border-b border-border pt-28 sm:pt-36 pb-16 sm:pb-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] bg-accent/20 rounded-full blur-[100px] opacity-60 mix-blend-screen animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] bg-info/20 rounded-full blur-[80px] opacity-60 mix-blend-screen" />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-text">
            Compete in <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent to-info">Trading Tournaments</span>
          </h1>
          <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
            Test your skills against traders worldwide. Climb the leaderboard, prove your strategy, and win funded accounts and cash prizes.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* 3D Metallic Tournament Podium Showcase */}
        <TournamentPodium
          title="Global Arena Champions & Prize Pool Podium"
          firstPrize="$10,000 + $100K Live Account"
          secondPrize="$5,000 + $50K Live Account"
          thirdPrize="$2,500 + $25K Live Account"
        />

        {loading ? (
          <div className="text-center py-20 text-text-muted animate-pulse">Loading arenas...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            No tournaments are open right now — check back soon.
          </div>
        ) : (
          <>
            {activeTournaments.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-1 bg-accent rounded-full" />
                  <h2 className="text-2xl font-bold text-text">Live Tournaments</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeTournaments.map(t => renderCard(t, true))}
                </div>
              </section>
            )}

            {upcomingTournaments.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-1 bg-info rounded-full" />
                  <h2 className="text-2xl font-bold text-text">Upcoming Challenges</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingTournaments.map(t => renderCard(t, false))}
                </div>
              </section>
            )}

            {completedTournaments.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-1 bg-border rounded-full" />
                  <h2 className="text-2xl font-bold text-text">Past Tournaments</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
                  {completedTournaments.map(t => renderCard(t, false))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <MarketingFooter />
    </div>
  )
}
