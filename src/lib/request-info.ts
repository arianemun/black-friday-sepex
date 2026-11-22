import "server-only";
import { headers } from "next/headers";

/**
 * Client IP. Only trusts X-Real-IP set by our own nginx ($remote_addr) when TRUST_PROXY=1.
 * X-Forwarded-For and CF-* headers are never trusted (they can be spoofed by clients).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  if (process.env.TRUST_PROXY === "1") {
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  return "local";
}

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return (h.get("user-agent") || "").slice(0, 300);
}

/** Basic same-origin check for state-changing JSON endpoints. */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true; // same-origin GET/navigation or non-browser; other limits apply
  const host = h.get("x-forwarded-host") || h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
