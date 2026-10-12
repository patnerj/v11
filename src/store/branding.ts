'use client'

import { create } from 'zustand'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'

export interface Branding {
  brand_name: string
  brand_tagline: string
  logo_url: string
  sidebar_icon_url: string
  login_logo_url: string
  favicon_url: string
  support_email: string
  primary_color: string
  secondary_color: string
  footer_text: string
  /** Platform→TradingView chart symbol overrides (JSON object string, V10.5). */
  tv_symbol_map: string
  youtube_url?: string
  instagram_url?: string
  tiktok_url?: string
  facebook_url?: string
  discord_url?: string
  developer_url?: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  google_site_verification?: string
  bing_site_verification?: string
  robots_indexing?: string
  og_image_url?: string
  ga_measurement_id?: string
  facebook_pixel_id?: string
  custom_head_code?: string
}

const DEFAULTS: Branding = {
  brand_name: 'LaunchAPropFirm',
  brand_tagline: 'Institutional High-Frequency Prop Trading',
  logo_url: '/branding/brand_logo.svg',
  sidebar_icon_url: '/branding/sidebar_icon.svg',
  login_logo_url: '/branding/login_logo.svg',
  favicon_url: '/favicon.svg',
  support_email: 'support@launchapropfirm.com',
  primary_color: '#10B981',
  secondary_color: '#059669',
  footer_text: '© 2026 LaunchAPropFirm. All rights reserved.',
  tv_symbol_map: '',
  youtube_url: '',
  instagram_url: 'https://www.instagram.com/yourswebsitemaker/',
  tiktok_url: '',
  facebook_url: '',
  discord_url: '',
  developer_url: '',
  meta_title: 'LaunchAPropFirm — Trade Up to $200,000 in Funded Capital',
  meta_description: 'Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits.',
  meta_keywords: 'Prop Firm, Proprietary Trading, Funded Account, Forex Prop Firm, Crypto Prop Firm, Trading Challenge, LaunchAPropFirm',
  google_site_verification: '',
  bing_site_verification: '',
  robots_indexing: 'index_follow',
  og_image_url: '/og-image.png',
  ga_measurement_id: 'G-G5758RZV7E',
  facebook_pixel_id: '',
  custom_head_code: '',
}

interface BrandingState {
  branding: Branding
  loaded: boolean
  load: () => Promise<void>
  reload: () => Promise<void>
  set: (b: Partial<Branding>) => void
}

let loadPromise: Promise<void> | null = null

function normalizeBranding(data: Partial<Branding>): Branding {
  const b = { ...DEFAULTS, ...data }
  if (!b.brand_name?.trim()) {
    b.brand_name = DEFAULTS.brand_name
  }
  if (!b.footer_text?.trim()) {
    b.footer_text = `© ${new Date().getFullYear()} ${b.brand_name}. Simulation platform only.`
  }
  return b
}

export const useBranding = create<BrandingState>((set, get) => ({
  branding: DEFAULTS,
  loaded: false,
  load: async () => {
    if (get().loaded || loadPromise) return loadPromise ?? Promise.resolve()
    loadPromise = (async () => {
      const res = await api.branding()
      if (res.ok) {
        const b = normalizeBranding(res.data)
        set({ branding: b, loaded: true })
        applyDocumentBranding(b)
      } else {
        set({ loaded: true })
        applyDocumentBranding(DEFAULTS)
      }
    })().finally(() => { loadPromise = null })
    return loadPromise
  },
  // Used by the admin previewer to reflect unsaved edits live.
  set: (b) => {
    const next = { ...get().branding, ...b }
    set({ branding: next })
    applyDocumentBranding(next)
  },
  reload: async () => {
    invalidateFxsim('/branding')
    const res = await api.branding()
    if (res.ok) {
      const b = normalizeBranding(res.data)
      set({ branding: b, loaded: true })
      applyDocumentBranding(b)
    }
  },
}))

/** Apply title + favicon at runtime (true white-label without rebuild). */
function applyDocumentBranding(b: Branding) {
  if (typeof document === 'undefined') return
  const title = b.brand_name || 'LaunchAPropFirm'
  if (document.title !== title) {
    document.title = title
  }
  if (b.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    if (link.getAttribute('href') !== b.favicon_url) {
      link.href = b.favicon_url
    }
  }
}
