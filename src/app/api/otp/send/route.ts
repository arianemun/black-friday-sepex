import { jsonError, jsonOk, readJson } from "@/lib/api";
import { normalizeIranMobile } from "@/lib/phone";
import { generateOtp, otpCooldown, OTP_LENGTH, OTP_RESEND_SECONDS, OTP_TTL_SECONDS } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request-info";
import { sendOtpSms, smsDryRun } from "@/lib/sms";

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError("درخواست نامعتبر است.", 403);
  let body: { phone?: string };
  try {
    body = (await readJson(req, 2_000)) as { phone?: string };
  } catch {
    return jsonError("درخواست نامعتبر است.");
  }
  const phone = normalizeIranMobile(body.phone ?? "");
  if (!phone) return jsonError("شماره موبایل معتبر نیست.");

  const ip = await getClientIp();
  if (!rateLimit(`otp:ip:${ip}`, 12, 3600)) return jsonError("تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.", 429);
  if (!rateLimit(`otp:phone:${phone}`, 6, 3600)) return jsonError("برای این شماره کد زیادی ارسال شده. کمی بعد دوباره تلاش کنید.", 429);

  const wait = otpCooldown(phone);
  if (wait > 0) return jsonError(`لطفاً ${wait} ثانیه دیگر دوباره تلاش کنید.`, 429, { retryAfter: wait });

  const code = generateOtp(phone);
  const sent = await sendOtpSms(phone, code);
  if (!sent.ok) return jsonError("ارسال پیامک با خطا مواجه شد. چند لحظه بعد دوباره تلاش کنید.", 502);

  return jsonOk({
    length: OTP_LENGTH,
    ttl: OTP_TTL_SECONDS,
    resendIn: OTP_RESEND_SECONDS,
    // Only in local development without an SMS key, to test the flow end to end.
    ...(smsDryRun() && process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  });
}
