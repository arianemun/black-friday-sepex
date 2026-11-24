import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-nav";
import { AdminThemeSync } from "@/components/admin/admin-theme-sync";
import { ConfirmProvider } from "@/components/admin-ui/confirm-dialog";
import { OffShiftNotice } from "@/components/admin/off-shift-notice";
import { onShiftIds } from "@/lib/shifts";

export const metadata: Metadata = { title: { default: "پنل", template: "%s | پنل بلک‌فرایدی" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  // Experts outside today's plan can still work, but are told it isn't their shift.
  const onShift = me.role === "expert" ? onShiftIds() : null;
  const offShift = !!onShift && !onShift.has(me.id);
  return (
    <ConfirmProvider>
      <AdminThemeSync />
      <AdminShell name={me.name} username={me.username} role={me.role} notice={offShift ? <OffShiftNotice /> : null}>
        {children}
      </AdminShell>
    </ConfirmProvider>
  );
}
