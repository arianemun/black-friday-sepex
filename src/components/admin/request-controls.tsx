"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Check, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { addNoteAction, assignAction, refetchLinksAction, setStatusAction } from "@/app/admin/actions";
import { statuses } from "@/lib/catalog";
import { Button, FieldTextarea, FormField, fieldControlClass } from "@/components/admin-ui";
import { cn } from "@/lib/utils";

export function RequestControls({ requestId, status, assignedTo, meId, staff }: { requestId: number; status: string; assignedTo: number | null; meId: number; staff: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-col gap-5", pending && "opacity-70")}>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-[#18181B]">وضعیت</p>
        <div className="grid grid-cols-2 gap-1.5">
          {statuses.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={status === s.key ? "primary" : "secondary"}
              disabled={pending || status === s.key}
              aria-pressed={status === s.key}
              className="justify-center disabled:opacity-100"
              onClick={() =>
                start(async () => {
                  await setStatusAction(requestId, s.key);
                  toast.success(`وضعیت: ${s.name}`);
                })
              }
            >
              {status === s.key && <Check className="size-3.5" aria-hidden />}
              {s.name}
            </Button>
          ))}
        </div>
      </div>
      <FormField label="کارشناس مسئول" htmlFor="assignee">
        {assignedTo !== meId && (
          <Button
            className="mb-2 w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
            icon={<UserCheck />}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await assignAction(requestId, meId);
                toast.success("درخواست برای شما شد.");
              })
            }
          >
            برمی‌دارم
          </Button>
        )}
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
      </FormField>
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
      <FieldTextarea name="body" rows={3} maxLength={2000} placeholder="نتیجه‌ی تماس، قیمت اعلام‌شده، …" aria-label="یادداشت" />
      <p className="text-[11px] text-[#A1A1AA]">یادداشت‌ها در گزارش فعالیت ثبت می‌شوند.</p>
      {state?.error && <p className="text-xs text-[#B91C1C]">{state.error}</p>}
      <Button type="submit" size="sm" loading={pending}>
        افزودن یادداشت
      </Button>
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
