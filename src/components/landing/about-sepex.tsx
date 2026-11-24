import { ArrowUpLeft, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SepexLogoAssemble, SepexMark } from "@/components/brand/logo";
import { about } from "@/content/landing";
import { siteConfig } from "@/lib/site";
import { PointerStage, Reveal } from "./reveal";

const POINTS = [
  { title: "خرید از فروشگاه", body: "کالایی که می‌خوای رو از فروشگاه خارجی برات می‌خریم." },
  { title: "حمل بین‌المللی", body: "از مبدأ تا ایران، با شبکه‌ی لجستیک سپکس." },
  { title: "ترخیص و تحویل", body: "ترخیص گمرکی با ماست؛ هر مرحله رو با یه کد پیگیری می‌بینی." },
];

/** Who is behind the campaign: the SEPEX logo, big, and what SEPEX does. */
export function AboutSepex() {
  return (
    <section id="sepex" className="relative isolate scroll-mt-4 overflow-hidden bg-black py-20 sm:py-28" aria-labelledby="sepex-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <Reveal>
          <PointerStage className="relative">
            <div className="chamfer relative aspect-[5/4] overflow-hidden bg-[#0b0b0b]">
              <div className="sepex-pattern pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_45%,rgb(255_203_5/0.16),transparent_70%)]" aria-hidden />
              <div className="parallax absolute inset-0 flex items-center justify-center p-[14%] [--depth:14px]">
                <SepexLogoAssemble className="text-brand drop-shadow-[0_0_40px_rgb(255_203_5/0.35)]" />
              </div>
            </div>
            <span className="absolute -bottom-3 left-6 bg-brand px-3 py-1 text-xs font-black text-ink">بلک‌فرایدی ۱۴۰۵</span>
          </PointerStage>
        </Reveal>

        <Reveal>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand">
            <SepexMark className="h-3" /> سپکس کیه؟
          </span>
          <h2 id="sepex-title" className="mt-4 text-3xl font-black leading-tight text-white sm:text-[2.6rem]">
            پشت این بلک‌فرایدی،
            <br />
            سپکس ایستاده
          </h2>
          <p className="mt-5 leading-8 text-white/60">{about.body}</p>
          <ul className="mt-8 grid gap-4">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <SepexMark className="mt-1.5 h-3 shrink-0 text-brand" />
                <span>
                  <span className="block font-black text-white">{p.title}</span>
                  <span className="mt-0.5 block text-sm leading-7 text-white/55">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-2">
            <Link href="/order" className="chamfer-sm inline-flex h-12 items-center gap-2 bg-brand px-6 text-sm font-black text-ink transition-colors hover:bg-[#ffd633]">
              ثبت سفارش
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <a href={siteConfig.mainSite} target="_blank" rel="noopener" className="chamfer-sm inline-flex h-12 items-center gap-2 bg-white/[0.08] px-5 text-sm font-bold text-white transition-colors hover:bg-white/[0.14]">
              سایت سپکس
              <ArrowUpLeft className="size-4" aria-hidden />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
