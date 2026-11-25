import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireInsights } from "@/lib/auth";
import { API_LABELS, EVENT_LABELS, VITALS, channelOf, eventDetail, parseScope, scopeQuery, type VitalName } from "@/lib/rec/analytics";
import { getSession, markWatched } from "@/lib/rec/insights";
import { SID_RE } from "@/lib/rec/protocol";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { deviceLabel, fmtDuration, pageLabel } from "@/components/admin/insights/insights-nav";
import { SessionPlayer, type Marker } from "@/components/admin/insights/session-player";
import { SessionNote } from "@/components/admin/insights/session-note";
import { cn, formatFaDateTime, toFaDigits } from "@/lib/utils";

export const metadata = { title: "ضبط جلسه" };
export const dynamic = "force-dynamic";

const LIVE_MS = 2 * 60_000;
const isLive = (lastAt: string) => Date.now() - Date.parse(lastAt) < LIVE_MS;

function vitalTone(name: VitalName, v: number | null) {
  if (v == null) return "";
  const t = VITALS[name];
  return v <= t.good ? "text-[#15803D]" : v <= t.poor ? "text-[#B45309]" : "text-[#B91C1C]";
}
const vitalText = (name: VitalName, v: number | null) =>
  v == null
    ? "—"
    : name === "CLS"
      ? toFaDigits(v.toFixed(2)).replace(".", "٫")
      : v < 1000
        ? `${toFaDigits(Math.round(v))} میلی‌ث`
        : `${toFaDigits((v / 1000).toFixed(1)).replace(".", "٫")} ث`;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireInsights();
  const { id } = await params;
  const sp = await searchParams;
  const back = scopeQuery(parseScope(sp));
  if (!SID_RE.test(id)) notFound();
  const data = getSession(id);
  if (!data) notFound();
  const { session: s, pages, clicks, errors, events, net, history } = data;
  if (!s.watched_at) markWatched(id, me.id);
  const live = isLive(s.last_at);

  const markers: Marker[] = [
    ...pages.map((p) => ({ ts: p.ts, kind: "page" as const, label: `${p.title || pageLabel(p.path)} (${p.path})` })),
    // One marker per rage burst (rage = 1); follow-up clicks of the burst only count if they were dead.
    ...clicks
      .filter((c) => c.rage === 1 || (c.dead && c.rage !== 2))
      .map((c) => ({ ts: c.ts, kind: c.rage === 1 ? ("rage" as const) : ("dead" as const), label: c.label ? `«${c.label}»` : pageLabel(c.path) })),
    ...errors.map((e) => ({ ts: e.ts, kind: "error" as const, label: `${e.source === "ext" ? "(افزونه/مرورگر) " : ""}${e.message}` })),
    ...events.map((e) => ({
      ts: e.ts,
      kind: e.name === "order_submit" && e.props?.includes('"ok":true') ? ("order" as const) : ("event" as const),
      label: `${EVENT_LABELS[e.name] ?? e.name}${eventDetail(e.name, e.props) ? ` — ${eventDetail(e.name, e.props)}` : ""}`,
    })),
    ...net
      .filter((n) => n.status === 0 || n.status >= 400)
      .map((n) => ({ ts: n.ts, kind: "net" as const, label: `${API_LABELS[n.url] ?? n.url}: ${n.status ? toFaDigits(n.status) : "قطع ارتباط"}` })),
  ].sort((a, b) => a.ts - b.ts);

  const src = s.utm_source ? [s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term].filter(Boolean).join(" / ") : null;
  const rows: [string, React.ReactNode][] = [
    ["شروع", formatFaDateTime(s.started_at)],
    ["زمان فعال", `${fmtDuration(s.active_ms)} از ${fmtDuration(Math.max(s.duration_ms, s.active_ms))}`],
    ["کانال", channelOf(s)],
    ["منبع", src ?? (s.referrer ? <bdi dir="ltr">{s.referrer}</bdi> : "مستقیم")],
    ["بازدیدکننده", s.return_visit ? "برگشتی" : "جدید"],
    ["دستگاه", `${deviceLabel[s.device] ?? s.device}، ${s.os ?? ""}، ${s.browser ?? ""}`],
    ["صفحه‌ی نمایش", s.vw ? <bdi dir="ltr">{toFaDigits(`${s.vw}×${s.vh ?? ""}${s.sw ? ` (${s.sw}×${s.sh})` : ""}`)}</bdi> : "—"],
    ["اینترنت", s.conn ? <bdi dir="ltr">{s.conn}</bdi> : "—"],
    ["زبان و منطقه", [s.lang, s.tz].filter(Boolean).join("، ") || "—"],
    ["کلیک‌ها", `${toFaDigits(s.clicks)} (عصبی ${toFaDigits(s.rage_clicks)}، بی‌اثر ${toFaDigits(s.dead_clicks)})`],
    ["بیشترین اسکرول", `${toFaDigits(s.max_scroll)}٪`],
  ];
  const failedNet = net.filter((n) => n.status === 0 || n.status >= 400);

  return (
    <>
      <PageHeader
        title="ضبط جلسه"
        description={`${formatFaDateTime(s.started_at)}، ${deviceLabel[s.device] ?? s.device}${s.watched_name && s.watched_at ? `، اولین بار دیده‌شده توسط ${s.watched_name}` : ""}`}
        actions={
          <Link href={`/admin/insights/sessions?${back}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#52525B] hover:text-[#18181B]">
            <ArrowRight className="size-4" aria-hidden />
            همه‌ی جلسه‌ها
          </Link>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SessionPlayer sid={s.id} markers={markers} live={live && sp.live === "1"} />
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
          <Panel title="یادداشت تیم">
            <SessionNote sid={s.id} note={s.note} starred={!!s.starred} />
          </Panel>
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
            <ol className="flex flex-col gap-2.5">
              {pages.map((p) => (
                <li key={p.view} className="text-[13px]">
                  <div className="flex justify-between gap-2">
                    <span className="truncate font-medium">{pageLabel(p.path)}</span>
                    <span className="shrink-0 text-[12px] text-[#71717A]">
                      {fmtDuration(p.active_ms || p.duration_ms)}، اسکرول {toFaDigits(p.max_scroll)}٪
                    </span>
                  </div>
                  {(p.lcp != null || !!p.quick_back) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[#71717A]">
                      {p.quick_back ? <span className="text-[#A16207]">زود برگشت</span> : null}
                      {p.lcp != null && (
                        <span>
                          LCP <span className={vitalTone("LCP", p.lcp)}>{vitalText("LCP", p.lcp)}</span>
                        </span>
                      )}
                      {p.inp != null && (
                        <span>
                          INP <span className={vitalTone("INP", p.inp)}>{vitalText("INP", p.inp)}</span>
                        </span>
                      )}
                      {p.cls != null && (
                        <span>
                          CLS <span className={vitalTone("CLS", p.cls)}>{vitalText("CLS", p.cls)}</span>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
          {failedNet.length > 0 && (
            <Panel title="درخواست‌های ناموفق به سرور">
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {failedNet.map((n, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{API_LABELS[n.url] ?? <bdi dir="ltr">{n.url}</bdi>}</span>
                    <span className="shrink-0 font-semibold text-[#B91C1C]">{n.status ? toFaDigits(n.status) : "قطع"}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {history.length > 0 && (
            <Panel title={`بازدیدهای دیگر همین مرورگر (${toFaDigits(history.length)})`}>
              <ul className="-mx-1 flex flex-col">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/admin/insights/sessions/${h.id}?${back}`}
                      className={cn("flex items-center justify-between gap-2 rounded-md px-1 py-1.5 text-[12px] hover:bg-[#F4F4F5]")}
                    >
                      <span className="text-[#18181B]">{formatFaDateTime(h.started_at)}</span>
                      <span className="shrink-0 text-[#71717A]">
                        {h.tracking_code ? <span className="font-semibold text-[#15803D]">سفارش، </span> : null}
                        {fmtDuration(h.active_ms)}، {h.utm_source ?? "مستقیم"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
