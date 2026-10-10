'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Download, Copy, Check, Share2, Layers,
  ExternalLink, MessageSquare, Flame, ShieldCheck, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBranding } from '@/store/branding'
import { FONT_PRESETS, hexToRgb } from '@/lib/theme-accent'

interface MarketingMediaKitProps {
  affiliateCode?: string
  partnerLink?: string
}

export function MarketingMediaKit({
  affiliateCode = 'PARTNER',
  partnerLink = 'https://demo.launchapropfirm.com',
}: MarketingMediaKitProps) {
  const storeBrand = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const brandName = storeBrand
  const [downloadingType, setDownloadingType] = useState<string | null>(null)
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState<number | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const copyToClipboard = (text: string, msg: string = 'Copied to clipboard!') => {
    try {
      navigator.clipboard.writeText(text)
      toast.success(msg)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleCopyLink = () => {
    copyToClipboard(partnerLink, 'Partner link copied!')
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const generateAndDownloadBanner = (type: '16:9' | '1:1' | '9:16') => {
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
      const brandFont = `"${activePreset.name}", system-ui, -apple-system, Roboto, sans-serif`

      const activeAccent = localStorage.getItem('fxsim:theme-accent') || '#10B981'
      const { r, g, b } = hexToRgb(activeAccent)

      // Background Luxury Gradient
      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#050811')
      bg.addColorStop(0.5, '#091024')
      bg.addColorStop(1, '#060B18')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // Radial Glow
      const glowY = type === '9:16' ? height * 0.42 : height * 0.48
      const glow = ctx.createRadialGradient(width / 2, glowY, 40, width / 2, glowY, width * 0.65)
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.28)`)
      glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)')
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      // Outer & Inner Borders
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`
      ctx.lineWidth = 4
      ctx.strokeRect(36, 36, width - 72, height - 72)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 2
      ctx.strokeRect(50, 50, width - 100, height - 100)

      ctx.textAlign = 'center'

      // Top Firm Tagline
      const topY = type === '9:16' ? 300 : type === '16:9' ? 210 : 230
      ctx.fillStyle = activeAccent
      ctx.font = `bold ${type === '9:16' ? '38px' : '32px'} ${brandFont}`
      ctx.fillText(`★ ${brandName.toUpperCase()} · OFFICIAL PARTNER ★`, width / 2, topY)

      // Main Hook
      const hookY = type === '9:16' ? 490 : type === '16:9' ? 340 : 380
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `900 ${type === '9:16' ? '72px' : '62px'} ${brandFont}`
      ctx.fillText('TRADE CAPITAL UP TO $200,000', width / 2, hookY)

      // Subtitle
      const subY = type === '9:16' ? 610 : type === '16:9' ? 425 : 475
      ctx.fillStyle = '#94A3B8'
      ctx.font = `500 ${type === '9:16' ? '34px' : '28px'} ${brandFont}`
      ctx.fillText('Keep up to 90% Profit Split · Instant Disbursals · Raw Spreads', width / 2, subY)

      // Referral Code Box
      const pillW = type === '9:16' ? 740 : 640
      const pillH = type === '9:16' ? 240 : 140
      const pillX = (width - pillW) / 2
      const pillY = type === '9:16' ? 780 : type === '16:9' ? 530 : 600

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`
      ctx.strokeStyle = activeAccent
      ctx.lineWidth = 3
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillW, pillH, 22)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillRect(pillX, pillY, pillW, pillH)
        ctx.strokeRect(pillX, pillY, pillW, pillH)
      }

      ctx.fillStyle = activeAccent
      ctx.font = `bold ${type === '9:16' ? '28px' : '22px'} ${brandFont}`
      ctx.fillText('⚡ USE PARTNER CODE AT CHECKOUT', width / 2, pillY + (type === '9:16' ? 70 : 45))

      ctx.fillStyle = '#FFFFFF'
      ctx.font = `900 ${type === '9:16' ? '68px' : '48px'} ${brandFont}`
      ctx.fillText((affiliateCode || 'PARTNER').toUpperCase(), width / 2, pillY + (type === '9:16' ? 150 : 100))

      if (type === '9:16') {
        ctx.fillStyle = '#38BDF8'
        ctx.font = `bold 26px ${brandFont}`
        ctx.fillText('GET 20% DISCOUNT ON ALL EVALUATIONS', width / 2, pillY + 205)
      }

      // Link Footer
      const footY = type === '9:16' ? 1680 : type === '16:9' ? 950 : 960
      ctx.fillStyle = '#64748B'
      ctx.font = `600 ${type === '9:16' ? '32px' : '24px'} ${brandFont}`
      ctx.fillText(partnerLink.replace(/^https?:\/\//, ''), width / 2, footY)

      // Download trigger
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${brandName.toLowerCase()}-banner-${type.replace(':', 'x')}-${affiliateCode}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success(`Banner (${type}) downloaded in Ultra-HD!`)
    } catch {
      toast.error('Failed to generate banner image')
    } finally {
      setDownloadingType(null)
    }
  }

  const promoCaptions = [
    {
      title: 'Twitter / X High-Converting Hook',
      desc: 'Optimized for high CTR with clear call to action and hashtag engagement.',
      text: `🚀 Looking to trade up to $200,000 in funded capital with an 85-90% profit split? I just partnered with ${brandName}!

Use my exclusive partner code "${affiliateCode}" for 20% off your evaluation at checkout:
👉 ${partnerLink}

#PropFirm #ForexTrader #FundedTrader #CryptoTrading`,
    },
    {
      title: 'Instagram & TikTok Caption / Bio',
      desc: 'Short, punchy, and direct for reels, stories, and link-in-bio traffic.',
      text: `🔥 Trade institutional capital up to $200,000 with ${brandName}.
💎 Lowest raw spreads, zero hidden time limits & bi-weekly crypto payouts.

⚡ Tap the link or use code "${affiliateCode}" for 20% OFF!
👉 ${partnerLink}`,
    },
    {
      title: 'Telegram & Discord Community Post',
      desc: 'Detailed breakdown tailored for trading group chats and alpha channels.',
      text: `🚨 Partner Alpha Alert:

Trade with ${brandName} and access up to $200K in trading balance with 90% profit payouts and raw spread execution!

🎟️ Partner Discount Code: ${affiliateCode} (20% OFF)
🔗 Join & Start Trading: ${partnerLink}`,
    },
  ]

  return (
    <Card className="w-full border-border/80 shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Official Marketing Media Kit & Creator Assets
            </CardTitle>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Ultra-HD promotional graphics, social media banners, and high-converting copy templates dynamically embedded with your referral code.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent" size="sm" className="font-mono">4K Ultra-HD</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 text-xs h-8"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLink ? 'Copied Link' : 'Copy Partner Link'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* ── 3 Banner Formats Grid (Clean layout, zero clunky overlapping) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* 1. 16:9 Landscape Banner */}
          <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-4 flex flex-col justify-between gap-4 group hover:border-accent/40 transition-colors">
            <div>
              {/* Crisp preview canvas mockup */}
              <div className="w-full aspect-[16/9] rounded-lg bg-gradient-to-br from-[#060811] via-[#0A1024] to-[#070C1A] border border-accent/40 p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden select-none">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-3xs font-extrabold text-accent tracking-wider">
                    ★ {brandName.toUpperCase()}
                  </span>
                  <span className="bg-accent/20 text-accent text-3xs font-bold px-2 py-0.5 rounded-full border border-accent/30">
                    90% PROFIT SPLIT
                  </span>
                </div>

                <div className="text-center my-auto py-1 relative z-10">
                  <div className="text-sm font-black text-white tracking-tight drop-shadow-sm">
                    TRADE UP TO $200,000
                  </div>
                  <div className="text-3xs text-slate-300 font-medium mt-0.5">
                    Instant Payouts · Lowest Spreads · Zero Time Limit
                  </div>
                </div>

                <div className="bg-accent/15 border border-accent/40 rounded-md px-2.5 py-1 flex items-center justify-between relative z-10">
                  <span className="text-3xs text-accent font-bold">CODE:</span>
                  <span className="text-2xs font-mono font-black text-white tracking-widest">{affiliateCode}</span>
                  <span className="text-3xs text-profit font-black bg-profit/20 px-1 py-0.5 rounded">20% OFF</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text">16:9 Landscape Banner</h4>
                  <span className="text-2xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                    1920 × 1080
                  </span>
                </div>
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                  Optimized for YouTube headers, Twitter/X cards, and blog articles.
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
                <Download className="h-3.5 w-3.5 text-accent" /> Download PNG
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

          {/* 2. 1:1 Square Feed Post */}
          <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-4 flex flex-col justify-between gap-4 group hover:border-info/40 transition-colors">
            <div>
              {/* Crisp preview canvas mockup */}
              <div className="w-full aspect-square max-h-56 mx-auto rounded-lg bg-gradient-to-tr from-[#060811] via-[#08152B] to-[#0A1A36] border border-info/40 p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden select-none">
                <div className="absolute bottom-0 left-0 w-28 h-28 bg-info/20 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <span className="text-3xs font-extrabold text-info tracking-wider">
                    ★ {brandName.toUpperCase()}
                  </span>
                  <span className="bg-info/20 text-info text-3xs font-bold px-2 py-0.5 rounded-full border border-info/30">
                    INSTANT PASS
                  </span>
                </div>

                <div className="text-center my-auto py-1 relative z-10">
                  <div className="text-3xs uppercase tracking-widest text-slate-300 font-bold">PROP CAPITAL</div>
                  <div className="text-base font-black text-white tracking-tight drop-shadow-sm mt-0.5">
                    KEEP 90% PROFITS
                  </div>
                  <div className="text-2xs font-mono font-black text-accent mt-0.5">$200K ACCOUNT</div>
                </div>

                <div className="bg-info/15 border border-info/40 rounded-md px-2.5 py-1 flex items-center justify-between relative z-10">
                  <span className="text-3xs text-info font-bold">CODE:</span>
                  <span className="text-2xs font-mono font-black text-white tracking-widest">{affiliateCode}</span>
                  <span className="text-3xs text-profit font-black bg-profit/20 px-1 py-0.5 rounded">20% OFF</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text">1:1 Square Feed Post</h4>
                  <span className="text-2xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                    1080 × 1080
                  </span>
                </div>
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                  Tailored for Instagram feed posts, Discord announcements, and Telegram groups.
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
                <Download className="h-3.5 w-3.5 text-info" /> Download PNG
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

          {/* 3. 9:16 Vertical Story & Reel */}
          <div className="rounded-xl border border-border-subtle bg-surface-muted/30 p-4 flex flex-col justify-between gap-4 group hover:border-purple-500/40 transition-colors">
            <div>
              {/* Crisp preview canvas mockup */}
              <div className="w-full aspect-[9/16] max-h-56 mx-auto rounded-lg bg-gradient-to-b from-[#060811] via-[#120B24] to-[#1C0F38] border border-purple-500/40 p-3 flex flex-col justify-between shadow-lg relative overflow-hidden select-none">
                <div className="absolute top-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <span className="text-3xs font-extrabold text-purple-300 tracking-wider">
                    ★ {brandName.toUpperCase()}
                  </span>
                  <span className="bg-purple-500/25 text-purple-300 text-3xs font-bold px-1.5 py-0.2 rounded-full border border-purple-500/40">
                    VIP
                  </span>
                </div>

                <div className="text-center my-auto py-1 relative z-10">
                  <div className="text-3xs uppercase tracking-widest text-slate-300 font-bold">EVALUATION PASS</div>
                  <div className="text-xs font-black text-white tracking-tight drop-shadow-sm mt-0.5">
                    GET FUNDED
                  </div>
                  <div className="text-sm font-mono font-black text-accent mt-0.5 leading-none">$200K</div>
                  <div className="text-3xs text-slate-300 mt-1">Keep 90% Profits</div>
                </div>

                <div className="bg-purple-500/20 border border-purple-500/40 rounded-md px-2 py-1 text-center relative z-10">
                  <div className="text-3xs text-purple-300 font-bold">PARTNER CODE:</div>
                  <div className="text-2xs font-mono font-black text-white tracking-widest">{affiliateCode}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text">9:16 Story &amp; Reel</h4>
                  <span className="text-2xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                    1080 × 1920
                  </span>
                </div>
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">
                  Perfect for Instagram Stories, TikTok, YouTube Shorts, and WhatsApp Status.
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
                <Download className="h-3.5 w-3.5 text-purple-400" /> Download PNG
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
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-bold text-text">Ready-to-Post Promotional Captions</h3>
            </div>
            <span className="text-2xs text-text-muted">1-Click Copy with dynamic link</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promoCaptions.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-border-subtle bg-surface-muted/20 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-text">{c.title}</div>
                  <div className="text-2xs text-text-muted">{c.desc}</div>
                  <pre className="mt-2 text-2xs p-3 rounded-lg bg-surface border border-border/60 text-text-secondary font-sans whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {c.text}
                  </pre>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 gap-1.5"
                  onClick={() => {
                    copyToClipboard(c.text, `${c.title} copied!`)
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
                      <Copy className="h-3.5 w-3.5" /> Copy Caption
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
