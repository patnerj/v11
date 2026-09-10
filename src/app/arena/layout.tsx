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

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuth((s) => s.user)
  const ready = useAuth((s) => s.ready)
  const bootstrap = useAuth((s) => s.bootstrap)
  const impersonating = useImpersonation((s) => s.record)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Restore persisted desktop collapse preference
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

  // Ensure session is bootstrapped
  useEffect(() => { bootstrap() }, [bootstrap])

  // Refresh user state on focus
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') void useAuth.getState().refresh() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (ready && !user) {
      const next = encodeURIComponent(pathname || '/arena')
      window.location.href = `/login?next=${next}`
    }
  }, [ready, user, pathname])

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Arena is exclusively a trader module — always render the trader sidebar & topbar
  const role: 'trader' = 'trader'

  return (
    <div className="min-h-screen bg-[#070A12] text-white flex flex-col">
      <ImpersonationBanner />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        role={role}
        currentPath={pathname}
      />
      <div className={`${collapsed ? 'lg:pl-16' : 'lg:pl-64'} min-h-screen flex flex-col transition-[padding] duration-200`}>
        <BannerBar placement="dashboard" />
        <Topbar onMenuClick={() => setSidebarOpen(true)} role={role} user={user} />
        <main className="flex-1 min-w-0 w-full">
          {children}
        </main>
      </div>
      <ZenithAiCopilot />
      <AiTiltGuard />
    </div>
  )
}
