"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { countryName, storeByKey, storeLabel } from "@/lib/catalog";
import type { PublicProduct } from "@/lib/products";
import { cn, toFaDigits } from "@/lib/utils";

const formatPrice = (price: string | null, currency: string | null) => {
  if (!price) return null;
  const n = Number(String(price).replace(/,/g, ""));
  const v = Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) : price;
  return `${v}${currency ? ` ${currency}` : ""}`;
};

/**
 * Fanned product carousel: the centre card is large and lit, neighbours step back and fade.
 * Auto-advances (paused on hover/focus and for reduced motion); arrows, dots and swipe.
 */
export function DealsCoverflow({ products }: { products: PublicProduct[] }) {
  const n = products.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback((d: number) => setActive((a) => (a + d + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), 3800);
    return () => clearInterval(t);
  }, [paused, n, go]);

  // Shortest signed distance on the ring, so the fan wraps around.
  const offset = (i: number) => {
    let o = i - active;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1); // RTL: swipe right = next
        touchX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="پیشنهادهای بلک‌فرایدی"
    >
      <div className="relative h-[29rem] sm:h-[31rem]">
        {products.map((p, i) => {
          const o = offset(i);
          const abs = Math.abs(o);
          const hidden = abs > 2;
          const store = storeByKey(p.storeKey);
          const price = formatPrice(p.price, p.currency);
          const old = formatPrice(p.oldPrice, p.currency);
          return (
            <article
              key={p.id}
              aria-hidden={o !== 0}
              onClick={() => o !== 0 && setActive(i)}
              className={cn(
                "absolute left-1/2 top-0 w-[15.5rem] transition-all duration-500 ease-out sm:w-[17rem]",
                o === 0 ? "z-30" : abs === 1 ? "z-20 cursor-pointer" : "z-10 cursor-pointer",
                hidden && "pointer-events-none"
              )}
              style={{
                transform: `translateX(calc(-50% + ${-o * 62}%)) translateY(${abs * 26}px) scale(${1 - abs * 0.12})`,
                opacity: hidden ? 0 : abs === 0 ? 1 : abs === 1 ? 0.55 : 0.22,
              }}
            >
              <div
                className={cn(
                  "flex flex-col bg-[#121212] p-2.5 ring-1 ring-inset transition-shadow duration-500",
                  o === 0 ? "ring-brand/50 shadow-[0_30px_90px_-25px_rgb(255_203_5/0.55)]" : "ring-white/10"
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-[#f4f4f2] p-5">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from our own /media route
                    <img src={p.image} alt={p.title} loading="lazy" decoding="async" className="size-full object-contain" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm text-ink/40">بدون تصویر</div>
                  )}
                  {p.discount ? (
                    <span className="price-tag absolute right-0 top-3 bg-brand py-1.5 pl-3 pr-8 text-base font-black text-ink">
                      ٪{toFaDigits(p.discount)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5 px-1.5 pb-1.5 pt-3">
                  <p className="text-xs text-white/45">
                    {store ? storeLabel(store) : "فروشگاه خارجی"}
                    {p.country ? `، ${countryName(p.country)}` : ""}
                  </p>
                  <h3 dir="auto" className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">{p.title}</h3>
                  <p dir="ltr" className="min-h-6 text-left">
                    {price && <span className="font-black text-brand">{price}</span>}
                    {old && <span className="ml-2 text-xs text-white/35 line-through">{old}</span>}
                  </p>
                  {o === 0 && (
                    <div className="mt-1 flex items-stretch gap-1.5">
                      <Link
                        href={`/order?deal=${p.code}`}
                        className="flex flex-1 items-center justify-center bg-brand py-2.5 text-sm font-black text-ink hover:bg-[#ffd633]"
                      >
                        همینو برام بیار
                      </Link>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener nofollow noreferrer"
                        className="flex w-10 items-center justify-center border border-white/15 text-white/55 hover:border-white/50 hover:text-white"
                        aria-label={`دیدن در ${store?.name ?? "فروشگاه"}`}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-2 flex items-center justify-center gap-4">
          <button type="button" onClick={() => go(-1)} className="flex size-11 items-center justify-center border border-white/15 text-white/70 hover:border-brand hover:text-brand" aria-label="قبلی">
            <ChevronRight className="size-5" />
          </button>
          <div className="flex items-center gap-1.5">
            {products.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`کالای ${toFaDigits(i + 1)}`}
                aria-current={i === active}
                className={cn("h-1.5 transition-all", i === active ? "w-6 bg-brand" : "w-1.5 bg-white/25 hover:bg-white/50")}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(1)} className="flex size-11 items-center justify-center border border-white/15 text-white/70 hover:border-brand hover:text-brand" aria-label="بعدی">
            <ChevronLeft className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
