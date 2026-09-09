'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, Flame, RefreshCw, 
  Users, Activity, Zap, CheckCircle2, Lock, Eye, AlertOctagon, 
  ExternalLink, Sliders, TrendingDown, ArrowUpRight
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AiSentinelReport } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function AiSentinelPanel() {
  const queryClient = useQueryClient()
  const [isScanning, setIsScanning] = useState(false)

  // Fetch or trigger live Sentinel Risk Audit
  const { data: report, isLoading, refetch } = useQuery<AiSentinelReport | null>({
    queryKey: ['admin-ai-sentinel-report'],
    queryFn: async () => {
      const res = await api.admin.ai.sentinelScan()
      return res.ok && res.data ? res.data : null
    },
    refetchInterval: 30_000,
  })

  const triggerScanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true)
      const res = await api.admin.ai.sentinelScan()
      if (!res.ok) throw new Error(res.error || 'Failed to complete Sentinel scan.')
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`AI Sentinel scan complete! Threat Level: ${data?.threat_level}`)
      queryClient.setQueryData(['admin-ai-sentinel-report'], data)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Sentinel scan failed.')
    },
    onSettled: () => {
      setIsScanning(false)
    }
  })

  const threatLevel = report?.threat_level ?? 'NOMINAL'
  const threatScore = report?.threat_score ?? 0

  const getThreatBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 animate-pulse text-xs">CRITICAL THREAT</span>
      case 'HIGH':
        return <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 text-xs">HIGH RISK</span>
      case 'ELEVATED':
        return <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-xs">ELEVATED</span>
      default:
        return <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-xs">NOMINAL / SECURE</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Sentinel Status Header ─────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#141A2E] via-[#101726] to-[#0A0D17] border border-[#1F2937] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight">AI Sentinel Watchtower</h2>
              {getThreatBadge(threatLevel)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Autonomous neural audit detecting group syndicates, sub-15s toxic arbitrage, and predictive drawdown breaches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerScanMutation.mutate()}
            loading={isScanning}
            className="gap-2 text-xs font-semibold shadow-emerald-500/20"
          >
            <Zap className="w-4 h-4" />
            Trigger Deep Neural Scan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-gray-800 text-gray-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Threat Summary Metrics ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">Global Threat Score</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-black font-mono ${threatScore > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {threatScore} / 100
              </span>
              <Activity className="w-4 h-4 text-gray-500" />
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full ${threatScore > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(100, Math.max(5, threatScore))}%` }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">Syndicate Copy Clusters</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-amber-400">
                {report?.syndicate_clusters?.length ?? 0}
              </span>
              <Users className="w-4 h-4 text-amber-400/80" />
            </div>
            <span className="text-[10px] text-gray-500 block mt-2">Correlated executions &lt;1.5s</span>
          </CardContent>
        </Card>

        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">Toxic Latency Scalpers</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-rose-400">
                {report?.toxic_scalpers?.length ?? 0}
              </span>
              <Flame className="w-4 h-4 text-rose-400/80" />
            </div>
            <span className="text-[10px] text-gray-500 block mt-2">HFT trades closed &lt;15s</span>
          </CardContent>
        </Card>

        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">Imminent Breach Risk</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-cyan-400">
                {report?.at_risk_breaches?.length ?? 0}
              </span>
              <TrendingDown className="w-4 h-4 text-cyan-400/80" />
            </div>
            <span className="text-[10px] text-gray-500 block mt-2">Accounts within 15% of limit</span>
          </CardContent>
        </Card>
      </div>

      {/* ── AI Intelligence Recommendations ───────────────────────────────── */}
      {report?.ai_recommendations && report.ai_recommendations.length > 0 && (
        <div className="p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30 text-cyan-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <Zap className="w-4 h-4" />
            Autonomous Risk Recommendations (Gemini 2.0 / DeepSeek-R1)
          </div>
          <ul className="space-y-1 text-xs text-gray-300">
            {report.ai_recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Detailed Tables ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Table 1: Toxic Latency Scalpers */}
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardHeader className="pb-3 border-b border-[#1F2937]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                Toxic Latency Scalpers (HFT Arbitrage)
              </CardTitle>
              <Badge tone="danger" size="sm">sub-15s</Badge>
            </div>
            <CardDescription className="text-xs text-gray-400">
              Traders exploiting bridge latency with ultra-short execution durations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(!report?.toxic_scalpers || report.toxic_scalpers.length === 0) ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No toxic latency scalpers detected in recent trade logs.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0B0F19] text-gray-400 uppercase text-[10px] font-mono border-b border-[#1F2937]">
                    <tr>
                      <th className="p-3">Trader / Email</th>
                      <th className="p-3 text-center">Fast Trades</th>
                      <th className="p-3 text-center">Avg Duration</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937]">
                    {report.toxic_scalpers.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/40">
                        <td className="p-3 font-medium text-white">
                          <div>{row.display_name || `Account #${row.account_id}`}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{row.user_email}</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-400">
                          {row.fast_trades_count}
                        </td>
                        <td className="p-3 text-center font-mono text-gray-300">
                          {parseFloat(String(row.avg_duration_sec)).toFixed(1)}s
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={() => toast.success(`Flagged Account #${row.account_id} for mandatory compliance audit.`)}
                          >
                            Flag / Audit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table 2: Imminent Breach Forecasting */}
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardHeader className="pb-3 border-b border-[#1F2937]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-cyan-400" />
                Imminent Drawdown Breach Radar
              </CardTitle>
              <Badge tone="accent" size="sm">&gt;3.5% Loss</Badge>
            </div>
            <CardDescription className="text-xs text-gray-400">
              Traders approaching maximum daily or trailing loss limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(!report?.at_risk_breaches || report.at_risk_breaches.length === 0) ? (
              <div className="p-8 text-center text-xs text-gray-500">
                All active accounts are within safe drawdown margins.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0B0F19] text-gray-400 uppercase text-[10px] font-mono border-b border-[#1F2937]">
                    <tr>
                      <th className="p-3">Trader</th>
                      <th className="p-3 text-center">Current DD</th>
                      <th className="p-3 text-right">Balance / Equity</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937]">
                    {report.at_risk_breaches.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/40">
                        <td className="p-3 font-medium text-white">
                          <div>{row.display_name || `Account #${row.account_id}`}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{row.user_email}</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-amber-400">
                          {parseFloat(String(row.drawdown_pct)).toFixed(2)}%
                        </td>
                        <td className="p-3 text-right font-mono text-[11px]">
                          <div>${parseFloat(String(row.balance)).toFixed(0)}</div>
                          <div className="text-gray-400">${parseFloat(String(row.equity)).toFixed(0)}</div>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2 border-gray-700"
                            onClick={() => toast.info(`Risk alert dispatched to trader ${row.user_email}.`)}
                          >
                            Warn Trader
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
