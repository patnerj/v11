'use client'

import React from 'react'
import { BrandingCenter } from '@/components/admin/branding-center'

export default function AdminBrandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">Platform Branding & White-Label</h1>
        <p className="text-sm text-text-muted mt-1">
          Customize firm identity, light and dark logos, primary brand colors, and preview live on simulated device mockups.
        </p>
      </div>

      <BrandingCenter />
    </div>
  )
}
