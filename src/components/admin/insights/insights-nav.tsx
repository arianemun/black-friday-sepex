import Link from "next/link";
import { LinkSegments } from "@/components/admin/link-segments";
import { RANGE_KEYS, RANGE_LABELS, scopeQuery, type Scope } from "@/lib/rec/analytics";
import { cn, toFaDigits } from "@/lib/utils";

export const INSIGHT_TABS = [
  { key: "overview", href: "/admin/insights", label: "نمای کلی" },
  { key: "realtime", href: "/admin/insights/realtime", label: "لحظه‌ای" },
  { key: "acquisition", href: "/admin/insights/acquisition", label: "جذب" },
  { key: "engagement", href: "/admin/insights/engagement", label: "صفحه‌ها و رویدادها" },
  { key: "funnel", href: "/admin/insights/funnel", label: "قیف سفارش" },
  { key: "tech", href: "/admin/insights/tech", label: "دستگاه و سرعت" },
  { key: "errors", href: "/admin/insights/errors", label: "خطاها" },
  { key: "sessions", href: "/admin/insights/sessions", label: "ضبط جلسه‌ها" },
  { key: "heatmaps", href: "/admin/insights/heatmaps", label: "هیت‌مپ" },
] as const;
export type InsightTab = (typeof INSIGHT_TABS)[number]["key"];

const select =
  "h-[34px] rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[13px] text-[#18181B] outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]";

/**
 * Section tabs plus the shared filters (date range, device, source). Filters travel with the
 * links, so switching tabs keeps the same segment — like GA's comparison bar.
 */
export function InsightsNav({
  active,
  scope,
  sources = [],
  extra = {},
  filters = true,
  deviceFilter = true,
}: {
  active: InsightTab;
  scope: Scope;
  sources?: string[];
  extra?: Record<string, string | undefined>;
  filters?: boolean;
  /** Off where the page has its own device switch (heatmaps). */
  deviceFilter?: boolean;
}) {
  const base = INSIGHT_TABS.find((t) => t.key === active)!.href;
  return (
    <div className="mb-5 flex flex-col gap-3">
      <nav aria-label="بخش‌های رفتار بازدیدکننده‌ها" className="no-scrollbar -mx-1 flex overflow-x-auto border-b border-[#E4E4E7] px-1">
        {INSIGHT_TABS.map((t) => (
          <Link
            key={t.key}
            href={`${t.href}?${scopeQuery(scope)}`}
            aria-current={t.key === active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] transition-colors",
              t.key === active ? "border-[#18181B] font-bold text-[#18181B]" : "border-transparent font-medium text-[#71717A] hover:text-[#18181B]",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          <LinkSegments
            label="بازه‌ی زمانی"
            items={RANGE_KEYS.map((d) => ({
              href: `${base}?${scopeQuery({ ...scope, range: d }, extra)}`,
              label: RANGE_LABELS[d],
              active: d === scope.range,
            }))}
          />
          <form method="get" action={base} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="d" value={scope.range} />
            {Object.entries(extra).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            {deviceFilter && (
              <select name="device" defaultValue={scope.device ?? ""} className={select} aria-label="دستگاه">
                <option value="">همه‌ی دستگاه‌ها</option>
                <option value="mobile">موبایل</option>
                <option value="tablet">تبلت</option>
                <option value="desktop">دسکتاپ</option>
              </select>
            )}
            <select name="source" defaultValue={scope.source ?? ""} className={select} aria-label="منبع">
              <option value="">همه‌ی منابع</option>
              <option value="(direct)">بدون UTM</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="h-[34px] rounded-lg bg-[#18181B] px-3 text-[13px] font-semibold text-white hover:bg-[#3F3F46]">
              اعمال
            </button>
            {(scope.device || scope.source) && (
              <Link href={`${base}?${scopeQuery({ ...scope, device: undefined, source: undefined }, extra)}`} className="text-[12px] font-semibold text-[#71717A] hover:text-[#18181B]">
                حذف فیلتر
              </Link>
            )}
          </form>
        </div>
      )}
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

/** Short form for tables: 1:05 / 12 ث */
export const fmtShort = (ms: number) => {
  // Under 10 s a decimal matters (a field filled in 0.4 s is not "0 s").
  if (ms > 0 && ms < 9950) return `${toFaDigits((ms / 1000).toFixed(1)).replace(".", "٫")} ث`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${toFaDigits(s)} ث`;
  return toFaDigits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
};

export const fa = (v: number, digits = 0) => toFaDigits(digits ? v.toFixed(digits) : Math.round(v));
export const pct = (part: number, whole: number) => (whole ? `${toFaDigits(Math.round((part / whole) * 100))}٪` : "—");

export const deviceLabel: Record<string, string> = { mobile: "موبایل", tablet: "تبلت", desktop: "دسکتاپ" };

export const pageLabel = (p: string) =>
  p === "/" ? "صفحه‌ی اصلی" : p.startsWith("/order") ? "ثبت سفارش" : p.startsWith("/track") ? "پیگیری سفارش" : p;

/** "▲ 12٪" / "▼ 5٪" against the previous period; `invert` when lower is better. */
export function Delta({ now, prev, invert = false }: { now: number; prev: number; invert?: boolean }) {
  if (!prev && !now) return null;
  if (!prev) return <span className="text-[#71717A]">دوره‌ی قبل: ۰</span>;
  const d = Math.round(((now - prev) / prev) * 100);
  if (d === 0) return <span className="text-[#71717A]">بدون تغییر</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={good ? "text-[#15803D]" : "text-[#B91C1C]"}>
      {d > 0 ? "▲" : "▼"} {toFaDigits(Math.abs(d))}٪ <span className="font-normal text-[#71717A]">نسبت به دوره‌ی قبل</span>
    </span>
  );
}

/** Horizontal share bar list (single hue). */
export function ShareList({
  rows,
  total,
  href,
}: {
  rows: { label: React.ReactNode; value: number; hint?: React.ReactNode; key: string }[];
  total: number;
  href?: (key: string) => string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-[#71717A]">داده‌ای نیست.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate group-hover:text-[#2563EB]">{r.label}</span>
              <span className="shrink-0">
                <span className="font-bold">{fa(r.value)}</span>
                {r.hint && <span className="text-[#71717A]"> {r.hint}</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F4F4F5]">
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${total ? (r.value / total) * 100 : 0}%` }} />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {href ? (
              <Link href={href(r.key)} className="group flex flex-col gap-1.5">
                {inner}
              </Link>
            ) : (
              <div className="flex flex-col gap-1.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
