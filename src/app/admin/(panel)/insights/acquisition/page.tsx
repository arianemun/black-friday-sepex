import { requireInsights } from "@/lib/auth";
import { byCampaign, byChannel, byLanding, bySourceMedium, parseScope, scopeQuery, sourceOptions, totals } from "@/lib/rec/analytics";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, fa, fmtDuration, pageLabel, pct } from "@/components/admin/insights/insights-nav";
import { ReportTable, type Col } from "@/components/admin/insights/report-table";
import Link from "next/link";

export const metadata = { title: "جذب" };
export const dynamic = "force-dynamic";

type Row = { key: string; detail: string; sessions: number; users: number; engaged: number; activeMs: number; reached: number; orders: number };

const metricCols = (): Col<Row>[] => [
  { label: "کاربر", num: true, cell: (r) => fa(r.users) },
  { label: "جلسه", num: true, cell: (r) => fa(r.sessions) },
  { label: "نرخ تعامل", num: true, cell: (r) => pct(r.engaged, r.sessions) },
  { label: "زمان فعال", num: true, cell: (r) => fmtDuration(r.activeMs) },
  { label: "به فرم رسید", num: true, cell: (r) => pct(r.reached, r.sessions) },
  { label: "سفارش", num: true, cell: (r) => <span className="font-bold">{fa(r.orders)}</span> },
  { label: "نرخ تبدیل", num: true, cell: (r) => pct(r.orders, r.sessions) },
];

export default async function AcquisitionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const scope = parseScope(await searchParams);
  const t = totals(scope);
  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="بازدیدکننده‌ها از کجا می‌آیند و کدام منبع واقعاً سفارش می‌آورد." />
      <InsightsNav active="acquisition" scope={scope} sources={sourceOptions(scope)} />
      <div className="flex flex-col gap-4">
        <Panel title="کانال‌ها">
          <ReportTable rows={byChannel(scope)} rowKey={(r) => r.key} cols={[{ label: "کانال", cell: (r) => <span className="font-semibold">{r.key}</span> }, ...metricCols()]} />
        </Panel>
        <Panel title="منبع / رسانه">
          <ReportTable
            rows={bySourceMedium(scope)}
            rowKey={(r) => `${r.key}|${r.detail}`}
            cols={[
              {
                label: "منبع",
                cell: (r) => (
                  <Link href={`/admin/insights?${scopeQuery({ ...scope, source: r.detail === "referral" || r.detail === "none" ? (r.key === "(direct)" ? "(direct)" : undefined) : r.key })}`} className="hover:text-[#2563EB]">
                    <div className="font-semibold" dir="ltr">
                      {r.key === "(direct)" ? "مستقیم" : r.key}
                    </div>
                    <div className="text-[11px] text-[#71717A]" dir="ltr">
                      {r.detail === "referral" ? "ارجاع از سایت دیگر" : r.detail === "none" ? "بدون منبع" : r.detail}
                    </div>
                  </Link>
                ),
              },
              ...metricCols(),
            ]}
          />
        </Panel>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="کمپین‌ها">
            <ReportTable
              rows={byCampaign(scope)}
              rowKey={(r) => `${r.key}|${r.detail}`}
              cols={[
                {
                  label: "کمپین",
                  cell: (r) => (
                    <>
                      <div className="font-semibold" dir="ltr">
                        {r.key}
                      </div>
                      {r.detail && (
                        <div className="text-[11px] text-[#71717A]" dir="ltr">
                          {r.detail}
                        </div>
                      )}
                    </>
                  ),
                },
                ...metricCols().filter((c) => ["جلسه", "نرخ تعامل", "سفارش", "نرخ تبدیل"].includes(c.label)),
              ]}
            />
          </Panel>
          <Panel title="صفحه‌ی ورود">
            <ReportTable
              rows={byLanding(scope)}
              rowKey={(r) => r.key}
              cols={[
                {
                  label: "صفحه",
                  cell: (r) => (
                    <>
                      <div className="font-semibold">{pageLabel(r.key)}</div>
                      <div className="text-[11px] text-[#71717A]" dir="ltr">
                        {r.key}
                      </div>
                    </>
                  ),
                },
                ...metricCols().filter((c) => ["جلسه", "نرخ تعامل", "سفارش", "نرخ تبدیل"].includes(c.label)),
              ]}
            />
          </Panel>
        </div>
        <p className="text-[11px] text-[#71717A]">
          {fa(t.sessions)} جلسه در این بازه. «نرخ تعامل» همان تعریف GA4 است: جلسه‌ای که دست‌کم ۱۰ ثانیه فعال بوده، دو صفحه یا بیشتر دیده یا سفارش ثبت کرده.
        </p>
      </div>
    </>
  );
}
