'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  Zap,
  Activity,
  Server,
  RefreshCw,
  Trash2,
  Save,
  Database,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Cpu,
  Radio,
  Clock,
  ExternalLink,
} from 'lucide-react'

interface RedisStatusData {
  success: boolean
  enabled: boolean
  connected: boolean
  host: string
  port: number
  db: number
  has_password: boolean
  latency_ms: number | null
  dbsize: number | null
  version: string | null
  uptime_days: number | null
  used_memory_human: string | null
  cache_backend: string
  fallback_active: boolean
  fail_soft: boolean
}

export function RedisCacheCard() {
  const [status, setStatus] = useState<RedisStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [flushing, setFlushing] = useState(false)
  const [flushConfirmOpen, setFlushConfirmOpen] = useState(false)

  // Form states
  const [enabled, setEnabled] = useState(true)
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('6379')
  const [db, setDb] = useState('0')
  const [password, setPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)

  const hydrated = useRef(false)

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.admin.redisStatus()
      if (res.ok && res.data) {
        setStatus(res.data)
        if (!hydrated.current) {
          hydrated.current = true
          setEnabled(res.data.enabled)
          setHost(res.data.host || '127.0.0.1')
          setPort(String(res.data.port || 6379))
          setDb(String(res.data.db ?? 0))
        }
      }
    } catch (err: any) {
      console.error('Failed to load Redis status:', err)
    }
  }, [])

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 10_000)
    return () => clearInterval(interval)
  }, [loadStatus])

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const res = await api.admin.redisTest({
        host: host.trim() || '127.0.0.1',
        port: parseInt(port, 10) || 6379,
        password: password || undefined,
        db: parseInt(db, 10) || 0,
      })

      if (res.ok && res.data.success) {
        toast.success(`Redis Ping Successful! Latency: ${res.data.latency_ms ?? '<1'}ms`, {
          duration: 4000,
        })
      } else {
        const errMsg = (!res.ok ? res.error : res.data.error) || 'Failed to connect to Redis server'
        toast.error(`Connection Test Failed: ${errMsg}`, {
          duration: 5000,
        })
      }
    } catch (err: any) {
      toast.error(`Connection Error: ${err.message || 'Unknown network error'}`)
    } finally {
      setTesting(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const payload: {
        enabled: boolean
        host: string
        port: number
        db: number
        password?: string
        clear_password?: boolean
      } = {
        enabled,
        host: host.trim() || '127.0.0.1',
        port: parseInt(port, 10) || 6379,
        db: parseInt(db, 10) || 0,
      }

      if (clearPassword) {
        payload.clear_password = true
      } else if (password.trim()) {
        payload.password = password.trim()
      }

      const res = await api.admin.redisSave(payload)
      if (res.ok && res.data.success) {
        toast.success(
          res.data.connected
            ? `Redis Connected & Saved! Latency: ${res.data.latency_ms ?? '<1'}ms`
            : 'Redis configuration saved (Offline / Fallback active).',
          { duration: 4000 }
        )
        setPassword('')
        setClearPassword(false)
        loadStatus()
      } else {
        toast.error((!res.ok ? res.error : 'Failed to save Redis configuration'))
      }
    } catch (err: any) {
      toast.error(`Save Error: ${err.message || 'Failed to save configuration'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleFlushCache = async () => {
    setFlushing(true)
    try {
      const res = await api.admin.redisFlush()
      if (res.ok && res.data.success) {
        toast.success(`In-Memory Cache Purged! ${res.data.cleared_keys} application keys cleared.`, {
          duration: 4000,
        })
        loadStatus()
      } else {
        toast.error((!res.ok ? res.error : 'Failed to flush in-memory cache'))
      }
    } catch (err: any) {
      toast.error(`Flush Error: ${err.message || 'Failed to flush cache'}`)
    } finally {
      setFlushing(false)
      setFlushConfirmOpen(false)
    }
  }

  const isConnected = status?.connected && status?.enabled
  const isFallback = status?.fallback_active || (!status?.connected && status?.enabled)

  return (
    <Card className="bg-[#111827] border-[#1F2937] overflow-hidden">
      <CardHeader className="border-b border-[#1F2937]/70 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isFallback
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-gray-100 flex items-center gap-2">
                In-Memory Redis Caching Engine
                {isConnected && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-gray-400">
                Ultra-low latency RAM caching for MT5 live prices, atomic rate-limiting, and distributed locks.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge tone="success" className="font-mono text-xs gap-1.5 py-1 px-2.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active (In-Memory RAM)
              </Badge>
            ) : isFallback ? (
              <Badge tone="warn" className="font-mono text-xs gap-1.5 py-1 px-2.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Fail-Soft (MySQL Fallback)
              </Badge>
            ) : (
              <Badge tone="neutral" className="font-mono text-xs py-1 px-2.5">
                Disabled
              </Badge>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={loadStatus}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Fail-Soft Guarantee Banner */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3 text-xs">
          <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-300">100% Fail-Soft Architecture Guarantee:</span>
            <p className="text-gray-300 leading-relaxed">
              If Redis disconnects or encounters latency spikes, every single trade execution, balance update, and price feed request seamlessly falls back to local database transients without throwing runtime exceptions.
            </p>
          </div>
        </div>

        {/* Real-time Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60">
            <span className="text-[11px] text-gray-500 block font-medium">Round-Trip Latency</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-xl font-bold font-mono ${isConnected ? 'text-emerald-400' : 'text-gray-400'}`}>
                {isConnected && status?.latency_ms !== null ? `${status.latency_ms} ms` : '—'}
              </span>
              {isConnected && status?.latency_ms !== null && status.latency_ms < 1 && (
                <span className="text-[10px] text-emerald-500 font-semibold uppercase font-mono">Sub-ms</span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60">
            <span className="text-[11px] text-gray-500 block font-medium">Active Cache Tier</span>
            <div className="mt-1">
              <span className="text-sm font-bold font-mono text-gray-200">
                {status?.cache_backend === 'redis' ? 'In-Memory Redis' : status?.cache_backend === 'object_cache' ? 'WP Object Cache' : 'MySQL Transients'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60">
            <span className="text-[11px] text-gray-500 block font-medium">Keys in Memory</span>
            <div className="mt-1">
              <span className="text-xl font-bold font-mono text-gray-200">
                {isConnected && status?.dbsize !== null ? status.dbsize : '0'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60">
            <span className="text-[11px] text-gray-500 block font-medium">Server Memory / Uptime</span>
            <div className="mt-1">
              <span className="text-xs font-bold font-mono text-gray-300">
                {isConnected && status?.used_memory_human ? status.used_memory_human : '—'}
                {isConnected && status?.uptime_days !== null ? ` • ${status.uptime_days}d` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4 pt-2 border-t border-[#1F2937]/50">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              Connection Configuration
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Enable Redis</span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-gray-400">Redis Host / URI</Label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1 or tls://your-cloud-redis.upstash.io"
                className="font-mono text-xs bg-[#0B0F19] border-[#1F2937]"
              />
              <span className="text-[10px] text-gray-500">Supports standard TCP (127.0.0.1) or encrypted TLS (tls://...).</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Port</Label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="6379"
                className="font-mono text-xs bg-[#0B0F19] border-[#1F2937]"
              />
              <span className="text-[10px] text-gray-500">Default: 6379 (or 6380 for TLS).</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-400">Auth Password (Optional)</Label>
                {status?.has_password && !password && (
                  <span className="text-[10px] text-emerald-400 font-mono">Password currently saved</span>
                )}
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (clearPassword) setClearPassword(false)
                }}
                placeholder={status?.has_password ? '•••••••••••••••• (Leave blank to keep)' : 'No auth required on local LAN'}
                className="font-mono text-xs bg-[#0B0F19] border-[#1F2937]"
              />
              {status?.has_password && (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="checkbox"
                    id="clear_pass_chk"
                    checked={clearPassword}
                    onChange={(e) => setClearPassword(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 text-xs"
                  />
                  <label htmlFor="clear_pass_chk" className="text-[11px] text-rose-400 cursor-pointer">
                    Clear stored password (switch to unauthenticated)
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Database Index</Label>
              <Input
                value={db}
                onChange={(e) => setDb(e.target.value)}
                placeholder="0"
                className="font-mono text-xs bg-[#0B0F19] border-[#1F2937]"
              />
              <span className="text-[10px] text-gray-500">Default: 0 (range 0–15).</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-[#1F2937]/70 p-4 bg-[#0B0F19]/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFlushConfirmOpen(true)}
          disabled={flushing}
          className="text-xs text-rose-400 hover:text-rose-300 hover:border-rose-500/50 gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Purge Cache (Flush)
        </Button>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestConnection}
            loading={testing}
            className="text-xs gap-1.5"
          >
            <Activity className="h-3.5 w-3.5" />
            Test Connection
          </Button>

          <Button
            size="sm"
            onClick={handleSaveConfig}
            loading={saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            Save & Connect
          </Button>
        </div>
      </CardFooter>

      {/* Confirmation Dialog for Purging Cache */}
      <ConfirmDialog
        open={flushConfirmOpen}
        onOpenChange={setFlushConfirmOpen}
        title="Flush In-Memory Redis Cache?"
        description="This will instantly purge all cached price feed ticks, distributed rate counters, and active memory keys prefixed with fxsim:*. Any subsequent requests will automatically fetch fresh data from the broker feed. Trading operations will not be interrupted."
        confirmLabel="Flush Cache Now"
        danger
        onConfirm={handleFlushCache}
      />
    </Card>
  )
}
