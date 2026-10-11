'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, User, Wallet, Headphones, ShieldAlert, Activity,
  Trophy, Tag, BarChart3, Sliders, ArrowRight, CornerDownLeft,
  X, CheckCircle2, Shield, Settings, LayoutDashboard, CreditCard,
  Layers, Lock, Sparkles
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'

export interface AdminCommandItem {
  id: string
  title: string
  subtitle: string
  category: 'hub' | 'config' | 'action' | 'risk'
  href: string
  icon: React.ElementType
  badge?: string
  keywords?: string[]
}

export const ADMIN_COMMAND_ITEMS: AdminCommandItem[] = [
  { id: 'admin-overview', title: 'Admin Overview', subtitle: 'Firm-wide performance metrics, net PnL, and live telemetry', category: 'hub', href: '/admin', icon: LayoutDashboard },
  { id: 'admin-traders', title: 'Manage Traders', subtitle: 'Browse active accounts, balance overrides, and KYC reviews', category: 'hub', href: '/admin/traders', icon: User, keywords: ['users', 'accounts', 'balances'] },
  { id: 'admin-payouts', title: 'Payout Requests Hub', subtitle: 'Review profit withdrawals, scan QR crypto, approve split payouts', category: 'hub', href: '/admin/payouts', icon: CreditCard, keywords: ['withdrawals', 'crypto', 'usdt'] },
  { id: 'admin-risk', title: 'Risk & Exposure Monitor', subtitle: 'Real-time breach alerts, symbol exposures, trader risk scoring', category: 'risk', href: '/admin/risk', icon: ShieldAlert, keywords: ['drawdown', 'breach', 'hedging'] },
  { id: 'admin-operations', title: 'System Operations & Services', subtitle: 'Health checks, emergency halt controls, Redis, and cron status', category: 'hub', href: '/admin/operations', icon: Activity, keywords: ['services', 'halt', 'health'] },
  { id: 'admin-helpdesk', title: 'Support & Helpdesk', subtitle: 'Live customer inquiry tickets, AI replies, and auto-pilot', category: 'hub', href: '/admin/helpdesk', icon: Headphones, keywords: ['tickets', 'support', 'chat'] },
  { id: 'admin-tournaments', title: 'Tournaments & Competitions', subtitle: 'Trading contest schedules, participant leaderboards, prize pools', category: 'hub', href: '/admin/tournaments', icon: Trophy, keywords: ['leaderboards', 'contests'] },
  { id: 'admin-marketing', title: 'Marketing & Promos', subtitle: 'Promotional banners, checkout discount coupons, affiliate partners', category: 'hub', href: '/admin/marketing', icon: Tag, keywords: ['coupons', 'affiliates', 'discounts'] },
  { id: 'admin-analytics', title: 'Platform Analytics', subtitle: 'Financial revenues, user growth curves, challenge pass/fail ratios', category: 'hub', href: '/admin/analytics', icon: BarChart3, keywords: ['revenue', 'metrics', 'stats'] },
  { id: 'admin-config', title: 'System Configuration', subtitle: 'Master configuration hub for prop firm operational parameters', category: 'config', href: '/admin/config', icon: Settings },
  // Direct Configuration Tab Shortcuts
  { id: 'config-branding', title: 'Branding & Themes', subtitle: 'Daylight/Obsidian contrast, custom logos, dynamic font engine', category: 'config', href: '/admin/config?tab=branding', icon: Sliders, badge: 'CONFIG', keywords: ['theme', 'fonts', 'logo'] },
  { id: 'config-mt5', title: 'MT5 Gateway Bridge', subtitle: 'MT5 server host, manager credentials, reverse copier daemon', category: 'config', href: '/admin/config?tab=mt5', icon: Sliders, badge: 'CONFIG', keywords: ['bridge', 'metatrader', 'copier'] },
  { id: 'config-rules', title: 'Challenge Rules Engine', subtitle: 'Daily DD, trailing floor, IP security, news & weekend rules', category: 'config', href: '/admin/config?tab=rules', icon: Shield, badge: 'CONFIG', keywords: ['drawdown', 'news', 'ip'] },
  { id: 'config-plans', title: 'Evaluation Plans Catalog', subtitle: '1-Step, 2-Step, and Direct Instant Funding plan presets', category: 'config', href: '/admin/config?tab=plans', icon: Layers, badge: 'CONFIG', keywords: ['challenge', 'steps', 'funding'] },
  { id: 'config-payments', title: 'Payment Gateways & Crypto', subtitle: 'Stripe, USDT TRC-20, ERC-20 deposit addresses & QR codes', category: 'config', href: '/admin/config?tab=payments', icon: Wallet, badge: 'CONFIG', keywords: ['stripe', 'crypto', 'usdt'] },
  { id: 'config-ai', title: 'AI Copilot & Auto-Pilot Settings', subtitle: 'Gemini, DeepSeek, auto-resolve & trading sentinel panel', category: 'config', href: '/admin/config?tab=ai_engine', icon: Sparkles, badge: 'CONFIG', keywords: ['gemini', 'deepseek', 'llm'] },
  { id: 'config-smtp', title: 'Email SMTP & Notifications', subtitle: 'Mail host credentials, welcome & breach warning templates', category: 'config', href: '/admin/config?tab=smtp', icon: Settings, badge: 'CONFIG', keywords: ['email', 'mail', 'smtp'] },
]

interface AdminCommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Helper to highlight matching substring within text for instant visual feedback.
 */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold rounded-xs px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function AdminCommandPalette({ open: controlledOpen, onOpenChange }: AdminCommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen)
      } else {
        setInternalOpen(nextOpen)
      }
    },
    [isControlled, onOpenChange]
  )

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Listen for Ctrl+K / Cmd+K global hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!isOpen)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setOpen])

  // Focus input and reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [isOpen])

  // Filter commands by query with keyword search
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ADMIN_COMMAND_ITEMS

    return ADMIN_COMMAND_ITEMS.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q)
      const subMatch = item.subtitle.toLowerCase().includes(q)
      const kwMatch = item.keywords?.some((k) => k.toLowerCase().includes(q))
      const badgeMatch = item.badge?.toLowerCase().includes(q)
      return titleMatch || subMatch || kwMatch || badgeMatch
    })
  }, [query])

  // Reset selectedIndex if out of bounds
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(0)
    }
  }, [filteredItems.length, selectedIndex])

  const executeCommand = useCallback(
    (item: AdminCommandItem) => {
      setOpen(false)
      router.push(item.href)
    },
    [router, setOpen]
  )

  // Keyboard navigation: ArrowUp, ArrowDown, Enter, Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const total = Math.max(1, filteredItems.length)
      const nextIndex = (selectedIndex + 1) % total
      setSelectedIndex(nextIndex)
      scrollActiveIntoView(nextIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const total = Math.max(1, filteredItems.length)
      const nextIndex = (selectedIndex - 1 + total) % total
      setSelectedIndex(nextIndex)
      scrollActiveIntoView(nextIndex)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filteredItems[selectedIndex]
      if (target) {
        executeCommand(target)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const scrollActiveIntoView = (index: number) => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-command-item]')
    const targetEl = items[index] as HTMLElement
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'nearest' })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="w-[calc(100vw-1.5rem)] sm:max-w-2xl bg-surface text-text border border-border shadow-2xl backdrop-blur-2xl rounded-2xl p-0 overflow-hidden z-50 flex flex-col max-h-[82vh] ring-1 ring-primary/20"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 pl-4 pr-12 py-3.5 border-b border-border bg-surface-muted/60 shrink-0">
          <Search className="w-5 h-5 text-accent shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type an admin command or search hubs, settings, risk..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-muted font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-text-muted hover:text-text p-1 rounded-md hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono bg-surface text-text-muted border border-border">
            ESC
          </kbd>
        </div>

        {/* Scrollable Command Items List */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar bg-surface">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
              <Search className="w-7 h-7 text-text-muted opacity-60" />
              <span>No matching admin commands found for &quot;{query}&quot;.</span>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const active = idx === selectedIndex
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  data-command-item
                  onClick={() => executeCommand(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 group cursor-pointer select-none border",
                    active
                      ? "bg-accent/10 border-accent/30 text-text shadow-xs"
                      : "bg-transparent border-transparent hover:bg-surface-muted text-text"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                        active
                          ? "bg-accent/20 border-accent/40 text-accent"
                          : "bg-surface-muted border-border text-text-muted group-hover:text-text"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-text truncate">
                          <HighlightMatch text={item.title} query={query} />
                        </span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded text-3xs font-bold font-mono bg-accent/15 text-accent border border-accent/20 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-2xs text-text-muted truncate block mt-0.5">
                        <HighlightMatch text={item.subtitle} query={query} />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-text-muted">
                    {active ? (
                      <span className="text-2xs font-mono flex items-center gap-1 text-accent font-medium">
                        <span>Select</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted group-hover:text-text" />
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-surface-muted/60 border-t border-border flex items-center justify-between text-2xs text-text-muted shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text">ESC</kbd> Close
            </span>
          </div>
          <span className="text-accent font-semibold">Admin Command Palette</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
