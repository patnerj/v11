'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/store/auth'
import { APP_DISPLAY_VERSION } from '@/lib/version'

export default function AdminLoginPage() {
  const router = useRouter()
  const signin = useAuth((s) => s.signin)
  const user = useAuth((s) => s.user)
  const ready = useAuth((s) => s.ready)

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && user?.is_admin) {
      router.replace('/admin')
    }
  }, [ready, user, router])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError(null)

    try {
      const res = await signin(username, password, remember)
      if (res.ok) {
        toast.success('Admin authentication verified. Welcome back!')
        router.replace('/admin')
      } else {
        setError(res.error || 'Authentication failed. Please check credentials.')
      }
    } catch (err: any) {
      setError(err?.message || 'Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-rose-500/20 selection:text-rose-400">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-rose-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Root Control Center {APP_DISPLAY_VERSION}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Admin Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Cryptographically gated management access for authorized staff only.
          </p>
        </div>

        <Card className="border border-white/10 bg-[#12151d]/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8 rounded-2xl">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <span className="leading-snug">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Staff Username or Email</Label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pl-9 bg-black/30 border-white/10 text-white placeholder:text-slate-600 focus:border-rose-500/50 focus:ring-rose-500/20 h-11"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Staff Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="pl-9 bg-black/30 border-white/10 text-white placeholder:text-slate-600 focus:border-rose-500/50 focus:ring-rose-500/20 h-11 font-mono"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-rose-500 focus:ring-rose-500/30"
                />
                Remember this session
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-medium h-11 rounded-xl mt-3 transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying clearance...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Administrator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-slate-500">
              Are you a prop trader?{' '}
              <a href="/login" className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors">
                Trader Dashboard Login
              </a>
            </p>
          </div>
        </Card>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-[11px] text-slate-600 font-mono">
            <Terminal className="w-3.5 h-3.5" />
            <span>AI Sentinel Active • Rate Limited & Audit Logged</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
