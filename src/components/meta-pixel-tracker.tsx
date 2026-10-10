'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pageview } from '@/lib/meta-pixel'

function MetaPixelTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip first render since layout.tsx initial script already fired PageView on boot
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    pageview()
  }, [pathname, searchParams])

  return null
}

export function MetaPixelTracker() {
  return (
    <Suspense fallback={null}>
      <MetaPixelTrackerInner />
    </Suspense>
  )
}
