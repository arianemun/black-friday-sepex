"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { detectStore, extractUrl, countryName } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** The hero input: paste a link (or a whole share message) and continue to the order flow. */
export function LinkStarter({ placeholder, submit }: { placeholder: string; submit: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const url = extractUrl(value);
  const store = url ? detectStore(url) : undefined;

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!url) {
      setError(value.trim() ? "این لینک معتبر نیست. لینک کامل صفحه‌ی کالا را بگذارید." : "لینک صفحه‌ی کالا را اینجا بگذارید.");
      return;
    }
    router.push(`/order?method=link&link=${encodeURIComponent(url)}`);
  }

  return (
    <form onSubmit={go} className="w-full" noValidate>
      <label htmlFor="hero-link" className="sr-only">
        {placeholder}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-ink/50" aria-hidden />
          <input
            id="hero-link"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={placeholder}
            aria-invalid={!!error}
            aria-describedby="hero-link-hint"
            className="h-14 w-full border-2 border-ink bg-white pl-3 pr-11 text-base text-ink outline-none placeholder:text-ink/45 focus-visible:ring-4 focus-visible:ring-ink/20"
          />
        </div>
        <button
          type="submit"
          className="chamfer-sm inline-flex h-14 items-center justify-center gap-2 bg-ink px-6 text-base font-bold text-brand transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {submit}
          <ArrowLeft className="size-5" aria-hidden />
        </button>
      </div>
      <p id="hero-link-hint" className={cn("mt-2 min-h-5 text-sm", error ? "font-semibold text-red-800" : "text-ink/70")}>
        {error ??
          (store
            ? `فروشگاه: ${store.name} (${countryName(store.country)})`
            : url
              ? "لینک دریافت شد. فروشگاه را کارشناس بررسی می‌کند."
              : "متن اشتراک‌گذاری اپ فروشگاه را هم می‌توانید کامل بچسبانید.")}
      </p>
    </form>
  );
}
