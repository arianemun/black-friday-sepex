import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, FileText, MessageCircle, Phone, Send } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listActiveStaff } from "@/lib/admin-queries";
import { countryName, methods, statusInfo, storeByKey, type Method } from "@/lib/catalog";
import { toIntlMobile } from "@/lib/phone";
import { mediaUrl } from "@/lib/uploads";
import { formatFaDateTime, toFaDigits } from "@/lib/utils";
import { RequestControls, NoteForm, RefetchButton } from "@/components/admin/request-controls";

export const metadata = { title: "جزئیات درخواست" };

type Req = {
  id: number; tracking_code: string; method: Method; first_name: string; last_name: string; gender: "male" | "female"; phone: string;
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
  const files = db
    .prepare("SELECT u.id, u.mime, u.request_item_id FROM uploads u JOIN request_items i ON i.id = u.request_item_id WHERE i.request_id = ? ORDER BY u.created_at")
    .all(id) as { id: string; mime: string; request_item_id: number }[];
  const events = db
    .prepare("SELECT e.type, e.body, e.created_at, s.name AS staff FROM request_events e LEFT JOIN staff s ON s.id = e.staff_id WHERE e.request_id = ? ORDER BY e.id DESC")
    .all(id) as { type: string; body: string | null; created_at: string; staff: string | null }[];
  const staff = listActiveStaff();
  const intl = toIntlMobile(r.phone);
  const honorific = r.gender === "female" ? "خانم" : "آقای";

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowRight className="size-4" /> درخواست‌ها
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {honorific} {r.first_name} {r.last_name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            <span dir="ltr" className="font-mono font-bold text-gray-900">{r.tracking_code}</span>، {methods[r.method].title}، {formatFaDateTime(r.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${r.phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
            <Phone className="size-4" /> <span dir="ltr">{r.phone}</span>
          </a>
          <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50">
            <MessageCircle className="size-4" /> واتس‌اپ
          </a>
          <a href={`https://t.me/+${intl}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50">
            <Send className="size-4" /> تلگرام
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {items.map((it, i) => {
            const store = storeByKey(it.store_key);
            const itemFiles = files.filter((f) => f.request_item_id === it.id);
            return (
              <section key={it.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold">کالای {toFaDigits(i + 1)}</h2>
                  <span className="text-sm text-gray-500">تعداد: {toFaDigits(it.quantity)}</span>
                </div>
                <div className="mt-3 flex gap-4">
                  {it.meta_image && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote store image, shown to staff only
                    <img src={it.meta_image} alt="" referrerPolicy="no-referrer" className="size-24 shrink-0 rounded-lg border border-gray-200 object-contain" />
                  )}
                  <dl className="grid min-w-0 flex-1 gap-1.5 text-sm">
                    {it.url && (
                      <div>
                        <dt className="sr-only">لینک</dt>
                        <dd>
                          <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="inline-flex max-w-full items-center gap-1 break-all text-left font-semibold text-blue-700 hover:underline">
                            <ExternalLink className="size-3.5 shrink-0" />
                            <span className="line-clamp-2">{it.url}</span>
                          </a>
                        </dd>
                      </div>
                    )}
                    {(store || it.origin_country) && (
                      <div className="text-gray-600">
                        {store ? `${store.name}، ` : ""}{countryName(it.origin_country)}
                      </div>
                    )}
                    {it.meta_title && <div dir="auto" className="font-semibold">{it.meta_title}</div>}
                    {it.meta_price && <div dir="ltr" className="text-right text-gray-700">{it.meta_price} {it.meta_currency}</div>}
                    {it.url && it.meta_status === "failed" && <div className="text-xs text-amber-700">اطلاعات لینک خودکار خوانده نشد؛ لینک را باز کنید.</div>}
                    {it.url && it.meta_status === "pending" && <div className="text-xs text-gray-500">در حال خواندن اطلاعات لینک…</div>}
                    {it.title && <div><span className="text-gray-500">نام/نوع کالا: </span>{it.title}</div>}
                    {it.weight && <div><span className="text-gray-500">وزن/حجم: </span>{it.weight}</div>}
                    {it.description && <div className="whitespace-pre-line"><span className="text-gray-500">توضیحات: </span>{it.description}</div>}
                  </dl>
                </div>
                {itemFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {itemFiles.map((f) => (
                      <a key={f.id} href={mediaUrl(f.id)!} target="_blank" rel="noopener" className="block size-28 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-blue-400">
                        {f.mime === "application/pdf" ? (
                          <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-gray-600"><FileText className="size-7" /> PDF</span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- private upload via authenticated /media route
                          <img src={mediaUrl(f.id)!} alt="" className="size-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {items.some((i) => i.url) && <RefetchButton requestId={r.id} />}
          {r.note && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5">
              <h2 className="font-bold">توضیحات مشتری</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-7">{r.note}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <RequestControls
              requestId={r.id}
              status={r.status}
              assignedTo={r.assigned_to}
              meId={me.id}
              staff={staff}
            />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <h2 className="font-bold">یادداشت و تاریخچه</h2>
            <NoteForm requestId={r.id} />
            <ol className="mt-4 space-y-3">
              {events.map((e, i) => (
                <li key={i} className="border-r-2 border-blue-200 pr-3 text-sm">
                  <p className="font-semibold">
                    {e.type === "status" ? `وضعیت: ${statusInfo(e.body ?? "").name}` : e.type === "created" ? "ثبت درخواست" : e.type === "assigned" ? `کارشناس: ${e.body}` : "یادداشت"}
                  </p>
                  {e.type === "note" && <p className="mt-1 whitespace-pre-line text-gray-700">{e.body}</p>}
                  <p className="mt-0.5 text-xs text-gray-400">{e.staff ? `${e.staff}، ` : ""}{formatFaDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </section>
          {(r.utm_source || r.referrer) && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-xs text-gray-500">
              <p>منبع: {[r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ") || "—"}</p>
              {r.referrer && <p dir="ltr" className="mt-1 truncate text-left">{r.referrer}</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
