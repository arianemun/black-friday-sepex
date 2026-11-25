import Link from "next/link";
import { requireInsights } from "@/lib/auth";
import { API_LABELS, apiReport, jsErrors, parseScope, sourceOptions } from "@/lib/rec/analytics";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { InsightsNav, fa, pageLabel, pct } from "@/components/admin/insights/insights-nav";
import { ReportTable } from "@/components/admin/insights/report-table";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "خطاها" };
export const dynamic = "force-dynamic";

const ms = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${toFaDigits((v / 1000).toFixed(1))} ث` : `${toFaDigits(v)} میلی‌ث`);

export default async function ErrorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const scope = parseScope(await searchParams);
  const api = apiReport(scope);
  const own = jsErrors(scope, "own");
  const ext = jsErrors(scope, "ext");
  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="درخواست‌هایی که برای بازدیدکننده ناموفق بوده‌اند و خطاهای جاوااسکریپت در مرورگرشان." />
      <InsightsNav active="errors" scope={scope} sources={sourceOptions(scope)} />
      <div className="flex flex-col gap-4">
        <Panel title="درخواست‌های سایت از مرورگر بازدیدکننده">
          <ReportTable
            rows={api}
            rowKey={(r) => r.key}
            empty="هنوز درخواستی ثبت نشده است. بعد از انتشار این نسخه جمع می‌شود."
            cols={[
              {
                label: "درخواست",
                cell: (r) => (
                  <>
                    <div className="font-semibold">{API_LABELS[r.url] ?? r.url}</div>
                    <div className="text-[11px] text-[#71717A]" dir="ltr">
                      {r.method} {r.url}
                    </div>
                  </>
                ),
              },
              { label: "تعداد", num: true, cell: (r) => fa(r.calls) },
              { label: "ناموفق (شبکه/سرور)", num: true, cell: (r) => (r.failed ? <span className="font-bold text-[#B91C1C]">{fa(r.failed)} ({pct(r.failed, r.calls)})</span> : "۰") },
              { label: "رد شده (۴xx)", num: true, cell: (r) => fa(r.client) },
              { label: "زمان پاسخ (میانه)", num: true, cell: (r) => ms(r.p50) },
              { label: "۹۰٪ زیر", num: true, cell: (r) => ms(r.p90) },
              {
                label: "کدها",
                cell: (r) => (
                  <span className="text-[11px] text-[#71717A]" dir="ltr">
                    {r.statuses.map(([s, c]) => `${s === 0 ? "net" : s}×${c}`).join("  ")}
                  </span>
                ),
              },
              {
                label: "",
                cell: (r) =>
                  r.sample ? (
                    <Link href={`/admin/insights/sessions/${r.sample}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                      نمونه
                    </Link>
                  ) : null,
              },
            ]}
          />
          <p className="text-[11px] text-[#71717A]">«ناموفق» یعنی درخواست اصلاً به سرور نرسید (net) یا سرور خطای ۵۰۰ داد. «رد شده» یعنی سرور جواب داد ولی قبول نکرد، مثل کد تأیید اشتباه.</p>
        </Panel>

        <Panel title="خطاهای جاوااسکریپت سایت">
          <ErrorList rows={own} empty="خطایی از کد خود سایت ثبت نشده است." />
        </Panel>
        <Panel title="خطای اسکریپت‌های بیرونی (تگ منیجر، Clarity و…)">
          <ErrorList rows={ext} empty="موردی نیست." />
          <p className="text-[11px] text-[#71717A]">مرورگر جزئیات این خطاها را پنهان می‌کند («Script error.»)، پس معمولاً کاری از دست ما برنمی‌آید؛ در آمار خطای سایت حساب نمی‌شوند.</p>
        </Panel>
      </div>
    </>
  );
}

function ErrorList({ rows, empty }: { rows: { message: string; count: number; sessions: number; sample: string; path: string; stack: string | null }[]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-[#71717A]">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-[#F4F4F5]">
      {rows.map((e) => (
        <li key={e.message} className="flex flex-col gap-1 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-[#B91C1C]" dir="ltr">
              {e.message}
            </code>
            <span className="text-xs text-[#71717A]">
              {fa(e.sessions)} جلسه، {fa(e.count)} بار، {pageLabel(e.path)}
            </span>
            <Link href={`/admin/insights/sessions/${e.sample}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
              نمونه
            </Link>
          </div>
          {e.stack && (
            <details className="text-[11px] text-[#71717A]">
              <summary className="cursor-pointer">جزئیات</summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-[#FAFAFA] p-2" dir="ltr">
                {e.stack}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
