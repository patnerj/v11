'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, HelpCircle, Sparkles, Mail, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/cn'
import Link from 'next/link'

interface QA { q: string; a: string }
interface Section { title: string; items: QA[] }

const SECTIONS: Section[] = [
  {
    title: 'Evaluation Models & Stage Rules',
    items: [
      { 
        q: 'How does the MassFunded two-phase evaluation work?',
        a: 'You select your desired capital size from $10,000 up to $200,000. In Phase 1, you target an 8% profit with zero calendar time pressure, while adhering to daily and maximum static drawdown limits. Once met, you transition automatically to Phase 2, which requires a 5% target. Upon completion, your funded trading credentials are automatically issued.' 
      },
      { 
        q: 'What instruments and markets are available to trade?',
        a: 'We provide institutional pricing across 19+ liquid instruments, including major Forex currency pairs (EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD), precious metals (XAUUSD Gold, XAGUSD Silver), equity indices (US30, NAS100, SPX500, GER40), and cryptocurrencies (BTCUSD, ETHUSD).' 
      },
      { 
        q: 'Is there a minimum or maximum time limit to pass?',
        a: 'There are ZERO maximum time limits on our evaluation phases—you can trade at your own rhythm without calendar rush. A minimum of 5 active trading days is required in each phase to verify disciplined risk management.' 
      },
    ],
  },
  {
    title: 'Drawdown & Risk Management Architecture',
    items: [
      { 
        q: 'What is the Daily Drawdown and how is it calculated?',
        a: 'The daily drawdown is 5% based on your daily starting balance/equity, resetting precisely at 00:00 UTC server midnight. Pre-trade risk guards and real-time floating equity monitors protect your account from accidental limit breaches.' 
      },
      { 
        q: 'What is the Static Maximum Drawdown, and how does it prevent trailing traps?',
        a: 'Unlike predatory prop firms that trail your maximum loss floor upwards as your unrealized floating profit grows, MassFunded enforces a fixed, static 10% maximum drawdown calculated solely from your initial account size. Your floor NEVER moves up to lock you into a synthetic failure during natural market pullbacks.' 
      },
      { 
        q: 'Can I trade during high-impact news events?',
        a: 'Yes, news trading is fully permitted across all phases. You may hold and execute orders through macroeconomic events such as Non-Farm Payrolls (NFP), Federal Reserve interest rate announcements (FOMC), and Consumer Price Index (CPI) releases.' 
      },
      { 
        q: 'Are Expert Advisors (EAs) and automated algorithms allowed?',
        a: 'Yes. EAs, custom indicators, risk management utilities, and automated algorithmic strategies are fully supported, provided they adhere to standard latency fair-execution guidelines.' 
      },
    ],
  },
  {
    title: 'Payouts, Disbursals & Fee Refunds',
    items: [
      { 
        q: 'When am I eligible for my first withdrawal?',
        a: 'Your first payout can be requested 14 calendar days after your funded trading account is activated. Subsequent payouts can be requested every 14 days on our regular bi-weekly schedule.' 
      },
      { 
        q: 'How does the 100% Evaluation Fee Refund work?',
        a: 'When you achieve funded status and request your very first successful profit payout, 100% of your initial challenge purchase fee is automatically refunded and added directly to your disbursed payment.' 
      },
      { 
        q: 'Which payout rails and currencies do you support?',
        a: 'We support instant crypto disbursals via USDT (TRC-20 and ERC-20), native Bitcoin (BTC), and direct international Bank Wire / Wise transfers. Crypto transactions are completed with zero withdrawal fees.' 
      },
      { 
        q: 'What is the trader profit split?',
        a: 'Traders start with an 80% profit share on funded accounts, scaling progressively up to 90% as you reach consecutive profitable bi-weekly milestones.' 
      },
    ],
  },
  {
    title: 'Platforms, Spreads & Technology',
    items: [
      { 
        q: 'Which trading platforms can I execute on?',
        a: 'You can execute orders directly in your web browser via our high-speed WebTrader terminal (featuring advanced TradingView charts and 1-click risk calculators), or connect via desktop/mobile MetaTrader 5 (MT5).' 
      },
      { 
        q: 'What spreads and execution latency do you provide?',
        a: 'Our execution infrastructure connects directly to Tier-1 institutional liquidity feeds (Pepperstone) hosted in London Equinix LD4, providing raw institutional spreads starting from 0.0 pips and an ultra-low 14ms execution bridge.' 
      },
    ],
  },
  {
    title: 'Support, Escalations & Governance',
    items: [
      { 
        q: 'How do I contact customer support or executive management?',
        a: 'Our operations team is available 24/7 at support@massfunded.org (average response time under 15 minutes). For institutional partnerships and large capital allocations ($100K–$2M), contact Managing Director Bahadur directly at bahadur@massfunded.org.' 
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <MarketingHeader />

      <main className="relative pt-28 pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/5 blur-[160px]" />
          <div className="absolute inset-0 bg-grid-overlay opacity-25" />
        </div>

        <div className="container max-w-4xl mx-auto px-4">
          
          {/* Header */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-4 shadow-glow-sm"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Knowledge Base &amp; Helpdesk</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tightest text-text">
              Frequently Asked <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Questions</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-muted max-w-xl mx-auto">
              Everything you need to know about our evaluation models, risk criteria, and bi-weekly payouts.
            </p>
          </div>

          {/* Sections List */}
          <div className="space-y-12">
            {SECTIONS.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {sec.title}
                </h2>
                
                <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border backdrop-blur-md shadow-card">
                  {sec.items.map((qa, i) => (
                    <QARow key={i} qa={qa} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Help Desk Card */}
          <div className="mt-16 rounded-3xl border border-emerald-500/30 bg-surface p-8 sm:p-10 text-center backdrop-blur-xl shadow-card">
            <h3 className="text-xl sm:text-2xl font-bold text-text mb-2">Still Have Questions?</h3>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
              Our 24/7 technical desk and executive management are here to help.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild className="h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-glow-sm">
                <a href="mailto:support@massfunded.org">
                  <Mail className="h-3.5 w-3.5 mr-2" />
                  <span>support@massfunded.org</span>
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 px-6 rounded-xl border-border hover:border-emerald-500/40 text-text hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold">
                <Link href="/contact">Open Contact Form</Link>
              </Button>
            </div>
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}

function QARow({ qa }: { qa: QA }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-surface/30 transition-colors"
      >
        <span className="font-bold text-text text-sm sm:text-base pr-4">
          {qa.q}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-text-muted shrink-0 transition-transform duration-200',
            open && 'rotate-180 text-emerald-400'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-text-muted leading-relaxed border-t border-border-subtle/30 pt-4">
              {qa.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
