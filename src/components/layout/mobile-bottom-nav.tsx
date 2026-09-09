'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CandlestickChart, Trophy, ShieldCheck, User } from 'lucide-react'
import { cn } from '@/lib/cn'

const DASHBOARD_TABS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/trading', label: 'Trade', icon: CandlestickChart, badge: 'LIVE' },
  { href: '/dashboard/challenges', label: 'Challenges', icon: Trophy },
  { href: '/dashboard/kyc', label: 'KYC', icon: ShieldCheck },
  { href: '/dashboard/settings', label: 'Account', icon: User },
]

const PUBLIC_TABS = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/challenges', label: 'Challenges', icon: Trophy },
  { href: '/dashboard/trading', label: 'Trade', icon: CandlestickChart, badge: 'LIVE' },
  { href: '/faq', label: 'Rules & FAQ', icon: ShieldCheck },
  { href: '/login', label: 'Sign in', icon: User },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin') || pathname?.startsWith('/checkout')) {
    return null
  }

  const isDashboard = pathname?.startsWith('/dashboard')
  const tabs = isDashboard ? DASHBOARD_TABS : PUBLIC_TABS

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070C18]/95 backdrop-blur-xl border-t border-border/60 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] px-3 pt-2 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.href === '/' 
            ? pathname === '/'
            : tab.href === '/dashboard' 
              ? pathname === '/dashboard' 
              : pathname?.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200",
                isActive 
                  ? "text-accent scale-105" 
                  : "text-text-muted hover:text-text hover:bg-surface-muted/30"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "stroke-[2.5px]")} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[8px] font-black text-[#070C18] bg-accent rounded-full animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] mt-1 font-medium tracking-tight",
                isActive ? "font-bold text-accent" : "text-text-muted"
              )}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
