"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Check, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { addNoteAction, assignAction, refetchLinksAction, setStatusAction } from "@/app/admin/actions";
import { statuses } from "@/lib/catalog";
import { Button, FieldTextarea, fieldControlClass } from "@/components/admin-ui";
import { cn } from "@/lib/utils";

const toneDot: Record<string, string> = {
  brand: "bg-[#EAB308]",
  info: "bg-[#2563EB]",
  warning: "bg-[#F59E0B]",
  success: "bg-[#16A34A]",
  destructive: "bg-[#DC2626]",
  secondary: "bg-[#A1A1AA]",
};

/** Status as a short vertical list (current one highlighted) plus the assignee. */
export function RequestControls({ requestId, status, assignedTo, meId, staff }: { requestId: number; status: string; assignedTo: number | null; meId: number; staff: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-col gap-5", pending && "pointer-events-none opacity-70")}>
      <div>
        <p className="mb-2 text-[13px] font-bold text-[#18181B]">وضعیت</p>
        <div role="radiogroup" aria-label="وضعیت درخواست" className="grid grid-cols-2 gap-1 lg:grid-cols-1">
          {statuses.map((s) => {
            const on = status === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending || on}
                onClick={() =>
                  start(async () => {
                    await setStatusAction(requestId, s.key);
                    toast.success(`وضعیت: ${s.name}`);
                  })
                }
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] font-semibold transition-colors",
                  on ? "bg-[#18181B] text-white" : "text-[#3F3F46] hover:bg-[#F4F4F5]"
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", toneDot[s.tone], on && "ring-2 ring-white/30")} aria-hidden />
                <span className="flex-1">{s.name}</span>
                {on && <Check className="size-3.5" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-[#F4F4F5] pt-4">
        <label htmlFor="assignee" className="mb-2 block text-[13px] font-bold text-[#18181B]">
          کارشناس مسئول
        </label>
        <select
          id="assignee"
          value={assignedTo ?? ""}
          disabled={pending}
          onChange={(e) => start(() => assignAction(requestId, e.target.value ? Number(e.target.value) : null))}
          className={fieldControlClass}
        >
          <option value="">بدون کارشناس</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {assignedTo !== meId && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            icon={<UserCheck />}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await assignAction(requestId, meId);
                toast.success("درخواست برای شما شد.");
              })
            }
          >
            برداشتن برای خودم
          </Button>
        )}
      </div>
    </div>
  );
}

export function NoteForm({ requestId }: { requestId: number }) {
  const [state, action, pending] = useActionState(addNoteAction.bind(null, requestId), null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <FieldTextarea name="body" rows={2} maxLength={2000} placeholder="یادداشت: نتیجه‌ی تماس، قیمت اعلام‌شده، …" aria-label="یادداشت تازه" className="min-h-[72px] resize-y" />
      <div className="flex items-center justify-between gap-2">
        {state?.error ? <p className="text-xs text-[#B91C1C]">{state.error}</p> : <span />}
        <Button type="submit" size="sm" loading={pending}>
          ثبت یادداشت
        </Button>
      </div>
    </form>
  );
}

export function RefetchButton({ requestId }: { requestId: number }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => refetchLinksAction(requestId))} className="w-fit text-[#52525B]" icon={<RefreshCw className={cn(pending && "animate-spin")} />}>
      خواندن دوباره‌ی اطلاعات لینک‌ها
    </Button>
  );
}
