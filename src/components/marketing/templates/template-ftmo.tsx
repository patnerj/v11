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
  ChevronDown,
  Eye,
  ArrowDown,
  Minus,
  Crown
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
    name: 'Andi',
    country: 'United Kingdom',
    flag: '🇬🇧',
    rewards: '$37,676',
    style: 'Day trader',
    views: '83K Views',
    quote: 'The evaluation rules are 100% transparent. No trailing traps, no hidden limits. Payouts arrive in under 8 hours.',
  },
  {
    name: 'Fabian',
    country: 'USA',
    flag: '🇺🇸',
    rewards: '$96,649',
    style: 'Scalper',
    views: '46K Views',
    quote: 'Passing Phase 1 and 2 was smooth because of the unlimited trading period. It allows you to wait for quality setups.',
  },
  {
    name: 'Choon Chiat',
    country: 'Malaysia',
    flag: '🇲🇾',
    rewards: '$30,182',
    style: 'Scalper',
    views: '193K Views',
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
    }).sort((a, b) => toNum(b.account_size) - toNum(a.account_size)) // Descending order (FTMO style 200k first)
  }, [effectivePlans, selectedModel])

  // Extract unique account sizes in FTMO descending order: 200K, 100K, 50K, 25K, 10K
  const accountSizes = useMemo(() => {
    const defaultOrder = [200000, 100000, 50000, 25000, 10000]
    const sizes = new Set<number>()
    filteredPlans.forEach((p) => sizes.add(toNum(p.account_size)))
    defaultOrder.forEach((s) => sizes.add(s))
    return Array.from(sizes).sort((a, b) => b - a)
  }, [filteredPlans])

  useEffect(() => {
    if (accountSizes.length > 0 && !accountSizes.includes(selectedSize)) {
      setSelectedSize(accountSizes.includes(200000) ? 200000 : accountSizes[0])
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
    <div className="w-full bg-bg dark:bg-[#030712] text-text dark:text-slate-100 selection:bg-[#0070F3] selection:text-white transition-colors duration-200 overflow-x-hidden font-sans">

      {/* ── 1. The Industry Titan Hero Section (ftmo_ref_hero.png) ───── */}
      <section className="relative pt-20 sm:pt-28 pb-16 sm:pb-24 overflow-hidden border-b border-border/60 dark:border-slate-800/60 bg-surface dark:bg-[#000000]">
        {/* Radial ambient electric blue glow at top center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-blue-600/15 dark:from-blue-600/25 via-blue-500/5 dark:via-blue-500/10 to-transparent blur-[140px] pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 relative z-10">
          
          {/* Eyebrow Pill Badge: Modern Prop Trading — Since 2015 */}
          <div className="text-center mb-7">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-surface-secondary/80 dark:bg-slate-900/90 border border-border dark:border-slate-800 text-xs font-semibold text-text-muted dark:text-slate-300 backdrop-blur-md shadow-sm"
            >
              <span>Modern Prop Trading — Since 2015</span>
            </motion.div>
          </div>

          {/* Grand Headline: Adaptive High Contrast */}
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-text dark:text-white leading-[1.08]"
            >
              Grow &amp; Monetize <br className="hidden sm:inline" />
              Your Demo Trading
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
            >
              Improve your trading skills on our simulated platform and earn rewards
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
                className="h-12 sm:h-13 px-8 rounded-full border-border dark:border-slate-800 bg-surface-secondary dark:bg-slate-950 hover:bg-surface-muted dark:hover:bg-slate-900 text-text dark:text-slate-200 hover:text-text dark:hover:text-white text-sm font-semibold cursor-pointer backdrop-blur-md"
              >
                <Link href="#pricing">Free Trial</Link>
              </Button>
            </motion.div>

            {/* Trustpilot Widget */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-7 flex items-center justify-center gap-2 text-xs text-text-muted dark:text-slate-400"
            >
              <span className="font-bold text-text dark:text-white">Excellent</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 w-4 bg-[#00b67a] flex items-center justify-center rounded-xs text-white">
                    <Star className="h-2.5 w-2.5 fill-white text-white" />
                  </div>
                ))}
              </div>
              <span className="font-semibold text-text-muted dark:text-slate-300">54,231 reviews on</span>
              <span className="font-bold text-text dark:text-white flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[#00b67a] text-[#00b67a]" /> Trustpilot
              </span>
            </motion.div>
          </div>

          {/* Special Offer 3D Card (ftmo_ref_hero.png) */}
          <div className="mt-14 max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-surface-secondary via-surface to-blue-500/5 dark:from-slate-950 dark:via-[#060a14] dark:to-blue-950/40 border border-border dark:border-slate-800/90 p-6 sm:p-10 relative overflow-hidden shadow-2xl backdrop-blur-xl">
            {/* Ambient Cyan Glow Behind Artwork */}
            <div className="absolute right-10 top-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Tilted Orange Discount Ribbon Badge */}
            <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
              <span className="px-3.5 py-1 rounded-md bg-[#FF6B00] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/40 inline-block transform -rotate-3">
                -20%
              </span>
            </div>

            <div className="grid md:grid-cols-12 gap-6 items-center relative z-10 pt-8 sm:pt-4">
              
              {/* Left Content */}
              <div className="md:col-span-8">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-text dark:text-white tracking-tight">
                  1-Step {brandName} Challenge $100K Special Offer
                </h3>
                <p className="text-sm text-text-muted dark:text-slate-400 mt-2 max-w-md">
                  Take your 1-Step to gain your {brandName} Account.
                </p>

                <div className="mt-6">
                  <Button
                    asChild
                    className="h-11 px-8 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-orange-500/30 cursor-pointer"
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

              {/* Right 3D Visual Artwork: Photorealistic Glowing Cyan Numeral "1" Sculpture on Pedestal */}
              <div className="md:col-span-4 flex items-center justify-center">
                <div className="relative w-40 h-44 sm:w-48 sm:h-52 flex items-center justify-center">
                  
                  {/* Volumetric backlight glow */}
                  <div className="absolute inset-0 bg-cyan-400/25 blur-2xl rounded-full" />
                  
                  {/* Pedestal Base */}
                  <div className="absolute bottom-2 w-32 h-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-md border border-slate-700/60 shadow-xl" />
                  
                  {/* Glowing 3D Glass Number 1 SVG */}
                  <svg viewBox="0 0 120 160" className="w-32 h-44 drop-shadow-[0_0_35px_rgba(34,211,238,0.7)] z-10">
                    <defs>
                      <linearGradient id="glass1Front" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#67e8f9" />
                        <stop offset="40%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#0284c7" />
                      </linearGradient>
                      <linearGradient id="glass1Side" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0891b2" />
                        <stop offset="100%" stopColor="#0369a1" />
                      </linearGradient>
                      <linearGradient id="glass1Top" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a5f3fc" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    </defs>

                    {/* Pedestal Top Ring */}
                    <ellipse cx="60" cy="145" rx="42" ry="10" fill="#082f49" opacity="0.8" />
                    <ellipse cx="60" cy="144" rx="38" ry="8" fill="#0369a1" opacity="0.5" />

                    {/* 3D Glass Number 1 Isometric Structure */}
                    {/* Bevel Left Tip */}
                    <polygon points="32,48 52,32 52,48 32,62" fill="url(#glass1Side)" opacity="0.9" />
                    <polygon points="32,48 52,32 58,35 38,51" fill="url(#glass1Top)" />

                    {/* Central Pillar */}
                    <polygon points="52,32 72,32 72,135 52,135" fill="url(#glass1Front)" />
                    {/* Top facet */}
                    <polygon points="52,32 72,32 80,24 60,24" fill="url(#glass1Top)" />
                    {/* Right Extrusion */}
                    <polygon points="72,32 80,24 80,127 72,135" fill="url(#glass1Side)" />
                    {/* Left Wing */}
                    <polygon points="32,48 52,32 52,135 32,135" fill="url(#glass1Front)" opacity="0.95" />
                    
                    {/* Bottom Base Foot */}
                    <polygon points="30,135 84,135 90,142 24,142" fill="url(#glass1Side)" />
                    
                    {/* Internal Light Core Highlight */}
                    <line x1="56" y1="36" x2="56" y2="132" stroke="#ffffff" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

            </div>
          </div>

          {/* Authority Badges & Social Proof Strip (ftmo_ref_hero.png) */}
          <div className="mt-14 pt-8 border-t border-border/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-text-muted dark:text-slate-400">
            <div className="flex items-center gap-6">
              <span className="font-bold uppercase tracking-wider text-text dark:text-slate-300">EY Entrepreneur Of The Year</span>
              <span className="text-border dark:text-slate-800">|</span>
              <span className="font-bold uppercase tracking-wider text-text dark:text-slate-300">Forbes</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-text dark:text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /> Up to $200,000 {brandName} Account
              </span>
              <span className="text-border dark:text-slate-800">|</span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /> Support in 21 Languages
              </span>
              <span className="text-border dark:text-slate-800">|</span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /> 4 Trading Platforms
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ── 2. Why People Choose Us (ftmo_ref_why_choose.png) ─────────── */}
      {/* ON LIVE FTMO, THIS SECTION COMES BEFORE CHOOSE YOUR CHALLENGE */}
      <section className="py-16 sm:py-24 border-b border-border/60 dark:border-slate-800/60 bg-surface-secondary/30 dark:bg-[#02050b] relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          {/* Header */}
          <div className="max-w-6xl mx-auto mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-text dark:text-white tracking-tight">
              Why People Choose {brandName}
            </h3>
          </div>

          {/* Hero Feature Banner: More Power, Less Risk (ftmo_ref_why_choose.png) */}
          <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-surface via-surface-secondary to-blue-500/5 dark:from-slate-950 dark:via-[#070b16] dark:to-[#0a1428] border border-border dark:border-slate-800 p-8 sm:p-12 mb-8 relative overflow-hidden shadow-2xl">
            <div className="grid md:grid-cols-12 gap-8 items-center">
              
              <div className="md:col-span-6">
                <h4 className="text-3xl sm:text-5xl font-black text-text dark:text-white leading-tight">
                  More Power, <br />
                  <span className="text-text dark:text-white">Less Risk</span>
                </h4>
                <p className="mt-3 text-sm sm:text-base text-text-muted dark:text-slate-400">
                  Up to $200K simulated capital
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <Button asChild className="h-11 px-7 rounded-full bg-[#0070F3] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer shadow-lg shadow-blue-500/20">
                    <Link href="#pricing">Explore Accounts</Link>
                  </Button>
                </div>
              </div>

              {/* Floating Live Account MetriX Card Mockup (ftmo_ref_why_choose.png) */}
              <div className="md:col-span-6 flex items-center justify-center">
                <div className="w-full max-w-md rounded-2xl bg-surface dark:bg-slate-950/95 border border-border dark:border-slate-800 p-5 shadow-2xl backdrop-blur-xl">
                  
                  <div className="flex items-center justify-between border-b border-border dark:border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text dark:text-white flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /> {brandName} Account
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xs text-text-muted dark:text-slate-400">Result</div>
                      <div className="text-xs font-bold text-text dark:text-white mt-0.5">Ongoing</div>
                    </div>
                    <div>
                      <div className="text-2xs text-text-muted dark:text-slate-400">Balance</div>
                      <div className="text-base font-extrabold text-text dark:text-white terminal-num mt-0.5">
                        $219,999.43
                      </div>
                    </div>
                  </div>

                  {/* Sparkline curve */}
                  <div className="mt-4 h-16 w-full flex items-end">
                    <svg viewBox="0 0 300 70" className="w-full h-full stroke-emerald-500 dark:stroke-emerald-400 fill-none stroke-[2.5]">
                      <path d="M 0 55 Q 50 50 90 38 T 170 32 T 240 18 T 300 8" />
                    </svg>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border dark:border-slate-800 flex items-center gap-2 text-2xs">
                    <button className="px-3 py-1.5 rounded-lg bg-surface-secondary dark:bg-slate-900 border border-border dark:border-slate-800 text-text dark:text-slate-300 font-semibold hover:text-primary dark:hover:text-white cursor-pointer flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Credentials
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-surface-secondary dark:bg-slate-900 border border-border dark:border-slate-800 text-text dark:text-slate-300 font-semibold hover:text-primary dark:hover:text-white cursor-pointer flex items-center gap-1">
                      <LineChart className="h-3 w-3" /> Account MetriX
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* 4 Feature Cards Row (ftmo_ref_why_choose.png) */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="rounded-2xl p-5 bg-surface dark:bg-slate-950/80 border border-border dark:border-slate-800/90 hover:border-border-strong dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2.5 mb-2">
                <DollarSign className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                <h5 className="font-extrabold text-sm text-text dark:text-white">Rewards</h5>
              </div>
              <p className="text-xs text-text-muted dark:text-slate-400 leading-relaxed">
                Fast and easy rewards withdrawals
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-surface dark:bg-slate-950/80 border border-border dark:border-slate-800/90 hover:border-border-strong dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2.5 mb-2">
                <Headphones className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                <h5 className="font-extrabold text-sm text-text dark:text-white">Advanced Support</h5>
              </div>
              <p className="text-xs text-text-muted dark:text-slate-400 leading-relaxed">
                Dedicated support via Live chat, email, or WhatsApp
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-surface dark:bg-slate-950/80 border border-border dark:border-slate-800/90 hover:border-border-strong dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2.5 mb-2">
                <Activity className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                <h5 className="font-extrabold text-sm text-text dark:text-white">Tools &amp; Services</h5>
              </div>
              <p className="text-xs text-text-muted dark:text-slate-400 leading-relaxed">
                Tailored tools &amp; services to support your growth
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-surface dark:bg-slate-950/80 border border-border dark:border-slate-800/90 hover:border-border-strong dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2.5 mb-2">
                <Clock className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                <h5 className="font-extrabold text-sm text-text dark:text-white">Free Trial</h5>
              </div>
              <p className="text-xs text-text-muted dark:text-slate-400 leading-relaxed">
                As many Free Trials as you need
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. The Iconic FTMO Trading Objectives Matrix (ftmo_ref_matrix.png) ─ */}
      <section id="pricing" className="pt-16 pb-28 sm:pt-28 sm:pb-28 border-b border-border/60 dark:border-slate-800/60 relative overflow-hidden scroll-mt-28 bg-surface dark:bg-[#000000]">
        
        {/* Top Spotlight Light Slit & Trapezoid Cone Beam (ftmo_ref_matrix.png) */}
        <div className="flex flex-col items-center justify-center relative pointer-events-none mb-4">
          {/* Horizontal rectangular light emitter slit */}
          <div className="w-56 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_30px_#00c0ff]" />
          {/* Downward trapezoid fan beam */}
          <div 
            className="w-[520px] h-[170px] bg-gradient-to-b from-cyan-400/35 via-blue-600/15 to-transparent blur-md -mt-0.5"
            style={{ clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)' }}
          />
        </div>

        <div className="container max-w-7xl mx-auto px-4 relative z-10">
          
          {/* Section Heading: Solid pure white */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-5xl font-black text-text dark:text-white tracking-tight">
              Choose Your {brandName} Challenge
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-muted dark:text-slate-400">
              Complete {brandName}’s Trading Objectives to become eligible to gain your demo {brandName} Account.
            </p>
          </div>

          {/* Segmented Control Tabs: 2-Step vs 1-Step (ftmo_ref_matrix.png) */}
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4 mb-8">
            
            {/* 2-Step Card */}
            <button
              onClick={() => setSelectedModel('2-Step')}
              className={cn(
                'p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between relative',
                selectedModel === '2-Step'
                  ? 'bg-surface dark:bg-white text-text dark:text-slate-950 border-2 border-primary dark:border-white shadow-xl'
                  : 'bg-surface-secondary/80 dark:bg-slate-900/60 border-border dark:border-slate-800 text-text-muted dark:text-slate-300 hover:border-border-strong dark:hover:border-slate-700'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center font-bold',
                  selectedModel === '2-Step' ? 'bg-primary dark:bg-blue-600 text-white' : 'bg-surface-secondary dark:bg-slate-800 text-text-muted dark:text-slate-300'
                )}>
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm sm:text-base">
                    2-Step
                  </div>
                  <div className={cn('text-2xs', selectedModel === '2-Step' ? 'text-text-muted dark:text-slate-600' : 'text-text-muted dark:text-slate-500')}>
                    Standard 2-Phase
                  </div>
                </div>
              </div>
              
              {/* Orange circular % badge on top right */}
              <div className="h-6 w-6 rounded-full bg-[#FF6B00] text-white font-black text-2xs flex items-center justify-center shadow-md">
                %
              </div>
            </button>

            {/* 1-Step Card */}
            <button
              onClick={() => setSelectedModel('1-Step')}
              className={cn(
                'p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between relative',
                selectedModel === '1-Step'
                  ? 'bg-surface dark:bg-white text-text dark:text-slate-950 border-2 border-primary dark:border-white shadow-xl'
                  : 'bg-surface-secondary/80 dark:bg-slate-900/60 border-border dark:border-slate-800 text-text-muted dark:text-slate-300 hover:border-border-strong dark:hover:border-slate-700'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center font-bold',
                  selectedModel === '1-Step' ? 'bg-primary dark:bg-blue-600 text-white' : 'bg-surface-secondary dark:bg-slate-800 text-text-muted dark:text-slate-300'
                )}>
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm sm:text-base">
                    1-Step
                  </div>
                  <div className={cn('text-2xs', selectedModel === '1-Step' ? 'text-text-muted dark:text-slate-600' : 'text-text-muted dark:text-slate-500')}>
                    Single step to {brandName} Account
                  </div>
                </div>
              </div>

              {/* Orange circular % badge on top right */}
              <div className="h-6 w-6 rounded-full bg-[#FF6B00] text-white font-black text-2xs flex items-center justify-center shadow-md">
                %
              </div>
            </button>

          </div>

          {/* Controls Bar: Currency Pills + Show Numbers + Hide Phases (ftmo_ref_matrix.png) */}
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            
            {/* Currency Selector Pill */}
            <div className="inline-flex p-1 rounded-xl bg-surface-secondary dark:bg-slate-900/90 border border-border dark:border-slate-800 w-full sm:w-auto">
              {CURRENCIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCurrency(c.key)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    selectedCurrency === c.key
                      ? 'bg-surface dark:bg-slate-800 text-text dark:text-white shadow-sm border border-border dark:border-slate-700'
                      : 'text-text-muted dark:text-slate-400 hover:text-text dark:hover:text-white'
                  )}
                >
                  <span className="text-sm">{c.flag}</span>
                  <span>{c.label}</span>
                </button>
              ))}
              <div className="px-3 py-1.5 text-xs text-text-muted dark:text-slate-500 flex items-center gap-1">
                <span>⁝ More</span>
              </div>
            </div>

            {/* Toggle Switches: Show Numbers + Hide Phases */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-end text-xs">
              
              {/* Show Numbers Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-text dark:text-slate-300 font-medium">Show Numbers</span>
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

              {/* Hide Phases Button with Eye Icon */}
              <button
                onClick={() => setHidePhases(!hidePhases)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                  hidePhases
                    ? 'bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-300'
                    : 'bg-surface-secondary dark:bg-slate-900 border border-border dark:border-slate-800 text-text-muted dark:text-slate-400 hover:text-text dark:hover:text-white'
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Hide phases</span>
              </button>

            </div>

          </div>

          {/* Account Sizes Row: Sleek scrollable row on mobile, centered flex on desktop */}
          <div className="max-w-5xl mx-auto flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-1 px-1 justify-start sm:justify-center mb-8">
            {accountSizes.map((size) => {
              const isSelected = selectedSize === size
              const is100K = size === 100000
              const label = size >= 1000 ? `${size / 1000}K` : `${size}`
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'px-5 sm:px-6 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer relative shrink-0',
                    isSelected
                      ? 'bg-primary text-white dark:bg-white dark:text-slate-950 shadow-lg'
                      : 'bg-surface-secondary dark:bg-slate-900 border border-border dark:border-slate-800 text-text dark:text-slate-300 hover:border-border-strong dark:hover:border-slate-700 hover:text-text dark:hover:text-white'
                  )}
                >
                  {is100K && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-surface dark:ring-[#000000]" />
                  )}
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          {/* ── MOBILE VIEW: Dedicated FTMO Mobile Objectives Card (ftmo_mobile_matrix.png) ── */}
          <div className="block md:hidden max-w-md mx-auto mb-8">
            <div className="rounded-3xl border border-border dark:border-slate-800 bg-surface dark:bg-[#070b14] p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              {/* Subtle blue corner ambient glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

              {/* Top Account Header & Giant Size */}
              <div className="text-center pb-4 border-b border-border/80 dark:border-slate-800/80">
                <span className="text-2xs uppercase tracking-wider text-text-muted dark:text-slate-400 font-bold">
                  {brandName} Account
                </span>
                <div className="text-3xl sm:text-4xl font-black text-text dark:text-white terminal-num mt-1">
                  {formatCurrencyVal(sizeUSD)}
                </div>

                {/* Primary Start Now Button (Full Width Mobile) */}
                <Button
                  asChild
                  className="w-full mt-4 h-12 rounded-xl bg-[#0084FF] hover:bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/25 cursor-pointer"
                >
                  <Link href={`/checkout?plan=${activePlan?.id || 1}&size=${sizeUSD}`}>
                    Start now
                  </Link>
                </Button>

                <div className="text-2xs text-text-muted dark:text-slate-400 mt-2.5">
                  One-time refundable fee from{' '}
                  <span className="font-bold text-text dark:text-white terminal-num">
                    {currencyMeta.symbol}{convertedPrice}
                  </span>
                </div>
              </div>

              {/* Clean Key-Value Objective Rows (divide-y, zero collision) */}
              <div className="divide-y divide-border/80 dark:divide-slate-800/80 text-xs mt-2">
                
                {/* Profit Target */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-white flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Profit Target</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-text dark:text-white terminal-num">
                      <span className="text-3xs text-text-muted dark:text-slate-400 font-normal mr-1">Phase 1:</span>
                      {showNumbers ? formatCurrencyVal(sizeUSD * (p1TargetPct / 100)) : `${p1TargetPct}%`}
                    </div>
                    {selectedModel === '2-Step' && !hidePhases && (
                      <div className="text-2xs text-text-muted dark:text-slate-400 terminal-num mt-0.5">
                        <span className="text-3xs text-text-muted dark:text-slate-500 mr-1">Phase 2:</span>
                        {showNumbers ? formatCurrencyVal(sizeUSD * (p2TargetPct / 100)) : `${p2TargetPct}%`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Max Daily Loss */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-slate-300 flex items-center gap-1.5">
                    <ArrowDown className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Max Daily Loss</span>
                  </div>
                  <div className="font-bold text-text dark:text-white terminal-num">
                    {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                  </div>
                </div>

                {/* Max Loss */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-slate-300 flex items-center gap-1.5">
                    <ArrowDown className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Max Loss</span>
                  </div>
                  <div className="font-bold text-text dark:text-white terminal-num">
                    {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                  </div>
                </div>

                {/* Min Trading days */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Min Trading days</span>
                  </div>
                  <div className="font-bold text-text dark:text-white">
                    {minTradingDays} days
                  </div>
                </div>

                {/* Trading Period */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Trading Period</span>
                  </div>
                  <div className="font-bold text-text dark:text-white">
                    Unlimited
                  </div>
                </div>

                {/* Refund */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-slate-300 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Refund</span>
                  </div>
                  <div>
                    <span className="text-text dark:text-white font-semibold text-xs">Yes </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-2xs uppercase">
                      100%
                    </span>
                  </div>
                </div>

                {/* Rewards */}
                <div className="py-3 flex items-center justify-between">
                  <div className="font-semibold text-text dark:text-slate-300 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" />
                    <span className="border-b border-dotted border-border dark:border-slate-600">Rewards</span>
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Up to 90% of the profit
                  </div>
                </div>

              </div>

              {/* FTMO Style Average Reward Pill (ftmo_mobile_matrix.png) */}
              <div className="mt-4 p-2.5 rounded-xl bg-surface-secondary dark:bg-slate-900/90 border border-border dark:border-slate-800 text-center text-xs text-text-muted dark:text-slate-400 font-medium">
                {currencyMeta.symbol}{Math.round(sizeUSD * 0.07 * currencyMeta.rate).toLocaleString()} Avg. Reward ⓘ
              </div>

            </div>
          </div>

          {/* ── DESKTOP/TABLET VIEW: 4-Column Table Matrix (ftmo_ref_matrix.png) ── */}
          <div className="hidden md:block max-w-5xl mx-auto rounded-3xl border border-border dark:border-slate-800 bg-surface dark:bg-[#070b14] shadow-2xl overflow-hidden backdrop-blur-xl">
            <div className="overflow-x-auto">
              <div className="min-w-[660px]">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-surface-secondary/70 dark:bg-[#05080f] py-4 px-6 border-b border-border dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-text-muted dark:text-slate-400">
                  <div className="col-span-4 flex items-center">
                    <span>TRADING OBJECTIVES</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="text-2xs text-text-muted dark:text-slate-500 font-bold flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3 text-cyan-600 dark:text-cyan-400" /> PHASE 1
                    </div>
                    <div className="text-xs font-black text-text dark:text-white mt-0.5">
                      Challenge
                    </div>
                  </div>
                  {selectedModel === '2-Step' && !hidePhases ? (
                    <div className="col-span-3 text-center">
                      <div className="text-2xs text-text-muted dark:text-slate-500 font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" /> PHASE 2
                      </div>
                      <div className="text-xs font-black text-text dark:text-white mt-0.5">
                        Verification
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-3 text-center text-text-muted/60 dark:text-slate-600">
                      —
                    </div>
                  )}
                  {/* Account Column with subtle blue highlight */}
                  <div className="col-span-3 text-center bg-blue-500/10 dark:bg-blue-950/20 -my-4 py-4 px-2 border-l border-blue-500/20 dark:border-blue-900/30">
                    <div className="text-2xs text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center gap-1">
                      <Award className="h-3 w-3 text-cyan-600 dark:text-cyan-400" /> ACCOUNT
                    </div>
                    <div className="text-xs font-black text-text dark:text-white mt-0.5">
                      {brandName} Account
                    </div>
                  </div>
                </div>

                {/* Matrix Rows: EXACT FTMO SEQUENCE (ftmo_ref_matrix.png) */}
                <div className="divide-y divide-border/60 dark:divide-slate-800/80 text-xs sm:text-sm font-medium">
                  
                  {/* Row 1: Profit Target (Row 1 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-bold text-text dark:text-white flex items-center gap-2">
                      <Target className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Profit Target</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text dark:text-white terminal-num">
                      {showNumbers ? formatCurrencyVal(sizeUSD * (p1TargetPct / 100)) : `${p1TargetPct}%`}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white terminal-num">
                      {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (p2TargetPct / 100)) : `${p2TargetPct}%`)}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      Unlimited
                    </div>
                  </div>

                  {/* Row 2: Maximum Daily Loss (Row 2 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-semibold text-text dark:text-slate-200 flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-text-muted dark:text-slate-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Max Daily Loss</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text dark:text-white terminal-num">
                      {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white terminal-num">
                      {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`)}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white terminal-num bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      {showNumbers ? formatCurrencyVal(sizeUSD * (dailyDDPct / 100)) : `${dailyDDPct}%`}
                    </div>
                  </div>

                  {/* Row 3: Maximum Loss (Row 3 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-semibold text-text dark:text-slate-200 flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-text-muted dark:text-slate-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Max Loss</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text dark:text-white terminal-num">
                      {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white terminal-num">
                      {selectedModel === '1-Step' ? '—' : (showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`)}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white terminal-num bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      {showNumbers ? formatCurrencyVal(sizeUSD * (maxDDPct / 100)) : `${maxDDPct}%`}
                    </div>
                  </div>

                  {/* Row 4: Minimum Trading Days (Row 4 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-semibold text-text dark:text-slate-200 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-text-muted dark:text-slate-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Min Trading days</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text dark:text-white">
                      {minTradingDays} days
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white">
                      {selectedModel === '1-Step' ? '—' : `${minTradingDays} days`}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      Unlimited
                    </div>
                  </div>

                  {/* Row 5: Trading Period (Row 5 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-semibold text-text dark:text-slate-200 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-text-muted dark:text-slate-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Trading Period</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text dark:text-white">
                      Unlimited
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white">
                      {selectedModel === '1-Step' ? '—' : 'Unlimited'}
                    </div>
                    <div className="col-span-3 text-center font-bold text-text dark:text-white bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      Unlimited
                    </div>
                  </div>

                  {/* Row 6: Refund (Row 6 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-semibold text-text dark:text-slate-200 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-text-muted dark:text-slate-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Refund</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text-muted dark:text-slate-500">
                      -
                    </div>
                    <div className="col-span-3 text-center font-bold text-text-muted dark:text-slate-500">
                      -
                    </div>
                    <div className="col-span-3 text-center font-bold bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      <span className="text-text dark:text-white font-semibold">Yes </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-2xs uppercase">
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Row 7: Rewards (Row 7 on FTMO!) */}
                  <div className="grid grid-cols-12 py-3.5 px-6 items-center hover:bg-surface-secondary/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-4 font-semibold text-text dark:text-slate-200 flex items-center gap-2">
                      <Award className="h-4 w-4 text-text-muted dark:text-slate-400 shrink-0" />
                      <span className="border-b border-dotted border-border dark:border-slate-600">Rewards</span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-text-muted dark:text-slate-500">
                      -
                    </div>
                    <div className="col-span-3 text-center font-bold text-text-muted dark:text-slate-500">
                      -
                    </div>
                    <div className="col-span-3 text-center font-bold bg-blue-500/10 dark:bg-blue-950/20 -my-3.5 py-3.5 border-l border-blue-500/20 dark:border-blue-900/30">
                      <span className="text-text dark:text-white">Up to </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">90%</span>
                      <span className="text-text dark:text-white"> of the profit</span>
                    </div>
                  </div>

                </div>

                {/* Bottom Checkout Bar (ftmo_ref_matrix.png) */}
                <div className="p-6 bg-surface-secondary/70 dark:bg-[#05080f] border-t border-border dark:border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-text-muted dark:text-slate-400">
                      {brandName} Account
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-text dark:text-white terminal-num mt-0.5">
                      {formatCurrencyVal(sizeUSD)}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-2xs uppercase tracking-wider text-text-muted dark:text-slate-400">Price</div>
                      <div className="text-xl sm:text-2xl font-black text-text dark:text-white terminal-num">
                        {currencyMeta.symbol}{convertedPrice}
                      </div>
                    </div>

                    <Button
                      asChild
                      className="h-12 px-10 rounded-xl bg-[#0084FF] hover:bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/25 cursor-pointer"
                    >
                      <Link href={`/checkout?plan=${activePlan?.id || 1}&size=${sizeUSD}`}>
                        Start now
                      </Link>
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Value Pills Bar Below Matrix (ftmo_ref_matrix.png) */}
          <div className="mt-8 max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-text-muted dark:text-slate-400">
            {['Academy', 'Psychology Course', 'Account MetriX', 'Economic Calendar', 'Equity Simulator', 'Trading Journal', 'News Indicator'].map((tool, idx) => (
              <span
                key={idx}
                className="px-4 py-2 rounded-full bg-surface dark:bg-slate-950 border border-border dark:border-slate-800 text-text dark:text-slate-300 font-medium hover:border-border-hover dark:hover:border-slate-700 transition-colors"
              >
                {tool}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* ── 4. How It Works (ftmo_ref_how_it_works.png) ────────────────── */}
      <section className="py-16 sm:py-24 border-b border-border dark:border-slate-800/60 bg-surface dark:bg-[#000000] relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-5xl font-black text-text dark:text-white tracking-tight">
              How It Works
            </h2>
          </div>

          {/* 3 Process Cards with Circular Arrow Connectors (ftmo_ref_how_it_works.png) */}
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 lg:gap-6 mb-12 relative">
            
            {/* Step 1: Evaluation Process */}
            <div className="w-full md:w-1/3 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-blue-50/70 dark:from-blue-900/60 via-surface dark:via-slate-950 to-surface dark:to-slate-950 border border-blue-500/30 flex flex-col justify-between min-h-[440px] relative overflow-hidden shadow-lg">
              <div>
                <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-white flex items-center justify-center mb-4">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-2xs uppercase tracking-wider font-bold text-blue-500 dark:text-blue-400">
                  EVALUATION PROCESS
                </span>
                <h3 className="text-2xl font-black text-text dark:text-white mt-1 mb-2">
                  Prove your skills
                </h3>
                <p className="text-xs text-text-muted dark:text-slate-300 mb-6 leading-relaxed">
                  Prove your skills in a 1-Step {brandName} Challenge or 2-Step Evaluation Process and gain your {brandName} Account.
                </p>

                {/* Checklist Pills inside Card 1 */}
                <div className="space-y-2 text-xs text-text dark:text-white">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border dark:border-slate-800">
                    <span className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" /> Profit Target</span>
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border dark:border-slate-800">
                    <span className="flex items-center gap-2"><ArrowDown className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" /> Max. Daily Loss</span>
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border dark:border-slate-800">
                    <span className="flex items-center gap-2"><ArrowDown className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" /> Max. Loss</span>
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary/80 dark:bg-slate-900/80 border border-border dark:border-slate-800">
                    <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-text-muted dark:text-slate-400" /> Min. Trading days</span>
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Circular Arrow Connector 1 -> 2 */}
            <div className="hidden md:flex h-10 w-10 rounded-full bg-surface dark:bg-slate-900 border border-border dark:border-slate-800 items-center justify-center text-text-muted dark:text-slate-300 shrink-0 z-10 shadow-lg">
              <ArrowRight className="h-4 w-4" />
            </div>

            {/* Step 2: FTMO Account */}
            <div className="w-full md:w-1/3 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-emerald-50/70 dark:from-emerald-900/60 via-surface dark:via-slate-950 to-surface dark:to-slate-950 border border-emerald-500/30 flex flex-col justify-between min-h-[440px] relative overflow-hidden shadow-lg">
              <div>
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-white flex items-center justify-center mb-4">
                  <DollarSign className="h-4 w-4" />
                </div>
                <span className="text-2xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                  {brandName.toUpperCase()} ACCOUNT
                </span>
                <h3 className="text-2xl font-black text-text dark:text-white mt-1 mb-2">
                  Earn real-money rewards
                </h3>
                <p className="text-xs text-text-muted dark:text-slate-300 mb-6 leading-relaxed">
                  Trade in a simulated environment and earn performance-based rewards.
                </p>

                {/* Photorealistic Reward Certificate Mockup (ftmo_ref_how_it_works.png) */}
                <div className="rounded-2xl bg-surface-secondary dark:bg-[#090d16] border border-emerald-500/40 p-4 relative shadow-2xl overflow-hidden">
                  <div className="text-3xs uppercase tracking-wider font-black text-text-muted dark:text-slate-400 flex items-center gap-1">
                    <Award className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> {brandName} REWARD
                  </div>
                  <div className="mt-2 text-3xs text-text-muted dark:text-slate-400">Proudly presented to:</div>
                  <div className="text-xs font-bold text-text dark:text-white">Elliott McDonald</div>
                  
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="text-3xs text-text-muted dark:text-slate-400">Your reward:</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 terminal-num">$20,335.70</div>
                    </div>
                    {/* Simulated QR code */}
                    <div className="h-10 w-10 bg-surface dark:bg-slate-900 border border-border dark:border-slate-700 p-1 rounded-sm grid grid-cols-2 gap-0.5">
                      <div className="bg-emerald-500/80 rounded-xs" />
                      <div className="bg-border dark:bg-slate-700 rounded-xs" />
                      <div className="bg-border dark:bg-slate-700 rounded-xs" />
                      <div className="bg-emerald-500/80 rounded-xs" />
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border dark:border-slate-800/80 flex items-center justify-between text-3xs text-text-muted dark:text-slate-500">
                    <span>24 Jun 2025</span>
                    <span className="italic font-serif text-text-muted dark:text-slate-300">Otakar S. CEO</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Circular Arrow Connector 2 -> 3 */}
            <div className="hidden md:flex h-10 w-10 rounded-full bg-surface dark:bg-slate-900 border border-border dark:border-slate-800 items-center justify-center text-text-muted dark:text-slate-300 shrink-0 z-10 shadow-lg">
              <ArrowRight className="h-4 w-4" />
            </div>

            {/* Step 3: Premium Programme */}
            <div className="w-full md:w-1/3 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-amber-50/70 dark:from-amber-900/60 via-surface dark:via-slate-950 to-surface dark:to-slate-950 border border-amber-500/30 flex flex-col justify-between min-h-[440px] relative overflow-hidden shadow-lg">
              <div>
                <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-white flex items-center justify-center mb-4">
                  <Crown className="h-4 w-4" />
                </div>
                <span className="text-2xs uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
                  PREMIUM PROGRAMME
                </span>
                <h3 className="text-2xl font-black text-text dark:text-white mt-1 mb-2">
                  Achieve More. Gain More.
                </h3>
                <p className="text-xs text-text-muted dark:text-slate-300 mb-2 leading-relaxed">
                  Access exclusive benefits with Premium Programme and Quantlane by {brandName}.
                </p>
                <div className="text-xs font-bold text-text dark:text-white underline mb-6 cursor-pointer">
                  Learn more
                </div>

                {/* 3 Metallic Pedestal Cards (ftmo_ref_how_it_works.png) */}
                <div className="grid grid-cols-3 gap-2 text-center text-3xs font-black uppercase">
                  <div className="p-3 rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-950 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex flex-col justify-center items-center h-24 shadow-md">
                    <span className="text-2xs text-cyan-600 dark:text-cyan-400 mb-1">◆</span>
                    <span>PRIME</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-b from-amber-100 to-amber-200 dark:from-amber-700 dark:to-amber-950 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-600 flex flex-col justify-center items-center h-24 shadow-md">
                    <span className="text-2xs text-amber-600 dark:text-amber-300 mb-1">★</span>
                    <span>QUANTLANE</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-b from-yellow-100 to-yellow-200 dark:from-yellow-600 dark:to-yellow-950 text-yellow-900 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-500 flex flex-col justify-center items-center h-24 shadow-md">
                    <span className="text-2xs text-yellow-600 dark:text-yellow-300 mb-1">♛</span>
                    <span>SUPREME</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Dual Bottom CTAs */}
          <div className="text-center flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 rounded-full bg-[#0084FF] hover:bg-blue-600 text-white font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/25">
              <Link href="#pricing">Start {brandName} Challenge</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-full border-border dark:border-slate-800 bg-surface dark:bg-slate-950 hover:bg-surface-secondary dark:hover:bg-slate-900 text-text dark:text-slate-300 hover:text-text dark:hover:text-white text-sm font-semibold cursor-pointer">
              <Link href="#pricing">How it works</Link>
            </Button>
          </div>

        </div>
      </section>

      {/* ── 5. Proof & Testimonials (ftmo_ref_proof.png) ──────────────── */}
      <section className="py-16 sm:py-24 border-b border-border dark:border-slate-800/60 bg-surface-secondary/40 dark:bg-[#02050b] relative">
        <div className="container max-w-7xl mx-auto px-4">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-5xl font-black text-text dark:text-white tracking-tight">
              Trusted by Millions of Traders
            </h2>
          </div>

          {/* Single Clean Line Metric Strip (ftmo_ref_proof.png) */}
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 sm:gap-16 mb-14 text-center">
            <div>
              <span className="text-2xl sm:text-3xl font-black text-text dark:text-white terminal-num">4.5M+</span>
              <span className="text-xs uppercase tracking-wider text-text-muted dark:text-slate-400 ml-2 font-semibold">Customers worldwide</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-text dark:text-white terminal-num">$650M+</span>
              <span className="text-xs uppercase tracking-wider text-text-muted dark:text-slate-400 ml-2 font-semibold">Paid in rewards</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-text dark:text-white terminal-num">140+</span>
              <span className="text-xs uppercase tracking-wider text-text-muted dark:text-slate-400 ml-2 font-semibold">Countries served</span>
            </div>
          </div>

          {/* Video Interview Cards Carousel/Grid (ftmo_ref_proof.png) */}
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-4 bg-surface dark:bg-slate-950/80 border border-border dark:border-slate-800/90 hover:border-border-hover dark:hover:border-slate-700 transition-colors flex flex-col justify-between shadow-sm"
              >
                <div>
                  {/* Video Thumbnail Placeholder with YouTube pill & Play button */}
                  <div className="h-36 rounded-xl bg-surface-secondary dark:bg-slate-900 border border-border dark:border-slate-800 relative overflow-hidden flex items-center justify-center mb-4">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    
                    {/* YouTube View pill */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-3xs font-bold text-white flex items-center gap-1">
                      <Play className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                      <span>YouTube • {t.views}</span>
                    </div>

                    {/* Centered Play Button */}
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 hover:scale-110 transition-transform cursor-pointer">
                      <Play className="h-4 w-4 fill-white ml-0.5" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{t.flag}</span>
                    <div>
                      <div className="font-bold text-sm text-text dark:text-white">{t.name}</div>
                      <div className="text-2xs text-text-muted dark:text-slate-400">{t.country}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border dark:border-slate-800/80 flex items-center justify-between text-2xs">
                  <div>
                    <div className="text-3xs uppercase tracking-wider text-text-muted dark:text-slate-400">REWARDS EARNED</div>
                    <div className="font-black text-sm text-text dark:text-white terminal-num mt-0.5">{t.rewards}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xs uppercase tracking-wider text-text-muted dark:text-slate-400">TRADING STYLE</div>
                    <div className="font-semibold text-text dark:text-slate-200 mt-0.5">{t.style}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trustpilot Score Below Carousel (ftmo_ref_proof.png) */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2">
              <span className="font-bold text-text dark:text-white text-base">Excellent</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-5 w-5 bg-[#00b67a] flex items-center justify-center rounded-xs text-white">
                    <Star className="h-3 w-3 fill-white text-white" />
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-text-muted dark:text-slate-400 mt-1">
              Rated 4.8 / 5 based on <span className="underline font-semibold text-text dark:text-white">54,231 reviews</span> on <span className="font-bold text-text dark:text-white">★ Trustpilot</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. Bottom CTA Banner & Tablet Mockup (ftmo_ref_cta.png) ────── */}
      <section className="py-20 border-b border-border dark:border-slate-800/60 bg-surface dark:bg-[#000000] relative overflow-hidden">
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
                    <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                    <span>As many Free Trials as you need</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                    <span>Up to $200,000 account</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
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
                    className="h-12 px-8 rounded-full border-2 border-white hover:bg-white/10 text-white font-bold text-sm cursor-pointer"
                  >
                    <Link href="#pricing">Free Trial</Link>
                  </Button>
                </div>
              </div>

              {/* Right Column: Angled Tablet Mockup (ftmo_ref_cta.png) */}
              <div className="lg:col-span-5 flex items-center justify-center">
                <div className="dark w-full max-w-sm rounded-2xl bg-slate-950 p-4 border-4 border-slate-900 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-300">
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

          {/* Prove Your Skills with a Trusted Firm (ftmo_ref_cta.png) */}
          <div className="mt-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h4 className="text-xl sm:text-2xl font-black text-text dark:text-white">
                Prove Your Skills with a Trusted Firm
              </h4>
              <p className="text-xs sm:text-sm text-text-muted dark:text-slate-400 mt-1">
                We’ve been empowering traders since 2015. Join them now!
              </p>
            </div>
            <div className="flex items-center gap-6 sm:gap-10 text-xs sm:text-sm">
              <div>
                <div className="font-black text-text dark:text-white text-lg sm:text-xl terminal-num">4.5M+</div>
                <div className="text-3xs text-text-muted dark:text-slate-400 uppercase">Customers worldwide</div>
              </div>
              <div>
                <div className="font-black text-text dark:text-white text-lg sm:text-xl terminal-num">$650M+</div>
                <div className="text-3xs text-text-muted dark:text-slate-400 uppercase">Paid in rewards</div>
              </div>
              <div>
                <div className="font-black text-text dark:text-white text-lg sm:text-xl terminal-num">4.8/5</div>
                <div className="text-3xs text-text-muted dark:text-slate-400 uppercase">Trustpilot</div>
              </div>
            </div>
          </div>

          {/* Secondary Authority Logos Strip (ftmo_ref_cta.png) */}
          <div className="mt-10 pt-8 border-t border-border dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6 text-text-muted dark:text-slate-400 text-xs font-bold uppercase">
              <span>Deloitte Fast 50</span>
              <span>Forbes</span>
              <span>Finance Magnates</span>
              <span>EY Entrepreneur Of The Year</span>
            </div>
            <div className="text-xs text-text-muted dark:text-slate-400 flex items-center gap-2">
              <span className="font-bold text-text dark:text-white">Excellent</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} className="h-3.5 w-3.5 bg-[#00b67a] flex items-center justify-center rounded-xs text-white">
                    <Star className="h-2 w-2 fill-white text-white" />
                  </div>
                ))}
              </div>
              <span>54,231 reviews on ★ Trustpilot</span>
            </div>
          </div>

        </div>
      </section>

    </div>
  )
}
