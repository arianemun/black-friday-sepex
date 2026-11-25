"use client";

import "@rrweb/replay/dist/style.css";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toFaDigits } from "@/lib/utils";

type Click = { x: number; y: number; doc_w: number; doc_h: number; rage: number; dead: number; el?: string | null; ox?: number | null; oy?: number | null };
type View = { max_scroll: number; attention: string | null };
type Moves = { doc_w: number; doc_h: number; pts: string };
export type HeatMode = "clicks" | "scroll" | "attention" | "moves";
type Pt = { x: number; y: number; w: number };

type ReplayerLike = {
  pause: (t?: number) => void;
  getMetaData: () => { startTime: number };
  iframe: HTMLIFrameElement;
  wrapper: HTMLElement;
  destroy: () => void;
};

/* Shown as the page itself: reveal-on-scroll pieces and entry animations are forced to their end state. */
const SETTLE_CSS = `
.reveal .rv, .reveal:not([data-shown]) .mark-assemble path { opacity: 1 !important; transform: none !important; }
*, *::before, *::after { animation-delay: 0s !important; animation-duration: 0s !important; transition: none !important; }
html { scroll-behavior: auto !important; }
`;

/** Sequential single-hue ramp (orange, light → dark) for click density. */
function colorize(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lerp = (p: number, q: number, k: number) => Math.round(p + (q - p) * k);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a < 0.02) {
      d[i + 3] = 0;
      continue;
    }
    const t = Math.min(1, a * 1.15);
    const [r, g, b] =
      t < 0.5
        ? [lerp(254, 249, t * 2), lerp(215, 115, t * 2), lerp(170, 22, t * 2)]
        : [lerp(249, 154, (t - 0.5) * 2), lerp(115, 52, (t - 0.5) * 2), lerp(22, 18, (t - 0.5) * 2)];
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = Math.round(Math.min(0.88, 0.3 + t * 0.65) * 255);
  }
  ctx.putImageData(img, 0, 0);
}

/** Click/move density: soft black blobs, then recoloured on the ramp; rage and dead clicks ringed on top. */
function drawDensity(ctx: CanvasRenderingContext2D, w: number, pts: Pt[], top: number, th: number, r: number, rings: { x: number; y: number; rage: boolean }[] = []) {
  const max = Math.max(1, ...pts.map((p) => p.w));
  for (const p of pts) {
    if (p.y < top - r || p.y > top + th + r) continue;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.35 * Math.min(1, 0.35 + p.w / max)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  colorize(ctx, w, th);
  for (const p of rings) {
    if (p.y < top - 12 || p.y > top + th + 12) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.rage ? "#DC2626" : "#2563EB";
    ctx.stroke();
  }
}

/** Average seconds each 5% band of the page was on screen; the label sits at the band. */
function drawAttention(ctx: CanvasRenderingContext2D, w: number, h: number, avg: number[]) {
  const max = Math.max(1, ...avg);
  const fs = w < 600 ? 12 : 14;
  ctx.font = `bold ${fs}px Peyda, Tahoma, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  avg.forEach((ms, i) => {
    const y0 = Math.floor((i / avg.length) * h);
    const y1 = Math.ceil(((i + 1) / avg.length) * h);
    const t = ms / max;
    // Cold bands are dimmed; hot ones get a warm wash.
    ctx.fillStyle = `rgba(9,9,11,${(1 - t) * 0.55})`;
    ctx.fillRect(0, y0, w, y1 - y0);
    ctx.fillStyle = `rgba(249,115,22,${t * 0.35})`;
    ctx.fillRect(0, y0, w, y1 - y0);
    const label = ms >= 1000 ? `${toFaDigits((ms / 1000).toFixed(1))} ثانیه` : `${toFaDigits(Math.round(ms / 100) / 10)} ثانیه`;
    const tw = ctx.measureText(label).width + 16;
    ctx.fillStyle = t > 0.66 ? "#9A3412" : "#27272A";
    ctx.fillRect(w - tw - 8, y0 + 6, tw, fs + 10);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, w - 16, y0 + fs + 10);
  });
}

function drawScroll(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number[]) {
  const n = Math.max(1, scroll.length);
  const reach = (pct: number) => scroll.filter((s) => s >= pct).length / n;
  for (let pct = 0; pct < 100; pct += 1) {
    const y0 = Math.floor((pct / 100) * h);
    const y1 = Math.ceil(((pct + 1) / 100) * h);
    ctx.fillStyle = `rgba(9,9,11,${(1 - reach(pct + 1)) * 0.7})`;
    ctx.fillRect(0, y0, w, y1 - y0);
  }
  const fs = w < 600 ? 13 : 15;
  ctx.font = `bold ${fs}px Peyda, Tahoma, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  for (const mark of [75, 50, 25]) {
    let pct = 0;
    for (let p = 100; p >= 0; p--)
      if (reach(p) >= mark / 100) {
        pct = p;
        break;
      }
    const y = Math.max(28, (pct / 100) * h);
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0, y - 1, w, 2);
    const label = `${toFaDigits(mark)}٪ بازدیدکننده‌ها تا اینجا آمدند`;
    const tw = ctx.measureText(label).width + 20;
    ctx.fillRect(w - tw - 8, y - fs - 14, tw, fs + 12);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, w - 18, y - 9);
  }
}

/**
 * The page rebuilt from a visitor's recording, at that visitor's real screen size and scrollable,
 * with the heat layer drawn inside the page so it lines up exactly with what was clicked.
 */
export function HeatmapView({
  backdrop,
  mode,
  clicks,
  views,
  moves,
  onAligned,
}: {
  backdrop: { sid: string; ts: number } | null;
  mode: HeatMode;
  clicks: Click[];
  views: View[];
  moves: Moves[];
  onAligned?: (share: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const docRef = useRef<Document | null>(null);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error" | "none">(backdrop ? "loading" : "none");

  // 1. Rebuild the page just after it loaded in that recording.
  useEffect(() => {
    if (!backdrop) return;
    let cancelled = false;
    let rep: ReplayerLike | null = null;
    (async () => {
      try {
        const [{ Replayer }, res] = await Promise.all([import("@rrweb/replay"), fetch(`/admin/insights/events/${backdrop.sid}`, { cache: "no-store" })]);
        if (!res.ok) throw new Error(String(res.status));
        const events = await res.json();
        if (cancelled || !stage.current) return;
        rep = new Replayer(events, { root: stage.current, showWarning: false, mouseTail: false, triggerFocus: false }) as unknown as ReplayerLike;
        rep.pause(Math.max(0, backdrop.ts - rep.getMetaData().startTime + 2500));
        await new Promise((r) => setTimeout(r, 300));
        const frame = rep.iframe;
        const doc = frame.contentDocument;
        if (!doc) throw new Error("no document");
        // Let the admin scroll the page; the player normally blocks all interaction.
        frame.removeAttribute("scrolling");
        frame.style.pointerEvents = "auto";
        rep.wrapper.querySelector<HTMLElement>(".replayer-mouse")?.style.setProperty("display", "none");
        const style = doc.createElement("style");
        style.textContent = SETTLE_CSS;
        doc.head?.appendChild(style);
        doc.documentElement.scrollTop = 0;
        docRef.current = doc;
        if (cancelled) return;
        setView({ w: Number(frame.width) || frame.clientWidth, h: Number(frame.height) || frame.clientHeight });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current = null;
      rep?.destroy();
    };
  }, [backdrop]);

  // 2. Fit the recorded screen into the panel.
  useEffect(() => {
    if (!view) return;
    const fit = () => {
      const el = box.current;
      if (!el) return;
      const maxH = Math.max(420, window.innerHeight - 260);
      setScale(Math.min(1, el.clientWidth / view.w, maxH / view.h));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [view]);

  // 3. Draw the layer inside the page, over the full document, in tiles (one huge canvas
  //    exceeds browser limits and silently doesn't paint).
  useEffect(() => {
    const doc = docRef.current;
    if (state !== "ready" || !doc?.body) return;
    doc.getElementById("bf-heat")?.remove();
    const w = doc.documentElement.scrollWidth;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    const layer = doc.createElement("div");
    layer.id = "bf-heat";
    layer.setAttribute("style", `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:2147483647`);
    // The replayed page has scripting disabled, and such documents don't paint <canvas>;
    // so each tile is drawn here and placed in the page as an image.
    const pts: Pt[] = [];
    const rings: { x: number; y: number; rage: boolean }[] = [];
    if (mode === "clicks") {
      // Pin each click to the element it hit (same element on this page version), at the same
      // relative spot inside it; fall back to the page-relative position.
      const rects = new Map<string, DOMRect | null>();
      const sx = doc.documentElement.scrollLeft;
      const sy = doc.documentElement.scrollTop;
      let aligned = 0;
      for (const c of clicks) {
        let x = (c.x / c.doc_w) * w;
        let y = c.doc_h ? (c.y / c.doc_h) * h : c.y;
        if (c.el && c.ox != null && c.oy != null) {
          if (!rects.has(c.el)) {
            let el: Element | null = null;
            try {
              el = doc.body.querySelector(`:scope>${c.el}`);
            } catch {}
            const r = el?.getBoundingClientRect();
            rects.set(c.el, r && r.width > 0 && r.height > 0 ? r : null);
          }
          const r = rects.get(c.el);
          if (r) {
            x = r.left + sx + (c.ox / 1000) * r.width;
            y = r.top + sy + (c.oy / 1000) * r.height;
            aligned++;
          }
        }
        pts.push({ x, y, w: 1 });
        if (c.rage === 1 || c.dead) rings.push({ x, y, rage: c.rage === 1 });
      }
      onAligned?.(clicks.length ? aligned / clicks.length : 1);
    } else if (mode === "moves") {
      for (const m of moves) {
        let a: number[] = [];
        try {
          a = JSON.parse(m.pts);
        } catch {}
        for (let i = 0; i + 2 < a.length; i += 3) pts.push({ x: (a[i] / m.doc_w) * w, y: (a[i + 1] / m.doc_h) * h, w: a[i + 2] });
      }
    }
    const avg: number[] = new Array(20).fill(0);
    if (mode === "attention") {
      let n = 0;
      for (const v of views) {
        try {
          const a = JSON.parse(v.attention ?? "null") as number[] | null;
          if (!Array.isArray(a) || a.length !== 20) continue;
          a.forEach((ms, i) => (avg[i] += Number(ms) || 0));
          n++;
        } catch {}
      }
      if (n) for (let i = 0; i < 20; i++) avg[i] /= n;
    }
    const scroll = views.map((v) => v.max_scroll);
    // The replayed page has scripting disabled, and such documents don't paint <canvas>;
    // so each tile is drawn here and placed in the page as an image.
    const TILE = 1024;
    for (let top = 0; top < h; top += TILE) {
      const th = Math.min(TILE, h - top);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = th;
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.translate(0, -top);
      if (mode === "clicks") drawDensity(ctx, w, pts, top, th, w < 600 ? 22 : 28, rings);
      else if (mode === "moves") drawDensity(ctx, w, pts, top, th, 20);
      else if (mode === "attention") drawAttention(ctx, w, h, avg);
      else drawScroll(ctx, w, h, scroll);
      const img = doc.createElement("img");
      img.src = c.toDataURL("image/png");
      img.alt = "";
      img.setAttribute("style", `position:absolute;left:0;top:${top}px;width:${w}px;height:${th}px;display:block;max-width:none`);
      layer.appendChild(img);
    }
    doc.body.appendChild(layer);
    return () => layer.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, clicks, views, moves]);

  if (state === "none") {
    return <p className="rounded-xl border border-[#E4E4E7] bg-white py-16 text-center text-sm text-[#71717A]">برای این صفحه و دستگاه هنوز ضبطی نیست.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={box} className="relative overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#F4F4F5]" style={{ height: view ? view.h * scale + 2 : 480 }}>
        <div
          ref={stage}
          dir="ltr"
          className="absolute left-1/2 top-0 origin-top"
          style={{ width: view?.w, height: view?.h, transform: `translateX(-50%) scale(${scale})` }}
        />
        {state !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-[#F4F4F5] text-sm text-[#71717A]">
            {state === "loading" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> در حال ساختن صفحه…
              </span>
            ) : (
              "نمایش این صفحه ممکن نشد."
            )}
          </div>
        )}
      </div>
      {state === "ready" && <p className="text-center text-[11px] text-[#71717A]">داخل صفحه اسکرول کنید تا بقیه‌ی نقشه را ببینید.</p>}
    </div>
  );
}
