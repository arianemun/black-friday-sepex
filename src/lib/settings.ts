import "server-only";
import { getDb } from "./db";

export type Settings = {
  countdown_target: string; // ISO datetime
  countdown_label: string;
  campaign_end: string; // ISO datetime or ""
  notify_mode: "all" | "round_robin";
  support_phone: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  bale: string;
};

export const defaultSettings: Settings = {
  // Black Friday 2026: Friday 27 Nov (7 Azar 1405), 00:00 Tehran time.
  countdown_target: "2026-11-26T20:30:00.000Z",
  countdown_label: "زمان باقی‌مانده تا پرواز بلک‌فرایدی",
  campaign_end: "",
  notify_mode: "all",
  support_phone: "",
  whatsapp: "",
  telegram: "",
  instagram: "",
  bale: "",
};

export function getSettings(): Settings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, string> = { ...defaultSettings };
  for (const r of rows) if (r.key in defaultSettings) out[r.key] = r.value;
  return out as Settings;
}

export function saveSettings(patch: Partial<Settings>) {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (k in defaultSettings && typeof v === "string") stmt.run(k, v);
    }
  })();
}

/** Before the start: count down to the start. After it (if an end is set): count down to the end. */
export function activeCountdown(s: Settings, now = Date.now()) {
  const started = now >= new Date(s.countdown_target).getTime();
  return started && s.campaign_end
    ? { target: s.campaign_end, label: "تا پایان کمپین" }
    : { target: s.countdown_target, label: s.countdown_label };
}
