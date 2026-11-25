import { getCurrentStaff } from "@/lib/auth";
import { canViewInsights } from "@/lib/roles";
import { SID_RE } from "@/lib/rec/protocol";
import { loadEvents } from "@/lib/rec/store";

/** rrweb events of one recorded session, for the in-panel player and heatmap backdrops. */
export async function GET(_req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const me = await getCurrentStaff();
  if (!me || !canViewInsights(me.role) || !SID_RE.test(sid)) return new Response("Not found", { status: 404 });
  const events = loadEvents(sid);
  if (!events.length) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(events), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=60" },
  });
}
