import { cache } from 'react'
import type { Metadata } from 'next'

export interface PageSeoConfig {
  title?: string
  description?: string
  primary_keyword?: string
  secondary_keywords?: string[]
  search_intent?: string
  hero_badge?: string
  h1_title?: string
  lead_paragraph?: string
  faqs?: Array<{ q: string; a: string }>
}

export const DEFAULT_SEO_PAGES: Record<string, PageSeoConfig> = {
  '/': {
    title: 'AlphaCapital — Trade Up to $200,000 in Funded Capital',
    description: 'Pass the evaluation, trade live institutional liquidity, and keep up to 90% of your profits with AlphaCapital.',
    primary_keyword: 'Prop Firm',
    secondary_keywords: ['Funded Trading Account', 'Forex Prop Firm', 'Instant Funding MT5', 'Proprietary Trading Firm'],
    search_intent: 'Commercial',
    hero_badge: 'Institutional Prop Trading',
    h1_title: 'Trade Up to $200,000 in Simulated Funded Capital',
    lead_paragraph: 'Prove your trading skills with fair evaluation rules, zero hidden restrictions, tight spreads on MT5, and bi-weekly payouts.',
    faqs: [
      { q: 'What is this platform?', a: 'We are a premier proprietary trading firm providing capital evaluations for ambitious traders worldwide.' },
      { q: 'What profit split do traders get?', a: 'Traders keep up to 90% of simulated profits upon successfully reaching the funded trader stage.' },
      { q: 'Are there time limits on evaluations?', a: 'No, our evaluation models feature unlimited trading days to allow disciplined, stress-free execution.' }
    ]
  },
  '/challenges': {
    title: 'Evaluation Plans & Pricing | Prop Firm Challenges',
    description: 'Compare 1-step and 2-step trading challenges from $10,000 to $200,000 with up to 90% profit split, static drawdown, and zero time limits.',
    primary_keyword: 'Prop Firm Challenge',
    secondary_keywords: ['2-Step Evaluation', 'Instant Funding MT5', 'Funded Account Challenge', 'Trading Evaluation Plans'],
    search_intent: 'Transactional',
    hero_badge: 'Evaluation Accounts',
    h1_title: 'Select Your Funded Trading Challenge',
    lead_paragraph: 'Choose between 1-step and 2-step evaluation models tailored to your risk tolerance. Scale up to $200,000 with transparent rules and rapid payout cycles.',
    faqs: [
      { q: 'How does the evaluation challenge work?', a: 'Achieve the profit target without hitting the daily or overall static drawdown limit to qualify for a funded simulated account.' },
      { q: 'Is there a minimum or maximum trading day limit?', a: 'We offer flexible trading conditions without strict maximum day restrictions.' },
      { q: 'Are challenge fees refundable?', a: 'Yes, 100% of your initial challenge fee is refunded on your very first successful payout.' }
    ]
  },
  '/about': {
    title: 'About Us | Proprietary Trading Firm',
    description: 'Learn how we empower global traders through institutional liquidity, fair risk parameters, and verified payout governance.',
    primary_keyword: 'Proprietary Trading Firm',
    secondary_keywords: ['Institutional Liquidity', 'Static Drawdown', 'About Prop Firm', 'Global Trading Firm'],
    search_intent: 'Informational',
    hero_badge: 'Our Mission',
    h1_title: 'Empowering Disciplined Traders Worldwide',
    lead_paragraph: 'Our firm was established to solve predatory prop firm practices. We back disciplined traders with transparent rules, real institutional liquidity, and zero drawdown gimmicks.',
    faqs: [
      { q: 'Where are we located?', a: 'We operate globally with technical infrastructure and institutional liquidity feeds across tier-1 financial hubs.' },
      { q: 'How do we manage risk?', a: 'We utilize static drawdown calculations and automated risk sentinels to ensure balanced capital protection.' }
    ]
  },
  '/how-it-works': {
    title: 'How It Works | 2-Step Evaluation & Trader Payouts',
    description: 'Understand the path to funded trading: choose a challenge, pass the risk-managed evaluation, and withdraw up to 90% profit splits.',
    primary_keyword: 'How Prop Firms Work',
    secondary_keywords: ['Trader Profit Split', 'Evaluation Rules', 'Prop Firm Steps', 'Funded Trader Roadmap'],
    search_intent: 'Informational',
    hero_badge: 'The Roadmap',
    h1_title: 'How Our Prop Firm Works',
    lead_paragraph: 'A straightforward three-stage journey: Pick your challenge size, demonstrate your risk discipline in the evaluation phase, and get funded with rapid bi-weekly payouts.',
    faqs: [
      { q: 'What happens after passing Phase 2?', a: 'You undergo instant KYC identity verification and receive your funded master account credentials.' },
      { q: 'Can I hold trades over the weekend?', a: 'Weekend holding is permitted according to our transparent plan specifications.' }
    ]
  },
  '/faq': {
    title: 'Frequently Asked Questions | Rules, Drawdown & Payouts',
    description: 'Find clear answers on drawdown calculations, news trading rules, weekend holding, payout methods, and platform compatibility.',
    primary_keyword: 'Prop Firm Drawdown Rules',
    secondary_keywords: ['Weekend Holding', 'Crypto Payouts', 'News Trading Rules', 'Prop Firm FAQ'],
    search_intent: 'Informational',
    hero_badge: 'Knowledge Base',
    h1_title: 'Frequently Asked Questions',
    lead_paragraph: 'Got questions? We have answers. Find comprehensive guidance on evaluation rules, trailing vs static drawdown, profit splits, and account parameters.',
    faqs: [
      { q: 'How is the daily drawdown calculated?', a: 'Daily drawdown is calculated from the day\'s starting equity balance at 00:00 UTC.' },
      { q: 'Which payment methods are supported for payouts?', a: 'We support crypto (USDT TRC20/ERC20) and direct bank transfers for seamless profit disbursements.' }
    ]
  },
  '/payouts': {
    title: 'Guaranteed Payouts & Proof | Prop Firm Payouts',
    description: 'Explore our verifiable payout track record. Fast, secure crypto and wire payouts with up to 90% profit split for funded traders.',
    primary_keyword: 'Guaranteed Trader Payouts',
    secondary_keywords: ['Bi-Weekly Profit Split', 'Prop Firm Payout Proof', 'Instant Crypto Payouts', 'Funded Trader Withdrawals'],
    search_intent: 'Commercial',
    hero_badge: 'Payout Guarantee',
    h1_title: 'Fast, Verifiable Trader Payouts',
    lead_paragraph: 'Request your profit split in just a few clicks. Payouts are processed within 24 to 48 hours via crypto or bank wire with zero hidden withdrawal fees.',
    faqs: [
      { q: 'When can I request my first payout?', a: 'You can request your first payout 14 days after your first placed trade on the funded simulated account.' },
      { q: 'What is the minimum payout amount?', a: 'The minimum payout threshold is $100 with zero platform processing fees.' }
    ]
  },
  '/contact': {
    title: 'Contact Support | 24/7 Trader Helpdesk',
    description: 'Get in touch with our support team via live chat, email, or Discord. We are here to assist with challenges, accounts, and payouts.',
    primary_keyword: 'Prop Firm Support',
    secondary_keywords: ['Trader Desk Governance', 'Customer Service', 'Support Helpdesk', '24/7 Live Support'],
    search_intent: 'Informational',
    hero_badge: '24/7 Trader Desk',
    h1_title: 'We are Here to Support Your Trading Journey',
    lead_paragraph: 'Our dedicated support team is available 24/7 via live chat, email, and Discord community to help you with any evaluation questions or technical issues.',
    faqs: [
      { q: 'How quickly does support respond?', a: 'Live chat inquiries are typically answered within 2 minutes, and email tickets within 2 hours.' },
      { q: 'Can I get help with MT5 setup?', a: 'Yes, our team provides step-by-step assistance for desktop, mobile, and web terminals.' }
    ]
  },
  '/tournaments': {
    title: 'Trading Tournaments & Arena | Compete for Funded Accounts',
    description: 'Join live trading competitions, battle global traders on the leaderboard, and win funded accounts and cash prizes.',
    primary_keyword: 'Trading Tournaments',
    secondary_keywords: ['Prop Firm Competitions', 'Trader Leaderboard', 'PvP Trading Arena', 'Free Funded Accounts'],
    search_intent: 'Commercial',
    hero_badge: 'Competitive Arena',
    h1_title: 'Prop Trading Tournaments & Contests',
    lead_paragraph: 'Showcase your market prowess in timed trading tournaments. Top performers on the verified leaderboard win cash prizes and funded account vouchers.',
    faqs: [
      { q: 'Are tournaments free to enter?', a: 'We offer both free monthly community tournaments and high-stakes prize pool competitions.' },
      { q: 'How is the tournament winner determined?', a: 'Rankings are based on percentage profit gain while strictly adhering to drawdown parameters.' }
    ]
  }
}

/**
 * Server-side memoized fetch for branding data.
 */
export const fetchServerBranding = cache(async () => {
  const rawApi =
    process.env.FXSIM_API_URL ||
    process.env.LOCAL_WP_BACKEND_URL ||
    (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : '') ||
    'http://localhost:8000/wp-json/fxsim/v1'
  const apiPath = rawApi.endsWith('/wp-json/fxsim/v1') ? rawApi : `${rawApi.replace(/\/$/, '')}/wp-json/fxsim/v1`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(`${apiPath}/branding`, {
      next: { revalidate: 30 },
      signal: controller.signal
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // network fallback
  } finally {
    clearTimeout(timeoutId)
  }
  return null
})

/**
 * Deduplicate brand name in meta titles to prevent "Title | Brand | Brand" bug.
 */
export function deduplicateBrandTitle(rawTitle: string, brandName: string): string {
  if (!rawTitle) return `${brandName} — Trade Up to $200,000 in Funded Capital`
  let title = rawTitle.trim()
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const trailingRegex = new RegExp(`(\\s*[|\\-–—]\\s*${escapedBrand})+\\s*$`, 'i')
  const base = title.replace(trailingRegex, '').trim()
  if (!base) return brandName
  if (new RegExp(`\\b${escapedBrand}\\b`, 'i').test(base)) {
    return base
  }
  return `${base} | ${brandName}`
}

/**
 * Generate Next.js Server Metadata for any route pathname.
 */
export async function getPageSeoMetadata(
  pathname: string,
  defaults?: Partial<PageSeoConfig>
): Promise<Metadata> {
  const branding = await fetchServerBranding()
  const brandName = branding?.brand_name && branding.brand_name.toLowerCase() !== 'propfirm system'
    ? branding.brand_name
    : (process.env.NEXT_PUBLIC_BRAND_NAME || 'AlphaCapital')
  const siteUrl = branding?.frontend_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://alphacapital.com'
  const ogImage = branding?.og_image_url || '/og-image.png'

  const serverPages = branding?.seo_pages || {}
  const pageConfig: PageSeoConfig = {
    ...(DEFAULT_SEO_PAGES[pathname] || {}),
    ...(defaults || {}),
    ...(serverPages[pathname] || {})
  }

  const rawTitle = pageConfig.title || `${brandName} — Trade Up to $200,000 in Funded Capital`
  const finalTitle = deduplicateBrandTitle(rawTitle, brandName)
  const finalDesc = pageConfig.description || `${brandName} Proprietary Trading Platform.`

  let keywords: string[] = []
  if (pageConfig.primary_keyword) keywords.push(pageConfig.primary_keyword)
  if (Array.isArray(pageConfig.secondary_keywords)) {
    keywords = [...keywords, ...pageConfig.secondary_keywords]
  }

  const canonicalUrl = `${siteUrl}${pathname === '/' ? '' : pathname}`

  return {
    title: {
      absolute: finalTitle
    },
    description: finalDesc,
    keywords: keywords.length > 0 ? keywords : ['Prop Firm', 'Proprietary Trading', brandName],
    openGraph: {
      title: finalTitle,
      description: finalDesc,
      url: canonicalUrl,
      siteName: brandName,
      images: [
        {
          url: ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`,
          width: 1200,
          height: 630,
          alt: finalTitle
        }
      ],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: finalTitle,
      description: finalDesc,
      images: [ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`]
    },
    alternates: {
      canonical: canonicalUrl
    }
  }
}

/**
 * Schema.org JSON-LD generators for search crawlers.
 */
export function generateFaqSchema(faqs: Array<{ q: string; a: string }>) {
  if (!faqs || faqs.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a
      }
    }))
  }
}

export function generateOrganizationSchema(
  brandName: string,
  siteUrl: string,
  logoUrl?: string,
  supportEmail?: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brandName,
    url: siteUrl,
    logo: logoUrl ? (logoUrl.startsWith('http') ? logoUrl : `${siteUrl}${logoUrl}`) : `${siteUrl}/branding/brand_logo.svg`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: supportEmail || 'support@alphacapital.com'
    }
  }
}

export function generateFinancialProductSchema(brandName: string, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: `${brandName} Funded Account Evaluation`,
    description: `Simulated trading capital challenges up to $200,000 with institutional liquidity, static drawdown limits, and up to 90% profit split.`,
    provider: {
      '@type': 'Organization',
      name: brandName,
      url: siteUrl
    },
    offers: [
      { '@type': 'Offer', name: '10K Evaluation', price: '99', priceCurrency: 'USD' },
      { '@type': 'Offer', name: '25K Evaluation', price: '199', priceCurrency: 'USD' },
      { '@type': 'Offer', name: '50K Evaluation', price: '349', priceCurrency: 'USD' },
      { '@type': 'Offer', name: '100K Evaluation', price: '549', priceCurrency: 'USD' },
      { '@type': 'Offer', name: '200K Evaluation', price: '999', priceCurrency: 'USD' }
    ]
  }
}

/**
 * Resolve all JSON-LD schemas applicable to a route.
 */
export async function getPageJsonLd(pathname: string) {
  const branding = await fetchServerBranding()
  const brandName = branding?.brand_name && branding.brand_name.toLowerCase() !== 'propfirm system'
    ? branding.brand_name
    : (process.env.NEXT_PUBLIC_BRAND_NAME || 'AlphaCapital')
  const siteUrl = branding?.frontend_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://alphacapital.com'
  const logoUrl = branding?.logo_url || '/branding/brand_logo.svg'
  const supportEmail = branding?.support_email || 'support@alphacapital.com'

  const serverPages = branding?.seo_pages || {}
  const pageConfig: PageSeoConfig = {
    ...(DEFAULT_SEO_PAGES[pathname] || {}),
    ...(serverPages[pathname] || {})
  }

  const schemas: any[] = []

  // 1. Organization schema
  schemas.push(generateOrganizationSchema(brandName, siteUrl, logoUrl, supportEmail))

  // 2. Financial product schema (for /challenges and /)
  if (pathname === '/' || pathname === '/challenges') {
    schemas.push(generateFinancialProductSchema(brandName, siteUrl))
  }

  // 3. FAQPage schema
  if (pageConfig.faqs && pageConfig.faqs.length > 0) {
    const faqSchema = generateFaqSchema(pageConfig.faqs)
    if (faqSchema) schemas.push(faqSchema)
  }

  return {
    '@context': 'https://schema.org',
    '@graph': schemas
  }
}
