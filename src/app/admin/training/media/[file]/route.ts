import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getCurrentStaff } from "@/lib/auth";
import { SAFE_FILE, TRAINING_DIR } from "@/lib/training";

/**
 * Streams training videos to signed-in staff with HTTP Range support, which phones
 * (Safari in particular) need for playback and seeking without downloading the whole file.
 */
/** Largest slice served per range request; players simply ask for the next one. */
const CHUNK = 4 * 1024 * 1024;

const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", webp: "image/webp", vtt: "text/vtt; charset=utf-8" };

async function serve(req: Request, params: Promise<{ file: string }>, head: boolean) {
  const { file } = await params;
  if (!SAFE_FILE.test(file) || !(await getCurrentStaff())) return new Response("Not found", { status: 404 });
  const full = path.join(/*turbopackIgnore: true*/ TRAINING_DIR, path.basename(file));
  let size: number;
  let mtime: Date;
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) throw new Error();
    size = st.size;
    mtime = st.mtime;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const base = {
    "Content-Type": TYPES[file.split(".").pop()!],
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Last-Modified": mtime.toUTCString(),
    ETag: `"${size.toString(36)}-${mtime.getTime().toString(36)}"`,
    "X-Content-Type-Options": "nosniff",
  };

  // In production nginx sends the file itself (sendfile, native Range, exact Content-Length):
  // the app only checks the login. Set TRAINING_ACCEL_PATH to nginx's internal location, e.g. /_bf_training/.
  const accel = process.env.TRAINING_ACCEL_PATH;
  if (accel && /^\/[A-Za-z0-9_/-]+\/$/.test(accel)) {
    return new Response(null, {
      headers: {
        "X-Accel-Redirect": `${accel}${path.basename(file)}`,
        "Content-Type": base["Content-Type"],
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const range = req.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    // Open-ended or very large ranges get a bounded slice (allowed by RFC 9110; players ask for the rest).
    end = Math.min(end, start + CHUNK - 1);
    status = 206;
  }

  const headers: Record<string, string> = { ...base, "Content-Length": String(end - start + 1) };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  if (head) return new Response(null, { status, headers });
  if (status === 206) {
    // A buffered slice keeps an exact Content-Length, which iOS Safari relies on.
    const buf = Buffer.alloc(end - start + 1);
    const fh = await fs.promises.open(full, "r");
    try {
      await fh.read(buf, 0, buf.length, start);
    } finally {
      await fh.close();
    }
    return new Response(new Uint8Array(buf), { status, headers });
  }
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
}

export function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return serve(req, ctx.params, false);
}

export function HEAD(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return serve(req, ctx.params, true);
}
