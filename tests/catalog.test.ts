import { describe, expect, it } from "vitest";
import { activeDeal, detectStore, storeCats, stores, suggestedStores } from "@/lib/catalog";

describe("store catalog", () => {
  it("suggests 30 to 80 stores, none from the hard-to-buy US group", () => {
    const s = suggestedStores();
    expect(s.length).toBeGreaterThanOrEqual(30);
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.map((x) => x.key)).not.toEqual(expect.arrayContaining(["ebay"]));
    for (const k of ["amazon-us", "ebay", "walmart", "bestbuy"]) expect(s.find((x) => x.key === k)).toBeUndefined();
  });

  it("gives every suggested store a category, a hint and a unique key", () => {
    const keys = new Set<string>();
    const cats = new Set(storeCats.map((c) => c.key));
    for (const s of suggestedStores()) {
      expect(s.cats?.length, s.key).toBeGreaterThan(0);
      for (const c of s.cats!) expect(cats.has(c), `${s.key}:${c}`).toBe(true);
      expect(s.hint, s.key).toBeTruthy();
      expect(s.url.startsWith("https://"), s.key).toBe(true);
    }
    for (const s of stores) {
      expect(keys.has(s.key), s.key).toBe(false);
      keys.add(s.key);
    }
  });

  it("still recognises links from stores that are no longer suggested", () => {
    expect(detectStore("https://www.ebay.com/itm/123")?.key).toBe("ebay");
    expect(detectStore("https://www.amazon.com/dp/B0X")?.key).toBe("amazon-us");
    expect(detectStore("https://amzn.to/abc")?.key).toBe("amazon-us");
    expect(detectStore("https://www.amazon.ae/dp/B0X")?.key).toBe("amazon-ae");
    expect(detectStore("https://www.trendyol.com/x-p-1")?.key).toBe("trendyol");
  });

  it("matches brands on a shared global domain only in their regional section", () => {
    expect(detectStore("https://www.apple.com/ae/shop/buy-iphone")?.key).toBe("apple-ae");
    expect(detectStore("https://www.apple.com/shop/buy-iphone")).toBeUndefined();
    expect(detectStore("https://www.zara.com/ae/en/shirt-p0123.html")?.key).toBe("zara-ae");
    expect(detectStore("https://www.zara.com/tr/en/shirt-p0123.html")).toBeUndefined();
    expect(detectStore("https://www.samsung.com/aero/")).toBeUndefined();
    expect(detectStore("https://en-ae.sssports.com/nike")?.key).toBe("sssports");
    expect(detectStore("https://ae.hm.com/en/")?.key).toBe("hm-ae");
  });

  it("shows a deal only until its last day (Tehran date)", () => {
    const noon = stores.find((s) => s.key === "noon")!;
    expect(activeDeal(noon, "2026-11-30")).toBeTruthy();
    expect(activeDeal(noon, "2026-12-01")).toBeUndefined();
  });
});

describe("store priority", () => {
  it("only lists suggested stores", async () => {
    const { STORE_PRIORITY } = await import("@/lib/catalog");
    const keys = new Set(suggestedStores().map((s) => s.key));
    for (const k of STORE_PRIORITY) expect(keys.has(k), k).toBe(true);
  });
});
