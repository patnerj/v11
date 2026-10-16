import type { PayoutItem } from '@/types/api'
import { buildPayoutCertificateSvg, generateQrDataUrl } from '@/lib/certificate-svg'
import { useBranding } from '@/store/branding'

/** Slugify a value for a clean, filesystem-safe filename. */
function slug(s: string): string {
  return (s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Payout'
}

/**
 * One-click luxury landscape payout certificate PDF that is 100% WYSIWYG identical
 * to the on-screen preview on /dashboard/certificates.
 *
 * Single Source of Truth: Uses buildPayoutCertificateSvg() from @/lib/certificate-svg,
 * rasterized at 2x onto an A4 landscape jsPDF page with full bleed emerald-tinted
 * obsidian background (#04090F).
 */
export async function downloadPayoutCertificatePdf(
  payout: PayoutItem, 
  options: { brand?: string; planName?: string } = {}
): Promise<void> {
  const storeBrand = typeof window !== 'undefined'
    ? (useBranding.getState?.()?.branding?.brand_name || localStorage.getItem('fxsim:brand-name') || 'Trading Firm')
    : 'Trading Firm'
  const brand = options.brand || storeBrand
  const plan = options.planName || (payout as any).plan_name || 'Funded Trader Program'

  const shareHref = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/payouts?id=${payout.id}`
    : `/dashboard/payouts?id=${payout.id}`

  const qrDataUrl = await generateQrDataUrl(shareHref)
  const svg = buildPayoutCertificateSvg(payout, brand, plan, qrDataUrl)

  const W = 1920
  const H = 1080
  const scale = 2

  const img = new Image()
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG render failed'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const png = canvas.toDataURL('image/png')

  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

  // Fill dark background matching payout canvas (#04090F)
  doc.setFillColor(4, 9, 15)
  doc.rect(0, 0, 297, 210, 'F')

  const targetW = 297
  const targetH = 297 * (1080 / 1920) // ~167.06 mm
  const offsetY = (210 - targetH) / 2 // ~21.47 mm

  doc.addImage(png, 'PNG', 0, offsetY, targetW, targetH, undefined, 'FAST')

  const filename = `${slug(brand)}-Payout-${payout.id}.pdf`
  doc.save(filename)
}

/** Also provide direct Ultra-HD PNG export for social sharing */
export async function downloadPayoutCertificatePng(
  payout: PayoutItem,
  options: { brand?: string; planName?: string } = {}
): Promise<void> {
  const storeBrand = typeof window !== 'undefined'
    ? (useBranding.getState?.()?.branding?.brand_name || localStorage.getItem('fxsim:brand-name') || 'Trading Firm')
    : 'Trading Firm'
  const brand = options.brand || storeBrand
  const plan = options.planName || (payout as any).plan_name || 'Funded Trader Program'

  const shareHref = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/payouts?id=${payout.id}`
    : `/dashboard/payouts?id=${payout.id}`

  const qrDataUrl = await generateQrDataUrl(shareHref)
  const svg = buildPayoutCertificateSvg(payout, brand, plan, qrDataUrl)

  const W = 1920
  const H = 1080
  const scale = 2

  const img = new Image()
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG render failed'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const png = canvas.toDataURL('image/png')

  const a = document.createElement('a')
  a.href = png
  a.download = `${slug(brand)}-Payout-${payout.id}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
