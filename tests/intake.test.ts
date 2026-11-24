import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

// DATA_DIR is read when db.ts loads, so set it before any dynamic import.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-intake-"));
process.env.DATA_DIR = dir;

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("migration 3 on an existing v2 database", () => {
  let migrate: (db: Database.Database, upTo?: number) => void;
  beforeAll(async () => {
    ({ migrate } = await import("@/lib/db"));
  });

  it("keeps every row, column value and foreign key", () => {
    const db = new Database(path.join(dir, "v2.db"));
    db.pragma("foreign_keys = ON");
    migrate(db, 2);
    expect(db.pragma("user_version", { simple: true })).toBe(2);

    db.prepare("INSERT INTO staff(name, username, password_hash, role) VALUES('A','a','h','expert')").run();
    const ins = db.prepare(
      `INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone, note, status, assigned_to, utm_source)
       VALUES(?, ?, 'علی', 'رضایی', ?, '09120000000', 'n', 'in_review', 1, 'ig')`,
    );
    for (let i = 0; i < 50; i++) ins.run(`BF-T${i}`, ["link", "photo", "shipping"][i % 3], i % 2 ? "male" : "female");
    db.prepare("INSERT INTO request_items(request_id, position, url, title) VALUES(7, 0, 'https://x', 't')").run();
    db.prepare("INSERT INTO request_events(request_id, type, body) VALUES(7, 'created', 'b')").run();
    const before = db.prepare("SELECT * FROM requests ORDER BY id").all();

    migrate(db);
    expect(db.pragma("user_version", { simple: true })).toBe(3);

    const after = db.prepare("SELECT * FROM requests ORDER BY id").all() as Record<string, unknown>[];
    expect(after).toHaveLength(50);
    // Every pre-existing column is byte-identical; new columns take their defaults.
    after.forEach((row, i) => {
      const { source, source_label, external_ref, ...old } = row;
      expect(old).toEqual(before[i]);
      expect(source).toBe("web");
      expect(source_label).toBeNull();
      expect(external_ref).toBeNull();
    });
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);

    // New values are accepted, invalid ones still rejected.
    db.prepare(
      "INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone, status) VALUES('BF-F1','form','x','',NULL,'0912','new')",
    ).run();
    expect(() =>
      db.prepare("INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone) VALUES('BF-F2','fax','x','',NULL,'0912')").run(),
    ).toThrow();

    // Cascades still point at the rebuilt table.
    db.prepare("DELETE FROM requests WHERE id = 7").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM request_items").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM request_events WHERE request_id = 7").get()).toEqual({ n: 0 });

    // Running again is a no-op.
    migrate(db);
    expect(db.pragma("user_version", { simple: true })).toBe(3);
    db.close();
  });
});

describe("WordPress intake", () => {
  const base = {
    idempotencyKey: "wp1-e101-r1",
    source: "sepex.net",
    key: "KEY",
    recordTitle: "لید چین",
    formId: "5",
    formTitle: "خرید از چین",
    entryId: "101",
    fullName: "رضا تست",
    mobile: "۰۹۱۲۱۲۳۴۵۶۷",
    fields: [{ id: "4", label: "لینک", value: "https://www.amazon.com/dp/B0TEST" }],
  };

  it("creates once, then reports duplicates", async () => {
    const { intakeSchema, createIntakeRequest } = await import("@/lib/intake");
    const first = createIntakeRequest(intakeSchema.parse(base), "127.0.0.1");
    expect(first.ok).toBe(true);
    const again = createIntakeRequest(intakeSchema.parse(base), "127.0.0.1");
    expect(again).toMatchObject({ ok: true, duplicate: true });
    if (first.ok && again.ok) expect(again.trackingCode).toBe(first.trackingCode);

    const { getDb } = await import("@/lib/db");
    const row = getDb().prepare("SELECT method, phone, gender, source, external_ref FROM requests").get();
    expect(row).toEqual({ method: "form", phone: "09121234567", gender: null, source: "sepex.net", external_ref: "wp:wp1-e101-r1" });
  });

  it("rejects an invalid mobile", async () => {
    const { intakeSchema, createIntakeRequest } = await import("@/lib/intake");
    const r = createIntakeRequest(intakeSchema.parse({ ...base, idempotencyKey: "wp1-e102-r1", mobile: "123" }), "127.0.0.1");
    expect(r.ok).toBe(false);
  });

  it("checks the bearer token", async () => {
    process.env.INTAKE_API_TOKEN = "x".repeat(32);
    const { checkIntakeAuth } = await import("@/lib/intake");
    expect(checkIntakeAuth(`Bearer ${"x".repeat(32)}`)).toBe(true);
    expect(checkIntakeAuth(`Bearer ${"y".repeat(32)}`)).toBe(false);
    expect(checkIntakeAuth(null)).toBe(false);
  });
});
