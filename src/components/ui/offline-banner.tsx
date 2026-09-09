'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOffline = () => {
      setIsOffline(true)
      setJustReconnected(false)
    }

    const handleOnline = () => {
      setIsOffline(false)
      setJustReconnected(true)
      const timer = setTimeout(() => setJustReconnected(false), 3000)
      return () => clearTimeout(timer)
    }

    // Set initial state
    setIsOffline(!navigator.onLine)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-50 bg-red-600/95 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 animate-pulse shrink-0" />
              <span>You are currently offline. Retrying connection...</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md text-[11px] transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        </motion.div>
      )}

      {justReconnected && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-50 bg-emerald-600/95 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg backdrop-blur-md"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Connection restored! You are back online.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
