import Link from "next/link";
import { requireInsights } from "@/lib/auth";
import { byDevice, byPage, bySource, overview, parseRange, problemElements, sinceIso, timeline, topErrors } from "@/lib/rec/insights";
import { KpiCard, PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, deviceLabel, fmtDuration, pageLabel } from "@/components/admin/insights/insights-nav";
import { AdminTable, AdminTd, AdminTh, AdminTHead, AdminTr } from "@/components/admin-ui";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "رفتار بازدیدکننده‌ها" };
export const dynamic = "force-dynamic";

const fa = (n: number) => toFaDigits(Math.round(n));
const pct = (part: number, whole: number) => (whole ? `${toFaDigits(Math.round((part / whole) * 100))}٪` : "—");

function bucketLabel(b: string, hourly: boolean) {
  if (hourly) return toFaDigits(Number(b.slice(11, 13)));
  const d = new Date(`${b}T12:00:00Z`);
  return new Intl.DateTimeFormat("fa-IR", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(d);
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireInsights();
  const range = parseRange((await searchParams).d);
  const since = sinceIso(range);
  const o = overview(since);
  const series = timeline(range, since);
  const max = Math.max(1, ...series.map((s) => s.sessions));
  const devices = byDevice(since);
  const sources = bySource(since);
  const pages = byPage(since);
  const rage = problemElements(since, "rage");
  const dead = problemElements(since, "dead");
  const errors = topErrors(since);
  const q = `d=${range}`;

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="بازدیدکننده‌ها در سایت چه می‌کنند، کجا گیر می‌کنند و چند نفرشان به ثبت سفارش می‌رسند." />
      <InsightsNav active="overview" range={range} />

      {o.sessions === 0 ? (
        <Panel>
          <p className="py-16 text-center text-sm text-[#71717A]">در این بازه هنوز جلسه‌ای ضبط نشده است.</p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard label="جلسه‌ها" value={fa(o.sessions)} hint={`${fa(o.visitors)} بازدیدکننده`} />
            <KpiCard label="میانگین ماندن" value={fmtDuration(o.avgMs)} hint={`${toFaDigits(o.pages.toFixed(1))} صفحه در هر جلسه`} />
            <KpiCard
              label="ثبت سفارش"
              value={fa(o.orders)}
              hintTone={o.orders ? "good" : "muted"}
              hint={`نرخ تبدیل ${pct(o.orders, o.sessions)}`}
            />
            <KpiCard
              label="خروج سریع"
              value={pct(o.bounces, o.sessions)}
              hintTone={o.bounces / Math.max(1, o.sessions) > 0.5 ? "bad" : "muted"}
              hint="یک صفحه و کمتر از ۱۰ ثانیه"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title={range === 1 ? "جلسه‌ها در ۲۴ ساعت اخیر" : `جلسه‌ها در ${toFaDigits(range)} روز اخیر`} className="lg:col-span-2">
              <div className="flex h-[200px] items-end gap-[3px] border-b border-[#E4E4E7] px-1" role="img" aria-label="نمودار تعداد جلسه‌ها">
                {series.map((s) => (
                  <div key={s.bucket} className="group relative flex h-full min-w-0 flex-1 items-end">
                    <div
                      className="w-full rounded-t-[4px] bg-[#2563EB] transition-colors group-hover:bg-[#1D4ED8]"
                      style={{ height: `${s.sessions ? Math.max(2, Math.round((s.sessions / max) * 100)) : 0}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#18181B] px-2 py-1 text-[11px] text-white group-hover:block">
                      {fa(s.sessions)} جلسه، {fa(s.orders)} سفارش
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-[3px] px-1 text-[10px] text-[#71717A]">
                {series.map((s, i) => (
                  <span key={s.bucket} className="min-w-0 flex-1 truncate text-center">
                    {range === 30 && i % 3 !== 0 ? "" : bucketLabel(s.bucket, range === 1)}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel title="قیف تبدیل">
              <Funnel
                steps={[
                  { label: "ورود به سایت", value: o.sessions },
                  { label: "رسیدن به فرم سفارش", value: o.reached },
                  { label: "ثبت سفارش", value: o.orders },
                ]}
              />
              <Link href={`/admin/insights/sessions?${q}&outcome=reached`} className="mt-auto text-xs font-semibold text-[#2563EB] hover:underline">
                ضبط کسانی که به فرم رسیدند ولی سفارش ندادند
              </Link>
            </Panel>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <SignalCard label="کلیک‌های عصبی" value={o.rage} total={o.sessions} href={`/admin/insights/sessions?${q}&issue=rage`} hint="چند کلیک پشت‌سرهم روی یک نقطه" />
            <SignalCard label="کلیک بی‌اثر" value={o.dead} total={o.sessions} href={`/admin/insights/sessions?${q}&issue=dead`} hint="کلیک روی چیزی که کاری نکرد" />
            <SignalCard label="خطای صفحه" value={o.errors} total={o.sessions} href={`/admin/insights/sessions?${q}&issue=error`} hint="خطای جاوااسکریپت در مرورگر" />
            <KpiCard label="میانگین اسکرول" value={`${fa(o.scroll)}٪`} hint="از ارتفاع صفحه دیده شده" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="منبع ورود">
              <AdminTable>
                <AdminTHead>
                  <tr>
                  <AdminTh>منبع</AdminTh>
                  <AdminTh className="text-left">جلسه</AdminTh>
                  <AdminTh className="text-left">به فرم رسید</AdminTh>
                  <AdminTh className="text-left">سفارش</AdminTh>
                  </tr>
                </AdminTHead>
                <tbody>
                  {sources.map((s) => (
                    <AdminTr key={`${s.source}|${s.detail}`}>
                      <AdminTd>
                        <div className="font-semibold">{s.source}</div>
                        {s.detail && <div className="text-[11px] text-[#71717A]">{s.detail}</div>}
                      </AdminTd>
                      <AdminTd className="text-left">{fa(s.sessions)}</AdminTd>
                      <AdminTd className="text-left">{pct(s.reached, s.sessions)}</AdminTd>
                      <AdminTd className="text-left font-bold">{fa(s.orders)}</AdminTd>
                    </AdminTr>
                  ))}
                </tbody>
              </AdminTable>
            </Panel>

            <Panel title="دستگاه">
              <div className="flex flex-col gap-3.5">
                {devices.map((d) => (
                  <Link key={d.device} href={`/admin/insights/sessions?${q}&device=${d.device}`} className="group flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="group-hover:text-[#2563EB]">{deviceLabel[d.device] ?? d.device}</span>
                      <span>
                        <span className="font-bold">{fa(d.sessions)}</span>
                        <span className="text-[#71717A]">
                          {" "}
                          جلسه، {fa(d.orders)} سفارش، میانگین {fmtDuration(d.avg_ms ?? 0)}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F4F4F5]">
                      <div className="h-full rounded-full bg-[#18181B]" style={{ width: `${(d.sessions / o.sessions) * 100}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="صفحه‌ها">
            <AdminTable>
              <AdminTHead>
                <tr>
                <AdminTh>صفحه</AdminTh>
                <AdminTh className="text-left">بازدید</AdminTh>
                <AdminTh className="text-left">میانگین ماندن</AdminTh>
                <AdminTh className="text-left">میانگین اسکرول</AdminTh>
                <AdminTh className="text-left">خروج از سایت</AdminTh>
                <AdminTh className="text-left">کلیک عصبی</AdminTh>
                <AdminTh className="text-left">کلیک بی‌اثر</AdminTh>
                <AdminTh />
                </tr>
              </AdminTHead>
              <tbody>
                {pages.map((p) => (
                  <AdminTr key={p.path}>
                    <AdminTd>
                      <div className="font-semibold">{pageLabel(p.path)}</div>
                      <div className="text-[11px] text-[#71717A]" dir="ltr">
                        {p.path}
                      </div>
                    </AdminTd>
                    <AdminTd className="text-left">{fa(p.views)}</AdminTd>
                    <AdminTd className="text-left">{fmtDuration(p.avg_ms)}</AdminTd>
                    <AdminTd className="text-left">{fa(p.scroll)}٪</AdminTd>
                    <AdminTd className="text-left">{pct(p.exits, p.views)}</AdminTd>
                    <AdminTd className="text-left">{fa(p.rage)}</AdminTd>
                    <AdminTd className="text-left">{fa(p.dead)}</AdminTd>
                    <AdminTd className="text-left">
                      <Link href={`/admin/insights/heatmaps?${q}&path=${encodeURIComponent(p.path)}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                        هیت‌مپ
                      </Link>
                    </AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProblemList title="جاهایی که کلیک عصبی خورده‌اند" empty="کلیک عصبی ثبت نشده است." rows={rage} q={q} />
            <ProblemList title="کلیک‌های بی‌اثر" empty="کلیک بی‌اثری ثبت نشده است." rows={dead} q={q} />
          </div>

          {errors.length > 0 && (
            <Panel title="خطاهای مرورگر">
              <ul className="flex flex-col divide-y divide-[#F4F4F5]">
                {errors.map((e) => (
                  <li key={e.message} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <code className="min-w-0 flex-1 truncate text-xs text-[#B91C1C]" dir="ltr">
                      {e.message}
                    </code>
                    <span className="text-xs text-[#71717A]">
                      {fa(e.sessions)} جلسه، {pageLabel(e.path)}
                    </span>
                    <Link href={`/admin/insights/sessions/${e.sample}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                      دیدن یک نمونه
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0].value);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]">
            <span>{s.label}</span>
            <span>
              <span className="font-bold">{fa(s.value)}</span>
              {i > 0 && <span className="text-[#71717A]"> ({pct(s.value, steps[i - 1].value)} از مرحله‌ی قبل)</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#F4F4F5]">
            <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${(s.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SignalCard({ label, value, total, href, hint }: { label: string; value: number; total: number; href: string; hint: string }) {
  return (
    <Link href={href} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]">
      <KpiCard
        label={label}
        value={pct(value, total)}
        hintTone={value ? "bad" : "good"}
        hint={
          <>
            {fa(value)} جلسه · <span className="font-normal text-[#71717A] group-hover:text-[#2563EB]">{hint}</span>
          </>
        }
      />
    </Link>
  );
}

function ProblemList({
  title,
  empty,
  rows,
  q,
}: {
  title: string;
  empty: string;
  rows: { path: string; label: string; clicks: number; sessions: number; sample: string }[];
  q: string;
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#71717A]">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#F4F4F5]">
          {rows.map((r) => (
            <li key={`${r.path}|${r.label}`} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[#18181B]">«{r.label}»</div>
                <div className="text-[11px] text-[#71717A]">
                  {pageLabel(r.path)} · {fa(r.sessions)} جلسه، {fa(r.clicks)} بار
                </div>
              </div>
              <Link href={`/admin/insights/heatmaps?${q}&path=${encodeURIComponent(r.path)}`} className="text-xs font-semibold text-[#71717A] hover:text-[#2563EB]">
                هیت‌مپ
              </Link>
              <Link href={`/admin/insights/sessions/${r.sample}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                نمونه
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
