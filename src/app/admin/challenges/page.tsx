'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ChallengeAccount } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { fmtUSD, fmtPct, fmtDate, statusLabel, statusTone, toNum } from '@/lib/format'
import { 
  Trophy, Shield, Layers, TrendingUp, AlertTriangle, ArrowUpRight, 
  Search, RefreshCw, CheckCircle2, DollarSign, Activity, Lock
} from 'lucide-react'
import Link from 'next/link'
import { ChallengeDrawer } from '@/components/admin/challenge-drawer'

const STANDARD_PLANS = [
  { id: 1, name: '$5K Starter Challenge', size: 5000, fee: 49, targetP1: 8, targetP2: 5, maxDd: 10, dailyDd: 5, split: 80 },
  { id: 2, name: '$10K Practitioner Challenge', size: 10000, fee: 89, targetP1: 8, targetP2: 5, maxDd: 10, dailyDd: 5, split: 80 },
  { id: 3, name: '$25K Advanced Challenge', size: 25000, fee: 189, targetP1: 8, targetP2: 5, maxDd: 10, dailyDd: 5, split: 80 },
  { id: 4, name: '$50K Professional Challenge', size: 50000, fee: 299, targetP1: 8, targetP2: 5, maxDd: 10, dailyDd: 5, split: 80 },
  { id: 5, name: '$100K Elite Challenge', size: 100000, fee: 499, targetP1: 8, targetP2: 5, maxDd: 10, dailyDd: 5, split: 80 },
  { id: 6, name: '$200K Master Challenge', size: 200000, fee: 949, targetP1: 8, targetP2: 5, maxDd: 10, dailyDd: 5, split: 85 },
]

export default function AdminChallengesPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'plans' | 'rules'>('accounts')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const { data: challengesResp, isPending, refetch, isFetching } = useQuery({
    queryKey: ['adminChallengesList', statusFilter],
    queryFn: async () => {
      const res = await api.admin.challenges({ 
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter 
      })
      if (!res.ok) throw new Error('Failed to load challenges')
      return res.data
    },
    refetchInterval: 30_000,
  })

  const rawChallenges: ChallengeAccount[] = Array.isArray(challengesResp?.challenges) 
    ? challengesResp!.challenges 
    : []

  const filteredChallenges = rawChallenges.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      String(c.id).includes(q) ||
      String(c.user_id).includes(q) ||
      (c.plan_name && c.plan_name.toLowerCase().includes(q)) ||
      (c.status && c.status.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        variant="hero"
        title="Challenge Management Hub"
        description="Monitor active evaluation stages, calibrate plan templates, and review prop firm trailing drawdown parameters."
        icon={Trophy}
        badge={{ label: 'Core Engine', tone: 'accent' }}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              loading={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/traders">
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Issue Manual Challenge
              </Link>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'accounts'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Activity className="h-4 w-4" /> Active Challenge Accounts
          {rawChallenges.length > 0 && (
            <Badge tone="accent" size="sm" className="ml-1 text-2xs">{rawChallenges.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'plans'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Layers className="h-4 w-4" /> Plan Templates & Pricing
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Shield className="h-4 w-4" /> Risk & Trailing Rules
        </button>
      </div>

      {/* TAB 1: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Search by ID, User, or Plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Status:</span>
              {(['all', 'active', 'passed', 'funded', 'breached'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-2xs uppercase font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'bg-surface-muted text-text-muted hover:text-text'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isPending && rawChallenges.length === 0 ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredChallenges.length === 0 ? (
                <div className="p-12 text-center text-text-muted text-sm">
                  <Trophy className="h-10 w-10 mx-auto text-text-faint mb-3 opacity-40" />
                  <p className="font-medium text-text">No challenge accounts found</p>
                  <p className="text-2xs text-text-muted mt-1">Try adjusting your search criteria or issue a new evaluation account.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/40 text-text-muted text-2xs uppercase tracking-wider">
                        <th className="text-left px-4 py-3 font-semibold">ID</th>
                        <th className="text-left px-4 py-3 font-semibold">Trader</th>
                        <th className="text-left px-4 py-3 font-semibold">Plan Template</th>
                        <th className="text-right px-4 py-3 font-semibold">Size</th>
                        <th className="text-right px-4 py-3 font-semibold">Balance</th>
                        <th className="text-right px-4 py-3 font-semibold">Trailing Floor</th>
                        <th className="text-center px-4 py-3 font-semibold">Stage</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-right px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredChallenges.map((c) => {
                        const floor = toNum((c as any).trailing_dd_floor)
                        const size = toNum(c.account_size)
                        return (
                          <tr 
                            key={c.id} 
                            onClick={() => {
                              setSelectedChallenge(c)
                              setIsDrawerOpen(true)
                            }}
                            className="hover:bg-surface-muted/60 transition-colors cursor-pointer group"
                          >
                            <td className="px-4 py-3 terminal-num font-medium text-text">#{c.id}</td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Link 
                                href={`/admin/traders/${c.user_id}`}
                                className="font-medium text-accent hover:underline flex items-center gap-1"
                              >
                                User #{c.user_id}
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-text font-medium">{c.plan_name ?? 'Standard Evaluation'}</td>
                            <td className="px-4 py-3 text-right tabular text-text-muted">{fmtUSD(size, { decimals: 0 })}</td>
                            <td className="px-4 py-3 text-right tabular font-semibold text-text">{fmtUSD(c.current_balance)}</td>
                            <td className="px-4 py-3 text-right tabular text-danger font-semibold">
                              {floor > 0 ? fmtUSD(floor) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded bg-surface-muted border border-border text-2xs font-semibold">
                                Phase {c.phase ?? 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge tone={statusTone(c.status)} size="sm">{statusLabel(c.status)}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-2xs border-accent/40 text-accent hover:bg-accent/10"
                                  onClick={() => {
                                    setSelectedChallenge(c)
                                    setIsDrawerOpen(true)
                                  }}
                                >
                                  Inspect
                                </Button>
                                <Button asChild variant="ghost" size="sm" className="h-7 text-2xs">
                                  <Link href={`/admin/traders/${c.user_id}`}>Profile</Link>
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
        </div>
      )}

      {/* TAB 2: PLANS */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Evaluation Tier Specifications</h2>
              <p className="text-2xs text-text-muted">Standard 2-Phase evaluation plans deployed across the firm.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/config">Edit Plans in Brand Config →</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STANDARD_PLANS.map((p) => (
              <Card key={p.id} className="border-border hover:border-accent/60 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Plan Template #{p.id}</div>
                      <CardTitle className="text-lg mt-0.5">{p.name}</CardTitle>
                    </div>
                    <Badge tone="accent" className="font-mono">${p.fee}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-2xs bg-surface-muted/40 p-2.5 rounded-lg border border-border">
                    <div>
                      <span className="text-text-muted">Account Capital:</span>
                      <div className="font-bold text-text text-sm tabular">{fmtUSD(p.size, { decimals: 0 })}</div>
                    </div>
                    <div>
                      <span className="text-text-muted">Profit Split:</span>
                      <div className="font-bold text-emerald-400 text-sm tabular">{p.split}%</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-text-muted">Phase 1 Target:</span>
                      <span className="font-medium text-text tabular">{p.targetP1}% ({fmtUSD((p.size * p.targetP1) / 100)})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-text-muted">Phase 2 Target:</span>
                      <span className="font-medium text-text tabular">{p.targetP2}% ({fmtUSD((p.size * p.targetP2) / 100)})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-text-muted">Max Trailing Drawdown:</span>
                      <span className="font-medium text-danger tabular">{p.maxDd}% ({fmtUSD((p.size * p.maxDd) / 100)})</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-text-muted">Daily Drawdown Limit:</span>
                      <span className="font-medium text-warn tabular">{p.dailyDd}% ({fmtUSD((p.size * p.dailyDd) / 100)})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RULES & TRAILING DRAWDOWN */}
      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border">
            <CardHeader>
              <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-2">
                <TrendingUp className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Trailing Drawdown Ratchet</CardTitle>
              <CardDescription className="text-xs">
                How peak equity affects account risk limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-text-muted">
              <p>
                The Trailing Drawdown Floor is calculated dynamically from the trader&apos;s <strong>Equity High Water Mark (HWM)</strong>.
              </p>
              <div className="p-3 bg-surface-muted rounded-lg font-mono text-2xs text-text border border-border">
                Trailing Floor = HWM - (Starting Balance * 10%)
              </div>
              <p>
                As the trader makes profit, the floor ratchets upwards. The floor never drops back down when equity decreases.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Starting Balance Floor Lock</CardTitle>
              <CardDescription className="text-xs">
                Permanent lock once target profit is reached
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-text-muted">
              <p>
                When a challenge account reaches <strong>+5% profit</strong>, the trailing floor locks permanently at the <strong>Starting Balance</strong>.
              </p>
              <div className="p-3 bg-emerald-500/10 rounded-lg text-2xs text-emerald-400 border border-emerald-500/20 font-medium">
                🛡️ Once locked, the trader can never lose their initial capital floor even if equity climbs further.
              </div>
              <p>
                This ensures traders who perform well retain ample breathing room without continuous ratcheting pressure.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <div className="h-9 w-9 rounded-lg bg-warn/10 border border-warn/20 flex items-center justify-center text-warn mb-2">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Daily Drawdown Sentinel</CardTitle>
              <CardDescription className="text-xs">
                Daily midnight 00:00 UTC calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-text-muted">
              <p>
                Daily drawdown is limited to <strong>5%</strong> of the previous server midnight equity or balance (whichever is higher).
              </p>
              <div className="p-3 bg-surface-muted rounded-lg font-mono text-2xs text-text border border-border">
                Daily Limit = Midnight Base * 0.95
              </div>
              <p>
                The sentinel evaluates open trades in real-time tick cycles. Breaches automatically transition the account to frozen state.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Slide-Over Quick Inspection Drawer (Phase 2) */}
      <ChallengeDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedChallenge(null)
        }}
        challenge={selectedChallenge}
        onRefresh={() => refetch()}
      />
    </div>
  )
}
