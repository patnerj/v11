'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { ChallengesPreview } from '@/components/marketing/challenges-preview'
import { Sparkles, ShieldCheck, Zap, Coins } from 'lucide-react'

export default function ChallengesPage() {
  return (
    <Suspense fallback={<ChallengesPageSkeleton />}>
      <ChallengesPageInner />
    </Suspense>
  )
}

function ChallengesPageSkeleton() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <MarketingHeader />
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-10 w-48 bg-surface-muted rounded-xl" />
          <div className="h-6 w-96 bg-surface-muted rounded-xl" />
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}

function ChallengesPageInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    if (params.get('stripe') === 'cancelled') {
      toast.info('Checkout cancelled — no payment was taken.')
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/challenges')
    }
  }, [params])

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <MarketingHeader />

      <main className="relative pt-24 pb-20 overflow-hidden">
        {/* Subtle background aurora */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/5 blur-[160px]" />
          <div className="absolute inset-0 bg-grid-overlay opacity-25" />
        </div>

        {/* Top Assurance Bar */}
        <div className="container max-w-7xl mx-auto px-4 mb-8">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-3 px-6 rounded-2xl bg-surface border border-border shadow-xs backdrop-blur-md text-xs text-text-muted font-mono">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <ShieldCheck className="h-4 w-4" /> Static Drawdown Only
            </span>
            <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold">
              <Coins className="h-4 w-4" /> 100% Fee Refund on 1st Payout
            </span>
            <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
              <Zap className="h-4 w-4" /> 14ms MT5 Server Execution
            </span>
          </div>
        </div>

        <ChallengesPreview 
          onSelectPlan={(id) => {
            router.push(`/checkout?plan=${id}`)
          }} 
        />
      </main>

      <MarketingFooter />
    </div>
  )
}
