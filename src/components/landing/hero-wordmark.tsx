"use client";

import { useEffect, useRef } from "react";

/**
 * BLACK FRIDAY lit like a sign: a soft highlight sweeps across the letters once on load,
 * then follows the cursor over the hero, as if someone is holding a lamp to the type.
 * Only the light moves; the letters themselves stay put.
 */
export function HeroWordmark() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    const stage = el.closest("section") ?? document.body;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--lx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        el.style.setProperty("--ly", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      });
    };
    const onLeave = () => {
      el.style.removeProperty("--lx");
      el.style.removeProperty("--ly");
    };
    stage.addEventListener("pointermove", onMove as EventListener);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointermove", onMove as EventListener);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return (
    <p ref={ref} dir="ltr" className="hero-wordmark wordmark-lit font-black" aria-hidden>
      BLACK
      <br />
      FRIDAY
    </p>
  );
}
