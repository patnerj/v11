'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import {
  User, Mail, ShieldCheck, Lock, LogOut, AtSign, MailWarning, BadgeCheck,
  Bell, Volume2, AlertTriangle, KeyRound, Check, RefreshCw, Send, Smartphone
} from 'lucide-react'

export default function SettingsPage() {
  const router          = useRouter()
  const user            = useAuth((s) => s.user)
  const signout         = useAuth((s) => s.signout)

  const [twoFA, setTwoFA]   = useState<boolean | null>(null)
  const [busy2fa, setBusy2fa] = useState(false)
  const [resending, setResending] = useState(false)

  // Password change state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw]   = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)

  // Preferences state
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    let soundInit = true
    let hapticInit = true
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem('fxsim_sound_enabled') === 'false') soundInit = false
        if (localStorage.getItem('fxsim_haptics_enabled') === 'false') hapticInit = false
      } catch {}
    }
    return {
      email_trade_closed:   true,
      email_margin_warning: true,
      email_payout_updates: true,
      email_marketing:      false,
      sound_effects:        soundInit,
      haptic_feedback:      hapticInit,
    }
  })
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingPrefKey, setSavingPrefKey] = useState<string | null>(null)

  useEffect(() => {
    api.auth.twoFactorStatus().then((res) => {
      if (res.ok) setTwoFA(res.data.enabled)
      else        setTwoFA(false)
    })

    api.preferences.get().then((res) => {
      setLoadingPrefs(false)
      if (res.ok && res.data.preferences) {
        setPrefs((p) => {
          const next = { ...p, ...res.data.preferences }
          if (typeof window !== 'undefined') {
            try {
              if (res.data.preferences.sound_effects !== undefined) {
                localStorage.setItem('fxsim_sound_enabled', String(res.data.preferences.sound_effects))
              }
              if (res.data.preferences.haptic_feedback !== undefined) {
                localStorage.setItem('fxsim_haptics_enabled', String(res.data.preferences.haptic_feedback))
              }
            } catch {}
          }
          return next
        })
      }
    })
  }, [])

  const toggle2FA = async () => {
    if (twoFA == null) return
    setBusy2fa(true)
    const res = await api.auth.twoFactorToggle(!twoFA)
    setBusy2fa(false)
    if (res.ok) { 
      setTwoFA(res.data.enabled)
      toast.success(res.data.enabled ? '2FA enabled' : '2FA disabled') 
    } else {
      toast.error(res.error)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPw) {
      toast.error('Please enter your current password.')
      return
    }
    if (!newPw || newPw.length < 8) {
      toast.error('New password must be at least 8 characters long.')
      return
    }
    if (newPw !== confirmPw) {
      toast.error('New passwords do not match.')
      return
    }

    setSavingPw(true)
    const res = await api.auth.changePassword({ current_password: currentPw, new_password: newPw })
    setSavingPw(false)

    if (res.ok && res.data.success) {
      toast.success(res.data.message || 'Password updated successfully!')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setShowPwForm(false)
    } else {
      toast.error((!res.ok ? res.error : res.data.message) || 'Failed to change password.')
    }
  }

  const togglePref = async (key: string) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    setSavingPrefKey(key)

    if (key === 'sound_effects') {
      try {
        localStorage.setItem('fxsim_sound_enabled', String(updated.sound_effects))
      } catch {}
    }
    if (key === 'haptic_feedback') {
      try {
        localStorage.setItem('fxsim_haptics_enabled', String(updated.haptic_feedback))
      } catch {}
    }

    const res = await api.preferences.save(updated)
    setSavingPrefKey(null)
    if (res.ok && res.data.success) {
      toast.success('Preference updated')
    } else {
      setPrefs(prefs)
      if (key === 'sound_effects') {
        try {
          localStorage.setItem('fxsim_sound_enabled', String(prefs.sound_effects))
        } catch {}
      }
      if (key === 'haptic_feedback') {
        try {
          localStorage.setItem('fxsim_haptics_enabled', String(prefs.haptic_feedback))
        } catch {}
      }
      toast.error('Failed to save preference')
    }
  }

  const resendVerify = async () => {
    setResending(true)
    const res = await api.auth.resendVerification()
    setResending(false)
    if (res.ok) toast.success('Verification email sent — check your inbox')
    else        toast.error(res.error)
  }

  const handleSignout = async () => {
    await signout()
    toast.success('Signed out')
    router.replace('/')
  }

  if (!user) return null

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full min-w-0 overflow-hidden">
      <PageHeader
        variant="hero"
        title="Account Settings"
        description="Manage your account, security, and preferences."
        icon={User}
        badge={{ label: 'Preferences', tone: 'accent' }}
      />

      <div className="grid lg:grid-cols-2 gap-6 w-full max-w-full min-w-0 items-start">
        {/* Left Column: Profile & Preferences */}
        <div className="space-y-6 w-full max-w-full min-w-0">
          <Card>
            <CardHeader className="p-4 sm:p-6"><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 sm:gap-4 pb-4 border-b border-border-subtle min-w-0">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-accent/15 text-accent flex items-center justify-center text-base sm:text-lg font-bold border border-accent/20 shrink-0">
                  {(user?.display_name || user?.username || 'TR').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-text truncate">{user?.display_name || user?.username || 'Trader'}</div>
                  <div className="text-xs sm:text-sm text-text-muted truncate">@{user?.username || 'trader'}</div>
                </div>
                {user?.is_admin && <Badge tone="accent" className="ml-auto shrink-0">Admin</Badge>}
              </div>

              <ReadOnlyField icon={User}  label="Username" value={user?.username || ''} />
              <ReadOnlyField icon={AtSign} label="Display name" value={user?.display_name || ''} />
              <div className="min-w-0 w-full">
                <Label>Email</Label>
                <div className="mt-1.5 flex items-center gap-2 px-3 h-10 rounded-md border border-border-subtle bg-surface-muted/50 text-sm min-w-0">
                  <Mail className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="flex-1 truncate text-text min-w-0">{user.email}</span>
                  {user.email_verified ? (
                    <Badge tone="success" className="shrink-0"><BadgeCheck className="h-3 w-3 mr-1" /> Verified</Badge>
                  ) : (
                    <Badge tone="warn" className="shrink-0">Unverified</Badge>
                  )}
                </div>
                {!user.email_verified && (
                  <div className="mt-2 text-xs text-text-muted flex flex-wrap items-center gap-1.5 leading-relaxed">
                    <MailWarning className="h-3.5 w-3.5 text-warn shrink-0" />
                    <span>Verify your email to enable payouts.</span>
                    <button
                      onClick={resendVerify}
                      disabled={resending}
                      className="text-accent hover:underline disabled:opacity-50 font-medium"
                    >
                      {resending ? 'Sending…' : 'Resend verification'}
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preferences Card */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Notifications & Preferences</CardTitle>
              <CardDescription>Configure which automated alerts and platform events you receive.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {loadingPrefs ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  <PrefToggleRow
                    icon={Bell}
                    title="Trade Closed Alerts"
                    subtitle="Receive an email summary when automated SL/TP or manual positions close."
                    checked={!!prefs.email_trade_closed}
                    busy={savingPrefKey === 'email_trade_closed'}
                    onToggle={() => togglePref('email_trade_closed')}
                  />
                  <PrefToggleRow
                    icon={AlertTriangle}
                    title="Margin Call Warnings"
                    subtitle="Get urgent alerts if your floating equity drops near maximum drawdown."
                    checked={!!prefs.email_margin_warning}
                    busy={savingPrefKey === 'email_margin_warning'}
                    onToggle={() => togglePref('email_margin_warning')}
                  />
                  <PrefToggleRow
                    icon={Mail}
                    title="Payout Status Updates"
                    subtitle="Email updates when your profit withdrawals are reviewed and transferred."
                    checked={!!prefs.email_payout_updates}
                    busy={savingPrefKey === 'email_payout_updates'}
                    onToggle={() => togglePref('email_payout_updates')}
                  />
                  <PrefToggleRow
                    icon={Volume2}
                    title="Platform Sound Effects"
                    subtitle="Play audio cues on order fills, SL/TP triggers, and victory fanfares."
                    checked={!!prefs.sound_effects}
                    busy={savingPrefKey === 'sound_effects'}
                    onToggle={() => togglePref('sound_effects')}
                  />
                  <PrefToggleRow
                    icon={Smartphone}
                    title="Haptic Vibration Feedback"
                    subtitle="Vibrate mobile devices on trade fills, position exits, and milestone passes."
                    checked={!!prefs.haptic_feedback}
                    busy={savingPrefKey === 'haptic_feedback'}
                    onToggle={() => togglePref('haptic_feedback')}
                  />
                  <PrefToggleRow
                    icon={Send}
                    title="Marketing & Competitions"
                    subtitle="News regarding seasonal trading tournaments and promotional offers."
                    checked={!!prefs.email_marketing}
                    busy={savingPrefKey === 'email_marketing'}
                    onToggle={() => togglePref('email_marketing')}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security & Actions */}
        <div className="space-y-6 w-full max-w-full min-w-0">
          <Card>
            <CardHeader className="p-4 sm:p-6"><CardTitle>Security</CardTitle></CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-5">
              {/* 2FA Toggle */}
              <div className="flex items-center justify-between gap-3 min-w-0 w-full">
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-md bg-success/10 text-success flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-semibold text-text">Two-factor authentication</div>
                    <div className="text-2xs text-text-muted leading-relaxed break-words">Get a 6-digit code by email on every sign-in — no authenticator app needed.</div>
                  </div>
                </div>
                <div className="shrink-0">
                  {twoFA == null ? (
                    <Skeleton className="h-8 sm:h-9 w-20 sm:w-24" />
                  ) : (
                    <Button
                      variant={twoFA ? 'outline' : 'primary'}
                      size="sm"
                      loading={busy2fa}
                      onClick={toggle2FA}
                    >
                      {twoFA ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </div>
              </div>

              <hr className="border-border-subtle" />

              {/* Password Section */}
              <div className="space-y-3 min-w-0 w-full">
                <div className="flex items-center justify-between gap-3 min-w-0 w-full">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-text">Password</div>
                      <div className="text-2xs text-text-muted leading-relaxed break-words">Change your login password directly or request a reset link.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={showPwForm ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setShowPwForm((v) => !v)}
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1" />
                      {showPwForm ? 'Cancel' : 'Change'}
                    </Button>
                  </div>
                </div>

                {/* In-page Password Change Form */}
                {showPwForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    onSubmit={handlePasswordChange}
                    className="p-3 sm:p-4 rounded-xl border border-border-subtle bg-surface-muted/40 space-y-3 mt-2 min-w-0 w-full"
                  >
                    <div>
                      <label className="text-xs font-semibold text-text block mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full h-9 rounded-lg bg-surface border border-border-subtle px-3 text-xs text-text focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-semibold text-text block mb-1">New Password</label>
                        <input
                          type="password"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="At least 8 characters"
                          className="w-full h-9 rounded-lg bg-surface border border-border-subtle px-3 text-xs text-text focus:outline-none focus:border-accent"
                          required
                          minLength={8}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text block mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full h-9 rounded-lg bg-surface border border-border-subtle px-3 text-xs text-text focus:outline-none focus:border-accent"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await api.auth.requestReset(user.email)
                          if (res.ok) toast.success('Password reset link sent to your email')
                          else        toast.error(res.error)
                        }}
                        className="text-2xs text-text-muted hover:text-accent underline text-left"
                      >
                        Forgot password? Send email link
                      </button>
                      <Button
                        type="submit"
                        size="sm"
                        loading={savingPw}
                        disabled={!currentPw || !newPw || !confirmPw}
                      >
                        Update Password
                      </Button>
                    </div>
                  </motion.form>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-danger/30">
            <CardHeader className="p-4 sm:p-6"><CardTitle className="text-danger">Account actions</CardTitle></CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 w-full">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-text">Sign out</div>
                  <div className="text-2xs text-text-muted">End your session on this device.</div>
                </div>
                <Button variant="outline" onClick={handleSignout} size="sm" className="shrink-0 w-full sm:w-auto">
                  <LogOut className="h-4 w-4 mr-1.5" /> Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyField({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="min-w-0 w-full">
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2 px-3 h-10 rounded-md border border-border-subtle bg-surface-muted/50 text-sm min-w-0">
        <Icon className="h-4 w-4 text-text-muted shrink-0" />
        <span className="truncate text-text font-medium min-w-0 flex-1">{value}</span>
      </div>
    </div>
  )
}

function PrefToggleRow({
  icon: Icon,
  title,
  subtitle,
  checked,
  busy,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  checked: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <div className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0 min-w-0 w-full">
      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div className="h-8 w-8 rounded-lg bg-surface-muted flex items-center justify-center shrink-0 text-text-muted mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-semibold text-text truncate">{title}</div>
          <div className="text-2xs text-text-muted leading-relaxed line-clamp-2 break-words">{subtitle}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-accent' : 'bg-surface-muted'
        } ${busy ? 'opacity-50' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
