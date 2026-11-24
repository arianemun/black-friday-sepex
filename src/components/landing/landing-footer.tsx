import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SepexLogo } from "@/components/brand/logo";
import { about } from "@/content/landing";
import type { Settings } from "@/lib/settings";
import { siteConfig } from "@/lib/site";
import { toFaDigits } from "@/lib/utils";

/** Deterministic barcode bars (x, width) from a seed string, so server and client render the same SVG. */
function barcode(seed: string) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  let h = 7;
  for (let i = 0; x < 236; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length)) % 997;
    const w = 1 + (h % 3);
    const gap = 1 + ((h >> 2) % 3);
    bars.push({ x, w });
    x += w + gap;
  }
  return bars;
}

const ORIGINS = ["CN", "AE", "EU", "US", "TR"];

/**
 * Closing section styled as a SEPEX shipping label: the route and CTAs on the main
 * panel, a tear-off stub with the barcode and contact links.
 */
export function LandingFooter({ settings }: { settings: Pick<Settings, "support_phone" | "whatsapp" | "telegram" | "instagram" | "bale"> }) {
  const social = [
    { key: "instagram", label: "اینستاگرام", href: settings.instagram },
    { key: "telegram", label: "تلگرام", href: settings.telegram },
    { key: "whatsapp", label: "واتس‌اپ", href: settings.whatsapp },
    { key: "bale", label: "بله", href: settings.bale },
  ].filter((s) => /^https:\/\//.test(s.href));
  const latinYear = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { year: "numeric" }).format(new Date());
  const year = toFaDigits(latinYear);
  const bars = barcode("SPX-BF-SEPEX-BLACKFRIDAY");

  return (
    <footer className="relative isolate overflow-hidden bg-black pt-24 sm:pt-32">
      <div className="sepex-pattern pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 opacity-[0.07] [mask-image:linear-gradient(to_bottom,transparent,#000)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_55%,rgb(255_203_5/0.12),transparent_70%)]" aria-hidden />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-5xl md:-rotate-[1.2deg] drop-shadow-[0_40px_60px_rgb(0_0_0/0.6)] transition-transform duration-500 hover:rotate-0">
          <div className="label-notch grid bg-brand text-ink md:grid-cols-[1fr_15rem]">
            {/* main panel */}
            <div className="flex flex-col p-6 sm:p-10">
              <div className="flex items-center justify-between gap-4 border-b-2 border-ink pb-4">
                <SepexLogo className="h-8 sm:h-9" />
                <span className="text-sm font-black">بارنامه‌ی بلک‌فرایدی</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-b-2 border-ink py-6 sm:gap-6 sm:py-8">
                <div>
                  <p className="text-xs font-bold text-ink/60">مبدأ</p>
                  <p className="mt-1 text-2xl font-black leading-tight sm:text-4xl">هر جای دنیا</p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black tracking-wider" dir="ltr">
                    {ORIGINS.map((o) => (
                      <span key={o} className="bg-ink px-1.5 py-0.5 text-brand">
                        {o}
                      </span>
                    ))}
                  </p>
                </div>
                <ArrowLeft className="mb-3 size-8 sm:size-12" strokeWidth={2.4} aria-hidden />
                <div className="text-left">
                  <p className="text-xs font-bold text-ink/60">مقصد</p>
                  <p className="mt-1 text-2xl font-black leading-tight sm:text-4xl">درِ خونه‌ی تو</p>
                  <p className="mt-2 flex text-[11px] font-black tracking-wider" dir="ltr">
                    <span className="bg-ink px-1.5 py-0.5 text-brand">IR</span>
                  </p>
                </div>
              </div>

              <p className="max-w-xl py-6 text-sm leading-7 text-ink/75 sm:text-base sm:leading-8">{about.body}</p>

              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <Link href="/order" className="chamfer-sm inline-flex h-12 items-center justify-center gap-2 bg-ink px-7 font-black text-brand transition-colors hover:bg-[#222]">
                  ثبت سفارش
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
                <Link href="/track" className="chamfer-sm inline-flex h-12 items-center justify-center bg-ink/10 px-7 text-sm font-black text-ink transition-colors hover:bg-ink/20">
                  پیگیری درخواست
                </Link>
              </div>
            </div>

            {/* tear-off stub */}
            <div className="relative flex flex-col gap-5 border-t-2 border-dashed border-ink/50 p-6 sm:p-8 md:border-r-2 md:border-t-0">
              <div>
                <p className="text-xs font-bold text-ink/60">کد مرسوله</p>
                <p className="mt-1 font-black tracking-widest" dir="ltr">
                  SPX-BF-{latinYear}
                </p>
              </div>
              <svg viewBox="0 0 236 56" className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
                {bars.map((b) => (
                  <rect key={b.x} x={b.x} y="0" width={b.w} height="56" fill="#000" />
                ))}
              </svg>
              <nav className="flex flex-col gap-2.5 text-sm font-bold" aria-label="لینک‌های پایانی">
                <Link href="/#faq" className="hover:underline">
                  سؤالات متداول
                </Link>
                <a href={siteConfig.mainSite} className="hover:underline" rel="noopener">
                  سایت سپکس
                </a>
                {settings.support_phone && (
                  <a href={`tel:${settings.support_phone.replace(/[^\d+]/g, "")}`} className="ltr text-right hover:underline">
                    {toFaDigits(settings.support_phone)}
                  </a>
                )}
              </nav>
              {social.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {social.map((s) => (
                    <a key={s.key} href={s.href} rel="noopener nofollow" target="_blank" className="bg-ink px-2.5 py-1 text-xs font-bold text-brand hover:bg-[#222]">
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 pb-24 pt-14 text-xs text-white/35 sm:flex-row md:pb-8">
          <p>© {year} سپکس. همه‌ی حقوق محفوظ است.</p>
          <p>ساخته شده با عشق ❤ توسط آرین پزشکی</p>
        </div>
      </div>
    </footer>
  );
}
