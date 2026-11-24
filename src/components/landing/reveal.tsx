"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades its content in once, when it first scrolls into view. Without JS or with reduced
 * motion the content is simply visible (the hidden state only exists inside the motion query).
 */
export function Reveal({ children, className, as: As = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "section" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.dataset.shown = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.dataset.shown = "";
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <As ref={ref} className={cn("reveal", className)}>
      {children}
    </As>
  );
}
