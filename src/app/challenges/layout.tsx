import type { Metadata } from 'next'
import { getPageSeoMetadata, getPageJsonLd } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return await getPageSeoMetadata('/challenges')
}

export default async function ChallengesLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = await getPageJsonLd('/challenges')
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
