import Link from "next/link";
import { LinkSegments } from "@/components/admin/link-segments";
import { RANGES, type RangeDays } from "@/lib/rec/insights";
import { cn, toFaDigits } from "@/lib/utils";

const TABS = [
  { key: "overview", href: "/admin/insights", label: "نمای کلی" },
  { key: "sessions", href: "/admin/insights/sessions", label: "ضبط جلسه‌ها" },
  { key: "heatmaps", href: "/admin/insights/heatmaps", label: "هیت‌مپ" },
] as const;

/** Section tabs plus the shared date range (kept across tabs via ?d=). */
export function InsightsNav({ active, range, extra = "" }: { active: (typeof TABS)[number]["key"]; range: RangeDays; extra?: string }) {
  const base = TABS.find((t) => t.key === active)!.href;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7]">
      <nav aria-label="بخش‌های رفتار بازدیدکننده‌ها" className="no-scrollbar -mb-px flex overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${t.href}?d=${range}`}
            aria-current={t.key === active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] transition-colors",
              t.key === active ? "border-[#18181B] font-bold text-[#18181B]" : "border-transparent font-medium text-[#71717A] hover:text-[#18181B]",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <LinkSegments
        label="بازه‌ی زمانی"
        className="mb-2"
        items={(Object.keys(RANGES) as unknown as RangeDays[]).map((d) => ({
          href: `${base}?d=${d}${extra}`,
          label: RANGES[d],
          active: Number(d) === range,
        }))}
      />
    </div>
  );
}

export const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${toFaDigits(s)} ثانیه`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${toFaDigits(m)} دقیقه${s % 60 ? ` و ${toFaDigits(s % 60)} ثانیه` : ""}`;
  return `${toFaDigits(Math.floor(m / 60))} ساعت و ${toFaDigits(m % 60)} دقیقه`;
};

export const deviceLabel: Record<string, string> = { mobile: "موبایل", tablet: "تبلت", desktop: "دسکتاپ" };

export const pageLabel = (p: string) => (p === "/" ? "صفحه‌ی اصلی" : p.startsWith("/order") ? "ثبت سفارش" : p.startsWith("/track") ? "پیگیری" : p);
