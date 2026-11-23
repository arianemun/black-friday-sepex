import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SepexLogo } from "@/components/brand/logo";

/** Routes from the five origins to Iran, drawn as an orbit around the SEPEX mark. */

const NODES = [
  { name: "چین", x: 50, y: 12, main: true },
  { name: "امارات", x: 86, y: 38, main: true },
  { name: "ترکیه", x: 74, y: 82, main: false },
  { name: "آمریکا", x: 24, y: 82, main: false },
  { name: "اروپا", x: 13, y: 38, main: false },
];

export function RouteOrbit() {
  return (
    <section className="relative isolate overflow-hidden bg-black py-20 sm:py-28" aria-labelledby="orbit-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <span className="inline-block border border-brand/40 px-3 py-1 text-xs font-semibold text-brand">بلک‌فرایدی سپکس</span>
          <h2 id="orbit-title" className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">
            از هر جای دنیا،
            <br />
            تا ایران
          </h2>
          <p className="mt-5 max-w-md leading-8 text-white/55">چین، امارات، اروپا، آمریکا و ترکیه. خرید از فروشگاه، حمل بین‌المللی و ترخیص گمرکی؛ همه در یک مسیر و با یک کد پیگیری.</p>
          <Link href="/order" className="mt-8 inline-flex h-12 items-center gap-2 bg-white px-6 text-sm font-black text-ink hover:bg-brand">
            ثبت سفارش
            <ArrowLeft className="size-4" />
          </Link>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[34rem]" aria-hidden>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
            {[18, 30, 44].map((r) => (
              <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="0.25" />
            ))}
            <circle cx="50" cy="50" r="49" fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth="0.25" strokeDasharray="0.6 1.4" />
            {NODES.map((n) => (
              <g key={n.name}>
                <line x1={n.x} y1={n.y} x2="50" y2="50" stroke={n.main ? "rgb(255 203 5 / 0.55)" : "rgb(255 203 5 / 0.25)"} strokeWidth="0.3" />
                <line x1={n.x} y1={n.y} x2="50" y2="50" stroke="#FFCB05" strokeWidth="0.6" strokeLinecap="round" className="route-dash" strokeDasharray="2 60" />
              </g>
            ))}
          </svg>
          <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgb(255_203_5/0.18),transparent_55%)]" />

          {/* centre: Iran */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="flex size-24 items-center justify-center bg-brand shadow-[0_0_80px_rgb(255_203_5/0.5)] sm:size-28">
              <SepexLogo className="h-9 text-ink sm:h-11" />
            </span>
            <span className="mt-2 text-sm font-black text-white">ایران</span>
          </div>

          {NODES.map((n) => (
            <div key={n.name} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
              <span className={`size-4 rotate-45 ${n.main ? "bg-brand shadow-[0_0_24px_rgb(255_203_5/0.8)]" : "border-2 border-brand/70 bg-black"}`} />
              <span className={`whitespace-nowrap bg-black/70 px-2 py-0.5 text-sm font-black ${n.main ? "text-brand" : "text-white/80"}`}>{n.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
