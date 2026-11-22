import Link from "next/link";
import { hero } from "@/content/landing";
import { stores } from "@/lib/catalog";
import { Countdown } from "./countdown";
import { LinkStarter } from "./link-starter";

/**
 * One bold idea: a midnight sale on a dark stage. A yellow spotlight turns on and price
 * tags with real store names drop in around the headline (tags = shopping + shipping labels).
 */

type Tag = { key: string; pos: string; r: number; d: number; s: number; tone: "yellow" | "dark"; size: "lg" | "md" | "sm" };
const TAGS: Tag[] = [
  { key: "taobao", pos: "right-[4%] top-[18%]", r: -9, d: 350, s: 0, tone: "yellow", size: "lg" },
  { key: "amazon-ae", pos: "left-[5%] top-[22%]", r: 7, d: 480, s: 1.2, tone: "yellow", size: "lg" },
  { key: "1688", pos: "right-[10%] top-[52%]", r: 5, d: 600, s: 0.6, tone: "dark", size: "md" },
  { key: "noon", pos: "left-[9%] top-[55%]", r: -6, d: 720, s: 1.8, tone: "dark", size: "md" },
  { key: "aliexpress", pos: "right-[3%] top-[80%]", r: -4, d: 840, s: 2.4, tone: "dark", size: "sm" },
  { key: "trendyol", pos: "left-[4%] top-[82%]", r: 8, d: 960, s: 3, tone: "dark", size: "sm" },
];

function PriceTag({ t }: { t: Tag }) {
  const store = stores.find((s) => s.key === t.key);
  if (!store) return null;
  const size = t.size === "lg" ? "text-xl pl-4 pr-9 py-3" : t.size === "md" ? "text-base pl-3.5 pr-8 py-2.5" : "text-sm pl-3 pr-7 py-2";
  return (
    <div className={`tag-drop absolute hidden lg:block ${t.pos}`} style={{ "--d": `${t.d}ms` } as React.CSSProperties} aria-hidden>
      <div className="tag-sway" style={{ "--r": `${t.r}deg`, "--s": `${t.s}s`, transform: `rotate(${t.r}deg)` } as React.CSSProperties}>
        <div
          className={`price-tag flex flex-col items-start font-black leading-tight shadow-2xl ${size} ${
            t.tone === "yellow" ? "bg-brand text-ink" : "bg-[#1b1b1b] text-brand ring-1 ring-inset ring-brand/30"
          }`}
        >
          <span dir="ltr">{store.latin}</span>
          <span className={`text-[0.7em] font-semibold ${t.tone === "yellow" ? "text-ink/60" : "text-white/50"}`}>{store.name}</span>
        </div>
      </div>
    </div>
  );
}

export function Hero({ countdownTarget, countdownLabel }: { countdownTarget: string; countdownLabel: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-black text-white" aria-labelledby="hero-title">
      <div className="spotlight pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="dot-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="floor-glow pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2" aria-hidden />

      {TAGS.map((t) => (
        <PriceTag key={t.key} t={t} />
      ))}

      <div className="relative mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center px-4 pb-16 pt-28 text-center sm:px-6 sm:pt-32">
        <Countdown target={countdownTarget} label={countdownLabel} doneLabel="بلک‌فرایدی شروع شده؛ همین حالا سفارش بدهید." className="justify-center" />

        <p dir="ltr" className="hero-wordmark mt-8 font-black text-brand" aria-hidden>
          BLACK
          <br />
          FRIDAY
        </p>
        <h1 id="hero-title" className="mt-6 whitespace-pre-line text-3xl font-black leading-[1.35] sm:text-5xl">
          {hero.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">{hero.lead}</p>

        <div className="mt-9 w-full max-w-2xl">
          <LinkStarter placeholder={hero.inputPlaceholder} submit={hero.submit} />
        </div>
        <div className="mt-3 flex flex-col items-center gap-3 text-sm sm:flex-row sm:gap-6">
          {hero.alt.map((a) => (
            <Link key={a.href} href={a.href} className="font-semibold text-white/75 underline decoration-brand/50 decoration-2 underline-offset-[6px] hover:text-brand hover:decoration-brand">
              {a.label}
            </Link>
          ))}
        </div>

        {/* Mobile: the tags sit in a row instead of floating around the stage. */}
        <ul className="mt-10 flex flex-wrap justify-center gap-2 lg:hidden" aria-label="چند فروشگاه">
          {TAGS.map((t, i) => {
            const s = stores.find((x) => x.key === t.key)!;
            return (
              <li key={t.key} style={{ transform: `rotate(${i % 2 ? 3 : -3}deg)` }}>
                <span className={`price-tag inline-block py-1.5 pl-3 pr-7 text-sm font-black ${i < 2 ? "bg-brand text-ink" : "bg-[#1b1b1b] text-brand ring-1 ring-inset ring-brand/30"}`} dir="ltr">
                  {s.latin}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Yellow running strip of stores and facts, right under the hero. */
export function Ticker() {
  const words = [...hero.facts, ...stores.filter((s) => s.featured).map((s) => s.name)];
  const row = (
    <ul className="flex shrink-0 items-center gap-8 pl-8">
      {words.map((w) => (
        <li key={w} className="flex items-center gap-8 whitespace-nowrap">
          <span>{w}</span>
          <span className="text-ink/40" aria-hidden>✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden bg-brand py-3.5 text-base font-black text-ink sm:text-lg" aria-label="خلاصه">
      <div className="ticker flex w-max" dir="ltr">
        <div dir="rtl" className="flex">{row}</div>
        <div dir="rtl" className="flex" aria-hidden>{row}</div>
      </div>
    </div>
  );
}
