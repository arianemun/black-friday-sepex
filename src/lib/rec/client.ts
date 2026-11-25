/**
 * In-page session recorder (public site only).
 *
 * rrweb records the DOM for replay. Alongside it we collect what the dashboards need:
 * page views (active time, scroll depth, attention per band, vitals), clicks (rage/dead with
 * element-relative coordinates), custom events, form-field timings, same-origin API calls,
 * JS errors, mouse-move density and a heartbeat for the realtime view.
 * Everything is batched every few seconds, DEFLATE-compressed and posted to /api/rec on our own domain.
 * Recording pauses while the tab is hidden, so background tabs don't inflate time or size.
 */
import type { Batch, ClickItem, RecItem, RecMeta } from "./protocol";

const KEY = "bf-rec";
const IDLE_MS = 30 * 60_000;
const MAX_SESSION_MS = 4 * 60 * 60_000;
const FLUSH_MS = 5_000;
const HEARTBEAT_MS = 15_000;
const DEAD_MS = 800;
const ACTIVE_IDLE_MS = 60_000;
const BANDS = 20;

type State = { sid: string; seq: number; view: number; last: number; started: number };

let state: State | null = null;
let events: unknown[] = [];
let items: RecItem[] = [];
let recordFn: typeof import("@rrweb/record").record | undefined;
let stopFn: (() => void) | undefined;
let deflate: ((d: Uint8Array) => Uint8Array) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;
let running = false;
let paused = false;
let flushing = false;
let flushAgain = false;
let sentMeta = false;
let entryMeta: RecMeta | null = null;
let lastSent = 0;
let hiddenAt = 0;

/* per page view */
let currentPath = "/";
let viewStart = 0;
let maxScroll = 0;
let viewDocH = 0;
let activeMs = 0;
let scrollDist = 0;
let lastScrollY = 0;
let interactions = 0;
let bands: number[] = new Array(BANDS).fill(0);
let errorsThisPage = 0;
let scrollDirty = false;
let lastInteraction = 0;
let prevViews: { path: string; start: number; view: number }[] = [];

const now = () => Date.now();
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);

/** The un-instrumented fetch, so the recorder's own uploads never show up as "network" analytics. */
let fetchOrig: typeof fetch = (...a) => fetch(...a);

/* ------------------------------------------------------------------ session state */

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

function visitor(): { vid?: string; ret: boolean } {
  try {
    const v = localStorage.getItem("bf-vid");
    if (v && /^[a-z0-9]{20,40}$/.test(v)) return { vid: v, ret: true };
    const n = rand();
    localStorage.setItem("bf-vid", n);
    return { vid: n, ret: false };
  } catch {
    return { ret: false };
  }
}

function meta(): RecMeta {
  const q = new URLSearchParams(location.search);
  const v = visitor();
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  return {
    path: location.pathname,
    ref: document.referrer.slice(0, 300),
    utm: {
      s: q.get("utm_source") ?? undefined,
      m: q.get("utm_medium") ?? undefined,
      c: q.get("utm_campaign") ?? undefined,
      t: q.get("utm_term") ?? undefined,
    },
    vw: window.innerWidth,
    vh: window.innerHeight,
    vid: v.vid,
    ret: v.ret,
    sw: screen.width,
    sh: screen.height,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    lang: navigator.language?.slice(0, 12),
    tz: tz?.slice(0, 40),
    conn: conn?.slice(0, 10),
  };
}

/* ------------------------------------------------------------------ page views, scroll, attention */

function docHeight() {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, 1);
}

function onScroll() {
  const h = docHeight();
  viewDocH = h;
  const y = window.scrollY;
  scrollDist += Math.abs(y - lastScrollY);
  lastScrollY = y;
  const pct = Math.min(100, Math.round(((y + window.innerHeight) / h) * 100));
  if (pct > maxScroll) {
    maxScroll = pct;
    scrollDirty = true;
  }
}

function markInteraction() {
  lastInteraction = now();
}

function onUserScroll() {
  markInteraction();
  interactions += 0.1; // a scroll gesture fires many events; ~10 of them count as one interaction
}

function onKey() {
  markInteraction();
  interactions += 1;
}

/** Every second: foreground time and which bands of the page were on screen. */
function tick() {
  if (document.visibilityState !== "visible" || !viewStart) return;
  if (now() - lastInteraction > ACTIVE_IDLE_MS) return;
  activeMs += 1000;
  const h = docHeight();
  const top = window.scrollY / h;
  const bottom = (window.scrollY + window.innerHeight) / h;
  for (let i = 0; i < BANDS; i++) {
    const overlap = Math.max(0, Math.min(bottom, (i + 1) / BANDS) - Math.max(top, i / BANDS)) * BANDS;
    if (overlap > 0) bands[i] += Math.round(1000 * overlap);
  }
  scrollDirty = true;
}

function pushScroll() {
  if (!state || !viewStart) return;
  items.push({
    k: "scroll",
    view: state.view,
    max: maxScroll,
    docH: viewDocH,
    dur: now() - viewStart,
    act: activeMs,
    dist: Math.round(scrollDist),
    ia: Math.round(interactions),
    bands: [...bands],
  });
  scrollDirty = false;
}

function startView(path: string) {
  if (!state) return;
  if (viewStart) pushScroll();
  // Quick back: a page left within 5 s for the page before it.
  const prev = prevViews[prevViews.length - 1];
  const before = prevViews[prevViews.length - 2];
  if (prev && before && before.path === path && now() - prev.start < 5000) items.push({ k: "qb", view: prev.view });
  flushMoves();
  state.view += 1;
  currentPath = path;
  viewStart = now();
  maxScroll = 0;
  viewDocH = 0;
  activeMs = 0;
  scrollDist = 0;
  lastScrollY = window.scrollY;
  interactions = 0;
  bands = new Array(BANDS).fill(0);
  errorsThisPage = 0;
  prevViews.push({ path, start: viewStart, view: state.view });
  if (prevViews.length > 5) prevViews.shift();
  items.push({ k: "page", view: state.view, path, ts: viewStart, title: document.title.slice(0, 120) });
  try {
    recordFn?.addCustomEvent("page", { path });
  } catch {}
  saveState();
  setTimeout(onScroll, 600);
}

/* ------------------------------------------------------------------ clicks */

const INTERACTIVE =
  "a,button,select,summary,video,audio,[role=button],[role=link],[role=tab],[role=checkbox],[role=switch],[role=menuitem],[role=option],[onclick]";
const FORM_CONTROL = "input,textarea,select,option,label,[contenteditable=true],[contenteditable='']";
let recent: { t: number; x: number; y: number }[] = [];
let netStarted = 0;
let lastBlur = 0;
let lastInputEvt = 0;

function looksClickable(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest(INTERACTIVE)) return true;
  for (let n: Element | null = el, i = 0; n && i < 4; n = n.parentElement, i++) {
    try {
      if (getComputedStyle(n).cursor === "pointer") return true;
    } catch {}
  }
  return false;
}

function isContainer(el: Element | null): boolean {
  if (!el) return true;
  const tag = el.tagName;
  if (tag === "HTML" || tag === "BODY" || tag === "MAIN" || tag === "SECTION" || tag === "ARTICLE" || tag === "FORM") return true;
  const r = el.getBoundingClientRect();
  return r.width * r.height > window.innerWidth * window.innerHeight * 0.6;
}

function selectorOf(el: Element | null): string {
  const parts: string[] = [];
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
    let p = n.tagName.toLowerCase();
    if (n.id && !/[-_][a-z0-9]{6,12}$/i.test(n.id)) {
      parts.unshift(`${p}#${n.id}`);
      break;
    }
    const cls = [...n.classList].filter((c) => /^[a-z][\w-]{1,24}$/i.test(c) && !c.includes(":")).slice(0, 2);
    if (cls.length) p += `.${cls.join(".")}`;
    parts.unshift(p);
  }
  return parts.join(" > ").slice(0, 200);
}

/** body > … :nth-of-type path, stable across visitors on the same page version. */
function structuralPath(el: Element | null): string {
  const parts: string[] = [];
  for (let n = el; n && n.nodeType === 1 && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    let i = 1;
    for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++;
    parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${i})`);
    if (parts.length > 24) break;
  }
  return parts.join(">").slice(0, 600);
}

function labelOf(el: Element | null): string {
  const target = el?.closest(INTERACTIVE) ?? el;
  if (!target) return "";
  if (target.matches(FORM_CONTROL)) {
    const t = target as HTMLInputElement;
    let lab: string | null | undefined = null;
    try {
      lab = t.id ? document.querySelector(`label[for="${CSS.escape(t.id)}"]`)?.textContent : null;
    } catch {}
    return (t.getAttribute("aria-label") || lab || t.getAttribute("placeholder") || t.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
  }
  const a = target.getAttribute("aria-label") || target.getAttribute("alt") || target.getAttribute("title");
  const text = (a || (target as HTMLElement).innerText || target.textContent || "").replace(/\s+/g, " ").trim();
  return text.slice(0, 60);
}

function onClick(e: MouseEvent) {
  if (!state || paused) return;
  markInteraction();
  interactions += 1;
  const t = now();
  const x = Math.round(e.pageX);
  const y = Math.round(e.pageY);
  const el = e.target instanceof Element ? e.target : null;
  const formControl = !!el?.closest(FORM_CONTROL) && !el?.closest("button,a");

  // Rage: 3+ clicks within 1 s and 40 px. Not for text fields, where repeated taps move the caret.
  let rage: 0 | 1 | 2 = 0;
  if (!formControl) {
    recent = recent.filter((c) => t - c.t < 1000 && Math.abs(c.x - x) < 40 && Math.abs(c.y - y) < 40);
    recent.push({ t, x, y });
    rage = recent.length === 3 ? 1 : recent.length > 3 ? 2 : 0;
  }

  const ia: 0 | 1 = formControl || looksClickable(el) ? 1 : 0;
  const target = el?.closest(INTERACTIVE) ?? el;
  const rect = target?.getBoundingClientRect();
  const base = {
    k: "click" as const,
    path: currentPath,
    ts: t,
    x,
    y,
    w: document.documentElement.scrollWidth,
    h: docHeight(),
    sel: selectorOf(el),
    label: labelOf(el),
    rage,
    ia,
    el: target && !isContainer(target) ? structuralPath(target) : undefined,
    ox: rect && rect.width ? Math.round(((e.clientX - rect.left) / rect.width) * 1000) : undefined,
    oy: rect && rect.height ? Math.round(((e.clientY - rect.top) / rect.height) * 1000) : undefined,
  };

  // Dead click: something that looks clickable, and nothing at all happened — no DOM change,
  // navigation, scroll, focus change, window blur (native pickers/dialogs), input or network request.
  if (!ia || formControl || isContainer(el)) {
    items.push({ ...base, dead: 0 } satisfies ClickItem);
    return;
  }
  let changed = false;
  const mo = new MutationObserver(() => {
    changed = true;
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  const href = location.href;
  const sy = window.scrollY;
  const focus = document.activeElement;
  const netBefore = netStarted;
  setTimeout(() => {
    mo.disconnect();
    const effect =
      changed ||
      location.href !== href ||
      window.scrollY !== sy ||
      document.activeElement !== focus ||
      lastBlur >= t ||
      lastInputEvt >= t ||
      netStarted !== netBefore ||
      document.visibilityState !== "visible";
    items.push({ ...base, dead: effect ? 0 : 1 } satisfies ClickItem);
  }, DEAD_MS);
}

/* ------------------------------------------------------------------ auto-captured events */

function linkEvent(a: HTMLAnchorElement): { name: string; props: Record<string, string> } | null {
  const href = a.getAttribute("href") ?? "";
  const label = (a.getAttribute("aria-label") || a.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const section = a.closest("section[id],header,footer,nav")?.id || a.closest("section,header,footer,nav")?.tagName.toLowerCase() || "";
  if (/^tel:/i.test(href)) return { name: "contact_phone", props: { label, section } };
  if (/^mailto:/i.test(href)) return { name: "contact_email", props: { label, section } };
  if (/wa\.me|whatsapp/i.test(href)) return { name: "contact_whatsapp", props: { label, section } };
  if (/t\.me|telegram/i.test(href)) return { name: "contact_telegram", props: { label, section } };
  if (/ble\.ir|bale/i.test(href)) return { name: "contact_bale", props: { label, section } };
  if (/instagram\.com/i.test(href)) return { name: "social_instagram", props: { label, section } };
  try {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return { name: "outbound", props: { host: u.hostname.replace(/^www\./, ""), label, section } };
    if (u.pathname.startsWith("/order")) return { name: "cta_order", props: { label, section, method: u.searchParams.get("method") ?? "" } };
    if (u.pathname.startsWith("/track")) return { name: "cta_track", props: { label, section } };
  } catch {}
  return null;
}

function onAutoEvent(e: MouseEvent) {
  if (paused) return;
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;
  const a = el.closest("a[href]") as HTMLAnchorElement | null;
  if (a) {
    const ev = linkEvent(a);
    if (ev) pushEvent(ev.name, ev.props);
    return;
  }
  const toggle = el.closest("[aria-expanded]");
  if (toggle && toggle.getAttribute("aria-expanded") === "false") {
    pushEvent("expand", { label: labelOf(toggle), section: toggle.closest("section[id]")?.id ?? "" });
  }
}

function pushEvent(name: string, props: Record<string, string | number | boolean | null | undefined> = {}) {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props).slice(0, 12)) if (v !== undefined) clean[k.slice(0, 30)] = typeof v === "string" ? v.slice(0, 120) : v;
  items.push({ k: "ev", path: currentPath, ts: now(), name: name.slice(0, 40), props: clean });
  try {
    recordFn?.addCustomEvent("ev", { name, props: clean });
  } catch {}
}

function onTrack(e: Event) {
  const d = (e as CustomEvent<{ name?: string; props?: Record<string, string | number | boolean | null> }>).detail;
  if (d?.name) pushEvent(d.name, d.props ?? {});
}

/* ------------------------------------------------------------------ form fields */

const fieldStart = new Map<Element, { t: number; v: string }>();
const fieldKeyOf = (el: Element) => {
  const id = (el as HTMLInputElement).id || (el as HTMLInputElement).name || el.getAttribute("aria-label") || el.tagName.toLowerCase();
  return id.replace(/[-_][a-z0-9]{6,12}$/i, "").slice(0, 40);
};
const valueOf = (el: Element) => ("value" in el ? String((el as HTMLInputElement).value ?? "") : "");
const formOf = (el: Element) => {
  const f = el.closest("form[id],[data-form],section[id]");
  return (f?.getAttribute("data-form") || f?.id || currentPath).slice(0, 40);
};

function onFocusIn(e: FocusEvent) {
  const el = e.target instanceof Element ? e.target : null;
  if (!el || !el.matches("input,textarea,select") || (el as HTMLInputElement).type === "hidden") return;
  fieldStart.set(el, { t: now(), v: valueOf(el) });
}

function onFocusOut(e: FocusEvent) {
  const el = e.target instanceof Element ? e.target : null;
  const s = el ? fieldStart.get(el) : undefined;
  if (!el || !s) return;
  fieldStart.delete(el);
  const v = valueOf(el);
  items.push({
    k: "field",
    path: currentPath,
    ts: s.t,
    form: formOf(el),
    field: fieldKeyOf(el),
    ms: Math.min(now() - s.t, 30 * 60_000),
    filled: v.trim() ? 1 : 0,
    changed: v !== s.v ? 1 : 0,
  });
}

/* ------------------------------------------------------------------ mouse movement (desktop) */

const moveGrid = new Map<string, number>();
let lastMove = 0;
function onMove(e: MouseEvent) {
  markInteraction();
  const t = now();
  if (t - lastMove < 150 || paused) return;
  lastMove = t;
  const key = `${Math.round(e.pageX / 16)},${Math.round(e.pageY / 16)}`;
  if (moveGrid.size < 3000 || moveGrid.has(key)) moveGrid.set(key, (moveGrid.get(key) ?? 0) + 1);
}

let movesFlushedAt = 0;
function flushMoves() {
  movesFlushedAt = now();
  if (!moveGrid.size) return;
  const pts: number[] = [];
  for (const [k, n] of moveGrid) {
    const [x, y] = k.split(",").map(Number);
    pts.push(x * 16, y * 16, n);
  }
  moveGrid.clear();
  items.push({ k: "move", path: currentPath, w: document.documentElement.scrollWidth, h: viewDocH || docHeight(), pts });
}

/* ------------------------------------------------------------------ network (same-origin API calls) */

let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window.fetch !== "function") return;
  fetchPatched = true;
  const orig = fetchOrig;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL | null = null;
    try {
      url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    } catch {}
    const watched = !!url && url.origin === location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/rec");
    if (!watched) return orig(input, init);
    netStarted++;
    const t = now();
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    try {
      const res = await orig(input, init);
      if (running) items.push({ k: "net", path: currentPath, ts: t, url: url!.pathname.slice(0, 120), method, status: res.status, ms: now() - t });
      return res;
    } catch (err) {
      if (running) items.push({ k: "net", path: currentPath, ts: t, url: url!.pathname.slice(0, 120), method, status: 0, ms: now() - t });
      throw err;
    }
  };
}

/* ------------------------------------------------------------------ errors, orders, vitals */

const NOISE =
  /Java object is gone|webkit\.messageHandlers|ResizeObserver loop|Non-Error promise rejection|__gCrWeb|instantSearchSDK|zaloJSV2|AutofillCallbackHandler|bytedance|ucbrowser/i;

function onError(e: ErrorEvent) {
  const msg = e.message || "Error";
  if (NOISE.test(msg) || NOISE.test(e.filename ?? "")) return;
  if (errorsThisPage++ >= 20) return;
  let own = false;
  try {
    own = !!e.filename && new URL(e.filename).origin === location.origin;
  } catch {}
  const where = e.filename ? ` (${e.filename.split("/").pop()?.split("?")[0]}:${e.lineno})` : "";
  const stack = (e.error as Error | undefined)?.stack?.split("\n").slice(0, 4).join("\n").slice(0, 600);
  items.push({ k: "err", path: currentPath, ts: now(), msg: `${msg}${where}`.slice(0, 300), src: own ? "own" : "ext", stack });
}

function onRejection(e: PromiseRejectionEvent) {
  const r = e.reason as { message?: string; stack?: string } | undefined;
  const msg = `Unhandled: ${r?.message ?? String(e.reason)}`;
  if (NOISE.test(msg) || errorsThisPage++ >= 20) return;
  const own = !r?.stack || r.stack.includes(location.origin);
  items.push({
    k: "err",
    path: currentPath,
    ts: now(),
    msg: msg.slice(0, 300),
    src: own ? "own" : "ext",
    stack: r?.stack?.split("\n").slice(0, 4).join("\n").slice(0, 600),
  });
}

function onOrder(e: Event) {
  const code = (e as CustomEvent<{ trackingCode?: string }>).detail?.trackingCode;
  if (!code) return;
  items.push({ k: "order", code });
  try {
    recordFn?.addCustomEvent("order", { code });
  } catch {}
  void flush(false);
}

async function watchVitals() {
  try {
    const v = await import("web-vitals");
    const view = () => state?.view ?? 1;
    const push = (name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB") => (m: { value: number }) => {
      items.push({ k: "vital", view: view(), name, value: name === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value) });
      if (document.visibilityState === "hidden") void flush(true);
    };
    v.onLCP(push("LCP"));
    v.onINP(push("INP"));
    v.onCLS(push("CLS"));
    v.onFCP(push("FCP"));
    v.onTTFB(push("TTFB"));
  } catch {}
}

/* ------------------------------------------------------------------ sending */

/**
 * Browsers cap keepalive bodies (all in flight together) at 64 KB. Exit uploads may use most of
 * it; routine ones only when small, so an upload caught mid-flight by the visitor leaving still
 * arrives and leaves room for the exit batch.
 */
const KEEPALIVE_EXIT = 60_000;
const KEEPALIVE_ROUTINE = 24_000;

/** Encodes and posts one batch; returns false on network failure. */
async function post(batch: Batch, keepaliveUnder: number): Promise<boolean> {
  if (!state || !deflate) return false;
  if (!sentMeta) batch.meta = entryMeta ?? meta();
  const seq = state.seq++;
  saveState();
  const body = deflate(new TextEncoder().encode(JSON.stringify(batch)));
  try {
    await fetchOrig(`/api/rec?sid=${state.sid}&seq=${seq}`, {
      method: "POST",
      body: body as BodyInit,
      headers: { "content-type": "application/octet-stream" },
      // While leaving, keepalive lets the request outlive the page.
      keepalive: body.byteLength < keepaliveUnder,
      credentials: "same-origin",
    });
    sentMeta = true;
    lastSent = now();
    return true;
  } catch {
    // Network hiccup: drop this batch rather than grow memory on a visitor's phone.
    return false;
  }
}

async function flush(final: boolean) {
  if (!state || !deflate) return;
  // A regular upload in flight: queue behind it. Leaving the page can't wait — send now.
  if (flushing && !final) {
    flushAgain = true;
    return;
  }
  if (!paused) onScroll();
  if (scrollDirty || final) pushScroll();
  // Movement is aggregated per page; send it every 30 s so a lost exit upload doesn't lose it all.
  if (!final && now() - movesFlushedAt > 30_000) flushMoves();
  if (final) {
    flushMoves();
    // Fields still focused when the visitor leaves: report their time so far.
    for (const [el, s] of fieldStart) {
      items.push({
        k: "field",
        path: currentPath,
        ts: s.t,
        form: formOf(el),
        field: fieldKeyOf(el),
        ms: now() - s.t,
        filled: valueOf(el).trim() ? 1 : 0,
        changed: valueOf(el) !== s.v ? 1 : 0,
      });
      fieldStart.set(el, { t: now(), v: valueOf(el) });
    }
  }
  if (!events.length && !items.length) {
    if (now() - lastSent < HEARTBEAT_MS || document.visibilityState !== "visible") return;
    items.push({ k: "hb", path: currentPath });
  }
  const ev = events;
  const it = items;
  events = [];
  items = [];
  const wasFlushing = flushing;
  flushing = true;
  try {
    if (final && ev.length && it.length) {
      // Leaving: the analytics items are small and matter most, so they go first in their own
      // keepalive request; the replay events follow and use whatever keepalive budget is left.
      await Promise.all([post({ v: 1, events: [], a: it }, KEEPALIVE_EXIT), post({ v: 1, events: ev, a: [] }, KEEPALIVE_EXIT)]);
    } else {
      await post({ v: 1, events: ev, a: it }, final ? KEEPALIVE_EXIT : KEEPALIVE_ROUTINE);
    }
  } finally {
    if (!wasFlushing) flushing = false;
  }
  if (flushAgain && !flushing) {
    flushAgain = false;
    void flush(final);
  }
  if (state && now() - state.started > MAX_SESSION_MS) stopRecorder();
}

/* ------------------------------------------------------------------ recording on/off with visibility */

function startRrweb() {
  if (!recordFn || stopFn) return;
  stopFn =
    recordFn({
      emit(e) {
        events.push(e);
        if (events.length > 400) void flush(false);
      },
      checkoutEveryNms: 5 * 60_000,
      maskAllInputs: false,
      maskInputOptions: { password: true },
      blockSelector: "[data-rec-block]",
      ignoreClass: "rec-ignore",
      recordCanvas: false,
      collectFonts: false,
      inlineImages: false,
      slimDOMOptions: "all",
      sampling: { mousemove: 60, mouseInteraction: true, scroll: 150, media: 800, input: "last" },
    }) ?? undefined;
}

function stopRrweb() {
  stopFn?.();
  stopFn = undefined;
}

function onVisibility() {
  if (!running) return;
  if (document.visibilityState === "hidden") {
    hiddenAt = now();
    void flush(true);
    stopRrweb();
    paused = true;
    return;
  }
  paused = false;
  markInteraction();
  // Back after a long absence: a new session, like analytics tools do.
  if (hiddenAt && now() - hiddenAt > IDLE_MS) {
    state = { sid: rand(), seq: 0, view: 0, last: now(), started: now() };
    sentMeta = false;
    entryMeta = { ...meta(), ref: "" };
    viewStart = 0;
    prevViews = [];
    startRrweb();
    startView(location.pathname);
    return;
  }
  startRrweb();
}

function onPageHide() {
  void flush(true);
}

/* ------------------------------------------------------------------ lifecycle */

export async function startRecorder(path: string) {
  if (running || typeof window === "undefined") return;
  if (navigator.webdriver || path.startsWith("/admin")) return;
  running = true;
  try {
    fetchOrig = window.fetch.bind(window);
    patchFetch();
    const [{ record }, { deflateSync }] = await Promise.all([import("@rrweb/record"), import("fflate")]);
    recordFn = record;
    deflate = (d) => deflateSync(d, { level: 6 });
    state = loadState();
    // Read the landing URL now: by the first send the visitor may already be on another page.
    entryMeta = meta();
    currentPath = path;
    markInteraction();
    startRrweb();
    startView(path);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("blur", onBlur);
    document.addEventListener("input", onInputEvt, { capture: true, passive: true });
    document.addEventListener("change", onInputEvt, { capture: true, passive: true });
    document.addEventListener("click", onClick, { capture: true, passive: true });
    document.addEventListener("click", onAutoEvent, { capture: true, passive: true });
    document.addEventListener("focusin", onFocusIn, { capture: true });
    document.addEventListener("focusout", onFocusOut, { capture: true });
    if (matchMedia("(pointer: fine)").matches) document.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("bf:order", onOrder);
    window.addEventListener("bf:track", onTrack);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    timer = setInterval(() => void flush(false), FLUSH_MS);
    tickTimer = setInterval(tick, 1000);
    void watchVitals();
  } catch {
    running = false;
  }
}

function onBlur() {
  lastBlur = now();
}

function onInputEvt() {
  lastInputEvt = now();
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
  stopRrweb();
  clearInterval(timer);
  clearInterval(tickTimer);
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("wheel", onUserScroll);
  window.removeEventListener("touchmove", onUserScroll);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("pointerdown", markInteraction);
  window.removeEventListener("blur", onBlur);
  document.removeEventListener("input", onInputEvt, { capture: true });
  document.removeEventListener("change", onInputEvt, { capture: true });
  document.removeEventListener("click", onClick, { capture: true });
  document.removeEventListener("click", onAutoEvent, { capture: true });
  document.removeEventListener("focusin", onFocusIn, { capture: true });
  document.removeEventListener("focusout", onFocusOut, { capture: true });
  document.removeEventListener("mousemove", onMove);
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
  window.removeEventListener("bf:order", onOrder);
  window.removeEventListener("bf:track", onTrack);
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("pagehide", onPageHide);
  running = false;
}
