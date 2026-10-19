'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Global Affiliate Tracker Component
 * Listens for ?ref=CODE across all public and marketing routes.
 * Persists the referral code to localStorage ('fxsim:ref') and a 60-day cookie
 * so that when the visitor navigates to /register or /checkout, their affiliate discount
 * and attribution are automatically applied without requiring manual code entry.
 */
export function AffiliateTracker() {
  const params = useSearchParams()

  useEffect(() => {
    try {
      const ref = params?.get('ref')
      if (ref && ref.trim()) {
        const cleanRef = ref.trim().toUpperCase()
        localStorage.setItem('fxsim:ref', cleanRef)
        document.cookie = `fxsim_ref=${encodeURIComponent(cleanRef)}; path=/; max-age=5184000; SameSite=Lax`
      }
    } catch {
      // Ignore storage restrictions in private browsing modes
    }
  }, [params])

  return null
}
