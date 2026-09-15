import { PuckRenderer } from "@/components/puck/puck-renderer";
import { MarketingHeader } from "@/components/marketing/header";
import { PayoutTicker } from "@/components/payout-ticker";
import { MarketingFooter } from "@/components/marketing/footer";
import { getApiBaseUrl } from "@/lib/fxsim";

export const dynamic = 'force-dynamic';

// Default fallback layout if database has no schema saved yet
const defaultData = {
  content: [
    { type: "Hero", props: { id: "hero-1" } },
    { type: "LiveStatsStrip", props: { id: "stats-1" } },
    { type: "HowItWorks", props: { id: "how-1" } },
    { type: "ChallengesPreview", props: { id: "chal-1" } },
    { type: "PlatformFeatures", props: { id: "feat-1" } },
    { type: "PayoutsSection", props: { id: "payout-1" } },
    { type: "Testimonials", props: { id: "test-1" } },
    { type: "FAQSection", props: { id: "faq-1" } },
    { type: "CTASection", props: { id: "cta-1" } }
  ],
  root: {}
};

async function getPageSchema() {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/page-schema`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const schema = data?.schema || (data?.content ? data : null);
      if (schema?.content && Array.isArray(schema.content)) {
        const hasFaq = schema.content.some((c: any) => c.type === 'FAQSection');
        if (!hasFaq) {
          const ctaIdx = schema.content.findIndex((c: any) => c.type === 'CTASection');
          if (ctaIdx !== -1) {
            schema.content.splice(ctaIdx, 0, { type: 'FAQSection', props: { id: 'faq-1' } });
          } else {
            schema.content.push({ type: 'FAQSection', props: { id: 'faq-1' } });
          }
        }
        return schema;
      }
    }
  } catch (err) {
    console.error("Error fetching page schema:", err);
  }
  return defaultData;
}

export default async function HomePage() {
  const data = await getPageSchema();

  return (
    <>
      <MarketingHeader />
      <PayoutTicker />
      <main className="relative">
        <PuckRenderer data={data} />
      </main>
      <MarketingFooter />
    </>
  );
}
