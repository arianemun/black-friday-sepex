"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/admin/actions";
import type { Settings } from "@/lib/settings";
import { Button, FieldInput, FormField, FormGrid } from "@/components/admin-ui";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[#E4E4E7] bg-white p-5">
      <div>
        <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        {hint && <p className="mt-1 text-[13px] text-[#71717A]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? "ذخیره شد.");
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Section title="شمارش معکوس کمپین" hint="زمان‌ها به وقت تهران. قبل از شروع تا «شروع» می‌شمارد؛ بعد از آن، اگر پایان تعیین شده باشد، تا «پایان».">
        <FormGrid>
          <FormField label="شروع" htmlFor="cd-start"><FieldInput id="cd-start" type="datetime-local" name="countdown_target" defaultValue={s.countdown_target} dir="ltr" required /></FormField>
          <FormField label="پایان (اختیاری)" htmlFor="cd-end"><FieldInput id="cd-end" type="datetime-local" name="campaign_end" defaultValue={s.campaign_end} dir="ltr" /></FormField>
        </FormGrid>
        <FormField label="متن بالای شمارنده تا شروع" htmlFor="cd-label"><FieldInput id="cd-label" name="countdown_label" defaultValue={s.countdown_label} /></FormField>
      </Section>

      <Section title="پیامک درخواست جدید به کارشناس‌ها">
        <label className="flex items-start gap-2 text-sm leading-6">
          <input type="radio" name="notify_mode" value="all" defaultChecked={s.notify_mode === "all"} className="mt-1.5 accent-[#18181B]" />
          همه‌ی کارشناس‌ها پیامک بگیرند؛ هر کس زودتر «برمی‌دارم» را زد، مسئول درخواست است.
        </label>
        <label className="flex items-start gap-2 text-sm leading-6">
          <input type="radio" name="notify_mode" value="round_robin" defaultChecked={s.notify_mode === "round_robin"} className="mt-1.5 accent-[#18181B]" />
          به نوبت؛ هر درخواست خودکار به یک کارشناس سپرده می‌شود و فقط او پیامک می‌گیرد.
        </label>
      </Section>

      <Section title="راه‌های ارتباطی در فوتر" hint="هر کدام خالی باشد نمایش داده نمی‌شود.">
        <FormGrid>
          <FormField label="تلفن پشتیبانی" htmlFor="st-phone"><FieldInput id="st-phone" name="support_phone" defaultValue={s.support_phone} dir="ltr" /></FormField>
          {(["instagram", "telegram", "whatsapp", "bale"] as const).map((k) => (
            <FormField key={k} label={{ instagram: "اینستاگرام", telegram: "تلگرام", whatsapp: "واتس‌اپ", bale: "بله" }[k]} htmlFor={`st-${k}`}>
              <FieldInput id={`st-${k}`} name={k} defaultValue={s[k]} dir="ltr" placeholder="https://" />
            </FormField>
          ))}
        </FormGrid>
      </Section>

      <div>
        <Button type="submit" size="lg" loading={pending}>ذخیره‌ی تنظیمات</Button>
      </div>
    </form>
  );
}
