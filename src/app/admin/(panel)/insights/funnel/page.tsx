import Link from "next/link";
import { requireInsights } from "@/lib/auth";
import { FIELD_LABELS, fieldsReport, methodSplit, orderFunnel, otpStats, parseScope, scopeQuery, sourceOptions } from "@/lib/rec/analytics";
import { methods, type Method } from "@/lib/catalog";
import { KpiCard, PageHeader, Panel } from "@/components/admin/page-header";
import { LinkSegments } from "@/components/admin/link-segments";
import { InsightsNav, fa, fmtShort, pct } from "@/components/admin/insights/insights-nav";
import { ReportTable } from "@/components/admin/insights/report-table";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "قیف سفارش" };
export const dynamic = "force-dynamic";

export default async function FunnelPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const sp = await searchParams;
  const scope = parseScope(sp);
  const q = scopeQuery(scope);
  const method = sp.method && sp.method in methods ? (sp.method as Method) : undefined;
  const funnel = orderFunnel(scope, method);
  const split = methodSplit(scope);
  const fields = fieldsReport(scope, "/order");
  const otp = otpStats(scope);
  const top = Math.max(1, funnel[0].value);
  const worst = funnel.slice(1).reduce(
    (w, f, i) => {
      const prev = funnel[i].value;
      const lost = prev ? (prev - f.value) / prev : 0;
      return lost > w.lost ? { label: f.label, lost, from: funnel[i].label } : w;
    },
    { label: "", lost: 0, from: "" },
  );

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="بازدیدکننده‌ها در کدام مرحله‌ی فرم سفارش منصرف می‌شوند و کدام فیلد اذیتشان می‌کند." />
      <InsightsNav active="funnel" scope={scope} sources={sourceOptions(scope)} extra={{ method }} />
      <div className="flex flex-col gap-4">
        <Panel
          title="قیف ثبت سفارش"
          action={
            <LinkSegments
              label="روش سفارش"
              items={[
                { href: `/admin/insights/funnel?${q}`, label: "همه", active: !method },
                ...(Object.keys(methods) as Method[])
                  .filter((m) => m !== "form")
                  .map((m) => ({ href: `/admin/insights/funnel?${q}&method=${m}`, label: methods[m].short, active: method === m })),
              ]}
            />
          }
        >
          <ol className="flex flex-col gap-4">
            {funnel.map((f, i) => {
              const prev = i ? funnel[i - 1].value : f.value;
              const lost = prev - f.value;
              return (
                <li key={f.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[13rem_minmax(0,1fr)_9rem]">
                  <span className="text-[13px] font-semibold text-[#18181B]">
                    {toFaDigits(i + 1)}. {f.label}
                  </span>
                  <div className="h-7 rounded-md bg-[#F4F4F5]">
                    <div className="flex h-full items-center rounded-md bg-[#2563EB] px-2 text-[12px] font-bold text-white" style={{ width: `${Math.max(f.value ? 6 : 0, (f.value / top) * 100)}%` }}>
                      {f.value ? fa(f.value) : ""}
                    </div>
                  </div>
                  <span className="text-[12px] text-[#71717A]">
                    {i === 0 ? `${fa(f.value)} جلسه` : lost > 0 ? <span className="text-[#B91C1C]">{fa(lost)} نفر رفتند ({pct(lost, prev)})</span> : "بدون ریزش"}
                  </span>
                </li>
              );
            })}
          </ol>
          {worst.lost > 0 && (
            <p className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#991B1B]">
              بیشترین ریزش بین «{worst.from}» و «{worst.label}» است: {toFaDigits(Math.round(worst.lost * 100))}٪.{" "}
              <Link href={`/admin/insights/sessions?${q}&outcome=reached`} className="font-semibold underline">
                ضبط این جلسه‌ها
              </Link>
            </p>
          )}
        </Panel>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard label="کد تأیید ارسال شد" value={fa(otp.otpOk)} hint={otp.otpFail ? `${fa(otp.otpFail)} بار ناموفق` : "بدون خطا"} hintTone={otp.otpFail ? "bad" : "good"} />
          <KpiCard label="ثبت نهایی موفق" value={fa(otp.submitOk)} hint={otp.submitFail ? `${fa(otp.submitFail)} بار ناموفق (کد اشتباه، خطا…)` : "بدون خطا"} hintTone={otp.submitFail ? "bad" : "good"} />
          {split.slice(0, 2).map((m) => (
            <KpiCard key={m.method} label={`انتخاب روش «${methods[m.method as Method]?.short ?? m.method}»`} value={fa(m.sessions)} hint="جلسه" />
          ))}
        </div>

        <Panel title="فیلدهای فرم سفارش">
          <ReportTable
            rows={fields}
            rowKey={(r) => r.field}
            empty="هنوز داده‌ای از فیلدها ثبت نشده است. بعد از انتشار این نسخه جمع می‌شود."
            cols={[
              {
                label: "فیلد",
                cell: (r) => (
                  <>
                    <div className="font-semibold">{FIELD_LABELS[r.field] ?? r.field}</div>
                    <div className="text-[11px] text-[#71717A]" dir="ltr">
                      {r.field}
                    </div>
                  </>
                ),
              },
              { label: "جلسه", num: true, cell: (r) => fa(r.sessions) },
              { label: "میانگین زمان", num: true, cell: (r) => fmtShort(r.avg_ms) },
              { label: "پر شد", num: true, cell: (r) => `${fa(r.filled * 100)}٪` },
              { label: "دوباره‌کاری", num: true, cell: (r) => fa(r.refills) },
              { label: "خطای اعتبارسنجی", num: true, cell: (r) => (r.errors ? <span className="font-bold text-[#B91C1C]">{fa(r.errors)}</span> : "۰") },
              { label: "آخرین فیلد قبل از رفتن", num: true, cell: (r) => (r.lastBeforeLeaving ? <span className="font-bold text-[#B45309]">{fa(r.lastBeforeLeaving)}</span> : "۰") },
            ]}
          />
          <p className="text-[11px] leading-5 text-[#71717A]">
            «آخرین فیلد قبل از رفتن» یعنی بازدیدکننده‌هایی که سفارش ثبت نکردند، آخرین بار با این فیلد کار کرده‌اند؛ معمولاً همان جایی است که گیر کرده‌اند.
          </p>
        </Panel>
      </div>
    </>
  );
}
