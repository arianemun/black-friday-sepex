"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Departure-board strip: flight, destination and a live status that flips once Black Friday starts. */
export function Countdown({ target, className }: { target: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first tick after mount
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const targetMs = new Date(target).getTime();
  const done = now !== null && (Number.isNaN(targetMs) || now >= targetMs);

  return (
    <div className={cn("w-full max-w-xl border border-white/10 bg-black/60 backdrop-blur", className)}>
      {/* board header row */}
      <div className="grid grid-cols-3 text-right text-[11px] sm:text-xs">
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
    </div>
  );
}
