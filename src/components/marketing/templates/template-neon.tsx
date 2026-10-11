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
  ChevronLeft,
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
  Percent,
  CreditCard,
  MessageSquare,
  Bot,
  SlidersHorizontal,
  Minus,
  Plus,
  Calculator,
  Heart
} from 'lucide-react'

// ── Currency definitions & rates ──────────────────────────────────────────────
type CurrencyKey = 'USD' | 'EUR' | 'GBP'

const CURRENCIES: { key: CurrencyKey; symbol: string; rate: number }[] = [
  { key: 'USD', symbol: '$', rate: 1.0 },
  { key: 'EUR', symbol: '€', rate: 0.92 },
  { key: 'GBP', symbol: '£', rate: 0.79 },
]

// ── FundedNext Challenge Models Definition ────────────────────────────────────
export type ChallengeModelId =
  | 'Stellar 2-Step'
  | 'Stellar 1-Step'
  | 'Stellar Lite'
  | 'Stellar Instant'

interface ModelConfig {
  id: ChallengeModelId
  title: string
  subtitle: string
  badge?: string
  phases: number
  // Challenge Rules
  p1TargetPct: number | null
  p2TargetPct: number | null
  dailyLossPct: number | null
  maxLossPct: number
  drawdownType: string
  minTradingDays: string
  newsTrading: string
  performanceRewardPct: number | null
  resetApplicable: string
  // Funded & Reward Rules
  fundedDailyLossPct: number | null
  fundedMaxLossPct: number
  rewardShare: string
  firstWithdrawalDefault: number
  firstWithdrawalLabel: string
  subsequentWithdrawal: string
  refundableFee: string
  newsTradingProfit: string
  maxRisk: string
  rewardCondition: string
  consistency: string
  // Benchmark pricing map
  prices: Record<number, number>
}

const CHALLENGE_MODELS: Record<ChallengeModelId, ModelConfig> = {
  'Stellar 2-Step': {
    id: 'Stellar 2-Step',
    title: 'Stellar 2-Step',
    subtitle: 'News Trading Allowed | Refund on 1st Reward',
    phases: 2,
    p1TargetPct: 8,
    p2TargetPct: 5,
    dailyLossPct: 5,
    maxLossPct: 10,
    drawdownType: 'Static',
    minTradingDays: '5 Days',
    newsTrading: 'Allowed',
    performanceRewardPct: 15,
    resetApplicable: 'Yes',
    fundedDailyLossPct: 5,
    fundedMaxLossPct: 10,
    rewardShare: '80%',
    firstWithdrawalDefault: 21,
    firstWithdrawalLabel: '21 Days',
    subsequentWithdrawal: '14 Days',
    refundableFee: 'With 1st Reward',
    newsTradingProfit: '40%',
    maxRisk: '3% At any time',
    rewardCondition: 'N/A',
    consistency: 'N/A',
    prices: {
      6000: 59.99,
      15000: 119.99,
      25000: 199.99,
      50000: 299.99,
      100000: 549.99,
      200000: 1099.99,
    },
  },
  'Stellar 1-Step': {
    id: 'Stellar 1-Step',
    title: 'Stellar 1-Step',
    subtitle: 'News Trading Allowed | Reward Every 5 Business Days',
    phases: 1,
    p1TargetPct: 10,
    p2TargetPct: null,
    dailyLossPct: 3,
    maxLossPct: 6,
    drawdownType: 'Static',
    minTradingDays: '2 Days',
    newsTrading: 'Allowed',
    performanceRewardPct: 15,
    resetApplicable: 'Yes',
    fundedDailyLossPct: 3,
    fundedMaxLossPct: 6,
    rewardShare: '80%',
    firstWithdrawalDefault: 5,
    firstWithdrawalLabel: '5 Business Days',
    subsequentWithdrawal: '5 Business Days',
    refundableFee: 'With 1st Reward',
    newsTradingProfit: '40%',
    maxRisk: '3% At any time',
    rewardCondition: 'N/A',
    consistency: 'N/A',
    prices: {
      6000: 65.0,
      15000: 129.0,
      25000: 219.0,
      50000: 329.0,
      100000: 589.0,
      200000: 1149.0,
    },
  },
  'Stellar Lite': {
    id: 'Stellar Lite',
    title: 'Stellar Lite',
    subtitle: 'Most Affordable 2 Step | News Trading Allowed',
    phases: 2,
    p1TargetPct: 8,
    p2TargetPct: 4,
    dailyLossPct: 4,
    maxLossPct: 8,
    drawdownType: 'Static',
    minTradingDays: '5 Days',
    newsTrading: 'Allowed',
    performanceRewardPct: 15,
    resetApplicable: 'Yes',
    fundedDailyLossPct: 4,
    fundedMaxLossPct: 8,
    rewardShare: '80%',
    firstWithdrawalDefault: 21,
    firstWithdrawalLabel: '21 Days',
    subsequentWithdrawal: '14 Days',
    refundableFee: 'With 1st Reward',
    newsTradingProfit: '40%',
    maxRisk: '3% At any time',
    rewardCondition: 'N/A',
    consistency: 'N/A',
    prices: {
      6000: 32.0,
      15000: 65.0,
      25000: 109.0,
      50000: 189.0,
      100000: 329.0,
      200000: 629.0,
    },
  },
  'Stellar Instant': {
    id: 'Stellar Instant',
    title: 'Stellar Instant',
    subtitle: 'No Daily Loss Limit | No Consistency Rule',
    phases: 0,
    p1TargetPct: null,
    p2TargetPct: null,
    dailyLossPct: null,
    maxLossPct: 10,
    drawdownType: 'Static',
    minTradingDays: '0 Days',
    newsTrading: 'Allowed',
    performanceRewardPct: null,
    resetApplicable: 'No',
    fundedDailyLossPct: null,
    fundedMaxLossPct: 10,
    rewardShare: '80%',
    firstWithdrawalDefault: 14,
    firstWithdrawalLabel: '14 Days',
    subsequentWithdrawal: '14 Days',
    refundableFee: 'N/A',
    newsTradingProfit: 'Allowed',
    maxRisk: '3% At any time',
    rewardCondition: 'N/A',
    consistency: 'N/A',
    prices: {
      6000: 199.0,
      15000: 399.0,
      25000: 599.0,
      50000: 1099.0,
      100000: 1999.0,
      200000: 3899.0,
    },
  },
}

// ── Top Verified Payouts (Real-Time Stream) ───────────────────────────────────
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
    model: 'Stellar Lite',
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
    quote:
      'The 15% profit bonus during Phase 1 and 2 was credited directly to my wallet on my first withdrawal. No other firm in the world gives you a bonus from your demo phase!',
    rating: 5,
  },
  {
    name: 'Sebastian W.',
    location: 'Frankfurt, Germany',
    flag: '🇩🇪',
    payout: '$38,940',
    model: 'Stellar 1-Step ($100K)',
    quote:
      'Balance-Based daily drawdown is a lifesaver. On other firms I lost accounts because of trailing equity spikes. Here, 00:00 balance is fixed. 100% fair and transparent.',
    rating: 5,
  },
  {
    name: 'Elena V.',
    location: 'Madrid, Spain',
    flag: '🇪🇸',
    payout: '$29,400',
    model: 'Stellar 2-Step ($100K)',
    quote:
      'No time limit allowed me to wait for high-probability swing setups during CPI news. Passed Phase 1 in 14 days and Phase 2 in 8 days. Payout received in 4 hours.',
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

  // Model & Selection States
  const [selectedMarket, setSelectedMarket] = useState<'CFDs' | 'Futures'>('CFDs')
  const [selectedModel, setSelectedModel] = useState<ChallengeModelId>('Stellar 2-Step')
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>('USD')
  const [selectedSize, setSelectedSize] = useState<number>(6000)
  const [showPercentage, setShowPercentage] = useState<boolean>(true)
  const [quantity, setQuantity] = useState<number>(1)
  const [withdrawalDays, setWithdrawalDays] = useState<number>(21)
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
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

  // Account size options: 6K, 15K, 25K, 50K, 100K, 200K
  const accountSizes = [6000, 15000, 25000, 50000, 100000, 200000]

  // Currency helper
  const currencyMeta = useMemo(() => {
    return CURRENCIES.find((c) => c.key === selectedCurrency) || CURRENCIES[0]
  }, [selectedCurrency])

  const formatCurrencyVal = (amountInUSD: number) => {
    const converted = amountInUSD * currencyMeta.rate
    if (converted >= 1000) {
      return `${currencyMeta.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    }
    return `${currencyMeta.symbol}${converted.toFixed(2)}`
  }

  const formatKSize = (size: number) => {
    return `$${Math.round(size / 1000)}K`
  }

  // Active Model Configuration
  const currentModelConfig = CHALLENGE_MODELS[selectedModel]

  // Sync withdrawal default when model changes
  useEffect(() => {
    setWithdrawalDays(currentModelConfig.firstWithdrawalDefault)
  }, [selectedModel, currentModelConfig.firstWithdrawalDefault])

  // Average reward calculation (FundedNext benchmark: $296.55 for $6K, scaling up)
  const avgReward = useMemo(() => {
    const scaleFactor = selectedSize / 6000
    const baseReward = 296.55
    return (baseReward * scaleFactor).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }, [selectedSize])

  // 15% Performance Reward Dollar Calculation
  const performanceRewardDollar = useMemo(() => {
    if (!currentModelConfig.performanceRewardPct) return 'N/A'
    const p1 = (currentModelConfig.p1TargetPct || 0) / 100
    const p2 = (currentModelConfig.p2TargetPct || 0) / 100
    const totalProfit = selectedSize * (p1 + p2)
    const bonus = Math.round(totalProfit * (currentModelConfig.performanceRewardPct / 100))
    return `$${bonus.toLocaleString()}`
  }, [selectedSize, currentModelConfig])

  // Base fee calculation with API matching or benchmark map
  const baseFeeUSD = useMemo(() => {
    // Check if live API provides an exact plan match
    const match = effectivePlans.find((p) => {
      const matchSize = toNum(p.account_size) === selectedSize
      const matchPhases = Number(p.phases) === currentModelConfig.phases
      return matchSize && matchPhases
    })

    if (match && toNum(match.price) > 0) {
      return toNum(match.price)
    }

    return currentModelConfig.prices[selectedSize] || 59.99
  }, [effectivePlans, selectedSize, currentModelConfig])

  // Multi-account tiered discount pricing
  const tieredPrices = useMemo(() => {
    const p1 = baseFeeUSD
    const p2 = baseFeeUSD * 0.9 // 10% OFF
    const p3 = baseFeeUSD * 0.85 // 15% OFF
    return { p1, p2, p3 }
  }, [baseFeeUSD])

  // Total checkout cost based on quantity
  const totalCostUSD = useMemo(() => {
    if (quantity === 1) return tieredPrices.p1
    if (quantity === 2) return tieredPrices.p1 + tieredPrices.p2
    if (quantity === 3) return tieredPrices.p1 + tieredPrices.p2 + tieredPrices.p3
    // 4 or more accounts: all subsequent get 15% OFF
    return tieredPrices.p1 + tieredPrices.p2 + tieredPrices.p3 + (quantity - 3) * tieredPrices.p3
  }, [quantity, tieredPrices])

  // Matching plan for checkout URL
  const matchedPlan = useMemo(() => {
    const exact = effectivePlans.find((p) => {
      const matchSize = toNum(p.account_size) === selectedSize
      const matchPhases = Number(p.phases) === currentModelConfig.phases
      return matchSize && matchPhases
    })
    if (exact) return exact

    const bySize = effectivePlans.find((p) => toNum(p.account_size) === selectedSize)
    return bySize || effectivePlans[0]
  }, [effectivePlans, selectedSize, currentModelConfig])

  const checkoutUrl = `/checkout?plan=${matchedPlan?.id || 1}&plan_id=${matchedPlan?.id || 1}&size=${selectedSize}&model=${encodeURIComponent(selectedModel)}&qty=${quantity}`

  const toggleAddOn = (addon: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]
    )
  }

  return (
    <div className="w-full min-h-screen bg-bg text-text transition-colors duration-200 overflow-x-hidden font-sans selection:bg-[#635BFF] selection:text-white">

      {/* ── 1. EXACT FUNDEDNEXT HERO SECTION ─────────────────────────────── */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-[#635BFF]/15 via-violet-600/5 to-transparent blur-[140px] pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

          {/* FundedNext Onyx Rounded Canvas Card */}
          <div className="dark relative rounded-3xl sm:rounded-[2.5rem] bg-[#07070a] border border-white/10 shadow-2xl overflow-hidden py-14 sm:py-20 px-4 sm:px-12 text-center text-white">

            {/* Subtle top spotlight flare */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(99,91,255,0.22),transparent_70%)] blur-2xl pointer-events-none" />

            {/* Subtle grid backdrop inside canvas */}
            <div
              className="absolute inset-0 opacity-[0.035] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
                backgroundSize: '32px 32px',
              }}
            />

            <div className="relative z-10 max-w-4xl mx-auto">

              {/* 1. Trustpilot Pill Badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#14131d] border border-white/10 text-xs font-medium text-white mb-8 shadow-sm backdrop-blur-md"
              >
                {/* 5 Green Trustpilot Stars */}
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-2xs bg-[#00B67A] text-white"
                    >
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                    </span>
                  ))}
                </div>
                <span className="font-semibold text-white">Trustpilot</span>
                <span className="text-white/40">•</span>
                <span className="text-white/80">79k+ reviews</span>
                <span className="h-3 w-px bg-white/20" />
                <span className="flex items-center gap-1.5 text-white/90">
                  <Heart className="w-3 h-3 fill-[#635BFF] text-[#635BFF]" />
                  <span>loved by 82k+</span>
                </span>
              </motion.div>

              {/* 2. Giant Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-4xl sm:text-6xl md:text-7xl lg:text-[4.75rem] font-extrabold tracking-tight text-white leading-[1.06]"
              >
                We sponsor your <br />
                <span className="text-white">trading journey</span>
              </motion.h1>

              {/* 3. Three Value Pills */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto mt-10"
              >
                {/* Pill 1: Rewards in 24h (with clock/24 badge) */}
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#14131f] border border-white/10 text-left hover:border-[#635BFF]/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[#635BFF]/20 text-[#635BFF] flex items-center justify-center shrink-0 border border-[#635BFF]/30 relative">
                    <Clock className="w-5 h-5 text-violet-400" />
                    <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-xs bg-[#635BFF] text-white font-mono text-[9px] font-black leading-none">24</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Rewards in 24h</div>
                    <div className="text-xs text-white/60">or get $1,000 extra</div>
                  </div>
                </div>

                {/* Pill 2: One-time fee (with credit card badge) */}
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#14131f] border border-white/10 text-left hover:border-emerald-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 relative">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <Check className="absolute -bottom-1 -right-1 w-3.5 h-3.5 p-0.5 rounded-full bg-emerald-500 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">One-time fee</div>
                    <div className="text-xs text-white/60">No recurring costs</div>
                  </div>
                </div>

                {/* Pill 3: 24/7 support (with message bubble badge) */}
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#14131f] border border-white/10 text-left hover:border-cyan-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30 relative">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#14131f]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">24/7 support</div>
                    <div className="text-xs text-white/60">in 44 languages</div>
                  </div>
                </div>
              </motion.div>

              {/* 4. Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mt-10 flex flex-wrap items-center justify-center gap-4"
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-8 rounded-xl bg-[#635BFF] hover:bg-[#5248EE] text-white font-bold text-sm shadow-xl shadow-[#635BFF]/30 border-0 cursor-pointer transition-all"
                >
                  <Link href="#challenge-models" className="flex items-center gap-2">
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 rounded-xl bg-[#161522] hover:bg-[#1E1D2D] text-white border-white/15 text-sm font-semibold cursor-pointer transition-all"
                >
                  <Link href="#rules-comparison">How It Works</Link>
                </Button>
              </motion.div>

            </div>

            {/* Bottom 3D fan decorative graphic */}
            <div className="mt-14 -mb-8 flex justify-center opacity-60">
              <div className="w-64 h-8 bg-gradient-to-t from-[#635BFF]/30 to-transparent rounded-t-full blur-md" />
            </div>

          </div>

        </div>
      </section>

      {/* ── 2. REAL-TIME PAYOUT TICKER & LIVE DISBURSAL STREAM ───────────── */}
      <section className="py-8 bg-surface-secondary/40 border-y border-border/80">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">

            {/* Statistics */}
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
                <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">Global Reach</div>
                <div className="text-lg sm:text-xl font-black font-mono text-text mt-0.5 tabular-nums">
                  145+ Countries
                </div>
              </div>
            </div>

            {/* Live streaming status badge */}
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

      {/* ── 3. EXACT FUNDEDNEXT MODEL SELECTOR & OBJECTIVES SECTION ──────── */}
      <section id="challenge-models" className="scroll-mt-28 sm:scroll-mt-36 py-20 sm:py-28 relative">
        <span id="pricing" className="block relative -top-32 invisible pointer-events-none" />
        <div className="container max-w-7xl mx-auto px-4 sm:px-6">

          {/* Heading */}
          <div className="text-center sm:text-left max-w-3xl mb-8">
            <h2 className="text-3xl sm:text-5xl font-black text-text tracking-tight">
              Choose your next challenge
            </h2>
          </div>

          {/* Market Selector & Action Helpers Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
            
            {/* Market Selector: CFDs (active) vs Futures [50% OFF] */}
            <div className="inline-flex p-1 rounded-2xl bg-surface-secondary border border-border gap-1 shadow-xs">
              <button
                onClick={() => setSelectedMarket('CFDs')}
                className={cn(
                  'px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer',
                  selectedMarket === 'CFDs'
                    ? 'bg-[#18162e] border-2 border-[#635BFF] text-white shadow-md'
                    : 'text-text-muted hover:text-text'
                )}
              >
                CFDs
              </button>

              <button
                onClick={() => setSelectedMarket('Futures')}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer',
                  selectedMarket === 'Futures'
                    ? 'bg-[#18162e] border-2 border-[#635BFF] text-white shadow-md'
                    : 'text-text-muted hover:text-text'
                )}
              >
                <span>Futures</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-3xs font-mono font-black uppercase">
                  50% OFF
                </span>
              </button>
            </div>

            {/* Quick Helper Buttons: Compare, Ask AI, Help me choose, Calculator */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="#rules-comparison"
                className="px-4 py-2 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-xs font-semibold text-text transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Compare</span>
              </a>

              <a
                href="/dashboard/ai"
                className="px-4 py-2 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-xs font-semibold text-text transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676]" />
                <span>Ask {brandName === 'LaunchAPropFirm' ? 'Fundee' : 'AI'}</span>
              </a>

              <button
                onClick={() => setSelectedModel('Stellar 2-Step')}
                className="px-4 py-2 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-xs font-semibold text-text transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-[#635BFF]" />
                <span>Help me choose</span>
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('rules-comparison')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-text transition-colors flex items-center justify-center cursor-pointer"
                title="Calculator & Rules Breakdown"
                aria-label="Calculator and Rules Breakdown"
              >
                <Calculator className="w-4 h-4 text-text-muted hover:text-text" />
              </button>
            </div>

          </div>

          {/* 4 Model Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            {(Object.keys(CHALLENGE_MODELS) as ChallengeModelId[]).map((modelKey) => {
              const model = CHALLENGE_MODELS[modelKey]
              const isSelected = selectedModel === modelKey

              return (
                <button
                  key={modelKey}
                  onClick={() => setSelectedModel(modelKey)}
                  className={cn(
                    'p-5 rounded-2xl text-left transition-all cursor-pointer relative',
                    isSelected
                      ? 'bg-[#141226] border-2 border-[#635BFF] text-white shadow-lg shadow-[#635BFF]/20 ring-1 ring-[#635BFF]/30'
                      : 'bg-surface border border-border hover:border-[#635BFF]/40 text-text'
                  )}
                >
                  <div className="text-base sm:text-lg font-bold tracking-tight">
                    {model.title}
                  </div>
                  <div
                    className={cn(
                      'text-xs mt-1.5 leading-snug line-clamp-2',
                      isSelected ? 'text-white/70' : 'text-text-muted'
                    )}
                  >
                    {model.subtitle}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Account Sizes Row: Account $6K ($59.99) ... Account $200K ($1,099.99) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {accountSizes.map((size) => {
              const isSelected = selectedSize === size
              const displayPrice = currentModelConfig.prices[size] || 59.99

              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'p-4 rounded-2xl text-left transition-all cursor-pointer font-mono',
                    isSelected
                      ? 'bg-[#141226] border-2 border-[#635BFF] text-white shadow-lg shadow-[#635BFF]/20 ring-1 ring-[#635BFF]/30'
                      : 'bg-surface border border-border hover:border-[#635BFF]/40 text-text'
                  )}
                >
                  <div className={cn('text-2xs font-medium uppercase font-sans', isSelected ? 'text-white/60' : 'text-text-muted')}>
                    Account
                  </div>
                  <div className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
                    {formatKSize(size)}
                  </div>
                  <div
                    className={cn(
                      'text-xs font-bold mt-1 tabular-nums',
                      isSelected ? 'text-[#00E676]' : 'text-emerald-600 dark:text-[#00E676]'
                    )}
                  >
                    {formatCurrencyVal(displayPrice)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── THE 3-COLUMN CARD CONTAINER ──────────────────────────────── */}
          <div className="dark rounded-3xl bg-[#090812] border border-white/10 p-6 sm:p-8 text-white relative shadow-2xl overflow-hidden">

            {/* Top Bar: Show Percentage switch + Avg. Reward */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
              
              {/* Show Percentage toggle switch */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={showPercentage}
                    onChange={(e) => setShowPercentage(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#635BFF]" />
                </div>
                <span className="text-sm font-semibold text-white">Show Percentage</span>
              </label>

              {/* Avg Reward Callout */}
              <div className="flex items-center gap-2 text-xs text-white/80">
                <Info className="w-4 h-4 text-white/50" />
                <span>Avg. Reward : </span>
                <span className="font-bold font-mono text-[#00E676] text-sm tabular-nums">
                  ${avgReward}
                </span>
              </div>

            </div>

            {/* 3-Column Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">

              {/* ── COLUMN 1: Challenge Rules (col-span-4) ─────────────────── */}
              <div className="lg:col-span-4 space-y-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-white/60 pb-1">
                  Challenge Rules
                </div>

                {/* Phase 1 Target */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Phase 1 Profit Target</span>
                  </div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {currentModelConfig.p1TargetPct === null
                      ? 'N/A'
                      : showPercentage
                      ? `${currentModelConfig.p1TargetPct}%`
                      : formatCurrencyVal((selectedSize * currentModelConfig.p1TargetPct) / 100)}
                  </div>
                </div>

                {/* Phase 2 Target */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Phase 2 Profit Target</span>
                  </div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {currentModelConfig.p2TargetPct === null
                      ? 'N/A'
                      : showPercentage
                      ? `${currentModelConfig.p2TargetPct}%`
                      : formatCurrencyVal((selectedSize * currentModelConfig.p2TargetPct) / 100)}
                  </div>
                </div>

                {/* Daily Loss Limit */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Daily Loss Limit</span>
                  </div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {currentModelConfig.dailyLossPct === null
                      ? 'N/A'
                      : showPercentage
                      ? `${currentModelConfig.dailyLossPct}%`
                      : formatCurrencyVal((selectedSize * currentModelConfig.dailyLossPct) / 100)}
                  </div>
                </div>

                {/* Maximum Loss Limit */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Maximum Loss Limit</span>
                  </div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {showPercentage
                      ? `${currentModelConfig.maxLossPct}%`
                      : formatCurrencyVal((selectedSize * currentModelConfig.maxLossPct) / 100)}
                  </div>
                </div>

                {/* Drawdown Type */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Drawdown Type</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.drawdownType}
                  </div>
                </div>

                {/* Minimum Trading Days */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Minimum Trading Days</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.minTradingDays}
                  </div>
                </div>

                {/* News Trading */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>News Trading</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.newsTrading}
                  </div>
                </div>

                {/* 15% Performance Reward */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>15% Performance Reward</span>
                  </div>
                  <div className="font-mono font-bold text-[#00E676] tabular-nums">
                    {performanceRewardDollar}
                  </div>
                </div>

                {/* Reset Applicable */}
                <div className="flex items-center justify-between text-xs py-1.5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Reset Applicable</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.resetApplicable}
                  </div>
                </div>

              </div>

              {/* ── COLUMN 2: Funded & Reward Rules (col-span-4) ───────────── */}
              <div className="lg:col-span-4 space-y-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-white/60 pb-1">
                  Funded &amp; Reward Rules
                </div>

                {/* Daily Loss Limit */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Daily Loss Limit</span>
                  </div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {currentModelConfig.fundedDailyLossPct === null
                      ? 'N/A'
                      : showPercentage
                      ? `${currentModelConfig.fundedDailyLossPct}%`
                      : formatCurrencyVal((selectedSize * currentModelConfig.fundedDailyLossPct) / 100)}
                  </div>
                </div>

                {/* Maximum Loss Limit */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Maximum Loss Limit</span>
                  </div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {showPercentage
                      ? `${currentModelConfig.fundedMaxLossPct}%`
                      : formatCurrencyVal((selectedSize * currentModelConfig.fundedMaxLossPct) / 100)}
                  </div>
                </div>

                {/* Reward Share */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Reward Share</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.rewardShare}
                  </div>
                </div>

                {/* First Withdrawal (Interactive stepper) */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>First Withdrawal</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#635BFF] text-white font-mono text-2xs font-bold shadow-xs">
                    <button
                      onClick={() => setWithdrawalDays((prev) => Math.max(5, prev - 7))}
                      className="hover:opacity-80 transition-opacity cursor-pointer text-white"
                      aria-label="Decrease withdrawal days"
                    >
                      <ChevronLeft className="w-3 h-3 text-white" />
                    </button>
                    <span className="text-white px-0.5">{withdrawalDays} Days</span>
                    <button
                      onClick={() => setWithdrawalDays((prev) => Math.min(28, prev + 7))}
                      className="hover:opacity-80 transition-opacity cursor-pointer text-white"
                      aria-label="Increase withdrawal days"
                    >
                      <ChevronRight className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>

                {/* Subsequent Withdrawal */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Subsequent Withdrawal</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.subsequentWithdrawal}
                  </div>
                </div>

                {/* Refundable Fee */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Refundable Fee</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.refundableFee}
                  </div>
                </div>

                {/* News Trading Profit */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>News Trading Profit</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.newsTradingProfit}
                  </div>
                </div>

                {/* Max Risk */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Max Risk</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.maxRisk}
                  </div>
                </div>

                {/* Reward Condition */}
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Reward Condition</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.rewardCondition}
                  </div>
                </div>

                {/* Consistency */}
                <div className="flex items-center justify-between text-xs py-1.5">
                  <div className="flex items-center gap-2 text-white/80">
                    <Info className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>Consistency</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {currentModelConfig.consistency}
                  </div>
                </div>

              </div>

              {/* ── COLUMN 3: Checkout Summary Box (col-span-4) ─────────────── */}
              <div className="lg:col-span-4 rounded-2xl bg-[#141322] border border-white/10 p-5 sm:p-6 flex flex-col justify-between shadow-xl">
                <div>
                  
                  {/* Title: SelectedModel + Size */}
                  <div className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {selectedModel} {formatKSize(selectedSize)}
                  </div>

                  {/* Large Green Price Display */}
                  <div className="text-3xl sm:text-4xl font-black font-mono text-[#00E676] my-2 tabular-nums">
                    {formatCurrencyVal(totalCostUSD)}
                  </div>

                  {/* Quantity Header */}
                  <div className="text-2xs font-bold uppercase tracking-wider text-white/50 mt-4 mb-2">
                    Quantity
                  </div>

                  {/* 3 Tiered Account Selections */}
                  <div className="space-y-2">
                    {/* 1st Account */}
                    <button
                      onClick={() => setQuantity(1)}
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                        quantity >= 1
                          ? 'bg-[#635BFF]/15 border-[#635BFF] text-white'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Check className={cn('w-3.5 h-3.5', quantity >= 1 ? 'text-[#00E676]' : 'text-white/20')} />
                        <span>1st account</span>
                      </div>
                      <span className="font-mono font-bold tabular-nums">
                        {formatCurrencyVal(tieredPrices.p1)}
                      </span>
                    </button>

                    {/* 2nd Account 10% OFF */}
                    <button
                      onClick={() => setQuantity(2)}
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                        quantity >= 2
                          ? 'bg-[#635BFF]/15 border-[#635BFF] text-white'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Check className={cn('w-3.5 h-3.5', quantity >= 2 ? 'text-[#00E676]' : 'text-white/20')} />
                        <span>2nd account</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-3xs font-mono font-bold">
                          10% OFF
                        </span>
                      </div>
                      <span className="font-mono font-bold tabular-nums">
                        {formatCurrencyVal(tieredPrices.p2)}
                      </span>
                    </button>

                    {/* 3rd Account 15% OFF */}
                    <button
                      onClick={() => setQuantity(3)}
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                        quantity >= 3
                          ? 'bg-[#635BFF]/15 border-[#635BFF] text-white'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Check className={cn('w-3.5 h-3.5', quantity >= 3 ? 'text-[#00E676]' : 'text-white/20')} />
                        <span>3rd account</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-3xs font-mono font-bold">
                          15% OFF
                        </span>
                      </div>
                      <span className="font-mono font-bold tabular-nums">
                        {formatCurrencyVal(tieredPrices.p3)}
                      </span>
                    </button>
                  </div>

                  {/* Quantity Stepper & Start Challenge CTA */}
                  <div className="flex items-center gap-3 mt-4">
                    {/* Stepper [ -  qty  + ] */}
                    <div className="inline-flex items-center rounded-xl bg-white/5 border border-white/10 p-1 text-xs font-mono">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white/80 hover:text-white"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-bold text-white tabular-nums">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                        className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white/80 hover:text-white"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Primary CTA: Start Challenge */}
                    <Button
                      asChild
                      size="lg"
                      className="flex-1 h-11 rounded-xl bg-[#635BFF] hover:bg-[#5248EE] text-white font-bold text-sm shadow-xl shadow-[#635BFF]/30 border-0 cursor-pointer transition-all"
                    >
                      <Link href={checkoutUrl} className="flex items-center justify-center gap-2">
                        <span>Start Challenge</span>
                      </Link>
                    </Button>
                  </div>

                  {/* Add-Ons Available */}
                  <div className="mt-5">
                    <div className="text-2xs font-semibold text-white/60 mb-2">
                      Add-Ons Available:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Lifetime Reward 95%',
                        'No Minimum Trading Days',
                        '150% Reward',
                        'Bi-Weekly Reward',
                      ].map((addon) => {
                        const active = selectedAddOns.includes(addon)
                        return (
                          <button
                            key={addon}
                            onClick={() => toggleAddOn(addon)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-3xs font-semibold transition-all cursor-pointer border',
                              active
                                ? 'bg-[#635BFF]/20 border-[#635BFF] text-white'
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                            )}
                          >
                            {addon}
                          </button>
                        )
                      })}
                      <span className="px-2 py-1 rounded-lg bg-white/5 text-white/40 text-3xs font-mono">
                        +3 more
                      </span>
                    </div>
                  </div>

                </div>

                {/* Payment Methods Row */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-white/60">
                  <div className="flex items-center gap-2">
                    {/* Mastercard icon */}
                    <span className="flex -space-x-1">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-500 opacity-90 inline-block" />
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 opacity-90 inline-block" />
                    </span>
                    {/* Visa text */}
                    <span className="font-extrabold text-2xs tracking-tighter text-white">VISA</span>
                    {/* AMEX */}
                    <span className="text-3xs font-black px-1 py-0.5 rounded bg-blue-600 text-white leading-none">
                      AMEX
                    </span>
                    {/* Apple Pay */}
                    <span className="text-3xs font-bold text-white">Pay</span>
                    {/* Google Pay */}
                    <span className="text-3xs font-bold text-white/80">GPay</span>
                    {/* PayPal */}
                    <span className="text-3xs font-black tracking-tight flex items-center leading-none">
                      <span className="italic text-[#0079C1]">Pay</span><span className="italic text-[#00457C]">Pal</span>
                    </span>
                    {/* Crypto */}
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-3xs leading-none">
                      ₿
                    </span>
                  </div>
                  <span className="text-3xs text-white/50 font-mono">+13 more</span>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── 4. THE 3 SIGNATURE BREAKTHROUGHS ────────────────────────────── */}
      <section id="breakthroughs" className="py-20 bg-surface-secondary/40 border-y border-border/80 relative">
        <div className="container max-w-7xl mx-auto px-4">

          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#635BFF]/10 border border-[#635BFF]/30 text-2xs font-mono uppercase tracking-wider font-bold text-[#635BFF] dark:text-violet-300 mb-3">
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
            <div className="p-8 rounded-3xl bg-surface border border-border hover:border-[#635BFF]/60 shadow-xl relative overflow-hidden group transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#635BFF]/10 border border-[#635BFF]/20 flex items-center justify-center text-[#635BFF] dark:text-violet-400 mb-6">
                <Percent className="h-7 w-7" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#635BFF]/10 text-[#635BFF] dark:text-violet-400 font-mono text-3xs font-bold mb-3 uppercase">
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#635BFF]/10 border border-[#635BFF]/30 text-2xs font-mono uppercase tracking-wider font-bold text-[#635BFF] dark:text-violet-300 mb-3">
              The Transparent Choice
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-text tracking-tight">
              {brandName} vs Other Prop Firms
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-muted">
              See the numbers side-by-side and decide who gives you the highest probability of passing and getting paid.
            </p>
          </div>

          <div className="rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary/80">
                    <th className="p-4 sm:p-5 font-bold text-text">Key Feature</th>
                    <th className="p-4 sm:p-5 font-black text-[#635BFF] dark:text-violet-400 bg-[#635BFF]/10">
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
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-[#635BFF]/5">
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
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-[#635BFF]/5 font-mono">
                      Balance-Based (Fixed at 00:00)
                    </td>
                    <td className="p-4 sm:p-5 text-rose-500 font-mono">Equity High Trailing Trap</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Evaluation Time Limit
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-[#635BFF]/5 font-mono">
                      No Limit (Unlimited Days)
                    </td>
                    <td className="p-4 sm:p-5 text-text-muted font-mono">30 - 60 Days Deadline</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      News Trading &amp; Weekend Holding
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-[#635BFF]/5 font-mono">
                      Fully Permitted
                    </td>
                    <td className="p-4 sm:p-5 text-rose-500 font-mono">Restricted or Prohibited</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Automated Payout Guarantee
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-[#635BFF]/5 font-mono">
                      Under 24 Hours
                    </td>
                    <td className="p-4 sm:p-5 text-text-muted font-mono">7 - 14 Days Approval</td>
                  </tr>

                  <tr>
                    <td className="p-4 sm:p-5 font-semibold text-text">
                      Maximum Scaling Capital
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-[#635BFF]/5 font-mono">
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
      <section className="py-20 bg-surface-secondary/40 border-y border-border/80">
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
                className="p-6 sm:p-8 rounded-3xl bg-surface border border-border hover:border-[#635BFF]/30 shadow-xl flex flex-col justify-between"
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
                    &ldquo;{t.quote}&rdquo;
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#635BFF]/10 border border-[#635BFF]/30 text-2xs font-mono uppercase tracking-wider font-bold text-[#635BFF] dark:text-violet-300 mb-3">
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
                        'h-4 w-4 text-[#635BFF] transition-transform duration-200 shrink-0',
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
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-transparent via-[#635BFF]/5 to-[#635BFF]/10">
        <div className="container max-w-5xl mx-auto px-4 relative z-10">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-[#635BFF] via-indigo-600 to-cyan-600 text-white text-center shadow-2xl relative overflow-hidden">

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
