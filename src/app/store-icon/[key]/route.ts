import fs from "node:fs";
import { storeIcon } from "@/lib/store-icons";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(key)) return new Response(null, { status: 404 });
  const p = await storeIcon(key);
  if (!p) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return new Response(new Uint8Array(fs.readFileSync(p)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" },
  });
}
