"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import type { realtime } from "@/lib/rec/analytics";
import { EVENT_LABELS, channelOf, eventDetail } from "@/lib/rec/analytics-shared";
import { cn, toFaDigits } from "@/lib/utils";

type Data = ReturnType<typeof realtime>;

const deviceLabel: Record<string, string> = { mobile: "موبایل", tablet: "تبلت", desktop: "دسکتاپ" };
const pageLabel = (p: string) => (p === "/" ? "صفحه‌ی اصلی" : p.startsWith("/order") ? "ثبت سفارش" : p.startsWith("/track") ? "پیگیری سفارش" : p);
const ago = (iso: string | number, now: number) => {
  const s = Math.max(0, Math.round((now - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000));
  return s < 60 ? `${toFaDigits(s)} ثانیه پیش` : `${toFaDigits(Math.floor(s / 60))} دقیقه پیش`;
};

/** Polls /admin/insights/realtime-data every 5 s while the tab is visible. */
export function RealtimeView({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.at));
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/admin/insights/realtime-data", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = (await r.json()) as Data;
        if (!stop) {
          setData(d);
          setNow(Date.parse(d.at));
          setStale(false);
        }
      } catch {
        if (!stop) setStale(true);
      }
    };
    const t = setInterval(load, 5000);
    const c = setInterval(() => setNow((n) => n + 1000), 1000);
    return () => {
      stop = true;
      clearInterval(t);
      clearInterval(c);
    };
  }, []);

  const active = data.active.filter((s) => now - Date.parse(s.last_at) < 5 * 60_000);
  const max = Math.max(1, ...data.perMinute);
  const onForm = active.filter((s) => (s.current_path ?? "").startsWith("/order")).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#52525B]">کاربران در ۵ دقیقه‌ی اخیر</span>
            <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold", stale ? "text-[#B45309]" : "text-[#15803D]")}>
              <Radio className={cn("size-3.5", !stale && "animate-pulse")} aria-hidden />
              {stale ? "قطع ارتباط، تلاش دوباره…" : "زنده"}
            </span>
          </div>
          <span className="text-[44px] font-extrabold leading-none tracking-tight text-[#18181B]">{toFaDigits(active.length)}</span>
          <span className="text-[12px] text-[#71717A]">
            {toFaDigits(onForm)} نفر در فرم سفارش، {toFaDigits(data.orders30)} سفارش در ۳۰ دقیقه‌ی اخیر
          </span>
          <div>
            <div className="flex h-16 items-end gap-[2px]" role="img" aria-label="کاربران فعال در ۳۰ دقیقه‌ی اخیر">
              {data.perMinute.map((v, i) => (
                <div key={i} className="group relative flex h-full flex-1 items-end">
                  <div className="w-full rounded-t-[2px] bg-[#93C5FD] group-hover:bg-[#2563EB]" style={{ height: `${v ? Math.max(4, (v / max) * 100) : 0}%` }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#18181B] px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {toFaDigits(v)} کاربر، {toFaDigits(29 - i)} دقیقه پیش
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[#A1A1AA]">
              <span>۳۰ دقیقه پیش</span>
              <span>الان</span>
            </div>
          </div>
        </section>
        <Breakdown title="صفحه‌ی فعلی" rows={data.pages.map(([k, v]) => [pageLabel(k), v])} total={active.length} />
        <div className="flex flex-col gap-4">
          <Breakdown title="کانال ورود" rows={data.sources} total={active.length} />
          <Breakdown title="دستگاه" rows={data.devices.map(([k, v]) => [deviceLabel[k] ?? k, v])} total={active.length} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
          <h2 className="border-b border-[#F4F4F5] px-4 py-3 text-[15px] font-bold text-[#18181B]">بازدیدکننده‌های آنلاین</h2>
          {active.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#71717A]">الان کسی روی سایت نیست.</p>
          ) : (
            <ul className="flex max-h-[520px] flex-col divide-y divide-[#F4F4F5] overflow-y-auto">
              {active.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className={cn("size-2 shrink-0 rounded-full", now - Date.parse(s.last_at) < 30_000 ? "bg-[#16A34A]" : "bg-[#A1A1AA]")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[#18181B]">
                      {pageLabel(s.current_path ?? s.entry_path ?? "/")}
                      {s.tracking_code && <span className="ms-1.5 rounded bg-[#DCFCE7] px-1.5 py-0.5 text-[11px] text-[#15803D]">سفارش داد</span>}
                      {!s.tracking_code && s.reached_order === 1 && <span className="ms-1.5 rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[11px] text-[#1D4ED8]">در فرم</span>}
                      {s.rage_clicks > 0 && <span className="ms-1.5 rounded bg-[#FEE2E2] px-1.5 py-0.5 text-[11px] text-[#B91C1C]">کلیک عصبی</span>}
                    </div>
                    <div className="text-[11px] text-[#71717A]">
                      {deviceLabel[s.device] ?? s.device}، {s.os}، {channelOf(s)}
                      {s.utm_source ? ` (${s.utm_source})` : ""}، {toFaDigits(s.pages)} صفحه، {s.return_visit ? "بازگشتی" : "جدید"}، آخرین فعالیت {ago(s.last_at, now)}
                    </div>
                  </div>
                  <Link href={`/admin/insights/sessions/${s.id}?live=1`} className="flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
                    <Radio className="size-3.5" aria-hidden /> تماشای زنده
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
          <h2 className="border-b border-[#F4F4F5] px-4 py-3 text-[15px] font-bold text-[#18181B]">رویدادهای ۳۰ دقیقه‌ی اخیر</h2>
          {data.stream.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#71717A]">رویدادی نیست.</p>
          ) : (
            <ol className="flex max-h-[520px] flex-col divide-y divide-[#F4F4F5] overflow-y-auto">
              {data.stream.map((e, i) => (
                <li key={`${e.sid}-${e.ts}-${i}`}>
                  <Link href={`/admin/insights/sessions/${e.sid}`} className="flex items-center gap-3 px-4 py-2 hover:bg-[#FAFAFA]">
                    <span className={cn("size-2 shrink-0 rounded-full", KIND_DOT[e.kind] ?? "bg-[#7C3AED]")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#3F3F46]">{describe(e)}</span>
                    <span className="shrink-0 text-[11px] text-[#A1A1AA]">{ago(e.ts, now)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

const KIND_DOT: Record<string, string> = { page: "bg-[#2563EB]", rage: "bg-[#DC2626]", dead: "bg-[#D97706]", ev: "bg-[#7C3AED]" };

function describe(e: Data["stream"][number]) {
  if (e.kind === "page") return `صفحه: ${pageLabel(e.path)}`;
  if (e.kind === "rage") return `کلیک عصبی روی «${e.name ?? "؟"}»`;
  if (e.kind === "dead") return `کلیک بی‌اثر روی «${e.name ?? "؟"}»`;
  const base = EVENT_LABELS[e.name ?? ""] ?? e.name ?? "رویداد";
  const extra = eventDetail(e.name ?? "", e.props);
  return extra ? `${base}: ${extra}` : base;
}

function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h2 className="text-[14px] font-bold text-[#18181B]">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[12px] text-[#A1A1AA]">—</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.slice(0, 6).map(([k, v]) => (
            <li key={k} className="flex flex-col gap-1">
              <div className="flex justify-between text-[12px]">
                <span className="truncate">{k}</span>
                <span className="font-bold">{toFaDigits(v)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F4F4F5]">
                <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
