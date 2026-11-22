import Link from "next/link";
import { SepexLogo } from "@/components/brand/logo";

const nav = [
  { href: "/#deals", label: "پیشنهادها" },
  { href: "/#how", label: "روش کار" },
  { href: "/#stores", label: "فروشگاه‌ها" },
  { href: "/#faq", label: "سؤالات" },
];

export function SiteHeader({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const dark = variant === "dark";
  return (
    <header className={dark ? "absolute inset-x-0 top-0 z-30 text-white" : "border-b border-ink/10 bg-paper text-ink"}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:h-20 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="بلک‌فرایدی سپکس، صفحه‌ی اصلی">
          <SepexLogo className={dark ? "h-7 text-brand sm:h-8" : "h-7 text-ink sm:h-8"} />
        </Link>
        <nav aria-label="بخش‌های صفحه" className="hidden items-center gap-6 text-sm md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={dark ? "text-white/70 hover:text-brand" : "text-ink/70 hover:text-ink"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
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
