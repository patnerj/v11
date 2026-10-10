'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { fmtUSD, fmtPct, fmtDate, toNum, statusLabel, statusTone, pnlClass } from '@/lib/format'
import type { ChallengeAccount, ChallengeMetrics } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { ChallengeProgressCard } from '@/components/dashboard/challenge-progress-card'
import { ChevronDown, Plus, Trophy, Sparkles, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { PhasePassCelebrationModal } from '@/components/dashboard/PhasePassCelebrationModal'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'

export default function DashboardChallenges() {
  const [metrics, setMetrics] = useState<Record<number, ChallengeMetrics | undefined>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [celebratingChallenge, setCelebratingChallenge] = useState<ChallengeAccount | null>(null)

  const { data: rawList, isPending } = useQuery({
    queryKey: ['challengeMy'],
    queryFn: async () => {
      const res = await api.challengeMy()
      if (!res.ok) throw new Error('Failed to fetch')
      return res.data
    },
    refetchInterval: 15_000,
  })

  const list = Array.isArray(rawList) ? (rawList as ChallengeAccount[]) : null
  const loading = isPending && !list

  useEffect(() => {
    if (!list || list.length === 0) return
    const active = list.find((c) => c.status === 'active') || list[0]
    if (active && expanded === null) {
      setExpanded(active.id)
    }
    if (active && !metrics[active.id]) {
      api.challengeMetrics(active.id).then((m) => {
        if (m.ok) setMetrics((prev) => ({ ...prev, [active.id]: m.data }))
      })
    }
  }, [list, expanded, metrics])

  const toggleExpand = async (id: number) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!metrics[id]) {
      const m = await api.challengeMetrics(id)
      if (m.ok) setMetrics((prev) => ({ ...prev, [id]: m.data }))
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        variant="hero"
        title="Your challenges"
        description="Track active evaluations, see past results, and start new challenges."
        icon={Trophy}
        badge={{ label: 'Evaluations', tone: 'accent' }}
        actions={
          <Button asChild size="sm">
            <Link href="/challenges"><Plus className="h-4 w-4 mr-1.5" /> New challenge</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>)}
        </div>
      ) : !list || list.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center">
            <div className="inline-flex h-12 w-12 rounded-xl bg-accent/10 text-accent items-center justify-center mb-4">
              <Trophy className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-text">No challenges yet</h2>
            <p className="text-sm text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
              Buy your first challenge to start the evaluation process.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/challenges">Browse challenges →</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((c) => {
            const exp     = expanded === c.id
            const m       = metrics[c.id]
            const profit  = toNum(c.current_balance) - toNum(c.starting_balance)
            const profitPct = (profit / Math.max(1, toNum(c.starting_balance))) * 100
            return (
              <Card key={c.id} className="overflow-hidden border-border/60">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(c.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(c.id) }}
                  className="w-full p-4 sm:p-5 flex items-center gap-4 hover:bg-surface-muted/30 transition-colors text-left focus-ring cursor-pointer"
                  aria-expanded={exp}
                >
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div>
                      <div className="font-semibold text-text truncate">{c.plan_name ?? `Challenge #${c.id}`}</div>
                      <div className="text-2xs text-text-muted terminal-num">{fmtUSD(c.account_size ?? 0, { decimals: 0 })}</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Phase</div>
                      <div className="text-sm font-medium text-text">{c.phase}</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted">P&L</div>
                      <div className={cn('text-sm font-semibold terminal-num', pnlClass(profit))}>
                        {fmtUSD(profit, { sign: true })} <span className="text-2xs text-text-muted">({fmtPct(profitPct, 1, true)})</span>
                      </div>
                    </div>
                    <div className="flex items-center sm:justify-end gap-2">
                      {(c.status === 'passed' || c.status === 'funded' || (m && (m.profit_progress >= 100 || m.status === 'passed' || m.status === 'funded'))) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCelebratingChallenge(c)
                          }}
                          className="px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-profit-subtle text-profit border border-profit-subtle hover:bg-profit/20 transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                          title="View Phase Pass Celebration"
                        >
                          <Sparkles className="w-3 h-3 text-profit animate-pulse" />
                          <span>Passed! 🎉</span>
                        </button>
                      )}
                      <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>
                    </div>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-text-muted shrink-0 transition-transform duration-200', exp && 'rotate-180')} />
                </div>

                <AnimatePresence initial={false}>
                  {exp && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden border-t border-border-subtle"
                    >
                      <div className="p-4 sm:p-5">
                        {m ? (
                          <SectionErrorBoundary sectionName="Challenge Progress">
                            <div className="grid lg:grid-cols-2 gap-4">
                              <ChallengeProgressCard metrics={m} />
                              <ChallengeDetailCard challenge={c} metrics={m} />
                            </div>
                          </SectionErrorBoundary>
                        ) : (
                          <Skeleton className="h-64 w-full" />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}
        </div>
      )}

      {/* Phase Pass Celebration Confetti & Congratulations Modal */}
      <PhasePassCelebrationModal
        challenge={celebratingChallenge || list?.find((c) => c.status === 'passed' || (metrics[c.id] && (metrics[c.id]?.profit_progress ?? 0) >= 100)) || null}
        metrics={celebratingChallenge ? metrics[celebratingChallenge.id] : (list?.find((c) => c.status === 'passed' || (metrics[c.id] && (metrics[c.id]?.profit_progress ?? 0) >= 100)) ? metrics[list.find((c) => c.status === 'passed' || (metrics[c.id] && (metrics[c.id]?.profit_progress ?? 0) >= 100))!.id] : null)}
        isOpen={celebratingChallenge !== null ? true : undefined}
        onClose={() => setCelebratingChallenge(null)}
      />
    </div>
  )
}

function CredentialsBox({ challenge: c }: { challenge: ChallengeAccount }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {})
      }
    } catch {}
    setCopiedKey(key)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleCopyAll = () => {
    const creds = [
      `MT5 Server: ${c.mt5_server || 'MetaQuotes-Demo'}`,
      `MT5 Login: ${c.mt5_login}`,
      `Trader Password: ${c.mt5_password || ''}`,
      `Investor Password: ${(c as any).mt5_investor_password || ''}`,
    ].join('\n')
    handleCopy(creds, 'all', 'All MT5 Credentials')
  }

  return (
    <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-accent flex items-center gap-1.5">
          MetaTrader 5 Credentials
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-2xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent/10 transition-colors cursor-pointer select-none"
        >
          {copiedKey === 'all' ? (
            <>
              <Check className="w-3 h-3 text-profit" />
              <span className="text-profit font-bold">✓ Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy All</span>
            </>
          )}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-surface-muted/50 p-2.5 rounded-lg border border-border-subtle">
        <div className="flex items-center justify-between group">
          <div>
            <span className="text-text-muted text-2xs block">Broker Server</span>
            <span className="font-medium text-text">{c.mt5_server || 'MetaQuotes-Demo'}</span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(c.mt5_server || 'MetaQuotes-Demo', 'server', 'Server')}
            className="p-1 rounded text-text-muted hover:text-text transition-colors cursor-pointer"
            title="Copy Server"
          >
            {copiedKey === 'server' ? <span className="text-2xs text-profit font-bold">✓ Copied!</span> : <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />}
          </button>
        </div>
        <div className="flex items-center justify-between group">
          <div>
            <span className="text-text-muted text-2xs block">MT5 Login ID</span>
            <span className="font-bold terminal-num text-text">{c.mt5_login}</span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(String(c.mt5_login), 'login', 'Login ID')}
            className="p-1 rounded text-text-muted hover:text-text transition-colors cursor-pointer"
            title="Copy Login"
          >
            {copiedKey === 'login' ? <span className="text-2xs text-profit font-bold">✓ Copied!</span> : <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />}
          </button>
        </div>
        <div className="flex items-center justify-between group">
          <div>
            <span className="text-text-muted text-2xs block">Trader Password</span>
            <span className="font-medium tabular text-text">{c.mt5_password || '••••••••'}</span>
          </div>
          {c.mt5_password && (
            <button
              type="button"
              onClick={() => handleCopy(c.mt5_password!, 'pass', 'Trader Password')}
              className="p-1 rounded text-text-muted hover:text-text transition-colors cursor-pointer"
              title="Copy Password"
            >
              {copiedKey === 'pass' ? <span className="text-2xs text-profit font-bold">✓ Copied!</span> : <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between group">
          <div>
            <span className="text-text-muted text-2xs block">Investor (Myfxbook)</span>
            <span className="font-medium tabular text-text">{(c as any).mt5_investor_password || '••••••••'}</span>
          </div>
          {(c as any).mt5_investor_password && (
            <button
              type="button"
              onClick={() => handleCopy((c as any).mt5_investor_password, 'inv', 'Investor Password')}
              className="p-1 rounded text-text-muted hover:text-text transition-colors cursor-pointer"
              title="Copy Investor Password"
            >
              {copiedKey === 'inv' ? <span className="text-2xs text-profit font-bold">✓ Copied!</span> : <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ChallengeDetailCard({ challenge: c, metrics: m }: { challenge: ChallengeAccount; metrics: ChallengeMetrics }) {
  return (
    <Card className="h-full relative overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Account details</CardTitle>
        {c.mt5_login && (
          <Badge tone="accent" size="sm" className="tabular font-semibold text-2xs">
            MT5: #{c.mt5_login}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <KV label="Started"           value={fmtDate(c.created_at)} />
        <KV label="Phase started"     value={fmtDate(c.phase_started_at)} />
        {c.passed_at  && <KV label="Phase passed" value={fmtDate(c.passed_at)} />}
        {c.failed_at  && <KV label="Failed"       value={fmtDate(c.failed_at)} tone="danger" />}
        {c.funded_at  && <KV label="Funded"       value={fmtDate(c.funded_at)} tone="success" />}
        <hr className="border-border-subtle" />
        <KV label="Starting balance" value={fmtUSD(m.starting_balance)} mono />
        <KV label="Current balance"  value={fmtUSD(m.balance)} mono />
        <KV label="Equity"           value={fmtUSD(m.equity)} mono />
        <KV label="Peak balance"     value={fmtUSD(c.peak_balance)} mono />
        <hr className="border-border-subtle" />
        <KV label="Win rate"      value={fmtPct(m.win_rate)} />
        <KV label="Profit factor" value={toNum(m.profit_factor).toFixed(2)} mono />
        <KV label="Total trades"  value={String(m.total_trades)} />

        {c.mt5_login && (
          <CredentialsBox challenge={c} />
        )}
      </CardContent>
    </Card>
  )
}

function KV({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: 'success' | 'danger' }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn(
        'font-medium',
        mono && 'terminal-num font-semibold',
        tone === 'success' && 'text-success',
        tone === 'danger'  && 'text-danger',
      )}>{value}</span>
    </div>
  )
}
