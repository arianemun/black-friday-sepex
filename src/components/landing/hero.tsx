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
  { key: "namshi", pos: "right-[3%] top-[17%]", r: -9, d: 350, s: 0, tone: "yellow", size: "lg" },
  { key: "amazon-ae", pos: "left-[4%] top-[20%]", r: 7, d: 480, s: 1.2, tone: "yellow", size: "lg" },
  { key: "ebay", pos: "right-[11%] top-[44%]", r: 5, d: 600, s: 0.6, tone: "dark", size: "md" },
  { key: "noon", pos: "left-[12%] top-[46%]", r: -6, d: 720, s: 1.8, tone: "dark", size: "md" },
  { key: "zalando", pos: "right-[4%] top-[68%]", r: -4, d: 840, s: 2.4, tone: "dark", size: "sm" },
  { key: "trendyol", pos: "left-[5%] top-[70%]", r: 8, d: 960, s: 3, tone: "yellow", size: "sm" },
];

const tagName = (key: string) => {
  const s = stores.find((x) => x.key === key);
  return s?.short ?? s?.name ?? key;
};

function PriceTag({ t }: { t: Tag }) {
  const size =
    t.size === "lg" ? "text-[2rem] pl-6 pr-12 py-4" : t.size === "md" ? "text-[1.6rem] pl-5 pr-11 py-3.5" : "text-[1.3rem] pl-4 pr-10 py-3";
  return (
    <div className={`tag-drop absolute hidden xl:block ${t.pos}`} style={{ "--d": `${t.d}ms` } as React.CSSProperties} aria-hidden>
      <div className="tag-sway" style={{ "--r": `${t.r}deg`, "--s": `${t.s}s`, transform: `rotate(${t.r}deg)` } as React.CSSProperties}>
        <div
          className={`price-tag font-black leading-none shadow-2xl ${size} ${
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

        <Countdown target={countdownTarget} className="mt-12" />

        {/* Small screens: the tags sit in a row instead of floating around the stage. */}
        <ul className="mt-10 flex flex-wrap justify-center gap-x-2 gap-y-3 xl:hidden" aria-label="چند فروشگاه">
          {TAGS.map((t, i) => (
            <li key={t.key} style={{ transform: `rotate(${i % 2 ? 3 : -3}deg)` }}>
              <span className={`price-tag inline-block py-2 pl-3.5 pr-8 text-base font-black ${t.tone === "yellow" ? "bg-brand text-ink" : "bg-[#1b1b1b] text-brand ring-1 ring-inset ring-brand/35"}`}>
                {tagName(t.key)}
              </span>
            </li>
          ))}
        </ul>
        <a href="#deals" className="mt-12 hidden flex-col items-center gap-2 text-xs text-white/40 hover:text-white/70 sm:flex">
          اسکرول کنید
          <span className="scroll-cue h-8 w-px bg-gradient-to-b from-brand to-transparent" aria-hidden />
        </a>
      </div>
    </section>
  );
}
