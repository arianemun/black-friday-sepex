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
    expect(loadEvents(SID)).toHaveLength(3);
  });

  it("rejects garbage and ignores bots", async () => {
    const { decodeBatch, isBot } = await import("@/lib/rec/store");
    expect(decodeBatch(Buffer.from("not deflate"))).toBeNull();
    expect(decodeBatch(pack({ v: 2, events: [], a: [] }))).toBeNull();
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot(UA)).toBe(false);
  });

  it("feeds the dashboards", async () => {
    const { overview, listSessions, heatClicks, sinceIso } = await import("@/lib/rec/insights");
    const since = sinceIso(1);
    expect(overview(since)).toMatchObject({ sessions: 1, orders: 1, reached: 1, rage: 1 });
    expect(listSessions({ since, issue: "error" }).total).toBe(1);
    expect(listSessions({ since, outcome: "none" }).total).toBe(0);
    expect(heatClicks("/", "mobile", since)).toHaveLength(2);
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
