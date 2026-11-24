import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-shifts-"));
process.env.DATA_DIR = dir;
process.env.SMS_DRY_RUN = "1";
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("migrations 4 and 5 on an existing v3 database", () => {
  it("keeps staff, sessions and links; adds supervisor, shifts and escalated_at", async () => {
    const { migrate } = await import("@/lib/db");
    const db = new Database(path.join(dir, "v3.db"));
    db.pragma("foreign_keys = ON");
    migrate(db, 3);
    const addStaff = db.prepare("INSERT INTO staff(name, username, password_hash, phone, role, notify_sms, last_notified_at) VALUES(?,?,?,?,?,?,?)");
    addStaff.run("مدیر", "admin", "h1", null, "admin", 0, null);
    addStaff.run("علی", "ali", "h2", "09120000001", "expert", 1, "2026-11-20T10:00:00.000Z");
    db.prepare("INSERT INTO sessions(id, staff_id, expires_at) VALUES('s1', 2, '2099-01-01')").run();
    db.prepare("INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone, assigned_to) VALUES('BF-OLD1','link','a','b','male','0912',2)").run();
    db.prepare("INSERT INTO request_events(request_id, staff_id, type) VALUES(1, 2, 'viewed')").run();
    const before = db.prepare("SELECT * FROM staff ORDER BY id").all();

    migrate(db);
    expect(db.pragma("user_version", { simple: true })).toBe(5);
    expect(db.prepare("SELECT * FROM staff ORDER BY id").all()).toEqual(before);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.prepare("SELECT staff_id FROM sessions").get()).toEqual({ staff_id: 2 });
    expect(db.prepare("SELECT assigned_to, escalated_at = created_at AS backfilled FROM requests").get()).toEqual({ assigned_to: 2, backfilled: 1 });

    db.prepare("INSERT INTO staff(name, username, password_hash, role) VALUES('عرفان','erfan','h','supervisor')").run();
    expect(() => db.prepare("INSERT INTO staff(name, username, password_hash, role) VALUES('x','x','h','owner')").run()).toThrow();

    // Deleting a staff member still cascades / nulls through the rebuilt table.
    db.prepare("INSERT INTO shifts(day, staff_id) VALUES('2026-11-25', 2)").run();
    db.prepare("DELETE FROM staff WHERE id = 2").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM shifts").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT assigned_to FROM requests").get()).toEqual({ assigned_to: null });
    db.close();
  });
});

describe("shifts and the 1-hour alert", () => {
  let db: Database.Database;
  beforeAll(async () => {
    const { getDb } = await import("@/lib/db");
    db = getDb();
    const add = db.prepare("INSERT INTO staff(name, username, password_hash, phone, role, notify_sms) VALUES(?,?,?,?,?,?)");
    add.run("مدیر", "admin", "h", "09120000000", "admin", 0); // 1
    add.run("عرفان", "erfan", "h", "09120000009", "supervisor", 0); // 2
    add.run("علی", "ali", "h", "09120000001", "expert", 1); // 3
    add.run("سارا", "sara", "h", "09120000002", "expert", 1); // 4
    add.run("رضا", "reza", "h", null, "expert", 0); // 5
  });

  it("computes the Tehran day", async () => {
    const { tehranDay } = await import("@/lib/shifts");
    expect(tehranDay(Date.parse("2026-11-24T20:29:00Z"))).toBe("2026-11-24");
    expect(tehranDay(Date.parse("2026-11-24T20:31:00Z"))).toBe("2026-11-25");
  });

  it("finds the Saturday that starts the week", async () => {
    const { weekStart } = await import("@/lib/shifts");
    expect(weekStart("2026-11-24")).toBe("2026-11-21"); // Tuesday -> Saturday
    expect(weekStart("2026-11-21")).toBe("2026-11-21");
    expect(weekStart("2026-11-27")).toBe("2026-11-21"); // Friday
    expect(weekStart("2026-11-24", 1)).toBe("2026-11-28");
  });

  it("no plan means everyone; a plan narrows it", async () => {
    const { onShiftIds, setShift, tehranDay } = await import("@/lib/shifts");
    expect(onShiftIds()).toBeNull();
    setShift(tehranDay(), 4, true, 2);
    expect([...(onShiftIds() ?? [])]).toEqual([4]);
  });

  it("sends new-lead SMS only to people on today's shift", async () => {
    const { afterRequestCreated } = await import("@/lib/requests");
    db.prepare("INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone) VALUES('BF-SHIFT','link','a','b','male','09120000099')").run();
    const id = (db.prepare("SELECT id FROM requests WHERE tracking_code = 'BF-SHIFT'").get() as { id: number }).id;
    await afterRequestCreated(id, { customerSms: false });
    const to = (db.prepare("SELECT meta FROM request_events WHERE request_id = ? AND type = 'sms' AND body = 'expert'").all(id) as { meta: string }[]).map(
      (r) => JSON.parse(r.meta).to,
    );
    expect(to).toEqual(["سارا"]);
    db.prepare("UPDATE requests SET escalated_at = created_at WHERE id = ?").run(id);
  });

  it("alerts once about requests nobody touched, to the shift plus supervisors and admins", async () => {
    const { findUnattended, escalationRecipients, runEscalation } = await import("@/lib/escalation");
    const old = new Date(Date.now() - 90 * 60_000).toISOString();
    const ins = db.prepare("INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone, status, created_at) VALUES(?,?,?,?,?,?,?,?)");
    ins.run("BF-WAIT1", "link", "a", "b", "male", "0912", "new", old); // unattended
    ins.run("BF-SEEN1", "link", "a", "b", "male", "0912", "new", old); // opened by staff
    ins.run("BF-DONE1", "link", "a", "b", "male", "0912", "in_review", old); // status changed
    ins.run("BF-NEW01", "link", "a", "b", "male", "0912", "new", new Date().toISOString()); // too recent
    const seen = db.prepare("SELECT id FROM requests WHERE tracking_code = 'BF-SEEN1'").get() as { id: number };
    db.prepare("INSERT INTO request_events(request_id, staff_id, type) VALUES(?, 3, 'viewed')").run(seen.id);
    // A system event (auto round-robin assignment, SMS) doesn't count as attention.
    const wait = db.prepare("SELECT id FROM requests WHERE tracking_code = 'BF-WAIT1'").get() as { id: number };
    db.prepare("INSERT INTO request_events(request_id, staff_id, type) VALUES(?, NULL, 'assigned')").run(wait.id);

    expect(findUnattended().map((r) => r.tracking_code)).toEqual(["BF-WAIT1"]);
    expect(escalationRecipients().map((r) => r.name).sort()).toEqual(["سارا", "عرفان", "مدیر"].sort());

    const first = await runEscalation();
    expect(first.requests).toBe(1);
    expect(first.sent).toBe(3);
    const again = await runEscalation();
    expect(again.requests).toBe(0);
    const ev = db.prepare("SELECT body, meta FROM request_events WHERE request_id = ? AND type = 'sms'").get(wait.id) as { body: string; meta: string };
    expect(ev.body).toBe("escalation");
    expect(JSON.parse(ev.meta).to).toHaveLength(3);
  });
});
