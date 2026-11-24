import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { detectStore, extractUrl } from "./catalog";
import { normalizeIranMobile } from "./phone";
import { generateTrackingCode } from "./tracking";

/**
 * Leads pushed from sepex.net (Gravity Forms → "CRM Management" WordPress plugin → here).
 * Server-to-server, authenticated with a shared bearer token (INTAKE_API_TOKEN).
 */

export function intakeToken(): string | null {
  const t = (process.env.INTAKE_API_TOKEN ?? "").trim();
  return t.length >= 24 ? t : null;
}

/** Constant-time check of "Authorization: Bearer <token>". */
export function checkIntakeAuth(header: string | null): boolean {
  const expected = intakeToken();
  if (!expected || !header) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const a = crypto.createHash("sha256").update(m[1].trim()).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const str = (max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? "" : String(v)).replace(/[ \t]+/g, " ").trim().slice(0, max));

export const intakeSchema = z.object({
  idempotencyKey: z.string().min(6).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  source: str(60),
  key: str(120),
  recordTitle: str(200),
  formId: str(20),
  formTitle: str(200),
  entryId: str(30),
  sourceUrl: str(500),
  fullName: str(120),
  title: str(200),
  mobile: str(40),
  email: str(160),
  extraData: str(4000),
  fields: z
    .array(z.object({ id: str(20), label: str(120), value: str(1500) }))
    .max(80)
    .optional()
    .default([]),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

export type IntakeResult =
  | { ok: true; id: number; trackingCode: string; duplicate: boolean }
  | { ok: false; error: string; status: number };

function splitName(full: string): { first: string; last: string } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "مشتری", last: "سایت سپکس" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function createIntakeRequest(input: IntakeInput, ip: string): IntakeResult {
  const phone = normalizeIranMobile(input.mobile.split(/[,،;]/)[0] ?? "");
  if (!phone) return { ok: false, status: 422, error: "invalid_mobile" };

  const db = getDb();
  const ref = `wp:${input.idempotencyKey}`;
  const existing = db.prepare("SELECT id, tracking_code FROM requests WHERE external_ref = ?").get(ref) as { id: number; tracking_code: string } | undefined;
  if (existing) return { ok: true, id: existing.id, trackingCode: existing.tracking_code, duplicate: true };

  const { first, last } = splitName(input.fullName);
  const label = input.formTitle || input.recordTitle || "فرم سایت سپکس";
  const lines = input.fields.filter((f) => f.value).map((f) => `${f.label || `فیلد ${f.id}`}: ${f.value}`);
  if (input.email && !lines.some((l) => l.includes(input.email))) lines.unshift(`ایمیل: ${input.email}`);
  const description = lines.join("\n").slice(0, 1500) || null;
  const url = extractUrl([input.extraData, ...input.fields.map((f) => f.value)].join(" "))?.slice(0, 2000) ?? null;
  const store = url ? detectStore(url) : undefined;

  try {
    return db.transaction((): IntakeResult => {
      let code = generateTrackingCode();
      while (db.prepare("SELECT 1 FROM requests WHERE tracking_code = ?").get(code)) code = generateTrackingCode();
      const r = db
        .prepare(
          `INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone, note,
            utm_source, utm_medium, utm_campaign, referrer, ip, user_agent, source, source_label, external_ref)
           VALUES(?, 'form', ?, ?, NULL, ?, ?, 'sepex.net', 'gravity-forms', ?, ?, ?, 'wordpress-plugin', ?, ?, ?)`
        )
        .run(
          code,
          first.slice(0, 60),
          last.slice(0, 80),
          phone,
          input.extraData || null,
          input.key || null,
          input.sourceUrl || null,
          ip,
          input.source || "sepex.net",
          label,
          ref
        );
      const id = Number(r.lastInsertRowid);
      db.prepare(
        `INSERT INTO request_items(request_id, position, url, title, description, quantity, origin_country, store_key, meta_status)
         VALUES(?, 0, ?, ?, ?, 1, ?, ?, ?)`
      ).run(id, url, (input.title || label).slice(0, 200), description, store?.country ?? null, store?.key ?? null, url ? "pending" : "none");
      db.prepare("INSERT INTO request_events(request_id, type, body, meta) VALUES(?, 'created', ?, ?)").run(
        id,
        `فرم سایت سپکس: ${label}`,
        JSON.stringify({ source: "sepex.net", formId: input.formId || null, entryId: input.entryId || null })
      );
      return { ok: true, id, trackingCode: code, duplicate: false };
    })();
  } catch (e) {
    // Two deliveries racing on the same key: the unique index keeps one; return it.
    const again = db.prepare("SELECT id, tracking_code FROM requests WHERE external_ref = ?").get(ref) as { id: number; tracking_code: string } | undefined;
    if (again) return { ok: true, id: again.id, trackingCode: again.tracking_code, duplicate: true };
    throw e;
  }
}
