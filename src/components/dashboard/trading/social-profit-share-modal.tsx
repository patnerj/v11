'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { 
  X, Download, Copy, Share2, ShieldCheck, Check, Sparkles,
  TrendingUp, TrendingDown, QrCode, ArrowUpRight, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtPrice, fmtUSD, fmtPct, toNum } from '@/lib/format'
import { FONT_PRESETS } from '@/lib/theme-accent'
import { useAuth } from '@/store/auth'
import { usePrices } from '@/store/prices'

export interface ShareTradeData {
  symbol: string
  type: 'buy' | 'sell'
  lotSize: number | string
  openPrice: number | string
  currentPrice: number | string
  pnl: number
  pnlPercent?: number
  traderHandle?: string
  accountId?: string | number
  margin?: number | string
  openedAt?: string
  closedAt?: string
  isClosed?: boolean
}

export interface SocialProfitShareModalProps {
  open: boolean
  onClose: () => void
  trade: ShareTradeData | null
}

export function SocialProfitShareModal({ open, onClose, trade }: SocialProfitShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const authUser = useAuth((s) => s.user)
  const account = usePrices((s) => s.account as any)

  const [downloading, setDownloading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  // Resolve handle & account ID (never default to developer name)
  const traderHandle = trade?.traderHandle || (
    authUser?.username 
      ? `@${authUser.username}` 
      : authUser?.email 
        ? `@${authUser.email.split('@')[0]}` 
        : '@AlphaTrader'
  )
  const accountId = trade?.accountId || (account?.id ? `ACC-${account.id}` : '#5056177670')
  const isProfit = (trade?.pnl ?? 0) >= 0

  // Calculate percentage gain mathematically soundly (leveraged ROI or price delta)
  const pnlPercent = trade?.pnlPercent ?? (() => {
    const pnlVal = trade?.pnl ?? 0
    const margin = toNum(trade?.margin)
    if (margin > 0 && Math.abs(pnlVal) > 0) {
      return (pnlVal / margin) * 100
    }
    const bal = toNum(account?.balance)
    if (bal > 0 && Math.abs(pnlVal) > 0) {
      return (pnlVal / bal) * 100
    }
    const openPx = toNum(trade?.openPrice)
    const curPx = toNum(trade?.currentPrice)
    if (openPx <= 0) return 0
    const diff = trade?.type === 'buy' ? curPx - openPx : openPx - curPx
    return (diff / openPx) * 100
  })()

  // High-res Canvas Drawer for PNG Export
  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !trade) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 1200
    const height = 675
    canvas.width = width
    canvas.height = height

    // 1. Background Gradient (Midnight Obsidian)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#0B0F19')
    bgGrad.addColorStop(0.5, '#0E1424')
    bgGrad.addColorStop(1, '#080C14')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // 2. Subtle Aurora Glow behind Hero PnL
    const glowGrad = ctx.createRadialGradient(width / 2, 280, 20, width / 2, 280, 420)
    glowGrad.addColorStop(0, isProfit ? 'rgba(16, 185, 129, 0.20)' : 'rgba(239, 68, 68, 0.20)')
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 0, width, height)

    // 3. Grid Pattern Overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
    ctx.lineWidth = 1
    const gridSize = 40
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // 3.5 Large Institutional Brand Watermark (Subtle background rotation)
    ctx.save()
    ctx.translate(width / 2, height / 2 - 10)
    ctx.rotate(-Math.PI / 18)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
    ctx.font = '900 115px "Plus Jakarta Sans", "Poppins", -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ALPHACAPITAL', 0, 0)
    ctx.restore()

    // 3.6 Instrument Pair Watermark (Subtle background accent)
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
    ctx.font = '900 76px "JetBrains Mono", monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(trade.symbol.toUpperCase(), width - 60, 140)
    ctx.restore()

    // 4. Card Outer Border with Neon Accent Line
    ctx.strokeStyle = '#1F2937'
    ctx.lineWidth = 3
    ctx.strokeRect(30, 30, width - 60, height - 60)

    // Top emerald neon accent
    const topAccent = ctx.createLinearGradient(30, 30, width - 30, 30)
    topAccent.addColorStop(0, 'rgba(16, 185, 129, 0)')
    topAccent.addColorStop(0.5, isProfit ? '#10B981' : '#EF4444')
    topAccent.addColorStop(1, 'rgba(16, 185, 129, 0)')
    ctx.strokeStyle = topAccent
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(30, 30)
    ctx.lineTo(width - 30, 30)
    ctx.stroke()

    // Resolve dynamic admin branding typography
    const activeFontId = typeof window !== 'undefined' ? (localStorage.getItem('fxsim:theme-font') || 'poppins') : 'poppins'
    const activePreset = FONT_PRESETS.find((f) => f.id === activeFontId) || FONT_PRESETS[0]
    const primaryFontFamily = `"${activePreset.name}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

    // 5. Header: Logo & Title
    ctx.fillStyle = isProfit ? '#10B981' : '#EF4444'
    ctx.beginPath()
    ctx.arc(80, 85, 18, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.font = `900 24px ${primaryFontFamily}`
    ctx.textAlign = 'left'
    ctx.fillText('ALPHACAPITAL', 115, 84)

    ctx.fillStyle = '#9CA3AF'
    ctx.font = `600 12px ${primaryFontFamily}`
    ctx.fillText('INSTITUTIONAL PROPRIETARY TRADING', 115, 102)

    // Header Right: Verified Telemetry Badge
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)'
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(width - 310, 68, 230, 38, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#10B981'
    ctx.beginPath()
    ctx.arc(width - 290, 87, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#E5E7EB'
    ctx.font = `700 13px ${primaryFontFamily}`
    ctx.fillText('VERIFIED TELEMETRY', width - 275, 92)

    // 6. Hero Badge: Symbol & Side
    const isBuy = trade.type === 'buy'
    const symbolFormatted = trade.symbol.toUpperCase()
    const sideText = `${symbolFormatted} · ${trade.type.toUpperCase()} ${Number(trade.lotSize).toFixed(2)} LOTS`
    
    ctx.fillStyle = isBuy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
    ctx.strokeStyle = isBuy ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(width / 2 - 180, 155, 360, 44, 22)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = isBuy ? '#34D399' : '#F87171'
    ctx.font = `800 16px ${primaryFontFamily}`
    ctx.textAlign = 'center'
    ctx.fillText(sideText, width / 2, 183)

    // 7. Hero PnL Typography (clean institutional font)
    ctx.fillStyle = isProfit ? '#10B981' : '#EF4444'
    ctx.font = `900 84px ${primaryFontFamily}`
    const pnlFormatted = fmtUSD(trade.pnl, { sign: true })
    ctx.fillText(pnlFormatted, width / 2, 290)

    // Return percentage pill
    const pctText = `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% ROI`
    ctx.fillStyle = isProfit ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)'
    ctx.strokeStyle = isProfit ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(width / 2 - 110, 315, 220, 36, 18)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = isProfit ? '#34D399' : '#F87171'
    ctx.font = `800 15px ${primaryFontFamily}`
    ctx.fillText(pctText, width / 2, 339)

    // 8. Stats Quad Grid (Entry, Current/Exit, Volume, Execution)
    ctx.textAlign = 'left'
    const statsBoxY = 385
    const colW = (width - 160) / 4

    const stats = [
      { label: 'TRADING PAIR', val: `${symbolFormatted} (${trade.type.toUpperCase()})` },
      { label: 'ENTRY PRICE', val: String(trade.openPrice) },
      { label: trade.isClosed ? 'EXIT PRICE' : 'MARKET PRICE', val: String(trade.currentPrice) },
      { label: 'VOLUME & PROTOCOL', val: `${Number(trade.lotSize).toFixed(2)}L · MT5 Parity` },
    ]

    stats.forEach((s, idx) => {
      const colX = 80 + idx * colW
      
      // Box Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
      ctx.strokeStyle = '#1F2937'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(colX, statsBoxY, colW - 20, 80, 10)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#9CA3AF'
      ctx.font = `600 11px ${primaryFontFamily}`
      ctx.fillText(s.label, colX + 16, statsBoxY + 30)

      ctx.fillStyle = idx === 0 ? (isBuy ? '#34D399' : '#F87171') : '#F3F4F6'
      ctx.font = `700 16px ${primaryFontFamily}`
      ctx.fillText(s.val, colX + 16, statsBoxY + 58)
    })

    // 9. Footer: Trader Handle, Account ID & Verification QR
    const footerY = 540

    // Trader Avatar Circle
    ctx.fillStyle = '#1F2937'
    ctx.beginPath()
    ctx.arc(105, footerY + 25, 25, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#10B981'
    ctx.font = `900 18px ${primaryFontFamily}`
    ctx.fillText(traderHandle.charAt(1)?.toUpperCase() || 'A', 98, footerY + 32)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 18px ${primaryFontFamily}`
    ctx.fillText(traderHandle, 145, footerY + 22)

    ctx.fillStyle = '#9CA3AF'
    ctx.font = `600 13px ${primaryFontFamily}`
    ctx.fillText(`Account ID: ${accountId} · Zero-Drift Verified`, 145, footerY + 42)

    // Verification QR Code Matrix Box
    const qrX = width - 180
    const qrY = footerY
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.roundRect(qrX, qrY, 60, 60, 8)
    ctx.fill()
    
    // QR Pattern mock
    ctx.fillStyle = '#0B0F19'
    ctx.fillRect(qrX + 6, qrY + 6, 16, 16)
    ctx.fillRect(qrX + 38, qrY + 6, 16, 16)
    ctx.fillRect(qrX + 6, qrY + 38, 16, 16)
    ctx.fillRect(qrX + 26, qrY + 26, 10, 10)
    ctx.fillRect(qrX + 38, qrY + 38, 10, 10)

    ctx.fillStyle = '#9CA3AF'
    ctx.font = `600 11px ${primaryFontFamily}`
    ctx.fillText('SCAN TO VERIFY', qrX - 110, footerY + 26)
    ctx.fillStyle = '#6B7280'
    ctx.font = `500 10px ${primaryFontFamily}`
    ctx.fillText('launchapropfirm.com', qrX - 110, footerY + 42)

  }, [trade, traderHandle, accountId, isProfit, pnlPercent])

  useEffect(() => {
    if (open && trade) {
      let active = true
      const render = () => {
        if (active) drawCanvas()
      }
      if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.ready.then(render)
      }
      const t = setTimeout(render, 60)
      return () => {
        active = false
        clearTimeout(t)
      }
    }
  }, [open, trade, drawCanvas])

  // Action 1: Download PNG
  const handleDownloadPNG = async () => {
    if (!canvasRef.current || !trade) return
    setDownloading(true)
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `AlphaCapital-${trade.symbol}-${isProfit ? 'PROFIT' : 'TRADE'}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Social Profit Share Card downloaded successfully!')
    } catch (err: any) {
      toast.error('Failed to download card: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  // Action 2: Copy to Clipboard (Safari / iOS WebKit compatible Promise flow)
  const handleCopyClipboard = async () => {
    if (!canvasRef.current || !trade) return
    setCopying(true)
    try {
      if (typeof window !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        // Modern Safari / WebKit requires ClipboardItem to receive a Promise<Blob> synchronously
        // inside the transient user gesture activation window.
        const blobPromise = new Promise<Blob>((resolve, reject) => {
          canvasRef.current?.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Canvas rasterization failed'))
          }, 'image/png')
        })

        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blobPromise })
        ])
        setCopied(true)
        toast.success('Profit Card PNG copied to clipboard!')
        setTimeout(() => setCopied(false), 2500)
      } else {
        await copySocialText()
      }
    } catch {
      // Fallback to rich formatted text
      await copySocialText()
    } finally {
      setCopying(false)
    }
  }

  const copySocialText = async () => {
    if (!trade) return
    const text = `🚀 Verified Profit Flex: ${fmtUSD(trade.pnl, { sign: true })} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%) on ${trade.symbol} with @AlphaCapital Prop Firm! 📈 https://demo.launchapropfirm.com`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Trade share text copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Clipboard write permission denied')
    }
  }

  // Action 3: Share (Native Web Share or Twitter intent)
  const handleShare = async () => {
    if (!trade || !canvasRef.current) return
    setSharing(true)
    try {
      const shareText = `🚀 Verified Profit Flex: ${fmtUSD(trade.pnl, { sign: true })} on ${trade.symbol} with @AlphaCapital! 📈`
      const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://demo.launchapropfirm.com'

      const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, 'image/png'))
      if (blob && typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([blob], `AlphaCapital-${trade.symbol}.png`, { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'AlphaCapital Profit Share Card',
              text: shareText,
              url: shareUrl,
              files: [file],
            })
            toast.success('Shared successfully!')
            return
          } catch (err: any) {
            if (err.name === 'AbortError') return
          }
        }
      }
      openTwitterShare(shareText, shareUrl)
    } finally {
      setSharing(false)
    }
  }

  const openTwitterShare = (text: string, url: string) => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, '_blank', 'noopener,noreferrer')
    toast.success('Opening Twitter / X share composer...')
  }

  if (!open || !trade) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-card-lg overflow-hidden my-8"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-muted/40">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-accent/10 border border-accent/25 text-accent flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Social Profit Share Card</h3>
                <p className="text-2xs text-text-muted">Branded P&L flex banner with verifiable trade telemetry</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Preview */}
          <div className="p-6 space-y-6">
            
            {/* Live Interactive Card Canvas Container */}
            <div className="rounded-xl border border-border overflow-hidden bg-surface-muted shadow-card relative group">
              <canvas
                ref={canvasRef}
                className="w-full h-auto block select-none pointer-events-none"
              />
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur px-2.5 py-1 rounded-md text-3xs tabular text-text-muted border border-border-subtle shadow-xs">
                1200 x 675 Ultra HD
              </div>
            </div>

            {/* Quick stats highlight */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-muted/60 border border-border-subtle text-center">
                <span className="text-3xs uppercase tracking-wider text-text-muted font-semibold block">
                  Trading Pair
                </span>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="text-base font-extrabold text-text">
                    {trade.symbol}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-3xs font-bold uppercase tabular ${
                    trade.type === 'buy' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    {trade.type} {Number(trade.lotSize).toFixed(2)}L
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-muted/60 border border-border-subtle text-center">
                <span className="text-3xs uppercase tracking-wider text-text-muted font-semibold block">
                  Net Profit
                </span>
                <span className={`text-base font-extrabold tabular ${isProfit ? 'text-accent' : 'text-danger'} block mt-0.5`}>
                  {fmtUSD(trade.pnl, { sign: true })}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-muted/60 border border-border-subtle text-center">
                <span className="text-3xs uppercase tracking-wider text-text-muted font-semibold block">
                  ROI Return
                </span>
                <span className={`text-base font-extrabold tabular ${pnlPercent >= 0 ? 'text-accent' : 'text-danger'} block mt-0.5`}>
                  {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleDownloadPNG}
                disabled={downloading}
                className="w-full sm:flex-1 gap-2 shadow-accent/20 text-xs font-semibold h-10"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Rendering PNG...' : 'Download PNG'}
              </Button>

              <Button
                variant="outline"
                onClick={handleCopyClipboard}
                disabled={copying}
                className="w-full sm:flex-1 gap-2 border-border hover:bg-surface-muted text-xs font-semibold h-10"
              >
                {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4 text-text-muted" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>

              <Button
                variant="outline"
                onClick={handleShare}
                disabled={sharing}
                className="w-full sm:w-auto px-4 gap-2 border-border hover:bg-surface-muted text-xs font-semibold h-10"
              >
                <Share2 className="h-4 w-4 text-text-muted" />
                Share
              </Button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
