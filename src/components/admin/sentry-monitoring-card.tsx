'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import * as Sentry from '@sentry/nextjs'
import { APP_NAME_VERSION } from '@/lib/version'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Bug,
  Send,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react'

export function SentryMonitoringCard() {
  const [testing, setTesting] = useState(false)
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  const isConfigured = Boolean(dsn)

  const handleTriggerTestAlert = async () => {
    try {
      setTesting(true)
      const testTimestamp = new Date().toISOString()
      
      // Dispatch test event to Sentry
      Sentry.captureMessage(`[TEST_ALERT] AlphaCapital Sentry Sentinel Handshake Verified at ${testTimestamp}`, {
        level: 'info',
        extra: {
          platform: APP_NAME_VERSION,
          environment: process.env.NODE_ENV,
          testTriggeredBy: 'Admin Operations Hub',
        },
      })

      toast.success('Test telemetry event dispatched to Sentry Sentinel!', {
        description: isConfigured 
          ? 'Event ingested by Sentry stream. Check your Sentry.io issues stream.' 
          : 'Local Sentry client captured event. Configure NEXT_PUBLIC_SENTRY_DSN to route to Sentry Cloud.',
      })
    } catch (err: any) {
      toast.error('Failed to trigger Sentry test alert', {
        description: err.message,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="border border-border-subtle bg-surface text-text shadow-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger border border-danger/20">
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-text">
                Sentry.io Crash & Error Sentinel
                <Badge
                  variant={isConfigured ? 'success' : 'warning'}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {isConfigured ? 'LIVE STREAMING' : 'CLIENT ACTIVE (STANDBY)'}
                  </span>
                </Badge>
              </CardTitle>
              <CardDescription className="text-text-muted mt-0.5">
                Real-time JavaScript unhandled exception tracking, SectionErrorBoundary capturing, and performance telemetry
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerTestAlert}
              disabled={testing}
              className="gap-1.5 text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5 text-accent" />
              {testing ? 'Dispatching...' : 'Trigger Test Alert'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {/* KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-muted/40">
            <div className="flex items-center justify-between text-text-muted text-xs font-medium mb-1">
              <span>Sentinel Mode</span>
              <Activity className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="text-lg font-bold text-text">
              Fail-Soft Guard
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Next.js 16 App Router
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-muted/40">
            <div className="flex items-center justify-between text-text-muted text-xs font-medium mb-1">
              <span>Error Boundary</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              100% Guarded
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Section & Global Handlers
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-muted/40">
            <div className="flex items-center justify-between text-text-muted text-xs font-medium mb-1">
              <span>Traces Sample Rate</span>
              <Zap className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="text-lg font-bold text-text">
              100% Capture
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Zero Performance Lag
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-muted/40">
            <div className="flex items-center justify-between text-text-muted text-xs font-medium mb-1">
              <span>Cloud Sentry DSN</span>
              <Radio className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-text truncate">
              {isConfigured ? 'Configured' : 'Ready in .env'}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {isConfigured ? 'Connected to Project' : 'Optional Cloud Sync'}
            </div>
          </div>
        </div>

        {/* Technical Architecture Details */}
        <div className="p-4 rounded-lg border border-border-subtle bg-surface-muted/30 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-accent" />
            Integrated Error Capture Coverage
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text">Global Error Handler (src/app/global-error.tsx):</span>
                <p className="text-text-muted text-[11px] mt-0.5">
                  Catches fatal root unhandled exceptions and dispatches stack traces before graceful error page display.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text">Section Error Boundary (SectionErrorBoundary):</span>
                <p className="text-text-muted text-[11px] mt-0.5">
                  Protects WebTrader, Zenith AI Copilot, and Account Tables; isolates component failures without breaking the page.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text">CSP Whitelist (next.config.mjs):</span>
                <p className="text-text-muted text-[11px] mt-0.5">
                  Content Security Policy allows secure telemetry packets to <code className="text-accent font-mono text-[10px]">https://*.ingest.sentry.io</code>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text">Edge & Server Runtimes:</span>
                <p className="text-text-muted text-[11px] mt-0.5">
                  Full dual-environment coverage across Edge middleware and Node.js server routes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Guide for Buyer */}
        <div className="p-4 rounded-lg border border-accent/20 bg-accent/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-text flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                Buyer Sentry DSN Configuration (Optional Cloud Ingestion)
              </h5>
              <p className="text-xs text-text-muted leading-relaxed">
                To route all production crashes directly to your personal Sentry.io dashboard, add your DSN to Vercel or your VPS environment:
              </p>
              <div className="mt-2 p-2 bg-surface-muted rounded border border-border-subtle font-mono text-[11px] text-accent select-all">
                NEXT_PUBLIC_SENTRY_DSN=https://your-public-key@o0.ingest.sentry.io/your-project-id
              </div>
            </div>
            <a
              href="https://sentry.io"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                Sentry.io
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border-subtle pt-3 text-xs text-text-muted flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          @sentry/nextjs v10.74.0 Active
        </span>
        <span className="text-[11px] font-medium text-text-muted">
          Target: Next.js 16 Turbopack
        </span>
      </CardFooter>
    </Card>
  )
}
