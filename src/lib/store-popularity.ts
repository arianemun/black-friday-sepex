import "server-only";
import { getDb } from "./db";
import { detectStore } from "./catalog";

/**
 * How many requested items came from each store. The store is taken from the item's link with
 * the current catalog (so stores added later count their earlier requests too), falling back to
 * the key saved with the item.
 */
export function storePopularity(): Record<string, number> {
  const rows = getDb()
    .prepare(`SELECT i.url, i.store_key FROM request_items i JOIN requests r ON r.id = i.request_id WHERE i.url IS NOT NULL OR i.store_key IS NOT NULL`)
    .all() as { url: string | null; store_key: string | null }[];
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = (r.url && detectStore(r.url)?.key) || r.store_key;
    if (key) out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
