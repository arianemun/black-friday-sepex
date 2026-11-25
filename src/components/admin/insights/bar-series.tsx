import { toFaDigits } from "@/lib/utils";

/**
 * Time series as thin bars (one hue) with an optional overlaid second measure as a darker inner bar.
 * Hover shows the tooltip; labels thin out automatically on long ranges.
 */
export function BarSeries({
  rows,
  hourly,
  legend,
}: {
  rows: { b: string; value: number; sub?: number; tip: string }[];
  hourly: boolean;
  legend?: [string, string];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const every = Math.ceil(rows.length / 12);
  const label = (b: string) => {
    if (hourly) return toFaDigits(Number(b.slice(11, 13)));
    return new Intl.DateTimeFormat("fa-IR", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(`${b}T12:00:00Z`));
  };
  return (
    <div className="flex flex-col gap-2">
      {legend && (
        <div className="flex gap-3.5 text-xs text-[#52525B]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[#93C5FD]" />
            {legend[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[#1D4ED8]" />
            {legend[1]}
          </span>
        </div>
      )}
      <div className="flex h-[200px] items-end gap-[2px] border-b border-[#E4E4E7] px-1" role="img" aria-label="نمودار زمانی">
        {rows.map((r) => (
          <div key={r.b} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div
              className="relative w-full rounded-t-[3px] bg-[#93C5FD] transition-colors group-hover:bg-[#60A5FA]"
              style={{ height: `${r.value ? Math.max(2, (r.value / max) * 100) : 0}%` }}
            >
              {!!r.sub && (
                <div className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-[#1D4ED8]" style={{ height: `${Math.min(100, (r.sub / Math.max(1, r.value)) * 100)}%` }} />
              )}
            </div>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#18181B] px-2 py-1 text-[11px] text-white group-hover:block">
              {r.tip}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] px-1 text-[10px] text-[#71717A]">
        {rows.map((r, i) => (
          <span key={r.b} className="min-w-0 flex-1 truncate text-center">
            {i % every === 0 ? label(r.b) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
