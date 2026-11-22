import "server-only";
import { getDb } from "./db";

export type RequestListRow = {
  id: number;
  tracking_code: string;
  method: "link" | "photo" | "shipping";
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  assigned_to: number | null;
  assignee: string | null;
  created_at: string;
  item_count: number;
  first_item: string | null;
  utm_source: string | null;
};

export function listRequests(f: { status?: string; q?: string; mine?: number; unassigned?: boolean; method?: string; page?: number }) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.status) {
    where.push("r.status = ?");
    args.push(f.status);
  }
  if (f.method) {
    where.push("r.method = ?");
    args.push(f.method);
  }
  if (f.mine) {
    where.push("r.assigned_to = ?");
    args.push(f.mine);
  }
  if (f.unassigned) where.push("r.assigned_to IS NULL");
  if (f.q) {
    const q = f.q.trim();
    where.push("(r.tracking_code LIKE ? OR r.phone LIKE ? OR (r.first_name || ' ' || r.last_name) LIKE ?)");
    args.push(`%${q.toUpperCase()}%`, `%${q}%`, `%${q}%`);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = 50;
  const page = Math.max(1, f.page ?? 1);
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM requests r ${w}`).get(...args) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT r.id, r.tracking_code, r.method, r.first_name, r.last_name, r.phone, r.status, r.assigned_to, r.created_at, r.utm_source,
        s.name AS assignee,
        (SELECT COUNT(*) FROM request_items i WHERE i.request_id = r.id) AS item_count,
        (SELECT COALESCE(i.title, i.meta_title, i.url) FROM request_items i WHERE i.request_id = r.id ORDER BY i.position LIMIT 1) AS first_item
       FROM requests r LEFT JOIN staff s ON s.id = r.assigned_to
       ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as RequestListRow[];
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function requestCounts() {
  const db = getDb();
  const byStatus = db.prepare("SELECT status, COUNT(*) AS c FROM requests GROUP BY status").all() as { status: string; c: number }[];
  const today = (
    db.prepare("SELECT COUNT(*) AS c FROM requests WHERE created_at >= ?").get(new Date(Date.now() - 86400_000).toISOString()) as { c: number }
  ).c;
  const unassigned = (db.prepare("SELECT COUNT(*) AS c FROM requests WHERE assigned_to IS NULL AND status = 'new'").get() as { c: number }).c;
  const total = byStatus.reduce((a, b) => a + b.c, 0);
  return { byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.c])) as Record<string, number>, today, unassigned, total };
}

export function listActiveStaff() {
  return getDb().prepare("SELECT id, name FROM staff WHERE active = 1 ORDER BY name").all() as { id: number; name: string }[];
}

/* ---------------------------------------------------------------- dashboard analytics */

export type DashRange = "today" | "7d" | "all";
const TEHRAN = "+210 minutes"; // UTC+03:30, no DST since 2022

/** ISO lower bound for the range in UTC, computed from Tehran local midnight. */
function sinceIso(range: DashRange, now = new Date()): string | null {
  if (range === "all") return null;
  const tehranNow = new Date(now.getTime() + 210 * 60_000);
  const midnight = Date.UTC(tehranNow.getUTCFullYear(), tehranNow.getUTCMonth(), tehranNow.getUTCDate()) - 210 * 60_000;
  return new Date(range === "today" ? midnight : midnight - 6 * 86400_000).toISOString();
}

export function dashboard(range: DashRange) {
  const db = getDb();
  const since = sinceIso(range);
  const w = since ? "WHERE r.created_at >= ?" : "";
  const a = since ? [since] : [];

  const total = (db.prepare(`SELECT COUNT(*) c FROM requests r ${w}`).get(...a) as { c: number }).c;
  const byStatus = Object.fromEntries(
    (db.prepare(`SELECT status, COUNT(*) c FROM requests r ${w} GROUP BY status`).all(...a) as { status: string; c: number }[]).map((r) => [r.status, r.c])
  ) as Record<string, number>;
  const byMethod = db.prepare(`SELECT method, COUNT(*) c FROM requests r ${w} GROUP BY method ORDER BY c DESC`).all(...a) as { method: string; c: number }[];
  const bySource = db
    .prepare(`SELECT COALESCE(NULLIF(r.utm_source, ''), CASE WHEN r.referrer IS NOT NULL THEN 'ارجاع از سایت دیگر' ELSE 'مستقیم' END) src, COUNT(*) c FROM requests r ${w} GROUP BY src ORDER BY c DESC LIMIT 6`)
    .all(...a) as { src: string; c: number }[];
  const unassigned = (db.prepare("SELECT COUNT(*) c FROM requests WHERE assigned_to IS NULL AND status = 'new'").get() as { c: number }).c;

  // Bars: hours for today, days otherwise (Tehran time).
  const bucketExpr = range === "today" ? `strftime('%H', r.created_at, '${TEHRAN}')` : `date(r.created_at, '${TEHRAN}')`;
  const series = db.prepare(`SELECT ${bucketExpr} b, COUNT(*) c, SUM(r.status = 'ordered') o FROM requests r ${w} GROUP BY b ORDER BY b`).all(...a) as {
    b: string;
    c: number;
    o: number;
  }[];

  // Today vs yesterday, for the KPI hint.
  const t = sinceIso("today")!;
  const yStart = new Date(new Date(t).getTime() - 86400_000).toISOString();
  const today = (db.prepare("SELECT COUNT(*) c FROM requests WHERE created_at >= ?").get(t) as { c: number }).c;
  const yesterday = (db.prepare("SELECT COUNT(*) c FROM requests WHERE created_at >= ? AND created_at < ?").get(yStart, t) as { c: number }).c;

  const experts = db
    .prepare(
      `SELECT s.id, s.name, COUNT(r.id) assigned, SUM(r.status = 'ordered') ordered, SUM(r.status IN ('new','reviewing')) open
       FROM staff s LEFT JOIN requests r ON r.assigned_to = s.id ${since ? "AND r.created_at >= ?" : ""}
       WHERE s.active = 1 GROUP BY s.id ORDER BY assigned DESC LIMIT 8`
    )
    .all(...a) as { id: number; name: string; assigned: number; ordered: number | null; open: number | null }[];

  // Fill empty buckets so the chart keeps its shape: hours so far today, or the last 7 days.
  const byBucket = new Map(series.map((s) => [s.b, s]));
  const tehranNow = new Date(Date.now() + 210 * 60_000);
  const buckets =
    range === "today"
      ? Array.from({ length: tehranNow.getUTCHours() + 1 }, (_, h) => String(h).padStart(2, "0"))
      : range === "7d"
        ? Array.from({ length: 7 }, (_, i) => new Date(tehranNow.getTime() - (6 - i) * 86400_000).toISOString().slice(0, 10))
        : series.map((s) => s.b);
  const filled = buckets.map((b) => byBucket.get(b) ?? { b, c: 0, o: 0 });

  return { total, byStatus, byMethod, bySource, unassigned, series, filled, today, yesterday, experts };
}
