import "server-only";
import * as cheerio from "cheerio";
import { safeFetch } from "./safe-fetch";

/**
 * Best-effort product metadata from a store page: JSON-LD Product first, then Open Graph /
 * product meta tags, then <title>. Never throws; returns null fields when nothing is found.
 * Many stores (Amazon, Taobao…) block bots or render client-side, so null is a normal result.
 */

export type LinkMeta = {
  title: string | null;
  image: string | null;
  price: string | null;
  currency: string | null;
  site: string | null;
  finalUrl: string | null;
};

const clean = (s: unknown, max = 300) => {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const v = String(s).replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

function absolutize(src: string | null, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;

function findProduct(node: unknown): Json | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n);
      if (p) return p;
    }
    return null;
  }
  const obj = node as Json;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && /^(Product|ProductGroup)$/i.test(t))) return obj;
  if (obj["@graph"]) return findProduct(obj["@graph"]);
  return null;
}

function firstImage(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === "object") return (img as Json).url ? String((img as Json).url) : null;
  return null;
}

function offerPrice(offers: unknown): { price: string | null; currency: string | null } {
  const o = (Array.isArray(offers) ? offers[0] : offers) as Json | undefined;
  if (!o || typeof o !== "object") return { price: null, currency: null };
  const price = o.price ?? o.lowPrice ?? (o.priceSpecification as Json | undefined)?.price;
  const currency = o.priceCurrency ?? (o.priceSpecification as Json | undefined)?.priceCurrency;
  return { price: clean(price, 40), currency: clean(currency, 8) };
}

export function parseLinkMeta(html: string, baseUrl: string): LinkMeta {
  const $ = cheerio.load(html);
  const meta = (sel: string) => clean($(sel).first().attr("content"));

  let title: string | null = null;
  let image: string | null = null;
  let price: string | null = null;
  let currency: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (title && image && price) return;
    try {
      const product = findProduct(JSON.parse($(el).contents().text()));
      if (!product) return;
      title ??= clean(product.name);
      image ??= firstImage(product.image);
      const o = offerPrice(product.offers);
      price ??= o.price;
      currency ??= o.currency;
    } catch {
      /* malformed JSON-LD is common */
    }
  });

  title ??= meta('meta[property="og:title"]') ?? meta('meta[name="twitter:title"]') ?? clean($("title").first().text());
  image ??=
    meta('meta[property="og:image:secure_url"]') ??
    meta('meta[property="og:image"]') ??
    meta('meta[name="twitter:image"]') ??
    clean($("#landingImage").attr("data-old-hires") || $("#landingImage").attr("src"), 1000);
  price ??=
    meta('meta[property="product:price:amount"]') ??
    meta('meta[property="og:price:amount"]') ??
    meta('meta[itemprop="price"]');
  currency ??=
    meta('meta[property="product:price:currency"]') ??
    meta('meta[property="og:price:currency"]') ??
    meta('meta[itemprop="priceCurrency"]');

  return {
    title,
    image: absolutize(image, baseUrl),
    price,
    currency,
    site: meta('meta[property="og:site_name"]'),
    finalUrl: baseUrl,
  };
}

export async function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  try {
    const res = await safeFetch(url);
    if (res.status >= 400 || !/html|xml/i.test(res.contentType)) return null;
    const meta = parseLinkMeta(res.body.toString("utf8"), res.url);
    // Bot-wall pages ("Robot Check", captcha) produce a title but no product data.
    if (meta.title && /robot check|captcha|access denied|verify you are human|slide to verify/i.test(meta.title) && !meta.price) {
      return null;
    }
    return meta.title || meta.image ? meta : null;
  } catch (e) {
    console.warn(`[link-meta] ${new URL(url).hostname}: ${(e as Error).message}`);
    return null;
  }
}
