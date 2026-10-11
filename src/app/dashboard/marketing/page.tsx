'use client'

import React from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Sparkles, Megaphone } from 'lucide-react'
import { MarketingMediaKit } from '@/components/dashboard/marketing/marketing-media-kit'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export default function TraderMarketingPage() {
  const { data: me } = useQuery({
    queryKey: ['affiliateMeForMarketing'],
    queryFn: async () => {
      const res = await api.affiliateMe()
      return res.ok ? res.data : null
    },
  })

  const affiliateCode = me?.code || 'PARTNER'
  const partnerLink = typeof window !== 'undefined'
    ? `${window.location.origin}/register?ref=${affiliateCode}`
    : `https://demo.launchapropfirm.com/register?ref=${affiliateCode}`

  return (
    <div className="space-y-8">
      <PageHeader
        variant="hero"
        title="Marketing Media Kit & Partner Hub"
        description="Download official promotional banners, stories, and high-converting marketing copy embedded with your affiliate code."
        icon={Megaphone}
        badge={{ label: 'Creator Assets', tone: 'accent' }}
      />

      <MarketingMediaKit
        affiliateCode={affiliateCode}
        partnerLink={partnerLink}
      />
    </div>
  )
}
