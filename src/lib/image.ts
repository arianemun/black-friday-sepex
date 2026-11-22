import "server-only";

/**
 * sharp is loaded lazily: on CPUs without x86-64-v2 (SSE4.1/SSSE3) its prebuilt binary can't
 * load, and a top-level import would crash the build and every upload route. Without sharp,
 * uploads are still accepted (type checked by magic bytes) and stored unchanged.
 * SHARP_DISABLED=1 forces the fallback (for testing).
 */

type SharpFn = typeof import("sharp").default;
let loaded: Promise<SharpFn | null> | null = null;

export function loadSharp(): Promise<SharpFn | null> {
  loaded ??= (async () => {
    if (process.env.SHARP_DISABLED === "1") return null;
    try {
      const mod = (await import("sharp")) as unknown as { default?: SharpFn } & SharpFn;
      const fn = (mod.default ?? mod) as SharpFn;
      // Touch the native binding once so a broken install fails here, not mid-request.
      await fn({ create: { width: 1, height: 1, channels: 3, background: "#000" } }).png().toBuffer();
      return fn;
    } catch (e) {
      console.warn("[image] sharp unavailable, storing images without re-encoding:", (e as Error).message.split("\n")[0]);
      return null;
    }
  })();
  return loaded;
}

export type Sniffed = { mime: string; ext: string } | null;

/** Identifies the formats we accept from the first bytes, never from the client's MIME type. */
export function sniffImage(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  const gif = buf.subarray(0, 6).toString("latin1");
  if (gif === "GIF87a" || gif === "GIF89a") return { mime: "image/gif", ext: "gif" };
  return null;
}
