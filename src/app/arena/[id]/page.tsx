'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Swords, Trophy, Flame, Zap, Clock, Users, DollarSign, 
  ShieldAlert, ShieldCheck, ArrowRight, ArrowLeft, Radio,
  Sparkles, RefreshCw, Award, Scale, CheckCircle2, ChevronRight,
  TrendingUp, TrendingDown, Send, MessageSquare, AlertTriangle,
  Play, StopCircle, RefreshCcw, XCircle, Shield
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import type { PvpLiveStateResponse } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'
import { TradingScreenLoader } from '@/components/ui/trading-loader'
import { ArenaChart } from '@/components/arena/arena-chart'

function formatMoney(val: number | string | undefined | null) {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PvpLiveBattleArenaPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const matchId = Number(params?.id)

  // Fast order execution deck state
  const [selectedLot, setSelectedLot] = useState<number>(1.0)
  const [chatMessage, setChatMessage] = useState('')
  const [sendingChat, setSendingChat] = useState(false)

  // Live query polling every 1.5 seconds for instant e-sports reaction
  const { data: liveState, isLoading, refetch } = useQuery<PvpLiveStateResponse>({
    queryKey: ['pvp-live-match', matchId],
    queryFn: async () => {
      const res = await api.pvp.live(matchId)
      if (!res.ok) throw new Error(res.error || 'Failed to fetch match live state.')
      return res.data
    },
    refetchInterval: 1500,
    enabled: !isNaN(matchId) && matchId > 0,
  })

  // Order Execution Mutation (BUY, SELL, CLOSE, REVERSE)
  const executeOrderMutation = useMutation({
    mutationFn: async (action: 'BUY' | 'SELL' | 'CLOSE' | 'REVERSE') => {
      const res = await api.pvp.order(matchId, { action, lot_size: selectedLot })
      if (!res.ok) throw new Error(res.error || 'Order failed.')
      return res.data
    },
    onSuccess: (data) => {
      if (data.action === 'CLOSE') {
        toast.success(`⏹️ Position Closed! (${data.tick_pnl >= 0 ? '+' : ''}$${data.tick_pnl.toFixed(2)} PnL)`)
      } else if (data.action === 'REVERSE') {
        toast.success(`🔄 Position Flipped! (${data.tick_pnl >= 0 ? '+' : ''}$${data.tick_pnl.toFixed(2)} PnL)`)
      } else {
        toast.success(`⚔️ ${data.action} ${data.lot_size} Lots executed! (${data.tick_pnl >= 0 ? '+' : ''}$${data.tick_pnl.toFixed(2)} PnL)`)
      }
      refetch()
    },
    onError: (err: any) => {
      toast.error('Execution Error: ' + err.message)
    },
  })

  // Manual Settlement Mutation
  const settleMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.pvp.settle(matchId)
      if (!res.ok) throw new Error(res.error || 'Settlement failed.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success('🏆 Match Settled! ' + data.message)
      refetch()
    },
    onError: (err: any) => {
      toast.error('Settlement Error: ' + err.message)
    },
  })

  // Cancel / Withdraw Mutation
  const cancelMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.pvp.cancel(matchId)
      if (!res.ok) throw new Error(res.error || 'Cancel failed.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success('🛡️ Match Cancelled! Stake refunded.')
      router.push('/arena')
    },
    onError: (err: any) => {
      toast.error('Cancel Error: ' + err.message)
    },
  })

  const match = liveState?.match
  const isCompleted = match?.status === 'completed'
  const isActive = match?.status === 'active'
  const isWaiting = match?.status === 'waiting'

  const user = useAuth((s) => s.user)
  const currentUserId = user?.id ? Number(user.id) : 0
  const isParticipant = currentUserId > 0 && (
    currentUserId === Number(match?.creator_user_id) || 
    currentUserId === Number(match?.challenger_user_id)
  )

  const creator = liveState?.creator || { name: 'Player 1', equity: 10000, pnl: 0, trades_count: 0, user_id: 1, position: null }
  const challenger = liveState?.challenger || { name: 'Waiting for Challenger...', equity: 10000, pnl: 0, trades_count: 0, user_id: 0, position: null }
  const secondsLeft = liveState?.seconds_remaining ?? 0
  const leadDelta = liveState?.lead_delta ?? 0

  // Participant's own position ticket
  const myPosition = useMemo(() => {
    if (!isParticipant) return null
    if (currentUserId === creator.user_id) return creator.position
    if (currentUserId === challenger.user_id) return challenger.position
    return null
  }, [isParticipant, currentUserId, creator.user_id, creator.position, challenger.user_id, challenger.position])

  // Weekend Market Status
  const isWeekendClosed = useMemo(() => {
    const sym = (match?.symbol || '').toUpperCase()
    const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL')
    if (isCrypto) return false
    const now = new Date()
    const d = now.getUTCDay()
    const h = now.getUTCHours()
    return d === 6 || (d === 0 && h < 22) || (d === 5 && h >= 22)
  }, [match?.symbol])

  // Dynamic Tug-of-War Momentum Calculation
  const { creatorPct, challengerPct } = useMemo(() => {
    const cPnl = creator.pnl || 0
    const chPnl = challenger.pnl || 0
    if (cPnl === 0 && chPnl === 0) {
      return { creatorPct: 50, challengerPct: 50 }
    }
    const diff = cPnl - chPnl
    // Scale diff to percentage: 0 diff = 50%, +/- $500 diff maxes at 85% / 15%
    const normalized = Math.max(-35, Math.min(35, (diff / 500) * 35))
    const cPct = Math.round(50 + normalized)
    return { creatorPct: cPct, challengerPct: 100 - cPct }
  }, [creator.pnl, challenger.pnl])

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    const msg = chatMessage.trim()
    if (!msg || !matchId) return
    setChatMessage('')
    try {
      setSendingChat(true)
      const res = await api.pvp.chat(matchId, msg)
      if (res.ok && res.data.success) {
        refetch()
      } else {
        toast.error((!res.ok ? res.error : res.data.message) || 'Failed to broadcast stadium chat.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to broadcast stadium chat.')
    } finally {
      setSendingChat(false)
    }
  }

  const LOT_BUTTONS = [0.5, 1.0, 2.0, 5.0]

  if (isLoading && !liveState) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
        <TradingScreenLoader
          fullscreen={false}
          label="Connecting to 1v1 Battle Arena"
          subtitle="Loading gladiator telemetry, live order deck, and tick stream..."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      
      {/* ── 1. COMPACT TOP COMMAND BAR ────────────────────────────────────── */}
      <header className="border-b border-border bg-surface/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            href="/arena"
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors bg-surface-muted px-2.5 py-1.5 rounded-lg border border-border"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Arena</span> Lobby
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <span className="tabular text-xs font-bold text-text flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5 text-red-500" />
            {match?.match_code || 'PVP-MATCH'}
          </span>
          <Badge tone="accent" size="sm" className="tabular font-semibold text-[10px] px-2 py-0.5">
            {match?.symbol || 'BTCUSD'}
          </Badge>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <Radio className="h-2.5 w-2.5 animate-pulse" />
            24/7 Live Feed
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tabular uppercase bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse">
              <Flame className="h-3 w-3 text-red-500" />
              1v1 In Progress
            </span>
          )}
          {isWaiting && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tabular uppercase bg-amber-500/20 text-amber-500 border border-amber-500/40">
              <Clock className="h-3 w-3 text-amber-500" />
              Waiting Challenger
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tabular uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/40">
              <Trophy className="h-3 w-3 text-emerald-500" />
              Concluded
            </span>
          )}

          {/* Countdown Clock */}
          <div className="bg-surface-muted border border-border px-3 py-1 rounded-lg flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-text-muted" />
            <span className={`text-sm font-black tabular ${
              secondsLeft <= 60 && isActive ? 'text-red-500 animate-ping' : 'text-cyan-500 dark:text-cyan-400'
            }`}>
              {isActive ? formatTimer(secondsLeft) : isWaiting ? `${match?.duration_minutes}:00` : '00:00'}
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="border-border text-text-muted hover:text-text hover:bg-surface-muted h-8 px-2.5 gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5 text-red-500" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* ── 2. WIDESCREEN UNIFIED 2-COLUMN ARENA TERMINAL (ZERO VERTICAL SCROLL) ── */}
      <main className="w-full max-w-[1720px] mx-auto p-3 sm:p-5 grid grid-cols-1 xl:grid-cols-12 gap-5 flex-1 items-start">
        
        {/* ── LEFT COLUMN (65% Width): INSTITUTIONAL CANDLESTICK CHART & MARKET STATS ── */}
        <div className="xl:col-span-8 flex flex-col gap-3">
          
          {/* Symbol Market Ticker Header */}
          <div className="bg-surface border border-border rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-text tracking-tight">{match?.symbol || 'BTCUSD'}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-muted text-text-muted border border-border">
                  5M Candlesticks
                </span>
              </div>
              <div className="h-3.5 w-[1px] bg-border hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2 text-xs tabular">
                <span className="text-text-muted">Ask:</span>
                <span className="font-bold text-emerald-500">
                  {liveState?.prices?.ask ? liveState.prices.ask.toFixed(match?.symbol?.includes('BTC') ? 2 : 4) : '---'}
                </span>
                <span className="text-text-muted ml-2">Bid:</span>
                <span className="font-bold text-red-500">
                  {liveState?.prices?.bid ? liveState.prices.bid.toFixed(match?.symbol?.includes('BTC') ? 2 : 4) : '---'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs tabular">
              <div className="text-right">
                <span className="text-[10px] uppercase text-text-muted block leading-none">Prize Pool</span>
                <span className="font-extrabold text-amber-500">{formatMoney(match?.prize_pool)} USDC</span>
              </div>
              <div className="h-4 w-[1px] bg-border" />
              <div className="text-right">
                <span className="text-[10px] uppercase text-text-muted block leading-none">Stake Each</span>
                <span className="font-bold text-text">{formatMoney(match?.stake_amount)} USDC</span>
              </div>
            </div>
          </div>

          {/* Real-time Candlestick Chart (Full Institutional Height) */}
          <div className="w-full">
            <ArenaChart 
              symbol={match?.symbol || 'BTCUSD'} 
              currentPrice={liveState?.prices?.ask} 
              height={580} 
            />
          </div>

          {/* Under-Chart Quick Battle Information */}
          <div className="bg-surface-muted/50 border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Provably Fair E-Sports Engine • 15% Platform Rake Retained • 85% Winner Payout</span>
            </div>
            <div className="tabular font-medium flex items-center gap-4">
              <span>Duration: <strong className="text-text">{match?.duration_minutes} Minutes</strong></span>
              <span>Symbol: <strong className="text-text">{match?.symbol}</strong></span>
              {isActive && (isParticipant || user?.is_admin || (user as any)?.role === 'administrator') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => settleMatchMutation.mutate()}
                  loading={settleMatchMutation.isPending}
                  className="h-7 text-[11px] text-red-500 hover:bg-red-500/10 px-2"
                >
                  <StopCircle className="h-3 w-3 mr-1" />
                  Conclude Duel
                </Button>
              )}
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN (35% Width): THE GLADIATOR COMBAT HUD & ORDER DECK ── */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          
          {/* 1. FIGHTER HEAD-TO-HEAD STATUS CARDS */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Blue Corner (Creator) */}
            <div className="bg-surface border border-blue-500/30 p-3.5 rounded-xl relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 dark:text-blue-400 text-[9px] font-extrabold uppercase">
                  Blue Corner (P1)
                </span>
                <span className="text-[11px] font-bold tabular text-blue-500">
                  {creator.trades_count} Orders
                </span>
              </div>
              <div className="font-bold text-sm text-text truncate mt-1">
                {creator.name}
              </div>
              <div className="mt-2 pt-2 border-t border-border flex items-baseline justify-between">
                <div className="text-xs text-text-muted tabular">
                  {formatMoney(creator.equity)}
                </div>
                <div className={`text-xs font-black tabular ${
                  creator.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {creator.pnl >= 0 ? '+' : ''}{formatMoney(creator.pnl)}
                </div>
              </div>
            </div>

            {/* Red Corner (Challenger) */}
            <div className="bg-surface border border-amber-500/30 p-3.5 rounded-xl relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold uppercase">
                  Red Corner (P2)
                </span>
                <span className="text-[11px] font-bold tabular text-amber-500">
                  {challenger.trades_count} Orders
                </span>
              </div>
              <div className="font-bold text-sm text-text truncate mt-1">
                {challenger.name}
              </div>
              <div className="mt-2 pt-2 border-t border-border flex items-baseline justify-between">
                <div className="text-xs text-text-muted tabular">
                  {formatMoney(challenger.equity)}
                </div>
                <div className={`text-xs font-black tabular ${
                  challenger.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {challenger.pnl >= 0 ? '+' : ''}{formatMoney(challenger.pnl)}
                </div>
              </div>
            </div>

          </div>

          {/* 2. DYNAMIC TUG-OF-WAR MOMENTUM BAR */}
          <div className="bg-surface border border-border rounded-xl p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold tabular">
              <span className="text-blue-500 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {creator.name} ({creatorPct}%)
              </span>
              <span className="text-text-muted text-[11px] flex items-center gap-1">
                <Swords className="h-3 w-3 text-red-500" />
                {leadDelta > 0 
                  ? `Blue +${formatMoney(leadDelta)}`
                  : leadDelta < 0 
                  ? `Red +${formatMoney(Math.abs(leadDelta))}`
                  : 'Dead Heat 50/50'}
              </span>
              <span className="text-amber-500 flex items-center gap-1">
                ({challengerPct}%) {challenger.name}
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </span>
            </div>

            {/* Split Progress Track */}
            <div className="h-3 w-full rounded-full bg-surface-muted overflow-hidden flex border border-border">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" 
                style={{ width: `${creatorPct}%` }}
              />
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500" 
                style={{ width: `${challengerPct}%` }}
              />
            </div>
          </div>

          {/* 3. ACTIVE OPEN POSITION TICKET (INSTITUTIONAL TICKET WITH 1-CLICK CLOSE & REVERSE) */}
          {isParticipant && (
            <div className="bg-surface border border-border rounded-xl p-3.5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-text uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5 text-cyan-500" />
                  Your Active Battle Ticket
                </div>
                {myPosition && myPosition.direction && myPosition.direction !== 'flat' ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    myPosition.direction === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                      : 'bg-red-500/20 text-red-500 border border-red-500/40'
                  }`}>
                    {myPosition.direction.toUpperCase()} {myPosition.lot_size}L
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-muted text-text-muted border border-border">
                    FLAT (No Open Orders)
                  </span>
                )}
              </div>

              {myPosition && myPosition.direction && myPosition.direction !== 'flat' ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 bg-surface-muted p-2.5 rounded-lg text-xs tabular">
                    <div>
                      <div className="text-[10px] text-text-muted uppercase">Entry Price</div>
                      <div className="font-bold text-text mt-0.5">
                        {myPosition.open_price.toFixed(match?.symbol?.includes('BTC') ? 2 : 4)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-text-muted uppercase">Floating PnL</div>
                      <div className={`font-black text-sm mt-0.5 ${
                        myPosition.floating_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {myPosition.floating_pnl >= 0 ? '+' : ''}{formatMoney(myPosition.floating_pnl)}
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Close and Reverse Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isActive || executeOrderMutation.isPending}
                      loading={executeOrderMutation.isPending}
                      onClick={() => executeOrderMutation.mutate('CLOSE')}
                      className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs h-8 font-bold gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Close Position
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isActive || executeOrderMutation.isPending}
                      loading={executeOrderMutation.isPending}
                      onClick={() => executeOrderMutation.mutate('REVERSE')}
                      className="border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 text-xs h-8 font-bold gap-1"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Reverse Position
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-text-muted bg-surface-muted/50 p-2.5 rounded-lg border border-border">
                  You have no active position open. Select lot size below and click BUY or SELL to strike!
                </div>
              )}
            </div>
          )}

          {/* 4. FAST ORDER EXECUTION DECK */}
          <Card className="bg-surface border border-border overflow-hidden shadow-sm">
            <CardHeader className="py-2.5 px-4 bg-surface-muted/70 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Order Execution Deck
                </CardTitle>
                <span className="text-[10px] text-text-muted uppercase tabular">
                  Sub-ms Fill Latency
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3">
              
              {/* Lot Selector Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-text">
                  <span>Lot Size</span>
                  <span className="text-text-muted tabular">{selectedLot.toFixed(1)} Lots selected</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {LOT_BUTTONS.map((lot) => (
                    <button
                      key={lot}
                      type="button"
                      onClick={() => setSelectedLot(lot)}
                      className={`py-1.5 rounded-lg tabular text-xs font-bold border transition-all ${
                        selectedLot === lot
                          ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-600/30'
                          : 'bg-surface-muted text-text-muted border-border hover:text-text'
                      }`}
                    >
                      {lot.toFixed(1)}L
                    </button>
                  ))}
                </div>
              </div>

              {/* Participant Trading vs Spectator Suite */}
              {!isParticipant ? (
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-500">
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    <span>Spectator & Referee Observation Suite</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Viewing battle live. Order executions are reserved for matched gladiators ({creator.name} vs {challenger.name}).
                  </p>
                </div>
              ) : (
                <>
                  {/* Weekend Closed Warning */}
                  {isWeekendClosed && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <div>{match?.symbol} is closed for weekend trading. Weekend duels require BTCUSD.</div>
                    </div>
                  )}

                  {/* High-Speed Buy & Sell Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Button
                      size="lg"
                      disabled={!isActive || isWeekendClosed || executeOrderMutation.isPending}
                      loading={executeOrderMutation.isPending}
                      onClick={() => executeOrderMutation.mutate('BUY')}
                      className="h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-black text-sm gap-1.5 shadow-md shadow-emerald-500/20 border border-emerald-400/40"
                    >
                      <TrendingUp className="h-4 w-4" />
                      BUY ({selectedLot}L)
                    </Button>

                    <Button
                      size="lg"
                      disabled={!isActive || isWeekendClosed || executeOrderMutation.isPending}
                      loading={executeOrderMutation.isPending}
                      onClick={() => executeOrderMutation.mutate('SELL')}
                      className="h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-black text-sm gap-1.5 shadow-md shadow-red-500/20 border border-red-400/40"
                    >
                      <TrendingDown className="h-4 w-4" />
                      SELL ({selectedLot}L)
                    </Button>
                  </div>

                  {/* Creator Cancel / Withdraw Button if Waiting */}
                  {isWaiting && currentUserId === Number(match?.creator_user_id) && (
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-[11px] text-text-muted">Awaiting opponent...</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelMatchMutation.mutate()}
                        loading={cancelMatchMutation.isPending}
                        className="text-xs h-7 px-2.5"
                      >
                        Withdraw Challenge
                      </Button>
                    </div>
                  )}
                </>
              )}

            </CardContent>
          </Card>

          {/* 5. LIVE STADIUM BANTER & EVENT FEED */}
          <Card className="bg-surface border border-border flex flex-col h-[260px] shadow-sm">
            <CardHeader className="py-2 px-4 bg-surface-muted/70 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-text flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-cyan-500" />
                  Stadium Banter & Action Log
                </CardTitle>
                <span className="text-[10px] text-text-muted tabular">Live Feed</span>
              </div>
            </CardHeader>

            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2 text-xs">
              {(Array.isArray(liveState?.events) ? liveState.events : []).map((ev) => {
                let author = (ev as any).author_name
                if (!author && (ev as any).payload) {
                  try { author = JSON.parse((ev as any).payload)?.author_name } catch {}
                }
                const isChat = ev.event_type === 'chat'
                const isSettled = ev.event_type === 'match_settled'
                const isStarted = ev.event_type === 'battle_started'

                return (
                  <div 
                    key={ev.id}
                    className={`p-2 rounded-lg border text-[11px] ${
                      isSettled 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300 font-bold'
                        : isStarted
                        ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-300 font-bold'
                        : isChat
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-200'
                        : 'bg-surface-muted/60 border-border text-text'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] text-text-muted mb-0.5">
                      <span className="font-semibold text-text">{isChat ? (author || 'Gladiator') : ev.event_type}</span>
                      <span>{ev.created_at?.substring(11, 19)}</span>
                    </div>
                    <div>{ev.message}</div>
                  </div>
                )
              })}
            </CardContent>

            <CardFooter className="p-2 bg-surface-muted/50 border-t border-border shrink-0">
              <form onSubmit={handleSendChat} className="flex gap-1.5 w-full">
                <Input
                  placeholder="Send banter in stadium..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="bg-surface border-border text-text text-xs h-8 font-sans"
                />
                <Button type="submit" size="sm" loading={sendingChat} className="bg-red-600 hover:bg-red-700 h-8 px-2.5">
                  <Send className="h-3 w-3" />
                </Button>
              </form>
            </CardFooter>
          </Card>

        </div>

      </main>

      {/* ── 3. VICTORY / CONCLUSION OVERLAY WHEN COMPLETED ─────────────────── */}
      {isCompleted && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-surface border border-amber-500/50 p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            {match?.winner_name ? (
              <>
                <Trophy className="h-16 w-16 text-amber-500 mx-auto animate-bounce" />
                <div className="space-y-1.5">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 uppercase">
                    Duel Concluded • 85% Prize Awarded
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-text mt-2">
                    Winner: {match.winner_name} 🏆
                  </h2>
                  <p className="text-xs text-text-muted">
                    Payout of <strong className="text-amber-500 font-extrabold">{formatMoney(match?.prize_pool)} USDC</strong> credited to gladiator wallet.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Scale className="h-16 w-16 text-amber-500 mx-auto" />
                <div className="space-y-1.5">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 uppercase">
                    Duel Concluded • Match Tied
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-text mt-2">
                    Honorable Draw 🤝
                  </h2>
                  <p className="text-xs text-text-muted">
                    Both gladiators fought to a dead heat. Stakes of <strong className="text-text font-extrabold">{formatMoney(match?.stake_amount)} USDC</strong> refunded in full with 0% rake.
                  </p>
                </div>
              </>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <Link href="/arena" className="w-full">
                <Button className="w-full bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-700 hover:to-red-700 text-white font-extrabold py-2.5">
                  Return to Arena Lobby
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}
