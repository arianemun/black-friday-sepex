import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireInsights } from "@/lib/auth";
import { getSession, parseRange } from "@/lib/rec/insights";
import { SID_RE } from "@/lib/rec/protocol";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { deviceLabel, fmtDuration, pageLabel } from "@/components/admin/insights/insights-nav";
import { SessionPlayer, type Marker } from "@/components/admin/insights/session-player";
import { formatFaDateTime, toFaDigits } from "@/lib/utils";

export const metadata = { title: "ضبط جلسه" };
export const dynamic = "force-dynamic";

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string }> }) {
  await requireInsights();
  const { id } = await params;
  const range = parseRange((await searchParams).d);
  if (!SID_RE.test(id)) notFound();
  const data = getSession(id);
  if (!data) notFound();
  const { session: s, pages, clicks, errors } = data;

  const markers: Marker[] = [
    ...pages.map((p) => ({ ts: p.ts, kind: "page" as const, label: `${pageLabel(p.path)} (${p.path})` })),
    // One marker per rage burst (rage = 1); follow-up clicks of the burst only count if they were dead.
    ...clicks
      .filter((c) => c.rage === 1 || (c.dead && c.rage !== 2))
      .map((c) => ({ ts: c.ts, kind: c.rage === 1 ? ("rage" as const) : ("dead" as const), label: c.label ? `«${c.label}»` : pageLabel(c.path) })),
    ...errors.map((e) => ({ ts: e.ts, kind: "error" as const, label: e.message })),
  ].sort((a, b) => a.ts - b.ts);

  const rows: [string, React.ReactNode][] = [
    ["شروع", formatFaDateTime(s.started_at)],
    ["مدت", fmtDuration(s.duration_ms)],
    ["دستگاه", `${deviceLabel[s.device] ?? s.device}، ${s.os ?? ""}، ${s.browser ?? ""}`],
    ["اندازه‌ی صفحه", s.vw ? <bdi dir="ltr">{toFaDigits(`${s.vw}×${s.vh ?? ""}`)}</bdi> : "—"],
    ["منبع", s.utm_source ? [s.utm_source, s.utm_medium, s.utm_campaign].filter(Boolean).join(" / ") : s.referrer ? <bdi dir="ltr">{s.referrer}</bdi> : "مستقیم"],
    ["صفحه‌ها", toFaDigits(s.pages)],
    ["بیشترین اسکرول", `${toFaDigits(s.max_scroll)}٪`],
    ["کلیک‌ها", `${toFaDigits(s.clicks)} (عصبی ${toFaDigits(s.rage_clicks)}، بی‌اثر ${toFaDigits(s.dead_clicks)})`],
  ];

  return (
    <>
      <PageHeader
        title="ضبط جلسه"
        description={`${formatFaDateTime(s.started_at)} · ${deviceLabel[s.device] ?? s.device}`}
        actions={
          <Link href={`/admin/insights/sessions?d=${range}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#52525B] hover:text-[#18181B]">
            <ArrowRight className="size-4" aria-hidden />
            همه‌ی جلسه‌ها
          </Link>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <SessionPlayer sid={s.id} markers={markers} />
        <div className="flex flex-col gap-4">
          {s.tracking_code && (
            <Panel title="سفارش ثبت کرد">
              <p className="text-[13px] text-[#3F3F46]">
                کد پیگیری <bdi className="font-bold">{s.tracking_code}</bdi>
              </p>
              {s.request_id && (
                <Link href={`/admin/requests/${s.request_id}`} className="text-[13px] font-semibold text-[#2563EB] hover:underline">
                  باز کردن درخواست
                </Link>
              )}
            </Panel>
          )}
          <Panel title="مشخصات">
            <dl className="flex flex-col gap-2 text-[13px]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-[#71717A]">{k}</dt>
                  <dd className="min-w-0 truncate text-left font-medium text-[#18181B]">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="مسیر">
            <ol className="flex flex-col gap-2">
              {pages.map((p) => (
                <li key={p.view} className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate">{pageLabel(p.path)}</span>
                  <span className="shrink-0 text-[12px] text-[#71717A]">
                    {fmtDuration(p.duration_ms)} · اسکرول {toFaDigits(p.max_scroll)}٪
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
