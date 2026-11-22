"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveStaffAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";

export type StaffRow = { id: number; name: string; username: string; phone: string | null; role: "admin" | "expert"; notify_sms: number; active: number };

const inputCls = "h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900";

function StaffForm({ row, onDone }: { row: StaffRow | null; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveStaffAction, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(state.message ?? "ذخیره شد.");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-3" key={row?.id ?? "new"}>
      {row && <input type="hidden" name="id" value={row.id} />}
      <label className="grid gap-1 text-xs font-semibold">نام<input name="name" required defaultValue={row?.name} className={inputCls} /></label>
      <label className="grid gap-1 text-xs font-semibold">نام کاربری<input name="username" required dir="ltr" defaultValue={row?.username} className={inputCls} /></label>
      <label className="grid gap-1 text-xs font-semibold">
        {row ? "رمز عبور جدید (خالی = بدون تغییر)" : "رمز عبور (حداقل ۸ کاراکتر)"}
        <input name="password" type="password" dir="ltr" autoComplete="new-password" required={!row} className={inputCls} />
      </label>
      <label className="grid gap-1 text-xs font-semibold">موبایل<input name="phone" dir="ltr" inputMode="tel" placeholder="09121234567" defaultValue={row?.phone ?? ""} className={inputCls} /></label>
      <label className="grid gap-1 text-xs font-semibold">
        نقش
        <select name="role" defaultValue={row?.role ?? "expert"} className={inputCls}>
          <option value="expert">کارشناس</option>
          <option value="admin">مدیر</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_sms" defaultChecked={row ? !!row.notify_sms : true} className="size-4 accent-zinc-900" />پیامک درخواست جدید</label>
      {row && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={!!row.active} className="size-4 accent-zinc-900" />فعال</label>}
      <button disabled={pending} className="flex h-10 items-center justify-center gap-2 bg-zinc-900 text-sm font-bold text-white disabled:opacity-60">
        {pending && <Loader2 className="size-4 animate-spin" />} {row ? "ذخیره" : "افزودن کارشناس"}
      </button>
    </form>
  );
}

export function StaffManager({ rows, meId }: { rows: StaffRow[]; meId: number }) {
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [formKey, setFormKey] = useState(0);
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <section className="h-fit border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">{editing ? `ویرایش ${editing.name}` : "کارشناس جدید"}</h2>
          {editing && <button onClick={() => setEditing(null)} className="text-xs text-zinc-500 underline">انصراف</button>}
        </div>
        <StaffForm key={`${editing?.id ?? "new"}-${formKey}`} row={editing} onDone={() => { setEditing(null); setFormKey((k) => k + 1); }} />
      </section>
      <ul className="h-fit divide-y divide-zinc-200 border border-zinc-200 bg-white">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {r.name} {r.id === meId && <span className="text-xs text-zinc-400">(شما)</span>}
              </p>
              <p className="text-xs text-zinc-500"><span dir="ltr">{r.username}</span>{r.phone ? <>، <span dir="ltr">{r.phone}</span></> : ""}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role === "admin" ? "مدیر" : "کارشناس"}</Badge>
              {!!r.notify_sms && <Badge variant="brand">پیامک</Badge>}
              {!r.active && <Badge variant="destructive">غیرفعال</Badge>}
            </div>
            <button onClick={() => setEditing(r)} className="flex size-9 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label={`ویرایش ${r.name}`}>
              <Pencil className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
