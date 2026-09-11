"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Ticket } from "@/types/api";
import { 
  LifeBuoy, 
  MessageSquare, 
  Send, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ArrowLeft, 
  Bot, 
  User, 
  Plus, 
  Search, 
  ShieldCheck, 
  TrendingUp, 
  Wallet, 
  Cpu, 
  HelpCircle, 
  RefreshCw, 
  Check, 
  ShieldAlert,
  SlidersHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { useBranding } from "@/store/branding";

interface CategoryMeta {
  id: string;
  label: string;
  icon: typeof HelpCircle;
  description: string;
}

const CATEGORIES: CategoryMeta[] = [
  { id: "general", label: "General Inquiry", icon: HelpCircle, description: "Account questions, profile, general support" },
  { id: "trading", label: "Trading & Orders", icon: TrendingUp, description: "Order execution, symbols, lot sizes, slippage" },
  { id: "billing", label: "Billing & Payouts", icon: Wallet, description: "Challenge purchase, invoice, crypto payout, KYC" },
  { id: "rules", label: "Rules & Dispute", icon: ShieldAlert, description: "Drawdown limits, breach audit, evaluation passing" },
  { id: "tech_mt5", label: "MT5 & Platform", icon: Cpu, description: "MT5 credentials, server connection, WebTrader" },
];

export function TraderSupport() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm';
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // New ticket state
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newMessage, setNewMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Tickets List
  const { data: ticketsData, refetch: refetchTickets, isFetching: isFetchingTickets } = useQuery({
    queryKey: ['trader.tickets.list'],
    queryFn: async () => {
      const res = await api.tickets.list();
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.data;
    },
    refetchInterval: (selectedTicket || isCreating) ? false : 8000,
  });
  const tickets = ticketsData ?? [];

  // Fetch Active Ticket Conversation Detail
  const { data: activeTicketData, refetch: refetchMessages, isFetching: isFetchingMessages } = useQuery({
    queryKey: ['trader.tickets.get', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return null;
      const res = await api.tickets.get(Number(selectedTicket.id));
      if (!res.ok) throw new Error('Failed to fetch ticket');
      return res.data;
    },
    enabled: !!selectedTicket,
    refetchInterval: 4000,
  });

  const messages = activeTicketData?.messages ?? [];
  const currentTicket = (activeTicketData as any)?.ticket || selectedTicket;

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (selectedTicket && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedTicket]);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyText("");
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error("Please fill in both subject and description.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.tickets.create({
        subject: newSubject.trim(),
        category: newCategory,
        message: newMessage.trim(),
      });
      if (res.ok && (res.data as any)?.success !== false) {
        toast.success("Support ticket opened! 24/7 AI Desk is analyzing your inquiry.");
        setIsCreating(false);
        setNewSubject("");
        setNewMessage("");
        setNewCategory("general");
        await refetchTickets();
        if (res.data?.id) {
          const freshTicket = {
            id: res.data.id,
            ticket_number: `TICK-${res.data.id}`,
            subject: newSubject.trim(),
            category: newCategory,
            status: 'open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any;
          setSelectedTicket(freshTicket);
        }
      } else {
        toast.error(res.ok ? ((res.data as any)?.message || "Failed to create ticket") : (res.error || "Failed to create ticket"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create support ticket.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicket || !replyText.trim() || loading) return;
    const textToSend = replyText.trim();
    setLoading(true);
    try {
      const res = await api.tickets.reply(Number(selectedTicket.id), textToSend);
      if (res.ok && (res.data as any)?.success !== false) {
        setReplyText("");
        toast.success("Reply dispatched to support desk.");
        await refetchMessages();
        await refetchTickets();
        if ((res.data as any)?.ai_replied) {
          toast.success("✨ AI Support Desk replied instantly!");
        }
      } else {
        toast.error(res.ok ? ((res.data as any)?.message || "Failed to send reply") : (res.error || "Failed to send reply"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reply.");
    } finally {
      setLoading(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = tickets.length;
    const active = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    return { total, active, resolved };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = !searchQuery.trim() || 
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.ticket_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' 
        ? true 
        : statusFilter === 'active' 
          ? (t.status === 'open' || t.status === 'in_progress')
          : (t.status === 'resolved' || t.status === 'closed');

      const matchesCat = categoryFilter === 'all' || t.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  // Helper for Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Resolved
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
            Open
          </span>
        );
    }
  };

  // Helper for Category Label
  const getCategoryMeta = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId) || {
      id: catId,
      label: catId ? catId.charAt(0).toUpperCase() + catId.slice(1) : 'General',
      icon: HelpCircle,
      description: 'Support inquiry'
    };
  };

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: CREATE NEW TICKET FORM
  // ──────────────────────────────────────────────────────────────────────────
  if (isCreating) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsCreating(false)} 
            className="gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Tickets
          </Button>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            24/7 AI Desk Ready
          </div>
        </div>

        <Card className="p-6 sm:p-8 bg-[#0B0F19] border-[#1F2937] shadow-2xl rounded-2xl">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Open a Support Ticket</h2>
            <p className="text-xs text-gray-400">
              Submit your inquiry and our autonomous AI desk + human support specialists will resolve it immediately.
            </p>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-6">
            {/* Category Cards */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
                Select Issue Category
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = newCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewCategory(cat.id)}
                      className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-950/40 text-white' 
                          : 'bg-[#111827]/60 hover:bg-[#111827] border-[#1F2937] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-gray-400'}`} />
                        <span className="text-xs font-bold">{cat.label}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 line-clamp-2 leading-tight">
                        {cat.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Ticket Subject
              </label>
              <input
                type="text"
                required
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full rounded-xl border p-3 bg-[#080C14] border-[#1F2937] text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                placeholder="E.g., Cannot execute BTC/USDT market order on WebTrader"
              />
            </div>

            {/* Message Textarea */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Detailed Message & Details
              </label>
              <textarea
                required
                rows={5}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full rounded-xl border p-3 bg-[#080C14] border-[#1F2937] text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-y"
                placeholder="Provide specific details such as account ID, symbol, error messages, or transaction hash..."
              />
            </div>

            {/* AI Speed Hint */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-gray-300">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-emerald-300">Autonomous Instant Resolution:</strong> Our 24/7 AI Support Desk analyzes incoming tickets against live account telemetry, drawdown headroom, and KYC compliance to provide immediate resolutions in seconds.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreating(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={loading}
                className="gap-2 px-6 shadow-emerald-500/20"
              >
                {loading ? "Submitting..." : "Submit Ticket"}
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 2: ACTIVE TICKET CONVERSATION CHAT
  // ──────────────────────────────────────────────────────────────────────────
  if (selectedTicket) {
    const isClosed = (currentTicket?.status || selectedTicket.status) === 'closed' || (currentTicket?.status || selectedTicket.status) === 'resolved';
    const catMeta = getCategoryMeta(selectedTicket.category);
    const CatIcon = catMeta.icon;

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedTicket(null)}
            className="gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            All Tickets
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchMessages();
                refetchTickets();
                toast.info("Thread refreshed.");
              }}
              className="gap-1.5 text-xs text-gray-300 border-[#1F2937] hover:border-emerald-500/40 h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMessages ? 'animate-spin text-emerald-400' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Ticket Header Card */}
        <Card className="p-5 bg-[#0B0F19] border-[#1F2937] shadow-xl rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937]/70 pb-4 mb-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {selectedTicket.ticket_number || `#TICK-${selectedTicket.id}`}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#111827] text-gray-300 border border-[#1F2937] text-xs font-medium">
                  <CatIcon className="w-3.5 h-3.5 text-gray-400" />
                  {catMeta.label}
                </span>
                {getStatusBadge(currentTicket?.status || selectedTicket.status)}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {selectedTicket.subject}
              </h2>
            </div>

            <div className="text-right text-xs text-gray-500 font-mono shrink-0">
              <div className="flex items-center gap-1.5 justify-end">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* AI Beacon Banner */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-950/30 to-teal-950/20 border border-emerald-500/20 text-xs text-gray-300 mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-emerald-300">24/7 AI Desk Active</span>
              <span className="text-gray-500 hidden sm:inline">— Follow-ups & questions are resolved instantly</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400/80">&lt; 5s turnaround</span>
          </div>

          {/* Messages Stream */}
          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1 pb-2">
            {messages.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs font-mono">
                Connecting to ticket stream...
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.sender_type === 'trader' || msg.sender_type === 'user';
                const isAi = !isMe && (
                  msg.message.includes('Autonomous AI Desk') || 
                  msg.message.includes('AI Copilot') || 
                  (msg.sender_type as string) === 'ai_assistant' || 
                  msg.sender_id === 1
                );

                return (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Header line above bubble */}
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1 px-1 font-mono">
                      {isMe ? (
                        <>
                          <span className="font-semibold text-gray-300 flex items-center gap-1">
                            <User className="w-3 h-3 text-emerald-400" /> You
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-emerald-400" />
                            {isAi ? `✨ ${brandName} AI Desk` : `${brandName} Support Agent`}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            Verified
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </>
                      )}
                    </div>

                    {/* Chat Bubble */}
                    <div
                      className={`max-w-[88%] sm:max-w-[82%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                        isMe
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none shadow-emerald-950/40'
                          : isAi
                            ? 'bg-[#0B101D] border border-emerald-500/30 text-gray-100 rounded-tl-none shadow-black/60 shadow-lg'
                            : 'bg-[#111827] border border-[#1F2937] text-gray-100 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-sans">{msg.message}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Composer */}
          <div className="border-t border-[#1F2937]/80 pt-4 mt-2">
            {!isClosed ? (
              <form onSubmit={handleSendReply} className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Type your reply or follow-up question here... (Press Ctrl + Enter to send)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    className="w-full rounded-xl border p-3.5 bg-[#080C14] border-[#1F2937] text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-y min-h-[85px]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-[11px] text-gray-500 font-mono">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-[#111827] border border-gray-700 text-gray-300">Ctrl + Enter</kbd> to send immediately
                  </span>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={!replyText.trim() || loading}
                      className="gap-2 px-5 shadow-emerald-500/20 text-xs font-semibold h-9"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-[#0E131F] border border-[#1F2937] text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  This support ticket has been marked as resolved.
                </div>
                <p className="text-[11px] text-gray-400">
                  If you require assistance on a new matter, please open a fresh ticket.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsCreating(true)}
                  className="gap-1.5 text-xs mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Open New Ticket
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 3: MY SUPPORT TICKETS HUB (LIST VIEW)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Executive Top Strip & Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 bg-[#0B0F19] border-[#1F2937] rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{metrics.total}</div>
            <div className="text-[11px] text-gray-400 font-medium">Total Tickets</div>
          </div>
        </Card>

        <Card className="p-4 bg-[#0B0F19] border-[#1F2937] rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-400">{metrics.active}</div>
            <div className="text-[11px] text-gray-400 font-medium">Active Inquiries</div>
          </div>
        </Card>

        <Card className="p-4 bg-[#0B0F19] border-[#1F2937] rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-400">{metrics.resolved}</div>
            <div className="text-[11px] text-gray-400 font-medium">Resolved</div>
          </div>
        </Card>

        <Card className="p-4 bg-[#0B0F19] border-[#1F2937] rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-400">ONLINE (24/7)</div>
            <div className="text-[11px] text-gray-400 font-medium">Autonomous AI Desk</div>
          </div>
        </Card>
      </div>

      {/* ── Main Tickets Panel ──────────────────────────────────────────── */}
      <Card className="p-6 bg-[#0B0F19] border-[#1F2937] shadow-xl rounded-2xl space-y-5">
        
        {/* Header & New Ticket Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937]/80 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Support Inquiries & Live Tickets
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Track active dispute requests, technical platform tickets, and automated resolutions.
            </p>
          </div>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setIsCreating(true)}
            className="gap-2 text-xs font-bold shadow-emerald-500/20 h-9 px-4 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Open New Ticket
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticket #, subject..."
              className="w-full pl-9 pr-3 py-2 bg-[#080C14] border border-[#1F2937] rounded-xl text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Status Tabs & Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#080C14] p-1 rounded-xl border border-[#1F2937] text-xs">
              {(['all', 'active', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
                    statusFilter === st 
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#080C14] border border-[#1F2937] text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="general">General</option>
              <option value="trading">Trading</option>
              <option value="billing">Billing & Payouts</option>
              <option value="rules">Rules Dispute</option>
              <option value="tech_mt5">MT5 Platform</option>
            </select>
          </div>
        </div>

        {/* Tickets Cards Feed */}
        <div className="space-y-2.5 pt-1">
          {filteredTickets.map((t) => {
            const cat = getCategoryMeta(t.category);
            const CatIcon = cat.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => handleSelectTicket(t)}
                className="group p-4 rounded-xl bg-[#0E131F]/70 hover:bg-[#111827] border border-[#1F2937] hover:border-emerald-500/40 cursor-pointer transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {t.ticket_number || `#TICK-${t.id}`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-[#080C14] px-2 py-0.5 rounded border border-[#1F2937]">
                      <CatIcon className="w-3 h-3 text-gray-500" />
                      {cat.label}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {t.subject}
                  </h3>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                    <span>Opened: {new Date(t.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Updated: {new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1.5 text-xs group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-all h-8"
                  >
                    Open Chat
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </Button>
                </div>
              </motion.div>
            );
          })}

          {filteredTickets.length === 0 && (
            <div className="py-16 text-center border border-dashed border-[#1F2937] rounded-2xl p-8 bg-[#080C14]/40">
              <div className="inline-flex h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 items-center justify-center mb-3">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight">No support tickets found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' 
                  ? "No tickets matched your search criteria. Clear filters to see all tickets."
                  : "You do not have any open inquiries. If you ever have questions regarding trades or rules, our 24/7 AI Desk is here to help."}
              </p>
              <div className="mt-4">
                <Button 
                  size="sm" 
                  variant="primary" 
                  onClick={() => setIsCreating(true)}
                  className="gap-2 text-xs shadow-emerald-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Open New Ticket
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
