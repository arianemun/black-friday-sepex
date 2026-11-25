import { requireInsights } from "@/lib/auth";
import { VITALS, parseScope, sourceOptions, speedImpact, techBreakdown, vitalsReport, type VitalName } from "@/lib/rec/analytics";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, ShareList, deviceLabel, fa, pageLabel, pct } from "@/components/admin/insights/insights-nav";
import { ReportTable } from "@/components/admin/insights/report-table";
import { cn, toFaDigits } from "@/lib/utils";

export const metadata = { title: "دستگاه و سرعت" };
export const dynamic = "force-dynamic";

const fmtVital = (name: VitalName, v: number | null) =>
  v == null ? "—" : name === "CLS" ? toFaDigits(v.toFixed(2)) : v >= 1000 ? `${toFaDigits((v / 1000).toFixed(1))} ث` : `${toFaDigits(Math.round(v))} میلی‌ث`;
const rate = (name: VitalName, v: number | null) => (v == null ? "none" : v <= VITALS[name].good ? "good" : v <= VITALS[name].poor ? "mid" : "poor");
const RATE_STYLE = { good: "text-[#15803D]", mid: "text-[#B45309]", poor: "text-[#B91C1C]", none: "text-[#A1A1AA]" };
const RATE_LABEL = { good: "خوب", mid: "قابل بهبود", poor: "ضعیف", none: "" };

export default async function TechPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const scope = parseScope(await searchParams);
  const vit = vitalsReport(scope);
  const impact = speedImpact(scope);
  const tables = [
    { key: "os", title: "سیستم‌عامل" },
    { key: "browser", title: "مرورگر" },
    { key: "screen", title: "اندازه‌ی صفحه" },
    { key: "conn", title: "سرعت اینترنت (برآورد مرورگر)" },
  ] as const;
  const devices = techBreakdown(scope, "device");
  const total = devices.reduce((a, d) => a + d.sessions, 0);

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="بازدیدکننده‌ها با چه دستگاهی می‌آیند و سایت برایشان چقدر سریع است (Core Web Vitals، اندازه‌گیری‌شده روی دستگاه خودشان)." />
      <InsightsNav active="tech" scope={scope} sources={sourceOptions(scope)} />
      <div className="flex flex-col gap-4">
        <Panel title="سرعت واقعی سایت (صدک ۷۵)">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {vit.all.map((v) => {
              const r = rate(v.name, v.p75);
              return (
                <div key={v.name} className="flex flex-col gap-1.5 rounded-lg border border-[#E4E4E7] p-3">
                  <span className="text-[12px] text-[#52525B]">{VITALS[v.name].label}</span>
                  <span className={cn("text-[22px] font-extrabold leading-none", RATE_STYLE[r])}>{fmtVital(v.name, v.p75)}</span>
                  <span className="text-[11px] text-[#71717A]">
                    {RATE_LABEL[r]} {v.n ? `، ${pct(v.good, v.n)} خوب، ${pct(v.poor, v.n)} ضعیف` : "، هنوز داده‌ای نیست"}
                  </span>
                  {v.n > 0 && (
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-[#F4F4F5]" aria-hidden>
                      <div className="bg-[#16A34A]" style={{ width: `${(v.good / v.n) * 100}%` }} />
                      <div className="bg-[#F59E0B]" style={{ width: `${((v.n - v.good - v.poor) / v.n) * 100}%` }} />
                      <div className="bg-[#DC2626]" style={{ width: `${(v.poor / v.n) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#71717A]">صدک ۷۵ یعنی سه‌چهارم بازدیدکننده‌ها سریع‌تر از این عدد تجربه کرده‌اند؛ گوگل هم همین را ملاک می‌گیرد.</p>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="سرعت به تفکیک دستگاه">
            <ReportTable
              rows={vit.byDevice}
              rowKey={(r) => r.device}
              cols={[
                { label: "دستگاه", cell: (r) => deviceLabel[r.device] ?? r.device },
                ...(["LCP", "INP", "CLS", "TTFB"] as VitalName[]).map((k) => ({
                  label: k,
                  num: true,
                  cell: (r: (typeof vit.byDevice)[number]) => {
                    const v = r.vitals.find((x) => x.name === k)!;
                    return <span className={RATE_STYLE[rate(k, v.p75)]}>{fmtVital(k, v.p75)}</span>;
                  },
                })),
              ]}
            />
          </Panel>
          <Panel title="آیا کندی، بازدیدکننده را فراری می‌دهد؟">
            <ReportTable
              rows={impact}
              rowKey={(r) => r.bucket}
              cols={[
                { label: "بارگذاری صفحه‌ی ورود", cell: (r) => r.bucket },
                { label: "جلسه", num: true, cell: (r) => fa(r.sessions) },
                { label: "خروج سریع", num: true, cell: (r) => `${fa(r.bounce * 100)}٪` },
                { label: "تعامل", num: true, cell: (r) => `${fa(r.engaged * 100)}٪` },
                { label: "تبدیل", num: true, cell: (r) => `${toFaDigits((r.conv * 100).toFixed(1))}٪` },
              ]}
            />
          </Panel>
        </div>

        <Panel title="سرعت به تفکیک صفحه">
          <ReportTable
            rows={vit.byPage}
            rowKey={(r) => r.path}
            cols={[
              { label: "صفحه", cell: (r) => pageLabel(r.path) },
              ...(["LCP", "INP", "CLS", "FCP", "TTFB"] as VitalName[]).map((k) => ({
                label: k,
                num: true,
                cell: (r: (typeof vit.byPage)[number]) => {
                  const v = r.vitals.find((x) => x.name === k)!;
                  return <span className={RATE_STYLE[rate(k, v.p75)]}>{fmtVital(k, v.p75)}</span>;
                },
              })),
            ]}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="دستگاه">
            <ShareList total={total} rows={devices.map((d) => ({ key: d.value, label: deviceLabel[d.value] ?? d.value, value: d.sessions, hint: `، ${fa(d.orders)} سفارش` }))} />
          </Panel>
          {tables.map((tb) => {
            const rows = techBreakdown(scope, tb.key);
            return (
              <Panel key={tb.key} title={tb.title}>
                <ShareList
                  total={total}
                  rows={rows.map((r) => ({ key: r.value, label: <span dir="auto">{r.value}</span>, value: r.sessions, hint: `، تعامل ${pct(r.engaged, r.sessions)}` }))}
                />
              </Panel>
            );
          })}
        </div>
      </div>
    </>
  );
}
