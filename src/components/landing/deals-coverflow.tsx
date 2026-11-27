"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { countryName, storeByKey } from "@/lib/catalog";
import type { PublicProduct } from "@/lib/products";
import { cn, toFaDigits } from "@/lib/utils";

const formatPrice = (price: string | null, currency: string | null) => {
  if (!price) return null;
  const n = Number(String(price).replace(/,/g, ""));
  const v = Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) : price;
  return `${v}${currency ? ` ${currency}` : ""}`;
};

/** The store's icon and name, small, in the photo's bottom corner. */
function StoreBadge({ storeKey, name }: { storeKey: string; name: string }) {
  const [icon, setIcon] = useState(true);
  return (
    <span className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white/95 py-1 pl-2 pr-1.5 text-[11px] font-bold leading-none text-ink ring-1 ring-black/[0.07]" dir="ltr">
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element -- our own icon route
        <img src={`/store-icon/${storeKey}`} alt="" className="size-4 object-contain" onError={() => setIcon(false)} />
      )}
      {name}
    </span>
  );
}

/**
 * Fanned product carousel: the centre card is large and lit, neighbours step back into the dark.
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
                // Neighbours stay solid (nothing shows through them); a shade inside dims them.
                opacity: hidden ? 0 : 1,
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 z-10 bg-black transition-opacity duration-500"
                style={{ opacity: abs === 0 ? 0 : abs === 1 ? 0.55 : 0.78 }}
                aria-hidden
              />
              <div
                className={cn(
                  "flex flex-col bg-[#121212] p-2.5 ring-1 ring-inset transition-shadow duration-500",
                  o === 0 ? "ring-brand/50 shadow-[0_30px_90px_-25px_rgb(255_203_5/0.55)]" : "ring-white/10"
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-white p-6">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from our own /media route
                    <img src={p.image} alt={p.title} loading="lazy" decoding="async" className="size-full object-contain" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm text-ink/40">بدون تصویر</div>
                  )}
                  {p.discount ? (
                    <span className="chamfer-sm absolute left-0 top-0 flex flex-col items-center bg-brand px-3 pb-1.5 pt-2 leading-none text-ink">
                      <span className="text-xl font-black">٪{toFaDigits(p.discount)}</span>
                      <span className="mt-0.5 text-[10px] font-bold text-ink/65">تخفیف</span>
                    </span>
                  ) : null}
                  {store && <StoreBadge storeKey={store.key} name={store.brand ?? store.latin} />}
                </div>
                <div className="flex flex-col gap-2 px-1.5 pb-1.5 pt-3">
                  <h3 dir="auto" className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">{p.title}</h3>
                  <div className="flex min-h-6 items-baseline justify-between gap-2">
                    {p.country ? <span className="shrink-0 text-[11px] text-white/40">از {countryName(p.country)}</span> : <span />}
                    <p dir="ltr" className="truncate text-left">
                      {price && <span className="font-black text-brand">{price}</span>}
                      {old && <span className="ml-2 text-xs text-white/35 line-through">{old}</span>}
                    </p>
                  </div>
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
