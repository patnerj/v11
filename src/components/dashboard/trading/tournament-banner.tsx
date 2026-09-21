'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Trophy, ArrowRightLeft, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { usePrices } from '@/store/prices'
import { fmtUSD, toNum } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Account, TournamentMine } from '@/types/api'
import type { SwitchEntry } from './account-switcher'

interface TournamentWarningBannerProps {
  tournamentId: number
  tournamentTitle?: string
  account: Account | null
  myTournaments?: TournamentMine[] | null
  switchEntries: SwitchEntry[]
}

/**
 * Prominent golden/amber warning banner rendered at the top of WebTrader
 * when a tournament account is active.
 *
 * Renders:
 * 🏆 TOURNAMENT MODE ACTIVE: [Tournament Name] (Rank: #[Rank] · PnL: $[PnL]) · [Switch to Funded Account / Standard Account]
 *
 * Features:
 * - 1-click interactive action to instantly switch to real funded / evaluation account.
 * - Live dynamic rank and PnL calculation with defensive array normalization (Rule 1.2).
 * - Clear isolation disclaimer to prevent accidental confusion with real funded capital.
 */
export function TournamentWarningBanner({
  tournamentId,
  tournamentTitle,
  account,
  myTournaments,
  switchEntries,
}: TournamentWarningBannerProps) {
  const [isSwitching, setIsSwitching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Query live tournament leaderboard for real-time rank and participant stats
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useQuery({
    queryKey: ['tournamentLeaderboard', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return null
      const res = await api.tournaments.leaderboard(tournamentId)
      return res.ok ? res.data : null
    },
    enabled: !!tournamentId,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  // Defensive array normalization (Rule 1.2 in AGENTS.md)
  const leaderboard = useMemo(() => {
    if (!leaderboardData) return []
    if (Array.isArray(leaderboardData)) return leaderboardData
    if (leaderboardData && typeof leaderboardData === 'object' && Array.isArray((leaderboardData as any).leaderboard)) {
      return (leaderboardData as any).leaderboard
    }
    return []
  }, [leaderboardData])

  // Current tournament metadata from joined list
  const currentTourney = useMemo(() => {
    const safe = Array.isArray(myTournaments) ? myTournaments : []
    return safe.find((t) => Number(t.tournament_id) === Number(tournamentId)) || null
  }, [myTournaments, tournamentId])

  // Current trader's participant record in the tournament (matches by account_id or user_id)
  const myParticipant = useMemo(() => {
    const targetAccId = account && 'id' in account ? Number(account.id) : (currentTourney?.account_id ? Number(currentTourney.account_id) : null)
    const targetUid = account && 'user_id' in account ? Number(account.user_id) : null
    if (!targetAccId && !targetUid) return null
    return leaderboard.find((p: any) => {
      if (targetAccId && Number(p.account_id) === targetAccId) return true
      if (targetUid && Number(p.user_id) === targetUid) return true
      return false
    }) || null
  }, [leaderboard, account, currentTourney])

  // Dynamic Rank & Live PnL Telemetry
  const rankDisplay = myParticipant?.rank ? `#${myParticipant.rank}` : (isLeaderboardLoading ? '...' : '—')

  const startingBal = toNum(currentTourney?.starting_balance || myParticipant?.starting_equity || (account ? account.balance : 10000))
  const liveEquity = account ? toNum(account.equity) : (myParticipant ? toNum(myParticipant.current_equity) : startingBal)
  const pnlVal = liveEquity - startingBal
  const pnlDisplay = fmtUSD(pnlVal, { sign: true })

  const displayTitle = tournamentTitle || currentTourney?.title || `Tournament #${tournamentId}`

  // Determine the best non-tournament account to switch back to
  const targetAccount = useMemo(() => {
    const safeEntries = Array.isArray(switchEntries) ? switchEntries : []
    // 1. Prefer Funded Account
    const funded = safeEntries.find((e) => e.kind === 'challenge' && e.status === 'funded')
    if (funded) return { entry: funded, label: 'Switch to Funded Account', isFunded: true }
    // 2. Second preference: Active evaluation challenge account -> Standard Account
    const active = safeEntries.find((e) => e.kind === 'challenge' && e.status === 'active')
    if (active) return { entry: active, label: 'Switch to Standard Account', isFunded: false }
    // 3. Fallback: Any non-tournament account
    const other = safeEntries.find((e) => e.kind !== 'tournament')
    if (other) return { entry: other, label: 'Switch to Standard Account', isFunded: false }
    return null
  }, [switchEntries])

  // Filter list of available non-tournament accounts for optional dropdown
  const otherAccounts = useMemo(() => {
    const safeEntries = Array.isArray(switchEntries) ? switchEntries : []
    return safeEntries.filter((e) => e.kind !== 'tournament')
  }, [switchEntries])

  // 1-Click interactive switch handler with optimistic safety (Rule 12 in GEMINI.md)
  const handleSwitch = async (entry: SwitchEntry) => {
    if (isSwitching) return
    setIsSwitching(true)
    setShowDropdown(false)
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const url = new URL(window.location.href)
        url.searchParams.delete('tournament')
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
      }
      await usePrices.getState().setTradingContext(entry.ctx)
      toast.success(`Switched to ${entry.label}`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch account')
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div
      role="alert"
      className="relative z-30 w-full rounded-lg bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-amber-500/20 border-2 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.22)] backdrop-blur-md p-2.5 sm:px-4 sm:py-2.5 text-amber-100 animate-in fade-in-0 duration-200"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        {/* Left: Trophy icon + Tournament Mode Title + Telemetry (Rank & PnL) */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 flex-wrap">
          <div className="h-8 w-8 rounded-lg bg-amber-500/30 border border-amber-500/60 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
            <Trophy className="h-4.5 w-4.5 animate-pulse text-amber-300" />
          </div>

          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-extrabold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
              🏆 TOURNAMENT MODE ACTIVE:
            </span>
            <span
              className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] xs:max-w-[240px] sm:max-w-[320px]"
              title={displayTitle}
            >
              {displayTitle}
            </span>

            {/* Telemetry pill: (Rank: #[Rank] · PnL: $[PnL]) */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-amber-500/40 text-2xs sm:text-xs font-semibold tabular shadow-xs">
              <span className="text-amber-400/90 font-medium">Rank:</span>
              <span className="text-white font-bold">{rankDisplay}</span>
              <span className="text-amber-500/40">·</span>
              <span className="text-amber-400/90 font-medium">PnL:</span>
              <span className={cn('font-bold', pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {pnlDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Right: 1-Click Interactive Switch Action */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          {targetAccount ? (
            <div className="relative inline-flex items-center gap-1">
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => handleSwitch(targetAccount.entry)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-md hover:shadow-amber-500/25 transition-all select-none cursor-pointer focus-ring active:scale-95 disabled:opacity-50"
                title={`Switch to ${targetAccount.entry.label}`}
              >
                {isSwitching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                )}
                <span>{targetAccount.label}</span>
              </button>

              {otherAccounts.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown((prev) => !prev)}
                    className="h-8 w-7 inline-flex items-center justify-center rounded-md bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-500/50 transition-colors cursor-pointer"
                    title="Choose another account"
                  >
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showDropdown && 'rotate-180')} />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 rounded-lg bg-[#0b0f19]/98 border border-amber-500/40 p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-xl">
                      <div className="px-2 py-1 text-3xs uppercase tracking-wider text-amber-400 font-bold">
                        Switch to Account:
                      </div>
                      {otherAccounts.map((e) => (
                        <button
                          key={e.key}
                          type="button"
                          onClick={() => handleSwitch(e)}
                          className="w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between hover:bg-surface-muted text-text hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="truncate font-medium">{e.planName || e.label}</span>
                          {e.status === 'funded' ? (
                            <span className="text-3xs font-semibold px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Funded
                            </span>
                          ) : (
                            <span className="text-3xs font-medium text-text-muted">#{e.accountId}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/challenges"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-md hover:shadow-amber-500/25 transition-all select-none cursor-pointer focus-ring"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Funded Account</span>
            </Link>
          )}
        </div>
      </div>

      {/* Subtle bottom disclaimer */}
      <div className="mt-1 pt-1 border-t border-amber-500/20 text-3xs text-amber-200/80 flex items-center justify-between gap-2">
        <span>
          ⚠️ <strong>Notice:</strong> Trades executed in Tournament Mode are isolated to this competition and will not affect your challenge drawdown or funded account equity.
        </span>
        <span className="hidden sm:inline text-amber-400 font-mono font-medium">
          Competition ID #{tournamentId}
        </span>
      </div>
    </div>
  )
}
