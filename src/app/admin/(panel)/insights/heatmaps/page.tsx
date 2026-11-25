import { requireInsights } from "@/lib/auth";
import { heatBackdrop, heatClicks, heatScroll, parseRange, pathsList, sinceIso, type HeatDevice } from "@/lib/rec/insights";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { LinkSegments } from "@/components/admin/link-segments";
import { InsightsNav, pageLabel } from "@/components/admin/insights/insights-nav";
import { HeatmapView } from "@/components/admin/insights/heatmap-view";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "هیت‌مپ" };
export const dynamic = "force-dynamic";

export default async function HeatmapsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const sp = await searchParams;
  const range = parseRange(sp.d);
  const since = sinceIso(range);
  const paths = pathsList(since);
  const path = sp.path && paths.includes(sp.path) ? sp.path : (paths[0] ?? "/");
  const device: HeatDevice = sp.device === "mobile" ? "mobile" : "desktop";
  const mode = sp.mode === "scroll" ? "scroll" : "clicks";
  const clicks = heatClicks(path, device, since);
  const scroll = heatScroll(path, device, since);
  const bd = heatBackdrop(path, device, since);

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ d: String(range), path, device, mode, ...patch });
    return `/admin/insights/heatmaps?${p}`;
  };

  // Most-clicked elements, from the same data the map shows.
  const top = new Map<string, number>();
  for (const c of clicks) if (c.label) top.set(c.label, (top.get(c.label) ?? 0) + 1);
  const topList = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const rage = clicks.filter((c) => c.rage === 1).length;
  const dead = clicks.filter((c) => c.dead).length;

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="کجای صفحه کلیک می‌شود و بازدیدکننده‌ها تا کجای صفحه پایین می‌آیند." />
      <InsightsNav active="heatmaps" range={range} extra={`&path=${encodeURIComponent(path)}&device=${device}&mode=${mode}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="d" value={range} />
          <input type="hidden" name="device" value={device} />
          <input type="hidden" name="mode" value={mode} />
          <select
            name="path"
            defaultValue={path}
            aria-label="صفحه"
            className="h-9 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]"
          >
            {(paths.length ? paths : ["/"]).map((p) => (
              <option key={p} value={p}>
                {pageLabel(p)} ({p})
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-lg bg-[#18181B] px-3 text-[13px] font-semibold text-white hover:bg-[#3F3F46]">
            نمایش
          </button>
        </form>
        <LinkSegments
          label="دستگاه"
          items={[
            { href: href({ device: "desktop" }), label: "دسکتاپ", active: device === "desktop" },
            { href: href({ device: "mobile" }), label: "موبایل", active: device === "mobile" },
          ]}
        />
        <LinkSegments
          label="نوع نقشه"
          items={[
            { href: href({ mode: "clicks" }), label: "کلیک‌ها", active: mode === "clicks" },
            { href: href({ mode: "scroll" }), label: "عمق اسکرول", active: mode === "scroll" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <HeatmapView key={`${path}|${device}|${bd?.session_id}`} backdrop={bd ? { sid: bd.session_id, ts: bd.ts } : null} mode={mode} clicks={clicks} scroll={scroll} />
        <div className="flex flex-col gap-4">
          <Panel title="خلاصه">
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-[#71717A]">بازدید این صفحه</dt>
                <dd className="font-bold">{toFaDigits(scroll.length)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#71717A]">کلیک</dt>
                <dd className="font-bold">{toFaDigits(clicks.length)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#71717A]">کلیک عصبی</dt>
                <dd className="font-bold text-[#B91C1C]">{toFaDigits(rage)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#71717A]">کلیک بی‌اثر</dt>
                <dd className="font-bold text-[#1D4ED8]">{toFaDigits(dead)}</dd>
              </div>
            </dl>
            {mode === "clicks" && (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#71717A]">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full border-2 border-[#DC2626]" />
                  کلیک عصبی
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full border-2 border-[#2563EB]" />
                  کلیک بی‌اثر
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-8 rounded-sm bg-gradient-to-l from-[#9A3412] via-[#F97316] to-[#FED7AA]" />
                  تراکم کلیک
                </span>
              </p>
            )}
          </Panel>
          {mode === "clicks" && topList.length > 0 && (
            <Panel title="بیشترین کلیک‌ها">
              <ol className="flex flex-col gap-2">
                {topList.map(([label, count]) => (
                  <li key={label} className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate">«{label}»</span>
                    <span className="shrink-0 font-bold">{toFaDigits(count)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
          <p className="text-[11px] leading-5 text-[#71717A]">
            پس‌زمینه از ضبط یکی از بازدیدکننده‌ها ساخته می‌شود، پس ممکن است بخش‌های متحرک صفحه کمی با سایت فعلی فرق داشته باشند. نقطه‌ها به نسبت عرض و ارتفاع صفحه‌ی هر بازدیدکننده جابه‌جا شده‌اند.
          </p>
        </div>
      </div>
    </>
  );
}
