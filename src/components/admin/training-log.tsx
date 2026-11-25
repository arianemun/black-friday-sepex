import { CheckCircle2 } from "lucide-react";
import { roleLabels, type Role } from "@/lib/roles";
import { toFaDigits } from "@/lib/utils";
import type { WatchRow } from "@/lib/training";

const when = (iso: string) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(iso));

/** m:ss, kept left-to-right inside Persian text. */
const mmss = (s: number) => <bdi dir="ltr">{toFaDigits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`)}</bdi>;

/** Who has watched what: one row per staff member, one column per video. */
export function TrainingLog({
  staff,
  videos,
  rows,
}: {
  staff: { id: number; name: string; role: Role }[];
  videos: { slug: string; title: string }[];
  rows: WatchRow[];
}) {
  const get = (id: number, slug: string) => rows.find((r) => r.staff_id === id && r.slug === slug);
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
      <header className="border-b border-[#F4F4F5] px-4 py-3">
        <h2 className="text-[15px] font-extrabold text-[#18181B]">گزارش تماشا</h2>
        <p className="mt-0.5 text-xs text-[#71717A]">فقط مدیر و سرپرست این بخش را می‌بینند. «دیده شد» یعنی دست‌کم ۹۰٪ ویدیو تماشا شده.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-[#71717A]">
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">نفر</th>
              {videos.map((v) => (
                <th key={v.slug} scope="col" className="px-3 py-2.5 text-right font-semibold">
                  {v.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-t border-[#F4F4F5] align-top">
                <th scope="row" className="px-4 py-3 text-right font-normal">
                  <div className="text-[13px] font-semibold text-[#18181B]">{s.name}</div>
                  <div className="text-[11px] text-[#A1A1AA]">{roleLabels[s.role]}</div>
                </th>
                {videos.map((v) => {
                  const r = get(s.id, v.slug);
                  if (!r) return <td key={v.slug} className="px-3 py-3 text-xs text-[#A1A1AA]">هنوز ندیده</td>;
                  const pct = r.duration ? Math.min(100, Math.round((r.max_position / r.duration) * 100)) : 0;
                  return (
                    <td key={v.slug} className="px-3 py-3">
                      {r.completed_at ? (
                        <div className="flex items-center gap-1 text-[13px] font-bold text-[#15803D]">
                          <CheckCircle2 className="size-4" aria-hidden />
                          دیده شد
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F4F4F5]" aria-hidden>
                            <div className="h-full rounded-full bg-[#18181B]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-[#3F3F46]">{toFaDigits(pct)}٪</span>
                        </div>
                      )}
                      <div className="mt-1 text-[11px] leading-5 text-[#71717A]">
                        تا دقیقه‌ی {mmss(r.max_position)} از {mmss(r.duration)}، {toFaDigits(r.plays)} بار پخش
                        <br />
                        آخرین بار {when(r.last_at)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
