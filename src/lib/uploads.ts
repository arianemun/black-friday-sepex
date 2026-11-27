import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, UPLOAD_DIR } from "./db";
import { fetchProxies, safeFetch, type FetchProxy } from "./safe-fetch";
import { loadSharp, sniffImage } from "./image";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// No HEIC in the list on purpose: iOS then converts photos to JPEG before upload.
export const ACCEPTED_UPLOADS = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

export type UploadKind = "customer" | "product";

export type UploadRow = {
  id: string;
  kind: UploadKind;
  file_name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  request_item_id: number | null;
};

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const hashDraftToken = sha256;

function isPdf(buf: Buffer) {
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/**
 * Validates by content (never by the client's MIME type), re-encodes images to WebP
 * (strips EXIF/GPS, normalizes orientation, defuses polyglots) and stores them outside /public.
 */
export async function storeUpload(
  buf: Buffer,
  opts: { kind: UploadKind; originalName?: string; draftToken?: string; ip?: string; maxSide?: number }
): Promise<UploadRow> {
  if (buf.length === 0 || buf.length > MAX_UPLOAD_BYTES) throw new Error("bad_size");
  const id = crypto.randomBytes(16).toString("base64url");
  let out: Buffer;
  let mime: string;
  let ext: string;
  let width: number | null = null;
  let height: number | null = null;

  if (isPdf(buf)) {
    if (opts.kind !== "customer") throw new Error("bad_type");
    out = buf;
    mime = "application/pdf";
    ext = "pdf";
  } else {
    const sharp = await loadSharp();
    if (sharp) {
      let img: ReturnType<typeof sharp>;
      try {
        img = sharp(buf, { failOn: "error", limitInputPixels: 60_000_000, animated: false });
        await img.metadata();
      } catch {
        throw new Error("bad_type");
      }
      const max = opts.maxSide ?? 2000;
      const res = await img
        .rotate()
        .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      out = res.data;
      width = res.info.width;
      height = res.info.height;
      mime = "image/webp";
      ext = "webp";
    } else {
      // Fallback without sharp: accept known image formats as they are.
      const kind = sniffImage(buf);
      if (!kind) throw new Error("bad_type");
      out = buf;
      mime = kind.mime;
      ext = kind.ext;
    }
  }

  const fileName = `${id}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, fileName), out, { mode: 0o640 });
  getDb()
    .prepare(
      "INSERT INTO uploads(id, kind, file_name, mime, size, width, height, draft_token_hash, ip) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, opts.kind, fileName, mime, out.length, width, height, opts.draftToken ? sha256(opts.draftToken) : null, opts.ip ?? null);
  return { id, kind: opts.kind, file_name: fileName, mime, size: out.length, width, height, request_item_id: null };
}

/** Downloads a remote product image (SSRF-guarded) and stores it as a product upload. Tries each proxy, then direct. */
export async function storeRemoteImage(url: string): Promise<UploadRow | null> {
  const routes: (FetchProxy | null)[] = [...fetchProxies(), null];
  for (const proxy of routes) {
    try {
      const res = await safeFetch(url, { proxy, maxBytes: MAX_UPLOAD_BYTES, accept: "image/avif,image/webp,image/*,*/*;q=0.8" });
      if (res.status >= 400) {
        console.warn(`[uploads] remote image via ${proxy?.label ?? "direct"}: http_${res.status} ${url.slice(0, 120)}`);
        continue;
      }
      return await storeUpload(res.body, { kind: "product", maxSide: 900 });
    } catch (e) {
      console.warn(`[uploads] remote image via ${proxy?.label ?? "direct"} failed:`, (e as Error).message);
    }
  }
  return null;
}

export function getUpload(id: string): UploadRow | undefined {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return undefined;
  return getDb()
    .prepare("SELECT id, kind, file_name, mime, size, width, height, request_item_id FROM uploads WHERE id = ?")
    .get(id) as UploadRow | undefined;
}

export async function readUploadFile(row: UploadRow): Promise<Buffer> {
  return fs.readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, path.basename(row.file_name)));
}

export async function deleteUpload(id: string) {
  const row = getUpload(id);
  if (!row) return;
  getDb().prepare("DELETE FROM uploads WHERE id = ?").run(id);
  await fs.rm(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, path.basename(row.file_name)), { force: true });
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/media/${id}` : null);
