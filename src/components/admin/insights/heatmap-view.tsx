"use client";

import "@rrweb/replay/dist/style.css";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toFaDigits } from "@/lib/utils";

type Click = { x: number; y: number; doc_w: number; doc_h: number; rage: number; dead: number };

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

function drawClicks(ctx: CanvasRenderingContext2D, w: number, h: number, clicks: Click[], top: number, th: number) {
  const r = w < 600 ? 22 : 28;
  const pos = (p: Click) => ({ x: (p.x / p.doc_w) * w, y: p.doc_h ? (p.y / p.doc_h) * h : p.y });
  for (const p of clicks) {
    const { x, y } = pos(p);
    if (y < top - r || y > top + th + r) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  colorize(ctx, w, th);
  for (const p of clicks) {
    if (p.rage !== 1 && !p.dead) continue;
    const { x, y } = pos(p);
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.rage === 1 ? "#DC2626" : "#2563EB";
    ctx.stroke();
  }
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
  scroll,
}: {
  backdrop: { sid: string; ts: number } | null;
  mode: "clicks" | "scroll";
  clicks: Click[];
  scroll: number[];
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
        const [{ Replayer }, res] = await Promise.all([import("@rrweb/replay"), fetch(`/admin/insights/events/${backdrop.sid}`)]);
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
    const TILE = 1024;
    for (let top = 0; top < h; top += TILE) {
      const th = Math.min(TILE, h - top);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = th;
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.translate(0, -top);
      if (mode === "clicks") drawClicks(ctx, w, h, clicks, top, th);
      else drawScroll(ctx, w, h, scroll);
      const img = doc.createElement("img");
      img.src = c.toDataURL("image/png");
      img.alt = "";
      img.setAttribute("style", `position:absolute;left:0;top:${top}px;width:${w}px;height:${th}px;display:block;max-width:none`);
      layer.appendChild(img);
    }
    doc.body.appendChild(layer);
    return () => layer.remove();
  }, [state, mode, clicks, scroll]);

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
