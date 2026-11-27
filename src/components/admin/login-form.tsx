"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";
import { Button, FieldInput, FormField } from "@/components/admin-ui";

export function LoginForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      {state?.error && (
        <p role="alert" className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {state.error}
        </p>
      )}
      <div className="mb-4">
        <FormField label="نام کاربری" htmlFor="username">
          <FieldInput id="username" name="username" dir="ltr" autoComplete="username" required />
        </FormField>
      </div>
      <div className="mb-6">
        <FormField label="رمز عبور" htmlFor="password">
          <FieldInput id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
        </FormField>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "در حال ورود..." : "ورود"}
      </Button>
    </form>
  );
}
