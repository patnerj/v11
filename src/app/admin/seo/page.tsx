'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { 
  Search, Globe, Share2, BarChart3, Check, Copy, ExternalLink, 
  Save, Sparkles, Shield, AlertCircle, Eye, Monitor, Smartphone, 
  FileCode, CheckCircle2, Code2, RefreshCw, KeyRound, ArrowUpRight
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
import { cn } from '@/lib/cn'

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
  meta_title: 'LaunchAPropFirm — Trade Up to $200,000 in Funded Capital',
  meta_description: 'Pass the proprietary evaluation, trade live institutional liquidity up to $200,000, and keep up to 90% of your trading profits with LaunchAPropFirm.',
  meta_keywords: 'Prop Firm, Proprietary Trading, Funded Account, Forex Prop Firm, Crypto Prop Firm, Trading Challenge, LaunchAPropFirm',
  robots_indexing: true,
  google_site_verification: '',
  bing_site_verification: '',
  og_image_url: '/branding/brand_logo_600x150.png',
  ga_measurement_id: '',
  facebook_pixel_id: '',
  custom_head_code: '',
}

export default function AdminSeoPage() {
  const { branding, reload: reloadBranding } = useBranding()
  const [form, setForm] = useState<SeoFormState>(DEFAULT_SEO_STATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

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
      const payload: Record<string, any> = {
        meta_title: form.meta_title.trim(),
        meta_description: form.meta_description.trim(),
        meta_keywords: form.meta_keywords.trim(),
        robots_indexing: form.robots_indexing ? '1' : '0',
        google_site_verification: form.google_site_verification.trim(),
        bing_site_verification: form.bing_site_verification.trim(),
        og_image_url: form.og_image_url.trim(),
        ga_measurement_id: form.ga_measurement_id.trim(),
        facebook_pixel_id: form.facebook_pixel_id.trim(),
        custom_head_code: form.custom_head_code,
      }

      const res = await api.admin.whitelabelSave(payload)
      if (res.ok) {
        toast.success('SEO & Webmaster settings saved successfully!')
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

  const keywordsList = form.meta_keywords
    ? form.meta_keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : []

  const titleLength = form.meta_title.length
  const descLength = form.meta_description.length

  const getTitleStatus = () => {
    if (titleLength === 0) return { label: 'Empty', tone: 'danger' }
    if (titleLength < 40) return { label: 'Too Short (<40)', tone: 'warning' }
    if (titleLength <= 65) return { label: 'Optimal (50-65)', tone: 'success' }
    return { label: 'Too Long (>65)', tone: 'warning' }
  }

  const getDescStatus = () => {
    if (descLength === 0) return { label: 'Empty', tone: 'danger' }
    if (descLength < 120) return { label: 'Too Short (<120)', tone: 'warning' }
    if (descLength <= 165) return { label: 'Optimal (120-165)', tone: 'success' }
    return { label: 'Too Long (>165)', tone: 'warning' }
  }

  const titleStatus = getTitleStatus()
  const descStatus = getDescStatus()

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="SEO & Webmaster Tools"
        description="Configure search engine visibility, meta tags, Google Search Console, Bing Webmaster verification, social cards, and web analytics."
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

      <Tabs defaultValue="serp" className="space-y-6">
        <TabsList className="bg-surface border border-border p-1 w-full sm:w-auto flex flex-wrap gap-1">
          <TabsTrigger value="serp" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Search className="h-4 w-4" />
            <span>Search Snippet & SERP</span>
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

        {/* TAB 1: SEARCH SNIPPET & SERP */}
        <TabsContent value="serp" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Form: Metadata */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Search Engine Metadata
                  </CardTitle>
                  <CardDescription>
                    These fields determine what potential traders see when searching for your firm on Google, Bing, and DuckDuckGo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Meta Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meta_title" className="text-xs font-semibold">
                        Meta Title (Page Title Tag)
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-muted-foreground font-mono">
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
                      placeholder="e.g. LaunchAPropFirm — Trade Up to $200,000 in Funded Capital"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Appears in the browser tab and as the main clickable headline in search results. Recommended: 50–65 characters.
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meta_description" className="text-xs font-semibold">
                        Meta Description
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-muted-foreground font-mono">
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
                      placeholder="Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits."
                    />
                    <p className="text-2xs text-muted-foreground">
                      Brief summary displayed under the title in search engines. Recommended: 120–165 characters.
                    </p>
                  </div>

                  {/* Meta Keywords */}
                  <div className="space-y-1.5">
                    <Label htmlFor="meta_keywords" className="text-xs font-semibold">
                      Focus Keywords (Comma-Separated)
                    </Label>
                    <Input
                      id="meta_keywords"
                      value={form.meta_keywords}
                      onChange={(e) => handleChange('meta_keywords', e.target.value)}
                      placeholder="Prop Firm, Proprietary Trading, Funded Account, Forex, Crypto"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Used by secondary search engines, directories, and internal search indexing.
                    </p>
                    {keywordsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {keywordsList.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-2xs font-normal">
                            #{kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Live SERP Preview */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm sticky top-20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Live Google Search Card Preview
                    </CardTitle>
                    <div className="flex items-center bg-surface-muted rounded-md p-0.5 border border-border">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          'p-1 rounded text-2xs transition-colors flex items-center gap-1',
                          previewDevice === 'desktop' 
                            ? 'bg-surface text-foreground shadow-xs font-medium' 
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Desktop Preview"
                      >
                        <Monitor className="h-3 w-3" />
                        <span>Desktop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          'p-1 rounded text-2xs transition-colors flex items-center gap-1',
                          previewDevice === 'mobile' 
                            ? 'bg-surface text-foreground shadow-xs font-medium' 
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Mobile Preview"
                      >
                        <Smartphone className="h-3 w-3" />
                        <span>Mobile</span>
                      </button>
                    </div>
                  </div>
                  <CardDescription className="text-2xs">
                    Simulates how Google displays your homepage in search queries.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    'bg-white dark:bg-[#202124] p-4 rounded-xl border border-border/80 shadow-xs transition-all',
                    previewDevice === 'mobile' ? 'max-w-[340px] mx-auto' : 'w-full'
                  )}>
                    {/* SERP Site Header */}
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                        M
                      </div>
                      <div className="leading-tight overflow-hidden">
                        <div className="text-xs font-normal text-slate-800 dark:text-[#dadce0] truncate">
                          {branding.brand_name || 'LaunchAPropFirm'}
                        </div>
                        <div className="text-2xs text-slate-500 dark:text-[#bdc1c6] truncate flex items-center gap-1">
                          <span>https://launchapropfirm.com</span>
                          <span>›</span>
                          <span>home</span>
                        </div>
                      </div>
                    </div>

                    {/* Clickable SERP Title */}
                    <div className="text-base sm:text-lg font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer leading-snug line-clamp-2 mt-1">
                      {form.meta_title || 'LaunchAPropFirm — Trade Up to $200,000 in Funded Capital'}
                    </div>

                    {/* Snippet Description */}
                    <p className="text-xs text-slate-600 dark:text-[#bdc1c6] line-clamp-2 sm:line-clamp-3 mt-1.5 leading-relaxed">
                      {form.meta_description || 'Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits.'}
                    </p>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-surface-muted/60 border border-border/60 text-2xs space-y-1.5 text-muted-foreground">
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span>Pro-Tip for Maximum CTR:</span>
                    </div>
                    <p>
                      Include your key value proposition (e.g. &quot;Up to 90% Profit Split&quot;, &quot;No Time Limits&quot;) in the first 55 characters of the title.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: WEBMASTER & INDEXING */}
        <TabsContent value="webmaster" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              {/* Indexing Switch Card */}
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Search Engine Indexing Control
                  </CardTitle>
                  <CardDescription>
                    Control whether web crawlers (Googlebot, Bingbot, Yandex) are allowed to index this platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-surface-muted border border-border">
                    <div className="space-y-1 pr-4">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span>Allow Search Engine Indexing</span>
                        {form.robots_indexing ? (
                          <Badge variant="success" className="text-3xs">INDEX, FOLLOW</Badge>
                        ) : (
                          <Badge variant="danger" className="text-3xs">NOINDEX, NOFOLLOW</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {form.robots_indexing 
                          ? 'Site is public and searchable on Google and Bing.' 
                          : 'Search engines are strictly instructed not to index pages or show them in search results.'}
                      </p>
                    </div>
                    <Switch
                      checked={form.robots_indexing}
                      onCheckedChange={(checked) => handleChange('robots_indexing', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Webmaster Verification Tokens */}
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Webmaster Console Verification
                  </CardTitle>
                  <CardDescription>
                    Verify ownership of launchapropfirm.com in Google Search Console and Bing Webmaster Tools.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Google Search Console */}
                  <div className="space-y-1.5">
                    <Label htmlFor="google_site_verification" className="text-xs font-semibold flex items-center justify-between">
                      <span>Google Search Console Verification Token</span>
                      <a 
                        href="https://search.google.com/search-console" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline text-2xs flex items-center gap-1 font-normal"
                      >
                        Open Search Console <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </Label>
                    <Input
                      id="google_site_verification"
                      value={form.google_site_verification}
                      onChange={(e) => handleChange('google_site_verification', e.target.value)}
                      placeholder="e.g. uK8v_XyZ1234567890abcdefghijklmnopqrstuvwxyz"
                    />
                    <p className="text-2xs text-muted-foreground">
                      In Google Search Console, choose &quot;URL prefix&quot; → &quot;HTML tag&quot; and copy either the full tag or just the content value. It will be injected automatically into your site&apos;s &lt;head&gt;.
                    </p>
                  </div>

                  {/* Bing Webmaster Tools */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bing_site_verification" className="text-xs font-semibold flex items-center justify-between">
                      <span>Bing Webmaster Tools Verification Token</span>
                      <a 
                        href="https://www.bing.com/webmasters" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline text-2xs flex items-center gap-1 font-normal"
                      >
                        Open Bing Webmaster <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </Label>
                    <Input
                      id="bing_site_verification"
                      value={form.bing_site_verification}
                      onChange={(e) => handleChange('bing_site_verification', e.target.value)}
                      placeholder="e.g. 9B8467D2B60183F11C8DE98E9B3DA6F8"
                    />
                    <p className="text-2xs text-muted-foreground">
                      In Bing Webmaster Tools, choose HTML meta tag and paste the <code className="text-foreground">msvalidate.01</code> code.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Crawler & Discovery Endpoints */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    Live Discovery & Crawler Feeds
                  </CardTitle>
                  <CardDescription className="text-2xs">
                    Your platform automatically publishes XML sitemaps and AI discovery manifests.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {/* Sitemap */}
                  <div className="p-3 rounded-lg bg-surface-muted border border-border flex items-center justify-between">
                    <div className="overflow-hidden pr-2">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                        <span>XML Sitemap</span>
                      </div>
                      <div className="text-2xs text-muted-foreground truncate font-mono mt-0.5">
                        https://launchapropfirm.com/sitemap.xml
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCopy('https://launchapropfirm.com/sitemap.xml', 'sitemap')}
                        title="Copy URL"
                      >
                        {copiedKey === 'sitemap' ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <a href="https://launchapropfirm.com/sitemap.xml" target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="xs" title="Open in new tab">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </div>

                  {/* Robots.txt */}
                  <div className="p-3 rounded-lg bg-surface-muted border border-border flex items-center justify-between">
                    <div className="overflow-hidden pr-2">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                        <span>Robots File</span>
                      </div>
                      <div className="text-2xs text-muted-foreground truncate font-mono mt-0.5">
                        https://launchapropfirm.com/robots.txt
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCopy('https://launchapropfirm.com/robots.txt', 'robots')}
                        title="Copy URL"
                      >
                        {copiedKey === 'robots' ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <a href="https://launchapropfirm.com/robots.txt" target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="xs" title="Open in new tab">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </div>

                  {/* LLMs.txt AI Manifest */}
                  <div className="p-3 rounded-lg bg-surface-muted border border-border flex items-center justify-between">
                    <div className="overflow-hidden pr-2">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>AI Search Manifest (GEO)</span>
                      </div>
                      <div className="text-2xs text-muted-foreground truncate font-mono mt-0.5">
                        https://launchapropfirm.com/llms.txt
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCopy('https://launchapropfirm.com/llms.txt', 'llms')}
                        title="Copy URL"
                      >
                        {copiedKey === 'llms' ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <a href="https://launchapropfirm.com/llms.txt" target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="xs" title="Open in new tab">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: SOCIAL CARDS (OPENGRAPH & TWITTER) */}
        <TabsContent value="social" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-primary" />
                    OpenGraph & Social Sharing Setup
                  </CardTitle>
                  <CardDescription>
                    Customize the rich thumbnail, title, and preview shown when links to launchapropfirm.com are shared on WhatsApp, Twitter/X, Discord, Telegram, or LinkedIn.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="og_image_url" className="text-xs font-semibold">
                      Social Banner Image URL (OG Image)
                    </Label>
                    <Input
                      id="og_image_url"
                      value={form.og_image_url}
                      onChange={(e) => handleChange('og_image_url', e.target.value)}
                      placeholder="/branding/brand_logo_600x150.png"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Recommended size: 1200×630 px (1.91:1 ratio) for crisp display on Twitter and WhatsApp.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Live Social Card Preview */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Social Share Card Preview
                  </CardTitle>
                  <CardDescription className="text-2xs">
                    Simulates appearance on Twitter/X, Discord, and Telegram.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    {/* Image Banner */}
                    <div className="h-44 bg-surface-muted flex items-center justify-center border-b border-border p-4 relative overflow-hidden">
                      {form.og_image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={form.og_image_url} 
                          alt="OpenGraph Banner" 
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Share2 className="h-8 w-8 mx-auto mb-1 opacity-40" />
                          <span className="text-2xs">No banner image set</span>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 space-y-1.5">
                      <div className="text-3xs uppercase tracking-wider font-semibold text-muted-foreground">
                        LAUNCHAPROPFIRM.COM
                      </div>
                      <div className="text-sm font-semibold text-foreground line-clamp-1">
                        {form.meta_title || 'LaunchAPropFirm — Trade Up to $200,000 in Funded Capital'}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {form.meta_description || 'Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: TRACKING & SCRIPTS */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Web Analytics & Pixel Tracking
                  </CardTitle>
                  <CardDescription>
                    Connect your analytics IDs to track website visitors, challenge conversions, and marketing funnels.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Google Analytics 4 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ga_measurement_id" className="text-xs font-semibold">
                      Google Analytics 4 Measurement ID
                    </Label>
                    <Input
                      id="ga_measurement_id"
                      value={form.ga_measurement_id}
                      onChange={(e) => handleChange('ga_measurement_id', e.target.value)}
                      placeholder="G-XXXXXXXXXX"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Your Google Analytics data stream measurement ID (starts with <code className="text-foreground">G-</code>).
                    </p>
                  </div>

                  {/* Facebook / Meta Pixel */}
                  <div className="space-y-1.5">
                    <Label htmlFor="facebook_pixel_id" className="text-xs font-semibold">
                      Meta (Facebook) Pixel ID
                    </Label>
                    <Input
                      id="facebook_pixel_id"
                      value={form.facebook_pixel_id}
                      onChange={(e) => handleChange('facebook_pixel_id', e.target.value)}
                      placeholder="e.g. 123456789012345"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Used to track Facebook ads, retargeting, and challenge checkout purchases.
                    </p>
                  </div>

                  {/* Custom Head Script Injection */}
                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="custom_head_code" className="text-xs font-semibold flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-primary" />
                      <span>Custom &lt;head&gt; Scripts &amp; Tracking Codes</span>
                    </Label>
                    <Textarea
                      id="custom_head_code"
                      rows={5}
                      className="font-mono text-xs"
                      value={form.custom_head_code}
                      onChange={(e) => handleChange('custom_head_code', e.target.value)}
                      placeholder="<!-- Google Tag Manager, Hotjar, or Trustpilot script -->&#10;<script>...</script>"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Injected securely into the HTML &lt;head&gt; on public marketing pages. Safe for Google Tag Manager, Trustpilot reviews, or live chat snippets.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Information Card */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-profit" />
                    Enterprise Security & Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                  <div className="p-3 rounded-lg bg-surface-muted/60 border border-border/60 space-y-1.5">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                      <span>Zero Source Code Edits</span>
                    </div>
                    <p className="text-2xs">
                      All settings saved here dynamically configure Next.js server-side metadata and HTML responses immediately without rebuilding or deploying source code.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-muted/60 border border-border/60 space-y-1.5">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                      <span>Trading Engine Isolation</span>
                    </div>
                    <p className="text-2xs">
                      SEO settings are completely isolated from the MT5 and trading calculation engines. Changes here carry zero financial risk.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating Save Bar on Bottom for Mobile & Desktop */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border shadow-md">
        <div className="text-xs text-muted-foreground">
          Make sure to click <strong className="text-foreground">&quot;Save All Changes&quot;</strong> to apply your SEO settings across the entire platform.
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
    </div>
  )
}
