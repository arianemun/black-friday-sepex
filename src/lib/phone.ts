import { toEnDigits } from "./utils";

/** Normalizes an Iranian mobile number to 09xxxxxxxxx, or returns null. */
export function normalizeIranMobile(raw: string): string | null {
  let s = toEnDigits(String(raw || "")).replace(/[\s\-()+.]/g, "");
  if (s.startsWith("0098")) s = "0" + s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = "0" + s.slice(2);
  else if (s.startsWith("9") && s.length === 10) s = "0" + s;
  return /^09\d{9}$/.test(s) ? s : null;
}

/** 09121234567 -> 989121234567 (for wa.me / t.me links) */
export function toIntlMobile(phone: string): string {
  return "98" + phone.slice(1);
}

export function maskPhone(phone: string): string {
  return phone.slice(0, 4) + "***" + phone.slice(-4);
}
