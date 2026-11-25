import Link from "next/link";
import { requireInsights } from "@/lib/auth";
import {
  byChannel,
  byLanding,
  excessiveScroll,
  orderFunnel,
  pagesReport,
  parseScope,
  problemElements,
  scopeQuery,
  series,
  sourceOptions,
  techBreakdown,
  totals,
} from "@/lib/rec/analytics";
import { KpiCard, PageHeader, Panel } from "@/components/admin/page-header";
import { Delta, InsightsNav, ShareList, deviceLabel, fa, fmtDuration, pageLabel, pct } from "@/components/admin/insights/insights-nav";
import { BarSeries } from "@/components/admin/insights/bar-series";
import { ProblemList } from "@/components/admin/insights/problem-list";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "رفتار بازدیدکننده‌ها" };
export const dynamic = "force-dynamic";

export default async function InsightsOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const scope = parseScope(await searchParams);
  const q = scopeQuery(scope);
  const t = totals(scope);
  const p = totals(scope, true);
  const s = series(scope);
  const funnel = orderFunnel(scope);
  const channels = byChannel(scope);
  const landing = byLanding(scope).slice(0, 6);
  const devices = techBreakdown(scope, "device");
  const pages = pagesReport(scope).slice(0, 6);
  const rage = problemElements(scope, "rage").slice(0, 5);
  const dead = problemElements(scope, "dead").slice(0, 5);
  const excessive = excessiveScroll(scope);
  const engagedRate = t.sessions ? t.engaged / t.sessions : 0;
  const prevEngagedRate = p.sessions ? p.engaged / p.sessions : 0;

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="چه کسانی از کجا می‌آیند، در سایت چه می‌کنند، کجا گیر می‌کنند و چند نفرشان سفارش ثبت می‌کنند." />
      <InsightsNav active="overview" scope={scope} sources={sourceOptions(scope)} />

      {t.sessions === 0 ? (
        <Panel>
          <p className="py-16 text-center text-sm text-[#71717A]">در این بازه جلسه‌ای ثبت نشده است.</p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard label="کاربران" value={fa(t.users)} hint={<Delta now={t.users} prev={p.users} />} />
            <KpiCard label="کاربران جدید" value={fa(t.newUsers)} hint={`${pct(t.newUsers, t.users)} از کاربران، ${fa(t.sessions)} جلسه`} />
            <KpiCard label="نرخ تعامل" value={pct(t.engaged, t.sessions)} hint={<Delta now={engagedRate} prev={prevEngagedRate} />} />
            <KpiCard label="میانگین زمان فعال" value={fmtDuration(t.activeMs)} hint={<Delta now={t.activeMs} prev={p.activeMs} />} />
            <KpiCard label="سفارش ثبت‌شده" value={fa(t.orders)} hint={<Delta now={t.orders} prev={p.orders} />} />
            <KpiCard label="نرخ تبدیل" value={pct(t.orders, t.sessions)} hint={`از ${fa(t.sessions)} جلسه`} hintTone={t.orders ? "good" : "muted"} />
            <KpiCard label="رسیدن به فرم سفارش" value={pct(t.reached, t.sessions)} hint={`${fa(t.reached)} جلسه`} />
            <KpiCard label="صفحه در هر جلسه" value={fa(t.pages, 1)} hint={`اسکرول میانگین ${fa(t.scroll)}٪`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title={s.hourly ? "جلسه‌ها، ساعت به ساعت" : "جلسه‌ها، روز به روز"} className="lg:col-span-2">
              <BarSeries
                hourly={s.hourly}
                legend={["جلسه", "سفارش"]}
                rows={s.rows.map((r) => ({ b: r.b, value: r.sessions, sub: r.orders, tip: `${toFaDigits(r.sessions)} جلسه، ${toFaDigits(r.users)} کاربر، ${toFaDigits(r.orders)} سفارش` }))}
              />
            </Panel>
            <Panel title="قیف سفارش">
              <ol className="flex flex-col gap-3">
                {funnel.map((f, i) => (
                  <li key={f.key} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{f.label}</span>
                      <span className="shrink-0">
                        <span className="font-bold">{fa(f.value)}</span>
                        {i > 0 && <span className="text-[11px] text-[#71717A]"> {pct(f.value, funnel[i - 1].value)}</span>}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F4F4F5]">
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${funnel[0].value ? (f.value / funnel[0].value) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={`/admin/insights/funnel?${q}`} className="mt-auto text-xs font-semibold text-[#2563EB] hover:underline">
                جزئیات قیف و فیلدهای فرم
              </Link>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="کانال ورود">
              <ShareList total={t.sessions} rows={channels.slice(0, 7).map((c) => ({ key: c.key, label: c.key, value: c.sessions, hint: `، ${fa(c.orders)} سفارش` }))} />
              <Link href={`/admin/insights/acquisition?${q}`} className="mt-auto text-xs font-semibold text-[#2563EB] hover:underline">
                منبع، کمپین و صفحه‌ی ورود
              </Link>
            </Panel>
            <Panel title="دستگاه">
              <ShareList
                total={t.sessions}
                rows={devices.map((d) => ({ key: d.value, label: deviceLabel[d.value] ?? d.value, value: d.sessions, hint: `، تعامل ${pct(d.engaged, d.sessions)}` }))}
                href={(k) => `/admin/insights?${scopeQuery({ ...scope, device: k })}`}
              />
            </Panel>
            <Panel title="صفحه‌ی ورود">
              <ShareList total={t.sessions} rows={landing.map((l) => ({ key: l.key, label: pageLabel(l.key), value: l.sessions, hint: `، ${fa(l.orders)} سفارش` }))} />
            </Panel>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            <Signal label="کلیک عصبی" value={t.rage} total={t.sessions} href={`/admin/insights/sessions?${q}&issue=rage`} hint="چند کلیک پشت‌سرهم روی یک نقطه" />
            <Signal label="کلیک بی‌اثر" value={t.dead} total={t.sessions} href={`/admin/insights/sessions?${q}&issue=dead`} hint="روی چیزی شبیه دکمه که کاری نکرد" />
            <Signal label="برگشت سریع" value={t.quickBacks} total={t.sessions} href={`/admin/insights/sessions?${q}&issue=quickback`} hint="کمتر از ۵ ثانیه و برگشت" />
            <Signal label="اسکرول بی‌هدف" value={excessive} total={t.sessions} href={`/admin/insights/sessions?${q}&issue=scroll`} hint="بالا و پایین زیاد، بدون کلیک" />
            <Signal label="خطای سایت یا شبکه" value={Math.max(t.errors, t.netErrors)} total={t.sessions} href={`/admin/insights/errors?${q}`} hint="خطا یا درخواست ناموفق" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="صفحه‌ها">
              <ul className="flex flex-col divide-y divide-[#F4F4F5]">
                {pages.map((pg) => (
                  <li key={pg.path} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                    <span className="truncate">{pageLabel(pg.path)}</span>
                    <span className="shrink-0 text-[12px] text-[#71717A]">
                      <span className="font-bold text-[#18181B]">{fa(pg.views)}</span> بازدید، {fmtDuration(pg.active_ms)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/admin/insights/engagement?${q}`} className="mt-auto text-xs font-semibold text-[#2563EB] hover:underline">
                همه‌ی صفحه‌ها و رویدادها
              </Link>
            </Panel>
            <ProblemList title="کلیک عصبی روی…" rows={rage} q={q} />
            <ProblemList title="کلیک بی‌اثر روی…" rows={dead} q={q} />
          </div>
        </div>
      )}
    </>
  );
}

function Signal({ label, value, total, href, hint }: { label: string; value: number; total: number; href: string; hint: string }) {
  return (
    <Link href={href} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]">
      <KpiCard
        label={label}
        value={pct(value, total)}
        hintTone={value ? "bad" : "good"}
        hint={
          <>
            {fa(value)} جلسه، <span className="font-normal text-[#71717A] group-hover:text-[#2563EB]">{hint}</span>
          </>
        }
      />
    </Link>
  );
}
