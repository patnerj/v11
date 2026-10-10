import { Suspense, cache } from "react";
import { PuckRenderer } from "@/components/puck/puck-renderer";
import { MarketingHeader } from "@/components/marketing/header";
import { PayoutTicker } from "@/components/payout-ticker";
import { MarketingFooter } from "@/components/marketing/footer";
import { getApiBaseUrl } from "@/lib/fxsim";

export const revalidate = 60;

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

const getCachedPageSchema = cache(async () => {
  try {
    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${baseUrl}/page-schema`, { 
      next: { revalidate: 300 },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
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
    // silently fallback on timeout or fetch error
  }
  return defaultData;
});

export default async function HomePage() {
  const data = await getCachedPageSchema();

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200 overflow-x-hidden">
      <MarketingHeader />
      <Suspense fallback={null}>
        <PayoutTicker />
      </Suspense>
      <main className="relative pb-20 lg:pb-0">
        <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}>
          <PuckRenderer data={data} />
        </Suspense>
      </main>
      <MarketingFooter />
    </div>
  );
}
