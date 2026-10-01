'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { Sidebar } from '@/components/admin/Sidebar'
import { Header } from '@/components/admin/Header'
import { OmniSearchDialog } from '@/components/admin/OmniSearchDialog'
import { TradingScreenLoader } from '@/components/ui/trading-loader'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
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

  // Rule 67.3: Dedicated Dark Portal Initialization & Root Mount Guard
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'midnight-obsidian')
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

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

  // Auth & Impersonation Guard
  useEffect(() => {
    if (isLoginPage) return
    if (!ready) return
    // Re-verify the role against the SERVER on every admin mount — never trust
    // cached client state for an authorization decision.
    void useAuth.getState().refresh(true)
    if (!user) {
      router.replace('/admin/login')
      return
    }
    if (impersonating || !user.is_admin) {
      router.replace('/dashboard')
    }
  }, [ready, user?.id, user?.is_admin, impersonating, router, isLoginPage])

  // If on admin login page, bypass layout shell and loaders completely
  if (isLoginPage) {
    return <>{children}</>
  }

  if (!ready || !user || !user.is_admin || impersonating) {
    return (
      <TradingScreenLoader
        label="Checking your session"
        subtitle="Verifying access permissions..."
      />
    )
  }

  return (
    <div className="dark min-h-screen bg-bg text-text flex flex-col lg:flex-row antialiased transition-colors" data-theme="midnight-obsidian">
      
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
          "flex-1 flex flex-col min-h-screen w-full transition-all duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        {/* Global Top Header with Omni-Search Trigger */}
        <Header 
          onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
          onOpenSearch={() => setIsOmniSearchOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 lg:pb-8">
          <SectionErrorBoundary sectionName="Admin Workspace">
            {children}
          </SectionErrorBoundary>
        </main>
      </div>

      {/* Admin Global Omni-Search Dialog (Cmd + K / Ctrl + K) */}
      <OmniSearchDialog 
        isOpen={isOmniSearchOpen} 
        onClose={() => setIsOmniSearchOpen(false)} 
      />

    </div>
  )
}
