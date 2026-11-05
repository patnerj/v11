import type { Metadata } from 'next'
import { getPageSeoMetadata, getPageJsonLd } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return await getPageSeoMetadata('/how-it-works')
}

export default async function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = await getPageJsonLd('/how-it-works')
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
