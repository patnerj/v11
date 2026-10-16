'use client'

import React, { useEffect, useState } from 'react'
import type { Certificate as Cert, PayoutItem } from '@/types/api'
import { useBranding } from '@/store/branding'
import { buildCertificateSvg, buildPayoutCertificateSvg, generateQrDataUrl } from '@/lib/certificate-svg'

/**
 * The certificate visual itself — renders the exact same luxury vector SVG
 * that is exported on download, guaranteeing 100% WYSIWYG parity.
 */
export function CertificateDocument({ cert }: { cert: Cert }) {
  const storeBrand = useBranding((s) => s.branding.brand_name) || 'Prop Firm'
  const [qrUrl, setQrUrl] = useState<string>('')

  const shareHref = typeof window !== 'undefined'
    ? `${window.location.origin}/certificate/${cert.share_code || cert.challenge_id}`
    : `/certificate/${cert.share_code || cert.challenge_id}`

  useEffect(() => {
    generateQrDataUrl(shareHref).then(setQrUrl)
  }, [shareHref])

  const svgHtml = buildCertificateSvg(cert, cert.brand || storeBrand, qrUrl)

  return (
    <div className="dark relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow-2xl bg-[#050811] border border-border select-none" data-theme="midnight-obsidian">
      <div
        className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  )
}

export function PayoutCertificateDocument({ payout, planName }: { payout: PayoutItem; planName?: string }) {
  const storeBrand = useBranding((s) => s.branding.brand_name) || 'Prop Firm'
  const [qrUrl, setQrUrl] = useState<string>('')

  const shareHref = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/payouts?id=${payout.id}`
    : `/dashboard/payouts?id=${payout.id}`

  useEffect(() => {
    generateQrDataUrl(shareHref).then(setQrUrl)
  }, [shareHref])

  const svgHtml = buildPayoutCertificateSvg(payout, storeBrand, planName || 'Funded Trader Program', qrUrl)

  return (
    <div className="dark relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow-2xl bg-[#04090F] border border-emerald-500/30 select-none" data-theme="midnight-obsidian">
      <div
        className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  )
}
