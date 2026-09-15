'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface QAItem {
  q: string
  a: string
}

const DEFAULT_FAQS: QAItem[] = [
  {
    q: 'How does the two-phase evaluation work?',
    a: 'You choose an account size from $10,000 to $200,000. Complete Phase 1 with an 8% profit target, and Phase 2 with a 5% target, while respecting daily and total drawdown rules. Once passed, you are allocated a funded account to trade our capital.'
  },
  {
    q: 'When and how do I receive my payouts?',
    a: 'Your first payout is eligible 14 days after your funded account is activated. Subsequent payouts occur on a bi-weekly schedule. Payouts are processed within 24 hours via Crypto (USDT) or direct bank transfer via Wise.'
  },
  {
    q: 'Are Expert Advisors (EAs) and news trading allowed?',
    a: 'Yes, algorithmic trading, EAs, and trading during macroeconomic news releases are fully permitted across both evaluation and funded phases.'
  },
  {
    q: 'What are the drawdown and risk limits?',
    a: 'The daily drawdown limit is 5% based on your daily starting equity/balance (resets at 00:00 UTC). The maximum total drawdown is a static 10% from your initial account balance.'
  },
  {
    q: 'What platforms and spreads do you provide?',
    a: 'We offer full integration with MetaTrader 5 (MT5) and TradingView powered charts, with direct market execution and institutional raw spreads starting from 0.0 pips.'
  }
]

interface FAQSectionProps {
  puckProps?: {
    badge?: string
    titleText1?: string
    titleAccent?: string
    description?: string
    faqs?: QAItem[]
  }
}

export function FAQSection({ puckProps }: FAQSectionProps) {
  const badge = puckProps?.badge || 'Common questions'
  const titleText1 = puckProps?.titleText1 || 'Frequently Asked'
  const titleAccent = puckProps?.titleAccent || 'Questions'
  const description = puckProps?.description || 'Everything you need to know about our evaluation process, rules, and payouts.'
  const faqs = puckProps?.faqs && puckProps.faqs.length > 0 ? puckProps.faqs : DEFAULT_FAQS

  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx))
  }

  return (
    <section className="py-20 lg:py-28 relative overflow-hidden" id="faq">
      <div className="container max-w-4xl">
        <div className="text-center mb-14">
          <Badge tone="info" className="mb-4">
            <HelpCircle className="h-3 w-3 mr-1" />
            {badge}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            {titleText1} <span className="text-gradient">{titleAccent}</span>
          </h2>
          <p className="mt-4 text-text-muted text-lg max-w-xl mx-auto">
            {description}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border transition-colors overflow-hidden',
                  isOpen ? 'border-border bg-surface shadow-sm' : 'border-border-subtle bg-surface/50 hover:bg-surface'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-5 text-left transition-colors"
                >
                  <span className="font-semibold text-text pr-4 text-base sm:text-lg">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-text-muted shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180 text-accent'
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="px-5 pb-5 text-sm sm:text-base text-text-muted leading-relaxed border-t border-border-subtle/50 pt-3">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
