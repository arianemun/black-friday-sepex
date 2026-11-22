import Link from "next/link";
import { SepexLogo } from "@/components/brand/logo";
import { siteConfig } from "@/lib/site";
import type { Settings } from "@/lib/settings";
import { toFaDigits } from "@/lib/utils";

export function SiteFooter({ settings }: { settings: Pick<Settings, "support_phone" | "whatsapp" | "telegram" | "instagram" | "bale"> }) {
  const social = [
    { key: "instagram", label: "اینستاگرام", href: settings.instagram },
    { key: "telegram", label: "تلگرام", href: settings.telegram },
    { key: "whatsapp", label: "واتس‌اپ", href: settings.whatsapp },
    { key: "bale", label: "بله", href: settings.bale },
  ].filter((s) => /^https:\/\//.test(s.href));

  return (
    <footer className="bg-black text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <SepexLogo className="h-9 text-brand" />
          <p className="mt-5 max-w-sm text-sm leading-7">خرید از فروشگاه‌های خارجی، حمل بین‌المللی و ترخیص؛ از چین و امارات تا اروپا، آمریکا و ترکیه.</p>
        </div>
        <nav aria-label="لینک‌ها" className="flex flex-col gap-3 text-sm">
          <Link href="/order" className="hover:text-brand">ثبت سفارش</Link>
          <Link href="/track" className="hover:text-brand">پیگیری درخواست</Link>
          <Link href="/#faq" className="hover:text-brand">سؤالات متداول</Link>
          <a href={siteConfig.mainSite} className="hover:text-brand" rel="noopener">سایت سپکس</a>
        </nav>
        <div className="flex flex-col gap-3 text-sm">
          {settings.support_phone && (
            <a href={`tel:${settings.support_phone.replace(/[^\d+]/g, "")}`} className="ltr w-fit text-lg font-bold text-white hover:text-brand">
              {toFaDigits(settings.support_phone)}
            </a>
          )}
          {social.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {social.map((s) => (
                <a key={s.key} href={s.href} rel="noopener nofollow" target="_blank" className="border border-white/15 px-3 py-1.5 hover:border-brand hover:text-brand">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/45 sm:flex-row sm:justify-between sm:px-6">
          <p>© {toFaDigits(new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { year: "numeric" }).format(new Date()))} سپکس. همه‌ی حقوق محفوظ است.</p>
          <p>ساخته شده با عشق ❤ توسط آرین پزشکی</p>
        </div>
      </div>
    </footer>
  );
}
