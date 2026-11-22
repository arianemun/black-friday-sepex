import Link from "next/link";
import { hero } from "@/content/landing";
import { countries } from "@/lib/catalog";
import { Countdown } from "./countdown";
import { LinkStarter } from "./link-starter";

/**
 * The page's one bold idea: a cargo waybill. "From: any store in the world → To: Iran",
 * with the link input inside the label.
 */
export function Hero({ countdownTarget, countdownLabel }: { countdownTarget: string; countdownLabel: string }) {
  return (
    <section className="relative overflow-hidden bg-black pt-24 text-white sm:pt-28" aria-labelledby="hero-title">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pb-24">
        <div>
          <p dir="ltr" className="hero-wordmark text-right font-black leading-none tracking-tight text-brand" aria-hidden>
            {hero.wordmark}
          </p>
          <h1 id="hero-title" className="mt-5 whitespace-pre-line text-4xl font-black leading-[1.25] sm:text-5xl lg:text-[3.6rem]">
            {hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/70 sm:text-lg">{hero.lead}</p>
          <Countdown className="mt-8" target={countdownTarget} label={countdownLabel} doneLabel="بلک‌فرایدی شروع شده؛ همین حالا سفارش بدهید." />
        </div>

        <div className="waybill relative">
          <div className="chamfer bg-brand text-ink shadow-[0_30px_80px_-30px_rgb(255_203_5/0.45)]">
            <div className="stripes-yellow h-3" aria-hidden />
            <div className="p-5 sm:p-7">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 border-b-2 border-ink pb-5 text-sm">
                <span className="font-bold text-ink/60">از</span>
                <span className="font-black">هر فروشگاهی در دنیا</span>
                <span className="font-bold text-ink/60">به</span>
                <span className="font-black">ایران</span>
                <span className="font-bold text-ink/60">مسیر</span>
                <span className="flex flex-wrap gap-1.5">
                  {countries.map((c, i) => (
                    <span key={c.code} className={i < 2 ? "bg-ink px-2 py-0.5 text-xs font-bold text-brand" : "border border-ink/40 px-2 py-0.5 text-xs font-semibold"}>
                      {c.name}
                    </span>
                  ))}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-black sm:text-2xl">کالایی که می‌خواهید کجاست؟</h2>
              <div className="mt-4">
                <LinkStarter placeholder={hero.inputPlaceholder} submit={hero.submit} />
              </div>
              <div className="mt-2 flex flex-col gap-2 border-t border-ink/20 pt-4 sm:flex-row sm:flex-wrap">
                {hero.alt.map((a) => (
                  <Link key={a.href} href={a.href} className="text-sm font-bold underline decoration-ink/30 decoration-2 underline-offset-4 hover:decoration-ink">
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="waybill-stamp pointer-events-none absolute -left-2 -top-5 rotate-[-8deg] border-[3px] border-brand bg-black px-3 py-1 text-sm font-black text-brand sm:-left-5" aria-hidden>
            خرید، حمل، ترخیص
          </div>
        </div>
      </div>

      <div className="relative border-y border-white/10 bg-white/[0.03]">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4" aria-label="چرا سپکس">
          {hero.facts.map((f) => (
            <li key={f} className="flex items-center gap-2.5 border-white/10 py-4 text-sm text-white/80 [&:not(:last-child)]:lg:border-l lg:px-5 lg:first:pr-0">
              <span className="size-2 shrink-0 rotate-45 bg-brand" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
