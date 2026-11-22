"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/admin/actions";
import type { Settings } from "@/lib/settings";

const inputCls = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? "ذخیره شد.");
  }, [state]);
  return (
    <form action={action} className="mt-6 grid gap-6">
      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <h2 className="font-bold">شمارش معکوس کمپین</h2>
        <p className="text-xs text-gray-500">زمان‌ها به وقت تهران. قبل از شروع تا «شروع» می‌شمارد؛ بعد از آن، اگر پایان تعیین شده باشد، تا «پایان».</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold">شروع<input type="datetime-local" name="countdown_target" defaultValue={s.countdown_target} dir="ltr" className={inputCls} required /></label>
          <label className="grid gap-1 text-xs font-semibold">پایان (اختیاری)<input type="datetime-local" name="campaign_end" defaultValue={s.campaign_end} dir="ltr" className={inputCls} /></label>
        </div>
        <label className="grid gap-1 text-xs font-semibold">متن کنار شمارش تا شروع<input name="countdown_label" defaultValue={s.countdown_label} className={inputCls} /></label>
      </section>

      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <h2 className="font-bold">پیامک درخواست جدید به کارشناس‌ها</h2>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="notify_mode" value="all" defaultChecked={s.notify_mode === "all"} className="mt-1 accent-blue-600" />همه‌ی کارشناس‌ها پیامک بگیرند؛ هر کس زودتر «برمی‌دارم» را زد، مسئول درخواست است.</label>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="notify_mode" value="round_robin" defaultChecked={s.notify_mode === "round_robin"} className="mt-1 accent-blue-600" />به نوبت؛ هر درخواست خودکار به یک کارشناس سپرده می‌شود و فقط او پیامک می‌گیرد.</label>
      </section>

      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <h2 className="font-bold">راه‌های ارتباطی در فوتر</h2>
        <p className="text-xs text-gray-500">هر کدام خالی باشد نمایش داده نمی‌شود.</p>
        <label className="grid gap-1 text-xs font-semibold">تلفن پشتیبانی<input name="support_phone" defaultValue={s.support_phone} dir="ltr" className={inputCls} /></label>
        {(["instagram", "telegram", "whatsapp", "bale"] as const).map((k) => (
          <label key={k} className="grid gap-1 text-xs font-semibold">
            {{ instagram: "اینستاگرام", telegram: "تلگرام", whatsapp: "واتس‌اپ", bale: "بله" }[k]}
            <input name={k} defaultValue={s[k]} dir="ltr" placeholder="https://" className={inputCls} />
          </label>
        ))}
      </section>

      <button disabled={pending} className="flex h-11 w-fit items-center gap-2 rounded-lg bg-blue-600 px-8 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
        {pending && <Loader2 className="size-4 animate-spin" />} ذخیره‌ی تنظیمات
      </button>
    </form>
  );
}
