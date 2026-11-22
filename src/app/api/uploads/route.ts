import { jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request-info";
import { MAX_UPLOAD_BYTES, storeUpload } from "@/lib/uploads";

/** Customer files before OTP. Bound to a random draft token; only that token can attach them to a request. */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError("درخواست نامعتبر است.", 403);
  const ip = await getClientIp();
  if (!rateLimit(`upload:ip:${ip}`, 60, 3600)) return jsonError("تعداد فایل‌ها زیاد است. کمی بعد دوباره تلاش کنید.", 429);

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD_BYTES + 100_000) return jsonError("حجم فایل بیشتر از ۱۰ مگابایت است.", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("فایل نامعتبر است.");
  }
  const file = form.get("file");
  const draftToken = String(form.get("draftToken") || "");
  if (!(file instanceof File)) return jsonError("فایلی انتخاب نشده است.");
  if (draftToken.length < 16 || draftToken.length > 64) return jsonError("درخواست نامعتبر است.");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("حجم فایل بیشتر از ۱۰ مگابایت است.", 413);

  try {
    const row = await storeUpload(Buffer.from(await file.arrayBuffer()), { kind: "customer", draftToken, ip, originalName: file.name });
    return jsonOk({ id: row.id, mime: row.mime, width: row.width, height: row.height });
  } catch (e) {
    const m = (e as Error).message;
    return jsonError(m === "bad_type" ? "فقط عکس (JPG، PNG، WebP) یا PDF قابل قبول است." : "بارگذاری فایل ناموفق بود.");
  }
}
