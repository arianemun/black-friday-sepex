import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { STORE_PRIORITY, activeDeal, countryName, storeLabel, suggestedStores } from "@/lib/catalog";
import { toFaDigits } from "@/lib/utils";
import { StoreBrowser, type StoreTile } from "./store-browser";

/** Stores worth buying from, filterable by category and country, most requested first. */
export function PopularStores({ logos, popularity, today }: { logos: Record<string, string>; popularity: Record<string, number>; today: string }) {
  const list = suggestedStores();
  // Most requested first; then our priority list; then the catalog order.
  const rank = (k: string) => {
    const i = STORE_PRIORITY.indexOf(k);
    return i >= 0 ? i : 100 + list.findIndex((s) => s.key === k);
  };
  const ranked = [...list].sort((a, b) => (popularity[b.key] ?? 0) - (popularity[a.key] ?? 0) || rank(a.key) - rank(b.key));
  // "Popular with our customers": the top few that people actually ordered from, more than once.
  const hot = new Set(ranked.filter((s) => (popularity[s.key] ?? 0) >= 2).slice(0, 6).map((s) => s.key));
  const tiles: StoreTile[] = ranked.map((s) => ({
    key: s.key,
    label: storeLabel(s),
    name: s.name,
    url: s.url,
    hint: s.hint ?? "",
    country: s.country,
    countryName: countryName(s.country),
    cats: s.cats ?? [],
    official: !!s.official,
    logo: logos[s.key],
    deal: activeDeal(s, today),
    hot: hot.has(s.key),
  }));

  return (
    <section id="stores" className="scroll-mt-4 bg-black py-20 sm:py-28" aria-labelledby="stores-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand">نمی‌دونی از کجا بخری؟</p>
            <h2 id="stores-title" className="mt-2 text-3xl font-black leading-tight text-white sm:text-[2.6rem]">سایت‌های محبوب برای خرید</h2>
            <p className="mt-3 max-w-xl leading-8 text-white/55">
              دسته‌ی کالات رو انتخاب کن، یه سر به سایتش بزن و لینک کالا رو برامون بفرست. به این فهرست هم محدود نیستی.
            </p>
            <StoreBrowser tiles={tiles} />
          </div>

          <aside className="flex flex-col gap-3 lg:pt-28">
            <div className="chamfer flex flex-1 flex-col items-center justify-center bg-brand p-8 text-center text-ink">
              <Camera className="size-10" strokeWidth={1.6} />
              <h3 className="mt-5 text-2xl font-black leading-snug">
                کالایی که می‌خواستی
                <br />
                پیدا نکردی؟
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink/70">عکس، اسکرین‌شات یا فقط اسمش رو بفرست؛ پیدا کردنش با ما.</p>
              <Link href="/order?method=photo" className="chamfer-sm mt-6 inline-flex h-12 items-center gap-2 bg-ink px-6 text-sm font-black text-brand hover:bg-neutral-800">
                بفرست، پیداش می‌کنیم
                <ArrowLeft className="size-4" />
              </Link>
            </div>
            <div className="bg-[#111] p-6 ring-1 ring-inset ring-white/8">
              <p className="text-sm text-white/50">فروشگاه و برند پیشنهادی</p>
              <p className="mt-1 text-5xl font-black text-white">+{toFaDigits(list.length)}</p>
              <p className="mt-2 text-sm leading-6 text-white/55">و هر سایت خارجی دیگه‌ای که لینکش رو داشته باشی.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
