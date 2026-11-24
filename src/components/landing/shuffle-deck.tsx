"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Footprints, Gamepad2, Headphones, Laptop, Shirt, Smartphone, Sparkles, Watch } from "lucide-react";
import type { PublicProduct } from "@/lib/products";

/**
 * A small deck of cards that keeps dealing: the front card slides away and the next one
 * comes forward. Uses product photos when there are deals, otherwise category icons.
 */

const FALLBACK = [
  { icon: Smartphone, label: "موبایل" },
  { icon: Headphones, label: "هدفون" },
  { icon: Laptop, label: "لپ‌تاپ" },
  { icon: Watch, label: "ساعت هوشمند" },
  { icon: Footprints, label: "کفش" },
  { icon: Shirt, label: "پوشاک" },
  { icon: Gamepad2, label: "گیمینگ" },
  { icon: Sparkles, label: "عطر و آرایشی" },
];

export function ShuffleDeck({ products }: { products: PublicProduct[] }) {
  const withImages = products.filter((p) => p.image);
  const cards = withImages.length >= 4 ? withImages.map((p) => ({ key: `p${p.id}`, image: p.image!, label: p.title })) : null;
  const n = cards ? cards.length : FALLBACK.length;
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTop((x) => (x + 1) % n), 2200);
    return () => clearInterval(t);
  }, [n]);

  const slots = [-1, 0, 1, 2]; // -1 = leaving, 0 = front, 1..2 = behind
  return (
    <section className="relative isolate overflow-hidden bg-black py-24 sm:py-32" aria-labelledby="deck-title">
      <div className="sepex-pattern pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [mask-image:radial-gradient(55%_60%_at_50%_45%,#000,transparent)]" aria-hidden />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <div className="relative h-64 w-52 sm:h-72 sm:w-60" aria-hidden>
          {slots.map((slot) => {
            const idx = (top + slot + n) % n;
            const style =
              slot === -1
                ? { transform: "translate(-70%, -40px) rotate(-16deg) scale(0.95)", opacity: 0, zIndex: 40 }
                : slot === 0
                  ? { transform: "none", opacity: 1, zIndex: 30 }
                  : slot === 1
                    ? { transform: "translateX(38%) rotate(7deg) scale(0.86)", opacity: 0.55, zIndex: 20 }
                    : { transform: "translateX(-38%) rotate(-7deg) scale(0.86)", opacity: 0.55, zIndex: 10 };
            const card = cards ? cards[idx] : null;
            const fb = FALLBACK[idx % FALLBACK.length];
            const Icon = fb.icon;
            return (
              <div
                key={idx}
                className="deck-card absolute inset-0 flex flex-col bg-[#141414] p-3 ring-1 ring-inset ring-white/15 shadow-2xl transition-all duration-700 ease-out"
                style={style}
              >
                <div className="flex flex-1 items-center justify-center bg-[#f4f4f2]">
                  {card ? (
                    // eslint-disable-next-line @next/next/no-img-element -- our own /media route
                    <img src={card.image} alt="" className="size-4/5 object-contain" />
                  ) : (
                    <Icon className="size-20 text-ink" strokeWidth={1.3} />
                  )}
                </div>
                <p dir="auto" className="mt-3 truncate text-sm font-bold text-white/80">{card ? card.label : fb.label}</p>
              </div>
            );
          })}
        </div>

        <h2 id="deck-title" className="rv mt-14 text-3xl font-black leading-tight text-white sm:text-5xl">تا بلک‌فرایدی تمام نشده، سفارش بده</h2>
        <p className="mt-4 max-w-xl leading-8 text-white/55">تخفیف‌ها چند روز بیشتر نمی‌مونن. همین حالا درخواستت رو ثبت کن تا کارشناس‌مون زودتر بررسیش کنه.</p>
        <Link href="/order" className="chamfer-sm mt-9 inline-flex h-14 items-center gap-2 bg-brand px-9 text-lg font-black text-ink shadow-[0_20px_60px_-15px_rgb(255_203_5/0.7)] hover:bg-[#ffd633]">
          ثبت سفارش
          <ArrowLeft className="size-5" />
        </Link>
      </div>
    </section>
  );
}
