"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { setSmsAccountAction, smsTestAction } from "@/app/admin/actions";
import { Badge, Button, FieldInput } from "@/components/admin-ui";
import { useConfirm } from "@/components/admin-ui/confirm-dialog";
import { cn } from "@/lib/utils";

export type SmsAccountView = {
  key: "a" | "b";
  label: string;
  configured: boolean;
  credit: number | null;
  templates: { otp?: string; customer?: string; expert?: string; escalation?: string };
};

const TEMPLATE_LABELS: [keyof SmsAccountView["templates"], string][] = [
  ["otp", "کد تأیید"],
  ["customer", "ثبت درخواست (مشتری)"],
  ["expert", "درخواست جدید (کارشناس)"],
  ["escalation", "هشدار پیگیری"],
];

const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(n);

function useToast(state: { ok?: boolean; error?: string; message?: string } | null) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? "انجام شد.");
  }, [state]);
}

/** Which SMS.ir account sends; switching takes effect immediately for every message. */
export function SmsAccounts({
  accounts,
  active,
  changedBy,
  changedAt,
  dryRun,
}: {
  accounts: SmsAccountView[];
  active: "a" | "b";
  changedBy: string;
  changedAt: string;
  dryRun: boolean;
}) {
  const [switchState, switchAction, switching] = useActionState(setSmsAccountAction, null);
  const [testState, testAction, testing] = useActionState(smsTestAction, null);
  const confirm = useConfirm();
  const switchTo = async (a: SmsAccountView) => {
    const missing = TEMPLATE_LABELS.filter(([k]) => !a.templates[k]).map(([, l]) => l);
    const ok = await confirm({
      title: `ارسال پیامک‌ها از «${a.label}»`,
      message: `از همین لحظه همه‌ی پیامک‌های سایت از «${a.label}» فرستاده می‌شوند.${missing.length ? ` قالب‌های «${missing.join("، ")}» در این حساب تنظیم نشده‌اند و این پیامک‌ها ارسال نمی‌شوند.` : ""}`,
      confirmLabel: "تغییر حساب",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("account", a.key);
    startTransition(() => switchAction(fd));
  };
  useToast(switchState);
  useToast(testState);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[#E4E4E7] bg-white p-5">
      <div>
        <h2 className="m-0 text-[15px] font-bold">حساب ارسال پیامک (SMS.ir)</h2>
        <p className="mt-1 text-[13px] text-[#71717A]">
          همه‌ی پیامک‌ها (کد تأیید، تأیید ثبت، اعلان کارشناس و هشدار پیگیری) از حساب فعال فرستاده می‌شوند. تغییر حساب فوراً اعمال می‌شود.
          {changedBy && changedAt && (
            <>
              {" "}
              آخرین تغییر:{" "}
              {changedBy}،{" "}
              {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(changedAt))}.
            </>
          )}
        </p>
        {dryRun && <p className="mt-2 text-[13px] font-semibold text-[#B45309]">ارسال واقعی خاموش است (SMS_DRY_RUN=1)؛ پیامک‌ها فقط در لاگ ثبت می‌شوند.</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {accounts.map((a) => {
          const isActive = a.key === active;
          return (
            <div key={a.key} className={cn("flex flex-col gap-3 rounded-lg border p-4", isActive ? "border-[#18181B] ring-1 ring-[#18181B]" : "border-[#E4E4E7]")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-bold">{a.label}</div>
                  <div className="mt-0.5 text-[12px] text-[#71717A]">
                    {!a.configured ? "کلید API تنظیم نشده" : a.credit == null ? "اعتبار خوانده نشد" : `اعتبار: ${fa(Math.floor(a.credit))}`}
                  </div>
                </div>
                {isActive ? (
                  <Badge variant="success" className="shrink-0 gap-1">
                    <CheckCircle2 className="size-3.5" aria-hidden /> در حال ارسال
                  </Badge>
                ) : !a.configured ? (
                  <Badge variant="warning" className="shrink-0">تنظیم نشده</Badge>
                ) : null}
              </div>
              <dl className="flex flex-col gap-1.5 text-[12px]">
                {TEMPLATE_LABELS.map(([k, label]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-[#71717A]">{label}</dt>
                    <dd className={cn("font-semibold tabular-nums", a.templates[k] ? "text-[#18181B]" : "text-[#B45309]")} dir="ltr">
                      {a.templates[k] ?? "تنظیم نشده"}
                    </dd>
                  </div>
                ))}
              </dl>
              {!isActive && (
                <Button type="button" size="sm" variant="secondary" className="w-full" disabled={!a.configured || switching} onClick={() => switchTo(a)}>
                  {switching ? "در حال تغییر…" : "ارسال از این حساب"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <form action={testAction} className="flex flex-col gap-2 border-t border-[#F4F4F5] pt-4">
        <label htmlFor="sms-test-mobile" className="text-[13px] font-semibold">
          پیامک آزمایشی
        </label>
        <p className="-mt-1 text-[12px] text-[#71717A]">قالب کد تأیید را با کد ۱۲۳۴۵ از حساب انتخاب‌شده به این شماره می‌فرستد.</p>
        <div className="flex flex-wrap items-center gap-2">
          <FieldInput id="sms-test-mobile" name="mobile" inputMode="numeric" dir="ltr" placeholder="09xxxxxxxxx" className="w-44" required />
          <select
            key={active}
            name="account"
            defaultValue={active}
            aria-label="حساب"
            className="h-9 rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]"
          >
            {accounts.map((a) => (
              <option key={a.key} value={a.key} disabled={!a.configured}>
                {a.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={testing}>
            <Send className="size-3.5" aria-hidden />
            {testing ? "در حال ارسال…" : "ارسال"}
          </Button>
        </div>
      </form>
    </section>
  );
}
