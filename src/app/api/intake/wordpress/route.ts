import { after } from "next/server";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { checkIntakeAuth, createIntakeRequest, intakeSchema, intakeToken } from "@/lib/intake";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-info";
import { afterRequestCreated } from "@/lib/requests";

/**
 * Lead intake from sepex.net (WordPress "CRM Management" plugin, secondary web service).
 * POST JSON, header "Authorization: Bearer <INTAKE_API_TOKEN>". Idempotent on idempotencyKey.
 */
export async function POST(req: Request) {
  if (!intakeToken()) return jsonError("intake_disabled", 503);
  const ip = await getClientIp();
  if (!rateLimit(`intake:ip:${ip}`, 120, 60)) return jsonError("rate_limited", 429);
  if (!checkIntakeAuth(req.headers.get("authorization"))) return jsonError("unauthorized", 401);

  let body: unknown;
  try {
    body = await readJson(req, 128_000);
  } catch {
    return jsonError("invalid_json", 400);
  }
  // Connection test from the plugin's settings page: valid token, nothing is created.
  if (body && typeof body === "object" && (body as { test?: unknown }).test === true) return jsonOk({ test: true });

  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid_payload", 422, { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join(".")) });

  const result = createIntakeRequest(parsed.data, ip);
  if (!result.ok) return jsonError(result.error, result.status);

  if (!result.duplicate) {
    const customerSms = process.env.INTAKE_CUSTOMER_SMS === "1";
    after(() => afterRequestCreated(result.id, { customerSms }).catch((e) => console.error("[intake] after failed:", e)));
  }
  console.info(`[intake] ${result.duplicate ? "duplicate" : "created"} ${result.trackingCode}`);
  return jsonOk({ trackingCode: result.trackingCode, duplicate: result.duplicate });
}

export function GET() {
  return jsonOk({ service: "sepex-black-friday-intake", version: 1, enabled: !!intakeToken() });
}
