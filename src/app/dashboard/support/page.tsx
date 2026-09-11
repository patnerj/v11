'use client'

import { PageHeader } from '@/components/ui/page-header'
import { LifeBuoy } from 'lucide-react'
import { TraderSupport } from '@/components/dashboard/trader-support'

export default function SupportPage() {
  return (
    <div className="space-y-3">
      <PageHeader
        variant="standard"
        title="Help & Support"
        description="Contact our support desk if you need assistance with your account, billing, or trades."
        icon={LifeBuoy}
        badge={{ label: 'Help Center', tone: 'accent' }}
      />

      <TraderSupport />
    </div>
  )
}
