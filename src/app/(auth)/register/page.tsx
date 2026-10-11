'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/store/auth'
import { useBranding } from '@/store/branding'
import { AlertCircle, ArrowRight, Check, Sparkles, Mail, Clock, ExternalLink, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { trackRegistration } from '@/lib/meta-pixel'
import { Suspense } from 'react'

export default function RegisterPage() {
  // useSearchParams() (for ?next=) requires a Suspense boundary in the App
  // Router, same pattern as login/page.tsx.
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { signup, user, ready } = useAuth()
  const brandName = useBranding((s) => s.branding.brand_name) || 'MassFunded'
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'M'
  // Same-origin-only guard against open-redirect (mirrors login/page.tsx) —
  // checkout links here as /register?next=/checkout?plan=N so a new customer
  // returns to their in-progress purchase instead of the empty dashboard.
  const rawNext = params.get('next') ?? '/dashboard'
  const next    = /^\/(?!\/)/.test(rawNext) ? rawNext : '/dashboard'
  const [username, setU] = useState('')
  const [email, setE]    = useState('')
  const [password, setP] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [ref, setRef]         = useState('')
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [checkingVerify, setCheckingVerify]   = useState(false)
  const [resendingVerify, setResendingVerify] = useState(false)
  const [resendCooldown, setResendCooldown]   = useState(0)

  // Capture an affiliate referral code from ?ref= and persist it so it survives
  // navigation between login/register before the user completes signup.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('ref')
      if (code) { localStorage.setItem('fxsim:ref', code); setRef(code) }
      else { const saved = localStorage.getItem('fxsim:ref'); if (saved) setRef(saved) }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (ready && user && user.email_verified) router.replace(next)
  }, [ready, user, router, next])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Auto-detect email verification while waiting on /register post-signup card
  useEffect(() => {
    if (!registeredEmail) return
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
      if (document.visibilityState === 'visible') checkNow()
    }, 8000)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      clearInterval(interval)
    }
  }, [registeredEmail])

  async function handleCheckVerification() {
    setCheckingVerify(true)
    try {
      await useAuth.getState().refresh(true)
      const currentUser = useAuth.getState().user
      if (currentUser?.email_verified) {
        toast.success('🎉 Email verified! Redirecting to your dashboard...')
        router.replace(next)
      } else {
        toast.info('Still pending verification. Please click the activation link sent to your email.')
      }
    } finally {
      setCheckingVerify(false)
    }
  }

  async function handleResendVerification() {
    if (resendCooldown > 0 || resendingVerify) return
    setResendingVerify(true)
    try {
      const res = await api.auth.resendVerification()
      if (res.ok) {
        toast.success('Verification email sent! Please check your inbox and spam folder.')
        setResendCooldown(60)
      } else {
        toast.error(res.error || 'Could not resend verification email.')
      }
    } finally {
      setResendingVerify(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError(null)
    const res = await signup(username, email, password, ref || undefined)
    setLoading(false)
    if (res.ok) {
      try { localStorage.removeItem('fxsim:ref') } catch { /* ignore */ }
      try { trackRegistration({ method: 'email', status: 'success' }) } catch { /* ignore */ }
      toast.success('Account created! Verification link sent to your email.')
      setRegisteredEmail(email)
    } else {
      setError(res.error ?? 'Sign-up failed')
    }
  }

  const pwOk = password.length >= 8

  if (registeredEmail) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="p-5 sm:p-8 glass-strong border-border-strong card-glow text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-glow-sm">
            <Mail className="h-8 w-8 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-400 mb-3">
            <Clock className="h-3.5 w-3.5" />
            <span>Verification Required Before Access</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-text">Check Your Inbox</h1>
          <p className="text-sm text-text-muted mt-2 max-w-sm mx-auto leading-relaxed">
            We sent an activation link to your email. You must verify your address before accessing your trading dashboard.
          </p>

          <div className="my-5 p-3.5 rounded-xl bg-surface-secondary/70 dark:bg-black/40 border border-border">
            <span className="font-mono text-sm font-bold text-text truncate select-all">
              {registeredEmail}
            </span>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleCheckVerification}
              disabled={checkingVerify}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-glow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {checkingVerify ? (
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

            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendVerification}
                disabled={resendingVerify || resendCooldown > 0}
                className="h-10 border-border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {resendingVerify ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Clock className="h-3.5 w-3.5 text-text-muted" />
                    <span>Resend in {resendCooldown}s</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Resend Email</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                asChild
                className="h-10 border-border text-xs font-semibold"
              >
                <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5">
                  <span>Open Gmail</span>
                  <ExternalLink className="h-3.5 w-3.5 text-text-muted" />
                </a>
              </Button>
            </div>
          </div>

          <p className="mt-6 text-xs text-text-muted leading-relaxed">
            Didn't receive the email? Check your spam folder or click Resend Email above.
          </p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="p-5 sm:p-8 glass-strong border-border-strong card-glow">
        <div className="text-center mb-4 sm:mb-6">
          <div className="brand-emblem">
            <span className="text-lg font-black text-slate-950">{brandInitial}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create free account</h1>
          <p className="text-sm text-text-muted mt-1">
            Pass the challenge. Get funded. Keep up to 90%.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-md bg-danger-muted border border-danger/30 text-sm">
            <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <span className="text-danger">{error}</span>
          </div>
        )}

        {ref && (
          <div className="mb-4 sm:mb-5 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shadow-sm shadow-emerald-500/5">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse" />
            <span>🎁 Referred by: <strong className="font-mono font-bold text-white bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">{ref}</strong> — You'll get a special discount!</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5 sm:space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user">Username</Label>
            <Input
              id="user"
              autoFocus
              autoComplete="username"
              minLength={3}
              value={username}
              onChange={(e) => setU(e.target.value.replace(/[^a-zA-Z0-9_.\-]/g, ''))}
              required
              placeholder="trader_handle"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setE(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pwd">Password</Label>
            <Input
              id="pwd"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setP(e.target.value)}
              required
              placeholder="Min. 8 characters"
            />
            <div className="text-2xs flex items-center gap-1.5 text-text-muted">
              <Check className={`h-3 w-3 ${pwOk ? 'text-success' : 'text-text-faint'}`} />
              At least 8 characters
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full btn-shine" 
            loading={loading}
            isSubmitting={loading}
            isPending={loading}
            disabled={loading}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0 mr-2" data-spinner="true" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-3.5 sm:mt-4 text-xs text-text-faint text-center leading-relaxed">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="hover:text-text">Terms</Link> and{' '}
          <Link href="/privacy" className="hover:text-text">Privacy Policy</Link>.
        </p>

        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border-subtle text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:text-accent-hover font-medium">
            Sign in
          </Link>
        </div>
      </Card>
    </motion.div>

  )
}
