import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";
import { stores, suggestedStores } from "./catalog";
import { loadSharp, sniffImage } from "./image";
import { safeFetch } from "./safe-fetch";

/**
 * Each store's own site icon, fetched once and cached in DATA_DIR/store-icons; visitors only
 * ever load it from our own domain. Sources, in order:
 *   1. Google's favicon service (one source, so icons look alike), for the host and its main domain
 *   2. the icons the site itself declares (<link rel=icon / apple-touch-icon>, web app manifest)
 *   3. the conventional /apple-touch-icon.png
 * Raster icons are normalised to a 128 px PNG when sharp is available; without it, PNGs are kept
 * as they are. Safe SVG icons are kept as SVG. When nothing works, the log says why per source.
 */

const DIR = path.join(DATA_DIR, "store-icons");
const SIZE = 128;
const MIN_SIZE = 32; // smaller than this looks blurry: show the monogram instead
const FRESH_MS = 30 * 86_400_000;
const MISS_RETRY_MS = 86_400_000;
/** Written into .miss files: a miss recorded by an older version (fewer sources) is retried at once. */
const SOURCES_VERSION = "3";
const EXTS = ["png", "svg"] as const;
type Ext = (typeof EXTS)[number];
type Icon = { buf: Buffer; ext: Ext };

const fileFor = (key: string, ext: Ext) => path.join(DIR, `${key}.${ext}`);
const missFile = (key: string) => path.join(DIR, `${key}.miss`);
const age = (p: string) => {
  try {
    return Date.now() - fs.statSync(p).mtimeMs;
  } catch {
    return Infinity;
  }
};
const existing = (key: string) => EXTS.map((e) => fileFor(key, e)).find((p) => fs.existsSync(p)) ?? null;

/** PNG width/height from the IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (sniffImage(buf)?.ext !== "png" || buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** An SVG we can serve: no scripts, event handlers or external references. */
export function safeSvg(buf: Buffer): boolean {
  if (buf.length > 150_000) return false;
  const t = buf.toString("utf8");
  if (!/<svg[\s>]/i.test(t.slice(0, 2000))) return false;
  return !/<script|<foreignObject|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:text)/i.test(t);
}

/** Turns fetched bytes into an icon we keep, or explains why not. */
async function toIcon(body: Buffer, contentType: string): Promise<Icon | string> {
  const raster = sniffImage(body);
  if (!raster) {
    if (/svg/i.test(contentType) || /<svg[\s>]/i.test(body.subarray(0, 2000).toString("utf8"))) {
      return safeSvg(body) ? { buf: body, ext: "svg" } : "unsafe svg";
    }
    return `not an image (${contentType.split(";")[0] || "?"})`;
  }
  const sharp = await loadSharp();
  if (sharp) {
    const img = sharp(body);
    const meta = await img.metadata();
    if ((meta.width ?? 0) < MIN_SIZE) return `${meta.width ?? 0}px`;
    const buf = await img.resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    return { buf, ext: "png" };
  }
  if (raster.ext !== "png") return `${raster.ext} (needs sharp)`;
  const size = pngSize(body);
  return size && size.w >= MIN_SIZE ? { buf: body, ext: "png" } : `${size?.w ?? 0}px`;
}

async function fetchIcon(src: string): Promise<Icon | string> {
  try {
    const res = await safeFetch(src, { maxBytes: 300_000, timeoutMs: 10_000, accept: "image/*" });
    if (res.status !== 200) return `http ${res.status}`;
    return await toIcon(res.body, res.contentType);
  } catch (e) {
    return (e as Error).message.slice(0, 40);
  }
}

/** "en-ae.6thstreet.com" -> "6thstreet.com" (two labels, three for second-level TLDs like com.tr). */
function apexOf(host: string) {
  const parts = host.split(".");
  const n = /^(com|co|net|org)\.[a-z]{2}$/.test(parts.slice(-2).join(".")) ? 3 : 2;
  return parts.slice(-n).join(".");
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
const largest = (sizes?: string) => Math.max(0, ...(sizes ?? "").split(/\s+/).map((s) => (s === "any" ? 512 : Number(s.split("x")[0]) || 0)));

/** Icons a site declares on its homepage and in its manifest, best first. */
export async function declaredIcons(pageUrl: string): Promise<{ urls: string[]; note: string }> {
  let res;
  try {
    res = await safeFetch(pageUrl, { maxBytes: 1_500_000, timeoutMs: 12_000, accept: "text/html" });
  } catch (e) {
    return { urls: [], note: (e as Error).message.slice(0, 40) };
  }
  if (res.status !== 200) return { urls: [], note: `http ${res.status}` };
  const html = res.body.toString("utf8");
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : 200_000);
  const found: { url: string; score: number }[] = [];
  let manifest: string | undefined;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    if (rel === "manifest") manifest = href;
    if (!/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) continue;
    const type = (attr(tag, "type") ?? "").toLowerCase();
    const svg = type.includes("svg") || /\.svg(\?|$)/i.test(href);
    const size = svg ? 512 : largest(attr(tag, "sizes")) || (rel.includes("apple") ? 180 : 16);
    found.push({ url: href, score: size + (rel.includes("apple") ? 1 : 0) });
  }
  if (manifest) {
    try {
      const m = await safeFetch(new URL(manifest, res.url).toString(), { maxBytes: 200_000, timeoutMs: 8_000, accept: "application/json" });
      const icons = (JSON.parse(m.body.toString("utf8")) as { icons?: { src?: string; sizes?: string }[] }).icons ?? [];
      for (const i of icons) if (i.src) found.push({ url: new URL(i.src, new URL(manifest, res.url)).toString(), score: largest(i.sizes) });
    } catch {
      /* a broken manifest is just one source less */
    }
  }
  const urls = [...new Set(found.sort((a, b) => b.score - a.score).map((f) => new URL(f.url, res.url).toString()))];
  return { urls: urls.slice(0, 4), note: urls.length ? "" : "no icon tags" };
}

async function download(storeUrl: string): Promise<{ icon: Icon | null; why: string[] }> {
  const host = new URL(storeUrl).hostname;
  const apex = apexOf(host);
  const why: string[] = [];
  const attempt = async (label: string, src: string) => {
    const r = await fetchIcon(src);
    if (typeof r === "string") why.push(`${label}: ${r}`);
    return typeof r === "string" ? null : r;
  };
  const google = (h: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=${SIZE}`;
  let icon = await attempt("google", google(host));
  if (!icon && apex !== host) icon = await attempt("google(apex)", google(apex));
  if (!icon) {
    const declared = await declaredIcons(storeUrl);
    if (declared.note) why.push(`page: ${declared.note}`);
    for (const u of declared.urls) {
      icon = await attempt("declared", u);
      if (icon) break;
    }
  }
  if (!icon) icon = await attempt("apple-touch", `https://${host}/apple-touch-icon.png`);
  return { icon, why };
}

const missIsCurrent = (key: string) => {
  try {
    return fs.readFileSync(missFile(key), "utf8") === SOURCES_VERSION && age(missFile(key)) < MISS_RETRY_MS;
  } catch {
    return false;
  }
};

const inflight = new Map<string, Promise<string | null>>();

/** Path of the cached icon, fetching it if needed; null if the store has no usable icon. */
export async function storeIcon(key: string): Promise<string | null> {
  const store = stores.find((s) => s.key === key);
  if (!store) return null;
  const have = existing(key);
  if (have && age(have) < FRESH_MS) return have;
  if (missIsCurrent(key)) return have;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const { icon, why } = await download(store.url);
      fs.mkdirSync(DIR, { recursive: true });
      if (!icon) {
        console.warn(`[store-icon] ${key}: no usable icon (${why.join("; ")})`);
        fs.writeFileSync(missFile(key), SOURCES_VERSION);
        return existing(key);
      }
      const p = fileFor(key, icon.ext);
      fs.writeFileSync(p + ".tmp", icon.buf);
      fs.renameSync(p + ".tmp", p);
      for (const e of EXTS) if (e !== icon.ext) fs.rmSync(fileFor(key, e), { force: true });
      fs.rmSync(missFile(key), { force: true });
      return p;
    } catch (e) {
      console.warn(`[store-icon] ${key}: ${(e as Error).message}`);
      // Keep a stale icon rather than none; retry the fetch tomorrow.
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(missFile(key), SOURCES_VERSION);
      return existing(key);
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

/** Keys whose icon is cached (the landing uses the monogram for the rest). */
export function cachedStoreIcons(): Set<string> {
  try {
    return new Set(
      fs
        .readdirSync(DIR)
        .filter((f) => /\.(png|svg)$/.test(f))
        .map((f) => f.replace(/\.(png|svg)$/, "")),
    );
  } catch {
    return new Set();
  }
}

/** Fetches the icons of all suggested stores, one at a time (startup and periodic refresh). */
export async function warmStoreIcons() {
  let got = 0;
  for (const s of suggestedStores()) if (await storeIcon(s.key)) got++;
  return got;
}
