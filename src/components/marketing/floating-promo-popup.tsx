'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, ArrowRight, Sparkles, Tag } from 'lucide-react'
import { cn } from '@/lib/cn'

const STORAGE_KEY = 'fxsim_promo_dismissed'

export function FloatingPromoPopup() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const isDismissed = localStorage.getItem(STORAGE_KEY) === '1'
      setDismissed(isDismissed)
    } catch {
      setDismissed(false)
    }
  }, [])

  // Suppress on high-focus user journeys (Rule 86.1)
  if (
    !mounted ||
    dismissed ||
    !pathname ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname === '/dashboard/trading' ||
    pathname.startsWith('/dashboard/trading')
  ) {
    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      navigator.clipboard.writeText('LAUNCH30')
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.92 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Promotional offer"
        role="complementary"
        className={cn(
          'fixed z-50 transition-all duration-300',
          // Mobile: sits above MobileBottomNav (bottom-20), on left-3 with max width to avoid template switcher
          // Desktop: bottom-6 left-6 with max-w-sm
          'bottom-20 sm:bottom-6 left-3 sm:left-6 max-w-[calc(100vw-110px)] sm:max-w-sm'
        )}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl p-3.5 sm:p-4',
            // Bulging elevated glass design
            'bg-surface/95 dark:bg-[#0c1222]/95 backdrop-blur-2xl',
            'border-2 border-emerald-500/40 dark:border-emerald-400/40',
            'shadow-[0_16px_50px_-8px_rgba(16,185,129,0.35)]',
            'ring-1 ring-emerald-500/20'
          )}
        >
          {/* Subtle pulsating ambient glow flare in corner */}
          <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none animate-pulse" />

          {/* Top Row: Badge + Close Button */}
          <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-2xs uppercase tracking-wider shadow-sm">
              <span>🚀 30% OFF</span>
            </div>

            <button
              onClick={handleDismiss}
              aria-label="Close promotional offer"
              className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Card Body */}
          <div className="relative z-10 mb-3">
            <h4 className="text-xs sm:text-sm font-extrabold text-text tracking-tight flex items-center gap-1.5">
              <span>Launch Week Exclusive</span>
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            </h4>
            <p className="text-2xs sm:text-xs text-text-muted mt-0.5 leading-relaxed">
              Use code below to claim 30% off any evaluation challenge.
            </p>
          </div>

          {/* Bottom Actions Row: 1-Click Code Copy + Claim CTA */}
          <div className="flex items-center gap-2 relative z-10 pt-1">
            {/* Copy code button */}
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-2xs font-mono font-bold transition-all cursor-pointer',
                copied
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'bg-surface-secondary border-border/80 hover:border-emerald-500/50 text-text hover:bg-surface-muted'
              )}
              title="Click to copy coupon code"
              aria-label="Copy coupon code LAUNCH30"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 text-text-muted" />
              )}
              <span>LAUNCH30</span>
              {copied && <span className="text-3xs font-sans text-emerald-500 font-semibold">Copied!</span>}
            </button>

            {/* Claim Offer Button */}
            <Link
              href="/#pricing"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-2xs sm:text-xs shadow-md transition-all cursor-pointer"
            >
              <span>Claim Offer</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
