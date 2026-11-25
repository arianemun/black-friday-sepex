import "server-only";
import { getDb } from "../db";

/** Read-side queries for the behaviour dashboards. All take an ISO lower bound on session start. */

export const RANGES = { 1: "۲۴ ساعت", 7: "۷ روز", 30: "۳۰ روز" } as const;
export type RangeDays = keyof typeof RANGES;
export const parseRange = (v: unknown): RangeDays => (v === "1" ? 1 : v === "30" ? 30 : 7);
export const sinceIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const db = () => getDb();
const n = (v: unknown) => Number(v ?? 0) || 0;

export function overview(since: string) {
  const r = db()
    .prepare(
      `SELECT COUNT(*) AS sessions,
              COUNT(DISTINCT COALESCE(visitor_id, id)) AS visitors,
              AVG(CASE WHEN duration_ms > 0 THEN duration_ms END) AS avg_ms,
              AVG(pages) AS pages,
              SUM(CASE WHEN pages <= 1 AND duration_ms < 10000 THEN 1 ELSE 0 END) AS bounces,
              SUM(reached_order) AS reached,
              SUM(CASE WHEN tracking_code IS NOT NULL THEN 1 ELSE 0 END) AS orders,
              SUM(CASE WHEN rage_clicks > 0 THEN 1 ELSE 0 END) AS rage,
              SUM(CASE WHEN dead_clicks > 0 THEN 1 ELSE 0 END) AS dead,
              SUM(CASE WHEN errors > 0 THEN 1 ELSE 0 END) AS errors,
              AVG(max_scroll) AS scroll
       FROM rec_sessions WHERE started_at >= ?`,
    )
    .get(since) as Record<string, number | null>;
  return {
    sessions: n(r.sessions),
    visitors: n(r.visitors),
    avgMs: n(r.avg_ms),
    pages: n(r.pages),
    bounces: n(r.bounces),
    reached: n(r.reached),
    orders: n(r.orders),
    rage: n(r.rage),
    dead: n(r.dead),
    errors: n(r.errors),
    scroll: n(r.scroll),
  };
}

/** Sessions per day (or per hour for a 1-day range), Tehran time. */
export function timeline(days: number, since: string) {
  const fmt = days === 1 ? "%Y-%m-%d %H:00" : "%Y-%m-%d";
  const rows = db()
    .prepare(
      `SELECT strftime('${fmt}', started_at, '+210 minutes') AS bucket, COUNT(*) AS sessions,
              SUM(CASE WHEN tracking_code IS NOT NULL THEN 1 ELSE 0 END) AS orders
       FROM rec_sessions WHERE started_at >= ? GROUP BY bucket ORDER BY bucket`,
    )
    .all(since) as { bucket: string; sessions: number; orders: number }[];
  // Fill empty buckets so gaps show as zero.
  const out: { bucket: string; sessions: number; orders: number }[] = [];
  const step = days === 1 ? 3_600_000 : 86_400_000;
  const count = days === 1 ? 24 : days;
  const end = Date.now() + 210 * 60_000;
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end - i * step).toISOString();
    const key = days === 1 ? `${d.slice(0, 10)} ${d.slice(11, 13)}:00` : d.slice(0, 10);
    out.push(rows.find((r) => r.bucket === key) ?? { bucket: key, sessions: 0, orders: 0 });
  }
  return out;
}

export function byDevice(since: string) {
  return db()
    .prepare(
      `SELECT device, COUNT(*) AS sessions, SUM(CASE WHEN tracking_code IS NOT NULL THEN 1 ELSE 0 END) AS orders,
              AVG(CASE WHEN duration_ms > 0 THEN duration_ms END) AS avg_ms
       FROM rec_sessions WHERE started_at >= ? GROUP BY device ORDER BY sessions DESC`,
    )
    .all(since) as { device: string; sessions: number; orders: number; avg_ms: number | null }[];
}

export function bySource(since: string) {
  const rows = db()
    .prepare(
      `SELECT utm_source, utm_medium, utm_campaign, referrer, tracking_code IS NOT NULL AS ordered, reached_order
       FROM rec_sessions WHERE started_at >= ?`,
    )
    .all(since) as { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer: string | null; ordered: number; reached_order: number }[];
  const map = new Map<string, { source: string; detail: string; sessions: number; reached: number; orders: number }>();
  for (const r of rows) {
    let source: string;
    let detail = "";
    if (r.utm_source) {
      source = r.utm_source;
      detail = [r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ");
    } else if (r.referrer) {
      try {
        source = new URL(r.referrer).hostname.replace(/^www\./, "");
      } catch {
        source = "ارجاع";
      }
      if (source.endsWith("sepex.net") && source !== "black.sepex.net") detail = "سایت سپکس";
      if (source === "black.sepex.net") source = "مستقیم";
    } else source = "مستقیم";
    const key = `${source}|${detail}`;
    const m = map.get(key) ?? { source, detail, sessions: 0, reached: 0, orders: 0 };
    m.sessions += 1;
    m.reached += r.reached_order;
    m.orders += r.ordered;
    map.set(key, m);
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 12);
}

export function byPage(since: string) {
  return db()
    .prepare(
      `SELECT p.path, COUNT(*) AS views, AVG(p.duration_ms) AS avg_ms, AVG(p.max_scroll) AS scroll,
              SUM(CASE WHEN s.exit_path = p.path AND p.view = (SELECT MAX(view) FROM rec_pages x WHERE x.session_id = p.session_id) THEN 1 ELSE 0 END) AS exits,
              (SELECT COUNT(*) FROM rec_clicks c JOIN rec_sessions cs ON cs.id = c.session_id WHERE c.path = p.path AND c.rage = 1 AND cs.started_at >= ?) AS rage,
              (SELECT COUNT(*) FROM rec_clicks c JOIN rec_sessions cs ON cs.id = c.session_id WHERE c.path = p.path AND c.dead = 1 AND cs.started_at >= ?) AS dead
       FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id
       WHERE s.started_at >= ? GROUP BY p.path ORDER BY views DESC LIMIT 15`,
    )
    .all(since, since, since) as { path: string; views: number; avg_ms: number; scroll: number; exits: number; rage: number; dead: number }[];
}

/** Elements people click repeatedly (rage) or that do nothing (dead). */
export function problemElements(since: string, kind: "rage" | "dead") {
  return db()
    .prepare(
      `SELECT c.path, COALESCE(NULLIF(c.label, ''), c.selector, '؟') AS label, c.selector, COUNT(*) AS clicks,
              COUNT(DISTINCT c.session_id) AS sessions, MAX(c.session_id) AS sample
       FROM rec_clicks c JOIN rec_sessions s ON s.id = c.session_id
       WHERE s.started_at >= ? AND c.${kind === "rage" ? "rage = 1" : "dead = 1"}
       GROUP BY c.path, label ORDER BY sessions DESC, clicks DESC LIMIT 10`,
    )
    .all(since) as { path: string; label: string; selector: string | null; clicks: number; sessions: number; sample: string }[];
}

export function topErrors(since: string) {
  return db()
    .prepare(
      `SELECT e.message, COUNT(*) AS count, COUNT(DISTINCT e.session_id) AS sessions, MAX(e.session_id) AS sample, MAX(e.path) AS path
       FROM rec_errors e JOIN rec_sessions s ON s.id = e.session_id
       WHERE s.started_at >= ? GROUP BY e.message ORDER BY sessions DESC LIMIT 8`,
    )
    .all(since) as { message: string; count: number; sessions: number; sample: string; path: string }[];
}

/* ------------------------------------------------------------------ sessions list */

export type SessionFilter = {
  since: string;
  device?: string;
  source?: string;
  outcome?: "order" | "reached" | "none";
  issue?: "rage" | "dead" | "error";
  path?: string;
  minSec?: number;
  page?: number;
};

export type SessionRow = {
  id: string;
  started_at: string;
  duration_ms: number;
  pages: number;
  entry_path: string | null;
  exit_path: string | null;
  device: string;
  os: string | null;
  browser: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  vw: number | null;
  vh: number | null;
  referrer: string | null;
  clicks: number;
  rage_clicks: number;
  dead_clicks: number;
  errors: number;
  max_scroll: number;
  reached_order: number;
  tracking_code: string | null;
  request_id: number | null;
  visitor_sessions: number;
};

export const PAGE_SIZE = 25;

export function listSessions(f: SessionFilter): { rows: SessionRow[]; total: number } {
  const where = ["s.started_at >= ?", "s.chunks > 0"];
  const args: unknown[] = [f.since];
  if (f.device) {
    where.push("s.device = ?");
    args.push(f.device);
  }
  if (f.source === "direct") where.push("s.utm_source IS NULL");
  else if (f.source) {
    where.push("s.utm_source = ?");
    args.push(f.source);
  }
  if (f.outcome === "order") where.push("s.tracking_code IS NOT NULL");
  if (f.outcome === "reached") where.push("s.reached_order = 1 AND s.tracking_code IS NULL");
  if (f.outcome === "none") where.push("s.reached_order = 0 AND s.tracking_code IS NULL");
  if (f.issue === "rage") where.push("s.rage_clicks > 0");
  if (f.issue === "dead") where.push("s.dead_clicks > 0");
  if (f.issue === "error") where.push("s.errors > 0");
  if (f.path) {
    where.push("EXISTS (SELECT 1 FROM rec_pages p WHERE p.session_id = s.id AND p.path = ?)");
    args.push(f.path);
  }
  if (f.minSec) {
    where.push("s.duration_ms >= ?");
    args.push(f.minSec * 1000);
  }
  const w = where.join(" AND ");
  const total = (db().prepare(`SELECT COUNT(*) AS n FROM rec_sessions s WHERE ${w}`).get(...args) as { n: number }).n;
  const page = Math.max(1, f.page ?? 1);
  const rows = db()
    .prepare(
      `SELECT s.*, CASE WHEN s.visitor_id IS NULL THEN 1 ELSE (SELECT COUNT(*) FROM rec_sessions v WHERE v.visitor_id = s.visitor_id) END AS visitor_sessions
       FROM rec_sessions s WHERE ${w} ORDER BY s.started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE) as SessionRow[];
  return { rows, total };
}

export function sourcesList(since: string): string[] {
  return (
    db().prepare("SELECT DISTINCT utm_source FROM rec_sessions WHERE started_at >= ? AND utm_source IS NOT NULL ORDER BY utm_source").all(since) as {
      utm_source: string;
    }[]
  ).map((r) => r.utm_source);
}

export function pathsList(since: string): string[] {
  return (
    db()
      .prepare(
        `SELECT p.path FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE s.started_at >= ?
         GROUP BY p.path ORDER BY COUNT(*) DESC LIMIT 30`,
      )
      .all(since) as { path: string }[]
  ).map((r) => r.path);
}

/* ------------------------------------------------------------------ one session */

export function getSession(id: string) {
  const s = db().prepare("SELECT * FROM rec_sessions WHERE id = ?").get(id) as (SessionRow & { first_ts: number | null }) | undefined;
  if (!s) return null;
  const pages = db().prepare("SELECT view, path, ts, duration_ms, max_scroll FROM rec_pages WHERE session_id = ? ORDER BY view").all(id) as {
    view: number;
    path: string;
    ts: number;
    duration_ms: number;
    max_scroll: number;
  }[];
  const clicks = db()
    .prepare("SELECT ts, path, label, rage, dead FROM rec_clicks WHERE session_id = ? AND (rage = 1 OR dead = 1) ORDER BY ts")
    .all(id) as { ts: number; path: string; label: string | null; rage: number; dead: number }[];
  const errors = db().prepare("SELECT ts, path, message FROM rec_errors WHERE session_id = ? ORDER BY ts").all(id) as {
    ts: number;
    path: string;
    message: string;
  }[];
  return { session: s, pages, clicks, errors };
}

/* ------------------------------------------------------------------ heatmaps */

export type HeatDevice = "desktop" | "mobile";

export function heatClicks(path: string, device: HeatDevice, since: string) {
  return db()
    .prepare(
      `SELECT c.x, c.y, c.doc_w, c.doc_h, c.rage, c.dead, c.label FROM rec_clicks c JOIN rec_sessions s ON s.id = c.session_id
       WHERE c.path = ? AND c.device ${device === "mobile" ? "= 'mobile'" : "IN ('desktop','tablet')"} AND s.started_at >= ? LIMIT 20000`,
    )
    .all(path, since) as { x: number; y: number; doc_w: number; doc_h: number; rage: number; dead: number; label: string | null }[];
}

export function heatScroll(path: string, device: HeatDevice, since: string) {
  return (
    db()
      .prepare(
        `SELECT p.max_scroll FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id
         WHERE p.path = ? AND s.device ${device === "mobile" ? "= 'mobile'" : "IN ('desktop','tablet')"} AND s.started_at >= ?`,
      )
      .all(path, since) as { max_scroll: number }[]
  ).map((r) => r.max_scroll);
}

/** A recent session that viewed `path` on this kind of device: its replay becomes the heatmap backdrop. */
export function heatBackdrop(path: string, device: HeatDevice, since: string) {
  return db()
    .prepare(
      `SELECT s.id AS session_id, p.ts, s.vw FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id
       WHERE p.path = ? AND s.device ${device === "mobile" ? "= 'mobile'" : "IN ('desktop','tablet')"} AND s.started_at >= ? AND s.chunks > 0
       ORDER BY (p.max_scroll >= 90) DESC, s.started_at DESC LIMIT 1`,
    )
    .get(path, since) as { session_id: string; ts: number; vw: number | null } | undefined;
}
