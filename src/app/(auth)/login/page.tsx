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
import { AlertCircle, ArrowRight, Fingerprint } from 'lucide-react'
import { authenticateWithBiometrics, hasSavedBiometricProfile, getSavedBiometricUser } from '@/lib/biometrics'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-32 mx-auto skel rounded-md" />
      <div className="h-4 w-48 mx-auto skel rounded-md" />
      <div className="h-10 w-full skel rounded-md mt-6" />
      <div className="h-10 w-full skel rounded-md" />
      <div className="h-12 w-full skel rounded-md" />
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  // Sanitize `next`: must be a same-origin path starting with a single `/`.
  // Reject protocol-relative URLs (`//evil.com`) and absolute URLs.
  const rawNext = params.get('next') ?? '/dashboard'
  const next    = /^\/(?!\/)/.test(rawNext) ? rawNext : '/dashboard'
  const signin = useAuth((s) => s.signin)
  const signinWithBiometricToken = useAuth((s) => s.signinWithBiometricToken)
  const verifyTwoFactor = useAuth((s) => s.verifyTwoFactor)
  const user   = useAuth((s) => s.user)
  const ready  = useAuth((s) => s.ready)
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [remember, setR] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [twoFA, setTwoFA] = useState<{ uid: number } | null>(null)
  const [code, setCode] = useState('')
  const [hasBiometrics, setHasBiometrics] = useState(false)
  const [bioUser, setBioUser] = useState<string | null>(null)

  useEffect(() => {
    setHasBiometrics(hasSavedBiometricProfile())
    setBioUser(getSavedBiometricUser())
  }, [])

  useEffect(() => {
    if (ready && user) {
      // If we landed on /login with an explicit ?next= parameter, the edge middleware
      // rejected our session cookie (missing or expired). Do NOT auto-redirect back to
      // the protected route — that causes an infinite redirect loop. Instead, clear
      // the stale client session so the user can re-authenticate cleanly.
      if (params.get('next')) {
        useAuth.getState().signout()
        return
      }
      const target = user.is_admin && next === '/dashboard' ? '/admin' : next
      router.replace(target)
    }
  }, [ready, user, next, router, params])

  const finishLogin = () => {
    toast.success('Welcome back')
    const u = useAuth.getState().user
    const target = u?.is_admin && next === '/dashboard' ? '/admin' : next
    router.replace(target)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError(null)
    const res = await signin(username, password, remember)
    setLoading(false)
    if (res.ok) {
      finishLogin()
    } else if (res.twoFactor && res.uid) {
      setCode('')
      setTwoFA({ uid: res.uid })
    } else {
      setError(res.error ?? 'Sign-in failed')
    }
  }

  async function submit2fa(e: FormEvent) {
    e.preventDefault()
    if (!twoFA || code.trim().length < 6) return
    setLoading(true)
    setError(null)
    const res = await verifyTwoFactor(twoFA.uid, code.trim(), remember)
    setLoading(false)
    if (res.ok) finishLogin()
    else setError(res.error ?? 'Invalid or expired code.')
  }

  async function handleThumbLogin() {
    setLoading(true)
    setError(null)
    const res = await authenticateWithBiometrics()
    if (res.ok && res.token) {
      const authRes = await signinWithBiometricToken(res.token)
      setLoading(false)
      if (authRes.ok) {
        finishLogin()
        return
      } else {
        setError(authRes.error ?? 'Thumb authentication failed.')
      }
    } else {
      setLoading(false)
      if (res.error && !res.error.includes('canceled')) {
        setError(res.error)
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="p-8 glass-strong border-border-strong card-glow">
        <div className="text-center mb-6">
          <div className="brand-emblem">
            <span className="text-lg font-black text-slate-950">P</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{twoFA ? 'Enter your code' : 'Welcome back'}</h1>
          <p className="text-sm text-text-muted mt-1">
            {twoFA ? 'We emailed you a 6-digit verification code' : 'Sign in to your trader account'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-md bg-danger-muted border border-danger/30 text-sm">
            <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <span className="text-danger">{error}</span>
          </div>
        )}

        {hasBiometrics && !twoFA && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleThumbLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-accent/10 border border-accent/40 text-accent font-bold text-sm hover:bg-accent/20 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] group"
            >
              <Fingerprint className="h-5 w-5 text-accent animate-pulse group-hover:scale-110 transition-transform" />
              <span>Unlock with Thumb / Biometric ({bioUser || 'Saved User'})</span>
            </button>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">or with password</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>
          </div>
        )}

        {twoFA ? (
          <form onSubmit={submit2fa} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-lg tracking-[0.4em] font-mono"
                required
              />
            </div>
            <Button type="submit" className="w-full" loading={loading} size="lg" disabled={code.trim().length < 6}>
              Verify and sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button type="button" onClick={() => { setTwoFA(null); setError(null) }} className="w-full text-2xs text-text-muted hover:text-text">
              Back to sign in
            </button>
          </form>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user">Username or email</Label>
            <Input
              id="user"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setU(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pwd">Password</Label>
              <Link href="/reset-password" className="text-2xs text-accent hover:text-accent-hover">Forgot?</Link>
            </div>
            <Input
              id="pwd"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setP(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setR(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface accent-accent"
            />
            Keep me signed in
          </label>

          <Button type="submit" className="w-full btn-shine" loading={loading} size="lg">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        )}

        {!twoFA && (
        <div className="mt-6 pt-6 border-t border-border-subtle text-center text-sm text-text-muted">
          New here?{' '}
          <Link href="/register" className="text-accent hover:text-accent-hover font-medium">
            Create an account
          </Link>
        </div>
        )}
      </Card>
    </motion.div>
  )
}
