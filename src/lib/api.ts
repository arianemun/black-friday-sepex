import "server-only";
import { NextResponse } from "next/server";

export const jsonError = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

export const jsonOk = (data: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });

export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}
