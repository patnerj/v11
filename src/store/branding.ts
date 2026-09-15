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
}

const DEFAULTS: Branding = {
  brand_name: 'Alpha Capital',
  brand_tagline: 'The Funded Trader Platform',
  logo_url: '', sidebar_icon_url: '', login_logo_url: '', favicon_url: '',
  support_email: 'support@alphacapital.com', primary_color: '#10B981', secondary_color: '#00e5a0', footer_text: '© 2026 Alpha Capital. Simulation platform only.', tv_symbol_map: '',
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
  // Dynamic fallback: If API returns vendor default or empty, dynamically fall back to Alpha Capital
  if (!b.brand_name || b.brand_name.toLowerCase() === 'launchapropfirm' || b.brand_name.toLowerCase() === 'propfirm system') {
    b.brand_name = 'Alpha Capital'
  }
  if (!b.footer_text || b.footer_text.includes('LaunchAPropFirm') || b.footer_text.includes('PropFirm System')) {
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
  const title = b.brand_name || 'Alpha Capital'
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
    link.href = b.favicon_url
  }
}
