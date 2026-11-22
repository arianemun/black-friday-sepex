import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";

export const OTP_LENGTH = 5;
export const OTP_TTL_SECONDS = 120;
export const OTP_RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return s || "dev-only-secret";
}

const hashCode = (phone: string, code: string) =>
  crypto.createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");

export function generateOtp(phone: string): string {
  const code = String(crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
  const db = getDb();
  const expires = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
  db.transaction(() => {
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0").run(phone);
    db.prepare("INSERT INTO otp_codes(phone, code_hash, expires_at) VALUES(?, ?, ?)").run(phone, hashCode(phone, code), expires);
  })();
  return code;
}

/** Seconds until another code may be sent to this phone (0 = allowed now). */
export function otpCooldown(phone: string): number {
  const row = getDb()
    .prepare("SELECT created_at FROM otp_codes WHERE phone = ? ORDER BY id DESC LIMIT 1")
    .get(phone) as { created_at: string } | undefined;
  if (!row) return 0;
  const elapsed = (Date.now() - new Date(row.created_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_SECONDS - elapsed));
}

export type VerifyResult = "ok" | "invalid" | "expired" | "too_many";

/** Verifies and consumes atomically. */
export function verifyOtp(phone: string, code: string): VerifyResult {
  const db = getDb();
  return db.transaction((): VerifyResult => {
    const row = db
      .prepare("SELECT id, code_hash, attempts, expires_at FROM otp_codes WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1")
      .get(phone) as { id: number; code_hash: string; attempts: number; expires_at: string } | undefined;
    if (!row) return "expired";
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);
      return "expired";
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);
      return "too_many";
    }
    const expected = Buffer.from(row.code_hash, "hex");
    const given = Buffer.from(hashCode(phone, code), "hex");
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) {
      db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);
      return "ok";
    }
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return "invalid";
  })();
}
