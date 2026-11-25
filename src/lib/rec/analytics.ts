import "server-only";
import { getDb } from "../db";
import { tehranDay } from "../shifts";
import { VITALS, channelOf, propLabel, type VitalName } from "./analytics-shared";
export * from "./analytics-shared";

/**
 * Report queries for the behaviour dashboards (GA4/Clarity-style).
 * Every report takes a Scope: a time window plus optional segment filters. Staff sessions
 * (signed-in team members browsing the site) are always excluded.
 */

/* ------------------------------------------------------------------ scope */

export const RANGE_KEYS = ["today", "1", "7", "30"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const RANGE_LABELS: Record<RangeKey, string> = { today: "امروز", 1: "۲۴ ساعت", 7: "۷ روز", 30: "۳۰ روز" };

export type Scope = {
  range: RangeKey;
  since: string;
  until: string;
  /** The same-length window right before, for comparisons. */
  prevSince: string;
  device?: string;
  source?: string;
};

export function parseScope(sp: Record<string, string | string[] | undefined>, now = Date.now()): Scope {
  const d = typeof sp.d === "string" && (RANGE_KEYS as readonly string[]).includes(sp.d) ? (sp.d as RangeKey) : "7";
  let since: number;
  if (d === "today") since = Date.parse(`${tehranDay(now)}T00:00:00+03:30`);
  else since = now - Number(d) * 86_400_000;
  const len = now - since;
  const device = typeof sp.device === "string" && ["mobile", "tablet", "desktop"].includes(sp.device) ? sp.device : undefined;
  const source = typeof sp.source === "string" && sp.source.length <= 80 && sp.source ? sp.source : undefined;
  return {
    range: d,
    since: new Date(since).toISOString(),
    until: new Date(now).toISOString(),
    prevSince: new Date(since - len).toISOString(),
    device,
    source,
  };
}

/** Query-string for links that keep the current scope. */
export const scopeQuery = (s: Scope, extra: Record<string, string | undefined> = {}) => {
  const p = new URLSearchParams();
  p.set("d", s.range);
  if (s.device) p.set("device", s.device);
  if (s.source) p.set("source", s.source);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p.toString();
};

type W = { sql: string; args: unknown[] };

/** WHERE for sessions (alias s) in the scope; `prev` selects the comparison window. */
export function where(s: Scope, prev = false, alias = "s"): W {
  const c = [`${alias}.is_staff = 0`, `${alias}.started_at >= ?`, `${alias}.started_at < ?`];
  const args: unknown[] = prev ? [s.prevSince, s.since] : [s.since, s.until];
  if (s.device) {
    c.push(`${alias}.device = ?`);
    args.push(s.device);
  }
  if (s.source === "(direct)") c.push(`${alias}.utm_source IS NULL`);
  else if (s.source) {
    c.push(`${alias}.utm_source = ?`);
    args.push(s.source);
  }
  return { sql: c.join(" AND "), args };
}

const db = () => getDb();
const n = (v: unknown) => Number(v ?? 0) || 0;

export function percentile(values: number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))];
}

/* ------------------------------------------------------------------ overview */

export type Totals = {
  users: number;
  newUsers: number;
  sessions: number;
  engaged: number;
  activeMs: number;
  pages: number;
  orders: number;
  reached: number;
  rage: number;
  dead: number;
  errors: number;
  netErrors: number;
  events: number;
  quickBacks: number;
  scroll: number;
};

export function totals(s: Scope, prev = false): Totals {
  const w = where(s, prev);
  const r = db()
    .prepare(
      `SELECT COUNT(DISTINCT COALESCE(s.visitor_id, s.id)) users,
              COUNT(DISTINCT CASE WHEN s.return_visit = 0 THEN COALESCE(s.visitor_id, s.id) END) new_users,
              COUNT(*) sessions, SUM(s.engaged) engaged, AVG(s.active_ms) active_ms, AVG(s.pages) pages,
              SUM(s.tracking_code IS NOT NULL) orders, SUM(s.reached_order) reached,
              SUM(s.rage_clicks > 0) rage, SUM(s.dead_clicks > 0) dead, SUM(s.errors > 0) errors, SUM(s.net_errors > 0) net_errors,
              SUM(s.events) events, SUM(s.quick_backs > 0) quick_backs, AVG(s.max_scroll) scroll
       FROM rec_sessions s WHERE ${w.sql}`,
    )
    .get(...w.args) as Record<string, number | null>;
  return {
    users: n(r.users),
    newUsers: n(r.new_users),
    sessions: n(r.sessions),
    engaged: n(r.engaged),
    activeMs: n(r.active_ms),
    pages: n(r.pages),
    orders: n(r.orders),
    reached: n(r.reached),
    rage: n(r.rage),
    dead: n(r.dead),
    errors: n(r.errors),
    netErrors: n(r.net_errors),
    events: n(r.events),
    quickBacks: n(r.quick_backs),
    scroll: n(r.scroll),
  };
}

/** Sessions, users and orders per hour (≤ 2 days) or per day, in Tehran time, gaps filled. */
export function series(s: Scope) {
  const hourly = s.range === "today" || s.range === "1";
  const fmt = hourly ? "%Y-%m-%d %H" : "%Y-%m-%d";
  const w = where(s);
  const rows = db()
    .prepare(
      `SELECT strftime('${fmt}', s.started_at, '+210 minutes') b, COUNT(*) sessions,
              COUNT(DISTINCT COALESCE(s.visitor_id, s.id)) users, SUM(s.tracking_code IS NOT NULL) orders, SUM(s.engaged) engaged
       FROM rec_sessions s WHERE ${w.sql} GROUP BY b`,
    )
    .all(...w.args) as { b: string; sessions: number; users: number; orders: number; engaged: number }[];
  const map = new Map(rows.map((r) => [r.b, r]));
  const out: { b: string; sessions: number; users: number; orders: number; engaged: number }[] = [];
  const step = hourly ? 3_600_000 : 86_400_000;
  const start = Date.parse(s.since) + 210 * 60_000;
  const end = Date.parse(s.until) + 210 * 60_000;
  for (let t = start - (start % step); t <= end; t += step) {
    const iso = new Date(t).toISOString();
    const key = hourly ? `${iso.slice(0, 10)} ${iso.slice(11, 13)}` : iso.slice(0, 10);
    out.push(map.get(key) ?? { b: key, sessions: 0, users: 0, orders: 0, engaged: 0 });
  }
  return { hourly, rows: out };
}

/* ------------------------------------------------------------------ acquisition */

type AcqRow = { key: string; detail: string; sessions: number; users: number; engaged: number; activeMs: number; reached: number; orders: number };

function acqRows(s: Scope, keyOf: (r: SrcRow) => { key: string; detail: string }): AcqRow[] {
  const w = where(s);
  const rows = db()
    .prepare(
      `SELECT s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term, s.referrer, s.entry_path, COALESCE(s.visitor_id, s.id) v,
              s.engaged, s.active_ms, s.reached_order, s.tracking_code IS NOT NULL ordered
       FROM rec_sessions s WHERE ${w.sql}`,
    )
    .all(...w.args) as SrcRow[];
  const map = new Map<string, AcqRow & { vs: Set<string> }>();
  for (const r of rows) {
    const { key, detail } = keyOf(r);
    const id = `${key}|${detail}`;
    const m = map.get(id) ?? { key, detail, sessions: 0, users: 0, engaged: 0, activeMs: 0, reached: 0, orders: 0, vs: new Set<string>() };
    m.sessions++;
    m.vs.add(r.v);
    m.engaged += r.engaged;
    m.activeMs += r.active_ms;
    m.reached += r.reached_order;
    m.orders += r.ordered;
    map.set(id, m);
  }
  return [...map.values()]
    .map(({ vs, ...m }) => ({ ...m, users: vs.size, activeMs: m.sessions ? m.activeMs / m.sessions : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
}

type SrcRow = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  referrer: string | null;
  entry_path: string | null;
  v: string;
  engaged: number;
  active_ms: number;
  reached_order: number;
  ordered: number;
};

const refHost = (r: string | null) => {
  if (!r) return "";
  try {
    return new URL(r).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const byChannel = (s: Scope) => acqRows(s, (r) => ({ key: channelOf(r), detail: "" }));
export const bySourceMedium = (s: Scope) =>
  acqRows(s, (r) => ({ key: r.utm_source ?? (refHost(r.referrer) || "(direct)"), detail: r.utm_source ? (r.utm_medium ?? "") : r.referrer ? "referral" : "none" }));
export const byCampaign = (s: Scope) =>
  acqRows(s, (r) => ({ key: r.utm_campaign ?? "(بدون کمپین)", detail: [r.utm_source, r.utm_term].filter(Boolean).join("، ") }));
export const byLanding = (s: Scope) => acqRows(s, (r) => ({ key: r.entry_path ?? "/", detail: "" }));

export function sourceOptions(s: Scope): string[] {
  const rows = db()
    .prepare("SELECT DISTINCT utm_source FROM rec_sessions WHERE is_staff = 0 AND started_at >= ? AND utm_source IS NOT NULL ORDER BY utm_source")
    .all(s.prevSince) as { utm_source: string }[];
  return rows.map((r) => r.utm_source);
}

/* ------------------------------------------------------------------ engagement: pages and events */

export function pagesReport(s: Scope) {
  const w = where(s);
  const rows = db()
    .prepare(
      `SELECT p.path, COUNT(*) views, COUNT(DISTINCT COALESCE(s.visitor_id, s.id)) users, AVG(p.active_ms) active_ms, AVG(p.max_scroll) scroll,
              SUM(CASE WHEN p.view = (SELECT MAX(view) FROM rec_pages x WHERE x.session_id = p.session_id) THEN 1 ELSE 0 END) exits,
              SUM(CASE WHEN s.entry_path = p.path AND p.view = (SELECT MIN(view) FROM rec_pages x WHERE x.session_id = p.session_id) THEN 1 ELSE 0 END) entrances,
              SUM(p.quick_back) quick_backs, MAX(p.title) title
       FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE ${w.sql}
       GROUP BY p.path ORDER BY views DESC LIMIT 30`,
    )
    .all(...w.args) as { path: string; views: number; users: number; active_ms: number; scroll: number; exits: number; entrances: number; quick_backs: number; title: string | null }[];
  const clicks = db()
    .prepare(
      `SELECT c.path, SUM(c.rage = 1) rage, SUM(c.dead) dead, COUNT(*) clicks FROM rec_clicks c JOIN rec_sessions s ON s.id = c.session_id
       WHERE ${w.sql} GROUP BY c.path`,
    )
    .all(...w.args) as { path: string; rage: number; dead: number; clicks: number }[];
  const lcp = db()
    .prepare(`SELECT p.path, p.lcp FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE ${w.sql} AND p.lcp IS NOT NULL`)
    .all(...w.args) as { path: string; lcp: number }[];
  return rows.map((r) => {
    const c = clicks.find((x) => x.path === r.path);
    return {
      ...r,
      rage: n(c?.rage),
      dead: n(c?.dead),
      clicks: n(c?.clicks),
      lcpP75: percentile(lcp.filter((x) => x.path === r.path).map((x) => x.lcp), 0.75),
    };
  });
}

export function eventsReport(s: Scope) {
  const w = where(s);
  return db()
    .prepare(
      `SELECT e.name, COUNT(*) count, COUNT(DISTINCT e.session_id) sessions, COUNT(DISTINCT COALESCE(s.visitor_id, s.id)) users
       FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id WHERE ${w.sql}
       GROUP BY e.name ORDER BY count DESC`,
    )
    .all(...w.args) as { name: string; count: number; sessions: number; users: number }[];
}

/** Breakdown of one event by a property (e.g. outbound by host, cta_order by section). */
export function eventBreakdown(s: Scope, name: string, prop: string) {
  const w = where(s);
  return db()
    .prepare(
      `SELECT COALESCE(json_extract(e.props, '$.' || ?), '—') value, COUNT(*) count, COUNT(DISTINCT e.session_id) sessions,
              MAX(e.session_id) sample
       FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id WHERE ${w.sql} AND e.name = ?
       GROUP BY value ORDER BY count DESC LIMIT 15`,
    )
    .all(prop, ...w.args, name)
    .map((r) => {
      const row = r as { value: string; count: number; sessions: number; sample: string };
      return { ...row, value: propLabel(prop, row.value) };
    });
}

/* ------------------------------------------------------------------ order funnel and fields */

export const FUNNEL_STEPS = [
  { key: "landing", label: "ورود به سایت" },
  { key: "order_page", label: "باز کردن صفحه‌ی سفارش" },
  { key: "items", label: "انتخاب روش، رفتن به مشخصات کالا" },
  { key: "contact", label: "رفتن به اطلاعات تماس" },
  { key: "otp", label: "دریافت کد تأیید" },
  { key: "done", label: "ثبت سفارش" },
] as const;

export function orderFunnel(s: Scope, method?: string) {
  const w = where(s);
  const total = (db().prepare(`SELECT COUNT(*) n FROM rec_sessions s WHERE ${w.sql}`).get(...w.args) as { n: number }).n;
  const orderPage = (db().prepare(`SELECT COUNT(*) n FROM rec_sessions s WHERE ${w.sql} AND s.reached_order = 1`).get(...w.args) as { n: number }).n;
  const step = (k: string) =>
    (
      db()
        .prepare(
          `SELECT COUNT(DISTINCT e.session_id) n FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id
           WHERE ${w.sql} AND e.name = 'form_step' AND json_extract(e.props, '$.step') = ?
           ${method ? "AND json_extract(e.props, '$.method') = ?" : ""}`,
        )
        .get(...w.args, k, ...(method ? [method] : [])) as { n: number }
    ).n;
  const orders = (db().prepare(`SELECT COUNT(*) n FROM rec_sessions s WHERE ${w.sql} AND s.tracking_code IS NOT NULL`).get(...w.args) as { n: number }).n;
  const values: Record<string, number> = {
    landing: total,
    order_page: orderPage,
    items: step("items"),
    contact: step("contact"),
    otp: step("otp"),
    done: Math.max(step("done"), orders),
  };
  return FUNNEL_STEPS.map((f) => ({ ...f, value: values[f.key] }));
}

export function methodSplit(s: Scope) {
  const w = where(s);
  return db()
    .prepare(
      `SELECT json_extract(e.props, '$.method') method, COUNT(DISTINCT e.session_id) sessions FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id
       WHERE ${w.sql} AND e.name = 'method_select' GROUP BY method ORDER BY sessions DESC`,
    )
    .all(...w.args) as { method: string; sessions: number }[];
}

export function fieldsReport(s: Scope, path = "/order") {
  const w = where(s);
  const rows = db()
    .prepare(
      `SELECT f.field, COUNT(*) focuses, COUNT(DISTINCT f.session_id) sessions, AVG(f.ms) avg_ms, AVG(f.filled) filled, AVG(f.changed) changed,
              SUM(f.changed = 1 AND (SELECT COUNT(*) FROM rec_fields g WHERE g.session_id = f.session_id AND g.field = f.field) > 1) refills
       FROM rec_fields f JOIN rec_sessions s ON s.id = f.session_id WHERE ${w.sql} AND f.path = ?
       GROUP BY f.field ORDER BY MIN(f.ts)`,
    )
    .all(...w.args, path) as { field: string; focuses: number; sessions: number; avg_ms: number; filled: number; changed: number; refills: number }[];
  // Validation errors per field, from the form's own error events.
  const errs = db()
    .prepare(
      `SELECT json_extract(e.props, '$.fields') fields FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id
       WHERE ${w.sql} AND e.name = 'form_error'`,
    )
    .all(...w.args) as { fields: string | null }[];
  const errCount = new Map<string, number>();
  for (const e of errs) for (const f of (e.fields ?? "").split(",").filter(Boolean)) errCount.set(f, (errCount.get(f) ?? 0) + 1);
  // Last field touched by visitors who left without ordering.
  const drops = db()
    .prepare(
      `SELECT f.field, COUNT(*) n FROM rec_fields f JOIN rec_sessions s ON s.id = f.session_id
       WHERE ${w.sql} AND f.path = ? AND s.tracking_code IS NULL
         AND f.ts = (SELECT MAX(ts) FROM rec_fields g WHERE g.session_id = f.session_id AND g.path = f.path)
       GROUP BY f.field`,
    )
    .all(...w.args, path) as { field: string; n: number }[];
  return rows.map((r) => ({ ...r, errors: errCount.get(r.field) ?? 0, lastBeforeLeaving: drops.find((d) => d.field === r.field)?.n ?? 0 }));
}

export function formErrorsBreakdown(s: Scope) {
  const w = where(s);
  const rows = db()
    .prepare(
      `SELECT json_extract(e.props, '$.step') step, json_extract(e.props, '$.fields') fields FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id
       WHERE ${w.sql} AND e.name = 'form_error'`,
    )
    .all(...w.args) as { step: string; fields: string | null }[];
  return rows.length;
}

export function otpStats(s: Scope) {
  const w = where(s);
  const q = (name: string, ok: number) =>
    (
      db()
        .prepare(
          `SELECT COUNT(*) n FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id WHERE ${w.sql} AND e.name = ? AND json_extract(e.props, '$.ok') = ?`,
        )
        .get(...w.args, name, ok) as { n: number }
    ).n;
  return { otpOk: q("otp_request", 1), otpFail: q("otp_request", 0), submitOk: q("order_submit", 1), submitFail: q("order_submit", 0) };
}

/* ------------------------------------------------------------------ technology and performance */

export function techBreakdown(s: Scope, col: "device" | "os" | "browser" | "conn" | "lang" | "tz" | "screen") {
  const w = where(s);
  const expr = col === "screen" ? "CASE WHEN s.sw IS NULL THEN NULL ELSE s.sw || '×' || s.sh END" : `s.${col}`;
  return db()
    .prepare(
      `SELECT COALESCE(${expr}, 'نامشخص') value, COUNT(*) sessions, COUNT(DISTINCT COALESCE(s.visitor_id, s.id)) users,
              SUM(s.engaged) engaged, SUM(s.tracking_code IS NOT NULL) orders, AVG(s.active_ms) active_ms
       FROM rec_sessions s WHERE ${w.sql} GROUP BY value ORDER BY sessions DESC LIMIT 15`,
    )
    .all(...w.args) as { value: string; sessions: number; users: number; engaged: number; orders: number; active_ms: number }[];
}

export function vitalsReport(s: Scope) {
  const w = where(s);
  const rows = db()
    .prepare(`SELECT s.device, p.path, p.lcp, p.inp, p.cls, p.fcp, p.ttfb FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE ${w.sql}`)
    .all(...w.args) as { device: string; path: string; lcp: number | null; inp: number | null; cls: number | null; fcp: number | null; ttfb: number | null }[];
  const summarize = (list: typeof rows) =>
    (Object.keys(VITALS) as VitalName[]).map((k) => {
      const vals = list.map((r) => r[k.toLowerCase() as "lcp"]).filter((v): v is number => v != null);
      const t = VITALS[k];
      return {
        name: k,
        n: vals.length,
        p75: percentile(vals, 0.75),
        good: vals.filter((v) => v <= t.good).length,
        poor: vals.filter((v) => v > t.poor).length,
      };
    });
  const devices = [...new Set(rows.map((r) => r.device))];
  return {
    all: summarize(rows),
    byDevice: devices.map((d) => ({ device: d, vitals: summarize(rows.filter((r) => r.device === d)) })),
    byPage: [...new Set(rows.map((r) => r.path))]
      .map((p) => ({ path: p, vitals: summarize(rows.filter((r) => r.path === p)) }))
      .filter((p) => p.vitals.some((v) => v.n > 0))
      .slice(0, 10),
  };
}

/** Does a slow first load cost sessions? Engagement and orders by LCP bucket. */
export function speedImpact(s: Scope) {
  const w = where(s);
  return db()
    .prepare(
      `SELECT CASE WHEN s.lcp IS NULL THEN 'نامشخص' WHEN s.lcp <= 2500 THEN 'سریع (تا ۲٫۵ ثانیه)' WHEN s.lcp <= 4000 THEN 'متوسط (۲٫۵ تا ۴ ثانیه)' ELSE 'کند (بیش از ۴ ثانیه)' END bucket,
              COUNT(*) sessions, AVG(s.engaged) engaged, AVG(s.tracking_code IS NOT NULL) conv, AVG(s.pages <= 1 AND s.active_ms < 10000) bounce
       FROM rec_sessions s WHERE ${w.sql} GROUP BY bucket ORDER BY MIN(COALESCE(s.lcp, 999999))`,
    )
    .all(...w.args) as { bucket: string; sessions: number; engaged: number; conv: number; bounce: number }[];
}

/* ------------------------------------------------------------------ errors */

export function jsErrors(s: Scope, source: "own" | "ext" = "own") {
  const w = where(s);
  return db()
    .prepare(
      `SELECT e.message, COUNT(*) count, COUNT(DISTINCT e.session_id) sessions, MAX(e.session_id) sample, MAX(e.path) path, MAX(e.stack) stack,
              MAX(e.ts) last_ts
       FROM rec_errors e JOIN rec_sessions s ON s.id = e.session_id WHERE ${w.sql} AND e.source = ?
       GROUP BY e.message ORDER BY sessions DESC LIMIT 20`,
    )
    .all(...w.args, source) as { message: string; count: number; sessions: number; sample: string; path: string; stack: string | null; last_ts: number }[];
}

export function apiReport(s: Scope) {
  const w = where(s);
  const rows = db()
    .prepare(`SELECT n.url, n.method, n.status, n.ms, n.session_id FROM rec_net n JOIN rec_sessions s ON s.id = n.session_id WHERE ${w.sql}`)
    .all(...w.args) as { url: string; method: string; status: number; ms: number; session_id: string }[];
  const urls = [...new Set(rows.map((r) => `${r.method} ${r.url}`))];
  return urls
    .map((u) => {
      const list = rows.filter((r) => `${r.method} ${r.url}` === u);
      const failed = list.filter((r) => r.status === 0 || r.status >= 500);
      const client = list.filter((r) => r.status >= 400 && r.status < 500);
      const statuses = new Map<number, number>();
      for (const r of list) statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
      return {
        key: u,
        url: list[0].url,
        method: list[0].method,
        calls: list.length,
        failed: failed.length,
        client: client.length,
        p50: percentile(list.map((r) => r.ms), 0.5),
        p90: percentile(list.map((r) => r.ms), 0.9),
        statuses: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
        sample: (failed[0] ?? client[0])?.session_id ?? null,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

/* ------------------------------------------------------------------ Clarity-style signals */

export function problemElements(s: Scope, kind: "rage" | "dead" | "nonclick") {
  const w = where(s);
  const cond = kind === "rage" ? "c.rage = 1" : kind === "dead" ? "c.dead = 1" : "c.interactive = 0 AND c.label IS NOT NULL AND c.label != ''";
  return db()
    .prepare(
      `SELECT c.path, COALESCE(NULLIF(c.label, ''), c.selector, '؟') label, COUNT(*) clicks, COUNT(DISTINCT c.session_id) sessions, MAX(c.session_id) sample
       FROM rec_clicks c JOIN rec_sessions s ON s.id = c.session_id WHERE ${w.sql} AND ${cond}
       GROUP BY c.path, label ORDER BY sessions DESC, clicks DESC LIMIT 10`,
    )
    .all(...w.args) as { path: string; label: string; clicks: number; sessions: number; sample: string }[];
}

export function excessiveScroll(s: Scope) {
  const w = where(s);
  return (
    db()
      .prepare(
        `SELECT COUNT(DISTINCT p.session_id) n FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id
         WHERE ${w.sql} AND p.doc_h > 0 AND p.scroll_dist > 3 * p.doc_h
           AND NOT EXISTS (SELECT 1 FROM rec_clicks c WHERE c.session_id = p.session_id AND c.path = p.path)`,
      )
      .get(...w.args) as { n: number }
  ).n;
}

/* ------------------------------------------------------------------ realtime */

export function realtime(now = Date.now()) {
  const d = db();
  const since5 = new Date(now - 5 * 60_000).toISOString();
  const since30 = new Date(now - 30 * 60_000).toISOString();
  const active = d
    .prepare(
      `SELECT id, started_at, last_at, current_path, entry_path, device, os, browser, utm_source, utm_medium, utm_campaign, referrer, pages, clicks,
              active_ms, tracking_code, reached_order, return_visit, rage_clicks, errors
       FROM rec_sessions WHERE is_staff = 0 AND last_at >= ? ORDER BY last_at DESC LIMIT 200`,
    )
    .all(since5) as {
    id: string;
    started_at: string;
    last_at: string;
    current_path: string | null;
    entry_path: string | null;
    device: string;
    os: string | null;
    browser: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
    pages: number;
    clicks: number;
    active_ms: number;
    tracking_code: string | null;
    reached_order: number;
    return_visit: number;
    rage_clicks: number;
    errors: number;
  }[];
  const sessions30 = d
    .prepare("SELECT started_at, last_at FROM rec_sessions WHERE is_staff = 0 AND last_at >= ?")
    .all(since30) as { started_at: string; last_at: string }[];
  const perMinute: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const a = now - (i + 1) * 60_000;
    const b = now - i * 60_000;
    perMinute.push(sessions30.filter((s) => Date.parse(s.started_at) < b && Date.parse(s.last_at) >= a).length);
  }
  const t30 = now - 30 * 60_000;
  const stream = d
    .prepare(
      `SELECT * FROM (
         SELECT e.ts, e.session_id sid, 'ev' kind, e.name, e.props, e.path FROM rec_events e JOIN rec_sessions s ON s.id = e.session_id WHERE s.is_staff = 0 AND e.ts >= ?
         UNION ALL
         SELECT p.ts, p.session_id, 'page', NULL, NULL, p.path FROM rec_pages p JOIN rec_sessions s ON s.id = p.session_id WHERE s.is_staff = 0 AND p.ts >= ?
         UNION ALL
         SELECT c.ts, c.session_id, CASE WHEN c.rage = 1 THEN 'rage' ELSE 'dead' END, c.label, NULL, c.path FROM rec_clicks c JOIN rec_sessions s ON s.id = c.session_id
           WHERE s.is_staff = 0 AND c.ts >= ? AND (c.rage = 1 OR c.dead = 1)
       ) ORDER BY ts DESC LIMIT 40`,
    )
    .all(t30, t30, t30) as { ts: number; sid: string; kind: string; name: string | null; props: string | null; path: string }[];
  const count = (key: (s: (typeof active)[number]) => string) => {
    const m = new Map<string, number>();
    for (const s of active) m.set(key(s), (m.get(key(s)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    active,
    perMinute,
    pages: count((s) => s.current_path ?? s.entry_path ?? "/"),
    sources: count((s) => channelOf(s)),
    devices: count((s) => s.device),
    stream,
    orders30: (d.prepare("SELECT COUNT(*) n FROM rec_sessions WHERE is_staff = 0 AND tracking_code IS NOT NULL AND last_at >= ?").get(since30) as { n: number }).n,
    at: new Date(now).toISOString(),
  };
}
