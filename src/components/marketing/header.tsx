'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BannerBar } from '@/components/banner-bar'
import { Logo } from '@/components/logo'
import { useBranding } from '@/store/branding'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/cn'
import { Menu, X, ArrowRight, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const NAV = [
  { href: '/challenges',     label: 'Challenges' },
  { href: '/how-it-works',   label: 'How It Works' },
  { href: '/payouts',        label: 'Payouts' },
  { href: '/about',          label: 'About' },
  { href: '/faq',            label: 'FAQ' },
  { href: '/contact',        label: 'Contact' },
]

export function MarketingHeader() {
  const user    = useAuth((s) => s.user)
  const ready   = useAuth((s) => s.ready)
  const [scrolled, setScrolled] = useState(false)
  const [open,     setOpen]     = useState(false)
  const brand = useBranding((s) => s.branding.brand_name)
  const loadBranding = useBranding((s) => s.load)
  useEffect(() => { loadBranding() }, [loadBranding])

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  // Lock body scroll while mobile menu is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Close mobile menu on Escape
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open])

  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed top-0 inset-x-0 z-40 transition-all duration-300',
        'pt-[max(0.25rem,env(safe-area-inset-top,0px))] bg-surface/85 backdrop-blur-2xl border-b border-border/60',
        scrolled && 'shadow-[0_4px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-emerald-500/20'
      )}
    >
      <BannerBar placement="top" />
      <div className="container max-w-7xl mx-auto flex h-14 md:h-16 items-center justify-between px-4">
        <Link href="/" className="focus-ring rounded-md flex items-center gap-2 shrink-0" aria-label={`${brand || 'MassFunded'} home`}>
          <Logo />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              prefetch={false}
              className="px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-emerald-400 hover:bg-surface-muted/60 transition-colors focus-ring rounded-lg"
            >
              {it.label}
            </Link>
          ))}
        </nav>

        {/* Auth-aware CTAs */}
        <div className="hidden lg:flex items-center gap-3 min-w-[200px] justify-end">
          {!ready ? (
            <div className="h-8 w-32 rounded-md skel" aria-hidden />
          ) : user ? (
            <Button asChild size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold shadow-glow-sm btn-shine">
              <Link href="/dashboard" prefetch={false} className="flex items-center gap-1.5">
                <span>Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="text-xs font-medium text-text-muted hover:text-text">
                <Link href="/login" prefetch={false}>Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-glow-sm btn-shine">
                <Link href="/register" prefetch={false} className="flex items-center gap-1">
                  <span>Start Trading</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>

        {/* Mobile Fast Action Buttons */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle className="h-8 w-8" />
          {user ? (
            <Button asChild size="sm" className="h-8 px-3 text-xs bg-emerald-500 text-white font-bold shadow-glow-sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="h-8 px-3 text-xs bg-emerald-500 text-white font-bold shadow-glow-sm">
              <Link href="/login">Sign In</Link>
            </Button>
          )}
          <button
            className="p-2 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text border border-border/60 focus-ring transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-border-subtle bg-surface/95 backdrop-blur-2xl shadow-2xl pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
          >
            <div className="container py-4 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {NAV.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-text-muted hover:text-emerald-400 hover:bg-surface-muted rounded-lg transition-colors"
                >
                  {it.label}
                </Link>
              ))}

              <div className="pt-3 mt-2 border-t border-border-subtle flex flex-col gap-2">
                {user ? (
                  <Button asChild size="md" className="bg-emerald-500 text-white font-bold w-full">
                    <Link href="/dashboard" prefetch={false} onClick={() => setOpen(false)}>
                      Dashboard →
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="md" variant="outline" className="w-full">
                      <Link href="/login" prefetch={false} onClick={() => setOpen(false)}>
                        Sign In
                      </Link>
                    </Button>
                    <Button asChild size="md" className="bg-emerald-500 text-white font-bold w-full">
                      <Link href="/register" prefetch={false} onClick={() => setOpen(false)}>
                        Start Trading →
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
