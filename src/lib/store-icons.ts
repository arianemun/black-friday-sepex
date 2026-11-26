import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";
import { stores, suggestedStores } from "./catalog";
import { loadSharp, sniffImage } from "./image";
import { safeFetch } from "./safe-fetch";

/**
 * Each store's own site icon, fetched once and cached in DATA_DIR/store-icons; visitors only
 * ever load it from our own domain. Sources, in order: Google's favicon service (one source, so
 * icons look alike), then the site's own apple-touch-icon. Normalised to 128 px PNG when sharp
 * is available; without it only PNGs are kept as they are.
 */

const DIR = path.join(DATA_DIR, "store-icons");
const SIZE = 128;
const MIN_SIZE = 32; // smaller than this looks blurry: show the monogram instead
const FRESH_MS = 30 * 86_400_000;
const MISS_RETRY_MS = 86_400_000;
/** Written into .miss files: a miss recorded by an older version (fewer sources) is retried at once. */
const SOURCES_VERSION = "2";

const file = (key: string) => path.join(DIR, `${key}.png`);
const missFile = (key: string) => path.join(DIR, `${key}.miss`);
const age = (p: string) => {
  try {
    return Date.now() - fs.statSync(p).mtimeMs;
  } catch {
    return Infinity;
  }
};

/** PNG width/height from the IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (sniffImage(buf)?.ext !== "png" || buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Usable icon bytes from one source, or null. */
async function tryFetch(src: string): Promise<Buffer | null> {
  try {
    const res = await safeFetch(src, { maxBytes: 300_000, timeoutMs: 10_000, accept: "image/*" });
    if (res.status !== 200 || !sniffImage(res.body)) return null;
    const sharp = await loadSharp();
    if (sharp) {
      const img = sharp(res.body);
      const meta = await img.metadata();
      if ((meta.width ?? 0) < MIN_SIZE) return null;
      return img.resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    }
    const size = pngSize(res.body);
    return size && size.w >= MIN_SIZE ? res.body : null;
  } catch {
    return null;
  }
}

/** "en-ae.6thstreet.com" -> "6thstreet.com" (two labels, three for second-level TLDs like com.tr). */
function apexOf(host: string) {
  const parts = host.split(".");
  const n = /^(com|co|net|org)\.[a-z]{2}$/.test(parts.slice(-2).join(".")) ? 3 : 2;
  return parts.slice(-n).join(".");
}

async function download(host: string): Promise<Buffer | null> {
  const apex = apexOf(host);
  const sources = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${SIZE}`,
    ...(apex !== host ? [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(apex)}&sz=${SIZE}`] : []),
    `https://${host}/apple-touch-icon.png`,
    `https://${host}/apple-touch-icon-precomposed.png`,
  ];
  for (const src of sources) {
    const buf = await tryFetch(src);
    if (buf) return buf;
  }
  return null;
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
  const p = file(key);
  if (age(p) < FRESH_MS) return p;
  if (missIsCurrent(key)) return fs.existsSync(p) ? p : null;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const buf = await download(new URL(store.url).hostname);
      fs.mkdirSync(DIR, { recursive: true });
      if (!buf) {
        fs.writeFileSync(missFile(key), SOURCES_VERSION);
        return fs.existsSync(p) ? p : null;
      }
      fs.writeFileSync(p + ".tmp", buf);
      fs.renameSync(p + ".tmp", p);
      fs.rmSync(missFile(key), { force: true });
      return p;
    } catch (e) {
      console.warn(`[store-icon] ${key}: ${(e as Error).message}`);
      // Keep a stale icon rather than none; retry the fetch tomorrow.
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(missFile(key), SOURCES_VERSION);
      return fs.existsSync(p) ? p : null;
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
        .filter((f) => f.endsWith(".png"))
        .map((f) => f.slice(0, -4)),
    );
  } catch {
    return new Set();
  }
}

/** Fetches the icons of all suggested stores, one at a time (startup and monthly refresh). */
export async function warmStoreIcons() {
  let got = 0;
  for (const s of suggestedStores()) if (await storeIcon(s.key)) got++;
  return got;
}
