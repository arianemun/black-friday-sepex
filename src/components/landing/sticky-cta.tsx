"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Mobile-only bottom bar, shown once the hero's own input has scrolled away. */
export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 px-4 pt-3 backdrop-blur transition-transform duration-300 md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!show}
    >
      <div className="flex gap-2">
        <Link href="/order" tabIndex={show ? 0 : -1} className="flex h-12 flex-1 items-center justify-center bg-brand font-bold text-ink">
          ثبت سفارش
        </Link>
        <Link href="/track" tabIndex={show ? 0 : -1} className="flex h-12 items-center justify-center border border-white/20 px-4 text-sm font-semibold text-white">
          پیگیری
        </Link>
      </div>
    </div>
  );
}
