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
  BookOpen,
  Zap,
  Monitor,
  Flame,
  BadgePercent,
  Play
} from 'lucide-react'

// ── Currency definitions & rates ──────────────────────────────────────────────
type CurrencyKey = 'USD' | 'EUR' | 'GBP'

const CURRENCIES: { key: CurrencyKey; symbol: string; rate: number }[] = [
  { key: 'USD', symbol: '$', rate: 1.0 },
  { key: 'EUR', symbol: '€', rate: 0.92 },
  { key: 'GBP', symbol: '£', rate: 0.79 },
]

// ── Verified Trader Testimonials (FTMO Style Social Proof) ────────────────────
const TESTIMONIALS = [
  {
    name: 'Maik',
    country: 'Germany',
    flag: '🇩🇪',
    rewards: '$114,907',
    style: 'Swing Trader',
    views: '81K Views',
    quote: 'The evaluation rules are 100% transparent. No trailing traps, no hidden limits. Payouts arrive in under 8 hours.',
  },
  {
    name: 'Cinthya',
    country: 'Ecuador',
    flag: '🇪🇨',
    rewards: '$41,018',
    style: 'Day Trader',
    views: '62K Views',
    quote: 'Passing Phase 1 and 2 was smooth because of the unlimited trading period. It allows you to wait for quality setups.',
  },
  {
    name: 'Bjorn',
    country: 'Belgium',
    flag: '🇧🇪',
    rewards: '$40,931',
    style: 'Swing Trader',
    views: '56K Views',
    quote: 'The MetriX dashboard gives you full clarity on daily loss and drawdown. Best prop firm platform I have ever traded on.',
  },
  {
    name: 'Ugnius',
    country: 'Lithuania',
    flag: '🇱🇹',
    rewards: '$99,706',
    style: 'Day Trader',
    views: '93K Views',
    quote: 'Scaling from $100K to $200K funded was seamless. The 90% profit split and fee reimbursement were paid without hesitation.',
  },
  {
    name: 'Richard',
    country: 'Canada',
    flag: '🇨🇦',
    rewards: '$32,500',
    style: 'Scalper',
    views: '119K Views',
    quote: 'Execution latency is zero. Raw spreads on XAUUSD and EURUSD let me scalp news events without slippage.',
  },
  {
    name: 'Andi',
    country: 'United Kingdom',
    flag: '🇬🇧',
    rewards: '$37,676',
    style: 'Day Trader',
    views: '83K Views',
    quote: 'Customer support answered in 45 seconds on live chat. Truly the gold standard for proprietary trading.',
  },
]

// ── Platform Badges & Authority Proof ─────────────────────────────────────────
const AUTHORITY_BRANDS = [
  { name: 'Forbes', subtitle: 'Featured in Business' },
  { name: 'Bloomberg', subtitle: 'Market Technology' },
  { name: 'Finance Magnates', subtitle: 'FinTech Innovation' },
  { name: 'Deloitte Fast 50', subtitle: 'Top Tier FinTech' },
  { name: 'Entrepreneur Of Year', subtitle: 'Global Winner' },
]

export function TemplateFtmo() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'AlphaCapital'
  const brandTagline = useBranding((s) => s.branding.brand_tagline) || 'The Modern Prop Trading Firm'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@alphacapital.com'
  const discordUrl = useBranding((s) => s.branding.discord_url) || 'https://discord.gg'
  const youtubeUrl = useBranding((s) => s.branding.youtube_url) || 'https://youtube.com'

  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>('USD')
  const [selectedModel, setSelectedModel] = useState<string>('2-Step')
  const [selectedSize, setSelectedSize] = useState<number>(100000)
  const [showNumbers, setShowNumbers] = useState<boolean>(true)
  const [activeObjectiveModal, setActiveObjectiveModal] = useState<string | null>(null)

  // Load plans from API or gracefully fallback
  useEffect(() => {
    api.challengePlans().then((res) => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const active = res.data.filter((p) => Number(p.is_active) !== 0)
        setPlans(active.length > 0 ? active : FALLBACK_CHALLENGE_PLANS)
      } else {
        setPlans(FALLBACK_CHALLENGE_PLANS)
      }
    }).catch(() => {
      setPlans(FALLBACK_CHALLENGE_PLANS)
    })
  }, [])

  const effectivePlans = plans || FALLBACK_CHALLENGE_PLANS

  // Model selection (2-Step vs 1-Step)
  const availableModels = useMemo(() => {
    const models = new Set<string>()
    effectivePlans.forEach((p) => {
      if (Number(p.phases) === 1) models.add('1-Step')
      else if (Number(p.phases) === 2) models.add('2-Step')
      else if (Number(p.phases) === 3) models.add('3-Step')
    })
    const order = ['2-Step', '1-Step', '3-Step']
    const result = Array.from(models).sort((a, b) => order.indexOf(a) - order.indexOf(b))
    return result.length > 0 ? result : ['2-Step', '1-Step']
  }, [effectivePlans])

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0])
    }
  }, [availableModels, selectedModel])

  // Filter plans for the chosen model
  const filteredPlans = useMemo(() => {
    return effectivePlans.filter((p) => {
      if (selectedModel === '1-Step') return Number(p.phases) === 1
      if (selectedModel === '2-Step') return Number(p.phases) === 2
      if (selectedModel === '3-Step') return Number(p.phases) === 3
      return true
    }).sort((a, b) => toNum(a.account_size) - toNum(b.account_size))
  }, [effectivePlans, selectedModel])

  // Extract unique account sizes
  const accountSizes = useMemo(() => {
    const sizes = new Set<number>()
    filteredPlans.forEach((p) => sizes.add(toNum(p.account_size)))
    const list = Array.from(sizes).sort((a, b) => a - b)
    return list.length > 0 ? list : [10000, 25000, 50000, 100000, 200000]
  }, [filteredPlans])

  useEffect(() => {
    if (accountSizes.length > 0 && !accountSizes.includes(selectedSize)) {
      setSelectedSize(accountSizes.includes(100000) ? 100000 : accountSizes[accountSizes.length - 1])
    }
  }, [accountSizes, selectedSize])

  // Active Selected Plan
  const activePlan = useMemo(() => {
    const match = filteredPlans.find((p) => toNum(p.account_size) === selectedSize)
    return match || filteredPlans[0] || effectivePlans[0]
  }, [filteredPlans, selectedSize, effectivePlans])

  // Currency conversion helpers
  const currencyMeta = useMemo(() => {
    return CURRENCIES.find((c) => c.key === selectedCurrency) || CURRENCIES[0]
  }, [selectedCurrency])

  const formatCurrencyVal = (amountInUSD: number) => {
    const converted = Math.round(amountInUSD * currencyMeta.rate)
    return `${currencyMeta.symbol}${converted.toLocaleString()}`
  }

  // Calculated numbers for active plan
  const sizeUSD = toNum(activePlan?.account_size || 100000)
  const p1TargetPct = toNum(activePlan?.p1_profit_target || (selectedModel === '1-Step' ? 10 : 8))
  const p2TargetPct = toNum(activePlan?.p2_profit_target || 5)
  const dailyDDPct = toNum(activePlan?.p1_daily_dd || 5)
  const maxDDPct = toNum(activePlan?.p1_max_dd || 10)
  const profitSplitPct = toNum(activePlan?.funded_profit_split || 80)
  const minTradingDays = Number(activePlan?.p1_min_days || 4)
  const rawPriceUSD = toNum(activePlan?.price || (sizeUSD >= 100000 ? 540 : 250))
  const discountedPriceUSD = Math.round(rawPriceUSD * 0.8) // 20% promotional offer

  return (
    <div className="w-full bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200 overflow-x-hidden font-sans">
      
      {/* ── 1. The Industry Titan Hero Section ────────────────────────── */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden border-b border-border/40">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-blue-600/10 via-emerald-500/5 to-transparent blur-[140px] pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 relative z-10 text-center">
          
          {/* Top Pill Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border/80 shadow-sm text-xs font-semibold text-text-muted mb-6"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Modern Prop Trading Platform • Standard of the Industry</span>
          </motion.div>

          {/* Grand Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tightest leading-[1.05] max-w-5xl mx-auto"
          >
            Grow &amp; Monetize <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Your Demo Trading
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-base sm:text-xl text-text-muted max-w-3xl mx-auto leading-relaxed"
          >
            Improve your trading skills on {brandName}’s institutional simulated platform. 
            Pass the evaluation to unlock up to $200,000 in funded capital and receive up to 90% in performance-based rewards.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Button asChild size="lg" className="h-13 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/20 cursor-pointer">
              <Link href="/challenges" className="flex items-center gap-2">
                <span>Trade with {brandName}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-13 px-8 rounded-xl border-border hover:border-text-muted text-text hover:bg-surface-secondary text-sm font-semibold cursor-pointer">
              <Link href="#pricing">Free Trial &amp; Rules</Link>
            </Button>
          </motion.div>

          {/* Trustpilot & Social Proof Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-text-muted"
          >
            <div className="flex items-center gap-2 bg-surface/70 px-4 py-2 rounded-xl border border-border/60">
              <div className="flex items-center text-emerald-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                ))}
              </div>
              <span className="font-bold text-text">Trustpilot</span>
              <span className="font-semibold text-text">4.8 / 5.0</span>
              <span className="text-text-muted">based on 16,000+ reviews</span>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5 font-semibold text-text">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                $650,000,000+ Disbursed
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5 font-semibold text-text">
                <Globe className="h-4 w-4 text-blue-500" />
                140+ Countries Supported
              </span>
            </div>
          </motion.div>

          {/* Promotional Banner Card */}
          <div className="mt-12 max-w-4xl mx-auto rounded-2xl bg-gradient-to-r from-orange-500/10 via-surface to-blue-500/10 border border-orange-500/30 p-5 sm:p-6 text-left relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-bold text-2xs uppercase tracking-wider mb-2">
                  <Flame className="h-3 w-3" />
                  <span>Limited Time Incentive</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-text">
                  Special Evaluation Deal: 100% Fee Refund + 90% Profit Split
                </h2>
                <p className="text-xs sm:text-sm text-text-muted mt-1">
                  Complete your evaluation phase at your own pace. Your challenge fee is completely reimbursed with your first eligible payout.
                </p>
              </div>
              <Button asChild className="h-10 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shrink-0 cursor-pointer">
                <Link href="/challenges">
                  Claim Offer →
                </Link>
              </Button>
            </div>
          </div>

          {/* Authority Logos Bar */}
          <div className="mt-12 pt-8 border-t border-border/40 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
            {AUTHORITY_BRANDS.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-surface/50 border border-border/40 text-center">
                <div className="font-black text-sm tracking-wide text-text">{item.name}</div>
                <div className="text-3xs text-text-muted mt-0.5 uppercase tracking-wider">{item.subtitle}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 2. Why People Choose Us (Value Pillars) ───────────────────── */}
      <section className="py-16 sm:py-24 bg-surface-secondary/30 border-b border-border/40">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-text">
              Why Traders Choose {brandName}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-muted">
              Built by traders for traders. We engineered the fairest prop firm framework with institutional grade reliability.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Rewards */}
            <div className="rounded-2xl p-6 bg-surface border border-border hover:border-blue-500/40 transition-all shadow-sm group">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">Fast Rewards</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Bi-weekly fast disbursals to crypto wallets or direct wire transfer. Keep up to 90% of all simulated gains without withdrawal caps.
              </p>
            </div>

            {/* Card 2: Advanced Support */}
            <div className="rounded-2xl p-6 bg-surface border border-border hover:border-emerald-500/40 transition-all shadow-sm group">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Headphones className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">24/7 Dedicated Support</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Multilingual human support desk with average response time under 60 seconds via Live Chat, Discord, and Email.
              </p>
            </div>

            {/* Card 3: Tools & Services */}
            <div className="rounded-2xl p-6 bg-surface border border-border hover:border-purple-500/40 transition-all shadow-sm group">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">Account MetriX</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Real-time drawdown meters, Equity Simulator, Trading Journal, and Economic News Calendar integrated right into your portal.
              </p>
            </div>

            {/* Card 4: Free Trial */}
            <div className="rounded-2xl p-6 bg-surface border border-border hover:border-amber-500/40 transition-all shadow-sm group">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">Free Trial Strategy</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Test your trading strategy and explore platform conditions with unlimited free trial accounts before putting real skin in the game.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. The Iconic FTMO Trading Objectives Matrix ─────────────── */}
      <section id="pricing" className="py-16 sm:py-24 border-b border-border/40 relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-text">
              Choose Your {brandName} Challenge
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-muted">
              Complete {brandName}’s Trading Objectives to become eligible to gain your funded demo rewards account.
            </p>
          </div>

          {/* Model Switcher & Currency Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-5xl mx-auto mb-8">
            
            {/* Step Selection Tabs (2-Step vs 1-Step) */}
            <div className="inline-flex p-1 rounded-xl bg-surface-secondary border border-border w-full md:w-auto">
              {availableModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={cn(
                    'flex-1 md:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    selectedModel === m
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  )}
                >
                  {m} Evaluation
                </button>
              ))}
            </div>

            {/* Currency & Numbers Toggle */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {/* Show Numbers Toggle */}
              <button
                onClick={() => setShowNumbers(!showNumbers)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-2xs font-bold text-text-muted hover:text-text cursor-pointer transition-colors"
                title="Toggle between absolute currency numbers and percentages"
              >
                <BadgePercent className="h-3.5 w-3.5" />
                <span>{showNumbers ? 'Showing: Numbers ($)' : 'Showing: Percentages (%)'}</span>
              </button>

              {/* Currency Picker */}
              <div className="inline-flex p-1 rounded-xl bg-surface-secondary border border-border">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCurrency(c.key)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer',
                      selectedCurrency === c.key
                        ? 'bg-surface text-text shadow-xs border border-border'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    {c.key}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Account Size Selection Buttons */}
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mb-8">
            {accountSizes.map((size) => {
              const isSelected = selectedSize === size
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center',
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500 shadow-md ring-1 ring-blue-500/30'
                      : 'bg-surface border-border hover:border-text-muted/40 hover:bg-surface-secondary'
                  )}
                >
                  <span className={cn('text-base sm:text-lg font-black terminal-num', isSelected ? 'text-blue-500 font-extrabold' : 'text-text')}>
                    {formatCurrencyVal(size)}
                  </span>
                  <span className="text-3xs font-semibold text-text-muted uppercase tracking-wider mt-0.5">
                    Account Size
                  </span>
                </button>
              )
            })}
          </div>

          {/* The Trading Objectives Table (Desktop & Tablet) */}
          <div className="max-w-5xl mx-auto rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
            
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-surface-secondary/80 py-4 px-4 sm:px-6 border-b border-border text-xs font-bold uppercase tracking-wider text-text">
              <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5">
                <span>Trading Objectives</span>
              </div>
              <div className="col-span-2 sm:col-span-2 text-center text-blue-500 font-extrabold">
                {selectedModel === '1-Step' ? 'Challenge' : 'Step 1: Challenge'}
              </div>
              {selectedModel !== '1-Step' ? (
                <div className="col-span-2 sm:col-span-3 text-center text-teal-500 font-extrabold">
                  Step 2: Verification
                </div>
              ) : (
                <div className="col-span-2 sm:col-span-3 text-center text-text-muted">
                  —
                </div>
              )}
              <div className="col-span-3 sm:col-span-3 text-right sm:text-center text-emerald-500 font-extrabold">
                {brandName} Trader
              </div>
            </div>

            {/* Matrix Rows */}
            <div className="divide-y divide-border/60 text-xs font-medium">
              
              {/* Row 1: Trading Period */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <Clock className="h-4 w-4 text-text-muted shrink-0" />
                  <span>Trading Period</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-text">
                  Unlimited
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-text">
                  {selectedModel === '1-Step' ? '—' : 'Unlimited'}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-emerald-500">
                  Unlimited
                </div>
              </div>

              {/* Row 2: Minimum Trading Days */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <Activity className="h-4 w-4 text-text-muted shrink-0" />
                  <span>Minimum Trading Days</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-text">
                  {minTradingDays} Days
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-text">
                  {selectedModel === '1-Step' ? '—' : `${minTradingDays} Days`}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-emerald-500">
                  None (0 Days)
                </div>
              </div>

              {/* Row 3: Maximum Daily Loss */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-text-muted shrink-0" />
                  <span>Maximum Daily Loss</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-text terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-text terminal-num">
                  {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`)}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-text terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                </div>
              </div>

              {/* Row 4: Maximum Loss */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-text-muted shrink-0" />
                  <span>Maximum Loss (100% Static)</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-text terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-text terminal-num">
                  {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`)}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-emerald-500 terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                </div>
              </div>

              {/* Row 5: Profit Target */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors bg-blue-500/5">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="font-bold text-text">Profit Target</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-extrabold text-blue-500 terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (p1TargetPct / 100)) : `${p1TargetPct}%`}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-extrabold text-teal-500 terminal-num">
                  {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (p2TargetPct / 100)) : `${p2TargetPct}%`)}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-extrabold text-emerald-500">
                  None (No Target)
                </div>
              </div>

              {/* Row 6: Refundable Fee */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <Award className="h-4 w-4 text-text-muted shrink-0" />
                  <span>Refundable Fee</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-text terminal-num">
                  {formatCurrencyVal(rawPriceUSD)}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-text">
                  {selectedModel === '1-Step' ? '—' : 'Free'}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-emerald-500">
                  100% Refunded
                </div>
              </div>

              {/* Row 7: Profit Split */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-surface-secondary/40 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-text flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-text-muted shrink-0" />
                  <span>Profit Split</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center text-text-muted">
                  —
                </div>
                <div className="col-span-2 sm:col-span-3 text-center text-text-muted">
                  —
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-extrabold text-profit">
                  {profitSplitPct}% → 90%
                </div>
              </div>

            </div>

            {/* Pricing Footer CTA Bar */}
            <div className="bg-surface-secondary p-5 sm:p-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <div className="text-xs text-text-muted">
                  One-time refundable fee for <span className="font-bold text-text">{formatCurrencyVal(sizeUSD)}</span> account:
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-text terminal-num">
                    {formatCurrencyVal(discountedPriceUSD)}
                  </span>
                  <span className="text-xs text-text-muted line-through terminal-num">
                    {formatCurrencyVal(rawPriceUSD)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-3xs uppercase">
                    100% Refunded on 1st Payout
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button asChild size="lg" className="w-full sm:w-auto h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md cursor-pointer">
                  <Link href={`/checkout?plan=${encodeURIComponent(String(activePlan?.id || sizeUSD))}`}>
                    <span>Start {brandName} Challenge</span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 4. Trust Metrics & Verified Trader Stories ────────────────── */}
      <section className="py-16 sm:py-24 bg-surface-secondary/20 border-b border-border/40">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-text">
              Trusted by Millions of Traders
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-16">
              <div>
                <div className="text-3xl sm:text-4xl font-black text-text terminal-num">4.5M+</div>
                <div className="text-xs sm:text-sm text-text-muted mt-0.5">Customers Worldwide</div>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-500 terminal-num">$650M+</div>
                <div className="text-xs sm:text-sm text-text-muted mt-0.5">Paid in Rewards</div>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div>
                <div className="text-3xl sm:text-4xl font-black text-blue-500 terminal-num">140+</div>
                <div className="text-xs sm:text-sm text-text-muted mt-0.5">Countries Served</div>
              </div>
            </div>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-6 bg-surface border border-border shadow-sm flex flex-col justify-between hover:border-text-muted/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{t.flag}</span>
                      <div>
                        <div className="font-bold text-sm text-text">{t.name}</div>
                        <div className="text-2xs text-text-muted">{t.country}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-3xs font-bold flex items-center gap-1">
                      <Play className="h-2.5 w-2.5 fill-blue-500" />
                      {t.views}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted italic leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/80 flex items-center justify-between text-2xs">
                  <div>
                    <div className="text-3xs uppercase tracking-wider text-text-muted">Rewards Disbursed</div>
                    <div className="font-black text-sm text-profit terminal-num mt-0.5">{t.rewards}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xs uppercase tracking-wider text-text-muted">Trading Style</div>
                    <div className="font-semibold text-text mt-0.5">{t.style}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 5. How It Works (Step 1 -> Step 2 -> Funded Account) ──────── */}
      <section className="py-16 sm:py-24 border-b border-border/40">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-text">
              How It Works
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-muted">
              Three simple steps to becoming a funded trader with {brandName}.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            {/* Step 1 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-surface border border-border shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-4 right-4 text-4xl font-black text-text-muted/15 terminal-num">
                01
              </div>
              <div>
                <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-500 font-bold text-2xs uppercase tracking-wider">
                  Phase 1
                </span>
                <h3 className="text-xl font-extrabold text-text mt-4 mb-2">
                  Prove Your Skills
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Trade on your own schedule with no maximum time limits. Reach the profit target while managing risk within our 100% static drawdown limits.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-2xs font-semibold text-blue-500 flex items-center gap-1">
                <span>Profit Target: 8% - 10%</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-surface border border-border shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-4 right-4 text-4xl font-black text-text-muted/15 terminal-num">
                02
              </div>
              <div>
                <span className="px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-500 font-bold text-2xs uppercase tracking-wider">
                  Phase 2
                </span>
                <h3 className="text-xl font-extrabold text-text mt-4 mb-2">
                  Verification
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Confirm your profitability and risk consistency. The profit target is halved to 5%, giving you a relaxed path to complete your validation.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-2xs font-semibold text-teal-500 flex items-center gap-1">
                <span>Profit Target: 5% Only</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-surface border border-emerald-500/40 shadow-sm flex flex-col justify-between relative overflow-hidden ring-1 ring-emerald-500/20">
              <div className="absolute top-4 right-4 text-4xl font-black text-emerald-500/20 terminal-num">
                03
              </div>
              <div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-500 font-bold text-2xs uppercase tracking-wider">
                  Funded Status
                </span>
                <h3 className="text-xl font-extrabold text-text mt-4 mb-2">
                  Earn Real Rewards
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  You are now an official {brandName} Trader. Keep up to 90% of all simulated profits and receive 100% reimbursement of your evaluation fee with your first payout.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-2xs font-semibold text-profit flex items-center gap-1">
                <span>Up to 90% Profit Share + Fee Refund</span>
              </div>
            </div>

          </div>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm cursor-pointer shadow-md">
              <Link href="/challenges">
                <span>Start Your Evaluation Today</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>

        </div>
      </section>

      {/* ── 6. Trading Platforms & Technology Ecosystem ──────────────── */}
      <section className="py-16 sm:py-24 bg-surface-secondary/30 border-b border-border/40">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="grid lg:grid-cols-12 gap-12 items-center max-w-6xl mx-auto">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold">
                <Monitor className="h-3.5 w-3.5" />
                <span>Multi-Platform Freedom</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-text leading-tight">
                We Support All Major Industry Platforms
              </h2>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed">
                At {brandName}, we give you options. Pick the professional trading terminal that suits your style best — whether you trade on desktop, browser, or mobile.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-text">MetaTrader 5 (MT5) Desktop &amp; Mobile</div>
                    <div className="text-xs text-text-muted">The worldwide industry standard with custom EAs, indicators, and DOM order execution.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-text">Live WebTrader Terminal (Zero Install)</div>
                    <div className="text-xs text-text-muted">Trade directly inside any web browser with high-frequency tick streaming and 1-click orders.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-text">cTrader &amp; Institutional FIX API</div>
                    <div className="text-xs text-text-muted">Advanced depth-of-market quotes and ultra-fast 14ms execution bridged to Equinix LD4.</div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button asChild variant="outline" className="h-11 px-6 rounded-xl border-border text-text hover:bg-surface-secondary cursor-pointer">
                  <Link href="/dashboard/trading">
                    Launch Live WebTrader Demo →
                  </Link>
                </Button>
              </div>
            </div>

            {/* Platform Visual Showcase Box */}
            <div className="lg:col-span-6 rounded-2xl bg-surface border border-border p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/80">
                <span className="font-bold text-sm text-text">Execution Telemetry</span>
                <span className="flex items-center gap-1.5 text-2xs text-emerald-500 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Equinix LD4 London
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-secondary border border-border/60">
                  <div className="text-2xs text-text-muted uppercase">Average Latency</div>
                  <div className="text-2xl font-black text-text terminal-num mt-1">14ms</div>
                  <div className="text-3xs text-emerald-500 mt-0.5 font-semibold">Zero Requotes</div>
                </div>
                <div className="p-4 rounded-xl bg-surface-secondary border border-border/60">
                  <div className="text-2xs text-text-muted uppercase">EURUSD Spread</div>
                  <div className="text-2xl font-black text-text terminal-num mt-1">0.1 pips</div>
                  <div className="text-3xs text-blue-500 mt-0.5 font-semibold">Raw Liquidity</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-text-muted space-y-2">
                <div className="font-bold text-text flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  <span>No Arbitrary News or Weekend Restrictions</span>
                </div>
                <p className="text-2xs leading-relaxed">
                  Hold trades over the weekend and execute during major macroeconomic releases without arbitrary bans or margin multiplier hikes.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 7. High-Converting Closing Call to Action ────────────────── */}
      <section className="py-20 bg-gradient-to-b from-surface to-surface-secondary/80">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          
          <h2 className="text-3xl sm:text-5xl font-black text-text mb-4">
            Ready to Prove Your Skills with <span className="text-blue-500">{brandName}</span>?
          </h2>
          
          <p className="text-base text-text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            Join disciplined traders across 140+ countries. Zero time pressure, guaranteed static drawdown floor, and fast bi-weekly payouts directly to your wallet.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="h-13 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/20 cursor-pointer">
              <Link href="/challenges" className="flex items-center gap-2">
                <span>Start Your Evaluation</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-13 px-8 rounded-xl border-border hover:border-text-muted text-text hover:bg-surface-secondary text-sm font-semibold cursor-pointer">
              <Link href="/faq">Read Trading Rules</Link>
            </Button>
          </div>

        </div>
      </section>

    </div>
  )
}
