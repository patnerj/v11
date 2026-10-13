'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Download, Share2, Copy, Check, Twitter,
  ShieldCheck, ArrowRight, Eye, RefreshCw
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtUSD } from '@/lib/format'
import { useBranding } from '@/store/branding'
import { FONT_PRESETS, hexToRgb } from '@/lib/theme-accent'

interface ViralPayoutCardModalProps {
  isOpen: boolean
  onClose: () => void
  amount?: number
  traderName?: string
  date?: string
  method?: string
  payoutId?: number
}

export function ViralPayoutCardModal({
  isOpen,
  onClose,
  amount = 3850,
  traderName = 'Pro Trader',
  date = new Date().toLocaleDateString(),
  method = 'USDT (TRC20)',
  payoutId = 101,
}: ViralPayoutCardModalProps) {
  const storeBrand = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const brandName = storeBrand

  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9')
  const [themeStyle, setThemeStyle] = useState<'emerald' | 'cyan' | 'gold'>('emerald')
  const [downloading, setDownloading] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  const shareText = `💰 Just received another verified profit split of ${fmtUSD(amount)} from @${brandName.replace(/\s+/g, '')}!

Fast disbursal via ${method}. Consistent execution pays off. 🚀
Trade with them: https://demo.launchapropfirm.com

#PropFirm #FundedTrader #PayoutProof #Forex`

  const handleShareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCopyText = () => {
    try {
      navigator.clipboard.writeText(shareText)
      toast.success('Share caption copied to clipboard!')
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleDownloadPng = async () => {
    setDownloading(true)
    try {
      const canvas = document.createElement('canvas')
      const width = aspect === '16:9' ? 1920 : 1080
      const height = aspect === '9:16' ? 1920 : 1080
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const activeFontId = localStorage.getItem('fxsim:theme-font') || 'poppins'
      const activePreset = FONT_PRESETS.find((f) => f.id === activeFontId) || FONT_PRESETS[0]
      const brandFont = `"${activePreset.name}", system-ui, -apple-system, sans-serif`

      // Primary glow color based on style
      const themeHex = themeStyle === 'gold' ? '#F59E0B' : themeStyle === 'cyan' ? '#06B6D4' : '#10B981'
      const { r, g, b } = hexToRgb(themeHex)

      // Background luxury deep gradient
      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#040711')
      bg.addColorStop(0.5, '#07121E')
      bg.addColorStop(1, '#030810')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // Central glowing radial aura
      const glowY = aspect === '9:16' ? height * 0.45 : height * 0.5
      const glow = ctx.createRadialGradient(width / 2, glowY, 50, width / 2, glowY, width * 0.6)
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.28)`)
      glow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.08)`)
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      // Outer & Inner metallic borders
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`
      ctx.lineWidth = 4
      ctx.strokeRect(36, 36, width - 72, height - 72)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 2
      ctx.strokeRect(50, 50, width - 100, height - 100)

      ctx.textAlign = 'center'

      // Brand Title
      const topY = aspect === '9:16' ? 260 : 180
      ctx.fillStyle = themeHex
      ctx.font = `bold ${aspect === '9:16' ? '36px' : '28px'} ${brandFont}`
      ctx.fillText(`★ ${brandName.toUpperCase()} · VERIFIED DISBURSAL ★`, width / 2, topY)

      // Verified Badge Pill
      const pillY = aspect === '9:16' ? 340 : 250
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`
      ctx.strokeStyle = themeHex
      ctx.lineWidth = 2
      const badgeW = 340
      const badgeH = 50
      const badgeX = (width - badgeW) / 2
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(badgeX, pillY - 35, badgeW, badgeH, 25)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillRect(badgeX, pillY - 35, badgeW, badgeH)
      }
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold 20px ${brandFont}`
      ctx.fillText('🛡️ 100% VERIFIED DISBURSAL', width / 2, pillY)

      // Main Big Amount
      const amtY = aspect === '9:16' ? 620 : 490
      ctx.fillStyle = themeHex
      ctx.font = `900 ${aspect === '9:16' ? '120px' : '108px'} ${brandFont}`
      ctx.fillText(fmtUSD(amount), width / 2, amtY)

      // Disbursal Method Subtitle
      const methY = aspect === '9:16' ? 720 : 570
      ctx.fillStyle = '#94A3B8'
      ctx.font = `600 ${aspect === '9:16' ? '34px' : '28px'} ${brandFont}`
      ctx.fillText(`Disbursed via ${method} · Anti-Arbitrage Cleared`, width / 2, methY)

      // Trader Box Details
      const cardW = aspect === '9:16' ? 720 : 680
      const cardH = aspect === '9:16' ? 220 : 140
      const cardX = (width - cardW) / 2
      const cardY = aspect === '9:16' ? 880 : 660

      ctx.fillStyle = '#081220'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.lineWidth = 2
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(cardX, cardY, cardW, cardH, 18)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillRect(cardX, cardY, cardW, cardH)
      }

      ctx.textAlign = 'left'
      ctx.fillStyle = '#64748B'
      ctx.font = `bold ${aspect === '9:16' ? '24px' : '18px'} ${brandFont}`
      ctx.fillText('TRADER HANDLE', cardX + 40, cardY + (aspect === '9:16' ? 55 : 45))
      ctx.fillText('DISBURSED ON', cardX + cardW / 2 + 20, cardY + (aspect === '9:16' ? 55 : 45))

      ctx.fillStyle = '#FFFFFF'
      ctx.font = `900 ${aspect === '9:16' ? '42px' : '32px'} ${brandFont}`
      ctx.fillText(traderName, cardX + 40, cardY + (aspect === '9:16' ? 120 : 95))
      ctx.fillText(date, cardX + cardW / 2 + 20, cardY + (aspect === '9:16' ? 120 : 95))

      // Verification TX & Footer
      ctx.textAlign = 'center'
      const footY = aspect === '9:16' ? 1680 : 960
      ctx.fillStyle = '#64748B'
      ctx.font = `600 ${aspect === '9:16' ? '30px' : '22px'} ${brandFont}`
      ctx.fillText(`Verification TX: PAY-2026-${String(payoutId).padStart(6, '0')} · launchapropfirm.com`, width / 2, footY)

      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${brandName.toLowerCase()}-payout-${aspect.replace(':', 'x')}-${fmtUSD(amount).replace(/[^0-9]/g, '')}.png`
      a.click()
      toast.success('Social Payout Brag Card downloaded in Ultra-HD!')
    } catch {
      toast.error('Failed to generate social brag card')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-surface border-border p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <DialogTitle className="text-lg font-bold">1-Click Viral Social Payout Card</DialogTitle>
            </div>
            <Badge tone="accent">Social Proof Generator</Badge>
          </div>
          <DialogDescription className="text-xs text-text-muted">
            Create an ultra-HD brag card for X (Twitter) or Instagram Stories to celebrate your verified profit disbursal.
          </DialogDescription>
        </DialogHeader>

        {/* Format & Style Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-muted">Format:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-muted/40 text-xs">
              <button
                type="button"
                onClick={() => setAspect('16:9')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  aspect === '16:9' ? 'bg-accent text-accent-contrast shadow-xs' : 'text-text-muted hover:text-text'
                }`}
              >
                16:9 (X / Twitter)
              </button>
              <button
                type="button"
                onClick={() => setAspect('9:16')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  aspect === '9:16' ? 'bg-accent text-accent-contrast shadow-xs' : 'text-text-muted hover:text-text'
                }`}
              >
                9:16 (IG / TikTok Stories)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-muted">Glow Style:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setThemeStyle('emerald')}
                className={`h-6 w-6 rounded-full bg-emerald-500 ring-2 transition-all ${
                  themeStyle === 'emerald' ? 'ring-white ring-offset-2 ring-offset-background scale-110' : 'ring-transparent'
                }`}
                title="Emerald Wealth"
              />
              <button
                type="button"
                onClick={() => setThemeStyle('cyan')}
                className={`h-6 w-6 rounded-full bg-cyan-500 ring-2 transition-all ${
                  themeStyle === 'cyan' ? 'ring-white ring-offset-2 ring-offset-background scale-110' : 'ring-transparent'
                }`}
                title="Cyan Quant"
              />
              <button
                type="button"
                onClick={() => setThemeStyle('gold')}
                className={`h-6 w-6 rounded-full bg-amber-500 ring-2 transition-all ${
                  themeStyle === 'gold' ? 'ring-white ring-offset-2 ring-offset-background scale-110' : 'ring-transparent'
                }`}
                title="Obsidian Gold"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Canvas Container */}
        <div className="flex justify-center p-3 sm:p-5 bg-background/80 rounded-2xl border border-border/80">
          <div
            data-theme="midnight-obsidian"
            className={`dark w-full rounded-2xl border p-6 flex flex-col justify-between text-center relative overflow-hidden shadow-2xl transition-all duration-300 ${
              aspect === '16:9' ? 'aspect-[16/9] max-h-[380px]' : 'aspect-[9/16] max-h-[460px] max-w-[280px]'
            } ${
              themeStyle === 'gold'
                ? 'border-amber-500/50 bg-gradient-to-br from-[#060811] via-[#120E04] to-[#04060C]'
                : themeStyle === 'cyan'
                ? 'border-cyan-500/50 bg-gradient-to-br from-[#060811] via-[#04121A] to-[#04060C]'
                : 'border-emerald-500/50 bg-gradient-to-br from-[#060811] via-[#04140F] to-[#04060C]'
            }`}
          >
            <div className="flex items-center justify-between relative z-10">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-text-muted">
                ★ {brandName.toUpperCase()} ★
              </span>
              <div className="inline-flex items-center gap-1 rounded-full bg-surface/60 border border-white/10 px-2 py-0.5 text-3xs font-bold text-white">
                <ShieldCheck className="h-3 w-3 text-profit" /> Verified
              </div>
            </div>

            <div className="my-auto py-2 relative z-10 space-y-1">
              <div className="text-3xs uppercase font-mono tracking-wider text-text-muted">Official Disbursal</div>
              <div
                className={`font-black tracking-tight drop-shadow-md ${
                  aspect === '16:9' ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl'
                } ${
                  themeStyle === 'gold'
                    ? 'text-amber-400'
                    : themeStyle === 'cyan'
                    ? 'text-cyan-400'
                    : 'text-emerald-400'
                }`}
              >
                {fmtUSD(amount)}
              </div>
              <div className="text-3xs text-slate-300 font-medium">Disbursed via {method}</div>
            </div>

            <div className="bg-[#0B1020]/80 border border-white/10 rounded-xl p-2.5 grid grid-cols-2 text-left relative z-10 text-3xs">
              <div>
                <span className="text-text-muted">Trader</span>
                <div className="font-bold text-white truncate">{traderName}</div>
              </div>
              <div className="text-right">
                <span className="text-text-muted">Date</span>
                <div className="font-bold text-white">{date}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareToTwitter}
              className="gap-1.5 flex-1 sm:flex-initial text-xs h-9 bg-black/40 text-white hover:bg-black/60 border-white/20"
            >
              <Twitter className="h-4 w-4 text-[#1DA1F2]" /> Share to X (Twitter)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="gap-1.5 flex-1 sm:flex-initial text-xs h-9"
            >
              {copiedShare ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
              {copiedShare ? 'Copied' : 'Copy Caption'}
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPng}
              loading={downloading}
              className="gap-1.5 w-full sm:w-auto text-xs h-9 font-bold bg-accent text-accent-contrast shadow-sm"
            >
              <Download className="h-4 w-4" /> Download Ultra-HD PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
