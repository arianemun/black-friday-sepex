import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-rec-"));
process.env.DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const pack = (o: unknown) => zlib.deflateRawSync(Buffer.from(JSON.stringify(o)));
const SID = "abcdefghijklmnopqrstuvwx12";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1";

describe("session recording storage", () => {
  it("stores a session, its pages, clicks, errors and links the order", async () => {
    const { getDb } = await import("@/lib/db");
    const { decodeBatch, ingest, loadEvents } = await import("@/lib/rec/store");
    const db = getDb();
    db.prepare("INSERT INTO requests(tracking_code, method, first_name, last_name, gender, phone) VALUES('BF-REC001','link','a','b',NULL,'0912')").run();

    const t0 = 1_700_000_000_000;
    const b0 = {
      v: 1,
      meta: { path: "/", ref: "", utm: { s: "sms", m: "cpc", c: "blackfriday" }, vw: 390, vh: 844, vid: "visitorvisitorvisitor01" },
      events: [{ type: 4, data: { width: 390, height: 844 }, timestamp: t0 }, { type: 2, data: {}, timestamp: t0 + 10 }],
      a: [
        { k: "page", view: 1, path: "/", ts: t0 },
        { k: "click", path: "/", ts: t0 + 1000, x: 100, y: 900, w: 390, h: 9000, sel: "a.btn", label: "ثبت سفارش", rage: 1, dead: 0 },
        { k: "click", path: "/", ts: t0 + 1100, x: 101, y: 901, w: 390, h: 9000, sel: "a.btn", label: "ثبت سفارش", rage: 2, dead: 1 },
        { k: "scroll", view: 1, max: 62, docH: 9000, dur: 4000 },
      ],
    };
    const body0 = pack(b0);
    expect(ingest(SID, 0, body0, decodeBatch(body0)!, UA, "1.2.3.4")).toBe(true);

    const b1 = {
      v: 1,
      events: [{ type: 3, data: {}, timestamp: t0 + 9000 }],
      a: [
        { k: "page", view: 2, path: "/order", ts: t0 + 5000 },
        { k: "err", path: "/order", ts: t0 + 6000, msg: "boom" },
        { k: "order", code: "bf-rec001" },
      ],
    };
    const body1 = pack(b1);
    ingest(SID, 1, body1, decodeBatch(body1)!, UA, "1.2.3.4");

    const s = db.prepare("SELECT * FROM rec_sessions WHERE id = ?").get(SID) as Record<string, unknown>;
    expect(s).toMatchObject({
      device: "mobile",
      os: "iOS",
      utm_source: "sms",
      pages: 2,
      entry_path: "/",
      exit_path: "/order",
      clicks: 2,
      rage_clicks: 1,
      dead_clicks: 1,
      errors: 1,
      max_scroll: 62,
      reached_order: 1,
      tracking_code: "BF-REC001",
      duration_ms: 9000,
      chunks: 2,
      visitor_id: "visitorvisitorvisitor01",
    });
    expect(s.request_id).toBe((db.prepare("SELECT id FROM requests WHERE tracking_code = 'BF-REC001'").get() as { id: number }).id);
    expect(loadEvents(SID).events).toHaveLength(3);
    expect(loadEvents(SID, 0)).toMatchObject({ lastSeq: 1 });
    expect(loadEvents(SID, 0).events).toHaveLength(1);
  });

  it("rejects garbage and ignores bots", async () => {
    const { decodeBatch, isBot } = await import("@/lib/rec/store");
    expect(decodeBatch(Buffer.from("not deflate"))).toBeNull();
    expect(decodeBatch(pack({ v: 2, events: [], a: [] }))).toBeNull();
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot(UA)).toBe(false);
  });

  it("stores events, vitals, network calls, fields, quick backs and moves; computes engagement", async () => {
    const { getDb } = await import("@/lib/db");
    const { decodeBatch, ingest } = await import("@/lib/rec/store");
    const db = getDb();
    const t0 = 1_700_000_100_000;
    const b2 = {
      v: 1,
      events: [{ type: 3, data: {}, timestamp: t0 }],
      a: [
        { k: "page", view: 3, path: "/order", ts: t0, title: "ثبت سفارش" },
        { k: "ev", path: "/order", ts: t0 + 100, name: "form_step", props: { step: "contact", method: "link" } },
        { k: "ev", path: "/order", ts: t0 + 200, name: "form_error", props: { step: "contact", fields: "phone" } },
        { k: "vital", view: 3, name: "LCP", value: 3100 },
        { k: "vital", view: 3, name: "CLS", value: 0.02 },
        { k: "net", path: "/order", ts: t0 + 300, url: "/api/otp/send", method: "POST", status: 500, ms: 820 },
        { k: "net", path: "/order", ts: t0 + 400, url: "/api/otp/send", method: "POST", status: 200, ms: 410 },
        { k: "field", path: "/order", ts: t0 + 500, form: "order", field: "phone", ms: 4200, filled: 1, changed: 1 },
        { k: "qb", view: 2 },
        { k: "move", path: "/order", w: 1280, h: 3000, pts: [16, 32, 4, 48, 64, 1] },
        {
          k: "scroll",
          view: 3,
          max: 80,
          docH: 3000,
          dur: 20000,
          act: 15000,
          dist: 1200,
          ia: 5,
          bands: Array.from({ length: 20 }, (_, i) => (i < 4 ? 3000 : 0)),
        },
        { k: "hb", path: "/order" },
      ],
    };
    const body2 = pack(b2);
    expect(ingest(SID, 2, body2, decodeBatch(body2)!, UA, "1.2.3.4")).toBe(true);

    expect(db.prepare("SELECT name FROM rec_events WHERE session_id = ? ORDER BY ts").all(SID)).toEqual([{ name: "form_step" }, { name: "form_error" }]);
    expect(db.prepare("SELECT lcp, cls, title, active_ms, interactions FROM rec_pages WHERE session_id = ? AND view = 3").get(SID)).toEqual({
      lcp: 3100,
      cls: 0.02,
      title: "ثبت سفارش",
      active_ms: 15000,
      interactions: 5,
    });
    const page3 = db.prepare("SELECT attention FROM rec_pages WHERE session_id = ? AND view = 3").get(SID) as { attention: string };
    expect(JSON.parse(page3.attention)).toHaveLength(20);
    expect(db.prepare("SELECT quick_back FROM rec_pages WHERE session_id = ? AND view = 2").get(SID)).toEqual({ quick_back: 1 });
    expect(db.prepare("SELECT COUNT(*) n FROM rec_net WHERE session_id = ?").get(SID)).toEqual({ n: 2 });
    expect(db.prepare("SELECT field, ms, filled FROM rec_fields WHERE session_id = ?").get(SID)).toEqual({ field: "phone", ms: 4200, filled: 1 });
    // Mouse movement only means something with a mouse: phones' moves are dropped.
    expect(db.prepare("SELECT COUNT(*) n FROM rec_moves WHERE session_id = ?").get(SID)).toEqual({ n: 0 });
    expect(db.prepare("SELECT events, net_errors, quick_backs, engaged, current_path, is_staff FROM rec_sessions WHERE id = ?").get(SID)).toEqual({
      events: 2,
      net_errors: 1,
      quick_backs: 1,
      engaged: 1,
      current_path: "/order",
      is_staff: 0,
    });
  });

  it("marks staff sessions and keeps them out of every report", async () => {
    const { decodeBatch, ingest } = await import("@/lib/rec/store");
    const { listSessions } = await import("@/lib/rec/insights");
    const { parseScope, totals } = await import("@/lib/rec/analytics");
    const STAFF_SID = "staffstaffstaffstaffstaff1";
    const b = {
      v: 1,
      meta: { path: "/", ref: "", vw: 1280, vh: 800 },
      events: [{ type: 4, data: { width: 1280, height: 800 }, timestamp: 1 }],
      a: [{ k: "page", view: 1, path: "/", ts: 1 }],
    };
    const body = pack(b);
    ingest(STAFF_SID, 0, body, decodeBatch(body)!, UA, "5.6.7.8", true);
    const scope = parseScope({ d: "1" });
    expect(totals(scope).sessions).toBe(1);
    expect(listSessions(scope, {}).rows.map((r) => r.id)).toEqual([SID]);
    expect(listSessions(scope, { staff: true }).rows.map((r) => r.id)).toEqual([STAFF_SID]);
  });

  it("feeds the dashboards", async () => {
    const { listSessions, heatClicks, heatScroll, heatMoves, getSession, setSessionNote, markWatched } = await import("@/lib/rec/insights");
    const { eventsReport, orderFunnel, parseScope, realtime, totals, apiReport } = await import("@/lib/rec/analytics");
    const scope = parseScope({ d: "1" });
    expect(totals(scope)).toMatchObject({ sessions: 1, orders: 1, reached: 1, rage: 1, engaged: 1, netErrors: 1, quickBacks: 1 });
    expect(listSessions(scope, { issue: "error" }).total).toBe(1);
    expect(listSessions(scope, { issue: "net" }).total).toBe(1);
    expect(listSessions(scope, { issue: "quickback" }).total).toBe(1);
    expect(listSessions(scope, { event: "form_error" }).total).toBe(1);
    expect(listSessions(scope, { event: "outbound" }).total).toBe(0);
    expect(listSessions(scope, { outcome: "none" }).total).toBe(0);
    expect(listSessions(scope, { unwatched: true }).total).toBe(1);
    expect(heatClicks(scope, "/", "mobile")).toHaveLength(2);
    expect(heatScroll(scope, "/order", "mobile").some((v) => v.attention)).toBe(true);
    expect(heatMoves(scope, "/order")).toHaveLength(0);
    expect(eventsReport(scope).map((e) => e.name).sort()).toEqual(["form_error", "form_step"]);
    expect(orderFunnel(scope)).toBeTruthy();
    expect(apiReport(scope).length).toBeGreaterThan(0);
    expect(realtime().active.map((a) => a.id)).toContain(SID);

    const { getDb } = await import("@/lib/db");
    const staffId = Number(getDb().prepare("INSERT INTO staff(name, username, password_hash, role) VALUES('ناظر','sup','x','supervisor')").run().lastInsertRowid);
    markWatched(SID, staffId);
    setSessionNote(SID, "  گیر کرد روی کد تأیید  ", true);
    const d = getSession(SID)!;
    expect(d.session).toMatchObject({ note: "گیر کرد روی کد تأیید", starred: 1, watched_name: "ناظر" });
    expect(d.events).toHaveLength(2);
    expect(listSessions(scope, { unwatched: true }).total).toBe(0);
    expect(listSessions(scope, { starred: true }).total).toBe(1);
  });

  it("keeps starred sessions past the retention period", async () => {
    const { getDb } = await import("@/lib/db");
    const { pruneRecordings } = await import("@/lib/rec/store");
    getDb().prepare("UPDATE rec_sessions SET last_at = '2020-01-01T00:00:00.000Z'").run();
    expect(pruneRecordings()).toBe(1); // only the (unstarred) staff session goes
    getDb().prepare("UPDATE rec_sessions SET starred = 0").run();
  });

  it("deletes sessions older than the retention period, files included", async () => {
    const { getDb } = await import("@/lib/db");
    const { pruneRecordings, REC_DIR } = await import("@/lib/rec/store");
    getDb().prepare("UPDATE rec_sessions SET last_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(SID);
    expect(pruneRecordings()).toBe(1);
    expect(fs.existsSync(path.join(REC_DIR, SID))).toBe(false);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM rec_clicks").get()).toEqual({ n: 0 });
  });
});
