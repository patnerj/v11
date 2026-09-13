'use client'

import { useEffect } from 'react'
import { Swords, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ArenaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Arena Error Boundary caught:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="h-16 w-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6">
        <Swords className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Arena Match Disconnected</h2>
      <p className="text-text-muted max-w-md mb-4">
        We encountered an error loading the 1v1 trader arena battle stadium. Your account metrics and open matches are safe.
      </p>
      {process.env.NODE_ENV === 'development' ? (
        <pre className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg p-3 max-w-xl overflow-x-auto mb-6 whitespace-pre-wrap text-left">
          {error?.message || 'Unknown error'}
          {error?.digest ? `\ndigest: ${error.digest}` : ''}
        </pre>
      ) : error?.digest ? (
        <p className="text-xs text-text-muted font-mono mb-6">Reference: {error.digest}</p>
      ) : null}
      <div className="flex gap-4">
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Arena
        </Button>
        <Button onClick={() => reset()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reconnect
        </Button>
      </div>
    </div>
  )
}
