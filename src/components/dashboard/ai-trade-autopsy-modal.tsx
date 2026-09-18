'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Sparkles, Award, Target, Brain, AlertTriangle, CheckCircle2 
} from 'lucide-react'
import type { AiTradeAutopsy } from '@/types/api'
import { toNum, fmtUSD, toBool } from '@/lib/format'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { Button } from '@/components/ui/button'

interface AiTradeAutopsyModalProps {
  autopsy: AiTradeAutopsy | null
  isOpen: boolean
  onClose: () => void
}

function AiTradeAutopsyModalContent({ autopsy, onClose }: { autopsy: AiTradeAutopsy; onClose: () => void }) {
  const pnlNum = toNum(autopsy.pnl)
  const isProfit = pnlNum >= 0
  const lotRaw = toNum(autopsy.lot_size)
  const lotSize = lotRaw > 0 ? lotRaw : 1.0
  const rrRatio = toNum(autopsy.risk_reward_ratio ?? (autopsy as any).rr_ratio ?? 1.5)
  const hasExecScore = (autopsy as any).execution_score !== undefined && (autopsy as any).execution_score !== null && (autopsy as any).execution_score !== ''
  const executionScore = hasExecScore ? toNum((autopsy as any).execution_score) : null
  const slDisciplined = toBool(autopsy.sl_tp_discipline ?? (autopsy as any).sl_adherence)
  const isTilt = toBool(autopsy.tilt_detected || (autopsy as any).cooling_off_recommended)
  const side = (autopsy.action || autopsy.side || '').toUpperCase()
  const gradeKey = (autopsy.grade || '').toUpperCase()

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
  const gradeClass = gradeColors[gradeKey] || 'bg-gray-800 text-gray-200 border-gray-700'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-card-lg overflow-hidden text-text"
      >
        {/* Top Decorative Banner */}
        <div className="p-5 bg-surface-muted/60 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 text-accent border border-accent/25">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text tracking-tight font-sans">AI Post-Trade Autopsy</h3>
                <span className="text-3xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25 font-mono font-bold">
                  Trade #{autopsy.trade_id || (autopsy as any).id || '—'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 font-sans">Tactical execution & psychology breakdown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Scorecard Hero Strip */}
          <div className="p-4 rounded-xl bg-surface-muted/60 border border-border-subtle flex items-center justify-between">
            <div>
              <span className="text-3xs uppercase tracking-wider font-semibold text-text-muted font-sans block">Trade Result</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xl font-black font-mono tabular ${isProfit ? 'text-accent' : 'text-danger'}`}>
                  {autopsy.pnl_formatted || fmtUSD(pnlNum, { sign: true })}
                </span>
                <span className="text-xs text-text-muted font-mono">
                  {autopsy.symbol || 'TRADE'} {side ? `${side} ` : ''}({lotSize.toFixed(2)}L)
                </span>
              </div>
            </div>

            {/* Execution Grade Badge */}
            <div className="text-center">
              <span className="text-3xs uppercase tracking-wider font-semibold text-text-muted font-sans block mb-0.5">Grade</span>
              <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-xl font-mono font-black border shadow-lg ${gradeClass}`}>
                {gradeKey || 'N/A'}
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className={`grid ${executionScore !== null ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-3`}>
            <div className="p-3 rounded-xl bg-surface-muted/40 border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-muted text-xs font-sans">
                <Target className="w-4 h-4 text-accent" />
                <span>Risk : Reward</span>
              </div>
              <span className="font-mono font-bold tabular text-xs text-text">
                {rrRatio > 0 ? `${rrRatio.toFixed(2)}:1` : '1.50:1'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/40 border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-muted text-xs font-sans">
                <CheckCircle2 className={`w-4 h-4 ${slDisciplined ? 'text-accent' : 'text-danger'}`} />
                <span>SL Discipline</span>
              </div>
              <span className={`font-mono font-bold text-xs ${slDisciplined ? 'text-accent' : 'text-danger'}`}>
                {slDisciplined ? 'Protected' : 'Naked Entry'}
              </span>
            </div>

            {executionScore !== null && (
              <div className="p-3 rounded-xl bg-surface-muted/40 border border-border-subtle flex items-center justify-between col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 text-text-muted text-xs font-sans">
                  <Award className="w-4 h-4 text-accent" />
                  <span>Exec Score</span>
                </div>
                <span className="font-mono font-bold tabular text-xs text-accent">
                  {executionScore.toFixed(0)}/100
                </span>
              </div>
            )}
          </div>

          {/* Tilt Warning Banner if detected */}
          {isTilt && (
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/25 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-danger block font-sans">Revenge / Tilt Trade Flagged</span>
                <p className="text-danger/90 mt-0.5 font-sans">
                  This trade occurred in a rapid losing cluster. High risk of capital bleeding.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Execution Summary */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider font-sans">
              <Sparkles className="w-3.5 h-3.5" />
              Execution Summary
            </div>
            <p className="text-xs text-text/90 bg-surface-muted/40 p-3.5 rounded-xl border border-border-subtle leading-relaxed font-sans">
              {autopsy.autopsy_summary || (autopsy as any).ai_tactical_summary || 'No execution summary available.'}
            </p>
          </div>

          {/* Section 2: Tactical Feedback */}
          {(autopsy.tactical_flaws || autopsy.tactical_notes) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-warn uppercase tracking-wider font-sans">
                <Target className="w-3.5 h-3.5" />
                Tactical & Technical Feedback
              </div>
              <p className="text-xs text-text/90 bg-surface-muted/40 p-3.5 rounded-xl border border-border-subtle leading-relaxed font-sans">
                {autopsy.tactical_flaws || autopsy.tactical_notes}
              </p>
            </div>
          )}

          {/* Section 3: Performance Psychology */}
          {(autopsy.psychology_notes || autopsy.coach_advice) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider font-sans">
                <Brain className="w-3.5 h-3.5" />
                AI Performance Coach Advice
              </div>
              <p className="text-xs text-text/90 bg-surface-muted/40 p-3.5 rounded-xl border border-border-subtle leading-relaxed font-sans">
                {autopsy.psychology_notes || autopsy.coach_advice}
              </p>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-surface-muted/60 border-t border-border-subtle flex items-center justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            className="text-xs font-medium px-5"
          >
            Understood / Next Trade
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function AiTradeAutopsyModal({ autopsy, isOpen, onClose }: AiTradeAutopsyModalProps) {
  return (
    <SectionErrorBoundary>
      <AnimatePresence>
        {isOpen && autopsy && (
          <AiTradeAutopsyModalContent autopsy={autopsy} onClose={onClose} />
        )}
      </AnimatePresence>
    </SectionErrorBoundary>
  )
}
