import { requireInsights } from "@/lib/auth";
import { parseScope, scopeQuery, sourceOptions } from "@/lib/rec/analytics";
import { heatBackdrop, heatClicks, heatMoves, heatScroll, pathsList, type HeatDevice } from "@/lib/rec/insights";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { LinkSegments } from "@/components/admin/link-segments";
import { InsightsNav, pageLabel } from "@/components/admin/insights/insights-nav";
import { HeatmapView, type HeatMode } from "@/components/admin/insights/heatmap-view";
import { toFaDigits } from "@/lib/utils";

export const metadata = { title: "هیت‌مپ" };
export const dynamic = "force-dynamic";

const MODES: { key: HeatMode; label: string; desktopOnly?: boolean }[] = [
  { key: "clicks", label: "کلیک‌ها" },
  { key: "scroll", label: "عمق اسکرول" },
  { key: "attention", label: "توجه" },
  { key: "moves", label: "حرکت ماوس", desktopOnly: true },
];

const HELP: Record<HeatMode, string> = {
  clicks: "هر کلیک روی همان المانی نشانده می‌شود که بازدیدکننده زده بود؛ حلقه‌ی قرمز کلیک عصبی و حلقه‌ی آبی کلیک بی‌اثر است.",
  scroll: "هرچه پایین‌تر بروید تیره‌تر می‌شود، یعنی بازدیدکننده‌ی کمتری تا آنجا آمده است.",
  attention: "میانگین زمانی که هر بخش صفحه واقعاً جلوی چشم بازدیدکننده بوده (فقط وقتی تب باز و فعال بوده).",
  moves: "جاهایی که ماوس بیشتر روی آن‌ها مانده؛ معمولاً همان جایی است که چشم می‌خواند. فقط دسکتاپ.",
};

export default async function HeatmapsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const sp = await searchParams;
  // The device here is the map's own switch, not the shared device filter.
  const scope = { ...parseScope(sp), device: undefined };
  const paths = pathsList(scope);
  const path = sp.path && paths.includes(sp.path) ? sp.path : (paths[0] ?? "/");
  const device: HeatDevice = sp.hdev === "mobile" ? "mobile" : "desktop";
  const requested = MODES.find((m) => m.key === sp.mode)?.key ?? "clicks";
  const mode: HeatMode = requested === "moves" && device === "mobile" ? "clicks" : requested;
  const clicks = heatClicks(scope, path, device);
  const views = heatScroll(scope, path, device);
  const moves = device === "desktop" && mode === "moves" ? heatMoves(scope, path) : [];
  const bd = heatBackdrop(scope, path, device);

  const own = { path, hdev: device, mode };
  const href = (patch: Record<string, string>) => `/admin/insights/heatmaps?${scopeQuery(scope, { ...own, ...patch })}`;

  // Most-clicked elements, from the same data the map shows.
  const top = new Map<string, number>();
  for (const c of clicks) if (c.label) top.set(c.label, (top.get(c.label) ?? 0) + 1);
  const topList = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const rage = clicks.filter((c) => c.rage === 1).length;
  const dead = clicks.filter((c) => c.dead).length;
  const reached = (pct: number) => (views.length ? Math.round((views.filter((v) => v.max_scroll >= pct).length / views.length) * 100) : 0);

  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="کجای صفحه کلیک می‌شود، کجا خوانده می‌شود و بازدیدکننده‌ها تا کجا پایین می‌آیند." />
      <InsightsNav active="heatmaps" scope={scope} sources={sourceOptions(scope)} extra={own} deviceFilter={false} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="d" value={scope.range} />
          {scope.source && <input type="hidden" name="source" value={scope.source} />}
          <input type="hidden" name="hdev" value={device} />
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
            { href: href({ hdev: "desktop" }), label: "دسکتاپ", active: device === "desktop" },
            { href: href({ hdev: "mobile", mode: mode === "moves" ? "clicks" : mode }), label: "موبایل", active: device === "mobile" },
          ]}
        />
        <LinkSegments
          label="نوع نقشه"
          items={MODES.filter((m) => !m.desktopOnly || device === "desktop").map((m) => ({ href: href({ mode: m.key }), label: m.label, active: mode === m.key }))}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <HeatmapView
          key={`${path}|${device}|${bd?.session_id}`}
          backdrop={bd ? { sid: bd.session_id, ts: bd.ts } : null}
          mode={mode}
          clicks={clicks}
          views={views}
          moves={moves}
        />
        <div className="flex flex-col gap-4">
          <Panel title="خلاصه">
            <dl className="flex flex-col gap-2 text-[13px]">
              <Row k="بازدید این صفحه" v={toFaDigits(views.length)} />
              <Row k="کلیک" v={toFaDigits(clicks.length)} />
              <Row k="کلیک عصبی" v={<span className="text-[#B91C1C]">{toFaDigits(rage)}</span>} />
              <Row k="کلیک بی‌اثر" v={<span className="text-[#1D4ED8]">{toFaDigits(dead)}</span>} />
              <Row k="تا نیمه‌ی صفحه آمدند" v={`${toFaDigits(reached(50))}٪`} />
              <Row k="تا انتهای صفحه آمدند" v={`${toFaDigits(reached(90))}٪`} />
            </dl>
            <p className="text-[11px] leading-5 text-[#71717A]">{HELP[mode]}</p>
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
            پس‌زمینه از ضبط یکی از بازدیدکننده‌ها ساخته می‌شود، پس ممکن است بخش‌های متحرک صفحه کمی با سایت فعلی فرق داشته باشند. جلسه‌های همکاران در نقشه‌ها شمرده نمی‌شوند.
          </p>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[#71717A]">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}
