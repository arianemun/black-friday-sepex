import { getCurrentStaff } from "@/lib/auth";
import { canViewInsights } from "@/lib/roles";
import { realtime } from "@/lib/rec/analytics";

/** Polled by the realtime page every few seconds. */
export async function GET() {
  const me = await getCurrentStaff();
  if (!me || !canViewInsights(me.role)) return new Response("Not found", { status: 404 });
  return Response.json(realtime(), { headers: { "Cache-Control": "no-store" } });
}
