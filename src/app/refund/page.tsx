import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = { title: 'Refund Policy | LaunchAPropFirm' }

export default function Page() {
  return (
    <LegalPage
      title="Refund Policy"
      intro="Our straightforward commitment to transparency, cooling-off rules, and 100% evaluation fee refunds."
      updated="September 2026"
      sections={[
        { 
          title: '1. 100% Evaluation Fee Refund Guarantee',
          body: <p>All challenge fees paid for evaluation accounts are eligible for a 100% refund. When you successfully meet the trading targets for Phase 1 and Phase 2 without breaching risk limits, your entire initial evaluation fee is refunded directly to your payout wallet alongside your very first bi-weekly profit split on the funded account.</p> 
        },
        { 
          title: '2. Cooling-Off Window for Unused Accounts',
          body: <p>If you purchase an evaluation account and choose not to trade, you are entitled to a full refund within 14 days of purchase, provided that zero trades (0 market orders, 0 pending orders) have been opened on the account.</p> 
        },
        { 
          title: '3. Active Trading Disqualification',
          body: <p>Once trading has commenced on an evaluation account (one or more orders executed), digital service delivery has been fully realized, and the evaluation fee becomes non-refundable until successfully qualified for the 100% refund reward on the funded stage.</p> 
        },
        { 
          title: '4. Duplicate Transactions & Technical Glitches',
          body: <p>In the event of accidental duplicate billing or technical network anomalies during crypto or card checkout, our finance team will promptly refund the duplicate transaction in full upon verification.</p> 
        },
        { 
          title: '5. Chargeback Notice & Direct Resolution',
          body: <p>If you experience any billing discrepancy, please contact our support team immediately. Initiating an unauthorized banking chargeback without contacting our desk violates terms and leads to permanent blacklist across all prop firm evaluation infrastructure.</p> 
        },
        { 
          title: '6. Refund Processing Channels',
          body: (
            <p>
              To request an unused account refund or clarify billing inquiries, email our 24/7 Operations Desk at{' '}
              <a className="text-emerald-400 hover:underline font-semibold" href="mailto:support@launchapropfirm.com">
                support@launchapropfirm.com
              </a>{' '}
              with your order reference.
            </p>
          ) 
        },
      ]}
    />
  )
}
