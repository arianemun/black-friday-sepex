import { jsonError, jsonOk, readJson } from "@/lib/api";
import { detectStore, extractUrl } from "@/lib/catalog";
import { cachedLinkMeta } from "@/lib/link-meta";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request-info";

/**
 * Live product preview for the order form: title, image and price read from the store page.
 * Best effort; a null preview is normal (bot walls, client-rendered pages, no proxy).
 */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError("درخواست نامعتبر است.", 403);
  const ip = await getClientIp();
  if (!rateLimit(`preview:ip:${ip}`, 40, 600)) return jsonError("تعداد درخواست‌ها زیاد است.", 429);

  let body: { url?: string };
  try {
    body = (await readJson(req, 5_000)) as typeof body;
  } catch {
    return jsonError("درخواست نامعتبر است.");
  }
  const url = extractUrl(String(body.url ?? "").slice(0, 4000));
  if (!url) return jsonError("لینک معتبر نیست.");

  const meta = await cachedLinkMeta(url);
  const store = detectStore(url);
  return jsonOk({
    preview: meta
      ? { title: meta.title, image: meta.image, price: meta.price, currency: meta.currency, site: store?.brand ?? store?.latin ?? meta.site }
      : null,
  });
}
