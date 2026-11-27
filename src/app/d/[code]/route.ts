import { NextResponse, type NextRequest } from "next/server";
import { countClick } from "@/lib/deals";
import { getProductByCode } from "@/lib/products";
import { siteConfig } from "@/lib/site";

/** Link-preview crawlers (Instagram, Telegram, WhatsApp…) open links too; they are not people. */
const PREVIEW_BOT = /facebookexternalhit|facebot|instagram.*bot|meta-externalagent|telegrambot|whatsapp|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i;

/**
 * Unique product link for stories: /d/<code> → the order form with the product already filled in.
 * `?s=` names the channel (default instagram), kept as utm_source so orders are counted per link.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = getProductByCode(code.toLowerCase());
  // Behind the reverse proxy the request URL is the internal one; build links on the public origin.
  if (!p) return NextResponse.redirect(new URL("/", siteConfig.url), 302);
  const ua = req.headers.get("user-agent") ?? "";
  if (!PREVIEW_BOT.test(ua)) countClick(p.id);
  const src = (req.nextUrl.searchParams.get("s") ?? "instagram").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "instagram";
  const base = new URL("/order", siteConfig.url);
  base.searchParams.set("deal", p.code);
  base.searchParams.set("utm_source", src);
  base.searchParams.set("utm_medium", src === "instagram" ? "story" : "link");
  base.searchParams.set("utm_campaign", `deal-${p.code}`);
  const res = NextResponse.redirect(base, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
