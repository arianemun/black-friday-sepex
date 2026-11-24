import Link from "next/link";
import { Camera, Ship } from "lucide-react";
import { hero } from "@/content/landing";
import { storeLabel, stores } from "@/lib/catalog";
import { Countdown } from "./countdown";
import { LinkStarter } from "./link-starter";

/**
 * One bold idea: a midnight sale on a dark stage. A yellow spotlight turns on and price
 * tags with real store names drop in around the headline (tags = shopping + shipping labels).
 */

type Tag = { key: string; pos: string; r: number; d: number; s: number; tone: "yellow" | "dark"; size: "lg" | "md" | "sm" };
const TAGS: Tag[] = [
  { key: "namshi", pos: "right-[3%] top-[17%]", r: -9, d: 350, s: 0, tone: "yellow", size: "lg" },
  { key: "amazon-ae", pos: "left-[4%] top-[20%]", r: 7, d: 480, s: 1.2, tone: "yellow", size: "lg" },
  { key: "ebay", pos: "right-[11%] top-[44%]", r: 5, d: 600, s: 0.6, tone: "dark", size: "md" },
  { key: "noon", pos: "left-[12%] top-[46%]", r: -6, d: 720, s: 1.8, tone: "dark", size: "md" },
  { key: "zalando", pos: "right-[4%] top-[68%]", r: -4, d: 840, s: 2.4, tone: "dark", size: "sm" },
  { key: "trendyol", pos: "left-[5%] top-[70%]", r: 8, d: 960, s: 3, tone: "yellow", size: "sm" },
];

const tagName = (key: string) => {
  const s = stores.find((x) => x.key === key);
  return s ? storeLabel(s) : key;
};

function PriceTag({ t }: { t: Tag }) {
  // Tags on the right of the stage hang toward the headline: hole on their left side.
  const toLeft = t.pos.startsWith("right");
  const size = {
    lg: toLeft ? "py-4 text-[2rem] pr-6 pl-12" : "py-4 text-[2rem] pl-6 pr-12",
    md: toLeft ? "py-3.5 text-[1.6rem] pr-5 pl-11" : "py-3.5 text-[1.6rem] pl-5 pr-11",
    sm: toLeft ? "py-3 text-[1.3rem] pr-4 pl-10" : "py-3 text-[1.3rem] pl-4 pr-10",
  }[t.size];
  return (
    <div className={`tag-drop absolute hidden origin-center scale-75 lg:block xl:scale-100 ${t.pos}`} style={{ "--d": `${t.d}ms` } as React.CSSProperties} aria-hidden>
      <div className={`tag-sway ${toLeft ? "tag-sway-l" : ""}`} style={{ "--r": `${t.r}deg`, "--s": `${t.s}s`, transform: `rotate(${t.r}deg)` } as React.CSSProperties}>
        <div
          className={`price-tag ${toLeft ? "price-tag-l" : ""} font-black leading-none shadow-2xl ${size} ${
            t.tone === "yellow" ? "bg-brand text-ink" : "bg-[#1b1b1b] text-brand ring-1 ring-inset ring-brand/35"
          }`}
        >
          {tagName(t.key)}
        </div>
      </div>
    </div>
  );
}

export function Hero({ countdownTarget }: { countdownTarget: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-black text-white" aria-labelledby="hero-title">
      <div className="spotlight pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="dot-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="floor-glow pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2" aria-hidden />

      {TAGS.map((t) => (
        <PriceTag key={t.key} t={t} />
      ))}

      <div className="relative mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-28 text-center sm:px-6 sm:pt-32">
        <p dir="ltr" className="hero-wordmark font-black text-brand" aria-hidden>
          BLACK
          <br />
          FRIDAY
        </p>
        <h1 id="hero-title" className="mt-6 whitespace-pre-line text-[1.6rem] font-black leading-[1.4] [text-wrap:balance] min-[400px]:text-3xl sm:text-5xl">
          {hero.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">{hero.lead}</p>

        <div className="mt-9 w-full max-w-2xl">
          <LinkStarter placeholder={hero.inputPlaceholder} submit={hero.submit} />
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 text-sm sm:flex-row sm:gap-3">
          {hero.alt.map((a, i) => {
            const Icon = i === 0 ? Camera : Ship;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="chamfer-sm inline-flex h-10 items-center gap-2 bg-white/[0.07] px-4 font-semibold text-white/80 transition-colors hover:bg-brand hover:text-ink"
              >
                <Icon className="size-4" aria-hidden />
                {a.label}
              </Link>
            );
          })}
        </div>

        <Countdown target={countdownTarget} className="mt-12" />

        {/* Small screens: the tags sit in a row instead of floating around the stage. */}
        <ul className="mt-10 flex flex-wrap justify-center gap-x-2 gap-y-3 lg:hidden" aria-label="چند فروشگاه" dir="ltr">
          {TAGS.map((t, i) => (
            <li key={t.key} style={{ transform: `rotate(${i % 2 ? 3 : -3}deg)` }}>
              <span className={`price-tag inline-block py-2 pl-3.5 pr-8 text-base font-black leading-none ${t.tone === "yellow" ? "bg-brand text-ink" : "bg-[#1b1b1b] text-brand ring-1 ring-inset ring-brand/35"}`}>
                {tagName(t.key)}
              </span>
            </li>
          ))}
        </ul>
        <a href="#deals" className="mt-12 hidden flex-col items-center gap-2 text-xs text-white/40 hover:text-white/70 sm:flex">
          بیا پایین
          <span className="scroll-cue h-8 w-px bg-gradient-to-b from-brand to-transparent" aria-hidden />
        </a>
      </div>
    </section>
  );
}
