"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-5 grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="username" className="text-sm font-semibold">نام کاربری</label>
        <Input id="username" name="username" dir="ltr" autoComplete="username" required className="text-left" />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-semibold">رمز عبور</label>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className="text-left" />
      </div>
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{state.error}</p>}
      <Button type="submit" variant="ink" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        ورود
      </Button>
    </form>
  );
}
