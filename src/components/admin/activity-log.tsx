"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleDot,
  Eye,
  Inbox,
  Link2,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  Send,
  StickyNote,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { statusInfo } from "@/lib/catalog";
import { cn, toFaDigits } from "@/lib/utils";

export type LogEvent = {
  id: number;
  type: string;
  body: string | null;
  meta: string | null;
  staff: string | null;
  created_at: string;
};

type Filter = "all" | "actions" | "notes" | "system";

type View = { icon: LucideIcon; tone: string; title: string; detail?: string | null; quote?: string | null; group: Exclude<Filter, "all"> };

const parse = (m: string | null): Record<string, unknown> => {
  try {
    return m ? (JSON.parse(m) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

function describe(e: LogEvent): View {
  const m = parse(e.meta);
  switch (e.type) {
    case "created":
      return { icon: Inbox, tone: "bg-[#FFCB05] text-[#18181B]", title: "مشتری درخواست را ثبت کرد", detail: e.body, group: "system" };
    case "viewed":
      return { icon: Eye, tone: "bg-[#F4F4F5] text-[#71717A]", title: "درخواست را باز کرد", group: "actions" };
    case "status": {
      const from = typeof m.from === "string" ? statusInfo(m.from).name : null;
      return {
        icon: CircleDot,
        tone: "bg-[#DBEAFE] text-[#1D4ED8]",
        title: `وضعیت: ${statusInfo(e.body ?? "").name}`,
        detail: from ? `قبلاً: ${from}` : null,
        group: "actions",
      };
    }
    case "assigned": {
      if (m.auto) return { icon: UserCheck, tone: "bg-[#EDE9FE] text-[#6D28D9]", title: `تخصیص خودکار به ${e.body ?? "کارشناس"}`, group: "system" };
      const title = m.self ? "درخواست را برداشت" : e.body ? `کارشناس مسئول: ${e.body}` : "کارشناس مسئول را برداشت";
      return { icon: UserCheck, tone: "bg-[#EDE9FE] text-[#6D28D9]", title, detail: typeof m.from === "string" && m.from ? `قبلاً: ${m.from}` : null, group: "actions" };
    }
    case "note":
      return { icon: StickyNote, tone: "bg-[#FEF3C7] text-[#B45309]", title: "یادداشت گذاشت", quote: e.body, group: "notes" };
    case "contact": {
      const c = e.body === "whatsapp" ? { icon: MessageCircle, t: "پیام واتس‌اپ را باز کرد" } : e.body === "telegram" ? { icon: Send, t: "تلگرام را باز کرد" } : { icon: Phone, t: "روی تماس تلفنی زد" };
      return { icon: c.icon, tone: "bg-[#DCFCE7] text-[#15803D]", title: c.t, group: "actions" };
    }
    case "refetch":
      return {
        icon: RefreshCw,
        tone: "bg-[#F4F4F5] text-[#52525B]",
        title: "اطلاعات لینک‌ها را دوباره خواند",
        detail: typeof m.total === "number" ? `${toFaDigits(Number(m.ok ?? 0))} از ${toFaDigits(m.total)} لینک خوانده شد` : null,
        group: "actions",
      };
    case "link_meta":
      return {
        icon: Link2,
        tone: "bg-[#F4F4F5] text-[#52525B]",
        title: "اطلاعات لینک‌ها خودکار خوانده شد",
        detail: typeof m.total === "number" ? `${toFaDigits(Number(m.ok ?? 0))} از ${toFaDigits(m.total)} لینک` : null,
        group: "system",
      };
    case "sms": {
      const who = e.body === "expert" ? `کارشناس${typeof m.to === "string" ? ` (${m.to})` : ""}` : "مشتری";
      const state = m.dryRun ? "ارسال نشد (قالب پیامک تنظیم نشده)" : m.ok ? "ارسال شد" : "ارسال ناموفق بود";
      return {
        icon: MessageSquareText,
        tone: m.ok && !m.dryRun ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#B91C1C]",
        title: `پیامک ${who}`,
        detail: state,
        group: "system",
      };
    }
    default:
      return { icon: CircleDot, tone: "bg-[#F4F4F5] text-[#71717A]", title: e.type, detail: e.body, group: "system" };
  }
}

const tz = "Asia/Tehran";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
const timeFa = (iso: string) => new Intl.DateTimeFormat("fa-IR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const fullFa = (iso: string) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: tz, dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
const dayFa = (iso: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

function relative(iso: string, now: number) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 45) return "همین حالا";
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "actions", label: "اقدام‌ها" },
  { key: "notes", label: "یادداشت‌ها" },
  { key: "system", label: "سیستم" },
];

/** Step-by-step activity of one request: who opened it, what they pressed, what the system did. */
export function ActivityLog({ events, composer }: { events: LogEvent[]; composer?: React.ReactNode }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- relative times need the client clock
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const views = useMemo(() => events.map((e) => ({ e, v: describe(e) })), [events]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: views.length, actions: 0, notes: 0, system: 0 };
    for (const { v } of views) c[v.group]++;
    return c;
  }, [views]);
  const shown = filter === "all" ? views : views.filter((x) => x.v.group === filter);

  const today = now ? dayKey(new Date(now).toISOString()) : null;
  const yesterday = now ? dayKey(new Date(now - 86400_000).toISOString()) : null;
  const groups: { key: string; label: string; items: typeof shown }[] = [];
  for (const x of shown) {
    const k = dayKey(x.e.created_at);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) {
      g = { key: k, label: k === today ? "امروز" : k === yesterday ? "دیروز" : dayFa(x.e.created_at), items: [] };
      groups.push(g);
    }
    g.items.push(x);
  }

  return (
    <section className="flex flex-col rounded-xl border border-[#E4E4E7] bg-white" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-2 border-b border-[#F4F4F5] px-5 pb-3 pt-4">
        <h2 id="activity-title" className="text-[15px] font-bold text-[#18181B]">
          گزارش فعالیت
        </h2>
        <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-semibold text-[#52525B]">{toFaDigits(events.length)} رویداد</span>
      </div>
      {composer && <div className="border-b border-[#F4F4F5] px-5 py-4">{composer}</div>}
      <div className="flex flex-wrap gap-1 px-4 pt-3" role="tablist" aria-label="فیلتر گزارش">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.key ? "bg-[#18181B] text-white" : "text-[#52525B] hover:bg-[#F4F4F5]"
            )}
          >
            {f.label}
            <span className={cn("text-[10px]", filter === f.key ? "text-white/70" : "text-[#A1A1AA]")}>{toFaDigits(counts[f.key])}</span>
          </button>
        ))}
      </div>

      <div className="px-5 pb-5 pt-2">
        {groups.length === 0 && <p className="py-8 text-center text-sm text-[#A1A1AA]">رویدادی نیست.</p>}
        {groups.map((g) => (
          <div key={g.key}>
            <p className="sticky top-0 z-10 bg-white pb-2 pt-3 text-[11px] font-bold text-[#71717A]">{g.label}</p>
            <ol className="relative">
              {g.items.map(({ e, v }, i) => {
                const Icon = v.icon;
                const last = i === g.items.length - 1;
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4">
                    {!last && <span className="absolute right-[13px] top-8 bottom-0 w-px bg-[#E4E4E7]" aria-hidden />}
                    <span className={cn("relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white", v.tone)}>
                      <Icon className="size-3.5" strokeWidth={2.2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[13px] leading-6 text-[#18181B]">
                        {e.staff && <span className="font-bold">{e.staff} </span>}
                        <span className={cn(!e.staff && "font-semibold")}>{v.title}</span>
                      </p>
                      {v.detail && <p className="text-xs text-[#71717A]">{v.detail}</p>}
                      {v.quote && <p className="mt-1.5 whitespace-pre-line rounded-lg bg-[#FAFAFA] px-3 py-2 text-[13px] leading-6 text-[#3F3F46] ring-1 ring-inset ring-[#F4F4F5]">{v.quote}</p>}
                      <p className="mt-0.5 text-[11px] text-[#A1A1AA]" title={fullFa(e.created_at)}>
                        <time dateTime={e.created_at}>{timeFa(e.created_at)}</time>
                        {now && <span> · {relative(e.created_at, now)}</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
