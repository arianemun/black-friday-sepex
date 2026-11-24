"use client";

import { useState, useTransition } from "react";
import { BellOff, Check, CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { copyPreviousShiftAction, toggleShiftAction } from "@/app/admin/actions";
import { Badge, Button } from "@/components/admin-ui";
import { roleLabels, type Role } from "@/lib/roles";
import { cn, toFaDigits } from "@/lib/utils";

export type ShiftDay = { day: string; label: string; isToday: boolean; staffIds: number[] };
export type ShiftStaff = { id: number; name: string; role: Role; reachable: boolean };

export function ShiftPlanner({ days, staff }: { days: ShiftDay[]; staff: ShiftStaff[] }) {
  if (!staff.length) {
    return <p className="rounded-xl border border-[#E4E4E7] bg-white p-6 text-sm text-[#71717A]">هنوز کارشناس فعالی ثبت نشده است.</p>;
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {days.map((d) => (
        <DayCard key={d.day} day={d} staff={staff} />
      ))}
    </ul>
  );
}

function DayCard({ day, staff }: { day: ShiftDay; staff: ShiftStaff[] }) {
  // Local copy so a tap answers instantly; the server result reconciles it.
  const [ids, setIds] = useState(() => new Set(day.staffIds));
  const [synced, setSynced] = useState(day.staffIds);
  const [pending, start] = useTransition();
  if (synced !== day.staffIds) {
    setSynced(day.staffIds);
    setIds(new Set(day.staffIds));
  }

  const toggle = (id: number) => {
    const on = !ids.has(id);
    setIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    start(async () => {
      const r = await toggleShiftAction(day.day, id, on);
      if (r?.error) {
        toast.error(r.error);
        setIds(new Set(day.staffIds));
      }
    });
  };

  const copyPrev = () =>
    start(async () => {
      const r = await copyPreviousShiftAction(day.day);
      if (r?.error) toast.error(r.error);
      else toast.success("برنامه‌ی روز قبل تکرار شد.");
    });

  const count = ids.size;
  return (
    <li className={cn("rounded-xl border bg-white p-4", day.isToday ? "border-[#18181B]" : "border-[#E4E4E7]")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-extrabold text-[#18181B]">{day.label}</h2>
          {day.isToday && <Badge variant="info">امروز</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", count ? "font-semibold text-[#15803D]" : "text-[#A1A1AA]")}>
            {count ? `${toFaDigits(count)} نفر در شیفت` : "بدون برنامه، پیامک برای همه"}
          </span>
          <Button
              variant="ghost"
              size="sm"
              onClick={copyPrev}
              disabled={pending}
              aria-label={`تکرار برنامه‌ی روز قبل برای ${day.label}`}
              title="تکرار برنامه‌ی روز قبل"
            >
              <CopyPlus />
              <span className="hidden sm:inline">مثل روز قبل</span>
            </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {staff.map((s) => {
          const on = ids.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]",
                on ? "border-[#18181B] bg-[#18181B] text-white" : "border-[#E4E4E7] bg-white text-[#3F3F46] hover:bg-[#F4F4F5]",
              )}
            >
              {on && <Check className="size-3.5" strokeWidth={2.4} aria-hidden />}
              {s.name}
              {s.role !== "expert" && <span className={cn("text-[11px] font-medium", on ? "text-white/70" : "text-[#A1A1AA]")}>{roleLabels[s.role]}</span>}
              {!s.reachable && (
                <BellOff className={cn("size-3.5", on ? "text-[#FCD34D]" : "text-[#A1A1AA]")} aria-label="پیامک برایش نمی‌رود (شماره یا پیامک خاموش)" />
              )}
            </button>
          );
        })}
      </div>
    </li>
  );
}
