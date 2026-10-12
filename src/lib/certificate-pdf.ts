import type { Certificate as Cert } from '@/types/api'
import { buildCertificateSvg, generateQrDataUrl } from '@/lib/certificate-svg'
import { useBranding } from '@/store/branding'

/** Slugify a value for a clean, filesystem-safe filename. */
function slug(s: string): string {
  return (s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Certificate'
}

/**
 * One-click luxury landscape certificate PDF that is 100% WYSIWYG identical to
 * the on-screen preview on /dashboard/certificates and /certificate/[code].
 *
 * Single Source of Truth: Uses buildCertificateSvg() from @/lib/certificate-svg,
 * rasterized at 2x (~3840x2160, 300+ DPI) onto an A4 landscape jsPDF page with
 * full bleed luxury obsidian background (#050811).
 */
export async function downloadCertificatePdf(cert: Cert, brandName?: string): Promise<void> {
  const storeBrand = typeof window !== 'undefined'
    ? (useBranding.getState?.()?.branding?.brand_name || localStorage.getItem('fxsim:brand-name') || 'LaunchAPropFirm')
    : 'LaunchAPropFirm'
  const brand = cert.brand || brandName || storeBrand

  const shareHref = typeof window !== 'undefined'
    ? `${window.location.origin}/certificate/${cert.share_code || cert.challenge_id}`
    : `https://demo.launchapropfirm.com/certificate/${cert.share_code || cert.challenge_id}`

  const qrDataUrl = await generateQrDataUrl(shareHref)
  const svg = buildCertificateSvg(cert, brand, qrDataUrl)

  // Rasterize 1920x1080 SVG onto 2x canvas (3840x2160, 300+ DPI)
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
  // Standard A4 landscape: 297mm x 210mm
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

  // Fill dark obsidian background matching SVG canvas (#050811) to eliminate white borders
  doc.setFillColor(5, 8, 17)
  doc.rect(0, 0, 297, 210, 'F')

  // Calculate 16:9 aspect ratio placement on 297x210mm page
  const targetW = 297
  const targetH = 297 * (1080 / 1920) // ~167.06 mm
  const offsetY = (210 - targetH) / 2 // ~21.47 mm

  doc.addImage(png, 'PNG', 0, offsetY, targetW, targetH, undefined, 'FAST')

  const filename = `${slug(brand)}-Certificate-${slug(cert.trader_name || 'Trader')}.pdf`
  doc.save(filename)
}

/** Also provide direct Ultra-HD PNG export for social sharing */
export async function downloadCertificatePng(cert: Cert, brandName?: string): Promise<void> {
  const storeBrand = typeof window !== 'undefined'
    ? (useBranding.getState?.()?.branding?.brand_name || localStorage.getItem('fxsim:brand-name') || 'LaunchAPropFirm')
    : 'LaunchAPropFirm'
  const brand = cert.brand || brandName || storeBrand

  const shareHref = typeof window !== 'undefined'
    ? `${window.location.origin}/certificate/${cert.share_code || cert.challenge_id}`
    : `https://demo.launchapropfirm.com/certificate/${cert.share_code || cert.challenge_id}`

  const qrDataUrl = await generateQrDataUrl(shareHref)
  const svg = buildCertificateSvg(cert, brand, qrDataUrl)

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
  a.download = `${slug(brand)}-Certificate-${slug(cert.trader_name || 'Trader')}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
