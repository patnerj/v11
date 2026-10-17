'use client'

/**
 * Dedicated Native MetaTrader 5 (MT5) WebTerminal Page (`/dashboard/mt5`)
 * Institutional WebTrader workspace mode exclusively running the Native MT5 Pro Chart Engine.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Clock,
  ListOrdered,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Trophy,
  ChevronDown,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { api } from '@/lib/api'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { useQuery } from '@tanstack/react-query'
import { useMediaQuery } from '@/hooks/use-media-query'
import { fmtPrice, toNum, fmtUSD, fmtPct } from '@/lib/format'
import { invalidateFxsim } from '@/lib/fxsim'
import { symbolDigits } from '@/lib/symbol-meta'
import { calculateLivePositionPnL, quoteToUsdRate } from '@/lib/order-math'
import type {
  Account,
  NoChallengeResp,
  Position,
  PendingOrder,
  ChallengeAccount,
  ChallengeMetrics,
} from '@/types/api'

import { MarketWatch } from '@/components/dashboard/trading/market-watch'
import { Mt5ChartPanel } from '@/components/dashboard/trading/mt5-chart'
import { OrderTicket } from '@/components/dashboard/trading/order-ticket'
import { PositionsTable } from '@/components/dashboard/trading/positions-table'
import { PendingOrdersTable } from '@/components/dashboard/trading/pending-orders-table'
import { AccountSwitcher, buildSwitchEntries } from '@/components/dashboard/trading/account-switcher'
import { TournamentWarningBanner } from '@/components/dashboard/trading/tournament-banner'
import { NewsRestrictBanner } from '@/components/dashboard/trading/news-restrict-banner'
import { SoundToggle } from '@/components/dashboard/trading/sound-toggle'
import { MobileBottomSheet } from '@/components/dashboard/trading/mobile-bottom-sheet'
import { PhasePassCelebrationModal } from '@/components/dashboard/PhasePassCelebrationModal'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { cn } from '@/lib/cn'
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  type PanelImperativeHandle,
} from 'react-resizable-panels'

function isAccount(x: Account | NoChallengeResp | null): x is Account {
  return !!x && (x as Account).balance !== undefined && !(x as NoChallengeResp).no_challenge
}

type Tab = 'positions' | 'pending'

export default function Mt5WebTerminalPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const bootstrapTerm = useTerminal((s) => s.bootstrap)
  const refreshSymbols = useTerminal((s) => s.refreshSymbols)
  const symbolsLoaded = useTerminal((s) => s.symbolsLoaded)
  const active = useTerminal((s) => s.active)

  // Real-time state from store
  const account = usePrices((s) => s.account as Account | NoChallengeResp | null)
  const rawPositions = usePrices((s) => s.positions)
  const optimisticPositions = usePrices((s) => s.optimisticPositions)
  const positions = useMemo(() => {
    if (!rawPositions && (!optimisticPositions || optimisticPositions.length === 0)) return rawPositions
    const real = rawPositions || []
    const opt = (optimisticPositions || []).filter((o) => !real.some((r) => r.id === o.id))
    return [...opt, ...real]
  }, [rawPositions, optimisticPositions])
  const pending = usePrices((s) => s.pending)

  const [chs, setChs] = useState<ChallengeAccount[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showMoreTelemetry, setShowMoreTelemetry] = useState(false)

  const { data: myTournaments } = useQuery({
    queryKey: ['tournamentsMine'],
    queryFn: () => api.tournaments.mine().then((r) => (r.ok ? r.data : [])),
    staleTime: 60_000,
  })

  const switchEntries = buildSwitchEntries(chs ?? [], myTournaments ?? [], true)

  const tradingCtx = usePrices((s) => s.tradingContext)
  const isTournamentMode = tradingCtx?.kind === 'tournament'
  const tournamentId = isTournamentMode ? tradingCtx.tournamentId : undefined
  const tournamentTitle = isTournamentMode ? tradingCtx.title : undefined

  useEffect(() => {
    bootstrapTerm()
  }, [bootstrapTerm])

  useEffect(() => {
    refreshSymbols()
    const interval = setInterval(refreshSymbols, 30_000)
    const onFocus = () => refreshSymbols()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshSymbols])

  const refreshAccount = usePrices((s) => s.refresh)
  const refreshUser = usePrices((s) => s.refreshUser)
  const stopStream = usePrices((s) => s.stop)

  useEffect(() => {
    refreshAccount().then(() => setLoaded(true))
    return () => stopStream()
  }, [refreshAccount, stopStream])

  useEffect(() => {
    let cancelled = false
    api.challengeMy().then((res) => {
      if (!cancelled && res.ok && Array.isArray(res.data)) {
        setChs(res.data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const currentAcc = isAccount(account) ? account : null
  const currentCh = useMemo(() => {
    if (!chs || !currentAcc) return null
    return chs.find((c) => c.fxsim_account_id === currentAcc.id) || null
  }, [chs, currentAcc])

  const { data: metrics } = useQuery({
    queryKey: ['metrics', currentCh?.id],
    queryFn: () => (currentCh?.id ? api.challengeMetrics(currentCh.id).then((r) => (r.ok ? r.data : null)) : null),
    enabled: !!currentCh?.id,
    refetchInterval: 10_000,
  })

  const plan = metrics?.plan

  const [tab, setTab] = useState<Tab>('positions')

  const posPanelRef = useRef<PanelImperativeHandle>(null)
  const [posCollapsed, setPosCollapsed] = useState(false)
  const mwPanelRef = useRef<PanelImperativeHandle>(null)
  const [mwCollapsed, setMwCollapsed] = useState(false)
  const orderPanelRef = useRef<PanelImperativeHandle>(null)
  const [orderCollapsed, setOrderCollapsed] = useState(false)

  const togglePos = () => {
    const panel = posPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) panel.expand()
      else panel.collapse()
    } else {
      setPosCollapsed((v) => !v)
    }
  }

  const toggleMw = () => {
    const panel = mwPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) panel.expand()
      else panel.collapse()
    } else {
      setMwCollapsed((v) => !v)
    }
  }

  const toggleOrder = () => {
    const panel = orderPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) panel.expand()
      else panel.collapse()
    } else {
      setOrderCollapsed((v) => !v)
    }
  }

  const onChanged = useCallback(() => {
    refreshUser()
    invalidateFxsim('/positions')
    invalidateFxsim('/account')
  }, [refreshUser])

  const allPrices = usePrices((s) => s.prices)
  const openPnL = useMemo(() => {
    if (!positions || positions.length === 0) return 0
    return positions.reduce((sum, p) => sum + calculateLivePositionPnL(p as any, allPrices), 0)
  }, [positions, allPrices])

  const balance = toNum(currentAcc?.balance)
  const pnl = openPnL ?? 0
  const equity = balance + pnl
  const used = toNum(currentAcc?.margin_used)
  const free = equity - used
  const level = used > 0 ? (equity / used) * 100 : null
  const lev = toNum(currentAcc?.leverage) || 100

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full min-h-0 w-full overflow-hidden">
      {/* High-Impact News Restrict Warning Banner */}
      <div className="shrink-0">
        <NewsRestrictBanner plan={plan} />
      </div>

      {/* Tournament Warning Banner */}
      {isTournamentMode && tournamentId && (
        <div className="shrink-0">
          <TournamentWarningBanner
            tournamentId={tournamentId}
            tournamentTitle={tournamentTitle}
            account={currentAcc}
            myTournaments={myTournaments}
            switchEntries={switchEntries}
          />
        </div>
      )}

      {/* Account switcher, MT5 Mode Badge & Controls bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <AccountSwitcher entries={switchEntries} metrics={metrics} showChartControls={true} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-terminal-label font-bold shadow-xs">
            <Zap className="w-3.5 h-3.5 fill-emerald-400" />
            <span>MT5 Pro Terminal Mode</span>
          </div>
          <Link
            href="/dashboard/trading"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-terminal-micro font-semibold text-text-muted hover:text-text hover:bg-surface-muted/60 border border-border transition-colors"
            title="Switch to Standard WebTrader"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Standard WebTrader</span>
          </Link>
          <SoundToggle compact className="shrink-0" />
        </div>
      </div>

      <PanelGroup orientation="horizontal" className="flex-1 min-h-0 w-full rounded-lg">
        {/* Left: market watch */}
        <Panel
          panelRef={mwPanelRef}
          defaultSize="24%"
          minSize="18%"
          maxSize="30%"
          collapsible={true}
          collapsedSize="4%"
          className="transition-all duration-200"
        >
          {mwCollapsed ? (
            <div className="h-full flex flex-col items-center justify-between py-3 border border-border bg-surface rounded-lg">
              <button
                onClick={toggleMw}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                aria-label="Expand market watch"
                title="Expand market watch"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <aside className="rounded-lg border border-border bg-surface flex flex-col h-full min-h-0 overflow-hidden">
              <div className="shrink-0 px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
                <h3 className="text-terminal-label font-semibold uppercase tracking-wider text-text-muted">
                  Market watch
                </h3>
                <button
                  onClick={toggleMw}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                  aria-label="Hide market watch"
                  title="Hide market watch"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <SectionErrorBoundary sectionName="MarketWatch">
                <MarketWatch />
              </SectionErrorBoundary>
            </aside>
          )}
        </Panel>

        <PanelResizeHandle className="w-3 relative group">
          <div className="absolute inset-y-0 left-1.5 w-px bg-border-subtle group-hover:bg-accent transition-colors" />
        </PanelResizeHandle>

        {/* Center: MT5 Pro Chart + Positions/Pending Tabs */}
        <Panel defaultSize="52%" minSize="40%">
          <PanelGroup orientation="vertical">
            <Panel defaultSize="70%" minSize="30%">
              <section className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col h-full min-h-0">
                <SectionErrorBoundary sectionName="Mt5ChartPanel">
                  <Mt5ChartPanel
                    positions={positions}
                    pendingOrders={pending}
                    plan={plan || metrics?.plan}
                    onChanged={onChanged}
                  />
                </SectionErrorBoundary>
              </section>
            </Panel>

            <PanelResizeHandle className="h-3 relative group">
              <div className="absolute inset-x-0 top-1.5 h-px bg-border-subtle group-hover:bg-accent transition-colors" />
            </PanelResizeHandle>

            <Panel
              panelRef={posPanelRef}
              defaultSize="30%"
              minSize="10%"
              collapsible={true}
              collapsedSize="5%"
            >
              <section className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col h-full min-h-0">
                <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle bg-bg-subtle/40">
                  <button
                    type="button"
                    onClick={() => setTab('positions')}
                    className={cn(
                      'px-3 py-1 rounded-md text-terminal-label font-semibold transition-colors flex items-center gap-1.5 cursor-pointer',
                      tab === 'positions'
                        ? 'bg-accent text-accent-fg shadow-xs'
                        : 'text-text-muted hover:text-text hover:bg-surface-muted'
                    )}
                  >
                    Positions
                    {positions && positions.length > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-muted text-accent text-terminal-micro font-semibold px-1">
                        {positions.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('pending')}
                    className={cn(
                      'px-3 py-1 rounded-md text-terminal-label font-semibold transition-colors flex items-center gap-1.5 cursor-pointer',
                      tab === 'pending'
                        ? 'bg-accent text-accent-fg shadow-xs'
                        : 'text-text-muted hover:text-text hover:bg-surface-muted'
                    )}
                  >
                    Pending Orders
                    {pending && pending.filter((o) => o.status === 'pending').length > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warn-muted text-warn text-terminal-micro font-semibold px-1">
                        {pending.filter((o) => o.status === 'pending').length}
                      </span>
                    )}
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={togglePos}
                      className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                      aria-label={posCollapsed ? 'Expand positions panel' : 'Collapse positions panel'}
                      title={posCollapsed ? 'Expand positions panel' : 'Collapse positions panel'}
                    >
                      {posCollapsed ? (
                        <PanelLeftOpen className="h-3.5 w-3.5 rotate-90" />
                      ) : (
                        <PanelLeftClose className="h-3.5 w-3.5 rotate-90" />
                      )}
                    </button>
                  </div>
                </div>

                {!posCollapsed && (
                  <>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <SectionErrorBoundary sectionName="PositionsTable">
                        {tab === 'positions' ? (
                          <PositionsTable positions={positions} onChanged={onChanged} />
                        ) : (
                          <PendingOrdersTable orders={pending} onChanged={onChanged} />
                        )}
                      </SectionErrorBoundary>
                    </div>

                    {/* MT5 Bottom Telemetry Summary Row */}
                    {currentAcc && (
                      <div className="shrink-0 border-t border-border bg-surface/95 dark:bg-bg-subtle/90 backdrop-blur px-3.5 py-1.5 flex items-center justify-between gap-4 text-terminal-body font-normal select-none overflow-x-auto no-scrollbar shadow-xs">
                        <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-text-muted">
                          <span>
                            Balance:{' '}
                            <strong className="font-semibold terminal-num text-text">
                              {fmtUSD(balance)}
                            </strong>
                          </span>
                          <span>
                            Equity:{' '}
                            <strong
                              className={cn(
                                'font-semibold terminal-num',
                                equity >= balance
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              )}
                            >
                              {fmtUSD(equity)}
                            </strong>
                          </span>
                          <span>
                            Free Margin:{' '}
                            <strong className="text-text font-semibold terminal-num">
                              {fmtUSD(free)}
                            </strong>
                          </span>

                          {showMoreTelemetry && (
                            <>
                              <span>
                                Margin:{' '}
                                <strong className="text-text font-semibold terminal-num">
                                  {fmtUSD(used)}
                                </strong>
                              </span>
                              <span>
                                Margin Level:{' '}
                                <strong
                                  className={cn(
                                    'font-semibold terminal-num',
                                    level !== null && level <= 120
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-text'
                                  )}
                                >
                                  {level !== null ? fmtPct(level, 1) : '—'}
                                </strong>
                              </span>
                              <span>
                                Leverage:{' '}
                                <strong className="text-text font-semibold terminal-num">
                                  1:{lev}
                                </strong>
                              </span>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setShowMoreTelemetry((v) => !v)}
                            className="inline-flex items-center gap-0.5 text-terminal-micro font-normal text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-muted transition-colors cursor-pointer"
                          >
                            <span>{showMoreTelemetry ? 'Less' : 'More'}</span>
                            <ChevronDown
                              className={cn(
                                'h-3 w-3 transition-transform',
                                showMoreTelemetry && 'rotate-180'
                              )}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-text-muted">Total P/L:</span>
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded text-terminal-body font-semibold terminal-num',
                              pnl >= 0
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            )}
                          >
                            {fmtUSD(pnl, { sign: true })}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-3 relative group">
          <div className="absolute inset-y-0 left-1.5 w-px bg-border-subtle group-hover:bg-accent transition-colors" />
        </PanelResizeHandle>

        {/* Right: order ticket */}
        <Panel
          panelRef={orderPanelRef}
          defaultSize="24%"
          minSize="18%"
          maxSize="35%"
          collapsible={true}
          collapsedSize="4%"
          className="transition-all duration-200"
        >
          {orderCollapsed ? (
            <div className="h-full flex flex-col items-center justify-between py-3 border border-border bg-surface rounded-lg">
              <button
                onClick={toggleOrder}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                aria-label="Expand order ticket"
                title="Expand order ticket"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <aside className="rounded-lg border border-border bg-surface flex flex-col h-full min-h-0 overflow-hidden">
              <div className="shrink-0 px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
                <h3 className="text-terminal-label font-semibold uppercase tracking-wider text-text-muted">
                  Order Ticket
                </h3>
                <button
                  onClick={toggleOrder}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                  aria-label="Hide order ticket"
                  title="Hide order ticket"
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                </button>
              </div>
              <SectionErrorBoundary sectionName="OrderTicket">
                <OrderTicket plan={plan || metrics?.plan} onChanged={onChanged} />
              </SectionErrorBoundary>
            </aside>
          )}
        </Panel>
      </PanelGroup>
    </div>
  )
}
