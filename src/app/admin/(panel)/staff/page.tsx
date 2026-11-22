import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { StaffManager, type StaffRow } from "@/components/admin/staff-manager";

export const metadata = { title: "کارشناس‌ها" };

export default async function StaffPage() {
  const me = await requireAdmin();
  const rows = getDb().prepare("SELECT id, name, username, phone, role, notify_sms, active FROM staff ORDER BY active DESC, role, name").all() as StaffRow[];
  const mode = getSettings().notify_mode;
  return (
    <div>
      <h1 className="text-2xl font-bold">کارشناس‌ها</h1>
      <p className="mt-1 text-sm text-gray-500">
        کارشناس‌هایی که «پیامک درخواست جدید» برایشان روشن است، با هر درخواست جدید پیامک می‌گیرند
        {mode === "round_robin" ? " (به نوبت؛ هر درخواست به یک نفر)." : " (همه با هم)."} حالت را در تنظیمات عوض کنید.
      </p>
      <StaffManager rows={rows} meId={me.id} />
    </div>
  );
}
