'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useBranding } from '@/store/branding'
import { api } from '@/lib/api'
import { fmtUSD, toNum } from '@/lib/format'
import { FALLBACK_CHALLENGE_PLANS } from '@/lib/mock-data'
import type { ChallengePlan } from '@/types/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Award,
  TrendingUp,
  Clock,
  Target,
  ChevronRight,
  Star,
  Users,
  Globe,
  DollarSign,
  Check,
  HelpCircle,
  Activity,
  Layers,
  Headphones,
  Zap,
  Monitor,
  Flame,
  BadgePercent,
  ChevronDown,
  Lock,
  RefreshCw,
  FileText,
  AlertCircle,
  Info,
  Shield,
  PieChart,
  Cpu,
  Wallet,
  Percent
} from 'lucide-react'

// ── Currency definitions & rates ──────────────────────────────────────────────
type CurrencyKey = 'USD' | 'EUR' | 'GBP'

const CURRENCIES: { key: CurrencyKey; symbol: string; rate: number }[] = [
  { key: 'USD', symbol: '$', rate: 1.0 },
  { key: 'EUR', symbol: '€', rate: 0.92 },
  { key: 'GBP', symbol: '£', rate: 0.79 },
]

// ── Top Verified Payouts (Real-Time Leaderboard Stream) ────────────────────────
const RECENT_PAYOUTS = [
  {
    trader: 'Tariq A.',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    amount: 38450,
    model: 'Stellar 2-Step',
    method: 'USDT (TRC-20)',
    timeAgo: '12m ago',
  },
  {
    trader: 'Lukas M.',
    country: 'Germany',
    flag: '🇩🇪',
    amount: 24190,
    model: 'Stellar 1-Step',
    method: 'Bank Wire',
    timeAgo: '28m ago',
  },
  {
    trader: 'Mateo R.',
    country: 'Spain',
    flag: '🇪🇸',
    amount: 31520,
    model: 'Stellar 2-Step',
    method: 'USDT (ERC-20)',
    timeAgo: '41m ago',
  },
  {
    trader: 'David H.',
    country: 'United Kingdom',
    flag: '🇬🇧',
    amount: 19800,
    model: 'Express Model',
    method: 'Bank Wire',
    timeAgo: '1h ago',
  },
  {
    trader: 'Liam K.',
    country: 'Canada',
    flag: '🇨🇦',
    amount: 14600,
    model: 'Stellar 1-Step',
    method: 'USDT (TRC-20)',
    timeAgo: '1h 24m ago',
  },
  {
    trader: 'Kenji S.',
    country: 'Japan',
    flag: '🇯🇵',
    amount: 42300,
    model: 'Stellar 2-Step',
    method: 'USDT (TRC-20)',
    timeAgo: '2h ago',
  },
]

// ── Verified Trader Testimonials ─────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: 'Ahmed K.',
    location: 'Dubai, UAE',
    flag: '🇦🇪',
    payout: '$52,180',
    model: 'Stellar 2-Step ($200K)',
    quote: 'The 15% profit bonus during Phase 1 and 2 was credited directly to my wallet on my first withdrawal. No other firm in the world gives you a bonus from your demo phase!',
    rating: 5,
  },
  {
    name: 'Sebastian W.',
    location: 'Frankfurt, Germany',
    flag: '🇩🇪',
    payout: '$38,940',
    model: 'Stellar 1-Step ($100K)',
    quote: 'Balance-Based daily drawdown is a lifesaver. On other firms I lost accounts because of trailing equity spikes. Here, 00:00 balance is fixed. 100% fair and transparent.',
    rating: 5,
  },
  {
    name: 'Elena V.',
    location: 'Madrid, Spain',
    flag: '🇪🇸',
    payout: '$29,400',
    model: 'Stellar 2-Step ($100K)',
    quote: 'No time limit allowed me to wait for high-probability swing setups during CPI news. Passed Phase 1 in 14 days and Phase 2 in 8 days. Payout received in 4 hours.',
    rating: 5,
  },
]

// ── FAQ Items Tailored to Cyber Challenger Rules ──────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does the 15% Profit Share in the Challenge Phase work?',
    a: 'We believe traders deserve compensation for their skill from Day 1. When you pass the evaluation (Phase 1 & Phase 2) and make your very first profit withdrawal on your funded simulated account, you receive a bonus payout equal to 15% of all profits made during your challenge phases.',
  },
  {
    q: 'What is Balance-Based Daily Drawdown, and how does it protect me?',
    a: 'Unlike trailing drawdown models that follow your floating equity highs throughout the trading day, our Daily Drawdown is strictly calculated based on your balance at the start of each day (00:00 server time). Floating profits during the day never pull your loss threshold higher.',
  },
  {
    q: 'Is there really No Time Limit on the evaluation phases?',
    a: 'Yes, absolutely. We do not enforce 30-day or 60-day deadlines. You can take as many calendar days, weeks, or months as your strategy requires to reach your profit targets without ticking clocks or rush.',
  },
  {
    q: 'Can I trade high-impact news and hold trades over the weekend?',
    a: 'Yes. On all Stellar models, weekend swing holding and news trading are 100% permitted. You have complete freedom to trade your natural market edge across Forex, Commodities, Indices, and Crypto.',
  },
  {
    q: 'How fast are payouts processed, and what methods are supported?',
    a: 'We disburse approved payouts within 24 hours. Payouts are supported via direct crypto (USDT TRC-20, USDT ERC-20, BTC) or international bank wire transfer.',
  },
  {
    q: 'What is the scaling plan for funded traders?',
    a: 'Consistently profitable traders qualify for our institutional scaling roadmap. Maintain profitability for 4 consecutive months with an average 10% gain, and we increase your simulated capital by 40%, up to a maximum allocation of $2,000,000.',
  },
]

export function TemplateNeon() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const brandTagline = useBranding((s) => s.branding.brand_tagline) || 'Next-Gen Cyber Proprietary Firm'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@launchapropfirm.com'

  // Model & Account Selection
  const [selectedModel, setSelectedModel] = useState<'Stellar 2-Step' | 'Stellar 1-Step' | 'Express'>('Stellar 2-Step')
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>('USD')
  const [selectedSize, setSelectedSize] = useState<number>(100000)
  const [selectedPlatform, setSelectedPlatform] = useState<'MT5' | 'WebTrader'>('MT5')
  const [showNumbers, setShowNumbers] = useState<boolean>(true)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // API Plans
  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)

  useEffect(() => {
    api.challengePlans()
      .then((res) => {
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          const active = res.data.filter((p) => Number(p.is_active) !== 0)
          setPlans(active.length > 0 ? active : FALLBACK_CHALLENGE_PLANS)
        } else {
          setPlans(FALLBACK_CHALLENGE_PLANS)
        }
      })
      .catch(() => {
        setPlans(FALLBACK_CHALLENGE_PLANS)
      })
  }, [])

  const effectivePlans = plans || FALLBACK_CHALLENGE_PLANS

  // Account size options
  const accountSizes = [6000, 15000, 25000, 50000, 100000, 200000]

  // Currency helper
  const currencyMeta = useMemo(() => {
    return CURRENCIES.find((c) => c.key === selectedCurrency) || CURRENCIES[0]
  }, [selectedCurrency])

  const formatCurrencyVal = (amountInUSD: number) => {
    const converted = Math.round(amountInUSD * currencyMeta.rate)
    return `${currencyMeta.symbol}${converted.toLocaleString()}`
  }

  // Model specific parameters
  const modelSpecs = useMemo(() => {
    if (selectedModel === 'Stellar 1-Step') {
      return {
        phases: 1,
        p1TargetPct: 10,
        p2TargetPct: 0,
        dailyLossPct: 3,
        overallLossPct: 6,
        minTradingDays: 2,
        timeLimit: 'Unlimited',
        leverage: '1:100',
        profitSplit: '90%',
        challengeBonus: '15%',
      }
    }
    if (selectedModel === 'Express') {
      return {
        phases: 1,
        p1TargetPct: 25,
        p2TargetPct: 0,
        dailyLossPct: 5,
        overallLossPct: 10,
        minTradingDays: 10,
        timeLimit: 'Unlimited',
        leverage: '1:100',
        profitSplit: '90%',
        challengeBonus: '15%',
      }
    }
    // Stellar 2-Step (Default)
    return {
      phases: 2,
      p1TargetPct: 8,
      p2TargetPct: 5,
      dailyLossPct: 5,
      overallLossPct: 10,
      minTradingDays: 5,
      timeLimit: 'Unlimited',
      leverage: '1:100',
      profitSplit: '90%',
      challengeBonus: '15%',
    }
  }, [selectedModel])

  // Pricing calculation matching prop industry standards
  const calculatedFeeUSD = useMemo(() => {
    // Attempt to find matching plan in loaded API data
    const match = effectivePlans.find((p) => {
      const matchSize = toNum(p.account_size) === selectedSize
      const matchPhases = selectedModel === 'Stellar 2-Step' ? Number(p.phases) === 2 : Number(p.phases) === 1
      return matchSize && matchPhases
    })
    if (match && toNum(match.price) > 0) {
      return toNum(match.price)
    }

    // Standard competitive fee matrix
    const baseMap: Record<number, number> = {
      6000: 59,
      15000: 119,
      25000: 199,
      50000: 299,
      100000: 519,
      200000: 999,
    }
    const base = baseMap[selectedSize] || 519
    if (selectedModel === 'Stellar 1-Step') return Math.round(base * 0.95)
    if (selectedModel === 'Express') return Math.round(base * 0.9)
    return base
  }, [effectivePlans, selectedSize, selectedModel])

  // Matching plan id for direct checkout
  const matchedPlan = useMemo(() => {
    return effectivePlans.find((p) => {
      const matchSize = toNum(p.account_size) === selectedSize
      const matchPhases = selectedModel === 'Stellar 2-Step' ? Number(p.phases) === 2 : Number(p.phases) === 1
      return matchSize && matchPhases
    }) || effectivePlans[0]
  }, [effectivePlans, selectedSize, selectedModel])

  const checkoutUrl = `/checkout?plan=${matchedPlan?.id || ''}&plan_id=${matchedPlan?.id || ''}&size=${selectedSize}&model=${encodeURIComponent(selectedModel)}`

  return (
    <div className="w-full min-h-screen bg-bg text-text transition-colors duration-200 overflow-x-hidden font-sans selection:bg-violet-500 selection:text-white">

      {/* ── 1. CYBER HERO SECTION ────────────────────────────────────────── */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 overflow-hidden border-b border-border/80 dark:border-violet-500/20">
        {/* Cyber Neon ambient backdrop lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-violet-600/20 via-cyan-500/10 to-transparent blur-[130px] pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[110px] pointer-events-none" />

        {/* Cyber Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '36px 36px',
          }}
        />

        <div className="container max-w-7xl mx-auto px-4 relative z-10">
          
          <div className="text-center max-w-4xl mx-auto">
            {/* Top Glowing Pill Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface border border-violet-500/40 shadow-sm text-xs font-semibold text-violet-600 dark:text-violet-300 mb-6 backdrop-blur-md"
            >
              <Zap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 animate-pulse" />
              <span>Next-Gen Cyber Prop Firm • Capital Up to $2,000,000</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </motion.div>

            {/* Hero Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tightest leading-[1.08] text-text"
            >
              Trade Like A Pro. <br />
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
                Earn 15% In The Challenge.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-base sm:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed"
            >
              Pass our transparent simulated evaluation and receive up to $200,000 initial capital. 
              Enjoy <strong className="text-text">Balance-Based Drawdown</strong>, <strong className="text-text">No Time Limits</strong>, and get rewarded from Day 1.
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
              <Button
                asChild
                size="lg"
                className="h-12 px-8 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-violet-600/25 border-0 cursor-pointer"
              >
                <Link href="#challenge-models" className="flex items-center gap-2">
                  <span>Start Stellar Evaluation</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-7 rounded-xl border-border text-text hover:bg-surface-secondary text-sm font-semibold cursor-pointer"
              >
                <Link href="#rules-comparison">Why Traders Choose Us</Link>
              </Button>
            </motion.div>

            {/* Social Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-text-muted"
            >
              <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-xl border border-border shadow-xs">
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <span className="font-bold text-text">4.8 / 5.0 Rating</span>
                <span>• 12,500+ Verified Traders</span>
              </div>
              <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-xl border border-border shadow-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-text">24H Automated Payout SLA</span>
              </div>
            </motion.div>
          </div>

          {/* 4 Feature Pillar Cards */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Pillar 1 */}
            <div className="p-6 rounded-2xl bg-surface border border-border hover:border-violet-500/50 shadow-lg shadow-slate-900/5 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Percent className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text mb-1.5">
                15% Challenge Profit Bonus
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Earn 15% reward on profits generated during Phase 1 &amp; Phase 2 upon your very first funded withdrawal.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-surface border border-border hover:border-cyan-500/50 shadow-lg shadow-slate-900/5 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text mb-1.5">
                No Time Pressure
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Trade at your natural rhythm. Zero calendar deadlines, zero expiration stress. Take all the time you need.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-2xl bg-surface border border-border hover:border-emerald-500/50 shadow-lg shadow-slate-900/5 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text mb-1.5">
                Balance-Based Drawdown
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Calculated strictly from 00:00 server balance. Intra-day high water mark spikes will never breach your account.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="p-6 rounded-2xl bg-surface border border-border hover:border-fuchsia-500/50 shadow-lg shadow-slate-900/5 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text mb-1.5">
                Up to 95% Profit Split
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Start with a guaranteed 90% split from Day 1 and unlock up to 95% lifetime profit share with our scaling plan.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 2. REAL-TIME PAYOUT TICKER & LIVE STREAM ─────────────────────── */}
      <section className="py-8 bg-surface-secondary/40 border-b border-border/80 dark:border-violet-500/20">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Stats Counter Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center sm:text-left w-full md:w-auto">
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">Total Paid Out</div>
                <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  $18,490,200+
                </div>
              </div>
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">Avg. Payout Time</div>
                <div className="text-lg sm:text-xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 tabular-nums">
                  4.8 Hours
                </div>
              </div>
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">Funded Accounts</div>
                <div className="text-lg sm:text-xl font-black font-mono text-violet-600 dark:text-violet-300 mt-0.5 tabular-nums">
                  19,840+
                </div>
              </div>
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">Global Coverage</div>
                <div className="text-lg sm:text-xl font-black font-mono text-text mt-0.5 tabular-nums">
                  145+ Countries
                </div>
              </div>
            </div>

            {/* Live Ticker Tag */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Disbursals Streaming</span>
            </div>

          </div>

          {/* Recent Payout Stream Cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RECENT_PAYOUTS.slice(0, 3).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border shadow-xs text-xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-lg">{p.flag}</span>
                  <div className="truncate">
                    <div className="font-bold text-text truncate">{p.trader}</div>
                    <div className="text-2xs text-text-muted">{p.model} • {p.method}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                    +${p.amount.toLocaleString()}
                  </div>
                  <div className="text-3xs text-text-muted">{p.timeAgo}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 3. INTERACTIVE MULTI-MODEL CHALLENGE SELECTOR ───────────────── */}
      <section id="challenge-models" className="py-20 sm:py-28 relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-2xs font-mono uppercase tracking-wider font-bold text-violet-600 dark:text-violet-300 mb-3">
              Institutional Evaluation Models
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-text tracking-tight">
              Choose Your Stellar Evaluation
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-muted leading-relaxed">
              Tailored for every trading style. Select between 2-Step, 1-Step, or Express, configure your account size, and unlock institutional simulated capital.
            </p>
          </div>

          {/* Model Switcher Tabs (Stellar 2-Step vs 1-Step vs Express) */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1.5 rounded-2xl bg-surface-secondary border border-border gap-1.5 shadow-sm">
              {(['Stellar 2-Step', 'Stellar 1-Step', 'Express'] as const).map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={cn(
                    'px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer',
                    selectedModel === model
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                      : 'text-text-muted hover:text-text hover:bg-surface'
                  )}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Controls: Currency, Platform, Numbers/Percentage */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-surface p-4 rounded-2xl border border-border shadow-xs">
            
            {/* Currency selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-medium">Currency:</span>
              <div className="inline-flex p-1 rounded-xl bg-surface-secondary border border-border">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCurrency(c.key)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                      selectedCurrency === c.key
                        ? 'bg-violet-600 text-white'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    {c.key} ({c.symbol})
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-medium">Platform:</span>
              <div className="inline-flex p-1 rounded-xl bg-surface-secondary border border-border">
                {(['MT5', 'WebTrader'] as const).map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setSelectedPlatform(plat)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                      selectedPlatform === plat
                        ? 'bg-violet-600 text-white'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode Toggle: $ vs % */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-medium">Metrics:</span>
              <button
                onClick={() => setShowNumbers(!showNumbers)}
                className="px-3 py-1 rounded-xl bg-surface-secondary border border-border text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-surface transition-colors cursor-pointer"
              >
                {showNumbers ? 'Show Percentages (%)' : 'Show Dollar Values ($)'}
              </button>
            </div>

          </div>

          {/* Account Size Selector Pills */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3 mb-10">
            {accountSizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={cn(
                  'py-3 sm:py-4 px-2 rounded-2xl border text-center transition-all cursor-pointer font-mono font-bold',
                  selectedSize === size
                    ? 'bg-gradient-to-b from-violet-600 to-indigo-600 text-white border-violet-400 shadow-lg shadow-violet-500/25 scale-[1.02]'
                    : 'bg-surface border-border text-text hover:border-violet-500/50 hover:bg-surface-secondary'
                )}
              >
                <div className="text-2xs opacity-80 uppercase tracking-wider font-sans font-semibold">Account</div>
                <div className="text-sm sm:text-base mt-0.5 tabular-nums font-black">
                  {formatCurrencyVal(size)}
                </div>
              </button>
            ))}
          </div>

          {/* The Objectives Matrix Card */}
          <div className="rounded-3xl bg-surface border border-border dark:border-violet-500/30 shadow-2xl overflow-hidden">
            
            {/* Top Matrix Title Strip */}
            <div className="p-6 sm:p-8 bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-transparent border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-600 text-white text-3xs font-mono font-bold uppercase">
                    {selectedModel}
                  </span>
                  <span className="text-xs text-text-muted font-mono">
                    Target Capital: {formatCurrencyVal(selectedSize)}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-text mt-1">
                  Trading Objectives &amp; Specifications
                </h3>
              </div>

              {/* 15% Bonus Callout Badge */}
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5 text-xs font-bold">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Includes 15% Profit Bonus from Challenge Phase</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="divide-y divide-border/60 text-xs sm:text-sm">
              
              {/* Row: Trading Period */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="font-semibold text-text">Trading Period</span>
                </div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Unlimited (No Time Limit)</span>
                </div>
              </div>

              {/* Row: Minimum Trading Days */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="font-semibold text-text">Minimum Trading Days</span>
                </div>
                <div className="font-bold text-text font-mono tabular-nums">
                  {modelSpecs.minTradingDays} Days
                </div>
              </div>

              {/* Row: Maximum Daily Loss (Balance-Based) */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-cyan-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-text">Maximum Daily Loss</span>
                    <span className="ml-2 text-3xs font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      Balance-Based
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-text tabular-nums">
                  {showNumbers
                    ? formatCurrencyVal((selectedSize * modelSpecs.dailyLossPct) / 100)
                    : `${modelSpecs.dailyLossPct}%`}
                </div>
              </div>

              {/* Row: Maximum Overall Loss */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="font-semibold text-text">Maximum Overall Loss</span>
                </div>
                <div className="text-right font-mono font-bold text-text tabular-nums">
                  {showNumbers
                    ? formatCurrencyVal((selectedSize * modelSpecs.overallLossPct) / 100)
                    : `${modelSpecs.overallLossPct}%`}
                </div>
              </div>

              {/* Row: Phase 1 Profit Target */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-text">Phase 1 Profit Target</span>
                </div>
                <div className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {showNumbers
                    ? formatCurrencyVal((selectedSize * modelSpecs.p1TargetPct) / 100)
                    : `${modelSpecs.p1TargetPct}%`}
                </div>
              </div>

              {/* Row: Phase 2 Profit Target (if applicable) */}
              {modelSpecs.phases > 1 && (
                <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Target className="h-4 w-4 text-teal-500 shrink-0" />
                    <span className="font-semibold text-text">Phase 2 Profit Target</span>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {showNumbers
                      ? formatCurrencyVal((selectedSize * modelSpecs.p2TargetPct) / 100)
                      : `${modelSpecs.p2TargetPct}%`}
                  </div>
                </div>
              )}

              {/* Row: Challenge Phase Profit Share Bonus */}
              <div className="p-4 sm:p-5 flex items-center justify-between bg-violet-500/10">
                <div className="flex items-center gap-2.5">
                  <Award className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="font-bold text-violet-700 dark:text-violet-300">
                    Challenge Phase Bonus Reward
                  </span>
                </div>
                <div className="text-right font-mono font-bold text-violet-600 dark:text-violet-400">
                  15% of Evaluation Profits
                </div>
              </div>

              {/* Row: Funded Profit Split */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <BadgePercent className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-text">Funded Account Profit Split</span>
                </div>
                <div className="font-mono font-bold text-text tabular-nums">
                  Up to {modelSpecs.profitSplit} (Scales to 95%)
                </div>
              </div>

              {/* Row: Leverage */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-text">Maximum Leverage</span>
                </div>
                <div className="font-mono font-bold text-text">
                  {modelSpecs.leverage}
                </div>
              </div>

              {/* Row: News & Weekend Trading */}
              <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-secondary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-text">News Trading &amp; Weekend Holding</span>
                </div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                  Fully Allowed
                </div>
              </div>

              {/* Row: Refundable Registration Fee */}
              <div className="p-4 sm:p-5 flex items-center justify-between bg-surface-secondary/80">
                <div>
                  <div className="font-bold text-text">Registration Fee</div>
                  <div className="text-3xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    100% Refundable with first payout
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black font-mono text-text tabular-nums">
                    {formatCurrencyVal(calculatedFeeUSD)}
                  </div>
                </div>
              </div>

            </div>

            {/* Matrix Action CTA Box */}
            <div className="p-6 sm:p-8 bg-surface-secondary/90 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <div className="text-xs text-text-muted">
                  Ready to trade with <strong className="text-text">{brandName}</strong>?
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  Instant account setup • MT5 Bridge credentials delivered immediately
                </div>
              </div>

              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-violet-600/30 cursor-pointer"
              >
                <Link href={checkoutUrl} className="flex items-center justify-center gap-2">
                  <span>Start {selectedModel} ({formatCurrencyVal(selectedSize)})</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

          </div>

        </div>
      </section>

      {/* ── 4. THE 3 SIGNATURE BREAKTHROUGHS ────────────────────────────── */}
      <section id="breakthroughs" className="py-20 bg-surface-secondary/40 border-y border-border/80 dark:border-violet-500/20 relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-2xs font-mono uppercase tracking-wider font-bold text-violet-600 dark:text-violet-300 mb-3">
              Market-First Innovations
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-text tracking-tight">
              Why Traders Switch To Us
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-muted leading-relaxed">
              We eliminated the restrictive rules that traditional prop firms use to trap traders. Built by traders, for traders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            
            {/* Card 1: 15% Bonus */}
            <div className="p-8 rounded-3xl bg-surface border border-border hover:border-violet-500/60 shadow-xl relative overflow-hidden group transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-6">
                <Percent className="h-7 w-7" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-mono text-3xs font-bold mb-3 uppercase">
                Signature Feature
              </div>
              <h3 className="text-xl font-black text-text mb-3">
                15% Profit Bonus in Challenge Phase
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Why trade for free while being tested? If you make $8,000 in Phase 1 and $5,000 in Phase 2 on a $100K account, you earn an extra <strong className="text-text">$1,950 bonus</strong> paid directly to your wallet on your first funded payout.
              </p>
            </div>

            {/* Card 2: Balance-Based DD */}
            <div className="p-8 rounded-3xl bg-surface border border-border hover:border-cyan-500/60 shadow-xl relative overflow-hidden group transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-600/10 rounded-full blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-6">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono text-3xs font-bold mb-3 uppercase">
                Zero Trailing Traps
              </div>
              <h3 className="text-xl font-black text-text mb-3">
                Balance-Based Daily Drawdown
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Trailing high-water mark drawdown fails traders when a winning trade retraces intra-day. Our daily drawdown recalculates strictly at <strong className="text-text">00:00 server time</strong> on your closed account balance. Clear, predictable, and fair.
              </p>
            </div>

            {/* Card 3: No Time Limit */}
            <div className="p-8 rounded-3xl bg-surface border border-border hover:border-emerald-500/60 shadow-xl relative overflow-hidden group transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6">
                <Clock className="h-7 w-7" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-3xs font-bold mb-3 uppercase">
                Stress-Free Trading
              </div>
              <h3 className="text-xl font-black text-text mb-3">
                Unlimited Trading Days
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Rushing leads to over-leveraging and emotional loss. Trade only when your high-conviction setup appears. You have infinite calendar time to complete all evaluation phases.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 5. HEAD-TO-HEAD COMPARISON MATRIX ────────────────────────────── */}
      <section id="rules-comparison" className="py-20 sm:py-28">
        <div className="container max-w-5xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-2xs font-mono uppercase tracking-wider font-bold text-violet-600 dark:text-violet-300 mb-3">
              The Transparent Choice
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-text tracking-tight">
              {brandName} vs Other Prop Firms
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-muted">
              See the numbers side-by-side and decide who gives you the highest probability of passing and getting paid.
            </p>
          </div>

          <div className="rounded-3xl bg-surface border border-border dark:border-violet-500/30 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary/80">
                    <th className="p-4 sm:p-5 font-bold text-text">Key Feature</th>
                    <th className="p-4 sm:p-5 font-black text-violet-600 dark:text-violet-400 bg-violet-500/10">
                      {brandName}
                    </th>
                    <th className="p-4 sm:p-5 font-bold text-text-muted">Traditional Firms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  
                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      15% Challenge Phase Profit Share
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-violet-500/5">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Check className="h-4 w-4" /> YES (15% Bonus)
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-rose-500 font-mono">NO (0%)</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Daily Drawdown Calculation
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-violet-500/5 font-mono">
                      Balance-Based (Fixed at 00:00)
                    </td>
                    <td className="p-4 sm:p-5 text-rose-500 font-mono">Equity High Trailing Trap</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Evaluation Time Limit
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-violet-500/5 font-mono">
                      No Limit (Unlimited Days)
                    </td>
                    <td className="p-4 sm:p-5 text-text-muted font-mono">30 - 60 Days Deadline</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      News Trading &amp; Weekend Holding
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-violet-500/5 font-mono">
                      Fully Permitted
                    </td>
                    <td className="p-4 sm:p-5 text-rose-500 font-mono">Restricted or Prohibited</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Automated Payout Guarantee
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-violet-500/5 font-mono">
                      Under 24 Hours
                    </td>
                    <td className="p-4 sm:p-5 text-text-muted font-mono">7 - 14 Days Approval</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Maximum Scaling Capital
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-violet-500/5 font-mono">
                      Up to $2,000,000
                    </td>
                    <td className="p-4 sm:p-5 text-text-muted font-mono">Capped at $400,000</td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. VERIFIED TESTIMONIALS & PAYOUT PROOF ──────────────────────── */}
      <section className="py-20 bg-surface-secondary/40 border-y border-border/80 dark:border-violet-500/20">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-2xs font-mono uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 mb-3">
              Verified Trader Stories
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-text tracking-tight">
              Real Traders. Real Payouts.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-muted">
              Thousands of disciplined traders worldwide rely on our execution and celebrate prompt disbursements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="p-6 sm:p-8 rounded-3xl bg-surface border border-border hover:border-violet-500/30 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{t.flag}</span>
                      <div>
                        <div className="font-bold text-text text-sm sm:text-base">{t.name}</div>
                        <div className="text-3xs text-text-muted">{t.location}</div>
                      </div>
                    </div>
                    <div className="flex items-center text-amber-500">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed italic mb-6">
                    "{t.quote}"
                  </p>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-mono">
                  <span className="text-text-muted">{t.model}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    Paid: {t.payout}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 7. FAQ ACCORDION ─────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="container max-w-4xl mx-auto px-4">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-2xs font-mono uppercase tracking-wider font-bold text-violet-600 dark:text-violet-300 mb-3">
              Clear Guidelines
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-text tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-text-muted">
              Everything you need to know about our Stellar evaluation models, 15% challenge profit bonus, and daily drawdown math.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-surface border border-border overflow-hidden shadow-xs"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-text transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-violet-500 transition-transform duration-200 shrink-0',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-text-muted leading-relaxed border-t border-border pt-4">
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

      {/* ── 8. HIGH-IMPACT CLOSING CYBER CTA ─────────────────────────────── */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-transparent via-violet-600/5 to-violet-600/10 dark:via-violet-950/20 dark:to-[#0A061E]">
        <div className="container max-w-5xl mx-auto px-4 relative z-10">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 text-white text-center shadow-2xl relative overflow-hidden">
            
            {/* Cyber Neon decorative light flares */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-300/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-fuchsia-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="px-3 py-1 rounded-full bg-white/20 text-white text-2xs font-mono font-bold uppercase tracking-wider backdrop-blur-md">
                Launch Your Career Today
              </span>
              <h2 className="text-3xl sm:text-5xl font-black mt-4 tracking-tight leading-tight">
                Get Funded Up to $2,000,000.
              </h2>
              <p className="mt-4 text-xs sm:text-base text-violet-100 leading-relaxed">
                Take the challenge with zero time limits, balance-based drawdown, and earn a 15% profit bonus on your evaluation once funded.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-8 rounded-xl bg-white text-slate-950 hover:bg-slate-100 font-bold text-sm shadow-xl cursor-pointer"
                >
                  <Link href="#challenge-models">
                    <span>Choose Evaluation Size</span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 rounded-xl border-white/30 text-white hover:bg-white/10 text-sm font-semibold cursor-pointer"
                >
                  <Link href={`mailto:${supportEmail}`}>Contact Desk</Link>
                </Button>
              </div>

              <div className="mt-8 flex items-center justify-center gap-6 text-2xs text-violet-100/80 font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" /> 100% Refundable Fee
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" /> Instant MT5 Credentials
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  )
}
