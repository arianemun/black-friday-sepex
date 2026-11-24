"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chamfered panel with a 1px frame. A border can't follow a clip-path, so the frame is the
 * outer layer's background showing through a 1px gap around the inner panel.
 */
export function Frame({
  children,
  className,
  innerClassName,
  tone = "muted",
  as: As = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  tone?: "muted" | "brand" | "danger";
  as?: "div" | "section" | "fieldset" | "form";
} & Omit<React.HTMLAttributes<HTMLElement>, "className">) {
  const frame = tone === "brand" ? "bg-brand" : tone === "danger" ? "bg-destructive/70" : "bg-white/12";
  return (
    <div className={cn("chamfer p-px", frame, className)}>
      <As className={cn("chamfer bg-[#121212] p-4 sm:p-6", innerClassName)} {...(rest as Record<string, unknown>)}>
        {children}
      </As>
    </div>
  );
}

/** Shared button looks so primary and secondary actions sit together as one family. */
export const btn = {
  primary:
    "chamfer-sm inline-flex h-12 items-center justify-center gap-2 bg-brand px-6 font-black text-ink transition-colors hover:bg-[#ffd633] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink disabled:opacity-60",
  secondary:
    "chamfer-sm inline-flex h-12 items-center justify-center gap-2 bg-white/[0.08] px-5 text-sm font-bold text-white transition-colors hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:opacity-50",
};

export type ProductPreview = { title: string | null; image: string | null; price: string | null; currency?: string | null; site?: string | null; guessed?: boolean };

/** Product card read from the store page: image, title, store and price. */
export function ProductPreviewCard({ preview, quantity, note, compact }: { preview: ProductPreview; quantity?: number | string; note?: string | null; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const image = !broken && preview.image && /^https:\/\//.test(preview.image) ? preview.image : null;
  const price = preview.price ? [preview.price, preview.currency].filter(Boolean).join(" ") : null;
  return (
    <div className="flex items-start gap-3">
      <div className={cn("chamfer-sm flex shrink-0 items-center justify-center overflow-hidden bg-white", compact ? "size-14" : "size-20")}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party store image, size unknown
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-contain p-1"
            onError={() => setBroken(true)}
          />
        ) : (
          <ImageOff className="size-6 text-ink/35" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {preview.title && (
          <p dir="auto" className={cn("line-clamp-2 font-bold leading-6", compact ? "text-sm" : "text-[0.95rem]")}>
            {preview.title}
          </p>
        )}
        {note && <p className="mt-0.5 truncate text-xs text-white/55">{note}</p>}
        {preview.guessed && <p className="mt-0.5 text-xs text-white/45">اسم از روی لینک؛ عکس و قیمت رو کارشناس بررسی می‌کنه.</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {preview.site && <span className="bg-white/10 px-1.5 py-0.5 font-bold text-white/80" dir="ltr">{preview.site}</span>}
          {price && (
            <span className="font-black text-brand" dir="ltr">
              {price}
            </span>
          )}
          {quantity !== undefined && <span className="text-white/55">تعداد: {quantity}</span>}
        </div>
      </div>
    </div>
  );
}
