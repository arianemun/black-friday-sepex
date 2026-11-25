import Link from "next/link";
import { AlertTriangle, MousePointerClick, MousePointer2, ShoppingBag, ClipboardList, Star, Eye, Radio, Undo2, WifiOff, StickyNote } from "lucide-react";
import { requireInsights } from "@/lib/auth";
import { EVENT_LABELS, parseScope, scopeQuery, sourceOptions } from "@/lib/rec/analytics";
import { eventNames, listSessions, pathsList, PAGE_SIZE, type SessionFilter } from "@/lib/rec/insights";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, deviceLabel, fmtDuration, pageLabel } from "@/components/admin/insights/insights-nav";
import { adminButtonVariants, Button } from "@/components/admin-ui";
import { formatFaDateTime, toFaDigits, cn } from "@/lib/utils";

export const metadata = { title: "ضبط جلسه‌ها" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => allowed.find((a) => a === v) as T | undefined;
const select =
  "h-9 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[13px] text-[#18181B] outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]";
/** Filters that belong to this page (range, device and source are in the shared nav). */
const OWN = ["outcome", "issue", "path", "event", "min", "engaged", "visitor", "unwatched", "starred", "staff"] as const;
const LIVE_MS = 2 * 60_000;
/** Still sending heartbeats: the visitor is on the site right now. */
const isLive = (lastAt: string) => Date.now() - Date.parse(lastAt) < LIVE_MS;

export default async function SessionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireInsights();
  const sp = await searchParams;
  const scope = parseScope(sp);
  const f: SessionFilter = {
    outcome: pick(sp.outcome, ["order", "reached", "none"] as const),
    issue: pick(sp.issue, ["rage", "dead", "error", "net", "quickback", "scroll"] as const),
    path: sp.path || undefined,
    event: sp.event || undefined,
    minSec: sp.min ? Math.max(0, Number(sp.min) || 0) : undefined,
    engaged: sp.engaged === "1",
    visitor: pick(sp.visitor, ["new", "returning"] as const),
    unwatched: sp.unwatched === "1",
    starred: sp.starred === "1",
    staff: sp.staff === "1",
    page: Math.max(1, Number(sp.page) || 1),
  };
  const { rows, total } = listSessions(scope, f);
  const paths = pathsList(scope);
  const events = eventNames(scope);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const own: SP = Object.fromEntries(OWN.map((k) => [k, sp[k]]));
  const base = scopeQuery(scope);
  const qs = (patch: SP) => `?${scopeQuery(scope, { ...own, ...patch })}`;
  const filtered = OWN.some((k) => !!sp[k]);

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="ضبط هر جلسه را باز کنید تا ببینید بازدیدکننده دقیقاً چه کرد." />
      <InsightsNav active="sessions" scope={scope} sources={sourceOptions(scope)} extra={own} />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="d" value={scope.range} />
        {scope.device && <input type="hidden" name="device" value={scope.device} />}
        {scope.source && <input type="hidden" name="source" value={scope.source} />}
        <select name="outcome" defaultValue={f.outcome ?? ""} className={select} aria-label="نتیجه">
          <option value="">هر نتیجه‌ای</option>
          <option value="order">سفارش ثبت کرد</option>
          <option value="reached">به فرم رسید، سفارش نداد</option>
          <option value="none">به فرم نرسید</option>
        </select>
        <select name="issue" defaultValue={f.issue ?? ""} className={select} aria-label="مشکل">
          <option value="">بدون فیلتر مشکل</option>
          <option value="rage">کلیک عصبی</option>
          <option value="dead">کلیک بی‌اثر</option>
          <option value="quickback">برگشت سریع</option>
          <option value="scroll">اسکرول سرگردان</option>
          <option value="error">خطای صفحه</option>
          <option value="net">درخواست ناموفق به سرور</option>
        </select>
        <select name="path" defaultValue={f.path ?? ""} className={select} aria-label="صفحه‌ی دیده‌شده">
          <option value="">هر صفحه‌ای</option>
          {paths.map((p) => (
            <option key={p} value={p}>
              {pageLabel(p)} ({p})
            </option>
          ))}
        </select>
        <select name="event" defaultValue={f.event ?? ""} className={select} aria-label="رویداد">
          <option value="">هر رویدادی</option>
          {events.map((e) => (
            <option key={e} value={e}>
              {EVENT_LABELS[e] ?? e}
            </option>
          ))}
        </select>
        <select name="min" defaultValue={sp.min ?? ""} className={select} aria-label="حداقل زمان فعال">
          <option value="">هر مدتی</option>
          <option value="10">فعال بیش از ۱۰ ثانیه</option>
          <option value="30">فعال بیش از ۳۰ ثانیه</option>
          <option value="60">فعال بیش از ۱ دقیقه</option>
          <option value="180">فعال بیش از ۳ دقیقه</option>
        </select>
        <select name="visitor" defaultValue={f.visitor ?? ""} className={select} aria-label="نوع بازدیدکننده">
          <option value="">جدید و برگشتی</option>
          <option value="new">فقط جدید</option>
          <option value="returning">فقط برگشتی</option>
        </select>
        <Check name="engaged" on={f.engaged} label="فقط درگیرشده" />
        <Check name="unwatched" on={f.unwatched} label="دیده‌نشده" />
        <Check name="starred" on={f.starred} label="ستاره‌دار" />
        <Check name="staff" on={f.staff} label="جلسه‌های همکاران" />
        <Button type="submit" size="sm">
          اعمال
        </Button>
        {filtered && (
          <Link href={`/admin/insights/sessions?${base}`} className={adminButtonVariants({ variant: "ghost", size: "sm" })}>
            پاک کردن فیلترها
          </Link>
        )}
      </form>

      <Panel>
        <div className="-mt-1 mb-1 text-xs text-[#71717A]">
          {toFaDigits(total)} جلسه{f.staff ? " از همکاران (در آمارها شمرده نمی‌شوند)" : ""}
        </div>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#71717A]">جلسه‌ای با این فیلترها پیدا نشد. بازه‌ی زمانی را بزرگ‌تر کنید یا فیلترها را پاک کنید.</p>
        ) : (
          <ul className="-mx-4 flex flex-col divide-y divide-[#F4F4F5] sm:-mx-5">
            {rows.map((r) => {
              const live = isLive(r.last_at);
              return (
                <li key={r.id}>
                  <Link
                    href={`/admin/insights/sessions/${r.id}?${base}${live ? "&live=1" : ""}`}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[#FAFAFA] sm:px-5",
                      r.watched_at && "bg-[#FCFCFC]",
                    )}
                  >
                    <div className="min-w-[11rem] flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[#18181B]">
                        {r.starred ? <Star className="size-3.5 fill-[#F59E0B] text-[#F59E0B]" aria-label="ستاره‌دار" /> : null}
                        {formatFaDateTime(r.started_at)}
                        {live && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-1.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                            <Radio className="size-3" /> الان روی سایت
                          </span>
                        )}
                        {r.return_visit ? (
                          <span className="rounded-md bg-[#F4F4F5] px-1.5 py-0.5 text-[11px] font-medium text-[#52525B]">
                            برگشتی{r.visitor_sessions > 1 ? `، ${toFaDigits(r.visitor_sessions)} جلسه` : ""}
                          </span>
                        ) : null}
                        {r.watched_at ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[#A1A1AA]" title={`دیده‌شده توسط ${r.watched_name ?? "همکار"}`}>
                            <Eye className="size-3" /> {r.watched_name ?? "دیده‌شده"}
                          </span>
                        ) : null}
                        {r.note ? <StickyNote className="size-3.5 text-[#71717A]" aria-label="یادداشت دارد" /> : null}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#71717A]">
                        {deviceLabel[r.device] ?? r.device}، {r.os}، {r.browser}،{" "}
                        {r.utm_source ? `${r.utm_source}${r.utm_medium ? ` / ${r.utm_medium}` : ""}${r.utm_campaign ? ` / ${r.utm_campaign}` : ""}` : r.referrer ? new URL(r.referrer).hostname : "مستقیم"}
                      </div>
                    </div>
                    <div className="w-32 text-[12px] text-[#3F3F46]">
                      <div className="font-semibold">
                        {fmtDuration(r.active_ms)} <span className="text-[11px] font-normal text-[#A1A1AA]">فعال</span>
                      </div>
                      <div className="text-[11px] text-[#71717A]">
                        {toFaDigits(r.pages)} صفحه، اسکرول {toFaDigits(r.max_scroll)}٪
                      </div>
                    </div>
                    <div className="w-40 truncate text-[12px] text-[#3F3F46]">
                      {pageLabel(r.entry_path ?? "/")}
                      {r.exit_path && r.exit_path !== r.entry_path ? ` ← ${pageLabel(r.exit_path)}` : ""}
                      {r.events > 0 && <div className="text-[11px] text-[#71717A]">{toFaDigits(r.events)} رویداد</div>}
                    </div>
                    <div className="flex w-48 flex-wrap items-center gap-1.5">
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
                      {r.quick_backs > 0 && (
                        <Chip tone="warn" icon={<Undo2 className="size-3" />}>
                          برگشت سریع
                        </Chip>
                      )}
                      {r.errors > 0 && (
                        <Chip tone="bad" icon={<AlertTriangle className="size-3" />}>
                          خطا {toFaDigits(r.errors)}
                        </Chip>
                      )}
                      {r.net_errors > 0 && (
                        <Chip tone="bad" icon={<WifiOff className="size-3" />}>
                          شبکه {toFaDigits(r.net_errors)}
                        </Chip>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
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

function Check({ name, on, label }: { name: string; on?: boolean; label: string }) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[13px] text-[#3F3F46] has-[:checked]:border-[#18181B] has-[:checked]:text-[#18181B]">
      <input type="checkbox" name={name} value="1" defaultChecked={on} className="size-3.5 accent-[#18181B]" />
      {label}
    </label>
  );
}

function Chip({ tone, icon, children }: { tone: "good" | "bad" | "warn" | "info"; icon: React.ReactNode; children: React.ReactNode }) {
  const t = {
    good: "bg-[#DCFCE7] text-[#15803D]",
    bad: "bg-[#FEE2E2] text-[#B91C1C]",
    warn: "bg-[#FEF3C7] text-[#B45309]",
    info: "bg-[#DBEAFE] text-[#1D4ED8]",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", t)}>
      {icon}
      {children}
    </span>
  );
}
