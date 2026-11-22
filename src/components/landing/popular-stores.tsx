import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Camera } from "lucide-react";
import { countryName, stores } from "@/lib/catalog";
import { toFaDigits } from "@/lib/utils";

/** Popular stores as logo tiles, plus "didn't find it?" and the store count. */

const FEATURED = ["taobao", "1688", "alibaba", "aliexpress", "amazon-ae", "noon", "shein", "temu", "trendyol", "namshi", "amazon-us", "ebay"];

export function PopularStores({ logos }: { logos: Record<string, string> }) {
  const list = FEATURED.map((k) => stores.find((s) => s.key === k)!).filter(Boolean);
  return (
    <section id="stores" className="scroll-mt-4 bg-black py-20 sm:py-28" aria-labelledby="stores-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div>
            <p className="text-sm font-semibold text-brand">نمی‌دانید از کجا بخرید؟</p>
            <h2 id="stores-title" className="mt-2 text-3xl font-black leading-tight text-white sm:text-[2.6rem]">سایت‌های محبوب برای خرید</h2>
            <p className="mt-3 max-w-xl leading-8 text-white/55">سر بزنید، کالا را پیدا کنید و لینکش را برای ما بفرستید. تمرکز ویژه‌ی ما روی فروشگاه‌های چین و امارات است.</p>

            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener nofollow noreferrer"
                    className="group flex h-full flex-col bg-[#111] p-4 ring-1 ring-inset ring-white/8 transition-all hover:-translate-y-0.5 hover:ring-brand/50 sm:p-5"
                  >
                    <span className="flex h-14 items-center justify-start">
                      {logos[s.key] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small static logo files
                        <img src={logos[s.key]} alt={s.name} className="max-h-10 max-w-[8rem] object-contain" loading="lazy" />
                      ) : (
                        <span className="text-2xl font-black text-white transition-colors group-hover:text-brand">{s.short ?? s.name}</span>
                      )}
                    </span>
                    <span className="mt-3 text-xs leading-5 text-white/50">{s.hint}</span>
                    <span className="mt-auto flex items-center justify-between pt-4 text-xs">
                      <span className="bg-white/[0.06] px-2 py-1 text-white/60">{countryName(s.country)}</span>
                      <span className="flex items-center gap-1 font-bold text-white/40 transition-colors group-hover:text-brand">
                        سر بزن <ArrowUpLeft className="size-3.5" />
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <aside className="flex flex-col gap-3 lg:pt-28">
            <div className="chamfer flex flex-1 flex-col items-center justify-center bg-brand p-8 text-center text-ink">
              <Camera className="size-10" strokeWidth={1.6} />
              <h3 className="mt-5 text-2xl font-black leading-snug">
                کالایی که می‌خواستی
                <br />
                پیدا نکردی؟
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink/70">عکس، اسکرین‌شات یا فقط اسمش را بفرستید؛ پیدا کردنش با ما.</p>
              <Link href="/order?method=photo" className="mt-6 inline-flex h-12 items-center gap-2 bg-ink px-6 text-sm font-black text-brand hover:bg-neutral-800">
                بفرست، پیداش می‌کنیم
                <ArrowLeft className="size-4" />
              </Link>
            </div>
            <div className="bg-[#111] p-6 ring-1 ring-inset ring-white/8">
              <p className="text-sm text-white/50">فروشگاه‌های شناخته‌شده</p>
              <p className="mt-1 text-5xl font-black text-white">
                +{toFaDigits(stores.length)}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">و هر سایت خارجی دیگری که لینکش را داشته باشید.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
