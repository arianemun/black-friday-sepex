import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-icons-"));
process.env.DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const png = (size: number) => sharp({ create: { width: size, height: size, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
const fetchMock = vi.fn();
vi.mock("@/lib/safe-fetch", () => ({ safeFetch: (...a: unknown[]) => fetchMock(...a) }));

describe("store icons", () => {
  beforeEach(() => fetchMock.mockReset());

  it("fetches a store's icon once, normalised to 128 px, and serves it from cache", async () => {
    fetchMock.mockResolvedValue({ status: 200, contentType: "image/png", body: await png(64), url: "" });
    const { storeIcon, cachedStoreIcons } = await import("@/lib/store-icons");
    const p = await storeIcon("noon");
    expect(p).toBeTruthy();
    expect((await sharp(fs.readFileSync(p!)).metadata()).width).toBe(128);
    expect(String(fetchMock.mock.calls[0][0])).toContain("domain=www.noon.com");
    await storeIcon("noon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cachedStoreIcons().has("noon")).toBe(true);
  });

  it("rejects tiny or missing icons and does not retry the same day", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    fetchMock.mockResolvedValue({ status: 200, contentType: "image/png", body: await png(16), url: "" });
    expect(await storeIcon("namshi")).toBeNull();
    fetchMock.mockResolvedValue({ status: 404, contentType: "image/png", body: await png(64), url: "" });
    expect(await storeIcon("trendyol")).toBeNull();
    expect(await storeIcon("trendyol")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores unknown stores", async () => {
    const { storeIcon } = await import("@/lib/store-icons");
    expect(await storeIcon("../../etc/passwd")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
