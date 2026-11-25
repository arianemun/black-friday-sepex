"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle, Video } from "lucide-react";
import { cn, toFaDigits } from "@/lib/utils";
import { trainingProgressAction } from "@/app/admin/actions";

export type TrainingItem = { slug: string; title: string; description: string; src: string; poster: string | null };

const POS_KEY = (slug: string) => `bf-training:${slug}`;

/** One player plus a list; picks up where each video was left off on this device. */
export function TrainingPlayer({ videos }: { videos: TrainingItem[] }) {
  const [current, setCurrent] = useState(videos[0]?.slug ?? null);
  const ref = useRef<HTMLVideoElement>(null);
  const video = videos.find((v) => v.slug === current) ?? null;

  // Restore the saved position once metadata is known; save it while watching.
  useEffect(() => {
    const el = ref.current;
    if (!el || !video) return;
    const restore = () => {
      try {
        const t = Number(localStorage.getItem(POS_KEY(video.slug)));
        if (t > 5 && t < el.duration - 5) el.currentTime = t;
      } catch {}
    };
    let last = 0;
    const save = () => {
      if (Math.abs(el.currentTime - last) < 3) return;
      last = el.currentTime;
      try {
        localStorage.setItem(POS_KEY(video.slug), String(Math.floor(el.currentTime)));
      } catch {}
    };
    const done = () => {
      try {
        localStorage.removeItem(POS_KEY(video.slug));
      } catch {}
    };
    // Watch log: a play is counted once per selection; progress goes out every 15s and on pause/end/leave.
    let counted = false;
    let lastSent = 0;
    const report = (started = false) => {
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      lastSent = Date.now();
      void trainingProgressAction(video.slug, el.currentTime, d, started).catch(() => {});
    };
    const onPlay = () => {
      if (!counted) {
        counted = true;
        report(true);
      }
    };
    const onTick = () => {
      if (!el.paused && Date.now() - lastSent > 15_000) report();
    };
    const onStop = () => counted && report();
    const onHide = () => document.visibilityState === "hidden" && onStop();
    el.addEventListener("loadedmetadata", restore);
    el.addEventListener("timeupdate", save);
    el.addEventListener("timeupdate", onTick);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onStop);
    el.addEventListener("ended", onStop);
    el.addEventListener("ended", done);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      onStop();
      el.removeEventListener("loadedmetadata", restore);
      el.removeEventListener("timeupdate", save);
      el.removeEventListener("timeupdate", onTick);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("ended", onStop);
      el.removeEventListener("ended", done);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [video]);

  if (!videos.length || !video) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D4D4D8] bg-white px-6 py-14 text-center">
        <Video className="size-6 text-[#A1A1AA]" aria-hidden />
        <p className="text-sm font-semibold text-[#3F3F46]">هنوز ویدیویی اضافه نشده است.</p>
      </div>
    );
  }

  const pick = (slug: string) => {
    setCurrent(slug);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
        <div className="aspect-video bg-black">
          <video
            key={video.slug}
            ref={ref}
            className="size-full"
            controls
            playsInline
            preload="metadata"
            poster={video.poster ?? undefined}
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
          >
            <source src={video.src} type="video/mp4" />
            مرورگر شما پخش ویدیو را پشتیبانی نمی‌کند.
          </video>
        </div>
        <div className="px-4 py-3.5">
          <h2 className="text-[15px] font-extrabold text-[#18181B]">{video.title}</h2>
          {video.description && <p className="mt-1 text-[13px] leading-6 text-[#52525B]">{video.description}</p>}
        </div>
      </section>

      <nav aria-label="فهرست ویدیوها" className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
        <div className="border-b border-[#F4F4F5] px-4 py-3 text-xs font-semibold text-[#71717A]">{toFaDigits(videos.length)} ویدیو</div>
        <ul>
          {videos.map((v) => {
            const active = v.slug === video.slug;
            return (
              <li key={v.slug} className="border-b border-[#F4F4F5] last:border-b-0">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => pick(v.slug)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-right outline-none transition-colors focus-visible:bg-[#F4F4F5]",
                    active ? "bg-[#F4F4F5]" : "hover:bg-[#FAFAFA]",
                  )}
                >
                  <span className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-[#18181B]">
                    {v.poster && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.poster} alt="" className="absolute inset-0 size-full object-cover opacity-80" loading="lazy" />
                    )}
                    <PlayCircle className="relative size-6 text-white" strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[13px] leading-5", active ? "font-extrabold text-[#18181B]" : "font-semibold text-[#3F3F46]")}>
                      {v.title}
                    </span>
                    {active && <span className="text-[11px] text-[#71717A]">در حال پخش</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
