import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-deals-"));
process.env.DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// No image stack in tests (the server CPU can't load sharp either).
vi.mock("@/lib/uploads", () => ({ storeRemoteImage: async () => null, mediaUrl: (id: string | null) => (id ? `/media/${id}` : null) }));
const metaMock = vi.fn();
vi.mock("@/lib/link-meta", async (orig) => ({ ...(await orig<typeof import("@/lib/link-meta")>()), fetchLinkMeta: (url: string) => metaMock(url) }));

describe("reading stock and the crossed-out price from store pages", () => {
  it("JSON-LD offers: availability and a strikethrough price", async () => {
    const { parseLinkMeta } = await import("@/lib/link-meta");
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Sony WH-1000XM4C",
      image: "https://img.example/sony.jpg",
      offers: {
        "@type": "Offer",
        price: "199.00",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        priceSpecification: [{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice", price: "249.00" }],
      },
    })}</script>`;
    const m = parseLinkMeta(html, "https://www.amazon.de/dp/X");
    expect(m).toMatchObject({ price: "199.00", currency: "EUR", availability: "in", oldPrice: "249.00" });
  });

  it("sold out (Namshi style) and an embedded was-price that matches the price", async () => {
    const { parseLinkMeta } = await import("@/lib/link-meta");
    const ld = `<script type="application/ld+json">{"@type":"Product","name":"Samba OG","offers":{"availability":"https://schema.org/OutOfStock","price":"284","priceCurrency":"AED"}}</script>`;
    const state = `<script>window.__S={"other":{"sale_price":10,"was_price":99},"p":{"sale_price":284,"was_price":379}}</script>`;
    const m = parseLinkMeta(ld + state, "https://www.namshi.com/x");
    expect(m.availability).toBe("out");
    // The unrelated pair (10/99) is ignored: its sale price is not this product's price.
    expect(m.oldPrice).toBe("379");
  });

  it("Amazon visible text and no structured stock", async () => {
    const { parseLinkMeta } = await import("@/lib/link-meta");
    const m = parseLinkMeta(`<title>X</title><h1>Apple Watch</h1><div id="availability"> Derzeit nicht verfügbar. </div>`, "https://www.amazon.de/dp/Y");
    expect(m.availability).toBe("out");
    expect(parseLinkMeta(`<h1>Thing</h1><meta property="og:image" content="https://i/x.jpg">`, "https://x.com/p").availability).toBeNull();
  });

  it("discounts only when plausible; European number formats", async () => {
    const { discountOf, toNumber } = await import("@/lib/link-meta");
    expect(toNumber("1.299,00 €")).toBe(1299);
    expect(toNumber("AED 2,799")).toBe(2799);
    expect(discountOf("2799", "5099")).toBe(45);
    expect(discountOf("100", "101")).toBeNull();
    expect(discountOf("10", "500")).toBeNull();
    expect(discountOf("300", "200")).toBeNull();
  });
});

describe("automatic deals", () => {
  const meta = (over: Record<string, unknown> = {}) => ({ title: "T", image: null, price: "100", currency: "AED", site: null, finalUrl: "", availability: "in", oldPrice: null, ...over });
  beforeEach(() => metaMock.mockReset());

  it("migration 9 gives every product a unique code", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    expect(db.pragma("user_version", { simple: true })).toBe(9);
    db.prepare("INSERT INTO products(title, url, source) VALUES('sample', 'https://example.com/a', 'sample')").run();
    const cols = (db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["code", "name_fa", "name_en", "stock", "queued", "published_at", "clicks", "discount_source"]));
  });

  it("seeds once: some live now, the rest queued; samples switched off", async () => {
    const { seedDeals, DEAL_SEED, dealsStatus } = await import("@/lib/deals");
    const { getDb } = await import("@/lib/db");
    expect(seedDeals()).toBe(DEAL_SEED.length);
    expect(seedDeals()).toBe(0);
    const s = dealsStatus();
    expect(s.live).toBe(DEAL_SEED.filter((x) => x.now).length);
    expect(s.pool).toBe(DEAL_SEED.filter((x) => !x.now).length);
    const sample = getDb().prepare("SELECT active FROM products WHERE source = 'sample'").get() as { active: number };
    expect(sample.active).toBe(0);
    const codes = getDb().prepare("SELECT code FROM products").all() as { code: string }[];
    expect(new Set(codes.map((c) => c.code)).size).toBe(codes.length);
    for (const c of codes) expect(c.code).toMatch(/^[a-f0-9]{8}$/);
  });

  it("a sold-out product is hidden, and comes back when restocked; a blocked check hides nothing", async () => {
    const { checkProduct } = await import("@/lib/deals");
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const row = () => db.prepare("SELECT * FROM products WHERE active = 1 OR auto_hidden = 1 ORDER BY id LIMIT 1").get() as import("@/lib/products").ProductRow;
    const p = row();

    metaMock.mockResolvedValueOnce(null);
    expect((await checkProduct(p)).note).toBe("blocked");
    expect(row()).toMatchObject({ id: p.id, active: 1, check_note: "blocked" });

    metaMock.mockResolvedValueOnce(meta({ availability: "out" }));
    expect((await checkProduct(row())).note).toBe("hidden_sold_out");
    expect(db.prepare("SELECT active, auto_hidden, stock FROM products WHERE id = ?").get(p.id)).toEqual({ active: 0, auto_hidden: 1, stock: "out" });

    metaMock.mockResolvedValueOnce(meta({ availability: "in", price: "80", oldPrice: "100" }));
    const again = db.prepare("SELECT * FROM products WHERE id = ?").get(p.id) as import("@/lib/products").ProductRow;
    expect((await checkProduct(again)).note).toBe("restocked");
    expect(db.prepare("SELECT active, stock, discount_percent, discount_source FROM products WHERE id = ?").get(p.id)).toEqual({
      active: 1,
      stock: "in",
      discount_percent: 20,
      discount_source: "site",
    });
  });

  it("a researched discount is dropped when the store raises the price", async () => {
    const { checkProduct } = await import("@/lib/deals");
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const p = db.prepare("SELECT * FROM products WHERE discount_source = 'research' LIMIT 1").get() as import("@/lib/products").ProductRow;
    metaMock.mockResolvedValueOnce(meta({ price: String(Number(p.price) * 1.3), availability: null }));
    await checkProduct(p);
    expect(db.prepare("SELECT discount_percent, stock FROM products WHERE id = ?").get(p.id)).toEqual({ discount_percent: null, stock: "unknown" });
  });

  it("publishes the next queued product with an image; categories take turns; sold-out leaves the queue", async () => {
    const { publishNext } = await import("@/lib/deals");
    const { getDb, nowIso } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO uploads(id, kind, file_name, mime, size) VALUES('img-test-000001', 'product', 'x.webp', 'image/webp', 1)").run();
    db.prepare("UPDATE products SET image_upload_id = 'img-test-000001' WHERE queued = 1").run();
    db.prepare("UPDATE products SET published_at = ? WHERE id = (SELECT id FROM products WHERE active = 1 AND category = 'digital' LIMIT 1)").run(new Date(Date.now() + 1000).toISOString());

    // First candidate (not digital) turns out sold out → leaves the queue; the next one goes live.
    const first = db.prepare("SELECT id FROM products WHERE queued = 1 AND active = 0 ORDER BY (category = 'digital'), sort DESC, id LIMIT 1").get() as { id: number };
    metaMock.mockResolvedValueOnce(meta({ availability: "out" })).mockResolvedValue(meta({ availability: "in" }));
    const id = await publishNext();
    expect(id).not.toBe(first.id);
    expect(db.prepare("SELECT queued, auto_hidden FROM products WHERE id = ?").get(first.id)).toEqual({ queued: 0, auto_hidden: 1 });
    const live = db.prepare("SELECT active, queued, category, published_at FROM products WHERE id = ?").get(id) as { active: number; queued: number; category: string; published_at: string };
    expect(live).toMatchObject({ active: 1, queued: 0 });
    expect(live.category).not.toBe("digital");
    expect(live.published_at <= nowIso()).toBe(true);
  });

  it("orders are counted per unique link", async () => {
    const { dealOrderCounts, getProductByCode } = await import("@/lib/products");
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const { code } = db.prepare("SELECT code FROM products LIMIT 1").get() as { code: string };
    expect(getProductByCode(code)?.code).toBe(code);
    expect(getProductByCode("../x")).toBeUndefined();
    const cols = (db.prepare("PRAGMA table_info(requests)").all() as { name: string; notnull: number; dflt_value: unknown }[])
      .filter((c) => c.notnull && c.dflt_value == null && c.name !== "id")
      .map((c) => c.name);
    const vals: Record<string, string> = { tracking_code: "BF-T1", method: "link", first_name: "a", last_name: "b", phone: "09120000000", status: "new", gender: "male" };
    db.prepare(`INSERT INTO requests(${[...cols, "utm_campaign"].join(",")}) VALUES(${[...cols, "utm_campaign"].map(() => "?").join(",")})`).run(...cols.map((c) => vals[c] ?? "x"), `deal-${code}`);
    expect(dealOrderCounts()[code]).toBe(1);
  });
});
