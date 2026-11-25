import { getCurrentStaff } from "@/lib/auth";
import { canViewInsights } from "@/lib/roles";
import { SID_RE } from "@/lib/rec/protocol";
import { loadEvents } from "@/lib/rec/store";
import { getDb } from "@/lib/db";

/** rrweb events of one recorded session, for the in-panel player and heatmap backdrops. */
export async function GET(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const me = await getCurrentStaff();
  if (!me || !canViewInsights(me.role) || !SID_RE.test(sid)) return new Response("Not found", { status: 404 });
  // ?after=<seq> returns only newer chunks (live follow); the response always says the last chunk seq.
  const after = Number(new URL(req.url).searchParams.get("after") ?? -1);
  const { events, lastSeq } = loadEvents(sid, Number.isInteger(after) ? after : -1);
  if (after < 0 && !events.length) return new Response("Not found", { status: 404 });
  // Last heartbeat from the visitor's tab: tells the live player "still here, just idle" from "left".
  const row = getDb().prepare("SELECT last_at FROM rec_sessions WHERE id = ?").get(sid) as { last_at: string } | undefined;
  return new Response(JSON.stringify(after >= 0 ? { events, lastSeq, lastAt: row?.last_at ?? null } : events), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Last-Seq": String(lastSeq),
      "X-Last-At": row?.last_at ?? "",
    },
  });
}
