import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { smsDryRun } from "@/lib/sms";
import { loadSharp } from "@/lib/image";
import { Settings } from "lucide-react";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "تنظیمات" };

/** ISO → "YYYY-MM-DDTHH:mm" in Tehran time for <input type="datetime-local"> */
function toTehranLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3.5 * 3600_000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export default async function SettingsPage() {
  await requireAdmin();
  const s = getSettings();
  const env = {
    smsLive: !smsDryRun(),
    otpTemplate: !!process.env.SMSIR_OTP_TEMPLATE_ID,
    customerTemplate: !!process.env.SMSIR_CUSTOMER_TEMPLATE_ID,
    expertTemplate: !!process.env.SMSIR_EXPERT_TEMPLATE_ID,
    fetchProxy: !!process.env.FETCH_PROXY_URL,
    sharp: !!(await loadSharp()),
  };
  return (
    <div className="max-w-3xl space-y-4 md:space-y-6">
      <PageHeader icon={Settings} title="تنظیمات" description="زمان کمپین، روش اعلان به کارشناس‌ها و راه‌های ارتباطی فوتر" />
      <SettingsForm settings={{ ...s, countdown_target: toTehranLocal(s.countdown_target), campaign_end: toTehranLocal(s.campaign_end) }} />
      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm md:p-6">
        <h2 className="text-lg font-semibold">وضعیت سرویس‌ها</h2>
        <p className="mt-1 text-xs text-gray-500">این موارد از فایل ‎.env سرور خوانده می‌شوند.</p>
        <ul className="mt-3 space-y-1.5">
          {[
            ["ارسال پیامک (SMS.ir)", env.smsLive, "فعال", "شبیه‌سازی؛ پیامکی ارسال نمی‌شود"],
            ["قالب پیامک کد تأیید", env.otpTemplate, "تنظیم شده", "تنظیم نشده"],
            ["قالب پیامک ثبت درخواست (مشتری)", env.customerTemplate, "تنظیم شده", "تنظیم نشده"],
            ["قالب پیامک درخواست جدید (کارشناس)", env.expertTemplate, "تنظیم شده", "تنظیم نشده"],
            ["پراکسی خارج برای خواندن لینک‌ها", env.fetchProxy, "تنظیم شده", "تنظیم نشده؛ بیشتر فروشگاه‌ها از ایران خوانده نمی‌شوند"],
            ["پردازش تصویر (sharp)", env.sharp, "فعال", "غیرفعال؛ عکس‌ها بدون فشرده‌سازی ذخیره می‌شوند"],
          ].map(([label, ok, yes, no]) => (
            <li key={label as string} className="flex justify-between gap-4">
              <span>{label}</span>
              <span className={ok ? "font-semibold text-green-700" : "font-semibold text-amber-700"}>{(ok ? yes : no) as string}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
