'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Download, Copy, Check, Megaphone,
  MessageSquare, Monitor, Smartphone, Layers,
  ShieldCheck, Zap, Ticket, ExternalLink, Flame, CheckCircle2, Award
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBranding } from '@/store/branding'
import { FONT_PRESETS, hexToRgb } from '@/lib/theme-accent'
import { cn } from '@/lib/cn'

interface MarketingMediaKitProps {
  affiliateCode?: string
  partnerLink?: string
}

type BannerFormat = '16:9' | '1:1' | '9:16'

export function MarketingMediaKit({
  affiliateCode = 'PARTNER',
  partnerLink = 'https://demo.launchapropfirm.com',
}: MarketingMediaKitProps) {
  const storeBrand = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const brandName = storeBrand
  const [selectedFormat, setSelectedFormat] = useState<BannerFormat>('16:9')
  const [downloadingType, setDownloadingType] = useState<string | null>(null)
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState<number | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const copyToClipboard = (text: string, msg: string = 'Copied to clipboard!') => {
    try {
      navigator.clipboard.writeText(text)
      toast.success(msg)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleCopyLink = () => {
    copyToClipboard(partnerLink, 'Partner referral link copied!')
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyCode = () => {
    copyToClipboard(affiliateCode, `Promo code "${affiliateCode}" copied!`)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // ── High-Fidelity Canvas Banner Generator (100% WYSIWYG Ultra-HD) ──
  const generateAndDownloadBanner = (type: BannerFormat) => {
    if (typeof window === 'undefined') return
    setDownloadingType(type)

    try {
      const canvas = document.createElement('canvas')
      const width = type === '16:9' ? 1920 : 1080
      const height = type === '9:16' ? 1920 : 1080
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const activeFontId = localStorage.getItem('fxsim:theme-font') || 'poppins'
      const activePreset = FONT_PRESETS.find((f) => f.id === activeFontId) || FONT_PRESETS[0]
      const brandFont = `"${activePreset.name}", 'Poppins', system-ui, -apple-system, sans-serif`

      const activeAccent = localStorage.getItem('fxsim:theme-accent') || '#10B981'
      const { r, g, b } = hexToRgb(activeAccent)

      // 1. Luxury Dark Gradient Canvas Background
      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#040711')
      bg.addColorStop(0.4, '#0A1226')
      bg.addColorStop(0.8, '#060B18')
      bg.addColorStop(1, '#03050C')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // 2. Multi-point Aurora Radial Glow
      const glow1X = width * 0.2
      const glow1Y = height * 0.3
      const g1 = ctx.createRadialGradient(glow1X, glow1Y, 20, glow1X, glow1Y, width * 0.5)
      g1.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`)
      g1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, width, height)

      const glow2X = width * 0.8
      const glow2Y = height * 0.7
      const g2 = ctx.createRadialGradient(glow2X, glow2Y, 30, glow2X, glow2Y, width * 0.55)
      g2.addColorStop(0, 'rgba(56, 189, 248, 0.16)')
      g2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, width, height)

      // 3. Precision Metallic Dual Border
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`
      ctx.lineWidth = 4
      ctx.strokeRect(36, 36, width - 72, height - 72)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = 2
      ctx.strokeRect(52, 52, width - 104, height - 104)

      // Corner Ornaments
      const drawCorner = (x: number, y: number, dirX: number, dirY: number) => {
        ctx.strokeStyle = activeAccent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y + dirY * 40)
        ctx.lineTo(x, y)
        ctx.lineTo(x + dirX * 40, y)
        ctx.stroke()
      }
      drawCorner(64, 64, 1, 1)
      drawCorner(width - 64, 64, -1, 1)
      drawCorner(64, height - 64, 1, -1)
      drawCorner(width - 64, height - 64, -1, -1)

      ctx.textAlign = 'center'

      if (type === '16:9') {
        // ── 16:9 Landscape Banner (1920x1080) ──
        // Top Header
        ctx.fillStyle = activeAccent
        ctx.font = `800 24px ${brandFont}`
        ctx.fillText(`★ ${brandName.toUpperCase()} · OFFICIAL VERIFIED PARTNER ★`, width / 2, 170)

        // Main Title
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `900 68px ${brandFont}`
        ctx.fillText('TRADE CAPITAL UP TO $200,000', width / 2, 270)

        // Subtitle
        ctx.fillStyle = '#94A3B8'
        ctx.font = `600 26px ${brandFont}`
        ctx.fillText('Keep Up to 90% Profit Split · Raw Spreads from 0.0 Pips · Bi-Weekly Payouts', width / 2, 335)

        // 3 Feature Badges
        const badges = [
          '💰 90% PROFIT SPLIT',
          '⚡ RAW SPREADS (0.0 PIPS)',
          '🛡️ BI-WEEKLY PAYOUTS',
        ]
        const badgeW = 320
        const badgeGap = 30
        const totalBadgesW = badges.length * badgeW + (badges.length - 1) * badgeGap
        const badgeStartX = (width - totalBadgesW) / 2
        const badgeY = 400

        badges.forEach((bText, i) => {
          const bx = badgeStartX + i * (badgeW + badgeGap)
          ctx.fillStyle = 'rgba(14, 22, 43, 0.85)'
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
          ctx.lineWidth = 1.5
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath()
            ctx.roundRect(bx, badgeY, badgeW, 60, 14)
            ctx.fill()
            ctx.stroke()
          } else {
            ctx.fillRect(bx, badgeY, badgeW, 60)
            ctx.strokeRect(bx, badgeY, badgeW, 60)
          }

          ctx.fillStyle = '#E2E8F0'
          ctx.font = `700 18px ${brandFont}`
          ctx.fillText(bText, bx + badgeW / 2, badgeY + 38)
        })

        // Central Partner Coupon Card
        const cardW = 760
        const cardH = 200
        const cardX = (width - cardW) / 2
        const cardY = 530

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`
        ctx.strokeStyle = activeAccent
        ctx.lineWidth = 3
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(cardX, cardY, cardW, cardH, 24)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillRect(cardX, cardY, cardW, cardH)
          ctx.strokeRect(cardX, cardY, cardW, cardH)
        }

        ctx.fillStyle = activeAccent
        ctx.font = `800 22px ${brandFont}`
        ctx.fillText('⚡ EXCLUSIVE PARTNER COUPON AT CHECKOUT', width / 2, cardY + 50)

        ctx.fillStyle = '#FFFFFF'
        ctx.font = `900 62px ${brandFont}`
        ctx.fillText((affiliateCode || 'PARTNER').toUpperCase(), width / 2, cardY + 125)

        // 20% OFF Tag
        ctx.fillStyle = '#F59E0B'
        ctx.font = `800 22px ${brandFont}`
        ctx.fillText('★ GET 20% DISCOUNT ON ALL EVALUATION SIZES ★', width / 2, cardY + 172)

        // Bottom Website Link & Authority Seal
        ctx.fillStyle = '#64748B'
        ctx.font = `600 24px ${brandFont}`
        ctx.fillText(partnerLink.replace(/^https?:\/\//, ''), width / 2, 880)

        ctx.fillStyle = '#475569'
        ctx.font = `500 18px ${brandFont}`
        ctx.fillText('Instant Evaluation Setup · Zero Minimum Trading Days · Tier-1 Liquidity', width / 2, 930)

      } else if (type === '1:1') {
        // ── 1:1 Square Feed Post (1080x1080) ──
        // Header
        ctx.fillStyle = activeAccent
        ctx.font = `800 22px ${brandFont}`
        ctx.fillText(`★ ${brandName.toUpperCase()} · OFFICIAL PARTNER ★`, width / 2, 160)

        // Title
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `900 52px ${brandFont}`
        ctx.fillText('TRADE UP TO $200,000', width / 2, 245)

        ctx.fillStyle = '#94A3B8'
        ctx.font = `600 22px ${brandFont}`
        ctx.fillText('Keep 90% Profit Split · Raw Spreads · Instant Payouts', width / 2, 300)

        // Feature Pill
        const pillW = 480
        const pillH = 48
        const pillX = (width - pillW) / 2
        const pillY = 345
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'
        ctx.strokeStyle = activeAccent
        ctx.lineWidth = 1.5
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(pillX, pillY, pillW, pillH, 24)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillRect(pillX, pillY, pillW, pillH)
          ctx.strokeRect(pillX, pillY, pillW, pillH)
        }
        ctx.fillStyle = '#34D399'
        ctx.font = `800 17px ${brandFont}`
        ctx.fillText('✦ VERIFIED EVALUATION CAPITAL ✦', width / 2, pillY + 31)

        // Coupon Box
        const cBoxW = 620
        const cBoxH = 250
        const cBoxX = (width - cBoxW) / 2
        const cBoxY = 445

        ctx.fillStyle = 'rgba(14, 22, 43, 0.9)'
        ctx.strokeStyle = activeAccent
        ctx.lineWidth = 3
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(cBoxX, cBoxY, cBoxW, cBoxH, 24)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillRect(cBoxX, cBoxY, cBoxW, cBoxH)
          ctx.strokeRect(cBoxX, cBoxY, cBoxW, cBoxH)
        }

        ctx.fillStyle = activeAccent
        ctx.font = `800 20px ${brandFont}`
        ctx.fillText('USE PARTNER DISCOUNT CODE:', width / 2, cBoxY + 55)

        ctx.fillStyle = '#FFFFFF'
        ctx.font = `900 64px ${brandFont}`
        ctx.fillText((affiliateCode || 'PARTNER').toUpperCase(), width / 2, cBoxY + 140)

        ctx.fillStyle = '#F59E0B'
        ctx.font = `800 22px ${brandFont}`
        ctx.fillText('★ 20% DISCOUNT AT CHECKOUT ★', width / 2, cBoxY + 205)

        // Footer Link
        ctx.fillStyle = '#38BDF8'
        ctx.font = `700 24px ${brandFont}`
        ctx.fillText(partnerLink.replace(/^https?:\/\//, ''), width / 2, 790)

        ctx.fillStyle = '#64748B'
        ctx.font = `500 18px ${brandFont}`
        ctx.fillText('Tap the link in bio to get funded today!', width / 2, 835)

      } else {
        // ── 9:16 Mobile Story & Reel (1080x1920) ──
        // Top Header
        ctx.fillStyle = activeAccent
        ctx.font = `800 28px ${brandFont}`
        ctx.fillText(`★ ${brandName.toUpperCase()} · OFFICIAL PARTNER ★`, width / 2, 280)

        // Story Badge
        const sBadgeW = 380
        const sBadgeH = 50
        const sBadgeX = (width - sBadgeW) / 2
        const sBadgeY = 330
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'
        ctx.strokeStyle = activeAccent
        ctx.lineWidth = 2
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(sBadgeX, sBadgeY, sBadgeW, sBadgeH, 25)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillRect(sBadgeX, sBadgeY, sBadgeW, sBadgeH)
          ctx.strokeRect(sBadgeX, sBadgeY, sBadgeW, sBadgeH)
        }
        ctx.fillStyle = '#34D399'
        ctx.font = `800 20px ${brandFont}`
        ctx.fillText('✦ 100% FUNDED TRADING ✦', width / 2, sBadgeY + 33)

        // Main Story Hook
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `900 64px ${brandFont}`
        ctx.fillText('TRADE UP TO', width / 2, 480)
        ctx.fillStyle = activeAccent
        ctx.font = `900 84px ${brandFont}`
        ctx.fillText('$200,000', width / 2, 575)

        ctx.fillStyle = '#94A3B8'
        ctx.font = `600 28px ${brandFont}`
        ctx.fillText('Scale your trading career with institutional capital', width / 2, 650)

        // 4 Bullet Feature Cards
        const bulletItems = [
          '✔ Keep Up to 90% of All Profits',
          '✔ Raw Spreads from 0.0 Pips on MT5',
          '✔ Fast Bi-Weekly Crypto & Bank Payouts',
          '✔ Zero Minimum Evaluation Trading Days',
        ]
        const cardStartY = 730
        const cardItemH = 75
        const cardItemGap = 20
        const cardItemW = 760
        const cardItemX = (width - cardItemW) / 2

        bulletItems.forEach((text, i) => {
          const cy = cardStartY + i * (cardItemH + cardItemGap)
          ctx.fillStyle = 'rgba(14, 22, 43, 0.9)'
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'
          ctx.lineWidth = 1.5
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath()
            ctx.roundRect(cardItemX, cy, cardItemW, cardItemH, 16)
            ctx.fill()
            ctx.stroke()
          } else {
            ctx.fillRect(cardItemX, cy, cardItemW, cardItemH)
            ctx.strokeRect(cardItemX, cy, cardItemW, cardItemH)
          }

          ctx.fillStyle = '#F8FAFC'
          ctx.font = `700 24px ${brandFont}`
          ctx.fillText(text, width / 2, cy + 47)
        })

        // Referral Code Card
        const sBoxW = 760
        const sBoxH = 260
        const sBoxX = (width - sBoxW) / 2
        const sBoxY = 1170

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`
        ctx.strokeStyle = activeAccent
        ctx.lineWidth = 3
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(sBoxX, sBoxY, sBoxW, sBoxH, 24)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillRect(sBoxX, sBoxY, sBoxW, sBoxH)
          ctx.strokeRect(sBoxX, sBoxY, sBoxW, sBoxH)
        }

        ctx.fillStyle = activeAccent
        ctx.font = `800 24px ${brandFont}`
        ctx.fillText('⚡ USE PARTNER CODE AT CHECKOUT', width / 2, sBoxY + 58)

        ctx.fillStyle = '#FFFFFF'
        ctx.font = `900 72px ${brandFont}`
        ctx.fillText((affiliateCode || 'PARTNER').toUpperCase(), width / 2, sBoxY + 150)

        ctx.fillStyle = '#F59E0B'
        ctx.font = `800 26px ${brandFont}`
        ctx.fillText('★ GET 20% OFF YOUR EVALUATION ★', width / 2, sBoxY + 215)

        // Bottom CTA
        ctx.fillStyle = '#38BDF8'
        ctx.font = `800 32px ${brandFont}`
        ctx.fillText('👆 LINK IN BIO / STORY LINK 👆', width / 2, 1620)

        ctx.fillStyle = '#64748B'
        ctx.font = `600 24px ${brandFont}`
        ctx.fillText(partnerLink.replace(/^https?:\/\//, ''), width / 2, 1680)
      }

      // Download Trigger adhering to Rule 93
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${brandName.toLowerCase()}-banner-${type.replace(':', 'x')}-${affiliateCode}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      toast.success(`Banner (${type}) downloaded in 4K Ultra-HD!`)
    } catch {
      toast.error('Failed to generate banner image')
    } finally {
      setDownloadingType(null)
    }
  }

  // ── 4 Ready-to-Post High-Converting Promotional Captions ──
  const promoCaptions = [
    {
      platform: 'Twitter / X',
      title: 'High-Converting Viral Hook',
      desc: 'Optimized for Twitter/X with strong CTR, partner discount code, and prop trading hashtags.',
      icon: MessageSquare,
      badgeTone: 'info' as const,
      text: `🚀 Looking to trade up to $200,000 in funded capital with an 85-90% profit split? I just partnered with ${brandName}!

Use my exclusive partner code "${affiliateCode}" for 20% OFF your evaluation at checkout:
👉 ${partnerLink}

#PropFirm #ForexTrader #FundedTrader #CryptoTrading #TradeFunded`,
    },
    {
      platform: 'Instagram & TikTok',
      title: 'Reels, Stories & Bio Caption',
      desc: 'Short, high-energy caption tailored for Instagram bio, story stickers, and TikTok descriptions.',
      icon: Flame,
      badgeTone: 'accent' as const,
      text: `🔥 Trade institutional capital up to $200,000 with ${brandName}.
💎 Lowest raw spreads, zero hidden time limits & fast bi-weekly payouts.

⚡ Tap the link in my bio or use discount code "${affiliateCode}" for 20% OFF at checkout!
👉 ${partnerLink}`,
    },
    {
      platform: 'Telegram & Discord',
      title: 'Community Alpha Callout',
      desc: 'Structured breakdown tailored for trading community channels, alpha calls, and Discord announcements.',
      icon: SendIcon,
      badgeTone: 'success' as const,
      text: `🚨 **Partner Alpha Alert**

Trade with **${brandName}** and unlock up to **$200,000** in funded capital:
• 90% Profit Split on all simulated accounts
• Raw spreads from 0.0 pips via MT5
• Bi-weekly crypto & bank profit disbarments
• 0 minimum trading days

🎟️ **Partner Discount Code:** \`${affiliateCode}\` (20% OFF)
🔗 **Join & Claim Discount:** ${partnerLink}`,
    },
    {
      platform: 'YouTube',
      title: 'Video Description & Pinned Comment',
      desc: 'Comprehensive template designed for YouTube video descriptions with clear affiliate call to action.',
      icon: Layers,
      badgeTone: 'warn' as const,
      text: `🏆 GET FUNDED WITH ${brandName.toUpperCase()} (Up to $200K Capital):
👉 Sign Up: ${partnerLink}
🎟️ Use Coupon Code "${affiliateCode}" for 20% OFF any challenge!

Key Highlights:
- Up to 90% Profit Split
- Raw spreads and institutional MT5 execution
- Bi-weekly profit disbursals
- No minimum trading day requirements

Disclaimer: Trading involves risk. Only risk capital you can afford to lose.`,
    },
  ]

  return (
    <Card className="w-full border-border shadow-sm bg-surface">
      <CardHeader className="pb-4 border-b border-border-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  Official Marketing Media Kit &amp; Creator Assets
                  <Badge tone="accent" size="sm" className="font-semibold text-2xs">
                    4K Ultra-HD
                  </Badge>
                </CardTitle>
                <p className="text-xs text-text-muted mt-0.5">
                  High-converting promotional banners, social graphics, and copy templates dynamically embedded with your code.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Partner Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-surface-muted border border-border rounded-lg px-2.5 py-1">
              <span className="text-2xs text-text-muted font-medium mr-1.5">CODE:</span>
              <span className="text-xs font-bold text-accent font-mono tracking-wider">{affiliateCode}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="h-6 w-6 p-0 ml-1.5 text-text-muted hover:text-text"
                title="Copy Code"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 text-xs h-8 font-semibold shadow-sm"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLink ? 'Copied Link' : 'Copy Partner Link'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 pt-6">

        {/* ── Studio Tab Selector ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-muted/60 p-2 rounded-xl border border-border-subtle">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedFormat('16:9')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0',
                selectedFormat === '16:9'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text hover:bg-surface/50'
              )}
            >
              <Monitor className="h-4 w-4 text-accent" />
              16:9 Landscape Banner
              <span className="text-3xs px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono font-bold">1920×1080</span>
            </button>

            <button
              onClick={() => setSelectedFormat('1:1')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0',
                selectedFormat === '1:1'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text hover:bg-surface/50'
              )}
            >
              <Layers className="h-4 w-4 text-info" />
              1:1 Square Feed Post
              <span className="text-3xs px-1.5 py-0.5 rounded bg-info/15 text-info font-mono font-bold">1080×1080</span>
            </button>

            <button
              onClick={() => setSelectedFormat('9:16')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0',
                selectedFormat === '9:16'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text hover:bg-surface/50'
              )}
            >
              <Smartphone className="h-4 w-4 text-warn" />
              9:16 Story &amp; Reel
              <span className="text-3xs px-1.5 py-0.5 rounded bg-warn/15 text-warn font-mono font-bold">1080×1920</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateAndDownloadBanner(selectedFormat)}
              loading={downloadingType === selectedFormat}
              className="gap-1.5 text-xs h-8 border-accent/40 hover:border-accent text-text"
            >
              <Download className="h-3.5 w-3.5 text-accent" />
              Download {selectedFormat} (4K PNG)
            </Button>
          </div>
        </div>

        {/* ── Active Studio Preview Stage (Enclosed in dark theme container for 100% Daylight contrast immunity) ── */}
        <div className="dark relative rounded-2xl border border-border bg-[#050811] p-4 sm:p-8 flex flex-col items-center justify-center min-h-[380px] shadow-xl overflow-hidden select-none" data-theme="midnight-obsidian">
          {/* Subtle Ambient Background Wash */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          {selectedFormat === '16:9' && (
            <div className="w-full max-w-3xl aspect-[16/9] rounded-xl bg-gradient-to-br from-[#040711] via-[#0A1226] to-[#060B18] border-2 border-emerald-500/40 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden text-center">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-400 tracking-wider">
                  ★ {brandName.toUpperCase()} · OFFICIAL PARTNER
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-2xs font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/40">
                  90% PROFIT SPLIT
                </span>
              </div>

              <div className="my-auto py-2">
                <div className="text-xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                  TRADE CAPITAL UP TO $200,000
                </div>
                <div className="text-2xs sm:text-xs text-slate-300 font-medium mt-1">
                  Keep Up to 90% Profit Split · Raw Spreads from 0.0 Pips · Bi-Weekly Payouts
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                  <span className="bg-[#0E162B] border border-sky-500/30 text-slate-200 text-2xs font-bold px-3 py-1 rounded-md">
                    💰 90% Profit Split
                  </span>
                  <span className="bg-[#0E162B] border border-sky-500/30 text-slate-200 text-2xs font-bold px-3 py-1 rounded-md">
                    ⚡ Raw Spreads from 0.0
                  </span>
                  <span className="bg-[#0E162B] border border-sky-500/30 text-slate-200 text-2xs font-bold px-3 py-1 rounded-md">
                    🛡️ Bi-Weekly Payouts
                  </span>
                </div>
              </div>

              {/* Coupon Pill */}
              <div className="bg-emerald-500/15 border border-emerald-500/50 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-2xs text-emerald-400 font-bold">⚡ CHECKOUT CODE:</span>
                <span className="text-sm sm:text-base font-black text-white font-mono tracking-widest">{affiliateCode}</span>
                <span className="text-2xs text-amber-400 font-extrabold bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded">
                  ★ 20% DISCOUNT
                </span>
              </div>
            </div>
          )}

          {selectedFormat === '1:1' && (
            <div className="w-full max-w-md aspect-square rounded-xl bg-gradient-to-tr from-[#040711] via-[#09152C] to-[#060D1E] border-2 border-sky-500/40 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden text-center">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-sky-400 tracking-wider">
                  ★ {brandName.toUpperCase()}
                </span>
                <span className="bg-sky-500/20 text-sky-300 text-2xs font-bold px-2.5 py-1 rounded-full border border-sky-500/40">
                  INSTANT PASS
                </span>
              </div>

              <div className="my-auto py-2">
                <div className="text-2xs font-bold text-slate-400 uppercase tracking-widest">PROPRIETARY TRADING</div>
                <div className="text-2xl font-black text-white tracking-tight mt-1">
                  GET FUNDED UP TO $200K
                </div>
                <div className="text-xs text-emerald-400 font-extrabold mt-1">
                  KEEP 90% PROFITS · RAW SPREADS
                </div>
              </div>

              <div className="bg-[#0E162B] border border-sky-500/50 rounded-xl p-3.5 space-y-1">
                <div className="text-3xs text-sky-400 font-bold tracking-wider">PARTNER DISCOUNT CODE:</div>
                <div className="text-xl font-black text-white font-mono tracking-widest">{affiliateCode}</div>
                <div className="text-2xs text-amber-400 font-bold">★ 20% OFF AT CHECKOUT ★</div>
              </div>

              <div className="text-3xs text-slate-400 font-medium">
                Tap link in bio to start trading institutional balance
              </div>
            </div>
          )}

          {selectedFormat === '9:16' && (
            <div className="w-full max-w-[280px] aspect-[9/16] rounded-2xl bg-gradient-to-b from-[#040711] via-[#120B24] to-[#080514] border-2 border-purple-500/40 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden text-center">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-extrabold text-purple-300 tracking-wider">
                  ★ {brandName.toUpperCase()}
                </span>
                <span className="bg-purple-500/25 text-purple-300 text-3xs font-bold px-2 py-0.5 rounded-full border border-purple-500/40">
                  FUNDED
                </span>
              </div>

              <div className="my-auto py-2 space-y-2">
                <div className="text-3xs font-bold text-slate-400 tracking-widest uppercase">PROP CAPITAL</div>
                <div className="text-base font-black text-white tracking-tight leading-tight">
                  TRADE CAPITAL UP TO
                  <span className="block text-xl text-emerald-400 mt-0.5">$200,000</span>
                </div>

                <div className="space-y-1 pt-1 text-left text-3xs text-slate-200">
                  <div className="bg-surface-muted/10 border border-slate-700/50 rounded px-2 py-1">✔ 90% Profit Split</div>
                  <div className="bg-surface-muted/10 border border-slate-700/50 rounded px-2 py-1">✔ Raw Spreads on MT5</div>
                  <div className="bg-surface-muted/10 border border-slate-700/50 rounded px-2 py-1">✔ Bi-Weekly Disbursals</div>
                </div>
              </div>

              <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-2.5">
                <div className="text-3xs text-purple-300 font-bold">PARTNER CODE:</div>
                <div className="text-sm font-black text-white font-mono tracking-widest">{affiliateCode}</div>
                <div className="text-3xs text-amber-400 font-bold">20% DISCOUNT</div>
              </div>

              <div className="text-3xs text-sky-400 font-bold tracking-wider">
                👆 TAP STORY LINK 👆
              </div>
            </div>
          )}
        </div>

        {/* ── 3 Banner Formats Cards Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">

          {/* 1. 16:9 Landscape Card */}
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between space-y-4 hover:border-accent/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="h-48 sm:h-52 bg-[#030610] rounded-xl border border-white/5 flex items-center justify-center p-3 overflow-hidden relative select-none">
                <div className="dark w-full aspect-[16/9] rounded-lg bg-gradient-to-br from-[#040711] via-[#0A1226] to-[#060B18] border border-emerald-500/40 p-3 flex flex-col justify-between shadow-md select-none text-center" data-theme="midnight-obsidian">
                  <div className="flex items-center justify-between text-3xs font-bold text-emerald-400">
                    <span>★ {brandName.toUpperCase()}</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-3xs px-1.5 py-0.5 rounded border border-emerald-500/40">90% SPLIT</span>
                  </div>
                  <div className="my-auto py-1">
                    <div className="text-xs sm:text-sm font-black text-white">$200,000 CAPITAL</div>
                    <div className="text-3xs text-slate-300">Raw Spreads · Fast Payouts</div>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-500/40 rounded px-2 py-0.5 flex items-center justify-between text-3xs">
                    <span className="text-emerald-400 font-bold">CODE:</span>
                    <span className="text-white font-bold font-mono">{affiliateCode}</span>
                    <span className="text-amber-400 font-bold">20% OFF</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text">16:9 Landscape Banner</h4>
                  <span className="text-2xs font-mono font-semibold text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                    1920 × 1080
                  </span>
                </div>
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                  Ideal for Twitter/X cards, YouTube video headers, and blog promotions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 gap-1.5"
                onClick={() => generateAndDownloadBanner('16:9')}
                loading={downloadingType === '16:9'}
              >
                <Download className="h-3.5 w-3.5 text-accent" /> Download 4K PNG
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={handleCopyLink}
                title="Copy Partner Link"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 2. 1:1 Square Feed Card */}
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between space-y-4 hover:border-info/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="h-48 sm:h-52 bg-[#030610] rounded-xl border border-white/5 flex items-center justify-center p-3 overflow-hidden relative select-none">
                <div className="dark h-full aspect-square rounded-lg bg-gradient-to-tr from-[#040711] via-[#09152C] to-[#060D1E] border border-sky-500/40 p-3 flex flex-col justify-between shadow-md select-none text-center" data-theme="midnight-obsidian">
                  <div className="flex items-center justify-between text-3xs font-bold text-sky-400">
                    <span>★ {brandName.toUpperCase()}</span>
                    <span className="bg-sky-500/20 text-sky-300 text-3xs px-1.5 py-0.5 rounded border border-sky-500/30">1:1</span>
                  </div>
                  <div className="my-auto py-1">
                    <div className="text-3xs uppercase tracking-wider text-slate-400 font-bold">PROP CAPITAL</div>
                    <div className="text-xs font-black text-white leading-tight mt-0.5">GET FUNDED $200K</div>
                    <div className="text-3xs text-emerald-400 font-extrabold mt-0.5">KEEP 90% PROFITS</div>
                  </div>
                  <div className="bg-sky-500/15 border border-sky-500/40 rounded px-2 py-1 text-3xs">
                    <div className="text-sky-300 font-bold">CODE: <span className="text-white font-mono">{affiliateCode}</span></div>
                    <div className="text-amber-400 font-bold">20% DISCOUNT</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text">1:1 Square Feed Post</h4>
                  <span className="text-2xs font-mono font-semibold text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                    1080 × 1080
                  </span>
                </div>
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                  Tailored for Instagram feed posts, Discord community channels, and Telegram.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 gap-1.5"
                onClick={() => generateAndDownloadBanner('1:1')}
                loading={downloadingType === '1:1'}
              >
                <Download className="h-3.5 w-3.5 text-info" /> Download 4K PNG
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={handleCopyLink}
                title="Copy Partner Link"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 3. 9:16 Vertical Story Card */}
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="h-48 sm:h-52 bg-[#030610] rounded-xl border border-white/5 flex items-center justify-center p-3 overflow-hidden relative select-none">
                <div className="dark h-full aspect-[9/16] rounded-lg bg-gradient-to-b from-[#040711] via-[#120B24] to-[#080514] border border-purple-500/40 p-2 flex flex-col justify-between shadow-md select-none text-center" data-theme="midnight-obsidian">
                  <div className="flex items-center justify-between text-3xs font-bold text-purple-300">
                    <span className="truncate">★ {brandName}</span>
                    <span className="bg-purple-500/25 text-purple-300 text-3xs px-1 py-0.2 rounded border border-purple-500/40">VIP</span>
                  </div>
                  <div className="my-auto py-0.5">
                    <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">SCALE UP</div>
                    <div className="text-[11px] font-black text-white leading-tight">$200,000</div>
                    <div className="text-[8px] text-emerald-400 font-bold">90% Split</div>
                  </div>
                  <div className="bg-purple-500/20 border border-purple-500/40 rounded p-1 text-[8px]">
                    <div className="text-purple-300 font-bold font-mono">{affiliateCode}</div>
                    <div className="text-amber-400 font-bold">20% OFF</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text">9:16 Mobile Story &amp; Reel</h4>
                  <span className="text-2xs font-mono font-semibold text-text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                    1080 × 1920
                  </span>
                </div>
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                  Crafted for TikTok, Instagram Stories, YouTube Shorts, and WhatsApp Status.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 gap-1.5"
                onClick={() => generateAndDownloadBanner('9:16')}
                loading={downloadingType === '9:16'}
              >
                <Download className="h-3.5 w-3.5 text-purple-400" /> Download 4K PNG
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={handleCopyLink}
                title="Copy Partner Link"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

        </div>

        {/* ── Ready-to-Post Promotional Captions ── */}
        <div className="space-y-4 pt-6 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-bold text-text">Ready-to-Post Promotional Captions</h3>
            </div>
            <span className="text-2xs text-text-muted font-medium">1-Click Copy with dynamic link &amp; promo code</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promoCaptions.map((c, i) => {
              const IconComp = c.icon
              return (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface-muted/40 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComp className="h-4 w-4 text-accent" />
                        <span className="text-xs font-bold text-text">{c.title}</span>
                      </div>
                      <Badge tone={c.badgeTone} size="sm" className="text-3xs font-bold">
                        {c.platform}
                      </Badge>
                    </div>

                    <div className="text-2xs text-text-muted">{c.desc}</div>

                    <pre className="mt-2 text-2xs p-3.5 rounded-lg bg-surface border border-border text-text font-mono whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                      {c.text}
                    </pre>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 gap-1.5"
                    onClick={() => {
                      copyToClipboard(c.text, `${c.platform} caption copied!`)
                      setCopiedCaptionIndex(i)
                      setTimeout(() => setCopiedCaptionIndex(null), 2000)
                    }}
                  >
                    {copiedCaptionIndex === i ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-profit" /> Copied Caption!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy {c.platform} Caption
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>

      </CardContent>
    </Card>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
