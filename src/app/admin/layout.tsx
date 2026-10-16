'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { Sidebar } from '@/components/admin/Sidebar'
import { Header } from '@/components/admin/Header'
import { AdminCommandPalette } from '@/components/admin/command-palette'
import { TradingScreenLoader } from '@/components/ui/trading-loader'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { useThemeContext } from '@/context/ThemeContext'
import { cn } from '@/lib/cn'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'
  const { user, ready } = useAuth()
  const impersonating = useImpersonation((s) => s.record)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isOmniSearchOpen, setIsOmniSearchOpen] = useState(false)
  const { theme } = useThemeContext()
  const isDark = theme !== 'clean-light'

  // Dynamic Theme Synchronization for Admin Portal
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
      if (theme === 'clean-light') {
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.add('dark')
        document.documentElement.classList.remove('light')
      }
    }
  }, [theme])

  // Dynamic document title synchronized with active admin route
  useEffect(() => {
    try {
      const brand = localStorage.getItem('fxsim:brand-name') || process.env.NEXT_PUBLIC_BRAND_NAME || 'Prop Firm'
      const titleMap: Record<string, string> = {
        '/admin': 'Admin Command Center',
        '/admin/traders': 'Traders CRM',
        '/admin/challenges': 'Challenges',
        '/admin/payouts': 'Payout Disbursals',
        '/admin/kyc': 'KYC Review Queue',
        '/admin/payments': 'Payment Gateways',
        '/admin/operations': 'System Operations',
        '/admin/config': 'Platform Config & Whitelabel',
        '/admin/marketing': 'Marketing & Coupons',
        '/admin/tournaments': 'Tournaments & PvP',
        '/admin/helpdesk': 'Helpdesk Support',
        '/admin/activity': 'Audit Logs',
        '/admin/analytics': 'Executive Analytics',
      }
      const pageName = titleMap[pathname] || (pathname.split('/').pop() ? pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Admin')
      document.title = `${pageName} | ${brand} Admin`
    } catch { /* SSR */ }
  }, [pathname])

  // Global Admin Omni-Search Shortcut (Cmd + K / Ctrl + K)
  useEffect(() => {
    if (isLoginPage) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOmniSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoginPage])

  const [isVerifying, setIsVerifying] = useState(!isLoginPage)

  // Auth & Impersonation Guard (ADMINUI-3: Await server verification before rendering)
  useEffect(() => {
    if (isLoginPage) return
    let active = true

    async function verifySession() {
      setIsVerifying(true)
      try {
        // Re-verify the role against the SERVER on every admin mount — never trust
        // cached client state for an authorization decision.
        await useAuth.getState().refresh(true)
      } catch {
        // ignore network error, user state will handle redirection
      } finally {
        if (active) setIsVerifying(false)
      }
    }

    verifySession()
    return () => { active = false }
  }, [isLoginPage])

  useEffect(() => {
    if (isLoginPage || isVerifying || !ready) return
    if (!user) {
      router.replace('/admin/login')
      return
    }
    if (impersonating || !user.is_admin) {
      router.replace('/dashboard')
    }
  }, [isLoginPage, isVerifying, ready, user?.id, user?.is_admin, impersonating, router])

  // If on admin login page, bypass layout shell and loaders completely
  if (isLoginPage) {
    return <>{children}</>
  }

  if (isVerifying || !ready || !user || !user.is_admin || impersonating) {
    return (
      <TradingScreenLoader
        label="Checking your session"
        subtitle="Verifying access permissions..."
      />
    )
  }

  return (
    <div 
      className={cn(
        "min-h-screen bg-bg text-text flex flex-col lg:flex-row antialiased transition-colors min-w-0 max-w-full overflow-x-hidden",
        isDark ? "dark" : "light"
      )} 
      data-theme={theme}
    >
      
      {/* Desktop Sidebar (Persistent) */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden lg:flex fixed inset-y-0 left-0"
      />

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar 
            collapsed={false}
            onMobileClose={() => setMobileSidebarOpen(false)}
            className="relative z-50 w-72 h-full shadow-2xl"
          />
        </div>
      )}

      {/* Main Content Wrapper */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-h-screen w-full min-w-0 max-w-full overflow-x-hidden transition-all duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        {/* Global Top Header with Omni-Search Trigger */}
        <Header 
          onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
          onOpenSearch={() => setIsOmniSearchOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 lg:pb-8">
          <SectionErrorBoundary sectionName="Admin Workspace">
            {children}
          </SectionErrorBoundary>
        </main>
      </div>

      {/* Admin Global Command Palette (Cmd + K / Ctrl + K) */}
      <AdminCommandPalette 
        open={isOmniSearchOpen} 
        onOpenChange={setIsOmniSearchOpen} 
      />

    </div>
  )
}
