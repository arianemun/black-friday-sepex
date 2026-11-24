import { requireShiftManager } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dayRange, shiftsBetween, tehranDay, weekStart } from "@/lib/shifts";
import { escalationMinutes } from "@/lib/escalation";
import { PageHeader } from "@/components/admin/page-header";
import { ShiftPlanner, type ShiftDay, type ShiftStaff } from "@/components/admin/shift-planner";
import type { Role } from "@/lib/roles";

export const metadata = { title: "شیفت‌بندی" };

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { ...opts, timeZone: "UTC" });
const at = (day: string) => new Date(`${day}T12:00:00Z`);
const weekday = fmt({ weekday: "long" });
const dayMonth = fmt({ day: "numeric", month: "long" });
const dayOnly = fmt({ day: "numeric" });

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await requireShiftManager();
  const sp = await searchParams;
  const offset = Math.max(-4, Math.min(8, Number.parseInt(sp.w ?? "0", 10) || 0));
  const today = tehranDay();
  const start = weekStart(today, offset);
  const days = dayRange(start, 7);

  const staff = getDb()
    .prepare(
      `SELECT id, name, role, phone, notify_sms FROM staff WHERE active = 1
       ORDER BY CASE role WHEN 'expert' THEN 0 WHEN 'supervisor' THEN 1 ELSE 2 END, name`,
    )
    .all() as { id: number; name: string; role: Role; phone: string | null; notify_sms: number }[];
  const rows = shiftsBetween(days[0], days[6]);
  const todayIds = shiftsBetween(today, today).map((r) => r.staff_id);

  const plan: ShiftDay[] = days.map((day) => ({
    day,
    weekday: weekday.format(at(day)),
    date: dayMonth.format(at(day)),
    isToday: day === today,
    isPast: day < today,
    staffIds: rows.filter((r) => r.day === day).map((r) => r.staff_id),
  }));
  const people: ShiftStaff[] = staff.map((s) => ({ id: s.id, name: s.name, role: s.role, reachable: !!s.phone && s.notify_sms === 1 }));

  const first = at(days[0]);
  const last = at(days[6]);
  const sameMonth = fmt({ month: "long" }).format(first) === fmt({ month: "long" }).format(last);
  const range = sameMonth ? `${dayOnly.format(first)} تا ${dayMonth.format(last)}` : `${dayMonth.format(first)} تا ${dayMonth.format(last)}`;

  return (
    <>
      <PageHeader
        title="شیفت‌بندی"
        description="هر خانه یعنی آن نفر در آن روز شیفت است. پیامک درخواست جدید فقط برای شیفتیِ همان روز می‌رود؛ روزی که خالی بماند، مثل قبل برای همه."
      />
      <ShiftPlanner
        weekStart={start}
        offset={offset}
        range={range}
        days={plan}
        staff={people}
        today={{ isPlanned: todayIds.length > 0, names: people.filter((p) => todayIds.includes(p.id)).map((p) => p.name) }}
        escalationMinutes={escalationMinutes()}
      />
    </>
  );
}
