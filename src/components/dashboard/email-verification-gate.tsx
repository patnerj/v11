'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Mail, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCcw, 
  LogOut, 
  ExternalLink, 
  Clock, 
  ArrowRight, 
  Loader2, 
  Sparkles,
  Copy,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/store/auth'
import { useBranding } from '@/store/branding'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import type { AuthUser } from '@/types/api'

function getWebmailProvider(email: string) {
  const domain = email?.split('@')[1]?.toLowerCase() || ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { name: 'Open Gmail', url: 'https://mail.google.com' }
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { name: 'Open Yahoo Mail', url: 'https://mail.yahoo.com' }
  }
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
    return { name: 'Open Outlook', url: 'https://outlook.live.com' }
  }
  if (domain === 'proton.me' || domain === 'protonmail.com') {
    return { name: 'Open Proton Mail', url: 'https://mail.proton.me' }
  }
  if (domain === 'icloud.com' || domain === 'me.com') {
    return { name: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' }
  }
  if (domain) {
    return { name: `Open ${domain}`, url: `https://${domain}` }
  }
  return { name: 'Open Webmail', url: 'https://mail.google.com' }
}

export function EmailVerificationGate({ user }: { user: AuthUser }) {
  const brandName = useBranding((s) => s.branding.brand_name) || 'MassFunded'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@massfunded.org'
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'M'
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cooldown, setCooldown] = useState(() => {
    if (typeof window === 'undefined') return 0
    try {
      const until = parseInt(localStorage.getItem('fxsim:resend_cooldown_until') || '0', 10)
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      return remaining
    } catch {
      return 0
    }
  })
  const [copied, setCopied] = useState(false)

  // Countdown timer for resend email
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((c) => {
        const next = Math.max(0, c - 1)
        if (next === 0 && typeof window !== 'undefined') {
          try { localStorage.removeItem('fxsim:resend_cooldown_until') } catch {}
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Instant cross-tab unlock (storage event), focus refresh, and 8s background polling
  useEffect(() => {
    const checkNow = () => {
      void useAuth.getState().refresh(true)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fxsim:email_verified_at') checkNow()
    }
    const onFocus = () => {
      if (document.visibilityState === 'visible') checkNow()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkNow()
      }
    }, 8000)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      clearInterval(interval)
    }
  }, [])

  async function handleResend() {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      const res = await api.auth.resendVerification()
      if (res.ok) {
        toast.success('Verification email sent! Please check your inbox and spam folder.')
        setCooldown(60)
        try {
          localStorage.setItem('fxsim:resend_cooldown_until', String(Date.now() + 60 * 1000))
        } catch {}
      } else {
        toast.error(res.error || 'Failed to resend verification email. Please try again in a moment.')
      }
    } catch {
      toast.error('Network error while resending verification email.')
    } finally {
      setResending(false)
    }
  }

  async function handleCheckStatus() {
    setChecking(true)
    try {
      await useAuth.getState().refresh(true)
      const currentUser = useAuth.getState().user
      if (currentUser?.email_verified) {
        toast.success('🎉 Email verified successfully! Unlocking your dashboard...')
      } else {
        toast.info('Still pending verification. Please click the link sent to your email.')
      }
    } catch {
      toast.error('Unable to refresh verification status.')
    } finally {
      setChecking(false)
    }
  }

  function copyEmail() {
    if (!user.email) return
    navigator.clipboard.writeText(user.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Dynamic ambient backgrounds */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-aurora opacity-50" />
        <div className="absolute inset-0 bg-grid-overlay opacity-30" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl mx-auto"
      >
        {/* Main Verification Card */}
        <div className="rounded-3xl border border-border bg-surface/95 dark:bg-background/95 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl transition-colors duration-200">
          
          {/* Top Security Pill Badge */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Mandatory Trader Account Verification</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">
              Verify Your Email Address
            </h1>
            <p className="mt-2 text-sm text-text-muted max-w-md mx-auto leading-relaxed">
              To secure your challenge allocations and protect institutional capital payouts, you must verify your email before accessing the <span className="font-semibold text-text">{brandName}</span> dashboard.
            </p>
          </div>

          {/* Registered Email Display Box */}
          <div className="p-4 rounded-2xl bg-surface-secondary/70 dark:bg-black/40 border border-border mb-6">
            <div className="flex items-center justify-between text-xs text-text-muted mb-2">
              <span className="font-medium">Verification link sent to:</span>
              <span className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                <Clock className="h-3 w-3" />
                <span>Pending Confirmation</span>
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 truncate">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="font-mono text-sm sm:text-base font-bold text-text truncate select-all">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={copyEmail}
                className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-muted border border-border shadow-xs text-xs font-semibold text-text hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                title="Copy Email"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instructions Step Box */}
          <div className="rounded-2xl border border-border-subtle bg-surface-secondary/40 p-4 mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>3-Step Quick Activation</span>
            </div>
            <ol className="text-xs text-text-muted space-y-2">
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-2xs">1</span>
                <span>Open your inbox and look for the verification email from <strong className="text-text">{brandName}</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-2xs">2</span>
                <span>Click the green <strong className="text-emerald-600 dark:text-emerald-400">"Verify My Email →"</strong> button inside the message.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-2xs">3</span>
                <span>Your dashboard will automatically unlock with full WebTrader and challenge access.</span>
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-glow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking Verification Status...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>I've Verified My Email — Unlock Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="h-11 bg-surface hover:bg-surface-muted border-border text-xs font-semibold text-text flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <Clock className="h-3.5 w-3.5 text-text-muted" />
                    <span>Resend in {cooldown}s</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Resend Email</span>
                  </>
                )}
              </Button>

              {(() => {
                const webmail = getWebmailProvider(user.email)
                return (
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    className="h-11 bg-surface hover:bg-surface-muted border-border text-xs font-semibold text-text flex items-center justify-center gap-2 rounded-xl transition-all"
                  >
                    <a 
                      href={webmail.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5"
                    >
                      <span className="truncate">{webmail.name}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    </a>
                  </Button>
                )
              })()}
            </div>
          </div>

          {/* Footer Controls: Sign Out and Help */}
          <div className="mt-8 pt-6 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
            <button
              type="button"
              onClick={() => useAuth.getState().signout()}
              className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out / Switch Account</span>
            </button>

            <a
              href={`mailto:${supportEmail}?subject=Email%20Verification%20Assistance`}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              Need help? Contact Desk
            </a>
          </div>

        </div>
      </motion.div>
    </div>
  )
}
