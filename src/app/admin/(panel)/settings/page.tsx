import { requireAdmin } from "@/lib/auth";
import { fetchProxies } from "@/lib/safe-fetch";
import { getSettings } from "@/lib/settings";
import { smsDryRun } from "@/lib/sms";
import { loadSharp } from "@/lib/image";
import { backupIntervalHours, listBackups } from "@/lib/backup";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin-ui";

export const metadata = { title: "تنظیمات" };

/** ISO → "YYYY-MM-DDTHH:mm" in Tehran time for <input type="datetime-local"> */
function toTehranLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3.5 * 3600_000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

/** A backup is overdue once two intervals (plus an hour of slack) have passed. */
function isFresh(at: Date | undefined) {
  return !!at && Date.now() - at.getTime() < (backupIntervalHours() * 2 + 1) * 3_600_000;
}

export default async function SettingsPage() {
  await requireAdmin();
  const s = getSettings();
  const env = {
    smsLive: !smsDryRun(),
    otpTemplate: !!process.env.SMSIR_OTP_TEMPLATE_ID,
    customerTemplate: !!process.env.SMSIR_CUSTOMER_TEMPLATE_ID,
    expertTemplate: !!process.env.SMSIR_EXPERT_TEMPLATE_ID,
    proxies: fetchProxies().map((p) => p.label),
    sharp: !!(await loadSharp()),
    escalationTemplate: !!process.env.SMSIR_ESCALATION_TEMPLATE_ID,
  };
  const backups = listBackups();
  const lastBackup = backups[0];
  const backupFresh = isFresh(lastBackup?.at);
  const fa = (d: Date) =>
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(d);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0">
      <div>
      <PageHeader title="تنظیمات و سامانه" description="زمان کمپین، روش اعلان به کارشناس‌ها و راه‌های ارتباطی فوتر" />
      <SettingsForm settings={{ ...s, countdown_target: toTehranLocal(s.countdown_target), campaign_end: toTehranLocal(s.campaign_end) }} />
      </div>
      <section className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white p-5 text-sm lg:sticky lg:top-24 lg:mt-[4.25rem]">
        <h2 className="m-0 text-[15px] font-bold">وضعیت سرویس‌ها</h2>
        <p className="text-xs text-[#71717A]">از فایل ‎.env سرور خوانده می‌شوند.</p>
        <ul className="flex flex-col divide-y divide-[#F4F4F5]">
          {[
            ["ارسال پیامک (SMS.ir)", env.smsLive, "فعال", "شبیه‌سازی؛ پیامکی ارسال نمی‌شود"],
            ["قالب پیامک کد تأیید", env.otpTemplate, "تنظیم شده", "تنظیم نشده"],
            ["قالب پیامک ثبت درخواست (مشتری)", env.customerTemplate, "تنظیم شده", "تنظیم نشده"],
            ["قالب پیامک درخواست جدید (کارشناس)", env.expertTemplate, "تنظیم شده", "تنظیم نشده"],
            ["قالب پیامک هشدار یک‌ساعته", env.escalationTemplate, "تنظیم شده", "تنظیم نشده"],
            [
              `پشتیبان خودکار دیتابیس (هر ${new Intl.NumberFormat("fa-IR").format(backupIntervalHours())} ساعت)`,
              backupFresh,
              lastBackup ? `آخرین: ${fa(lastBackup.at)} · ${new Intl.NumberFormat("fa-IR").format(backups.length)} نسخه` : "",
              lastBackup ? `آخرین نسخه قدیمی است: ${fa(lastBackup.at)}` : "هنوز نسخه‌ای گرفته نشده",
            ],
            ["پراکسی خارج برای خواندن لینک‌ها", env.proxies.length > 0, `${env.proxies.length} پراکسی: ${env.proxies.join("، ")}`, "تنظیم نشده؛ بیشتر فروشگاه‌ها از ایران خوانده نمی‌شوند"],
            ["پردازش تصویر (sharp)", env.sharp, "فعال", "غیرفعال؛ عکس‌ها بدون فشرده‌سازی ذخیره می‌شوند"],
          ].map(([label, ok, yes, no]) => (
            <li key={label as string} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
              <span className="text-[13px] font-semibold">{label}</span>
              <Badge variant={ok ? "success" : "warning"} className="w-fit">{(ok ? yes : no) as string}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
