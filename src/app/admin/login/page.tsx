import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentStaff, ensureBootstrapAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";
import { SepexLogo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "ورود به پنل", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  ensureBootstrapAdmin();
  if (await getCurrentStaff()) redirect("/admin");
  return (
    <main className="admin-soft flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <span className="rounded-xl bg-brand p-3 shadow-sm"><SepexLogo className="h-9 text-ink" /></span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <h1 className="text-lg font-bold">ورود به پنل بلک‌فرایدی</h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
