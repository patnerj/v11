import { Suspense, cache } from "react";
import { cookies } from "next/headers";
import { MarketingHeader } from "@/components/marketing/header";
import { PayoutTicker } from "@/components/payout-ticker";
import { MarketingFooter } from "@/components/marketing/footer";
import { TemplateClassic } from "@/components/marketing/templates/template-classic";
import { TemplateTerminal } from "@/components/marketing/templates/template-terminal";
import { TemplateFtmo } from "@/components/marketing/templates/template-ftmo";
import { TemplateNeon } from "@/components/marketing/templates/template-neon";
import { TemplateSwitcher, type LandingTemplateId } from "@/components/marketing/templates/template-switcher";
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

interface PageProps {
  searchParams?: Promise<{ template?: string }> | { template?: string };
}

export default async function HomePage(props: PageProps) {
  const data = await getCachedPageSchema();
  const rawParams = props.searchParams ? await Promise.resolve(props.searchParams) : {};
  const queryTemplate = (rawParams?.template || '').toLowerCase().trim();

  let cookieTemplate = '';
  try {
    const cookieStore = await cookies();
    cookieTemplate = cookieStore.get('fxsim_landing_template')?.value || '';
  } catch {}

  // Determine active template:
  // Priority: URL query (?template=ftmo, titan, terminal, massfunded, classic) -> cookie -> default ('classic')
  let activeTemplate: LandingTemplateId = 'classic';
  if (['ftmo', 'titan', 'industry'].includes(queryTemplate)) {
    activeTemplate = 'ftmo';
  } else if (['neon', 'cyber', 'fundednext', 'challenger'].includes(queryTemplate)) {
    activeTemplate = 'neon';
  } else if (['terminal', 'massfunded', 'pro'].includes(queryTemplate)) {
    activeTemplate = 'terminal';
  } else if (queryTemplate === 'classic') {
    activeTemplate = 'classic';
  } else if (['ftmo', 'titan', 'industry'].includes(cookieTemplate)) {
    activeTemplate = 'ftmo';
  } else if (['neon', 'cyber', 'fundednext', 'challenger'].includes(cookieTemplate)) {
    activeTemplate = 'neon';
  } else if (['terminal', 'massfunded', 'pro'].includes(cookieTemplate)) {
    activeTemplate = 'terminal';
  } else if (cookieTemplate === 'classic') {
    activeTemplate = 'classic';
  }

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-emerald-500 selection:text-white transition-colors duration-200 overflow-x-hidden">
      <MarketingHeader />
      <Suspense fallback={null}>
        <PayoutTicker />
      </Suspense>
      <main className="relative pb-20 lg:pb-0">
        {activeTemplate === 'ftmo' ? (
          <TemplateFtmo />
        ) : activeTemplate === 'neon' ? (
          <TemplateNeon />
        ) : activeTemplate === 'terminal' ? (
          <TemplateTerminal />
        ) : (
          <TemplateClassic data={data} />
        )}
      </main>
      <MarketingFooter />

      {/* Floating 1-Click Template Switcher */}
      <Suspense fallback={null}>
        <TemplateSwitcher currentTemplate={activeTemplate} />
      </Suspense>
    </div>
  );
}
