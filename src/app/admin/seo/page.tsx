'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { 
  Search, Globe, Share2, BarChart3, Check, Copy, ExternalLink, 
  Save, Sparkles, Shield, AlertCircle, Eye, Monitor, Smartphone, 
  FileCode, CheckCircle2, Code2, RefreshCw, KeyRound, ArrowUpRight,
  Plus, Trash2, X, Lightbulb, Zap, HelpCircle, Layers, CheckCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useBranding } from '@/store/branding'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { PageSeoConfig, DEFAULT_SEO_PAGES, deduplicateBrandTitle } from '@/lib/seo-metadata'

interface SeoFormState {
  meta_title: string
  meta_description: string
  meta_keywords: string
  robots_indexing: boolean
  google_site_verification: string
  bing_site_verification: string
  og_image_url: string
  ga_measurement_id: string
  facebook_pixel_id: string
  custom_head_code: string
}

const DEFAULT_SEO_STATE: SeoFormState = {
  meta_title: 'AlphaCapital — Trade Up to $200,000 in Funded Capital',
  meta_description: 'Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits with AlphaCapital.',
  meta_keywords: 'Prop Firm, Proprietary Trading, Funded Account, Forex Prop Firm, Crypto Prop Firm, Trading Challenge, AlphaCapital',
  robots_indexing: true,
  google_site_verification: '',
  bing_site_verification: '',
  og_image_url: '/branding/brand_logo_600x150.png',
  ga_measurement_id: 'G-G5758RZV7E',
  facebook_pixel_id: '',
  custom_head_code: '',
}

const AVAILABLE_PAGES = [
  { path: '/', label: 'Home Page', badge: 'Main', icon: Globe },
  { path: '/challenges', label: 'Challenges / Pricing', badge: 'Core', icon: BarChart3 },
  { path: '/about', label: 'About Us', badge: 'Trust', icon: Shield },
  { path: '/how-it-works', label: 'How It Works', badge: 'Roadmap', icon: FileCode },
  { path: '/faq', label: 'FAQ & Rules', badge: 'Help', icon: HelpCircle },
  { path: '/payouts', label: 'Payouts & Proof', badge: 'Proof', icon: CheckCircle2 },
  { path: '/contact', label: 'Contact & Support', badge: 'Desk', icon: Share2 },
  { path: '/tournaments', label: 'Tournaments Arena', badge: 'PvP', icon: Sparkles },
]

const PAGE_KEYWORD_SUGGESTIONS: Record<string, string[]> = {
  '/': ['Prop Firm', 'Funded Trading Account', 'Forex Prop Firm', 'Instant Funding MT5', 'Proprietary Trading Firm'],
  '/challenges': ['Prop Firm Challenge', '2-Step Evaluation', 'Instant Funding MT5', 'Funded Account Challenge', 'Trading Evaluation Plans'],
  '/about': ['Proprietary Trading Firm', 'Institutional Liquidity', 'Static Drawdown', 'About Us', 'Global Trading Firm'],
  '/how-it-works': ['How Prop Firms Work', 'Trader Profit Split', 'Evaluation Rules', 'Prop Firm Steps', 'Funded Trader Roadmap'],
  '/faq': ['Prop Firm Drawdown Rules', 'Weekend Holding', 'Crypto Payouts', 'News Trading Rules', 'Prop Firm FAQ'],
  '/payouts': ['Guaranteed Trader Payouts', 'Bi-Weekly Profit Split', 'Prop Firm Payout Proof', 'Instant Crypto Payouts', 'Funded Withdrawals'],
  '/contact': ['Prop Firm Support', 'Trader Desk Governance', 'Customer Service', 'Support Desk', '24/7 Live Support'],
  '/tournaments': ['Trading Tournaments', 'Prop Firm Competitions', 'Trader Leaderboard', 'PvP Trading Arena', 'Free Funded Accounts'],
}

export default function AdminSeoPage() {
  const { branding, reload: reloadBranding } = useBranding()
  const [form, setForm] = useState<SeoFormState>(DEFAULT_SEO_STATE)
  const [seoPages, setSeoPages] = useState<Record<string, PageSeoConfig>>(DEFAULT_SEO_PAGES)
  const [activePath, setActivePath] = useState<string>('/challenges')
  const [newKeywordInput, setNewKeywordInput] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  // Load current values from API
  useEffect(() => {
    let mounted = true
    api.admin.whitelabelGet().then((res) => {
      if (!mounted) return
      if (res.ok && res.data) {
        const d = res.data as Record<string, any>
        setForm({
          meta_title: d.meta_title ?? DEFAULT_SEO_STATE.meta_title,
          meta_description: d.meta_description ?? DEFAULT_SEO_STATE.meta_description,
          meta_keywords: d.meta_keywords ?? DEFAULT_SEO_STATE.meta_keywords,
          robots_indexing: d.robots_indexing !== undefined ? (d.robots_indexing === '1' || d.robots_indexing === 1 || d.robots_indexing === true) : true,
          google_site_verification: d.google_site_verification ?? '',
          bing_site_verification: d.bing_site_verification ?? '',
          og_image_url: d.og_image_url ?? DEFAULT_SEO_STATE.og_image_url,
          ga_measurement_id: d.ga_measurement_id ?? DEFAULT_SEO_STATE.ga_measurement_id,
          facebook_pixel_id: d.facebook_pixel_id ?? '',
          custom_head_code: d.custom_head_code ?? '',
        })

        if (d.seo_pages && typeof d.seo_pages === 'object' && Object.keys(d.seo_pages).length > 0) {
          setSeoPages((prev) => ({ ...prev, ...d.seo_pages }))
        } else if (d.seo_pages_data) {
          try {
            const parsed = JSON.parse(d.seo_pages_data)
            if (parsed && typeof parsed === 'object') {
              setSeoPages((prev) => ({ ...prev, ...parsed }))
            }
          } catch {
            // fallback
          }
        }
      }
      setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const handleChange = (field: keyof SeoFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const homePageSeo = seoPages['/'] || DEFAULT_SEO_PAGES['/'] || {}
      const syncedTitle = (homePageSeo.title || form.meta_title).trim()
      const syncedDesc = (homePageSeo.description || form.meta_description).trim()
      const syncedKeywords = homePageSeo.primary_keyword
        ? [homePageSeo.primary_keyword, ...(homePageSeo.secondary_keywords || [])].join(', ')
        : form.meta_keywords.trim()

      const payload: Record<string, any> = {
        meta_title: syncedTitle,
        meta_description: syncedDesc,
        meta_keywords: syncedKeywords,
        robots_indexing: form.robots_indexing ? '1' : '0',
        google_site_verification: form.google_site_verification.trim(),
        bing_site_verification: form.bing_site_verification.trim(),
        og_image_url: form.og_image_url.trim(),
        ga_measurement_id: form.ga_measurement_id.trim(),
        facebook_pixel_id: form.facebook_pixel_id.trim(),
        custom_head_code: form.custom_head_code,
        seo_pages: seoPages,
        seo_pages_data: JSON.stringify(seoPages),
      }

      const res = await api.admin.whitelabelSave(payload)
      if (res.ok) {
        setForm((prev) => ({
          ...prev,
          meta_title: syncedTitle,
          meta_description: syncedDesc,
          meta_keywords: syncedKeywords,
        }))
        toast.success('All SEO, Keywords & Page Content saved successfully!')
        await reloadBranding()
      } else {
        toast.error((res as any).error || 'Failed to save SEO settings')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  // Active page config helpers
  const activePageConfig: PageSeoConfig = {
    ...(DEFAULT_SEO_PAGES[activePath] || {}),
    ...(seoPages[activePath] || {})
  }

  const handlePageFieldChange = (field: keyof PageSeoConfig, value: any) => {
    setSeoPages((prev) => ({
      ...prev,
      [activePath]: {
        ...(prev[activePath] || DEFAULT_SEO_PAGES[activePath] || {}),
        [field]: value
      }
    }))
  }

  const handleAddSecondaryKeyword = (kwToAdd?: string) => {
    const raw = kwToAdd !== undefined ? kwToAdd : newKeywordInput
    const trimmed = raw.trim()
    if (!trimmed) return
    const current = activePageConfig.secondary_keywords || []
    if (!current.includes(trimmed)) {
      handlePageFieldChange('secondary_keywords', [...current, trimmed])
    }
    if (kwToAdd === undefined) {
      setNewKeywordInput('')
    }
  }

  const handleRemoveSecondaryKeyword = (kwToRemove: string) => {
    const current = activePageConfig.secondary_keywords || []
    handlePageFieldChange('secondary_keywords', current.filter((k) => k !== kwToRemove))
  }

  const handleAddFaqItem = () => {
    const current = activePageConfig.faqs || []
    handlePageFieldChange('faqs', [
      ...current,
      { q: 'New question about this page?', a: 'Provide clear, authoritative answer here.' }
    ])
  }

  const handleUpdateFaqItem = (index: number, field: 'q' | 'a', value: string) => {
    const current = [...(activePageConfig.faqs || [])]
    if (current[index]) {
      current[index] = { ...current[index], [field]: value }
      handlePageFieldChange('faqs', current)
    }
  }

  const handleRemoveFaqItem = (index: number) => {
    const current = [...(activePageConfig.faqs || [])]
    current.splice(index, 1)
    handlePageFieldChange('faqs', current)
  }

  const handleAiEnrich = async () => {
    setIsAiLoading(true)
    try {
      const res = await api.admin.seoAiEnrich({
        page_path: activePath,
        primary_keyword: activePageConfig.primary_keyword || '',
        secondary_keywords: activePageConfig.secondary_keywords || [],
        search_intent: activePageConfig.search_intent || 'Commercial',
      })
      if (res.ok && res.data) {
        setAiResult(res.data)
        setAiModalOpen(true)
        toast.success('AI SEO suggestions generated successfully!')
      } else {
        toast.error((res as any).error || 'Failed to generate AI suggestions')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error communicating with AI engine')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleApplyAiSuggestions = () => {
    if (!aiResult) return
    const current = { ...(seoPages[activePath] || DEFAULT_SEO_PAGES[activePath] || {}) }
    if (aiResult.title) current.title = aiResult.title
    if (aiResult.description) current.description = aiResult.description
    if (aiResult.hero_badge) current.hero_badge = aiResult.hero_badge
    if (aiResult.h1_title) current.h1_title = aiResult.h1_title
    if (aiResult.lead_paragraph) current.lead_paragraph = aiResult.lead_paragraph
    if (aiResult.search_intent) current.search_intent = aiResult.search_intent
    if (Array.isArray(aiResult.faqs) && aiResult.faqs.length > 0) current.faqs = aiResult.faqs

    setSeoPages((prev) => ({
      ...prev,
      [activePath]: current
    }))
    setAiModalOpen(false)
    toast.success(`Applied AI SEO content to ${activePath}! Click "Save All Changes" to persist.`)
  }

  // Real-time Keyword Occurrence & Density Counter
  const leadText = activePageConfig.lead_paragraph || ''
  const pKw = (activePageConfig.primary_keyword || '').trim()
  const secList = activePageConfig.secondary_keywords || []

  const countKeyword = (text: string, kw: string) => {
    if (!text || !kw) return 0
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const reg = new RegExp(`\\b${escaped}\\b`, 'gi')
    return (text.match(reg) || []).length
  }

  const primaryOccurrences = countKeyword(leadText, pKw)
  const wordCount = leadText.trim().split(/\s+/).filter(Boolean).length
  const primaryDensity = wordCount > 0 ? (((primaryOccurrences * (pKw ? pKw.split(/\s+/).length : 1)) / wordCount) * 100).toFixed(1) : '0.0'

  // Global SEO length calculations
  const titleLength = form.meta_title.length
  const descLength = form.meta_description.length

  const getTitleStatus = (len: number) => {
    if (len === 0) return { label: 'Empty', tone: 'danger' }
    if (len < 40) return { label: 'Too Short (<40)', tone: 'warning' }
    if (len <= 65) return { label: 'Optimal (50-65)', tone: 'success' }
    return { label: 'Too Long (>65)', tone: 'warning' }
  }

  const getDescStatus = (len: number) => {
    if (len === 0) return { label: 'Empty', tone: 'danger' }
    if (len < 120) return { label: 'Too Short (<120)', tone: 'warning' }
    if (len <= 165) return { label: 'Optimal (120-165)', tone: 'success' }
    return { label: 'Too Long (>165)', tone: 'warning' }
  }

  const titleStatus = getTitleStatus(titleLength)
  const descStatus = getDescStatus(descLength)

  // Active page title / description length
  const activeTitle = activePageConfig.title || ''
  const activeDesc = activePageConfig.description || ''
  const activeTitleStatus = getTitleStatus(activeTitle.length)
  const activeDescStatus = getDescStatus(activeDesc.length)

  // SEO Health score calculation for active page
  const hasPrimaryKw = Boolean(pKw)
  const titleHasKw = hasPrimaryKw && countKeyword(activeTitle, pKw) > 0
  const descHasKw = hasPrimaryKw && countKeyword(activeDesc, pKw) > 0
  const leadHasKw = hasPrimaryKw && primaryOccurrences > 0
  const titleOptimal = activeTitle.length >= 40 && activeTitle.length <= 65
  const descOptimal = activeDesc.length >= 115 && activeDesc.length <= 165
  const hasSecKws = secList.length >= 2
  const hasFaqs = (activePageConfig.faqs || []).length >= 2

  let healthScore = 0
  if (hasPrimaryKw) healthScore += 15
  if (titleOptimal) healthScore += 15
  if (descOptimal) healthScore += 15
  if (titleHasKw) healthScore += 15
  if (descHasKw) healthScore += 15
  if (leadHasKw) healthScore += 15
  if (hasSecKws) healthScore += 5
  if (hasFaqs) healthScore += 5

  const brandName = branding.brand_name || 'AlphaCapital'
  const finalDisplayTitle = deduplicateBrandTitle(activeTitle || `${brandName} — Trade Up to $200,000`, brandName)

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="SEO & Content Management Hub"
        description="Configure Page-by-Page SEO Keywords, On-Page Headings, Lead Paragraphs, FAQ Rich Snippets, and SERP Previews without rebuilding code."
        icon={Search}
        badge={{ label: 'Search Engine Hub', tone: 'accent' }}
        action={
          <Button 
            onClick={handleSave} 
            disabled={saving || loading}
            className="flex items-center gap-2 shadow-sm font-semibold"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        }
      />

      <Tabs defaultValue="page_by_page" className="space-y-6">
        <TabsList className="bg-surface border border-border p-1 w-full sm:w-auto flex flex-wrap gap-1">
          <TabsTrigger value="page_by_page" className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <FileCode className="h-4 w-4" />
            <span>📄 Page-by-Page SEO & Content</span>
          </TabsTrigger>
          <TabsTrigger value="serp" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Search className="h-4 w-4" />
            <span>Global SERP Defaults</span>
          </TabsTrigger>
          <TabsTrigger value="webmaster" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <KeyRound className="h-4 w-4" />
            <span>Webmaster & Indexing</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Share2 className="h-4 w-4" />
            <span>Social Cards (OG)</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            <span>Tracking & Scripts</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: PAGE-BY-PAGE SEO & CONTENT (MAIN USER REQUIREMENT)        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="page_by_page" className="space-y-6">
          {/* PAGE SELECTOR HUB */}
          <Card className="bg-surface border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Page Selector Hub
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    Select the marketing page to customize its Target Keywords, Meta Tags, On-Page Headings, Lead Paragraphs, and Rich FAQs.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="self-start sm:self-auto border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-mono text-2xs bg-emerald-50/50 dark:bg-emerald-500/10">
                  8 Dynamic Routes Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {AVAILABLE_PAGES.map((p) => {
                  const Icon = p.icon
                  const isActive = activePath === p.path
                  const pConfig = seoPages[p.path] || DEFAULT_SEO_PAGES[p.path] || {}
                  const hasKw = Boolean(pConfig.primary_keyword)
                  return (
                    <button
                      key={p.path}
                      onClick={() => setActivePath(p.path)}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0",
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-600 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/50"
                          : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")} />
                      <span>{p.label}</span>
                      <span className={cn(
                        "font-mono text-3xs px-1.5 py-0.5 rounded",
                        isActive ? "bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold" : "bg-slate-100 dark:bg-surface text-slate-600 dark:text-slate-400"
                      )}>
                        {p.path}
                      </span>
                      {hasKw && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Keywords configured" />
                      )}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* TWO COLUMN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: EDITORS & CONFIG (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* CARD 1: TARGET KEYWORDS SUITE */}
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Target Keywords &amp; Search Intent
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAiEnrich}
                      disabled={isAiLoading}
                      className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-transparent hover:bg-emerald-100/60 dark:hover:bg-emerald-500/10 h-7 text-xs font-semibold gap-1.5"
                    >
                      {isAiLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>✨ AI Optimize Page Content</span>
                    </Button>
                  </div>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    Define the core terms this page targets so your lead paragraphs and meta tags align with actual trader search intent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Primary Keyword */}
                  <div className="space-y-1.5">
                    <Label htmlFor="primary_kw" className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>Primary Focus Keyword</span>
                      <span className="text-3xs text-emerald-700 dark:text-emerald-400 font-mono font-medium">Core Ranking Term</span>
                    </Label>
                    <Input
                      id="primary_kw"
                      value={activePageConfig.primary_keyword || ''}
                      onChange={(e) => handlePageFieldChange('primary_keyword', e.target.value)}
                      placeholder="e.g. Prop Firm Challenge"
                      className="font-medium border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                    <p className="text-2xs text-slate-500 dark:text-muted-foreground">
                      The primary search term you want Google to associate with this specific URL.
                    </p>
                  </div>

                  {/* Secondary Keywords Chips */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>Secondary / LSI Keywords ({secList.length})</span>
                      <span className="text-3xs text-slate-500 dark:text-muted-foreground">Type &amp; press Enter</span>
                    </Label>
                    
                    {/* Chip List */}
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-lg bg-slate-50 dark:bg-surface-muted/40 border border-slate-200 dark:border-border">
                      {secList.length === 0 ? (
                        <span className="text-2xs text-slate-500 dark:text-muted-foreground self-center italic">
                          No secondary keywords added yet. Add below or click suggestions.
                        </span>
                      ) : (
                        secList.map((kw, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium"
                          >
                            <span>{kw}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSecondaryKeyword(kw)}
                              className="text-emerald-700 hover:text-emerald-950 dark:text-emerald-400/80 dark:hover:text-emerald-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add Keyword Input */}
                    <div className="flex gap-2">
                      <Input
                        value={newKeywordInput}
                        onChange={(e) => setNewKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddSecondaryKeyword()
                          }
                        }}
                        placeholder="Add secondary keyword (e.g. Instant Funding MT5)..."
                        className="text-xs h-9 border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAddSecondaryKeyword()}
                        disabled={!newKeywordInput.trim()}
                        className="h-9 px-3 shrink-0 text-xs gap-1 font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>

                    {/* Quick Suggestions Bar */}
                    {PAGE_KEYWORD_SUGGESTIONS[activePath] && (
                      <div className="pt-1">
                        <div className="flex items-center gap-1 text-3xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          <Lightbulb className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                          <span>Recommended LSI Suggestions for {activePath}:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {PAGE_KEYWORD_SUGGESTIONS[activePath].map((sug, i) => {
                            const isAdded = secList.includes(sug) || activePageConfig.primary_keyword === sug
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isAdded}
                                onClick={() => handleAddSecondaryKeyword(sug)}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs border transition-all duration-150 font-medium",
                                  isAdded
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold cursor-default"
                                    : "bg-white dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
                                )}
                              >
                                {isAdded ? `✓ ${sug}` : `+ ${sug}`}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Search Intent */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Search Intent</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['Commercial', 'Informational', 'Transactional', 'Navigational'] as const).map((intent) => {
                        const isSelected = (activePageConfig.search_intent || 'Commercial') === intent
                        return (
                          <button
                            key={intent}
                            type="button"
                            onClick={() => handlePageFieldChange('search_intent', intent)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-xs font-semibold text-center transition-all",
                              isSelected
                                ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-600 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/40"
                                : "bg-white dark:bg-surface border-slate-200 dark:border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-muted"
                            )}
                          >
                            {intent}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* CARD 2: SEARCH ENGINE METADATA */}
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Search className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    SERP Meta Tags for {activePath}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    These tags dictate how Google, Bing, and social crawlers render the clickable snippet for this exact route.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Meta Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="page_title" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Meta Title (Title Tag)
                      </Label>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-2xs text-slate-600 dark:text-slate-400 tabular-nums">
                          {activeTitle.length} chars
                        </span>
                        <Badge 
                          variant={activeTitleStatus.tone === 'success' ? 'success' : activeTitleStatus.tone === 'danger' ? 'danger' : 'warning'} 
                          className="text-3xs px-1.5 py-0"
                        >
                          {activeTitleStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <Input
                      id="page_title"
                      value={activePageConfig.title || ''}
                      onChange={(e) => handlePageFieldChange('title', e.target.value)}
                      placeholder={`e.g. ${activePath === '/' ? 'AlphaCapital — Trade Up to $200,000' : 'Evaluation Plans & Pricing | AlphaCapital'}`}
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                    <p className="text-2xs text-slate-500 dark:text-muted-foreground">
                      Browser tab headline. Recommended: 50–65 characters. Automatically deduplicates brand name suffix.
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="page_desc" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Meta Description
                      </Label>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-2xs text-slate-600 dark:text-slate-400 tabular-nums">
                          {activeDesc.length} chars
                        </span>
                        <Badge 
                          variant={activeDescStatus.tone === 'success' ? 'success' : activeDescStatus.tone === 'danger' ? 'danger' : 'warning'} 
                          className="text-3xs px-1.5 py-0"
                        >
                          {activeDescStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <Textarea
                      id="page_desc"
                      rows={3}
                      value={activePageConfig.description || ''}
                      onChange={(e) => handlePageFieldChange('description', e.target.value)}
                      placeholder="e.g. Compare 1-step and 2-step trading challenges from $10,000 to $200,000 with up to 90% profit split and static drawdown."
                      className="resize-none border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                    <p className="text-2xs text-slate-500 dark:text-muted-foreground">
                      Search snippet summary below the headline. Recommended: 120–165 characters.
                    </p>
                  </div>

                </CardContent>
              </Card>

              {/* CARD 3: ON-PAGE CONTENT BLOCKS & REAL-TIME COUNTER */}
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        On-Page Dynamic Content Blocks
                      </CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                        Directly controls the hero badge, main H1 title, and lead paragraph on the live page without code edits.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-slate-300 dark:border-border text-slate-700 dark:text-slate-300 font-mono text-2xs bg-slate-50 dark:bg-transparent">
                      Live SSR Binding
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Hero Badge Tagline */}
                  <div className="space-y-1.5">
                    <Label htmlFor="hero_badge" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Hero Badge Tagline
                    </Label>
                    <Input
                      id="hero_badge"
                      value={activePageConfig.hero_badge || ''}
                      onChange={(e) => handlePageFieldChange('hero_badge', e.target.value)}
                      placeholder="e.g. Next-Gen Proprietary Trading Infrastructure"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>

                  {/* Page H1 Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="h1_title" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Page Main Heading (H1)
                    </Label>
                    <Input
                      id="h1_title"
                      value={activePageConfig.h1_title || ''}
                      onChange={(e) => handlePageFieldChange('h1_title', e.target.value)}
                      placeholder="e.g. Select Your Funded Trading Challenge"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>

                  {/* SEO Lead Paragraph */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="lead_paragraph" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        SEO Lead Paragraph
                      </Label>
                      <span className="text-2xs text-slate-600 dark:text-slate-400 font-mono tabular-nums font-medium">
                        {wordCount} words
                      </span>
                    </div>
                    <Textarea
                      id="lead_paragraph"
                      rows={4}
                      value={activePageConfig.lead_paragraph || ''}
                      onChange={(e) => handlePageFieldChange('lead_paragraph', e.target.value)}
                      placeholder="Enter the primary introductory paragraph for this page. Weave your primary and secondary keywords naturally into the text..."
                      className="leading-relaxed border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>

                  {/* REAL-TIME KEYWORD OCCURRENCE & DENSITY ANALYTICS BAR */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-muted/60 border border-slate-200 dark:border-border space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-800 dark:text-foreground">
                        <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Lead Paragraph Keyword Density
                      </span>
                      <span className="text-2xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                        Real-time Audit
                      </span>
                    </div>

                    {/* Primary Keyword Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-surface border border-slate-200 dark:border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-slate-600 dark:text-slate-400 font-medium">Primary:</span>
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {pKw || '(None set)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {primaryOccurrences > 0 ? (
                          <Badge variant="success" className="text-3xs px-2 py-0.5 font-semibold">
                            ✓ {primaryOccurrences} Occurrence{primaryOccurrences > 1 ? 's' : ''} ({primaryDensity}% density)
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-3xs px-2 py-0.5 font-semibold">
                            ⚠️ 0 in paragraph (Add term)
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Secondary Keywords Breakdown */}
                    {secList.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-2xs text-slate-600 dark:text-slate-400 font-medium">Secondary terms in paragraph:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {secList.map((sec, i) => {
                            const c = countKeyword(leadText, sec)
                            return (
                              <span
                                key={i}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono border",
                                  c > 0
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold"
                                    : "bg-white dark:bg-surface border-slate-200 dark:border-border text-slate-600 dark:text-slate-400 font-medium"
                                )}
                              >
                                <span>{sec}</span>
                                <span className={cn(
                                  "text-3xs px-1 rounded font-bold",
                                  c > 0 ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300" : "bg-slate-100 dark:bg-surface-muted text-slate-500 dark:text-muted-foreground"
                                )}>
                                  {c}
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>

              {/* CARD 4: FAQ RICH SNIPPETS BUILDER */}
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Google FAQPage Rich Snippets ({(activePageConfig.faqs || []).length})
                      </CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                        Generate expandable accordion answers right on Google search result cards via Schema.org JSON-LD.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddFaqItem}
                      className="text-xs h-8 gap-1.5 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-transparent hover:bg-emerald-100/50 dark:hover:bg-emerald-500/10 font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add FAQ
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(activePageConfig.faqs || []).length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-300 dark:border-border rounded-xl">
                      <p className="text-xs text-slate-600 dark:text-muted-foreground mb-2">No FAQ rich snippets configured for this page.</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddFaqItem}
                        className="text-xs gap-1 font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add First FAQ
                      </Button>
                    </div>
                  ) : (
                    (activePageConfig.faqs || []).map((faq, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-muted/40 border border-slate-200 dark:border-border space-y-2 relative group">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            FAQ #{idx + 1}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFaqItem(idx)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-loss"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          value={faq.q}
                          onChange={(e) => handleUpdateFaqItem(idx, 'q', e.target.value)}
                          placeholder="Question (e.g. How does the static drawdown work?)"
                          className="text-xs font-semibold border-slate-300 dark:border-border bg-white dark:bg-surface text-slate-900 dark:text-foreground"
                        />
                        <Textarea
                          rows={2}
                          value={faq.a}
                          onChange={(e) => handleUpdateFaqItem(idx, 'a', e.target.value)}
                          placeholder="Authoritative, informative answer for Google searchers..."
                          className="text-xs resize-none leading-relaxed border-slate-300 dark:border-border bg-white dark:bg-surface text-slate-900 dark:text-foreground"
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

            </div>

            {/* RIGHT COLUMN: SERP PREVIEW & AUDIT (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* LIVE GOOGLE SERP PREVIEW */}
              <Card className="bg-surface border-border shadow-sm sticky top-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Live Google SERP Preview
                    </CardTitle>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-surface-muted p-0.5 rounded-lg border border-slate-200 dark:border-border">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          "px-2 py-1 rounded text-2xs font-medium flex items-center gap-1 transition-colors",
                          previewDevice === 'desktop' ? "bg-white dark:bg-surface text-slate-900 dark:text-foreground shadow-xs font-semibold" : "text-slate-600 dark:text-muted-foreground"
                        )}
                      >
                        <Monitor className="h-3 w-3" /> Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          "px-2 py-1 rounded text-2xs font-medium flex items-center gap-1 transition-colors",
                          previewDevice === 'mobile' ? "bg-white dark:bg-surface text-slate-900 dark:text-foreground shadow-xs font-semibold" : "text-slate-600 dark:text-muted-foreground"
                        )}
                      >
                        <Smartphone className="h-3 w-3" /> Mobile
                      </button>
                    </div>
                  </div>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    Real-time visual simulation of your search result card on Google.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Google Card Box */}
                  <div className={cn(
                    "p-4 rounded-xl border border-slate-300 dark:border-border bg-white dark:bg-zinc-950 font-sans transition-all",
                    previewDevice === 'mobile' ? "max-w-xs mx-auto shadow-md" : "w-full"
                  )}>
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 mb-1.5 text-2xs">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-3xs">
                        MF
                      </div>
                      <div className="truncate font-sans">
                        <span className="font-semibold text-[#202124] dark:text-[#bdc1c6]">{brandName}</span>
                        <span className="mx-1 text-slate-400 dark:text-zinc-500">›</span>
                        <span className="text-slate-600 dark:text-zinc-400 font-medium">{activePath === '/' ? 'index' : activePath.replace('/', '')}</span>
                      </div>
                    </div>

                    {/* Blue Title Link */}
                    <h3 className="text-base sm:text-lg font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline leading-snug cursor-pointer line-clamp-2 mb-1">
                      {finalDisplayTitle}
                    </h3>

                    {/* Meta Description */}
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed line-clamp-3">
                      {activeDesc || 'No meta description configured for this page yet.'}
                    </p>

                    {/* FAQ Rich Result Simulation */}
                    {(activePageConfig.faqs || []).length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
                        <div className="text-3xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          Google FAQ Rich Snippet Card:
                        </div>
                        {(activePageConfig.faqs || []).slice(0, 2).map((f, i) => (
                          <div key={i} className="text-2xs text-slate-700 dark:text-zinc-200 flex items-start gap-1 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">›</span>
                            <span>{f.q}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Character Length Progress Bars */}
                  <div className="space-y-3 pt-2 text-xs">
                    {/* Title Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-2xs font-mono">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Title: {activeTitle.length} / 65</span>
                        <span className={titleOptimal ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-amber-700 dark:text-amber-400 font-semibold"}>
                          {activeTitleStatus.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-surface-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all",
                            activeTitle.length > 65 ? "bg-amber-500" : activeTitle.length >= 40 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-sky-500"
                          )}
                          style={{ width: `${Math.min(100, (activeTitle.length / 65) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Description Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-2xs font-mono">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Description: {activeDesc.length} / 165</span>
                        <span className={descOptimal ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-amber-700 dark:text-amber-400 font-semibold"}>
                          {activeDescStatus.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-surface-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all",
                            activeDesc.length > 165 ? "bg-amber-500" : activeDesc.length >= 115 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-sky-500"
                          )}
                          style={{ width: `${Math.min(100, (activeDesc.length / 165) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* PAGE SEO HEALTH CHECKLIST */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-muted/50 border border-slate-200 dark:border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-foreground">Page SEO Health Score</span>
                      <Badge 
                        variant={healthScore >= 80 ? "success" : healthScore >= 50 ? "warning" : "danger"} 
                        className="font-mono text-xs px-2 py-0.5"
                      >
                        {healthScore} / 100
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-2xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasPrimaryKw ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={hasPrimaryKw ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>Primary keyword defined</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", titleOptimal ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={titleOptimal ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>Meta Title optimal (40–65 chars)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", descOptimal ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={descOptimal ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>Meta Description optimal (115–165 chars)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", titleHasKw ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={titleHasKw ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>Primary keyword inside Meta Title</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", descHasKw ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={descHasKw ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>Primary keyword inside Meta Description</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", leadHasKw ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={leadHasKw ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>Primary keyword inside Lead Paragraph</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasSecKws ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={hasSecKws ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>At least 2 Secondary / LSI keywords</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasFaqs ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600")} />
                        <span className={hasFaqs ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500"}>FAQPage rich snippets configured</span>
                      </div>
                    </div>
                  </div>

                  {/* SCHEMA.ORG BADGES */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-muted/50 border border-slate-200 dark:border-border space-y-2">
                    <div className="text-2xs font-bold text-slate-700 dark:text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Active Schema.org Structured Data
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-2xs">
                      <div className="p-2 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-between">
                        <span>Organization</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-between">
                        <span>FAQPage</span>
                        <span className={hasFaqs ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                          {hasFaqs ? '✓' : '—'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-between col-span-2">
                        <span>FinancialProduct</span>
                        <span className={activePath === '/' || activePath === '/challenges' ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                          {activePath === '/' || activePath === '/challenges' ? '✓ Active' : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: GLOBAL SEARCH SNIPPET & SERP                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="serp" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Form: Metadata */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Global Search Engine Metadata Defaults
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    These fields serve as universal fallbacks if a specific subroute does not have custom page-by-page SEO configured.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Meta Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meta_title" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Global Meta Title
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-slate-600 dark:text-slate-400 font-mono">
                          {titleLength} chars
                        </span>
                        <Badge 
                          variant={titleStatus.tone === 'success' ? 'success' : titleStatus.tone === 'danger' ? 'danger' : 'warning'} 
                          className="text-3xs px-1.5 py-0"
                        >
                          {titleStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <Input
                      id="meta_title"
                      value={form.meta_title}
                      onChange={(e) => handleChange('meta_title', e.target.value)}
                      placeholder="e.g. AlphaCapital — Trade Up to $200,000 in Funded Capital"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                    <p className="text-2xs text-slate-500 dark:text-muted-foreground">
                      Appears in the browser tab and as the main clickable headline in search results. Recommended: 50–65 characters.
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meta_description" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Global Meta Description
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-slate-600 dark:text-slate-400 font-mono">
                          {descLength} chars
                        </span>
                        <Badge 
                          variant={descStatus.tone === 'success' ? 'success' : descStatus.tone === 'danger' ? 'danger' : 'warning'} 
                          className="text-3xs px-1.5 py-0"
                        >
                          {descStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <Textarea
                      id="meta_description"
                      rows={3}
                      value={form.meta_description}
                      onChange={(e) => handleChange('meta_description', e.target.value)}
                      placeholder="e.g. Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits with AlphaCapital."
                      className="resize-none border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                    <p className="text-2xs text-slate-500 dark:text-muted-foreground">
                      Shown below the title on Google results pages. Recommended: 120–165 characters.
                    </p>
                  </div>

                  {/* Meta Keywords */}
                  <div className="space-y-1.5">
                    <Label htmlFor="meta_keywords" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Global Meta Keywords (Comma-separated)
                    </Label>
                    <Input
                      id="meta_keywords"
                      value={form.meta_keywords}
                      onChange={(e) => handleChange('meta_keywords', e.target.value)}
                      placeholder="e.g. Prop Firm, Proprietary Trading, Funded Account, Forex Prop Firm"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {form.meta_keywords.split(',').map((k) => k.trim()).filter(Boolean).map((kw, i) => (
                        <span 
                          key={i} 
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-muted border border-slate-200 dark:border-border text-2xs text-slate-800 dark:text-foreground font-mono font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Info Card */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                    Hierarchy of SEO Meta Tags
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">
                  <p>
                    1. <strong className="text-slate-800 dark:text-foreground">Page-by-Page SEO & Content</strong> tab takes top priority for specific routes (`/challenges`, `/about`, `/faq`, etc.).
                  </p>
                  <p>
                    2. If a page has not been customized individually, Next.js falls back to the <strong className="text-slate-800 dark:text-foreground">Global Search Engine Metadata Defaults</strong> configured here.
                  </p>
                  <p>
                    3. Brand suffix deduplication ensures your brand name is never duplicated in search results (`About Us | AlphaCapital | AlphaCapital`).
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: WEBMASTER & INDEXING                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="webmaster" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Webmaster Verification & Indexing
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    Verify site ownership with Google Search Console and Bing Webmaster Tools, and manage crawling permissions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-surface-muted/50 border border-slate-200 dark:border-border">
                    <div className="space-y-0.5">
                      <Label htmlFor="robots_indexing" className="text-sm font-semibold text-slate-800 dark:text-foreground">
                        Search Engine Indexing
                      </Label>
                      <p className="text-2xs text-slate-600 dark:text-muted-foreground">
                        Allow Google and Bing to crawl and index your site (`index, follow`). Disable during maintenance.
                      </p>
                    </div>
                    <Switch
                      id="robots_indexing"
                      checked={form.robots_indexing}
                      onCheckedChange={(checked) => handleChange('robots_indexing', checked)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="google_site_verification" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Google Search Console Verification Token
                    </Label>
                    <Input
                      id="google_site_verification"
                      value={form.google_site_verification}
                      onChange={(e) => handleChange('google_site_verification', e.target.value)}
                      placeholder="e.g. dBJk_vJ7gXo9r7z_K1..."
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bing_site_verification" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Bing Webmaster Tools Verification Token
                    </Label>
                    <Input
                      id="bing_site_verification"
                      value={form.bing_site_verification}
                      onChange={(e) => handleChange('bing_site_verification', e.target.value)}
                      placeholder="e.g. 84B3D4A7F1C9E..."
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    Sitemap & Robots Endpoints
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-muted/50 border border-slate-200 dark:border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-foreground">XML Sitemap</div>
                      <div className="text-2xs text-slate-500 dark:text-muted-foreground font-mono">/sitemap.xml</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy('https://massfunded.org/sitemap.xml', 'sitemap')}>
                      {copiedKey === 'sitemap' ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-muted/50 border border-slate-200 dark:border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-foreground">Robots.txt Directives</div>
                      <div className="text-2xs text-slate-500 dark:text-muted-foreground font-mono">/robots.txt</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy('https://massfunded.org/robots.txt', 'robots')}>
                      {copiedKey === 'robots' ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: SOCIAL CARDS (OG)                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="social" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-primary" />
                    Open Graph &amp; Social Card Configuration
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    Custom image and preview tags for link sharing on Twitter, Telegram, Discord, and WhatsApp.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="og_image_url" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      OpenGraph Banner Image URL (1200 x 630 px)
                    </Label>
                    <Input
                      id="og_image_url"
                      value={form.og_image_url}
                      onChange={(e) => handleChange('og_image_url', e.target.value)}
                      placeholder="/og-image.png"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-primary" />
                    Social Preview Card
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 dark:border-border overflow-hidden bg-slate-50 dark:bg-surface-muted/40">
                    <div className="h-36 bg-gradient-to-tr from-emerald-950 via-zinc-900 to-teal-950 flex items-center justify-center text-center p-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-emerald-400 font-mono">MASSFUNDED</div>
                        <div className="text-xs text-white font-semibold">Simulated Funded Capital Up to $200k</div>
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <div className="text-2xs text-slate-500 dark:text-muted-foreground uppercase font-mono">massfunded.org</div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-foreground line-clamp-1">{form.meta_title}</div>
                      <div className="text-2xs text-slate-600 dark:text-muted-foreground line-clamp-2">{form.meta_description}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: TRACKING & SCRIPTS                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Tracking Pixels &amp; Custom Head Scripts
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
                    Connect analytics and marketing conversion tracking securely without modifying source code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ga_measurement_id" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Google Analytics 4 Measurement ID
                    </Label>
                    <Input
                      id="ga_measurement_id"
                      value={form.ga_measurement_id}
                      onChange={(e) => handleChange('ga_measurement_id', e.target.value)}
                      placeholder="G-XXXXXXXXXX"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facebook_pixel_id" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Meta Pixel (Facebook) ID
                    </Label>
                    <Input
                      id="facebook_pixel_id"
                      value={form.facebook_pixel_id}
                      onChange={(e) => handleChange('facebook_pixel_id', e.target.value)}
                      placeholder="e.g. 123456789012345"
                      className="border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="custom_head_code" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Custom Header Code (&lt;head&gt; Injections)
                    </Label>
                    <Textarea
                      id="custom_head_code"
                      rows={4}
                      value={form.custom_head_code}
                      onChange={(e) => handleChange('custom_head_code', e.target.value)}
                      placeholder="<!-- Add custom script tags, Hotjar, or tracking pixels here -->"
                      className="font-mono text-xs border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                    Enterprise Security &amp; Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-muted/60 border border-slate-200 dark:border-border/60 space-y-1.5">
                    <div className="font-semibold text-slate-800 dark:text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Zero Source Code Edits</span>
                    </div>
                    <p className="text-2xs text-slate-600 dark:text-muted-foreground">
                      All settings saved here dynamically configure Next.js server-side metadata and HTML responses immediately without rebuilding or deploying source code.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-muted/60 border border-slate-200 dark:border-border/60 space-y-1.5">
                    <div className="font-semibold text-slate-800 dark:text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Trading Engine Isolation</span>
                    </div>
                    <p className="text-2xs text-slate-600 dark:text-muted-foreground">
                      SEO settings are completely isolated from the MT5 and trading calculation engines. Changes here carry zero financial risk.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* FLOATING BOTTOM SAVE BAR */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-border shadow-md">
        <div className="text-xs text-slate-600 dark:text-muted-foreground">
          Make sure to click <strong className="text-slate-900 dark:text-foreground">&quot;Save All Changes&quot;</strong> to apply your SEO settings across the entire platform.
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving || loading}
          className="flex items-center gap-2 font-semibold shrink-0"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {/* AI SUGGESTIONS PREVIEW MODAL */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-foreground">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              AI Optimized SEO &amp; Content Suggestions for {activePath}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-muted-foreground">
              Review the AI generated metadata, headings, lead paragraph, and FAQ rich snippets tailored to your target keywords.
            </DialogDescription>
          </DialogHeader>

          {aiResult && (
            <div className="space-y-4 py-2 text-xs">
              {/* Provider Badge */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-surface-muted/50 border border-slate-200 dark:border-border">
                <span className="text-2xs text-slate-600 dark:text-muted-foreground font-mono">Engine:</span>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-mono text-3xs bg-emerald-50/50 dark:bg-transparent">
                  {aiResult.provider || 'AI Engine'}
                </Badge>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <div className="font-semibold text-slate-800 dark:text-foreground">Suggested Meta Title:</div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-muted border border-slate-200 dark:border-border text-slate-900 dark:text-foreground font-mono text-2xs">
                  {aiResult.title}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="font-semibold text-slate-800 dark:text-foreground">Suggested Meta Description:</div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-muted border border-slate-200 dark:border-border text-slate-800 dark:text-foreground leading-relaxed">
                  {aiResult.description}
                </div>
              </div>

              {/* Headings */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-foreground">Hero Badge:</div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-surface-muted border border-slate-200 dark:border-border text-2xs font-medium text-slate-800 dark:text-foreground">
                    {aiResult.hero_badge}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-foreground">Page H1 Title:</div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-surface-muted border border-slate-200 dark:border-border text-2xs font-medium text-slate-800 dark:text-foreground">
                    {aiResult.h1_title}
                  </div>
                </div>
              </div>

              {/* Lead Paragraph */}
              <div className="space-y-1">
                <div className="font-semibold text-slate-800 dark:text-foreground">Suggested Lead Paragraph:</div>
                <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-500/5 border border-emerald-300 dark:border-emerald-500/20 text-slate-900 dark:text-foreground leading-relaxed">
                  {aiResult.lead_paragraph}
                </div>
              </div>

              {/* FAQs */}
              {Array.isArray(aiResult.faqs) && aiResult.faqs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-800 dark:text-foreground">Suggested FAQ Rich Snippets ({aiResult.faqs.length}):</div>
                  <div className="space-y-2">
                    {aiResult.faqs.map((f: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-muted border border-slate-200 dark:border-border space-y-1">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400">Q: {f.q}</div>
                        <div className="text-slate-600 dark:text-muted-foreground">{f.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setAiModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleApplyAiSuggestions}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <CheckCheck className="h-4 w-4" />
              Apply to {activePath}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
