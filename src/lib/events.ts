import "server-only";
import { getDb } from "./db";

/**
 * Per-request activity log. Every staff action and system step on a request is a row here;
 * the admin request page shows them as a timeline. `meta` holds small JSON details.
 *
 * Types: created, viewed, status, assigned, note, contact, refetch, sms, link_meta.
 */
export type EventType = "created" | "viewed" | "status" | "assigned" | "note" | "contact" | "refetch" | "sms" | "link_meta";

export function logEvent(
  requestId: number,
  type: EventType,
  opts: { staffId?: number | null; body?: string | null; meta?: Record<string, unknown> | null } = {}
) {
  try {
    getDb()
      .prepare("INSERT INTO request_events(request_id, staff_id, type, body, meta) VALUES(?, ?, ?, ?, ?)")
      .run(requestId, opts.staffId ?? null, type, opts.body ?? null, opts.meta ? JSON.stringify(opts.meta) : null);
  } catch (e) {
    console.error("[events]", (e as Error).message);
  }
}

/** One "opened" row per staff member per request per 15 minutes, so refreshes don't flood the log. */
export function logView(requestId: number, staffId: number) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const recent = getDb()
    .prepare("SELECT 1 FROM request_events WHERE request_id = ? AND staff_id = ? AND type = 'viewed' AND created_at > ? LIMIT 1")
    .get(requestId, staffId, since);
  if (!recent) logEvent(requestId, "viewed", { staffId });
}
