'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Global helpers for triggering the top progress bar programmatically.
 */
export function startTopProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('top-progress:start'))
  }
}

export function completeTopProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('top-progress:complete'))
  }
}

function TopProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [mounted, setMounted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)

  const timersRef = useRef<NodeJS.Timeout[]>([])
  const isFirstRender = useRef(true)
  const currentPathRef = useRef<string>('')

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const start = () => {
    clearAllTimers()
    setIsFinishing(false)
    setVisible(true)
    setProgress(18)

    // Staged progression simulating realistic page chunk loading
    const t1 = setTimeout(() => setProgress(42), 150)
    const t2 = setTimeout(() => setProgress(68), 400)
    const t3 = setTimeout(() => setProgress(84), 850)
    const t4 = setTimeout(() => setProgress(92), 1600)
    // Auto-complete safety timeout in case navigation took too long or was intercepted
    const tSafe = setTimeout(() => finish(), 7000)

    timersRef.current = [t1, t2, t3, t4, tSafe]
  }

  const finish = () => {
    clearAllTimers()
    setIsFinishing(true)
    setProgress(100)

    const tEnd = setTimeout(() => {
      setVisible(false)
      setProgress(0)
      setIsFinishing(false)
    }, 280)

    timersRef.current = [tEnd]
  }

  useEffect(() => {
    setMounted(true)
    currentPathRef.current = `${window.location.pathname}${window.location.search}`
  }, [])

  // Complete progress whenever route path or searchParams change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const newPath = `${pathname}${searchParams?.toString() ? '?' + searchParams.toString() : ''}`
    if (newPath !== currentPathRef.current) {
      currentPathRef.current = newPath
      finish()
    }
  }, [pathname, searchParams])

  // Global document click interceptor for internal links
  useEffect(() => {
    if (!mounted) return

    const handleDocumentClick = (e: MouseEvent) => {
      // Ignore modified or non-primary clicks
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return
      }

      const target = (e.target as Element)?.closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      // Ignore hash links, javascript:, mailto:, tel:, external links, or target=_blank
      if (
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        target.target === '_blank' ||
        target.hasAttribute('download')
      ) {
        return
      }

      // Check origin
      if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          const url = new URL(href)
          if (url.origin !== window.location.origin) return
        } catch {
          return
        }
      }

      // If pointing to the exact same current path, ignore
      const fullDest = href.startsWith('http') ? new URL(href).pathname + new URL(href).search : href
      const currentFull = window.location.pathname + window.location.search
      if (fullDest === currentFull) return

      // Trigger 0ms instant top progress bar!
      start()
    }

    const handleCustomStart = () => start()
    const handleCustomComplete = () => finish()

    document.addEventListener('click', handleDocumentClick, { capture: true })
    window.addEventListener('top-progress:start', handleCustomStart)
    window.addEventListener('top-progress:complete', handleCustomComplete)

    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true })
      window.removeEventListener('top-progress:start', handleCustomStart)
      window.removeEventListener('top-progress:complete', handleCustomComplete)
      clearAllTimers()
    }
  }, [mounted])

  if (!mounted || !visible) return null

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="Page navigation progress"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[2.5px] bg-transparent overflow-hidden"
    >
      <div
        className="h-full relative"
        style={{
          width: `${progress}%`,
          backgroundColor: 'hsl(var(--accent, 160 84% 39%))',
          boxShadow: '0 0 10px hsl(var(--accent, 160 84% 39%)), 0 0 5px hsl(var(--accent, 160 84% 39%))',
          transition: isFinishing
            ? 'width 180ms ease-out, opacity 250ms 100ms ease-in'
            : 'width 250ms ease-out, opacity 150ms ease-out',
          opacity: isFinishing && progress === 100 ? 0.2 : 1,
        }}
      >
        {/* Glowing Head Peg */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-24 h-full pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.4))',
            boxShadow: '0 0 12px hsl(var(--accent, 160 84% 39%)), 0 0 6px hsl(var(--accent, 160 84% 39%))',
          }} 
        />
      </div>
    </div>
  )
}

export function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  )
}
