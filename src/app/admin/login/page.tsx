'use client'

import { useState, FormEvent, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { useAuth } from '@/store/auth'
import { APP_DISPLAY_VERSION } from '@/lib/version'

export default function AdminLoginPage() {
  const router = useRouter()
  const signin = useAuth((s) => s.signin)
  const verifyTwoFactor = useAuth((s) => s.verifyTwoFactor)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [twoFA, setTwoFA] = useState<{ uid: number } | null>(null)
  const [otpCode, setOtpCode] = useState('')

  useEffect(() => {
    // Admin login portal operates in high-contrast Obsidian Dark with Emerald accents
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
    document.documentElement.setAttribute('data-theme', 'midnight-obsidian')
  }, [])

  function finishAdminRedirect() {
    const user = useAuth.getState().user
    // ADMINUI-1: Gating non-admin users from admin dashboard
    if (user && !user.is_admin) {
      toast.error('Access restricted. Your account does not have administrator privileges.')
      router.replace('/dashboard')
      return
    }

    toast.success('Admin authentication verified. Welcome back!')
    const searchParams = new URLSearchParams(window.location.search)
    const next = searchParams.get('next')
    const target = next && next.startsWith('/admin') && next !== '/admin/login' ? next : '/admin'
    router.replace(target)
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== target) {
        window.location.href = new URL(target, window.location.origin).pathname
      }
    }, 1200)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError(null)

    try {
      const res = await signin(username, password, remember)
      if (res.ok) {
        finishAdminRedirect()
      } else if ((res as any).twoFactor) {
        // ADMINUI-2: Show 2FA input step when required
        setTwoFA({ uid: (res as any).uid })
        toast.info('Two-factor authentication required. Please enter the verification code sent to your email.')
      } else {
        setError(res.error || 'Invalid username or password.')
      }
    } catch (err: any) {
      setError(err?.message || 'Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2FA(e: FormEvent) {
    e.preventDefault()
    if (!twoFA || !otpCode.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await verifyTwoFactor(twoFA.uid, otpCode.trim(), remember)
      if (res.ok) {
        finishAdminRedirect()
      } else {
        setError(res.error || 'Invalid 2FA verification code.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to verify 2FA code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-theme="midnight-obsidian"
      className="admin-login-scope dark min-h-screen bg-[#070B13] text-text flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-accent/20 selection:text-accent"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .admin-login-scope h1 { color: #ffffff !important; }
        .admin-login-scope p { color: #94a3b8 !important; }
        .admin-login-scope label, .admin-login-scope .label-text { color: #cbd5e1 !important; }
        .admin-login-scope input { color: #ffffff !important; background-color: rgba(0, 0, 0, 0.4) !important; }
        .admin-login-scope input::placeholder { color: #64748b !important; }
      `}} />

      {/* Brand Emerald Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] bg-accent/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/5 blur-[120px] pointer-events-none rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Logo variant="login" className="h-10 justify-center" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-mono uppercase tracking-wider mb-3 shadow-[0_0_15px_rgba(16,185,129,0.12)]">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Root Control Center {APP_DISPLAY_VERSION}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2" style={{ color: '#ffffff' }}>
            Admin Portal
          </h1>
          <p className="text-sm text-text-muted mt-1.5" style={{ color: '#94a3b8' }}>
            Cryptographically gated management access for authorized staff only.
          </p>
        </div>

        <Card className="border border-white/10 bg-[#0E1424]/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8 rounded-2xl shadow-black/40">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span className="leading-snug">{error}</span>
            </motion.div>
          )}

          {twoFA ? (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-300" style={{ color: '#cbd5e1' }}>6-Digit 2FA Code</Label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-accent absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-accent focus:ring-accent/20 h-11 font-mono tracking-widest text-center text-lg rounded-xl transition-all"
                    style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.4)' }}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <p className="text-2xs text-slate-400 mt-1">Check your registered administrator email for the authentication code.</p>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading || otpCode.length < 6}
                loading={loading}
                className="w-full h-11 rounded-xl mt-3 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.99] transition-all"
              >
                {!loading && (
                  <>
                    <span>Verify Code & Enter</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setTwoFA(null); setOtpCode(''); setError(null); }}
                className="w-full text-center text-xs text-slate-400 hover:text-white pt-2 transition-colors"
              >
                ← Back to username login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-300" style={{ color: '#cbd5e1' }}>Staff Username or Email</Label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Staff username or email"
                    className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-accent focus:ring-accent/20 h-11 rounded-xl transition-all"
                    style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.4)' }}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-300" style={{ color: '#cbd5e1' }}>Staff Password</Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-accent focus:ring-accent/20 h-11 font-mono rounded-xl transition-all"
                    style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.4)' }}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-300 transition-colors" style={{ color: '#94a3b8' }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 text-accent focus:ring-accent/30"
                  />
                  Remember this session
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                loading={loading}
                className="w-full h-11 rounded-xl mt-3 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.99] transition-all"
              >
                {!loading && (
                  <>
                    <span>Sign In as Administrator</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-slate-400" style={{ color: '#94a3b8' }}>
              Are you a prop trader?{' '}
              <Link href="/login" className="text-accent hover:text-accent-hover font-semibold underline underline-offset-2 transition-colors">
                Trader Dashboard Login
              </Link>
            </p>
          </div>
        </Card>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-2xs text-slate-500 font-mono">
            <Terminal className="w-3.5 h-3.5 text-accent" />
            <span>AI Sentinel Active • Rate Limited & Audit Logged</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
