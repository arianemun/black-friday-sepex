import fs from "node:fs";
import { storeIcon } from "@/lib/store-icons";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(key)) return new Response(null, { status: 404 });
  const p = await storeIcon(key);
  if (!p) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  const svg = p.endsWith(".svg");
  const type = svg ? "image/svg+xml" : p.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return new Response(new Uint8Array(fs.readFileSync(p)), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      // An SVG opened directly must not run anything.
      ...(svg ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
    },
  });
}
