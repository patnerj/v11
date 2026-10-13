'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import { 
  Trophy, Award, Users, DollarSign, Calendar, Clock, 
  Plus, Edit, Trash2, Search, Filter, RefreshCw, Eye,
  CheckCircle2, AlertTriangle, ShieldCheck, Flame, ChevronRight,
  TrendingUp, Sparkles, X, ArrowUpRight, Zap, Swords, Radio, ExternalLink, StopCircle,
  Wallet, ArrowDownToLine, ArrowUpFromLine, AlertCircle, Shield, Check, FileText,
  ArrowUp, ArrowDown
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Tournament, TournamentParticipant, TournamentRules, PvpMatch, PvpAnalyticsResponse } from '@/types/api'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'

export default function AdminTournamentsPage() {
  const queryClient = useQueryClient()
  const [activeNavTab, setActiveNavTab] = useState<'tournaments' | 'pvp'>('tournaments')

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null)
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null)
  
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false)
  const [selectedTournamentForLeaderboard, setSelectedTournamentForLeaderboard] = useState<Tournament | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    starting_balance: '10000',
    entry_fee: '0',
    max_participants: '500',
    fake_participants: '0',
    prize_pool: '$25,000',
    first_prize: '$10,000 + $100K Account',
    second_prize: '$5,000 + $50K Account',
    third_prize: '$2,500 + $25K Account',
    prize_4th_10th: '$25K Evaluation Challenge',
    prize_11th_50th: '$10K Evaluation Challenge',
    prize_51st_100th: '50% Challenge Discount Voucher',
    start_date: new Date().toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16),
    drawdown_type: 'trailing' as 'trailing' | 'static',
    trailing_dd: '5',
    daily_dd: '5',
    max_dd: '10',
    leverage: '100',
    status: 'upcoming' as 'upcoming' | 'active' | 'completed' | 'cancelled'
  })

  // Quick Preset Helper for Prizes
  const applyPrizePreset = (type: 'standard' | 'micro') => {
    if (type === 'standard') {
      setFormData(prev => ({
        ...prev,
        prize_pool: '$25,000',
        first_prize: '$10,000 Cash + $100K Funded Account',
        second_prize: '$5,000 Cash + $50K Funded Account',
        third_prize: '$2,500 Cash + $25K Funded Account',
        prize_4th_10th: '$25K Evaluation Challenge',
        prize_11th_50th: '$10K Evaluation Challenge',
        prize_51st_100th: '50% Challenge Discount Voucher',
      }))
      toast.success('Applied Standard PropFirm Prize Tiers!')
    } else {
      setFormData(prev => ({
        ...prev,
        prize_pool: '$5,000',
        first_prize: '$2,000 Cash + $50K Account',
        second_prize: '$1,000 Cash + $25K Account',
        third_prize: '$500 Cash + $10K Account',
        prize_4th_10th: '$10K Evaluation Challenge',
        prize_11th_50th: '35% Challenge Discount Voucher',
        prize_51st_100th: '20% Challenge Discount Voucher',
      }))
      toast.success('Applied Micro Cup Prize Tiers!')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. FETCH TOURNAMENTS LIST
  // ─────────────────────────────────────────────────────────────
  const { data: tournaments = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-tournaments', statusFilter, searchQuery],
    queryFn: async () => {
      const res = await api.admin.tournaments.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery ? searchQuery : undefined,
      })
      return res.ok && Array.isArray(res.data) ? res.data : []
    },
    refetchInterval: 20_000,
  })

  // ─────────────────────────────────────────────────────────────
  // 2. FETCH LIVE LEADERBOARD
  // ─────────────────────────────────────────────────────────────
  const { 
    data: leaderboardData, 
    isLoading: isLoadingLeaderboard,
    refetch: refetchLeaderboard
  } = useQuery({
    queryKey: ['admin-tournament-leaderboard', selectedTournamentForLeaderboard?.id],
    queryFn: async () => {
      if (!selectedTournamentForLeaderboard?.id) return null
      const res = await api.admin.tournaments.leaderboard(selectedTournamentForLeaderboard.id)
      return res.ok ? res.data : null
    },
    enabled: !!selectedTournamentForLeaderboard && isLeaderboardModalOpen,
    refetchInterval: 10_000,
  })

  // ─────────────────────────────────────────────────────────────
  // 2.2 SYNTHETIC LEADERBOARD MANAGEMENT (Client Requirement)
  // ─────────────────────────────────────────────────────────────
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false)
  const [isGeneratingSynthetic, setIsGeneratingSynthetic] = useState(false)
  const [manualEntryData, setManualEntryData] = useState({
    display_name: '',
    country: 'GB',
    starting_equity: '10000',
    current_equity: '12500',
    roi_pct: '25.00',
    max_dd_reached: '2.0',
  })

  const handleAutoGenerateSynthetic = async () => {
    if (!selectedTournamentForLeaderboard?.id) return
    setIsGeneratingSynthetic(true)
    try {
      const res = await api.admin.tournaments.generateSynthetic(selectedTournamentForLeaderboard.id)
      if (res.ok && res.data.success) {
        toast.success(`Generated ${res.data.count || 12} realistic synthetic leaderboard entries!`)
        refetchLeaderboard()
      } else {
        toast.error(res.ok ? (res.data.message || 'Generation failed') : res.error)
      }
    } catch (e: any) {
      toast.error(e.message || 'Generation error')
    } finally {
      setIsGeneratingSynthetic(false)
    }
  }

  const handleClearSynthetic = async (entryId?: string) => {
    if (!selectedTournamentForLeaderboard?.id) return
    const cleanId = entryId ? String(entryId).replace(/^synth_/, '') : undefined
    try {
      const res = await api.admin.tournaments.clearSynthetic(selectedTournamentForLeaderboard.id, cleanId)
      if (res.ok && res.data.success) {
        toast.success(entryId ? 'Removed synthetic entry.' : 'Cleared all synthetic entries.')
        refetchLeaderboard()
      } else {
        toast.error(res.ok ? (res.data.message || 'Failed') : res.error)
      }
    } catch (e: any) {
      toast.error(e.message || 'Clear error')
    }
  }

  const handleSaveManualSynthetic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTournamentForLeaderboard?.id) return
    if (!manualEntryData.display_name.trim()) {
      toast.error('Please enter a trader name.')
      return
    }
    try {
      const startingVal = !isNaN(parseFloat(manualEntryData.starting_equity)) ? parseFloat(manualEntryData.starting_equity) : 10000
      const currentVal = !isNaN(parseFloat(manualEntryData.current_equity)) ? parseFloat(manualEntryData.current_equity) : startingVal
      const roiVal = !isNaN(parseFloat(manualEntryData.roi_pct)) ? parseFloat(manualEntryData.roi_pct) : 0
      const maxDdVal = !isNaN(parseFloat(manualEntryData.max_dd_reached)) ? parseFloat(manualEntryData.max_dd_reached) : 0

      const res = await api.admin.tournaments.saveSynthetic(selectedTournamentForLeaderboard.id, {
        display_name: manualEntryData.display_name.trim(),
        country: manualEntryData.country.trim().toUpperCase() || 'GB',
        starting_equity: startingVal,
        current_equity: currentVal,
        roi_pct: roiVal,
        max_dd_reached: maxDdVal,
      })
      if (res.ok && res.data.success) {
        toast.success(`Added ${manualEntryData.display_name} to leaderboard!`)
        setIsManualEntryModalOpen(false)
        refetchLeaderboard()
      } else {
        toast.error(res.ok ? (res.data.message || 'Failed to save entry') : res.error)
      }
    } catch (e: any) {
      toast.error(e.message || 'Save error')
    }
  }

  const [isEditSyntheticModalOpen, setIsEditSyntheticModalOpen] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [editSyntheticData, setEditSyntheticData] = useState({
    id: '',
    display_name: '',
    country: 'GB',
    starting_equity: '10000',
    current_equity: '12500',
    roi_pct: '25.00',
    max_dd_reached: '2.0',
  })

  const handleOpenEditSynthetic = (p: any) => {
    const rawId = String(p.synthetic_id || p.id || '').replace(/^synth_/, '')
    const starting = String(p.starting_equity || selectedTournamentForLeaderboard?.starting_balance || 10000)
    const current = String(p.current_equity != null ? p.current_equity : 10000)
    const roi = String(p.roi_pct != null ? p.roi_pct : '0.00')
    const maxDd = String(p.max_dd_reached != null ? p.max_dd_reached : '0.0')

    setEditSyntheticData({
      id: rawId,
      display_name: p.display_name || p.user_login || 'Trader',
      country: p.country || 'GB',
      starting_equity: starting,
      current_equity: current,
      roi_pct: roi,
      max_dd_reached: maxDd,
    })
    setIsEditSyntheticModalOpen(true)
  }

  const handleSaveEditSynthetic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTournamentForLeaderboard?.id) return
    if (!editSyntheticData.display_name.trim()) {
      toast.error('Please enter a trader name.')
      return
    }
    try {
      const startingVal = !isNaN(parseFloat(editSyntheticData.starting_equity)) ? parseFloat(editSyntheticData.starting_equity) : 10000
      const currentVal = !isNaN(parseFloat(editSyntheticData.current_equity)) ? parseFloat(editSyntheticData.current_equity) : startingVal
      const roiVal = !isNaN(parseFloat(editSyntheticData.roi_pct)) ? parseFloat(editSyntheticData.roi_pct) : 0
      const maxDdVal = !isNaN(parseFloat(editSyntheticData.max_dd_reached)) ? parseFloat(editSyntheticData.max_dd_reached) : 0

      const res = await api.admin.tournaments.saveSynthetic(selectedTournamentForLeaderboard.id, {
        id: editSyntheticData.id,
        display_name: editSyntheticData.display_name.trim(),
        country: editSyntheticData.country.trim().toUpperCase() || 'GB',
        starting_equity: startingVal,
        current_equity: currentVal,
        roi_pct: roiVal,
        max_dd_reached: maxDdVal,
      })
      if (res.ok && res.data.success) {
        toast.success(`Updated ${editSyntheticData.display_name} successfully!`)
        setIsEditSyntheticModalOpen(false)
        refetchLeaderboard()
      } else {
        toast.error(res.ok ? (res.data.message || 'Failed to update entry') : res.error)
      }
    } catch (e: any) {
      toast.error(e.message || 'Update error')
    }
  }

  const handleMoveSynthetic = async (p: any, direction: 'up' | 'down') => {
    if (!selectedTournamentForLeaderboard?.id || !leaderboardData?.leaderboard) return
    const list = [...leaderboardData.leaderboard]
    const currentIdx = list.findIndex(item => 
      ((item as any).synthetic_id && (item as any).synthetic_id === (p as any).synthetic_id) || item.id === p.id
    )
    if (currentIdx === -1) return

    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1
    if (targetIdx < 0 || targetIdx >= list.length) return

    const target = list[targetIdx]
    setIsReordering(true)

    try {
      // Build full synthetic array from existing leaderboard
      const syntheticItems = list
        .filter((item: any) => item.is_synthetic)
        .map((item: any, idx: number) => ({
          id: String(item.synthetic_id || item.id || (idx + 1)).replace(/^synth_/, ''),
          display_name: item.display_name || item.user_login || `Trader #${idx + 1}`,
          country: item.country || 'GB',
          starting_equity: !isNaN(parseFloat(item.starting_equity)) ? parseFloat(item.starting_equity) : 10000,
          current_equity: !isNaN(parseFloat(item.current_equity)) ? parseFloat(item.current_equity) : 10000,
          roi_pct: !isNaN(parseFloat(item.roi_pct)) ? parseFloat(item.roi_pct) : 0,
          max_dd_reached: !isNaN(parseFloat(item.max_dd_reached)) ? parseFloat(item.max_dd_reached) : 0,
        }))

      const pCleanId = String(p.synthetic_id || p.id).replace(/^synth_/, '')
      const currSynthetic = syntheticItems.find(s => s.id === pCleanId || s.id === String(p.synthetic_id) || s.id === String(p.id))
      if (!currSynthetic) {
        toast.error('Synthetic entry not found.')
        setIsReordering(false)
        return
      }

      if ((target as any).is_synthetic) {
        // Target is also synthetic -> clean metric swap with individual account scaling
        const targetCleanId = String((target as any).synthetic_id || target.id).replace(/^synth_/, '')
        const targetSynthetic = syntheticItems.find(s => s.id === targetCleanId || s.id === String((target as any).synthetic_id) || s.id === String(target.id))
        if (targetSynthetic) {
          const tempRoi = currSynthetic.roi_pct
          const tempDd = currSynthetic.max_dd_reached

          // Swap ROIs
          currSynthetic.roi_pct = targetSynthetic.roi_pct
          targetSynthetic.roi_pct = tempRoi

          // Tie-breaker if both had identical ROI
          if (currSynthetic.roi_pct === targetSynthetic.roi_pct) {
            const step = direction === 'up' ? 0.05 : -0.05
            currSynthetic.roi_pct = parseFloat((currSynthetic.roi_pct + step).toFixed(2))
          }

          // Recalculate equity for each trader according to their own starting capital
          currSynthetic.current_equity = parseFloat((currSynthetic.starting_equity * (1 + currSynthetic.roi_pct / 100)).toFixed(2))
          targetSynthetic.current_equity = parseFloat((targetSynthetic.starting_equity * (1 + targetSynthetic.roi_pct / 100)).toFixed(2))

          // Swap max DD reached
          currSynthetic.max_dd_reached = targetSynthetic.max_dd_reached
          targetSynthetic.max_dd_reached = tempDd
        }
      } else {
        // Target is a real participant -> calibrate synthetic ROI smoothly between target and adjacent rank
        // Strictly never modify real participant data (Rule 76 / Rule 72)
        const targetRoi = Number(target.roi_pct) || 0

        if (direction === 'up') {
          // Moving up past target -> sit right above target, below whoever is above target
          let newRoi: number
          if (targetIdx > 0) {
            const aboveRoi = Number(list[targetIdx - 1]?.roi_pct) || targetRoi
            if (aboveRoi > targetRoi) {
              newRoi = parseFloat(((targetRoi + aboveRoi) / 2).toFixed(2))
              if (newRoi <= targetRoi) newRoi = parseFloat((targetRoi + 0.01).toFixed(2))
              if (newRoi >= aboveRoi) newRoi = parseFloat((aboveRoi - 0.01).toFixed(2))
            } else {
              newRoi = parseFloat((targetRoi + 0.05).toFixed(2))
            }
          } else {
            // Target is already Rank 1 -> become the new leader
            newRoi = parseFloat((targetRoi + 0.50).toFixed(2))
          }
          currSynthetic.roi_pct = newRoi
        } else {
          // Moving down past target -> sit right below target, above whoever is below target
          let newRoi: number
          if (targetIdx < list.length - 1) {
            const belowRoi = Number(list[targetIdx + 1]?.roi_pct) || targetRoi
            if (targetRoi > belowRoi) {
              newRoi = parseFloat(((targetRoi + belowRoi) / 2).toFixed(2))
              if (newRoi >= targetRoi) newRoi = parseFloat((targetRoi - 0.01).toFixed(2))
              if (newRoi <= belowRoi) newRoi = parseFloat((belowRoi + 0.01).toFixed(2))
            } else {
              newRoi = parseFloat((targetRoi - 0.05).toFixed(2))
            }
          } else {
            // Target is already bottom rank -> become the new bottom
            newRoi = parseFloat((targetRoi - 0.50).toFixed(2))
          }
          currSynthetic.roi_pct = newRoi
        }

        // Recalculate equity based on own starting equity and calibrated ROI
        currSynthetic.current_equity = parseFloat((currSynthetic.starting_equity * (1 + currSynthetic.roi_pct / 100)).toFixed(2))
      }

      const res = await api.admin.tournaments.saveSynthetic(selectedTournamentForLeaderboard.id, {
        entries: syntheticItems
      })

      if (res.ok && res.data.success) {
        toast.success(direction === 'up' ? `Moved ${p.display_name || 'Trader'} up!` : `Moved ${p.display_name || 'Trader'} down!`)
        await refetchLeaderboard()
      } else {
        toast.error(res.ok ? (res.data.message || 'Reorder failed') : res.error)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder entries')
    } finally {
      setIsReordering(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2.5 FETCH PVP ARENA ANALYTICS & REVENUE
  // ─────────────────────────────────────────────────────────────
  const { data: pvpData, refetch: refetchPvp } = useQuery<PvpAnalyticsResponse>({
    queryKey: ['admin-pvp-analytics'],
    queryFn: async () => {
      const res = await api.admin.pvpAnalytics()
      if (!res.ok) throw new Error(res.error || 'Failed to fetch pvp analytics.')
      return res.data
    },
    refetchInterval: 10_000,
  })

  const [matchToSettle, setMatchToSettle] = useState<any>(null)

  const settlePvpMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.pvp.settle(id)
      if (!res.ok) throw new Error(res.error || 'Failed to settle duel.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success('🏆 Duel Settled! ' + data.message)
      queryClient.invalidateQueries({ queryKey: ['admin-pvp-analytics'] })
    },
    onError: (err: any) => {
      toast.error('Settlement Error: ' + err.message)
    },
  })

  // ─────────────────────────────────────────────────────────────
  // 2.6 PVP ARENA SETTINGS, WITHDRAWALS & WALLET CREDIT
  // ─────────────────────────────────────────────────────────────
  const { data: pvpSettingsData, refetch: refetchPvpSettings } = useQuery({
    queryKey: ['admin-pvp-settings'],
    queryFn: async () => {
      const res = await api.admin.pvpSettingsGet()
      if (!res.ok) throw new Error(res.error || 'Failed to fetch pvp settings.')
      return res.data
    },
    enabled: activeNavTab === 'pvp',
  })

  const [arenaWalletMode, setArenaWalletMode] = useState<'demo' | 'live'>('demo')
  React.useEffect(() => {
    if (pvpSettingsData?.arena_wallet_mode) {
      setArenaWalletMode(pvpSettingsData.arena_wallet_mode)
    }
  }, [pvpSettingsData])

  const savePvpSettingsMutation = useMutation({
    mutationFn: async (mode: 'demo' | 'live') => {
      const res = await api.admin.pvpSettingsSave({ arena_wallet_mode: mode })
      if (!res.ok) throw new Error(res.error || 'Failed to update arena settings.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Arena settings updated!')
      queryClient.invalidateQueries({ queryKey: ['admin-pvp-settings'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error updating settings.')
    },
  })

  const { data: pvpWithdrawalsData, refetch: refetchPvpWithdrawals } = useQuery({
    queryKey: ['admin-pvp-withdrawals'],
    queryFn: async () => {
      const res = await api.admin.pvpWithdrawalsList('pending')
      if (!res.ok) throw new Error(res.error || 'Failed to fetch pvp withdrawals.')
      return res.data
    },
    enabled: activeNavTab === 'pvp',
    refetchInterval: 15_000,
  })

  const [actionWithdrawalModal, setActionWithdrawalModal] = useState<{ id: number; action: 'paid' | 'rejected'; amount: number; user_id: number; address: string } | null>(null)
  const [withdrawalTxRef, setWithdrawalTxRef] = useState('')

  const pvpWithdrawalActionMutation = useMutation({
    mutationFn: async ({ id, action, tx_reference }: { id: number; action: 'paid' | 'rejected'; tx_reference?: string }) => {
      const res = await api.admin.pvpWithdrawalAction(id, { action, tx_reference })
      if (!res.ok) throw new Error(res.error || 'Failed to update withdrawal status.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Withdrawal status updated!')
      setActionWithdrawalModal(null)
      setWithdrawalTxRef('')
      queryClient.invalidateQueries({ queryKey: ['admin-pvp-withdrawals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-pvp-analytics'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error processing withdrawal.')
    },
  })

  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false)
  const [creditForm, setCreditForm] = useState({ user_id: '', amount: '', ref: '', note: '' })

  const creditWalletMutation = useMutation({
    mutationFn: async (payload: { user_id: number; amount: number; ref?: string; note?: string }) => {
      const res = await api.admin.pvpWalletCredit(payload)
      if (!res.ok) throw new Error(res.error || 'Failed to credit wallet.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Wallet credited successfully!')
      setIsCreditModalOpen(false)
      setCreditForm({ user_id: '', amount: '', ref: '', note: '' })
      queryClient.invalidateQueries({ queryKey: ['admin-pvp-analytics'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error crediting wallet.')
    },
  })

  // ─────────────────────────────────────────────────────────────
  // 3. MUTATIONS (SAVE, STATUS, DELETE)
  // ─────────────────────────────────────────────────────────────
  const saveTournamentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.admin.tournaments.save(payload)
      if (!res.ok) throw new Error(res.error || 'Failed to save tournament.')
      return res.data
    },
    onSuccess: () => {
      toast.success(editingTournament ? 'Tournament updated successfully!' : 'Tournament created and launched!')
      setIsFormModalOpen(false)
      setEditingTournament(null)
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error saving tournament.')
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.admin.tournaments.updateStatus(id, status)
      if (!res.ok) throw new Error(res.error || 'Failed to update status.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Tournament status updated!')
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error updating status.')
    }
  })

  const deleteTournamentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.admin.tournaments.delete(id)
      if (!res.ok) throw new Error(res.error || 'Failed to delete tournament.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Tournament deleted.')
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error deleting tournament.')
    }
  })

  // Open Form Modal Handler
  const handleOpenCreateModal = () => {
    setEditingTournament(null)
    setFormData({
      title: '',
      slug: '',
      description: '',
      starting_balance: '10000',
      entry_fee: '0',
      max_participants: '5000',
      fake_participants: '0',
      prize_pool: '$25,000',
      first_prize: '$10,000 + $100K Account',
      second_prize: '$5,000 + $50K Account',
      third_prize: '$2,500 + $25K Account',
      prize_4th_10th: '$25K Evaluation Challenge',
      prize_11th_50th: '$10K Evaluation Challenge',
      prize_51st_100th: '50% Challenge Discount Voucher',
      start_date: new Date().toISOString().slice(0, 16),
      end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16),
      drawdown_type: 'trailing',
      trailing_dd: '5',
      daily_dd: '5',
      max_dd: '10',
      leverage: '100',
      status: 'upcoming'
    })
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (t: Tournament) => {
    setEditingTournament(t)
    
    let rules: any = {}
    if (typeof t.rules_json === 'string') {
      try { rules = JSON.parse(t.rules_json) } catch (e) {}
    } else if (t.rules_json) {
      rules = t.rules_json
    }

    let prizes: any = {}
    if (typeof t.prizes_breakdown === 'string') {
      try { prizes = JSON.parse(t.prizes_breakdown) } catch (e) {}
    } else if (t.prizes_breakdown) {
      prizes = t.prizes_breakdown
    }

    setFormData({
      title: t.title || t.name || '',
      slug: t.slug || '',
      description: t.description || '',
      starting_balance: String(t.starting_balance || 10000),
      entry_fee: String(t.entry_fee || 0),
      max_participants: String(t.max_participants || 5000),
      fake_participants: String((t as any).fake_participants || 0),
      prize_pool: t.prize_pool || '$25,000',
      first_prize: prizes['1st'] || prizes['first'] || '$10,000 + $100K Account',
      second_prize: prizes['2nd'] || prizes['second'] || '$5,000 + $50K Account',
      third_prize: prizes['3rd'] || prizes['third'] || '$2,500 + $25K Account',
      prize_4th_10th: prizes['4th_10th'] || prizes['4 to 10'] || '$25K Evaluation Challenge',
      prize_11th_50th: prizes['11th_50th'] || prizes['10 to 50'] || '$10K Evaluation Challenge',
      prize_51st_100th: prizes['51st_100th'] || prizes['50 to 100'] || '50% Challenge Discount Voucher',
      start_date: t.start_date ? new Date(t.start_date).toISOString().slice(0, 16) : '',
      end_date: t.end_date ? new Date(t.end_date).toISOString().slice(0, 16) : '',
      drawdown_type: (rules.drawdown_type || 'trailing') as 'trailing' | 'static',
      trailing_dd: String(rules.trailing_dd || rules.max_dd || 5),
      daily_dd: String(rules.daily_dd || 5),
      max_dd: String(rules.max_dd || rules.trailing_dd || 10),
      leverage: String(rules.leverage || 100),
      status: t.status || 'upcoming'
    })
    setIsFormModalOpen(true)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error('Tournament title is required.')
      return
    }

    const payload = {
      id: editingTournament ? editingTournament.id : undefined,
      title: formData.title.trim(),
      slug: formData.slug.trim() || undefined,
      description: formData.description.trim(),
      starting_balance: parseFloat(formData.starting_balance) || 10000,
      entry_fee: parseFloat(formData.entry_fee) || 0,
      max_participants: parseInt(formData.max_participants) || 5000,
      fake_participants: parseInt(formData.fake_participants) || 0,
      prize_pool: formData.prize_pool.trim() || '$10,000',
      prizes_breakdown: {
        '1st': formData.first_prize,
        '2nd': formData.second_prize,
        '3rd': formData.third_prize,
        '4th_10th': formData.prize_4th_10th,
        '11th_50th': formData.prize_11th_50th,
        '51st_100th': formData.prize_51st_100th,
      },
      rules_json: {
        drawdown_type: formData.drawdown_type,
        trailing_dd: parseFloat(formData.trailing_dd) || 5,
        daily_dd: parseFloat(formData.daily_dd) || 5,
        max_dd: parseFloat(formData.max_dd) || 10,
        leverage: parseInt(formData.leverage) || 100,
      },
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : undefined,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : undefined,
      status: formData.status,
    }

    saveTournamentMutation.mutate(payload)
  }

  // Summary Metrics Computation
  const metrics = useMemo(() => {
    const total = tournaments.length
    const active = tournaments.filter(t => t.status === 'active').length
    const totalEnrolled = tournaments.reduce((acc, t) => acc + (t.current_participants || t.participants_count || 0), 0)
    const prizeSum = tournaments.reduce((acc, t) => {
      const num = parseFloat(String(t.prize_pool).replace(/[^0-9.]/g, '')) || 0
      return acc + num
    }, 0)
    return {
      total,
      active,
      totalEnrolled,
      prizeSumFormatted: `$${prizeSum.toLocaleString()}`
    }
  }, [tournaments])

  return (
    <div className="w-full space-y-6 pb-16">
      
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-muted/70 pb-6 w-full">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Tournaments & Competitions Engine
            </h1>
            <Badge tone="accent" size="sm" pulsing className="font-mono">
              Live Contests
            </Badge>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Host global prop trading tournaments, manage automated prize pools, and track real-time leaderboards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeNavTab === 'pvp') {
                refetchPvp()
                refetchPvpSettings()
                refetchPvpWithdrawals()
                toast.info('PvP arena telemetry refreshed.')
              } else {
                refetch()
                toast.info('Tournament directory refreshed.')
              }
            }}
            className="gap-1.5 border-surface-muted hover:border-emerald-500"
          >
            <RefreshCw className="h-4 w-4 text-emerald-400" />
            Refresh
          </Button>

          {activeNavTab === 'tournaments' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              className="gap-1.5 shadow-emerald-500/20"
            >
              <Plus className="h-4 w-4" />
              Create Tournament
            </Button>
          )}

          {activeNavTab === 'pvp' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreditModalOpen(true)}
              className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold"
            >
              <Wallet className="h-4 w-4" />
              Credit Trader Wallet
            </Button>
          )}
        </div>
      </div>

      {/* ── Sub Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-surface-muted pb-3">
        <button
          onClick={() => setActiveNavTab('tournaments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeNavTab === 'tournaments'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-text-muted hover:text-text bg-surface border border-border'
          }`}
        >
          <Trophy className="h-4 w-4" />
          Global Tournaments ({tournaments.length})
        </button>

        <button
          onClick={() => setActiveNavTab('pvp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeNavTab === 'pvp'
              ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md shadow-red-600/20'
              : 'text-text-muted hover:text-text bg-surface border border-border'
          }`}
        >
          <Swords className="h-4 w-4 text-red-500" />
          1v1 PvP Arena & Rake Revenue
          <span className="px-1.5 py-0.5 rounded-full text-2xs font-mono bg-red-500/20 text-red-500 dark:text-red-300 border border-red-500/30">
            15% Rake
          </span>
        </button>
      </div>

      {activeNavTab === 'tournaments' ? (
        <>
          {/* ── Summary Metric Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
            <Card className="bg-surface border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted">Total Competitions</span>
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Trophy className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-text mt-1.5 tabular-nums">
                  {metrics.total}
                </div>
                <span className="text-2xs text-text-muted">Hosted all-time</span>
              </CardContent>
            </Card>

        <Card className="bg-surface border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Active Contests</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Flame className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
              {metrics.active}
            </div>
            <span className="text-2xs text-text-muted">Live trading sprints</span>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Enrolled Traders</span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5 tabular-nums">
              {metrics.totalEnrolled.toLocaleString()}
            </div>
            <span className="text-2xs text-text-muted">Community participants</span>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Total Prize Pool</span>
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
              {metrics.prizeSumFormatted}
            </div>
            <span className="text-2xs text-text-muted">Guaranteed cash & funded</span>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter & Search Toolbar ───────────────────────────────────────── */}
      <Card className="bg-surface border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-3 text-text-muted" />
              <Input
                placeholder="Search tournaments by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-lg border border-border">
              {['all', 'active', 'upcoming', 'completed'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Tournament Cards Grid ─────────────────────────────────────────── */}
      {tournaments.length === 0 ? (
        <Card className="bg-surface border-border">
          <CardContent className="py-16 text-center text-text-muted">
            <Trophy className="h-10 w-10 mx-auto text-text-muted mb-3" />
            <h3 className="font-semibold text-text text-base">No Tournaments Found</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              No tournaments match your current filter settings. Click "+ Create Tournament" to configure your first prop contest.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              className="mt-4 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Create First Tournament
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((t) => {
            const currentCount = t.current_participants || t.participants_count || 0
            const maxCount = t.max_participants || 500
            const fillPct = Math.min(100, Math.round((currentCount / maxCount) * 100))

            return (
              <Card 
                key={t.id} 
                className="bg-surface border-border hover:border-accent/40 transition-all flex flex-col justify-between overflow-hidden shadow-sm group"
              >
                <div>
                  {/* Card Header Top */}
                  <CardHeader className="pb-3 border-b border-border bg-surface-muted">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            #{t.id}
                          </span>
                          <Badge 
                            tone={
                              t.status === 'active' ? 'success' :
                              t.status === 'upcoming' ? 'warn' :
                              t.status === 'completed' ? 'neutral' : 'danger'
                            } 
                            size="sm"
                            pulsing={t.status === 'active'}
                            className="capitalize font-mono text-2xs"
                          >
                            {t.status}
                          </Badge>
                        </div>

                        <CardTitle className="text-base font-bold text-text group-hover:text-emerald-500 transition-colors line-clamp-1 mt-1">
                          {t.title || t.name}
                        </CardTitle>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 inline-block">
                          {(t.prize_pool && String(t.prize_pool).startsWith(',') ? '$10' + t.prize_pool : (t.prize_pool && !String(t.prize_pool).startsWith('$') && !String(t.prize_pool).startsWith('€') && !String(t.prize_pool).startsWith('£') ? '$' + t.prize_pool : t.prize_pool)) || '$10,000'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Body */}
                  <CardContent className="p-5 space-y-4 text-xs font-sans">
                    <p className="text-text-muted line-clamp-2 leading-relaxed min-h-[36px]">
                      {t.description || 'Global simulated trading tournament. Compete against top prop traders for funded accounts and cash prizes.'}
                    </p>

                    {/* Specifications Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-surface-muted p-3 rounded-lg border border-border font-mono text-2xs">
                      <div>
                        <span className="text-text-muted block text-2xs">Starting Equity</span>
                        <span className="font-bold text-text">${Number(t.starting_balance || 10000).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-2xs">Entry Fee</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(t.entry_fee) === 0 ? 'FREE' : `$${t.entry_fee}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-2xs">Start Date</span>
                        <span className="text-text">{new Date(t.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-2xs">End Date</span>
                        <span className="text-text">{new Date(t.end_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Participant Fill Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-2xs font-mono">
                        <span className="text-text-muted flex items-center gap-1">
                          <Users className="h-3 w-3 text-emerald-500" />
                          Enrollment
                        </span>
                        <span className="font-bold text-text">
                          {currentCount} / {maxCount} ({fillPct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-muted overflow-hidden border border-border">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all rounded-full"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer Actions */}
                <CardFooter className="border-t border-border p-3 bg-surface-muted flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTournamentForLeaderboard(t)
                      setIsLeaderboardModalOpen(true)
                    }}
                    className="gap-1.5 text-xs border-emerald-500/30 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 flex-1"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Leaderboard
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={t.status}
                      onChange={(e) => updateStatusMutation.mutate({ id: t.id, status: e.target.value })}
                      className="bg-surface border border-border text-text text-2xs font-mono rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      title="Change Status"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(t)}
                      className="h-8 w-8 p-0 text-text-muted hover:text-text"
                      title="Edit Tournament"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTournamentToDelete(t)}
                      className="h-8 w-8 p-0 text-text-muted hover:text-red-500"
                      title="Delete Tournament"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>

              </Card>
            )
          })}
        </div>
      )}
      </>
      ) : (
        /* ── 1V1 PVP E-SPORTS ARENA & RAKE REVENUE VIEW ─────────────────── */
        <div className="space-y-6">
          
          {/* PvP Telemetry 4-Pack */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
            <Card className="bg-surface border-red-500/30 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted">Total Volume Staked</span>
                  <div className="h-7 w-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-text mt-1.5 font-mono">
                  ${(pvpData?.analytics?.total_staked || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-2xs text-text-muted font-mono">Cumulative 1v1 turnover</span>
              </CardContent>
            </Card>

            <Card className="bg-surface border-amber-500/30 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 font-bold">House Rake (15%)</span>
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Trophy className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5 font-mono">
                  ${(pvpData?.analytics?.total_rake || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-mono">100% Risk-Free Platform Profit</span>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted">Active Live Duels</span>
                  <div className="h-7 w-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                    <Radio className="h-3.5 w-3.5 animate-ping" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1.5 font-mono">
                  {pvpData?.analytics?.active_matches || 0} LIVE
                </div>
                <span className="text-2xs text-text-muted font-mono">Real-time spectator rooms</span>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted">Settled Matches</span>
                  <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1.5 font-mono">
                  {pvpData?.analytics?.completed_matches || 0} Duels
                </div>
                <span className="text-2xs text-text-muted font-mono">Automated escrow payouts</span>
              </CardContent>
            </Card>
          </div>

          {/* Arena Wallet Mode Card */}
          <Card className="bg-surface border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border bg-surface-muted/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm text-text flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Arena Wallet Financial Operating Mode
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted mt-0.5">
                    Control whether the 1v1 PvP Arena operates with simulated sandbox funds or live USDC escrow settlement.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    tone={arenaWalletMode === 'live' ? 'danger' : 'warning'} 
                    size="sm" 
                    className="font-mono text-2xs uppercase tracking-wider"
                  >
                    Active: {arenaWalletMode === 'live' ? 'LIVE MODE (Escrow Guard)' : 'DEMO MODE (Sandbox)'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div
                  onClick={() => setArenaWalletMode('demo')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    arenaWalletMode === 'demo'
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-surface-muted/40 border-border hover:border-amber-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-text flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-amber-500" />
                      Demo Sandbox Mode (Default)
                    </div>
                    {arenaWalletMode === 'demo' && <Check className="h-4 w-4 text-amber-500" />}
                  </div>
                  <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                    Traders deposit simulated test funds directly into their arena wallet. Cashouts execute immediately with instant simulated ledger deductions for risk-free gladiator testing.
                  </p>
                </div>

                <div
                  onClick={() => setArenaWalletMode('live')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    arenaWalletMode === 'live'
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                      : 'bg-surface-muted/40 border-border hover:border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-text flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      Live Escrow Mode (Production)
                    </div>
                    {arenaWalletMode === 'live' && <Check className="h-4 w-4 text-emerald-500" />}
                  </div>
                  <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                    Real USDC wagering. Trader deposits are gated to crypto gateway or admin crediting. Trader withdrawals are held as <code className="text-2xs font-mono font-bold">withdrawal_pending</code> for manual review and blockchain tx reference verification.
                  </p>
                </div>
              </div>

              {arenaWalletMode === 'live' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-2xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Warning:</strong> In Live Mode, all trader withdrawals require manual verification in the Withdrawals Review Queue below before on-chain disbursal.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  size="sm"
                  onClick={() => savePvpSettingsMutation.mutate(arenaWalletMode)}
                  loading={savePvpSettingsMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-4"
                >
                  Save Mode Setting
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Arena Withdrawals Review Queue Table */}
          <Card className="bg-surface border-border overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border pb-4 bg-surface-muted/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-text flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-amber-500" />
                  Arena Withdrawals Review Queue
                  <Badge tone={pvpWithdrawalsData?.withdrawals?.length ? 'warning' : 'default'} size="sm" className="font-mono text-2xs">
                    {pvpWithdrawalsData?.withdrawals?.length || 0} Pending
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-text-muted mt-0.5">
                  Approve live arena payouts, record on-chain transaction hash references, or reject and refund trader balances.
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchPvpWithdrawals()}
                className="gap-1.5 text-xs h-7 border-border hover:bg-surface-muted"
              >
                <RefreshCw className="h-3.5 w-3.5 text-text-muted" />
                Refresh Queue
              </Button>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-text-muted font-mono uppercase text-2xs bg-surface-muted">
                    <th className="py-3 px-4">Tx ID & Ref</th>
                    <th className="py-3 px-4">Trader</th>
                    <th className="py-3 px-4 text-right">Amount ($ USDC)</th>
                    <th className="py-3 px-4">Destination & Notes</th>
                    <th className="py-3 px-4 text-center">Requested At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!pvpWithdrawalsData?.withdrawals || pvpWithdrawalsData.withdrawals.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-muted">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                        No pending arena withdrawals in queue. All trader cashouts are up to date.
                      </td>
                    </tr>
                  ) : (
                    pvpWithdrawalsData.withdrawals.map((w: any) => (
                      <tr key={w.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-text">#{w.id}</div>
                          <div className="text-2xs text-text-muted font-mono">{w.reference_id || '-'}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text">{w.display_name || w.user_login || `User #${w.user_id}`}</div>
                          <div className="text-2xs text-text-muted font-mono">{w.user_email || `ID: ${w.user_id}`}</div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          ${Math.abs(Number(w.amount)).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="text-2xs font-mono text-text truncate" title={w.notes}>
                            {w.notes || 'Crypto Address'}
                          </div>
                          <div className="text-3xs text-text-muted font-mono mt-0.5">
                            Balance after debit: ${Number(w.balance_after || 0).toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center text-2xs text-text-muted font-mono">
                          {w.created_at}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setActionWithdrawalModal({
                                  id: w.id,
                                  action: 'paid',
                                  amount: Math.abs(Number(w.amount)),
                                  user_id: w.user_id,
                                  address: w.notes || ''
                                })
                                setWithdrawalTxRef('')
                              }}
                              className="h-7 text-2xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Mark Paid
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActionWithdrawalModal({
                                  id: w.id,
                                  action: 'rejected',
                                  amount: Math.abs(Number(w.amount)),
                                  user_id: w.user_id,
                                  address: w.notes || ''
                                })
                              }}
                              className="h-7 text-2xs font-bold border-red-500/40 text-red-500 hover:bg-red-500/10 px-2"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject & Refund
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* PvP Matches Table */}
          <Card className="bg-surface border-border overflow-hidden">
            <CardHeader className="border-b border-border pb-4 bg-surface-muted flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-text flex items-center gap-2">
                  <Swords className="h-4 w-4 text-red-500" />
                  1v1 Arena Matches & Escrow Ledger
                </CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Monitor live gladiator trading duels, review profit splits, and force-settle arena matches.
                </CardDescription>
              </div>

              <a
                href="/arena"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Public Arena Lobby
              </a>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-text-muted font-mono uppercase text-2xs bg-surface-muted">
                    <th className="py-3 px-4">Match Code</th>
                    <th className="py-3 px-4">Gladiator A (Creator)</th>
                    <th className="py-3 px-4">Gladiator B (Challenger)</th>
                    <th className="py-3 px-4 text-center">Stake & Prize Pool</th>
                    <th className="py-3 px-4 text-center">House Rake (15%)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!pvpData?.matches || pvpData.matches.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        No arena matches registered yet.
                      </td>
                    </tr>
                  ) : (
                    pvpData.matches.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-text flex items-center gap-1.5">
                            <span>{m.match_code}</span>
                            <Badge tone="info" size="sm" className="font-mono text-2xs">
                              {m.symbol}
                            </Badge>
                          </div>
                          <div className="text-2xs text-text-muted font-mono mt-0.5">
                            {m.duration_minutes} Mins Duration
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text">{m.creator_name || 'Gladiator A'}</div>
                          <div className="text-2xs text-text-muted font-mono">{m.creator_email || m.creator_login || (m.creator_user_id ? `User #${m.creator_user_id}` : '-')}</div>
                          <div className="text-2xs font-mono mt-0.5 text-blue-500 dark:text-blue-400">
                            PnL: {Number(m.creator_pnl) >= 0 ? '+' : ''}${Number(m.creator_pnl).toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text">
                            {m.challenger_name || (m.status === 'waiting' ? 'Waiting for Challenger...' : 'Gladiator B')}
                          </div>
                          <div className="text-2xs text-text-muted font-mono">{m.challenger_email || m.challenger_login || (m.challenger_user_id ? `User #${m.challenger_user_id}` : '-')}</div>
                          <div className="text-2xs font-mono mt-0.5 text-amber-600 dark:text-amber-400">
                            PnL: {Number(m.challenger_pnl) >= 0 ? '+' : ''}${Number(m.challenger_pnl).toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono">
                          <div className="text-text font-bold">${Number(m.stake_amount).toFixed(2)} Stake</div>
                          <div className="text-2xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                            Prize: ${Number(m.prize_pool).toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +${Number(m.platform_rake).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {m.status === 'active' && (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse inline-flex items-center gap-1">
                              <Radio className="h-2.5 w-2.5" />
                              LIVE DUEL
                            </span>
                          )}
                          {m.status === 'waiting' && (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                              WAITING
                            </span>
                          )}
                          {m.status === 'completed' && (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              SETTLED ({m.winner_name || 'Champion'})
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/arena/${m.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-surface-muted text-text-muted hover:text-text border border-border transition-colors"
                              title="Spectate Arena"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </a>

                            {m.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMatchToSettle(m)}
                                loading={settlePvpMutation.isPending && settlePvpMutation.variables === m.id}
                                className="h-7 text-2xs font-mono text-red-500 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 px-2"
                              >
                                <StopCircle className="h-3.5 w-3.5 mr-1" />
                                Force Settle
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* ── Modal 1: Live Leaderboard Drawer / Modal ──────────────────────── */}
      <Modal
        isOpen={isLeaderboardModalOpen}
        onClose={() => {
          setIsLeaderboardModalOpen(false)
          setSelectedTournamentForLeaderboard(null)
        }}
        title={`Live Leaderboard: ${selectedTournamentForLeaderboard?.title || selectedTournamentForLeaderboard?.name || 'Tournament'}`}
        description={`Prize Pool: ${selectedTournamentForLeaderboard?.prize_pool || '$25,000'} | Start Capital: $${Number(selectedTournamentForLeaderboard?.starting_balance || 10000).toLocaleString()}`}
        maxWidth="2xl"
        className="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Badge tone="accent" size="sm" pulsing className="font-mono">
                Real-Time Telemetry
              </Badge>
              <span className="text-xs text-text-muted">Rankings update on every MT5 trade tick</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const startBal = Number(selectedTournamentForLeaderboard?.starting_balance || 10000)
                  setManualEntryData({
                    display_name: '',
                    country: 'US',
                    starting_equity: String(startBal),
                    current_equity: String(Math.round(startBal * 1.18)),
                    roi_pct: '18.00',
                    max_dd_reached: '1.8',
                  })
                  setIsManualEntryModalOpen(true)
                }}
                className="gap-1 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 h-7"
              >
                <Plus className="h-3 w-3" />
                Add Manual Entry
              </Button>

              <Button
                variant="outline"
                size="sm"
                loading={isGeneratingSynthetic}
                onClick={handleAutoGenerateSynthetic}
                className="gap-1 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 h-7"
              >
                <Sparkles className="h-3 w-3" />
                Auto-Generate Top 10
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearSynthetic()}
                className="gap-1 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10 h-7"
              >
                <Trash2 className="h-3 w-3" />
                Clear Synthetic
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLeaderboard()}
                className="gap-1 text-xs border-border h-7"
              >
                <RefreshCw className="h-3 w-3 text-emerald-500" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border max-h-[480px]">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-surface-muted text-text-muted uppercase font-mono text-2xs tracking-wider border-b border-border sticky top-0">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Trader</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4 text-right">Current Equity</th>
                  <th className="py-3 px-4 text-right">ROI %</th>
                  <th className="py-3 px-4 text-right">Max DD</th>
                  <th className="py-3 px-4">Prize Tier</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {isLoadingLeaderboard ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-text-muted">
                      Loading live leaderboard ranks...
                    </td>
                  </tr>
                ) : !leaderboardData?.leaderboard || leaderboardData.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-text-muted">
                      No participants registered yet for this tournament.
                    </td>
                  </tr>
                ) : (
                  leaderboardData.leaderboard.map((p: TournamentParticipant, index: number) => {
                    const isTop3 = p.rank <= 3
                    const rankTone = p.rank === 1 ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' :
                                     p.rank === 2 ? 'text-text-muted bg-surface-muted border-border' :
                                     p.rank === 3 ? 'text-amber-700 dark:text-amber-600 bg-amber-700/10 border-amber-700/30' :
                                     'text-text-muted bg-surface-muted border-transparent'

                    let prizes: any = {}
                    const rawBreakdown = selectedTournamentForLeaderboard?.prizes_breakdown || (leaderboardData?.tournament as any)?.prizes_breakdown
                    if (typeof rawBreakdown === 'string') {
                      try { prizes = JSON.parse(rawBreakdown) } catch (e) {}
                    } else if (rawBreakdown) {
                      prizes = rawBreakdown
                    }

                    let prizeLabel = '—'
                    if (p.rank === 1) prizeLabel = prizes['1st'] ? `🥇 1st Place: ${prizes['1st']}` : '🥇 1st Place: 50% of Prize Pool'
                    else if (p.rank === 2) prizeLabel = prizes['2nd'] ? `🥈 2nd Place: ${prizes['2nd']}` : '🥈 2nd Place: 30% of Prize Pool'
                    else if (p.rank === 3) prizeLabel = prizes['3rd'] ? `🥉 3rd Place: ${prizes['3rd']}` : '🥉 3rd Place: 20% of Prize Pool'
                    else if (p.rank <= 10 && prizes['top10']) prizeLabel = `🎖️ Top 10: ${prizes['top10']}`

                    return (
                      <tr key={p.id || index} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center justify-center font-mono font-bold text-xs h-6 w-6 rounded-md border ${rankTone}`}>
                            {p.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text block">{p.display_name || p.user_login || 'Trader'}</span>
                              {(p as any).country && (
                                <span className="text-2xs font-mono px-1 py-0.2 rounded bg-surface-muted border border-border text-text-muted">
                                  {(p as any).country}
                                </span>
                              )}
                              {(p as any).is_synthetic && (
                                <Badge tone="warn" size="sm" className="text-3xs py-0 px-1 border-amber-500/30 text-amber-500 bg-amber-500/10 font-mono">
                                  Synthetic
                                </Badge>
                              )}
                            </div>
                            <span className="text-2xs text-text-muted font-mono">{p.user_email || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-text">
                          #{p.account_id || `TRD-${p.id}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text">
                          <div className="flex items-center justify-end gap-1.5 group">
                            <span>${Number(p.current_equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            {(p as any).is_synthetic && (
                              <button 
                                type="button"
                                onClick={() => handleOpenEditSynthetic(p)}
                                title="Edit balance & metrics"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-text-muted hover:text-blue-500 rounded hover:bg-blue-500/10"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${Number(p.roi_pct) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          {Number(p.roi_pct) >= 0 ? '+' : ''}{Number(p.roi_pct).toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-text-muted">
                          {p.max_dd_reached != null ? Number(p.max_dd_reached).toFixed(1) : '0.0'}%
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-2xs font-semibold ${isTop3 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}`}>
                            {prizeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(p as any).is_synthetic ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={index === 0 || isReordering}
                                className="h-6 w-6 p-0 text-text-muted hover:text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-20 disabled:pointer-events-none"
                                title="Move Up (Upar karein)"
                                onClick={() => handleMoveSynthetic(p, 'up')}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={index === leaderboardData.leaderboard.length - 1 || isReordering}
                                className="h-6 w-6 p-0 text-text-muted hover:text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-20 disabled:pointer-events-none"
                                title="Move Down (Nechy karein)"
                                onClick={() => handleMoveSynthetic(p, 'down')}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-500/80 hover:text-blue-500 hover:bg-blue-500/10"
                                title="Edit Balance & Trader"
                                onClick={() => handleOpenEditSynthetic(p)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                                title="Delete synthetic entry"
                                onClick={() => handleClearSynthetic((p as any).synthetic_id || (p as any).id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-text-faint text-2xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLeaderboardModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal 1.5: Add Manual Synthetic Leaderboard Entry ──────────────── */}
      <Modal
        isOpen={isManualEntryModalOpen}
        onClose={() => setIsManualEntryModalOpen(false)}
        title="Add Manual Leaderboard Entry"
        description={`Add custom trader with customized PnL & ROI to ${selectedTournamentForLeaderboard?.title || 'Tournament'}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveManualSynthetic} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Trader Display Name *</Label>
            <Input
              value={manualEntryData.display_name}
              onChange={e => setManualEntryData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="e.g. Liam Vance"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Country (ISO-2 Code)</Label>
              <Input
                value={manualEntryData.country}
                onChange={e => setManualEntryData(prev => ({ ...prev, country: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="US, GB, AE, etc."
                maxLength={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Max Drawdown %</Label>
              <Input
                type="number"
                step="0.1"
                value={manualEntryData.max_dd_reached}
                onChange={e => setManualEntryData(prev => ({ ...prev, max_dd_reached: e.target.value }))}
                placeholder="2.0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Equity ($)</Label>
              <Input
                type="number"
                value={manualEntryData.starting_equity}
                onChange={e => {
                  const starting = parseFloat(e.target.value) || 0
                  const current = parseFloat(manualEntryData.current_equity) || 0
                  const roi = starting > 0 ? (((current - starting) / starting) * 100).toFixed(2) : '0.00'
                  setManualEntryData(prev => ({ ...prev, starting_equity: e.target.value, roi_pct: roi }))
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Current Equity ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={manualEntryData.current_equity}
                onChange={e => {
                  const current = parseFloat(e.target.value) || 0
                  const starting = parseFloat(manualEntryData.starting_equity) || 0
                  const roi = starting > 0 ? (((current - starting) / starting) * 100).toFixed(2) : '0.00'
                  setManualEntryData(prev => ({ ...prev, current_equity: e.target.value, roi_pct: roi }))
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">ROI %</Label>
              <Input
                type="number"
                step="0.01"
                value={manualEntryData.roi_pct}
                onChange={e => {
                  const roi = parseFloat(e.target.value) || 0
                  const starting = parseFloat(manualEntryData.starting_equity) || 0
                  const current = (starting * (1 + roi / 100)).toFixed(2)
                  setManualEntryData(prev => ({ ...prev, roi_pct: e.target.value, current_equity: current }))
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsManualEntryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Add to Leaderboard
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal 1.6: Edit Synthetic Leaderboard Entry ────────────────────── */}
      <Modal
        isOpen={isEditSyntheticModalOpen}
        onClose={() => setIsEditSyntheticModalOpen(false)}
        title="Edit Leaderboard Entry & Balance"
        description={`Modify balance, ROI, and display metrics for ${editSyntheticData.display_name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEditSynthetic} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Trader Display Name *</Label>
            <Input
              value={editSyntheticData.display_name}
              onChange={e => setEditSyntheticData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="e.g. Liam Vance"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Country (ISO-2 Code)</Label>
              <Input
                value={editSyntheticData.country}
                onChange={e => setEditSyntheticData(prev => ({ ...prev, country: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="US, GB, AE, etc."
                maxLength={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Max Drawdown %</Label>
              <Input
                type="number"
                step="0.1"
                value={editSyntheticData.max_dd_reached}
                onChange={e => setEditSyntheticData(prev => ({ ...prev, max_dd_reached: e.target.value }))}
                placeholder="2.0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Equity ($)</Label>
              <Input
                type="number"
                value={editSyntheticData.starting_equity}
                onChange={e => {
                  const val = e.target.value
                  const starting = parseFloat(val)
                  const current = parseFloat(editSyntheticData.current_equity)
                  if (val.trim() === '' || isNaN(starting) || starting <= 0) {
                    setEditSyntheticData(prev => ({ ...prev, starting_equity: val }))
                  } else {
                    const roi = !isNaN(current) ? (((current - starting) / starting) * 100).toFixed(2) : '0.00'
                    setEditSyntheticData(prev => ({ ...prev, starting_equity: val, roi_pct: roi }))
                  }
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Current Balance ($) *</Label>
              <Input
                type="number"
                step="0.01"
                value={editSyntheticData.current_equity}
                onChange={e => {
                  const val = e.target.value
                  const starting = parseFloat(editSyntheticData.starting_equity)
                  const current = parseFloat(val)
                  if (val.trim() === '' || isNaN(current)) {
                    setEditSyntheticData(prev => ({ ...prev, current_equity: val }))
                  } else {
                    const roi = (!isNaN(starting) && starting > 0) ? (((current - starting) / starting) * 100).toFixed(2) : '0.00'
                    setEditSyntheticData(prev => ({ ...prev, current_equity: val, roi_pct: roi }))
                  }
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">ROI %</Label>
              <Input
                type="number"
                step="0.01"
                value={editSyntheticData.roi_pct}
                onChange={e => {
                  const val = e.target.value
                  const starting = parseFloat(editSyntheticData.starting_equity)
                  const roi = parseFloat(val)
                  if (val.trim() === '' || val === '-' || isNaN(roi)) {
                    setEditSyntheticData(prev => ({ ...prev, roi_pct: val }))
                  } else {
                    const current = (!isNaN(starting) && starting > 0) ? (starting * (1 + roi / 100)).toFixed(2) : '0.00'
                    setEditSyntheticData(prev => ({ ...prev, roi_pct: val, current_equity: current }))
                  }
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditSyntheticModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal 2: Create / Edit Tournament Modal ───────────────────────── */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingTournament(null)
        }}
        title={editingTournament ? `Edit Tournament #${editingTournament.id}` : 'Create New Tournament'}
        description="Configure competition rules, starting balances, dates, and prize breakdown."
        maxWidth="2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tournament Title</Label>
              <Input
                placeholder="e.g. Summer Global FX Cup 2026"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Custom URL Slug (Optional)</Label>
              <Input
                placeholder="e.g. summer-global-fx-cup-2026"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              placeholder="Brief summary of contest rules and target assets..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Starting Equity ($)</Label>
              <Input
                type="number"
                value={formData.starting_balance}
                onChange={(e) => setFormData({ ...formData, starting_balance: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Entry Fee ($) [0 = Free]</Label>
              <Input
                type="number"
                value={formData.entry_fee}
                onChange={(e) => setFormData({ ...formData, entry_fee: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Capacity</Label>
              <Input
                type="number"
                placeholder="5000"
                value={formData.max_participants}
                onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-accent flex items-center justify-between">
                <span>Social Proof Offset</span>
                <span className="text-2xs text-text-muted">+Fake</span>
              </Label>
              <Input
                type="number"
                placeholder="e.g. 1950"
                value={formData.fake_participants}
                onChange={(e) => setFormData({ ...formData, fake_participants: e.target.value })}
                className="text-xs font-mono border-accent/40 focus:border-accent text-accent font-semibold"
              />
            </div>
          </div>

          {/* Social Proof Live Preview */}
          <div className="px-3 py-1.5 rounded-lg bg-surface-muted border border-border flex items-center justify-between text-xs font-mono">
            <span className="text-text-muted">Trader Card Live Display:</span>
            <span className="text-accent font-semibold">
              👥 {(Math.max(0, parseInt(String((editingTournament as any)?.real_participants ?? (editingTournament as any)?.current_participants ?? 0)) || 0) + (parseInt(formData.fake_participants) || 0)).toLocaleString()} / {(parseInt(formData.max_participants) || 5000).toLocaleString()} Traders
              <span className="text-2xs text-text-muted font-normal ml-1.5">
                (Real: {String((editingTournament as any)?.real_participants ?? (editingTournament as any)?.current_participants ?? 0)} + Offset: {(parseInt(formData.fake_participants) || 0).toLocaleString()})
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Total Prize Pool ($)</Label>
              <Input
                placeholder="e.g. $25,000"
                value={formData.prize_pool}
                onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none focus:border-emerald-500 font-mono capitalize"
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Prize Breakdown (6 Tiers with Bulk Quick Presets) */}
          <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-2xs font-semibold text-text block font-mono">
                🏆 Prize Distribution Breakdown (6 Tiers)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted">Quick Fill:</span>
                <button
                  type="button"
                  onClick={() => applyPrizePreset('standard')}
                  className="px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent text-2xs font-medium hover:bg-accent/20 transition-colors"
                >
                  ⚡ PropFirm Standard
                </button>
                <button
                  type="button"
                  onClick={() => applyPrizePreset('micro')}
                  className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-2xs font-medium hover:bg-amber-500/20 transition-colors"
                >
                  ⚡ Micro Cup
                </button>
              </div>
            </div>

            {/* Podium (1st, 2nd, 3rd) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-2xs text-amber-500 font-semibold flex items-center gap-1">🥇 1st Place Prize</Label>
                <Input
                  placeholder="$10,000 + $100K Account"
                  value={formData.first_prize}
                  onChange={(e) => setFormData({ ...formData, first_prize: e.target.value })}
                  className="text-xs font-mono border-amber-500/30"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-2xs text-slate-300 font-semibold flex items-center gap-1">🥈 2nd Place Prize</Label>
                <Input
                  placeholder="$5,000 + $50K Account"
                  value={formData.second_prize}
                  onChange={(e) => setFormData({ ...formData, second_prize: e.target.value })}
                  className="text-xs font-mono border-slate-500/30"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-2xs text-amber-700 font-semibold flex items-center gap-1">🥉 3rd Place Prize</Label>
                <Input
                  placeholder="$2,500 + $25K Account"
                  value={formData.third_prize}
                  onChange={(e) => setFormData({ ...formData, third_prize: e.target.value })}
                  className="text-xs font-mono border-amber-700/30"
                />
              </div>
            </div>

            {/* Extended Tiers (4-10, 11-50, 51-100) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/50">
              <div className="space-y-1">
                <Label className="text-2xs text-text-muted">🎖️ 4th – 10th Place</Label>
                <Input
                  placeholder="$25K Evaluation Challenge"
                  value={formData.prize_4th_10th}
                  onChange={(e) => setFormData({ ...formData, prize_4th_10th: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-2xs text-text-muted">🏅 11th – 50th Place</Label>
                <Input
                  placeholder="$10K Evaluation Challenge"
                  value={formData.prize_11th_50th}
                  onChange={(e) => setFormData({ ...formData, prize_11th_50th: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-2xs text-text-muted">🎗️ 51st – 100th Place</Label>
                <Input
                  placeholder="50% Challenge Discount Voucher"
                  value={formData.prize_51st_100th}
                  onChange={(e) => setFormData({ ...formData, prize_51st_100th: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date & Time</Label>
              <Input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date & Time</Label>
              <Input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Risk & Trailing Drawdown Rules */}
          <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-2xs font-semibold text-text block font-mono">
                ⚡ Tournament Risk & Drawdown Rules
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted font-mono">Drawdown Model:</span>
                <select
                  value={formData.drawdown_type}
                  onChange={(e) => setFormData({ ...formData, drawdown_type: e.target.value as any })}
                  className="h-7 px-2 rounded-md bg-surface border border-accent/40 text-2xs text-accent font-semibold focus:outline-none"
                >
                  <option value="trailing">Trailing Drawdown (Recommended)</option>
                  <option value="static">Static Balance Drawdown</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-2xs text-text-muted">
                  {formData.drawdown_type === 'trailing' ? 'Trailing DD (%) [from Peak]' : 'Max DD (%) [Static]'}
                </Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.drawdown_type === 'trailing' ? formData.trailing_dd : formData.max_dd}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    trailing_dd: e.target.value,
                    max_dd: e.target.value 
                  })}
                  className="text-xs font-mono h-8 border-accent/30 text-accent font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-2xs text-text-muted">Daily DD (%) [Reset 00:00 UTC]</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.daily_dd}
                  onChange={(e) => setFormData({ ...formData, daily_dd: e.target.value })}
                  className="text-xs font-mono h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-2xs text-text-muted">Leverage (1:X)</Label>
                <Input
                  type="number"
                  value={formData.leverage}
                  onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                  className="text-xs font-mono h-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsFormModalOpen(false)
                setEditingTournament(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saveTournamentMutation.isPending}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {editingTournament ? 'Save Changes' : 'Launch Tournament'}
            </Button>
          </div>

        </form>
      </Modal>

      {/* Delete Tournament Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!tournamentToDelete}
        onCancel={() => setTournamentToDelete(null)}
        onConfirm={() => {
          if (tournamentToDelete) {
            deleteTournamentMutation.mutate(tournamentToDelete.id)
            setTournamentToDelete(null)
          }
        }}
        title={`Delete Tournament: ${tournamentToDelete?.title || tournamentToDelete?.name || 'Tournament'}`}
        description="Are you sure you want to permanently delete this tournament and its participant leaderboard data?"
        confirmText="Delete Tournament"
        isDestructive={true}
        loading={deleteTournamentMutation.isPending}
      />

      {/* Force Settle Confirm Dialog — one click used to immediately settle a
          live money-staked duel (distributing the prize pool) with no
          confirmation at all, unlike every other destructive action here. */}
      <ConfirmDialog
        isOpen={!!matchToSettle}
        onCancel={() => setMatchToSettle(null)}
        onConfirm={() => {
          if (matchToSettle) {
            settlePvpMutation.mutate(matchToSettle.id)
            setMatchToSettle(null)
          }
        }}
        title={`Force Settle Duel #${matchToSettle?.id ?? ''}`}
        description="This immediately ends an ACTIVE duel, declares a winner, and distributes the prize pool. This cannot be undone."
        confirmText="Force Settle"
        isDestructive={true}
        loading={settlePvpMutation.isPending}
      />

      {/* Action Withdrawal Modal */}
      <Modal
        open={!!actionWithdrawalModal}
        onClose={() => setActionWithdrawalModal(null)}
        title={actionWithdrawalModal?.action === 'paid' ? 'Mark Withdrawal as Paid' : 'Reject & Refund Withdrawal'}
      >
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Request ID:</span>
              <span className="font-mono font-bold text-text">#{actionWithdrawalModal?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Trader User ID:</span>
              <span className="font-mono font-bold text-text">#{actionWithdrawalModal?.user_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Amount:</span>
              <span className="font-mono font-black text-emerald-500">${actionWithdrawalModal?.amount.toFixed(2)} USDC</span>
            </div>
          </div>

          {actionWithdrawalModal?.action === 'paid' ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-text">On-Chain Transaction Reference / Tx Hash <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 0xabc123... or Polygonscan link"
                value={withdrawalTxRef}
                onChange={(e) => setWithdrawalTxRef(e.target.value)}
                className="bg-surface-muted border-border text-text font-mono text-xs"
              />
              <p className="text-2xs text-text-muted">
                This transaction reference will be permanently attached to the ledger transaction row and visible in the audit log.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Refund Confirmation
              </div>
              <p className="text-2xs leading-relaxed opacity-95">
                Rejecting this withdrawal will immediately refund <strong>${actionWithdrawalModal?.amount.toFixed(2)} USDC</strong> back to Trader #{actionWithdrawalModal?.user_id}&apos;s Arena Cash Wallet, and record a <code>pvp_refund</code> transaction in the ledger.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setActionWithdrawalModal(null)}>Cancel</Button>
            {actionWithdrawalModal?.action === 'paid' ? (
              <Button
                disabled={!withdrawalTxRef.trim()}
                loading={pvpWithdrawalActionMutation.isPending}
                onClick={() => {
                  if (actionWithdrawalModal) {
                    pvpWithdrawalActionMutation.mutate({
                      id: actionWithdrawalModal.id,
                      action: 'paid',
                      tx_reference: withdrawalTxRef.trim()
                    })
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirm Paid
              </Button>
            ) : (
              <Button
                loading={pvpWithdrawalActionMutation.isPending}
                onClick={() => {
                  if (actionWithdrawalModal) {
                    pvpWithdrawalActionMutation.mutate({
                      id: actionWithdrawalModal.id,
                      action: 'rejected'
                    })
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Reject & Refund
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Credit Trader Wallet Modal */}
      <Modal
        open={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        title="Credit Trader Arena Wallet"
      >
        <div className="space-y-4 pt-2 text-xs">
          <p className="text-text-muted leading-relaxed">
            Deposit funds directly into a trader&apos;s Arena Cash Wallet. Ideal for manual crypto escrow deposits, promotional credits, or tournament prize bonuses.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">Trader User ID <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              placeholder="e.g. 42"
              value={creditForm.user_id}
              onChange={(e) => setCreditForm({ ...creditForm, user_id: e.target.value })}
              className="bg-surface-muted border-border text-text font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">Amount ($ USDC) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 100"
              value={creditForm.amount}
              onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
              className="bg-surface-muted border-border text-text font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">Transaction / Payment Reference</Label>
            <Input
              placeholder="e.g. CRYPTO-TX-77891 or Escrow Receipt"
              value={creditForm.ref}
              onChange={(e) => setCreditForm({ ...creditForm, ref: e.target.value })}
              className="bg-surface-muted border-border text-text font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-text">Admin Note</Label>
            <Input
              placeholder="e.g. Manual deposit confirmation on Polygon"
              value={creditForm.note}
              onChange={(e) => setCreditForm({ ...creditForm, note: e.target.value })}
              className="bg-surface-muted border-border text-text"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setIsCreditModalOpen(false)}>Cancel</Button>
            <Button
              disabled={!creditForm.user_id || !creditForm.amount || Number(creditForm.amount) <= 0}
              loading={creditWalletMutation.isPending}
              onClick={() => {
                creditWalletMutation.mutate({
                  user_id: Number(creditForm.user_id),
                  amount: Number(creditForm.amount),
                  ref: creditForm.ref.trim(),
                  note: creditForm.note.trim(),
                })
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Credit Wallet
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

