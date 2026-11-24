import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SepexLogo } from "@/components/brand/logo";

/** Routes from the five origins to Iran, drawn as an orbit around the SEPEX mark. */

const R = 38; // node ring radius (viewBox units)
const LABEL_R = 46.5;
const NODES = [
  { name: "چین", deg: -90, main: true },
  { name: "امارات", deg: -18, main: true },
  { name: "ترکیه", deg: 54, main: false },
  { name: "آمریکا", deg: 126, main: false },
  { name: "اروپا", deg: 198, main: false },
].map((n) => {
  const rad = (n.deg * Math.PI) / 180;
  const at = (r: number) => ({ x: +(50 + r * Math.cos(rad)).toFixed(2), y: +(50 + r * Math.sin(rad)).toFixed(2) });
  return { ...n, ...at(R), label: at(LABEL_R) };
});

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
          <p className="mt-5 max-w-md leading-8 text-white/55">بلک‌فرایدی امسال بی‌مرزه: چین، امارات، اروپا، آمریکا و ترکیه. خرید، حمل و ترخیص؛ همه‌اش توی یه مسیر و با یه کد پیگیری.</p>
          <Link href="/order" className="chamfer-sm mt-8 inline-flex h-12 items-center gap-2 bg-white px-6 text-sm font-black text-ink hover:bg-brand">
            ثبت سفارش
            <ArrowLeft className="size-4" />
          </Link>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[34rem]" aria-hidden>
          {/* radar sweep */}
          <div className="orbit-sweep absolute inset-[9%] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,rgb(255_203_5/0.09)_355deg,transparent_360deg)]" />
          <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgb(255_203_5/0.16),transparent_50%)]" />

          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
            {[8, 14, 20, 26, 32, R, 44].map((r) => (
              <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={r === R ? "rgb(255 203 5 / 0.14)" : "rgb(255 255 255 / 0.06)"} strokeWidth="0.25" />
            ))}
            <circle cx="50" cy="50" r="49" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="0.25" strokeDasharray="0.6 1.4" />
            {NODES.map((n, i) => (
              <g key={n.name}>
                <line x1={n.x} y1={n.y} x2="50" y2="50" stroke={n.main ? "rgb(255 203 5 / 0.5)" : "rgb(255 203 5 / 0.22)"} strokeWidth="0.3" />
                <line
                  x1={n.x}
                  y1={n.y}
                  x2="50"
                  y2="50"
                  stroke="#FFCB05"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                  className="route-dash"
                  strokeDasharray="3 40"
                  style={{ animationDelay: `${-i * 0.55}s`, filter: "drop-shadow(0 0 1.2px #FFCB05)" }}
                />
              </g>
            ))}
            {/* nodes sit exactly on the line ends */}
            {NODES.map((n) => (
              <g key={n.name} transform={`translate(${n.x} ${n.y})`}>
                {n.main && <circle r="3" fill="rgb(255 203 5 / 0.14)" />}
                <rect x="-1.5" y="-1.5" width="3" height="3" transform={`rotate(${n.deg - 45})`} fill={n.main ? "#FFCB05" : "#000"} stroke="#FFCB05" strokeOpacity={n.main ? 1 : 0.75} strokeWidth="0.45" />
              </g>
            ))}
          </svg>

          {/* labels, pushed outward along each route */}
          {NODES.map((n) => (
            <span
              key={n.name}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-black sm:text-sm ${n.main ? "text-brand" : "text-white/75"}`}
              style={{ left: `${n.label.x}%`, top: `${n.label.y}%` }}
            >
              {n.name}
            </span>
          ))}

          {/* centre: SEPEX mark */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="chamfer relative flex size-24 items-center justify-center bg-[linear-gradient(145deg,#FFE066_0%,#FFCB05_45%,#E0A800_100%)] shadow-[0_0_90px_rgb(255_203_5/0.55)] sm:size-28">
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.45)_0%,transparent_35%)]" />
              <SepexLogo className="relative h-9 text-ink sm:h-11" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
