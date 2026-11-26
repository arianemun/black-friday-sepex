import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-icons-"));
process.env.DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

// A real PNG built by hand: the test must not need sharp (the production CPU can't load it).
function crcTable() {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
}
const CRC = crcTable();
const crc = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
async function png(size: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0xc8)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const pngWidth = (b: Buffer) => b.readUInt32BE(16);
const fetchMock = vi.fn();
vi.mock("@/lib/safe-fetch", () => ({ safeFetch: (...a: unknown[]) => fetchMock(...a) }));
// Like the production server: sharp can't load there.
vi.mock("@/lib/image", async (orig) => ({ ...(await orig<typeof import("@/lib/image")>()), loadSharp: async () => null }));

describe("store icons", () => {
  beforeEach(() => fetchMock.mockReset());

  it("fetches a store's icon once and serves it from cache", async () => {
    fetchMock.mockResolvedValue({ status: 200, contentType: "image/png", body: await png(64), url: "" });
    const { storeIcon, cachedStoreIcons } = await import("@/lib/store-icons");
    const p = await storeIcon("noon");
    expect(p).toBeTruthy();
    expect(pngWidth(fs.readFileSync(p!))).toBe(64); // kept as is without sharp
    expect(String(fetchMock.mock.calls[0][0])).toContain("domain=www.noon.com");
    await storeIcon("noon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cachedStoreIcons().has("noon")).toBe(true);
  });

  it("falls back to the site's own apple-touch-icon when Google has none", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    const good = await png(180);
    const tiny = await png(16);
    fetchMock.mockImplementation(async (...a: unknown[]) =>
      String(a[0]).endsWith("/apple-touch-icon.png") ? { status: 200, body: good } : { status: 200, body: tiny },
    );
    expect(await storeIcon("trendyol")).toBeTruthy();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("https://www.trendyol.com/apple-touch-icon.png");
  });

  it("tries the main domain for regional subdomains", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    fetchMock.mockResolvedValue({ status: 404, body: await png(64) });
    expect(await storeIcon("6thstreet")).toBeNull();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("https://www.google.com/s2/favicons?domain=6thstreet.com&sz=128");
  });

  it("does not retry a miss the same day, but retries misses from an older version", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    fetchMock.mockResolvedValue({ status: 404, body: await png(64) });
    expect(await storeIcon("namshi")).toBeNull();
    const n = fetchMock.mock.calls.length;
    expect(await storeIcon("namshi")).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(n);
    fs.writeFileSync(path.join(dir, "store-icons", "namshi.miss"), ""); // written by the first version
    await storeIcon("namshi");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(n);
  });

  it("uses the icon the site declares in its page when the usual places have none", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    const good = await png(192);
    const tiny = await png(16);
    const page = `<html><head><link rel="icon" href="/fav.ico"><link rel="apple-touch-icon" sizes="180x180" href="/static/touch-180.png"></head></html>`;
    fetchMock.mockImplementation(async (...a: unknown[]) => {
      const url = String(a[0]);
      if (url.includes("google.com")) return { status: 200, body: tiny, contentType: "image/png", url };
      if (url === "https://www.taobao.com") return { status: 200, body: Buffer.from(page), contentType: "text/html", url: "https://www.taobao.com/" };
      if (url === "https://www.taobao.com/static/touch-180.png") return { status: 200, body: good, contentType: "image/png", url };
      return { status: 404, body: Buffer.alloc(0), contentType: "", url };
    });
    const p = await storeIcon("taobao");
    expect(p).toMatch(/taobao\.png$/);
    expect(pngWidth(fs.readFileSync(p!))).toBe(192);
  });

  it("keeps a safe SVG icon and refuses one with scripts", async () => {
    const { safeSvg } = await import("@/lib/store-icons");
    expect(safeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'))).toBe(true);
    expect(safeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBe(false);
    expect(safeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>'))).toBe(false);
    expect(safeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>'))).toBe(false);
  });

  it("ignores unknown stores", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    expect(await storeIcon("../../etc/passwd")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
