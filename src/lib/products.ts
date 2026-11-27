import "server-only";
import { getDb } from "./db";
import { mediaUrl } from "./uploads";

export type ProductRow = {
  id: number;
  title: string;
  url: string;
  image_upload_id: string | null;
  store_key: string | null;
  country: string | null;
  category: string;
  price: string | null;
  old_price: string | null;
  currency: string | null;
  discount_percent: number | null;
  source: string;
  active: number;
  sort: number;
  code: string;
  name_fa: string | null;
  name_en: string | null;
  stock: "in" | "out" | "unknown";
  checked_at: string | null;
  check_fails: number;
  check_note: string | null;
  queued: number;
  published_at: string | null;
  auto_hidden: number;
  discount_source: string | null;
  clicks: number;
  created_at: string;
  updated_at: string;
};

export type PublicProduct = {
  id: number;
  code: string;
  title: string;
  url: string;
  image: string | null;
  storeKey: string | null;
  country: string | null;
  category: string;
  price: string | null;
  oldPrice: string | null;
  currency: string | null;
  discount: number | null;
};

export function listProducts(opts: { activeOnly?: boolean } = {}): ProductRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM products ${opts.activeOnly ? "WHERE active = 1" : ""}
       ORDER BY active DESC, queued DESC, sort DESC, COALESCE(published_at, created_at) DESC, id DESC`
    )
    .all() as ProductRow[];
}

export function getPublicProducts(): PublicProduct[] {
  // An automatic deal shows once its image has been fetched; a card without a picture sells nothing.
  return listProducts({ activeOnly: true })
    .filter((p) => p.image_upload_id || p.source !== "auto")
    .map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    url: p.url,
    image: mediaUrl(p.image_upload_id),
    storeKey: p.store_key,
    country: p.country,
    category: p.category,
    price: p.price,
    oldPrice: p.old_price,
    currency: p.currency,
    discount: p.discount_percent,
  }));
}

export function getProductByCode(code: string): ProductRow | undefined {
  if (!/^[a-z0-9]{4,16}$/.test(code)) return undefined;
  return getDb().prepare("SELECT * FROM products WHERE code = ?").get(code) as ProductRow | undefined;
}

/** Orders that came through each product's unique link (utm_campaign = deal-<code>). */
export function dealOrderCounts(): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT substr(utm_campaign, 6) AS code, COUNT(*) AS n FROM requests WHERE utm_campaign LIKE 'deal-%' GROUP BY utm_campaign")
    .all() as { code: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.code, r.n]));
}
