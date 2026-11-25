"use client";

import "@rrweb/replay/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { FastForward, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { cn, toFaDigits } from "@/lib/utils";

export type Marker = { ts: number; kind: "page" | "rage" | "dead" | "error" | "order"; label: string };

type ReplayerLike = {
  play: (t?: number) => void;
  pause: (t?: number) => void;
  getCurrentTime: () => number;
  getMetaData: () => { startTime: number; endTime: number; totalTime: number };
  setConfig: (c: Record<string, unknown>) => void;
  on: (e: string, cb: (p?: unknown) => void) => void;
  destroy: () => void;
  wrapper: HTMLElement;
};

const SPEEDS = [1, 2, 4, 8];
const MARK_COLOR: Record<Marker["kind"], string> = {
  page: "bg-[#2563EB]",
  rage: "bg-[#DC2626]",
  dead: "bg-[#D97706]",
  error: "bg-[#7C3AED]",
  order: "bg-[#16A34A]",
};
export const MARK_LABEL: Record<Marker["kind"], string> = {
  page: "صفحه",
  rage: "کلیک عصبی",
  dead: "کلیک بی‌اثر",
  error: "خطا",
  order: "ثبت سفارش",
};

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return toFaDigits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
};

/** rrweb replay with our own RTL controls, event markers on the timeline and a clickable event list. */
export function SessionPlayer({ sid, markers }: { sid: string; markers: Marker[] }) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rep = useRef<ReplayerLike | null>(null);
  // Kept in a ref for the resize callbacks and mirrored to state for rendering.
  const size = useRef({ w: 1280, h: 720 });
  const [dims, setDims] = useState({ w: 1280, h: 720 });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [meta, setMeta] = useState({ startTime: 0, totalTime: 0 });
  const [speed, setSpeed] = useState(1);
  const [skip, setSkip] = useState(true);
  const [scale, setScale] = useState(1);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const maxH = Math.min(window.innerHeight * 0.7, 760);
    setDims({ ...size.current });
    setScale(Math.min(el.clientWidth / size.current.w, maxH / size.current.h, 1.5));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    (async () => {
      try {
        const [{ Replayer }, res] = await Promise.all([import("@rrweb/replay"), fetch(`/admin/insights/events/${sid}`)]);
        if (!res.ok) throw new Error(String(res.status));
        const events = (await res.json()) as { type: number; data: { width?: number; height?: number }; timestamp: number }[];
        if (cancelled || !stage.current) return;
        const m = events.find((e) => e.type === 4 && e.data.width);
        if (m) size.current = { w: m.data.width!, h: m.data.height! };
        const r = new Replayer(events as never, {
          root: stage.current,
          skipInactive: true,
          showWarning: false,
          mouseTail: { strokeStyle: "rgba(37,99,235,.5)", lineWidth: 3, duration: 600 },
          triggerFocus: false,
          UNSAFE_replayCanvas: false,
        }) as unknown as ReplayerLike;
        rep.current = r;
        r.on("resize", (p) => {
          const d = p as { width: number; height: number };
          size.current = { w: d.width, h: d.height };
          fit();
        });
        r.on("finish", () => setPlaying(false));
        const md = r.getMetaData();
        setMeta({ startTime: md.startTime, totalTime: md.totalTime });
        fit();
        r.pause(0);
        setState("ready");
        const tick = () => {
          if (rep.current) setTime(Math.min(rep.current.getCurrentTime(), md.totalTime));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      rep.current?.destroy();
      rep.current = null;
    };
  }, [sid, fit]);

  const toggle = () => {
    const r = rep.current;
    if (!r) return;
    if (playing) {
      r.pause();
      setPlaying(false);
    } else {
      const t = time >= meta.totalTime - 50 ? 0 : time;
      r.play(t);
      setPlaying(true);
    }
  };

  const seek = (t: number) => {
    const r = rep.current;
    if (!r) return;
    const at = Math.max(0, Math.min(meta.totalTime, t));
    if (playing) r.play(at);
    else r.pause(at);
    setTime(at);
  };

  const setSpd = (s: number) => {
    setSpeed(s);
    rep.current?.setConfig({ speed: s });
  };
  const setSkp = (v: boolean) => {
    setSkip(v);
    rep.current?.setConfig({ skipInactive: v });
  };

  const rel = (ts: number) => ts - meta.startTime;
  const total = Math.max(1, meta.totalTime);

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="relative w-full overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#F4F4F5]" style={{ height: dims.h * scale + 2 }}>
        <div
          ref={stage}
          dir="ltr"
          className="bf-replay absolute left-1/2 top-0 origin-top"
          style={{ width: dims.w, height: dims.h, transform: `translateX(-50%) scale(${scale})` }}
        />
        {state !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-[#F4F4F5] text-sm text-[#71717A]">
            {state === "loading" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> در حال بارگذاری ضبط…
              </span>
            ) : (
              "ضبط این جلسه در دسترس نیست."
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5">
        <div className="relative h-6" dir="ltr">
          <input
            type="range"
            min={0}
            max={total}
            step={100}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="زمان پخش"
            className="absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 cursor-pointer accent-[#18181B]"
            disabled={state !== "ready"}
          />
          {markers.map((m, i) => (
            <button
              key={i}
              type="button"
              title={`${MARK_LABEL[m.kind]}: ${m.label}`}
              aria-label={`${MARK_LABEL[m.kind]}: ${m.label}`}
              onClick={() => seek(rel(m.ts) - 1000)}
              className={cn("absolute top-0 h-2 w-1 -translate-x-1/2 rounded-full", MARK_COLOR[m.kind])}
              style={{ left: `${Math.max(0, Math.min(100, (rel(m.ts) / total) * 100))}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              disabled={state !== "ready"}
              aria-label={playing ? "توقف" : "پخش"}
              className="grid size-9 place-items-center rounded-lg bg-[#18181B] text-white transition-colors hover:bg-[#3F3F46] disabled:opacity-40"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => seek(0)}
              disabled={state !== "ready"}
              aria-label="از اول"
              className="grid size-9 place-items-center rounded-lg text-[#52525B] hover:bg-[#F4F4F5] disabled:opacity-40"
            >
              <RotateCcw className="size-4" />
            </button>
            <span className="text-[13px] tabular-nums text-[#3F3F46]">
              <bdi dir="ltr">
                {clock(time)} / {clock(meta.totalTime)}
              </bdi>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#52525B]">
              <input type="checkbox" checked={skip} onChange={(e) => setSkp(e.target.checked)} className="accent-[#18181B]" />
              <FastForward className="size-3.5" aria-hidden />
              رد شدن از بی‌کاری
            </label>
            <div role="group" aria-label="سرعت پخش" className="flex rounded-lg bg-[#F4F4F5] p-[3px]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpd(s)}
                  aria-pressed={speed === s}
                  className={cn("h-7 rounded-md px-2 text-[12px]", speed === s ? "bg-white font-bold text-[#18181B] shadow-sm" : "text-[#52525B]")}
                >
                  {toFaDigits(s)}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {markers.length > 0 && (
        <ol className="flex flex-col divide-y divide-[#F4F4F5] rounded-xl border border-[#E4E4E7] bg-white">
          {markers.map((m, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  seek(rel(m.ts) - 1000);
                  if (!playing) toggle();
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-right hover:bg-[#FAFAFA]"
              >
                <span className={cn("size-2 shrink-0 rounded-full", MARK_COLOR[m.kind])} aria-hidden />
                <span className="w-12 shrink-0 text-[12px] tabular-nums text-[#71717A]">
                  <bdi dir="ltr">{clock(rel(m.ts))}</bdi>
                </span>
                <span className="text-[12px] font-semibold text-[#3F3F46]">{MARK_LABEL[m.kind]}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#71717A]">{m.label}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
