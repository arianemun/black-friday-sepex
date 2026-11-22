"use client";

import { useEffect, useState } from "react";
import { Check, Link2, PackageCheck, Phone, Plane } from "lucide-react";
import { steps } from "@/content/landing";
import { cn, toFaDigits } from "@/lib/utils";

/** Four steps as an accordion; a phone beside it shows what each step looks like. */

function Screen({ step }: { step: number }) {
  return (
    <div className="relative h-full overflow-hidden bg-[#0e0e0e] px-4 pb-4 pt-10 text-right">
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>سپکس</span>
        <span dir="ltr">bf.sepex.net</span>
      </div>

      {step === 0 && (
        <div className="screen-in mt-5">
          <p className="text-sm font-black text-white">لینک کالا را بگذارید</p>
          <div className="mt-3 flex items-center gap-2 border border-brand/60 bg-white/5 px-2.5 py-2.5">
            <Link2 className="size-3.5 text-brand" />
            <span dir="ltr" className="truncate text-[10px] text-white/70">https://www.amazon.ae/dp/…</span>
          </div>
          <p className="mt-2 text-[10px] text-brand">فروشگاه: آمازون امارات</p>
          <div className="mt-4 grid grid-cols-[1fr_3rem] gap-2">
            <div className="h-8 bg-white/5" />
            <div className="flex h-8 items-center justify-center bg-white/5 text-[11px] text-white">{toFaDigits(1)}</div>
          </div>
          <div className="mt-6 flex h-10 items-center justify-center bg-brand text-xs font-black text-ink">ادامه</div>
          <p className="mt-3 text-center text-[10px] text-white/35">عکس یا اسم کالا هم کافی است</p>
        </div>
      )}

      {step === 1 && (
        <div className="screen-in mt-8 flex flex-col items-center text-center">
          <span className="ring-pulse flex size-16 items-center justify-center bg-brand text-ink">
            <Phone className="size-7" />
          </span>
          <p className="mt-5 text-sm font-black text-white">کارشناس سپکس</p>
          <p className="mt-1 text-[11px] text-white/50">در حال تماس…</p>
          <div className="mt-6 w-full space-y-2 text-right">
            <div className="bg-white/5 p-2.5 text-[10px] leading-5 text-white/70">سلام؛ درخواست BF-7K3Q9M را بررسی کردیم.</div>
            <div className="bg-brand/15 p-2.5 text-[10px] leading-5 text-brand">قیمت نهایی و زمان رسیدن را اعلام می‌کنیم.</div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="screen-in mt-6">
          <p className="text-sm font-black text-white">در مسیر</p>
          <div className="relative mt-6 h-24">
            <div className="absolute inset-x-2 top-1/2 h-px bg-white/15" />
            <div className="plane-run absolute top-1/2 -translate-y-1/2 text-brand">
              <Plane className="size-6 -scale-x-100" />
            </div>
            <span className="absolute right-0 top-[60%] text-[10px] text-white/50">دبی</span>
            <span className="absolute left-0 top-[60%] text-[10px] text-white/50">تهران</span>
          </div>
          <div className="space-y-2">
            {["خرید از فروشگاه", "تحویل به انبار مبدأ", "حمل بین‌المللی"].map((t, i) => (
              <div key={t} className="flex items-center gap-2 text-[11px] text-white/75">
                <span className={cn("flex size-4 items-center justify-center", i < 2 ? "bg-brand text-ink" : "border border-brand/60")}>
                  {i < 2 && <Check className="size-3" />}
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="screen-in mt-6">
          <div className="border border-white/10 p-3">
            <div className="h-1 bg-brand" />
            <p className="mt-3 text-[10px] text-white/45">کد پیگیری</p>
            <p dir="ltr" className="text-right text-lg font-black tracking-wider text-white">BF-7K3Q9M</p>
          </div>
          <div className="mt-4 space-y-3">
            {["ثبت درخواست", "سفارش قطعی شد", "ترخیص گمرکی"].map((t, i) => (
              <div key={t} className="flex items-center gap-2 text-[11px] text-white/75">
                <span className={cn("size-2 rotate-45", i === 2 ? "bg-brand" : "bg-white/30")} />
                {t}
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 bg-white/5 py-3 text-[11px] font-bold text-brand">
            <PackageCheck className="size-4" /> آماده‌ی تحویل
          </div>
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 4500);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <section id="how" className="relative isolate scroll-mt-4 overflow-hidden bg-[#070707] py-20 sm:py-28" aria-labelledby="how-title">
      <div className="pointer-events-none absolute left-[10%] top-1/2 -z-10 size-[36rem] -translate-y-1/2 bg-[radial-gradient(closest-side,rgb(255_203_5/0.14),transparent)]" aria-hidden />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold text-brand">برای بلک‌فرایدی آماده شوید</p>
          <h2 id="how-title" className="mt-2 text-3xl font-black leading-tight text-white sm:text-[2.6rem]">چطور سفارش بدهم؟</h2>
          <ol className="mt-8 space-y-2.5">
            {steps.map((s, i) => {
              const open = i === active;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setAuto(false);
                    }}
                    aria-expanded={open}
                    className={cn(
                      "relative w-full overflow-hidden border p-4 text-right transition-colors sm:p-5",
                      open ? "border-brand/50 bg-white/[0.05]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center text-sm font-black", open ? "bg-brand text-ink" : "border border-white/20 text-white/60")}>
                        {toFaDigits(i + 1)}
                      </span>
                      <span className={cn("text-base font-black", open ? "text-white" : "text-white/70")}>{s.title}</span>
                    </span>
                    <span className={cn("grid transition-all duration-300", open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                      <span className="overflow-hidden pr-11 text-sm leading-7 text-white/60">{s.body}</span>
                    </span>
                    {open && auto && <span key={active} className="step-progress absolute bottom-0 right-0 h-0.5 bg-brand" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* phone */}
        <div className="mx-auto hidden w-[17rem] rotate-[-4deg] sm:block" aria-hidden>
          <div className="rounded-[2.4rem] bg-gradient-to-b from-[#2a2a2a] to-[#111] p-2.5 shadow-[0_40px_100px_-30px_rgb(255_203_5/0.35)] ring-1 ring-white/15">
            <div className="relative h-[33rem] overflow-hidden rounded-[1.9rem]">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
              <Screen key={active} step={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
