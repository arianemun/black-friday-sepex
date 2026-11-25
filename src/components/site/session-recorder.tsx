"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Starts the self-hosted recorder once the page is idle; follows client-side navigation. */
export function SessionRecorder({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      void import("@/lib/rec/client").then((m) => m.startRecorder(location.pathname));
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(go, { timeout: 3000 }) : window.setTimeout(go, 1500);
    return () => {
      cancelled = true;
      if (!ric) clearTimeout(id);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void import("@/lib/rec/client").then((m) => m.notePath(pathname));
  }, [enabled, pathname]);

  return null;
}
