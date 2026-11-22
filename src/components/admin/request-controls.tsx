"use client";

import { useActionState, useTransition, useRef, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { addNoteAction, assignAction, refetchLinksAction, setStatusAction } from "@/app/admin/actions";
import { statuses } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function RequestControls({ requestId, status, assignedTo, meId, staff }: { requestId: number; status: string; assignedTo: number | null; meId: number; staff: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-col gap-4", pending && "opacity-70")}>
      <div>
        <h2 className="mb-2 font-bold">وضعیت</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {statuses.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                await setStatusAction(requestId, s.key);
                toast.success(`وضعیت: ${s.name}`);
              })}
              className={cn(
                "rounded-lg border px-2 py-2 text-sm font-semibold transition-colors",
                status === s.key ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-2 font-bold">کارشناس</h2>
        {assignedTo !== meId && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              await assignAction(requestId, meId);
              toast.success("درخواست برای شما شد.");
            })}
            className="mb-2 h-10 w-full rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
          >
            برمی‌دارم
          </button>
        )}
        <select
          value={assignedTo ?? ""}
          disabled={pending}
          onChange={(e) => start(() => assignAction(requestId, e.target.value ? Number(e.target.value) : null))}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm"
          aria-label="کارشناس مسئول"
        >
          <option value="">بدون کارشناس</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
    <form ref={ref} action={action} className="mt-3 flex flex-col gap-2">
      <textarea name="body" rows={3} maxLength={2000} placeholder="نتیجه‌ی تماس، قیمت اعلام‌شده، …" className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
      {state?.error && <p className="text-xs font-semibold text-destructive">{state.error}</p>}
      <button disabled={pending} className="flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {pending && <Loader2 className="size-4 animate-spin" />} افزودن یادداشت
      </button>
    </form>
  );
}

export function RefetchButton({ requestId }: { requestId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => refetchLinksAction(requestId))}
      className="inline-flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} /> خواندن دوباره‌ی اطلاعات لینک‌ها
    </button>
  );
}
