'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AlertTriangle, ShieldAlert, ShieldCheck, Clock, 
  X, PauseCircle, Zap, CheckCircle2 
} from 'lucide-react'
import { api } from '@/lib/api'
import { usePrices } from '@/store/prices'
import type { AiTiltStatus } from '@/types/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function AiTiltGuard() {
  const account = usePrices((s) => s.account)
  const [tiltStatus, setTiltStatus] = useState<AiTiltStatus | null>(null)
  const [isSnoozed, setIsSnoozed] = useState(false)
  const [isEngaging, setIsEngaging] = useState(false)

  const checkTilt = async () => {
    if (!account?.id) return
    try {
      const res = await api.ai.coach.tiltCheck(account.id)
      if (res.ok && res.data) {
        setTiltStatus(res.data)
      }
    } catch {
      // Non-blocking
    }
  }

  useEffect(() => {
    checkTilt()
    const interval = setInterval(checkTilt, 20_000)
    return () => clearInterval(interval)
  }, [account?.id])

  const handleCoolingOff = async (minutes = 30) => {
    if (!account?.id) return
    setIsEngaging(true)
    try {
      const res = await api.ai.coach.coolingOff({
        account_id: account.id,
        duration_minutes: minutes,
      })
      if (res.ok) {
        toast.success(`🛡️ Self-imposed cooling-off engaged for ${minutes} minutes. Trading paused to protect capital.`)
        checkTilt()
      } else {
        toast.error(res.error || 'Failed to engage cooling-off.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Cooling off error.')
    } finally {
      setIsEngaging(false)
    }
  }

  // 1. If Cooling-off is currently active: show persistent protective status strip
  if (tiltStatus?.cooling_off_active) {
    const minsLeft = Math.max(1, Math.ceil((tiltStatus.cooling_off_remaining_sec || 0) / 60))
    return (
      <div className="w-full bg-gradient-to-r from-cyan-950/80 via-blue-950/80 to-cyan-950/80 border-b border-cyan-500/30 px-4 py-2 text-xs text-cyan-200 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-semibold text-white">Self-Imposed Cooling-Off Active:</span>
          <span className="font-mono text-cyan-300 font-bold">{minsLeft} minutes remaining</span>
          <span className="text-gray-400 hidden sm:inline">— New orders are temporarily locked to protect your drawdown.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Capital Protection Shield
          </span>
        </div>
      </div>
    )
  }

  // 2. If Revenge trading / Tilt is detected and not snoozed: show Intervention Modal
  const isTilted = tiltStatus?.is_tilted && !isSnoozed

  return (
    <AnimatePresence>
      {isTilted && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-[#0F172A] border-2 border-rose-500/40 p-5 shadow-2xl shadow-rose-950/50 relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    AI Performance Coach Intervention
                  </h4>
                  <span className="text-[10px] font-mono text-rose-300 uppercase tracking-wider font-bold">
                    Revenge Trading Risk Detected
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSnoozed(true)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mt-3 leading-relaxed">
              {tiltStatus?.reason || "You have experienced 3 rapid consecutive losses. Prop firm behavioral data shows 74% of traders in this emotional state breach their maximum daily drawdown."}
            </p>

            <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSnoozed(true)}
                className="text-xs text-gray-400 border-gray-800 hover:text-white"
              >
                Snooze 15m
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCoolingOff(30)}
                loading={isEngaging}
                className="text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Take 30-Min Cooling Off
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
