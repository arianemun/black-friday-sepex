"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Loader2, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { addNoteAction, assignAction, refetchLinksAction, setStatusAction } from "@/app/admin/actions";
import { statuses } from "@/lib/catalog";
import { Button } from "@/components/admin-ui/button";
import { Label } from "@/components/admin-ui/label";
import { cn } from "@/lib/utils";

export function RequestControls({ requestId, status, assignedTo, meId, staff }: { requestId: number; status: string; assignedTo: number | null; meId: number; staff: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-col gap-5", pending && "opacity-70")}>
      <div>
        <Label className="mb-2 block">وضعیت</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {statuses.map((s) => (
            <Button
              key={s.key}
              type="button"
              size="sm"
              variant={status === s.key ? "default" : "outline"}
              disabled={pending}
              className={status === s.key ? "bg-blue-600 hover:bg-blue-700" : ""}
              onClick={() =>
                start(async () => {
                  await setStatusAction(requestId, s.key);
                  toast.success(`وضعیت: ${s.name}`);
                })
              }
            >
              {s.name}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="assignee" className="mb-2 block">کارشناس مسئول</Label>
        {assignedTo !== meId && (
          <Button
            type="button"
            disabled={pending}
            className="mb-2 w-full bg-green-600 hover:bg-green-700"
            onClick={() =>
              start(async () => {
                await assignAction(requestId, meId);
                toast.success("درخواست برای شما شد.");
              })
            }
          >
            <UserCheck className="ml-1.5 h-4 w-4" /> برمی‌دارم
          </Button>
        )}
        <select
          id="assignee"
          value={assignedTo ?? ""}
          disabled={pending}
          onChange={(e) => start(() => assignAction(requestId, e.target.value ? Number(e.target.value) : null))}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <form ref={ref} action={action} className="mt-2 flex flex-col gap-2">
      <textarea
        name="body"
        rows={3}
        maxLength={2000}
        placeholder="نتیجه‌ی تماس، قیمت اعلام‌شده، …"
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state?.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
      <Button disabled={pending} size="sm">
        {pending && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />} افزودن یادداشت
      </Button>
    </form>
  );
}

export function RefetchButton({ requestId }: { requestId: number }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => start(() => refetchLinksAction(requestId))} className="w-fit text-muted-foreground">
      <RefreshCw className={cn("ml-1.5 h-4 w-4", pending && "animate-spin")} /> خواندن دوباره‌ی اطلاعات لینک‌ها
    </Button>
  );
}
