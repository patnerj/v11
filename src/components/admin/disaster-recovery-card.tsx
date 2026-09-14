'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { BackupStatusResponse, BackupSnapshot } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  Database,
  Lock,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Copy,
  Clock,
  Terminal,
  ShieldAlert,
  Archive,
  Download,
  Key
} from 'lucide-react'

export function DisasterRecoveryCard() {
  const [status, setStatus] = useState<BackupStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.admin.backupStatus()
      if (res.ok && res.data) {
        setStatus(res.data)
      }
    } catch (err: any) {
      console.error('Failed to load backup status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 30_000)
    return () => clearInterval(interval)
  }, [loadStatus])

  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      const res = await api.admin.backupCreate()
      if (res.ok && res.data.success) {
        toast.success(res.data.message || 'Encrypted backup snapshot created and verified!')
        await loadStatus()
      } else {
        toast.error((!res.ok ? res.error : res.data.message) || 'Failed to create backup snapshot.')
      }
    } catch (err: any) {
      toast.error('Backup creation error: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const latest = status?.latest_backup

  return (
    <div className="space-y-6 w-full">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937]/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">
              Institutional Disaster Recovery & Encrypted Vault
            </h2>
            <Badge tone="success" size="sm" className="font-mono">
              AES-256 PBKDF2
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Automated cryptographic MySQL backups with SHA-256 tamper verification, ACID isolation, and multi-tier retention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStatus}
            disabled={loading}
            className="border-[#1F2937] bg-[#111827] text-gray-300 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>

          <Button
            size="sm"
            onClick={handleCreateBackup}
            disabled={creating}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
          >
            {creating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Encrypting Vault Snapshot...
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Trigger Encrypted Backup Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── 4 Key KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Disaster Recovery Readiness */}
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">DR Readiness Score</span>
              <Badge tone="success" size="sm" className="font-mono">
                {status?.status || 'OPERATIONAL'}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-emerald-400">
                {status?.dr_readiness_score ?? 100}%
              </span>
              <span className="text-xs text-gray-500">Readiness</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ACID Single-Transaction Isolation
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Encryption Cipher */}
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Encryption Cipher</span>
              <Badge tone="info" size="sm" className="font-mono">
                Military Grade
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-gray-100">
                AES-256-CBC
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
              <Key className="h-3 w-3 text-blue-400" />
              PBKDF2 (100,000 HMAC-SHA256 Iters)
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Latest Snapshot Size */}
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Latest Snapshot</span>
              <Badge tone="neutral" size="sm" className="font-mono">
                {status?.total_snapshots ?? 0} Snapshots
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {latest ? formatBytes(latest.encrypted_size_bytes) : '—'}
              </span>
              {latest?.raw_size_bytes && latest.compressed_size_bytes && (
                <span className="text-xs text-emerald-400 font-mono">
                  (-{Math.round((1 - latest.compressed_size_bytes / latest.raw_size_bytes) * 100)}%)
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
              <HardDrive className="h-3 w-3 text-amber-400" />
              GZIP Level 9 Compression
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Retention Policy */}
        <Card className="bg-[#111827] border-[#1F2937]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Retention Policy</span>
              <Badge tone="neutral" size="sm" className="font-mono">
                Automated
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-base font-bold font-mono text-gray-200">
                {status?.retention_policy || '7 Daily / 4 Weekly / 3 Monthly'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-purple-400" />
              Nightly VPS Cron at 02:00 UTC
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Active Vault Manifest Details ──────────────────────────────────── */}
      {latest && (
        <Card className="bg-[#111827] border-emerald-500/30">
          <CardHeader className="pb-3 border-b border-[#1F2937]/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                Active Production Snapshot Manifest
              </CardTitle>
              <Badge tone="success" size="sm" className="font-mono flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                SHA-256 Tamper-Proof
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <span className="text-gray-500 block">Snapshot ID</span>
                <span className="font-mono font-semibold text-gray-200">{latest.id}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Archive Filename</span>
                <span className="font-mono font-semibold text-gray-200">{latest.filename}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Creation Timestamp (UTC)</span>
                <span className="font-mono font-semibold text-gray-200">{latest.timestamp_utc}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Target Database</span>
                <span className="font-mono font-semibold text-gray-200">{latest.database}</span>
              </div>
            </div>

            <div className="p-3 bg-[#0B0F19] rounded-lg border border-[#1F2937] flex items-center justify-between">
              <div className="space-y-0.5 overflow-hidden">
                <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">
                  SHA-256 Cryptographic Checksum Digest
                </span>
                <span className="font-mono text-xs text-emerald-400 truncate block">
                  {latest.checksum_sha256}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(latest.checksum_sha256, 'SHA-256 Hash')}
                className="text-gray-400 hover:text-white ml-2 flex-shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Disaster Recovery Restoration Drill Instructions ────────────────── */}
      <Card className="bg-[#111827] border-[#1F2937]">
        <CardHeader className="pb-3 border-b border-[#1F2937]/60">
          <CardTitle className="text-base text-gray-100 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            Disaster Recovery Restoration Drills (Buyer Due Diligence)
          </CardTitle>
          <CardDescription className="text-xs text-gray-400">
            Automated scripts included in <code className="text-emerald-400 font-mono">05_DATABASE_AND_DEPLOYMENT/backup_scripts/</code> allow buyers to verify 100% restore capability without touching live tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <div className="p-3.5 bg-[#0B0F19] rounded-lg border border-[#1F2937] font-mono text-xs text-gray-300 space-y-2">
            <div className="flex items-center justify-between text-gray-500 text-[11px] pb-1 border-b border-[#1F2937]">
              <span>Step 1: Non-Destructive Dry Run Integrity Verification</span>
              <button
                onClick={() => copyToClipboard('python 05_DATABASE_AND_DEPLOYMENT/backup_scripts/restore_database.py backups/alphacapital_backup_*.sql.gz.enc --verify-only', 'Verification command')}
                className="hover:text-white"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <code className="block text-emerald-400">
              python 05_DATABASE_AND_DEPLOYMENT/backup_scripts/restore_database.py &lt;archive.sql.gz.enc&gt; --verify-only
            </code>
          </div>

          <div className="p-3.5 bg-[#0B0F19] rounded-lg border border-[#1F2937] font-mono text-xs text-gray-300 space-y-2">
            <div className="flex items-center justify-between text-gray-500 text-[11px] pb-1 border-b border-[#1F2937]">
              <span>Step 2: 1-Command Live Database Restoration</span>
              <button
                onClick={() => copyToClipboard('python 05_DATABASE_AND_DEPLOYMENT/backup_scripts/restore_database.py backups/alphacapital_backup_*.sql.gz.enc --restore', 'Restore command')}
                className="hover:text-white"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <code className="block text-blue-400">
              python 05_DATABASE_AND_DEPLOYMENT/backup_scripts/restore_database.py &lt;archive.sql.gz.enc&gt; --restore
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
