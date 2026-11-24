"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BellOff, Check, ChevronLeft, ChevronRight, CopyPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { copyShiftWeekAction, toggleShiftAction } from "@/app/admin/actions";
import { Button, adminButtonVariants } from "@/components/admin-ui";
import { useConfirm } from "@/components/admin-ui/confirm-dialog";
import { roleLabels, type Role } from "@/lib/roles";
import { cn, toFaDigits } from "@/lib/utils";

export type ShiftDay = { day: string; weekday: string; date: string; isToday: boolean; isPast: boolean; staffIds: number[] };
export type ShiftStaff = { id: number; name: string; role: Role; reachable: boolean };

type Props = {
  weekStart: string;
  offset: number;
  range: string;
  days: ShiftDay[];
  staff: ShiftStaff[];
  today: { isPlanned: boolean; names: string[] };
  escalationMinutes: number;
};

/** Weekly roster: people down the side, Saturday to Friday across, one tap per cell. */
export function ShiftPlanner(props: Props) {
  // Remount on fresh server data so the optimistic copy never drifts from the database.
  const key = props.weekStart + props.days.map((d) => d.staffIds.join(",")).join("|");
  return <Planner key={key} {...props} />;
}

const weekName = (o: number) =>
  o === 0 ? "این هفته" : o === 1 ? "هفته‌ی بعد" : o === -1 ? "هفته‌ی قبل" : o > 0 ? `${toFaDigits(o)} هفته بعد` : `${toFaDigits(-o)} هفته قبل`;

function Planner({ weekStart, offset, range, days, staff, today, escalationMinutes }: Props) {
  const [plan, setPlan] = useState(() => new Map(days.map((d) => [d.day, new Set(d.staffIds)])));
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const todayRef = useRef<HTMLTableCellElement>(null);
  // On narrow screens the week scrolls sideways: bring today into view.
  useEffect(() => {
    const el = todayRef.current;
    const box = el?.closest<HTMLElement>("[data-roster]");
    if (el && box && box.scrollWidth > box.clientWidth) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  const toggle = (day: string, id: number) => {
    const on = !plan.get(day)?.has(id);
    setPlan((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(day));
      if (on) set.add(id);
      else set.delete(id);
      next.set(day, set);
      return next;
    });
    start(async () => {
      const r = await toggleShiftAction(day, id, on);
      if (r?.error) {
        toast.error(r.error);
        setPlan(new Map(days.map((d) => [d.day, new Set(d.staffIds)])));
      }
    });
  };

  const copyWeek = async () => {
    const ok = await confirm({
      title: "کپی به هفته‌ی بعد",
      message: "برنامه‌ی هفته‌ی بعد با برنامه‌ی همین هفته جایگزین می‌شود.",
      confirmLabel: "کپی کن",
    });
    if (!ok) return;
    start(async () => {
      const r = await copyShiftWeekAction(weekStart);
      if (r?.error) toast.error(r.error);
      else toast.success("برنامه به هفته‌ی بعد کپی شد.");
    });
  };

  const anyPlanned = days.some((d) => (plan.get(d.day)?.size ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4">
      <TodayStrip today={today} escalationMinutes={escalationMinutes} />

      <section className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] px-3 py-2.5 sm:px-4">
          <nav aria-label="انتخاب هفته" className="flex items-center gap-1">
            <Link
              href={`/admin/shifts?w=${offset - 1}`}
              aria-label="هفته‌ی قبل"
              className={cn(adminButtonVariants({ variant: "ghost", size: "sm" }), "px-2", offset <= -4 && "pointer-events-none opacity-40")}
            >
              <ChevronRight />
            </Link>
            <div className="min-w-[9.5rem] text-center">
              <div className="text-[15px] font-extrabold text-[#18181B]">{range}</div>
              <div className="text-[11px] text-[#71717A]">{weekName(offset)}</div>
            </div>
            <Link
              href={`/admin/shifts?w=${offset + 1}`}
              aria-label="هفته‌ی بعد"
              className={cn(adminButtonVariants({ variant: "ghost", size: "sm" }), "px-2", offset >= 8 && "pointer-events-none opacity-40")}
            >
              <ChevronLeft />
            </Link>
            {offset !== 0 && (
              <Link href="/admin/shifts" className={cn(adminButtonVariants({ variant: "secondary", size: "sm" }), "ms-1")}>
                این هفته
              </Link>
            )}
          </nav>
          <Button variant="secondary" size="sm" onClick={copyWeek} disabled={pending || !anyPlanned}>
            <CopyPlus />
            کپی به هفته‌ی بعد
          </Button>
        </header>

        {staff.length === 0 ? (
          <p className="p-6 text-sm text-[#71717A]">هنوز کاربر فعالی ثبت نشده است.</p>
        ) : (
          <div data-roster className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[132px] sm:w-[168px]" />
                {days.map((d) => (
                  <col key={d.day} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="sticky right-0 z-10 bg-white px-3 py-3 text-right text-xs font-semibold text-[#71717A] sm:px-4">
                    نفرات
                  </th>
                  {days.map((d) => (
                    <th key={d.day} ref={d.isToday ? todayRef : undefined} scope="col" className={cn("px-1 py-3 text-center font-normal", d.isPast && "opacity-45")}>
                      <div className={cn("mx-auto flex w-fit flex-col items-center rounded-lg px-2.5 py-1", d.isToday && "bg-[#18181B]")}>
                        <span className={cn("text-[13px] font-bold", d.isToday ? "text-white" : "text-[#18181B]")}>{d.weekday}</span>
                        <span className={cn("text-[11px]", d.isToday ? "text-white/70" : "text-[#71717A]")}>{d.date}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-[#F4F4F5]">
                    <th scope="row" className="sticky right-0 z-10 bg-white px-3 py-2 text-right font-normal sm:px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-[#18181B]">{s.name}</span>
                        {!s.reachable && (
                          <BellOff className="size-3.5 shrink-0 text-[#D97706]" aria-label="پیامک برایش نمی‌رود: شماره ندارد یا پیامکش خاموش است" />
                        )}
                      </div>
                      {s.role !== "expert" && <div className="text-[11px] text-[#A1A1AA]">{roleLabels[s.role]}</div>}
                    </th>
                    {days.map((d) => {
                      const on = !!plan.get(d.day)?.has(s.id);
                      return (
                        <td key={d.day} className={cn("p-1", d.isToday && "bg-[#FAFAFA]")}>
                          <button
                            type="button"
                            aria-pressed={on}
                            aria-label={`${s.name}، ${d.weekday} ${d.date}`}
                            disabled={d.isPast}
                            onClick={() => toggle(d.day, s.id)}
                            className={cn(
                              "mx-auto flex h-10 w-full max-w-[96px] items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]",
                              on && !d.isPast && "bg-[#18181B] text-white hover:bg-[#3F3F46]",
                              on && d.isPast && "bg-[#E4E4E7] text-[#A1A1AA]",
                              !on && !d.isPast && "border border-dashed border-[#E4E4E7] text-transparent hover:border-[#A1A1AA] hover:text-[#A1A1AA] focus-visible:text-[#A1A1AA]",
                              !on && d.isPast && "cursor-default",
                            )}
                          >
                            {on ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : !d.isPast && <Plus className="size-4" aria-hidden />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#E4E4E7] bg-[#FAFAFA]">
                  <th scope="row" className="sticky right-0 z-10 bg-[#FAFAFA] px-3 py-2.5 text-right text-xs font-semibold text-[#71717A] sm:px-4">
                    پیامک درخواست جدید
                  </th>
                  {days.map((d) => {
                    const n = plan.get(d.day)?.size ?? 0;
                    return (
                      <td key={d.day} className={cn("px-1 py-2.5 text-center text-xs", d.isPast && "opacity-45")}>
                        {n ? <span className="font-bold text-[#15803D]">{toFaDigits(n)} نفر</span> : <span className="text-[#A1A1AA]">همه</span>}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {staff.some((s) => !s.reachable) && (
        <p className="flex items-start gap-1.5 text-xs leading-5 text-[#71717A]">
          <BellOff className="mt-0.5 size-3.5 shrink-0 text-[#D97706]" aria-hidden />
          این نفر شماره ندارد یا پیامکش خاموش است و در شیفت هم پیامک نمی‌گیرد. از صفحه‌ی کارشناس‌ها درستش کنید.
        </p>
      )}
    </div>
  );
}

function TodayStrip({ today, escalationMinutes }: { today: Props["today"]; escalationMinutes: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-[#E4E4E7] bg-white px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", today.isPlanned ? "bg-[#16A34A]" : "bg-[#A1A1AA]")} />
        <p className="text-sm text-[#3F3F46]">
          {today.isPlanned ? (
            <>
              <span className="font-bold text-[#18181B]">امروز در شیفت:</span> {today.names.join("، ")}
            </>
          ) : (
            <>
              <span className="font-bold text-[#18181B]">برای امروز برنامه‌ای نیست.</span> پیامک درخواست جدید برای همه می‌رود.
            </>
          )}
        </p>
      </div>
      <p className="text-xs text-[#71717A]">
        درخواستی که {toFaDigits(escalationMinutes)} دقیقه دست‌نخورده بماند، برای شیفتی‌ها، سرپرست‌ها و مدیرها پیامک هشدار می‌فرستد.
      </p>
    </div>
  );
}
