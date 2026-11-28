import Link from "next/link";
import { Camera, Ship } from "lucide-react";
import { hero } from "@/content/landing";
import { storeLabel, stores, suggestedStores } from "@/lib/catalog";
import { SepexLogo } from "@/components/brand/logo";
import { HeroWordmark } from "./hero-wordmark";
import { LinkStarter } from "./link-starter";

/**
 * One bold idea: a midnight sale on a dark stage. A yellow spotlight turns on and price
 * tags with real store names drop in around the headline (tags = shopping + shipping labels).
 */

type Tag = { key: string; pos: string; r: number; d: number; s: number; tone: "yellow" | "dark"; size: "lg" | "md" | "sm" };
const TAGS: Tag[] = [
  { key: "namshi", pos: "right-[3%] top-[17%]", r: -9, d: 350, s: 0, tone: "yellow", size: "lg" },
  { key: "amazon-ae", pos: "left-[4%] top-[20%]", r: 7, d: 480, s: 1.2, tone: "yellow", size: "lg" },
  { key: "nike-ae", pos: "right-[11%] top-[44%]", r: 5, d: 600, s: 0.6, tone: "dark", size: "md" },
  { key: "noon", pos: "left-[12%] top-[46%]", r: -6, d: 720, s: 1.8, tone: "dark", size: "md" },
  { key: "adidas-ae", pos: "right-[4%] top-[68%]", r: -4, d: 840, s: 2.4, tone: "dark", size: "sm" },
  { key: "trendyol", pos: "left-[5%] top-[70%]", r: 8, d: 960, s: 3, tone: "yellow", size: "sm" },
];

const tagName = (key: string) => {
  const s = stores.find((x) => x.key === key);
  return s ? storeLabel(s) : key;
};

/** A vertical price tag on a short string: one big number, a word, and where it leads. */
function HangingTag({ href, tone, big, small, label, r, d, s }: { href: string; tone: "yellow" | "dark"; big: string; small: string; label: string; r: number; d: number; s: number }) {
  const yellow = tone === "yellow";
  return (
    <a href={href} className="tag-drop group relative block outline-none" style={{ "--d": `${d}ms` } as React.CSSProperties}>
      <span className="tag-sway tag-hang relative block" style={{ "--s": `${s}s`, rotate: `${r}deg` } as React.CSSProperties}>
        {/* the string, from the line above down to the punched hole */}
        <span className="absolute left-1/2 top-[-1.25rem] z-10 h-[2.3rem] w-px -translate-x-1/2 bg-white/45" aria-hidden />
        <span
          className={`hang-tag relative flex w-[8.75rem] flex-col items-center px-3 pb-4 pt-9 text-center transition-transform group-active:scale-95 ${
            yellow ? "bg-brand text-ink" : "bg-[#181818] text-white"
          }`}
        >
          <span className={`text-[2.5rem] font-black leading-none tracking-tight ${yellow ? "" : "text-brand"}`} dir="ltr">
            {big}
          </span>
          <span className={`mt-1.5 text-[11px] font-bold ${yellow ? "text-ink/60" : "text-white/45"}`}>{small}</span>
          <span className={`mt-3 w-full border-t border-dashed pt-2.5 text-[13px] font-extrabold leading-5 ${yellow ? "border-ink/25" : "border-white/15"}`}>{label}</span>
        </span>
        {/* soft glow / outline that follows the tag's shape */}
        {yellow ? (
          <span className="pointer-events-none absolute inset-x-3 -bottom-3 h-8 rounded-full bg-brand/40 blur-xl" aria-hidden />
        ) : (
          <span className="hang-tag-ring pointer-events-none absolute inset-0" aria-hidden />
        )}
        <span className="pointer-events-none absolute -inset-1.5 opacity-0 outline outline-2 outline-brand group-focus-visible:opacity-100" aria-hidden />
      </span>
    </a>
  );
}

function PriceTag({ t }: { t: Tag }) {
  // Tags on the right of the stage hang toward the headline: hole on their left side.
  const toLeft = t.pos.startsWith("right");
  const size = {
    lg: toLeft ? "py-4 text-[2rem] pr-6 pl-12" : "py-4 text-[2rem] pl-6 pr-12",
    md: toLeft ? "py-3.5 text-[1.6rem] pr-5 pl-11" : "py-3.5 text-[1.6rem] pl-5 pr-11",
    sm: toLeft ? "py-3 text-[1.3rem] pr-4 pl-10" : "py-3 text-[1.3rem] pl-4 pr-10",
  }[t.size];
  return (
    <a
      href="#stores"
      className={`tag-drop group absolute z-20 hidden origin-center scale-75 outline-none lg:block xl:scale-100 ${t.pos}`}
      style={{ "--d": `${t.d}ms` } as React.CSSProperties}
      aria-label={`${tagName(t.key)} — سایت‌های محبوب برای خرید`}
    >
      <div className={`tag-sway ${toLeft ? "tag-sway-l" : ""}`} style={{ "--r": `${t.r}deg`, "--s": `${t.s}s`, transform: `rotate(${t.r}deg)` } as React.CSSProperties}>
        <div
          className={`price-tag ${toLeft ? "price-tag-l" : ""} font-black leading-none shadow-2xl transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-110 group-focus-visible:brightness-125 ${size} ${
            t.tone === "yellow" ? "bg-brand text-ink" : "bg-[#1b1b1b] text-brand ring-1 ring-inset ring-brand/35"
          }`}
        >
          {tagName(t.key)}
        </div>
      </div>
    </a>
  );
}

export function Hero({ deals }: { deals?: { count: number; maxDiscount: number | null } }) {
  return (
    <section className="relative isolate overflow-hidden bg-black text-white" aria-labelledby="hero-title">
      <div className="spotlight pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="dot-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="floor-glow pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2" aria-hidden />

      {TAGS.map((t) => (
        <PriceTag key={t.key} t={t} />
      ))}

      <div className="relative mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-28 text-center sm:px-6 sm:pt-32">
        <div className="hero-in mb-5 flex items-center gap-3 text-white/70 [--in:100ms]">
          <span className="h-px w-10 bg-gradient-to-l from-white/40 to-transparent" aria-hidden />
          <SepexLogo className="h-6 sm:h-7" title="سپکس" />
          <span className="h-px w-10 bg-gradient-to-r from-white/40 to-transparent" aria-hidden />
        </div>
        <HeroWordmark />
        <h1 id="hero-title" className="hero-in mt-6 [--in:600ms] whitespace-pre-line text-[1.6rem] font-black leading-[1.4] [text-wrap:balance] min-[400px]:text-3xl sm:text-5xl">
          {hero.title}
        </h1>
        <p className="hero-in mt-5 max-w-2xl text-base leading-8 text-white/65 [--in:720ms] sm:text-lg">{hero.lead}</p>

        <div className="hero-in mt-9 w-full max-w-2xl [--in:840ms]">
          <LinkStarter placeholder={hero.inputPlaceholder} submit={hero.submit} />
        </div>
        <div className="hero-in mt-4 flex flex-col items-center gap-2 text-sm [--in:960ms] sm:flex-row sm:gap-3">
          {hero.alt.map((a, i) => {
            const Icon = i === 0 ? Camera : Ship;
            // The photo route is highlighted with a border. clip-path would cut a ring at the
            // chamfered corners, so the border is a 1px chamfered layer behind the button.
            return i === 0 ? (
              <Link
                key={a.href}
                href={a.href}
                className="chamfer-sm group inline-flex bg-brand/55 p-px transition-colors hover:bg-brand focus-visible:bg-brand focus-visible:outline-none"
              >
                <span className="chamfer-sm inline-flex h-[42px] items-center gap-2 bg-[#161616] px-4 font-bold text-brand transition-colors group-hover:bg-brand group-hover:text-ink group-focus-visible:bg-brand group-focus-visible:text-ink">
                  <Icon className="size-4" aria-hidden />
                  {a.label}
                </span>
              </Link>
            ) : (
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

        {/* Small screens: two price tags hang from a string; each is a shortcut to what people come for. */}
        <nav className="hero-in relative mt-12 w-full max-w-sm [--in:1080ms] lg:hidden" aria-label="میان‌بر">
          <svg className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full" viewBox="0 0 320 32" preserveAspectRatio="none" aria-hidden>
            <path d="M0 2 Q160 26 320 2" fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul className="relative flex items-start justify-center gap-7 pt-5">
            {deals && deals.count > 0 && (
              <li>
                <HangingTag href="#deals" tone="yellow" big={deals.maxDiscount ? `٪${deals.maxDiscount.toLocaleString("fa-IR")}` : "BF"} small="تخفیف" label="پیشنهادهای بلک‌فرایدی" r={-5} d={1150} s={0.4} />
              </li>
            )}
            <li>
              <HangingTag href="#stores" tone="dark" big={`+${suggestedStores().length.toLocaleString("fa-IR")}`} small="سایت پیشنهادی" label="نمی‌دونی از کجا بخری؟" r={5} d={1300} s={1.6} />
            </li>
          </ul>
        </nav>
        <a href="#deals" className="mt-12 hidden flex-col items-center gap-2 text-xs text-white/40 hover:text-white/70 sm:flex">
          بیا پایین
          <span className="scroll-cue h-8 w-px bg-gradient-to-b from-brand to-transparent" aria-hidden />
        </a>
      </div>
    </section>
  );
}
