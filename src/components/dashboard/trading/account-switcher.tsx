'use client'

/**
 * Account switcher — sleek institutional dropdown shared across the trading terminal,
 * dashboard, analytics, and history pages.
 * Replaces bulky multi-line button clutter with an ultra-compact single-row trigger and
 * categorized dropdown menu with instant search.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { usePrices, type TradingContext } from '@/store/prices'
import { cn } from '@/lib/cn'
import { fmtUSD, toNum } from '@/lib/format'
import {
  ChevronDown,
  Check,
  Search,
  X,
  Trophy,
  Briefcase,
  Sparkles,
  Loader2,
  ShieldCheck
} from 'lucide-react'

export interface SwitchEntry {
  key: string
  label: string
  sub?: string
  ctx: TradingContext
  kind?: 'challenge' | 'tournament'
  status?: string
  balance?: number
  startingBalance?: number
  planName?: string
  mt5Login?: string
  phase?: number
  accountId?: number
  tournamentId?: number
}

export function AccountSwitcher({ entries }: { entries: SwitchEntry[] }) {
  const ctx = usePrices((s) => s.tradingContext)
  const switching = usePrices((s) => s.contextSwitching)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeKey = ctx
    ? ctx.kind === 'tournament'
      ? `t-${ctx.tournamentId}`
      : ctx.accountId
        ? `c-${ctx.accountId}`
        : 'challenge'
    : 'challenge'

  const activeEntry = useMemo(() => {
    return entries.find((e) => e.key === activeKey) || entries[0]
  }, [entries, activeKey])

  const switchTo = async (entry: SwitchEntry) => {
    if (pendingKey !== null || entry.key === activeKey) {
      setIsOpen(false)
      return
    }
    setPendingKey(entry.key)
    setIsOpen(false)
    try {
      await usePrices.getState().setTradingContext(entry.ctx)
    } finally {
      setPendingKey(null)
    }
  }

  // Handle click outside and Escape key to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Filter entries based on search input
  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase().trim()
    return entries.filter((e) => {
      const labelMatch = e.label.toLowerCase().includes(q)
      const subMatch = e.sub ? e.sub.toLowerCase().includes(q) : false
      const mt5Match = e.mt5Login ? String(e.mt5Login).includes(q) : false
      const idMatch = e.accountId ? String(e.accountId).includes(q) : false
      const planMatch = e.planName ? e.planName.toLowerCase().includes(q) : false
      return labelMatch || subMatch || mt5Match || idMatch || planMatch
    })
  }, [entries, search])

  // Group entries into Active, Tournaments, and Review/Past
  const { activeChallenges, tournaments, reviewChallenges } = useMemo(() => {
    const active: SwitchEntry[] = []
    const tourneys: SwitchEntry[] = []
    const review: SwitchEntry[] = []

    for (const e of filteredEntries) {
      if (e.kind === 'tournament') {
        tourneys.push(e)
      } else {
        const st = (e.status || '').toLowerCase()
        if (st === 'active' || st === 'funded') {
          active.push(e)
        } else {
          review.push(e)
        }
      }
    }

    return { activeChallenges: active, tournaments: tourneys, reviewChallenges: review }
  }, [filteredEntries])

  if (entries.length === 0) return null

  const renderItem = (e: SwitchEntry) => {
    const active = e.key === activeKey
    const busy = pendingKey === e.key
    const isFunded = e.status === 'funded'
    const isFailed = e.status === 'failed'
    const isPassed = e.status === 'passed'

    return (
      <button
        key={e.key}
        type="button"
        disabled={busy || switching}
        onClick={() => switchTo(e)}
        className={cn(
          "w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 group focus-ring select-none",
          active
            ? "bg-accent/15 border-accent/50 text-text shadow-xs"
            : isFailed
              ? "bg-surface/40 border-border/40 opacity-75 hover:opacity-100 hover:bg-surface-muted/60"
              : "bg-surface/70 border-border/60 hover:bg-surface-muted/80 hover:border-border-strong text-text"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon indicator */}
          <div className="shrink-0">
            {e.kind === 'tournament' ? (
              <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-4 h-4" />
              </div>
            ) : isFunded ? (
              <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
            ) : isFailed ? (
              <div className="w-7 h-7 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <X className="w-4 h-4" />
              </div>
            ) : isPassed ? (
              <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Briefcase className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-xs text-text truncate max-w-[200px]">
                {e.planName || e.label}
              </span>
              {e.accountId && (
                <span className="text-3xs font-mono text-text-muted">
                  #{e.accountId}
                </span>
              )}
              {e.mt5Login && (
                <span className="px-1 py-0.5 rounded text-3xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  MT5: #{e.mt5Login}
                </span>
              )}
              {isFunded && (
                <span className="px-1 py-0.5 rounded text-3xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Funded
                </span>
              )}
              {isFailed && (
                <span className="px-1 py-0.5 rounded text-3xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  Failed
                </span>
              )}
              {isPassed && (
                <span className="px-1 py-0.5 rounded text-3xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Passed
                </span>
              )}
            </div>

            {e.sub && (
              <p className="text-3xs text-text-muted truncate mt-0.5 font-mono">
                {e.sub}
              </p>
            )}
          </div>
        </div>

        {/* Right: Balance & Active indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {e.balance !== undefined && (
            <span className="font-mono text-xs font-bold text-emerald-400">
              {fmtUSD(e.balance, { decimals: 0 })}
            </span>
          )}

          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
          ) : active ? (
            <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Check className="w-3.5 h-3.5" />
            </div>
          ) : null}
        </div>
      </button>
    )
  }

  return (
    <div ref={dropdownRef} className="relative z-40 w-full">
      {/* Sleek single-row trigger bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-surface/90 border border-border/80 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-3xs text-text-muted font-mono uppercase tracking-wider shrink-0 hidden sm:inline">
            Active Account
          </span>

          <button
            type="button"
            disabled={pendingKey !== null || switching}
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn(
              "group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all focus-ring select-none cursor-pointer",
              isOpen
                ? "bg-accent/15 border-accent/60 text-accent shadow-xs"
                : "bg-surface-muted/80 border-border hover:border-border-strong hover:bg-surface-muted text-text"
            )}
            title={activeEntry?.sub}
          >
            {/* Pulsing indicator dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              {activeEntry?.status === 'funded' ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              ) : activeEntry?.kind === 'tournament' ? (
                <Trophy className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </>
              )}
            </span>

            {/* Account Title / Plan Name */}
            <span className="font-semibold text-text max-w-[140px] sm:max-w-[220px] md:max-w-[280px] truncate">
              {activeEntry?.planName || activeEntry?.label || 'Select Account'}
            </span>

            {/* Account ID */}
            {activeEntry?.accountId && (
              <span className="text-3xs font-mono text-text-muted shrink-0">
                #{activeEntry.accountId}
              </span>
            )}

            {/* MT5 Badge if connected */}
            {activeEntry?.mt5Login && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
                MT5: #{activeEntry.mt5Login}
              </span>
            )}

            {/* Live Balance */}
            {activeEntry?.balance !== undefined && (
              <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                {fmtUSD(activeEntry.balance, { decimals: 0 })}
              </span>
            )}

            {/* Dropdown Chevron */}
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform duration-200 shrink-0",
                isOpen && "rotate-180 text-accent"
              )}
            />
          </button>

          {/* Total accounts count badge */}
          {entries.length > 1 && (
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono text-text-muted bg-surface-muted border border-border/50 shrink-0">
              {entries.length} Accounts
            </span>
          )}
        </div>

        {/* Right side: status or loading */}
        <div className="flex items-center gap-2 shrink-0">
          {(switching || pendingKey !== null) ? (
            <div className="flex items-center gap-1.5 text-xs text-accent font-mono animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Switching account…</span>
            </div>
          ) : (
            <span className="hidden xl:inline-block text-3xs font-mono text-text-faint">
              Instant MT5 &amp; WebTrader context sync
            </span>
          )}
        </div>
      </div>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full sm:w-[480px] max-w-[95vw] rounded-xl bg-[#0d121f]/95 border border-border/80 shadow-2xl backdrop-blur-xl p-2.5 flex flex-col gap-2 animate-in fade-in-0 zoom-in-95 duration-150 z-50">
          {/* Search box if multiple accounts */}
          {entries.length > 3 && (
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts (plan, ID, or MT5 login)..."
                className="w-full h-8 pl-8 pr-7 text-xs bg-surface-muted/80 border border-border/60 rounded-lg text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-text-muted hover:text-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Categorized Accounts List */}
          <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2.5 divide-y divide-border/20 custom-scrollbar">
            {/* Active Challenges */}
            {activeChallenges.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-3xs font-mono uppercase tracking-wider text-text-muted font-bold flex items-center justify-between">
                  <span>Active Challenges</span>
                  <span>{activeChallenges.length}</span>
                </div>
                {activeChallenges.map(renderItem)}
              </div>
            )}

            {/* Tournaments */}
            {tournaments.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="px-2 py-1 text-3xs font-mono uppercase tracking-wider text-text-muted font-bold flex items-center justify-between">
                  <span>Tournaments</span>
                  <span>{tournaments.length}</span>
                </div>
                {tournaments.map(renderItem)}
              </div>
            )}

            {/* Past / Review Challenges */}
            {reviewChallenges.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="px-2 py-1 text-3xs font-mono uppercase tracking-wider text-text-muted font-bold flex items-center justify-between">
                  <span>Past / Review Accounts</span>
                  <span>{reviewChallenges.length}</span>
                </div>
                {reviewChallenges.map(renderItem)}
              </div>
            )}

            {filteredEntries.length === 0 && (
              <div className="py-6 text-center text-xs text-text-muted">
                No accounts match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Build switcher entries from active challenges + joined tournaments. */
export function buildSwitchEntries(
  challenges: Array<{
    fxsim_account_id: number
    id?: number
    status?: string
    plan_name?: string
    current_balance?: number | string
    starting_balance?: number | string
    phase?: number
    mt5_login?: string | null
  }>,
  tournaments: Array<{
    tournament_id: number
    title: string
    starting_balance: number | string
    tournament_status?: string
  }>,
  activeOnly = false,
): SwitchEntry[] {
  const entries: SwitchEntry[] = []
  const safeChallenges = Array.isArray(challenges) ? challenges : []
  const safeTournaments = Array.isArray(tournaments) ? tournaments : []

  for (const ch of safeChallenges) {
    if (!ch) continue
    const st = (ch.status ?? '').toLowerCase()
    // activeOnly (terminal): only tradeable accounts. Dashboard: all, so a
    // failed challenge's final stats stay reviewable.
    if (activeOnly && st !== 'active' && st !== 'funded') continue

    const sub = st === 'funded' ? 'Funded Account'
      : st === 'failed' ? 'Failed (Review Only)'
      : st === 'passed' ? 'Passed (Review Only)'
      : `Balance: ${fmtUSD(toNum(ch.current_balance || ch.starting_balance), { decimals: 0 })}`
    
    const mt5Tag = ch.mt5_login ? ` [MT5: #${ch.mt5_login}]` : ''
    const plan = ch.plan_name || `Challenge #${ch.fxsim_account_id}`
    const label = plan + mt5Tag + (st === 'failed' ? ' (Failed)' : '')

    entries.push({
      key: `c-${ch.fxsim_account_id}`,
      label,
      sub: (ch.mt5_login ? `MT5 #${ch.mt5_login} · ` : '') + sub,
      ctx: { kind: 'challenge', accountId: ch.fxsim_account_id, title: ch.plan_name },
      kind: 'challenge',
      status: st,
      balance: toNum(ch.current_balance || ch.starting_balance),
      startingBalance: toNum(ch.starting_balance),
      planName: ch.plan_name,
      mt5Login: ch.mt5_login || undefined,
      phase: ch.phase ?? 1,
      accountId: ch.fxsim_account_id,
    })
  }

  for (const t of safeTournaments) {
    if (!t) continue
    entries.push({
      key: `t-${t.tournament_id}`,
      label: `🏆 ${t.title}`,
      sub: `Tournament · start ${fmtUSD(toNum(t.starting_balance), { decimals: 0 })}`,
      ctx: { kind: 'tournament', tournamentId: t.tournament_id, title: t.title },
      kind: 'tournament',
      status: t.tournament_status ?? 'active',
      balance: toNum(t.starting_balance),
      tournamentId: t.tournament_id,
    })
  }

  return entries
}

