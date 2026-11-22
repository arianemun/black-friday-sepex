import "server-only";
import { getDb } from "./db";

/**
 * Fixed-window rate limiter stored in SQLite (survives restarts, works with one process).
 * Returns true when the action is allowed.
 */
export function rateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  return db.transaction(() => {
    const row = db.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").get(key) as
      | { window_start: number; count: number }
      | undefined;
    if (!row || row.window_start !== windowStart) {
      db.prepare(
        "INSERT INTO rate_limits(key, window_start, count) VALUES(?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1"
      ).run(key, windowStart);
      return true;
    }
    if (row.count >= limit) return false;
    db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    return true;
  })();
}

/** Occasional cleanup of stale rows. */
export function pruneRateLimits() {
  const cutoff = Math.floor(Date.now() / 1000) - 2 * 86400;
  getDb().prepare("DELETE FROM rate_limits WHERE window_start < ?").run(cutoff);
}
