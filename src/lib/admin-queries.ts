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
