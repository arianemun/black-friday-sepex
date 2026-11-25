/**
 * In-page session recorder (public site only).
 * rrweb records the DOM for replay; alongside it we collect what the dashboards need:
 * page views with scroll depth, clicks (with rage/dead detection) for heatmaps, JS errors and orders.
 * Everything is batched every few seconds, DEFLATE-compressed and posted to /api/rec on our own domain.
 */
import type { Batch, RecItem, RecMeta } from "./protocol";

const KEY = "bf-rec";
const IDLE_MS = 30 * 60_000;
const MAX_SESSION_MS = 60 * 60_000;
const FLUSH_MS = 5_000;
const DEAD_MS = 700;

type State = { sid: string; seq: number; view: number; last: number; started: number };

let state: State | null = null;
let events: unknown[] = [];
let items: RecItem[] = [];
let stopFn: (() => void) | undefined;
let addCustom: ((tag: string, payload: unknown) => void) | undefined;
let deflate: ((d: Uint8Array) => Uint8Array) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let currentPath = "/";
let viewStart = 0;
let maxScroll = 0;
let viewDocH = 0;
let scrollDirty = false;
let errorsThisPage = 0;
let sentMeta = false;
let entryMeta: RecMeta | null = null;
let flushing = false;
let running = false;

const now = () => Date.now();
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);

function loadState(): State {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as State | null;
    if (s && typeof s.sid === "string" && now() - s.last < IDLE_MS && now() - s.started < MAX_SESSION_MS) return s;
  } catch {}
  return { sid: rand(), seq: 0, view: 0, last: now(), started: now() };
}

function saveState() {
  if (!state) return;
  state.last = now();
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function visitorId(): string | undefined {
  try {
    let v = localStorage.getItem("bf-vid");
    if (!v || !/^[a-z0-9]{20,40}$/.test(v)) {
      v = rand();
      localStorage.setItem("bf-vid", v);
    }
    return v;
  } catch {
    return undefined;
  }
}

function meta(): RecMeta {
  const q = new URLSearchParams(location.search);
  return {
    vid: visitorId(),
    path: location.pathname,
    ref: document.referrer.slice(0, 300),
    utm: { s: q.get("utm_source") ?? undefined, m: q.get("utm_medium") ?? undefined, c: q.get("utm_campaign") ?? undefined },
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}

/* ------------------------------------------------------------------ page views & scroll */

function docHeight() {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
}

function onScroll() {
  const h = docHeight();
  viewDocH = h;
  const pct = h > 0 ? Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h) * 100)) : 100;
  if (pct > maxScroll) {
    maxScroll = pct;
    scrollDirty = true;
  }
}

function pushScroll() {
  if (!state || !viewStart) return;
  // The height measured while this page was on screen (the DOM may already show the next page).
  items.push({ k: "scroll", view: state.view, max: maxScroll, docH: viewDocH, dur: now() - viewStart });
  scrollDirty = false;
}

function startView(path: string) {
  if (!state) return;
  if (viewStart) pushScroll();
  state.view += 1;
  currentPath = path;
  viewStart = now();
  maxScroll = 0;
  viewDocH = 0;
  errorsThisPage = 0;
  items.push({ k: "page", view: state.view, path, ts: viewStart });
  addCustom?.("page", { path });
  saveState();
  setTimeout(onScroll, 500);
}

/* ------------------------------------------------------------------ clicks */

const INTERACTIVE =
  "a,button,input,select,textarea,label,summary,video,audio,[role=button],[role=link],[role=tab],[role=checkbox],[role=switch],[tabindex],[contenteditable=true]";
let recent: { t: number; x: number; y: number }[] = [];

function selectorOf(el: Element | null): string {
  const parts: string[] = [];
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
    let p = n.tagName.toLowerCase();
    if (n.id) {
      parts.unshift(`${p}#${n.id}`);
      break;
    }
    const cls = [...n.classList].filter((c) => /^[a-z][\w-]{1,24}$/i.test(c) && !c.includes(":")).slice(0, 2);
    if (cls.length) p += `.${cls.join(".")}`;
    parts.unshift(p);
  }
  return parts.join(" > ").slice(0, 200);
}

function labelOf(el: Element | null): string {
  const target = el?.closest(INTERACTIVE) ?? el;
  if (!target) return "";
  const a = target.getAttribute("aria-label") || target.getAttribute("alt") || target.getAttribute("title");
  const text = (a || (target as HTMLElement).innerText || target.textContent || "").replace(/\s+/g, " ").trim();
  return text.slice(0, 60);
}

function onClick(e: MouseEvent) {
  if (!state) return;
  const t = now();
  const x = Math.round(e.pageX);
  const y = Math.round(e.pageY);
  recent = recent.filter((c) => t - c.t < 1000 && Math.abs(c.x - x) < 40 && Math.abs(c.y - y) < 40);
  recent.push({ t, x, y });
  const rage: 0 | 1 | 2 = recent.length === 3 ? 1 : recent.length > 3 ? 2 : 0;

  const el = e.target instanceof Element ? e.target : null;
  const path = currentPath;
  const w = document.documentElement.scrollWidth;
  const h = docHeight();
  const sel = selectorOf(el);
  const label = labelOf(el);

  // Dead click: nothing visible happened (no DOM change, navigation, scroll or focus change).
  let changed = false;
  const mo = new MutationObserver(() => {
    changed = true;
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  const href = location.href;
  const sy = window.scrollY;
  const focus = document.activeElement;
  setTimeout(() => {
    mo.disconnect();
    const dead = !changed && location.href === href && window.scrollY === sy && document.activeElement === focus ? 1 : 0;
    items.push({ k: "click", path, ts: t, x, y, w, h, sel, label, rage, dead });
  }, DEAD_MS);
}

/* ------------------------------------------------------------------ errors & orders */

function onError(e: ErrorEvent) {
  if (errorsThisPage++ >= 20) return;
  const src = e.filename ? ` (${e.filename.split("/").pop()}:${e.lineno})` : "";
  items.push({ k: "err", path: currentPath, ts: now(), msg: `${e.message || "Error"}${src}`.slice(0, 300) });
}

function onRejection(e: PromiseRejectionEvent) {
  if (errorsThisPage++ >= 20) return;
  const r = e.reason as { message?: string } | undefined;
  items.push({ k: "err", path: currentPath, ts: now(), msg: `Unhandled: ${r?.message ?? String(e.reason)}`.slice(0, 300) });
}

function onOrder(e: Event) {
  const code = (e as CustomEvent<{ trackingCode?: string }>).detail?.trackingCode;
  if (!code) return;
  items.push({ k: "order", code });
  addCustom?.("order", { code });
  void flush(false);
}

/* ------------------------------------------------------------------ sending */

async function flush(final: boolean) {
  if (!state || !deflate || flushing) return;
  onScroll();
  if (scrollDirty || final) pushScroll();
  if (!events.length && !items.length) return;
  flushing = true;
  const batch: Batch = { v: 1, events, a: items };
  if (!sentMeta) batch.meta = entryMeta ?? meta();
  events = [];
  items = [];
  const seq = state.seq++;
  saveState();
  try {
    const body = deflate(new TextEncoder().encode(JSON.stringify(batch)));
    await fetch(`/api/rec?sid=${state.sid}&seq=${seq}`, {
      method: "POST",
      body: body as BodyInit,
      headers: { "content-type": "application/octet-stream" },
      keepalive: final && body.byteLength < 60_000,
      credentials: "omit",
    });
    sentMeta = true;
  } catch {
    // Network hiccup: drop this batch rather than grow memory on a visitor's phone.
  } finally {
    flushing = false;
  }
  if (state && now() - state.started > MAX_SESSION_MS) stopRecorder();
}

function onHide() {
  if (document.visibilityState === "hidden") void flush(true);
}

/* ------------------------------------------------------------------ lifecycle */

export async function startRecorder(path: string) {
  if (running || typeof window === "undefined") return;
  if (navigator.webdriver || path.startsWith("/admin")) return;
  running = true;
  try {
    const [{ record }, { deflateSync }] = await Promise.all([import("@rrweb/record"), import("fflate")]);
    deflate = (d) => deflateSync(d, { level: 6 });
    state = loadState();
    // Read the landing URL now: by the first send the visitor may already be on another page.
    entryMeta = meta();
    currentPath = path;
    stopFn = record({
      emit(e) {
        events.push(e);
      },
      checkoutEveryNms: 5 * 60_000,
      maskAllInputs: false,
      maskInputOptions: { password: true },
      blockSelector: "[data-rec-block]",
      recordCanvas: false,
      collectFonts: false,
      inlineImages: false,
      slimDOMOptions: "all",
      sampling: { mousemove: 60, mouseInteraction: true, scroll: 150, media: 800, input: "last" },
    }) ?? undefined;
    addCustom = (tag, payload) => record.addCustomEvent(tag, payload);
    startView(path);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, { capture: true, passive: true });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("bf:order", onOrder);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    timer = setInterval(() => void flush(false), FLUSH_MS);
  } catch {
    running = false;
  }
}

/** Called on client-side navigation. */
export function notePath(path: string) {
  if (!running) return;
  if (path.startsWith("/admin")) {
    stopRecorder();
    return;
  }
  if (path !== currentPath) startView(path);
}

export function stopRecorder() {
  if (!running) return;
  void flush(true);
  stopFn?.();
  clearInterval(timer);
  window.removeEventListener("scroll", onScroll);
  document.removeEventListener("click", onClick, { capture: true });
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
  window.removeEventListener("bf:order", onOrder);
  document.removeEventListener("visibilitychange", onHide);
  window.removeEventListener("pagehide", onHide);
  running = false;
}
