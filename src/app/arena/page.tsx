'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Swords, Trophy, Flame, Zap, Clock, Users, DollarSign, 
  ShieldAlert, ShieldCheck, ArrowRight, Plus, Eye, Radio,
  Sparkles, RefreshCw, Award, Scale, CheckCircle2, ChevronRight,
  TrendingUp, Activity, Wallet, Gift, ArrowDownToLine, ArrowUpFromLine,
  Layers, Check, Copy, AlertCircle, Shield, CircleDollarSign
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { 
  PvpMatch, PvpLobbyResponse, PvpLeaderboardEntry, 
  PvpArenaWallet, TraderPerk, PvpLeaguePodiumResponse, ChallengeAccount 
} from '@/types/api'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import { useAuth } from '@/store/auth'

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

export default function PvpArenaLobbyPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)
  const currentUserId = user?.id ? Number(user.id) : 0

  // Mode & Filter State
  const [arenaMode, setArenaMode] = useState<'all' | 'league' | 'cash' | 'perk'>('all')
  const [filterTab, setFilterTab] = useState<'all' | 'waiting' | 'active' | 'completed'>('all')

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [isPerksModalOpen, setIsPerksModalOpen] = useState(false)

  // Wallet Form State
  const [depositAmount, setDepositAmount] = useState<number>(50)
  const [withdrawAmount, setWithdrawAmount] = useState<number>(50)
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [selectedPerkAccount, setSelectedPerkAccount] = useState<number>(0)

  // Weekend Market Gate
  const isWeekend = useMemo(() => {
    const d = new Date().getUTCDay()
    const h = new Date().getUTCHours()
    return d === 6 || (d === 0 && h < 22) || (d === 5 && h >= 22)
  }, [])

  // Create Battle Form State
  const [createForm, setCreateForm] = useState<{
    symbol: string;
    arena_mode: 'league' | 'cash' | 'perk';
    perk_reward: 'FREE_RETRY' | 'DRAWDOWN_BUFFER_1PCT' | 'CHALLENGE_50PCT_OFF';
    stake_amount: number;
    duration_minutes: number;
    title: string;
  }>({
    symbol: 'BTCUSD',
    arena_mode: 'league',
    perk_reward: 'FREE_RETRY',
    stake_amount: 50,
    duration_minutes: 15,
    title: '',
  })

  // Queries
  const { data: lobbyData, isLoading, refetch: refetchLobby } = useQuery<PvpLobbyResponse>({
    queryKey: ['pvp-lobby-data', arenaMode],
    queryFn: async () => {
      const res = await api.pvp.lobby(arenaMode === 'all' ? undefined : arenaMode)
      if (!res.ok) throw new Error(res.error || 'Failed to fetch arena lobby.')
      return res.data
    },
    refetchInterval: 5000,
  })

  const { data: walletData, refetch: refetchWallet } = useQuery<PvpArenaWallet>({
    queryKey: ['pvp-arena-wallet'],
    queryFn: async () => {
      const res = await api.pvp.wallet()
      if (!res.ok) throw new Error(res.error || 'Failed to fetch arena wallet.')
      return res.data
    },
    enabled: !!user,
  })

  const { data: perksData, refetch: refetchPerks } = useQuery<{ success: boolean; perks: TraderPerk[] }>({
    queryKey: ['pvp-user-perks'],
    queryFn: async () => {
      const res = await api.pvp.perks()
      if (!res.ok) throw new Error(res.error || 'Failed to fetch perks.')
      return res.data
    },
    enabled: !!user,
  })

  const { data: podiumData } = useQuery<PvpLeaguePodiumResponse>({
    queryKey: ['pvp-league-podium'],
    queryFn: async () => {
      const res = await api.pvp.podium()
      if (!res.ok) throw new Error(res.error || 'Failed to fetch league podium.')
      return res.data
    },
    staleTime: 60000,
  })

  const { data: challengeAccounts } = useQuery<ChallengeAccount[]>({
    queryKey: ['user-challenge-accounts'],
    queryFn: async () => {
      const res = await api.challengeMy()
      if (!res.ok) return []
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!user && isPerksModalOpen,
  })

  // Mutations
  const createMatchMutation = useMutation({
    mutationFn: async (payload: typeof createForm) => {
      const res = await api.pvp.create(payload)
      if (!res.ok) throw new Error(res.error || 'Failed to create battle arena.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success('⚔️ Arena Battle Created! Waiting for challenger.')
      setIsCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['pvp-lobby-data'] })
      queryClient.invalidateQueries({ queryKey: ['pvp-arena-wallet'] })
      router.push(`/arena/${data.match_id}`)
    },
    onError: (err: any) => {
      toast.error('Arena Error: ' + err.message)
    },
  })

  const joinMatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.pvp.join(id)
      if (!res.ok) throw new Error(res.error || 'Failed to join battle arena.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success('🔥 CHALLENGE ACCEPTED! Entering the 1v1 Arena...')
      queryClient.invalidateQueries({ queryKey: ['pvp-lobby-data'] })
      queryClient.invalidateQueries({ queryKey: ['pvp-arena-wallet'] })
      router.push(`/arena/${data.match_id}`)
    },
    onError: (err: any) => {
      toast.error('Join Error: ' + err.message)
    },
  })

  const cancelMatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.pvp.cancel(id)
      if (!res.ok) throw new Error(res.error || 'Failed to cancel match.')
      return res.data
    },
    onSuccess: () => {
      toast.success('🛡️ Match cancelled and escrow refunded.')
      queryClient.invalidateQueries({ queryKey: ['pvp-lobby-data'] })
      queryClient.invalidateQueries({ queryKey: ['pvp-arena-wallet'] })
    },
    onError: (err: any) => {
      toast.error('Cancel Error: ' + err.message)
    },
  })

  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await api.pvp.deposit(amount)
      if (!res.ok) throw new Error(res.error || 'Deposit failed.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`💳 Deposited $${depositAmount.toFixed(2)} USDC into Arena Cash Wallet!`)
      setIsDepositModalOpen(false)
      refetchWallet()
      refetchLobby()
    },
    onError: (err: any) => {
      toast.error('Deposit Error: ' + err.message)
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, address }: { amount: number; address: string }) => {
      const res = await api.pvp.withdraw(amount, address)
      if (!res.ok) throw new Error(res.error || 'Withdrawal failed.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`💸 Withdrawn $${withdrawAmount.toFixed(2)} USDC from Arena Wallet!`)
      setIsWithdrawModalOpen(false)
      setWithdrawAddress('')
      refetchWallet()
      refetchLobby()
    },
    onError: (err: any) => {
      toast.error('Withdrawal Error: ' + err.message)
    },
  })

  const applyPerkMutation = useMutation({
    mutationFn: async ({ perkId, accountId }: { perkId: number; accountId?: number }) => {
      const res = await api.pvp.applyPerk(perkId, accountId)
      if (!res.ok) throw new Error(res.error || 'Failed to apply perk.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success('🎉 ' + data.message)
      refetchPerks()
      refetchLobby()
    },
    onError: (err: any) => {
      toast.error('Perk Error: ' + err.message)
    },
  })

  const allMatches: PvpMatch[] = useMemo(() => {
    if (!lobbyData) return []
    const w = lobbyData.waiting || []
    const a = lobbyData.active || []
    const c = lobbyData.completed || []
    return [...a, ...w, ...c]
  }, [lobbyData])

  const filteredMatches = useMemo(() => {
    if (filterTab === 'waiting') return lobbyData?.waiting || []
    if (filterTab === 'active') return lobbyData?.active || []
    if (filterTab === 'completed') return lobbyData?.completed || []
    return allMatches
  }, [filterTab, lobbyData, allMatches])

  const stats = lobbyData?.stats || {
    total_staked: 0,
    total_rake: 0,
    total_matches: 0,
    active_count: 0,
    waiting_count: 0,
  }

  const SYMBOLS = ['EURUSD', 'XAUUSD', 'BTCUSD', 'US30', 'NAS100']
  const CASH_STAKE_OPTIONS = [10, 25, 50, 100, 250, 500]
  const CHIP_STAKE_OPTIONS = [50, 100, 250, 500, 1000]
  const DURATION_OPTIONS = [
    { label: '5 Mins', val: 5, desc: 'Hyper-Turbo' },
    { label: '15 Mins', val: 15, desc: 'Fast Sprint' },
    { label: '30 Mins', val: 30, desc: 'Standard Duel' },
    { label: '60 Mins', val: 60, desc: 'Endurance Clash' },
  ]

  const practiceChips = lobbyData?.practice_balance ?? 1000
  const cashBalance = walletData?.balance ?? lobbyData?.cash_balance ?? 0
  const availablePerksCount = (perksData?.perks || []).filter(p => p.status === 'available').length

  const getPerkName = (type: string) => {
    switch (type) {
      case 'FREE_RETRY': return 'Free Challenge Retry Voucher'
      case 'DRAWDOWN_BUFFER_1PCT': return '+1.0% Max Drawdown Buffer'
      case 'CHALLENGE_50PCT_OFF': return '50% Off Challenge Coupon'
      default: return 'Challenge Perk Token'
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text pb-24">
      
      {/* ── STADIUM HERO SECTION ───────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-gradient-to-b from-red-500/10 via-purple-500/5 to-transparent py-10 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto space-y-6">
          
          {/* Header Title & Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tabular uppercase tracking-wider bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse">
                  <Flame className="h-3.5 w-3.5 text-red-500" />
                  E-Sports Trading Stadium
                </span>
                <span className="text-xs text-text-muted font-medium">
                  • 3 Battle Modes: League · Cash · Challenge Perks
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-text flex items-center gap-3">
                PvP Trading Arena
                <Swords className="h-8 w-8 sm:h-10 sm:w-10 text-red-500" />
              </h1>

              <p className="text-sm sm:text-base text-text-muted max-w-2xl leading-relaxed">
                Duel traders head-to-head in real-time execution sprints. Play free practice league for weekly challenge funding, wager real USDC cash duels, or win powerful perks for active challenges.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                size="lg"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold gap-2 px-6 h-12 shadow-lg shadow-red-600/30 border border-red-400/30 transition-all transform hover:scale-105"
              >
                <Plus className="h-5 w-5" />
                Create 1v1 Battle
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  refetchLobby()
                  refetchWallet()
                  refetchPerks()
                  toast.success('Arena data refreshed')
                }}
                className="border-border text-text-muted hover:text-text hover:bg-surface-muted gap-2 h-12"
              >
                <RefreshCw className="h-4 w-4 text-red-500" />
                Live Refresh
              </Button>
            </div>
          </div>

          {/* ── USER TRADER RESOURCE BAR (CHIPS, WALLET, PERKS) ────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3 rounded-2xl bg-surface/80 backdrop-blur-md border border-border shadow-md">
            
            {/* 1. Free Gladiator Chips */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center">
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Free Practice Chips</div>
                  <div className="text-lg font-black tabular text-blue-500 dark:text-blue-400">
                    {practiceChips.toLocaleString()} Chips
                  </div>
                </div>
              </div>
              <Badge tone="info" size="sm" className="text-[10px]">
                Daily Refill
              </Badge>
            </div>

            {/* 2. Real Cash Arena Wallet */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Arena Cash Wallet (USDC)</div>
                  <div className="text-lg font-black tabular text-emerald-500 dark:text-emerald-400">
                    {formatMoney(cashBalance)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsDepositModalOpen(true)}
                  className="h-7 text-xs px-2.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <ArrowDownToLine className="h-3 w-3 mr-1" /> Deposit
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="h-7 text-xs px-2.5 border-border text-text-muted hover:text-text"
                >
                  <ArrowUpFromLine className="h-3 w-3 mr-1" /> Withdraw
                </Button>
              </div>
            </div>

            {/* 3. Trader Perks Inventory */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Challenge Perks</div>
                  <div className="text-lg font-black tabular text-purple-500 dark:text-purple-400">
                    {availablePerksCount} Available
                  </div>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsPerksModalOpen(true)}
                className="h-7 text-xs px-3 border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
              >
                <Layers className="h-3 w-3 mr-1" /> View Perks
              </Button>
            </div>

          </div>

          {/* ── 3 ARENA MODE SELECTOR TABS ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
            
            <button
              onClick={() => setArenaMode('all')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                arenaMode === 'all'
                  ? 'bg-surface border-red-500 shadow-md shadow-red-500/10 ring-1 ring-red-500'
                  : 'bg-surface/50 border-border text-text-muted hover:bg-surface hover:text-text'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs sm:text-sm text-text">All Arenas</span>
                <Swords className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-[11px] text-text-muted mt-1">Unified view of all duel types</p>
            </button>

            <button
              onClick={() => setArenaMode('league')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                arenaMode === 'league'
                  ? 'bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                  : 'bg-surface/50 border-border text-text-muted hover:bg-surface hover:text-text'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs sm:text-sm text-blue-500 dark:text-blue-400 flex items-center gap-1.5">
                  <Shield className="h-4 w-4" /> Mode 1: Gladiator League
                </span>
                <Badge tone="info" size="sm" className="text-[9px]">100% Free</Badge>
              </div>
              <p className="text-[11px] text-text-muted mt-1">Free Chips • Win $25K Challenge</p>
            </button>

            <button
              onClick={() => setArenaMode('cash')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                arenaMode === 'cash'
                  ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500'
                  : 'bg-surface/50 border-border text-text-muted hover:bg-surface hover:text-text'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs sm:text-sm text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Mode 2: Cash Duels
                </span>
                <Badge tone="success" size="sm" className="text-[9px]">USDC</Badge>
              </div>
              <p className="text-[11px] text-text-muted mt-1">$10-$100 • 85% Winner Payout</p>
            </button>

            <button
              onClick={() => setArenaMode('perk')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                arenaMode === 'perk'
                  ? 'bg-purple-500/10 border-purple-500 shadow-md shadow-purple-500/10 ring-1 ring-purple-500'
                  : 'bg-surface/50 border-border text-text-muted hover:bg-surface hover:text-text'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs sm:text-sm text-purple-500 dark:text-purple-400 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" /> Mode 3: Perk Battles
                </span>
                <Badge tone="accent" size="sm" className="text-[9px]">Prop Perks</Badge>
              </div>
              <p className="text-[11px] text-text-muted mt-1">Win Free Retries & +1% Buffers</p>
            </button>

          </div>

          {/* 4 Arena Telemetry Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-muted font-semibold uppercase tracking-wider">
                <span>Active Duels</span>
                <Radio className="h-3.5 w-3.5 text-red-500 animate-ping" />
              </div>
              <div className="text-2xl font-black tabular text-text mt-1">
                {stats.active_count} LIVE
              </div>
              <div className="text-[11px] text-text-muted mt-1">Real-time spectator rooms</div>
            </div>

            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-muted font-semibold uppercase tracking-wider">
                <span>Duel Volume</span>
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-black tabular text-emerald-600 dark:text-emerald-400 mt-1">
                {formatMoney(stats.total_staked)}
              </div>
              <div className="text-[11px] text-text-muted mt-1">Cumulative stake turnover</div>
            </div>

            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-muted font-semibold uppercase tracking-wider">
                <span>Winner Payout</span>
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-black tabular text-amber-600 dark:text-amber-400 mt-1">
                85% Winner
              </div>
              <div className="text-[11px] text-text-muted mt-1">15% platform escrow rake</div>
            </div>

            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-muted font-semibold uppercase tracking-wider">
                <span>Matches Settled</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <div className="text-2xl font-black tabular text-purple-600 dark:text-purple-400 mt-1">
                {stats.total_matches} Duels
              </div>
              <div className="text-[11px] text-text-muted mt-1">100% automated payouts</div>
            </div>

          </div>

        </div>
      </section>

      {/* ── ARENA LOBBY MAIN CONTENT ───────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-10">
        
        {/* Weekly League Rewards Podium Showcase (Mode 1 Highlight) */}
        {(arenaMode === 'all' || arenaMode === 'league') && (
          <div className="bg-gradient-to-r from-blue-950/30 via-surface to-purple-950/20 border border-blue-500/30 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="info" size="sm">Free League Podium</Badge>
                  <span className="text-xs text-text-muted font-bold">Week #{podiumData?.week_number || 38}</span>
                </div>
                <h2 className="text-lg font-black text-text mt-1 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Weekly Free Gladiator League Rewards
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Top 3 gladiators with highest wins each week receive 100% free evaluation funded accounts!
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateForm(prev => ({ ...prev, arena_mode: 'league', stake_amount: 50 }))
                    setIsCreateModalOpen(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs px-3.5"
                >
                  <Swords className="h-3.5 w-3.5 mr-1.5" /> Fight in League
                </Button>
              </div>
            </div>

            {/* 3 Tier Podium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* #1 Champion */}
              <div className="bg-surface/80 border border-amber-500/40 rounded-xl p-4 flex items-center gap-3 relative overflow-hidden">
                <div className="text-3xl font-black text-amber-500 shrink-0">🥇</div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="text-[11px] uppercase font-bold text-amber-500">1st Place Prize</div>
                  <div className="text-sm font-extrabold text-text truncate">
                    {podiumData?.podium?.[0]?.name ? `${podiumData.podium[0].name} (${podiumData.podium[0].wins}W)` : 'Free $25K Challenge'}
                  </div>
                  <div className="text-[11px] text-text-muted font-medium">
                    Reward: <strong>$25,000 Free Challenge</strong>
                  </div>
                </div>
              </div>

              {/* #2 Runner Up */}
              <div className="bg-surface/80 border border-slate-400/40 rounded-xl p-4 flex items-center gap-3">
                <div className="text-3xl font-black text-slate-400 shrink-0">🥈</div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="text-[11px] uppercase font-bold text-slate-400">2nd Place Prize</div>
                  <div className="text-sm font-extrabold text-text truncate">
                    {podiumData?.podium?.[1]?.name ? `${podiumData.podium[1].name} (${podiumData.podium[1].wins}W)` : 'Free $10K Challenge'}
                  </div>
                  <div className="text-[11px] text-text-muted font-medium">
                    Reward: <strong>$10,000 Free Challenge</strong>
                  </div>
                </div>
              </div>

              {/* #3 Podium */}
              <div className="bg-surface/80 border border-amber-700/40 rounded-xl p-4 flex items-center gap-3">
                <div className="text-3xl font-black text-amber-700 shrink-0">🥉</div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="text-[11px] uppercase font-bold text-amber-700">3rd Place Prize</div>
                  <div className="text-sm font-extrabold text-text truncate">
                    {podiumData?.podium?.[2]?.name ? `${podiumData.podium[2].name} (${podiumData.podium[2].wins}W)` : 'Free $5K Challenge'}
                  </div>
                  <div className="text-[11px] text-text-muted font-medium">
                    Reward: <strong>$5,000 Free Challenge</strong>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Navigation Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center bg-surface-muted p-1 rounded-xl border border-border">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterTab === 'all'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              All Matches ({allMatches.length})
            </button>
            <button
              onClick={() => setFilterTab('waiting')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'waiting'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Open Challenges ({lobbyData?.waiting?.length || 0})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'active'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Radio className="h-3.5 w-3.5 text-red-500" />
              Live Duels ({lobbyData?.active?.length || 0})
            </button>
            <button
              onClick={() => setFilterTab('completed')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterTab === 'completed'
                  ? 'bg-surface text-text shadow-md border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Recaps & History ({lobbyData?.completed?.length || 0})
            </button>
          </div>

          <div className="text-xs text-text-muted font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Multi-Mode Escrow Architecture (0 Risk to Challenge Accounts)</span>
          </div>
        </div>

        {/* ── BATTLES GRID ───────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Swords className="h-5 w-5 text-red-500" />
              Gladiator Arena Roster {arenaMode !== 'all' && `(${arenaMode.toUpperCase()})`}
            </h2>
            <span className="text-xs text-text-muted tabular font-medium">
              Showing {filteredMatches.length} arenas
            </span>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-text-muted">
              <div className="h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading arena matches...
            </div>
          ) : filteredMatches.length === 0 ? (
            <Card className="bg-surface border border-border text-center p-12">
              <Swords className="h-12 w-12 mx-auto text-text-muted mb-3" />
              <h3 className="text-base font-bold text-text">No Battles Found in This Category</h3>
              <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                Be the first gladiator to create a 1v1 challenge and wait for an opponent to accept!
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-5 bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create 1v1 Duel
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMatches.map((match) => {
                const isWaiting = match.status === 'waiting'
                const isActive = match.status === 'active'
                const isCompleted = match.status === 'completed'
                const mode = match.arena_mode || 'league'
                const isCreator = currentUserId > 0 && match.creator_user_id === currentUserId
                const isChallenger = currentUserId > 0 && match.challenger_user_id === currentUserId

                return (
                  <Card 
                    key={match.id}
                    className={`bg-surface border transition-all duration-300 overflow-hidden relative group hover:border-red-500/50 ${
                      isActive 
                        ? 'border-red-500/40 shadow-lg shadow-red-950/20' 
                        : isWaiting 
                        ? 'border-amber-500/30' 
                        : 'border-border'
                    }`}
                  >
                    {/* Top Status Bar */}
                    <div className="p-4 border-b border-border flex items-center justify-between bg-surface-muted">
                      <div className="flex items-center gap-2">
                        <span className="tabular text-xs font-bold text-text">
                          {match.match_code}
                        </span>
                        <Badge tone="info" size="sm" className="tabular font-semibold text-[10px]">
                          {match.symbol}
                        </Badge>
                        
                        {/* Arena Mode Badge */}
                        {mode === 'league' && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                            🛡️ League (Free)
                          </span>
                        )}
                        {mode === 'cash' && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                            ⚔️ Cash (USDC)
                          </span>
                        )}
                        {mode === 'perk' && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                            🏆 Challenge Perk
                          </span>
                        )}
                      </div>

                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                          <Radio className="h-2.5 w-2.5" />
                          LIVE
                        </span>
                      )}

                      {isWaiting && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          OPEN
                        </span>
                      )}

                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Trophy className="h-2.5 w-2.5" />
                          CONCLUDED
                        </span>
                      )}
                    </div>

                    <CardContent className="p-5 space-y-4">
                      
                      {/* Title & Duration */}
                      <div>
                        <h3 className="text-base font-bold text-text group-hover:text-red-500 transition-colors">
                          {match.title}
                        </h3>
                        <div className="text-xs text-text-muted tabular font-medium mt-0.5 flex items-center gap-2">
                          <Clock className="h-3 w-3 text-blue-500" />
                          <span>{match.duration_minutes} Mins Duration</span>
                          <span>•</span>
                          <span>$10,000 Equity Deck</span>
                        </div>
                      </div>

                      {/* Stakes Showcase based on Mode */}
                      <div className="bg-surface-muted p-3.5 rounded-xl border border-border grid grid-cols-2 gap-3 text-center">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">Entry Stake</div>
                          <div className="text-sm sm:text-base font-bold tabular text-text mt-0.5">
                            {mode === 'perk' 
                              ? 'Challenge Honor' 
                              : mode === 'league' 
                              ? `${match.stake_amount} Chips` 
                              : formatMoney(match.stake_amount)}
                          </div>
                        </div>

                        <div className="border-l border-border">
                          <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                            {mode === 'perk' ? 'Winner Reward' : 'Winner Takes (85%)'}
                          </div>
                          <div className="text-sm sm:text-base font-extrabold tabular text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                            {mode === 'perk' 
                              ? (match.perk_reward ? getPerkName(match.perk_reward) : 'Challenge Perk') 
                              : mode === 'league' 
                              ? `${match.prize_pool} Chips` 
                              : formatMoney(match.prize_pool)}
                          </div>
                        </div>
                      </div>

                      {/* Gladiators Face-off */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-surface-muted/60 border border-border">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center tabular font-bold text-[10px]">
                              P1
                            </span>
                            <span className="font-semibold text-text">{match.creator_name || 'Creator'}</span>
                          </div>
                          <span className="tabular font-medium text-text-muted">
                            {isActive || isCompleted ? `${Number(match.creator_pnl) >= 0 ? '+' : ''}${formatMoney(match.creator_pnl)}` : 'Ready'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-surface-muted/60 border border-border">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center tabular font-bold text-[10px]">
                              P2
                            </span>
                            <span className="font-semibold text-text">{match.challenger_name || (isWaiting ? 'Waiting Challenger...' : 'Opponent')}</span>
                          </div>
                          <span className="tabular font-medium text-text-muted">
                            {isActive || isCompleted ? `${Number(match.challenger_pnl) >= 0 ? '+' : ''}${formatMoney(match.challenger_pnl)}` : isWaiting ? 'Open' : 'Ready'}
                          </span>
                        </div>
                      </div>

                    </CardContent>

                    {/* Footer Actions */}
                    <CardFooter className="p-4 bg-surface-muted/40 border-t border-border flex items-center justify-between gap-3">
                      {isWaiting && !isCreator && (
                        <Button
                          onClick={() => joinMatchMutation.mutate(match.id)}
                          loading={joinMatchMutation.isPending}
                          className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold shadow-md"
                        >
                          <Swords className="h-4 w-4 mr-1.5" />
                          Accept Challenge
                        </Button>
                      )}

                      {isWaiting && isCreator && (
                        <div className="flex items-center justify-between w-full gap-2">
                          <Link href={`/arena/${match.id}`} className="flex-1">
                            <Button variant="outline" className="w-full border-border text-text-muted hover:text-text font-bold">
                              <Eye className="h-4 w-4 mr-1.5" />
                              View Room
                            </Button>
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => cancelMatchMutation.mutate(match.id)}
                            loading={cancelMatchMutation.isPending}
                            className="bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {(isActive || isCompleted) && (
                        <Link href={`/arena/${match.id}`} className="w-full">
                          <Button 
                            className={`w-full font-extrabold ${
                              isActive 
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20' 
                                : 'bg-surface-muted hover:bg-surface border border-border text-text'
                            }`}
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            {isActive ? (isCreator || isChallenger ? 'Enter Duel Room' : 'Spectate Duel') : 'View Match Recap'}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* ── GLADIATOR HALL OF FAME / LEADERBOARD ───────────────────────────── */}
        <section className="bg-surface border border-border shadow-sm rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-text flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Gladiator Hall of Fame (Top Win Streaks)
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Highest ranked 1v1 duelists across all arena modes with verified win records.
              </p>
            </div>

            <Badge tone="accent" size="sm" className="font-semibold">
              Updated Real-Time
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-muted font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Gladiator</th>
                  <th className="py-3 px-4 text-center">Duels Won</th>
                  <th className="py-3 px-4 text-center">Win Rate</th>
                  <th className="py-3 px-4 text-center">Current Streak</th>
                  <th className="py-3 px-4 text-right">Net Prize Money</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(lobbyData?.leaderboard || []).map((row) => (
                  <tr key={row.rank} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="py-3.5 px-4 tabular font-bold text-text">
                      {row.rank === 1 ? '🥇 #1' : row.rank === 2 ? '🥈 #2' : row.rank === 3 ? '🥉 #3' : `#${row.rank}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 font-semibold text-text">
                        <span className="text-base">{row.avatar}</span>
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center tabular font-bold text-text">
                      {row.wins} Wins
                    </td>
                    <td className="py-3.5 px-4 text-center tabular font-bold text-emerald-600 dark:text-emerald-400">
                      {row.win_rate}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tabular font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                        <Flame className="h-3 w-3 text-amber-500" />
                        {row.streak} Streak
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular font-extrabold text-amber-600 dark:text-amber-400">
                      {formatMoney(row.earnings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* ── CREATE 1V1 BATTLE MODAL ────────────────────────────────────────── */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Deploy 1v1 Gladiator Arena"
      >
        <div className="space-y-6 pt-2">
          
          {/* Mode Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-text">Select Duel Category</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, arena_mode: 'league', stake_amount: 50 })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  createForm.arena_mode === 'league'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-500 ring-1 ring-blue-500'
                    : 'bg-surface-muted text-text-muted border-border'
                }`}
              >
                <div className="font-bold text-xs">🛡️ League</div>
                <div className="text-[10px] opacity-80">Free Practice</div>
              </button>

              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, arena_mode: 'cash', stake_amount: 50 })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  createForm.arena_mode === 'cash'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-surface-muted text-text-muted border-border'
                }`}
              >
                <div className="font-bold text-xs">⚔️ Cash Duel</div>
                <div className="text-[10px] opacity-80">USDC Stakes</div>
              </button>

              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, arena_mode: 'perk', stake_amount: 0 })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  createForm.arena_mode === 'perk'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-500 ring-1 ring-purple-500'
                    : 'bg-surface-muted text-text-muted border-border'
                }`}
              >
                <div className="font-bold text-xs">🏆 Perk Battle</div>
                <div className="text-[10px] opacity-80">Challenge Buffs</div>
              </button>
            </div>
          </div>

          {/* If Mode 3 (Perk): Perk Reward Selector */}
          {createForm.arena_mode === 'perk' && (
            <div className="space-y-2 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <Label className="text-xs font-bold text-purple-500 dark:text-purple-300">Choose Perk Reward for Winner</Label>
              <div className="space-y-2 pt-1">
                {[
                  { key: 'FREE_RETRY', label: 'Free Evaluation Retry Voucher', desc: 'Resets breached challenge account back to active at 0% drawdown' },
                  { key: 'DRAWDOWN_BUFFER_1PCT', label: '+1.0% Max Drawdown Buffer Token', desc: 'Expands trailing/max drawdown limit by an extra 1.0% buffer' },
                  { key: 'CHALLENGE_50PCT_OFF', label: '50% Off Evaluation Coupon', desc: 'Single-use 50% discount code for any evaluation challenge plan' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, perk_reward: p.key as any })}
                    className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                      createForm.perk_reward === p.key
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                        : 'bg-surface text-text-muted border-border hover:text-text'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{p.label}</div>
                      <div className="text-[10px] opacity-80">{p.desc}</div>
                    </div>
                    {createForm.perk_reward === p.key && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symbol Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-text">Choose Battle Instrument</Label>
              {isWeekend && (
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Weekend: 24/7 Crypto Feed Active
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SYMBOLS.map((sym) => {
                const isCrypto = sym.includes('BTC') || sym.includes('ETH')
                const isClosed = isWeekend && !isCrypto
                return (
                  <button
                    key={sym}
                    type="button"
                    disabled={isClosed}
                    onClick={() => !isClosed && setCreateForm({ ...createForm, symbol: sym })}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                      isClosed
                        ? 'opacity-40 cursor-not-allowed bg-surface-muted/40 border-border text-text-muted'
                        : createForm.symbol === sym
                        ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                        : 'bg-surface-muted text-text-muted border-border hover:text-text'
                    }`}
                  >
                    <span>{sym}</span>
                    <span className={`text-[9px] font-semibold ${isClosed ? 'text-red-500' : isCrypto ? 'text-emerald-500' : 'text-text-muted'}`}>
                      {isClosed ? 'Closed Weekend' : isCrypto ? '24/7 Live' : 'Open'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stake Selector (League Chips or Cash USDC) */}
          {createForm.arena_mode !== 'perk' && (
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs font-semibold text-text">
                  {createForm.arena_mode === 'league' ? 'Stake Free Practice Chips' : 'Entry Stake Amount ($ USDC)'}
                </Label>
                <span className="text-xs tabular text-amber-600 dark:text-amber-400 font-bold">
                  {createForm.arena_mode === 'league' 
                    ? `Winner Takes: ${Math.round(createForm.stake_amount * 2 * 0.85)} Chips` 
                    : `Winner Takes: ${formatMoney(createForm.stake_amount * 2 * 0.85)}`}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(createForm.arena_mode === 'league' ? CHIP_STAKE_OPTIONS : CASH_STAKE_OPTIONS).map((stake) => (
                  <button
                    key={stake}
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, stake_amount: stake })}
                    className={`p-2.5 rounded-xl text-xs font-bold tabular border transition-all ${
                      createForm.stake_amount === stake
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                        : 'bg-surface-muted text-text-muted border-border hover:text-text'
                    }`}
                  >
                    {createForm.arena_mode === 'league' ? `${stake} C` : `$${stake}`}
                  </button>
                ))}
              </div>

              <div className="bg-surface-muted p-3 rounded-xl border border-border text-xs text-text-muted tabular flex items-center justify-between">
                <span>Prize Pool (85%): <strong className="text-amber-600 dark:text-amber-400">{createForm.arena_mode === 'league' ? `${Math.round(createForm.stake_amount * 2 * 0.85)} Chips` : formatMoney(createForm.stake_amount * 2 * 0.85)}</strong></span>
                <span>Platform Rake (15%): <strong className="text-text">{createForm.arena_mode === 'league' ? `${Math.round(createForm.stake_amount * 2 * 0.15)} Chips` : formatMoney(createForm.stake_amount * 2 * 0.15)}</strong></span>
              </div>
            </div>
          )}

          {/* Duration Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-text">Match Duration Countdown</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((dur) => (
                <button
                  key={dur.val}
                  type="button"
                  onClick={() => setCreateForm({ ...createForm, duration_minutes: dur.val })}
                  className={`p-2.5 rounded-xl text-xs border text-left transition-all ${
                    createForm.duration_minutes === dur.val
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-surface-muted text-text-muted border-border hover:text-text'
                  }`}
                >
                  <div className="font-bold tabular">{dur.label}</div>
                  <div className="text-[10px] opacity-80">{dur.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Title */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-text">Custom Duel Title (Optional)</Label>
            <Input
              placeholder={`e.g. ${createForm.symbol} ${createForm.duration_minutes}M Turbo Clash`}
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="bg-surface-muted border-border text-text"
            />
          </div>

          {/* Admin Gating Notice */}
          {user?.is_admin && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <strong className="block font-bold">Administrator / Referee Mode Active</strong>
                <span>Platform staff cannot enter PvP duels as fighters. Admins may oversee and spectate active battles from the referee suite.</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              className="border-border text-text-muted hover:text-text"
            >
              Cancel
            </Button>
            <Button
              disabled={user?.is_admin || createMatchMutation.isPending}
              onClick={() => createMatchMutation.mutate(createForm)}
              loading={createMatchMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold px-6"
            >
              <Swords className="h-4 w-4 mr-2" />
              Open Arena ({createForm.arena_mode === 'perk' ? 'Perk Duel' : createForm.arena_mode === 'league' ? `${createForm.stake_amount} Chips` : formatMoney(createForm.stake_amount)})
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── DEPOSIT MODAL (MODE 2 ARENA WALLET) ────────────────────────────── */}
      <Modal
        open={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title="Deposit into Arena Cash Wallet"
      >
        <div className="space-y-5 pt-2 text-xs">
          <p className="text-text-muted leading-relaxed">
            Funds deposited into your Arena Cash Wallet are held in dedicated escrow strictly for 1v1 PvP wagering. <strong>These funds are completely isolated from and will never risk your active evaluation challenge balances.</strong>
          </p>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-text">Select Deposit Amount ($ USDC)</Label>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDepositAmount(amt)}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    depositAmount === amt
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-surface-muted text-text-muted border-border hover:text-text'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">Custom Amount</Label>
            <Input
              type="number"
              min={5}
              max={5000}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
              className="bg-surface-muted border-border text-text"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Instant Credit Enabled
            </div>
            <div className="text-[11px] mt-0.5 opacity-90">
              Demo sandbox mode credits your arena wallet immediately. In production, deposits settle within 1 confirmation on Arbitrum/Polygon USDC.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setIsDepositModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => depositMutation.mutate(depositAmount)}
              loading={depositMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Deposit ${depositAmount.toFixed(2)} USDC
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── WITHDRAW MODAL (MODE 2 ARENA WALLET) ───────────────────────────── */}
      <Modal
        open={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Withdraw from Arena Cash Wallet"
      >
        <div className="space-y-5 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-surface-muted border border-border flex items-center justify-between">
            <span className="text-text-muted">Available Cash Balance:</span>
            <span className="font-black tabular text-emerald-500 text-base">{formatMoney(cashBalance)}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">Withdrawal Amount ($ USDC)</Label>
            <Input
              type="number"
              min={10}
              max={cashBalance}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
              className="bg-surface-muted border-border text-text"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">USDC Payout Address (ERC20 / Polygon / Arbitrum)</Label>
            <Input
              placeholder="0x..."
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="bg-surface-muted border-border text-text"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>Cancel</Button>
            <Button
              disabled={withdrawAmount <= 0 || withdrawAmount > cashBalance}
              onClick={() => withdrawMutation.mutate({ amount: withdrawAmount, address: withdrawAddress })}
              loading={withdrawMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Confirm Withdrawal
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── PERKS INVENTORY MODAL (MODE 3 CHALLENGE PERKS) ──────────────────── */}
      <Modal
        open={isPerksModalOpen}
        onClose={() => setIsPerksModalOpen(false)}
        title="Trader Perks Inventory (Challenge Modifiers)"
      >
        <div className="space-y-5 pt-2 text-xs">
          <p className="text-text-muted leading-relaxed">
            Perks earned by winning Mode 3 PvP battles are stored in your inventory. You can apply them directly to any of your active evaluation accounts or redeem discount vouchers.
          </p>

          {/* Account Selector if user has challenges */}
          {Array.isArray(challengeAccounts) && challengeAccounts.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-xl bg-surface-muted border border-border">
              <Label className="text-xs font-bold text-text">Target Challenge Account for Perks:</Label>
              <select
                value={selectedPerkAccount}
                onChange={(e) => setSelectedPerkAccount(Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-surface border border-border text-xs text-text font-medium"
              >
                <option value={0}>Select challenge account...</option>
                {challengeAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    Account #{acc.id} ({acc.plan_name || '$' + acc.starting_balance} • {acc.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Perks List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {(perksData?.perks || []).length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No perks in your inventory yet.</p>
                <p className="text-[11px] mt-1">Win a Mode 3 Perk Duel in the arena to unlock Free Retries and Drawdown Buffers!</p>
              </div>
            ) : (
              (perksData?.perks || []).map((perk) => {
                const isAvailable = perk.status === 'available'
                return (
                  <div 
                    key={perk.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isAvailable ? 'bg-surface border-purple-500/40 shadow-sm' : 'bg-surface-muted/40 border-border opacity-60'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={isAvailable ? 'accent' : 'neutral'} size="sm">
                          {isAvailable ? 'Available' : 'Applied'}
                        </Badge>
                        <span className="font-extrabold text-text truncate">{getPerkName(perk.perk_type)}</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Earned: {perk.created_at?.substring(0, 10)}
                        {perk.applied_account_id && ` • Applied to Account #${perk.applied_account_id}`}
                      </div>
                    </div>

                    {isAvailable && (
                      <Button
                        size="sm"
                        onClick={() => applyPerkMutation.mutate({ perkId: perk.id, accountId: selectedPerkAccount })}
                        loading={applyPerkMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0"
                      >
                        Apply Perk
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setIsPerksModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
