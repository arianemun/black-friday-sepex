"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Link2 } from "lucide-react";
import { track } from "@/lib/rec/track";
import { detectStore, extractUrl, countryName } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * The hero input: paste a link (or a whole share message) and continue to the order flow.
 * Typed text without a link is taken as the product's name and opens the photo/name flow with it.
 */
export function LinkStarter({
  placeholder,
  submit,
}: {
  placeholder: string;
  submit: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const url = extractUrl(value);
  const store = url ? detectStore(url) : undefined;
  const text = value.replace(/\s+/g, " ").trim();
  // A half-pasted link ("amazon.ae/dp/…") is still a link, not a name.
  const looksLikeLink = /^(https?:|www\.)|\.(com|ae|tr|de|net|cn|co)\b\/?/i.test(text);
  const name = !url && text.length >= 2 && !looksLikeLink ? text : null;

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (url) {
      router.push(`/order?method=link&link=${encodeURIComponent(url)}`);
      return;
    }
    if (name) {
      track("hero_name", { len: name.length });
      router.push(`/order?method=photo&name=${encodeURIComponent(name.slice(0, 120))}`);
      return;
    }
    setError(text ? "این لینک کامل نیست. لینک کامل صفحه‌ی کالا رو بذار یا اسم کالا رو بنویس." : "لینک یا اسم کالا رو اینجا بنویس.");
  }

  return (
    <form onSubmit={go} className="w-full text-start" noValidate>
      <label htmlFor="hero-link" className="sr-only">
        {placeholder}
      </label>
      <div className="drop-shadow-[0_18px_40px_rgb(255_203_5/0.18)]">
        <div className="chamfer bg-white/15 p-px transition-colors focus-within:bg-brand/70">
          <div className="chamfer flex flex-col gap-2 bg-[#141414] p-2 sm:flex-row">
            <div className="relative flex-1">
              <Link2
                className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-white/40"
                aria-hidden
              />
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
                className="h-13 w-full bg-transparent pl-12 pr-11 text-base text-white outline-none placeholder:text-white/40"
              />
              <Link
                href="/order?method=photo"
                aria-label="عکس یا اسکرین‌شات کالا رو بفرست"
                title="عکس یا اسکرین‌شات کالا رو بفرست"
                className="absolute left-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-white/55 transition-colors hover:bg-white/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Camera className="size-5" aria-hidden />
              </Link>
            </div>
            <button
              type="submit"
              className="chamfer-sm inline-flex h-13 items-center justify-center gap-2 bg-brand px-6 text-base font-black text-ink transition-colors hover:bg-[#ffd633] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
            >
              {submit}
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <p
        id="hero-link-hint"
        className={cn(
          "mt-2.5 min-h-5 text-center text-sm",
          error ? "font-semibold text-red-300" : "text-white/50",
        )}
      >
        {error ??
          (store
            ? `فروشگاه: ${store.name} (${countryName(store.country)})`
            : url
              ? "لینک رسید. فروشگاهش رو کارشناس بررسی می‌کنه."
              : name
                ? "لینک نیست؟ اشکال نداره؛ با همین اسم ثبتش می‌کنیم و کارشناس پیداش می‌کنه."
                : "متن اشتراک‌گذاری اپ فروشگاه رو هم می‌تونی کامل بچسبونی.")}
      </p>
    </form>
  );
}
