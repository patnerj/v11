import QRCode from 'qrcode'
import type { Certificate as Cert, PayoutItem } from '@/types/api'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const POPPINS_FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function money(v: number | string): string {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  if (!isFinite(n)) return String(v)
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 180,
      color: {
        dark: '#ffffff',
        light: '#00000000',
      },
    })
  } catch {
    return ''
  }
}

export function buildCertificateSvg(
  cert: Cert,
  brandName: string = 'Trading Firm',
  qrDataUrl: string = ''
): string {
  const funded = (cert.status ?? '') === 'funded'
  const kind = funded ? 'Funded Trader' : 'Evaluation Pass'
  const certDate = cert.issued_date ? new Date(cert.issued_date) : new Date()
  const safeCertDate = isNaN(certDate.getTime()) ? new Date() : certDate
  const year = safeCertDate.getFullYear()
  const verificationId = `PFL-${year}-${String(cert.challenge_id || 101).padStart(6, '0')}`
  const trader = esc(cert.trader_name || 'Verified Trader')
  const plan = esc(cert.plan_name || 'Executive Trader')
  const issued = esc(
    safeCertDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  )
  const sizeStr = esc(money(cert.account_size || 100000))
  const splitPct = (typeof cert.profit_split === 'number' ? cert.profit_split : parseFloat(String(cert.profit_split)) || 85) + '%'
  const brand = esc(cert.brand || brandName || 'Trading Firm')

  const W = 1920
  const H = 1080

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="cert-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050811"/>
      <stop offset="45%" stop-color="#0A1022"/>
      <stop offset="100%" stop-color="#070C18"/>
    </linearGradient>
    <linearGradient id="gold-border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="30%" stop-color="#FCD34D"/>
      <stop offset="60%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="emerald-glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0"/>
      <stop offset="50%" stop-color="#10B981" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="aurora-left" cx="0.15" cy="0.2" r="0.45">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aurora-right" cx="0.85" cy="0.8" r="0.5">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aurora-center" cx="0.5" cy="0.4" r="0.4">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="seal-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <style>
      text, tspan { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
  </defs>

  <!-- Deep Obsidian luxury canvas -->
  <rect width="${W}" height="${H}" fill="url(#cert-bg)"/>
  <rect width="${W}" height="${H}" fill="url(#aurora-left)"/>
  <rect width="${W}" height="${H}" fill="url(#aurora-right)"/>
  <rect width="${W}" height="${H}" fill="url(#aurora-center)"/>

  <!-- Outer metallic border -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="20" fill="none" stroke="url(#gold-border)" stroke-width="4"/>
  <!-- Inner subtle border -->
  <rect x="56" y="56" width="${W - 112}" height="${H - 112}" rx="14" fill="none" stroke="#24324D" stroke-width="2"/>
  
  <!-- Corner Guilloche Ornaments -->
  <path d="M 68 108 L 108 68 M 68 128 L 128 68 M 68 88 L 88 68" stroke="#F59E0B" stroke-width="2" stroke-opacity="0.4"/>
  <path d="M ${W - 68} 108 L ${W - 108} 68 M ${W - 68} 128 L ${W - 128} 68 M ${W - 68} 88 L ${W - 88} 68" stroke="#F59E0B" stroke-width="2" stroke-opacity="0.4"/>
  <path d="M 68 ${H - 108} L 108 ${H - 68} M 68 ${H - 128} L 128 ${H - 68} M 68 ${H - 88} L 88 ${H - 68}" stroke="#F59E0B" stroke-width="2" stroke-opacity="0.4"/>
  <path d="M ${W - 68} ${H - 108} L ${W - 108} ${H - 68} M ${W - 68} ${H - 128} L ${W - 128} ${H - 68} M ${W - 68} ${H - 88} L ${W - 88} ${H - 68}" stroke="#F59E0B" stroke-width="2" stroke-opacity="0.4"/>

  <!-- Top Badge / Firm Header -->
  <text x="${W / 2}" y="125" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="18" font-weight="800" letter-spacing="8" fill="#F59E0B">
    ★ ${brand.toUpperCase()} · INSTITUTIONAL RISK MANAGEMENT ★
  </text>

  <!-- Title -->
  <text x="${W / 2}" y="195" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="52" font-weight="900" letter-spacing="3" fill="#FFFFFF">
    CERTIFICATE OF ACHIEVEMENT
  </text>

  <!-- Kind Badge Pill -->
  <rect x="${W / 2 - 160}" y="225" width="320" height="38" rx="19" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1.5"/>
  <text x="${W / 2}" y="250" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="16" font-weight="700" letter-spacing="3" fill="#34D399">
    ✦  ${kind.toUpperCase()} PRO  ✦
  </text>

  <!-- Presentation text -->
  <text x="${W / 2}" y="340" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="20" font-weight="600" letter-spacing="4" fill="#94A3B8">
    THIS IS PROUDLY PRESENTED TO
  </text>

  <!-- Trader Name -->
  <text x="${W / 2}" y="425" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="64" font-weight="900" fill="#FFFFFF" letter-spacing="1">
    ${trader}
  </text>

  <!-- Underline divider with diamond -->
  <line x1="${W / 2 - 320}" y1="455" x2="${W / 2 + 320}" y2="455" stroke="url(#emerald-glow)" stroke-width="3"/>
  <polygon points="${W / 2},447 ${W / 2 + 8},455 ${W / 2},463 ${W / 2 - 8},455" fill="#F59E0B"/>

  <!-- Qualification Body -->
  <text x="${W / 2}" y="520" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="24" font-weight="500" fill="#CBD5E1">
    for demonstrating disciplined risk execution and passing the evaluation requirements for the
  </text>
  <text x="${W / 2}" y="565" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="30" font-weight="800" fill="#38BDF8">
    ${plan} Account
  </text>

  <!-- Stat Pills Box -->
  <g transform="translate(${W / 2 - 390}, 625)">
    <!-- Account Size -->
    <rect x="0" y="0" width="240" height="90" rx="14" fill="#0E162B" stroke="#243452" stroke-width="1.5"/>
    <text x="120" y="32" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="#64748B">ACCOUNT CAPITAL</text>
    <text x="120" y="68" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="28" font-weight="900" fill="#FFFFFF">${sizeStr}</text>

    <!-- Profit Split -->
    <rect x="270" y="0" width="240" height="90" rx="14" fill="#0E162B" stroke="#243452" stroke-width="1.5"/>
    <text x="390" y="32" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="#64748B">PROFIT SPLIT</text>
    <text x="390" y="68" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="28" font-weight="900" fill="#34D399">${splitPct}</text>

    <!-- Risk Performance -->
    <rect x="540" y="0" width="240" height="90" rx="14" fill="#0E162B" stroke="#243452" stroke-width="1.5"/>
    <text x="660" y="32" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="#64748B">DISCIPLINE STATUS</text>
    <text x="660" y="68" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="28" font-weight="900" fill="#F59E0B">TIER-1 PASS</text>
  </g>

  <!-- Official Dual Metallic Seal -->
  <g transform="translate(180, 850)">
    <circle cx="0" cy="0" r="70" fill="url(#seal-grad)" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="3"/>
    <circle cx="0" cy="0" r="58" fill="none" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="6,4"/>
    <circle cx="0" cy="0" r="46" fill="#0B132B"/>
    <path d="M -16 6 L -4 18 L 18 -10" stroke="#F59E0B" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="0" y="30" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="9" font-weight="800" letter-spacing="1" fill="#FCD34D">OFFICIAL SEAL</text>
  </g>

  <!-- Signatures and Auth -->
  <g transform="translate(360, 850)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="34" font-style="italic" fill="#E2E8F0">${brand}</text>
    <line x1="0" y1="14" x2="260" y2="14" stroke="#475569" stroke-width="2"/>
    <text x="0" y="38" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="1" fill="#94A3B8">CHIEF RISK OFFICER</text>
  </g>

  <!-- Center Date & ID -->
  <g transform="translate(${W / 2}, 850)">
    <text x="0" y="-8" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="#64748B">ISSUED ON</text>
    <text x="0" y="20" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="18" font-weight="800" fill="#F8FAFC">${issued}</text>
    <text x="0" y="55" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="600" fill="#94A3B8">
      ID: <tspan fill="#38BDF8" font-family="monospace" font-weight="bold">${verificationId}</tspan>
    </text>
  </g>

  <!-- Right: QR Code Authenticity Watermark -->
  <g transform="translate(${W - 320}, 780)">
    <rect x="0" y="0" width="160" height="175" rx="12" fill="#0B1326" stroke="#243452" stroke-width="1.5"/>
    ${
      qrDataUrl
        ? `<image href="${qrDataUrl}" xlink:href="${qrDataUrl}" x="15" y="12" width="130" height="130"/>`
        : `
      <rect x="25" y="15" width="110" height="110" fill="#13203C" rx="6"/>
      <text x="80" y="75" text-anchor="middle" font-family="monospace" font-size="12" fill="#38BDF8">QR VERIFY</text>
      `
    }
    <text x="80" y="160" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="10" font-weight="700" letter-spacing="0.5" fill="#94A3B8">
      SCAN TO VERIFY
    </text>
  </g>
</svg>`
}

export function buildPayoutCertificateSvg(
  payout: PayoutItem,
  brandName: string = 'Trading Firm',
  planName: string = 'Funded Account',
  qrDataUrl: string = ''
): string {
  const rawIssued = payout.processed_at || payout.requested_at || new Date().toISOString()
  const poDate = new Date(rawIssued)
  const safePoDate = isNaN(poDate.getTime()) ? new Date() : poDate
  const year = safePoDate.getFullYear()
  const verificationId = `PAY-${year}-${String(payout.id || 1).padStart(6, '0')}`
  const trader = esc(payout.name || payout.username || 'Funded Trader')
  const dateFormatted = esc(
    safePoDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  )
  const amountStr = esc(money(payout.trader_amount || 0))
  const splitPct = payout.profit_split_pct ? `${payout.profit_split_pct}%` : '80%'
  const method = esc((payout.payment_method || 'Crypto USDT').toUpperCase())
  const brand = esc(brandName || 'Trading Firm')

  const W = 1920
  const H = 1080

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="payout-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#04090F"/>
      <stop offset="50%" stop-color="#06141B"/>
      <stop offset="100%" stop-color="#03080E"/>
    </linearGradient>
    <linearGradient id="emerald-border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="35%" stop-color="#34D399"/>
      <stop offset="70%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <radialGradient id="aurora-green" cx="0.5" cy="0.3" r="0.5">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="green-seal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="50%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <style>
      text, tspan { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#payout-bg)"/>
  <rect width="${W}" height="${H}" fill="url(#aurora-green)"/>

  <!-- Border -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="20" fill="none" stroke="url(#emerald-border)" stroke-width="4"/>
  <rect x="56" y="56" width="${W - 112}" height="${H - 112}" rx="14" fill="none" stroke="#16382C" stroke-width="2"/>

  <!-- Brand header -->
  <text x="${W / 2}" y="125" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="18" font-weight="800" letter-spacing="8" fill="#34D399">
    ★ ${brand.toUpperCase()} · VERIFIED PROFIT DISBURSAL ★
  </text>

  <!-- Title -->
  <text x="${W / 2}" y="195" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="52" font-weight="900" letter-spacing="3" fill="#FFFFFF">
    CERTIFICATE OF PAYOUT
  </text>

  <rect x="${W / 2 - 160}" y="225" width="320" height="38" rx="19" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1.5"/>
  <text x="${W / 2}" y="250" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="16" font-weight="700" letter-spacing="3" fill="#34D399">
    ✦  PROFIT SPLIT DISBURSED  ✦
  </text>

  <!-- Recipient -->
  <text x="${W / 2}" y="335" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="20" font-weight="600" letter-spacing="4" fill="#94A3B8">
    DISBURSED TO
  </text>
  <text x="${W / 2}" y="415" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="60" font-weight="900" fill="#FFFFFF">
    ${trader}
  </text>

  <!-- Big Amount Display -->
  <g transform="translate(${W / 2}, 530)">
    <text x="0" y="0" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="76" font-weight="900" fill="#34D399" letter-spacing="1">
      ${amountStr}
    </text>
    <text x="0" y="38" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="18" font-weight="600" fill="#94A3B8">
      Processed via <tspan fill="#F8FAFC" font-weight="bold">${method}</tspan> · Profit Split <tspan fill="#34D399" font-weight="bold">${splitPct}</tspan>
    </text>
  </g>

  <!-- Stat summary -->
  <g transform="translate(${W / 2 - 260}, 640)">
    <rect x="0" y="0" width="240" height="80" rx="12" fill="#0A1C16" stroke="#1B4D3E" stroke-width="1.5"/>
    <text x="120" y="30" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="12" font-weight="700" fill="#64748B">PROGRAM</text>
    <text x="120" y="60" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="20" font-weight="800" fill="#FFFFFF">${esc(planName)}</text>

    <rect x="280" y="0" width="240" height="80" rx="12" fill="#0A1C16" stroke="#1B4D3E" stroke-width="1.5"/>
    <text x="400" y="30" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="12" font-weight="700" fill="#64748B">DISBURSAL STATUS</text>
    <text x="400" y="60" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="20" font-weight="800" fill="#34D399">VERIFIED PAID</text>
  </g>

  <!-- Seal -->
  <g transform="translate(180, 850)">
    <circle cx="0" cy="0" r="70" fill="url(#green-seal)" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="3"/>
    <circle cx="0" cy="0" r="58" fill="none" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="6,4"/>
    <circle cx="0" cy="0" r="46" fill="#061E14"/>
    <path d="M -16 6 L -4 18 L 18 -10" stroke="#34D399" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="0" y="30" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="9" font-weight="800" letter-spacing="1" fill="#A7F3D0">PAYOUT VERIFIED</text>
  </g>

  <!-- Signatures -->
  <g transform="translate(360, 850)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="34" font-style="italic" fill="#E2E8F0">${brand}</text>
    <line x1="0" y1="14" x2="260" y2="14" stroke="#1B4D3E" stroke-width="2"/>
    <text x="0" y="38" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="1" fill="#94A3B8">HEAD OF TREASURY</text>
  </g>

  <!-- Center Date & ID -->
  <g transform="translate(${W / 2}, 850)">
    <text x="0" y="-8" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="#64748B">DISBURSED ON</text>
    <text x="0" y="20" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="18" font-weight="800" fill="#F8FAFC">${dateFormatted}</text>
    <text x="0" y="55" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="13" font-weight="600" fill="#94A3B8">
      TX ID: <tspan fill="#34D399" font-family="monospace" font-weight="bold">${verificationId}</tspan>
    </text>
  </g>

  <!-- Right: QR Code -->
  <g transform="translate(${W - 320}, 780)">
    <rect x="0" y="0" width="160" height="175" rx="12" fill="#0A1C16" stroke="#1B4D3E" stroke-width="1.5"/>
    ${
      qrDataUrl
        ? `<image href="${qrDataUrl}" xlink:href="${qrDataUrl}" x="15" y="12" width="130" height="130"/>`
        : `
      <rect x="25" y="15" width="110" height="110" fill="#13362A" rx="6"/>
      <text x="80" y="75" text-anchor="middle" font-family="monospace" font-size="12" fill="#34D399">QR VERIFY</text>
      `
    }
    <text x="80" y="160" text-anchor="middle" font-family="${POPPINS_FONT}" font-size="10" font-weight="700" letter-spacing="0.5" fill="#94A3B8">
      SCAN TO VERIFY
    </text>
  </g>
</svg>`
}
