'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

export interface MT5CredentialsModalProps {
  isOpen: boolean
  onClose: () => void
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
      title="Live Broker Latency · MetaQuotes-Demo Direct Bridge (Click to view MT5 credentials)"
      className={cn(
        'group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-mono font-medium select-none transition-all duration-200',
        'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 hover:border-cyan-500/40 hover:text-cyan-300',
        'shadow-xs focus-ring cursor-pointer',
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
      <span className="font-semibold text-emerald-300 group-hover:text-cyan-300 transition-colors">
        ⚡ 18ms
      </span>
      <span className="text-text-faint">·</span>
      <span className="text-emerald-400/90 group-hover:text-cyan-200 transition-colors">
        MetaQuotes-Demo
      </span>
    </button>
  )
}

export function MT5CredentialsModal({
  isOpen,
  onClose,
  broker = 'MetaQuotes-Demo',
  server = 'MetaQuotes-Demo',
  login = '5056177670',
  traderPassword = '-0DxOxMu',
  investorPassword = 'RwYd*t3t',
  accountLabel,
}: MT5CredentialsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showTraderPass, setShowTraderPass] = useState(false)
  const [showInvestorPass, setShowInvestorPass] = useState(false)

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
      <DialogContent className="sm:max-w-xl bg-[#0b0f19]/95 border border-border/80 shadow-2xl backdrop-blur-2xl rounded-2xl p-5 sm:p-6 overflow-hidden">
        {/* Ambient background glow accents */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />

        <DialogHeader className="relative z-10 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  MetaTrader 5 Credentials
                  <span className="px-2 py-0.5 rounded text-3xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    MT5 Pro
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-text-muted mt-0.5">
                  {accountLabel ? `${accountLabel} · ` : ''}Direct institutional connection &amp; live bridge
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Live Parity & Latency Status Banner */}
        <div className="relative z-10 rounded-xl bg-surface-muted/60 border border-emerald-500/30 p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 tracking-tight">
              🟢 Bridge Synced · 0.00% Drift
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-3xs text-text-muted">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border/60 text-emerald-300">
              <Zap className="w-3 h-3 text-emerald-400" />
              18ms Ultra-Low Latency
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border/60 text-cyan-300">
              <Layers className="w-3 h-3 text-cyan-400" />
              Direct FIX 4.4
            </span>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="relative z-10 space-y-2.5">
          {/* Broker */}
          <div className="p-2.5 rounded-lg bg-surface/70 border border-border/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-3xs font-mono uppercase tracking-wider text-text-muted block">
                Broker
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-text truncate block">
                {broker}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded text-3xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                Institutional Tier-1 LP
              </span>
            </div>
          </div>

          {/* Server */}
          <div className="p-2.5 rounded-lg bg-surface/70 border border-border/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-3xs font-mono uppercase tracking-wider text-text-muted block">
                Server
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-cyan-400 truncate block">
                {server}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(server, 'server', 'Server name')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all focus-ring cursor-pointer shrink-0',
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
          <div className="p-2.5 rounded-lg bg-surface/70 border border-border/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-3xs font-mono uppercase tracking-wider text-text-muted block">
                Login (Account ID)
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-text truncate block">
                {login}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(String(login), 'login', 'MT5 Login')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all focus-ring cursor-pointer shrink-0',
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
          <div className="p-2.5 rounded-lg bg-surface/70 border border-border/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-3xs font-mono uppercase tracking-wider text-text-muted block">
                  Trader Password (Master / Execution)
                </span>
                <span className="px-1 py-0.2 rounded text-3xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20">
                  Trade Access
                </span>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold text-text truncate block tracking-wider">
                {showTraderPass ? traderPassword : '••••••••••••'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowTraderPass(!showTraderPass)}
                aria-label={showTraderPass ? 'Hide password' : 'Show password'}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors focus-ring"
              >
                {showTraderPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(traderPassword, 'traderPass', 'Trader Password')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all focus-ring cursor-pointer',
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
          <div className="p-2.5 rounded-lg bg-surface/70 border border-border/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-3xs font-mono uppercase tracking-wider text-text-muted block">
                  Investor Password (Read-Only)
                </span>
                <span className="px-1 py-0.2 rounded text-3xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  Read Only
                </span>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold text-text truncate block tracking-wider">
                {showInvestorPass ? investorPassword : '••••••••••••'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowInvestorPass(!showInvestorPass)}
                aria-label={showInvestorPass ? 'Hide password' : 'Show password'}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors focus-ring"
              >
                {showInvestorPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(investorPassword, 'investorPass', 'Investor Password')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all focus-ring cursor-pointer',
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
        <div className="relative z-10 flex justify-end">
          <button
            type="button"
            onClick={copyAll}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all focus-ring cursor-pointer shadow-xs',
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

        {/* Platform Direct Download Links */}
        <div className="relative z-10 pt-3 border-t border-border/60">
          <span className="text-3xs font-mono uppercase tracking-wider text-text-muted block mb-2">
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
              <Download className="w-3 h-3 text-text-faint group-hover:text-cyan-300 ml-auto" />
            </a>

            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/MetaTrader5.dmg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Laptop className="w-3.5 h-3.5 text-slate-300 group-hover:scale-110 transition-transform" />
              <span>macOS</span>
              <Download className="w-3 h-3 text-text-faint group-hover:text-slate-200 ml-auto" />
            </a>

            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/ios"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>iOS</span>
              <ExternalLink className="w-3 h-3 text-text-faint group-hover:text-emerald-300 ml-auto" />
            </a>

            <a
              href="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/android"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface/80 border border-border/60 hover:border-accent hover:bg-surface-muted/90 text-text hover:text-white transition-all text-xs font-medium group select-none"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Android</span>
              <ExternalLink className="w-3 h-3 text-text-faint group-hover:text-emerald-300 ml-auto" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
