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
const migrations: string[] = [
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
];

function migrate(db: DB) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < migrations.length; v++) {
    db.transaction(() => {
      db.exec(migrations[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
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
