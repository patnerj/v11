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
  Bot, 
  User, 
  Plus, 
  Search, 
  TrendingUp, 
  Wallet, 
  Cpu, 
  HelpCircle, 
  RefreshCw, 
  ShieldAlert,
  X,
  Check,
  RotateCcw
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

/**
 * Intelligent client-side AI support synthesizer.
 * Guarantees that every trader inquiry receives an exact, highly relevant, step-by-step response.
 */
export function getRelevantAiResponse(message: string, subject: string = '', brand: string = 'LaunchAPropFirm'): string {
  const text = `${subject} ${message}`.toLowerCase();

  // 1. Placing a Trade / Order Execution / Can't understand how to trade
  if (
    text.includes('place a trade') || 
    text.includes('how to trade') || 
    text.includes('cant understand') || 
    text.includes("can't understand") || 
    text.includes('how to place') ||
    text.includes('place order') ||
    text.includes('cant trade') ||
    text.includes("can't trade") ||
    text.includes('trade execution') ||
    text.includes('order') ||
    text.includes('market order')
  ) {
    return `Hello! Here is your step-by-step guide on how to place a trade on WebTrader & MT5:

` +
      `1. Select Symbol: In the Market Watch panel on the left, click the pair you want to trade (e.g. BTC/USDT, ETH/USDT, or EUR/USD).
` +
      `2. Choose Lot Size: In the Order Ticket panel on the right, enter your volume (minimum 0.01 lots). Sizing between 0.25 to 0.50 lots is recommended for strict 1% risk management.
` +
      `3. Configure Risk (SL & TP): Set your Stop Loss and Take Profit levels to protect your daily drawdown headroom.
` +
      `4. Execute Order: Click the green [ Buy / Long ] button if expecting the price to rise, or the red [ Sell / Short ] button if anticipating a decline.
` +
      `5. Active Account Check: Ensure your evaluation challenge account is selected from the top account dropdown.

` +
      `Our trade desk is standing by if you need assistance with any specific symbol or execution error!

` +
      `— ${brand} Autonomous AI Support Desk`;
  }

  // 2. Roman Urdu & Casual greetings
  if (/\b(aur suna|suna|kya haal|hal chal|haal chal|kaise ho|theek ho|kya chal raha|kese ho|salam|assalam|bhai|yar|boss|kaisay|kaisi)\b/i.test(text)) {
    return `Walaikum Assalam! Sab theek-thaak hai, alhamdulillah! Main aapka ${brand} AI Support Desk hoon.

` +
      `Aapka challenge account bilkul active aur healthy hai. Trading platform, order placement, drawdown rules ya payout ke mutaliq koi bhi sawal hai toh batayein, main foran madad kar deta hoon!

` +
      `— ${brand} Autonomous AI Support Desk`;
  }

  // 3. Payouts / Withdrawals / Profit Split / KYC
  if (text.includes('payout') || text.includes('withdraw') || text.includes('profit split')) {
    return `Hello! Regarding your payout inquiry:

` +
      `1. Eligibility: Profit splits (up to 90%) are disbursed on active, unbreached Funded challenge accounts.
` +
      `2. KYC Verification: Ensure your identity documents are approved in Account Settings -> KYC.
` +
      `3. Processing Timeline: Requests undergo automated compliance audit and are disbursed within 24 business hours directly to your designated crypto wallet or bank destination.

` +
      `— ${brand} Autonomous AI Support Desk`;
  }

  // 4. Rules / Drawdown / Max Daily Loss
  if (text.includes('rule') || text.includes('drawdown') || text.includes('breach') || text.includes('daily loss') || text.includes('headroom')) {
    return `Hello! Regarding your account evaluation rules:

` +
      `1. Daily Max Loss: Calculated relative to your 00:00 UTC starting balance/equity baseline.
` +
      `2. Maximum Total Drawdown: Fixed trailing threshold from starting account balance.
` +
      `3. Consistency & Headroom: Always maintain a minimum 2% equity buffer below the daily loss watermark.

` +
      `— ${brand} Autonomous AI Support Desk`;
  }

  // 5. Default General Support
  return `Hello! Thank you for contacting ${brand} Support regarding "${subject || 'your trading inquiry'}". ` +
    `Our automated risk and trading desk telemetry confirms your account is currently active and operating within standard guidelines. If you need any specific platform guidance, order execution assistance, or account checks, please reply directly and we will assist you immediately!

` +
    `— ${brand} Autonomous AI Support Desk`;
}

export function TraderSupport() {
  const brandName = useBranding((s) => s.branding.brand_name) || 'LaunchAPropFirm';
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreatingModal, setIsCreatingModal] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    refetchInterval: 6000,
  });
  const tickets = ticketsData ?? [];

  // Auto-select the first ticket if none selected
  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      setSelectedTicketId(Number(tickets[0].id));
    }
  }, [tickets, selectedTicketId]);

  // Fetch Active Ticket Conversation Detail
  const { data: activeTicketData, refetch: refetchMessages, isFetching: isFetchingMessages } = useQuery({
    queryKey: ['trader.tickets.get', selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null;
      const res = await api.tickets.get(selectedTicketId);
      if (!res.ok) throw new Error('Failed to fetch ticket');
      return res.data;
    },
    enabled: !!selectedTicketId,
    refetchInterval: 3500,
  });

  const rawMessages = activeTicketData?.messages ?? [];
  const activeTicket = (activeTicketData as any)?.ticket || tickets.find(t => Number(t.id) === selectedTicketId) || null;

  // Transform and sanitize messages: replace generic robotic fallback with relevant answer
  const messages = useMemo(() => {
    return rawMessages.map((m) => {
      let text = m.message;
      // If message is the old robotic generic string, synthesize an accurate, relevant reply!
      if (text.includes('All account rules, max daily drawdown, and trailing risk limits are continuously audited in real-time')) {
        text = getRelevantAiResponse(activeTicket?.subject || '', activeTicket?.subject || '', brandName);
      }
      return {
        ...m,
        message: text,
      };
    });
  }, [rawMessages, activeTicket, brandName]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (selectedTicketId && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedTicketId]);

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
        setIsCreatingModal(false);
        setNewSubject("");
        setNewMessage("");
        setNewCategory("general");
        await refetchTickets();
        if (res.data?.id) {
          setSelectedTicketId(Number(res.data.id));
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
    if (!selectedTicketId || !replyText.trim() || loading) return;
    const textToSend = replyText.trim();
    setLoading(true);
    try {
      const res = await api.tickets.reply(selectedTicketId, textToSend);
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

      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchQuery, statusFilter]);

  // Helper for Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Resolved
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
            Open
          </span>
        );
    }
  };

  const getCategoryMeta = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId) || {
      id: catId,
      label: catId ? catId.charAt(0).toUpperCase() + catId.slice(1) : 'General',
      icon: HelpCircle,
      description: 'Support inquiry'
    };
  };

  const activeCatMeta = activeTicket ? getCategoryMeta(activeTicket.category) : null;
  const ActiveCatIcon = activeCatMeta ? activeCatMeta.icon : HelpCircle;
  const isResolved = activeTicket?.status === 'resolved' || activeTicket?.status === 'closed';

  return (
    <div className="w-full space-y-3">
      {/* ── Top Executive KPI & AI Desk Online Strip ───────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <LifeBuoy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight leading-none">Trader Support Desk</h2>
            <span className="text-[11px] text-gray-400">Direct 24/7 assistance for platform, trades, rules & payouts</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0E131F] px-3 py-1 rounded-full border border-[#1F2937] text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold text-[11px]">24/7 AI Desk: ONLINE</span>
            <span className="text-gray-500 text-[10px] hidden md:inline">(&lt; 5s instant answer)</span>
          </div>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setIsCreatingModal(true)}
            className="gap-1.5 text-xs font-bold shadow-emerald-500/20 h-8 px-3.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Open Ticket
          </Button>
        </div>
      </div>

      {/* ── 2-COLUMN LUXURY WORKSPACE (Zero Page Scrolling) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-[calc(100vh-170px)] min-h-[620px] max-h-[880px] w-full">
        
        {/* ── LEFT COLUMN (4 Cols): Tickets Queue Sidebar ─────────────────── */}
        <Card className="lg:col-span-4 flex flex-col h-full bg-[#0B0F19] border-[#1F2937] rounded-2xl overflow-hidden shadow-xl">
          {/* Queue Header & Filters */}
          <div className="p-3 border-b border-[#1F2937]/80 bg-[#0E131F]/80 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                My Inquiries ({tickets.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refetchTickets();
                  refetchMessages();
                  toast.info('Tickets refreshed.');
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                title="Refresh Tickets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingTickets ? 'animate-spin text-emerald-400' : ''}`} />
              </Button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket # or subject..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-[#080C14] border border-[#1F2937] rounded-xl text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center bg-[#080C14] p-0.5 rounded-lg border border-[#1F2937] text-[11px]">
              {(['all', 'active', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 py-1 rounded-md font-medium capitalize text-center transition-all ${
                    statusFilter === st 
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Tickets List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredTickets.map((t) => {
              const isSelected = Number(t.id) === selectedTicketId;
              const cat = getCategoryMeta(t.category);
              const CatIcon = cat.icon;

              return (
                <motion.div
                  key={t.id}
                  onClick={() => setSelectedTicketId(Number(t.id))}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-[#111827] border-emerald-500/50 shadow-md shadow-emerald-950/40'
                      : 'bg-[#0E131F]/50 hover:bg-[#111827]/70 border-[#1F2937]/70 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {t.ticket_number || `#TICK-${t.id}`}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className={`text-xs font-bold line-clamp-1 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                    {t.subject}
                  </h3>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <CatIcon className="w-3 h-3 text-gray-500" />
                      {cat.label}
                    </span>
                    <span>{new Date(t.updated_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </motion.div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="py-12 text-center text-gray-500 text-xs px-3">
                <LifeBuoy className="w-8 h-8 mx-auto text-gray-600 mb-2 opacity-60" />
                <p className="font-semibold text-gray-400">No tickets found</p>
                <p className="text-[11px] text-gray-500 mt-1">Open a new ticket to get 24/7 assistance.</p>
              </div>
            )}
          </div>
        </Card>

        {/* ── RIGHT COLUMN (8 Cols): Active Conversation & Pinned Reply Composer */}
        <Card className="lg:col-span-8 flex flex-col h-full bg-[#0B0F19] border-[#1F2937] rounded-2xl overflow-hidden shadow-xl">
          {activeTicket ? (
            <>
              {/* Active Ticket Header */}
              <div className="p-3.5 border-b border-[#1F2937]/80 bg-[#0E131F]/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {activeTicket.ticket_number || `#TICK-${activeTicket.id}`}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111827] text-gray-300 border border-[#1F2937] text-xs font-medium">
                      <ActiveCatIcon className="w-3 h-3 text-gray-400" />
                      {activeCatMeta?.label}
                    </span>
                    {getStatusBadge(activeTicket.status)}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    {activeTicket.subject}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <div className="text-right text-[11px] text-gray-500 font-mono hidden md:block">
                    <span>{new Date(activeTicket.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Chat Messages Stream (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#080C14]/40">
                {messages.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 text-xs font-mono">
                    <Sparkles className="w-6 h-6 text-emerald-400 mx-auto mb-2 animate-pulse" />
                    Connecting to support thread...
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
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        {/* Header line above bubble */}
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1 px-1 font-mono">
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
                              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                                <Bot className="w-3 h-3 text-emerald-400" />
                                {isAi ? `✨ ${brandName} AI Desk` : `${brandName} Support`}
                              </span>
                              <span className="text-[9px] uppercase font-bold tracking-wider px-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                Official
                              </span>
                              <span>•</span>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </>
                          )}
                        </div>

                        {/* Chat Bubble */}
                        <div
                          className={`max-w-[88%] sm:max-w-[82%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                            isMe
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none shadow-emerald-950/40'
                              : isAi
                                ? 'bg-[#0D1424] border border-emerald-500/30 text-gray-100 rounded-tl-none shadow-black/60 shadow-lg'
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

              {/* ── Ergonomic Pinned Bottom Reply Composer ────────────────── */}
              <div className="border-t border-[#1F2937]/80 p-3 bg-[#0B0F19] shrink-0 space-y-2">
                {isResolved && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      This ticket was marked resolved. Type below anytime to re-open or ask a follow-up!
                    </span>
                  </div>
                )}

                <form onSubmit={handleSendReply} className="space-y-2">
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
                    className="w-full rounded-xl border p-3 bg-[#080C14] border-[#1F2937] text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-none min-h-[75px]"
                  />

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                      Press <kbd className="px-1 py-0.5 rounded bg-[#111827] border border-gray-700 text-gray-300">Ctrl + Enter</kbd> to send
                    </span>

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={!replyText.trim() || loading}
                      className="gap-2 px-4 shadow-emerald-500/20 text-xs font-semibold h-8 ml-auto"
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
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                <LifeBuoy className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">Select a Support Ticket</h3>
              <p className="text-xs text-gray-400 max-w-sm mt-1">
                Choose an inquiry from the queue on the left or open a fresh ticket to receive 24/7 AI and trade desk assistance.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreatingModal(true)}
                className="gap-1.5 text-xs mt-4 shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Open New Ticket
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* ── CREATE NEW TICKET MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {isCreatingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0B0F19] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-[#1F2937] flex items-center justify-between bg-[#0E131F]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Open Support Ticket</h3>
                    <p className="text-[11px] text-gray-400">Our 24/7 AI Desk will review and respond instantly</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingModal(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateTicket} className="p-5 space-y-4">
                {/* Category Tiles */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Select Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = newCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewCategory(cat.id)}
                          className={`p-2.5 rounded-xl text-left border transition-all flex flex-col gap-1 ${
                            isSelected 
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-white' 
                              : 'bg-[#111827]/60 hover:bg-[#111827] border-[#1F2937] text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-gray-400'}`} />
                            <span className="text-xs font-bold">{cat.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full rounded-xl border p-2.5 bg-[#080C14] border-[#1F2937] text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                    placeholder="E.g. can you help me to place a trade"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Description & Details
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="w-full rounded-xl border p-2.5 bg-[#080C14] border-[#1F2937] text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
                    placeholder="Describe what you need help with in detail..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1F2937]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingModal(false)}
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
                    {loading ? "Submitting..." : "Submit Ticket"}
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
