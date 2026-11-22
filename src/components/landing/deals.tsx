"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { categories, countries, countryName, storeByKey } from "@/lib/catalog";
import type { PublicProduct } from "@/lib/products";
import { cn, toFaDigits } from "@/lib/utils";

const formatPrice = (price: string | null, currency: string | null) => {
  if (!price) return null;
  const n = Number(String(price).replace(/,/g, ""));
  const v = Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) : price;
  return `${v}${currency ? ` ${currency}` : ""}`;
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 border px-3.5 py-2 text-sm font-semibold transition-colors",
        active ? "border-ink bg-ink text-brand" : "border-ink/15 bg-white text-ink/75 hover:border-ink/50"
      )}
    >
      {children}
    </button>
  );
}

export function Deals({ products }: { products: PublicProduct[] }) {
  const [cat, setCat] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");

  const usedCats = useMemo(() => categories.filter((c) => products.some((p) => p.category === c.key)), [products]);
  const usedCountries = useMemo(() => countries.filter((c) => products.some((p) => p.country === c.code)), [products]);
  const list = products.filter((p) => (cat === "all" || p.category === cat) && (country === "all" || p.country === country));

  return (
    <div>
      <div className="flex flex-col gap-3">
        {usedCats.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="دسته‌بندی">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>همه</Chip>
            {usedCats.map((c) => (
              <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.name}</Chip>
            ))}
          </div>
        )}
        {usedCountries.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="کشور">
            <Chip active={country === "all"} onClick={() => setCountry("all")}>همه‌ی کشورها</Chip>
            {usedCountries.map((c) => (
              <Chip key={c.code} active={country === c.code} onClick={() => setCountry(c.code)}>{c.name}</Chip>
            ))}
          </div>
        )}
      </div>

      <ul className="mt-6 grid grid-cols-2 border-r border-t border-ink/10 md:grid-cols-3 xl:grid-cols-4">
        {list.map((p) => {
          const store = storeByKey(p.storeKey);
          const price = formatPrice(p.price, p.currency);
          const old = formatPrice(p.oldPrice, p.currency);
          return (
            <li key={p.id} className="group flex flex-col border-b border-l border-ink/10 bg-white">
              <div className="relative aspect-square overflow-hidden bg-white p-4">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from our own /media route
                  <img src={p.image} alt={p.title} loading="lazy" decoding="async" className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-paper text-sm text-ink/40">بدون تصویر</div>
                )}
                {p.discount ? (
                  <span className="chamfer-sm absolute right-0 top-3 bg-brand px-2.5 py-1 text-sm font-black text-ink">٪{toFaDigits(p.discount)} تخفیف</span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 border-t border-ink/5 p-3 sm:p-4">
                <p className="text-xs text-ink/55">
                  {store?.name ?? "فروشگاه خارجی"}
                  {p.country ? `، ${countryName(p.country)}` : ""}
                </p>
                <h3 dir="auto" className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-ink">{p.title}</h3>
                {price && (
                  <p dir="ltr" className="text-left">
                    <span className="font-black text-ink">{price}</span>
                    {old && <span className="mr-2 text-xs text-ink/40 line-through">{old}</span>}
                  </p>
                )}
                <div className="mt-auto flex items-stretch gap-1.5 pt-1">
                  <Link
                    href={`/order?method=link&link=${encodeURIComponent(p.url)}`}
                    className="flex flex-1 items-center justify-center bg-ink px-2 py-2.5 text-center text-xs font-bold text-brand hover:bg-neutral-800 sm:text-sm"
                  >
                    همینو برام بیار
                  </Link>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener nofollow noreferrer"
                    className="flex w-10 items-center justify-center border border-ink/15 text-ink/60 hover:border-ink hover:text-ink"
                    aria-label={`دیدن در ${store?.name ?? "فروشگاه"}`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="mt-6 text-center text-ink/60">در این دسته فعلاً پیشنهادی نیست. فیلتر دیگری را امتحان کنید.</p>}
    </div>
  );
}
