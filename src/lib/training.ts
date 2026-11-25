import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getDb, nowIso } from "./db";

/**
 * Training videos for staff, kept outside the repo in DATA_DIR/training:
 *   panel.mp4, panel.jpg (poster, optional), landing.mp4, …
 *   videos.json (optional): [{ "file": "panel.mp4", "title": "…", "description": "…" }] sets order and titles.
 * Videos should be H.264 + AAC MP4 with +faststart so they stream on every device.
 */
export const TRAINING_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "training");

export const SAFE_FILE = /^[a-z0-9][a-z0-9_-]{0,60}\.(mp4|jpg|webp|vtt)$/;

export type TrainingVideo = { slug: string; file: string; title: string; description: string; poster: string | null; size: number };

type Entry = { file: string; title: string; description: string };

function readManifest(): Entry[] | null {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ TRAINING_DIR, "videos.json"), "utf8"));
    if (!Array.isArray(raw)) return null;
    return raw
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && typeof (v as { file?: unknown }).file === "string")
      .map((v) => ({
        file: String(v.file),
        title: typeof v.title === "string" ? v.title : "",
        description: typeof v.description === "string" ? v.description : "",
      }));
  } catch {
    return null;
  }
}

export function listTrainingVideos(): TrainingVideo[] {
  let files: string[];
  try {
    files = fs.readdirSync(TRAINING_DIR);
  } catch {
    return [];
  }
  const mp4s = files.filter((f) => f.endsWith(".mp4") && SAFE_FILE.test(f));
  const manifest = readManifest();
  const ordered: Entry[] = manifest
    ? manifest.filter((m) => mp4s.includes(m.file))
    : mp4s.sort().map((file) => ({ file, title: "", description: "" }));
  return ordered.map((m) => {
    const slug = m.file.replace(/\.mp4$/, "");
    const poster = [`${slug}.jpg`, `${slug}.webp`].find((p) => files.includes(p)) ?? null;
    const size = fs.statSync(path.join(/*turbopackIgnore: true*/ TRAINING_DIR, m.file)).size;
    return {
      slug,
      file: m.file,
      title: m.title || slug.replace(/[-_]+/g, " "),
      description: m.description,
      poster,
      size,
    };
  });
}

/* ------------------------------------------------------------------ watch log */

export type WatchRow = {
  staff_id: number;
  name: string;
  role: string;
  slug: string;
  plays: number;
  max_position: number;
  duration: number;
  completed_at: string | null;
  first_at: string;
  last_at: string;
};

/**
 * Records progress for one staff member on one video.
 * `started` counts a new play; position only ever moves forward (furthest point reached);
 * a video counts as finished once 90% of it has been reached.
 */
export function recordWatch(staffId: number, slug: string, position: number, duration: number, started: boolean) {
  const db = getDb();
  const now = nowIso();
  const pos = Math.max(0, Math.floor(position));
  const dur = Math.max(0, Math.floor(duration));
  db.prepare(
    `INSERT INTO training_views(staff_id, slug, plays, max_position, duration, first_at, last_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(staff_id, slug) DO UPDATE SET
       plays = plays + excluded.plays,
       max_position = MAX(max_position, excluded.max_position),
       duration = MAX(duration, excluded.duration),
       last_at = excluded.last_at`,
  ).run(staffId, slug, started ? 1 : 0, pos, dur, now, now);
  db.prepare(
    `UPDATE training_views SET completed_at = ?
     WHERE staff_id = ? AND slug = ? AND completed_at IS NULL AND duration > 0 AND max_position >= duration * 0.9`,
  ).run(now, staffId, slug);
}

export function watchLog(): WatchRow[] {
  return getDb()
    .prepare(
      `SELECT v.staff_id, s.name, s.role, v.slug, v.plays, v.max_position, v.duration, v.completed_at, v.first_at, v.last_at
       FROM training_views v JOIN staff s ON s.id = v.staff_id ORDER BY v.last_at DESC`,
    )
    .all() as WatchRow[];
}
