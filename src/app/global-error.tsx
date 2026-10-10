'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Fatal Global Error:', error)
    Sentry.captureException(error)
  }, [error])

  const handleHardReload = () => {
    try {
      if (typeof window !== 'undefined') {
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name))
          })
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister())
          })
        }
        const cleanUrl = window.location.origin + window.location.pathname + '?_v=' + Date.now()
        window.location.replace(cleanUrl)
        return
      }
    } catch (e) {}
    window.location.reload()
  }

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans">
          <div className="max-w-md w-full bg-surface border border-border-subtle rounded-xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-text">Fatal Application Error</h2>
            <p className="text-text-muted mb-6 text-sm">
              We encountered a critical error. Please reload the page to recover.
            </p>
            <div className="flex gap-4 justify-center mb-4">
              <Button onClick={handleHardReload} variant="outline">
                Reload Page
              </Button>
              <Button onClick={handleHardReload} className="bg-accent text-white hover:bg-accent-hover">
                Try Again
              </Button>
            </div>
            <p className="text-xs text-text-muted/70">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-surface-muted border text-2xs">Ctrl+F5</kbd> or open in Incognito to clear browser cache.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
