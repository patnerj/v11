import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = { title: 'Terms of Service | LaunchAPropFirm' }

export default function Page() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="By using LaunchAPropFirm (launchapropfirm.com) you agree to the following institutional terms and service conditions."
      updated="September 2026"
      sections={[
        { 
          title: '1. The Service & Evaluation Framework',
          body: <p>LaunchAPropFirm provides simulated proprietary trading evaluation programmes. Funded accounts operate on demonstration accounts mirroring live institutional market pricing. Payouts represent the operator&apos;s contractual profit-split share of allocated performance capital, backed by our institutional liquidity reserves, and are not the direct result of executions on a retail broker account.</p> 
        },
        { 
          title: '2. Eligibility & Compliance',
          body: <p>You must be at least 18 years of age and reside in a jurisdiction where simulated prop firm evaluations are permitted by local law. You may not use the service if you are subject to international sanctions or reside in a prohibited territory.</p> 
        },
        { 
          title: '3. Account Security & Integrity',
          body: <p>You are strictly responsible for maintaining the confidentiality of your MetaTrader 5 and WebTrader credentials. Two-factor authentication (2FA) is strongly recommended. Account sharing, credential reselling, or unauthorized proxy access is strictly forbidden and results in immediate termination.</p> 
        },
        { 
          title: '4. Trading Discipline & Static Drawdown',
          body: <p>Active evaluation accounts are governed by static daily-drawdown and static maximum-drawdown rules as stated on each plan. Drawdown is calculated against your initial starting balance with zero trailing floor traps. Prohibited trading practices including latency arbitrage, gap manipulation, high-frequency quote spamming, and account mirroring will result in immediate disqualification.</p> 
        },
        { 
          title: '5. 100% Evaluation Fee Refund',
          body: <p>Evaluation fees are credited back 100% in full alongside your first eligible bi-weekly profit split withdrawal on your funded account. Unused challenges with zero executed trades may be cancelled within the standard cooling-off window.</p> 
        },
        { 
          title: '6. Limitation of Liability',
          body: <p>The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. LaunchAPropFirm is not liable for indirect, incidental, or consequential damages. Trading foreign exchange and CFDs carries financial risk; past performance does not guarantee future results.</p> 
        },
        { 
          title: '7. Official Notices & Contact Channels',
          body: (
            <p>
              For general client support, order verification, or technical inquiries, contact our 24/7 Operations Desk at{' '}
              <a className="text-emerald-400 hover:underline font-semibold" href="mailto:support@launchapropfirm.com">
                support@launchapropfirm.com
              </a>
              .
            </p>
          ) 
        },
      ]}
    />
  )
}
