import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = { title: 'Risk Disclosure | MassFunded' }

export default function Page() {
  return (
    <LegalPage
      title="Risk Disclosure"
      intro="Trading financial instruments involves significant risk. This disclosure clarifies the nature of our evaluation programmes and simulated capital environments."
      updated="September 2026"
      sections={[
        { 
          title: '1. Simulated Evaluation Environment',
          body: <p>MassFunded provides evaluation programmes designed to identify consistent, disciplined trading talent. All challenges and funded stage accounts utilize real-time institutional price feeds in a simulated demonstration environment. Challenge fees grant access to digital educational assessment services and do not constitute retail investment deposits.</p> 
        },
        { 
          title: '2. High Volatility & Risk of Loss',
          body: <p>Trading foreign currencies, commodities, equity indices, and crypto CFDs carries significant financial exposure. Fluctuations in exchange rates, central bank announcements, geopolitical events, and liquidity gaps can result in rapid drawdown and breach of account risk limits.</p> 
        },
        { 
          title: '3. No Financial or Investment Advice',
          body: <p>Information provided on this platform, in educational blogs, or by support staff does not constitute investment advice, financial planning, or tax counsel. All trading decisions, order sizes, stop loss placements, and strategy executions remain the sole responsibility of the individual trader.</p> 
        },
        { 
          title: '4. Market Data Feeds & Execution Latency',
          body: <p>Quotations are aggregated from institutional ECN liquidity providers (Pepperstone raw feeds). While our Equinix LD4 cross-connect operates at 14ms latency, network congestion, slippage, and spread widening may occur during major economic data releases.</p> 
        },
        { 
          title: '5. Risk Management Compliance',
          body: <p>Traders must strictly adhere to the static daily drawdown (5%) and static maximum drawdown (10%) parameters. Over-leveraging or reckless risk taking violates evaluation rules and terminates access to funded allocations.</p> 
        },
        { 
          title: '6. Risk Desk & Compliance Contacts',
          body: (
            <p>
              For questions regarding risk parameters, contact our Risk Desk at{' '}
              <a className="text-emerald-400 hover:underline font-semibold" href="mailto:support@massfunded.org">
                support@massfunded.org
              </a>
              . For institutional risk policies and executive inquiries, contact our Managing Director at{' '}
              <a className="text-amber-400 hover:underline font-semibold" href="mailto:bahadur@massfunded.org">
                bahadur@massfunded.org
              </a>
              .
            </p>
          ) 
        },
      ]}
    />
  )
}
