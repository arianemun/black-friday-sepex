import Link from "next/link";
import { SepexLogo } from "@/components/brand/logo";

const nav = [
  { href: "/#deals", label: "پیشنهادها" },
  { href: "/#categories", label: "چی بیاریم؟" },
  { href: "/#how", label: "روش کار" },
  { href: "/#stores", label: "فروشگاه‌ها" },
  { href: "/#faq", label: "سؤالات" },
];

export function SiteHeader({ variant = "dark" }: { variant?: "dark" | "solid" | "light" }) {
  const dark = variant !== "light";
  return (
    <header
      className={
        variant === "dark" ? "absolute inset-x-0 top-0 z-30 text-white" : variant === "solid" ? "relative z-30 border-b border-white/10 text-white" : "border-b border-ink/10 bg-paper text-ink"
      }
    >
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-6 px-4 sm:h-20 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex w-fit items-center gap-3" aria-label="بلک‌فرایدی سپکس، صفحه‌ی اصلی">
          <SepexLogo className={dark ? "h-7 text-brand sm:h-8" : "h-7 text-ink sm:h-8"} />
        </Link>
        <nav aria-label="بخش‌های صفحه" className="hidden items-center gap-1 text-sm md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={dark ? "chamfer-sm px-4 py-2 font-medium text-white/75 transition-colors hover:bg-brand hover:text-ink focus-visible:bg-brand focus-visible:text-ink focus-visible:outline-none" : "chamfer-sm px-4 py-2 font-medium text-ink/70 transition-colors hover:bg-brand hover:text-ink"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/track"
            className={
              dark
                ? "px-3 py-2 text-sm font-semibold text-white/80 hover:text-brand"
                : "px-3 py-2 text-sm font-semibold text-ink/70 hover:text-ink"
            }
          >
            پیگیری
          </Link>
          <Link
            href="/order"
            className={
              dark
                ? "chamfer-sm hidden bg-brand px-4 py-2.5 text-sm font-bold text-ink hover:bg-brand-deep sm:inline-flex"
                : "chamfer-sm hidden bg-ink px-4 py-2.5 text-sm font-bold text-brand hover:bg-neutral-800 sm:inline-flex"
            }
          >
            ثبت سفارش
          </Link>
        </div>
      </div>
    </header>
  );
}
