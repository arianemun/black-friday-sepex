import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), "data"));
export const UPLOAD_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "uploads");

type DB = Database.Database;

const globalForDb = globalThis as unknown as { __sepexDb?: DB };

/**
 * Versioned, additive, idempotent migrations (PRAGMA user_version).
 * Never edit a released migration: append a new one.
 */
/** A rebuild copies `table` into a new table; the runner checks its row count and foreign keys. */
type Migration = string | { sql: string; rebuild: true; table?: string };

const migrations: Migration[] = [
  /* 1 */ `
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'expert' CHECK (role IN ('admin','expert')),
    notify_sms INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    last_notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, created_at);

  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL CHECK (method IN ('link','photo','shipping')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male','female')),
    phone TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    assigned_to INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, referrer TEXT,
    ip TEXT, user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_requests_phone ON requests(phone);

  CREATE TABLE IF NOT EXISTS request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    url TEXT,
    title TEXT,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    origin_country TEXT,
    store_key TEXT,
    weight TEXT,
    meta_status TEXT NOT NULL DEFAULT 'none',
    meta_title TEXT, meta_image TEXT, meta_price TEXT, meta_currency TEXT, meta_site TEXT,
    meta_fetched_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_items_request ON request_items(request_id);

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('customer','product')),
    file_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER, height INTEGER,
    request_item_id INTEGER REFERENCES request_items(id) ON DELETE SET NULL,
    draft_token_hash TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS request_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    body TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_request ON request_events(request_id, created_at);

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    image_upload_id TEXT REFERENCES uploads(id) ON DELETE SET NULL,
    store_key TEXT,
    country TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    price TEXT,
    old_price TEXT,
    currency TEXT,
    discount_percent INTEGER,
    source TEXT NOT NULL DEFAULT 'manual',
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_active ON products(active, sort, id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  /* 2: structured detail for the per-request activity log */ `
  ALTER TABLE request_events ADD COLUMN meta TEXT;
  `,
  /*
   * 3: leads from the sepex.net Gravity Forms (via the WordPress CRM plugin).
   * SQLite can't alter a CHECK constraint, so `requests` is rebuilt the documented way
   * (new table, copy every row, swap names) with foreign keys off; child rows keep their ids.
   * - method may also be 'form'
   * - gender may be NULL (site forms don't ask for it)
   * - source / source_label / external_ref record where a lead came from; external_ref is
   *   unique so a retried webhook can't create a duplicate request.
   */
  {
    rebuild: true,
    sql: `
  CREATE TABLE requests_v3 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL CHECK (method IN ('link','photo','shipping','form')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT CHECK (gender IS NULL OR gender IN ('male','female')),
    phone TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    assigned_to INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, referrer TEXT,
    ip TEXT, user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    source TEXT NOT NULL DEFAULT 'web',
    source_label TEXT,
    external_ref TEXT
  );
  INSERT INTO requests_v3(id, tracking_code, method, first_name, last_name, gender, phone, note, status, assigned_to,
    utm_source, utm_medium, utm_campaign, referrer, ip, user_agent, created_at, updated_at)
  SELECT id, tracking_code, method, first_name, last_name, gender, phone, note, status, assigned_to,
    utm_source, utm_medium, utm_campaign, referrer, ip, user_agent, created_at, updated_at
  FROM requests;
  DROP TABLE requests;
  ALTER TABLE requests_v3 RENAME TO requests;
  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_requests_phone ON requests(phone);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_external_ref ON requests(external_ref) WHERE external_ref IS NOT NULL;
  `,
  },
  /*
   * 4: a third role, 'supervisor' (an expert who can also plan shifts).
   * Same rebuild as migration 3, for `staff`; sessions, assignments and events keep their staff ids.
   */
  {
    rebuild: true,
    table: "staff",
    sql: `
  CREATE TABLE staff_v4 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'expert' CHECK (role IN ('admin','supervisor','expert')),
    notify_sms INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    last_notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  INSERT INTO staff_v4(id, name, username, password_hash, phone, role, notify_sms, active, last_notified_at, created_at)
  SELECT id, name, username, password_hash, phone, role, notify_sms, active, last_notified_at, created_at FROM staff;
  DROP TABLE staff;
  ALTER TABLE staff_v4 RENAME TO staff;
  `,
  },
  /*
   * 5: shifts and the "nobody picked this up" alert.
   * - shifts: one row per staff member per Tehran calendar day (YYYY-MM-DD).
   * - requests.escalated_at: when the 1-hour alert went out. Existing requests are marked as
   *   already handled so the first run doesn't alert about old leads.
   */ `
  CREATE TABLE IF NOT EXISTS shifts (
    day TEXT NOT NULL,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (day, staff_id)
  );
  ALTER TABLE requests ADD COLUMN escalated_at TEXT;
  UPDATE requests SET escalated_at = created_at;
  `,
  /* 6: who watched which training video, and how far. */ `
  CREATE TABLE IF NOT EXISTS training_views (
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    max_position INTEGER NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    first_at TEXT NOT NULL,
    last_at TEXT NOT NULL,
    PRIMARY KEY (staff_id, slug)
  );
  `,
];

/** Exported for tests; `upTo` lets a test build an older schema version. */
export function migrate(db: DB, upTo = migrations.length) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < Math.min(upTo, migrations.length); v++) {
    const m = migrations[v];
    const rebuild = typeof m !== "string";
    const sql = typeof m === "string" ? m : m.sql;
    const table = typeof m === "string" ? "" : (m.table ?? "requests");
    // A table rebuild needs foreign keys off, and that pragma is ignored inside a transaction.
    if (rebuild) db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        const before = rebuild ? (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n : 0;
        db.exec(sql);
        if (rebuild) {
          const after = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
          if (after !== before) throw new Error(`migration ${v + 1}: row count changed ${before} -> ${after}`);
          const broken = db.pragma("foreign_key_check") as unknown[];
          if (broken.length) throw new Error(`migration ${v + 1}: ${broken.length} foreign key problems`);
        }
        db.pragma(`user_version = ${v + 1}`);
      })();
    } finally {
      if (rebuild) db.pragma("foreign_keys = ON");
    }
  }
}

export function getDb(): DB {
  if (globalForDb.__sepexDb) return globalForDb.__sepexDb;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(/*turbopackIgnore: true*/ DATA_DIR, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  migrate(db);
  globalForDb.__sepexDb = db;
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}
