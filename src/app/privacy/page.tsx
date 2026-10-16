'use client'

import { LegalPage } from '@/components/marketing/legal-page'
import { useBranding } from '@/store/branding'

export default function Page() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'Trading Firm'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@example.com'

  return (
    <LegalPage
      title="Privacy Policy"
      intro={`How ${brandName} collects, utilizes, and protects your personal information and trading data.`}
      updated="September 2026"
      sections={[
        { 
          title: '1. Data We Collect',
          body: <p>We collect essential account details (username, verified email, encrypted password hash), authentication telemetry (IP address, session timestamps, browser fingerprint for fraud prevention), trading history on evaluation and funded accounts, and identity verification documents submitted during KYC procedures.</p> 
        },
        { 
          title: '2. How We Use Your Data',
          body: <p>Your data is processed strictly to maintain and operate trading terminals, execute automated evaluation rules, process payout disbursals, comply with AML/CTF obligations, and provide security notifications. We never sell, rent, or monetize personal data with third-party advertising brokers.</p> 
        },
        { 
          title: '3. Payment & Banking Data Protection',
          body: <p>Payment transactions are processed through encrypted, PCI-DSS compliant gateways. Credit/debit card numbers are never stored on {brandName} servers. Cryptocurrency payout wallet addresses are stored in encrypted vaults and used strictly for disbursing your profit splits.</p> 
        },
        { 
          title: '4. Data Retention & Privacy Rights',
          body: <p>We retain transaction and trading records in accordance with institutional financial compliance standards. Depending on your jurisdiction (e.g. GDPR), you possess the right to access, rectify, port, or request erasure of your personal data, subject to regulatory record-keeping laws.</p> 
        },
        { 
          title: '5. Security Protocols & Encryption',
          body: <p>{brandName} enforces 256-bit TLS/SSL encryption for data in transit and AES-256 for data at rest, alongside mandatory rate limiting, automated intrusion detection, and isolated database clusters.</p> 
        },
        { 
          title: '6. Privacy Inquiries & Data Protection Desk',
          body: (
            <p>
              To exercise your data protection rights or report security concerns, contact our operations desk at{' '}
              <a className="text-emerald-400 hover:underline font-semibold" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
          ) 
        },
      ]}
    />
  )
}
