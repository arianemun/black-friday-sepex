import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DATA_DIR, getDb } from "../db";
import type { Batch, RecItem } from "./protocol";

/**
 * Storage for self-hosted session recordings.
 * Raw chunks (as received, DEFLATE-compressed rrweb events) go to DATA_DIR/recordings/<sid>/<seq>.bin;
 * sessions, page views, clicks and errors go to SQLite for the dashboards.
 */
export const REC_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "recordings");

const MAX_CHUNKS = 4000;
const MAX_SESSION_BYTES = 60 * 1024 * 1024;
const MAX_INFLATED = 24 * 1024 * 1024;

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
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /CriOS|Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "دیگر";
  return { device, os, browser };
}

export const isBot = (ua: string) => !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget/i.test(ua);

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
const int = (v: unknown, min = 0, max = 1e9) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
};
const cleanPath = (p: unknown) => {
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

/** Stores one batch. Returns false when the session is over its limits (caller still answers 204). */
export function ingest(sid: string, seq: number, body: Buffer, batch: Batch, ua: string, ip: string): boolean {
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
      `INSERT INTO rec_sessions(id, started_at, last_at, entry_path, exit_path, referrer, utm_source, utm_medium, utm_campaign,
         device, os, browser, vw, vh, ip_hash, visitor_id)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sid,
      now,
      now,
      m ? cleanPath(m.path) : null,
      m ? cleanPath(m.path) : null,
      clip(m?.ref, 300) || null,
      clip(m?.utm?.s, 80) || null,
      clip(m?.utm?.m, 80) || null,
      clip(m?.utm?.c, 120) || null,
      info.device,
      info.os,
      info.browser,
      vw || null,
      int(m?.vh, 0, 10000) || null,
      crypto.createHash("sha256").update(`rec:${ip}`).digest("hex").slice(0, 16),
      typeof m?.vid === "string" && /^[a-z0-9]{20,40}$/.test(m.vid) ? m.vid : null,
    );
  }
  const device = existing?.device ?? (db.prepare("SELECT device FROM rec_sessions WHERE id = ?").get(sid) as { device: string }).device;

  const dir = path.join(/*turbopackIgnore: true*/ REC_DIR, sid);
  if (batch.events.length) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dir, `${seq}.bin`), body);
  }

  const span = eventSpan(batch.events);
  db.transaction(() => {
    db.prepare(
      `UPDATE rec_sessions SET last_at = ?,
         first_ts = CASE WHEN ? IS NULL THEN first_ts WHEN first_ts IS NULL OR ? < first_ts THEN ? ELSE first_ts END,
         last_ts = CASE WHEN ? IS NULL THEN last_ts WHEN last_ts IS NULL OR ? > last_ts THEN ? ELSE last_ts END,
         chunks = chunks + ?, bytes = bytes + ?
       WHERE id = ?`,
    ).run(now, span.first, span.first, span.first, span.last, span.last, span.last, batch.events.length ? 1 : 0, body.length, sid);
    for (const item of batch.a.slice(0, 500)) applyItem(sid, device, item);
    db.prepare(
      `UPDATE rec_sessions SET
         duration_ms = MAX(0, COALESCE(last_ts - first_ts, 0)),
         pages = (SELECT COUNT(*) FROM rec_pages WHERE session_id = ?),
         exit_path = COALESCE((SELECT path FROM rec_pages WHERE session_id = ? ORDER BY view DESC LIMIT 1), exit_path),
         entry_path = COALESCE((SELECT path FROM rec_pages WHERE session_id = ? ORDER BY view ASC LIMIT 1), entry_path),
         max_scroll = MAX(max_scroll, COALESCE((SELECT MAX(max_scroll) FROM rec_pages WHERE session_id = ?), 0)),
         reached_order = CASE WHEN EXISTS (SELECT 1 FROM rec_pages WHERE session_id = ? AND path LIKE '/order%') THEN 1 ELSE reached_order END
       WHERE id = ?`,
    ).run(sid, sid, sid, sid, sid, sid);
  })();
  return true;
}

function applyItem(sid: string, device: string, it: RecItem) {
  const db = getDb();
  switch (it?.k) {
    case "page":
      db.prepare("INSERT OR IGNORE INTO rec_pages(session_id, view, path, ts) VALUES(?, ?, ?, ?)").run(
        sid,
        int(it.view, 0, 100000),
        cleanPath(it.path),
        int(it.ts, 0, 9e15),
      );
      break;
    case "scroll":
      db.prepare(
        "UPDATE rec_pages SET max_scroll = MAX(max_scroll, ?), doc_h = ?, duration_ms = MAX(duration_ms, ?) WHERE session_id = ? AND view = ?",
      ).run(int(it.max, 0, 100), int(it.docH, 0, 500000), int(it.dur, 0, 86_400_000), sid, int(it.view, 0, 100000));
      break;
    case "click": {
      const rage = it.rage === 1 ? 1 : it.rage === 2 ? 2 : 0;
      const dead = it.dead === 1 ? 1 : 0;
      db.prepare(
        `INSERT INTO rec_clicks(session_id, path, device, ts, x, y, doc_w, doc_h, rage, dead, selector, label)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        sid,
        cleanPath(it.path),
        device,
        int(it.ts, 0, 9e15),
        int(it.x, 0, 100000),
        int(it.y, 0, 500000),
        int(it.w, 1, 100000),
        int(it.h, 1, 500000),
        rage,
        dead,
        clip(it.sel, 200) || null,
        clip(it.label, 80) || null,
      );
      db.prepare(
        "UPDATE rec_sessions SET clicks = clicks + 1, rage_clicks = rage_clicks + ?, dead_clicks = dead_clicks + ? WHERE id = ?",
      ).run(rage === 1 ? 1 : 0, dead, sid);
      break;
    }
    case "err":
      db.prepare("INSERT INTO rec_errors(session_id, path, ts, message) VALUES(?, ?, ?, ?)").run(
        sid,
        cleanPath(it.path),
        int(it.ts, 0, 9e15),
        clip(it.msg, 300) || "خطای ناشناخته",
      );
      db.prepare("UPDATE rec_sessions SET errors = errors + 1 WHERE id = ?").run(sid);
      break;
    case "order": {
      const code = clip(it.code, 20).toUpperCase();
      const req = db.prepare("SELECT id FROM requests WHERE tracking_code = ?").get(code) as { id: number } | undefined;
      db.prepare("UPDATE rec_sessions SET tracking_code = ?, request_id = COALESCE(?, request_id) WHERE id = ?").run(code, req?.id ?? null, sid);
      break;
    }
  }
}

/** All rrweb events of a session, in order. */
export function loadEvents(sid: string): unknown[] {
  const dir = path.join(/*turbopackIgnore: true*/ REC_DIR, sid);
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => /^\d+\.bin$/.test(f));
  } catch {
    return [];
  }
  files.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  const out: unknown[] = [];
  for (const f of files) {
    const b = decodeBatch(fs.readFileSync(path.join(/*turbopackIgnore: true*/ dir, f)));
    if (b) out.push(...b.events);
  }
  out.sort((a, b) => ((a as { timestamp: number }).timestamp ?? 0) - ((b as { timestamp: number }).timestamp ?? 0));
  return out;
}

/** Removes sessions older than REC_KEEP_DAYS, files first. */
export function pruneRecordings(now = Date.now()) {
  const db = getDb();
  const cutoff = new Date(now - keepDays() * 86_400_000).toISOString();
  const old = db.prepare("SELECT id FROM rec_sessions WHERE last_at < ?").all(cutoff) as { id: string }[];
  for (const { id } of old) {
    fs.rmSync(path.join(/*turbopackIgnore: true*/ REC_DIR, id), { recursive: true, force: true });
    db.prepare("DELETE FROM rec_sessions WHERE id = ?").run(id);
  }
  return old.length;
}
