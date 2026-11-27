import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentStaff, ensureBootstrapAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "ورود به پنل", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MARK =
  "M316 121 L370 143 L424 121 L370 97 Z M124 23 L124 68 L247 121 L370 68 L493 121 L493 75 L370 23 L247 75 Z M193 23 L247 47 L300 23 L247 0 Z";

/** Spinex admin login, with the SEPEX mark. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  ensureBootstrapAdmin();
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") && !sp.next.startsWith("//") ? sp.next.slice(0, 6000) : "";
  if (await getCurrentStaff()) redirect(next || "/admin");
  return (
    <div className="admin-soft flex min-h-dvh items-center justify-center bg-[#FAFAFA] px-4 text-[#18181B]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-[#18181B]">
            <svg width="30" height="12" viewBox="124 0 370 143" fill="#FFCB05">
              <path fillRule="evenodd" d={MARK} />
            </svg>
          </span>
          <div className="flex flex-col">
            <span className="text-2xl font-extrabold tracking-wide">SEPEX</span>
            <span className="text-xs text-[#71717A]">پنل بلک‌فرایدی</span>
          </div>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-extrabold">ورود به پنل مدیریت</h1>
          <p className="mb-5 text-sm text-[#71717A]">برای ادامه وارد حساب خود شوید.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
