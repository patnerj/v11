'use client'

import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { 
  Server, Activity, CheckCircle2, AlertTriangle, ShieldAlert,
  Database, Globe, Mail, Lock, Clock, FileCode2, Loader2, XCircle,
  RefreshCw, Cpu, Zap, Radio, ShieldCheck, Power, Flame, Sparkles,
  Sliders, Save, ArrowRight, TrendingUp, AlertOctagon, Wifi, BarChart3,
  Calendar, Filter, Search, Plus, Trash2, SlidersHorizontal, Trophy, RotateCcw,
  CheckCircle, PlayCircle, Award, Copy, Terminal, ExternalLink, AlertCircle, Bug
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { NewsGuardSettings, NewsEvent, TestToolChallenge } from '@/types/api'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Switch } from '@/components/ui/switch'
import { Modal } from '@/components/ui/Modal'
import { Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PriceFeedCard } from '@/components/admin/price-feed-card'
import { RedisCacheCard } from '@/components/admin/redis-cache-card'
import { DisasterRecoveryCard } from '@/components/admin/disaster-recovery-card'
import { SentryMonitoringCard } from '@/components/admin/sentry-monitoring-card'
import { Mt5GatewayMonitorCard } from '@/components/admin/mt5-gateway-monitor-card'
import { toast } from 'sonner'

export default function OperationsHubPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'health' | 'feed' | 'mt5' | 'news' | 'challenges' | 'redis' | 'backup' | 'sentry'>('health')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam === 'challenges' || tabParam === 'mt5' || tabParam === 'feed' || tabParam === 'news' || tabParam === 'health' || tabParam === 'redis' || tabParam === 'backup' || tabParam === 'sentry') {
        setActiveTab(tabParam)
      }
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────
  // CHALLENGE LIFECYCLE & TEST TOOLS STATE
  // ─────────────────────────────────────────────────────────────────
  const [challengeSearch, setChallengeSearch] = useState('')
  const [busyChallengeId, setBusyChallengeId] = useState<number | null>(null)
  const [challengeConfirmTarget, setChallengeConfirmTarget] = useState<{
    challenge: TestToolChallenge
    action: 'phase1' | 'phase2' | 'funded' | 'payout_ready' | 'reset'
  } | null>(null)

  const { data: testChallengesList, isLoading: isTestChallengesLoading, refetch: refetchTestChallenges } = useQuery({
    queryKey: ['admin-test-tools-challenges'],
    queryFn: () => api.admin.testToolsChallenges().then(res => res.ok ? res.data : []),
    staleTime: 5000,
  })

  const safeTestChallengesList: TestToolChallenge[] = useMemo(() => {
    if (Array.isArray(testChallengesList)) return testChallengesList
    if (testChallengesList && typeof testChallengesList === 'object' && Array.isArray((testChallengesList as any).challenges)) {
      return (testChallengesList as any).challenges
    }
    return []
  }, [testChallengesList])

  const executeChallengeAction = async (c: TestToolChallenge, action: 'phase1' | 'phase2' | 'funded' | 'payout_ready' | 'reset') => {
    setBusyChallengeId(c.id)
    try {
      const res = await api.admin.testToolsSet(c.id, action)
      if (res.ok && res.data.success) {
        toast.success(`Challenge #${c.id} (${c.user_login}) updated -> ${res.data.status}`)
        refetchTestChallenges()
        queryClient.invalidateQueries({ queryKey: ['admin-challenges-list'] })
        queryClient.invalidateQueries({ queryKey: ['admin-users-list'] })
      } else {
        toast.error((!res.ok ? res.error : res.data.message) || 'Lifecycle action failed.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Lifecycle action failed.')
    } finally {
      setBusyChallengeId(null)
      setChallengeConfirmTarget(null)
    }
  }

  const handleChallengeActionClick = (c: TestToolChallenge, action: 'phase1' | 'phase2' | 'funded' | 'payout_ready' | 'reset') => {
    // ADMINUI-24: Gate all lifecycle test actions behind confirmation dialog
    setChallengeConfirmTarget({ challenge: c, action })
  }

  // ─────────────────────────────────────────────────────────────────
  // MACRO-ECONOMIC NEWS GUARD STATE
  // ─────────────────────────────────────────────────────────────────
  const [newsSettingsForm, setNewsSettingsForm] = useState<NewsGuardSettings>({
    enabled: true,
    mode: 'hard_gate',
    buffer_before_minutes: 2,
    buffer_after_minutes: 2,
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'],
  })

  const [newsSearch, setNewsSearch] = useState('')
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState('ALL')
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false)
  const [newEventForm, setNewEventForm] = useState<{
    title: string
    currency: string
    impact: 'high' | 'medium' | 'low'
    event_time_utc: string
    source: string
  }>({
    title: '',
    currency: 'USD',
    impact: 'high',
    event_time_utc: '',
    source: 'Economic Calendar',
  })

  const { data: newsSettingsData } = useQuery({
    queryKey: ['admin-news-settings'],
    queryFn: async () => {
      const res = await api.admin.newsSettingsGet()
      return res.ok && res.data ? res.data : null
    },
  })

  useEffect(() => {
    if (newsSettingsData) {
      setNewsSettingsForm(newsSettingsData)
    }
  }, [newsSettingsData])

  const { data: newsEventsData, isLoading: isLoadingNewsEvents, refetch: refetchNewsEvents } = useQuery({
    queryKey: ['admin-news-events'],
    queryFn: async () => {
      const res = await api.admin.newsEvents()
      return res.ok && res.data?.events ? res.data.events : []
    },
    staleTime: 10000,
  })

  const saveNewsSettingsMutation = useMutation({
    mutationFn: async (payload: Partial<NewsGuardSettings>) => {
      const res = await api.admin.newsSettingsSave(payload)
      if (!res.ok) throw new Error(res.error || 'Failed to save news settings.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Macro-Economic News Guard rules updated!')
      queryClient.invalidateQueries({ queryKey: ['admin-news-settings'] })
    },
    onError: (err: any) => {
      toast.error('Save Error: ' + err.message)
    },
  })

  const addEventMutation = useMutation({
    mutationFn: async (payload: typeof newEventForm) => {
      const res = await api.admin.newsEventAdd(payload)
      if (!res.ok) throw new Error(res.error || 'Failed to add news event.')
      return res.data
    },
    onSuccess: () => {
      toast.success('Custom economic event added.')
      setIsAddEventModalOpen(false)
      setNewEventForm({
        title: '',
        currency: 'USD',
        impact: 'high',
        event_time_utc: '',
        source: 'Economic Calendar',
      })
      refetchNewsEvents()
    },
    onError: (err: any) => {
      toast.error('Error: ' + err.message)
    },
  })

  // Emergency Global Switches State
  const [emergencyStates, setEmergencyStates] = useState({
    pauseRegistrations: false,
    freezeTrading: false,
    maintenanceMode: false,
  })

  const [confirmModalState, setConfirmModalState] = useState<{
    open: boolean
    key: keyof typeof emergencyStates | null
    label: string
    actionName: string
    isDangerous: boolean
  }>({
    open: false,
    key: null,
    label: '',
    actionName: '',
    isDangerous: false,
  })

  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  // Hydrate initial state of emergency switches from backend
  useEffect(() => {
    Promise.all([
      api.admin.maintenanceGet(),
      api.admin.whitelabelGet(),
      api.admin.newsLockGet()
    ]).then(([maintRes, wlRes, newsRes]) => {
      const maintEnabled = Boolean(maintRes.ok && maintRes.data?.enabled)
      const wlData = wlRes.ok ? (wlRes.data as any) : {}
      const pauseTrading = wlData?.pause_trading === '1' || wlData?.pause_trading === 1 || wlData?.pause_trading === true
      const newsLocked = Boolean(newsRes.ok && newsRes.data?.locked)
      const pauseRegistrations = wlData?.pause_registrations === '1' || wlData?.pause_registrations === 1 || wlData?.pause_registrations === true

      setEmergencyStates({
        maintenanceMode: maintEnabled,
        freezeTrading: pauseTrading || newsLocked,
        pauseRegistrations: pauseRegistrations
      })
    }).catch(err => {
      console.error('Failed to hydrate emergency switches', err)
    })
  }, [])

  // API Queries for Health
  const { data: healthReport, isLoading: isHealthLoading, refetch } = useQuery({
    queryKey: ['admin-health-deep'],
    queryFn: () => api.admin.health(true).then(res => res.ok ? res.data : null),
    staleTime: 15000,
  })

  // System Health Metric calculations from live report.
  // FAIL-CLOSED: if the API is unreachable we show "unknown", never a fake
  // healthy score — an operator must be able to trust this widget.
  const healthUnknown = !isHealthLoading && !healthReport
  const healthScore = healthReport?.score ?? (healthUnknown ? 0 : 100)
  // Uptime% and response-time figures were previously invented from the
  // health score via a ternary (never actually measured) — this platform
  // doesn't track real uptime/latency telemetry, so showing a fabricated
  // number that LOOKS measured is worse than not showing one. The degraded
  // count and "nominal" summary below are computed from the real per-check
  // states instead of being hardcoded.
  const healthItems = healthReport?.items ? Object.entries(healthReport.items) : []
  const totalChecks = healthItems.length
  const degradedChecks = healthItems.filter(([, item]: [string, any]) => item?.state && item.state !== 'ok').length

  const HEALTH_KEY_CONFIG: Record<string, { name: string; category: string; icon: any }> = {
    php_runtime: { name: 'PHP Runtime & Modules', category: 'Host Environment', icon: Terminal },
    database_tables: { name: 'Database 42-Table Schema', category: 'Storage & Schema', icon: Database },
    permalinks: { name: 'WordPress Routing / Permalinks', category: 'API Connectivity', icon: Globe },
    challenge_plans: { name: 'Challenge Products Catalog', category: 'Storefront & Plans', icon: Trophy },
    trading_symbols: { name: 'Instruments & Liquidity Pairs', category: 'Matching Engine', icon: BarChart3 },
    mt5_feed: { name: 'MT5 Bridge Execution', category: 'Trading Engine', icon: Activity },
    last_price_update: { name: 'Live Price Feed', category: 'Market Data Feed', icon: Radio },
    stripe: { name: 'Stripe Gateway', category: 'Billing & Payments', icon: Globe },
    stripe_webhook: { name: 'Payment Webhooks', category: 'Webhook Stream', icon: Zap },
    smtp: { name: 'SMTP Mail Delivery', category: 'Notifications', icon: Mail },
    rest_api: { name: 'REST API Subsystem', category: 'Core Backend', icon: Server },
    certificates: { name: 'Certificate Engine', category: 'Certificate Studio', icon: ShieldCheck },
    storage: { name: 'Media Storage & Logs', category: 'Storage & Assets', icon: Database },
    cron: { name: 'Scheduled Cron Workers', category: 'Background Tasks', icon: Cpu },
    ssl: { name: 'SSL / TLS Security', category: 'Network Security', icon: Lock },
    redis_cache: { name: 'In-Memory Redis Cache', category: 'High-Speed Memory', icon: Zap },
  }

  const ORDER = [
    'php_runtime', 'database_tables', 'permalinks', 'challenge_plans', 'trading_symbols',
    'redis_cache', 'mt5_feed', 'last_price_update', 'stripe', 'stripe_webhook',
    'smtp', 'rest_api', 'certificates', 'storage', 'cron', 'ssl',
  ] as const

  // Prompt confirmation for emergency controls
  const handleRequestToggle = (key: keyof typeof emergencyStates, label: string) => {
    const currentState = emergencyStates[key]
    const willEnable = !currentState

    setConfirmModalState({
      open: true,
      key,
      label,
      actionName: willEnable ? `Activate ${label}` : `Deactivate ${label}`,
      isDangerous: willEnable,
    })
  }

  const handleConfirmToggle = async () => {
    const { key, label } = confirmModalState
    if (!key) return

    setConfirmModalState(prev => ({ ...prev, open: false }))
    setTogglingKey(key)
    const nextState = !emergencyStates[key]

    try {
      // fxsim() resolves { ok: false } on a failed API call rather than
      // throwing, so the catch block below never sees a rejected request —
      // every result here must be checked explicitly, or a failed toggle
      // (expired session, backend error) still reports "ACTIVATED" while
      // nothing actually changed on the backend.
      let ok = true
      if (key === 'maintenanceMode') {
        ok = (await api.admin.maintenance(nextState, 'Platform maintenance in progress.')).ok
      } else if (key === 'freezeTrading') {
        const r1 = await api.admin.whitelabelSave({ pause_trading: nextState ? '1' : '0' })
        const r2 = await api.admin.newsLock(nextState)
        ok = r1.ok && r2.ok
      } else if (key === 'pauseRegistrations') {
        ok = (await api.admin.whitelabelSave({ pause_registrations: nextState ? '1' : '0' })).ok
      }

      if (!ok) {
        toast.error(`Failed to update ${label} — the backend rejected the request. Nothing was changed.`)
        return
      }

      setEmergencyStates(prev => ({ ...prev, [key]: nextState }))

      if (nextState) {
        toast.error(`EMERGENCY STATE ACTIVATED: ${label} is now active firm-wide!`, {
          duration: 5000,
        })
      } else {
        toast.success(`RESTORED: ${label} has been disabled. Normal operations resumed.`, {
          duration: 4000,
        })
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${label}`)
    } finally {
      setTogglingKey(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // MT5 BRIDGE MANAGER STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────
  const [mt5OpsForm, setMt5OpsForm] = useState({
    server_ip: '127.0.0.1',
    server_port: 443,
    manager_login: '1001',
    manager_pass: '',
    demo_group: 'demo\\forex-eval',
    funded_group: 'real\\funded-pro',
  })

  const { data: mt5OpsData, isLoading: isMt5OpsLoading } = useQuery({
    queryKey: ['admin-mt5-bridge-ops'],
    queryFn: async () => {
      const res = await api.admin.mt5BridgeGet()
      return res.ok && res.data ? res.data : null
    }
  })

  useEffect(() => {
    if (mt5OpsData) {
      setMt5OpsForm((prev) => ({
        ...prev,
        server_ip: mt5OpsData.server_ip || prev.server_ip,
        server_port: Number(mt5OpsData.server_port || prev.server_port),
        manager_login: mt5OpsData.manager_login || prev.manager_login,
        demo_group: mt5OpsData.demo_group || prev.demo_group,
        funded_group: mt5OpsData.funded_group || prev.funded_group,
      }))
    }
  }, [mt5OpsData])

  const saveMt5OpsMutation = useMutation({
    mutationFn: async (payload: typeof mt5OpsForm) => {
      const res = await api.admin.mt5BridgeSave(payload)
      if (!res.ok) throw new Error(res.error || 'Failed to save MT5 configuration')
      return res.data
    },
    onSuccess: () => {
      toast.success('MetaTrader 5 Bridge Gateway settings saved!')
      queryClient.invalidateQueries({ queryKey: ['admin-mt5-bridge-ops'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save MT5 settings')
    }
  })

  const [isTestingMt5Ops, setIsTestingMt5Ops] = useState(false)
  const [mt5OpsPingResult, setMt5OpsPingResult] = useState<{
    connected: boolean
    latency_ms: number
    message: string
  } | null>(null)

  const handleTestMt5Ops = async () => {
    setIsTestingMt5Ops(true)
    setMt5OpsPingResult(null)
    try {
      const res = await api.admin.mt5BridgeTest(mt5OpsForm)
      if (res.ok) {
        setMt5OpsPingResult(res.data)
        toast.success(res.data.message || 'MT5 Gateway ping successful!')
      } else {
        setMt5OpsPingResult({
          connected: false,
          latency_ms: 0,
          message: res.error || 'Connection to MT5 Gateway failed. Check Server IP and Port.'
        })
        toast.error('MT5 ping failed')
      }
    } catch (err: any) {
      setMt5OpsPingResult({
        connected: false,
        latency_ms: 0,
        message: 'Connection error: ' + err.message
      })
      toast.error('MT5 connection error: ' + err.message)
    } finally {
      setIsTestingMt5Ops(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 1-CLICK AUTOMATED HEALTH REPAIR (ADMINUI-23)
  // ─────────────────────────────────────────────────────────────────
  const [isRepairing, setIsRepairing] = useState(false)
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false)
  const [repairConfirmText, setRepairConfirmText] = useState('')

  const handleOpenRepairModal = () => {
    setRepairConfirmText('')
    setIsRepairModalOpen(true)
  }

  const handleAutoRepair = async () => {
    if (repairConfirmText.trim().toUpperCase() !== 'CONFIRM REPAIR') {
      toast.error('Please type "CONFIRM REPAIR" to authorize.')
      return
    }
    setIsRepairing(true)
    try {
      const res = await api.admin.healthRepair()
      if (res.ok && res.data.success) {
        toast.success(res.data.message || 'System self-healing completed successfully!')
        if (res.data.repaired && res.data.repaired.length > 0) {
          res.data.repaired.forEach((action) => {
            toast.info(action, { duration: 4000 })
          })
        }
        await refetch()
        setIsRepairModalOpen(false)
      } else {
        toast.error((res as any).error || 'Self-repair completed with warnings. Check logs.')
        await refetch()
      }
    } catch (err: any) {
      toast.error('Auto-repair failed: ' + err.message)
    } finally {
      setIsRepairing(false)
    }
  }

  // Radial Gauge SVG Parameters
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (circumference * healthScore) / 100

  return (
    <div className="w-full space-y-8 pb-16">
      
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <PageHeader
        title="Operations Hub & Infrastructure"
        description="Global infrastructure health telemetry, server status diagnostics, and master kill-switches."
        badge={{ label: 'Live Operations', tone: 'accent' }}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              loading={isHealthLoading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-check
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleOpenRepairModal}
              disabled={isRepairing}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
            >
              {isRepairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              1-Click Auto-Repair
            </Button>
          </div>
        }
      />

      {/* ── Operations Navigation Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 bg-surface-muted/60 p-1.5 rounded-xl border border-border overflow-x-auto scrollbar-none w-full">
        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'health'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          System Health & Overrides
        </button>

        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'feed'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          Price Feed & Failover
        </button>

        <button
          onClick={() => setActiveTab('mt5')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'mt5'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          MT5 Gateway Bridge
        </button>

        <button
          onClick={() => setActiveTab('news')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'news'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Macro News Guard
        </button>

        <button
          onClick={() => setActiveTab('challenges')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'challenges'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Challenge Lifecycle & Test Tools
        </button>

        <button
          onClick={() => setActiveTab('redis')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'redis'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Redis In-Memory Engine
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'backup'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Disaster Recovery & Encrypted Backups
        </button>

        <button
          onClick={() => setActiveTab('sentry')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'sentry'
              ? 'bg-accent text-primary-foreground font-semibold shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Bug className="h-3.5 w-3.5" />
          Sentry Crash Sentinel
        </button>
      </div>

      {/* ── TAB 1: SYSTEM HEALTH & OVERRIDES ──────────────────────────────── */}
      {activeTab === 'health' && (
        <div className="space-y-8 w-full">
          {/* 1. System Health Radial Indicator & Top Metrics */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            
            {/* Health Score Radial Widget */}
            <Card className="bg-surface border-surface-muted flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Overall System Health
                </CardTitle>
                <CardDescription className="text-xs text-gray-400">
                  Composite index based on latency, error rates, and node uptime
                </CardDescription>
              </CardHeader>

              {isHealthLoading && !healthReport ? (
                <CardContent className="py-8 flex items-center justify-center gap-8">
                  <Skeleton className="h-32 w-32 rounded-full shrink-0" />
                  <div className="space-y-3 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              ) : (
                <CardContent className="py-6 flex items-center justify-center gap-8">
                  {/* SVG Radial Gauge */}
                  <div className="relative flex items-center justify-center">
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle
                        cx="72"
                        cy="72"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-slate-800"
                        fill="transparent"
                      />
                      <circle
                        cx="72"
                        cy="72"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-emerald-500 transition-all duration-1000 ease-out"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className={`text-3xl font-bold font-mono tracking-tight ${healthUnknown ? 'text-warn' : 'text-white'}`}>
                        {healthUnknown ? '—' : healthScore}
                      </span>
                      <span className={`text-2xs uppercase font-bold font-mono tracking-wider ${healthUnknown ? 'text-warn' : 'text-emerald-400'}`}>
                        {healthUnknown ? 'Data unavailable' : 'Operational'}
                      </span>
                    </div>
                  </div>

                  {/* Health Specs */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-gray-500 block">Checks Passing</span>
                      <span className="font-mono font-bold text-white text-base">{healthUnknown ? '—' : `${totalChecks - degradedChecks} / ${totalChecks}`}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Degraded / Warning</span>
                      <span className={`font-mono font-bold text-sm ${degradedChecks > 0 ? 'text-amber-400' : 'text-gray-300'}`}>{healthUnknown ? '—' : `${degradedChecks} Service${degradedChecks === 1 ? '' : 's'}`}</span>
                    </div>
                  </div>
                </CardContent>
              )}

              <CardFooter className="pt-0 border-t border-surface-muted/50 text-xs text-gray-400">
                {isHealthLoading && !healthReport ? (
                  <span className="flex items-center gap-1.5 text-text-muted font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" /> Auditing operational endpoints...
                  </span>
                ) : healthUnknown ? (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> Health API unreachable — status unknown
                  </span>
                ) : degradedChecks === 0 ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All {totalChecks} systems nominal
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> {degradedChecks} of {totalChecks} systems degraded or in warning
                  </span>
                )}
              </CardFooter>
            </Card>

            {/* Master Emergency Control Panel (Wide 2-Columns) */}
            <Card className="lg:col-span-2 bg-surface border-red-500/30 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
              
              <CardHeader className="pb-3 border-b border-surface-muted/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-red-400 flex items-center gap-2 font-bold">
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                    Emergency Global Control Panel
                  </CardTitle>
                  <Badge tone="danger" size="sm" className="font-mono">
                    Master Kill-Switches
                  </Badge>
                </div>
                <CardDescription className="text-xs text-gray-400">
                  High-priority operational overrides for extreme volatility, market anomalies, or planned maintenance.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                
                {/* Switch 1: Pause New Registrations */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-surface-muted bg-background hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100">Pause New Registrations</span>
                      {emergencyStates.pauseRegistrations && (
                        <Badge tone="danger" size="sm">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Instantly block checkout flow and new challenge account purchases firm-wide.
                    </p>
                  </div>
                  <Switch
                    checked={emergencyStates.pauseRegistrations}
                    disabled={togglingKey === 'pauseRegistrations'}
                    onCheckedChange={() => handleRequestToggle('pauseRegistrations', 'New Registrations Lock')}
                  />
                </div>

                {/* Switch 2: Global Trading Freeze */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-surface-muted bg-background hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100">Global Trading Execution Freeze</span>
                      {emergencyStates.freezeTrading && (
                        <Badge tone="danger" size="sm">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Instantly reject all new market and pending orders across all trader evaluation accounts.
                    </p>
                  </div>
                  <Switch
                    checked={emergencyStates.freezeTrading}
                    disabled={togglingKey === 'freezeTrading'}
                    onCheckedChange={() => handleRequestToggle('freezeTrading', 'Trading Execution Freeze')}
                  />
                </div>

                {/* Switch 3: Scheduled Platform Maintenance */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-surface-muted bg-background hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100">Full Platform Maintenance Mode</span>
                      {emergencyStates.maintenanceMode && (
                        <Badge tone="danger" size="sm">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Display global maintenance splash screen on client portal and restrict login to Super Admins.
                    </p>
                  </div>
                  <Switch
                    checked={emergencyStates.maintenanceMode}
                    disabled={togglingKey === 'maintenanceMode'}
                    onCheckedChange={() => handleRequestToggle('maintenanceMode', 'Maintenance Mode')}
                  />
                </div>

              </CardContent>

              <CardFooter className="pt-3 border-t border-surface-muted/50 text-xs text-amber-400/90 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Actions here execute immediately and log audit trails to the compliance database.</span>
              </CardFooter>
            </Card>

          </section>

          {/* ── 2. Infrastructure Health (Dynamic Live Telemetry Grid) ─────────── */}
          <section className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-400" />
                Live Subsystem Telemetry & Service Checks ({healthReport?.items ? Object.keys(healthReport.items).length : 0})
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-mono">
                  {healthReport?.generated_at ? `Checked ${new Date(healthReport.generated_at * 1000).toLocaleTimeString()}` : 'Polling live checks'}
                </span>
                <Button size="sm" variant="outline" onClick={() => refetch()} loading={isHealthLoading} className="h-8 text-xs gap-1.5">
                  <RefreshCw className="h-3 w-3" /> Re-check
                </Button>
                <Button size="sm" onClick={handleAutoRepair} loading={isRepairing} className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-200" /> 1-Click Auto-Repair
                </Button>
              </div>
            </div>

            {/* Anomaly & Self-Healing Action Banner */}
            {degradedChecks > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-amber-300 text-xs">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <span className="font-bold block text-amber-200">Attention Required: {degradedChecks} system check(s) degraded or missing.</span>
                    <span className="text-amber-300/80">Automated repair can recreate database tables, fix permalinks, seed challenge tiers, and reschedule background crons.</span>
                  </div>
                </div>
                <Button size="sm" onClick={handleAutoRepair} loading={isRepairing} className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0">
                  <Sparkles className="h-3.5 w-3.5" /> Execute 1-Click Self-Healing
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {ORDER.map((key) => {
                const item = healthReport?.items?.[key]
                if (!item) return null
                const conf = HEALTH_KEY_CONFIG[key] || { name: item.label, category: 'Subsystem', icon: Server }
                const Icon = conf.icon
                const tone = item.state === 'ok' ? 'success' : item.state === 'warn' ? 'accent' : 'danger'
                const statusLabel = item.state === 'ok' ? 'Operational' : item.state === 'warn' ? 'Warning' : 'Degraded'

                return (
                  <Card 
                    key={key} 
                    className="bg-surface border-surface-muted hover:border-emerald-500/30 transition-all duration-200"
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            item.state === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            item.state === 'warn' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-100">{item.label || conf.name}</h4>
                            <span className="text-2xs text-gray-500 font-mono">{conf.category}</span>
                          </div>
                        </div>

                        <Badge tone={tone as any} size="sm" className="font-mono text-2xs">
                          {statusLabel}
                        </Badge>
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed font-mono">
                        {item.detail || 'Service responding within normal operating thresholds.'}
                        {item.explain && (
                          <span className="block text-2xs text-gray-500 mt-1">({item.explain})</span>
                        )}
                      </p>

                      <div className="pt-2 border-t border-surface-muted/50 flex items-center justify-between text-xs font-mono text-gray-500">
                        <span>Check Status: <strong className={item.state === 'ok' ? 'text-emerald-400' : item.state === 'warn' ? 'text-amber-400' : 'text-rose-400'}>{item.state.toUpperCase()}</strong></span>
                        <span>{item.ts ? `TS: ${new Date(item.ts * 1000).toLocaleTimeString()}` : 'Live'}</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Any extra dynamically added backend check items */}
              {healthReport?.items && Object.entries(healthReport.items)
                .filter(([k]) => !(ORDER as readonly string[]).includes(k))
                .map(([key, item]) => {
                  const tone = item.state === 'ok' ? 'success' : item.state === 'warn' ? 'accent' : 'danger'
                  return (
                    <Card key={key} className="bg-surface border-surface-muted">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-100">{item.label || key}</h4>
                          <Badge tone={tone as any} size="sm">{item.state}</Badge>
                        </div>
                        <p className="text-xs text-gray-400 font-mono">{item.detail}</p>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </section>
        </div>
      )}

      {/* ── TAB 2: PRICE FEED ENGINE & FAILOVER ────────────────────────────── */}
      {activeTab === 'feed' && (
        <div className="space-y-6 max-w-4xl">
          <PriceFeedCard />
        </div>
      )}

      {/* ── TAB 3: MT5 BRIDGE GATEWAY ──────────────────────────────────────── */}
      {activeTab === 'mt5' && (
        <div className="space-y-6 max-w-4xl">
          <Mt5GatewayMonitorCard />

          <Card className="bg-surface border-border text-text shadow-card">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-text flex items-center gap-2">
                  <Server className="h-4 w-4 text-accent" />
                  MetaTrader 5 Manager Gateway Settings
                </CardTitle>
                <Badge tone="accent" size="sm">Bridge Protocol</Badge>
              </div>
              <CardDescription className="text-xs text-text-muted">
                Direct integration with MetaTrader 5 Manager API for automatic account provisioning, group assignments, and real-time equity synchronization.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              
              {/* Server IP & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="mt5-ops-ip">MT5 Server IP / Hostname</Label>
                  <Input
                    id="mt5-ops-ip"
                    placeholder="127.0.0.1 or mt5.yourbroker.com"
                    value={mt5OpsForm.server_ip}
                    onChange={(e) => setMt5OpsForm({ ...mt5OpsForm, server_ip: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mt5-ops-port">Server Port</Label>
                  <Input
                    id="mt5-ops-port"
                    type="number"
                    placeholder="443"
                    value={mt5OpsForm.server_port}
                    onChange={(e) => setMt5OpsForm({ ...mt5OpsForm, server_port: Number(e.target.value) })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Manager Login & Pass */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mt5-ops-login">MT5 Manager Login ID</Label>
                  <Input
                    id="mt5-ops-login"
                    placeholder="1001"
                    value={mt5OpsForm.manager_login}
                    onChange={(e) => setMt5OpsForm({ ...mt5OpsForm, manager_login: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mt5-ops-pass">Manager Password / API Secret</Label>
                  <Input
                    id="mt5-ops-pass"
                    type="password"
                    placeholder="••••••••••••"
                    value={mt5OpsForm.manager_pass}
                    onChange={(e) => setMt5OpsForm({ ...mt5OpsForm, manager_pass: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Group Mappings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                <div className="space-y-1.5">
                  <Label htmlFor="mt5-ops-demo-group">Demo / Evaluation Group Mapping</Label>
                  <Input
                    id="mt5-ops-demo-group"
                    placeholder="demo\forex-eval"
                    value={mt5OpsForm.demo_group}
                    onChange={(e) => setMt5OpsForm({ ...mt5OpsForm, demo_group: e.target.value })}
                    className="font-mono text-xs"
                  />
                  <span className="text-2xs text-text-muted">Group assigned for Phase 1 & 2 accounts</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mt5-ops-funded-group">Live / Funded Group Mapping</Label>
                  <Input
                    id="mt5-ops-funded-group"
                    placeholder="real\funded-pro"
                    value={mt5OpsForm.funded_group}
                    onChange={(e) => setMt5OpsForm({ ...mt5OpsForm, funded_group: e.target.value })}
                    className="font-mono text-xs"
                  />
                  <span className="text-2xs text-text-muted">Group assigned when passing into Funded status</span>
                </div>
              </div>

              {/* Ping Gateway Diagnostic Card */}
              <div className="p-4 rounded-xl border border-border-subtle bg-surface-muted/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-accent" />
                    <span className="text-xs font-bold text-text">Live MT5 Gateway Connection Ping</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestMt5Ops}
                    loading={isTestingMt5Ops}
                    className="text-xs gap-1.5 border-border hover:bg-surface"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Test MT5 Manager Connection
                  </Button>
                </div>

                {mt5OpsPingResult && (
                  <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    mt5OpsPingResult.connected
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-danger/30 bg-danger/10 text-danger'
                  }`}>
                    <div className="flex items-center gap-2">
                      {mt5OpsPingResult.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                      ) : (
                        <AlertOctagon className="h-4 w-4 text-danger shrink-0" />
                      )}
                      <span className="text-text">{mt5OpsPingResult.message}</span>
                    </div>
                    {mt5OpsPingResult.connected && (
                      <Badge tone="success" size="sm" className="font-mono">
                        Latency: {mt5OpsPingResult.latency_ms}ms
                      </Badge>
                    )}
                  </div>
                )}
              </div>

            </CardContent>

            <CardFooter className="border-t border-border-subtle p-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => saveMt5OpsMutation.mutate(mt5OpsForm)}
                loading={saveMt5OpsMutation.isPending}
                className="gap-1.5 shadow-accent/20"
              >
                <Save className="h-4 w-4" />
                Save MT5 Gateway Settings
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ── TAB 4: MACRO-ECONOMIC NEWS GUARD & CALENDAR ───────────────────── */}
      {activeTab === 'news' && (
        <div className="space-y-8 w-full">
          
          {/* Top Actions & Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-400" />
                Macro-Economic News Guard & High-Impact Calendar
              </h2>
              <p className="text-xs text-gray-400">
                Institutional news restriction engine. Automates order rejection or breach auditing for trades placed around red-folder releases.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchNewsEvents()}
                className="text-xs gap-1.5 border-surface-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Feed
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => saveNewsSettingsMutation.mutate(newsSettingsForm)}
                loading={saveNewsSettingsMutation.isPending}
                className="gap-1.5 shadow-emerald-500/20"
              >
                <Save className="h-4 w-4" />
                Save News Guard Rules
              </Button>
            </div>
          </div>

          {/* 1. Configuration & Rules Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Engine Controls & Gating Mode */}
            <Card className="bg-surface border-surface-muted lg:col-span-2">
              <CardHeader className="border-b border-surface-muted/60 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-gray-100">News Guard Enforcement Engine</CardTitle>
                      <CardDescription className="text-xs text-gray-400">
                        Intercepts buy/sell orders during high-volatility economic announcements.
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={newsSettingsForm.enabled ? 'success' : 'neutral'} size="sm">
                      {newsSettingsForm.enabled ? '🟢 Guard Armed' : '⚪ Guard Standby'}
                    </Badge>
                    <Switch
                      checked={newsSettingsForm.enabled}
                      onCheckedChange={(checked) => setNewsSettingsForm({ ...newsSettingsForm, enabled: checked })}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                
                {/* Enforcement Mode Selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-300">Enforcement Mode</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewsSettingsForm({ ...newsSettingsForm, mode: 'hard_gate' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        newsSettingsForm.mode === 'hard_gate'
                          ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                          : 'border-surface-muted bg-background hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          🛑 Hard Gate (Reject Order)
                        </span>
                        {newsSettingsForm.mode === 'hard_gate' && (
                          <Badge tone="success" size="sm">Default</Badge>
                        )}
                      </div>
                      <p className="text-2xs text-gray-400 leading-relaxed">
                        Instantly blocks order submissions within the buffer window with HTTP 400 error.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewsSettingsForm({ ...newsSettingsForm, mode: 'soft_breach' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        newsSettingsForm.mode === 'soft_breach'
                          ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                          : 'border-surface-muted bg-background hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          ⚠️ Soft Breach (Tag & Audit)
                        </span>
                        {newsSettingsForm.mode === 'soft_breach' && (
                          <Badge tone="warning" size="sm">Audit Mode</Badge>
                        )}
                      </div>
                      <p className="text-2xs text-gray-400 leading-relaxed">
                        Allows order to execute, but logs violation audit to deduct profits during payout review.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Buffer Windows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-surface-muted/60">
                  <div className="space-y-1.5">
                    <Label htmlFor="buffer-before" className="text-xs font-semibold text-gray-300">
                      Minutes Before Event (Pre-News Buffer)
                    </Label>
                    <div className="relative">
                      <Input
                        id="buffer-before"
                        type="number"
                        min="1"
                        max="60"
                        value={newsSettingsForm.buffer_before_minutes}
                        onChange={(e) => setNewsSettingsForm({ ...newsSettingsForm, buffer_before_minutes: parseInt(e.target.value) || 2 })}
                        className="font-mono text-xs pr-12"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-500 font-mono">min</span>
                    </div>
                    <span className="text-2xs text-gray-500">Standard market rule: 2 to 5 minutes before</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="buffer-after" className="text-xs font-semibold text-gray-300">
                      Minutes After Event (Post-News Buffer)
                    </Label>
                    <div className="relative">
                      <Input
                        id="buffer-after"
                        type="number"
                        min="1"
                        max="60"
                        value={newsSettingsForm.buffer_after_minutes}
                        onChange={(e) => setNewsSettingsForm({ ...newsSettingsForm, buffer_after_minutes: parseInt(e.target.value) || 2 })}
                        className="font-mono text-xs pr-12"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-500 font-mono">min</span>
                    </div>
                    <span className="text-2xs text-gray-500">Standard market rule: 2 to 5 minutes after</span>
                  </div>
                </div>

                {/* Monitored Currencies */}
                <div className="space-y-2 pt-2 border-t border-surface-muted/60">
                  <Label className="text-xs font-semibold text-gray-300">Active Currencies & Cross Pairs Monitored</Label>
                  <div className="flex flex-wrap gap-2">
                    {['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'].map((c) => (
                      <span key={c} className="px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="text-2xs text-gray-500">
                    Also protects derived assets: Gold (`XAUUSD`), US Indices (`US30`, `NAS100`, `SPX500`), and Oil (`WTI`, `BRENT`).
                  </p>
                </div>

              </CardContent>
            </Card>

            {/* Card 2: Quick Telemetry & Calendar Summary */}
            <Card className="bg-surface border-surface-muted flex flex-col justify-between">
              <CardHeader className="border-b border-surface-muted/60 pb-4">
                <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Live Guard Status
                </CardTitle>
                <CardDescription className="text-xs text-gray-400">
                  Real-time synchronization with institutional economic data feeds.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="p-3.5 rounded-xl bg-background border border-surface-muted space-y-1">
                  <span className="text-2xs text-gray-500 uppercase tracking-wider font-semibold">Feed Source</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Central Banks & Economic Calendars</span>
                    <Badge tone="success" size="sm">Online</Badge>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-background border border-surface-muted space-y-1">
                  <span className="text-2xs text-gray-500 uppercase tracking-wider font-semibold">Upcoming Red Folders</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white font-mono">{newsEventsData?.length || 0} Events</span>
                    <Badge tone="danger" size="sm">Next 7 Days</Badge>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-background border border-surface-muted space-y-1">
                  <span className="text-2xs text-gray-500 uppercase tracking-wider font-semibold">Active Restriction Window</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      ±{newsSettingsForm.buffer_before_minutes}m ({newsSettingsForm.buffer_before_minutes + newsSettingsForm.buffer_after_minutes} min total)
                    </span>
                    <Badge tone="accent" size="sm">Automated</Badge>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddEventModalOpen(true)}
                    className="w-full text-xs gap-1.5 border-surface-muted hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Custom Economic Release
                  </Button>
                </div>
              </CardContent>

              <CardFooter className="border-t border-surface-muted/60 p-4 text-2xs text-gray-500">
                <span>Updates automatically every 60 minutes via server cron.</span>
              </CardFooter>
            </Card>

          </div>

          {/* 2. Upcoming High-Impact Events Table */}
          <Card className="bg-surface border-surface-muted">
            <CardHeader className="border-b border-surface-muted/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    Upcoming High-Impact Events (Next 7 Days)
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-400">
                    Live schedule of red-folder macroeconomic releases triggering automated buffer restrictions.
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-500" />
                    <Input
                      placeholder="Filter events..."
                      value={newsSearch}
                      onChange={(e) => setNewsSearch(e.target.value)}
                      className="pl-8 text-xs h-8 w-44 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-surface-muted text-xs">
                    {['ALL', 'USD', 'EUR', 'GBP', 'JPY'].map((cur) => (
                      <button
                        key={cur}
                        onClick={() => setSelectedCurrencyFilter(cur)}
                        className={`px-2 py-1 rounded text-2xs font-bold transition-all ${
                          selectedCurrencyFilter === cur
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-background/80 border-b border-surface-muted text-gray-400 font-semibold uppercase tracking-wider text-2xs">
                    <tr>
                      <th className="px-5 py-3">Date & Time (UTC)</th>
                      <th className="px-4 py-3">Currency</th>
                      <th className="px-5 py-3">Event / Release Name</th>
                      <th className="px-4 py-3">Impact</th>
                      <th className="px-4 py-3">Source / Institution</th>
                      <th className="px-5 py-3 text-right">Buffer Window</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-muted/50 text-gray-200">
                    {isLoadingNewsEvents ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading economic calendar feed...
                        </td>
                      </tr>
                    ) : (newsEventsData || []).filter((e: NewsEvent) => {
                      const matchesSearch = !newsSearch || e.title.toLowerCase().includes(newsSearch.toLowerCase()) || e.currency.toLowerCase().includes(newsSearch.toLowerCase())
                      const matchesCur = selectedCurrencyFilter === 'ALL' || e.currency === selectedCurrencyFilter
                      return matchesSearch && matchesCur
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                          No economic events found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      (newsEventsData || [])
                        .filter((e: NewsEvent) => {
                          const matchesSearch = !newsSearch || e.title.toLowerCase().includes(newsSearch.toLowerCase()) || e.currency.toLowerCase().includes(newsSearch.toLowerCase())
                          const matchesCur = selectedCurrencyFilter === 'ALL' || e.currency === selectedCurrencyFilter
                          return matchesSearch && matchesCur
                        })
                        .map((evt: NewsEvent) => {
                          return (
                            <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-5 py-3 font-mono font-medium text-gray-200 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 text-gray-500" />
                                  <span>{evt.event_time_utc} UTC</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-800 border border-slate-700 text-white">
                                  {evt.currency}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-semibold text-white">
                                {evt.title}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {/* Was hardcoded to "High Impact" for every row regardless of
                                    the event's real impact — the desk couldn't tell which
                                    events actually gate trading. */}
                                {evt.impact === 'high' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold bg-red-500/10 border border-red-500/30 text-red-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                                    High Impact
                                  </span>
                                ) : evt.impact === 'medium' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    Medium Impact
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-700/40 border border-slate-600 text-gray-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                    Low Impact
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-2xs whitespace-nowrap">
                                {evt.source || 'Central Bank / Bureau'}
                              </td>
                              <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                ±{newsSettingsForm.buffer_before_minutes}m active
                              </td>
                            </tr>
                          )
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* ── TAB 5: CHALLENGE LIFECYCLE & TEST TOOLS ──────────────────────── */}
      {activeTab === 'challenges' && (
        <div className="space-y-6 w-full">
          {/* Header & Safeguard Alert */}
          <Card className="bg-surface border-surface-muted">
            <CardHeader className="pb-3 border-b border-surface-muted/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                    Challenge Lifecycle & Test Tools Controller
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-400 mt-1">
                    Direct operational overrides to force evaluation phases, promote accounts to funded, or test profit payouts.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <Input
                      placeholder="Search user, login, or #ID..."
                      value={challengeSearch}
                      onChange={(e) => setChallengeSearch(e.target.value)}
                      className="pl-8 h-9 text-xs w-56 bg-background border-surface-muted"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchTestChallenges()}
                    loading={isTestChallengesLoading}
                    className="h-9 text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 bg-amber-500/5 border-b border-surface-muted/50 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90 leading-relaxed font-mono">
                <strong>Operational Override Notice:</strong> These controls bypass the automated trading rule evaluation engine to directly modify account lifecycle state for customer support and test simulation purposes. Actions take effect immediately.
              </p>
            </CardContent>
          </Card>

          {/* Challenges Table */}
          <Card className="bg-surface border-surface-muted">
            <CardContent className="p-0">
              {isTestChallengesLoading ? (
                <div className="p-8 text-center text-xs text-gray-400 font-mono flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Loading challenge accounts...
                </div>
              ) : safeTestChallengesList.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-500 font-mono">
                  No challenge accounts found in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-background border-b border-surface-muted text-gray-400 uppercase tracking-wider font-mono text-2xs">
                      <tr>
                        <th className="py-3 px-4">Account / Trader</th>
                        <th className="py-3 px-4">Challenge Plan</th>
                        <th className="py-3 px-4">Phase</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Simulated Balance</th>
                        <th className="py-3 px-4 text-right">Lifecycle Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-muted/60">
                      {safeTestChallengesList
                        .filter((c: TestToolChallenge) => {
                          const q = challengeSearch.trim().toLowerCase()
                          if (!q) return true
                          return (
                            (c.user_login || '').toLowerCase().includes(q) ||
                            (c.display_name || '').toLowerCase().includes(q) ||
                            (c.plan_name || '').toLowerCase().includes(q) ||
                            String(c.id) === q ||
                            String(c.user_id) === q
                          )
                        })
                        .map((c: TestToolChallenge) => {
                          const isBusy = busyChallengeId === c.id
                          const statusTone = c.status === 'funded' ? 'success' : c.status === 'passed' ? 'accent' : c.status === 'failed' ? 'danger' : 'neutral'
                          return (
                            <tr key={c.id} className="hover:bg-[#1A2234]/50 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-white flex items-center gap-2">
                                  <span>{c.display_name || c.user_login}</span>
                                  <span className="text-2xs font-mono text-gray-500">#{c.id}</span>
                                </div>
                                <div className="text-2xs text-gray-400 font-mono mt-0.5">
                                  User #{c.user_id} • @{c.user_login}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-gray-300">
                                {c.plan_name || 'Standard Challenge'}
                              </td>

                              <td className="py-3.5 px-4">
                                <Badge tone="accent" size="sm" className="font-mono">
                                  Phase {c.phase}
                                </Badge>
                              </td>

                              <td className="py-3.5 px-4">
                                <Badge tone={statusTone as any} size="sm" className="font-mono capitalize">
                                  {c.status}
                                </Badge>
                              </td>

                              <td className="py-3.5 px-4 font-mono">
                                <div className="text-white font-bold">
                                  ${Number(c.current_balance || 0).toLocaleString()}
                                </div>
                                <div className="text-2xs text-gray-500">
                                  Start: ${Number(c.starting_balance || 0).toLocaleString()}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleChallengeActionClick(c, 'phase1')}
                                    className="h-7 text-2xs px-2 border-surface-muted hover:border-emerald-500/50 hover:text-emerald-400"
                                    title="Mark Phase 1 Passed"
                                  >
                                    Phase 1 ✓
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleChallengeActionClick(c, 'phase2')}
                                    className="h-7 text-2xs px-2 border-surface-muted hover:border-blue-500/50 hover:text-blue-400"
                                    title="Mark Phase 2 Passed"
                                  >
                                    Phase 2 ✓
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="primary"
                                    disabled={isBusy}
                                    onClick={() => handleChallengeActionClick(c, 'funded')}
                                    className="h-7 text-2xs px-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                                    title="Promote directly to Funded Status"
                                  >
                                    <Trophy className="h-3 w-3 mr-1" /> Funded
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleChallengeActionClick(c, 'payout_ready')}
                                    className="h-7 text-2xs px-2 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                                    title="Fund account and credit test simulated profit for payout testing"
                                  >
                                    Payout Ready
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={isBusy}
                                    onClick={() => handleChallengeActionClick(c, 'reset')}
                                    className="h-7 text-2xs px-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                    title="Reset account to Phase 1"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lifecycle Action Safeguard Dialog (ADMINUI-24) */}
          <ConfirmDialog
            isOpen={!!challengeConfirmTarget}
            title={
              challengeConfirmTarget?.action === 'reset' 
                ? `Reset Challenge #${challengeConfirmTarget?.challenge.id}?` 
                : challengeConfirmTarget?.action === 'payout_ready'
                ? `Simulate Payout Ready for Challenge #${challengeConfirmTarget?.challenge.id}?`
                : challengeConfirmTarget?.action === 'phase1'
                ? `Mark Phase 1 Passed for Challenge #${challengeConfirmTarget?.challenge.id}?`
                : challengeConfirmTarget?.action === 'phase2'
                ? `Mark Phase 2 Passed for Challenge #${challengeConfirmTarget?.challenge.id}?`
                : `Force-Promote Challenge #${challengeConfirmTarget?.challenge.id} to Funded?`
            }
            description={
              challengeConfirmTarget?.action === 'reset'
                ? `This will reset ${challengeConfirmTarget?.challenge.user_login}'s account back to Phase 1 with starting balance restored to $${Number(challengeConfirmTarget?.challenge.starting_balance || 0).toLocaleString()}.`
                : challengeConfirmTarget?.action === 'payout_ready'
                ? `This will promote ${challengeConfirmTarget?.challenge.user_login}'s account to Funded and inject simulated profit to test the payout request lifecycle.`
                : challengeConfirmTarget?.action === 'phase1'
                ? `This will bypass trading targets and advance ${challengeConfirmTarget?.challenge.user_login}'s account to Phase 2.`
                : challengeConfirmTarget?.action === 'phase2'
                ? `This will bypass Phase 2 trading targets and mark the evaluation as completed.`
                : `This will bypass evaluation metrics and immediately mark ${challengeConfirmTarget?.challenge.user_login}'s account as Fully Funded.`
            }
            confirmText={
              challengeConfirmTarget?.action === 'reset' 
                ? 'Confirm Reset' 
                : challengeConfirmTarget?.action === 'payout_ready'
                ? 'Confirm Payout Ready'
                : 'Confirm Action'
            }
            isDestructive={challengeConfirmTarget?.action === 'reset'}
            loading={busyChallengeId === challengeConfirmTarget?.challenge.id}
            onConfirm={() => {
              if (challengeConfirmTarget) {
                executeChallengeAction(challengeConfirmTarget.challenge, challengeConfirmTarget.action)
              }
            }}
            onCancel={() => setChallengeConfirmTarget(null)}
          />
        </div>
      )}

      {/* ── Auto-Repair High Friction Confirmation Modal (ADMINUI-23) ── */}
      <Modal
        open={isRepairModalOpen}
        onOpenChange={(open) => {
          if (!isRepairing) {
            setIsRepairModalOpen(open)
            if (!open) setRepairConfirmText('')
          }
        }}
        title="⚠️ Confirm System Auto-Repair"
        description="Auto-repair executes database schema synchronization, verifies 42 required tables, re-provisions missing options, and restarts health sentinels."
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
            <strong>Warning:</strong> This will mutate database configuration and schema options. Type <span className="font-mono font-bold text-white bg-amber-950/60 px-1 py-0.5 rounded">CONFIRM REPAIR</span> below to verify authorization.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repair-confirm-input" className="text-xs">Type &quot;CONFIRM REPAIR&quot; to authorize:</Label>
            <Input
              id="repair-confirm-input"
              value={repairConfirmText}
              onChange={(e) => setRepairConfirmText(e.target.value)}
              placeholder="CONFIRM REPAIR"
              className="font-mono text-xs uppercase"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-muted">
            <Button
              variant="outline"
              size="sm"
              disabled={isRepairing}
              onClick={() => setIsRepairModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={repairConfirmText.trim().toUpperCase() !== 'CONFIRM REPAIR' || isRepairing}
              loading={isRepairing}
              onClick={handleAutoRepair}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Execute Auto-Repair
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── TAB 6: REDIS IN-MEMORY ENGINE ─────────────────────────────────── */}
      {activeTab === 'redis' && (
        <div className="space-y-6 w-full">
          <RedisCacheCard />
        </div>
      )}

      {/* ── TAB 7: DISASTER RECOVERY & ENCRYPTED VAULT ──────────────────────── */}
      {activeTab === 'backup' && (
        <div className="space-y-6 w-full">
          <DisasterRecoveryCard />
        </div>
      )}

      {/* ── TAB 8: SENTRY CRASH SENTINEL ──────────────────────────────────── */}
      {activeTab === 'sentry' && (
        <div className="space-y-6 w-full">
          <SentryMonitoringCard />
        </div>
      )}

      {/* ── Add Custom Economic Event Modal ───────────────────────────────── */}
      <Modal
        open={isAddEventModalOpen}
        onOpenChange={setIsAddEventModalOpen}
        title="Add Custom Economic Event"
        description="Insert a scheduled macroeconomic announcement into the restriction calendar."
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newEventForm.title || !newEventForm.event_time_utc) {
              toast.error('Please complete title and date/time.')
              return
            }
            addEventMutation.mutate(newEventForm)
          }}
          className="space-y-4 pt-2 text-xs"
        >
          <div className="space-y-1.5">
            <Label htmlFor="event-name">Event / Release Name</Label>
            <Input
              id="event-name"
              placeholder="e.g. US Non-Farm Payrolls (NFP)"
              value={newEventForm.title}
              onChange={(e) => setNewEventForm({ ...newEventForm, title: e.target.value })}
              className="text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-curr">Target Currency</Label>
              <select
                id="event-curr"
                value={newEventForm.currency}
                onChange={(e) => setNewEventForm({ ...newEventForm, currency: e.target.value })}
                className="w-full h-9 rounded-md border border-surface-muted bg-background text-white px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-impact">Impact Rating</Label>
              <select
                id="event-impact"
                value={newEventForm.impact}
                onChange={(e) => setNewEventForm({ ...newEventForm, impact: e.target.value as 'high' | 'medium' | 'low' })}
                className="w-full h-9 rounded-md border border-surface-muted bg-background text-white px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="high">High Impact (Red Folder)</option>
                <option value="medium">Medium Impact (Orange)</option>
                <option value="low">Low Impact (Yellow)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-time">Event Date & Time (UTC)</Label>
            <Input
              id="event-time"
              type="datetime-local"
              value={newEventForm.event_time_utc}
              onChange={(e) => setNewEventForm({ ...newEventForm, event_time_utc: e.target.value })}
              className="text-xs font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-source">Source / Institution</Label>
            <Input
              id="event-source"
              placeholder="e.g. US Bureau of Labor Statistics"
              value={newEventForm.source}
              onChange={(e) => setNewEventForm({ ...newEventForm, source: e.target.value })}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-muted">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddEventModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={addEventMutation.isPending}
            >
              Insert Economic Event
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Emergency Confirmation Modal ──────────────────────────────────── */}
      <Modal
        open={confirmModalState.open}
        onOpenChange={(open) => setConfirmModalState(prev => ({ ...prev, open }))}
        title={confirmModalState.actionName}
        description="Master infrastructure override confirmation."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 py-2 text-xs leading-relaxed">
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
            <p>
              Are you sure you want to change the state of <strong>{confirmModalState.label}</strong>? This action takes immediate firm-wide effect across all trading terminals, webhooks, and billing gateways.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalState(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmToggle}
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              Confirm State Change
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
