import "server-only";
import { getDb } from "./db";

/**
 * Shifts: which staff members are on duty on a given Tehran calendar day.
 * A day with no shift rows means "no plan": everyone is notified as before.
 */

const TZ = "Asia/Tehran";

/** YYYY-MM-DD in Tehran for the given instant. */
export function tehranDay(at: Date | number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    typeof at === "number" ? new Date(at) : at,
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** `count` consecutive Tehran days starting at `from` (YYYY-MM-DD). */
export function dayRange(from: string, count: number): string[] {
  const [y, m, d] = from.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  return Array.from({ length: count }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10));
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Staff ids on shift that day, or null when the day has no plan. */
export function onShiftIds(day = tehranDay()): Set<number> | null {
  const rows = getDb()
    .prepare("SELECT x.staff_id FROM shifts x JOIN staff s ON s.id = x.staff_id WHERE x.day = ? AND s.active = 1")
    .all(day) as { staff_id: number }[];
  return rows.length ? new Set(rows.map((r) => r.staff_id)) : null;
}

export function shiftsBetween(from: string, to: string): { day: string; staff_id: number }[] {
  return getDb().prepare("SELECT day, staff_id FROM shifts WHERE day >= ? AND day <= ? ORDER BY day").all(from, to) as {
    day: string;
    staff_id: number;
  }[];
}

export function setShift(day: string, staffId: number, on: boolean, by: number) {
  const db = getDb();
  if (on) db.prepare("INSERT OR IGNORE INTO shifts(day, staff_id, created_by) VALUES(?, ?, ?)").run(day, staffId, by);
  else db.prepare("DELETE FROM shifts WHERE day = ? AND staff_id = ?").run(day, staffId);
}

/** Copies one day's plan onto other days (replacing what they had). */
export function copyShiftDay(from: string, to: string[], by: number) {
  const db = getDb();
  const ids = (db.prepare("SELECT staff_id FROM shifts WHERE day = ?").all(from) as { staff_id: number }[]).map((r) => r.staff_id);
  db.transaction(() => {
    for (const day of to) {
      if (day === from) continue;
      db.prepare("DELETE FROM shifts WHERE day = ?").run(day);
      for (const id of ids) db.prepare("INSERT INTO shifts(day, staff_id, created_by) VALUES(?, ?, ?)").run(day, id, by);
    }
  })();
}
