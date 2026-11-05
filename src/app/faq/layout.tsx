import type { Metadata } from 'next'
import { getPageSeoMetadata, getPageJsonLd } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return await getPageSeoMetadata('/faq')
}

export default async function FaqLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = await getPageJsonLd('/faq')
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
