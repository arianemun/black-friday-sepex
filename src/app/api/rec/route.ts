import { headers } from "next/headers";
import { getClientIp } from "@/lib/request-info";
import { MAX_BODY, SID_RE } from "@/lib/rec/protocol";
import { decodeBatch, ingest, isBot } from "@/lib/rec/store";

/**
 * Receives recorder batches from the public site. Always answers 204 for well-formed requests
 * (even when a session is over its limits) so the visitor's page never sees errors.
 */
const hits = new Map<string, { t: number; n: number }>();

function allowed(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { t: now, n: 1 });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > 60_000) hits.delete(k);
    return true;
  }
  h.n += 1;
  return h.n <= 240;
}

export async function POST(req: Request) {
  if (process.env.REC_DISABLED === "1") return new Response(null, { status: 204 });
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") ?? "";
  const seq = Number(url.searchParams.get("seq"));
  if (!SID_RE.test(sid) || !Number.isInteger(seq) || seq < 0 || seq > 100_000) return new Response(null, { status: 400 });

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (isBot(ua)) return new Response(null, { status: 204 });
  const ip = await getClientIp();
  if (!allowed(ip)) return new Response(null, { status: 429 });

  const len = Number(h.get("content-length") ?? 0);
  if (len > MAX_BODY) return new Response(null, { status: 413 });
  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length || body.length > MAX_BODY) return new Response(null, { status: 413 });

  const batch = decodeBatch(body);
  if (!batch) return new Response(null, { status: 400 });
  try {
    ingest(sid, seq, body, batch, ua, ip);
  } catch (e) {
    console.error("[rec] ingest failed:", (e as Error).message);
  }
  return new Response(null, { status: 204 });
}
