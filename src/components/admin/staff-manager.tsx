"use client";

import { useActionState, useEffect, useState } from "react";
import { roleLabels, type Role } from "@/lib/roles";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveStaffAction } from "@/app/admin/actions";
import { AdminTable, AdminTd, AdminTh, AdminTHead, AdminTr, Badge, Button, FieldInput, FormField, IconButton, fieldControlClass } from "@/components/admin-ui";

export type StaffRow = { id: number; name: string; username: string; phone: string | null; role: Role; notify_sms: number; active: number };

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
    <form action={action} className="flex flex-col gap-4">
      {row && <input type="hidden" name="id" value={row.id} />}
      <FormField label="نام" htmlFor="s-name"><FieldInput id="s-name" name="name" required defaultValue={row?.name} /></FormField>
      <FormField label="نام کاربری" htmlFor="s-user" helper="حروف انگلیسی، عدد، نقطه یا خط تیره"><FieldInput id="s-user" name="username" required dir="ltr" defaultValue={row?.username} /></FormField>
      <FormField label={row ? "رمز عبور جدید" : "رمز عبور"} htmlFor="s-pass" helper={row ? "خالی بگذارید تا تغییر نکند." : "حداقل ۸ کاراکتر"}>
        <FieldInput id="s-pass" name="password" type="password" dir="ltr" autoComplete="new-password" required={!row} />
      </FormField>
      <FormField label="موبایل" htmlFor="s-phone" helper="برای پیامک درخواست جدید لازم است.">
        <FieldInput id="s-phone" name="phone" dir="ltr" inputMode="tel" placeholder="09121234567" defaultValue={row?.phone ?? ""} />
      </FormField>
      <FormField label="نقش" htmlFor="s-role">
        <select id="s-role" name="role" defaultValue={row?.role ?? "expert"} className={fieldControlClass}>
          <option value="expert">کارشناس</option>
          <option value="supervisor">سرپرست</option>
          <option value="admin">مدیر</option>
        </select>
      </FormField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_sms" defaultChecked={row ? !!row.notify_sms : true} className="size-4 accent-[#18181B]" />پیامک درخواست جدید</label>
      {row && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={!!row.active} className="size-4 accent-[#18181B]" />فعال</label>}
      <Button type="submit" loading={pending}>{row ? "ذخیره" : "افزودن کارشناس"}</Button>
    </form>
  );
}

export function StaffManager({ rows, meId }: { rows: StaffRow[]; meId: number }) {
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [formKey, setFormKey] = useState(0);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] [&>*]:min-w-0">
      <section className="flex flex-col gap-4 rounded-xl border border-[#E4E4E7] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-bold">{editing ? `ویرایش ${editing.name}` : "کارشناس جدید"}</h2>
          {editing && <Button variant="link" size="sm" onClick={() => setEditing(null)}>انصراف</Button>}
        </div>
        <StaffForm key={`${editing?.id ?? "new"}-${formKey}`} row={editing} onDone={() => { setEditing(null); setFormKey((k) => k + 1); }} />
      </section>
      <section className="rounded-xl border border-[#E4E4E7] bg-white">
        <AdminTable>
          <AdminTHead>
            <tr>
              <AdminTh>نام</AdminTh>
              <AdminTh className="hidden sm:table-cell">موبایل</AdminTh>
              <AdminTh>وضعیت</AdminTh>
              <AdminTh className="w-12" />
            </tr>
          </AdminTHead>
          <tbody>
            {rows.map((r) => (
              <AdminTr key={r.id}>
                <AdminTd>
                  <div className="font-semibold">{r.name} {r.id === meId && <span className="text-xs font-normal text-[#A1A1AA]">(شما)</span>}</div>
                  <div dir="ltr" className="text-right text-xs text-[#71717A]">{r.username}</div>
                </AdminTd>
                <AdminTd className="hidden text-[13px] text-[#52525B] sm:table-cell" dir="ltr">{r.phone ?? "—"}</AdminTd>
                <AdminTd>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={r.role === "admin" ? "info" : r.role === "supervisor" ? "warning" : "neutral"}>{roleLabels[r.role]}</Badge>
                    {!!r.notify_sms && <Badge variant="success">پیامک</Badge>}
                    {!r.active && <Badge variant="danger">غیرفعال</Badge>}
                  </div>
                </AdminTd>
                <AdminTd>
                  <IconButton aria-label={`ویرایش ${r.name}`} tooltip="ویرایش" onClick={() => setEditing(r)}>
                    <Pencil />
                  </IconButton>
                </AdminTd>
              </AdminTr>
            ))}
          </tbody>
        </AdminTable>
      </section>
    </div>
  );
}
