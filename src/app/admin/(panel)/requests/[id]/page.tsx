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
import { adminButtonVariants } from "@/components/admin-ui";
import { Panel } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";

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
    <>
      <Link href="/admin/requests" className="mb-3 inline-flex items-center gap-1 text-sm text-[#71717A] hover:text-[#18181B]">
        <ArrowRight className="size-4" /> درخواست‌ها
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-extrabold text-[#18181B]">
            {honorific} {r.first_name} {r.last_name}
            <StatusBadge status={r.status} />
          </h1>
          <p className="mt-1 text-sm text-[#71717A]">
            <span dir="ltr" className="font-mono font-bold text-[#18181B]">{r.tracking_code}</span>، {methods[r.method].title}، {formatFaDateTime(r.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${r.phone}`} className={adminButtonVariants({ variant: "primary" })}>
            <Phone /> <span dir="ltr">{r.phone}</span>
          </a>
          <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" className={adminButtonVariants({ variant: "secondary" })}>
            <MessageCircle className="text-[#15803D]" /> واتس‌اپ
          </a>
          <a href={`https://t.me/+${intl}`} target="_blank" rel="noopener noreferrer" className={adminButtonVariants({ variant: "secondary" })}>
            <Send className="text-[#2563EB]" /> تلگرام
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          {items.map((it, i) => {
            const store = storeByKey(it.store_key);
            const itemFiles = files.filter((f) => f.request_item_id === it.id);
            return (
              <Panel key={it.id} title={`کالای ${toFaDigits(i + 1)}`} action={<span className="text-[13px] text-[#71717A]">تعداد: {toFaDigits(it.quantity)}</span>}>
                <div className="flex gap-4">
                  {it.meta_image && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote store image, shown to staff only
                    <img src={it.meta_image} alt="" referrerPolicy="no-referrer" className="size-24 shrink-0 rounded-lg border border-[#E4E4E7] object-contain" />
                  )}
                  <dl className="grid min-w-0 flex-1 gap-1.5 text-sm">
                    {it.url && (
                      <dd>
                        <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="inline-flex max-w-full items-center gap-1 break-all text-left font-semibold text-[#2563EB] hover:underline">
                          <ExternalLink className="size-3.5 shrink-0" />
                          <span className="line-clamp-2">{it.url}</span>
                        </a>
                      </dd>
                    )}
                    {(store || it.origin_country) && <dd className="text-[#52525B]">{store ? `${store.name}، ` : ""}{countryName(it.origin_country)}</dd>}
                    {it.meta_title && <dd dir="auto" className="font-semibold">{it.meta_title}</dd>}
                    {it.meta_price && <dd dir="ltr" className="text-right">{it.meta_price} {it.meta_currency}</dd>}
                    {it.url && it.meta_status === "failed" && <dd className="text-xs text-[#B45309]">اطلاعات لینک خودکار خوانده نشد؛ لینک را باز کنید.</dd>}
                    {it.url && it.meta_status === "pending" && <dd className="text-xs text-[#71717A]">در حال خواندن اطلاعات لینک…</dd>}
                    {it.title && <dd><span className="text-[#71717A]">نام/نوع کالا: </span>{it.title}</dd>}
                    {it.weight && <dd><span className="text-[#71717A]">وزن/حجم: </span>{it.weight}</dd>}
                    {it.description && <dd className="whitespace-pre-line"><span className="text-[#71717A]">توضیحات: </span>{it.description}</dd>}
                  </dl>
                </div>
                {itemFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {itemFiles.map((f) => (
                      <a key={f.id} href={mediaUrl(f.id)!} target="_blank" rel="noopener" className="block size-28 overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#2563EB]">
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
        </div>

        <aside className="flex flex-col gap-4">
          <Panel>
            <RequestControls requestId={r.id} status={r.status} assignedTo={r.assigned_to} meId={me.id} staff={staff} />
          </Panel>
          <Panel title="یادداشت و تاریخچه">
            <NoteForm requestId={r.id} />
            <ol className="flex flex-col gap-3">
              {events.map((e, i) => (
                <li key={i} className="border-r-2 border-[#E4E4E7] pr-3 text-[13px]">
                  <p className="font-semibold">
                    {e.type === "status" ? `وضعیت: ${statusInfo(e.body ?? "").name}` : e.type === "created" ? "ثبت درخواست" : e.type === "assigned" ? `کارشناس: ${e.body}` : "یادداشت"}
                  </p>
                  {e.type === "note" && <p className="mt-1 whitespace-pre-line text-[#3F3F46]">{e.body}</p>}
                  <p className="mt-0.5 text-[11px] text-[#71717A]">{e.staff ? `${e.staff}، ` : ""}{formatFaDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
          {(r.utm_source || r.referrer) && (
            <Panel title="منبع">
              <p className="text-xs text-[#52525B]">{[r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ") || "—"}</p>
              {r.referrer && <p dir="ltr" className="truncate text-left text-xs text-[#71717A]">{r.referrer}</p>}
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
