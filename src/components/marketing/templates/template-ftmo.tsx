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
  Play,
  Rocket,
  SlidersHorizontal,
  FileText,
  Calendar,
  LineChart,
  Lock,
  ExternalLink,
  ChevronDown
} from 'lucide-react'

// ── Currency definitions & rates ──────────────────────────────────────────────
type CurrencyKey = 'USD' | 'EUR' | 'GBP'

const CURRENCIES: { key: CurrencyKey; symbol: string; rate: number; label: string; flag: string }[] = [
  { key: 'USD', symbol: '$', rate: 1.0, label: 'USD', flag: '🇺🇸' },
  { key: 'GBP', symbol: '£', rate: 0.79, label: 'GBP', flag: '🇬🇧' },
  { key: 'EUR', symbol: '€', rate: 0.92, label: 'EUR', flag: '🇪🇺' },
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

// ── Trustpilot Reviews Grid (FTMO Style) ──────────────────────────────────────
const TRUSTPILOT_REVIEWS = [
  {
    name: 'Alexandre M.',
    rating: 5,
    date: '2 days ago',
    title: 'Super fast payout on crypto',
    review: 'Requested my profit split on Tuesday morning, approved by noon, USDT in my wallet by 4 PM. Unmatched service.',
  },
  {
    name: 'Sarah K.',
    rating: 5,
    date: '3 days ago',
    title: 'Fair evaluation rules without gimmicks',
    review: 'Having unlimited time takes all the anxiety away. You trade like a professional instead of gambling against the clock.',
  },
  {
    name: 'Dmitri V.',
    rating: 5,
    date: '5 days ago',
    title: 'Account MetriX is the best tool',
    review: 'Live floating drawdown warning and equity curves keep you strictly disciplined. Helped me pass Phase 2 on first try.',
  },
  {
    name: 'Liam P.',
    rating: 5,
    date: '1 week ago',
    title: 'Customer support 10/10',
    review: 'Answered my question about news trading in seconds. Very clear guidelines and zero slippery terms.',
  },
]

// ── Platform Badges & Authority Proof ─────────────────────────────────────────
const AUTHORITY_BRANDS = [
  { name: 'EY Entrepreneur Of The Year', subtitle: 'Global Winner' },
  { name: 'Forbes', subtitle: 'Featured in Business' },
  { name: 'Deloitte Fast 50', subtitle: 'Top Tier FinTech' },
  { name: 'Finance Magnates', subtitle: 'FinTech Innovation' },
]

export function TemplateFtmo() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const brandTagline = useBranding((s) => s.branding.brand_tagline) || 'Modern Prop Trading'
  const supportEmail = useBranding((s) => s.branding.support_email) || 'support@launchapropfirm.com'

  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>('USD')
  const [selectedModel, setSelectedModel] = useState<'2-Step' | '1-Step'>('2-Step')
  const [selectedSize, setSelectedSize] = useState<number>(200000)
  const [showNumbers, setShowNumbers] = useState<boolean>(true)
  const [hidePhases, setHidePhases] = useState<boolean>(false)

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

  // Filter plans for the chosen model
  const filteredPlans = useMemo(() => {
    return effectivePlans.filter((p) => {
      if (selectedModel === '1-Step') return Number(p.phases) === 1
      if (selectedModel === '2-Step') return Number(p.phases) === 2
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
      setSelectedSize(accountSizes.includes(200000) ? 200000 : accountSizes[accountSizes.length - 1])
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
  const sizeUSD = toNum(activePlan?.account_size || selectedSize || 200000)
  const p1TargetPct = toNum(activePlan?.p1_profit_target || (selectedModel === '1-Step' ? 10 : 10))
  const p2TargetPct = toNum(activePlan?.p2_profit_target || 5)
  const dailyDDPct = toNum(activePlan?.p1_daily_dd || 5)
  const maxDDPct = toNum(activePlan?.p1_max_dd || 10)
  const minTradingDays = Number(activePlan?.p1_min_days || 4)
  const rawPriceUSD = toNum(activePlan?.price || (sizeUSD >= 200000 ? 1080 : sizeUSD >= 100000 ? 540 : 250))
  const convertedPrice = Math.round(rawPriceUSD * currencyMeta.rate)

  return (
    <div className="w-full bg-[#0a0d14] text-slate-100 selection:bg-[#0070F3] selection:text-white transition-colors duration-200 overflow-x-hidden font-sans">
      
      {/* ── 0. Sticky Top Announcement Ribbon (FTMO Style) ──────────── */}
      <div className="w-full bg-[#0c1017] border-b border-slate-800/80 py-2.5 px-4 text-center text-xs relative z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <span className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-2xs">
            %
          </span>
          <span className="font-semibold text-slate-200">
            20% Off Special deal on $100K 1-Step Challenge
          </span>
          <Link
            href="#pricing"
            onClick={() => { setSelectedModel('1-Step'); setSelectedSize(100000); }}
            className="text-orange-400 font-bold hover:text-orange-300 ml-1 inline-flex items-center gap-0.5"
          >
            Claim Offer <ChevronRight className="h-3 w-3 inline" />
          </Link>
        </div>
      </div>

      {/* ── 1. The Industry Titan Hero Section (ftmo_ref_hero.png) ───── */}
      <section className="relative pt-20 sm:pt-28 pb-16 sm:pb-24 overflow-hidden border-b border-slate-800/60">
        {/* Radial ambient cyan & blue glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[580px] bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-transparent blur-[140px] pointer-events-none" />
        <div className="absolute -top-40 right-10 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 relative z-10">
          
          {/* Eyebrow Pill Badge */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/70 shadow-sm text-xs font-semibold text-slate-300 backdrop-blur-md"
            >
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>MODERN PROP TRADING — SINCE 2015</span>
            </motion.div>
          </div>

          {/* Grand Headline (ftmo_ref_hero.png) */}
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08]"
            >
              Grow &amp; Monetize <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Your Demo Trading
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed"
            >
              Improve your trading skills on our simulated platform and earn rewards.
            </motion.p>

            {/* Primary & Secondary Dual CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
              <Button
                asChild
                size="lg"
                className="h-12 sm:h-13 px-8 sm:px-10 rounded-full bg-[#0070F3] hover:bg-[#0060df] text-white font-bold text-sm sm:text-base shadow-xl shadow-blue-500/25 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Link href="#pricing" className="flex items-center gap-2">
                  <span>Trade with {brandName}</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 sm:h-13 px-8 rounded-full border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white text-sm font-semibold cursor-pointer backdrop-blur-md"
              >
                <Link href="#pricing">Free Trial</Link>
              </Button>
            </motion.div>

            {/* Trustpilot Widget */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"
            >
              <span className="font-semibold text-white">Excellent</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 w-4 bg-[#00b67a] flex items-center justify-center rounded-xs text-white">
                    <Star className="h-2.5 w-2.5 fill-white text-white" />
                  </div>
                ))}
              </div>
              <span className="font-semibold text-slate-300">54,231 reviews on</span>
              <span className="font-bold text-white flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[#00b67a] text-[#00b67a]" /> Trustpilot
              </span>
            </motion.div>
          </div>

          {/* Special Offer 3D Card (ftmo_ref_hero.png) */}
          <div className="mt-14 max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-blue-950/40 border border-slate-800/90 p-6 sm:p-8 relative overflow-hidden shadow-2xl backdrop-blur-xl">
            {/* Ambient Cyan Glow Behind Artwork */}
            <div className="absolute right-10 top-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="grid md:grid-cols-12 gap-6 items-center relative z-10">
              
              {/* Left Content */}
              <div className="md:col-span-8">
                {/* Tilted Orange Discount Badge */}
                <div className="inline-block transform -rotate-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-[#FF6B00] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/30">
                    -20%
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  1-Step {brandName} Challenge $100K Special Offer
                </h3>
                <p className="text-sm text-slate-400 mt-1 max-w-md">
                  Take your 1-Step to gain your {brandName} Account with 10% lower evaluation target and 100% fee reimbursement.
                </p>

                <div className="mt-5">
                  <Button
                    asChild
                    className="h-11 px-7 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/25 cursor-pointer"
                  >
                    <Link
                      href="#pricing"
                      onClick={() => { setSelectedModel('1-Step'); setSelectedSize(100000); }}
                    >
                      Claim 20% Off
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Right 3D Visual Artwork: Glowing Cyan Number "1" Sculpture */}
              <div className="md:col-span-4 flex items-center justify-center">
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
                  {/* Outer Glowing Rings */}
                  <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-spin-slow pointer-events-none" />
                  <div className="absolute inset-3 rounded-full border border-blue-500/30 pointer-events-none" />
                  
                  {/* Stylized 3D Numeral "1" Vector */}
                  <svg viewBox="0 0 100 120" className="w-28 h-32 drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]">
                    <defs>
                      <linearGradient id="cyanNumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#0284c7" />
                      </linearGradient>
                      <linearGradient id="cyanFacet" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0891b2" />
                        <stop offset="100%" stopColor="#67e8f9" />
                      </linearGradient>
                    </defs>
                    {/* 3D Isometric Numeral 1 */}
                    <path d="M 45 25 L 30 38 L 30 50 L 45 38 L 45 95 L 62 95 L 62 25 Z" fill="url(#cyanNumGrad)" />
                    <path d="M 45 25 L 62 25 L 55 15 L 38 15 Z" fill="url(#cyanFacet)" opacity="0.8" />
                    <path d="M 62 25 L 72 35 L 72 105 L 62 95 Z" fill="#0369a1" />
                    <path d="M 25 105 L 72 105 L 62 95 L 15 95 Z" fill="#075985" opacity="0.6" />
                  </svg>
                </div>
              </div>

            </div>
          </div>

          {/* Authority Badges & Social Proof Strip (ftmo_ref_hero.png) */}
          <div className="mt-14 pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-6">
              <span className="font-bold uppercase tracking-wider text-slate-300">EY Entrepreneur Of The Year</span>
              <span className="text-slate-700">|</span>
              <span className="font-bold uppercase tracking-wider text-slate-300">Forbes</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-cyan-400" /> Up to $200,000 {brandName} Account
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-cyan-400" /> Support in 21 Languages
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-cyan-400" /> 4 Trading Platforms
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ── 2. The Iconic FTMO Trading Objectives Matrix (ftmo_ref_matrix.png) ─ */}
      <section id="pricing" className="py-20 sm:py-28 border-b border-slate-800/60 relative overflow-hidden scroll-mt-24">
        {/* Top Radial Ambient Cyan Back-Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-cyan-500/20 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 relative z-10">
          
          {/* Section Heading */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Choose Your {brandName} Challenge
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Complete {brandName}’s Trading Objectives to become eligible to gain your demo {brandName} Account.
            </p>
          </div>

          {/* Segmented Control Tabs: 2-Step vs 1-Step (ftmo_ref_matrix.png) */}
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4 mb-8">
            
            {/* 2-Step Card */}
            <button
              onClick={() => setSelectedModel('2-Step')}
              className={cn(
                'p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between',
                selectedModel === '2-Step'
                  ? 'bg-white text-slate-950 border-white shadow-xl shadow-white/5'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center font-bold',
                  selectedModel === '2-Step' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                )}>
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                    <span>2-Step</span>
                    <span className={cn('text-2xs font-semibold px-1.5 py-0.5 rounded', selectedModel === '2-Step' ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-400')}>
                      [%]
                    </span>
                  </div>
                  <div className={cn('text-2xs', selectedModel === '2-Step' ? 'text-slate-600' : 'text-slate-500')}>
                    Standard 2-Phase
                  </div>
                </div>
              </div>
              <ChevronRight className={cn('h-5 w-5', selectedModel === '2-Step' ? 'text-slate-900' : 'text-slate-600')} />
            </button>

            {/* 1-Step Card */}
            <button
              onClick={() => setSelectedModel('1-Step')}
              className={cn(
                'p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between',
                selectedModel === '1-Step'
                  ? 'bg-white text-slate-950 border-white shadow-xl shadow-white/5'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center font-bold',
                  selectedModel === '1-Step' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                )}>
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                    <span>1-Step</span>
                    <span className={cn('text-2xs font-semibold px-1.5 py-0.5 rounded', selectedModel === '1-Step' ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-400')}>
                      [%]
                    </span>
                  </div>
                  <div className={cn('text-2xs', selectedModel === '1-Step' ? 'text-slate-600' : 'text-slate-500')}>
                    Single step to {brandName} Account
                  </div>
                </div>
              </div>
              <ChevronRight className={cn('h-5 w-5', selectedModel === '1-Step' ? 'text-slate-900' : 'text-slate-600')} />
            </button>

          </div>

          {/* Controls Bar: Currency + Numbers Switch (ftmo_ref_matrix.png) */}
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            
            {/* Currency Selector */}
            <div className="inline-flex p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-full sm:w-auto">
              {CURRENCIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCurrency(c.key)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    selectedCurrency === c.key
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <span>{c.flag}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Toggle Switches */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-end text-xs">
              
              {/* Show Numbers Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-medium">Show Numbers</span>
                <button
                  onClick={() => setShowNumbers(!showNumbers)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                    showNumbers ? 'bg-[#0070F3]' : 'bg-slate-700'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      showNumbers ? 'transform translate-x-5' : ''
                    )}
                  />
                </button>
              </div>

              {/* Hide Phases Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Hide phases</span>
                <button
                  onClick={() => setHidePhases(!hidePhases)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                    hidePhases ? 'bg-[#0070F3]' : 'bg-slate-800'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      hidePhases ? 'transform translate-x-5' : ''
                    )}
                  />
                </button>
              </div>

            </div>

          </div>

          {/* Account Sizes Row (ftmo_ref_matrix.png) */}
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8">
            {accountSizes.map((size) => {
              const isSelected = selectedSize === size
              const is100K = size === 100000
              const label = size >= 1000 ? `${size / 1000}K` : `${size}`
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'px-6 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer relative',
                    isSelected
                      ? 'bg-white text-slate-950 shadow-lg shadow-white/10'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  )}
                >
                  {is100K && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 ring-2 ring-[#0a0d14]" />
                  )}
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          {/* 4-Column Table Matrix (ftmo_ref_matrix.png) */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl overflow-hidden backdrop-blur-xl">
            
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-slate-950/80 py-4 px-4 sm:px-6 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
              <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5">
                <span>TRADING OBJECTIVES</span>
              </div>
              <div className="col-span-2 sm:col-span-2 text-center text-cyan-400 font-extrabold">
                {selectedModel === '1-Step' ? 'CHALLENGE' : 'PHASE 1'}
              </div>
              {selectedModel === '2-Step' && !hidePhases ? (
                <div className="col-span-2 sm:col-span-3 text-center text-blue-400 font-extrabold">
                  PHASE 2
                </div>
              ) : (
                <div className="col-span-2 sm:col-span-3 text-center text-slate-600">
                  —
                </div>
              )}
              <div className="col-span-3 sm:col-span-3 text-right sm:text-center text-emerald-400 font-extrabold">
                ACCOUNT
              </div>
            </div>

            {/* Matrix Rows */}
            <div className="divide-y divide-slate-800/80 text-xs sm:text-sm font-medium">
              
              {/* Row 1: Trading Period */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-200">
                  Trading Period
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-white">
                  Unlimited
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-white">
                  {selectedModel === '1-Step' ? '—' : 'Unlimited'}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-emerald-400">
                  Unlimited
                </div>
              </div>

              {/* Row 2: Minimum Trading Days */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-200">
                  Minimum trading days
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-white">
                  {minTradingDays} days
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-white">
                  {selectedModel === '1-Step' ? '—' : `${minTradingDays} days`}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-slate-500">
                  X
                </div>
              </div>

              {/* Row 3: Maximum Daily Loss */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-200">
                  Maximum Daily Loss
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-white terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-white terminal-num">
                  {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`)}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-white terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                </div>
              </div>

              {/* Row 4: Maximum Loss */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-200">
                  Maximum Loss
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-white terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-white terminal-num">
                  {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`)}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-white terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                </div>
              </div>

              {/* Row 5: Profit Target */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors bg-cyan-500/5">
                <div className="col-span-5 sm:col-span-4 font-bold text-cyan-300">
                  Profit Target
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-cyan-400 terminal-num">
                  {showNumbers ? formatCurrencyVal(sizeUSD * (p1TargetPct / 100)) : `${p1TargetPct}%`}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-blue-400 terminal-num">
                  {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (p2TargetPct / 100)) : `${p2TargetPct}%`)}
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold text-slate-500">
                  X
                </div>
              </div>

              {/* Row 6: Refundable Fee */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-200">
                  Refundable Fee
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-slate-500">
                  X
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-slate-500">
                  X
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-bold">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-2xs uppercase">
                    Yes 100%
                  </span>
                </div>
              </div>

              {/* Row 7: Rewards */}
              <div className="grid grid-cols-12 py-3.5 px-4 sm:px-6 items-center hover:bg-slate-800/30 transition-colors bg-emerald-500/5">
                <div className="col-span-5 sm:col-span-4 font-bold text-emerald-300">
                  Rewards
                </div>
                <div className="col-span-2 sm:col-span-2 text-center font-bold text-slate-500">
                  X
                </div>
                <div className="col-span-2 sm:col-span-3 text-center font-bold text-slate-500">
                  X
                </div>
                <div className="col-span-3 sm:col-span-3 text-right sm:text-center font-black text-emerald-400">
                  Up to 90% of the profit
                </div>
              </div>

            </div>

            {/* Bottom Checkout Bar (ftmo_ref_matrix.png) */}
            <div className="p-4 sm:p-6 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <div className="text-sm sm:text-base font-extrabold text-white">
                  {brandName} Account {formatCurrencyVal(sizeUSD)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Price <span className="font-bold text-white terminal-num">{currencyMeta.symbol}{convertedPrice}</span>
                </div>
              </div>

              <Button
                asChild
                className="h-12 px-10 rounded-full bg-[#0084FF] hover:bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/25 cursor-pointer w-full sm:w-auto"
              >
                <Link href={`/checkout?plan=${activePlan?.id || 1}&size=${sizeUSD}`}>
                  Start now
                </Link>
              </Button>
            </div>

          </div>

          {/* Value Pills Bar Below Matrix (ftmo_ref_matrix.png) */}
          <div className="mt-8 max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-400">
            {['Academy', 'Psychology Course', 'Account MetriX', 'Economic Calendar', 'Equity Simulator', 'Trading Journal', 'News Indicator'].map((tool, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-medium hover:border-slate-700 transition-colors"
              >
                {tool}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* ── 3. Why People Choose Us (ftmo_ref_why_choose.png) ─────────── */}
      <section className="py-16 sm:py-24 border-b border-slate-800/60 bg-slate-950/50 relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Why People Choose {brandName}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              The premier prop trading firm engineered with fair trading objectives and reliable capital backing.
            </p>
          </div>

          {/* Hero Feature Card: More Power, Less Risk (ftmo_ref_why_choose.png) */}
          <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/60 border border-slate-800 p-8 sm:p-12 mb-10 relative overflow-hidden shadow-2xl">
            <div className="grid md:grid-cols-12 gap-8 items-center">
              
              <div className="md:col-span-6">
                <span className="text-xs uppercase tracking-wider font-bold text-cyan-400">
                  INSTITUTIONAL SIMULATED CAPITAL
                </span>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 leading-tight">
                  More Power, <br />
                  <span className="text-cyan-400">Less Risk.</span>
                </h3>
                <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
                  Trade up to $200,000 on a demo {brandName} Account. Keep up to 90% of the simulated gains without risking personal savings on market drawdowns.
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <Button asChild className="h-11 px-7 rounded-full bg-[#0070F3] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer">
                    <Link href="#pricing">Explore Accounts</Link>
                  </Button>
                </div>
              </div>

              {/* Floating Live Account MetriX Card Mockup (ftmo_ref_why_choose.png) */}
              <div className="md:col-span-6 flex items-center justify-center">
                <div className="w-full max-w-md rounded-2xl bg-slate-950/90 border border-slate-800/90 p-5 shadow-2xl backdrop-blur-xl">
                  
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-200">Result: Ongoing</span>
                    </div>
                    <span className="text-2xs font-semibold text-slate-400">{brandName} MetriX</span>
                  </div>

                  <div>
                    <div className="text-3xs uppercase tracking-wider text-slate-400">Simulated Account Balance</div>
                    <div className="text-2xl sm:text-3xl font-black text-white terminal-num mt-0.5">
                      $219,999.43
                    </div>
                    <div className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> +$19,999.43 (+10.00% Profit)
                    </div>
                  </div>

                  {/* Sparkline curve */}
                  <div className="mt-4 h-16 w-full flex items-end">
                    <svg viewBox="0 0 300 70" className="w-full h-full stroke-cyan-400 fill-none stroke-[2.5]">
                      <path d="M 0 60 Q 50 55 90 40 T 170 30 T 240 15 T 300 5" />
                    </svg>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-2xs text-slate-400">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-semibold cursor-pointer">
                      Credentials
                    </span>
                    <span className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 font-semibold cursor-pointer">
                      Account MetriX
                    </span>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* 4 Feature Cards Grid (ftmo_ref_why_choose.png) */}
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                <DollarSign className="h-5 w-5" />
              </div>
              <h4 className="font-extrabold text-base text-white mb-2">Rewards</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bi-weekly reward disbursements with up to 90% profit share directly sent to your preferred payout method.
              </p>
            </div>

            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                <Headphones className="h-5 w-5" />
              </div>
              <h4 className="font-extrabold text-base text-white mb-2">Advanced Support</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                24/7 dedicated assistance available in 21 languages with average response time under 60 seconds.
              </p>
            </div>

            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                <Activity className="h-5 w-5" />
              </div>
              <h4 className="font-extrabold text-base text-white mb-2">Tools &amp; Services</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Account MetriX, Statistical App, Trading Journal, and Economic Calendar built into your account.
              </p>
            </div>

            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5" />
              </div>
              <h4 className="font-extrabold text-base text-white mb-2">Free Trial</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Test our platform conditions and refine trading strategies completely risk-free before taking the challenge.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 4. How It Works (ftmo_ref_how_it_works.png) ────────────────── */}
      <section className="py-16 sm:py-24 border-b border-slate-800/60 relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              How It Works
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Three clear stages from demo trader to elite funded professional.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-12">
            
            {/* Step 1: Evaluation Process */}
            <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 flex flex-col justify-between relative overflow-hidden">
              <div>
                <span className="text-2xs uppercase tracking-wider font-black text-blue-400">
                  STEP 01
                </span>
                <h3 className="text-xl font-black text-white mt-2 mb-1">
                  EVALUATION PROCESS
                </h3>
                <div className="text-sm font-semibold text-slate-400 mb-6">
                  Prove your skills
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    <span>Profit Target: 10% (Phase 1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    <span>Max Daily Loss: 5%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    <span>Max Overall Loss: 10%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    <span>Minimum 4 Trading Days</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 text-2xs text-slate-500">
                Phase 1 &amp; Phase 2 Evaluation
              </div>
            </div>

            {/* Step 2: FTMO Account */}
            <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden">
              <div>
                <span className="text-2xs uppercase tracking-wider font-black text-emerald-400">
                  STEP 02
                </span>
                <h3 className="text-xl font-black text-white mt-2 mb-1">
                  {brandName.toUpperCase()} ACCOUNT
                </h3>
                <div className="text-sm font-semibold text-slate-400 mb-6">
                  Earn real-money rewards
                </div>

                {/* Certificate Mockup Card (ftmo_ref_how_it_works.png) */}
                <div className="rounded-xl bg-slate-950/90 border border-emerald-500/30 p-4 text-center">
                  <Award className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <div className="text-3xs uppercase tracking-wider text-slate-400">Total Payout Disbursed</div>
                  <div className="text-lg font-black text-emerald-400 terminal-num mt-0.5">$20,335.70</div>
                  <div className="text-3xs text-slate-500 mt-1">100% Fee Refund Included</div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 text-2xs text-slate-500">
                Up to 90% Profit Split
              </div>
            </div>

            {/* Step 3: Premium Programme */}
            <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col justify-between relative overflow-hidden">
              <div>
                <span className="text-2xs uppercase tracking-wider font-black text-amber-400">
                  STEP 03
                </span>
                <h3 className="text-xl font-black text-white mt-2 mb-1">
                  PREMIUM PROGRAMME
                </h3>
                <div className="text-sm font-semibold text-slate-400 mb-6">
                  Achieve More. Gain More.
                </div>

                {/* 3 Metallic Badges (ftmo_ref_how_it_works.png) */}
                <div className="grid grid-cols-3 gap-2 text-center text-3xs font-black uppercase">
                  <div className="p-2.5 rounded-lg bg-gradient-to-b from-slate-700 to-slate-800 text-slate-200 border border-slate-600">
                    PRIME
                  </div>
                  <div className="p-2.5 rounded-lg bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100 border border-amber-500">
                    QUANTLANE
                  </div>
                  <div className="p-2.5 rounded-lg bg-gradient-to-b from-indigo-700 to-indigo-900 text-indigo-100 border border-indigo-600">
                    SUPREME
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 text-2xs text-slate-500">
                Scale up to $2,000,000+
              </div>
            </div>

          </div>

          {/* Dual Bottom CTAs */}
          <div className="text-center flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 rounded-full bg-[#0070F3] hover:bg-blue-600 text-white font-bold text-sm cursor-pointer">
              <Link href="#pricing">Start {brandName} Challenge</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-full border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-semibold cursor-pointer">
              <Link href="#pricing">How it works</Link>
            </Button>
          </div>

        </div>
      </section>

      {/* ── 5. Proof & Testimonials (ftmo_ref_proof.png) ──────────────── */}
      <section className="py-16 sm:py-24 border-b border-slate-800/60 bg-slate-950/40 relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Trusted by Millions of Traders
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Real stories and audited disbursements from funded traders across the globe.
            </p>
          </div>

          {/* 3 Metric Columns (ftmo_ref_proof.png) */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 text-center">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-black text-white terminal-num">4.5M+</div>
              <div className="text-xs uppercase tracking-wider text-slate-400 mt-1 font-semibold">Customers worldwide</div>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 terminal-num">$650M+</div>
              <div className="text-xs uppercase tracking-wider text-slate-400 mt-1 font-semibold">Paid in rewards</div>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-black text-cyan-400 terminal-num">140+</div>
              <div className="text-xs uppercase tracking-wider text-slate-400 mt-1 font-semibold">Countries served</div>
            </div>
          </div>

          {/* Video Interview Cards Grid (ftmo_ref_proof.png) */}
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-6 bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{t.flag}</span>
                      <div>
                        <div className="font-bold text-sm text-white">{t.name}</div>
                        <div className="text-2xs text-slate-400">{t.country}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-3xs font-bold flex items-center gap-1">
                      <Play className="h-2.5 w-2.5 fill-blue-400" />
                      {t.views}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-2xs">
                  <div>
                    <div className="text-3xs uppercase tracking-wider text-slate-400">Rewards Disbursed</div>
                    <div className="font-black text-sm text-emerald-400 terminal-num mt-0.5">{t.rewards}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xs uppercase tracking-wider text-slate-400">Trading Style</div>
                    <div className="font-semibold text-slate-200 mt-0.5">{t.style}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trustpilot 4-Card Reviews Grid (ftmo_ref_proof.png) */}
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUSTPILOT_REVIEWS.map((r, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-0.5">
                    {[...Array(r.rating)].map((_, idx) => (
                      <div key={idx} className="h-3.5 w-3.5 bg-[#00b67a] flex items-center justify-center rounded-xs text-white">
                        <Star className="h-2 w-2 fill-white text-white" />
                      </div>
                    ))}
                  </div>
                  <span className="text-3xs text-slate-500">{r.date}</span>
                </div>
                <div className="font-bold text-white mb-1">{r.title}</div>
                <p className="text-slate-400 text-2xs leading-relaxed">{r.review}</p>
                <div className="text-3xs text-slate-500 mt-2 font-semibold">— {r.name}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 6. Bottom CTA Banner & Tablet Mockup (ftmo_ref_cta.png) ────── */}
      <section className="py-20 border-b border-slate-800/60 relative overflow-hidden">
        <div className="container max-w-6xl mx-auto px-4">
          
          {/* Royal Blue Banner Card (ftmo_ref_cta.png) */}
          <div className="rounded-3xl bg-gradient-to-r from-[#0066ff] via-[#005cd9] to-[#004bb5] p-8 sm:p-14 text-white relative overflow-hidden shadow-2xl">
            {/* Ambient Background Circles */}
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Left Column */}
              <div className="lg:col-span-7">
                <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                  Start Your {brandName} <br />
                  Challenge Today
                </h2>

                <div className="mt-6 space-y-3 text-sm sm:text-base font-bold text-white">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-cyan-300 shrink-0" />
                    <span>As many Free Trials as you need</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-cyan-300 shrink-0" />
                    <span>Up to $200,000 account</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-cyan-300 shrink-0" />
                    <span>No time limit</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-8 rounded-full bg-white hover:bg-slate-100 text-[#0066ff] font-bold text-sm shadow-xl cursor-pointer"
                  >
                    <Link href="#pricing">Trade with {brandName}</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-12 px-8 rounded-full border-2 border-white/60 hover:bg-white/10 text-white font-bold text-sm cursor-pointer"
                  >
                    <Link href="#pricing">Free Trial</Link>
                  </Button>
                </div>
              </div>

              {/* Right Column: Angled Tablet Mockup (ftmo_ref_cta.png) */}
              <div className="lg:col-span-5 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-2xl bg-slate-950 p-4 border-4 border-slate-900 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-300">
                  <div className="flex items-center justify-between text-2xs text-slate-400 pb-2 mb-3 border-b border-slate-800">
                    <span className="font-bold text-white">{brandName} MetriX Live</span>
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </div>
                  <div className="text-2xs text-slate-400">Current Equity</div>
                  <div className="text-xl font-black text-white terminal-num">$214,830.00</div>
                  <div className="mt-3 h-20 w-full">
                    <svg viewBox="0 0 200 60" className="w-full h-full stroke-emerald-400 fill-none stroke-[2]">
                      <path d="M 0 50 Q 40 45 70 30 T 130 20 T 200 5" />
                    </svg>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-3xs text-slate-500">
                    <span>Drawdown Floor: $180,000</span>
                    <span className="text-emerald-400">+$14,830 profit</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Secondary Authority Logos Strip (ftmo_ref_cta.png) */}
          <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 items-center text-center">
            {AUTHORITY_BRANDS.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                <div className="font-black text-xs sm:text-sm text-slate-300">{item.name}</div>
                <div className="text-3xs text-slate-500 mt-0.5 uppercase tracking-wider">{item.subtitle}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  )
}
