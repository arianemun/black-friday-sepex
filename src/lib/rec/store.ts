import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DATA_DIR, getDb } from "../db";
import type { Batch, RecItem } from "./protocol";

/**
 * Storage for self-hosted session recordings and the analytics derived from them.
 * Raw chunks (as received, DEFLATE-compressed rrweb events) go to DATA_DIR/recordings/<sid>/<seq>.bin;
 * sessions, page views, clicks, events, API calls, fields and errors go to SQLite for the dashboards.
 */
export const REC_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "recordings");

const MAX_CHUNKS = 6000;
const MAX_SESSION_BYTES = 80 * 1024 * 1024;
const MAX_INFLATED = 24 * 1024 * 1024;
/** GA4's definition: 10 s of engagement, 2+ pages, or a conversion. */
const ENGAGED_MS = 10_000;

export const keepDays = () => {
  const n = Number(process.env.REC_KEEP_DAYS);
  return Number.isFinite(n) && n >= 1 ? n : 30;
};

export type Device = "mobile" | "tablet" | "desktop";

export function parseUa(ua: string, vw: number): { device: Device; os: string; browser: string } {
  const device: Device = /iPad|Tablet/i.test(ua)
    ? "tablet"
    : /Mobi|iPhone|Android/i.test(ua)
      ? /Android/i.test(ua) && !/Mobi/i.test(ua)
        ? "tablet"
        : "mobile"
      : vw > 0 && vw < 768
        ? "mobile"
        : "desktop";
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "دیگر";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /; wv\)|WebView/.test(ua)
            ? "WebView"
            : /CriOS|Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : "دیگر";
  return { device, os, browser };
}

export const isBot = (ua: string) =>
  !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python-requests|go-http|okhttp|node-fetch/i.test(ua);

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
const int = (v: unknown, min = 0, max = 1e9) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
};
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
};
export const cleanPath = (p: unknown) => {
  const s = clip(p, 300);
  return s.startsWith("/") ? s.split("?")[0].split("#")[0] || "/" : "/";
};

export function decodeBatch(body: Buffer): Batch | null {
  try {
    const json = zlib.inflateRawSync(body, { maxOutputLength: MAX_INFLATED }).toString("utf8");
    const b = JSON.parse(json) as Batch;
    if (!b || b.v !== 1 || !Array.isArray(b.events) || !Array.isArray(b.a)) return null;
    return b;
  } catch {
    return null;
  }
}

function eventSpan(events: unknown[]): { first: number | null; last: number | null } {
  let first: number | null = null;
  let last: number | null = null;
  for (const e of events) {
    const t = (e as { timestamp?: unknown })?.timestamp;
    if (typeof t === "number" && Number.isFinite(t)) {
      if (first === null || t < first) first = t;
      if (last === null || t > last) last = t;
    }
  }
  return { first, last };
}

type Ctx = { sid: string; device: string; now: string; lastPath: string | null };

/** Stores one batch. Returns false when the session is over its limits (caller still answers 204). */
export function sessionExists(sid: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM rec_sessions WHERE id = ?").get(sid);
}

export function ingest(sid: string, seq: number, body: Buffer, batch: Batch, ua: string, ip: string, isStaff = false): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT chunks, bytes, device FROM rec_sessions WHERE id = ?").get(sid) as
    | { chunks: number; bytes: number; device: string }
    | undefined;
  if (existing && (existing.chunks >= MAX_CHUNKS || existing.bytes >= MAX_SESSION_BYTES)) return false;

  const m = batch.meta;
  if (!existing) {
    const vw = int(m?.vw, 0, 10000);
    const info = parseUa(ua, vw);
    db.prepare(
      `INSERT INTO rec_sessions(id, started_at, last_at, entry_path, exit_path, current_path, referrer, utm_source, utm_medium, utm_campaign, utm_term,
         device, os, browser, vw, vh, ip_hash, visitor_id, return_visit, is_staff, lang, tz, conn, sw, sh, dpr)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sid,
      now,
      now,
      m ? cleanPath(m.path) : null,
      m ? cleanPath(m.path) : null,
      m ? cleanPath(m.path) : null,
      clip(m?.ref, 300) || null,
      clip(m?.utm?.s, 80) || null,
      clip(m?.utm?.m, 80) || null,
      clip(m?.utm?.c, 120) || null,
      clip(m?.utm?.t, 120) || null,
      info.device,
      info.os,
      info.browser,
      vw || null,
      int(m?.vh, 0, 10000) || null,
      crypto.createHash("sha256").update(`rec:${ip}`).digest("hex").slice(0, 16),
      typeof m?.vid === "string" && /^[a-z0-9]{20,40}$/.test(m.vid) ? m.vid : null,
      m?.ret ? 1 : 0,
      isStaff ? 1 : 0,
      clip(m?.lang, 12) || null,
      clip(m?.tz, 40) || null,
      clip(m?.conn, 10) || null,
      int(m?.sw, 0, 20000) || null,
      int(m?.sh, 0, 20000) || null,
      num(m?.dpr, 0.5, 8),
    );
  } else if (isStaff) {
    db.prepare("UPDATE rec_sessions SET is_staff = 1 WHERE id = ?").run(sid);
  }
  const device = existing?.device ?? (db.prepare("SELECT device FROM rec_sessions WHERE id = ?").get(sid) as { device: string }).device;

  if (batch.events.length) {
    const dir = path.join(/*turbopackIgnore: true*/ REC_DIR, sid);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dir, `${seq}.bin`), body);
  }

  const span = eventSpan(batch.events);
  const ctx: Ctx = { sid, device, now, lastPath: null };
  db.transaction(() => {
    db.prepare(
      `UPDATE rec_sessions SET last_at = ?,
         first_ts = CASE WHEN ? IS NULL THEN first_ts WHEN first_ts IS NULL OR ? < first_ts THEN ? ELSE first_ts END,
         last_ts = CASE WHEN ? IS NULL THEN last_ts WHEN last_ts IS NULL OR ? > last_ts THEN ? ELSE last_ts END,
         chunks = chunks + ?, bytes = bytes + ?
       WHERE id = ?`,
    ).run(now, span.first, span.first, span.first, span.last, span.last, span.last, batch.events.length ? 1 : 0, body.length, sid);
    for (const item of batch.a.slice(0, 800)) applyItem(ctx, item);
    if (ctx.lastPath) db.prepare("UPDATE rec_sessions SET current_path = ? WHERE id = ?").run(ctx.lastPath, sid);
    db.prepare(
      `UPDATE rec_sessions SET
         duration_ms = MAX(0, COALESCE(last_ts - first_ts, 0)),
         pages = (SELECT COUNT(*) FROM rec_pages WHERE session_id = @sid),
         exit_path = COALESCE((SELECT path FROM rec_pages WHERE session_id = @sid ORDER BY view DESC LIMIT 1), exit_path),
         entry_path = COALESCE((SELECT path FROM rec_pages WHERE session_id = @sid ORDER BY view ASC LIMIT 1), entry_path),
         max_scroll = MAX(max_scroll, COALESCE((SELECT MAX(max_scroll) FROM rec_pages WHERE session_id = @sid), 0)),
         active_ms = MAX(active_ms, COALESCE((SELECT SUM(active_ms) FROM rec_pages WHERE session_id = @sid), 0)),
         interactions = MAX(interactions, COALESCE((SELECT SUM(interactions) FROM rec_pages WHERE session_id = @sid), 0)),
         quick_backs = (SELECT COUNT(*) FROM rec_pages WHERE session_id = @sid AND quick_back = 1),
         reached_order = CASE WHEN EXISTS (SELECT 1 FROM rec_pages WHERE session_id = @sid AND path LIKE '/order%') THEN 1 ELSE reached_order END
       WHERE id = @sid`,
    ).run({ sid });
    db.prepare(
      // Replay timestamps stop while the visitor idles; wall time can't be shorter than active time.
      `UPDATE rec_sessions SET duration_ms = MAX(duration_ms, active_ms),
         engaged = CASE WHEN active_ms >= ? OR pages >= 2 OR tracking_code IS NOT NULL THEN 1 ELSE 0 END WHERE id = ?`,
    ).run(ENGAGED_MS, sid);
  })();
  return true;
}

function applyItem(c: Ctx, it: RecItem) {
  const db = getDb();
  const sid = c.sid;
  switch (it?.k) {
    case "page": {
      const p = cleanPath(it.path);
      db.prepare("INSERT OR IGNORE INTO rec_pages(session_id, view, path, ts, title) VALUES(?, ?, ?, ?, ?)").run(
        sid,
        int(it.view, 0, 100000),
        p,
        int(it.ts, 0, 9e15),
        clip(it.title, 120) || null,
      );
      c.lastPath = p;
      break;
    }
    case "scroll": {
      const bands = Array.isArray(it.bands) && it.bands.length === 20 ? JSON.stringify(it.bands.map((b) => int(b, 0, 86_400_000))) : null;
      db.prepare(
        `UPDATE rec_pages SET max_scroll = MAX(max_scroll, ?), doc_h = CASE WHEN ? > 0 THEN ? ELSE doc_h END, duration_ms = MAX(duration_ms, ?),
           active_ms = MAX(active_ms, ?), scroll_dist = MAX(scroll_dist, ?), interactions = MAX(interactions, ?),
           attention = COALESCE(?, attention)
         WHERE session_id = ? AND view = ?`,
      ).run(
        int(it.max, 0, 100),
        int(it.docH, 0, 500000),
        int(it.docH, 0, 500000),
        int(it.dur, 0, 86_400_000),
        int(it.act, 0, 86_400_000),
        int(it.dist, 0, 1e8),
        int(it.ia, 0, 1e6),
        bands,
        sid,
        int(it.view, 0, 100000),
      );
      break;
    }
    case "click": {
      const rage = it.rage === 1 ? 1 : it.rage === 2 ? 2 : 0;
      const dead = it.dead === 1 ? 1 : 0;
      db.prepare(
        `INSERT INTO rec_clicks(session_id, path, device, ts, x, y, doc_w, doc_h, rage, dead, selector, label, interactive, el, ox, oy)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        sid,
        cleanPath(it.path),
        c.device,
        int(it.ts, 0, 9e15),
        int(it.x, 0, 100000),
        int(it.y, 0, 500000),
        int(it.w, 1, 100000),
        int(it.h, 1, 500000),
        rage,
        dead,
        clip(it.sel, 200) || null,
        clip(it.label, 80) || null,
        it.ia === 0 ? 0 : 1,
        clip(it.el, 600) || null,
        it.ox == null ? null : int(it.ox, 0, 1000),
        it.oy == null ? null : int(it.oy, 0, 1000),
      );
      db.prepare("UPDATE rec_sessions SET clicks = clicks + 1, rage_clicks = rage_clicks + ?, dead_clicks = dead_clicks + ? WHERE id = ?").run(
        rage === 1 ? 1 : 0,
        dead,
        sid,
      );
      break;
    }
    case "err":
      db.prepare("INSERT INTO rec_errors(session_id, path, ts, message, source, stack) VALUES(?, ?, ?, ?, ?, ?)").run(
        sid,
        cleanPath(it.path),
        int(it.ts, 0, 9e15),
        clip(it.msg, 300) || "خطای ناشناخته",
        it.src === "ext" ? "ext" : "own",
        clip(it.stack, 600) || null,
      );
      if (it.src !== "ext") db.prepare("UPDATE rec_sessions SET errors = errors + 1 WHERE id = ?").run(sid);
      break;
    case "order": {
      const code = clip(it.code, 20).toUpperCase();
      const req = db.prepare("SELECT id FROM requests WHERE tracking_code = ?").get(code) as { id: number } | undefined;
      db.prepare("UPDATE rec_sessions SET tracking_code = ?, request_id = COALESCE(?, request_id) WHERE id = ?").run(code, req?.id ?? null, sid);
      break;
    }
    case "ev": {
      const name = clip(it.name, 40).replace(/[^\w.-]/g, "");
      if (!name) break;
      let props: string | null = null;
      if (it.props && typeof it.props === "object") {
        const clean: Record<string, string | number | boolean | null> = {};
        for (const [k, v] of Object.entries(it.props).slice(0, 12)) {
          if (v === null || typeof v === "number" || typeof v === "boolean") clean[clip(k, 30)] = v;
          else if (typeof v === "string") clean[clip(k, 30)] = v.slice(0, 120);
        }
        props = JSON.stringify(clean);
      }
      db.prepare("INSERT INTO rec_events(session_id, ts, path, name, props) VALUES(?, ?, ?, ?, ?)").run(sid, int(it.ts, 0, 9e15), cleanPath(it.path), name, props);
      db.prepare("UPDATE rec_sessions SET events = events + 1 WHERE id = ?").run(sid);
      break;
    }
    case "vital": {
      const name = it.name;
      if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(name)) break;
      const col = name.toLowerCase();
      const v = name === "CLS" ? num(it.value, 0, 100) : int(it.value, 0, 600_000);
      db.prepare(`UPDATE rec_pages SET ${col} = ? WHERE session_id = ? AND view = ?`).run(v, sid, int(it.view, 0, 100000));
      // The session keeps the entry page's values (what most visitors experience first).
      db.prepare(`UPDATE rec_sessions SET ${col} = COALESCE(${col}, ?) WHERE id = ?`).run(v, sid);
      if (name === "INP" || name === "CLS")
        db.prepare(`UPDATE rec_sessions SET ${col} = MAX(COALESCE(${col}, 0), ?) WHERE id = ?`).run(v, sid);
      break;
    }
    case "net": {
      const status = int(it.status, 0, 999);
      db.prepare("INSERT INTO rec_net(session_id, ts, path, url, method, status, ms) VALUES(?, ?, ?, ?, ?, ?, ?)").run(
        sid,
        int(it.ts, 0, 9e15),
        cleanPath(it.path),
        cleanPath(it.url),
        clip(it.method, 8).toUpperCase() || "GET",
        status,
        int(it.ms, 0, 600_000),
      );
      if (status === 0 || status >= 500) db.prepare("UPDATE rec_sessions SET net_errors = net_errors + 1 WHERE id = ?").run(sid);
      break;
    }
    case "field":
      db.prepare("INSERT INTO rec_fields(session_id, ts, path, form, field, ms, filled, changed) VALUES(?, ?, ?, ?, ?, ?, ?, ?)").run(
        sid,
        int(it.ts, 0, 9e15),
        cleanPath(it.path),
        clip(it.form, 40) || "form",
        clip(it.field, 40) || "field",
        int(it.ms, 0, 3_600_000),
        it.filled ? 1 : 0,
        it.changed ? 1 : 0,
      );
      break;
    case "qb":
      db.prepare("UPDATE rec_pages SET quick_back = 1 WHERE session_id = ? AND view = ?").run(sid, int(it.view, 0, 100000));
      break;
    case "move": {
      if (c.device !== "desktop" || !Array.isArray(it.pts) || it.pts.length % 3 !== 0) break;
      const pts = it.pts.slice(0, 9000).map((v) => int(v, 0, 500000));
      db.prepare("INSERT INTO rec_moves(session_id, path, doc_w, doc_h, pts) VALUES(?, ?, ?, ?, ?)").run(
        sid,
        cleanPath(it.path),
        int(it.w, 1, 100000),
        int(it.h, 1, 500000),
        JSON.stringify(pts),
      );
      break;
    }
    case "hb":
      c.lastPath = cleanPath(it.path);
      break;
  }
}

function chunkFiles(sid: string): string[] {
  try {
    return fs
      .readdirSync(path.join(/*turbopackIgnore: true*/ REC_DIR, sid))
      .filter((f) => /^\d+\.bin$/.test(f))
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  } catch {
    return [];
  }
}

/** rrweb events of a session in order; with `afterSeq`, only chunks after it (live follow). */
export function loadEvents(sid: string, afterSeq = -1): { events: unknown[]; lastSeq: number } {
  const out: unknown[] = [];
  let lastSeq = afterSeq;
  for (const f of chunkFiles(sid)) {
    const seq = Number.parseInt(f, 10);
    if (seq <= afterSeq) continue;
    const b = decodeBatch(fs.readFileSync(path.join(/*turbopackIgnore: true*/ REC_DIR, sid, f)));
    if (b) out.push(...b.events);
    lastSeq = Math.max(lastSeq, seq);
  }
  out.sort((a, b) => ((a as { timestamp: number }).timestamp ?? 0) - ((b as { timestamp: number }).timestamp ?? 0));
  return { events: out, lastSeq };
}

/** Removes sessions older than REC_KEEP_DAYS, files first. Starred sessions are kept. */
export function pruneRecordings(now = Date.now()) {
  const db = getDb();
  const cutoff = new Date(now - keepDays() * 86_400_000).toISOString();
  const old = db.prepare("SELECT id FROM rec_sessions WHERE last_at < ? AND starred = 0").all(cutoff) as { id: string }[];
  for (const { id } of old) {
    fs.rmSync(path.join(/*turbopackIgnore: true*/ REC_DIR, id), { recursive: true, force: true });
    db.prepare("DELETE FROM rec_sessions WHERE id = ?").run(id);
  }
  return old.length;
}
