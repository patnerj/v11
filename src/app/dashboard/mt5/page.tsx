'use client'

/**
 * Dedicated Native MetaTrader 5 (MT5) WebTerminal Page (`/dashboard/mt5`)
 * Institutional WebTrader workspace mode exclusively running the Native MT5 Pro Chart Engine.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Clock,
  ListOrdered,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Trophy,
  ChevronDown,
  Zap,
  Activity,
  Sliders,
} from 'lucide-react'
import type { Timeframe, ChartStyle, ThemePreset } from '@/components/dashboard/trading/mt5-chart/types'
import { TIMEFRAMES, CHART_STYLES } from '@/components/dashboard/trading/mt5-chart/mt5-top-controls'
import { toast } from 'sonner'
import Link from 'next/link'

import { api } from '@/lib/api'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { useQuery } from '@tanstack/react-query'
import { useMediaQuery } from '@/hooks/use-media-query'
import { fmtPrice, toNum, fmtUSD, fmtPct } from '@/lib/format'
import { invalidateFxsim } from '@/lib/fxsim'
import { symbolDigits, getSymbolMeta } from '@/lib/symbol-meta'
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
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { cn } from '@/lib/cn'
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels'

function isAccount(x: Account | NoChallengeResp | null): x is Account {
  return !!x && (x as Account).balance !== undefined && !(x as NoChallengeResp).no_challenge
}

type Tab = 'positions' | 'pending'

export default function Mt5WebTerminalPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isXl = useMediaQuery('(min-width: 1280px)')

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

  // Dock visibility states
  const [mwOpen, setMwOpen] = useState(true)
  const [orderOpen, setOrderOpen] = useState(true)
  const [tabbedDockTab, setTabbedDockTab] = useState<'mw' | 'order'>('mw')
  const [posCollapsed, setPosCollapsed] = useState(false)
  const [tab, setTab] = useState<Tab>('positions')

  // Top Toolbar MT5 state
  const showOneClick = useTerminal((s) => s.showOneClick)
  const toggleOneClick = useTerminal((s) => s.toggleOneClick)

  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    if (typeof window === 'undefined') return 'H1'
    try { return (localStorage.getItem('fxsim:mt5:tf') as Timeframe) || 'H1' } catch { return 'H1' }
  })
  const [chartStyle, setChartStyle] = useState<ChartStyle>(() => {
    if (typeof window === 'undefined') return 'candlestick'
    try { return (localStorage.getItem('fxsim:mt5:style') as ChartStyle) || 'candlestick' } catch { return 'candlestick' }
  })
  const [theme, setTheme] = useState<ThemePreset>(() => {
    if (typeof window === 'undefined') return 'cyber'
    try { return (localStorage.getItem('fxsim:mt5:theme') as ThemePreset) || 'cyber' } catch { return 'cyber' }
  })
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [showPeriodSeparators, setShowPeriodSeparators] = useState(() => timeframe !== 'D1' && timeframe !== 'W1')

  // Global hotkeys: Ctrl+M (Market Watch) & F9 (Order Ticket)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        if (isXl) {
          setMwOpen((v) => !v)
        } else {
          setTabbedDockTab('mw')
          setMwOpen(true)
        }
      } else if (e.key === 'F9') {
        e.preventDefault()
        if (isXl) {
          setOrderOpen((v) => !v)
        } else {
          setTabbedDockTab('order')
          setMwOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isXl])

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

  const pricesStart = usePrices((s) => s.start)
  const pricesStop = usePrices((s) => s.stop)
  const refreshAccount = usePrices((s) => s.refresh)
  const refreshUser = usePrices((s) => s.refreshUser)

  // Start the prices stream & user data polling while MT5 terminal is mounted
  useEffect(() => {
    pricesStart()
    refreshAccount().then(() => setLoaded(true))
    return () => pricesStop()
  }, [pricesStart, pricesStop, refreshAccount])

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

  const onChanged = useCallback(() => {
    refreshUser()
    invalidateFxsim('/positions')
    invalidateFxsim('/account')
  }, [refreshUser])

  const allPrices = usePrices((s) => s.prices)
  const openPnL = useMemo(() => {
    if (!positions || positions.length === 0) return 0
    return positions.reduce((sum, p) => {
      const meta = getSymbolMeta(p.symbol)
      return sum + calculateLivePositionPnL(p as any, allPrices, meta?.contractSize)
    }, 0)
  }, [positions, allPrices])

  const balance = toNum(currentAcc?.balance)
  const pnl = openPnL ?? 0
  const equity = balance + pnl
  const used = toNum(currentAcc?.margin_used)
  const free = equity - used
  const level = used > 0 ? (equity / used) * 100 : null
  const lev = toNum(currentAcc?.leverage) || 100

  const activeTick = allPrices[active]
  const activeMeta = useMemo(() => getSymbolMeta(active), [active])
  const activeSpread = activeTick && activeTick.ask && activeTick.bid
    ? Math.max(0, (toNum(activeTick.ask) - toNum(activeTick.bid)) / (activeMeta.pipSize || 1)).toFixed(1)
    : null

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

      {/* MT5 Single Unified Institutional Top Controls Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg bg-surface border border-border select-none text-terminal-body overflow-x-auto no-scrollbar">
        {/* Left Section: Account Switcher, Active Symbol Badge, Timeframe pills, Chart Style pills, Indicators button, Theme selector, 1-Click */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <AccountSwitcher entries={switchEntries} metrics={metrics} showChartControls={false} />

          {/* Active Symbol & Spread Badge */}
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-subtle/80 border border-border-subtle text-terminal-label shrink-0">
            <span className="font-bold text-text">{active}</span>
            {activeSpread !== null && (
              <span className="text-terminal-micro text-text-muted font-normal">
                Spread: <strong className="text-text font-semibold">{activeSpread}</strong> pts
              </span>
            )}
          </div>

          <div className="w-px h-4 bg-border/80 mx-0.5" />

          {/* Timeframe Segmented Switcher */}
          <div className="flex items-center bg-bg-subtle/80 p-0.5 rounded-md border border-border-subtle">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  setTimeframe(tf)
                  try { localStorage.setItem('fxsim:mt5:tf', tf) } catch {}
                }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-terminal-micro font-semibold transition-all cursor-pointer',
                  timeframe === tf
                    ? 'bg-accent text-accent-fg shadow-xs font-bold'
                    : 'text-text-muted hover:text-text hover:bg-surface-muted/50'
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart Style Switcher */}
          <div className="flex items-center bg-bg-subtle/80 p-0.5 rounded-md border border-border-subtle">
            {CHART_STYLES.map((cs) => {
              const Icon = cs.icon
              const isSel = chartStyle === cs.id
              return (
                <button
                  key={cs.id}
                  type="button"
                  onClick={() => {
                    setChartStyle(cs.id)
                    try { localStorage.setItem('fxsim:mt5:style', cs.id) } catch {}
                  }}
                  className={cn(
                    'p-1 rounded transition-all cursor-pointer',
                    isSel
                      ? 'bg-accent text-accent-fg shadow-xs'
                      : 'text-text-muted hover:text-text hover:bg-surface-muted/50'
                  )}
                  title={`${cs.label} (${cs.shortcut})`}
                  aria-label={cs.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              )
            })}
          </div>

          {/* Chart Properties & Technical Indicators Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsIndicatorsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-terminal-micro font-semibold text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle transition-colors cursor-pointer shrink-0"
            title="Chart Properties & Indicators (Themes, Grid, Separators, EMA, ICT, RSI, MACD)"
          >
            <Sliders className="w-3.5 h-3.5 text-accent" />
            <span>Properties</span>
          </button>

          {/* 1-Click Execution Box Toggle (Alt+T) */}
          <button
            type="button"
            onClick={toggleOneClick}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-terminal-micro font-semibold transition-all cursor-pointer shrink-0',
              showOneClick
                ? 'text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-surface-muted border border-border-subtle'
            )}
            title="Toggle 1-Click Trading Box (Alt+T)"
          >
            <Zap className={cn('w-3 h-3', showOneClick && 'fill-emerald-500')} />
            <span>1-Click</span>
          </button>
        </div>

        {/* Right Section: Market Watch, Order Ticket, Sound */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Market Watch Dock Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isXl) {
                setMwOpen((v) => !v)
              } else {
                if (mwOpen && tabbedDockTab === 'mw') {
                  setMwOpen(false)
                } else {
                  setTabbedDockTab('mw')
                  setMwOpen(true)
                }
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-terminal-label font-semibold border transition-all cursor-pointer",
              (isXl ? mwOpen : (mwOpen && tabbedDockTab === 'mw'))
                ? "bg-accent/15 border-accent/40 text-accent shadow-xs"
                : "bg-surface border-border text-text-muted hover:text-text hover:bg-surface-muted"
            )}
            title="Toggle Market Watch (Ctrl+M)"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Market Watch</span>
            <span className="hidden xl:inline text-terminal-micro text-text-muted font-normal">Ctrl+M</span>
          </button>

          {/* Order Ticket Dock Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isXl) {
                setOrderOpen((v) => !v)
              } else {
                if (mwOpen && tabbedDockTab === 'order') {
                  setMwOpen(false)
                } else {
                  setTabbedDockTab('order')
                  setMwOpen(true)
                }
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-terminal-label font-semibold border transition-all cursor-pointer",
              (isXl ? orderOpen : (mwOpen && tabbedDockTab === 'order'))
                ? "bg-accent/15 border-accent/40 text-accent shadow-xs"
                : "bg-surface border-border text-text-muted hover:text-text hover:bg-surface-muted"
            )}
            title="Toggle Order Ticket (F9)"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Order Ticket</span>
            <span className="hidden xl:inline text-terminal-micro text-text-muted font-normal">F9</span>
          </button>

          <SoundToggle compact className="shrink-0" />
        </div>
      </div>

      {/* 3-Zone Workspace: Left Dock + Center Chart/Positions + Right Dock */}
      <div className="flex-1 min-h-0 w-full flex flex-row gap-1.5 sm:gap-2 overflow-hidden">
        {/* Left / Tabbed Dock */}
        {isXl ? (
          /* Desktop XL (>= 1280px): Dedicated Left Market Watch Dock */
          mwOpen ? (
            <aside className="w-[270px] min-w-[270px] shrink-0 h-full rounded-lg border border-border bg-surface flex flex-col overflow-hidden">
              <div className="shrink-0 px-3 py-2 border-b border-border-subtle flex items-center justify-between bg-bg-subtle/30">
                <h3 className="text-terminal-label font-semibold uppercase tracking-wider text-text-muted">
                  Market Watch
                </h3>
                <button
                  type="button"
                  onClick={() => setMwOpen(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                  title="Collapse Market Watch (Ctrl+M)"
                  aria-label="Collapse Market Watch"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <SectionErrorBoundary sectionName="MarketWatch">
                  <MarketWatch />
                </SectionErrorBoundary>
              </div>
            </aside>
          ) : (
            <div className="w-9 shrink-0 h-full border border-border bg-surface rounded-lg flex flex-col items-center py-3 select-none">
              <button
                type="button"
                onClick={() => setMwOpen(true)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                title="Expand Market Watch (Ctrl+M)"
                aria-label="Expand Market Watch"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )
        ) : (
          /* Responsive Viewports (< 1280px): Single Tabbed Dock */
          mwOpen ? (
            <aside className="w-[310px] min-w-[310px] shrink-0 h-full rounded-lg border border-border bg-surface flex flex-col overflow-hidden">
              <div className="shrink-0 px-2.5 py-1.5 border-b border-border-subtle flex items-center justify-between bg-bg-subtle/40">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTabbedDockTab('mw')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-terminal-label font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                      tabbedDockTab === 'mw'
                        ? 'bg-accent text-accent-fg shadow-xs'
                        : 'text-text-muted hover:text-text hover:bg-surface-muted'
                    )}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Market Watch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabbedDockTab('order')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-terminal-label font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                      tabbedDockTab === 'order'
                        ? 'bg-accent text-accent-fg shadow-xs'
                        : 'text-text-muted hover:text-text hover:bg-surface-muted'
                    )}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Order Ticket</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMwOpen(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                  title="Close dock"
                  aria-label="Close dock"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <SectionErrorBoundary sectionName="TabbedDockContent">
                  {tabbedDockTab === 'mw' ? (
                    <MarketWatch />
                  ) : (
                    <OrderTicket plan={plan || metrics?.plan} onChanged={onChanged} />
                  )}
                </SectionErrorBoundary>
              </div>
            </aside>
          ) : (
            <div className="w-9 shrink-0 h-full border border-border bg-surface rounded-lg flex flex-col items-center py-3 select-none">
              <button
                type="button"
                onClick={() => setMwOpen(true)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                title="Expand Dock"
                aria-label="Expand Dock"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )
        )}

        {/* Center: MT5 Pro Chart + Positions/Pending Split */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          {posCollapsed ? (
            <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
              <section className="flex-1 min-h-0 rounded-lg border border-border bg-surface overflow-hidden flex flex-col">
                <SectionErrorBoundary sectionName="Mt5ChartPanel">
                  <Mt5ChartPanel
                    positions={positions}
                    pendingOrders={pending}
                    plan={plan || metrics?.plan}
                    onChanged={onChanged}
                    showTopControls={false}
                    timeframe={timeframe}
                    onChangeTimeframe={setTimeframe}
                    chartStyle={chartStyle}
                    onChangeChartStyle={setChartStyle}
                    theme={theme}
                    onChangeTheme={setTheme}
                    showGrid={showGrid}
                    onChangeShowGrid={setShowGrid}
                    showPeriodSeparators={showPeriodSeparators}
                    onChangeShowPeriodSeparators={setShowPeriodSeparators}
                    isIndicatorsModalOpen={isIndicatorsModalOpen}
                    onToggleIndicatorsModal={setIsIndicatorsModalOpen}
                  />
                </SectionErrorBoundary>
              </section>

              {/* Slim 36px MT5 Collapsed Telemetry & Dock Strip */}
              <div className="mt-1 shrink-0 h-9 rounded-lg border border-border bg-surface/95 px-3 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPosCollapsed(false)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent/10 hover:bg-accent/20 text-accent font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                    <span>Positions & Orders ({positions?.length || 0})</span>
                  </button>

                  <div className="h-4 w-px bg-border-subtle" />

                  <div className="flex items-center gap-3 sm:gap-4 text-text-muted">
                    <span>
                      Balance: <strong className="font-semibold tabular-nums text-text">{fmtUSD(balance)}</strong>
                    </span>
                    <span>
                      Equity:{' '}
                      <strong className={cn('font-semibold tabular-nums', equity >= balance ? 'text-emerald-500' : 'text-rose-500')}>
                        {fmtUSD(equity)}
                      </strong>
                    </span>
                    <span className="hidden sm:inline">
                      Free Margin: <strong className="font-semibold tabular-nums text-text">{fmtUSD(free)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Total P/L:</span>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-semibold tabular-nums', pnl >= 0 ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-500 border border-rose-500/30')}>
                    {fmtUSD(pnl, { sign: true })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <PanelGroup orientation="vertical" className="h-full w-full">
              <Panel defaultSize={70} minSize={30}>
                <section className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col h-full min-h-0">
                  <SectionErrorBoundary sectionName="Mt5ChartPanel">
                    <Mt5ChartPanel
                      positions={positions}
                      pendingOrders={pending}
                      plan={plan || metrics?.plan}
                      onChanged={onChanged}
                      showTopControls={false}
                      timeframe={timeframe}
                      onChangeTimeframe={setTimeframe}
                      chartStyle={chartStyle}
                      onChangeChartStyle={setChartStyle}
                      theme={theme}
                      onChangeTheme={setTheme}
                      showGrid={showGrid}
                      onChangeShowGrid={setShowGrid}
                      showPeriodSeparators={showPeriodSeparators}
                      onChangeShowPeriodSeparators={setShowPeriodSeparators}
                      isIndicatorsModalOpen={isIndicatorsModalOpen}
                      onToggleIndicatorsModal={setIsIndicatorsModalOpen}
                    />
                  </SectionErrorBoundary>
                </section>
              </Panel>

              <PanelResizeHandle className="h-2 relative group cursor-row-resize">
                <div className="absolute inset-x-0 top-1 h-px bg-border-subtle group-hover:bg-accent transition-colors" />
              </PanelResizeHandle>

              <Panel defaultSize={30} minSize={15} collapsible={false}>
                <section className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col h-full min-h-0">
                  {/* Positions & Pending Tab Header */}
                  <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-border-subtle bg-bg-subtle/40">
                    <button
                      type="button"
                      onClick={() => setTab('positions')}
                      className={cn(
                        'px-3 py-1.5 h-7 rounded-md text-xs font-semibold font-sans transition-colors flex items-center gap-1.5 cursor-pointer',
                        tab === 'positions'
                          ? 'bg-accent text-accent-fg shadow-xs'
                          : 'text-text-muted hover:text-text hover:bg-surface-muted'
                      )}
                    >
                      Positions
                      {positions && positions.length > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-muted text-accent text-[10px] font-semibold px-1">
                          {positions.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('pending')}
                      className={cn(
                        'px-3 py-1.5 h-7 rounded-md text-xs font-semibold font-sans transition-colors flex items-center gap-1.5 cursor-pointer',
                        tab === 'pending'
                          ? 'bg-accent text-accent-fg shadow-xs'
                          : 'text-text-muted hover:text-text hover:bg-surface-muted'
                      )}
                    >
                      Pending Orders
                      {pending && pending.filter((o) => o.status === 'pending').length > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warn-muted text-warn text-[10px] font-semibold px-1">
                          {pending.filter((o) => o.status === 'pending').length}
                        </span>
                      )}
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPosCollapsed(true)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                        aria-label="Collapse positions panel"
                        title="Collapse positions panel"
                      >
                        <PanelLeftClose className="h-3.5 w-3.5 rotate-90" />
                      </button>
                    </div>
                  </div>

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
                  <div className="shrink-0 border-t border-border bg-surface/95 dark:bg-bg-subtle/90 backdrop-blur px-3.5 py-1.5 flex items-center justify-between gap-4 text-xs font-normal select-none overflow-x-auto no-scrollbar shadow-xs">
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-text-muted">
                      <span>
                        Balance:{' '}
                        <strong className="font-semibold tabular-nums text-text">
                          {fmtUSD(balance)}
                        </strong>
                      </span>
                      <span>
                        Equity:{' '}
                        <strong
                          className={cn(
                            'font-semibold tabular-nums',
                            equity >= balance
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          )}
                        >
                          {fmtUSD(equity)}
                        </strong>
                      </span>
                      <span>
                        Free Margin:{' '}
                        <strong className="text-text font-semibold tabular-nums">
                          {fmtUSD(free)}
                        </strong>
                      </span>

                      {showMoreTelemetry && (
                        <>
                          <span>
                            Margin:{' '}
                            <strong className="text-text font-semibold tabular-nums">
                              {fmtUSD(used)}
                            </strong>
                          </span>
                          <span>
                            Margin Level:{' '}
                            <strong
                              className={cn(
                                'font-semibold tabular-nums',
                                level !== null && level <= 120
                                  ? 'text-rose-500'
                                  : 'text-text'
                              )}
                            >
                              {level !== null ? fmtPct(level, 1) : '—'}
                            </strong>
                          </span>
                          <span>
                            Leverage:{' '}
                            <strong className="text-text font-semibold tabular-nums">
                              1:{lev}
                            </strong>
                          </span>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowMoreTelemetry((v) => !v)}
                        className="inline-flex items-center gap-0.5 text-[11px] font-normal text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-muted transition-colors cursor-pointer"
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
                          'px-2.5 py-0.5 rounded text-xs font-semibold tabular-nums',
                          pnl >= 0
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                        )}
                      >
                        {fmtUSD(pnl, { sign: true })}
                      </span>
                    </div>
                  </div>
                </section>
              </Panel>
            </PanelGroup>
          )}
        </div>

        {/* Right: Dedicated Order Ticket Dock (Desktop XL >= 1280px) */}
        {isXl && (
          orderOpen ? (
            <aside className="w-[300px] min-w-[300px] shrink-0 h-full rounded-lg border border-border bg-surface flex flex-col overflow-hidden">
              <div className="shrink-0 px-3 py-2 border-b border-border-subtle flex items-center justify-between bg-bg-subtle/30">
                <h3 className="text-terminal-label font-semibold uppercase tracking-wider text-text-muted">
                  Order Ticket
                </h3>
                <button
                  type="button"
                  onClick={() => setOrderOpen(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                  title="Collapse Order Ticket (F9)"
                  aria-label="Collapse Order Ticket"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <SectionErrorBoundary sectionName="OrderTicket">
                  <OrderTicket plan={plan || metrics?.plan} onChanged={onChanged} />
                </SectionErrorBoundary>
              </div>
            </aside>
          ) : (
            <div className="w-9 shrink-0 h-full border border-border bg-surface rounded-lg flex flex-col items-center py-3 select-none">
              <button
                type="button"
                onClick={() => setOrderOpen(true)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring cursor-pointer"
                title="Expand Order Ticket (F9)"
                aria-label="Expand Order Ticket"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
