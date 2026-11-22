import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "پنل", template: "%s | پنل بلک‌فرایدی" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900">
      <AdminNav name={me.name} isAdmin={me.role === "admin"} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
