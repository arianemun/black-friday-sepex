import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SepexLogo } from "@/components/brand/logo";
import { about } from "@/content/landing";
import type { Settings } from "@/lib/settings";
import { siteConfig } from "@/lib/site";
import { toFaDigits } from "@/lib/utils";

/** Closing section: big headline over the SEPEX pattern, with a card holding CTAs and footer info. */
export function LandingFooter({ settings }: { settings: Pick<Settings, "support_phone" | "whatsapp" | "telegram" | "instagram" | "bale"> }) {
  const social = [
    { key: "instagram", label: "اینستاگرام", href: settings.instagram },
    { key: "telegram", label: "تلگرام", href: settings.telegram },
    { key: "whatsapp", label: "واتس‌اپ", href: settings.whatsapp },
    { key: "bale", label: "بله", href: settings.bale },
  ].filter((s) => /^https:\/\//.test(s.href));

  return (
    <footer className="relative isolate overflow-hidden bg-black pt-24 sm:pt-32">
      <div className="sepex-pattern pointer-events-none absolute inset-0 -z-10 opacity-[0.08] [mask-image:linear-gradient(to_bottom,transparent,#000_30%,#000)]" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="footer-giant select-none text-center font-black leading-none" aria-hidden>
          آماده‌ی بلک‌فرایدی؟
        </p>
        <div className="relative -mt-2 border border-white/10 bg-[#0d0d0d]/95 backdrop-blur sm:-mt-7">
          <div className="h-1 bg-brand" />
          <div className="flex flex-col items-center px-6 py-10 text-center sm:py-12">
            <p className="max-w-xl leading-8 text-white/65">{about.body}</p>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Link href="/order" className="chamfer-sm inline-flex h-12 items-center justify-center gap-2 bg-brand px-7 font-black text-ink hover:bg-[#ffd633]">
                ثبت سفارش
                <ArrowLeft className="size-4" />
              </Link>
              <Link href="/track" className="inline-flex h-12 items-center justify-center border border-white/20 px-7 text-sm font-bold text-white hover:border-white/50">
                پیگیری درخواست
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-center gap-5 border-t border-white/10 px-6 py-6 text-sm text-white/55 md:flex-row md:justify-between">
            <SepexLogo className="h-8 text-brand" />
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="لینک‌ها">
              <Link href="/#faq" className="hover:text-brand">سؤالات متداول</Link>
              <a href={siteConfig.mainSite} className="hover:text-brand" rel="noopener">سایت سپکس</a>
              {settings.support_phone && (
                <a href={`tel:${settings.support_phone.replace(/[^\d+]/g, "")}`} className="ltr hover:text-brand">
                  {toFaDigits(settings.support_phone)}
                </a>
              )}
              {social.map((s) => (
                <a key={s.key} href={s.href} rel="noopener nofollow" target="_blank" className="hover:text-brand">
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 pb-24 pt-6 text-xs text-white/35 sm:flex-row md:pb-6">
          <p>© {toFaDigits(new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { year: "numeric" }).format(new Date()))} سپکس. همه‌ی حقوق محفوظ است.</p>
          <p>ساخته شده با عشق ❤ توسط آرین پزشکی</p>
        </div>
      </div>
    </footer>
  );
}
