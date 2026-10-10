'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { useBranding } from '@/store/branding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UploadCloud, RotateCcw, ImageIcon, Info, Palette } from 'lucide-react'
import { DeviceFrameMockup } from '@/components/admin/device-frame-mockup'

type AssetField = 'logo' | 'login_logo' | 'sidebar_icon' | 'favicon'
const ASSETS: { field: AssetField; key: string; title: string; size: string; helper: string }[] = [
  { field: 'sidebar_icon', key: 'sidebar_icon_url', title: 'Sidebar Icon',           size: 'upload 128×128 px',  helper: 'Square mark shown in the dashboard sidebar (expanded and collapsed), rendered at 40px. Upload at 128×128 for a crisp result on high-resolution screens. Transparent PNG/WebP recommended.' },
  { field: 'login_logo',   key: 'login_logo_url',   title: 'Login Logo',              size: 'upload ≥320×80 px',  helper: 'Horizontal logo on the login screen, rendered ~36px tall. Upload at least 320×80 px (transparent PNG/SVG) so it stays sharp.' },
  { field: 'logo',         key: 'logo_url',         title: 'Brand Logo (web & email)',size: 'upload ≥400 px wide', helper: 'Horizontal logo used in the marketing site header and email headers, rendered 160–200px wide. Upload ≥400px wide for retina/email clients. Transparent background works best.' },
  { field: 'favicon',      key: 'favicon_url',      title: 'Favicon',                 size: 'upload 48×48 px',    helper: 'Square browser-tab icon, rendered at 32×32. Upload a 48×48 (or 64×64) high-contrast square mark — not the full horizontal logo — for clear visibility.' },
]

const DEFAULTS: Record<string, string> = {
  brand_name: 'LaunchAPropFirm', brand_tagline: 'Institutional High-Frequency Prop Trading',
  accent_color: '#10B981',
  logo_url: '/branding/brand_logo_600x150.png', login_logo_url: '/branding/login_logo_400x100.png', sidebar_icon_url: '/branding/sidebar_icon_128x128.png', favicon_url: '/favicon.svg',
  ga_measurement_id: 'G-G5758RZV7E',
  facebook_pixel_id: '',
  google_site_verification: '',
  youtube_url: 'https://www.youtube.com/@LaunchAPropFirm',
  instagram_url: 'https://www.instagram.com/launchapropfirm/',
  tiktok_url: 'https://www.tiktok.com/@launchapropfirm.com',
  facebook_url: 'https://www.facebook.com/profile.php?id=61591803448831',
  discord_url: 'https://discord.com/channels/1555893909496799312/1555893997103484969',
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

  const save = async () => {
    setSaving(true)
    const payload: Record<string, string> = {
      brand_name: vals.brand_name ?? '', brand_tagline: vals.brand_tagline ?? '',
      support_email: vals.support_email ?? '',
      accent_color: vals.accent_color ?? '#10B981',
      logo_url: vals.logo_url ?? '', login_logo_url: vals.login_logo_url ?? '',
      sidebar_icon_url: vals.sidebar_icon_url ?? '', favicon_url: vals.favicon_url ?? '',
      ga_measurement_id: vals.ga_measurement_id ?? 'G-G5758RZV7E',
      facebook_pixel_id: vals.facebook_pixel_id ?? '',
      google_site_verification: vals.google_site_verification ?? '',
      youtube_url: vals.youtube_url ?? 'https://www.youtube.com/@LaunchAPropFirm',
      instagram_url: vals.instagram_url ?? 'https://www.instagram.com/launchapropfirm/',
      tiktok_url: vals.tiktok_url ?? 'https://www.tiktok.com/@launchapropfirm.com',
      facebook_url: vals.facebook_url ?? 'https://www.facebook.com/profile.php?id=61591803448831',
      discord_url: vals.discord_url ?? 'https://discord.com/channels/1555893909496799312/1555893997103484969',
      developer_url: vals.developer_url ?? '',
    }
    const res = await api.admin.whitelabelSave(payload)
    setSaving(false)
    if (res.ok) { invalidateFxsim('/admin/whitelabel'); await reloadBranding(); toast.success('Branding saved') }
    else toast.error(res.ok ? 'Save failed' : res.error)
  }

  const handleConfirmReset = async () => {
    setResetting(true)
    try {
      setVals((p) => ({ ...p, ...DEFAULTS }))
      setLive(DEFAULTS as Partial<import('@/store/branding').Branding>)
      const res = await api.admin.whitelabelSave(DEFAULTS)
      if (res.ok) { invalidateFxsim('/admin/whitelabel'); await reloadBranding(); toast.success('Branding reset to default') }
      else toast.error(res.ok ? 'Reset failed' : res.error)
    } finally {
      setResetting(false)
      setIsResetConfirmOpen(false)
    }
  }

  const brand = vals.brand_name || 'Alpha Capital'

  if (!loaded) return <Card><CardContent className="p-6 text-sm text-text-muted">Loading branding…</CardContent></Card>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-accent" /> Branding Center</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setIsResetConfirmOpen(true)} disabled={resetting}>
          <RotateCcw className="h-4 w-4" /> Reset to default
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identity */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bc-name">Company name</Label>
            <Input id="bc-name" value={vals.brand_name ?? ''} onChange={(e) => set('brand_name', e.target.value)} placeholder="Your Prop Firm" />
            <p className="text-2xs text-text-faint">Short names display better in the sidebar.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-tagline">Tagline / Slogan</Label>
            <Input id="bc-tagline" value={vals.brand_tagline ?? ''} onChange={(e) => set('brand_tagline', e.target.value)} placeholder="The Funded Trader Platform" />
            <p className="text-2xs text-text-faint">Displayed on portals, emails and headers.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-accent" className="flex items-center gap-1.5">
              <Palette className="h-3 w-3 text-accent" />
              Primary Brand Color
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="bc-accent-picker"
                type="color"
                value={vals.accent_color || '#10B981'}
                onChange={(e) => set('accent_color', e.target.value)}
                className="h-9 w-10 p-0.5 rounded-lg border border-border bg-surface cursor-pointer shrink-0"
              />
              <Input
                id="bc-accent"
                value={vals.accent_color ?? '#10B981'}
                onChange={(e) => set('accent_color', e.target.value)}
                placeholder="#10B981"
                className="font-mono text-xs uppercase"
              />
            </div>
            <p className="text-2xs text-text-faint">Buttons, badges, and equity chart highlights.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-support">Support email</Label>
            <Input id="bc-support" type="email" value={vals.support_email ?? ''} onChange={(e) => set('support_email', e.target.value)} placeholder="support@yourfirm.com" />
            <p className="text-2xs text-text-faint">Used in emails and support links across the platform.</p>
          </div>
        </div>

        {/* Analytics & Tracking (GA4 & Meta Pixel) */}
        <div className="rounded-lg border border-border-subtle bg-surface-muted/20 p-4 space-y-4">
          {/* GA4 */}
          <div className="space-y-3 pb-3 border-b border-border-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text flex items-center gap-2">
                  <span className="text-base">📊</span> Google Analytics 4 (GA4) Tracking
                </div>
                <p className="text-2xs text-text-muted mt-0.5">
                  Configure your Google Analytics Measurement ID to track trader visits, page views, signups, and checkout conversions.
                </p>
              </div>
              {vals.ga_measurement_id ? (
                <span className="inline-flex items-center gap-1.5 text-2xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active: {vals.ga_measurement_id}
                </span>
              ) : (
                <span className="text-2xs font-mono px-2.5 py-1 rounded-full bg-surface-muted text-text-muted border border-border w-fit">
                  Inactive
                </span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="bc-ga-id">Measurement ID</Label>
                <Input
                  id="bc-ga-id"
                  value={vals.ga_measurement_id ?? ''}
                  onChange={(e) => set('ga_measurement_id', e.target.value.trim().toUpperCase())}
                  placeholder="G-G5758RZV7E"
                  className="font-mono text-xs uppercase tracking-wider"
                />
                <p className="text-2xs text-text-faint">
                  Format: <code>G-XXXXXXXXXX</code> (Found in Google Analytics → Admin → Data Streams).
                </p>
              </div>
              <div className="rounded-md bg-surface border border-border-subtle p-3 flex flex-col justify-center">
                <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1">Telemetry Status</div>
                <div className="text-xs text-text font-mono flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${vals.ga_measurement_id ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {vals.ga_measurement_id
                    ? 'Injected via Next.js Layout Script'
                    : 'Enter Measurement ID and click Save Branding'}
                </div>
              </div>
            </div>
          </div>

          {/* Meta (Facebook) Pixel */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text flex items-center gap-2">
                  <span className="text-base">🎯</span> Meta (Facebook) Pixel Tracking
                </div>
                <p className="text-2xs text-text-muted mt-0.5">
                  Track trader visits, page views, and ad campaign conversion optimization via Meta Events Manager.
                </p>
              </div>
              {vals.facebook_pixel_id ? (
                <span className="inline-flex items-center gap-1.5 text-2xs font-mono px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Active: {vals.facebook_pixel_id}
                </span>
              ) : (
                <span className="text-2xs font-mono px-2.5 py-1 rounded-full bg-surface-muted text-text-muted border border-border w-fit">
                  Inactive
                </span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="bc-fb-pixel">Pixel ID</Label>
                <Input
                  id="bc-fb-pixel"
                  value={vals.facebook_pixel_id ?? ''}
                  onChange={(e) => set('facebook_pixel_id', e.target.value.trim())}
                  placeholder="1114425831025183"
                  className="font-mono text-xs tracking-wider"
                />
                <p className="text-2xs text-text-faint">
                  Numeric Pixel ID provided in Meta Ads Manager / Events Manager.
                </p>
              </div>
              <div className="rounded-md bg-surface border border-border-subtle p-3 flex flex-col justify-center">
                <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1">Pixel Status</div>
                <div className="text-xs text-text font-mono flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${vals.facebook_pixel_id ? 'bg-blue-400' : 'bg-amber-500'}`} />
                  {vals.facebook_pixel_id
                    ? 'Injected via Next.js Layout Script (connect.facebook.net)'
                    : 'Enter Pixel ID and click Save Branding'}
                </div>
              </div>
            </div>
          </div>

          {/* Google Search Console (GSC) Verification */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text flex items-center gap-2">
                  <span className="text-base">🔍</span> Google Search Console (GSC)
                </div>
                <p className="text-2xs text-text-muted mt-0.5">
                  Verify domain ownership in Google Search Console to index pages, monitor impressions, and submit sitemaps.
                </p>
              </div>
              {vals.google_site_verification ? (
                <span className="inline-flex items-center gap-1.5 text-2xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Verified / Active
                </span>
              ) : (
                <span className="text-2xs font-mono px-2.5 py-1 rounded-full bg-surface-muted text-text-muted border border-border w-fit">
                  Not Configured
                </span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="bc-gsc-code">Verification Token / HTML Tag</Label>
                <Input
                  id="bc-gsc-code"
                  value={vals.google_site_verification ?? ''}
                  onChange={(e) => set('google_site_verification', e.target.value.trim())}
                  placeholder="e.g. google-site-verification token or code"
                  className="font-mono text-xs tracking-wider"
                />
                <p className="text-2xs text-text-faint">
                  Enter the verification string from Search Console (HTML tag method: content=&quot;...&quot;).
                </p>
                <p className="text-2xs text-amber-500/90 font-medium leading-relaxed mt-1">
                  ⚠️ Google Search Console mein property add karte waqt &quot;URL prefix&quot; select karein (https://launchapropfirm.com), NOT &quot;Domain&quot;. Meta tag verification sirf URL prefix ke sath kaam karti hai. Domain property ke liye DNS TXT record chahiye.
                </p>
              </div>
              <div className="rounded-md bg-surface border border-border-subtle p-3 flex flex-col justify-center">
                <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1">Index &amp; Sitemap Status</div>
                <div className="text-xs text-text font-mono flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${vals.google_site_verification ? 'bg-emerald-400' : 'bg-amber-500'}`} />
                  {vals.google_site_verification
                    ? 'Injected in Next.js layout metadata (<meta name="google-site-verification">)'
                    : 'Paste token & click Save Branding to activate GSC verification'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Official Social Media & Developer Desks */}
        <div className="rounded-lg border border-border-subtle bg-surface-muted/20 p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold text-text flex items-center gap-2">
              <span className="text-base">🌐</span> Official Social Media &amp; Developer Desks
            </div>
            <p className="text-2xs text-text-muted mt-0.5">
              Live channels displayed across the public marketing footer, contact hub, and trader portals.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {/* YouTube */}
            <div className="space-y-1.5">
              <Label htmlFor="bc-youtube" className="flex items-center gap-1.5">
                <span className="text-red-500 font-bold">▶</span> YouTube Channel
              </Label>
              <Input
                id="bc-youtube"
                value={vals.youtube_url ?? ''}
                onChange={(e) => set('youtube_url', e.target.value.trim())}
                placeholder="https://www.youtube.com/@LaunchAPropFirm"
                className="font-mono text-xs"
              />
              <p className="text-2xs text-text-faint">Video walkthroughs &amp; payouts breakdown.</p>
            </div>

            {/* Instagram */}
            <div className="space-y-1.5">
              <Label htmlFor="bc-instagram" className="flex items-center gap-1.5">
                <span className="text-pink-500 font-bold">📸</span> Instagram Profile
              </Label>
              <Input
                id="bc-instagram"
                value={vals.instagram_url ?? ''}
                onChange={(e) => set('instagram_url', e.target.value.trim())}
                placeholder="https://www.instagram.com/launchapropfirm/"
                className="font-mono text-xs"
              />
              <p className="text-2xs text-text-faint">Stories, market alerts &amp; trader spotlights.</p>
            </div>

            {/* TikTok */}
            <div className="space-y-1.5">
              <Label htmlFor="bc-tiktok" className="flex items-center gap-1.5">
                <span className="text-cyan-400 font-bold">🎵</span> TikTok Account
              </Label>
              <Input
                id="bc-tiktok"
                value={vals.tiktok_url ?? ''}
                onChange={(e) => set('tiktok_url', e.target.value.trim())}
                placeholder="https://www.tiktok.com/@launchapropfirm.com"
                className="font-mono text-xs"
              />
              <p className="text-2xs text-text-faint">Short-form updates, tips &amp; trading highlights.</p>
            </div>

            {/* Facebook */}
            <div className="space-y-1.5">
              <Label htmlFor="bc-facebook" className="flex items-center gap-1.5">
                <span className="text-blue-500 font-bold">📘</span> Facebook Page
              </Label>
              <Input
                id="bc-facebook"
                value={vals.facebook_url ?? ''}
                onChange={(e) => set('facebook_url', e.target.value.trim())}
                placeholder="https://www.facebook.com/profile.php?id=..."
                className="font-mono text-xs"
              />
              <p className="text-2xs text-text-faint">Official company updates &amp; community events.</p>
            </div>

            {/* Discord */}
            <div className="space-y-1.5">
              <Label htmlFor="bc-discord" className="flex items-center gap-1.5">
                <span className="text-indigo-400 font-bold">💬</span> Discord Community
              </Label>
              <Input
                id="bc-discord"
                value={vals.discord_url ?? ''}
                onChange={(e) => set('discord_url', e.target.value.trim())}
                placeholder="https://discord.com/channels/..."
                className="font-mono text-xs"
              />
              <p className="text-2xs text-text-faint">Live trader lounge, floor chat &amp; announcements.</p>
            </div>

            {/* Platform Developer / Architecture Desk */}
            <div className="space-y-1.5">
              <Label htmlFor="bc-developer" className="flex items-center gap-1.5 text-accent font-semibold">
                <span className="text-emerald-400 font-bold">🛠️</span> Platform Developer
              </Label>
              <Input
                id="bc-developer"
                value={vals.developer_url ?? ''}
                onChange={(e) => set('developer_url', e.target.value.trim())}
                placeholder="https://launchapropfirm.com"
                className="font-mono text-xs border-accent/40 focus:border-accent"
              />
              <p className="text-2xs text-text-faint">Contact Developer link in footer and support routes.</p>
            </div>
          </div>
        </div>

        {/* Asset uploads */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ASSETS.map((a) => (
            <AssetTile key={a.field} asset={a} url={vals[a.key] ?? ''}
              uploading={uploading === a.field}
              onUpload={async (file) => {
                setUploading(a.field)
                const res = await api.admin.brandingUpload(a.field, file)
                setUploading(null)
                if (res.ok) { set(a.key, res.data.url); toast.success(`${a.title} uploaded`); invalidateFxsim('/branding') }
                else toast.error(res.ok ? 'Upload failed' : res.error)
              }}
              onUrl={(v) => set(a.key, v)}
              onClear={() => set(a.key, '')}
            />
          ))}
        </div>

        {/* Live Interactive Device Frame Mockup (Point #4) */}
        <DeviceFrameMockup
          brandName={vals.brand_name || 'Alpha Capital'}
          brandTagline={vals.brand_tagline || 'The Funded Trader Platform'}
          logoUrl={vals.logo_url || vals.login_logo_url}
          sidebarIconUrl={vals.sidebar_icon_url}
          accentColor={vals.accent_color || '#10B981'}
        />

        {/* Live previews */}
        <div>
          <div className="text-2xs uppercase tracking-wider text-text-faint mb-2.5">Asset Component Previews</div>
          <div className="grid md:grid-cols-3 gap-3">
            {/* Sidebar */}
            <div className="rounded-lg border border-border-subtle overflow-hidden">
              <div className="px-3 py-2 text-2xs text-text-faint border-b border-border-subtle">Sidebar</div>
              <div className="bg-surface p-3 flex items-center gap-2.5 h-16">
                {vals.sidebar_icon_url
                  ? <img src={vals.sidebar_icon_url} alt={brand} className="h-8 w-8 rounded-lg object-contain bg-surface-muted/40 shrink-0" />
                  : <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-accent/70 shrink-0" />}
                <span className="font-semibold text-sm truncate">{brand}</span>
              </div>
            </div>
            {/* Login */}
            <div className="rounded-lg border border-border-subtle overflow-hidden">
              <div className="px-3 py-2 text-2xs text-text-faint border-b border-border-subtle">Login</div>
              <div className="bg-surface p-4 flex flex-col items-center gap-2 h-16 justify-center">
                {(vals.login_logo_url || vals.logo_url)
                  ? <img src={vals.login_logo_url || vals.logo_url} alt={brand} className="h-7 w-auto max-w-[150px] object-contain" />
                  : <span className="font-semibold text-sm">{brand}</span>}
              </div>
            </div>
            {/* Email header */}
            <div className="rounded-lg border border-border-subtle overflow-hidden">
              <div className="px-3 py-2 text-2xs text-text-faint border-b border-border-subtle">Email header</div>
              <div className="bg-white p-3 flex items-center gap-2 h-16">
                {vals.logo_url ? <img src={vals.logo_url} alt={brand} className="h-7 w-auto max-w-[150px] object-contain" />
                  : <span className="font-semibold text-sm text-text-strong">{brand}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Buyer guidance */}
        <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><Info className="h-4 w-4 text-accent" /> Tips for best results</div>
          <ul className="space-y-1 text-2xs text-text-muted">
            <li>• Short company names display better in the sidebar.</li>
            <li>• Transparent PNG logos are recommended.</li>
            <li>• Logos should remain readable on dark backgrounds.</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Save branding</Button>
        </div>
      </CardContent>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset Branding to Defaults"
        description="Are you sure you want to restore default branding? This will reset the platform name, slogan, logos, favicon, and email styling to system defaults."
        confirmText="Reset Branding"
        isDestructive={true}
        loading={resetting}
      />
    </Card>
  )
}

function AssetTile({ asset, url, uploading, onUpload, onUrl, onClear }: {
  asset: { field: AssetField; title: string; size: string; helper: string }
  url: string; uploading: boolean
  onUpload: (f: File) => void; onUrl: (v: string) => void; onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-lg border border-border-subtle p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{asset.title}</div>
        <span className="text-2xs text-text-faint">{asset.size}</span>
      </div>
      <div className="h-16 rounded-md bg-surface-muted/40 border border-border-subtle flex items-center justify-center overflow-hidden">
        {url ? <img src={url} alt={asset.title} className="max-h-14 max-w-full object-contain" />
          : <span className="text-2xs text-text-faint">No image</span>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); if (ref.current) ref.current.value = '' }} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" loading={uploading} onClick={() => ref.current?.click()}>
          <UploadCloud className="h-3.5 w-3.5" /> Upload
        </Button>
        {url && <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>}
      </div>
      <Input value={url} onChange={(e) => onUrl(e.target.value)} placeholder="…or paste an image URL" className="text-2xs" />
      <p className="text-2xs text-text-faint leading-relaxed">{asset.helper}</p>
    </div>
  )
}
