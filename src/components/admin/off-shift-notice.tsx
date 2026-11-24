import { CalendarX2 } from "lucide-react";

/** Shown to experts who aren't on today's shift. They can still use the panel. */
export function OffShiftNotice() {
  return (
    <div role="status" className="border-b border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 md:px-8">
      <div className="mx-auto flex max-w-[1320px] items-center gap-2.5 text-[13px] text-[#92400E]">
        <CalendarX2 className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <p>
          <span className="font-bold">امروز شیفت شما نیست.</span> پیامک درخواست‌های جدید برای شما ارسال نمی‌شود؛ اگر می‌خواهید روی درخواست‌ها کار کنید، با سرپرست خود هماهنگ کنید.
        </p>
      </div>
    </div>
  );
}
