'use client'

import { LegalPage } from '@/components/marketing/legal-page'
import { useBranding } from '@/store/branding'

export default function Page() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'Trading Firm'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@example.com'

  return (
    <LegalPage
      title="Cookie Policy"
      intro={`How ${brandName} uses essential session cookies to provide high-speed, secure trading workspaces.`}
      updated="September 2026"
      sections={[
        { 
          title: '1. Essential Technical Cookies',
          body: <p>We deploy strictly necessary session cookies and local storage tokens to maintain authenticated trader sessions, persist theme preferences (Obsidian dark mode), and cache chart workspace settings. These cookies are critical for platform operation.</p> 
        },
        { 
          title: '2. Zero Third-Party Advertising Trackers',
          body: <p>{brandName} does not utilize third-party advertising cookies, cross-site profiling trackers, or invasive data brokers. Your trading patterns, balance details, and interaction data are never sold or shared with external ad platforms.</p> 
        },
        { 
          title: '3. Security & Anti-Fraud Telemetry',
          body: <p>Certain encrypted tokens are stored temporarily to protect against cross-site request forgery (CSRF), brute-force authentication attacks, and duplicate order submissions.</p> 
        },
        { 
          title: '4. Managing Browser Cookies',
          body: <p>You may adjust your browser preferences to block cookies; however, disabling essential session cookies will prevent login access to your Trader Dashboard, WebTrader, and challenge management portal.</p> 
        },
        { 
          title: '5. Policy Inquiries',
          body: (
            <p>
              For questions regarding our cookie practices, reach our support desk at{' '}
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
