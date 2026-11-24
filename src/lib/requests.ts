import "server-only";
import { z } from "zod";
import { getDb, nowIso } from "./db";
import { detectStore, extractUrl, methods, type Method } from "./catalog";
import { generateTrackingCode } from "./tracking";
import { deleteUpload, hashDraftToken } from "./uploads";
import { pruneRateLimits } from "./rate-limit";
import { cachedLinkMeta } from "./link-meta";
import { logEvent } from "./events";
import { getSettings } from "./settings";
import { sendCustomerConfirmationSms, sendExpertNotificationSms } from "./sms";

export const MAX_ITEMS = 10;
export const MAX_FILES_PER_ITEM = 5;

const text = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((s) => s.replace(/\s+/g, " ").trim().slice(0, max));

const longText = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((s) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max));

const itemSchema = z.object({
  url: z.string().max(4000).optional().default(""),
  title: text(200).optional().default(""),
  description: longText(1500).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  originCountry: z.enum(["CN", "AE", "EU", "US", "TR", "OTHER", ""]).optional().default(""),
  weight: text(60).optional().default(""),
  uploads: z.array(z.string().regex(/^[A-Za-z0-9_-]{10,40}$/)).max(MAX_FILES_PER_ITEM).optional().default([]),
});

export const submitSchema = z.object({
  method: z.enum(["link", "photo", "shipping"]),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  firstName: text(60).pipe(z.string().min(2)),
  lastName: text(80).pipe(z.string().min(2)),
  gender: z.enum(["male", "female"]),
  phone: z.string().max(20),
  code: z.string().max(10),
  note: longText(1000).optional().default(""),
  draftToken: z.string().min(16).max(64),
  utm: z
    .object({
      source: text(80).optional(),
      medium: text(80).optional(),
      campaign: text(80).optional(),
      referrer: text(300).optional(),
    })
    .optional()
    .default({}),
});

export type SubmitInput = z.infer<typeof submitSchema>;
type Item = SubmitInput["items"][number];

/** Per-method validation that zod can't express cleanly. Returns a Persian error or null. */
export function validateItems(method: Method, items: Item[]): string | null {
  for (const [i, it] of items.entries()) {
    const n = items.length > 1 ? ` (کالای ${i + 1})` : "";
    if (method === "link") {
      const url = extractUrl(it.url);
      if (!url) return `لینک کالا معتبر نیست${n}.`;
      it.url = url.slice(0, 2000);
    } else if (method === "photo") {
      if (!it.uploads.length && it.title.length < 2) return `عکس یا نام کالا را وارد کنید${n}.`;
      it.url = extractUrl(it.url)?.slice(0, 2000) ?? "";
    } else {
      if (it.title.length < 2 && it.description.length < 2) return `نوع کالا را بنویسید${n}.`;
      it.url = extractUrl(it.url)?.slice(0, 2000) ?? "";
    }
  }
  return null;
}

export type CreatedRequest = { id: number; trackingCode: string };

export function createRequest(
  input: SubmitInput,
  phone: string,
  meta: { ip: string; userAgent: string }
): CreatedRequest | { error: string } {
  const db = getDb();
  const tokenHash = hashDraftToken(input.draftToken);
  return db.transaction(() => {
    let trackingCode = generateTrackingCode();
    while (db.prepare("SELECT 1 FROM requests WHERE tracking_code = ?").get(trackingCode)) trackingCode = generateTrackingCode();

    const r = db
      .prepare(
        `INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone, note,
          utm_source, utm_medium, utm_campaign, referrer, ip, user_agent)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        trackingCode,
        input.method,
        input.firstName,
        input.lastName,
        input.gender,
        phone,
        input.note || null,
        input.utm.source || null,
        input.utm.medium || null,
        input.utm.campaign || null,
        input.utm.referrer || null,
        meta.ip,
        meta.userAgent
      );
    const requestId = Number(r.lastInsertRowid);

    const insItem = db.prepare(
      `INSERT INTO request_items(request_id, position, url, title, description, quantity, origin_country, store_key, weight, meta_status)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const claim = db.prepare(
      "UPDATE uploads SET request_item_id = ? WHERE id = ? AND kind = 'customer' AND request_item_id IS NULL AND draft_token_hash = ?"
    );
    for (const [pos, it] of input.items.entries()) {
      const store = it.url ? detectStore(it.url) : undefined;
      const res = insItem.run(
        requestId,
        pos,
        it.url || null,
        it.title || null,
        it.description || null,
        it.quantity,
        it.originCountry || store?.country || null,
        store?.key ?? null,
        it.weight || null,
        it.url ? "pending" : "none"
      );
      const itemId = Number(res.lastInsertRowid);
      for (const uploadId of it.uploads) {
        const ok = claim.run(itemId, uploadId, tokenHash).changes === 1;
        if (!ok) throw new UploadOwnershipError();
      }
    }
    db.prepare("INSERT INTO request_events(request_id, type, body) VALUES(?, 'created', ?)").run(requestId, methods[input.method].title);
    return { id: requestId, trackingCode };
  })();
}

export class UploadOwnershipError extends Error {}

/** Picks who gets notified (and, in round-robin mode, assigned). */
function pickExperts(requestId: number): { id: number; phone: string; name: string }[] {
  const db = getDb();
  const experts = db
    .prepare(
      `SELECT id, phone, name FROM staff WHERE active = 1 AND notify_sms = 1 AND phone IS NOT NULL AND phone != ''
       ORDER BY COALESCE(last_notified_at, '') ASC, id ASC`
    )
    .all() as { id: number; phone: string; name: string }[];
  if (!experts.length) return [];
  const settings = getSettings();
  const chosen = settings.notify_mode === "round_robin" ? [experts[0]] : experts;
  const now = nowIso();
  db.transaction(() => {
    for (const e of chosen) db.prepare("UPDATE staff SET last_notified_at = ? WHERE id = ?").run(now, e.id);
    if (settings.notify_mode === "round_robin") {
      db.prepare("UPDATE requests SET assigned_to = ? WHERE id = ? AND assigned_to IS NULL").run(chosen[0].id, requestId);
      db.prepare("INSERT INTO request_events(request_id, staff_id, type, body, meta) VALUES(?, NULL, 'assigned', ?, ?)").run(
        requestId,
        chosen[0].name,
        JSON.stringify({ auto: true })
      );
    }
  })();
  return chosen;
}

/** Runs after the response: SMS to customer and experts, then link enrichment. Never throws. */
export async function afterRequestCreated(requestId: number) {
  const db = getDb();
  const req = db
    .prepare("SELECT tracking_code, method, first_name, last_name, phone FROM requests WHERE id = ?")
    .get(requestId) as { tracking_code: string; method: Method; first_name: string; last_name: string; phone: string } | undefined;
  if (!req) return;

  const tasks: Promise<unknown>[] = [];
  tasks.push(
    sendCustomerConfirmationSms(req.phone, req.first_name, req.tracking_code).then((r) =>
      logEvent(requestId, "sms", { body: "customer", meta: { ok: r.ok, dryRun: "dryRun" in r } })
    )
  );
  try {
    for (const e of pickExperts(requestId)) {
      tasks.push(
        sendExpertNotificationSms(e.phone, req.tracking_code, `${req.first_name} ${req.last_name}`, methods[req.method].short).then((r) =>
          logEvent(requestId, "sms", { body: "expert", meta: { ok: r.ok, dryRun: "dryRun" in r, to: e.name } })
        )
      );
    }
  } catch (e) {
    console.error("[notify] pick experts failed:", (e as Error).message);
  }
  await Promise.allSettled(tasks);
  const links = await enrichRequestLinks(requestId);
  if (links.total) logEvent(requestId, "link_meta", { meta: links });
  await housekeeping();
}

/** Removes customer files never attached to a request (abandoned forms) and stale rate-limit rows. */
async function housekeeping() {
  try {
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
    const orphans = getDb()
      .prepare("SELECT id FROM uploads WHERE kind = 'customer' AND request_item_id IS NULL AND created_at < ? LIMIT 200")
      .all(cutoff) as { id: string }[];
    for (const o of orphans) await deleteUpload(o.id);
    pruneRateLimits();
  } catch (e) {
    console.error("[housekeeping]", (e as Error).message);
  }
}

export async function enrichRequestLinks(requestId: number): Promise<{ total: number; ok: number }> {
  const db = getDb();
  const items = db
    .prepare("SELECT id, url FROM request_items WHERE request_id = ? AND url IS NOT NULL AND meta_status IN ('pending','failed')")
    .all(requestId) as { id: number; url: string }[];
  let ok = 0;
  for (const it of items) {
    const meta = await cachedLinkMeta(it.url);
    if (meta && !meta.guessed) ok++;
    db.prepare(
      `UPDATE request_items SET meta_status = ?, meta_title = ?, meta_image = ?, meta_price = ?, meta_currency = ?, meta_site = ?, meta_fetched_at = ?
       WHERE id = ?`
    ).run(
      meta ? "ok" : "failed",
      meta?.title ?? null,
      meta?.image ?? null,
      meta?.price ?? null,
      meta?.currency ?? null,
      meta?.site ?? null,
      nowIso(),
      it.id
    );
  }
  return { total: items.length, ok };
}
