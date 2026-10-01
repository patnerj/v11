"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { fmtUSD, toNum } from "@/lib/format";
import type { ChallengePlan } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Info, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Calculator, 
  TrendingUp,
  Zap,
  Coins
} from "lucide-react";
import { useBranding } from "@/store/branding";

export function ChallengesPreview({ onSelectPlan, puckProps }: { onSelectPlan?: (planId: number) => void, puckProps?: any }) {
  const title = puckProps?.title || "Choose Your Capital Tier";
  const brandName = useBranding((s) => s.branding.brand_name) || "MassFunded";
  const loadBranding = useBranding((s) => s.load);

  useEffect(() => { loadBranding(); }, [loadBranding]);

  const [plans, setPlans] = useState<ChallengePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>("2-Step");
  const [selectedSize, setSelectedSize] = useState<number>(0);
  const [profitEstimatePct, setProfitEstimatePct] = useState<number>(8); // Default 8% profit simulation

  useEffect(() => {
    api.challengePlans().then((res) => {
      if (res.ok) {
        const active = res.data.filter((p) => Number(p.is_active) !== 0);
        setPlans(active);
      } else {
        setError(res.error);
      }
    });
  }, []);

  const models = useMemo(() => {
    if (!plans) return [];
    const m = new Set<string>();
    plans.forEach((p) => {
      if (Number(p.is_instant_funding) === 1 || Number(p.phases) === 0)
        m.add("Instant Funding");
      else if (Number(p.phases) === 1) m.add("1-Step");
      else if (Number(p.phases) === 2) m.add("2-Step");
      else if (Number(p.phases) === 3) m.add("3-Step");
    });
    const order = ["1-Step", "2-Step", "3-Step", "Instant Funding"];
    return Array.from(m).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [plans]);

  useEffect(() => {
    if (models.length > 0 && !models.includes(selectedModel)) {
      setSelectedModel(models[0]);
    }
  }, [models, selectedModel]);

  const currentModelPlans = useMemo(() => {
    if (!plans) return [];
    return plans
      .filter((p) => {
        if (selectedModel === "Instant Funding")
          return Number(p.is_instant_funding) === 1 || Number(p.phases) === 0;
        if (selectedModel === "1-Step")
          return Number(p.phases) === 1 && Number(p.is_instant_funding) !== 1;
        if (selectedModel === "2-Step")
          return Number(p.phases) === 2 && Number(p.is_instant_funding) !== 1;
        if (selectedModel === "3-Step")
          return Number(p.phases) === 3 && Number(p.is_instant_funding) !== 1;
        return false;
      })
      .sort((a, b) => toNum(a.account_size) - toNum(b.account_size));
  }, [plans, selectedModel]);

  const accountSizes = useMemo(() => {
    const sizes = new Set<number>();
    currentModelPlans.forEach((p) => sizes.add(toNum(p.account_size)));
    return Array.from(sizes).sort((a, b) => a - b);
  }, [currentModelPlans]);

  useEffect(() => {
    if (
      accountSizes.length > 0 &&
      (!selectedSize || !accountSizes.includes(selectedSize))
    ) {
      setSelectedSize(
        accountSizes[Math.floor(accountSizes.length / 2)] || accountSizes[0],
      );
    }
  }, [accountSizes, selectedSize]);

  const activePlan = useMemo(() => {
    return (
      currentModelPlans.find((p) => toNum(p.account_size) === selectedSize) ||
      currentModelPlans[0]
    );
  }, [currentModelPlans, selectedSize]);

  const getModelBadge = (modelName: string) => {
    if (modelName === "2-Step") return "⭐ Most Popular";
    if (modelName === "1-Step") return "⚡ Rapid 1-Phase";
    if (modelName === "Instant Funding") return "🚀 No Evaluation";
    return "Classic";
  };

  const getModelSubtext = (modelName: string) => {
    if (modelName === "1-Step")
      return "Single phase fast-track • Bi-weekly payouts • News trading allowed";
    if (modelName === "2-Step")
      return "Two phase evaluation • Up to 90% profit split • 100% fee refund";
    if (modelName === "3-Step") 
      return "Advanced risk tier • Maximum scaling ceiling • Institutional leverage";
    if (modelName === "Instant Funding")
      return "Direct live capital • Zero evaluation phases • Instant funded account";
    return "Institutional prop trading";
  };

  // Profit Simulation Calculations
  const calculatedGain = useMemo(() => {
    if (!activePlan) return 0;
    const size = toNum(activePlan.account_size);
    return size * (profitEstimatePct / 100);
  }, [activePlan, profitEstimatePct]);

  const calculatedTraderSplit = useMemo(() => {
    if (!activePlan) return 0;
    const splitPct = toNum(activePlan.funded_profit_split) || 80;
    return calculatedGain * (splitPct / 100);
  }, [activePlan, calculatedGain]);

  return (
    <section className="relative py-20 lg:py-28 bg-transparent text-text overflow-hidden" id="challenges">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-[160px] pointer-events-none" />

      <div className="container max-w-7xl mx-auto px-4 relative">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Institutional Evaluation Plans</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            {title}
          </h2>
          <p className="mt-4 text-text-muted text-base sm:text-lg">
            Choose your model and account size. Zero hidden rules, transparent drawdown criteria, and full fee refund on your first payout.
          </p>
        </div>

        {error && (
          <div className="text-center py-12 text-sm text-text-muted">
            Unable to load challenges right now.{" "}
            <Link href="/challenges" className="text-emerald-400 underline underline-offset-4">
              View plans →
            </Link>
          </div>
        )}

        {plans === null && !error ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl bg-surface/50" />
            <Skeleton className="h-20 w-full rounded-2xl bg-surface/50" />
            <Skeleton className="h-96 w-full rounded-2xl bg-surface/50" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Model Selection Tabs */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${models.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
              {models.map((m) => {
                const isActive = selectedModel === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedModel(m)}
                    className={`relative text-left p-5 rounded-2xl border transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isActive
                        ? "bg-surface/90 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.18)]"
                        : "bg-surface/30 border-border-subtle/80 hover:border-border hover:bg-surface/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-base font-extrabold ${isActive ? "text-text" : "text-text-muted"}`}>
                        {m}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isActive 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-surface border-border-subtle text-text-muted"
                      }`}>
                        {getModelBadge(m)}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isActive ? "text-text-muted" : "text-text-muted/60"}`}>
                      {getModelSubtext(m)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Account Size Selection Buttons */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${
              accountSizes.length === 7 ? "lg:grid-cols-7" :
              accountSizes.length === 6 ? "lg:grid-cols-6" :
              "lg:grid-cols-5"
            } gap-2.5 sm:gap-3`}>
              {accountSizes.map((size) => {
                const isActive = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`relative text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isActive
                        ? "bg-gradient-to-b from-emerald-500/15 to-surface/90 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "bg-surface/30 border-border-subtle/80 hover:border-border hover:bg-surface/50"
                    }`}
                  >
                    <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                      Account Size
                    </div>
                    <div className={`text-lg xl:text-xl font-black font-mono tracking-tight ${isActive ? "text-emerald-400" : "text-text"}`}>
                      {fmtUSD(size, { decimals: 0 })}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Active Plan Showcase & Profit Calculator */}
            <AnimatePresence mode="wait">
              {activePlan && (
                <motion.div
                  key={activePlan.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="bg-surface/50 border border-border/70 rounded-3xl p-6 lg:p-8 backdrop-blur-xl shadow-card-lg"
                >
                  <div className="grid lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left & Center: Rules Breakdown + Interactive Profit Calculator */}
                    <div className="lg:col-span-8 space-y-6">
                      
                      {/* Rules Columns */}
                      <div className="grid md:grid-cols-2 gap-6">
                        
                        {/* Column 1: Evaluation Rules */}
                        <div className="bg-bg/40 rounded-2xl p-5 border border-border-subtle/60">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-subtle">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            <h4 className="text-sm font-bold text-text">
                              {Number(activePlan.is_instant_funding) === 1 || Number(activePlan.phases) === 0
                                ? "Instant Funding Parameters"
                                : "Evaluation Parameters"}
                            </h4>
                          </div>
                          <ul className="space-y-3.5">
                            {(Number(activePlan.is_instant_funding) === 1 || Number(activePlan.phases) === 0) && (
                              <RuleRow
                                label="Profit Target"
                                value="None (Instant Funded)"
                                highlight
                              />
                            )}
                            {Number(activePlan.phases) >= 1 && Number(activePlan.is_instant_funding) !== 1 && (
                              <RuleRow
                                label="Phase 1 Profit Target"
                                value={`${toNum(activePlan.p1_profit_target)}%`}
                                highlight
                              />
                            )}
                            {Number(activePlan.phases) >= 2 && Number(activePlan.is_instant_funding) !== 1 && (
                              <RuleRow
                                label="Phase 2 Profit Target"
                                value={`${toNum(activePlan.p2_profit_target)}%`}
                                highlight
                              />
                            )}
                            <RuleRow
                              label="Daily Loss Limit"
                              value={`${toNum(activePlan.p1_daily_dd)}%`}
                            />
                            <RuleRow
                              label="Maximum Drawdown"
                              value={`${toNum(activePlan.p1_max_dd)}%`}
                            />
                            <RuleRow
                              label="Drawdown Type"
                              value={
                                activePlan.drawdown_type === "trailing"
                                  ? "Trailing"
                                  : activePlan.drawdown_type === "eod_trailing"
                                    ? "EOD Trailing"
                                    : "Static (Zero Trailing Traps)"
                              }
                            />
                            <RuleRow
                              label="Minimum Trading Days"
                              value={
                                Number(activePlan.p1_min_days) > 0
                                  ? `${activePlan.p1_min_days} Days`
                                  : "0 Days (No Minimum)"
                              }
                            />
                            <RuleRow
                              label="Trading Period"
                              value={
                                Number(activePlan.p1_max_days) > 0
                                  ? `${activePlan.p1_max_days} Days`
                                  : "Unlimited (No Time Limit)"
                              }
                            />
                          </ul>
                        </div>

                        {/* Column 2: Funded & Reward Rules */}
                        <div className="bg-bg/40 rounded-2xl p-5 border border-border-subtle/60">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-subtle">
                            <Coins className="h-4 w-4 text-emerald-400" />
                            <h4 className="text-sm font-bold text-text">
                              Funded Phase & Rewards
                            </h4>
                          </div>
                          <ul className="space-y-3.5">
                            <RuleRow
                              label="Trader Profit Share"
                              value={`Up to ${toNum(activePlan.funded_profit_split) || 80}%`}
                              highlight
                            />
                            <RuleRow label="First Payout Period" value="14 Days" />
                            <RuleRow label="Subsequent Payouts" value="Bi-Weekly (Every 14 Days)" />
                            <RuleRow
                              label="Evaluation Fee Refund"
                              value="100% Refund with 1st Payout"
                              highlight
                            />
                            <RuleRow
                              label="News Trading"
                              value={
                                Number(activePlan.news_trading) === 1
                                  ? "Allowed"
                                  : "Not Allowed"
                              }
                            />
                            <RuleRow
                              label="Weekend Holding"
                              value={
                                Number(activePlan.weekend_holding) === 1
                                  ? "Allowed"
                                  : "Not Allowed"
                              }
                            />
                            <RuleRow
                              label="Expert Advisors (EAs)"
                              value="Allowed"
                            />
                          </ul>
                        </div>
                      </div>

                      {/* Interactive Live Profit Calculator */}
                      <div className="bg-gradient-to-r from-emerald-500/10 via-surface/60 to-surface/40 rounded-2xl p-5 border border-emerald-500/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-emerald-400" />
                            <h4 className="text-sm font-bold text-text">
                              Interactive Payout Simulator
                            </h4>
                          </div>
                          
                          {/* Target Presets */}
                          <div className="flex items-center gap-1.5">
                            {[5, 8, 10, 12, 15].map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setProfitEstimatePct(preset)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                                  profitEstimatePct === preset
                                    ? "bg-emerald-500 text-bg shadow-glow-sm"
                                    : "bg-surface hover:bg-surface-muted text-text-muted border border-border-subtle"
                                }`}
                              >
                                {preset}%
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Slider Control */}
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>Simulated Monthly Return</span>
                            <span className="font-mono font-bold text-emerald-400">+{profitEstimatePct}% Profit</span>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="20"
                            step="1"
                            value={profitEstimatePct}
                            onChange={(e) => setProfitEstimatePct(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer h-2 bg-surface rounded-lg appearance-none"
                          />
                        </div>

                        {/* Calculation Summary Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border-subtle/60 text-xs">
                          <div className="p-2.5 rounded-xl bg-surface/60 border border-border-subtle">
                            <div className="text-text-muted text-[11px]">Total Trading Profit</div>
                            <div className="text-base font-bold font-mono text-text mt-0.5">
                              {fmtUSD(calculatedGain)}
                            </div>
                          </div>
                          
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                            <div className="text-emerald-400 font-semibold text-[11px]">Your Bi-Weekly Share ({toNum(activePlan.funded_profit_split) || 80}%)</div>
                            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                              {fmtUSD(calculatedTraderSplit)}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-surface/60 border border-border-subtle">
                            <div className="text-text-muted text-[11px]">100% Fee Refund Added</div>
                            <div className="text-base font-bold font-mono text-text mt-0.5">
                              +{fmtUSD(activePlan.price)}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Column: Pricing & Instant Checkout Card */}
                    <div className="lg:col-span-4 bg-surface/80 rounded-2xl p-6 border border-border-subtle/80 flex flex-col justify-between shadow-card">
                      <div>
                        <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                          Ready to trade
                        </div>
                        <h3 className="text-2xl font-black text-text tracking-tight">
                          {brandName} {selectedModel}
                        </h3>
                        <div className="text-sm text-text-muted mt-1">
                          {fmtUSD(activePlan.account_size, { decimals: 0 })} Trading Capital
                        </div>

                        <div className="my-6 pb-6 border-b border-border-subtle">
                          <div className="text-xs text-text-muted mb-1">One-time Evaluation Fee (Refundable)</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-emerald-400 font-mono tracking-tight">
                              {fmtUSD(activePlan.price)}
                            </span>
                          </div>
                        </div>

                        <ul className="space-y-2.5 mb-6 text-xs text-text-muted">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>Instant account credential dispatch</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>1:100 Institutional Pepperstone leverage</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>WebTrader + MetaTrader 5 reverse sync</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>100% Fee Refund on your 1st payout</span>
                          </li>
                        </ul>
                      </div>

                      <Button
                        asChild={!onSelectPlan}
                        onClick={() => onSelectPlan && onSelectPlan(activePlan.id)}
                        className="w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold py-6 rounded-xl shadow-glow hover:shadow-glow-success transition-all duration-300 btn-shine"
                      >
                        {onSelectPlan ? (
                          "Start Challenge"
                        ) : (
                          <Link href={`/checkout?plan=${activePlan.id}`} className="flex items-center justify-center gap-2">
                            <span>Start Challenge Now</span>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}
                      </Button>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}
      </div>
    </section>
  );
}

function RuleRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <li className="flex justify-between items-center text-xs sm:text-sm">
      <div className="flex items-center gap-2 text-text-muted">
        <Info className="h-3.5 w-3.5 opacity-60 shrink-0" />
        <span>{label}</span>
      </div>
      <span className={`font-semibold text-right ${highlight ? "text-emerald-400 font-bold" : "text-text"}`}>
        {value}
      </span>
    </li>
  );
}
