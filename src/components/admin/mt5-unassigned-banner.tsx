'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown, ChevronUp, Server } from 'lucide-react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

type UnassignedTrader = {
  challenge_id: number
  user_id: number
  name: string
  email: string
  funded_at: string | null
  days_waiting: number | null
}

// Funded challenge accounts wait for an admin to manually create and bind a
// live MT5 account (see class-rest-api.php admin_mt5_unassigned() — MT5
// account creation is a broker-side manual step, not automated). This
// surfaces the backlog so it doesn't silently sit unnoticed.
export function Mt5UnassignedBanner() {
  const [traders, setTraders] = useState<UnassignedTrader[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [assignFor, setAssignFor] = useState<UnassignedTrader | null>(null)

  const refresh = useCallback(async () => {
    const res = await api.admin.mt5Unassigned()
    if (res.ok && res.data && Array.isArray(res.data.traders)) {
      setTraders(res.data.traders)
    } else {
      setTraders([])
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (!traders || traders.length === 0) return null

  return (
    <>
      <div className="border border-warn/30 bg-warn/10 rounded-xl overflow-hidden transition-all shadow-2xs">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-warn/15 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Server className="h-4 w-4 text-warn shrink-0" />
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-semibold text-text">
                {traders.length} funded {traders.length === 1 ? 'trader' : 'traders'} waiting for MT5 assignment
              </span>
              <Badge tone="warn" size="sm">{traders.length}</Badge>
              <span className="text-2xs text-text-muted hidden sm:inline">
                (Passed evaluation · pending MT5 login)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-warn font-medium shrink-0">
            <span>{expanded ? 'Hide' : 'Review'}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-warn/20 divide-y divide-border/60 bg-surface/50">
            {traders.map((t) => (
              <div key={t.challenge_id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text truncate">{t.name}</div>
                  <div className="text-2xs text-text-muted truncate font-mono">
                    {t.email}
                    {t.days_waiting !== null && (
                      <span className={t.days_waiting >= 2 ? 'text-warn font-semibold' : ''}>
                        {' '}· waiting {t.days_waiting}d
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-warn/40 text-warn hover:bg-warn/10" onClick={() => setAssignFor(t)}>
                  Assign MT5
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {assignFor && (
        <AssignMt5Dialog
          trader={assignFor}
          onClose={() => setAssignFor(null)}
          onSaved={() => {
            setAssignFor(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

function AssignMt5Dialog({ trader, onClose, onSaved }: {
  trader: UnassignedTrader; onClose: () => void; onSaved: () => void
}) {
  const [login, setLogin]     = useState('')
  const [password, setPassword] = useState('')
  const [server, setServer]   = useState('')
  const [busy, setBusy]       = useState(false)

  const submit = async () => {
    if (!login.trim()) { toast.error('MT5 login is required'); return }
    if (!server.trim()) { toast.error('MT5 server is required'); return }
    setBusy(true)
    const res = await api.admin.saveUserMt5(trader.user_id, {
      mt5_login: login.trim(),
      mt5_password: password.trim() || undefined,
      mt5_server: server.trim(),
      mt5_account_type: 'live',
    })
    setBusy(false)
    if (res.ok && res.data.success) {
      toast.success(`MT5 account bound for ${trader.name}`)
      onSaved()
    } else {
      toast.error(res.ok ? (res.data.message || 'Failed to save') : res.error)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            Assign MT5 — {trader.name}
          </DialogTitle>
          <DialogDescription>
            Create the live MT5 account on your broker/dealing desk first, then bind its credentials here so the trader can see them on their dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mt5_login">MT5 Login</Label>
            <Input id="mt5_login" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="e.g. 5012345" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt5_password">MT5 Password</Label>
            <Input id="mt5_password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Investor or master password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt5_server">MT5 Server</Label>
            <Input id="mt5_server" value={server} onChange={(e) => setServer(e.target.value)} placeholder="e.g. YourBroker-Live" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!login.trim() || !server.trim()}>Bind account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
