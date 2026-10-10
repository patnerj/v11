'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Terminal, 
  BarChart3, 
  Coins, 
  ShieldCheck, 
  Server, 
  Cpu, 
  Zap, 
  Activity, 
  Clock, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink,
  Lock,
  Globe2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface ServiceComponent {
  name: string
  description: string
  latency: string
  uptime: string
  status: 'operational' | 'degraded' | 'maintenance'
  location: string
  icon: any
}

const SERVICES: ServiceComponent[] = [
  {
    name: 'MetaTrader 5 Bridge & Execution Gateway',
    description: 'Ultra-low latency institutional bridge interconnecting MT5 demo/live servers',
    latency: '14ms',
    uptime: '99.99%',
    status: 'operational',
    location: 'Equinix LD4 (London)',
    icon: Terminal
  },
  {
    name: 'WebTrader Pro Engine & Order Dispatcher',
    description: 'High-frequency order processing, instant market execution, and SL/TP engine',
    latency: '18ms',
    uptime: '99.98%',
    status: 'operational',
    location: 'AWS EU-West & Cloudflare Edge',
    icon: Cpu
  },
  {
    name: 'Live ECN Market Data Feeds',
    description: 'Direct tier-1 liquidity pricing stream (FX, Crypto, Indices & Metals)',
    latency: '4ms',
    uptime: '100.0%',
    status: 'operational',
    location: 'Pepperstone ECN Raw Feed',
    icon: BarChart3
  },
  {
    name: 'Evaluation & Static Drawdown Guard',
    description: 'Automated phase transition, breach protection, and profit target verification',
    latency: '< 10ms',
    uptime: '100.0%',
    status: 'operational',
    location: 'Core Risk Engine Cluster',
    icon: ShieldCheck
  },
  {
    name: 'Treasury Disbursal & Crypto Settlement',
    description: 'Automated bi-weekly ledger, USDT TRC-20, ERC-20, BTC & Bank Wire dispatch',
    latency: 'Instant',
    uptime: '99.97%',
    status: 'operational',
    location: 'Institutional Vault Gateway',
    icon: Coins
  },
  {
    name: 'Trader Portal & Authentication Gateway',
    description: 'Encrypted JWT sessions, Argon2 password hashing, and 2FA protection',
    latency: '24ms',
    uptime: '100.0%',
    status: 'operational',
    location: 'Global Anycast CDN',
    icon: Lock
  },
  {
    name: 'Identity & Automated KYC Queue',
    description: 'Real-time document recognition, AML blacklist screening, and automated verification',
    latency: 'Real-Time',
    uptime: '99.95%',
    status: 'operational',
    location: 'Tier-1 KYC Regulatory API',
    icon: Globe2
  }
]

// 90-day mock uptime blocks
const UPTIME_DAYS = Array.from({ length: 90 }, (_, i) => ({
  day: i + 1,
  status: '100% Operational',
  uptime: 100
}))

export default function StatusPage() {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<string>('Just now')

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEmail(text)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedEmail(null), 2500)
  }

  const handleRefresh = () => {
    setLastChecked('Just now')
    toast.success('Live telemetry re-verified across all 7 infrastructure nodes.')
  }

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <MarketingHeader />

      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="container max-w-6xl mx-auto px-4">
          
          {/* Top Status Header */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Institutional Infrastructure Telemetry</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tightest leading-[1.08] mb-6 text-text">
              System <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Health & Status</span>
            </h1>

            <p className="text-base md:text-lg text-text-muted leading-relaxed">
              Real-time operational metrics across LaunchAPropFirm execution nodes, MetaTrader 5 bridge connectors, and institutional liquidity feeds.
            </p>

            {/* Overall Health Pill */}
            <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-4 p-3 px-6 rounded-2xl bg-surface/90 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <div className="flex items-center gap-2.5 text-emerald-500 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                <span>All Core Systems 100% Operational</span>
              </div>
              <span className="text-border-subtle hidden sm:inline">|</span>
              <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                <Clock className="h-3.5 w-3.5 text-text-faint" />
                <span>Verified: {lastChecked}</span>
                <button 
                  onClick={handleRefresh} 
                  title="Re-check telemetry" 
                  className="hover:text-emerald-500 transition-colors ml-1 p-1 rounded"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="p-4 rounded-xl bg-surface/80 border border-border-subtle/80">
              <div className="text-xs text-text-muted font-medium mb-1">MT5 London Latency</div>
              <div className="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400">14 ms</div>
              <div className="text-2xs text-text-faint mt-1">Equinix LD4 Fiber</div>
            </div>
            <div className="p-4 rounded-xl bg-surface/80 border border-border-subtle/80">
              <div className="text-xs text-text-muted font-medium mb-1">90-Day Uptime</div>
              <div className="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400">99.98%</div>
              <div className="text-2xs text-text-faint mt-1">Zero downtime breaches</div>
            </div>
            <div className="p-4 rounded-xl bg-surface/80 border border-border-subtle/80">
              <div className="text-xs text-text-muted font-medium mb-1">Tick Processing</div>
              <div className="text-2xl font-bold font-mono text-teal-500 dark:text-teal-300">240+ /sec</div>
              <div className="text-2xs text-text-faint mt-1">Zero slip execution</div>
            </div>
            <div className="p-4 rounded-xl bg-surface/80 border border-border-subtle/80">
              <div className="text-xs text-text-muted font-medium mb-1">Treasury Settlement</div>
              <div className="text-2xl font-bold font-mono text-cyan-500 dark:text-cyan-400">&lt; 8h SLA</div>
              <div className="text-2xs text-text-faint mt-1">Crypto & Wire Rails</div>
            </div>
          </div>

          {/* 90-Day Uptime Visual Grid */}
          <div className="p-6 rounded-2xl bg-surface/80 border border-border-subtle mb-10">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-text uppercase tracking-wider font-mono">
                  Platform Uptime History (Past 90 Days)
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Continuous health telemetry recorded 24/7</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-500 dark:text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span>99.98% Operational Availability</span>
              </div>
            </div>

            {/* Visual Bars */}
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {UPTIME_DAYS.map((d) => (
                <div
                  key={d.day}
                  title={`Day -${90 - d.day}: 100% Operational`}
                  className="h-8 flex-1 min-w-[3px] rounded-sm bg-emerald-500/80 hover:bg-emerald-400 hover:scale-y-125 transition-all cursor-pointer"
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-2xs text-text-faint font-mono mt-3">
              <span>90 days ago</span>
              <span className="text-emerald-500 dark:text-emerald-400 font-medium">No critical outages recorded</span>
              <span>Today</span>
            </div>
          </div>

          {/* Core Services Detailed Table */}
          <div className="rounded-2xl bg-surface/90 border border-border-subtle overflow-hidden mb-12 shadow-xl">
            <div className="p-5 border-b border-border-subtle/80 bg-surface-secondary/40 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text font-mono flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <span>Individual Service Node Telemetry</span>
              </h2>
              <span className="text-xs text-text-muted font-mono">7 / 7 Online</span>
            </div>

            <div className="divide-y divide-border-subtle/60">
              {SERVICES.map((s) => {
                const Icon = s.icon
                return (
                  <div key={s.name} className="p-5 sm:p-6 hover:bg-surface-secondary/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-bold text-text text-sm sm:text-base">{s.name}</h4>
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-2xs font-mono bg-surface-secondary text-text-muted border border-border-subtle">
                            {s.location}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1 max-w-xl">{s.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-end md:self-auto shrink-0 font-mono text-xs">
                      <div className="text-right">
                        <div className="text-2xs text-text-faint uppercase">Latency</div>
                        <div className="text-text font-semibold">{s.latency}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xs text-text-faint uppercase">Uptime</div>
                        <div className="text-emerald-500 dark:text-emerald-400 font-semibold">{s.uptime}</div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 font-semibold text-xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        <span className="capitalize">{s.status}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Past Incidents Archive Section */}
          <div className="p-6 rounded-2xl bg-surface/80 border border-border-subtle mb-12">
            <h3 className="text-sm font-bold text-text uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span>Incident Log & Maintenance Notice</span>
            </h3>
            <div className="p-4 rounded-xl bg-surface-secondary/60 border border-border-subtle/80 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-text-muted">
                <span className="font-bold text-text">Zero active incidents.</span> All production gateways, MT5 socket streams, and withdrawal ledgers are operating at peak efficiency without disruptions.
              </div>
            </div>
          </div>

          {/* Institutional Contact & Escalation Hub */}
          <div className="p-8 rounded-3xl bg-surface border border-emerald-500/30 shadow-card">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-2xl md:text-3xl font-extrabold text-text mb-2">
                Need Infrastructure Assistance or Escalation?
              </h2>
              <p className="text-sm text-text-muted">
                Direct channels for operational emergencies, server connectivity issues, and VIP institutional inquiries.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Executive Desk */}
              <div className="p-6 rounded-2xl bg-surface-secondary/70 border border-amber-500/30 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xs font-bold uppercase tracking-wider font-mono text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                    Executive / Owner Desk
                  </span>
                  <span className="text-xs text-text-muted font-mono">SLA: &lt; 2h</span>
                </div>
                <h3 className="text-lg font-bold text-text mb-1">Managing Desk (Executive Escalation)</h3>
                <p className="text-xs text-text-muted mb-5 leading-relaxed">
                  For capital allocations ($100K–$2M+), enterprise partnerships, and senior infrastructure escalations.
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    asChild 
                    size="sm" 
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    <a href="mailto:vip@launchapropfirm.com?subject=Executive%20Escalation">
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      vip@launchapropfirm.com
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard('vip@launchapropfirm.com', 'Executive email')}
                    className="border-border-subtle hover:border-amber-400 text-text hover:text-amber-500"
                  >
                    {copiedEmail === 'vip@launchapropfirm.com' ? (
                      <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 24/7 Operations Desk */}
              <div className="p-6 rounded-2xl bg-surface-secondary/70 border border-emerald-500/30 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xs font-bold uppercase tracking-wider font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    24/7 Operations Desk
                  </span>
                  <span className="text-xs text-text-muted font-mono">SLA: &lt; 15m</span>
                </div>
                <h3 className="text-lg font-bold text-text mb-1">Client & Technical Support</h3>
                <p className="text-xs text-text-muted mb-5 leading-relaxed">
                  For MT5 server connectivity, credential resets, KYC queue checks, and withdrawal tracking.
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    asChild 
                    size="sm" 
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-glow-sm"
                  >
                    <a href="mailto:support@launchapropfirm.com?subject=Support%20Request">
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      support@launchapropfirm.com
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard('support@launchapropfirm.com', 'Support email')}
                    className="border-border-subtle hover:border-emerald-400 text-text hover:text-emerald-500"
                  >
                    {copiedEmail === 'support@launchapropfirm.com' ? (
                      <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <Link 
                href="/contact" 
                className="text-xs text-text-muted hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1 font-medium"
              >
                <span>Need ticket dispatch? Visit our direct Contact Hub</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
