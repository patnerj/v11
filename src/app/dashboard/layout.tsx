'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { ImpersonationBanner } from '@/components/dashboard/impersonation-banner'
import { BannerBar } from '@/components/banner-bar'
import { ZenithAiCopilot } from '@/components/dashboard/zenith-ai-copilot'
import { AiTiltGuard } from '@/components/dashboard/ai-tilt-guard'
import { EmailVerificationGate } from '@/components/dashboard/email-verification-gate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router    = useRouter()
  const pathname  = usePathname()
  const user      = useAuth((s) => s.user)
  const ready     = useAuth((s) => s.ready)
  const bootstrap = useAuth((s) => s.bootstrap)
  const impersonating = useImpersonation((s) => s.record)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Restore persisted desktop collapse preference. If the user has never set
  // one and the viewport is a narrow laptop (≤1440px), default to collapsed so
  // dashboards/terminal get ~190px more width on 14-inch screens. Large monitors
  // and any explicit user choice are untouched.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fxsim:sidebar-collapsed')
      if (saved === null) {
        setCollapsed(window.innerWidth <= 1440)
      } else {
        setCollapsed(saved === '1')
      }
    } catch { /* private mode */ }
  }, [])
  const toggleCollapse = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('fxsim:sidebar-collapsed', next ? '1' : '0') } catch { /* private mode */ }
    return next
  })

  // Make sure auth has bootstrapped at least once
  useEffect(() => { bootstrap() }, [bootstrap])

  // Refresh the user when the tab regains focus — covers verifying email (or other
  // account changes) in another tab/window without a manual reload.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') void useAuth.getState().refresh() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Dynamic document title synchronized with active route and whitelabel brand
  useEffect(() => {
    try {
      const brand = localStorage.getItem('fxsim:brand-name') || process.env.NEXT_PUBLIC_BRAND_NAME || 'LaunchAPropFirm'
      const titleMap: Record<string, string> = {
        '/dashboard': 'Trader Dashboard',
        '/dashboard/trading': 'Trading Terminal',
        '/dashboard/challenges': 'Challenges',
        '/dashboard/tournaments': 'Tournaments',
        '/dashboard/arena': 'PvP Arena',
        '/dashboard/history': 'Trade History',
        '/dashboard/analytics': 'Analytics',
        '/dashboard/payouts': 'Payouts',
        '/dashboard/affiliate': 'Affiliates',
        '/dashboard/marketing': 'Marketing Media Kit',
        '/dashboard/certificates': 'Certificates',
        '/dashboard/kyc': 'Identity Verification',
        '/dashboard/settings': 'Settings',
      }
      const pageName = titleMap[pathname] || (pathname.split('/').pop() ? pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Dashboard')
      document.title = `${pageName} | ${brand}`
    } catch { /* SSR or restricted context */ }
  }, [pathname])

  // Redirect to login if known-unauthenticated
  useEffect(() => {
    if (ready && !user) {
      const next = encodeURIComponent(pathname || '/dashboard')
      window.location.href = `/login?next=${next}`
    }
  }, [ready, user, pathname])

  // Role routing: admins land on /admin, never on the trader overview.
  // Runs as early as possible; the render block below holds the paint while
  // the redirect resolves so the wrong dashboard never flashes.
  const adminOnTraderOverview = ready && !!user?.is_admin && !impersonating && pathname === '/dashboard'
  useEffect(() => {
    if (adminOnTraderOverview) router.replace('/admin')
  }, [adminOnTraderOverview, router])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // The trading terminal uses the full viewport width (no max-width / heavy
  // padding) like TradingView / cTrader; other dashboard pages stay readable.
  const isTerminal = !!pathname?.startsWith('/dashboard/trading')
  const isSupport  = pathname === '/dashboard/support'

  if (!ready || !user || adminOnTraderOverview) return <DashboardSkeleton />

  // Hard gate: Mandatory email verification before dashboard and trading access.
  // Admins and admin-impersonators are exempt.
  if (user && !user.is_admin && !impersonating && !user.email_verified) {
    return <EmailVerificationGate user={user} />
  }

  return (
    <div className={isTerminal ? "h-dvh max-h-dvh overflow-hidden flex flex-col bg-bg min-w-0 max-w-full" : "min-h-screen bg-bg min-w-0 max-w-full overflow-x-hidden"}>
      <ImpersonationBanner />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <div className={`${collapsed ? 'lg:pl-16' : 'lg:pl-64'} ${isTerminal ? 'h-full max-h-full overflow-hidden' : 'min-h-screen'} flex flex-col min-w-0 max-w-full overflow-x-hidden transition-[padding] duration-200`}>
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className={
          isTerminal ? 'flex-1 min-h-0 min-w-0 max-w-full overflow-hidden w-full p-1.5 sm:p-2 md:p-2.5 flex flex-col' :
          isSupport ? 'flex-1 min-w-0 max-w-full overflow-x-hidden p-3 md:p-4 max-w-[1400px] w-full mx-auto pb-28 lg:pb-4' :
          'flex-1 min-w-0 max-w-full overflow-x-hidden p-3 sm:p-4 md:p-8 max-w-[1400px] w-full mx-auto pb-28 md:pb-8'
        }>
          {children}
        </main>
      </div>
      <ZenithAiCopilot />
      <AiTiltGuard />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="space-y-3 text-center">
        <div className="inline-block h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <div className="text-sm text-text-muted">Loading your dashboard…</div>
      </div>
    </div>
  )
}
