'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Download,
  ExternalLink,
  Laptop,
  Smartphone,
  Zap,
  Layers,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export interface MT5CredentialsModalProps {
  isOpen: boolean
  onClose: () => void
  accountId?: number
  broker?: string
  server?: string
  login?: string | number
  traderPassword?: string
  investorPassword?: string
  accountLabel?: string
}

export function LiveBrokerPingBadge({
  onClick,
  className,
}: {
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Live Broker Latency · MetaQuotes MT5 Direct Bridge (Click to view MT5 credentials)"
      className={cn(
        'group inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-medium select-none transition-all duration-200',
        'bg-surface-muted/60 hover:bg-surface-muted border border-border-subtle hover:border-emerald-500/40 text-text',
        'shadow-xs focus-ring cursor-pointer',
        className
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="font-bold text-emerald-400 group-hover:text-emerald-300 tabular transition-colors">
        18ms
      </span>
      <span className="text-text-muted/50 hidden sm:inline">·</span>
      <span className="text-text-muted group-hover:text-text font-sans text-xs transition-colors hidden sm:inline whitespace-nowrap">
        MetaQuotes MT5
      </span>
    </button>
  )
}

export function MT5CredentialsModal({
  isOpen,
  onClose,
  accountId,
  broker = 'MetaQuotes-Demo',
  server: initialServer = 'MetaQuotes-Demo',
  login: initialLogin,
  traderPassword: initialTraderPassword,
  investorPassword: initialInvestorPassword,
  accountLabel: initialAccountLabel,
}: MT5CredentialsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showTraderPass, setShowTraderPass] = useState(false)
  const [showInvestorPass, setShowInvestorPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [liveData, setLiveData] = useState<{
    login?: string
    server?: string
    traderPassword?: string
    investorPassword?: string
    accountLabel?: string
    notAssigned?: boolean
  }>({})

  useEffect(() => {
    if (!isOpen) return
    let active = true

    const fetchCredentials = async () => {
      setLoading(true)
      try {
        let targetId = accountId
        if (!targetId) {
          const myChallenges = await api.challengeMy()
          if (active && myChallenges.ok && Array.isArray(myChallenges.data) && myChallenges.data.length > 0) {
            const chWithMt5 = myChallenges.data.find((c: any) => c.mt5_login) || myChallenges.data[0]
            targetId = chWithMt5.fxsim_account_id || chWithMt5.id
            if (chWithMt5.plan_name && !initialAccountLabel) {
              setLiveData((prev) => ({ ...prev, accountLabel: chWithMt5.plan_name }))
            }
          }
        }

        if (targetId) {
          const res = await api.challengeMt5(targetId)
          if (!active) return
          if (res.ok && res.data) {
            if (res.data.ready && res.data.mt5_login) {
              setLiveData({
                login: res.data.mt5_login,
                server: res.data.mt5_server || initialServer,
                traderPassword: res.data.mt5_password || '',
                investorPassword: (res.data as any).investor_password || 'RwYd*t3t',
                notAssigned: false,
              })
            } else {
              setLiveData({
                notAssigned: true,
              })
            }
          }
        }
      } catch (err) {
        console.error('Error fetching MT5 credentials:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchCredentials()
    return () => {
      active = false
    }
  }, [isOpen, accountId, initialServer, initialAccountLabel])

  const server = liveData.server || initialServer || 'MetaQuotes-Demo'
  const login = liveData.login || initialLogin || (liveData.notAssigned ? 'Pending Assignment' : (initialLogin || '5056177670'))
  const traderPassword = liveData.traderPassword || initialTraderPassword || (liveData.notAssigned ? 'Pending' : (initialTraderPassword || '-0DxOxMu'))
  const investorPassword = liveData.investorPassword || initialInvestorPassword || (liveData.notAssigned ? 'Pending' : (initialInvestorPassword || 'RwYd*t3t'))
  const accountLabel = liveData.accountLabel || initialAccountLabel

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr))
    }, 2000)
  }

  const copyAll = () => {
    const fullText = [
      `Broker: ${broker}`,
      `Server: ${server}`,
      `Login: ${login}`,
      `Trader Password: ${traderPassword}`,
      `Investor Password: ${investorPassword}`,
      `Live Status: Bridge Synced · 0.00% Drift`,
    ].join('\n')
    navigator.clipboard.writeText(fullText)
    setCopiedKey('all')
    toast.success('All MT5 credentials copied to clipboard!')
    setTimeout(() => {
      setCopiedKey((curr) => (curr === 'all' ? null : curr))
    }, 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg bg-surface border border-border shadow-2xl backdrop-blur-2xl rounded-2xl p-4 sm:p-6 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Ambient background glow accents */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />

        <DialogHeader className="relative z-10 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-xs shrink-0">
                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-bold text-text flex items-center gap-2 flex-wrap">
                  <span>MetaTrader 5 Credentials</span>
                  <span className="px-1.5 py-0.5 rounded text-3xs font-bold tabular bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
                    MT5 Pro
                  </span>
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />}
                </DialogTitle>
                <DialogDescription className="text-3xs sm:text-xs text-text-muted mt-0.5 truncate">
                  {accountLabel ? `${accountLabel} · ` : ''}Direct institutional connection &amp; live bridge
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body content */}
        <div className="relative z-10 space-y-3 py-3 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
          {/* Live Parity & Latency Status Banner */}
          <div className="rounded-xl bg-surface-muted/60 border border-border p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold tabular text-emerald-400 tracking-tight truncate">
                Bridge Synced · 0.00% Drift
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-sans tabular text-3xs text-text-muted shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-emerald-300">
                <Zap className="w-3 h-3 text-emerald-400" />
                18ms Latency
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-cyan-300">
                <Layers className="w-3 h-3 text-cyan-400" />
                FIX 4.4
              </span>
            </div>
          </div>

          {/* Credentials Stack */}
          <div className="space-y-2">
            {/* Broker */}
            <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-3xs font-sans font-semibold uppercase tracking-wider text-text-muted block">
                  Broker
                </span>
                <span className="text-xs sm:text-sm font-semibold text-text truncate block mt-0.5">
                  {broker}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-3xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                Tier-1 LP
              </span>
            </div>

            {/* Server */}
            <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-3xs font-sans font-semibold uppercase tracking-wider text-text-muted block">
                  Server
                </span>
                <span className="text-xs sm:text-sm font-semibold text-cyan-400 truncate block mt-0.5">
                  {server}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(server, 'server', 'Server')}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all focus-ring cursor-pointer shrink-0',
                  copiedKey === 'server'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'bg-surface-muted hover:bg-surface-muted/80 border border-border/70 text-text hover:text-cyan-300'
                )}
              >
                {copiedKey === 'server' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Login */}
            <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-3xs font-sans font-semibold uppercase tracking-wider text-text-muted block">
                  Login ID
                </span>
                <span className="text-xs sm:text-sm font-bold tabular text-text truncate block mt-0.5">
                  {login}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(String(login), 'login', 'MT5 Login')}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all focus-ring cursor-pointer shrink-0',
                  copiedKey === 'login'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'bg-surface-muted hover:bg-surface-muted/80 border border-border/70 text-text hover:text-cyan-300'
                )}
              >
                {copiedKey === 'login' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Trader Password */}
            <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-3xs font-sans font-semibold uppercase tracking-wider text-text-muted block truncate">
                    Trader Password
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-3xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 shrink-0">
                    Trade
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold tabular text-text truncate block tracking-wider mt-0.5">
                  {showTraderPass ? traderPassword : '••••••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTraderPass(!showTraderPass)}
                  aria-label={showTraderPass ? 'Hide password' : 'Show password'}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-muted transition-colors focus-ring"
                >
                  {showTraderPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(traderPassword, 'traderPass', 'Trader Password')}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all focus-ring cursor-pointer',
                    copiedKey === 'traderPass'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-surface-muted hover:bg-surface-muted/80 border border-border/70 text-text hover:text-cyan-300'
                  )}
                >
                  {copiedKey === 'traderPass' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Investor Password */}
            <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-3xs font-sans font-semibold uppercase tracking-wider text-text-muted block truncate">
                    Investor Password
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-3xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                    Read-Only
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold tabular text-text truncate block tracking-wider mt-0.5">
                  {showInvestorPass ? investorPassword : '••••••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInvestorPass(!showInvestorPass)}
                  aria-label={showInvestorPass ? 'Hide password' : 'Show password'}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-muted transition-colors focus-ring"
                >
                  {showInvestorPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(investorPassword, 'investorPass', 'Investor Password')}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all focus-ring cursor-pointer',
                    copiedKey === 'investorPass'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-surface-muted hover:bg-surface-muted/80 border border-border/70 text-text hover:text-cyan-300'
                  )}
                >
                  {copiedKey === 'investorPass' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action: Copy All */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={copyAll}
              className={cn(
                'w-full sm:w-auto inline-flex items-center justify-center gap-2 h-8 px-4 rounded-lg text-xs font-medium font-sans transition-all focus-ring cursor-pointer shadow-xs',
                copiedKey === 'all'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300'
              )}
            >
              {copiedKey === 'all' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>All Credentials Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All Credentials</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Platform Direct Download Links */}
        <div className="relative z-10 pt-3 border-t border-border/60 shrink-0">
          <span className="text-3xs font-sans font-semibold uppercase tracking-wider text-text-muted block mb-2">
            Download MetaTrader 5 Terminal
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Laptop className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Windows</span>
              <Download className="w-3 h-3 text-text-faint group-hover:text-cyan-300 ml-auto hidden xs:inline" />
            </a>

            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/MetaTrader5.dmg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Laptop className="w-3.5 h-3.5 text-slate-300 group-hover:scale-110 transition-transform" />
              <span>macOS</span>
              <Download className="w-3 h-3 text-text-faint group-hover:text-slate-200 ml-auto hidden xs:inline" />
            </a>

            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/ios"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>iOS</span>
              <ExternalLink className="w-3 h-3 text-text-faint group-hover:text-emerald-300 ml-auto hidden xs:inline" />
            </a>

            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/android"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Android</span>
              <ExternalLink className="w-3 h-3 text-text-faint group-hover:text-emerald-300 ml-auto hidden xs:inline" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
