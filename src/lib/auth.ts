import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { canManageShifts, type Role } from "./roles";

const COOKIE = "sbf_session";
const SESSION_DAYS = 14;

export type Staff = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  role: Role;
  notify_sms: number;
  active: number;
};

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD when no staff exists. */
export function ensureBootstrapAdmin() {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM staff").get() as { c: number }).c;
  if (count > 0) return;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  db.prepare("INSERT INTO staff(name, username, password_hash, role, notify_sms) VALUES(?, ?, ?, 'admin', 0)").run(
    "مدیر",
    username.trim().toLowerCase(),
    bcrypt.hashSync(password, 12)
  );
}

export async function login(username: string, password: string): Promise<boolean> {
  ensureBootstrapAdmin();
  const db = getDb();
  const row = db
    .prepare("SELECT id, password_hash FROM staff WHERE username = ? AND active = 1")
    .get(username.trim().toLowerCase()) as { id: number; password_hash: string } | undefined;
  // Always run bcrypt to keep timing similar for unknown users.
  const ok = bcrypt.compareSync(password, row?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!row || !ok) return false;
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  db.prepare("INSERT INTO sessions(id, staff_id, expires_at) VALUES(?, ?, ?)").run(sha256(token), row.id, expires.toISOString());
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return true;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sha256(token));
  jar.delete(COOKIE);
}

export async function getCurrentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT s.id, s.name, s.username, s.phone, s.role, s.notify_sms, s.active
       FROM sessions x JOIN staff s ON s.id = x.staff_id
       WHERE x.id = ? AND x.expires_at > ? AND s.active = 1`
    )
    .get(sha256(token), new Date().toISOString()) as Staff | undefined;
  return row ?? null;
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/admin");
  return staff;
}

/** Admins and supervisors: shift planning. */
export async function requireShiftManager(): Promise<Staff> {
  const staff = await requireStaff();
  if (!canManageShifts(staff.role)) redirect("/admin");
  return staff;
}

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 12);
}
