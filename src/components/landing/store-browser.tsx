"use client";

import { useMemo, useState } from "react";
import { ArrowUpLeft, BadgeCheck, Flame } from "lucide-react";
import { storeCats, type CountryCode, type StoreCat, type StoreDeal } from "@/lib/catalog";
import { track } from "@/lib/rec/track";
import { cn, toFaDigits } from "@/lib/utils";

export type StoreTile = {
  key: string;
  label: string;
  name: string;
  url: string;
  hint: string;
  country: CountryCode;
  countryName: string;
  cats: StoreCat[];
  official: boolean;
  icon?: string;
  deal?: StoreDeal;
  hot: boolean;
};

type Filter = "any" | "official" | StoreCat;
const COUNTRIES: { code: CountryCode | "any"; name: string }[] = [
  { code: "any", name: "همه‌ی کشورها" },
  { code: "AE", name: "امارات" },
  { code: "TR", name: "ترکیه" },
  { code: "CN", name: "چین" },
  { code: "EU", name: "اروپا" },
];
/** Collapsed: 15 tiles on wide screens (3 rows of 5), 12 below (full rows at 2, 3 and 4 columns). */
const FIRST = 15;
const FIRST_NARROW = 12;

const dealText = (d: StoreDeal) => (d.min ? `${toFaDigits(d.min)} تا ${toFaDigits(d.max)}٪ تخفیف` : `تا ${toFaDigits(d.max)}٪ تخفیف`);

export function StoreBrowser({ tiles }: { tiles: StoreTile[] }) {
  const [cat, setCat] = useState<Filter>("any");
  const [country, setCountry] = useState<CountryCode | "any">("any");
  const [all, setAll] = useState(false);

  const shown = useMemo(
    () =>
      tiles.filter(
        (t) =>
          (cat === "any" || (cat === "official" ? t.official : t.cats.includes(cat))) && (country === "any" || t.country === country),
      ),
    [tiles, cat, country],
  );
  const filtered = cat !== "any" || country !== "any";
  const visible = filtered || all ? shown : shown.slice(0, FIRST);
  // Hide chips that would show nothing in the chosen country.
  const catCount = (c: Filter) =>
    tiles.filter((t) => (c === "any" || (c === "official" ? t.official : t.cats.includes(c))) && (country === "any" || t.country === country)).length;

  const pick = (nextCat: Filter, nextCountry: CountryCode | "any") => {
    setCat(nextCat);
    setCountry(nextCountry);
    if (nextCat !== "any" || nextCountry !== "any") track("store_filter", { cat: nextCat === "any" ? "" : nextCat, country: nextCountry === "any" ? "" : nextCountry });
  };

  const chip = (active: boolean) =>
    cn(
      "h-9 shrink-0 px-3.5 text-[13px] font-bold transition-colors",
      active ? "bg-brand text-ink" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white",
    );

  return (
    <div className="mt-8">
      <div role="group" aria-label="دسته‌ی کالا" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" aria-pressed={cat === "any"} onClick={() => pick("any", country)} className={chip(cat === "any")}>
          همه
        </button>
        <button type="button" aria-pressed={cat === "official"} onClick={() => pick("official", country)} className={cn(chip(cat === "official"), "inline-flex items-center gap-1.5")}>
          <BadgeCheck className="size-4" aria-hidden />
          برندهای رسمی
        </button>
        {storeCats
          .filter((c) => catCount(c.key) > 0)
          .map((c) => (
            <button key={c.key} type="button" aria-pressed={cat === c.key} onClick={() => pick(c.key, country)} className={chip(cat === c.key)}>
              {c.name}
            </button>
          ))}
      </div>
      <div role="group" aria-label="کشور" className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            type="button"
            aria-pressed={country === c.code}
            onClick={() => pick(cat, c.code)}
            className={cn(
              "h-8 shrink-0 px-3 text-xs font-semibold transition-colors",
              country === c.code ? "text-brand underline decoration-2 underline-offset-[6px]" : "text-white/50 hover:text-white",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {toFaDigits(shown.length)} فروشگاه
      </p>
      {shown.length === 0 ? (
        <p className="mt-8 bg-[#111] p-8 text-center text-sm leading-7 text-white/60 ring-1 ring-inset ring-white/8">
          در این دسته و کشور فروشگاهی پیشنهاد نداریم.{" "}
          <button type="button" onClick={() => pick("any", "any")} className="font-bold text-brand underline underline-offset-4">
            همه را نشان بده
          </button>
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((s, i) => (
            <li key={s.key} className={cn(!filtered && !all && i >= FIRST_NARROW && "hidden xl:block")}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener nofollow noreferrer"
                title={`${s.label}، ${s.name}: ${s.hint}`}
                className="group relative flex h-full items-center gap-2.5 bg-[#111] p-2.5 ring-1 ring-inset ring-white/8 transition-colors hover:bg-[#161616] hover:ring-brand/50 sm:gap-3 sm:p-3"
              >
                {s.deal && (
                  <span className="absolute -top-2 left-2 bg-brand px-1.5 py-0.5 text-[10px] font-black leading-none text-ink sm:text-[11px]">{dealText(s.deal)}</span>
                )}
                <StoreIcon src={s.icon} label={s.label} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span dir="ltr" className="truncate text-[14px] font-black leading-tight text-white transition-colors group-hover:text-brand sm:text-[15px]">
                      {s.label}
                    </span>
                    {s.official && <BadgeCheck className="size-3.5 shrink-0 text-brand" aria-label="فروشگاه رسمی برند" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-5 text-white/50 sm:text-xs">{s.hint}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-4 text-white/35 sm:text-[11px]">
                    {s.countryName}
                    {s.hot && (
                      <span className="inline-flex items-center gap-0.5 font-bold text-brand">
                        <Flame className="size-3" aria-hidden />
                        پرطرفدار
                      </span>
                    )}
                  </span>
                </span>
                <ArrowUpLeft className="hidden size-4 shrink-0 text-white/25 transition-colors group-hover:text-brand sm:block" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
      {!filtered && !all && shown.length > FIRST_NARROW && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-4 h-12 w-full bg-white/[0.06] text-sm font-bold text-white/80 ring-1 ring-inset ring-white/8 transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          نمایش همه‌ی {toFaDigits(shown.length)} فروشگاه
        </button>
      )}
      <p className="mt-4 text-[11px] leading-5 text-white/35">درصد تخفیف‌ها طبق اعلام خود فروشگاه‌ها برای بلک‌فرایدی امسال است و روی همه‌ی کالاها نیست.</p>
    </div>
  );
}

/** The store's own site icon on a white tile; its initial when there is none (or it fails to load). */
function StoreIcon({ src, label }: { src?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden bg-white sm:size-11" aria-hidden>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny cached icons from our own domain
        <img src={src} alt="" width={28} height={28} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-7 object-contain sm:size-8" />
      ) : (
        <span dir="ltr" className="text-lg font-black text-ink">
          {label.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
