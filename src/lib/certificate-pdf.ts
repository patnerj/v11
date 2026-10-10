import type { Certificate as Cert } from '@/types/api'
import { buildCertificateSvg, generateQrDataUrl } from './certificate-svg'

function slug(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'Certificate'
}

/**
 * High-DPI rasterization helper using native browser SVG rendering via Blob URL.
 */
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

/**
 * Downloads high-res 1920x1080 PNG certificate matching on-screen design 100%.
 */
export async function downloadCertificatePng(cert: Cert): Promise<void> {
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/certificate/${cert.share_code || cert.challenge_id}`
    : `https://demo.launchapropfirm.com/certificate/${cert.share_code || cert.challenge_id}`
  const qr = await generateQrDataUrl(verifyUrl)
  const brand = cert.brand || (typeof window !== 'undefined' ? localStorage.getItem('fxsim:brand_name') : '') || 'LaunchAPropFirm'
  const svg = buildCertificateSvg(cert, brand, qr)

  const pngUrl = await rasterizeSvgToDataUrl(svg, 1920, 1080)
  const a = document.createElement('a')
  a.href = pngUrl
  a.download = `${slug(brand)}-Certificate-${slug(cert.trader_name || 'Trader')}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Downloads Landscape A4 PDF certificate with 100% WYSIWYG parity.
 */
export async function downloadCertificatePdf(cert: Cert): Promise<void> {
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/certificate/${cert.share_code || cert.challenge_id}`
    : `https://demo.launchapropfirm.com/certificate/${cert.share_code || cert.challenge_id}`
  const qr = await generateQrDataUrl(verifyUrl)
  const brand = cert.brand || (typeof window !== 'undefined' ? localStorage.getItem('fxsim:brand_name') : '') || 'LaunchAPropFirm'
  const svg = buildCertificateSvg(cert, brand, qr)

  const pngUrl = await rasterizeSvgToDataUrl(svg, 1920, 1080)

  const { default: jsPDF } = await import('jspdf')
  // Landscape A4: 297mm x 210mm
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  doc.addImage(pngUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST')

  const filename = `${slug(brand)}-Certificate-${slug(cert.trader_name)}.pdf`
  doc.save(filename)
}
