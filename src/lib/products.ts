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
  created_at: string;
  updated_at: string;
};

export type PublicProduct = {
  id: number;
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
    .prepare(`SELECT * FROM products ${opts.activeOnly ? "WHERE active = 1" : ""} ORDER BY sort DESC, id DESC`)
    .all() as ProductRow[];
}

export function getPublicProducts(): PublicProduct[] {
  return listProducts({ activeOnly: true }).map((p) => ({
    id: p.id,
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
