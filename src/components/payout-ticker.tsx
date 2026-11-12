"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fmtUSD } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";

import { getApiBaseUrl } from "@/lib/fxsim";

interface PayoutProof {
  name: string;
  amount: number;
  date: string;
}

export function PayoutTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: payouts } = useQuery<PayoutProof[]>({
    queryKey: ["public-payout-proofs"],
    queryFn: async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/stats/leaderboard`);
        if (!res.ok) return [];
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.leaderboard || []);
        return rows.map((r: any) => ({
          name: r.user_login || r.name || 'Trader',
          amount: Number(r.pnl || r.profit || r.amount || 0),
          date: r.created_at || 'Recently'
        })).filter((p: any) => p.amount > 0);
      } catch {
        return [];
      }
    },
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!payouts || payouts.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % payouts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [payouts]);

  if (!payouts || payouts.length === 0) return null;

  const current = payouts[currentIndex];

  return (
    <div className="mt-14 md:mt-16 w-full bg-emerald-500/10 border-y border-emerald-500/20 py-2.5 overflow-hidden flex items-center justify-center relative z-20">
      <div className="container px-4 sm:px-6 flex items-center justify-center space-x-2 text-xs sm:text-sm font-medium">
        <span className="text-text-muted">Recent Payouts:</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center space-x-2"
          >
            <span className="text-text font-semibold">{current.name}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono tabular-nums terminal-num">{fmtUSD(current.amount)}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
