import Link from "next/link";
import { requireInsights } from "@/lib/auth";
import { EVENT_LABELS, eventBreakdown, eventsReport, pagesReport, parseScope, problemElements, scopeQuery, sourceOptions } from "@/lib/rec/analytics";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, fa, fmtDuration, pageLabel, pct } from "@/components/admin/insights/insights-nav";
import { ReportTable } from "@/components/admin/insights/report-table";
import { ProblemList } from "@/components/admin/insights/problem-list";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "صفحه‌ها و رویدادها" };
export const dynamic = "force-dynamic";

/** Which property best explains each event. */
const BREAKDOWN: Record<string, { prop: string; label: string }> = {
  outbound: { prop: "host", label: "مقصد" },
  cta_order: { prop: "section", label: "بخش صفحه" },
  contact_whatsapp: { prop: "section", label: "بخش صفحه" },
  contact_phone: { prop: "section", label: "بخش صفحه" },
  expand: { prop: "label", label: "عنوان" },
  method_select: { prop: "method", label: "روش" },
  form_error: { prop: "fields", label: "فیلدها" },
  otp_request: { prop: "ok", label: "موفق؟" },
  order_submit: { prop: "ok", label: "موفق؟" },
  form_step: { prop: "step", label: "مرحله" },
};

export default async function EngagementPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const sp = await searchParams;
  const scope = parseScope(sp);
  const q = scopeQuery(scope);
  const pages = pagesReport(scope);
  const events = eventsReport(scope);
  const selected = sp.event && events.some((e) => e.name === sp.event) ? sp.event : events[0]?.name;
  const bd = selected ? BREAKDOWN[selected] ?? { prop: "label", label: "عنوان" } : null;
  const breakdown = selected && bd ? eventBreakdown(scope, selected, bd.prop) : [];
  const nonclick = problemElements(scope, "nonclick");

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="کدام صفحه‌ها دیده می‌شوند، چقدر وقت می‌گیرند و بازدیدکننده‌ها روی چه چیزهایی کلیک می‌کنند." />
      <InsightsNav active="engagement" scope={scope} sources={sourceOptions(scope)} extra={{ event: sp.event }} />
      <div className="flex flex-col gap-4">
        <Panel title="صفحه‌ها">
          <ReportTable
            rows={pages}
            rowKey={(r) => r.path}
            cols={[
              {
                label: "صفحه",
                cell: (r) => (
                  <>
                    <div className="font-semibold">{pageLabel(r.path)}</div>
                    <div className="text-[11px] text-[#71717A]" dir="ltr">
                      {r.path}
                    </div>
                  </>
                ),
              },
              { label: "بازدید", num: true, cell: (r) => fa(r.views) },
              { label: "کاربر", num: true, cell: (r) => fa(r.users) },
              { label: "زمان فعال", num: true, cell: (r) => fmtDuration(r.active_ms) },
              { label: "اسکرول", num: true, cell: (r) => `${fa(r.scroll)}٪` },
              { label: "ورود", num: true, cell: (r) => fa(r.entrances) },
              { label: "خروج از سایت", num: true, cell: (r) => pct(r.exits, r.views) },
              { label: "برگشت سریع", num: true, cell: (r) => fa(r.quick_backs) },
              { label: "عصبی / بی‌اثر", num: true, cell: (r) => `${toFaDigits(r.rage)} / ${toFaDigits(r.dead)}` },
              { label: "LCP (p75)", num: true, cell: (r) => (r.lcpP75 == null ? "—" : `${toFaDigits((r.lcpP75 / 1000).toFixed(1))} ث`) },
              {
                label: "",
                cell: (r) => (
                  <Link href={`/admin/insights/heatmaps?${q}&path=${encodeURIComponent(r.path)}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                    هیت‌مپ
                  </Link>
                ),
              },
            ]}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title="رویدادها">
            <ReportTable
              rows={events}
              rowKey={(r) => r.name}
              empty="هنوز رویدادی ثبت نشده است."
              cols={[
                {
                  label: "رویداد",
                  cell: (r) => (
                    <Link href={`/admin/insights/engagement?${q}&event=${r.name}`} className={r.name === selected ? "font-bold text-[#2563EB]" : "hover:text-[#2563EB]"}>
                      <div>{EVENT_LABELS[r.name] ?? r.name}</div>
                      <div className="text-[11px] font-normal text-[#71717A]" dir="ltr">
                        {r.name}
                      </div>
                    </Link>
                  ),
                },
                { label: "تعداد", num: true, cell: (r) => fa(r.count) },
                { label: "جلسه", num: true, cell: (r) => fa(r.sessions) },
                { label: "کاربر", num: true, cell: (r) => fa(r.users) },
              ]}
            />
          </Panel>
          <Panel title={selected ? `${EVENT_LABELS[selected] ?? selected}، به تفکیک ${bd?.label}` : "جزئیات رویداد"}>
            <ReportTable
              rows={breakdown}
              rowKey={(r) => String(r.value)}
              empty="یک رویداد را انتخاب کنید."
              cols={[
                { label: bd?.label ?? "", cell: (r) => <span dir="auto">{String(r.value) === "1" ? "بله" : String(r.value) === "0" ? "خیر" : String(r.value)}</span> },
                { label: "تعداد", num: true, cell: (r) => fa(r.count) },
                { label: "جلسه", num: true, cell: (r) => fa(r.sessions) },
                {
                  label: "",
                  cell: (r) => (
                    <Link href={`/admin/insights/sessions/${r.sample}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                      نمونه
                    </Link>
                  ),
                },
              ]}
            />
          </Panel>
        </div>

        <ProblemList title="کلیک روی چیزهایی که قابل‌کلیک نیستند (احتمالاً انتظار لینک داشتند)" rows={nonclick} q={q} />
      </div>
    </>
  );
}
