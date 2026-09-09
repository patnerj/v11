'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { RefreshCw, Activity, Server, Globe, CheckCircle2, Terminal, Copy } from 'lucide-react'

interface Health {
  mode: 'auto' | 'mt5' | 'yahoo'; active_source: string; status: string
  mt5_last_push_ts: number | null; mt5_age_sec: number | null; mt5_fresh: boolean
  stale_threshold: number; yahoo_last_ts: number | null; feed_failed: boolean
  symbol_count: number; secret_set: boolean; market_open: boolean
  ingest_secret?: string; ingest_url?: string
  auto_failover?: boolean; auto_freeze?: boolean
}

const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger' | 'neutral'> = {
  fresh: 'success', yahoo: 'neutral', market_closed: 'neutral', stale: 'warn', offline: 'danger',
}
const STATUS_LABEL: Record<string, string> = {
  fresh: 'MT5 live', yahoo: 'Yahoo (fallback)', market_closed: 'Market closed', stale: 'MT5 stale', offline: 'MT5 offline',
}

export function PriceFeedCard() {
  const [health, setHealth] = useState<Health | null>(null)
  const [mode, setMode] = useState<'auto' | 'mt5' | 'yahoo'>('auto')
  const [stale, setStale] = useState('5')
  const [secret, setSecret] = useState('')
  const [autoFailover, setAutoFailover] = useState(true)
  const [autoFreeze, setAutoFreeze] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Hydrate editable fields from the server exactly once. This card polls
  // health every 10s to keep the telemetry panel live — re-syncing the
  // editable fields on every poll would silently revert an admin's
  // in-progress edit before they get a chance to save it.
  const hydrated = useRef(false)

  const load = useCallback(async () => {
    const res = await api.admin.priceFeedHealth()
    if (res.ok) {
      setHealth(res.data)
      if (!hydrated.current) {
        hydrated.current = true
        setMode(res.data.mode)
        setStale(String(res.data.stale_threshold))
        setAutoFailover(res.data.auto_failover ?? true)
        setAutoFreeze(res.data.auto_freeze ?? false)
      }
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [load])

  const save = async () => {
    setSaving(true)
    const payload: Record<string, string | boolean> = {
      source_mode: mode, mt5_stale_secs: stale,
      auto_failover: autoFailover, auto_freeze: autoFreeze,
    }
    if (secret.trim()) payload.mt5_ingest_secret = secret.trim()
    const res = await api.admin.priceFeedSave(payload)
    setSaving(false)
    if (res.ok) { toast.success('Price feed settings saved'); setSecret(''); load() }
    else toast.error(res.ok ? 'Save failed' : res.error)
  }

  const forceRefresh = async () => {
    setRefreshing(true)
    const res = await api.admin.forcePrices()
    setRefreshing(false)
    if (res.ok) { toast.success(res.data.message || 'Prices refreshed'); load() }
    else toast.error(res.ok ? 'Refresh failed' : res.error)
  }

  const copy = (label: string, value?: string) => {
    if (!value) { toast.error(`No ${label.toLowerCase()} yet — it appears after the first save.`); return }
    navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  const status = health?.status ?? 'yahoo'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /> Live price feed (MT5)</CardTitle>
        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Active source" value={health?.active_source ?? '—'} />
          <Stat label="MT5 last push" value={health?.mt5_age_sec != null ? `${health.mt5_age_sec}s ago` : 'never'} />
          <Stat label="Symbols" value={health ? String(health.symbol_count) : '—'} />
          <Stat label="Market" value={health ? (health.market_open ? 'Open' : 'Closed') : '—'} />
        </div>

        {/* Source mode */}
        <div className="space-y-2">
          <Label>Source mode</Label>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('mt5')}
              className={`p-3.5 rounded-lg border text-left space-y-1 transition-colors ${
                mode === 'auto' || mode === 'mt5' ? 'border-accent bg-accent/5' : 'border-border-subtle hover:border-border'
              }`}
            >
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-accent" /> MT5 bridge live stream
                {(mode === 'auto' || mode === 'mt5') && <CheckCircle2 className="h-3.5 w-3.5 text-accent ml-auto" />}
              </span>
              <p className="text-2xs text-text-faint">Live institutional ticks from your MT5 bridge, with Yahoo as fallback.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('yahoo')}
              className={`p-3.5 rounded-lg border text-left space-y-1 transition-colors ${
                mode === 'yahoo' ? 'border-accent bg-accent/5' : 'border-border-subtle hover:border-border'
              }`}
            >
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-accent" /> Yahoo Finance only
                {mode === 'yahoo' && <CheckCircle2 className="h-3.5 w-3.5 text-accent ml-auto" />}
              </span>
              <p className="text-2xs text-text-faint">Public quotes, zero setup required — ignores MT5 entirely.</p>
            </button>
          </div>
        </div>

        {/* MT5 streamer credentials — only relevant when MT5 is in play */}
        {(mode === 'auto' || mode === 'mt5') && (
          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Terminal className="h-3.5 w-3.5 text-accent" /> MT5 streamer credentials
              </div>
              <Badge tone={health?.mt5_fresh ? 'success' : 'warn'}>
                {health?.mt5_fresh ? 'MT5 connected' : 'Waiting for streamer'}
              </Badge>
            </div>
            <p className="text-2xs text-text-faint">
              Point your MT5 price streamer at this endpoint with this key in the <code>X-FXSIM-Feed-Key</code> header.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-2xs uppercase font-medium text-text-faint">Ingestion endpoint (or Base URL)</span>
                <div className="flex items-center gap-1.5 p-2 bg-bg-subtle rounded-md border border-border-subtle text-2xs font-mono">
                  <span className="truncate flex-1">{health?.ingest_url || '—'}</span>
                  <button
                    type="button"
                    onClick={() => copy('Ingestion endpoint', health?.ingest_url)}
                    className="p-1 hover:bg-surface-muted rounded text-text-faint hover:text-text shrink-0"
                    title="Copy ingestion URL"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-2xs uppercase font-medium text-text-faint">Feed secret key</span>
                <div className="flex items-center gap-1.5 p-2 bg-bg-subtle rounded-md border border-border-subtle text-2xs font-mono">
                  <span className="truncate flex-1">{health?.ingest_secret || '—'}</span>
                  <button
                    type="button"
                    onClick={() => copy('Feed secret key', health?.ingest_secret)}
                    className="p-1 hover:bg-surface-muted rounded text-text-faint hover:text-text shrink-0"
                    title="Copy feed key"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pf-stale">Staleness threshold (seconds)</Label>
            <Input id="pf-stale" inputMode="numeric" value={stale}
              onChange={(e) => setStale(e.target.value.replace(/\D/g, '') || '')} placeholder="5" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-secret">Rotate ingestion secret {health?.ingest_secret && <span className="text-text-faint font-normal">(leave blank to keep current)</span>}</Label>
            <Input id="pf-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
              placeholder="Set a new shared secret" autoComplete="off" />
          </div>
        </div>

        {/* Resilience toggles */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3 bg-surface-muted/30 rounded-lg border border-border-subtle">
            <div>
              <p className="text-xs font-medium">Auto-failover to Yahoo when MT5 drops or goes stale</p>
              <p className="text-2xs text-text-faint">Keeps quotes flowing during MT5 bridge or broker downtime.</p>
            </div>
            <Switch checked={autoFailover} onCheckedChange={setAutoFailover} />
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-muted/30 rounded-lg border border-border-subtle">
            <div>
              <p className="text-xs font-medium">Auto-freeze execution during abnormal feed latency</p>
              <p className="text-2xs text-text-faint">Blocks new fills on stale prices to avoid latency-arbitrage exposure.</p>
            </div>
            <Switch checked={autoFreeze} onCheckedChange={setAutoFreeze} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={saving}>Save feed settings</Button>
          <Button variant="outline" onClick={forceRefresh} loading={refreshing}>
            <RefreshCw className="h-4 w-4" /> Force refresh now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-3">
      <div className="text-2xs text-text-muted">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  )
}
