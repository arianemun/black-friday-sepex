import "server-only";
import { getDb } from "../db";
import { where, type Scope } from "./analytics";

/** Session list, one session's details, and heatmap data. */

const db = () => getDb();

/* ------------------------------------------------------------------ sessions list */

export type SessionFilter = {
  outcome?: "order" | "reached" | "none";
  issue?: "rage" | "dead" | "error" | "net" | "quickback" | "scroll";
  path?: string;
  event?: string;
  minSec?: number;
  engaged?: boolean;
  visitor?: "new" | "returning";
  unwatched?: boolean;
  starred?: boolean;
  staff?: boolean;
  page?: number;
};

export type SessionRow = {
  id: string;
  started_at: string;
  last_at: string;
  duration_ms: number;
  active_ms: number;
  pages: number;
  entry_path: string | null;
  exit_path: string | null;
  current_path: string | null;
  device: string;
  os: string | null;
  browser: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  referrer: string | null;
  vw: number | null;
  vh: number | null;
  clicks: number;
  rage_clicks: number;
  dead_clicks: number;
  errors: number;
  net_errors: number;
  quick_backs: number;
  events: number;
  engaged: number;
  return_visit: number;
  is_staff: number;
  max_scroll: number;
  reached_order: number;
  tracking_code: string | null;
  request_id: number | null;
  visitor_id: string | null;
  visitor_sessions: number;
  watched_at: string | null;
  watched_name: string | null;
  note: string | null;
  starred: number;
  lang: string | null;
  tz: string | null;
  conn: string | null;
  sw: number | null;
  sh: number | null;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
};

export const PAGE_SIZE = 25;

export function listSessions(scope: Scope, f: SessionFilter): { rows: SessionRow[]; total: number } {
  const w = where(scope);
  const c = [f.staff ? w.sql.replace("s.is_staff = 0", "s.is_staff = 1") : w.sql, "s.chunks > 0"];
  const args: unknown[] = [...w.args];
  if (f.outcome === "order") c.push("s.tracking_code IS NOT NULL");
  if (f.outcome === "reached") c.push("s.reached_order = 1 AND s.tracking_code IS NULL");
  if (f.outcome === "none") c.push("s.reached_order = 0 AND s.tracking_code IS NULL");
  if (f.issue === "rage") c.push("s.rage_clicks > 0");
  if (f.issue === "dead") c.push("s.dead_clicks > 0");
  if (f.issue === "error") c.push("s.errors > 0");
  if (f.issue === "net") c.push("s.net_errors > 0");
  if (f.issue === "quickback") c.push("s.quick_backs > 0");
  if (f.issue === "scroll")
    c.push(
      "EXISTS (SELECT 1 FROM rec_pages p WHERE p.session_id = s.id AND p.doc_h > 0 AND p.scroll_dist > 3 * p.doc_h AND p.interactions = 0)",
    );
  if (f.path) {
    c.push("EXISTS (SELECT 1 FROM rec_pages p WHERE p.session_id = s.id AND p.path = ?)");
    args.push(f.path);
  }
  if (f.event) {
    c.push("EXISTS (SELECT 1 FROM rec_events e WHERE e.session_id = s.id AND e.name = ?)");
    args.push(f.event);
  }
  if (f.minSec) {
    c.push("s.active_ms >= ?");
    args.push(f.minSec * 1000);
  }
  if (f.engaged) c.push("s.engaged = 1");
  if (f.visitor === "new") c.push("s.return_visit = 0");
  if (f.visitor === "returning") c.push("s.return_visit = 1");
  if (f.unwatched) c.push("s.watched_at IS NULL");
  if (f.starred) c.push("s.starred = 1");
  const sql = c.join(" AND ");
  const total = (db().prepare(`SELECT COUNT(*) AS n FROM rec_sessions s WHERE ${sql}`).get(...args) as { n: number }).n;
  const page = Math.max(1, f.page ?? 1);
  const rows = db()
    .prepare(
      `SELECT s.*, st.name AS watched_name,
              CASE WHEN s.visitor_id IS NULL THEN 1 ELSE (SELECT COUNT(*) FROM rec_sessions v WHERE v.visitor_id = s.visitor_id) END AS visitor_sessions
       FROM rec_sessions s LEFT JOIN staff st ON st.id = s.watched_by
       WHERE ${sql} ORDER BY s.started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE) as SessionRow[];
  return { rows, total };
}

export function pathsList(scope: Scope): string[] {
  const w = where(scope);
  return (
    db()
      .prepare(`SELECT p.path FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE ${w.sql} GROUP BY p.path ORDER BY COUNT(*) DESC LIMIT 30`)
      .all(...w.args) as { path: string }[]
  ).map((r) => r.path);
}

export function eventNames(scope: Scope): string[] {
  const w = where(scope);
  return (
    db()
      .prepare(`SELECT e.name FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id WHERE ${w.sql} GROUP BY e.name ORDER BY COUNT(*) DESC`)
      .all(...w.args) as { name: string }[]
  ).map((r) => r.name);
}

/* ------------------------------------------------------------------ one session */

export type SessionDetail = NonNullable<ReturnType<typeof getSession>>;

export function getSession(id: string) {
  const s = db()
    .prepare(`SELECT s.*, st.name AS watched_name, 0 AS visitor_sessions FROM rec_sessions s LEFT JOIN staff st ON st.id = s.watched_by WHERE s.id = ?`)
    .get(id) as (SessionRow & { first_ts: number | null }) | undefined;
  if (!s) return null;
  const pages = db()
    .prepare("SELECT view, path, ts, duration_ms, active_ms, max_scroll, title, lcp, inp, cls, quick_back FROM rec_pages WHERE session_id = ? ORDER BY view")
    .all(id) as {
    view: number;
    path: string;
    ts: number;
    duration_ms: number;
    active_ms: number;
    max_scroll: number;
    title: string | null;
    lcp: number | null;
    inp: number | null;
    cls: number | null;
    quick_back: number;
  }[];
  const clicks = db()
    .prepare("SELECT ts, path, label, rage, dead FROM rec_clicks WHERE session_id = ? AND (rage = 1 OR dead = 1) ORDER BY ts")
    .all(id) as { ts: number; path: string; label: string | null; rage: number; dead: number }[];
  const errors = db().prepare("SELECT ts, path, message, source FROM rec_errors WHERE session_id = ? ORDER BY ts").all(id) as {
    ts: number;
    path: string;
    message: string;
    source: string;
  }[];
  const events = db().prepare("SELECT ts, path, name, props FROM rec_events WHERE session_id = ? ORDER BY ts").all(id) as {
    ts: number;
    path: string;
    name: string;
    props: string | null;
  }[];
  const net = db().prepare("SELECT ts, url, method, status, ms FROM rec_net WHERE session_id = ? ORDER BY ts").all(id) as {
    ts: number;
    url: string;
    method: string;
    status: number;
    ms: number;
  }[];
  // Other visits from the same browser.
  const history = s.visitor_id
    ? (db()
        .prepare(
          `SELECT id, started_at, active_ms, pages, tracking_code, entry_path, utm_source FROM rec_sessions
           WHERE visitor_id = ? AND id != ? ORDER BY started_at DESC LIMIT 20`,
        )
        .all(s.visitor_id, id) as {
        id: string;
        started_at: string;
        active_ms: number;
        pages: number;
        tracking_code: string | null;
        entry_path: string | null;
        utm_source: string | null;
      }[])
    : [];
  return { session: s, pages, clicks, errors, events, net, history };
}

export function markWatched(id: string, staffId: number) {
  db().prepare("UPDATE rec_sessions SET watched_by = COALESCE(watched_by, ?), watched_at = COALESCE(watched_at, ?) WHERE id = ?").run(staffId, new Date().toISOString(), id);
}

export function setSessionNote(id: string, note: string, starred: boolean) {
  db().prepare("UPDATE rec_sessions SET note = ?, starred = ? WHERE id = ?").run(note.trim().slice(0, 1000) || null, starred ? 1 : 0, id);
}

/** All recorded visits of the browser that placed this order (newest first). */
export function sessionsForRequest(requestId: number, trackingCode: string) {
  const hit = db()
    .prepare("SELECT id, visitor_id FROM rec_sessions WHERE request_id = ? OR tracking_code = ? ORDER BY started_at DESC LIMIT 1")
    .get(requestId, trackingCode) as { id: string; visitor_id: string | null } | undefined;
  if (!hit) return [];
  const q = hit.visitor_id
    ? db().prepare("SELECT id, started_at, active_ms, pages, tracking_code, utm_source FROM rec_sessions WHERE visitor_id = ? ORDER BY started_at DESC LIMIT 10").all(hit.visitor_id)
    : db().prepare("SELECT id, started_at, active_ms, pages, tracking_code, utm_source FROM rec_sessions WHERE id = ?").all(hit.id);
  return q as { id: string; started_at: string; active_ms: number; pages: number; tracking_code: string | null; utm_source: string | null }[];
}

/* ------------------------------------------------------------------ heatmaps */

export type HeatDevice = "desktop" | "mobile";
const devCond = (d: HeatDevice) => (d === "mobile" ? "s.device = 'mobile'" : "s.device IN ('desktop','tablet')");

export type HeatClick = {
  x: number;
  y: number;
  doc_w: number;
  doc_h: number;
  rage: number;
  dead: number;
  label: string | null;
  el: string | null;
  ox: number | null;
  oy: number | null;
};

export function heatClicks(scope: Scope, path: string, device: HeatDevice) {
  const w = where({ ...scope, device: undefined });
  return db()
    .prepare(
      `SELECT c.x, c.y, c.doc_w, c.doc_h, c.rage, c.dead, c.label, c.el, c.ox, c.oy FROM rec_clicks c JOIN rec_sessions s ON s.id = c.session_id
       WHERE ${w.sql} AND c.path = ? AND ${devCond(device)} LIMIT 30000`,
    )
    .all(...w.args, path) as HeatClick[];
}

export function heatScroll(scope: Scope, path: string, device: HeatDevice) {
  const w = where({ ...scope, device: undefined });
  return db()
    .prepare(`SELECT p.max_scroll, p.attention FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE ${w.sql} AND p.path = ? AND ${devCond(device)}`)
    .all(...w.args, path) as { max_scroll: number; attention: string | null }[];
}

export function heatMoves(scope: Scope, path: string) {
  const w = where({ ...scope, device: undefined });
  return db()
    .prepare(`SELECT m.doc_w, m.doc_h, m.pts FROM rec_moves m JOIN rec_sessions s ON s.id = m.session_id WHERE ${w.sql} AND m.path = ? LIMIT 3000`)
    .all(...w.args, path) as { doc_w: number; doc_h: number; pts: string }[];
}

/** A recent, well-scrolled session that viewed `path` on this kind of device: its replay becomes the backdrop. */
export function heatBackdrop(scope: Scope, path: string, device: HeatDevice) {
  const w = where({ ...scope, device: undefined });
  return db()
    .prepare(
      `SELECT s.id AS session_id, p.ts, s.vw FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id
       WHERE ${w.sql} AND p.path = ? AND ${devCond(device)} AND s.chunks > 0
       ORDER BY (p.max_scroll >= 90) DESC, s.started_at DESC LIMIT 1`,
    )
    .get(...w.args, path) as { session_id: string; ts: number; vw: number | null } | undefined;
}
