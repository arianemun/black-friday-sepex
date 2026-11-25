import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, ExternalLink, FileText, Globe, Package, UserRound } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { canViewInsights } from "@/lib/roles";
import { getDb } from "@/lib/db";
import { listActiveStaff } from "@/lib/admin-queries";
import { countryName, methods, storeByKey, type Method } from "@/lib/catalog";
import { toIntlMobile } from "@/lib/phone";
import { mediaUrl } from "@/lib/uploads";
import { formatFaDateTime, toFaDigits } from "@/lib/utils";
import { RequestControls, NoteForm, RefetchButton } from "@/components/admin/request-controls";
import { Panel } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActivityLog, type LogEvent } from "@/components/admin/activity-log";
import { ContactButtons, CopyCode, ItemImage } from "@/components/admin/request-contact";
import { logView } from "@/lib/events";
import { sessionsForRequest } from "@/lib/rec/insights";
import { fmtDuration } from "@/components/admin/insights/insights-nav";

export const metadata = { title: "جزئیات درخواست" };

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 40);
  }
};

type Req = {
  id: number; tracking_code: string; method: Method; first_name: string; last_name: string; gender: "male" | "female" | null; phone: string; source: string; source_label: string | null;
  note: string | null; status: string; assigned_to: number | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  referrer: string | null; created_at: string; updated_at: string;
};
type Item = {
  id: number; url: string | null; title: string | null; description: string | null; quantity: number; origin_country: string | null; store_key: string | null;
  weight: string | null; meta_status: string; meta_title: string | null; meta_image: string | null; meta_price: string | null; meta_currency: string | null;
};

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const r = db.prepare("SELECT * FROM requests WHERE id = ?").get(id) as Req | undefined;
  if (!r) notFound();
  const items = db.prepare("SELECT * FROM request_items WHERE request_id = ? ORDER BY position").all(id) as Item[];
  // The customer's recorded visit (self-hosted recordings), for admins and supervisors.
  // All visits of the browser that placed the order, newest first (the one with the order is marked).
  const visits = canViewInsights(me.role) ? sessionsForRequest(id, r.tracking_code) : [];
  const files = db
    .prepare("SELECT u.id, u.mime, u.request_item_id FROM uploads u JOIN request_items i ON i.id = u.request_item_id WHERE i.request_id = ? ORDER BY u.created_at")
    .all(id) as { id: string; mime: string; request_item_id: number }[];
  logView(id, me.id);
  const events = db
    .prepare("SELECT e.id, e.type, e.body, e.meta, e.created_at, s.name AS staff FROM request_events e LEFT JOIN staff s ON s.id = e.staff_id WHERE e.request_id = ? ORDER BY e.id DESC")
    .all(id) as LogEvent[];
  const assignee = r.assigned_to ? (db.prepare("SELECT name FROM staff WHERE id = ?").get(r.assigned_to) as { name: string } | undefined)?.name : null;
  const staff = listActiveStaff();
  const intl = toIntlMobile(r.phone);
  const honorific = r.gender === "female" ? "خانم" : r.gender === "male" ? "آقای" : "";

  return (
    <>
      <Link href="/admin/requests" className="mb-3 inline-flex items-center gap-1 text-sm text-[#71717A] hover:text-[#18181B]">
        <ArrowRight className="size-4" /> درخواست‌ها
      </Link>

      <header className="mb-5 flex flex-col gap-4 rounded-xl border border-[#E4E4E7] bg-white p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-[#18181B] sm:text-2xl">
              {honorific} {r.first_name} {r.last_name}
            </h1>
            <StatusBadge status={r.status} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#52525B]">
            <CopyCode code={r.tracking_code} />
            <span>{methods[r.method].title}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5 text-[#A1A1AA]" aria-hidden />
              {formatFaDateTime(r.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="size-3.5 text-[#A1A1AA]" aria-hidden />
              {toFaDigits(items.length)} کالا
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5 text-[#A1A1AA]" aria-hidden />
              {assignee ?? "بدون کارشناس"}
            </span>
          </div>
        </div>
        <ContactButtons requestId={r.id} phone={r.phone} intl={intl} />
      </header>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Panel>
            <RequestControls requestId={r.id} status={r.status} assignedTo={r.assigned_to} meId={me.id} staff={staff} />
          </Panel>
          <Panel title="مشتری" className="hidden lg:flex">
            <dl className="grid gap-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71717A]">نام</dt>
                <dd className="font-semibold">{r.first_name} {r.last_name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71717A]">موبایل</dt>
                <dd dir="ltr" className="font-mono font-semibold">{r.phone}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71717A]">ثبت</dt>
                <dd>{formatFaDateTime(r.created_at)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71717A]">منبع</dt>
                <dd className="inline-flex items-center gap-1 truncate">
                  <Globe className="size-3.5 text-[#A1A1AA]" aria-hidden />
                  {r.source === "sepex.net" || r.method === "form" ? `سایت سپکس${r.source_label ? `، ${r.source_label}` : ""}` : [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ") || (r.referrer ? hostOf(r.referrer) : "مستقیم")}
                </dd>
              </div>
              {visits.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <dt className="text-[#71717A]">رفتار در سایت{visits.length > 1 ? ` (${toFaDigits(visits.length)} بازدید)` : ""}</dt>
                  <dd className="flex flex-col gap-1">
                    {visits.map((v) => (
                      <Link
                        key={v.id}
                        href={`/admin/insights/sessions/${v.id}`}
                        className="flex items-center justify-between gap-2 rounded-md text-[12px] text-[#2563EB] hover:underline"
                      >
                        <span className="font-semibold">{v.tracking_code === r.tracking_code ? "جلسه‌ی ثبت سفارش" : formatFaDateTime(v.started_at)}</span>
                        <span className="shrink-0 text-[#71717A]">{fmtDuration(v.active_ms)}</span>
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {items.map((it, i) => {
            const store = storeByKey(it.store_key);
            const itemFiles = files.filter((f) => f.request_item_id === it.id);
            return (
              <Panel key={it.id} title={items.length > 1 ? `کالای ${toFaDigits(i + 1)}` : "کالا"} action={<span className="rounded-md bg-[#F4F4F5] px-2 py-0.5 text-xs font-semibold text-[#52525B]">تعداد: {toFaDigits(it.quantity)}</span>}>
                <div className="flex gap-4">
                  {(it.url || it.meta_image) && <ItemImage src={it.meta_image} />}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                    {it.meta_title && <p dir="auto" className="font-bold leading-6 text-[#18181B]">{it.meta_title}</p>}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {(store || it.origin_country) && (
                        <span className="rounded-md bg-[#F4F4F5] px-2 py-0.5 font-semibold text-[#52525B]">
                          {store ? `${store.name}، ` : ""}
                          {countryName(it.origin_country)}
                        </span>
                      )}
                      {it.meta_price && (
                        <span dir="ltr" className="rounded-md bg-[#DCFCE7] px-2 py-0.5 font-bold text-[#15803D]">
                          {it.meta_price} {it.meta_currency}
                        </span>
                      )}
                    </div>
                    {it.url && (
                      <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="inline-flex max-w-full items-center gap-1 text-left text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span className="truncate">{it.url}</span>
                      </a>
                    )}
                    {it.url && it.meta_status === "failed" && <p className="text-xs text-[#B45309]">اطلاعات لینک خودکار خوانده نشد؛ لینک را باز کنید.</p>}
                    {it.url && it.meta_status === "pending" && <p className="text-xs text-[#71717A]">در حال خواندن اطلاعات لینک…</p>}
                    <dl className="mt-1 grid gap-1 text-[13px]">
                      {it.title && <div><dt className="inline text-[#71717A]">نام/نوع کالا: </dt><dd className="inline">{it.title}</dd></div>}
                      {it.weight && <div><dt className="inline text-[#71717A]">وزن/حجم: </dt><dd className="inline">{it.weight}</dd></div>}
                      {it.description && <div className="whitespace-pre-line"><dt className="inline text-[#71717A]">توضیحات: </dt><dd className="inline">{it.description}</dd></div>}
                    </dl>
                  </div>
                </div>
                {itemFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {itemFiles.map((f) => (
                      <a key={f.id} href={mediaUrl(f.id)!} target="_blank" rel="noopener" className="block size-24 overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#2563EB] sm:size-28">
                        {f.mime === "application/pdf" ? (
                          <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-[#71717A]"><FileText className="size-7" /> PDF</span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- private upload via authenticated /media route
                          <img src={mediaUrl(f.id)!} alt="" className="size-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
          {items.some((i) => i.url) && <RefetchButton requestId={r.id} />}
          {r.note && (
            <Panel title="توضیحات مشتری">
              <p className="whitespace-pre-line text-sm leading-7">{r.note}</p>
            </Panel>
          )}
          <ActivityLog events={events} composer={<NoteForm requestId={r.id} />} />
        </div>
      </div>
    </>
  );
}
