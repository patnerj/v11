import type { Metadata } from 'next'
import { getPageSeoMetadata, getPageJsonLd } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return await getPageSeoMetadata('/tournaments')
}

export default async function TournamentsLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = await getPageJsonLd('/tournaments')
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
