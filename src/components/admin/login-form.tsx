"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/admin/actions";
import { Input } from "@/components/admin-ui/input";
import { Button } from "@/components/admin-ui/button";
import { Label } from "@/components/admin-ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-5 grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="username">نام کاربری</Label>
        <Input id="username" name="username" dir="ltr" autoComplete="username" required className="text-left" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">رمز عبور</Label>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className="text-left" />
      </div>
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700">
        {pending && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
        ورود
      </Button>
    </form>
  );
}
