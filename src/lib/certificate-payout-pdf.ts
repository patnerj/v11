import type { PayoutItem } from '@/types/api'
import { buildPayoutCertificateSvg, generateQrDataUrl } from './certificate-svg'

function slug(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'Payout'
}

async function rasterizeSvgToDataUrl(svg: string, width: number, height: number): Promise<string> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const blobUrl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG render failed'))
      img.src = blobUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export async function downloadPayoutCertificatePng(
  payout: PayoutItem,
  options: { brand?: string; planName?: string } = {}
): Promise<void> {
  const brand = options.brand || (typeof window !== 'undefined' ? localStorage.getItem('fxsim:brand_name') : '') || 'LaunchAPropFirm'
  const plan = options.planName || 'Funded Trader Program'
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/payouts?id=${payout.id}`
    : `https://demo.launchapropfirm.com/dashboard/payouts?id=${payout.id}`
  const qr = await generateQrDataUrl(verifyUrl)

  const svg = buildPayoutCertificateSvg(payout, brand, plan, qr)
  const pngUrl = await rasterizeSvgToDataUrl(svg, 1920, 1080)

  const a = document.createElement('a')
  a.href = pngUrl
  a.download = `${slug(brand)}-Payout-Certificate-${slug(payout.name || payout.username || 'Trader')}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function downloadPayoutCertificatePdf(
  payout: PayoutItem,
  options: { brand?: string; planName?: string } = {}
): Promise<void> {
  const brand = options.brand || (typeof window !== 'undefined' ? localStorage.getItem('fxsim:brand_name') : '') || 'LaunchAPropFirm'
  const plan = options.planName || 'Funded Trader Program'
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/payouts?id=${payout.id}`
    : `https://demo.launchapropfirm.com/dashboard/payouts?id=${payout.id}`
  const qr = await generateQrDataUrl(verifyUrl)

  const svg = buildPayoutCertificateSvg(payout, brand, plan, qr)
  const pngUrl = await rasterizeSvgToDataUrl(svg, 1920, 1080)

  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  doc.addImage(pngUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST')

  const filename = `${slug(brand)}-Payout-Certificate-${slug(payout.name || payout.username || 'Trader')}.pdf`
  doc.save(filename)
}
