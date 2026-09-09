'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Sparkles, Award, Target, Brain, AlertTriangle, 
  CheckCircle2, ShieldAlert, TrendingUp, TrendingDown, ArrowRight
} from 'lucide-react'
import type { AiTradeAutopsy } from '@/types/api'
import { Button } from '@/components/ui/button'

interface AiTradeAutopsyModalProps {
  autopsy: AiTradeAutopsy | null
  isOpen: boolean
  onClose: () => void
}

export function AiTradeAutopsyModal({ autopsy, isOpen, onClose }: AiTradeAutopsyModalProps) {
  if (!isOpen || !autopsy) return null

  const isProfit = (autopsy.pnl >= 0)
  const gradeColors: Record<string, string> = {
    'A+': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20',
    'A':  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
    'B+': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    'B':  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'B-': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'C':  'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'D':  'bg-orange-500/20 text-orange-300 border-orange-500/40',
    'F':  'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/20',
  }
  const gradeClass = gradeColors[autopsy.grade] || 'bg-gray-800 text-gray-200 border-gray-700'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg rounded-2xl bg-[#0F172A] border border-[#1E293B] shadow-2xl overflow-hidden"
        >
          {/* Top Decorative Banner */}
          <div className="p-5 bg-gradient-to-r from-cyan-950/60 via-[#1E293B]/60 to-purple-950/60 border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">AI Post-Trade Autopsy</h3>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                    Trade #{autopsy.trade_id}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Tactical execution & psychology breakdown</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Scorecard Hero Strip */}
            <div className="p-4 rounded-xl bg-[#141E33] border border-[#1E293B] flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-mono">Trade Result</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xl font-black font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {autopsy.pnl_formatted || (isProfit ? `+$${autopsy.pnl.toFixed(2)}` : `-$${Math.abs(autopsy.pnl).toFixed(2)}`)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {autopsy.symbol} {autopsy.side || ''} ({autopsy.lot_size || 1.0}L)
                  </span>
                </div>
              </div>

              {/* Execution Grade Badge */}
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-mono block mb-0.5">Grade</span>
                <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-xl font-black border shadow-lg ${gradeClass}`}>
                  {autopsy.grade}
                </span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span>Risk : Reward</span>
                </div>
                <span className="font-mono font-bold text-xs text-white">
                  {autopsy.risk_reward_ratio}:1
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <CheckCircle2 className={`w-4 h-4 ${autopsy.sl_tp_discipline ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <span>SL Discipline</span>
                </div>
                <span className={`font-mono font-bold text-xs ${autopsy.sl_tp_discipline ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {autopsy.sl_tp_discipline ? 'Protected' : 'Naked Entry'}
                </span>
              </div>
            </div>

            {/* Tilt Warning Banner if detected */}
            {autopsy.tilt_detected && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-rose-300 block">Revenge / Tilt Trade Flagged</span>
                  <p className="text-rose-200/80 mt-0.5">
                    This trade occurred in a rapid losing cluster. High risk of capital bleeding.
                  </p>
                </div>
              </div>
            )}

            {/* Section 1: Execution Summary */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Execution Summary
              </div>
              <p className="text-xs text-gray-300 bg-[#111827] p-3.5 rounded-xl border border-gray-800/80 leading-relaxed">
                {autopsy.autopsy_summary}
              </p>
            </div>

            {/* Section 2: Tactical Feedback */}
            {autopsy.tactical_flaws && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5" />
                  Tactical & Technical Feedback
                </div>
                <p className="text-xs text-gray-300 bg-[#111827] p-3.5 rounded-xl border border-gray-800/80 leading-relaxed">
                  {autopsy.tactical_flaws}
                </p>
              </div>
            )}

            {/* Section 3: Performance Psychology */}
            {autopsy.psychology_notes && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                  <Brain className="w-3.5 h-3.5" />
                  AI Performance Coach Advice
                </div>
                <p className="text-xs text-gray-300 bg-[#111827] p-3.5 rounded-xl border border-gray-800/80 leading-relaxed">
                  {autopsy.psychology_notes}
                </p>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 bg-[#0A0E1A] border-t border-[#1E293B] flex items-center justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold px-5 shadow-cyan-500/20"
            >
              Understood / Next Trade
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
