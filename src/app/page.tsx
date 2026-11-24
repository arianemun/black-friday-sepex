import { Hero } from "@/components/landing/hero";
import { DealsCoverflow } from "@/components/landing/deals-coverflow";
import { CategoryWall } from "@/components/landing/category-wall";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PopularStores } from "@/components/landing/popular-stores";
import { ShuffleDeck } from "@/components/landing/shuffle-deck";
import { RouteOrbit } from "@/components/landing/route-orbit";
import { LandingFooter } from "@/components/landing/landing-footer";
import { storeLogos } from "@/lib/store-logos";
import { Faq, Paths } from "@/components/landing/sections";
import { StickyCta } from "@/components/landing/sticky-cta";
import { SiteHeader } from "@/components/site/site-header";
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
        <Hero countdownTarget={countdown.target} />
        <Paths />
        {products.length > 0 && (
          <section id="deals" className="relative isolate scroll-mt-4 overflow-hidden bg-black py-20 text-white sm:py-24" aria-labelledby="deals-title">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_45%,rgb(255_203_5/0.08),transparent_70%)]" aria-hidden />
            <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
              <h2 id="deals-title" className="text-3xl font-black leading-tight sm:text-[2.6rem]">پیشنهادهای بلک‌فرایدی</h2>
              <p className="mx-auto mt-3 max-w-2xl leading-8 text-white/55">
                چندتا کالای منتخب از فروشگاه‌های خارجی. قیمت‌ها مال خود فروشگاهه و ممکنه عوض بشه؛ قیمت نهایی رو کارشناس بهت می‌گه.
              </p>
              <div className="mt-12">
                <DealsCoverflow products={products} />
              </div>
            </div>
          </section>
        )}
        <CategoryWall />
        <HowItWorks />
        <PopularStores logos={storeLogos()} />
        <ShuffleDeck products={products} />
        <RouteOrbit />
        <Faq />
      </main>
      <LandingFooter settings={settings} />
      <StickyCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
