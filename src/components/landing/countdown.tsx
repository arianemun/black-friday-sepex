"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Airport departure board: "flight" Black Friday, with split-flap digits that flip on change.
 * Renders placeholders until mounted (no hydration mismatch); space is reserved so nothing shifts.
 */

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function Half({ char, half }: { char: string; half: "top" | "bottom" }) {
  return (
    <span className={cn("absolute inset-x-0 h-1/2 overflow-hidden bg-[#161616]", half === "top" ? "top-0 rounded-t-[3px]" : "bottom-0 rounded-b-[3px]")}>
      <span className={cn("absolute inset-x-0 flex h-[200%] items-center justify-center", half === "bottom" && "-top-full")}>{char}</span>
    </span>
  );
}

function FlipChar({ char }: { char: string }) {
  const [shown, setShown] = useState(char);
  const [prev, setPrev] = useState(char);
  const [flip, setFlip] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (char === shown) return;
    /* eslint-disable react-hooks/set-state-in-effect -- drive the flip from the incoming value */
    setPrev(shown);
    setShown(char);
    setFlip((f) => f + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [char, shown]);

  return (
    <span className="flip-char relative inline-block h-12 w-8 text-[1.7rem] font-black tabular-nums text-brand sm:h-16 sm:w-11 sm:text-[2.4rem]" aria-hidden>
      <Half char={shown} half="top" />
      <Half char={flip ? prev : shown} half="bottom" />
      {flip > 0 && (
        <span key={flip}>
          <span className="flip-top absolute inset-0 origin-center">
            <Half char={prev} half="top" />
          </span>
          <span className="flip-bottom absolute inset-0 origin-center">
            <Half char={shown} half="bottom" />
          </span>
        </span>
      )}
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-px bg-black/80" />
    </span>
  );
}

function FlipGroup({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-0.5 sm:gap-1" dir="ltr">
        {value.split("").map((c, i) => (
          <FlipChar key={i} char={c} />
        ))}
      </div>
      <span className="text-[11px] text-white/45 sm:text-xs">{label}</span>
    </div>
  );
}

export function Countdown({ target, label, doneLabel, className }: { target: string; label: string; doneLabel: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first tick after mount
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const targetMs = new Date(target).getTime();
  const done = now !== null && (Number.isNaN(targetMs) || now >= targetMs);
  const p = parts(now === null ? 0 : targetMs - now);
  // Latin digits on purpose: a split-flap cuts the Persian zero (a dot) in half.
  const two = (n: number) => (now === null ? "--" : String(Math.min(n, 99)).padStart(2, "0"));
  const sep = <span className="pb-6 text-2xl font-black text-brand/40 sm:text-3xl" aria-hidden>:</span>;

  return (
    <div className={cn("w-full max-w-xl border border-white/10 bg-black/60 backdrop-blur", className)}>
      {/* board header row */}
      <div className="grid grid-cols-3 border-b border-white/10 text-right text-[11px] sm:text-xs">
        <div className="border-l border-white/10 px-3 py-2">
          <span className="block text-white/40">پرواز</span>
          <span dir="ltr" className="block text-right font-black tracking-wider text-white">SPX-BF</span>
        </div>
        <div className="border-l border-white/10 px-3 py-2">
          <span className="block text-white/40">مقصد</span>
          <span className="block font-black text-white">بلک‌فرایدی</span>
        </div>
        <div className="px-3 py-2">
          <span className="block text-white/40">وضعیت</span>
          <span className="flex items-center gap-1.5 font-black text-brand">
            <span className="board-blink size-1.5 bg-brand" aria-hidden />
            {done ? "در حال اجرا" : "آماده‌ی پرواز"}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 px-3 py-4 sm:py-5">
        <p className="text-sm font-semibold text-white/70">{done ? doneLabel : label}</p>
        {!done && (
          <div className="flex items-start gap-1.5 sm:gap-3" dir="rtl" role="timer" aria-label={`${label}: ${p.d} روز، ${p.h} ساعت، ${p.m} دقیقه`}>
            <FlipGroup value={two(p.d)} label="روز" />
            {sep}
            <FlipGroup value={two(p.h)} label="ساعت" />
            {sep}
            <FlipGroup value={two(p.m)} label="دقیقه" />
            {sep}
            <FlipGroup value={two(p.s)} label="ثانیه" />
          </div>
        )}
      </div>
    </div>
  );
}
