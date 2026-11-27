import "server-only";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { detectStore } from "./catalog";
import { getDb, nowIso } from "./db";
import { discountOf, fetchLinkMeta, toNumber } from "./link-meta";
import type { ProductRow } from "./products";
import { deleteUpload, storeRemoteImage } from "./uploads";

/**
 * Automatic landing deals.
 *
 * - Pool: products with queued = 1 wait for their turn (seeded below, or added by staff).
 * - Every 2 hours the next pooled product that is not known to be sold out and has an image
 *   goes live (categories take turns).
 * - Every 30 minutes every live or pooled product is re-read from its store: price, crossed-out
 *   price and stock. "Sold out" hides it (and it comes back by itself when restocked); a store
 *   that blocks the check only marks it "unknown" — nothing is hidden on a guess.
 * - Each product has a unique code: /d/<code> opens the order form with it already filled in.
 */

export const newCode = () => randomBytes(4).toString("hex");

const settingGet = (k: string) =>
  (getDb().prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string } | undefined)?.value ?? null;
const settingSet = (k: string, v: string) =>
  getDb().prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, v);

export const PUBLISH_EVERY_MS = 2 * 3_600_000;
export const CHECK_EVERY_MS = 30 * 60_000;

export type DealsStatus = {
  auto: boolean;
  lastPublishAt: string | null;
  nextPublishAt: string | null;
  lastCheckAt: string | null;
  pool: number;
  live: number;
  soldOut: number;
};

export function dealsAuto(): boolean {
  return settingGet("deals_auto") !== "0";
}
export function setDealsAuto(on: boolean) {
  settingSet("deals_auto", on ? "1" : "0");
}

export function dealsStatus(): DealsStatus {
  const db = getDb();
  const c = db
    .prepare(
      `SELECT SUM(queued = 1 AND active = 0) pool, SUM(active = 1) live, SUM(stock = 'out' AND active = 0 AND queued = 0) sold FROM products`
    )
    .get() as { pool: number | null; live: number | null; sold: number | null };
  const last = settingGet("deals_last_publish");
  const auto = dealsAuto();
  return {
    auto,
    lastPublishAt: last,
    nextPublishAt: auto && (c.pool ?? 0) > 0 ? new Date((last ? Date.parse(last) : Date.now()) + PUBLISH_EVERY_MS).toISOString() : null,
    lastCheckAt: settingGet("deals_last_check"),
    pool: c.pool ?? 0,
    live: c.live ?? 0,
    soldOut: c.sold ?? 0,
  };
}

function refresh() {
  try {
    revalidatePath("/");
    revalidatePath("/admin/products");
  } catch {
    /* outside a request (background job): pages are dynamic anyway */
  }
}

/* ------------------------------------------------------------------ stock & price */

export type CheckResult = { id: number; stock: ProductRow["stock"]; note: string };

/** Re-reads one product from its store and updates stock, price and discount. */
export async function checkProduct(p: ProductRow): Promise<CheckResult> {
  const db = getDb();
  const meta = await fetchLinkMeta(p.url);
  const now = nowIso();
  if (!meta || meta.guessed) {
    // Blocked or unreachable: say so, change nothing else.
    db.prepare("UPDATE products SET checked_at = ?, check_fails = check_fails + 1, check_note = ?, stock = CASE WHEN check_fails >= 5 THEN 'unknown' ELSE stock END WHERE id = ?").run(
      now,
      "blocked",
      p.id
    );
    return { id: p.id, stock: p.check_fails >= 5 ? "unknown" : p.stock, note: "blocked" };
  }

  const stock: ProductRow["stock"] = meta.availability === "out" ? "out" : meta.availability === "in" ? "in" : "unknown";
  const siteDiscount = discountOf(meta.price, meta.oldPrice);
  // Stored as plain numbers ("5099"), not as the page wrote them ("AED5,099.00").
  const price = meta.price ? String(toNumber(meta.price) ?? meta.price) : p.price;
  // A discount read from the store wins. Otherwise the recorded one (staff, bookmark, research)
  // stays: the server often can't see the crossed-out price that a person saw. It is dropped
  // only when the store now asks more than the recorded price, i.e. the sale is over.
  let discount = p.discount_percent;
  let source = p.discount_source;
  let old = p.old_price;
  const now$ = toNumber(meta.price), was$ = toNumber(p.price);
  if (siteDiscount) {
    discount = siteDiscount;
    source = "site";
    old = meta.oldPrice ? String(toNumber(meta.oldPrice) ?? meta.oldPrice) : null;
  } else if (discount && now$ && was$ && now$ > was$ * 1.02) {
    const fromOld = old ? discountOf(now$, old) : null;
    discount = fromOld;
    if (!fromOld) {
      source = null;
      old = null;
    }
  } else if (discount && old && now$ && was$ && Math.abs(now$ - was$) / was$ > 0.005) {
    // Price moved a little (still on sale): keep the percent true to the crossed-out price.
    discount = discountOf(now$, old) ?? discount;
  }

  let imageId = p.image_upload_id;
  if (!imageId && meta.image) {
    imageId = (await storeRemoteImage(meta.image))?.id ?? null;
    if (!imageId) console.warn(`[deals] #${p.id} image download failed: ${meta.image.slice(0, 160)}`);
  } else if (!imageId) console.warn(`[deals] #${p.id} page read, but it names no product image`);

  let active = p.active;
  let autoHidden = p.auto_hidden;
  if (stock === "out" && p.active) {
    active = 0;
    autoHidden = 1;
  } else if (stock === "in" && p.auto_hidden && !p.active) {
    active = 1;
    autoHidden = 0;
  }

  db.prepare(
    `UPDATE products SET stock = ?, checked_at = ?, check_fails = 0, check_note = ?, price = ?, old_price = ?, currency = COALESCE(?, currency),
       discount_percent = ?, discount_source = ?, image_upload_id = ?, active = ?, auto_hidden = ?, updated_at = ? WHERE id = ?`
  ).run(stock, now, meta.availability ? "ok" : "no_stock_info", price, old, meta.currency, discount, source, imageId, active, autoHidden, now, p.id);
  return { id: p.id, stock, note: active !== p.active ? (active ? "restocked" : "hidden_sold_out") : "ok" };
}

/** Every live, pooled or auto-hidden product, one at a time (gentle on the stores). */
export async function checkAllDeals(): Promise<CheckResult[]> {
  const rows = getDb()
    .prepare("SELECT * FROM products WHERE active = 1 OR queued = 1 OR auto_hidden = 1 ORDER BY checked_at IS NOT NULL, checked_at")
    .all() as ProductRow[];
  const out: CheckResult[] = [];
  for (const p of rows) {
    try {
      out.push(await checkProduct(p));
    } catch (e) {
      console.warn(`[deals] check ${p.id} failed:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  settingSet("deals_last_check", nowIso());
  if (out.length) refresh();
  return out;
}

/* ------------------------------------------------------------------ publishing */

/** Publishes the next pooled product; categories take turns. Returns its id or null. */
export async function publishNext(opts: { force?: boolean } = {}): Promise<number | null> {
  const db = getDb();
  const lastCat = (db.prepare("SELECT category FROM products WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1").get() as { category: string } | undefined)?.category ?? "";
  const pool = db
    .prepare(
      "SELECT * FROM products WHERE queued = 1 AND active = 0 ORDER BY (image_upload_id IS NULL), (COALESCE(discount_percent, 0) = 0), (category = ?), sort DESC, id LIMIT 8"
    )
    .all(lastCat) as ProductRow[];
  for (const cand of pool) {
    // Fresh look at the store right before it goes live.
    if (!cand.checked_at || Date.now() - Date.parse(cand.checked_at) > 20 * 60_000) await checkProduct(cand).catch(() => null);
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(cand.id) as ProductRow;
    if (p.stock === "out") {
      // Sold out while waiting: leave the queue; restocking brings it back.
      db.prepare("UPDATE products SET queued = 0, auto_hidden = 1, updated_at = ? WHERE id = ?").run(nowIso(), p.id);
      continue;
    }
    if (!opts.force && (!p.image_upload_id || !p.discount_percent)) continue;
    const now = nowIso();
    db.prepare("UPDATE products SET active = 1, queued = 0, published_at = ?, updated_at = ? WHERE id = ?").run(now, now, p.id);
    settingSet("deals_last_publish", now);
    console.log(`[deals] published #${p.id} ${p.name_en ?? p.title}`);
    refresh();
    return p.id;
  }
  return null;
}

/**
 * Background tick: publish when two hours have passed since the last one. If fewer than
 * MIN_LIVE products are showing (sold out, blocked stores without images), fill up from the
 * pool right away instead of waiting.
 */
export async function publishIfDue() {
  if (!dealsAuto()) return null;
  let id: number | null = null;
  for (let i = 0; i < MIN_LIVE && visibleLiveCount() < MIN_LIVE; i++) {
    const next = await publishNext();
    if (!next) break;
    id = next;
  }
  if (id) return id;
  const last = settingGet("deals_last_publish");
  if (last && Date.now() - Date.parse(last) < PUBLISH_EVERY_MS - 60_000) return null;
  return publishNext();
}

/* ------------------------------------------------------------------ seed */

type Seed = {
  url: string;
  title: string;
  name_fa: string;
  name_en: string;
  category: string;
  price?: string;
  old_price?: string;
  currency?: string;
  /** Discount verified in research for this Black Friday (27 Nov 2026). */
  discount?: number;
  /** Goes live right away instead of waiting in the pool. */
  now?: boolean;
  /** Seed batch; a later batch is added to an existing pool once. */
  batch?: number;
  sort?: number;
};

/**
 * Researched 27 Nov 2026 (store pages and Black Friday round-ups). Prices are a starting point;
 * the first stock check replaces them with what the store shows.
 */
export const DEAL_SEED: Seed[] = [
  // digital
  { url: "https://www.noon.com/uae-en/galaxy-s25-ultra-ai-dual-sim-titanium-grey-12gb-ram-256gb-5g-middle-east-version/N70140492V/p/", title: "Samsung Galaxy S25 Ultra 12GB/256GB Titanium Grey (Middle East)", name_fa: "گوشی سامسونگ گلکسی S25 اولترا", name_en: "Samsung Galaxy S25 Ultra 256GB", category: "digital", price: "2799", old_price: "5099", currency: "AED", discount: 45, now: true },
  { url: "https://www.noon.com/uae-en/airpods-pro-3-wireless-earbuds-bluetooth-headphones-active-noise-cancellation-hearing-test-hearing-aid-hearing-protection-features-heart-rate-sensing-during-workouts-live-translation-high-fidelity-sound-h2-chip-usb-c-charging-white/N70212301V/p/", title: "Apple AirPods Pro 3", name_fa: "ایرپاد پرو ۳ اپل", name_en: "Apple AirPods Pro 3", category: "digital", price: "711.96", old_price: "949", currency: "AED", discount: 24 },
  // fashion
  { url: "https://www.namshi.com/uae-en/buy-nike-af1-shadow/VF6791DCEFAFE176CF7EFV/p/", title: "Nike Air Force 1 Shadow", name_fa: "کفش نایک ایرفورس ۱ شدو", name_en: "Nike Air Force 1 Shadow", category: "fashion", currency: "AED", now: true },
  { url: "https://www.namshi.com/uae-en/buy-adidas-originals-adidas-samba-og-green-originals-unisex-shoes/Z4EBE76BFDDEE17ED2DF2Z/p/", title: "adidas Originals Samba OG Green", name_fa: "کفش آدیداس سامبا", name_en: "adidas Samba OG", category: "fashion", price: "499", currency: "AED" },
  { url: "https://www.trendyol.com/nike/air-force-1-07-beyaz-sneaker-erkek-ayakkabi-cw2288-111-p-348222363", title: "Nike Air Force 1 '07 White CW2288-111", name_fa: "کفش نایک ایرفورس ۱ سفید", name_en: "Nike Air Force 1 '07", category: "fashion", price: "8649", currency: "TRY" },
  { url: "https://en-ae.sssports.com/adidas-originals-mens-samba-og-shoes/ADIH6844.html", title: "adidas Originals Men's Samba OG White", name_fa: "کفش آدیداس سامبا سفید", name_en: "adidas Samba OG", category: "fashion", price: "279", old_price: "499", currency: "AED" },
  // sport
  { url: "https://en-ae.sssports.com/nike-mens-air-max-sc-shoe/NKCW4555-102.html", title: "Nike Men's Air Max SC White", name_fa: "کفش نایک ایرمکس SC", name_en: "Nike Air Max SC", category: "sport", price: "479", currency: "AED", now: true },
  // beauty
  { url: "https://www.noon.com/uae-en/sauvage-edp-for-men-100ml/N23101656A/p/", title: "Dior Sauvage EDP 100ml", name_fa: "عطر دیور ساواج ادوپرفیوم", name_en: "Dior Sauvage EDP 100ml", category: "beauty", price: "500", currency: "AED", now: true },
  { url: "https://www.trendyol.com/dyson/airwrap-co-anda2x-sac-sekillendirme-ve-kurutma-seti-amber-silk-p-1039524765", title: "Dyson Airwrap Co-anda2x (Amber Silk)", name_fa: "حالت‌دهنده مو دایسون ایرورپ", name_en: "Dyson Airwrap Co-anda2x", category: "beauty", currency: "TRY", now: true },
  { url: "https://www.trendyol.com/dyson/airwrap-i-d-sac-sekillendirme-ve-kurutma-seti-kivircik-bukleli-ceramic-patina-ve-topaz-p-897054238", title: "Dyson Airwrap i.d. Curly+Coily (Ceramic Patina & Topaz)", name_fa: "حالت‌دهنده مو دایسون ایرورپ i.d", name_en: "Dyson Airwrap i.d.", category: "beauty", currency: "TRY" },
  // Batch 3: Amazon UAE first (the store Iranian buyers ask for most); ahead of everything else in the queue.
  { batch: 3, sort: 5, now: true, url: "https://www.amazon.ae/Samsung-Storage-Titanium-Smartphone-Approved/dp/B0DSLTQQL3", title: "Samsung Galaxy S25 Ultra 256GB/12GB Titanium Gray (UAE)", name_fa: "گوشی سامسونگ گلکسی S25 اولترا", name_en: "Samsung Galaxy S25 Ultra 256GB", category: "digital", currency: "AED" },
  { batch: 3, sort: 5, now: true, url: "https://www.amazon.ae/Apple-Wireless-headphones-charging-compatible/dp/B0FQFYMLS5", title: "Apple AirPods Pro 3", name_fa: "ایرپاد پرو ۳ اپل", name_en: "Apple AirPods Pro 3", category: "digital", currency: "AED" },
  { batch: 3, sort: 5, now: true, url: "https://www.amazon.ae/Apple-iPhone-Pro-Max-256/dp/B0FQFHZF6L", title: "Apple iPhone 17 Pro Max 256GB Cosmic Orange", name_fa: "گوشی آیفون ۱۷ پرو مکس", name_en: "iPhone 17 Pro Max 256GB", category: "digital", currency: "AED" },
  { batch: 3, sort: 5, now: true, url: "https://www.amazon.ae/Dyson-Airwrap-i-d-Multi-styler-dryer/dp/B0FLK45SF7", title: "Dyson Airwrap i.d. Straight+Wavy (Ceramic Pink/Rose Gold)", name_fa: "حالت‌دهنده مو دایسون ایرورپ", name_en: "Dyson Airwrap i.d.", category: "beauty", currency: "AED" },
  { batch: 3, sort: 5, url: "https://www.amazon.ae/Dyson-Airwrap-Co-anda2x-Multi-Styler-Straight/dp/B0F9679PP3", title: "Dyson Airwrap Co-anda2x Straight+Wavy (Ceramic Pink)", name_fa: "حالت‌دهنده مو دایسون ایرورپ Co-anda2x", name_en: "Dyson Airwrap Co-anda2x", category: "beauty", currency: "AED" },
];

export const SEED_VERSION = Math.max(...DEAL_SEED.map((x) => x.batch ?? 1));

/** Live products the landing can actually show (it hides automatic ones without an image). */
export const MIN_LIVE = 6;
export function visibleLiveCount(): number {
  return (
    getDb().prepare(`SELECT COUNT(*) n FROM products WHERE active = 1 AND discount_percent > 0 AND (image_upload_id IS NOT NULL OR source != 'auto')`).get() as { n: number }
  ).n;
}

/**
 * Adds the seed once (by URL; anything staff deleted is not re-added after the first run).
 * The researched "now" items go live at once; the rest wait in the pool. The old sample
 * products are switched off (not deleted) so the real deals replace them.
 */
export function seedDeals(): number {
  const db = getDb();
  const done = Number((settingGet("deals_seeded") ?? "v0").replace(/^v/, "")) || 0;
  if (done >= SEED_VERSION) return 0;
  const first = done === 0;
  const exists = db.prepare("SELECT 1 FROM products WHERE url = ?");
  const ins = db.prepare(
    `INSERT INTO products(title, url, category, country, store_key, price, old_price, currency, discount_percent, discount_source, source,
       active, queued, published_at, sort, code, name_fa, name_en)
     VALUES(?,?,?,?,?,?,?,?,?,?, 'auto', ?, ?, ?, ?, ?, ?, ?)`
  );
  let n = 0;
  db.transaction(() => {
    const now = nowIso();
    for (const s of DEAL_SEED) {
      if ((s.batch ?? 1) <= done) continue;
      if (exists.get(s.url)) continue;
      const store = detectStore(s.url);
      ins.run(
        s.title, s.url, s.category, store?.country ?? null, store?.key ?? null, s.price ?? null, s.old_price ?? null, s.currency ?? null,
        s.discount ?? null, s.discount ? "research" : null,
        s.now ? 1 : 0, s.now ? 0 : 1, s.now ? now : null, s.sort ?? 0, newCode(), s.name_fa, s.name_en
      );
      n++;
    }
    if (first) {
      db.prepare("UPDATE products SET active = 0, updated_at = ? WHERE source = 'sample' AND active = 1").run(now);
      settingSet("deals_last_publish", now);
    }
    settingSet("deals_seeded", `v${SEED_VERSION}`);
  })();
  if (n) console.log(`[deals] seeded ${n} product(s)`);
  return n;
}

/**
 * One-time removal of the Amazon.de deals (27 Nov: the landing is UAE-first). Their images go
 * too; a story link to one of them now opens the landing.
 */
export async function removeAmazonDe(): Promise<number> {
  if (settingGet("deals_cleanup") === "amazon-de") return 0;
  const db = getDb();
  const rows = db.prepare("SELECT id, image_upload_id FROM products WHERE store_key = 'amazon-de' AND source = 'auto'").all() as { id: number; image_upload_id: string | null }[];
  db.transaction(() => {
    for (const r of rows) db.prepare("DELETE FROM products WHERE id = ?").run(r.id);
    settingSet("deals_cleanup", "amazon-de");
  })();
  for (const r of rows) if (r.image_upload_id) await deleteUpload(r.image_upload_id).catch(() => null);
  if (rows.length) console.log(`[deals] removed ${rows.length} Amazon.de product(s)`);
  return rows.length;
}

/** Counted when someone opens a unique link (link-preview bots excluded by the caller). */
export function countClick(id: number) {
  getDb().prepare("UPDATE products SET clicks = clicks + 1 WHERE id = ?").run(id);
}
