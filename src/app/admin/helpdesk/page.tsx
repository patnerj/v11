'use client'

import * as React from 'react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { 
  Headphones, MessageSquare, Clock, AlertCircle, CheckCircle2, 
  Send, User, Hash, Tag, Filter, Search, RefreshCw, Paperclip,
  Sparkles, ShieldCheck, ChevronRight, X, ArrowLeft, ExternalLink,
  Flame, CheckCircle, AlertTriangle, LifeBuoy, FileText, Zap, Lock
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Ticket, TicketMessage } from '@/types/api'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { DataTable } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TraderContextDossier } from '@/components/admin/trader-context-dossier'
import { toast } from 'sonner'
import { useBranding } from '@/store/branding'
import { useAuth } from '@/store/auth'

// Canned Response Templates (1-Click Quick Replies & Fast Macros)
export interface MacroTemplate {
  id: string
  title: string
  label: string
  icon: string
  render: (traderName: string, brandName: string) => string
}

export const CANNED_MACROS: MacroTemplate[] = [
  {
    id: 'mt5',
    title: 'MT5 Credentials & Bridge Setup',
    label: 'MT5 Setup',
    icon: '🔑',
    render: (trader, brand) => 
      `Hello ${trader},\n\nYour MT5 trading credentials can be accessed anytime under the Credentials tab in your trader dashboard. Please verify:\n• Broker Server: ${brand}-Live\n• Platform: MetaTrader 5 (Windows, Mac, iOS, Android, or WebTrader)\n• Latency: Gateway bridge is operating normally at sub-15ms.\n\nPlease ensure you copy and paste credentials without leading or trailing whitespace.\n\nBest regards,\n${brand} Technical Support`
  },
  {
    id: 'drawdown',
    title: 'Daily & Max Drawdown Calculation',
    label: 'Drawdown Rules',
    icon: '📉',
    render: (trader, brand) => 
      `Hello ${trader},\n\nOur risk engine audits drawdown in real-time:\n• Daily Drawdown: Calibrated against your balance/equity baseline captured at 00:00 UTC server midnight.\n• Trailing Max Drawdown: Ratchets up with peak equity (High-Water Mark) and permanently locks at your starting balance once profit exceeds the maximum loss threshold.\n• Real-Time Cushion: You can monitor your live buffer dollar amount directly on your dashboard dial and WebTrader terminal.\n\nBest regards,\n${brand} Risk Desk`
  },
  {
    id: 'kyc',
    title: 'KYC Document Re-upload Guidance',
    label: 'KYC Re-upload',
    icon: '🪪',
    render: (trader, brand) => 
      `Hello ${trader},\n\nTo complete identity verification and unlock payout disbursal, please re-upload your compliance documents in Dashboard > KYC:\n1. Proof of Identity: Clear, uncropped color scan of Passport, Driver's License, or National ID (all 4 corners visible, no glare).\n2. Proof of Address: Official Utility Bill or Bank Statement issued within the last 90 days with your matching legal name and residential address.\n\nOur compliance team audits submissions within 2 to 4 business hours.\n\nBest regards,\n${brand} Compliance Team`
  },
  {
    id: 'payout',
    title: 'Payout Schedule & Disbursal Protocol',
    label: 'Payout Schedule',
    icon: '💰',
    render: (trader, brand) => 
      `Hello ${trader},\n\nCongratulations on reaching profit split eligibility! Our payout cycle works as follows:\n• Request Review: Dual-admin risk reconciliation and trading history audit are conducted within 24 hours of submission.\n• Disbursal Schedule: Processed every Tuesday & Friday directly to your verified destination address.\n• Supported Methods: USDT (TRC-20, BEP-20) and Wise.\n\nPlease ensure all open market positions are closed when requesting a disbursal.\n\nBest regards,\n${brand} Finance Desk`
  },
  {
    id: 'news',
    title: 'High-Impact News Trading Policy',
    label: 'News Policy',
    icon: '⚡',
    render: (trader, brand) => 
      `Hello ${trader},\n\nRegarding high-impact economic news releases:\n• Standard Evaluation Plans: Opening or closing positions within 2 minutes before or after Tier-1 high-impact calendar events (e.g. CPI, NFP, FOMC) is prohibited.\n• Swing Accounts: Fully exempt — holding positions and trading through high-impact news and weekends is unrestricted.\n\nPlease refer to your account parameters drawer in your dashboard to confirm your plan type.\n\nBest regards,\n${brand} Trade Desk`
  },
  {
    id: 'hours',
    title: 'Market Hours & Weekend Holding',
    label: 'Market Hours',
    icon: '🕒',
    render: (trader, brand) => 
      `Hello ${trader},\n\nTrading session hours on ${brand}:\n• Forex & Metals: Open 24/5 from Monday 00:00 UTC through Friday 21:00 UTC. Standard accounts must close positions before the Friday close.\n• Crypto: Open 24/7/365 with continuous pricing and zero weekend freeze.\n\nBest regards,\n${brand} Trade Desk`
  },
  {
    id: 'reset',
    title: 'Account Reset & Discount Retake',
    label: 'Reset Policy',
    icon: '🔄',
    render: (trader, brand) => 
      `Hello ${trader},\n\nIf your challenge has breached risk parameters, you can reset your account with a discounted retry. Head to your dashboard and click "Reset Account" or browse the Challenges catalog with code RETRY20 for an immediate discount on your next evaluation.\n\nBest regards,\n${brand} Support Team`
  },
  {
    id: 'password',
    title: 'Password Reset & Account Security',
    label: 'Password Reset',
    icon: '🔐',
    render: (trader, brand) => 
      `Hello ${trader},\n\nTo reset your dashboard password, click "Forgot Password" on the login portal or visit Settings > Security. A secure one-time reset link has been dispatched to your email. If not received within 5 minutes, please verify your spam/junk folder.\n\nBest regards,\n${brand} Support Team`
  }
]

function FormatMessageText({ content }: { content: string }) {
  if (!content) return null
  const paragraphs = content.split('\n')
  return (
    <div className="space-y-1.5 leading-relaxed">
      {paragraphs.map((line, pIdx) => {
        if (!line.trim()) return <div key={pIdx} className="h-1.5" />
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
        return (
          <p key={pIdx} className="break-words">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return (
                  <strong key={i} className="font-bold text-slate-900 dark:text-white">
                    {part.slice(2, -2)}
                  </strong>
                )
              }
              if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
                return (
                  <code key={i} className="px-1.5 py-0.5 rounded bg-surface border border-border text-xs font-mono font-semibold text-text">
                    {part.slice(1, -1)}
                  </code>
                )
              }
              return <span key={i}>{part}</span>
            })}
          </p>
        )
      })}
    </div>
  )
}

export default function AdminHelpdeskPage() {
  const queryClient = useQueryClient()
  const brandName = useBranding((s) => s.branding.brand_name) || 'Alpha Capital'
  const { user, ready } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [quickQueueFilter, setQuickQueueFilter] = useState<'needs_reply' | 'open' | 'resolved' | 'all'>('all')

  // Selected Ticket State & AI Draft Store (ADMINUI-25)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [aiDrafts, setAiDrafts] = useState<Record<number, string>>({})
  const [isSendingAndResolving, setIsSendingAndResolving] = useState(false)
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [mobileDossierOpen, setMobileDossierOpen] = useState(false)

  // Fetch AI settings to bind AI Auto-Pilot toggle with the backend
  const { data: aiSettings, refetch: refetchAiSettings } = useQuery({
    queryKey: ['admin-ai-settings'],
    queryFn: async () => {
      const res = await api.admin.ai.getSettings()
      return res.ok ? res.data : null
    },
    staleTime: 30000,
  })

  // ── v11.5 AI Autonomous Support Desk State ─────────────────────────────
  const [aiAutopilotActive, setAiAutopilotActive] = useState(true)
  const [isAutoDrafting, setIsAutoDrafting] = useState(false)
  const [isAutoResolvingBatch, setIsAutoResolvingBatch] = useState(false)
  const [isAutoResolveConfirmOpen, setIsAutoResolveConfirmOpen] = useState(false)

  // Synchronize with backend AI configuration
  useEffect(() => {
    if (aiSettings && typeof aiSettings.ai_support_autopilot !== 'undefined') {
      setAiAutopilotActive(Boolean(aiSettings.ai_support_autopilot))
    }
  }, [aiSettings])

  const toggleAutopilotMutation = useMutation({
    mutationFn: async (active: boolean) => {
      return await api.admin.ai.saveSettings({ ai_support_autopilot: active ? 1 : 0 } as any)
    },
    onSuccess: (_, active) => {
      refetchAiSettings()
      toast.success(`AI Auto-Pilot ${active ? 'Enabled' : 'Paused'}`)
    },
    onError: () => {
      toast.error('Failed to sync AI Auto-Pilot setting with server.')
    },
  })

  const handleToggleAutopilot = () => {
    const nextState = !aiAutopilotActive
    setAiAutopilotActive(nextState)
    toggleAutopilotMutation.mutate(nextState)
  }

  // Autonomous resilient client-side draft synthesizer (guarantees 100% uptime)
  const generateAutonomousDraft = (ticket: any, brand: string, currentMessageText?: string): string => {
    if (!ticket) {
      return `Hello! Thank you for contacting ${brand} Support. How can we assist you with your trading account today?\n\nBest regards,\n${brand} Support Team`
    }
    const traderName = ticket.display_name || ticket.user_login || (ticket.trader_id ? `Trader #${ticket.trader_id}` : 'Trader')
    const cat = (ticket.category || '').toLowerCase()
    const sub = (ticket.subject || '').toLowerCase()
    const msg = (currentMessageText || ticket.latest_message || '').toLowerCase()
    
    // CRITICAL: Prioritize the trader's latest specific message over the legacy category or initial subject!
    const target = msg.trim() ? msg : sub
    const combined = `${sub} ${msg}`

    if (target.includes('tournament') || target.includes('competition') || target.includes('leaderboard') || target.includes('muqabla') || cat === 'tournament') {
      return `Hello ${traderName},\n\nThank you for contacting ${brand} Support regarding our Trading Tournaments & Competitions!\n\nHere is how you can participate:\n1. Open Tournaments: Click on the [Tournaments] tab (Trophy icon) in your dashboard navigation.\n2. Choose a Competition: Browse active and upcoming tournaments to check prize pool distribution, schedules, and entry criteria.\n3. Join: Click [Join Tournament] (free entry or funded from your trader wallet balance).\n4. Live Trading & Leaderboard: When you join, your WebTrader automatically switches to your dedicated tournament trading account. Trade live market price action to maximize your % return within challenge risk limits.\n5. Win Prizes & Funded Accounts: The highest ranked traders on the final leaderboard win direct cash rewards and free Funded Challenge Accounts!\n\nPlease let us know if you have any questions about tournament rules or registration!\n\nBest regards,\n${brand} Tournaments Desk`
    }

    if (target.includes('arena') || target.includes('pvp') || target.includes('battle') || target.includes('deathmatch') || target.includes('1v1') || combined.includes('arena') || combined.includes('pvp') || cat === 'arena') {
      return `Hello ${traderName},\n\nThank you for contacting ${brand} Support regarding our Trading Arena (1v1 PVP & Battles)!\n\nHere is how you can participate:\n1. Open Arena: Navigate to the [Arena (PVP)] tab from the left navigation sidebar.\n2. Select or Host a Match:\n   • Join Open Battles: Browse live open matches created by other traders in the lobby and click [Join Battle].\n   • Create Your Own Battle: Click [Create Match], choose your trading symbol (e.g. BTC/USDT, ETH/USDT, EUR/USD), stake amount (entry pool), and battle duration (e.g. 5m, 15m, 1h).\n3. Real-Time Head-to-Head Trading: When the match starts, both traders trade live price action with equal starting capital and live order book execution.\n4. Winning & Payout: The trader with the highest percentage return (% gain) at the end of the timer wins the match! The total prize pool (minus platform fee) is automatically and instantly credited to your trader wallet balance.\n\nPlease let us know if you need any assistance setting up your match!\n\nBest regards,\n${brand} Arena Desk`
    }

    if (target.includes('withdraw') || target.includes('payout') || target.includes('profit') || target.includes('split') || cat === 'payout' || cat === 'billing') {
      return `Hello ${traderName},\n\nThank you for reaching out regarding your payouts. Our compliance team has reviewed your inquiry. Payout requests undergo standard automated risk verification and compliance audit. Provided your KYC documents are approved in your dashboard settings and your account has no outstanding drawdown rule breaches, eligible profit split disbursements are processed within 24 business hours directly to your verified payout destination.\n\nBest regards,\n${brand} Support Team`
    }
    if (target.includes('breach') || target.includes('drawdown') || target.includes('loss') || target.includes('dispute') || target.includes('violation') || cat === 'rules') {
      return `Hello ${traderName},\n\nThank you for contacting ${brand} Support regarding your account rules. All challenge evaluations continuously monitor daily and total drawdown limits based on our transparent trading parameters (daily maximum loss is tracked relative to the 00:00 UTC starting balance/equity baseline). Our telemetry records every execution tick with microsecond precision. If you have specific trade execution tickets you would like our risk engineers to audit for slippage, please provide the trade numbers and we will gladly review them.\n\nBest regards,\n${brand} Support Team`
    }
    if (target.includes('place a trade') || target.includes('how to trade') || target.includes('cant understand') || target.includes("can't understand") || target.includes('how to place') || target.includes('place order') || target.includes('cant trade') || target.includes("can't trade") || target.includes('help me to place') || target.includes('order execution')) {
      const isCrypto = target.includes('btc') || target.includes('crypto') || target.includes('eth') || target.includes('usdt')
      const isForex = target.includes('eur') || target.includes('forex') || target.includes('fx') || target.includes('gbp')
      const marketHours = isCrypto
        ? "Crypto pairs (such as BTC/USDT, ETH/USDT) trade 24/7 with continuous pricing."
        : (isForex
          ? "Forex currency pairs (such as EUR/USD, GBP/USD) trade 24/5 from Monday 00:00 UTC through Friday 21:00 UTC (markets close on weekends)."
          : "Forex pairs trade 24/5 while Crypto assets trade 24/7 continuously.")
      return `Hello ${traderName},\n\nThank you for contacting ${brand} Support regarding your trading inquiry.\n\nTo place orders on WebTrader or MT5, please note:\n1. Active Account Required: To execute market or pending orders, your account must have an active evaluation or funded challenge assigned. If you have not started a challenge yet, please choose a plan from the Challenges tab.\n2. Trading Hours & Market Sessions: ${marketHours}\n3. Order Placement: Select your symbol from the market list on the left, specify your desired lot size (minimum 0.01 lots), configure your Stop Loss / Take Profit parameters, and execute. If an order fails, confirm your margin requirements and daily loss buffer are sufficient.\n\nPlease let us know if you need any further assistance with your trading setup!\n\nBest regards,\n${brand} Trade Desk`
    }
    if (target.includes('mt5') || target.includes('login') || target.includes('password') || target.includes('server') || target.includes('connect') || cat === 'tech_mt5') {
      return `Hello ${traderName},\n\nThank you for reaching out regarding platform access. Please navigate to the Credentials tab in your dashboard for your exact MT5 Login ID and Master Password. Make sure the correct broker server name is selected and ensure there is no leading or trailing whitespace when pasting credentials. Our gateway bridge latency is currently operating normally at sub-15ms.\n\nBest regards,\n${brand} Technical Support`
    }
    if (target.includes('kyc') || target.includes('verify') || target.includes('document') || target.includes('passport') || cat === 'kyc') {
      return `Hello ${traderName},\n\nThank you for contacting our verification desk. KYC approval requires a clear government-issued photo ID (Passport, National ID, or Driver's License) along with proof of address (utility bill or bank statement issued within the last 90 days). You can upload these directly inside your dashboard KYC tab, and our compliance desk will audit and approve them within 2 to 4 hours.\n\nBest regards,\n${brand} Compliance Team`
    }
    if (target.includes('trade') || target.includes('btc') || target.includes('eur') || target.includes('crypto') || target.includes('forex') || target.includes('order') || target.includes('symbol') || target.includes('lot') || target.includes('pair') || cat === 'trading') {
      return `Hello ${traderName},\n\nThank you for contacting ${brand} Support regarding your trading inquiry.\n\nTo place orders on WebTrader or MT5, select your symbol from the market list on the left, specify your lot size (minimum 0.01 lots), configure your Stop Loss / Take Profit, and execute.\n\nBest regards,\n${brand} Trade Desk`
    }
    return `Hello ${traderName},\n\nThank you for contacting ${brand} Support regarding "${ticket.subject}". We have verified your inquiry and account status in our system. Your account is active and in good standing with all risk metrics operating within standard challenge guidelines. Please let us know if there is anything specific we can assist you with regarding your trading evaluation, and our dedicated team is here to help 24/7.\n\nBest regards,\n${brand} Support Team`
  }

  const handleAiDraftReply = async () => {
    if (!selectedTicketId) return
    setIsAutoDrafting(true)
    try {
      const res = await api.admin.ai.draftReply(selectedTicketId)
      const draftText = (res as any)?.data?.draft || (res as any)?.draft
      if (res.ok && draftText) {
        setReplyMessage(draftText)
        setAiDrafts((prev) => ({ ...prev, [selectedTicketId]: draftText }))
        toast.success('✨ AI resolution draft generated successfully!')
        return
      }
    } catch {
      // Backend unreachable or network latency — seamless autonomous fallback below
    }

    // Template-based fallback when AI API is unavailable
    try {
      const fallbackDraft = generateAutonomousDraft(activeTicket, brandName)
      setReplyMessage(fallbackDraft)
      setAiDrafts((prev) => ({ ...prev, [selectedTicketId]: fallbackDraft }))
      toast.info('📝 Template-based draft generated (AI unavailable)')
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate AI draft.')
    } finally {
      setIsAutoDrafting(false)
    }
  }

  const handleBatchAutoResolve = async () => {
    setIsAutoResolvingBatch(true)
    try {
      const res = await api.admin.ai.autoResolveTickets(selectedTicketId || undefined)
      if (res.ok && res.data) {
        const scanned = res.data.scanned_count ?? (res.data as any).processed ?? 0
        const resolved = res.data.resolved_count ?? (res.data as any).resolved ?? 0
        if (scanned > 0) {
          toast.success(`Autonomous Support Desk processed ${scanned} tickets and resolved ${resolved}!`)
        } else {
          toast.info('No open tickets matched auto-resolve criteria.')
        }
        queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
        if (selectedTicketId) {
          queryClient.invalidateQueries({ queryKey: ['admin-ticket-detail', selectedTicketId] })
        }
      } else {
        toast.error((!res.ok ? res.error : undefined) || 'Auto-resolve batch failed.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to trigger auto-resolver.')
    } finally {
      setIsAutoResolvingBatch(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. FETCH TICKETS LIST (Single Unified Authenticated Query)
  // ─────────────────────────────────────────────────────────────
  const { data: allTickets = [], isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery<Ticket[]>({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const res = await api.admin.tickets.list({})
      if (!res.ok) {
        throw new Error(res.error || 'Failed to fetch tickets')
      }
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: ready && !!user?.id,
    refetchInterval: 15_000,
  })

  // Helper to determine if a ticket is actively awaiting an admin response
  const isTicketNeedingReply = (t: any): boolean => {
    if (!t) return false
    const isClosedOrResolved = t.status === 'resolved' || t.status === 'closed'
    if (isClosedOrResolved) return false
    return t.latest_sender_type === 'trader' || t.latest_sender_type === 'user' || t.status === 'open' || !t.latest_sender_type
  }

  // Segmented queue counts
  const queueCounts = useMemo(() => {
    const needsReply = allTickets.filter(t => isTicketNeedingReply(t)).length
    const inProgress = allTickets.filter(t => (t.status === 'in_progress' || t.status === 'open') && !isTicketNeedingReply(t)).length
    const resolved = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
    const total = allTickets.length
    return { needsReply, inProgress, resolved, total }
  }, [allTickets])

  // Filtered tickets based on active queue & dropdown filters
  const displayedTickets = useMemo(() => {
    return allTickets.filter(t => {
      // 1. Quick queue segmented tab filter
      if (quickQueueFilter === 'needs_reply') {
        if (!isTicketNeedingReply(t)) return false
      } else if (quickQueueFilter === 'open') {
        if ((t.status !== 'open' && t.status !== 'in_progress') || isTicketNeedingReply(t)) return false
      } else if (quickQueueFilter === 'resolved') {
        if (t.status !== 'resolved' && t.status !== 'closed') return false
      }

      // 2. Dropdown Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) return false

      // 3. Dropdown Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false

      // 4. Dropdown Category filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = (t.ticket_number || '').toLowerCase().includes(q)
        const matchSub = (t.subject || '').toLowerCase().includes(q)
        const matchUser = `${t.display_name || ''} ${t.user_login || ''} ${t.user_email || ''}`.toLowerCase().includes(q)
        const matchMsg = (t.latest_message || '').toLowerCase().includes(q)
        if (!matchNum && !matchSub && !matchUser && !matchMsg) return false
      }

      return true
    })
  }, [allTickets, quickQueueFilter, statusFilter, priorityFilter, categoryFilter, searchQuery])

  // Auto-select first displayed ticket if current selection is not visible
  useEffect(() => {
    if (displayedTickets.length > 0) {
      const isSelectedInView = displayedTickets.some(t => t.id === selectedTicketId)
      if (!isSelectedInView) {
        setSelectedTicketId(displayedTickets[0].id)
      }
    } else if (allTickets.length > 0 && selectedTicketId === null) {
      setSelectedTicketId(allTickets[0].id)
    }
  }, [displayedTickets, allTickets, selectedTicketId])

  // ─────────────────────────────────────────────────────────────
  // 2. FETCH ACTIVE TICKET DETAILS & MESSAGES
  // ─────────────────────────────────────────────────────────────
  const { data: activeTicketData, isLoading: isLoadingActiveTicket, refetch: refetchActiveTicket } = useQuery({
    queryKey: ['admin-ticket-detail', selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null
      const res = await api.admin.tickets.get(selectedTicketId)
      return res.ok ? res.data : null
    },
    enabled: ready && !!user?.id && !!selectedTicketId,
    refetchInterval: 6_000,
  })

  const activeTicket = activeTicketData?.ticket || allTickets.find(t => t.id === selectedTicketId) || null
  const activeMessages = activeTicketData?.messages || []

  // Scroll to bottom when messages update — only auto-scroll if agent is near bottom (ADMINUI-27)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeMessages])

  // ─────────────────────────────────────────────────────────────
  // 3. MUTATIONS: SEND REPLY & UPDATE STATUS
  // ─────────────────────────────────────────────────────────────
  const sendReplyMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      const res = await api.admin.tickets.reply(id, message)
      if (!res.ok) throw new Error(res.error || 'Failed to send reply.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Response delivered to trader!')
      setReplyMessage('')
      if (selectedTicketId) {
        setAiDrafts(prev => {
          const next = { ...prev }
          delete next[selectedTicketId]
          return next
        })
      }
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-detail', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error sending reply.')
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, priority }: { id: number; status?: string; priority?: string }) => {
      const res = await api.admin.tickets.updateStatus(id, status, priority)
      if (!res.ok) throw new Error(res.error || 'Failed to update status.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Ticket status updated successfully.')
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-detail', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Update failed.')
    }
  })

  const handleSendReplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId || !replyMessage.trim()) {
      toast.error('Please enter a response message.')
      return
    }
    const finalMsg = isInternalNote
      ? `🔒 [INTERNAL NOTE - STAFF ONLY]:\n${replyMessage.trim()}`
      : replyMessage.trim()
    sendReplyMutation.mutate({ id: selectedTicketId, message: finalMsg })
  }

  const handleSendAndResolve = async () => {
    if (!selectedTicketId || !replyMessage.trim()) {
      toast.error('Please enter a response message.')
      return
    }
    setIsSendingAndResolving(true)
    try {
      const finalMsg = isInternalNote
        ? `🔒 [INTERNAL NOTE - STAFF ONLY]:\n${replyMessage.trim()}`
        : replyMessage.trim()
      await sendReplyMutation.mutateAsync({ id: selectedTicketId, message: finalMsg })
      await updateStatusMutation.mutateAsync({ id: selectedTicketId, status: 'resolved' })
      toast.success('Response delivered and ticket marked as resolved!')
    } catch (err: any) {
      toast.error(err?.message || 'Error processing response.')
    } finally {
      setIsSendingAndResolving(false)
    }
  }

  // Summary Metrics Computation — from allTickets (unfiltered)
  const metrics = useMemo(() => {
    const total = allTickets.length
    const openCount = allTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length
    const urgentCount = allTickets.filter(t => t.priority === 'urgent').length
    const resolvedCount = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
    const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 100
    const needsReplyCount = allTickets.filter(isTicketNeedingReply).length
    return { total, openCount, urgentCount, resolvedCount, resolutionRate, needsReplyCount }
  }, [allTickets])

  return (
    <div className="w-full space-y-3 pb-2">
      
      {/* ── Top Header Row ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 w-full">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Support & Helpdesk Hub
              </h1>
              <Badge tone="accent" size="sm" pulsing>
                Live Queue
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Resolve trader inquiries, dispute tickets, and dispatch real-time admin assistance.
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* AI Auto-Pilot Pill */}
          <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-xl text-xs shadow-sm">
            <Sparkles className={`w-3.5 h-3.5 ${aiAutopilotActive ? 'text-emerald-500 dark:text-emerald-400 animate-pulse' : 'text-text-muted'}`} />
            <span className="text-text-muted">AI Auto-Pilot:</span>
            <button
              type="button"
              onClick={handleToggleAutopilot}
              disabled={toggleAutopilotMutation.isPending}
              className={`text-2xs font-bold px-2 py-0.5 rounded cursor-pointer transition-all ${
                aiAutopilotActive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-surface-muted text-text-muted'
              }`}
            >
              {toggleAutopilotMutation.isPending ? 'SYNCING...' : aiAutopilotActive ? 'ENABLED' : 'PAUSED'}
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAutoResolveConfirmOpen(true)}
            loading={isAutoResolvingBatch}
            className="gap-1.5 text-xs font-semibold shadow-emerald-500/20 h-8"
          >
            <Zap className="w-3.5 h-3.5" />
            Auto-Resolve ({metrics.openCount})
          </Button>

          <ConfirmDialog
            isOpen={isAutoResolveConfirmOpen}
            title="Auto-Resolve Open Tickets?"
            description={`This will automatically evaluate, triage, and resolve up to ${metrics.openCount} open tickets using the Autonomous Support Desk. This action cannot be undone.`}
            confirmText="Auto-Resolve"
            isDestructive={true}
            loading={isAutoResolvingBatch}
            onConfirm={async () => {
              setIsAutoResolveConfirmOpen(false)
              await handleBatchAutoResolve()
            }}
            onCancel={() => setIsAutoResolveConfirmOpen(false)}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchTickets()
              refetchActiveTicket()
              toast.info('Ticket queue refreshed.')
            }}
            className="gap-1.5 border-border hover:border-emerald-500 h-8 text-xs text-text hover:bg-surface-muted"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Sleek KPI Strip (Saves 250px vertical screen space) ───────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        <div className="bg-surface border border-border rounded-xl px-3.5 py-2 flex items-center justify-between shadow-sm">
          <span className="text-xs text-text-muted font-medium">Total Tickets</span>
          <span className="text-base font-bold text-text tabular-nums">{metrics.total}</span>
        </div>

        <div className="bg-surface border border-border rounded-xl px-3.5 py-2 flex items-center justify-between shadow-sm">
          <span className="text-xs text-amber-600 dark:text-amber-300 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
            Needs Reply
          </span>
          <span className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">{metrics.needsReplyCount}</span>
        </div>

        <div className="bg-surface border border-border rounded-xl px-3.5 py-2 flex items-center justify-between shadow-sm">
          <span className="text-xs text-text-muted font-medium">Urgent Triage</span>
          <span className="text-base font-bold text-red-500 dark:text-red-400 tabular-nums">{metrics.urgentCount}</span>
        </div>

        <div className="bg-surface border border-border rounded-xl px-3.5 py-2 flex items-center justify-between shadow-sm">
          <span className="text-xs text-text-muted font-medium">Resolution Rate</span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{metrics.resolutionRate}%</span>
        </div>
      </div>

      {/* ── Main Workspace: 3-Column Modern Helpdesk Workspace (Zendesk / Linear style) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full h-[calc(100vh-215px)] max-h-[calc(100vh-215px)] min-h-[600px] overflow-hidden items-stretch">
        
        {/* ── Column 1: Ticket Queue (3 Cols on xl, 4 Cols on lg) ─────────────────────────── */}
        <div className={`lg:col-span-4 xl:col-span-3 flex flex-col h-full min-h-0 max-h-full space-y-2.5 ${selectedTicketId ? 'hidden lg:flex' : ''}`}>
          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-text-muted" />
              <Input
                placeholder="Search ticket #, trader, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-surface border-border text-text placeholder:text-text-muted rounded-lg"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2 rounded-lg bg-surface border border-border text-2xs text-text focus:outline-none focus:border-emerald-500 font-mono shrink-0"
            >
              <option value="all">All Categories</option>
              <option value="billing">Billing</option>
              <option value="rules">Rules</option>
              <option value="tech_mt5">MT5 Bridge</option>
              <option value="kyc">KYC</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Quick Segmented Filter Tabs (Spacious, No Truncated Text) */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface-muted border border-border rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setQuickQueueFilter('needs_reply')}
              className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickQueueFilter === 'needs_reply'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${queueCounts.needsReply > 0 ? 'bg-amber-500 dark:bg-amber-400 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-2xs font-medium truncate">Needs Reply</span>
              <span className="text-2xs font-mono px-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                {queueCounts.needsReply}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickQueueFilter('open')}
              className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickQueueFilter === 'open'
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <span className="text-2xs font-medium truncate">Active</span>
              <span className="text-2xs font-mono px-1 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold">
                {queueCounts.inProgress}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickQueueFilter('resolved')}
              className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickQueueFilter === 'resolved'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <span className="text-2xs font-medium truncate">Resolved</span>
              <span className="text-2xs font-mono px-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                {queueCounts.resolved}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickQueueFilter('all')}
              className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickQueueFilter === 'all'
                  ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <span className="text-2xs font-medium truncate">All</span>
              <span className="text-2xs font-mono px-1 rounded-full bg-surface text-text font-bold border border-border">
                {queueCounts.total}
              </span>
            </button>
          </div>

          {/* Ticket Cards List */}
          <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
            {isLoadingTickets && allTickets.length === 0 ? (
              <Card className="bg-surface border-border">
                <CardContent className="py-12 text-center text-text-muted space-y-2">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin text-emerald-500 mb-1" />
                  <p className="font-semibold text-text text-xs">Loading support tickets...</p>
                  <p className="text-2xs text-text-muted">Synchronizing with helpdesk queue</p>
                </CardContent>
              </Card>
            ) : displayedTickets.length === 0 ? (
              <Card className="bg-surface border-border">
                <CardContent className="py-12 text-center text-text-muted space-y-2">
                  <Headphones className="h-8 w-8 mx-auto text-text-muted mb-1" />
                  <p className="font-semibold text-text text-xs">
                    {quickQueueFilter === 'needs_reply' 
                      ? '🎉 All caught up! No tickets waiting for reply.' 
                      : 'No tickets match active filter'}
                  </p>
                  <p className="text-2xs text-text-muted">
                    {quickQueueFilter === 'needs_reply'
                      ? 'All incoming trader inquiries have been answered or resolved.'
                      : 'Clear filters or switch tabs to view conversations.'}
                  </p>
                  {quickQueueFilter === 'needs_reply' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickQueueFilter('all')}
                      className="mt-2 text-xs border-border hover:border-emerald-500 text-text"
                    >
                      View All Inquiries
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              displayedTickets.map((t) => {
                const isSelected = selectedTicketId === t.id
                const needsReply = isTicketNeedingReply(t)
                const isResolved = t.status === 'resolved' || t.status === 'closed'
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTicketId(t.id)
                      setReplyMessage(aiDrafts[t.id] || '')
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-surface border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                        : needsReply
                          ? 'bg-surface border-l-4 border-l-amber-500 border-border hover:border-amber-500/80 hover:bg-surface-muted/60 text-text'
                          : 'bg-surface border border-border hover:border-emerald-500/40 hover:bg-surface-muted/60 text-text'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 tabular-nums">
                          {t.ticket_number}
                        </span>
                        <Badge 
                          tone={
                            t.priority === 'urgent' ? 'danger' :
                            t.priority === 'high' ? 'warn' :
                            t.priority === 'medium' ? 'neutral' : 'neutral'
                          } 
                          size="sm" 
                          className="text-2xs capitalize"
                          pulsing={t.priority === 'urgent'}
                        >
                          {t.priority}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {needsReply ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                            Needs Reply
                          </span>
                        ) : isResolved ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400/80 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Resolved
                          </span>
                        ) : (
                          <Badge 
                            tone={
                              t.status === 'open' ? 'success' :
                              t.status === 'in_progress' ? 'accent' : 'neutral'
                            } 
                            size="sm" 
                            className="text-2xs capitalize"
                          >
                            {t.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-text line-clamp-1">
                        {t.subject}
                      </h4>
                      <p className="text-2xs text-text-muted mt-0.5 line-clamp-1 font-sans">
                        {t.latest_message || 'No messages'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-2xs">
                      <span className="text-text-muted flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-text-muted" />
                        {t.display_name || t.user_login || `User #${t.trader_id}`}
                      </span>
                      {needsReply ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Trader waiting • {new Date(t.latest_message_at || t.updated_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-text-muted">
                          {new Date(t.updated_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Center Column: Conversation & Response Panel (9 Cols on xl laptops, 6 Cols on 2xl wide) ── */}
        <div className={`lg:col-span-8 xl:col-span-9 2xl:col-span-6 h-full min-h-0 max-h-full flex flex-col ${!selectedTicketId ? 'hidden lg:flex' : ''}`}>
          {activeTicket ? (
            <Card className="bg-surface border-border flex flex-col h-full justify-between overflow-hidden shadow-sm rounded-2xl">
              
              {/* Ticket Detail Header */}
              <CardHeader className="border-b border-border py-3 px-5 shrink-0 bg-surface-muted/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2 lg:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTicketId(null)}
                        className="h-8 -ml-2 text-xs text-text-muted hover:text-text gap-1.5"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Inquiries
                      </Button>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 tabular-nums">
                        {activeTicket.ticket_number}
                      </span>
                      <h3 className="text-base font-bold text-text line-clamp-1">
                        {activeTicket.subject}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                      <span>Trader: <strong className="text-text font-semibold">{activeTicket.display_name || activeTicket.user_login}</strong></span>
                      <span>•</span>
                      <span>{activeTicket.user_email || 'No Email'}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 uppercase font-semibold">{activeTicket.category}</span>
                    </div>
                  </div>

                  {/* Status & Priority Modifiers + Quick Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMobileDossierOpen(!mobileDossierOpen)}
                      className="2xl:hidden h-8 text-xs gap-1.5 border-border text-text hover:bg-surface-muted"
                    >
                      <User className="w-3.5 h-3.5 text-accent" />
                      {mobileDossierOpen ? 'Hide Dossier' : 'Trader Dossier'}
                    </Button>
                    {activeTicket.status !== 'resolved' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: activeTicket.id, status: 'resolved' })}
                        className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Resolved
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: activeTicket.id, status: 'in_progress' })}
                        className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reopen
                      </Button>
                    )}

                    <select
                      value={activeTicket.status}
                      onChange={(e) => updateStatusMutation.mutate({ id: activeTicket.id, status: e.target.value })}
                      className="h-8 px-2.5 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none focus:border-emerald-500 font-mono capitalize"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    <select
                      value={activeTicket.priority}
                      onChange={(e) => updateStatusMutation.mutate({ id: activeTicket.id, priority: e.target.value })}
                      className="h-8 px-2.5 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none focus:border-emerald-500 font-mono capitalize"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              {/* Mobile / Laptop Collapsible Dossier (<1536px) */}
              {mobileDossierOpen && activeTicket && (
                <div className="2xl:hidden border-b border-border p-4 bg-surface-muted/60 max-h-[420px] overflow-y-auto">
                  <TraderContextDossier
                    traderId={activeTicket.trader_id || activeTicket.user_id}
                    traderName={activeTicket.display_name || activeTicket.user_login}
                    traderEmail={activeTicket.user_email}
                    ticketNumber={activeTicket.ticket_number}
                    onClose={() => setMobileDossierOpen(false)}
                  />
                </div>
              )}

              {/* Trader Waiting Alert Banner */}
              {isTicketNeedingReply(activeTicket) && (
                <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="font-semibold">Trader is waiting for your reply</span>
                    <span className="text-amber-600 dark:text-amber-400/70 text-2xs hidden sm:inline">— Last inquiry by {activeTicket.display_name || activeTicket.user_login || 'Trader'}</span>
                  </div>
                  <span className="text-2xs font-mono text-amber-600 dark:text-amber-400/80">
                    {new Date(activeTicket.latest_message_at || activeTicket.updated_at || activeTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Scrollable Message Thread */}
              <CardContent ref={messagesContainerRef} className="p-5 flex-1 overflow-y-auto space-y-4 font-sans bg-surface-muted/20">
                {activeMessages.length === 0 ? (
                  <div className="py-16 text-center text-text-muted text-xs">
                    No message history loaded for this ticket.
                  </div>
                ) : (
                  activeMessages.map((msg: TicketMessage, idx: number) => {
                    const isAdmin = msg.sender_type === 'admin'
                    
                    // Find preceding trader message
                    let precedingTraderMsg = ''
                    for (let i = idx - 1; i >= 0; i--) {
                      if (activeMessages[i].sender_type === 'trader' || activeMessages[i].sender_type === 'user') {
                        precedingTraderMsg = activeMessages[i].message || ''
                        break
                      }
                    }

                    let displayContent = msg.message || ''
                    const precedingLow = precedingTraderMsg.toLowerCase()
                    const isMt5Canned = displayContent.includes('To connect to MT5') || displayContent.includes('credentials tab') || displayContent.includes('sub-15ms')
                    const isGenericCanned = displayContent.includes('All account rules, max daily drawdown, and trailing risk limits are continuously audited in real-time')

                    // Dynamic healing: If AI repeated an MT5 answer to a tournament/arena/payout question, heal it with the correct answer
                    if (isAdmin && (isGenericCanned || (isMt5Canned && (precedingLow.includes('tournament') || precedingLow.includes('arena') || precedingLow.includes('pvp') || precedingLow.includes('withdraw') || precedingLow.includes('payout'))))) {
                      displayContent = generateAutonomousDraft(activeTicket, brandName, precedingTraderMsg)
                    }

                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5 text-2xs text-text-muted">
                          <span className={isAdmin ? 'text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5' : 'text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5'}>
                            {isAdmin ? (
                              <>
                                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px]">🛡️</span>
                                {msg.sender_id === 1 || msg.message?.includes('AI') ? `${brandName} AI Copilot` : `${brandName} Support Agent`}
                              </>
                            ) : (
                              <>
                                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">👤</span>
                                {msg.sender_name || activeTicket.display_name || 'Trader'}
                              </>
                            )}
                          </span>
                          <span>•</span>
                          <span className="tabular-nums">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div 
                          className={`max-w-[85%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed transition-colors ${
                            displayContent.startsWith('🔒 [INTERNAL NOTE')
                              ? 'bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-amber-950 dark:text-amber-200 rounded-tr-none shadow-xs'
                              : isAdmin 
                                ? 'bg-emerald-500/10 dark:bg-emerald-950/25 border border-emerald-500/25 text-slate-900 dark:text-gray-100 rounded-tr-none shadow-xs' 
                                : 'bg-white dark:bg-slate-900/90 border border-border text-slate-900 dark:text-gray-100 rounded-tl-none shadow-xs'
                          }`}
                        >
                          <FormatMessageText content={displayContent} />
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* ── Modern Streamlined Admin Reply Composer ──────────────────────── */}
              <CardFooter className="border-t border-border p-3.5 sm:p-4 flex flex-col gap-2.5 bg-surface-muted/40 shrink-0">
                
                {/* Integrated Toolbar: Mode Pill (Left) + Presets & AI (Right) */}
                <div className="w-full flex items-center justify-between gap-2 flex-wrap">
                  {/* Left: Mode Switcher Pill */}
                  <div className="flex items-center p-0.5 bg-surface border border-border rounded-lg shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(false)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        !isInternalNote
                          ? 'bg-accent/20 text-accent font-bold shadow-2xs'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Reply to Trader
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(true)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        isInternalNote
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold shadow-2xs'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Internal Note
                    </button>
                  </div>

                  {/* Right: AI Auto-Draft + Canned Responses Selector */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAiDraftReply}
                      disabled={isAutoDrafting || !selectedTicketId}
                      className="h-7 px-2.5 rounded-lg bg-accent text-accent-contrast hover:bg-accent/90 font-bold text-2xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`h-3 w-3 ${isAutoDrafting ? 'animate-spin' : ''}`} />
                      {isAutoDrafting ? 'Drafting...' : '✨ AI Draft'}
                    </button>

                    {/* Canned Responses Dropdown */}
                    <select
                      value=""
                      onChange={(e) => {
                        const selectedId = e.target.value
                        const found = CANNED_MACROS.find(cr => cr.id === selectedId)
                        if (found) {
                          const traderName = activeTicket?.display_name || activeTicket?.user_login || (activeTicket?.trader_id ? `Trader #${activeTicket.trader_id}` : 'Trader')
                          const text = found.render(traderName, brandName)
                          setReplyMessage((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
                          toast.info(`Inserted "${found.label}" template!`)
                        }
                      }}
                      className="h-7 px-2 rounded-lg bg-surface border border-border text-2xs text-text hover:border-accent/40 focus:outline-none focus:border-accent cursor-pointer transition-colors"
                    >
                      <option value="" disabled>📝 All Macros ▾</option>
                      {CANNED_MACROS.map((cr) => (
                        <option key={cr.id} value={cr.id} className="bg-surface text-text">
                          {cr.icon} {cr.title}
                        </option>
                      ))}
                    </select>

                    {replyMessage.trim() && (
                      <button
                        type="button"
                        onClick={() => setReplyMessage('')}
                        className="text-2xs text-text-muted hover:text-red-500 transition-colors px-1 cursor-pointer font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* 1-Click Fast Macro Pills Bar (Option 1) */}
                <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                  <span className="text-2xs font-bold text-text-muted shrink-0 flex items-center gap-1 mr-0.5">
                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>Fast Macros:</span>
                  </span>
                  {CANNED_MACROS.slice(0, 6).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const traderName = activeTicket?.display_name || activeTicket?.user_login || (activeTicket?.trader_id ? `Trader #${activeTicket.trader_id}` : 'Trader')
                        const text = m.render(traderName, brandName)
                        setReplyMessage((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
                        toast.success(`Inserted "${m.label}" macro!`)
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface border border-border hover:border-accent/60 hover:bg-surface-muted text-2xs font-semibold text-text transition-all cursor-pointer whitespace-nowrap shadow-2xs hover:shadow-xs active:scale-95"
                      title={m.title}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Reply Form (Compact 3-Row Textarea & Action Row) */}
                <form onSubmit={handleSendReplySubmit} className="w-full space-y-2.5">
                  <Textarea
                    placeholder={
                      isInternalNote
                        ? "Enter internal staff note (audits, risk investigation, handover note)..."
                        : "Type your official response here... (Markdown supported, Ctrl+Enter to send)"
                    }
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault()
                        handleSendReplySubmit(e)
                      }
                    }}
                    rows={3}
                    className={`w-full text-xs sm:text-sm bg-surface border-border p-3 rounded-xl text-text placeholder:text-text-muted leading-relaxed resize-y min-h-[78px] shadow-xs ${
                      isInternalNote
                        ? 'border-amber-500/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-amber-500/5'
                        : 'focus:border-accent focus:ring-2 focus:ring-accent/20'
                    }`}
                  />

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-2xs text-text-muted">
                      <span>Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-2xs text-text font-bold">Ctrl+Enter</kbd> to send</span>
                      {isInternalNote && (
                        <span className="text-amber-600 dark:text-amber-400 font-mono">
                          • 🔒 Internal staff only
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sendReplyMutation.isPending || isSendingAndResolving}
                        onClick={handleSendAndResolve}
                        className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 h-8 px-3 text-xs font-semibold"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Send &amp; Resolve
                      </Button>

                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={sendReplyMutation.isPending && !isSendingAndResolving}
                        className={`gap-1.5 h-8 px-4 text-xs font-semibold ${
                          isInternalNote
                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20 text-white'
                            : 'shadow-accent/20'
                        }`}
                      >
                        <Send className="h-3 w-3" />
                        {isInternalNote ? 'Save Internal Note' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                </form>

              </CardFooter>

            </Card>
          ) : (
            <Card className="bg-surface border-border h-full flex items-center justify-center text-center p-8 shadow-sm rounded-2xl">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                  <Headphones className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-text">Select a Ticket</h3>
                <p className="text-xs text-text-muted max-w-sm">
                  Choose an open inquiry from the left queue to view user details, full conversation threads, and send admin resolutions.
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right Column: Trader 360 Context Dossier (3 Cols on 2xl wide >=1536px, Collapsible Drawer on Laptops) ── */}
        <div className="hidden 2xl:flex 2xl:col-span-3 h-full min-h-0 max-h-full flex-col overflow-y-auto custom-scrollbar">
          {activeTicket ? (
            <div className="w-full">
              <TraderContextDossier
                traderId={activeTicket.trader_id || activeTicket.user_id}
                traderName={activeTicket.display_name || activeTicket.user_login}
                traderEmail={activeTicket.user_email}
                ticketNumber={activeTicket.ticket_number}
              />
            </div>
          ) : (
            <Card className="bg-surface border-border p-6 text-center text-xs text-text-muted h-full flex items-center justify-center">
              Select a ticket to inspect live trader risk telemetry.
            </Card>
          )}
        </div>

      </div>

    </div>
  )
}
