import "server-only";
import { getDb, nowIso } from "./db";
import { logEvent } from "./events";
import { onShiftIds } from "./shifts";
import { sendEscalationSms } from "./sms";

/**
 * "Nobody picked this up" alert.
 * A request is unattended when it is still 'new' and no staff member has done anything on it
 * (opened it, changed status, written a note, assigned it…) since it was created.
 * After ESCALATION_MINUTES (default 60) one SMS goes to everyone on today's shift (or, with no
 * plan for today, everyone who gets new-lead SMS) plus every supervisor and admin with a phone.
 * Each request is alerted once; several waiting requests are bundled into one SMS per person.
 */

export const escalationMinutes = () => {
  const n = Number(process.env.ESCALATION_MINUTES);
  return Number.isFinite(n) && n >= 5 ? n : 60;
};

type Recipient = { id: number; name: string; phone: string };

export function escalationRecipients(): Recipient[] {
  const db = getDb();
  const staff = db
    .prepare("SELECT id, name, phone, role, notify_sms FROM staff WHERE active = 1 AND phone IS NOT NULL AND phone != ''")
    .all() as (Recipient & { role: string; notify_sms: number })[];
  const onShift = onShiftIds();
  return staff
    .filter((s) => s.role === "admin" || s.role === "supervisor" || (s.notify_sms === 1 && (!onShift || onShift.has(s.id))))
    .map(({ id, name, phone }) => ({ id, name, phone }));
}

export function findUnattended(now = Date.now()): { id: number; tracking_code: string }[] {
  const cutoff = new Date(now - escalationMinutes() * 60_000).toISOString();
  return getDb()
    .prepare(
      `SELECT r.id, r.tracking_code FROM requests r
       WHERE r.escalated_at IS NULL AND r.status = 'new' AND r.created_at <= ?
         AND NOT EXISTS (SELECT 1 FROM request_events e WHERE e.request_id = r.id AND e.staff_id IS NOT NULL)
       ORDER BY r.created_at`,
    )
    .all(cutoff) as { id: number; tracking_code: string }[];
}

let running = false;

export async function runEscalation(now = Date.now()): Promise<{ requests: number; sent: number }> {
  if (running) return { requests: 0, sent: 0 };
  running = true;
  try {
    const db = getDb();
    const due = findUnattended(now);
    if (!due.length) return { requests: 0, sent: 0 };

    // Claim first so a crash or a second process can't alert twice.
    const at = nowIso();
    const claim = db.prepare("UPDATE requests SET escalated_at = ? WHERE id = ? AND escalated_at IS NULL");
    const claimed = db.transaction(() => due.filter((r) => claim.run(at, r.id).changes === 1))();
    if (!claimed.length) return { requests: 0, sent: 0 };

    const people = escalationRecipients();
    const results = await Promise.all(people.map((p) => sendEscalationSms(p.phone, claimed.length, claimed[0].tracking_code)));
    const ok = results.some((r) => r.ok);
    const dryRun = results.length > 0 && results.every((r) => "dryRun" in r);
    for (const r of claimed)
      logEvent(r.id, "sms", {
        body: "escalation",
        meta: { ok: ok && people.length > 0, dryRun, to: people.map((p) => p.name), bundled: claimed.length },
      });
    if (!people.length) console.warn(`[escalation] ${claimed.length} unattended request(s) but nobody with a phone to alert`);
    return { requests: claimed.length, sent: results.filter((r) => r.ok).length };
  } catch (e) {
    console.error("[escalation]", (e as Error).message);
    return { requests: 0, sent: 0 };
  } finally {
    running = false;
  }
}
