#!/usr/bin/env node
/**
 * Which proxy can read which store? Fetches each URL through every proxy in FETCH_PROXY_URLS
 * (plus FETCH_PROXY_URL) at the same time and prints a matrix: HTTP status, time, and whether
 * product data (og:image / price / JSON-LD Product) was found.
 *
 *   node scripts/proxy-check.mjs                      # default store URLs
 *   node scripts/proxy-check.mjs https://... https:// # your own product URLs
 *
 * Reads .env from the current directory if the variables aren't already set. Never prints
 * proxy credentials.
 */
import fs from "node:fs";
import { ProxyAgent, fetch } from "undici";

if (!process.env.FETCH_PROXY_URLS && !process.env.FETCH_PROXY_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*(FETCH_PROXY_URLS?|FETCH_PROXY_URL)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const proxies = [];
for (const part of [process.env.FETCH_PROXY_URLS, process.env.FETCH_PROXY_URL].filter(Boolean).join(",").split(",")) {
  const p = part.trim();
  if (!p) continue;
  const m = p.match(/^([A-Za-z0-9_-]{1,12})=(https?:\/\/.+)$/);
  const url = m ? m[2] : p;
  if (proxies.some((x) => x.url === url)) continue;
  proxies.push({ label: m ? m[1] : new URL(url).port, url, agent: new ProxyAgent(url) });
}
if (!proxies.length) {
  console.error("No FETCH_PROXY_URLS / FETCH_PROXY_URL configured.");
  process.exit(1);
}

const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "https://www.amazon.ae/dp/B0CHWRXH8B",
      "https://www.amazon.com/dp/B0CHWRXH8B",
      "https://www.amazon.de/dp/B0CHWRXH8B",
      "https://www.noon.com/uae-en/",
      "https://www.namshi.com/uae-en/",
      "https://www.trendyol.com/",
      "https://www.ebay.com/",
      "https://www.walmart.com/",
      "https://www.bestbuy.com/",
      "https://www.zalando.de/",
      "https://www.hepsiburada.com/",
      "https://uae.sharafdg.com/",
    ];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function probe(url, proxy) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { dispatcher: proxy.agent, headers: HEADERS, signal: ctrl.signal, redirect: "follow" });
    const html = (await res.text()).slice(0, 2_500_000);
    const ms = Date.now() - t0;
    const title = (html.match(/<title[^>]*>([^<]{0,80})/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const product = /og:image|"@type"\s*:\s*"Product"|product:price|itemprop="price"/i.test(html);
    const blocked = res.status >= 400 || /robot check|captcha|access denied|verify you are human|cf-chl|just a moment/i.test(html);
    const mark = blocked ? "✗" : product ? "✓" : "~";
    return { cell: `${mark} ${res.status} ${ms}ms`, title, ok: !blocked && product, ms };
  } catch (e) {
    return { cell: `✗ ${e.name === "AbortError" ? "timeout" : (e.cause?.code ?? e.message).toString().slice(0, 18)}`, title: "", ok: false, ms: Infinity };
  } finally {
    clearTimeout(timer);
  }
}

const rows = await Promise.all(
  urls.map(async (url) => {
    const results = await Promise.all(proxies.map((p) => probe(url, p)));
    const best = results
      .map((r, i) => ({ ...r, label: proxies[i].label }))
      .filter((r) => r.ok)
      .sort((a, b) => a.ms - b.ms)[0];
    return { url, results, best };
  })
);

const host = (u) => new URL(u).hostname.replace(/^www\./, "") + new URL(u).pathname.slice(0, 18);
const w = Math.max(...urls.map((u) => host(u).length), 10);
console.log(["store".padEnd(w), ...proxies.map((p) => p.label.padEnd(18)), "best"].join(" | "));
for (const r of rows) {
  console.log([host(r.url).padEnd(w), ...r.results.map((x) => x.cell.padEnd(18)), r.best ? r.best.label : "none"].join(" | "));
}
console.log("\n✓ product data found   ~ page loaded, no product data   ✗ blocked / error");
process.exit(0);
