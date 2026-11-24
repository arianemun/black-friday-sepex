"use client";

import { useEffect, useState } from "react";
import { SepexMark } from "@/components/brand/logo";
import { Check, Link2, PackageCheck, Phone, Plane } from "lucide-react";
import { steps } from "@/content/landing";
import { cn, toFaDigits } from "@/lib/utils";

/** Four steps as an accordion; a phone beside it shows what each step looks like. */

function Screen({ step }: { step: number }) {
  return (
    <div className="relative h-full overflow-hidden bg-[#0e0e0e] px-4 pb-8 pt-12 text-right">
      <div
        className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.07] py-1.5 text-[10px] text-white/55"
        dir="ltr"
      >
        <svg viewBox="0 0 10 12" className="h-2.5 w-auto fill-white/50">
          <path d="M2 5V3.5a3 3 0 0 1 6 0V5h.5A1.5 1.5 0 0 1 10 6.5v4A1.5 1.5 0 0 1 8.5 12h-7A1.5 1.5 0 0 1 0 10.5v-4A1.5 1.5 0 0 1 1.5 5H2Zm1.3 0h3.4V3.5a1.7 1.7 0 0 0-3.4 0V5Z" />
        </svg>
        black.sepex.net
      </div>

      {step === 0 && (
        <div className="screen-in mt-5">
          <p className="text-sm font-black text-white">لینک کالا رو بذار</p>
          <div className="mt-3 flex items-center gap-2 border border-brand/60 bg-white/5 px-2.5 py-2.5">
            <Link2 className="size-3.5 text-brand" />
            <span dir="ltr" className="truncate text-[10px] text-white/70">
              https://www.amazon.ae/dp/…
            </span>
          </div>
          <p className="mt-2 text-[10px] text-brand">فروشگاه: آمازون امارات</p>
          <div className="mt-4 grid grid-cols-[1fr_3rem] gap-2">
            <div className="h-8 bg-white/5" />
            <div className="flex h-8 items-center justify-center bg-white/5 text-[11px] text-white">
              {toFaDigits(1)}
            </div>
          </div>
          <div className="chamfer-sm mt-6 flex h-10 items-center justify-center bg-brand text-xs font-black text-ink">
            ادامه
          </div>
          <p className="mt-3 text-center text-[10px] text-white/35">
            عکس یا اسم کالا هم کافیه
          </p>
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
            <div className="bg-white/5 p-2.5 text-[10px] leading-5 text-white/70">
              سلام! درخواست BF-7K3Q9M رو بررسی کردیم.
            </div>
            <div className="bg-brand/15 p-2.5 text-[10px] leading-5 text-brand">
              قیمت نهایی و زمان رسیدنش رو بهت می‌گیم.
            </div>
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
            <span className="absolute right-0 top-[60%] text-[10px] text-white/50">
              دبی
            </span>
            <span className="absolute left-0 top-[60%] text-[10px] text-white/50">
              تهران
            </span>
          </div>
          <div className="space-y-2">
            {["خرید از فروشگاه", "تحویل به انبار مبدأ", "حمل بین‌المللی"].map(
              (t, i) => (
                <div
                  key={t}
                  className="flex items-center gap-2 text-[11px] text-white/75"
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center",
                      i < 2 ? "bg-brand text-ink" : "border border-brand/60",
                    )}
                  >
                    {i < 2 && <Check className="size-3" />}
                  </span>
                  {t}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="screen-in mt-6">
          <div className="border border-white/10 p-3">
            <div className="h-1 bg-brand" />
            <p className="mt-3 text-[10px] text-white/45">کد پیگیری</p>
            <p
              dir="ltr"
              className="text-right text-lg font-black tracking-wider text-white"
            >
              BF-7K3Q9M
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {["ثبت درخواست", "سفارش قطعی شد", "ترخیص گمرکی"].map((t, i) => (
              <div
                key={t}
                className="flex items-center gap-2 text-[11px] text-white/75"
              >
                <span
                  className={cn(
                    "size-2 rotate-45",
                    i === 2 ? "bg-brand" : "bg-white/30",
                  )}
                />
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
    <section
      id="how"
      className="relative isolate scroll-mt-4 overflow-hidden bg-black py-20 sm:py-28"
      aria-labelledby="how-title"
    >
      <div
        className="pointer-events-none absolute left-[10%] top-1/2 -z-10 size-[36rem] -translate-y-1/2 bg-[radial-gradient(closest-side,rgb(255_203_5/0.14),transparent)]"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="rv">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <SepexMark className="h-3" /> برای بلک‌فرایدی آماده شو
            </p>
            <h2
              id="how-title"
              className="mt-2 text-3xl font-black leading-tight text-white sm:text-[2.6rem]"
            >
              چطوری سفارش بدم؟
            </h2>
          </div>
          <ol className="mt-8 space-y-2.5">
            {steps.map((s, i) => {
              const open = i === active;
              return (
                <li
                  key={s.title}
                  className="rv"
                  style={{ "--i": i + 1 } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setAuto(false);
                    }}
                    aria-expanded={open}
                    className={cn(
                      "relative w-full overflow-hidden border p-4 text-right transition-colors sm:p-5",
                      open
                        ? "border-brand/50 bg-white/[0.05]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center text-sm font-black",
                          open
                            ? "bg-brand text-ink"
                            : "border border-white/20 text-white/60",
                        )}
                      >
                        {toFaDigits(i + 1)}
                      </span>
                      <span
                        className={cn(
                          "text-base font-black",
                          open ? "text-white" : "text-white/70",
                        )}
                      >
                        {s.title}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "grid transition-all duration-300",
                        open
                          ? "mt-3 grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <span className="overflow-hidden pr-11 text-sm leading-7 text-white/60">
                        {s.body}
                      </span>
                    </span>
                    {open && auto && (
                      <span
                        key={active}
                        className="step-progress absolute bottom-0 right-0 h-0.5 bg-brand"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* phone */}
        <div
          className="relative mx-auto hidden w-[17.5rem] rotate-[-4deg] sm:block"
          aria-hidden
        >
          {/* side buttons */}
          <span className="absolute -left-[3px] top-24 h-7 w-[3px] rounded-l-sm bg-gradient-to-b from-[#6b6b6b] to-[#3a3a3a]" />
          <span className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l-sm bg-gradient-to-b from-[#6b6b6b] to-[#3a3a3a]" />
          <span className="absolute -left-[3px] top-[13.5rem] h-12 w-[3px] rounded-l-sm bg-gradient-to-b from-[#6b6b6b] to-[#3a3a3a]" />
          <span className="absolute -right-[3px] top-40 h-20 w-[3px] rounded-r-sm bg-gradient-to-b from-[#6b6b6b] to-[#3a3a3a]" />
          {/* titanium frame */}
          <div className="rounded-[3rem] bg-[linear-gradient(145deg,#8a8a8a_0%,#3c3c3c_18%,#1c1c1c_45%,#4a4a4a_70%,#9a9a9a_100%)] p-[3px] shadow-[0_50px_120px_-30px_rgb(255_203_5/0.35),0_30px_60px_-20px_rgb(0_0_0/0.9)]">
            {/* black bezel */}
            <div className="rounded-[2.85rem] bg-black p-[9px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
              <div className="relative h-[34rem] overflow-hidden rounded-[2.35rem] bg-[#0e0e0e]">
                {/* status bar */}
                <div
                  className="absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-between px-6 text-[11px] font-semibold text-white"
                  dir="ltr"
                >
                  <span className="tabular-nums">9:41</span>
                  <span className="flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 17 11"
                      className="h-[9px] w-auto fill-white"
                    >
                      <rect x="0" y="7" width="3" height="4" rx="0.7" />
                      <rect x="4.5" y="5" width="3" height="6" rx="0.7" />
                      <rect x="9" y="2.5" width="3" height="8.5" rx="0.7" />
                      <rect x="13.5" y="0" width="3" height="11" rx="0.7" />
                    </svg>
                    <svg
                      viewBox="0 0 15 11"
                      className="h-[9px] w-auto fill-white"
                    >
                      <path d="M7.5 2.2c2.1 0 4 .8 5.5 2.1l1.1-1.2A9.6 9.6 0 0 0 7.5.5 9.6 9.6 0 0 0 .9 3.1L2 4.3a8 8 0 0 1 5.5-2.1Zm0 3.3c1.2 0 2.3.4 3.2 1.2l1.1-1.2a6.4 6.4 0 0 0-8.6 0l1.1 1.2c.9-.8 2-1.2 3.2-1.2Zm0 3.3-1.6 1.7L7.5 11l1.6-1.5-1.6-1.7Z" />
                    </svg>
                    <span className="relative flex h-[11px] w-[22px] items-center rounded-[3px] border border-white/45 p-[1.5px]">
                      <span className="h-full w-[72%] rounded-[1.5px] bg-white" />
                      <span className="absolute -right-[3px] top-1/2 h-1 w-[1.5px] -translate-y-1/2 rounded-r bg-white/45" />
                    </span>
                  </span>
                </div>
                {/* dynamic island */}
                <div className="absolute left-1/2 top-2.5 z-30 flex h-[1.6rem] w-[5.8rem] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5">
                  <span className="size-2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#2a3a5a,#05070c_70%)] ring-1 ring-white/5" />
                </div>
                <Screen key={active} step={active} />
                {/* home indicator */}
                <div className="absolute bottom-2 left-1/2 z-20 h-[4px] w-28 -translate-x-1/2 rounded-full bg-white/70" />
                {/* glass glare */}
                <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(115deg,rgb(255_255_255/0.09)_0%,rgb(255_255_255/0.03)_28%,transparent_42%)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
