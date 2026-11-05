import type { Metadata } from 'next'
import { getPageSeoMetadata, getPageJsonLd } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return await getPageSeoMetadata('/about')
}

export default async function AboutLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = await getPageJsonLd('/about')
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
