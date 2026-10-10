'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { Mail, Send, CheckCircle2 } from 'lucide-react'

interface Draft {
  host: string; port: number; auth?: boolean; user: string; pass: string
  secure: 'tls' | 'ssl' | ''; from_email: string; from_name: string; reply_to: string
}

/**
 * Settings → Email: full SMTP management from the dashboard.
 * Password is write-only (empty input = keep existing), mirroring the Stripe
 * secret model. Delivery logic itself is untouched — this only manages the
 * same options the existing mailer already reads.
 */
export function EmailSettingsPanel() {
  const [d, setD] = useState<Draft | null>(null)
  const [passSet, setPassSet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testTo, setTestTo] = useState('')

  useEffect(() => {
    api.admin.smtpGet().then((res) => {
      if (!res.ok) { setD({ host: '', port: 587, auth: true, user: '', pass: '', secure: 'tls', from_email: '', from_name: '', reply_to: '' }); return }
      const c = res.data
      setPassSet(c.pass_set)
      setD({ host: c.host, port: c.port || 587, auth: (c as any).auth ?? true, user: c.user, pass: '', secure: (c.secure as Draft['secure']) ?? 'tls', from_email: c.from_email, from_name: c.from_name, reply_to: c.reply_to })
    })
  }, [])

  const set = (k: keyof Draft, v: string | number | boolean) => setD((p) => (p ? { ...p, [k]: v } : p))

  const save = async () => {
    if (!d) return
    const portNum = Number(d.port)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error('Port must be a valid number between 1 and 65535')
      return
    }
    setSaving(true)
    const payload: Record<string, unknown> = {
      host: d.host, port: portNum, auth: d.auth ?? true, user: d.user, secure: d.secure,
      from_email: d.from_email, from_name: d.from_name, reply_to: d.reply_to,
    }
    if (d.pass.trim()) payload.pass = d.pass.trim() // write-only: empty = keep existing
    const res = await api.admin.smtpSave(payload)
    setSaving(false)
    if (res.ok) { toast.success('Email settings saved'); if (d.pass.trim()) setPassSet(true); set('pass', '') }
    else toast.error(res.ok ? 'Save failed' : res.error)
  }

  const sendTest = async () => {
    setTesting(true)
    // NOTIFYUI-1: Do not send empty password override in test payload to prevent clobbering stored credentials
    let testPayload: Record<string, unknown> | undefined = undefined
    if (d) {
      const { pass, ...rest } = d
      testPayload = { ...rest, auth: d.auth ?? true }
      if (pass && pass.trim()) {
        testPayload.pass = pass.trim()
      }
    }
    const res = await api.admin.smtpTest(testTo.trim() || undefined, testPayload)
    setTesting(false)
    if (res.ok && res.data.success) toast.success('Test email sent — check the inbox (and spam folder).')
    else toast.error(res.ok ? (res.data.message || 'Test email failed — check your SMTP settings.') : res.error)
  }

  if (!d) return <Card><CardContent className="p-6 text-sm text-text-muted">Loading email settings…</CardContent></Card>

  const configured = !!d.host

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-info" /> Email delivery (SMTP)</CardTitle>
        <span className={cn('text-2xs px-2 py-0.5 rounded-full', configured ? 'bg-success-muted text-success' : 'bg-surface-muted text-text-faint')}>
          {configured ? 'Configured' : 'Using host default mail'}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xs text-text-faint leading-relaxed">
          Connect your email provider (e.g. Brevo, SendGrid, Mailgun, Gmail Workspace) for reliable inbox delivery.
          Sender name and support address default to your Branding settings when left blank.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="sm-host">SMTP host</Label>
            <Input id="sm-host" value={d.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.your-provider.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-port">Port</Label>
            <Input id="sm-port" type="number" value={d.port} onChange={(e) => set('port', parseInt(e.target.value || '587', 10))} placeholder="587" />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="sm-auth"
            type="checkbox"
            checked={d.auth ?? true}
            onChange={(e) => set('auth', e.target.checked)}
            className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent cursor-pointer"
          />
          <Label htmlFor="sm-auth" className="text-xs text-text-muted cursor-pointer font-medium">
            SMTP Authentication Required (disable for internal relays without auth)
          </Label>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sm-user">Username</Label>
            <Input id="sm-user" value={d.user} onChange={(e) => set('user', e.target.value)} placeholder="SMTP username" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-pass">Password {passSet && <span className="text-2xs text-success">• configured</span>}</Label>
            <Input id="sm-pass" type="password" value={d.pass} onChange={(e) => set('pass', e.target.value)}
              placeholder={passSet ? '•••••••• (leave blank to keep)' : 'SMTP password'} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-sec">Encryption</Label>
            <select
              id="sm-sec"
              value={d.secure}
              onChange={(e) => set('secure', e.target.value)}
              className="w-full h-9 rounded-md bg-surface border border-border-subtle px-3 text-sm focus-ring"
            >
              <option value="tls">TLS (recommended, port 587)</option>
              <option value="ssl">SSL (port 465)</option>
              <option value="">None</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sm-fn">From name</Label>
            <Input id="sm-fn" value={d.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="Defaults to brand name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-fe">From email</Label>
            <Input id="sm-fe" type="email" value={d.from_email} onChange={(e) => set('from_email', e.target.value)} placeholder="noreply@yourfirm.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-rt">Reply-To email</Label>
            <Input id="sm-rt" type="email" value={d.reply_to} onChange={(e) => set('reply_to', e.target.value)} placeholder="support@yourfirm.com (optional)" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send test to… (default: admin email)" className="w-64 text-2xs" />
            <Button variant="outline" size="sm" onClick={sendTest} loading={testing}>
              {!testing && <Send className="h-3.5 w-3.5" />} Send test email
            </Button>
          </div>
          <Button onClick={save} loading={saving}><CheckCircle2 className="h-4 w-4" /> Save email settings</Button>
        </div>
        <p className="text-2xs text-text-faint">
          Tip: save first, then send a test. For best deliverability also add SPF and DKIM DNS records for your sending domain at your DNS provider.
        </p>
      </CardContent>
    </Card>
  )
}
