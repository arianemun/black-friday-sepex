"use client";

import "@rrweb/replay/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { FastForward, Loader2, Pause, Play, Radio, RotateCcw } from "lucide-react";
import { cn, toFaDigits } from "@/lib/utils";

export type MarkerKind = "page" | "rage" | "dead" | "error" | "order" | "event" | "net" | "quickback";
export type Marker = { ts: number; kind: MarkerKind; label: string };

type RrEvent = { type: number; data: { width?: number; height?: number }; timestamp: number };
type ReplayerLike = {
  play: (t?: number) => void;
  pause: (t?: number) => void;
  getCurrentTime: () => number;
  getMetaData: () => { startTime: number; endTime: number; totalTime: number };
  setConfig: (c: Record<string, unknown>) => void;
  on: (e: string, cb: (p?: unknown) => void) => void;
  startLive: (baseline?: number) => void;
  addEvent: (e: RrEvent) => void;
  /** rrweb's playback clock (ms since the live baseline). */
  timer?: { timeOffset: number };
  destroy: () => void;
};

const SPEEDS = [1, 2, 4, 8];
const POLL_MS = 3000;
/** No heartbeat for this long: the visitor closed the tab or lost connection. */
const GONE_MS = 60_000;

const MARK_COLOR: Record<MarkerKind, string> = {
  page: "bg-[#2563EB]",
  rage: "bg-[#DC2626]",
  dead: "bg-[#D97706]",
  error: "bg-[#7C3AED]",
  order: "bg-[#16A34A]",
  event: "bg-[#0891B2]",
  net: "bg-[#BE185D]",
  quickback: "bg-[#A16207]",
};
export const MARK_LABEL: Record<MarkerKind, string> = {
  page: "صفحه",
  rage: "کلیک عصبی",
  dead: "کلیک بی‌اثر",
  error: "خطا",
  order: "ثبت سفارش",
  event: "رویداد",
  net: "درخواست ناموفق",
  quickback: "برگشت سریع",
};

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return toFaDigits(`${h ? `${h}:` : ""}${mm}:${String(s % 60).padStart(2, "0")}`);
};
const ago = (ms: number) => (ms < 60_000 ? `${toFaDigits(Math.max(0, Math.round(ms / 1000)))} ثانیه پیش` : `${toFaDigits(Math.round(ms / 60_000))} دقیقه پیش`);

/**
 * rrweb replay with RTL controls and event markers.
 * `live`: follows a session that is still running, pulling new chunks every few seconds.
 */
export function SessionPlayer({ sid, markers, live: liveInitially = false }: { sid: string; markers: Marker[]; live?: boolean }) {
  const [live, setLive] = useState(liveInitially);
  return live ? <LivePlayer key="live" sid={sid} onStop={() => setLive(false)} /> : <RecordedPlayer key="rec" sid={sid} markers={markers} />;
}

/* ------------------------------------------------------------------ shared stage */

function useStage() {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 1280, h: 720 });
  const [dims, setDims] = useState({ w: 1280, h: 720 });
  const [scale, setScale] = useState(1);
  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const maxH = Math.min(window.innerHeight * 0.7, 760);
    setDims({ ...size.current });
    setScale(Math.min(el.clientWidth / size.current.w, maxH / size.current.h, 1.5));
  }, []);
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);
  const watch = (r: ReplayerLike, events: RrEvent[]) => {
    const m = events.find((e) => e.type === 4 && e.data.width);
    if (m) size.current = { w: m.data.width!, h: m.data.height! };
    r.on("resize", (p) => {
      const d = p as { width: number; height: number };
      size.current = { w: d.width, h: d.height };
      fit();
    });
    fit();
  };
  return { box, stage, dims, scale, watch };
}

function Stage({
  boxRef,
  stageRef,
  dims,
  scale,
  state,
  children,
}: {
  boxRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  dims: { w: number; h: number };
  scale: number;
  state: "loading" | "ready" | "error";
  children?: React.ReactNode;
}) {
  return (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#F4F4F5]" style={{ height: dims.h * scale + 2 }}>
      <div
        ref={stageRef}
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
      {children}
    </div>
  );
}

const replayOptions = (root: HTMLElement, extra: Record<string, unknown> = {}) => ({
  root,
  showWarning: false,
  mouseTail: { strokeStyle: "rgba(37,99,235,.5)", lineWidth: 3, duration: 600 },
  triggerFocus: false,
  UNSAFE_replayCanvas: false,
  ...extra,
});

/* ------------------------------------------------------------------ recorded */

function RecordedPlayer({ sid, markers }: { sid: string; markers: Marker[] }) {
  const { box, stage, dims, scale, watch } = useStage();
  const rep = useRef<ReplayerLike | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [meta, setMeta] = useState({ startTime: 0, totalTime: 0 });
  const [speed, setSpeed] = useState(1);
  const [skip, setSkip] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    (async () => {
      try {
        const [{ Replayer }, res] = await Promise.all([import("@rrweb/replay"), fetch(`/admin/insights/events/${sid}`, { cache: "no-store" })]);
        if (!res.ok) throw new Error(String(res.status));
        const events = (await res.json()) as RrEvent[];
        if (cancelled || !stage.current) return;
        if (events.length < 2) throw new Error("too short");
        const r = new Replayer(events as never, replayOptions(stage.current, { skipInactive: true })) as unknown as ReplayerLike;
        rep.current = r;
        watch(r, events);
        r.on("finish", () => setPlaying(false));
        const md = r.getMetaData();
        setMeta({ startTime: md.startTime, totalTime: md.totalTime });
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
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      rep.current?.destroy();
      rep.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const toggle = () => {
    const r = rep.current;
    if (!r) return;
    if (playing) {
      r.pause();
      setPlaying(false);
    } else {
      r.play(time >= meta.totalTime - 50 ? 0 : time);
      setPlaying(true);
    }
  };
  const seek = (t: number, andPlay = playing) => {
    const r = rep.current;
    if (!r) return;
    const at = Math.max(0, Math.min(meta.totalTime, t));
    if (andPlay) r.play(at);
    else r.pause(at);
    setPlaying(andPlay);
    setTime(at);
  };
  const rel = (ts: number) => ts - meta.startTime;
  const total = Math.max(1, meta.totalTime);

  return (
    <div className="flex flex-col gap-3">
      <Stage boxRef={box} stageRef={stage} dims={dims} scale={scale} state={state} />
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
          {state === "ready" &&
            markers.map((m, i) => (
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
              <input
                type="checkbox"
                checked={skip}
                onChange={(e) => {
                  setSkip(e.target.checked);
                  rep.current?.setConfig({ skipInactive: e.target.checked });
                }}
                className="accent-[#18181B]"
              />
              <FastForward className="size-3.5" aria-hidden />
              رد شدن از بی‌کاری
            </label>
            <div role="group" aria-label="سرعت پخش" className="flex rounded-lg bg-[#F4F4F5] p-[3px]">
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    setSpeed(sp);
                    rep.current?.setConfig({ speed: sp });
                  }}
                  aria-pressed={speed === sp}
                  className={cn("h-7 rounded-md px-2 text-[12px]", speed === sp ? "bg-white font-bold text-[#18181B] shadow-sm" : "text-[#52525B]")}
                >
                  {toFaDigits(sp)}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {markers.length > 0 && (
        <ol className="flex max-h-[420px] flex-col divide-y divide-[#F4F4F5] overflow-y-auto rounded-xl border border-[#E4E4E7] bg-white">
          {markers.map((m, i) => (
            <li key={i}>
              <button
                type="button"
                disabled={state !== "ready"}
                onClick={() => seek(rel(m.ts) - 1000, true)}
                className="flex w-full items-center gap-3 px-3 py-2 text-right hover:bg-[#FAFAFA] disabled:cursor-default"
              >
                <span className={cn("size-2 shrink-0 rounded-full", MARK_COLOR[m.kind])} aria-hidden />
                <span className="w-14 shrink-0 text-[12px] tabular-nums text-[#71717A]">
                  <bdi dir="ltr">{meta.startTime ? clock(rel(m.ts)) : "–"}</bdi>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-[#3F3F46]">{MARK_LABEL[m.kind]}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#71717A]">{m.label}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ live */

function LivePlayer({ sid, onStop }: { sid: string; onStop: () => void }) {
  const { box, stage, dims, scale, watch } = useStage();
  const rep = useRef<ReplayerLike | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState<{ lastAt: number; lastEvent: number; count: number }>({ lastAt: 0, lastEvent: 0, count: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSeq = -1;
    (async () => {
      try {
        const [{ Replayer }, res] = await Promise.all([import("@rrweb/replay"), fetch(`/admin/insights/events/${sid}`, { cache: "no-store" })]);
        if (!res.ok) throw new Error(String(res.status));
        const events = (await res.json()) as RrEvent[];
        lastSeq = Number(res.headers.get("X-Last-Seq") ?? -1);
        const lastAt = Date.parse(res.headers.get("X-Last-At") ?? "") || 0;
        if (cancelled || !stage.current || !events.length) throw new Error("empty");
        // Live mode: what we already have is applied at once; newer events play as they arrive.
        // useVirtualDom off: in live mode rrweb applies past events instantly, and with the virtual
        // DOM those changes would wait for a flush that only play() performs — the page would
        // freeze at its first snapshot.
        const r = new Replayer([], replayOptions(stage.current, { liveMode: true, useVirtualDom: false })) as unknown as ReplayerLike;
        rep.current = r;
        watch(r, events);
        const latest = events[events.length - 1].timestamp;
        r.startLive(latest);
        for (const e of events) r.addEvent(e);
        setStatus({ lastAt, lastEvent: latest, count: events.length });
        setState("ready");

        const poll = async () => {
          if (cancelled) return;
          try {
            const p = await fetch(`/admin/insights/events/${sid}?after=${lastSeq}`, { cache: "no-store" });
            if (p.ok) {
              const d = (await p.json()) as { events: RrEvent[]; lastSeq: number; lastAt: string | null };
              lastSeq = Math.max(lastSeq, d.lastSeq);
              for (const e of d.events) rep.current?.addEvent(e);
              // Live playback runs at real pace from when this page opened; if the visitor was idle
              // before that, new activity would play late by that much. Jump to just before it.
              const t = rep.current?.timer;
              if (t && d.events.length) {
                const due = Math.min(...d.events.map((e) => e.timestamp)) - latest;
                if (due - t.timeOffset > 1500) t.timeOffset = due - 500;
              }
              setStatus((st) => ({
                lastAt: Date.parse(d.lastAt ?? "") || st.lastAt,
                lastEvent: d.events.length ? d.events[d.events.length - 1].timestamp : st.lastEvent,
                count: st.count + d.events.length,
              }));
            }
          } catch {
            /* next poll */
          }
          timer = setTimeout(poll, POLL_MS);
        };
        timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(clockTimer);
      rep.current?.destroy();
      rep.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const gone = state === "ready" && now - status.lastAt > GONE_MS;
  const idle = !gone && status.lastEvent > 0 && now - status.lastAt < GONE_MS && now - status.lastEvent > 20_000;

  return (
    <div className="flex flex-col gap-3">
      <Stage boxRef={box} stageRef={stage} dims={dims} scale={scale} state={state}>
        {gone && (
          <div className="absolute inset-x-0 bottom-0 bg-[#18181B]/80 px-3 py-2 text-center text-[13px] text-white">بازدیدکننده سایت را ترک کرده است.</div>
        )}
      </Stage>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 text-[13px]">
          {gone ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F4F4F5] px-2 py-1 font-semibold text-[#52525B]">پایان جلسه</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#DCFCE7] px-2 py-1 font-semibold text-[#15803D]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#22C55E] opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-[#16A34A]" />
              </span>
              زنده
            </span>
          )}
          {state === "ready" && (
            <span className="text-[12px] text-[#71717A]">
              {idle ? "بازدیدکننده الان کاری نمی‌کند یا تب دیگری را باز کرده" : `آخرین فعالیت ${ago(now - (status.lastAt || now))}`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E4E4E7] px-2.5 text-[12px] font-semibold text-[#3F3F46] hover:bg-[#F4F4F5]"
        >
          <Radio className="size-3.5" aria-hidden />
          پخش از اول با خط زمان
        </button>
      </div>
    </div>
  );
}
