import { describe, expect, it } from "vitest";
import { detectStore, extractUrl } from "@/lib/catalog";
import { normalizeIranMobile } from "@/lib/phone";
import { generateTrackingCode, normalizeTrackingCode } from "@/lib/tracking";
import { isGenericPage, parseLinkMeta } from "@/lib/link-meta";
import { toEnDigits } from "@/lib/utils";

describe("catalog", () => {
  it("extracts a URL from a share message", () => {
    expect(extractUrl("Check this out! https://a.aliexpress.com/_mK1234 cool")).toBe("https://a.aliexpress.com/_mK1234");
    expect(extractUrl("no link here")).toBeNull();
  });
  it("detects stores by the most specific domain", () => {
    expect(detectStore("https://www.amazon.ae/dp/B0X")?.key).toBe("amazon-ae");
    expect(detectStore("https://www.amazon.com.tr/dp/B0X")?.key).toBe("amazon-tr");
    expect(detectStore("https://detail.1688.com/offer/1.html")?.country).toBe("CN");
    expect(detectStore("https://example.org")).toBeUndefined();
  });
});

describe("phone", () => {
  it("normalizes Iranian mobiles, including Persian digits", () => {
    expect(normalizeIranMobile("۰۹۱۲ ۱۲۳ ۴۵۶۷")).toBe("09121234567");
    expect(normalizeIranMobile("+989121234567")).toBe("09121234567");
    expect(normalizeIranMobile("9121234567")).toBe("09121234567");
    expect(normalizeIranMobile("02112345678")).toBeNull();
  });
  it("converts digits", () => expect(toEnDigits("۱۲۳٤٥")).toBe("12345"));
});

describe("tracking code", () => {
  it("generates readable codes and normalizes input", () => {
    const c = generateTrackingCode();
    expect(c).toMatch(/^BF-[2-9A-HJKMNP-Z]{6}$/);
    expect(normalizeTrackingCode(" bf-abc234 ")).toBe("BF-ABC234");
    expect(normalizeTrackingCode("abc234")).toBe("BF-ABC234");
  });
});

describe("link meta", () => {
  it("prefers JSON-LD Product data", () => {
    const html = `<html><head><title>Store</title><meta property="og:image" content="/og.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Phone X","image":["https://cdn.x/p.jpg"],"offers":{"price":"199.5","priceCurrency":"AED"}}]}</script></head></html>`;
    const m = parseLinkMeta(html, "https://shop.example/p/1");
    expect(m).toMatchObject({ title: "Phone X", image: "https://cdn.x/p.jpg", price: "199.5", currency: "AED" });
  });
  it("falls back to Open Graph and absolutizes images", () => {
    const html = `<meta property="og:title" content="Bag"><meta property="og:image" content="/img/bag.jpg"><meta property="product:price:amount" content="20">`;
    const m = parseLinkMeta(html, "https://shop.example/p/2");
    expect(m).toMatchObject({ title: "Bag", image: "https://shop.example/img/bag.jpg", price: "20" });
  });
});


describe("isGenericPage", () => {
  it("flags a store-name-only title without image or price", () => {
    expect(isGenericPage({ title: "Amazon.ae", image: null, price: null, site: null }, "https://www.amazon.ae/dp/B0X")).toBe(true);
    expect(isGenericPage({ title: "Amazon.ae: Online Shopping", image: null, price: null, site: null }, "https://www.amazon.ae/dp/B0X")).toBe(true);
  });
  it("keeps real product titles", () => {
    expect(isGenericPage({ title: "Apple AirPods Pro (2nd generation) with MagSafe Case", image: null, price: null, site: null }, "https://www.amazon.ae/dp/B0X")).toBe(false);
    expect(isGenericPage({ title: "Amazon.ae", image: "https://x/y.jpg", price: null, site: null }, "https://www.amazon.ae/dp/B0X")).toBe(false);
  });
});
