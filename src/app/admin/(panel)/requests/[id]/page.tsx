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
import { Button } from "@/components/admin-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin-ui/card";
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
    <div className="space-y-4 md:space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> درخواست‌ها
      </Link>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg md:text-xl">
                {honorific} {r.first_name} {r.last_name}
                <StatusBadge status={r.status} />
              </CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground md:text-sm">
                <span dir="ltr" className="font-mono font-bold text-foreground">{r.tracking_code}</span>، {methods[r.method].title}، {formatFaDateTime(r.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href={`tel:${r.phone}`}>
                  <Phone className="ml-1.5 h-4 w-4" /> <span dir="ltr">{r.phone}</span>
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="ml-1.5 h-4 w-4 text-green-600" /> واتس‌اپ
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`https://t.me/+${intl}`} target="_blank" rel="noopener noreferrer">
                  <Send className="ml-1.5 h-4 w-4 text-sky-600" /> تلگرام
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {items.map((it, i) => {
            const store = storeByKey(it.store_key);
            const itemFiles = files.filter((f) => f.request_item_id === it.id);
            return (
              <Card key={it.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2">
                  <CardTitle className="text-base">کالای {toFaDigits(i + 1)}</CardTitle>
                  <span className="text-sm text-muted-foreground">تعداد: {toFaDigits(it.quantity)}</span>
                </CardHeader>
                <CardContent className="p-4 pt-2 md:p-6 md:pt-2">
                  <div className="flex gap-4">
                    {it.meta_image && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote store image, shown to staff only
                      <img src={it.meta_image} alt="" referrerPolicy="no-referrer" className="size-24 shrink-0 rounded-lg border object-contain" />
                    )}
                    <dl className="grid min-w-0 flex-1 gap-1.5 text-sm">
                      {it.url && (
                        <dd>
                          <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="inline-flex max-w-full items-center gap-1 break-all text-left font-medium text-blue-700 hover:underline">
                            <ExternalLink className="size-3.5 shrink-0" />
                            <span className="line-clamp-2">{it.url}</span>
                          </a>
                        </dd>
                      )}
                      {(store || it.origin_country) && (
                        <dd className="text-muted-foreground">
                          {store ? `${store.name}، ` : ""}{countryName(it.origin_country)}
                        </dd>
                      )}
                      {it.meta_title && <dd dir="auto" className="font-medium">{it.meta_title}</dd>}
                      {it.meta_price && <dd dir="ltr" className="text-right">{it.meta_price} {it.meta_currency}</dd>}
                      {it.url && it.meta_status === "failed" && <dd className="text-xs text-amber-700">اطلاعات لینک خودکار خوانده نشد؛ لینک را باز کنید.</dd>}
                      {it.url && it.meta_status === "pending" && <dd className="text-xs text-muted-foreground">در حال خواندن اطلاعات لینک…</dd>}
                      {it.title && <dd><span className="text-muted-foreground">نام/نوع کالا: </span>{it.title}</dd>}
                      {it.weight && <dd><span className="text-muted-foreground">وزن/حجم: </span>{it.weight}</dd>}
                      {it.description && <dd className="whitespace-pre-line"><span className="text-muted-foreground">توضیحات: </span>{it.description}</dd>}
                    </dl>
                  </div>
                  {itemFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {itemFiles.map((f) => (
                        <a key={f.id} href={mediaUrl(f.id)!} target="_blank" rel="noopener" className="block size-28 overflow-hidden rounded-lg border bg-gray-50 hover:border-blue-400">
                          {f.mime === "application/pdf" ? (
                            <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground"><FileText className="size-7" /> PDF</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- private upload via authenticated /media route
                            <img src={mediaUrl(f.id)!} alt="" className="size-full object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {items.some((i) => i.url) && <RefetchButton requestId={r.id} />}
          {r.note && (
            <Card>
              <CardHeader className="p-4 pb-2 md:p-6 md:pb-2"><CardTitle className="text-base">توضیحات مشتری</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 md:p-6 md:pt-0"><p className="whitespace-pre-line text-sm leading-7">{r.note}</p></CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4 md:p-5">
              <RequestControls requestId={r.id} status={r.status} assignedTo={r.assigned_to} meId={me.id} staff={staff} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2 md:p-5 md:pb-2"><CardTitle className="text-base">یادداشت و تاریخچه</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 md:p-5 md:pt-0">
              <NoteForm requestId={r.id} />
              <ol className="mt-4 space-y-3">
                {events.map((e, i) => (
                  <li key={i} className="border-r-2 border-blue-200 pr-3 text-sm">
                    <p className="font-medium">
                      {e.type === "status" ? `وضعیت: ${statusInfo(e.body ?? "").name}` : e.type === "created" ? "ثبت درخواست" : e.type === "assigned" ? `کارشناس: ${e.body}` : "یادداشت"}
                    </p>
                    {e.type === "note" && <p className="mt-1 whitespace-pre-line text-gray-700">{e.body}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.staff ? `${e.staff}، ` : ""}{formatFaDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          {(r.utm_source || r.referrer) && (
            <Card>
              <CardContent className="p-4 text-xs text-muted-foreground">
                <p>منبع: {[r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ") || "—"}</p>
                {r.referrer && <p dir="ltr" className="mt-1 truncate text-left">{r.referrer}</p>}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
