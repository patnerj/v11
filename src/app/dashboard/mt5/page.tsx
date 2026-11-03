'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Native MT5 WebTerminal route (`/dashboard/mt5`)
 * Currently gated pending client $300 tier add-on unlock.
 * Automatically bounces traders to the primary Trading Terminal (`/dashboard/trading`).
 */
export default function Mt5WebTerminalPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/trading')
  }, [router])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-bg">
      <div className="text-center text-text-muted space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" />
        <p className="text-sm font-medium">Redirecting to Trading Terminal…</p>
      </div>
    </div>
  )
}
