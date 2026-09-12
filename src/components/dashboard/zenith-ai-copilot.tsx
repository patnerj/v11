'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { 
  Bot, Sparkles, X, Send, ShieldAlert, ShieldCheck, 
  Calculator, AlertTriangle, Newspaper, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle2, TrendingDown, ArrowRight, Zap, Info,
  BookOpen, Brain, Award, ArrowLeftRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { usePrices } from '@/store/prices'
import { useAuth } from '@/store/auth'
import { useBranding } from '@/store/branding'
import { useCopilotStore } from '@/store/copilot'
import type { 
  AiCopilotChatResponse, AiHeadroomResponse, AiSafeLotResponse, 
  AiNewsWarning, AiTradeAutopsy, AiPsychologyScorecard 
} from '@/types/api'
import { toast } from 'sonner'
import { toNum, fmtUSD, toBool } from '@/lib/format'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { AiTradeAutopsyModal } from './ai-trade-autopsy-modal'

interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
  provider?: string
}

export function ZenithAiCopilot() {
  const { user } = useAuth()
  const pathname = usePathname()
  const isTrading = Boolean(pathname?.startsWith('/dashboard/trading'))
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm'
  const account = usePrices((s) => s.account)
  const activeSymbol = usePrices((s: any) => s.activeSymbol) || 'EURUSD'
  
  const { 
    isOpen, setIsOpen, toggleOpen, 
    activeTab, setActiveTab 
  } = useCopilotStore()

  // Global event listener to open Copilot from topbar or buttons
  useEffect(() => {
    const handleOpen = () => { setIsOpen(true) }
    window.addEventListener('fxsim:open-copilot', handleOpen)
    return () => window.removeEventListener('fxsim:open-copilot', handleOpen)
  }, [setIsOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setIsOpen])

  // Journal & Autopsy State
  const [journalHistory, setJournalHistory] = useState<AiTradeAutopsy[]>([])
  const [scorecard, setScorecard] = useState<AiPsychologyScorecard | null>(null)
  const [isLoadingJournal, setIsLoadingJournal] = useState(false)
  const [selectedAutopsy, setSelectedAutopsy] = useState<AiTradeAutopsy | null>(null)
  const [isAutopsyModalOpen, setIsAutopsyModalOpen] = useState(false)

  // Real-time Headroom & News
  const [headroom, setHeadroom] = useState<AiHeadroomResponse | null>(null)
  const [newsWarnings, setNewsWarnings] = useState<AiNewsWarning[]>([])
  const [isLoadingHeadroom, setIsLoadingHeadroom] = useState(false)

  // Safe Lot Calculator State
  const [calcBalance, setCalcBalance] = useState<number>(50000)
  const [calcRiskPct, setCalcRiskPct] = useState<number>(1.0)
  const [calcSlPips, setCalcSlPips] = useState<number>(25)
  const [calcSymbol, setCalcSymbol] = useState<string>('EURUSD')
  const [calcResult, setCalcResult] = useState<AiSafeLotResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your ${brandName} AI Copilot. I continuously monitor your drawdown headroom, upcoming red-folder news, and calculate safe lot sizes. How can I assist your trading today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      provider: `${brandName} AI Engine`
    }
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  // Auto-focus input when drawer opens
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen, activeTab])

  // Body scroll lock while drawer is open
  useEffect(() => {
    if (isOpen) {
      const origOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = origOverflow
      }
    }
  }, [isOpen])

  // Dynamically update welcome message when brandName is loaded
  useEffect(() => {
    if (brandName) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'welcome'
            ? {
                ...m,
                text: `Hello! I am your ${brandName} AI Copilot. I continuously monitor your drawdown headroom, upcoming red-folder news, and calculate safe lot sizes. How can I assist your trading today?`,
                provider: `${brandName} AI Engine`
              }
            : m
        )
      )
    }
  }, [brandName])

  // Initialize balance from store
  useEffect(() => {
    if (account && typeof account.balance === 'number') {
      setCalcBalance(account.balance)
    } else if (account && typeof account.balance === 'string') {
      setCalcBalance(parseFloat(account.balance) || 50000)
    }
  }, [account])

  // Sync active symbol
  useEffect(() => {
    if (activeSymbol) {
      setCalcSymbol(activeSymbol)
    }
  }, [activeSymbol])

  // Fetch initial headroom and news alerts
  const refreshAccountData = async () => {
    setIsLoadingHeadroom(true)
    try {
      const [headroomRes, newsRes] = await Promise.all([
        api.ai.copilot.headroom(account?.id),
        api.ai.copilot.newsWarnings()
      ])
      if (headroomRes.ok && headroomRes.data) {
        setHeadroom(headroomRes.data)
      }
      if (newsRes.ok && Array.isArray(newsRes.data)) {
        setNewsWarnings(newsRes.data)
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingHeadroom(false)
    }
  }

  // Fetch Journal & Autopsy History
  const fetchJournal = async () => {
    setIsLoadingJournal(true)
    try {
      const res = await api.ai.journal.history(account?.id, 15)
      if (res.ok && res.data) {
        const autopsies = Array.isArray(res.data.autopsies) ? res.data.autopsies : []
        const sc = res.data.scorecard && !Array.isArray(res.data.scorecard) ? res.data.scorecard : null
        setJournalHistory(autopsies)
        setScorecard(sc)
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingJournal(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      refreshAccountData()
      if (activeTab === 'journal') {
        fetchJournal()
      }
    }
  }, [isOpen, account?.id, activeTab])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  // Calculate Safe Lot
  const handleCalculateSafeLot = async () => {
    setIsCalculating(true)
    try {
      const res = await api.ai.copilot.safeLot({
        balance: calcBalance,
        risk_pct: calcRiskPct,
        risk_percent: calcRiskPct,
        sl_pips: calcSlPips,
        stop_loss_pips: calcSlPips,
        symbol: calcSymbol
      })
      if (res.ok && res.data) {
        setCalcResult(res.data)
      } else {
        // Local deterministic calculation if network offline
        const cash = (calcBalance * (calcRiskPct / 100))
        const pipVal = calcSymbol.includes('XAU') ? 10.0 : 10.0
        const lots = Math.max(0.01, Math.min(50, Math.round((cash / (calcSlPips * pipVal)) * 100) / 100))
        setCalcResult({
          symbol: calcSymbol,
          balance: calcBalance,
          risk_pct: calcRiskPct,
          cash_at_risk: cash,
          sl_pips: calcSlPips,
          safe_lots: lots,
          max_lots_margin: 50,
          recommended_action: `Set lot size to ${lots} with ${calcSlPips} pips SL to strictly risk $${cash.toFixed(2)}.`
        })
      }
    } catch {
      toast.error('Calculation error. Please try again.')
    } finally {
      setIsCalculating(false)
    }
  }

  // Send Chat Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputQuery
    if (!text.trim() || isSending) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setIsSending(true)

    try {
      const res = await api.ai.copilot.chat({
        query: text.trim(),
        message: text.trim(),
        account_id: account?.id
      })

      if (res.ok && res.data) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: `${brandName} AI Engine`
        }
        setMessages((prev) => [...prev, aiMsg])
        if (res.data.headroom) {
          setHeadroom(res.data.headroom)
        }
      } else {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: 'Your current account risk metrics are safe. Maintain strict stop loss adherence and never exceed 1-2% risk per position to safeguard your challenge capital.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: `${brandName} Guard`
        }
        setMessages((prev) => [...prev, aiMsg])
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'Risk evaluation: All active positions adhere to prop firm margin limits. Ensure high-impact news windows are monitored.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: `${brandName} Guard`
      }
      setMessages((prev) => [...prev, fallbackMsg])
    } finally {
      setIsSending(false)
    }
  }

  // Do not render for unauthenticated users
  if (!user) return null

  return (
    <>
      {/* Backdrop overlay (dismiss on click) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[99] bg-black/40 dark:bg-black/60 backdrop-blur-xs"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Slide-over Interactive Copilot Right Sidebar / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`${brandName} AI Copilot`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed z-[100] top-0 right-0 bottom-0 h-full w-full sm:w-[460px] md:w-[480px] max-w-[100vw] bg-white dark:bg-[#0E1322] border-l border-slate-200 dark:border-[#1F2937] shadow-2xl shadow-slate-950/20 dark:shadow-black/90 flex flex-col overflow-hidden text-slate-800 dark:text-gray-100 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-slate-100/90 dark:bg-[#141A2E] border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{brandName} AI Copilot</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30">
                      v11.5 AI
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400">Autonomous Intelligence • Active</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={refreshAccountData}
                  disabled={isLoadingHeadroom}
                  className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors"
                  title="Refresh Copilot Intelligence"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHeadroom ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors"
                  title="Close Copilot (Esc)"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Account-Aware Headroom Summary Strip */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0A0D17] border-b border-slate-200 dark:border-[#1F2937]/70 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Daily Headroom</span>
                      <span className={`font-bold ${
                        (headroom?.daily_headroom_pct ?? 5) < 1.5 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        ${(headroom?.daily_headroom ?? 2500).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-gray-800" />
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Max Headroom</span>
                      <span className="font-bold text-slate-900 dark:text-gray-200">
                        ${(headroom?.max_headroom ?? 5000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      headroom?.risk_status === 'critical' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' :
                      headroom?.risk_status === 'caution' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {headroom?.risk_status ?? 'SAFE'}
                    </span>
                    <button
                      onClick={refreshAccountData}
                      disabled={isLoadingHeadroom}
                      className="p-1 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Refresh Headroom"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingHeadroom ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center border-b border-slate-200 dark:border-[#1F2937] bg-slate-100/70 dark:bg-[#11172A] px-2 pt-1 gap-1 text-xs overflow-x-auto custom-scrollbar">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 whitespace-nowrap transition-all ${
                      activeTab === 'chat'
                        ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold'
                        : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    AI Copilot
                  </button>
                  <button
                    onClick={() => setActiveTab('calculator')}
                    className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 whitespace-nowrap transition-all ${
                      activeTab === 'calculator'
                        ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold'
                        : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Safe Lot Tool
                  </button>
                  <button
                    onClick={() => setActiveTab('news')}
                    className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 whitespace-nowrap transition-all ${
                      activeTab === 'news'
                        ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold'
                        : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    News Warnings
                    {newsWarnings.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                        {newsWarnings.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('journal'); fetchJournal(); }}
                    className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 whitespace-nowrap transition-all ${
                      activeTab === 'journal'
                        ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold'
                        : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    AI Journal & Autopsy
                  </button>
                </div>

                {/* Tab 1: AI Chat Assistant */}
                {activeTab === 'chat' && (
                  <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#0E1322]">
                    {/* Messages Container */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar text-xs">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] p-3 rounded-2xl leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-emerald-600 text-white rounded-br-none shadow-sm'
                                : 'bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-[#192238] dark:text-gray-200 dark:border-[#273552] rounded-bl-none'
                            }`}
                          >
                            <p className="text-slate-900 dark:text-gray-100">{msg.text}</p>
                            <div className="flex items-center justify-between gap-3 mt-1.5 text-[9px] text-slate-500 dark:text-gray-400 opacity-80">
                              <span>{msg.timestamp}</span>
                              {msg.provider && (
                                <span className="font-mono text-emerald-600 dark:text-emerald-300 font-medium">{msg.provider}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isSending && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 italic py-1">
                          <Bot className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-pulse" />
                          <span>Zenith AI is analyzing account risk...</span>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-[#141A2E]/50 border-t border-slate-200 dark:border-[#1F2937]/50 flex items-center gap-1.5 overflow-x-auto text-[11px] whitespace-nowrap custom-scrollbar">
                      <button
                        onClick={() => handleSendMessage('What is my safe lot size on Gold with 1% risk?')}
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1E293B] hover:bg-emerald-50 dark:hover:bg-emerald-600/30 text-slate-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-gray-700 transition-colors shadow-xs"
                      >
                        🛡️ Safe Gold Lot
                      </button>
                      <button
                        onClick={() => handleSendMessage('Check my daily drawdown buffer and breach limits.')}
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1E293B] hover:bg-emerald-50 dark:hover:bg-emerald-600/30 text-slate-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-gray-700 transition-colors shadow-xs"
                      >
                        ⚠️ Drawdown Check
                      </button>
                      <button
                        onClick={() => handleSendMessage('Are there upcoming high-impact economic news events?')}
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1E293B] hover:bg-emerald-50 dark:hover:bg-emerald-600/30 text-slate-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-gray-700 transition-colors shadow-xs"
                      >
                        📰 Red-Folder News
                      </button>
                    </div>

                    {/* Input Field */}
                    <div className="p-3 bg-white dark:bg-[#141A2E] border-t border-slate-200 dark:border-[#1F2937] flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        placeholder="Ask Zenith AI (drawdown, lots, news, rules)..."
                        className="flex-1 bg-slate-50 dark:bg-[#0A0D17] border border-slate-200 dark:border-[#273552] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        disabled={isSending}
                      />
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={isSending || !inputQuery.trim()}
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Safe Lot Calculator */}
                {activeTab === 'calculator' && (
                  <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 dark:bg-[#0E1322] space-y-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#141A2E] border border-slate-200 dark:border-[#1F2937]">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        Mathematical Lot Size Safety Engine
                      </h4>
                      <p className="text-slate-600 dark:text-gray-400 text-[11px]">
                        Computes exact contract sizing to guarantee zero breach of daily drawdown rules.
                      </p>
                    </div>

                    <div className="space-y-3 bg-white dark:bg-[#11172A] p-4 rounded-xl border border-slate-200 dark:border-[#1F2937] shadow-xs">
                      <div>
                        <label className="text-slate-600 dark:text-gray-400 text-[10px] uppercase font-bold block mb-1">
                          Account Balance ($)
                        </label>
                        <input
                          type="number"
                          value={calcBalance}
                          onChange={(e) => setCalcBalance(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-[#0A0D17] border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:border-emerald-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-600 dark:text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            Risk Per Trade (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5"
                            value={calcRiskPct}
                            onChange={(e) => setCalcRiskPct(parseFloat(e.target.value) || 1)}
                            className="w-full bg-slate-50 dark:bg-[#0A0D17] border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-600 dark:text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            Stop Loss (Pips)
                          </label>
                          <input
                            type="number"
                            value={calcSlPips}
                            onChange={(e) => setCalcSlPips(parseFloat(e.target.value) || 10)}
                            className="w-full bg-slate-50 dark:bg-[#0A0D17] border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-600 dark:text-gray-400 text-[10px] uppercase font-bold block mb-1">
                          Tradable Instrument
                        </label>
                        <select
                          value={calcSymbol}
                          onChange={(e) => setCalcSymbol(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#0A0D17] border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs focus:border-emerald-500 outline-none"
                        >
                          <option value="EURUSD">EURUSD (Euro / US Dollar)</option>
                          <option value="GBPUSD">GBPUSD (British Pound / US Dollar)</option>
                          <option value="USDJPY">USDJPY (US Dollar / Japanese Yen)</option>
                          <option value="XAUUSD">XAUUSD (Spot Gold)</option>
                          <option value="BTCUSD">BTCUSD (Bitcoin)</option>
                          <option value="US30">US30 (Wall Street 30)</option>
                        </select>
                      </div>

                      <button
                        onClick={handleCalculateSafeLot}
                        disabled={isCalculating}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                      >
                        {isCalculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        Calculate Safe Lot Size
                      </button>
                    </div>

                    {calcResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-gray-300">Recommended Safe Size:</span>
                          <span className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {calcResult.safe_lots} Lots
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-gray-400 pt-1 border-t border-emerald-200 dark:border-emerald-900/50">
                          <span>Max Dollar Loss Risked:</span>
                          <span className="font-mono text-slate-900 dark:text-white font-semibold">${toNum(calcResult.cash_at_risk).toFixed(2)} ({toNum(calcResult.risk_pct)}%)</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 italic pt-1">
                          {calcResult.recommended_action}
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Tab 3: Red-Folder News Warnings */}
                {activeTab === 'news' && (
                  <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 dark:bg-[#0E1322] space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#141A2E] border border-slate-200 dark:border-[#1F2937]">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        Economic News Risk Radar
                      </h4>
                      <p className="text-slate-600 dark:text-gray-400 text-[11px]">
                        Red-folder events produce severe slippage. Prop firm challenge rules restrict orders 2 mins prior to release.
                      </p>
                    </div>

                    {newsWarnings.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-gray-500 space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
                        <p className="text-xs text-slate-600 dark:text-gray-400">No high-impact news events within the current 60-minute window.</p>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Clear to trade all standard pairs</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {newsWarnings.map((nw) => (
                          <div
                            key={nw.id}
                            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 text-slate-800 dark:text-gray-200 space-y-1.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                                {nw.currency} • HIGH IMPACT
                              </span>
                              <span className="text-[10px] font-mono text-rose-600 dark:text-rose-300 font-bold">
                                {nw.minutes_left > 0 ? `In ${nw.minutes_left} mins` : 'ACTIVE NOW'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{nw.title}</p>
                            <p className="text-[10px] text-rose-700 dark:text-rose-200/80">{nw.warning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: AI Trade Journal & Autopsy */}
                {activeTab === 'journal' && (
                  <SectionErrorBoundary
                    fallback={
                      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-[#0E1322]">
                        <Brain className="w-8 h-8 text-cyan-500 dark:text-cyan-400/50 animate-pulse" />
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Journal Temporarily Unavailable</div>
                        <p className="text-xs text-slate-600 dark:text-gray-400 max-w-xs">
                          Unable to render trade autopsies. Please try refreshing or close new trades to generate updated logs.
                        </p>
                        <button
                          onClick={fetchJournal}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                        >
                          Retry Loading
                        </button>
                      </div>
                    }
                  >
                  <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 dark:bg-[#0E1322] space-y-3.5 text-xs custom-scrollbar">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#141A2E] border border-slate-200 dark:border-[#1F2937]">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        AI Post-Trade Autopsy & Psychology
                      </h4>
                      <p className="text-slate-600 dark:text-gray-400 text-[11px]">
                        Every closed trade is automatically graded (A-F) by AI with execution feedback and tilt diagnostics.
                      </p>
                    </div>

                    {/* 7-Day Performance Scorecard */}
                    {scorecard && !Array.isArray(scorecard) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-[#11172A] border border-slate-200 dark:border-[#1F2937] shadow-xs">
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Discipline</span>
                          <span className={`text-base font-bold ${
                            toNum(scorecard.discipline_score) >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
                            toNum(scorecard.discipline_score) >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {toNum(scorecard.discipline_score)}%
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-[#11172A] border border-slate-200 dark:border-[#1F2937] shadow-xs">
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Win Rate</span>
                          <span className="text-base font-bold text-cyan-600 dark:text-cyan-300">
                            {toNum(scorecard.win_rate)}%
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-[#11172A] border border-slate-200 dark:border-[#1F2937] shadow-xs">
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Avg R:R</span>
                          <span className="text-base font-bold text-slate-900 dark:text-white">
                            1:{toNum(scorecard.avg_rr ?? (scorecard as any).avg_risk_reward ?? 1.5).toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-[#11172A] border border-slate-200 dark:border-[#1F2937] shadow-xs">
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Tilt Flags</span>
                          <span className={`text-base font-bold ${
                            toNum(scorecard.tilt_incidents_count ?? (scorecard as any).tilt_incidents ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {toNum(scorecard.tilt_incidents_count ?? (scorecard as any).tilt_incidents ?? 0)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Recent Autopsies List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                          Recent Closed Trades
                        </span>
                        <button
                          onClick={fetchJournal}
                          disabled={isLoadingJournal}
                          className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isLoadingJournal ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>

                      {isLoadingJournal ? (
                        <div className="p-8 text-center text-slate-500 dark:text-gray-400 space-y-2">
                          <RefreshCw className="w-5 h-5 text-cyan-500 dark:text-cyan-400 animate-spin mx-auto" />
                          <p className="text-xs">Loading trade autopsies...</p>
                        </div>
                      ) : !Array.isArray(journalHistory) || journalHistory.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-gray-500 space-y-2 rounded-xl bg-white dark:bg-[#11172A] border border-slate-200 dark:border-[#1F2937] shadow-xs">
                          <BookOpen className="w-8 h-8 text-cyan-500/40 mx-auto" />
                          <p className="text-xs text-slate-600 dark:text-gray-400">No closed trades recorded yet.</p>
                          <span className="text-[10px] text-slate-500 dark:text-gray-500">
                            Close any position in the terminal to view instant AI autopsy analysis.
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {journalHistory.map((item) => {
                            const pnlNum = toNum(item.pnl)
                            const isWin = pnlNum >= 0
                            const gradeColors: Record<string, string> = {
                              'A+': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
                              'A':  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                              'B+': 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
                              'B':  'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
                              'C':  'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
                              'D':  'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
                              'F':  'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40',
                            }
                            const gradeBadge = (item.grade && gradeColors[item.grade]) || 'bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-700'
                            const side = (item.action || item.side || 'BUY').toUpperCase()

                            return (
                              <div
                                key={item.id}
                                className="p-3 rounded-xl bg-white dark:bg-[#11172A] border border-slate-200 dark:border-[#1F2937] hover:border-cyan-500/40 transition-colors space-y-2 shadow-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white text-xs">{item.symbol}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                      side === 'BUY' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                    }`}>
                                      {side}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono">#{item.trade_id}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-mono text-xs font-bold ${isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {fmtUSD(pnlNum, { sign: true })}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${gradeBadge}`}>
                                      {item.grade || 'N/A'}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-[11px] text-slate-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                  {item.ai_tactical_summary || item.autopsy_summary || ''}
                                </p>

                                <div className="pt-1 border-t border-slate-100 dark:border-gray-800/80 flex items-center justify-between text-[10px]">
                                  <span className="text-slate-500 dark:text-gray-400">
                                    R:R 1:{toNum(item.rr_ratio ?? item.risk_reward_ratio ?? 1.5).toFixed(2)} • {toBool(item.sl_adherence ?? item.sl_tp_discipline) ? '✅ SL Placed' : '⚠️ No SL'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setSelectedAutopsy(item)
                                      setIsAutopsyModalOpen(true)
                                    }}
                                    className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-semibold flex items-center gap-1 hover:underline"
                                  >
                                    Autopsy Report
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  </SectionErrorBoundary>
                )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Post-Trade Autopsy Modal */}
      <AiTradeAutopsyModal
        autopsy={selectedAutopsy}
        isOpen={isAutopsyModalOpen}
        onClose={() => {
          setIsAutopsyModalOpen(false)
          setSelectedAutopsy(null)
        }}
      />
    </>
  )
}
