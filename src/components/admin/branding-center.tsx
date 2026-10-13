'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { useBranding } from '@/store/branding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  UploadCloud,
  RotateCcw,
  ImageIcon,
  Info,
  Palette,
  Type,
  Check,
  Sparkles,
  Layers,
  BarChart3,
  Globe,
  CheckCircle2,
  Play,
  Instagram,
  Music2,
  MessageSquare,
  Facebook,
  Wrench,
} from 'lucide-react'
import { DeviceFrameMockup } from '@/components/admin/device-frame-mockup'
import { THEME_PRESETS, FONT_PRESETS, applyThemeAccent, applyFontFamily } from '@/lib/theme-accent'
import { cn } from '@/lib/cn'

type AssetField = 'logo' | 'login_logo' | 'sidebar_icon' | 'favicon'
interface AssetMeta {
  field: AssetField
  key: string
  title: string
  size: string
  format: string
  helper: string
}

const ASSETS: AssetMeta[] = [
  {
    field: 'sidebar_icon',
    key: 'sidebar_icon_url',
    title: 'Sidebar Icon',
    size: '128×128 px',
    format: 'PNG / WebP / SVG',
    helper: 'Square mark shown in the dashboard sidebar, rendered at 40px. High-contrast transparent mark recommended.',
  },
  {
    field: 'login_logo',
    key: 'login_logo_url',
    title: 'Login Logo',
    size: '≥320×80 px',
    format: 'PNG / SVG',
    helper: 'Horizontal logo on login screen, rendered ~36px tall. Transparent background stays sharp.',
  },
  {
    field: 'logo',
    key: 'logo_url',
    title: 'Brand Logo (Web & Email)',
    size: '≥400 px wide',
    format: 'PNG / SVG',
    helper: 'Horizontal logo for public header and email templates, rendered 160–200px wide.',
  },
  {
    field: 'favicon',
    key: 'favicon_url',
    title: 'Browser Favicon',
    size: '48×48 px',
    format: 'ICO / SVG / PNG',
    helper: 'Browser-tab icon rendered at 32×32. Use high-contrast square mark for clear visibility.',
  },
]

const DEFAULTS: Record<string, string> = {
  brand_name: 'LaunchAPropFirm',
  brand_tagline: 'Institutional High-Frequency Prop Trading',
  accent_color: '#10B981',
  primary_color: '#10B981',
  font_family: 'poppins',
  logo_url: '/branding/brand_logo_600x150.png',
  login_logo_url: '/branding/login_logo_400x100.png',
  sidebar_icon_url: '/branding/sidebar_icon_128x128.png',
  favicon_url: '/favicon.svg',
  ga_measurement_id: '',
  facebook_pixel_id: '',
  google_site_verification: '',
  youtube_url: '#',
  instagram_url: 'https://www.instagram.com/yourswebsitemaker/',
  tiktok_url: '#',
  facebook_url: '#',
  discord_url: '#',
  developer_url: '',
}

export function BrandingCenter() {
  const setLive = useBranding((s) => s.set)
  const reloadBranding = useBranding((s) => s.reload)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [uploading, setUploading] = useState<AssetField | null>(null)

  useEffect(() => {
    api.admin.whitelabelGet().then((res) => {
      if (res.ok) setVals(res.data as Record<string, string>)
      setLoaded(true)
    })
  }, [])

  const set = (k: string, v: string) => {
    setVals((p) => ({ ...p, [k]: v }))
    // Reflect immediately in the live preview store (sidebar/login update instantly).
    setLive({ [k]: v } as Partial<import('@/store/branding').Branding>)
  }

  const handlePaletteSelect = (presetColor: string) => {
    set('accent_color', presetColor)
    set('primary_color', presetColor)
    applyThemeAccent(presetColor, { persist: true })
  }

  const handleFontSelect = (fontId: string) => {
    set('font_family', fontId)
    applyFontFamily(fontId, { persist: true })
  }

  const save = async () => {
    setSaving(true)
    const effectiveAccent = vals.accent_color || vals.primary_color || '#10B981'
    const payload: Record<string, string> = {
      brand_name: vals.brand_name ?? '',
      brand_tagline: vals.brand_tagline ?? '',
      support_email: vals.support_email ?? '',
      accent_color: effectiveAccent,
      primary_color: effectiveAccent,
      font_family: vals.font_family ?? 'poppins',
      logo_url: vals.logo_url ?? '',
      login_logo_url: vals.login_logo_url ?? '',
      sidebar_icon_url: vals.sidebar_icon_url ?? '',
      favicon_url: vals.favicon_url ?? '',
      ga_measurement_id: vals.ga_measurement_id ?? '',
      facebook_pixel_id: vals.facebook_pixel_id ?? '',
      google_site_verification: vals.google_site_verification ?? '',
      youtube_url: vals.youtube_url ?? '#',
      instagram_url: vals.instagram_url ?? 'https://www.instagram.com/yourswebsitemaker/',
      tiktok_url: vals.tiktok_url ?? '#',
      facebook_url: vals.facebook_url ?? '#',
      discord_url: vals.discord_url ?? '#',
      developer_url: vals.developer_url ?? '',
    }
    const res = await api.admin.whitelabelSave(payload)
    setSaving(false)
    if (res.ok) {
      invalidateFxsim('/admin/whitelabel')
      await reloadBranding()
      applyThemeAccent(effectiveAccent, { persist: true })
      if (vals.font_family) applyFontFamily(vals.font_family, { persist: true })
      toast.success('Branding saved successfully')
    } else {
      toast.error(res.ok ? 'Save failed' : res.error)
    }
  }

  const handleConfirmReset = async () => {
    setResetting(true)
    try {
      setVals((p) => ({ ...p, ...DEFAULTS }))
      setLive(DEFAULTS as Partial<import('@/store/branding').Branding>)
      const res = await api.admin.whitelabelSave(DEFAULTS)
      if (res.ok) {
        invalidateFxsim('/admin/whitelabel')
        await reloadBranding()
        applyThemeAccent(DEFAULTS.accent_color, { persist: true })
        applyFontFamily(DEFAULTS.font_family, { persist: true })
        toast.success('Branding reset to defaults')
      } else {
        toast.error(res.ok ? 'Reset failed' : res.error)
      }
    } finally {
      setResetting(false)
      setIsResetConfirmOpen(false)
    }
  }

  const brand = vals.brand_name || 'Alpha Capital'
  const effectiveAccent = vals.accent_color || vals.primary_color || '#10B981'
  const activeFontId = (vals.font_family || 'poppins').toLowerCase()

  if (!loaded) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-text-muted">Loading branding…</CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* =========================================================================
          LEFT COLUMN: BRANDING CONTROLS & SETTINGS (xl:col-span-7)
      ========================================================================= */}
      <div className="xl:col-span-7 space-y-6">
        {/* Card 1: Identity & Typography Presets */}
        <Card className="border-border bg-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-text">
              <Sparkles className="h-4 w-4 text-accent" /> Institutional Theme &amp; Identity
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              disabled={resetting}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Defaults
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Identity Text Inputs */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bc-name">Company name</Label>
                <Input
                  id="bc-name"
                  value={vals.brand_name ?? ''}
                  onChange={(e) => set('brand_name', e.target.value)}
                  placeholder="Your Prop Firm"
                />
                <p className="text-2xs text-text-faint">Displayed across sidebar, portal header, and emails.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bc-tagline">Tagline / Slogan</Label>
                <Input
                  id="bc-tagline"
                  value={vals.brand_tagline ?? ''}
                  onChange={(e) => set('brand_tagline', e.target.value)}
                  placeholder="The Funded Trader Platform"
                />
                <p className="text-2xs text-text-faint">Displayed on hero cards, meta tags, and portal badges.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bc-accent" className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-accent" />
                  Primary Brand Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="bc-accent-picker"
                    type="color"
                    value={effectiveAccent}
                    onChange={(e) => {
                      set('accent_color', e.target.value)
                      set('primary_color', e.target.value)
                      applyThemeAccent(e.target.value, { persist: true })
                    }}
                    className="h-9 w-10 p-0.5 rounded-lg border border-border bg-surface cursor-pointer shrink-0"
                  />
                  <Input
                    id="bc-accent"
                    value={effectiveAccent}
                    onChange={(e) => {
                      set('accent_color', e.target.value)
                      set('primary_color', e.target.value)
                      applyThemeAccent(e.target.value, { persist: true })
                    }}
                    placeholder="#10B981"
                    className="font-mono text-xs uppercase"
                  />
                </div>
                <p className="text-2xs text-text-faint">Buttons, badges, active tabs, and chart highlights.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bc-support">Support Email</Label>
                <Input
                  id="bc-support"
                  type="email"
                  value={vals.support_email ?? ''}
                  onChange={(e) => set('support_email', e.target.value)}
                  placeholder="support@yourfirm.com"
                />
                <p className="text-2xs text-text-faint">Used in support tickets, notifications, and portal footers.</p>
              </div>
            </div>

            {/* Instant Color Presets Swatches */}
            <div className="rounded-xl border border-border-subtle bg-surface-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-accent" />
                  Curated Institutional Palettes
                </div>
                <span className="text-3xs font-mono text-text-faint uppercase">1-Click Harmonize</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THEME_PRESETS.map((p) => {
                  const isSelected = effectiveAccent.toLowerCase() === p.primary.toLowerCase()
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePaletteSelect(p.primary)}
                      className={cn(
                        'group flex items-center gap-2 p-2 rounded-lg border text-left transition-all',
                        isSelected
                          ? 'border-accent bg-accent/10 shadow-xs'
                          : 'border-border-subtle bg-surface hover:border-border hover:bg-surface-muted/40'
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/20 shrink-0 shadow-xs flex items-center justify-center"
                        style={{ backgroundColor: p.primary }}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-2xs font-semibold text-text truncate">{p.name}</div>
                        <div className="text-3xs font-mono text-text-faint uppercase">{p.primary}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Instant Typography Presets */}
            <div className="rounded-xl border border-border-subtle bg-surface-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-accent" />
                  Platform Typography Presets (Rule 88)
                </div>
                <span className="text-3xs font-mono text-text-faint uppercase">Live Dynamic Font</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FONT_PRESETS.map((f) => {
                  const isSelected = activeFontId === f.id.toLowerCase()
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFontSelect(f.id)}
                      className={cn(
                        'flex flex-col p-2.5 rounded-lg border text-left transition-all',
                        isSelected
                          ? 'border-accent bg-accent/10 shadow-xs'
                          : 'border-border-subtle bg-surface hover:border-border hover:bg-surface-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text truncate">{f.name}</span>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />}
                      </div>
                      <span className="text-3xs text-text-muted mt-0.5 truncate">{f.category}</span>
                      <span className="text-2xs text-text-faint font-medium mt-1 truncate" style={{ fontFamily: f.cssVar }}>
                        Aa Bb 123
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Smart Asset Uploads (Dropzones with Dimension Hints) */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-text">
              <Layers className="h-4 w-4 text-accent" /> Smart Asset Uploads &amp; Dropzones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {ASSETS.map((a) => (
                <AssetTile
                  key={a.field}
                  asset={a}
                  url={vals[a.key] ?? ''}
                  uploading={uploading === a.field}
                  onUpload={async (file) => {
                    setUploading(a.field)
                    const res = await api.admin.brandingUpload(a.field, file)
                    setUploading(null)
                    if (res.ok) {
                      set(a.key, res.data.url)
                      toast.success(`${a.title} uploaded successfully`)
                      invalidateFxsim('/branding')
                    } else {
                      toast.error(res.ok ? 'Upload failed' : res.error)
                    }
                  }}
                  onUrl={(v) => set(a.key, v)}
                  onClear={() => set(a.key, '')}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Analytics & Conversion Telemetry (GA4, Meta, GSC) */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-text">
              <BarChart3 className="h-4 w-4 text-accent" /> Analytics, Meta Pixel &amp; Search Console
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GA4 */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted/20 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-text flex items-center gap-2">
                    <span>📊</span> Google Analytics 4 (GA4) Tracking
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">
                    Track visits, checkout conversions, and trader funnels.
                  </p>
                </div>
                {vals.ga_measurement_id ? (
                  <span className="inline-flex items-center gap-1.5 text-3xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active: {vals.ga_measurement_id}
                  </span>
                ) : (
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-border w-fit">
                    Inactive
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-ga-id">Measurement ID</Label>
                <Input
                  id="bc-ga-id"
                  value={vals.ga_measurement_id ?? ''}
                  onChange={(e) => set('ga_measurement_id', e.target.value.trim().toUpperCase())}
                  placeholder="G-XXXXXXXXXX"
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            {/* Meta Pixel */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted/20 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-text flex items-center gap-2">
                    <span>🎯</span> Meta (Facebook) Pixel Tracking
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">
                    Track campaign conversions via Meta Ads Manager.
                  </p>
                </div>
                {vals.facebook_pixel_id ? (
                  <span className="inline-flex items-center gap-1.5 text-3xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Active: {vals.facebook_pixel_id}
                  </span>
                ) : (
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-border w-fit">
                    Inactive
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-fb-pixel">Pixel ID</Label>
                <Input
                  id="bc-fb-pixel"
                  value={vals.facebook_pixel_id ?? ''}
                  onChange={(e) => set('facebook_pixel_id', e.target.value.trim())}
                  placeholder="1114425831025183"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Google Search Console */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted/20 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-text flex items-center gap-2">
                    <span>🔍</span> Google Search Console (GSC) Verification
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">
                    Verify site ownership to monitor indexing and search impressions.
                  </p>
                </div>
                {vals.google_site_verification ? (
                  <span className="inline-flex items-center gap-1.5 text-3xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Verified
                  </span>
                ) : (
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-border w-fit">
                    Not Configured
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-gsc-code">Verification Token</Label>
                <Input
                  id="bc-gsc-code"
                  value={vals.google_site_verification ?? ''}
                  onChange={(e) => set('google_site_verification', e.target.value.trim())}
                  placeholder="Paste GSC verification token or content string"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Social Desks */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-text">
              <Globe className="h-4 w-4 text-accent" /> Official Channels &amp; Developer Desks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bc-youtube" className="text-2xs flex items-center gap-1.5">
                  <Play className="h-3 w-3 text-red-500 fill-red-500" /> YouTube
                </Label>
                <Input
                  id="bc-youtube"
                  value={vals.youtube_url ?? ''}
                  onChange={(e) => set('youtube_url', e.target.value.trim())}
                  placeholder="https://youtube.com/@YourFirm"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-instagram" className="text-2xs flex items-center gap-1.5">
                  <Instagram className="h-3 w-3 text-pink-500" /> Instagram
                </Label>
                <Input
                  id="bc-instagram"
                  value={vals.instagram_url ?? ''}
                  onChange={(e) => set('instagram_url', e.target.value.trim())}
                  placeholder="https://instagram.com/yourfirm"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-tiktok" className="text-2xs flex items-center gap-1.5">
                  <Music2 className="h-3 w-3 text-cyan-400" /> TikTok
                </Label>
                <Input
                  id="bc-tiktok"
                  value={vals.tiktok_url ?? ''}
                  onChange={(e) => set('tiktok_url', e.target.value.trim())}
                  placeholder="https://tiktok.com/@yourfirm"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-discord" className="text-2xs flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-indigo-400" /> Discord
                </Label>
                <Input
                  id="bc-discord"
                  value={vals.discord_url ?? ''}
                  onChange={(e) => set('discord_url', e.target.value.trim())}
                  placeholder="https://discord.gg/yourserver"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-facebook" className="text-2xs flex items-center gap-1.5">
                  <Facebook className="h-3 w-3 text-blue-500" /> Facebook
                </Label>
                <Input
                  id="bc-facebook"
                  value={vals.facebook_url ?? ''}
                  onChange={(e) => set('facebook_url', e.target.value.trim())}
                  placeholder="https://facebook.com/yourfirm"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-developer" className="text-2xs text-accent font-semibold flex items-center gap-1.5">
                  <Wrench className="h-3 w-3 text-accent" /> Platform Developer Desk
                </Label>
                <Input
                  id="bc-developer"
                  value={vals.developer_url ?? ''}
                  onChange={(e) => set('developer_url', e.target.value.trim())}
                  placeholder="https://launchapropfirm.com"
                  className="text-xs border-accent/40"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Button Footer */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-2xs text-text-faint">
            Edits update the live preview instantly. Click Save to persist platform-wide.
          </p>
          <Button onClick={save} loading={saving} className="px-6">
            Save Platform Branding
          </Button>
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: STICKY REAL-TIME LIVE PREVIEW CANVAS (xl:col-span-5)
      ========================================================================= */}
      <div className="xl:col-span-5 xl:sticky xl:top-20 space-y-4">
        {/* Device Preview Mockup Frame */}
        <DeviceFrameMockup
          brandName={vals.brand_name || 'Alpha Capital'}
          brandTagline={vals.brand_tagline || 'The Funded Trader Platform'}
          logoUrl={vals.logo_url || vals.login_logo_url}
          sidebarIconUrl={vals.sidebar_icon_url}
          accentColor={effectiveAccent}
        />

        {/* Real-time Asset Component Previews */}
        <Card className="border-border bg-surface">
          <CardHeader className="py-2.5 px-4 border-b border-border-subtle flex flex-row items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">
              Live Component Micro-Previews
            </span>
            <span className="text-3xs font-mono text-accent">Active Theme Sync</span>
          </CardHeader>

          <CardContent className="p-3 space-y-3">
            {/* Sidebar View */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {vals.sidebar_icon_url ? (
                  <img
                    src={vals.sidebar_icon_url}
                    alt={brand}
                    className="h-8 w-8 rounded-lg object-contain bg-surface-muted/60 p-0.5 border border-border-subtle shrink-0"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-xs"
                    style={{ backgroundColor: effectiveAccent }}
                  >
                    {brand.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text truncate">{brand}</div>
                  <div className="text-3xs text-text-faint truncate">Sidebar Brand Identity</div>
                </div>
              </div>
              <span
                className="px-2 py-0.5 rounded text-3xs font-bold uppercase shrink-0"
                style={{ backgroundColor: `${effectiveAccent}20`, color: effectiveAccent }}
              >
                PRO
              </span>
            </div>

            {/* Login Screen Header */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {vals.login_logo_url || vals.logo_url ? (
                  <img
                    src={vals.login_logo_url || vals.logo_url}
                    alt={brand}
                    className="h-7 w-auto max-w-[120px] object-contain shrink-0"
                  />
                ) : (
                  <span className="text-xs font-bold text-text truncate">{brand}</span>
                )}
                <div className="text-3xs text-text-faint truncate">Portal Login Header</div>
              </div>
              <span className="text-3xs text-text-muted font-mono">auth/login</span>
            </div>

            {/* Email Header Preview */}
            <div className="rounded-lg border border-border-subtle bg-white p-2.5 flex items-center justify-between text-gray-900">
              <div className="flex items-center gap-2.5 min-w-0">
                {vals.logo_url ? (
                  <img
                    src={vals.logo_url}
                    alt={brand}
                    className="h-6 w-auto max-w-[120px] object-contain shrink-0"
                  />
                ) : (
                  <span className="text-xs font-bold text-gray-900 truncate">{brand}</span>
                )}
                <div className="text-3xs text-gray-500 truncate">Outgoing Email Header</div>
              </div>
              <span className="text-3xs text-gray-400 font-mono">noreply@firm.com</span>
            </div>

            {/* Guidance Tips */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-text">
                <Info className="h-3 w-3 text-accent" /> Production Asset Guidelines
              </div>
              <ul className="text-3xs text-text-muted space-y-0.5">
                <li>• Transparent PNG or vector SVG files ensure crisp rendering on retina displays.</li>
                <li>• Brand accent is isolated from PnL profit (#10B981) and loss (#EF4444) invariants.</li>
                <li>• Selected typography hydrates on first-paint via Google Fonts CDN without layout shift.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset Branding to Defaults"
        description="Are you sure you want to restore default branding? This will reset company name, slogan, accent colors, typography, logos, and telemetry tokens to factory defaults."
        confirmText="Reset Branding"
        isDestructive={true}
        loading={resetting}
      />
    </div>
  )
}

function AssetTile({
  asset,
  url,
  uploading,
  onUpload,
  onUrl,
  onClear,
}: {
  asset: AssetMeta
  url: string
  uploading: boolean
  onUpload: (f: File) => void
  onUrl: (v: string) => void
  onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'rounded-xl border p-3.5 space-y-2.5 transition-all bg-surface',
        isDragOver
          ? 'border-accent bg-accent/5 ring-1 ring-accent'
          : 'border-border-subtle hover:border-border'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-text">{asset.title}</div>
        <div className="flex items-center gap-1.5">
          <span className="text-3xs font-mono text-text-faint px-1.5 py-0.5 rounded bg-surface-muted/60 border border-border-subtle">
            {asset.size}
          </span>
          {url ? (
            <span className="text-3xs font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Live
            </span>
          ) : (
            <span className="text-3xs text-text-faint bg-surface-muted px-1.5 py-0.5 rounded">
              Empty
            </span>
          )}
        </div>
      </div>

      <div
        onClick={() => ref.current?.click()}
        className="h-18 rounded-lg bg-surface-muted/40 border border-dashed border-border-subtle hover:border-border cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-colors group"
      >
        {url ? (
          <img
            src={url}
            alt={asset.title}
            className="max-h-14 max-w-full object-contain group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-text-faint group-hover:text-text-muted transition-colors">
            <UploadCloud className="h-4 w-4" />
            <span className="text-3xs font-medium">Click or drag file here ({asset.format})</span>
          </div>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          if (ref.current) ref.current.value = ''
        }}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-2xs h-7"
          loading={uploading}
          onClick={() => ref.current?.click()}
        >
          <UploadCloud className="h-3 w-3 mr-1" /> Upload
        </Button>
        {url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-2xs h-7 text-text-faint hover:text-loss"
          >
            Clear
          </Button>
        )}
      </div>

      <Input
        value={url}
        onChange={(e) => onUrl(e.target.value)}
        placeholder="…or paste image URL directly"
        className="text-2xs h-7"
      />
      <p className="text-3xs text-text-faint leading-relaxed">{asset.helper}</p>
    </div>
  )
}
