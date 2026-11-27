import "server-only";
import * as cheerio from "cheerio";
import { fetchProxies, safeFetch, type FetchProxy } from "./safe-fetch";

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
  /** Title read from the URL slug because the page itself couldn't be fetched. */
  guessed?: boolean;
  /** What the page says about stock; null when it says nothing we understand. */
  availability?: "in" | "out" | null;
  /** The crossed-out price, only when the page states it next to the current price. */
  oldPrice?: string | null;
};

const OUT_RE = /OutOfStock|SoldOut|Discontinued|out[ _-]?of[ _-]?stock|^oos$/i;
const IN_RE = /InStock|LimitedAvailability|OnlineOnly|InStoreOnly|PreOrder|BackOrder|^in[ _-]?stock$|^available/i;
export function readAvailability(v: unknown): "in" | "out" | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().replace(/^https?:\/\/schema\.org\//i, "");
  if (OUT_RE.test(s)) return "out";
  if (IN_RE.test(s)) return "in";
  return null;
}

/** "1.299,00" / "1,299.00" / "AED 749" → 1299 / 749. */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot) {
    // comma is the decimal separator when followed by 1–2 digits
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Whole-number percent off, only when it is plausible (3–90%). */
export function discountOf(price: unknown, old: unknown): number | null {
  const p = toNumber(price), o = toNumber(old);
  if (!p || !o || o <= p) return null;
  const d = Math.round((1 - p / o) * 100);
  return d >= 3 && d <= 90 ? d : null;
}

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

function offerPrice(offers: unknown): { price: string | null; currency: string | null; availability: "in" | "out" | null; oldPrice: string | null } {
  const o = (Array.isArray(offers) ? offers[0] : offers) as Json | undefined;
  if (!o || typeof o !== "object") return { price: null, currency: null, availability: null, oldPrice: null };
  const specs = (Array.isArray(o.priceSpecification) ? o.priceSpecification : [o.priceSpecification]).filter((x): x is Json => !!x && typeof x === "object");
  const listSpec = specs.find((x) => /StrikethroughPrice|ListPrice|MSRP/i.test(String(x.priceType ?? "")));
  const saleSpec = specs.find((x) => x !== listSpec);
  const price = o.price ?? o.lowPrice ?? saleSpec?.price;
  const currency = o.priceCurrency ?? saleSpec?.priceCurrency ?? listSpec?.priceCurrency;
  // Several offers (sellers/sizes): in stock if any is.
  const all = Array.isArray(offers) ? (offers as Json[]) : [o];
  const avs = all.map((x) => readAvailability(x?.availability));
  const availability = avs.includes("in") ? "in" : avs.includes("out") ? "out" : null;
  return { price: clean(price, 40), currency: clean(currency, 8), availability, oldPrice: clean(listSpec?.price, 40) };
}

/**
 * Store pages often embed the product state as JSON (noon, Namshi…). A crossed-out price is
 * taken from it only when the sale price of the pair equals the price already read.
 */
const PRICE_PAIRS: [string, string][] = [
  ["sale_price", "was_price"],
  ["salePrice", "wasPrice"],
  ["salePrice", "listPrice"],
  ["specialPrice", "price"],
  ["sale_price", "price"],
  ["discountedPrice", "originalPrice"],
  ["sellingPrice", "originalPrice"],
  ["price", "originalPrice"],
  ["price", "oldPrice"],
];
export function embeddedOldPrice(html: string, price: string | null): string | null {
  const p = toNumber(price);
  for (const [saleKey, oldKey] of PRICE_PAIRS) {
    const re = new RegExp(`"${saleKey}"\\s*:\\s*"?([\\d.,]+)"?[^{}]{0,400}?"${oldKey}"\\s*:\\s*"?([\\d.,]+)"?|"${oldKey}"\\s*:\\s*"?([\\d.,]+)"?[^{}]{0,400}?"${saleKey}"\\s*:\\s*"?([\\d.,]+)"?`, "g");
    for (const m of html.matchAll(re)) {
      const sale = toNumber(m[1] ?? m[4]);
      const old = toNumber(m[2] ?? m[3]);
      if (!sale || !old || old <= sale) continue;
      if (p && Math.abs(sale - p) / p > 0.01) continue;
      return String(old);
    }
  }
  return null;
}

/** Visible stock text (Amazon and similar) when structured data says nothing. */
function textAvailability($: cheerio.CheerioAPI): "in" | "out" | null {
  const t = clean($("#availability, #outOfStock, [data-testid=availability]").first().text(), 200)?.toLowerCase() ?? "";
  if (!t) return null;
  if (/currently unavailable|nicht verfügbar|derzeit nicht|out of stock|sold out|stokta yok|tükendi/.test(t)) return "out";
  if (/in stock|auf lager|stokta|only \d+ left|nur noch/.test(t)) return "in";
  return null;
}

/**
 * Some stores give the image as a key on their CDN rather than a URL: noon writes
 * "pnsku/N70212301V/45/_/1766380651/7916b63e-…" (or "pzsku/…"), served from f.nooncdn.com.
 */
export function storeImage(image: string | null, baseUrl: string): string | null {
  if (!image || /^https?:\/\//i.test(image)) return image;
  let host = "";
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return image;
  }
  const key = image.match(/(?:^|\/)(p[nz]sku\/[^\s"'?#]+)/)?.[1];
  if (/(^|\.)noon\.com$/.test(host) && key) return `https://f.nooncdn.com/p/${key.replace(/\.(jpe?g|png|webp)$/i, "")}.jpg`;
  return image;
}

export function parseLinkMeta(html: string, baseUrl: string): LinkMeta {
  const $ = cheerio.load(html);
  const meta = (sel: string) => clean($(sel).first().attr("content"));

  let title: string | null = null;
  let image: string | null = null;
  let price: string | null = null;
  let currency: string | null = null;
  let availability: "in" | "out" | null = null;
  let oldPrice: string | null = null;

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
      availability ??= o.availability;
      oldPrice ??= o.oldPrice;
    } catch {
      /* malformed JSON-LD is common */
    }
  });

  title ??=
    meta('meta[property="og:title"]') ??
    meta('meta[name="twitter:title"]') ??
    clean($("#productTitle").first().text()) ??
    clean($("h1").first().text(), 200) ??
    clean($("title").first().text());
  image ??=
    meta('meta[property="og:image:secure_url"]') ??
    meta('meta[property="og:image"]') ??
    meta('meta[name="twitter:image"]') ??
    clean($("#landingImage").attr("data-old-hires") || $("#landingImage").attr("src"), 1000) ??
    clean($("#imgTagWrapperId img, #main-image, #imgBlkFront").first().attr("src"), 1000);
  price ??=
    meta('meta[property="product:price:amount"]') ??
    meta('meta[property="og:price:amount"]') ??
    meta('meta[itemprop="price"]');
  if (!price) {
    // Amazon-style visible price: "AED 749.00", "$1,299.99", "749,00 €".
    const text = clean($("#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, #apex_desktop .a-offscreen, .a-price .a-offscreen").first().text(), 40);
    const m = text?.match(/^([A-Z]{3}|[$€£])?\s*([\d.,]+)\s*([A-Z]{3}|[$€£])?$/);
    if (m) {
      price = m[2];
      const sym = m[1] ?? m[3];
      currency ??= sym ? ({ $: "USD", "€": "EUR", "£": "GBP" } as Record<string, string>)[sym] ?? sym : null;
    }
  }
  currency ??=
    meta('meta[property="product:price:currency"]') ??
    meta('meta[property="og:price:currency"]') ??
    meta('meta[itemprop="priceCurrency"]');

  availability ??=
    readAvailability(meta('meta[property="product:availability"]')) ??
    readAvailability(meta('meta[property="og:availability"]')) ??
    readAvailability($('[itemprop="availability"]').first().attr("href") ?? $('[itemprop="availability"]').first().attr("content")) ??
    textAvailability($);
  if (!oldPrice && price) {
    oldPrice =
      meta('meta[property="product:original_price:amount"]') ??
      clean($(".basisPrice .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price.a-text-price .a-offscreen").first().text(), 40) ??
      embeddedOldPrice(html, price);
  }
  if (oldPrice && !discountOf(price, oldPrice)) oldPrice = null;

  return {
    title,
    image: absolutize(storeImage(image, baseUrl), baseUrl),
    price,
    currency,
    availability,
    oldPrice,
    site: meta('meta[property="og:site_name"]'),
    finalUrl: baseUrl,
  };
}

/**
 * A soft bot page often keeps only the store's name as <title> ("Amazon.ae") with no image or
 * price. That isn't product data, so treat it as "not found" instead of showing a fake card.
 */
export function isGenericPage(meta: Pick<LinkMeta, "title" | "image" | "price" | "site">, url: string): boolean {
  if (meta.image || meta.price) return false;
  const title = (meta.title ?? "").trim().toLowerCase();
  if (!title) return true;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    /* ignore */
  }
  const brand = host.split(".")[0];
  const site = (meta.site ?? "").trim().toLowerCase();
  const short = title.length <= 40;
  return (
    title === host ||
    title === site ||
    (short && !!brand && title.replace(/[^a-z0-9]/g, "").startsWith(brand) && title.split(/\s+/).length <= 4)
  );
}

class NoProduct extends Error {}

async function readMeta(url: string, proxy: FetchProxy | null, signal: AbortSignal): Promise<LinkMeta> {
  const res = await safeFetch(url, { proxy, signal, timeoutMs: 10_000 });
  if (res.status >= 400) throw new NoProduct(`http_${res.status}`);
  if (!/html|xml/i.test(res.contentType)) throw new NoProduct("not_html");
  const meta = parseLinkMeta(res.body.toString("utf8"), res.url);
  // Bot-wall pages ("Robot Check", captcha) produce a title but no product data.
  if (meta.title && /robot check|robot or human|are you a human|captcha|access denied|verify you are human|slide to verify|pardon our interruption|just a moment/i.test(meta.title) && !meta.price) {
    throw new NoProduct("bot_wall");
  }
  if (isGenericPage(meta, res.url)) throw new NoProduct("generic_page");
  if (!meta.title && !meta.image) throw new NoProduct("empty");
  return meta;
}

/** Which proxy last worked for each store host, so the next request tries it first. */
const preferred = new Map<string, string>();
const HEDGE_MS = 1_200;

/**
 * Hedged race over the configured proxies: the proxy that last worked for this host starts
 * first, the rest join after HEDGE_MS (or at once if it fails or nothing is known yet).
 * The first proxy that returns real product data wins; the others are aborted.
 */
function raceProxies(url: string, host: string): Promise<{ meta: LinkMeta; via: string }> {
  const all = fetchProxies();
  const pool: (FetchProxy | null)[] = all.length ? all : [null];
  const pref = preferred.get(host);
  const order = pref ? [...pool].sort((x, y) => Number(y?.label === pref) - Number(x?.label === pref)) : pool;
  const ctrl = new AbortController();
  return new Promise((resolve, reject) => {
    const started = new Set<number>();
    let failed = 0;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const errors: string[] = [];
    const start = (i: number) => {
      if (done || started.has(i)) return;
      started.add(i);
      const p = order[i];
      readMeta(url, p, ctrl.signal).then(
        (meta) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          ctrl.abort();
          resolve({ meta, via: p?.label ?? "direct" });
        },
        (e: Error) => {
          errors.push(`${p?.label ?? "direct"}:${e.message}`);
          failed++;
          if (done) return;
          if (failed === order.length) {
            done = true;
            clearTimeout(timer);
            reject(new Error(errors.join(" ")));
          } else if (i === 0) startAll();
        }
      );
    };
    const startAll = () => order.forEach((_, i) => start(i));
    start(0);
    if (pref && order.length > 1) timer = setTimeout(startAll, HEDGE_MS);
    else startAll();
  });
}

/**
 * Last resort when every proxy is blocked: many store URLs carry the product name as a slug
 * (amazon.ae/Apple-AirPods-Pro/dp/…, trendyol.com/apple/iphone-15-p-123). Title only.
 */
export function titleFromUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const segs = u.pathname.split("/").map((x) => {
    try {
      return decodeURIComponent(x);
    } catch {
      return x;
    }
  });
  const dp = segs.findIndex((x) => x === "dp" || x === "gp");
  const candidates = dp > 0 ? [segs[dp - 1]] : segs;
  let best: string | null = null;
  for (const c of candidates) {
    const cleaned = c
      .replace(/\.(html?|aspx?|php)$/i, "")
      .replace(/-p-\d+.*$/i, "")
      .replace(/(^|[-_])(\d{5,}|[A-Z0-9]{10})$/g, "")
      .replace(/[-_+]+/g, " ")
      .trim();
    const words = cleaned.split(/\s+/).filter((w) => /\p{L}/u.test(w));
    if (words.length >= 2 && cleaned.length >= 8 && (!best || cleaned.length > best.length)) best = cleaned;
  }
  if (!best) return null;
  // Title-case only all-lowercase slugs (trendyol); keep the store's own casing (iPad, eBay).
  const titled = best === best.toLowerCase() ? best.replace(/(^|\s)(\p{Ll})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase()) : best;
  return titled.slice(0, 160);
}

export async function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const t0 = Date.now();
  try {
    const { meta, via } = await raceProxies(url, host);
    preferred.set(host, via);
    console.info(`[link-meta] ${host} ok via ${via} in ${Date.now() - t0}ms`);
    return meta;
  } catch (e) {
    const guess = titleFromUrl(url);
    console.warn(`[link-meta] ${host} failed in ${Date.now() - t0}ms${guess ? " (title from URL)" : ""}: ${(e as Error).message}`);
    return guess ? { title: guess, image: null, price: null, currency: null, site: null, finalUrl: url, guessed: true } : null;
  }
}

/* In-process cache so the live preview and the post-submit enrichment share one fetch. */
const CACHE_MAX = 500;
const OK_TTL = 30 * 60_000;
const FAIL_TTL = 60_000;
const cache = new Map<string, { at: number; meta: LinkMeta | null }>();
const inflight = new Map<string, Promise<LinkMeta | null>>();

export async function cachedLinkMeta(url: string): Promise<LinkMeta | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < (hit.meta && !hit.meta.guessed ? OK_TTL : FAIL_TTL)) return hit.meta;
  const running = inflight.get(url);
  if (running) return running;
  const p = fetchLinkMeta(url)
    .then((meta) => {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(url, { at: Date.now(), meta });
      return meta;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
