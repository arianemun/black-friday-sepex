import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DATA_DIR, getDb } from "./db";

/**
 * Automatic database backups: every BACKUP_INTERVAL_HOURS (default 6) an online copy of app.db
 * goes to DATA_DIR/backups (SQLite backup API, safe while the app is writing). Each copy is
 * opened and integrity-checked; copies older than BACKUP_KEEP_DAYS (default 7) are removed.
 * The newest backup is never deleted, whatever its age.
 */
export const BACKUP_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "backups");

const num = (v: string | undefined, def: number, min: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : def;
};
export const backupIntervalHours = () => num(process.env.BACKUP_INTERVAL_HOURS, 6, 1);
const keepDays = () => num(process.env.BACKUP_KEEP_DAYS, 7, 1);

const NAME = /^app-\d{8}-\d{4}\.db$/;

export function listBackups(): { file: string; size: number; at: Date }[] {
  try {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => NAME.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(/*turbopackIgnore: true*/ BACKUP_DIR, f));
        return { file: f, size: st.size, at: st.mtime };
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  } catch {
    return [];
  }
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

let running = false;

export async function runBackup(): Promise<{ ok: boolean; file?: string; error?: string }> {
  if (running) return { ok: false, error: "busy" };
  running = true;
  const file = `app-${stamp()}.db`;
  const dest = path.join(/*turbopackIgnore: true*/ BACKUP_DIR, file);
  const tmp = `${dest}.part`;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o750 });
    await getDb().backup(tmp);
    // The copy inherits WAL mode; switch it to a single self-contained file before checking it.
    const check = new Database(tmp);
    check.pragma("journal_mode = DELETE");
    const result = check.pragma("integrity_check", { simple: true });
    check.close();
    if (result !== "ok") throw new Error(`integrity_check: ${String(result)}`);
    fs.chmodSync(tmp, 0o640);
    for (const f of [`${tmp}-wal`, `${tmp}-shm`]) fs.rmSync(f, { force: true });
    fs.renameSync(tmp, dest);
    prune();
    console.log(`[backup] ${file} ok`);
    return { ok: true, file };
  } catch (e) {
    for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) fs.rmSync(f, { force: true });
    console.error("[backup] failed:", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  } finally {
    running = false;
  }
}

function prune() {
  const cutoff = Date.now() - keepDays() * 86_400_000;
  const all = listBackups();
  for (const b of all.slice(1)) if (b.at.getTime() < cutoff) fs.rmSync(path.join(/*turbopackIgnore: true*/ BACKUP_DIR, b.file), { force: true });
}

/** Runs a backup now if the newest one is older than the interval (covers restarts and deploys). */
export async function backupIfDue() {
  const last = listBackups()[0];
  if (!last || Date.now() - last.at.getTime() >= backupIntervalHours() * 3_600_000 - 60_000) await runBackup();
}
