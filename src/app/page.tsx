import { Hero } from "@/components/landing/hero";
import { Deals } from "@/components/landing/deals";
import { About, Faq, FinalCta, HowItWorks, Paths, Stores } from "@/components/landing/sections";
import { StickyCta } from "@/components/landing/sticky-cta";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { faqs } from "@/content/landing";
import { getPublicProducts } from "@/lib/products";
import { activeCountdown, getSettings } from "@/lib/settings";
import { siteConfig } from "@/lib/site";

// Rendered per request from SQLite (sub-millisecond reads). Keeps the build from ever
// touching the production database and shows product edits immediately.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const settings = getSettings();
  const products = getPublicProducts();
  const countdown = activeCountdown(settings);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "SEPEX",
      alternateName: "سپکس",
      url: siteConfig.mainSite,
      logo: `${siteConfig.url}/brand/sepex-logo.svg`,
      ...(settings.support_phone ? { telephone: settings.support_phone } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.shortName,
      url: siteConfig.url,
      inLanguage: "fa-IR",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <SiteHeader />
      <main>
        <Hero countdownTarget={countdown.target} countdownLabel={countdown.label} />
        {products.length > 0 && (
          <section id="deals" className="scroll-mt-4 bg-white py-16 text-ink sm:py-24" aria-labelledby="deals-title">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <h2 id="deals-title" className="text-3xl font-black leading-tight sm:text-4xl">پیشنهادهای بلک‌فرایدی</h2>
                  <p className="mt-3 leading-8 text-ink/65">
                    چند کالای منتخب از فروشگاه‌های خارجی. قیمت‌ها قیمت خود فروشگاه‌اند و ممکن است تغییر کنند؛ قیمت نهایی را کارشناس اعلام می‌کند.
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <Deals products={products} />
              </div>
            </div>
          </section>
        )}
        <HowItWorks />
        <Paths />
        <Stores />
        <About />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter settings={settings} />
      <StickyCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
