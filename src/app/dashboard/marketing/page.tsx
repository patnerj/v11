'use client'

import React from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Megaphone } from 'lucide-react'
import { MarketingMediaKit } from '@/components/dashboard/marketing/marketing-media-kit'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export default function TraderMarketingPage() {
  const { data: me, isPending } = useQuery({
    queryKey: ['affiliateMeForMarketing'],
    queryFn: async () => {
      const res = await api.affiliateMe()
      return res.ok ? res.data : null
    },
  })

  const affiliateCode = me?.code || 'PARTNER'
  const partnerLink = typeof window !== 'undefined'
    ? `${window.location.origin}/register?ref=${affiliateCode}`
    : `/register?ref=${affiliateCode}`

  return (
    <div className="space-y-8">
      <PageHeader
        variant="hero"
        title="Marketing Media Kit & Partner Hub"
        description="Download official promotional banners, stories, and high-converting marketing copy embedded with your affiliate code."
        icon={Megaphone}
        badge={{ label: 'Creator Assets', tone: 'accent' }}
      />

      <SectionErrorBoundary sectionName="Marketing Media Kit">
        {isPending && me === undefined ? (
          <Skeleton className="h-[480px] w-full rounded-2xl" />
        ) : (
          <MarketingMediaKit
            affiliateCode={affiliateCode}
            partnerLink={partnerLink}
          />
        )}
      </SectionErrorBoundary>
    </div>
  )
}
