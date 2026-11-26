import "server-only";
import { getSettings } from "./settings";

/**
 * SMS.ir "verify" (template) API.
 * Docs: POST https://api.sms.ir/v1/send/verify  { mobile, templateId, parameters: [{ name, value }] }
 *
 * Two SMS.ir accounts can be configured side by side; an admin picks which one sends (Settings):
 *   account "a": SMSIR_API_KEY, SMSIR_OTP_TEMPLATE_ID, … (the original variables)
 *   account "b": SMSIR_B_API_KEY, SMSIR_B_OTP_TEMPLATE_ID, …
 * Parameter names (SMSIR_B_OTP_PARAM, …) fall back to account a's, then to the defaults.
 * Without the active account's API key (or with SMS_DRY_RUN=1) messages are logged instead of sent.
 */

export type SmsAccountKey = "a" | "b";
export const SMS_ACCOUNT_KEYS: SmsAccountKey[] = ["a", "b"];

type TemplateKind = "OTP" | "CUSTOMER" | "EXPERT" | "ESCALATION";
const envOf = (acc: SmsAccountKey, name: string) => process.env[acc === "a" ? `SMSIR_${name}` : `SMSIR_B_${name}`] || undefined;

export function smsAccount(acc: SmsAccountKey) {
  const t = (k: TemplateKind) => envOf(acc, `${k}_TEMPLATE_ID`);
  return {
    key: acc,
    label: envOf(acc, "LABEL") ?? (acc === "a" ? "حساب اول" : "حساب دوم"),
    configured: !!envOf(acc, "API_KEY"),
    templates: { otp: t("OTP"), customer: t("CUSTOMER"), expert: t("EXPERT"), escalation: t("ESCALATION") },
  };
}
export type SmsAccount = ReturnType<typeof smsAccount>;

/** The account chosen in Settings (account a if nothing was chosen). */
export function activeSmsAccountKey(): SmsAccountKey {
  return getSettings().sms_account === "b" ? "b" : "a";
}

export function smsDryRun() {
  return !envOf(activeSmsAccountKey(), "API_KEY") || process.env.SMS_DRY_RUN === "1";
}

/** Template parameter name: this account's, else account a's, else the default. */
function param(acc: SmsAccountKey, name: string, fallback: string) {
  return envOf(acc, name) ?? process.env[`SMSIR_${name}`] ?? fallback;
}

const API_URL = "https://api.sms.ir/v1/send/verify";

type Param = { name: string; value: string };

export async function sendTemplateSms(mobile: string, templateId: string | undefined, parameters: Param[], acc: SmsAccountKey = activeSmsAccountKey()) {
  // Logs never contain parameter values (OTP codes) or the full number.
  const masked = mobile.replace(/^(\d{4})\d+(\d{3})$/, "$1****$2");
  const apiKey = envOf(acc, "API_KEY");
  const label = `[sms] account=${acc} to=${masked} template=${templateId ?? "-"} params=${parameters.map((p) => p.name).join(",")}`;
  if (!apiKey || process.env.SMS_DRY_RUN === "1" || !templateId) {
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
        "x-api-key": apiKey,
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

export function sendOtpSms(mobile: string, code: string) {
  const acc = activeSmsAccountKey();
  return sendTemplateSms(mobile, smsAccount(acc).templates.otp, [{ name: param(acc, "OTP_PARAM", "CODE"), value: code }], acc);
}

export function sendCustomerConfirmationSms(mobile: string, name: string, trackingCode: string) {
  const acc = activeSmsAccountKey();
  return sendTemplateSms(
    mobile,
    smsAccount(acc).templates.customer,
    [
      { name: param(acc, "CUSTOMER_PARAM_NAME", "NAME"), value: name },
      { name: param(acc, "CUSTOMER_PARAM_CODE", "CODE"), value: trackingCode },
    ],
    acc,
  );
}

export function sendExpertNotificationSms(mobile: string, trackingCode: string, customer: string, method: string) {
  const acc = activeSmsAccountKey();
  return sendTemplateSms(
    mobile,
    smsAccount(acc).templates.expert,
    [
      { name: param(acc, "EXPERT_PARAM_CODE", "CODE"), value: trackingCode },
      { name: param(acc, "EXPERT_PARAM_NAME", "NAME"), value: customer },
      { name: param(acc, "EXPERT_PARAM_METHOD", "METHOD"), value: method },
    ],
    acc,
  );
}

/** "N requests have waited over an hour" alert to on-shift staff, supervisors and admins. */
export function sendEscalationSms(mobile: string, count: number, trackingCode: string) {
  const acc = activeSmsAccountKey();
  return sendTemplateSms(
    mobile,
    smsAccount(acc).templates.escalation,
    [
      { name: param(acc, "ESCALATION_PARAM_COUNT", "COUNT"), value: String(count) },
      { name: param(acc, "ESCALATION_PARAM_CODE", "CODE"), value: trackingCode },
    ],
    acc,
  );
}

/** Remaining credit of an account (SMS.ir GET /v1/credit), or null if it can't be read. */
export async function smsCredit(acc: SmsAccountKey): Promise<number | null> {
  const apiKey = envOf(acc, "API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.sms.ir/v1/credit", {
      headers: { Accept: "application/json", "x-api-key": apiKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { status?: number; data?: number } | null;
    return res.ok && body?.status === 1 && typeof body.data === "number" ? body.data : null;
  } catch {
    return null;
  }
}
