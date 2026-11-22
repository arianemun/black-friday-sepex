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
        <Input id="username" name="username" dir="ltr" autoComplete="username" required className="text-left focus-visible:border-blue-500 focus-visible:ring-blue-500/20" />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-semibold">رمز عبور</label>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className="text-left focus-visible:border-blue-500 focus-visible:ring-blue-500/20" />
      </div>
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700">
        {pending && <Loader2 className="animate-spin" />}
        ورود
      </Button>
    </form>
  );
}
