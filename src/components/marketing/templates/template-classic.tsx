'use client'

import { Suspense } from 'react'
import { PuckRenderer } from '@/components/puck/puck-renderer'

export function TemplateClassic({ data }: { data: any }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <PuckRenderer data={data} />
    </Suspense>
  )
}
