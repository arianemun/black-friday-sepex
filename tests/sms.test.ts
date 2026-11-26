import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-sms-"));
process.env.DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const ENV = {
  SMSIR_API_KEY: "key-a",
  SMSIR_OTP_TEMPLATE_ID: "111",
  SMSIR_OTP_PARAM: "CODE",
  SMSIR_ESCALATION_TEMPLATE_ID: "114",
  SMSIR_B_API_KEY: "key-b",
  SMSIR_B_OTP_TEMPLATE_ID: "452109",
  SMSIR_B_ESCALATION_TEMPLATE_ID: "172259",
  SMSIR_B_LABEL: "حساب جدید",
};

describe("two SMS.ir accounts", () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 1, data: { messageId: 1 } }), { status: 200 }));
  beforeAll(() => {
    Object.assign(process.env, ENV);
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => fetchMock.mockClear());
  afterAll(() => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    vi.unstubAllGlobals();
  });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    return { url, key: (init.headers as Record<string, string>)["x-api-key"], body: JSON.parse(String(init.body)) };
  };

  it("sends from account a until an admin switches", async () => {
    const { sendOtpSms, activeSmsAccountKey, smsDryRun } = await import("@/lib/sms");
    expect(activeSmsAccountKey()).toBe("a");
    expect(smsDryRun()).toBe(false);
    await sendOtpSms("09120000000", "4821");
    expect(lastCall()).toMatchObject({ key: "key-a", body: { templateId: 111, parameters: [{ name: "CODE", value: "4821" }] } });
  });

  it("switches every message to account b, with its own templates", async () => {
    const { saveSettings } = await import("@/lib/settings");
    const { sendOtpSms, sendEscalationSms, smsAccount, activeSmsAccountKey } = await import("@/lib/sms");
    saveSettings({ sms_account: "b" });
    expect(activeSmsAccountKey()).toBe("b");
    expect(smsAccount("b")).toMatchObject({ label: "حساب جدید", configured: true, templates: { otp: "452109", escalation: "172259" } });
    await sendOtpSms("09120000000", "7310");
    // Parameter names fall back to account a's.
    expect(lastCall()).toMatchObject({ key: "key-b", body: { templateId: 452109, parameters: [{ name: "CODE", value: "7310" }] } });
    await sendEscalationSms("09120000000", 3, "BF-ABC123");
    expect(lastCall()).toMatchObject({ key: "key-b", body: { templateId: 172259 } });
  });

  it("does not send when the active account has no template for a message", async () => {
    const { sendCustomerConfirmationSms } = await import("@/lib/sms");
    const r = await sendCustomerConfirmationSms("09120000000", "علی", "BF-1");
    expect(r).toMatchObject({ ok: true, dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an account without a key as dry-run", async () => {
    const { smsDryRun } = await import("@/lib/sms");
    delete process.env.SMSIR_B_API_KEY;
    expect(smsDryRun()).toBe(true);
    process.env.SMSIR_B_API_KEY = "key-b";
  });
});
