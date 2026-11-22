import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "پنل", template: "%s | پنل بلک‌فرایدی" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <AdminShell name={me.name} username={me.username} isAdmin={me.role === "admin"}>
      {children}
    </AdminShell>
  );
}
