import { after } from "next/server";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { normalizeIranMobile } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, getUserAgent, isSameOrigin } from "@/lib/request-info";
import { afterRequestCreated, createRequest, submitSchema, UploadOwnershipError, validateItems } from "@/lib/requests";
import { toEnDigits } from "@/lib/utils";

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError("درخواست نامعتبر است.", 403);
  const ip = await getClientIp();
  if (!rateLimit(`submit:ip:${ip}`, 30, 3600)) return jsonError("تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.", 429);

  let raw: unknown;
  try {
    raw = await readJson(req, 120_000);
  } catch {
    return jsonError("درخواست نامعتبر است.");
  }
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path?.[0] ?? "");
    const msg =
      field === "firstName" ? "نام را کامل وارد کنید." : field === "lastName" ? "نام خانوادگی را کامل وارد کنید." : field === "gender" ? "جنسیت را انتخاب کنید." : "اطلاعات فرم کامل نیست.";
    return jsonError(msg);
  }
  const input = parsed.data;
  const phone = normalizeIranMobile(input.phone);
  if (!phone) return jsonError("شماره موبایل معتبر نیست.");
  const itemsError = validateItems(input.method, input.items);
  if (itemsError) return jsonError(itemsError);

  const result = verifyOtp(phone, toEnDigits(input.code).trim());
  if (result !== "ok") {
    const msg =
      result === "invalid" ? "کد تأیید اشتباه است." : result === "too_many" ? "تعداد تلاش‌ها زیاد بود. کد جدید بگیرید." : "کد تأیید منقضی شده. کد جدید بگیرید.";
    return jsonError(msg, 400, { otp: result });
  }

  let created;
  try {
    created = createRequest(input, phone, { ip, userAgent: await getUserAgent() });
  } catch (e) {
    if (e instanceof UploadOwnershipError) return jsonError("یکی از فایل‌ها معتبر نیست. دوباره بارگذاری کنید.");
    console.error("[requests] create failed:", e);
    return jsonError("ثبت درخواست با خطا مواجه شد. دوباره تلاش کنید.", 500);
  }
  if ("error" in created) return jsonError(created.error);

  after(() => afterRequestCreated(created.id).catch((e) => console.error("[requests] after failed:", e)));
  return jsonOk({ trackingCode: created.trackingCode });
}
