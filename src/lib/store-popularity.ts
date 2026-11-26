import "server-only";
import { getDb } from "./db";

/** How many requested items came from each store (store_key is detected from the item's link). */
export function storePopularity(): Record<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT i.store_key AS key, COUNT(*) AS n FROM request_items i JOIN requests r ON r.id = i.request_id
       WHERE i.store_key IS NOT NULL GROUP BY i.store_key`,
    )
    .all() as { key: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.n]));
}
