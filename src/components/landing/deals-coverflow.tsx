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

const AUTOPLAY_MS = 3800;

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
  // The current slide and the one before it (to tell a one-step move from a wrap-around jump).
  const [slide, setSlide] = useState({ at: 0, from: 0 });
  const active = slide.at;
  const setActive = useCallback((i: number) => setSlide((s) => (s.at === i ? s : { at: i, from: s.at })), []);
  // Separate reasons to hold the autoplay; each one is lifted by its own counterpart event,
  // so a tap on a phone or a click on an arrow can never leave the carousel stuck.
  const [hover, setHover] = useState(false); // real mouse only
  const [keyFocus, setKeyFocus] = useState(false); // keyboard focus inside
  const [touching, setTouching] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback((d: number) => setSlide((s) => ({ at: (s.at + d + n) % n, from: s.at })), [n]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Stop while scrolled away or the tab is in the background.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting && !document.hidden), { threshold: 0.25 });
    io.observe(el);
    const vis = () => setOnScreen(!document.hidden && el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < window.innerHeight);
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  // One timer per slide: any move (auto, arrow, dot, swipe) restarts the full wait.
  const running = n > 1 && !reduced && !hover && !keyFocus && !touching && onScreen;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => go(1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [running, active, go]);

  // Shortest signed distance on the ring, so the fan wraps around.
  const ring = (i: number, a: number) => {
    let o = i - a;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  };
  const offset = (i: number) => ring(i, active);

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocusCapture={(e) => setKeyFocus(e.target instanceof HTMLElement && e.target.matches(":focus-visible"))}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyFocus(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setTouching(true);
        setHover(false);
      }}
      onTouchEnd={(e) => {
        setTouching(false);
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1); // RTL: swipe right = next
        touchX.current = null;
      }}
      onTouchCancel={() => {
        setTouching(false);
        touchX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="پیشنهادهای بلک‌فرایدی"
    >
      <div className="relative h-[26rem] sm:h-[28.5rem]">
        {products.map((p, i) => {
          const o = offset(i);
          const abs = Math.abs(o);
          const hidden = abs > 2;
          // A card that wraps from one end of the ring to the other jumps instead of flying across.
          const jump = Math.abs(o - ring(i, slide.from)) > 1;
          const store = storeByKey(p.storeKey);
          const price = formatPrice(p.price, p.currency);
          const old = formatPrice(p.oldPrice, p.currency);
          return (
            <article
              key={p.id}
              aria-hidden={o !== 0}
              onClick={() => o !== 0 && setActive(i)}
              className={cn(
                "absolute left-1/2 top-0 w-[15.5rem] will-change-transform sm:w-[17rem]",
                !jump && "transition-[transform,opacity] duration-500 ease-out",
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
        <div className="mx-auto mt-3 flex w-full max-w-[19rem] items-center gap-4 sm:mt-5 sm:max-w-sm">
          <button type="button" onClick={() => go(-1)} className="flex size-11 shrink-0 items-center justify-center border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white" aria-label="قبلی">
            <ChevronRight className="size-5" />
          </button>

          {/* Where we are in the list: a counter and a track you can click to jump. */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
            <p className="flex items-baseline gap-1.5 font-black leading-none" aria-hidden>
              <span className="text-xl text-white tabular-nums">{toFaDigits(String(active + 1).padStart(2, "0"))}</span>
              <span className="text-xs text-white/35">/</span>
              <span className="text-xs text-white/35 tabular-nums">{toFaDigits(String(n).padStart(2, "0"))}</span>
            </p>
            <span className="sr-only" aria-live={running ? "off" : "polite"}>
              کالای {toFaDigits(active + 1)} از {toFaDigits(n)}
            </span>
            <div
              className="group relative flex h-4 w-full cursor-pointer items-center"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const frac = (r.right - e.clientX) / r.width; // RTL: first item on the right
                setActive(Math.min(n - 1, Math.max(0, Math.floor(frac * n))));
              }}
              aria-hidden
            >
              <span className="h-px w-full bg-white/15 transition-[height] group-hover:h-0.5" />
              <span
                className="absolute h-[3px] bg-brand transition-[right] duration-500 ease-out"
                style={{ right: `${(active / n) * 100}%`, width: `${Math.max(100 / n, 4)}%` }}
              />
            </div>
          </div>

          <button type="button" onClick={() => go(1)} className="relative flex size-11 shrink-0 items-center justify-center border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white" aria-label="بعدی">
            <ChevronLeft className="size-5" />
            {/* Autoplay timer: the frame fills in yellow until the next card comes in. */}
            {running && (
              <svg key={active} className="pointer-events-none absolute -inset-px size-[calc(100%+2px)]" viewBox="0 0 46 46" aria-hidden>
                <rect
                  x="0.75"
                  y="0.75"
                  width="44.5"
                  height="44.5"
                  pathLength={100}
                  fill="none"
                  stroke="var(--color-brand, #FFCB05)"
                  strokeWidth="1.5"
                  className="autoplay-ring"
                  style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
