"use client";

import { useEffect, useState } from "react";
import { cn, toFaDigits } from "@/lib/utils";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const pad = (n: number) => toFaDigits(String(n).padStart(2, "0"));

/**
 * Renders nothing until mounted (avoids a hydration mismatch on the seconds), then ticks.
 * Space is reserved by the fixed-height container, so there is no layout shift.
 */
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
  const units = [
    { v: p.d, l: "روز" },
    { v: p.h, l: "ساعت" },
    { v: p.m, l: "دقیقه" },
    { v: p.s, l: "ثانیه" },
  ];

  return (
    <div className={cn("flex h-16 items-center gap-4", className)} aria-live="off">
      {done ? (
        <p className="text-lg font-black text-brand">{doneLabel}</p>
      ) : (
        <>
          <p className="max-w-24 text-sm leading-5 text-white/60">{label}</p>
          <div className="flex items-stretch gap-1.5" dir="ltr" role="timer" aria-label={label}>
            {[...units].reverse().map((u, i) => (
              <div key={u.l} className="flex items-stretch gap-1.5">
                {i > 0 && <span className="self-center pb-4 text-lg font-bold text-white/25">:</span>}
                <div className="flex w-12 flex-col items-center">
                  <span className="flex h-10 w-full items-center justify-center bg-white/[0.07] text-xl font-black tabular-nums text-white">
                    {now === null ? " " : pad(u.v)}
                  </span>
                  <span className="mt-1 text-[11px] text-white/45">{u.l}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
