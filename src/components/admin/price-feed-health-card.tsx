'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Terminal,
  Radio,
  Clock,
  ShieldCheck,
  Zap,
  Globe,
  Server,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface PriceFeedHealthCardProps {
  onConfigureClick?: () => void
}

export function PriceFeedHealthCard({ onConfigureClick }: PriceFeedHealthCardProps) {
  const [health, setHealth] = useState<any | null>(null)
  const [cronSetup, setCronSetup] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [hRes, cRes] = await Promise.all([
        api.admin.priceFeedHealth(),
        api.admin.priceFeedCronSetup(),
      ])

      if (hRes.ok && hRes.data) {
        setHealth(hRes.data)
      }
      if (cRes.ok && cRes.data) {
        setCronSetup(cRes.data)
      }
    } catch {
      // Fail-soft fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 8000)
    return () => clearInterval(timer)
  }, [loadData])

  const handleForceRefresh = async () => {
    try {
      setRefreshing(true)
      const res = await api.admin.forcePrices()
      if (res.ok) {
        toast.success(res.data.message || 'Prices refreshed successfully')
        loadData()
      } else {
        toast.error('Failed to force price refresh')
      }
    } catch (err: any) {
      toast.error('Price refresh error: ' + (err?.message || 'Network error'))
    } finally {
      setRefreshing(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const isStale = health?.is_stale ?? (health?.seconds_ago != null ? health.seconds_ago > 120 : false)
  const secondsAgo = health?.seconds_ago ?? (health?.last_update_ts ? Math.max(0, Math.floor(Date.now() / 1000) - health.last_update_ts) : null)
  const isSystemCron = Boolean(health?.wp_cron_disabled ?? cronSetup?.wp_cron_disabled)
  const activeSource = health?.active_source || health?.source || 'Yahoo Finance'
  const positionsCount = health?.positions_with_sltp ?? 0

  return (
    <Card className="border border-border-subtle bg-surface text-text shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
              isStale
                ? 'bg-danger/10 text-danger border-danger/20'
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              <Radio className={`h-5 w-5 ${!isStale ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-text">
                Live Price Feed & SL/TP Sentinel
                <Badge tone={isStale ? 'danger' : 'success'}>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${isStale ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                    {isStale ? 'FEED STALE' : 'LIVE STREAMING'}
                  </span>
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Deterministic SL/TP and stop-out enforcement daemon with Yahoo Finance & MT5 bridge
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceRefresh}
              disabled={refreshing}
              className="gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-accent ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Force Refresh'}
            </Button>
            {onConfigureClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onConfigureClick}
                className="gap-1 text-xs"
              >
                Configure
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {/* Metric 1: Last Ticks */}
          <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted">
              <span>Last Quote Tick</span>
              <Clock className="h-3 w-3 text-text-faint" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-text">
                {secondsAgo != null ? `${secondsAgo}s` : '—'}
              </span>
              <span className="text-2xs text-text-muted">ago</span>
              {!isStale ? (
                <span className="text-xs text-emerald-500 ml-auto font-medium">Fresh</span>
              ) : (
                <span className="text-xs text-red-400 ml-auto font-medium">Stale</span>
              )}
            </div>
            <div className="text-2xs text-text-faint">
              Cadence: 5s in-memory / 35s Yahoo
            </div>
          </div>

          {/* Metric 2: Active Feed Source */}
          <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted">
              <span>Active Source</span>
              {activeSource.includes('mt5') ? (
                <Server className="h-3 w-3 text-accent" />
              ) : (
                <Globe className="h-3 w-3 text-accent" />
              )}
            </div>
            <div className="text-base font-semibold text-text truncate">
              {activeSource}
            </div>
            <div className="text-2xs text-text-faint">
              Mode: {health?.mode ?? 'auto'} (failover safe)
            </div>
          </div>

          {/* Metric 3: Active SL/TP Positions */}
          <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted">
              <span>Active SL/TP Orders</span>
              <ShieldCheck className="h-3 w-3 text-accent" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-text">
                {positionsCount}
              </span>
              <span className="text-2xs text-text-muted">positions guarded</span>
            </div>
            <div className="text-2xs text-text-faint">
              Continuous 5s Sentinel Check
            </div>
          </div>

          {/* Metric 4: System Cron Status */}
          <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted">
              <span>Cron Architecture</span>
              <Activity className="h-3 w-3 text-accent" />
            </div>
            <div className="flex items-center gap-1.5">
              {isSystemCron ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-500">System Cron</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">WP-Cron Active</span>
                </>
              )}
            </div>
            <div className="text-2xs text-text-faint">
              {isSystemCron ? 'Deterministic background timing' : 'Requires site visitors (recommend setup)'}
            </div>
          </div>
        </div>

        {/* Collapsible Setup & Deployment Instructions */}
        <div className="border border-border-subtle rounded-lg bg-surface-muted/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSetup((prev) => !prev)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-text hover:bg-surface-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-accent" />
              SL/TP Sentinel & Server Cron Setup Instructions
            </span>
            <span className="flex items-center gap-1 text-2xs text-text-muted">
              {showSetup ? (
                <>Hide Details <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>Show Setup Guide <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </span>
          </button>

          {showSetup && (
            <div className="p-4 border-t border-border-subtle space-y-3 text-xs">
              <p className="text-text-muted">
                To guarantee stop-loss and take-profit triggers fire 100% reliably even with zero site visitors:
              </p>

              {/* Step 1 */}
              <div className="space-y-1">
                <div className="font-semibold text-text flex items-center gap-1.5">
                  <span className="flex h-4 w-4 rounded-full bg-accent/20 text-accent items-center justify-center text-2xs">1</span>
                  Add to wp-config.php (disables flaky visitor-based cron):
                </div>
                <div className="flex items-center justify-between p-2 bg-bg-subtle rounded border border-border-subtle font-mono text-2xs text-text-muted">
                  <code>{cronSetup?.wp_config_line || "define('DISABLE_WP_CRON', true);"}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cronSetup?.wp_config_line || "define('DISABLE_WP_CRON', true);", "wp-config line")}
                    className="p-1 hover:bg-surface-muted rounded text-text-faint hover:text-text shrink-0"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-1">
                <div className="font-semibold text-text flex items-center gap-1.5">
                  <span className="flex h-4 w-4 rounded-full bg-accent/20 text-accent items-center justify-center text-2xs">2</span>
                  Add to server crontab (crontab -e) for 60s background execution:
                </div>
                <div className="flex items-center justify-between p-2 bg-bg-subtle rounded border border-border-subtle font-mono text-2xs text-text-muted">
                  <code className="truncate mr-2">{cronSetup?.crontab_line || '* * * * * curl -s "https://massfunded.org/wp-cron.php?doing_wp_cron=1" > /dev/null 2>&1'}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cronSetup?.crontab_line || '* * * * * curl -s "https://massfunded.org/wp-cron.php?doing_wp_cron=1" > /dev/null 2>&1', "Crontab curl command")}
                    className="p-1 hover:bg-surface-muted rounded text-text-faint hover:text-text shrink-0"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-1">
                <div className="font-semibold text-text flex items-center gap-1.5">
                  <span className="flex h-4 w-4 rounded-full bg-accent/20 text-accent items-center justify-center text-2xs">3</span>
                  Dedicated 5-Second SL/TP Sentry Daemon (via PM2 or nohup):
                </div>
                <div className="flex items-center justify-between p-2 bg-bg-subtle rounded border border-border-subtle font-mono text-2xs text-text-muted">
                  <code className="truncate mr-2">pm2 start sentry_sltp.php --interpreter=php --name=sltp-sentry --restart-delay=5000</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("pm2 start sentry_sltp.php --interpreter=php --name=sltp-sentry --restart-delay=5000", "PM2 start command")}
                    className="p-1 hover:bg-surface-muted rounded text-text-faint hover:text-text shrink-0"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
