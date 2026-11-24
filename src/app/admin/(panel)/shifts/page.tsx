import { requireShiftManager } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dayRange, shiftsBetween, tehranDay } from "@/lib/shifts";
import { escalationMinutes } from "@/lib/escalation";
import { PageHeader } from "@/components/admin/page-header";
import { ShiftPlanner, type ShiftDay, type ShiftStaff } from "@/components/admin/shift-planner";
import type { Role } from "@/lib/roles";

export const metadata = { title: "شیفت‌بندی" };

const DAYS = 14;

const label = (day: string) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

export default async function ShiftsPage() {
  await requireShiftManager();
  const today = tehranDay();
  const days = dayRange(today, DAYS);
  const staff = getDb()
    .prepare(
      `SELECT id, name, role, phone, notify_sms FROM staff WHERE active = 1
       ORDER BY CASE role WHEN 'expert' THEN 0 WHEN 'supervisor' THEN 1 ELSE 2 END, name`,
    )
    .all() as { id: number; name: string; role: Role; phone: string | null; notify_sms: number }[];
  const rows = shiftsBetween(days[0], days[days.length - 1]);

  const plan: ShiftDay[] = days.map((day) => ({
    day,
    label: label(day),
    isToday: day === today,
    staffIds: rows.filter((r) => r.day === day).map((r) => r.staff_id),
  }));
  const people: ShiftStaff[] = staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    reachable: !!s.phone && s.notify_sms === 1,
  }));

  return (
    <>
      <PageHeader
        title="شیفت‌بندی"
        description={`برای هر روز مشخص کنید چه کسانی شیفت هستند. پیامک درخواست جدید فقط برای همان‌ها می‌رود. روزی که کسی برایش انتخاب نشده، مثل قبل برای همه ارسال می‌شود. اگر درخواستی ${new Intl.NumberFormat("fa-IR").format(escalationMinutes())} دقیقه بدون بررسی بماند، برای شیفتی‌ها، سرپرست‌ها و مدیرها پیامک هشدار می‌رود.`}
      />
      <ShiftPlanner days={plan} staff={people} />
    </>
  );
}
