import crypto from "node:crypto";

// No 0/O/1/I/L to avoid confusion when read over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTrackingCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `BF-${s}`;
}

export function normalizeTrackingCode(raw: string): string {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("BF") ? s.slice(2) : s;
  return `BF-${body}`;
}
