'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Plus, X, Send, HelpCircle, Swords, TrendingUp, Wallet, ShieldAlert, Cpu } from 'lucide-react'

export interface TicketModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { subject: string; category: string; message: string }) => Promise<void> | void
  loading?: boolean
}

const CATEGORIES = [
  { id: 'general', label: 'General Inquiry', icon: HelpCircle },
  { id: 'arena', label: 'Arena & PVP', icon: Swords },
  { id: 'trading', label: 'Trading & Orders', icon: TrendingUp },
  { id: 'billing', label: 'Billing & Payouts', icon: Wallet },
  { id: 'rules', label: 'Rules & Dispute', icon: ShieldAlert },
  { id: 'tech_mt5', label: 'MT5 & Platform', icon: Cpu },
]

export function CreateTicketModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}: TicketModalProps) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')

  const subjectInputRef = useRef<HTMLInputElement>(null)

  // Point #6: Auto-focus Subject input on modal open
  useEffect(() => {
    if (isOpen) {
      setSubject('')
      setMessage('')
      setCategory('general')
      const timer = setTimeout(() => {
        subjectInputRef.current?.focus()
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    await onSubmit({ subject: subject.trim(), category, message: message.trim() })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl bg-card dark:bg-[#0B0F19] border border-border dark:border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-border dark:border-[#1F2937] flex items-center justify-between bg-muted/40 dark:bg-[#0E131F]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground dark:text-white">Open Support Ticket</h3>
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">Our 24/7 AI Desk will review and respond instantly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-white p-1 rounded-lg hover:bg-muted dark:hover:bg-gray-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Category Tiles */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground/80 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Select Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon
                    const isSelected = category === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-emerald-500/15 dark:bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-white shadow-sm'
                            : 'bg-muted/30 dark:bg-[#111827]/60 hover:bg-muted/70 dark:hover:bg-[#111827] border-border dark:border-[#1F2937] text-muted-foreground dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground dark:text-gray-400'}`} />
                          <span className="text-xs font-bold">{cat.label}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Subject Input with Auto-Focus */}
              <div>
                <label htmlFor="ticket-subject" className="block text-[11px] font-semibold text-foreground/80 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Subject
                </label>
                <input
                  id="ticket-subject"
                  ref={subjectInputRef}
                  autoFocus
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border p-2.5 bg-background dark:bg-[#080C14] border-border dark:border-[#1F2937] text-xs text-foreground dark:text-gray-100 placeholder:text-muted-foreground dark:placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 shadow-sm"
                  placeholder="E.g. How can I participate in Arena?"
                />
              </div>

              {/* Description Textarea */}
              <div>
                <label htmlFor="ticket-description" className="block text-[11px] font-semibold text-foreground/80 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Description & Details
                </label>
                <textarea
                  id="ticket-description"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border p-2.5 bg-background dark:bg-[#080C14] border-border dark:border-[#1F2937] text-xs text-foreground dark:text-gray-100 placeholder:text-muted-foreground dark:placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 resize-none shadow-sm"
                  placeholder="Describe what you need help with in detail..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border dark:border-[#1F2937]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={loading}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={loading}
                  className="gap-2 text-xs px-5 shadow-emerald-500/20"
                >
                  {loading ? 'Submitting...' : 'Submit Ticket'}
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
