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
  logo?: string;
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
const FIRST = 12;

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
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((s) => (
            <li key={s.key}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener nofollow noreferrer"
                className="group relative flex h-full flex-col bg-[#111] p-4 ring-1 ring-inset ring-white/8 transition-all hover:-translate-y-0.5 hover:ring-brand/50 sm:p-5"
              >
                {s.deal && (
                  <span className="chamfer-sm absolute -top-2 left-3 bg-brand px-2 py-1 text-[11px] font-black leading-none text-ink">{dealText(s.deal)}</span>
                )}
                <span className="flex h-14 items-center justify-start">
                  {s.logo ? (
                    <span className="flex h-12 items-center bg-white px-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- small static logo files */}
                      <img src={s.logo} alt={s.label} className="max-h-8 max-w-[7rem] object-contain" loading="lazy" />
                    </span>
                  ) : (
                    <span dir="ltr" className="text-[1.35rem] font-black leading-none text-white transition-colors group-hover:text-brand sm:text-2xl">
                      {s.label}
                    </span>
                  )}
                </span>
                <span className="mt-2 text-[13px] font-bold text-white/85">{s.name}</span>
                <span className="mt-1 text-xs leading-5 text-white/50">{s.hint}</span>
                <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-[11px]">
                  <span className="bg-white/[0.06] px-2 py-1 text-white/60">{s.countryName}</span>
                  {s.official && (
                    <span className="inline-flex items-center gap-1 bg-white/[0.06] px-2 py-1 text-white/60">
                      <BadgeCheck className="size-3" aria-hidden />
                      رسمی
                    </span>
                  )}
                  {s.hot && (
                    <span className="inline-flex items-center gap-1 bg-brand/15 px-2 py-1 font-bold text-brand">
                      <Flame className="size-3" aria-hidden />
                      پرطرفدار
                    </span>
                  )}
                  <span className="ms-auto flex items-center gap-1 font-bold text-white/40 transition-colors group-hover:text-brand">
                    سر بزن <ArrowUpLeft className="size-3.5" aria-hidden />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {!filtered && !all && shown.length > FIRST && (
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
