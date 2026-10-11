'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, User, Wallet, Headphones, ShieldAlert, Activity,
  Trophy, Tag, BarChart3, Sliders, ArrowRight, CornerDownLeft,
  X, Loader2, FileText, CheckCircle2, AlertTriangle, Layers
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { fmtUSD } from '@/lib/format'
import { useBranding } from '@/store/branding'

interface OmniSearchDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  id: string
  title: string
  subtitle: string
  category: 'hub' | 'trader' | 'ticket' | 'payout' | 'challenge'
  href: string
  icon: React.ElementType
  badge?: string
}

const ADMIN_HUBS: NavItem[] = [
  { id: 'hub-traders', title: 'Traders Management', subtitle: 'View accounts, balances, rule overrides, and KYC', category: 'hub', href: '/admin/traders', icon: User },
  { id: 'hub-payouts', title: 'Payouts Hub', subtitle: 'Approve withdrawals, scan-to-pay wallets, and profit splits', category: 'hub', href: '/admin/payouts', icon: Wallet },
  { id: 'hub-helpdesk', title: 'Support & Helpdesk', subtitle: 'Live customer inquiry tickets, canned replies, and AI auto-pilot', category: 'hub', href: '/admin/helpdesk', icon: Headphones },
  { id: 'hub-risk', title: 'Risk & Exposure Monitor', subtitle: 'Real-time breach alerts, symbol exposures, and risk scoring', category: 'hub', href: '/admin/risk', icon: ShieldAlert },
  { id: 'hub-operations', title: 'System Operations & Health', subtitle: 'Services telemetry, emergency halt, Redis, and cron status', category: 'hub', href: '/admin/operations', icon: Activity },
  { id: 'hub-tournaments', title: 'Tournaments & Competitions', subtitle: 'Trading contest schedules, leaderboards, and prize pools', category: 'hub', href: '/admin/tournaments', icon: Trophy },
  { id: 'hub-marketing', title: 'Marketing & Promos', subtitle: 'Banners, coupons, broadcasts, and affiliate partners', category: 'hub', href: '/admin/marketing', icon: Tag },
  { id: 'hub-analytics', title: 'Platform Analytics', subtitle: 'Revenues, user growth, challenge pass/fail ratios', category: 'hub', href: '/admin/analytics', icon: BarChart3 },
  { id: 'hub-config', title: 'Configuration Hub', subtitle: 'Challenge plans, branding, MT5 bridge, and gateways', category: 'hub', href: '/admin/config', icon: Sliders },
  // ── Quick Sub-Page Direct Shortcuts ─────────────────────────────────
  { id: 'hub-config-branding', title: 'Branding & Appearance', subtitle: 'Themes, dark/light contrast, logos, typography presets', category: 'hub', href: '/admin/config?tab=branding', icon: Sliders, badge: 'CONFIG' },
  { id: 'hub-config-mt5', title: 'MT5 Gateway Bridge', subtitle: 'Server host, manager credentials, reverse copier & telemetry', category: 'hub', href: '/admin/config?tab=mt5', icon: Sliders, badge: 'CONFIG' },
  { id: 'hub-config-rules', title: 'Challenge Rules Engine', subtitle: 'Daily DD, trailing floor, IP security, news & weekend rules', category: 'hub', href: '/admin/config?tab=rules', icon: Sliders, badge: 'CONFIG' },
  { id: 'hub-config-plans', title: 'Evaluation Plans Catalog', subtitle: '1-Step, 2-Step, and Direct Instant Funding plan presets', category: 'hub', href: '/admin/config?tab=plans', icon: Sliders, badge: 'CONFIG' },
  { id: 'hub-config-payments', title: 'Payment Gateways & Crypto', subtitle: 'Stripe, USDT TRC-20, ERC-20 deposit addresses & QR codes', category: 'hub', href: '/admin/config?tab=payments', icon: Sliders, badge: 'CONFIG' },
  { id: 'hub-config-ai', title: 'AI Copilot & Auto-Pilot Settings', subtitle: 'Gemini, DeepSeek, auto-resolve & trading sentinel', category: 'hub', href: '/admin/config?tab=ai_engine', icon: Sliders, badge: 'CONFIG' },
  { id: 'hub-config-smtp', title: 'Email SMTP & Notifications', subtitle: 'Mail host credentials, welcome & breach warning templates', category: 'hub', href: '/admin/config?tab=smtp', icon: Sliders, badge: 'CONFIG' },
]

export function OmniSearchDialog({ isOpen, onClose }: OmniSearchDialogProps) {
  const router = useRouter()
  const branding = useBranding((s) => s.branding)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [traders, setTraders] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open & reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Live query debounce
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setTraders([])
      setTickets([])
      setPayouts([])
      setChallenges([])
      setLoading(false)
      return
    }

    const q = query.trim().toLowerCase()
    const cleanChallengeQ = q.replace(/^[#c\-chal]+/i, '').trim()
    let isCancelled = false
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const [usersRes, payoutsRes, ticketsRes, challengesRes] = await Promise.all([
          api.admin.users(q, 1, 8).catch(() => ({ ok: false, data: null })),
          api.admin.payoutsList().catch(() => ({ ok: false, data: [] })),
          api.tickets.list().catch(() => ({ ok: false, data: [] })),
          api.admin.challenges({ search: cleanChallengeQ || q, limit: 6 }).catch(() => ({ ok: false, data: null })),
        ])

        if (isCancelled) return

        // 1. Filter Traders
        if (usersRes.ok && usersRes.data?.data) {
          setTraders(Array.isArray(usersRes.data.data) ? usersRes.data.data.slice(0, 5) : [])
        } else {
          setTraders([])
        }

        // 2. Filter Payouts
        if (payoutsRes.ok && Array.isArray(payoutsRes.data)) {
          const matchedPayouts = payoutsRes.data.filter((p: any) => {
            const code = `PO-${p.id}`.toLowerCase()
            const name = (p.name || p.username || '').toLowerCase()
            const email = (p.email || p.user_email || '').toLowerCase()
            const addr = (p.payment_address || '').toLowerCase()
            return code.includes(q) || name.includes(q) || email.includes(q) || addr.includes(q)
          }).slice(0, 4)
          setPayouts(matchedPayouts)
        } else {
          setPayouts([])
        }

        // 3. Filter Tickets
        if (ticketsRes.ok && Array.isArray(ticketsRes.data)) {
          const matchedTickets = ticketsRes.data.filter((t: any) => {
            const idStr = String(t.id)
            const sub = (t.subject || '').toLowerCase()
            const email = (t.user_email || t.email || '').toLowerCase()
            const name = (t.display_name || t.user_login || '').toLowerCase()
            return idStr.includes(q) || sub.includes(q) || email.includes(q) || name.includes(q)
          }).slice(0, 4)
          setTickets(matchedTickets)
        } else {
          setTickets([])
        }

        // 4. Filter Challenges
        if (challengesRes.ok && challengesRes.data?.challenges && Array.isArray(challengesRes.data.challenges)) {
          const matchedChallenges = challengesRes.data.challenges.filter((c: any) => {
            const cid = String(c.id)
            const accId = String(c.account_id || '')
            const plan = (c.plan_name || '').toLowerCase()
            const login = String(c.mt5_login || c.login || '')
            const st = (c.status || '').toLowerCase()
            return cid.includes(cleanChallengeQ || q) || accId.includes(cleanChallengeQ || q) || login.includes(q) || plan.includes(q) || st.includes(q)
          }).slice(0, 5)
          setChallenges(matchedChallenges)
        } else {
          setChallenges([])
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }, 200)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, query])

  // Build filtered items list for selection
  const allItems = useMemo<NavItem[]>(() => {
    const q = query.trim().toLowerCase()
    const items: NavItem[] = []

    // 1. Hub matches
    const matchedHubs = ADMIN_HUBS.filter(
      h => !q || h.title.toLowerCase().includes(q) || h.subtitle.toLowerCase().includes(q)
    )
    items.push(...matchedHubs)

    // 2. Challenge matches
    for (const c of challenges) {
      const plan = c.plan_name || 'Challenge Account'
      const bal = Number(c.starting_balance || c.balance || 0)
      const st = (c.status || 'active').toUpperCase()
      items.push({
        id: `challenge-${c.id}`,
        title: `Challenge #${c.id}: ${plan} (${fmtUSD(bal)})`,
        subtitle: `Trader ID #${c.user_id} · MT5 #${c.mt5_login || c.login || 'N/A'} · Status: ${st}`,
        category: 'challenge',
        href: `/admin/traders/${c.user_id}?challenge=${c.id}`,
        icon: Trophy,
        badge: st,
      })
    }

    // 3. Trader matches
    for (const t of traders) {
      const email = t.user_email || t.email || ''
      const name = t.display_name || t.user_login || t.name || `Trader #${t.user_id}`
      const mt5 = t.mt5_login ? `MT5 #${t.mt5_login}` : undefined
      items.push({
        id: `trader-${t.user_id}`,
        title: name,
        subtitle: `${email}${mt5 ? ` · ${mt5}` : ''}`,
        category: 'trader',
        href: `/admin/traders?search=${encodeURIComponent(email || name)}`,
        icon: User,
        badge: mt5 || `User #${t.user_id}`,
      })
    }

    // 4. Ticket matches
    for (const tk of tickets) {
      items.push({
        id: `ticket-${tk.id}`,
        title: `Ticket #${tk.id}: ${tk.subject || 'Support Inquiry'}`,
        subtitle: `From ${tk.display_name || tk.user_login || 'Trader'} · Status: ${tk.status || 'open'}`,
        category: 'ticket',
        href: `/admin/helpdesk?ticket=${tk.id}`,
        icon: Headphones,
        badge: tk.status?.toUpperCase() || 'OPEN',
      })
    }

    // 5. Payout matches
    for (const po of payouts) {
      const amt = Number(po.amount_requested || po.amount || 0)
      items.push({
        id: `payout-${po.id}`,
        title: `Payout #PO-${po.id} (${fmtUSD(amt)})`,
        subtitle: `Trader: ${po.name || po.username || 'Trader'} · Status: ${po.status || 'requested'}`,
        category: 'payout',
        href: `/admin/payouts?search=${encodeURIComponent(String(po.id))}`,
        icon: Wallet,
        badge: po.status?.toUpperCase() || 'REQUESTED',
      })
    }

    return items
  }, [query, traders, tickets, payouts, challenges])

  // Reset index when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allItems.length])

  const executeSelection = useCallback((item: NavItem) => {
    onClose()
    router.push(item.href)
  }, [onClose, router])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = allItems[selectedIndex]
      if (target) executeSelection(target)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="w-[calc(100vw-1.5rem)] sm:max-w-2xl bg-surface text-foreground border border-border shadow-2xl backdrop-blur-2xl rounded-2xl p-0 overflow-hidden z-50 flex flex-col max-h-[82vh] ring-1 ring-primary/20"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 pl-4 pr-14 py-3.5 border-b border-border bg-surface-muted shrink-0">
          <Search className="w-5 h-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trader email, MT5 login, challenge #, ticket, payout, or admin hub..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground font-medium"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono bg-surface text-muted-foreground border border-border">
            ESC
          </span>
        </div>

        {/* Scrollable Results */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar bg-surface">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Search className="w-7 h-7 text-muted-foreground opacity-60" />
              <span>No matching traders, challenges, tickets, payouts, or admin hubs found.</span>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const active = idx === selectedIndex
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => executeSelection(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 group cursor-pointer select-none border",
                    active
                      ? "bg-primary/10 border-primary/30 text-foreground shadow-xs"
                      : "bg-transparent border-transparent hover:bg-surface-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                      active
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-surface-muted border-border text-muted-foreground group-hover:text-foreground"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-2xs font-bold tabular border shrink-0",
                            item.category === 'trader' ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                            : item.category === 'payout' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : item.category === 'ticket' ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : item.category === 'challenge' ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-2xs text-muted-foreground truncate block mt-0.5">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                    {active ? (
                      <span className="text-2xs font-mono flex items-center gap-1 text-primary font-medium">
                        <span>Navigate</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground group-hover:text-foreground" />
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-surface-muted border-t border-border flex items-center justify-between text-2xs text-muted-foreground shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-foreground">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-foreground">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-foreground">ESC</kbd> Close</span>
          </div>
          <span className="text-primary font-semibold">{branding.brand_name || 'LaunchAPropFirm'} Omni-Search</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
