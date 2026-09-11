'use client'

import * as React from 'react'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Menu, Search, Bell, Shield, LogOut, User, 
  CheckCircle2, AlertTriangle, ChevronDown, ExternalLink,
  LifeBuoy
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/admin':             { title: 'Overview Dashboard', subtitle: 'Real-time performance metrics, trading volume, and system alerts' },
  '/admin/traders':     { title: 'Traders Management', subtitle: 'Browse active accounts, adjust balances, and configure rule overrides' },
  '/admin/operations':  { title: 'System Operations', subtitle: 'Health checks, emergency halt controls, and service status' },
  '/admin/risk':        { title: 'Risk & Exposure Monitor', subtitle: 'Real-time breach alerts, symbol exposures, and trader risk scoring' },
  '/admin/payouts':     { title: 'Payouts Hub', subtitle: 'Review profit withdrawals, destination wallets, and approve transactions' },
  '/admin/marketing':   { title: 'Marketing & Growth Hub', subtitle: 'Promotional banners, checkout discount coupons, and referral affiliates' },
  '/admin/tournaments': { title: 'Tournaments & Competitions', subtitle: 'Trading contest schedules, participant leaderboards, and prize pools' },
  '/admin/analytics':   { title: 'Platform Analytics', subtitle: 'Financial revenues, user growth curves, and challenge pass/fail ratios' },
  '/admin/helpdesk':    { title: 'Support & Helpdesk', subtitle: 'Live customer inquiry tickets, direct replies, and resolution tracking' },
  '/admin/config':      { title: 'Configuration Hub', subtitle: 'Challenge plans, theme branding, Stripe, crypto wallets, and MT5 settings' },
  '/admin/activity':    { title: 'Global Activity & Audit', subtitle: 'Live system-wide event notifications, trade actions, and audit logs' },
}

interface HeaderProps {
  onMobileMenuToggle: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Live Notifications Count
  const { data: notifData } = useQuery({
    queryKey: ['admin-header-notifications'],
    queryFn: () => api.admin.notifications().then(res => res.ok ? res.data : { unread_count: 0 }),
    refetchInterval: 20000
  })

  // Match current page info
  const matchingKey = Object.keys(PAGE_TITLES).find(k => 
    k === '/admin' ? pathname === '/admin' : pathname.startsWith(k)
  )
  const pageInfo = matchingKey ? PAGE_TITLES[matchingKey] : { title: 'Admin Command Center', subtitle: 'Prop firm management portal' }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors">
      
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors"
          aria-label="Toggle mobile menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Center/Search (Hidden on small mobile) */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-muted border border-border rounded-lg text-sm text-text-muted w-64 lg:w-80 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all">
        <Search className="h-4 w-4 text-text-subtle shrink-0" />
        <input
          type="text"
          placeholder="Search accounts, traders, or rules..."
          className="bg-transparent border-none outline-none text-text text-xs w-full placeholder:text-text-subtle"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* System Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-muted border border-border text-xs font-medium text-text-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
          </span>
          <span className="text-[11px] font-semibold text-text">System Live</span>
        </div>

        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* IDE Themes Switcher */}
        <ThemeSwitcher />

        {/* Notifications Icon with Badge */}
        <Link
          href="/admin/activity"
          className="relative p-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors"
          title="Activity & Notifications"
        >
          <Bell className="h-5 w-5" />
          {notifData && notifData.unread_count > 0 ? (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface" />
          ) : null}
        </Link>

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-muted transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted hidden sm:block" />
          </button>

          {profileDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setProfileDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-border shadow-xl z-50 p-1.5 text-xs text-text">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="font-semibold text-text truncate">{user?.email || 'admin@firm.com'}</p>
                  <p className="text-[10px] text-accent mt-0.5">Enterprise SuperAdmin</p>
                </div>

                <div className="px-3 py-1.5 flex items-center justify-between border-b border-border mb-1">
                  <span className="text-text-muted">IDE Theme</span>
                  <ThemeSwitcher />
                </div>

                <Link
                  href="/dashboard"
                  target="_blank"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-muted text-text transition-colors"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <ExternalLink className="h-4 w-4 text-text-subtle" />
                  <span>Trader Dashboard</span>
                </Link>

                <Link
                  href="/admin/config"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-muted text-text transition-colors"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <Shield className="h-4 w-4 text-text-subtle" />
                  <span>Firm Settings</span>
                </Link>

                <Link
                  href="/admin/helpdesk"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-muted text-text transition-colors"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <LifeBuoy className="h-4 w-4 text-text-subtle" />
                  <span>Support Center</span>
                </Link>

                <div className="border-t border-border my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  )
}
