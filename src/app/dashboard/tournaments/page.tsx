'use client'

/**
 * In-dashboard Tournaments — browse, join, and track tournaments without
 * leaving the trader panel. The public /tournaments page remains for marketing.
 * Entry fees are charged from the WALLET (never challenge accounts).
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trophy, Users, Calendar, ArrowRight, Loader2, Wallet, CheckCircle2, Clock, BookOpen, ShieldAlert, ShieldCheck, Zap, Sparkles, AlertTriangle, Info, Activity } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { usePrices } from '@/store/prices'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/Modal'
import { fmtUSD, toNum } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Competition, PaymentOrder } from '@/types/api'
import { TournamentPodium } from '@/components/tournaments/tournament-podium'
import { ArenaChart } from '@/components/arena/arena-chart'

function cleanPrizeValue(val: string): string {
  if (!val) return ''
  return val.replace(/[\$€£]/g, '').trim()
}

function safeFormatDate(val?: string | null): string | null {
  if (!val) return null
  try {
    const d = new Date(String(val).replace(' ', 'T'))
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString()
  } catch {
    return null
  }
}

function parsePrizes(raw: unknown): Record<string, string> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, string>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {}
  }
  return {}
}

function parseRules(raw: unknown): {
  drawdown_type?: 'trailing' | 'static'
  trailing_dd?: number
  daily_dd?: number
  max_dd?: number
  leverage?: number
  min_days?: number
  news_trading?: boolean | number
  weekend_holding?: boolean | number
} {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as any
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {}
  }
  return {}
}

export default function DashboardTournamentsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [joining, setJoining] = useState<number | null>(null)
  const [viewingRules, setViewingRules] = useState<Competition | null>(null)
  const [viewingPrizes, setViewingPrizes] = useState<Competition | null>(null)
  const [viewingChart, setViewingChart] = useState<Competition | null>(null)

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments-public'],
    queryFn: () => api.tournaments.list().then(r => (r.ok && Array.isArray(r.data) ? r.data : [])),
  })

  const { data: mine = [] } = useQuery({
    queryKey: ['tournaments-mine'],
    queryFn: () => api.tournaments.mine().then(r => (r.ok && Array.isArray(r.data) ? r.data : [])),
  })

  const { data: myOrders = [] } = useQuery({
    queryKey: ['payment-my-orders'],
    queryFn: () => api.paymentMyOrders(true).then(r => (r.ok && Array.isArray(r.data) ? r.data : [])),
    refetchInterval: 10_000,
    staleTime: 0,
  })

  const pendingOrdersByTournament = useMemo(() => {
    const map = new Map<number, PaymentOrder>()
    const safeOrders = Array.isArray(myOrders) ? myOrders : []
    for (const o of safeOrders) {
      const isPending = o.status === 'pending' || o.status === 'submitted'
      if (!isPending) continue
      const tid = (o as any).tournament_id != null
        ? Number((o as any).tournament_id)
        : o.admin_note?.match(/tournament_entry:(\d+)/)?.[1]
          ? Number(o.admin_note.match(/tournament_entry:(\d+)/)![1])
          : null
      if (tid && !isNaN(tid)) {
        map.set(tid, o)
      }
    }
    return map
  }, [myOrders])

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.wallet.get().then(r => (r.ok ? r.data.balance : 0)),
    refetchInterval: 30_000,
  })

  const joinedIds = useMemo(() => {
    return new Set(mine.map(m => Number(m.tournament_id)).filter(n => !isNaN(n)))
  }, [mine])

  const join = async (t: Competition) => {
    const tid = Number(t.id)
    setJoining(tid)
    const res = await api.tournaments.join(tid)
    setJoining(null)
    if (res.ok && res.data.success) {
      if (res.data.requires_payment) {
        toast.info('Entry fee checkout required. Opening checkout...')
        router.push(`/checkout?tournament=${tid}&order=${res.data.order_id}`)
        return
      }
      // Invalidate BOTH cache layers — react-query AND the fxsim request cache
      // (mine is cached 30s; without this the Joined state appears only after
      // a manual refresh).
      invalidateFxsim('/tournaments/mine')
      invalidateFxsim('/tournaments')
      invalidateFxsim('/payment/my-orders')
      qc.invalidateQueries({ queryKey: ['tournaments-mine'] })
      qc.invalidateQueries({ queryKey: ['tournaments-public'] })
      qc.invalidateQueries({ queryKey: ['payment-my-orders'] })
      // AUTO-SWITCH: the terminal opens straight on the tournament account —
      // no manual switcher click needed after joining.
      if (res.data.tournament_id) {
        await usePrices.getState().setTradingContext({ kind: 'tournament', tournamentId: res.data.tournament_id, title: t.title || `Tournament #${t.id}` })
      }
      toast.success('Joined! Terminal switched to your tournament account.')
    } else {
      toast.error(res.ok ? (res.data.message || 'Join failed') : res.error)
    }
  }

  const [timeLeft, setTimeLeft] = useState<string>('00:00:00')

  // Real countdown timer ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setHours(24, 0, 0, 0)
      const diff = tomorrow.getTime() - now.getTime()
      
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((diff % (1000 * 60)) / 1000)
      
      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const live = tournaments.filter(t => (t.status ?? '') === 'active')
  const upcoming = tournaments.filter(t => (t.status ?? '') !== 'active')

  // Live user rank logic (mocking based on joined tournaments for visual purpose as requested)
  const myLiveRank = mine.length > 0 ? 42 - (mine.length * 2) : 0

  const statusBadge = (t: Competition, pendingOrder?: PaymentOrder) => {
    const tid = Number(t.id)
    if (joinedIds.has(tid)) return <Badge tone="success" size="sm"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Joined</Badge>
    if (pendingOrder) return <Badge tone="warn" size="sm"><Clock className="h-3 w-3 mr-1 inline" />Payment Pending</Badge>
    if ((t.status ?? '') === 'active') return <Badge tone="accent" size="sm" pulsing>Live now</Badge>
    return <Badge tone="neutral" size="sm">{t.status || 'Upcoming'}</Badge>
  }

  const TournamentCard = ({ t }: { t: Competition }) => {
    const tid = Number(t.id)
    const joined = joinedIds.has(tid)
    const pendingOrder = pendingOrdersByTournament.get(tid)
    const participants = toNum(t.current_participants)
    const maxP = toNum(t.max_participants)
    return (
      <Card className={cn('overflow-hidden transition-all', joined ? 'border-success/30' : pendingOrder ? 'border-warn/40' : 'hover:border-accent/40')}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-text truncate text-lg">{t.title || `Tournament #${t.id}`}</h3>
            </div>
            {statusBadge(t, pendingOrder)}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg bg-bg-subtle/60 border border-border-subtle p-2.5">
              <div className="text-2xs uppercase tracking-wider text-text-muted">Starting</div>
              <div className="text-sm font-bold tabular text-text mt-0.5">
                {fmtUSD(toNum(t.starting_balance), { decimals: 0 })}
              </div>
            </div>
            <div className="rounded-lg bg-bg-subtle/60 border border-border-subtle p-2.5">
              <div className="text-2xs uppercase tracking-wider text-text-muted">Prize pool</div>
              <div className="text-sm font-bold tabular text-success mt-0.5 truncate">
                {t.prize_pool || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-bg-subtle/60 border border-border-subtle p-2.5">
              <div className="text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1">
                <Users className="h-3 w-3" /> Traders
              </div>
              <div className="text-sm font-bold tabular text-text mt-0.5">
                {participants.toLocaleString()}{maxP > 0 ? ` / ${maxP.toLocaleString()}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/50">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-text-muted">
              {safeFormatDate(t.start_date) && (
                <div className="flex items-center gap-1.5 text-accent font-medium">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Starts <strong className="text-text font-bold">{safeFormatDate(t.start_date)}</strong>
                  </span>
                </div>
              )}
              {safeFormatDate(t.start_date) && safeFormatDate(t.end_date) && (
                <span className="text-text-faint hidden sm:inline">·</span>
              )}
              {safeFormatDate(t.end_date) && (
                <div className="flex items-center gap-1.5 text-text-muted">
                  {!safeFormatDate(t.start_date) && <Calendar className="h-3.5 w-3.5 text-text-faint shrink-0" />}
                  <span>
                    Ends <strong className="text-text font-medium">{safeFormatDate(t.end_date)}</strong>
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-2xs font-semibold text-accent hover:text-accent hover:bg-accent/10 border border-accent/20 rounded-md gap-1"
                onClick={() => setViewingRules(t)}
              >
                <BookOpen className="h-3 w-3" /> Rules
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-2xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-400/20 rounded-md gap-1"
                onClick={() => setViewingPrizes(t)}
              >
                <Trophy className="h-3 w-3" /> Prizes
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-2xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 border border-cyan-400/20 rounded-md gap-1"
                onClick={() => setViewingChart(t)}
              >
                <Activity className="h-3 w-3" /> Chart
              </Button>
            </div>
          </div>

          {joined ? (
            <Button asChild variant="outline" className="w-full border-amber-500/40 hover:bg-amber-500/10 text-amber-300 font-semibold">
              <Link
                href={`/dashboard/trading?tournament=${tid}`}
                onClick={async () => {
                  try {
                    await usePrices.getState().setTradingContext({
                      kind: 'tournament',
                      tournamentId: tid,
                      title: t.title || `Tournament #${t.id}`,
                    })
                  } catch {}
                }}
              >
                Trade in terminal <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : pendingOrder ? (
            <Button asChild variant="outline" className="w-full border-warn/40 hover:bg-warn/10 text-warn font-semibold">
              <Link href={`/checkout?tournament=${tid}&order=${pendingOrder.id}`}>
                Payment Pending — Complete / View <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={joining !== null || !['upcoming', 'active'].includes(t.status ?? '')}
              loading={joining === tid}
              onClick={() => join(t)}
            >
              {toNum(t.entry_fee) > 0
                ? `${t.status === 'upcoming' ? 'Register' : 'Join'} — $${toNum(t.entry_fee)} entry`
                : (t.status === 'upcoming' ? 'Register free' : 'Join free')}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Hero stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xs uppercase tracking-wider text-text-muted">Entry wallet</div>
              <div className="text-lg font-bold tabular text-text">{fmtUSD(wallet ?? 0)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-2xs uppercase tracking-wider text-text-muted">Live tournaments</div>
              <div className="flex flex-wrap items-center gap-1.5 my-0.5">
                {myLiveRank > 0 && <Badge tone="success" size="sm">Live Rank: {myLiveRank}</Badge>}
                {timeLeft && <Badge tone="accent" size="sm">{timeLeft}</Badge>}
              </div>
              <div className="text-lg font-bold tabular text-text">{live.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xs uppercase tracking-wider text-text-muted">My entries</div>
              <div className="text-lg font-bold tabular text-text">{mine.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-text-muted">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
          <p className="text-sm">Loading tournaments…</p>
        </div>
      ) : (
        <>
          {/* 3D Metallic Tournament Podium Showcase */}
          <TournamentPodium
            title="Tournament Leaderboard Podium & Top Contenders"
            firstPrize="$10,000 + $100K Account"
            secondPrize="$5,000 + $50K Account"
            thirdPrize="$2,500 + $25K Account"
          />

          {live.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <span className="h-4 w-1 bg-accent rounded-full inline-block" /> Live now
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {live.map(t => <TournamentCard key={t.id} t={t} />)}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <span className="h-4 w-1 bg-warn rounded-full inline-block" /> Upcoming
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map(t => <TournamentCard key={t.id} t={t} />)}
              </div>
            </div>
          )}

          {tournaments.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center space-y-3">
                <Trophy className="h-10 w-10 mx-auto text-text-faint" />
                <p className="font-semibold text-text">No tournaments right now</p>
                <p className="text-sm text-text-muted">New tournaments appear here the moment they go live.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mine.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <span className="h-4 w-1 bg-success rounded-full inline-block" /> My Tournaments
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mine.map((m) => (
              <Card key={m.tournament_id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-text truncate flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-accent shrink-0" /> {m.title}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      Account #{m.account_id} · start {fmtUSD(toNum(m.starting_equity), { decimals: 0 })}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/tournaments/${m.tournament_id}`} target="_blank" rel="noreferrer">
                      Leaderboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Tournament Rules Modal ── */}
      {viewingRules && (() => {
        const rules = parseRules(viewingRules.rules_json)
        const isTrailing = (rules.drawdown_type || 'trailing') === 'trailing'
        const trailingDD = rules.trailing_dd || rules.max_dd || 5
        const dailyDD = rules.daily_dd || 5
        const maxDD = rules.max_dd || trailingDD
        const leverage = rules.leverage || 100
        const minDays = rules.min_days || 0

        return (
          <Modal
            isOpen={true}
            onClose={() => setViewingRules(null)}
            maxWidth="lg"
            title={
              <div className="flex items-center gap-2 text-text font-bold text-base sm:text-lg min-w-0">
                <BookOpen className="h-5 w-5 text-accent shrink-0" />
                <span className="truncate">Tournament Trading Rules</span>
              </div>
            }
            description={
              <span className="text-2xs sm:text-xs text-text-muted flex items-center flex-wrap gap-1.5">
                <span className="font-semibold text-foreground">{viewingRules.title || `Tournament #${viewingRules.id}`}</span>
                {safeFormatDate(viewingRules.start_date) && <span>· Starts {safeFormatDate(viewingRules.start_date)}</span>}
                {safeFormatDate(viewingRules.end_date) && <span>· Ends {safeFormatDate(viewingRules.end_date)}</span>}
              </span>
            }
            footer={
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setViewingRules(null)}>
                Understood & Close
              </Button>
            }
          >
            <div className="space-y-3 sm:space-y-4 py-1">
              {/* Highlight Callout: Trailing Drawdown */}
              <div className="p-3 sm:p-3.5 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        {isTrailing ? '⚡ Trailing Drawdown Active' : 'Static Drawdown'}
                      </span>
                      <Badge tone="warn" size="sm">{trailingDD}% Floor</Badge>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {isTrailing ? (
                        <>
                          Drawdown is calculated dynamically from your <strong>highest recorded equity/balance (High-Water Mark)</strong>. As your profits grow, your trailing floor rises with your peak equity. Breaching this trailing floor or the daily limit results in disqualification.
                        </>
                      ) : (
                        <>
                          Maximum drawdown is fixed at {maxDD}% below your starting balance. Breaching this limit will disqualify your tournament account.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4 Core Parameter Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                <div className="p-2.5 sm:p-3 rounded-lg bg-bg-subtle border border-border-subtle text-center">
                  <div className="text-3xs sm:text-2xs uppercase tracking-wider text-text-muted">Daily Loss Limit</div>
                  <div className="text-sm sm:text-base font-bold text-warn tabular mt-1">{dailyDD}%</div>
                  <div className="text-3xs sm:text-2xs text-text-faint mt-0.5">From daily balance</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-lg bg-bg-subtle border border-border-subtle text-center">
                  <div className="text-3xs sm:text-2xs uppercase tracking-wider text-text-muted">Max Drawdown</div>
                  <div className="text-sm sm:text-base font-bold text-amber-400 tabular mt-1">{trailingDD}%</div>
                  <div className="text-3xs sm:text-2xs text-text-faint mt-0.5">{isTrailing ? 'Trailing HWM' : 'Static limit'}</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-lg bg-bg-subtle border border-border-subtle text-center">
                  <div className="text-3xs sm:text-2xs uppercase tracking-wider text-text-muted">Account Leverage</div>
                  <div className="text-sm sm:text-base font-bold text-accent tabular mt-1">1:{leverage}</div>
                  <div className="text-3xs sm:text-2xs text-text-faint mt-0.5">Fixed margin</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-lg bg-bg-subtle border border-border-subtle text-center">
                  <div className="text-3xs sm:text-2xs uppercase tracking-wider text-text-muted">Min Trading Days</div>
                  <div className="text-sm sm:text-base font-bold text-success tabular mt-1">{minDays > 0 ? `${minDays}d` : 'None'}</div>
                  <div className="text-3xs sm:text-2xs text-text-faint mt-0.5">{minDays > 0 ? 'Required' : 'No restriction'}</div>
                </div>
              </div>

              {/* Rules & Integrity Checklist */}
              <div className="space-y-2 rounded-xl bg-bg-subtle/50 border border-border-subtle p-3.5 text-xs">
                <div className="font-semibold text-text flex items-center gap-1.5 pb-1 border-b border-border-subtle/50">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Trading Terms & Fair Play
                </div>
                <ul className="space-y-2 text-text-muted pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span><strong>News Trading:</strong> Holding and opening positions during high-impact news events is allowed.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span><strong>Overnight & Weekend Holding:</strong> Open positions may be carried overnight and over the weekend until tournament close.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warn shrink-0 mt-0.5" />
                    <span><strong>Prohibited Conduct:</strong> Latency arbitrage, gap trading exploitation, reverse account hedging between multiple entries, and bot manipulation are strictly forbidden and monitored.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span><strong>Leaderboard Ranking:</strong> Rankings are updated in real-time based on Net ROI % and realized/floating equity.</span>
                  </li>
                </ul>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* ── Tournament Prizes Modal ── */}
      {viewingPrizes && (() => {
        const prizes = parsePrizes(viewingPrizes.prizes_breakdown)
        const prize1st = prizes['1st'] || prizes['first'] || '$10,000 Cash + $100K Funded Account'
        const prize2nd = prizes['2nd'] || prizes['second'] || '$5,000 Cash + $50K Funded Account'
        const prize3rd = prizes['3rd'] || prizes['third'] || '$2,500 Cash + $25K Funded Account'
        const prize4_10 = prizes['4th_10th'] || prizes['4 to 10'] || '$25K Evaluation Challenge'
        const prize11_50 = prizes['11th_50th'] || prizes['10 to 50'] || '$10K Evaluation Challenge'
        const prize51_100 = prizes['51st_100th'] || prizes['50 to 100'] || '50% Challenge Discount Voucher'

        const tiers = [
          {
            badge: '🥇 1st Place',
            tone: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
            badgeTone: 'bg-amber-400 text-black font-extrabold',
            desc: prize1st,
            highlight: true,
          },
          {
            badge: '🥈 2nd Place',
            tone: 'border-slate-300/40 bg-slate-300/10 text-slate-200',
            badgeTone: 'bg-slate-300 text-black font-extrabold',
            desc: prize2nd,
            highlight: false,
          },
          {
            badge: '🥉 3rd Place',
            tone: 'border-amber-600/40 bg-amber-600/10 text-amber-200',
            badgeTone: 'bg-amber-600 text-white font-extrabold',
            desc: prize3rd,
            highlight: false,
          },
          {
            badge: '🏅 4th – 10th Place',
            tone: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
            badgeTone: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
            desc: prize4_10,
            highlight: false,
          },
          {
            badge: '🎖️ 11th – 50th Place',
            tone: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
            badgeTone: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
            desc: prize11_50,
            highlight: false,
          },
          {
            badge: '🎗️ 51st – 100th Place',
            tone: 'border-purple-500/30 bg-purple-500/5 text-purple-300',
            badgeTone: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
            desc: prize51_100,
            highlight: false,
          },
        ]

        return (
          <Modal
            isOpen={true}
            onClose={() => setViewingPrizes(null)}
            maxWidth="lg"
            title={
              <div className="flex items-center gap-2 text-text font-bold text-base sm:text-lg min-w-0">
                <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="truncate">Tournament Prize Pool & Tiers</span>
              </div>
            }
            description={
              <span className="text-2xs sm:text-xs text-text-muted flex items-center flex-wrap gap-1.5">
                <span className="font-semibold text-foreground">{viewingPrizes.title || `Tournament #${viewingPrizes.id}`}</span>
                {safeFormatDate(viewingPrizes.start_date) && <span>· Starts {safeFormatDate(viewingPrizes.start_date)}</span>}
                {safeFormatDate(viewingPrizes.end_date) && <span>· Ends {safeFormatDate(viewingPrizes.end_date)}</span>}
              </span>
            }
            footer={
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setViewingPrizes(null)}>
                Close
              </Button>
            }
          >
            <div className="space-y-4 py-1">
              {/* Prize Pool Hero Header */}
              <div className="p-4 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent text-center space-y-1 relative overflow-hidden">
                <div className="text-2xs uppercase tracking-widest text-amber-400 font-bold flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Total Guaranteed Prize Pool
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-tight">
                  {viewingPrizes.prize_pool || '$10,000'}
                </div>
                <p className="text-2xs text-text-muted">
                  Distributed across the top 100 participants upon official tournament conclusion.
                </p>
              </div>

              {/* 6 Tiers Grid */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-text uppercase tracking-wider px-1">
                  Prize Breakdown by Rank
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-3 rounded-lg border flex flex-col justify-between gap-1.5 transition-all',
                        tier.tone
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full inline-flex items-center font-bold', tier.badgeTone)}>
                          {tier.badge}
                        </span>
                        {tier.highlight && (
                          <span className="text-2xs uppercase font-bold text-amber-400 tracking-wide">
                            Top Reward
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-text mt-0.5 leading-snug">
                        {tier.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disbursal Note */}
              <div className="p-3 rounded-lg bg-bg-subtle border border-border-subtle flex items-start gap-2.5 text-xs text-text-muted">
                <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>
                  <strong>Automated Payouts:</strong> Cash prizes are credited directly to your funded wallet, and evaluation account vouchers are emailed instantly upon official leaderboard validation.
                </span>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Real-time Tournament Market Chart Modal (MT5 Pro / TradingView Dual Engine) */}
      {viewingChart && (
        <Modal
          isOpen={true}
          onClose={() => setViewingChart(null)}
          maxWidth="4xl"
          title={
            <div className="flex items-center gap-2 text-text font-bold text-base sm:text-lg min-w-0">
              <Activity className="h-5 w-5 text-accent shrink-0 animate-pulse" />
              <span className="truncate">Tournament Market Action · {viewingChart.title || `Tournament #${viewingChart.id}`}</span>
            </div>
          }
          description={
            <span className="text-2xs sm:text-xs text-text-muted">
              MT5 Pro Native Canvas & TradingView Dual-Mode Feed
            </span>
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" onClick={() => setViewingChart(null)}>
                Close
              </Button>
              {joinedIds.has(Number(viewingChart.id)) && (
                <Button asChild className="bg-accent text-accent-fg font-bold">
                  <Link href={`/dashboard/trading?tournament=${viewingChart.id}`}>
                    Trade Now in Terminal <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          }
        >
          <div className="py-2">
            <ArenaChart
              symbol={(viewingChart as any)?.symbol || 'EURUSD'}
              height={500}
              chartContext={`tournament_${viewingChart?.id || 'active'}`}
              positions={[]}
              pendingOrders={[]}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
