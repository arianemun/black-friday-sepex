import "server-only";

/**
 * SMS.ir "verify" (template) API.
 * Docs: POST https://api.sms.ir/v1/send/verify  { mobile, templateId, parameters: [{ name, value }] }
 * Without SMSIR_API_KEY (or with SMS_DRY_RUN=1) messages are logged instead of sent.
 */

const API_URL = "https://api.sms.ir/v1/send/verify";

export function smsDryRun() {
  return !process.env.SMSIR_API_KEY || process.env.SMS_DRY_RUN === "1";
}

type Param = { name: string; value: string };

export async function sendTemplateSms(mobile: string, templateId: string | undefined, parameters: Param[]) {
  // Logs never contain parameter values (OTP codes) or the full number.
  const masked = mobile.replace(/^(\d{4})\d+(\d{3})$/, "$1****$2");
  const label = `[sms] to=${masked} template=${templateId ?? "-"} params=${parameters.map((p) => p.name).join(",")}`;
  if (smsDryRun() || !templateId) {
    const devValues = process.env.NODE_ENV !== "production" ? ` ${parameters.map((p) => `${p.name}=${p.value}`).join(" ")}` : "";
    console.info(`${label}${devValues} (dry-run${!templateId ? ", no template id" : ""})`);
    return { ok: true, dryRun: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain",
        "x-api-key": process.env.SMSIR_API_KEY as string,
      },
      body: JSON.stringify({ mobile, templateId: Number(templateId), parameters }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { status?: number; message?: string; data?: { messageId?: number; cost?: number } } | null;
    if (!res.ok || body?.status !== 1) {
      console.error(`${label} failed: http=${res.status} status=${body?.status} message=${body?.message}`);
      return { ok: false };
    }
    console.info(`${label} ok messageId=${body?.data?.messageId ?? "-"}`);
    return { ok: true };
  } catch (e) {
    console.error(`${label} error:`, (e as Error).message);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const p = (envName: string, fallback: string) => process.env[envName] || fallback;

export function sendOtpSms(mobile: string, code: string) {
  return sendTemplateSms(mobile, process.env.SMSIR_OTP_TEMPLATE_ID, [{ name: p("SMSIR_OTP_PARAM", "CODE"), value: code }]);
}

export function sendCustomerConfirmationSms(mobile: string, name: string, trackingCode: string) {
  return sendTemplateSms(mobile, process.env.SMSIR_CUSTOMER_TEMPLATE_ID, [
    { name: p("SMSIR_CUSTOMER_PARAM_NAME", "NAME"), value: name },
    { name: p("SMSIR_CUSTOMER_PARAM_CODE", "CODE"), value: trackingCode },
  ]);
}

export function sendExpertNotificationSms(mobile: string, trackingCode: string, customer: string, method: string) {
  return sendTemplateSms(mobile, process.env.SMSIR_EXPERT_TEMPLATE_ID, [
    { name: p("SMSIR_EXPERT_PARAM_CODE", "CODE"), value: trackingCode },
    { name: p("SMSIR_EXPERT_PARAM_NAME", "NAME"), value: customer },
    { name: p("SMSIR_EXPERT_PARAM_METHOD", "METHOD"), value: method },
  ]);
}
