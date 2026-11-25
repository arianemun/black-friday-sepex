import Link from "next/link";
import { AlertTriangle, MousePointerClick, MousePointer2, ShoppingBag, ClipboardList } from "lucide-react";
import { requireInsights } from "@/lib/auth";
import { listSessions, parseRange, pathsList, PAGE_SIZE, sinceIso, sourcesList, type SessionFilter } from "@/lib/rec/insights";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, deviceLabel, fmtDuration, pageLabel } from "@/components/admin/insights/insights-nav";
import { adminButtonVariants, Button } from "@/components/admin-ui";
import { formatFaDateTime, toFaDigits, cn } from "@/lib/utils";

export const metadata = { title: "ضبط جلسه‌ها" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (allowed.find((a) => a === v) as T | undefined) ?? undefined;
const select =
  "h-9 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[13px] text-[#18181B] outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]";

export default async function SessionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireInsights();
  const sp = await searchParams;
  const range = parseRange(sp.d);
  const since = sinceIso(range);
  const f: SessionFilter = {
    since,
    device: pick(sp.device, ["mobile", "tablet", "desktop"] as const),
    source: sp.source || undefined,
    outcome: pick(sp.outcome, ["order", "reached", "none"] as const),
    issue: pick(sp.issue, ["rage", "dead", "error"] as const),
    path: sp.path || undefined,
    minSec: sp.min ? Math.max(0, Number(sp.min) || 0) : undefined,
    page: Math.max(1, Number(sp.page) || 1),
  };
  const { rows, total } = listSessions(f);
  const sources = sourcesList(since);
  const paths = pathsList(since);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: SP) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };
  const filtered = !!(f.device || f.source || f.outcome || f.issue || f.path || f.minSec);

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="ضبط هر جلسه را باز کنید تا ببینید بازدیدکننده دقیقاً چه کرد." />
      <InsightsNav active="sessions" range={range} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="d" value={range} />
        <select name="device" defaultValue={f.device ?? ""} className={select} aria-label="دستگاه">
          <option value="">همه‌ی دستگاه‌ها</option>
          <option value="mobile">موبایل</option>
          <option value="tablet">تبلت</option>
          <option value="desktop">دسکتاپ</option>
        </select>
        <select name="source" defaultValue={f.source ?? ""} className={select} aria-label="منبع ورود">
          <option value="">همه‌ی منابع</option>
          <option value="direct">بدون UTM</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={f.outcome ?? ""} className={select} aria-label="نتیجه">
          <option value="">هر نتیجه‌ای</option>
          <option value="order">سفارش ثبت کرد</option>
          <option value="reached">به فرم رسید، سفارش نداد</option>
          <option value="none">به فرم نرسید</option>
        </select>
        <select name="issue" defaultValue={f.issue ?? ""} className={select} aria-label="مشکل">
          <option value="">بدون فیلتر مشکل</option>
          <option value="rage">کلیک عصبی داشت</option>
          <option value="dead">کلیک بی‌اثر داشت</option>
          <option value="error">خطای صفحه داشت</option>
        </select>
        <select name="path" defaultValue={f.path ?? ""} className={select} aria-label="صفحه‌ی دیده‌شده">
          <option value="">هر صفحه‌ای</option>
          {paths.map((p) => (
            <option key={p} value={p}>
              {pageLabel(p)} ({p})
            </option>
          ))}
        </select>
        <select name="min" defaultValue={sp.min ?? ""} className={select} aria-label="حداقل مدت">
          <option value="">هر مدتی</option>
          <option value="10">بیش از ۱۰ ثانیه</option>
          <option value="30">بیش از ۳۰ ثانیه</option>
          <option value="60">بیش از ۱ دقیقه</option>
          <option value="180">بیش از ۳ دقیقه</option>
        </select>
        <Button type="submit" size="sm">
          اعمال
        </Button>
        {filtered && (
          <Link href={`/admin/insights/sessions?d=${range}`} className={adminButtonVariants({ variant: "ghost", size: "sm" })}>
            پاک کردن فیلترها
          </Link>
        )}
      </form>

      <Panel>
        <div className="-mt-1 mb-1 text-xs text-[#71717A]">{toFaDigits(total)} جلسه</div>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#71717A]">جلسه‌ای با این فیلترها پیدا نشد.</p>
        ) : (
          <ul className="-mx-4 flex flex-col divide-y divide-[#F4F4F5] sm:-mx-5">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/insights/sessions/${r.id}?d=${range}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[#FAFAFA] sm:px-5"
                >
                  <div className="min-w-[10rem] flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[#18181B]">
                      {formatFaDateTime(r.started_at)}
                      {r.visitor_sessions > 1 && (
                        <span className="rounded-md bg-[#F4F4F5] px-1.5 py-0.5 text-[11px] font-medium text-[#52525B]">بازدیدکننده‌ی تکراری، {toFaDigits(r.visitor_sessions)} جلسه</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#71717A]">
                      {deviceLabel[r.device] ?? r.device} · {r.os} · {r.browser} · {r.utm_source ? `${r.utm_source}${r.utm_campaign ? ` / ${r.utm_campaign}` : ""}` : "بدون UTM"}
                    </div>
                  </div>
                  <div className="w-28 text-[12px] text-[#3F3F46]">
                    <div className="font-semibold">{fmtDuration(r.duration_ms)}</div>
                    <div className="text-[11px] text-[#71717A]">
                      {toFaDigits(r.pages)} صفحه · اسکرول {toFaDigits(r.max_scroll)}٪
                    </div>
                  </div>
                  <div className="w-36 truncate text-[12px] text-[#3F3F46]">
                    {pageLabel(r.entry_path ?? "/")}
                    {r.exit_path && r.exit_path !== r.entry_path ? ` ← ${pageLabel(r.exit_path)}` : ""}
                  </div>
                  <div className="flex w-40 flex-wrap items-center gap-1.5">
                    {r.tracking_code ? (
                      <Chip tone="good" icon={<ShoppingBag className="size-3" />}>
                        سفارش {r.tracking_code}
                      </Chip>
                    ) : r.reached_order ? (
                      <Chip tone="info" icon={<ClipboardList className="size-3" />}>
                        رسید به فرم
                      </Chip>
                    ) : null}
                    {r.rage_clicks > 0 && (
                      <Chip tone="bad" icon={<MousePointerClick className="size-3" />}>
                        عصبی {toFaDigits(r.rage_clicks)}
                      </Chip>
                    )}
                    {r.dead_clicks > 0 && (
                      <Chip tone="warn" icon={<MousePointer2 className="size-3" />}>
                        بی‌اثر {toFaDigits(r.dead_clicks)}
                      </Chip>
                    )}
                    {r.errors > 0 && (
                      <Chip tone="bad" icon={<AlertTriangle className="size-3" />}>
                        خطا {toFaDigits(r.errors)}
                      </Chip>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="صفحه‌ها" className="flex items-center justify-center gap-2 border-t border-[#F4F4F5] pt-3 text-[13px]">
            <Link
              aria-disabled={f.page! <= 1}
              className={cn(adminButtonVariants({ variant: "ghost", size: "sm" }), f.page! <= 1 && "pointer-events-none opacity-40")}
              href={qs({ page: String(f.page! - 1) })}
            >
              قبلی
            </Link>
            <span className="text-[#71717A]">
              {toFaDigits(f.page!)} از {toFaDigits(pages)}
            </span>
            <Link
              aria-disabled={f.page! >= pages}
              className={cn(adminButtonVariants({ variant: "ghost", size: "sm" }), f.page! >= pages && "pointer-events-none opacity-40")}
              href={qs({ page: String(f.page! + 1) })}
            >
              بعدی
            </Link>
          </nav>
        )}
      </Panel>
    </>
  );
}

function Chip({ tone, icon, children }: { tone: "good" | "bad" | "warn" | "info"; icon: React.ReactNode; children: React.ReactNode }) {
  const t = {
    good: "bg-[#DCFCE7] text-[#15803D]",
    bad: "bg-[#FEE2E2] text-[#B91C1C]",
    warn: "bg-[#FEF3C7] text-[#B45309]",
    info: "bg-[#DBEAFE] text-[#1D4ED8]",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", t)}>{icon}{children}</span>;
}
