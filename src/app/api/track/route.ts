import { jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { normalizeIranMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request-info";
import { normalizeTrackingCode } from "@/lib/tracking";
import { detectStore, methods, statusInfo, storeLabel, type Method } from "@/lib/catalog";

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Tracking needs both the code and the mobile number, so a guessed code alone reveals nothing. */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError("درخواست نامعتبر است.", 403);
  const ip = await getClientIp();
  if (!rateLimit(`track:ip:${ip}`, 30, 600)) return jsonError("تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره تلاش کنید.", 429);

  let body: { code?: string; phone?: string };
  try {
    body = (await readJson(req, 2_000)) as typeof body;
  } catch {
    return jsonError("درخواست نامعتبر است.");
  }
  const phone = normalizeIranMobile(body.phone ?? "");
  const code = normalizeTrackingCode(body.code ?? "");
  if (!phone || code.length !== 9) return jsonError("کد پیگیری یا شماره موبایل درست نیست.");

  const db = getDb();
  const r = db
    .prepare("SELECT id, tracking_code, method, first_name, status, created_at, updated_at FROM requests WHERE tracking_code = ? AND phone = ?")
    .get(code, phone) as
    | { id: number; tracking_code: string; method: Method; first_name: string; status: string; created_at: string; updated_at: string }
    | undefined;
  if (!r) return jsonError("درخواستی با این کد و شماره پیدا نشد.", 404);

  const items = db
    .prepare("SELECT title, meta_title, meta_image, meta_price, meta_currency, url, quantity FROM request_items WHERE request_id = ? ORDER BY position")
    .all(r.id) as {
    title: string | null;
    meta_title: string | null;
    meta_image: string | null;
    meta_price: string | null;
    meta_currency: string | null;
    url: string | null;
    quantity: number;
  }[];
  const history = db
    .prepare("SELECT type, body, created_at FROM request_events WHERE request_id = ? AND type IN ('created','status') ORDER BY id")
    .all(r.id) as { type: string; body: string | null; created_at: string }[];

  return jsonOk({
    request: {
      trackingCode: r.tracking_code,
      method: methods[r.method].title,
      firstName: r.first_name,
      status: statusInfo(r.status),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      items: items.map((i) => {
        const store = i.url ? detectStore(i.url) : undefined;
        const host = i.url ? hostOf(i.url) : null;
        return {
          title: i.meta_title || i.title || host || "کالا",
          note: i.meta_title && i.title ? i.title : null,
          store: store ? storeLabel(store) : host,
          image: i.meta_image && /^https:\/\//.test(i.meta_image) ? i.meta_image : null,
          price: i.meta_price ? [i.meta_price, i.meta_currency].filter(Boolean).join(" ") : null,
          quantity: i.quantity,
        };
      }),
      history: history.map((h) => ({ label: h.type === "created" ? "ثبت درخواست" : statusInfo(h.body ?? "").name, at: h.created_at })),
    },
  });
}
