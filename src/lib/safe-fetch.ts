import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

/**
 * Fetches user-supplied URLs without letting them reach our own network (SSRF guard):
 * only http(s), only public IPs, manual redirects (each hop re-checked), size and time limits.
 *
 * FETCH_PROXY_URL (optional, http:// or https:// proxy) routes these requests through a server
 * outside Iran, because most foreign stores are unreachable or blocked from Iranian IPs.
 */

const MAX_REDIRECTS = 4;

let proxyAgent: Dispatcher | undefined;
function dispatcher(): Dispatcher | undefined {
  const url = process.env.FETCH_PROXY_URL;
  if (!url) return undefined;
  proxyAgent ??= new ProxyAgent(url);
  return proxyAgent;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad_protocol");
  if (url.username || url.password) throw new Error("credentials_in_url");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("bad_port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("private_host");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("private_host");
    return url;
  }
  // Through the foreign proxy, the proxy resolves names. Local DNS is skipped on purpose:
  // Iran's resolvers answer filtered domains with 10.10.34.x, which would look "private".
  if (process.env.FETCH_PROXY_URL) return url;
  const ips = (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("private_host");
  return url;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export type SafeResponse = { url: string; status: number; contentType: string; body: Buffer };

export async function safeFetch(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; accept?: string } = {}
): Promise<SafeResponse> {
  const maxBytes = opts.maxBytes ?? 2_500_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    let current = raw;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertPublicUrl(current);
      const res = await undiciFetch(url, {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: dispatcher(),
        headers: opts.accept ? { ...BROWSER_HEADERS, Accept: opts.accept } : BROWSER_HEADERS,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel();
        if (!loc) throw new Error("redirect_without_location");
        current = new URL(loc, url).toString();
        continue;
      }
      const len = Number(res.headers.get("content-length") || 0);
      if (len > maxBytes) {
        await res.body?.cancel();
        throw new Error("too_large");
      }
      const chunks: Buffer[] = [];
      let total = 0;
      if (res.body) {
        for await (const chunk of res.body) {
          total += chunk.length;
          if (total > maxBytes) {
            controller.abort();
            throw new Error("too_large");
          }
          chunks.push(Buffer.from(chunk));
        }
      }
      return {
        url: url.toString(),
        status: res.status,
        contentType: res.headers.get("content-type") || "",
        body: Buffer.concat(chunks),
      };
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timer);
  }
}
