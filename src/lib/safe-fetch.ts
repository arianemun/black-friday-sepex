import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

/**
 * Fetches user-supplied URLs without letting them reach our own network (SSRF guard):
 * only http(s), only public IPs, manual redirects (each hop re-checked), size and time limits.
 *
 * Foreign stores are unreachable or blocked from Iranian IPs, so requests go through proxies
 * outside Iran. FETCH_PROXY_URLS is a comma-separated list, each entry optionally labelled:
 *   FETCH_PROXY_URLS=US=http://user:pass@1.2.3.4:35273,NL=http://user:pass@1.2.3.4:35274
 * FETCH_PROXY_URL (single proxy) is still read as a fallback. Only http(s) proxies.
 */

const MAX_REDIRECTS = 4;

export type FetchProxy = { label: string; url: string };

let parsed: { raw: string; list: FetchProxy[] } | undefined;
export function fetchProxies(): FetchProxy[] {
  const raw = [process.env.FETCH_PROXY_URLS, process.env.FETCH_PROXY_URL].filter(Boolean).join(",");
  if (parsed?.raw === raw) return parsed.list;
  const list: FetchProxy[] = [];
  for (const part of raw.split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z0-9_-]{1,12})=(https?:\/\/.+)$/);
    const url = m ? m[2] : part;
    if (!/^https?:\/\//.test(url) || list.some((p) => p.url === url)) continue;
    let label = m?.[1];
    if (!label) {
      try {
        label = `${new URL(url).port || "proxy"}`;
      } catch {
        continue;
      }
    }
    list.push({ label, url });
  }
  parsed = { raw, list };
  return list;
}

const agents = new Map<string, Dispatcher>();
function agentFor(proxy: FetchProxy | null): Dispatcher | undefined {
  if (!proxy) return undefined;
  let a = agents.get(proxy.url);
  if (!a) {
    a = new ProxyAgent(proxy.url);
    agents.set(proxy.url, a);
  }
  return a;
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
  if (fetchProxies().length) return url;
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
  opts: {
    maxBytes?: number;
    timeoutMs?: number;
    accept?: string;
    /** A specific proxy, `null` for a direct request; default: the first configured proxy. */
    proxy?: FetchProxy | null;
    signal?: AbortSignal;
  } = {}
): Promise<SafeResponse> {
  const maxBytes = opts.maxBytes ?? 2_500_000;
  const controller = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const proxy = opts.proxy === undefined ? (fetchProxies()[0] ?? null) : opts.proxy;
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    let current = raw;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertPublicUrl(current);
      const res = await undiciFetch(url, {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: agentFor(proxy),
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
