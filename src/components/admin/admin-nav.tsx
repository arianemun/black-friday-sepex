"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarClock, GraduationCap, Download, ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, Search, Settings2, Tag, Users, X, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { IconButton, adminButtonVariants } from "@/components/admin-ui";
import { cn } from "@/lib/utils";
import { canManageShifts, canViewInsights, roleLabels, type Role } from "@/lib/roles";

/** Admin shell ported from Spinex: white 248px sidebar, sticky top bar, neutral zinc + blue. */

type NavItem = { href: string; label: string; icon: LucideIcon; group: "work" | "system"; only?: (role: Role) => boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, group: "work" },
  { href: "/admin/requests", label: "درخواست‌ها", icon: Inbox, group: "work" },
  { href: "/admin/products", label: "پیشنهادهای لندینگ", icon: Tag, group: "work" },
  { href: "/admin/insights", label: "رفتار بازدیدکننده‌ها", icon: Activity, group: "work", only: canViewInsights },
  { href: "/admin/training", label: "آموزش‌ها", icon: GraduationCap, group: "work" },
  { href: "/admin/shifts", label: "شیفت‌بندی", icon: CalendarClock, group: "work", only: canManageShifts },
  { href: "/admin/staff", label: "کارشناس‌ها", icon: Users, group: "system", only: (r) => r === "admin" },
  { href: "/admin/settings", label: "تنظیمات و سامانه", icon: Settings2, group: "system", only: (r) => r === "admin" },
];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

const MARK =
  "M316 121 L370 143 L424 121 L370 97 Z M124 23 L124 68 L247 121 L370 68 L493 121 L493 75 L370 23 L247 75 Z M193 23 L247 47 L300 23 L247 0 Z";

function Brand() {
  return (
    <Link href="/admin" className="mb-1 flex items-center gap-2.5 px-2.5 pb-5 pt-1">
      <span aria-hidden className="flex size-[30px] items-center justify-center rounded-lg bg-[#18181B]">
        <svg width="20" height="10" viewBox="124 0 370 143" fill="#FFCB05">
          <path fillRule="evenodd" d={MARK} />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-extrabold tracking-[0.2px] text-[#18181B]">SEPEX</span>
        <span className="text-[11px] text-[#71717A]">پنل بلک‌فرایدی</span>
      </span>
    </Link>
  );
}

function Nav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const path = usePathname();
  const isAdmin = role === "admin";
  const items = NAV.filter((i) => !i.only || i.only(role));
  const group = (g: NavItem["group"]) =>
    items
      .filter((i) => i.group === g)
      .map((item) => {
        const Icon = item.icon;
        const active = isActive(path, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-sm transition-colors",
              active ? "bg-[#F4F4F5] font-bold text-[#18181B]" : "font-medium text-[#3F3F46] hover:bg-[#F4F4F5]"
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
            {item.label}
          </Link>
        );
      });
  return (
    <nav aria-label="ناوبری اصلی" className="flex flex-col gap-1">
      <span className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-[#71717A]">کمپین</span>
      {group("work")}
      {isAdmin && <span className="px-2.5 pb-1 pt-4 text-[11px] font-semibold text-[#71717A]">سامانه</span>}
      {group("system")}
    </nav>
  );
}

export function AdminShell({ name, username, role, notice, children }: { name: string; username: string; role: Role; notice?: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the drawer after navigation
  useEffect(() => setOpen(false), [path]);

  const sidebar = (
    <>
      <Brand />
      <div className="flex-1 overflow-y-auto">
        <Nav role={role} onNavigate={() => setOpen(false)} />
      </div>
      <div className="mt-auto flex items-center gap-2.5 border-t border-[#F4F4F5] px-2.5 py-3">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E4E4E7] text-[13px] font-bold">
          {name.trim().charAt(0) || "؟"}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-[#18181B]">{name}</span>
          <span className="block truncate text-[11px] text-[#71717A]">
            {role === "admin" ? "مدیر سیستم" : roleLabels[role]} · <span dir="ltr">{username}</span>
          </span>
        </div>
        <form action={logoutAction}>
          <IconButton type="submit" aria-label="خروج" tooltip="خروج">
            <LogOut />
          </IconButton>
        </form>
      </div>
    </>
  );

  return (
    <div className="admin-soft flex min-h-dvh bg-[#FAFAFA] text-[#18181B]">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-l border-[#E4E4E7] bg-white p-[20px_14px] md:flex">{sidebar}</aside>

      {/* mobile drawer */}
      <div className={cn("fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setOpen(false)} aria-hidden />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-[#E4E4E7] bg-white p-4 shadow-xl transition-transform duration-300 md:hidden",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
        aria-label="منوی مدیریت"
      >
        <IconButton className="absolute left-3 top-3" aria-label="بستن منو" onClick={() => setOpen(false)}>
          <X />
        </IconButton>
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] bg-white px-4 py-3.5 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <IconButton className="md:hidden" aria-label="باز کردن منو" tooltip="منو" onClick={() => setOpen(true)}>
              <Menu />
            </IconButton>
            <form action="/admin/requests" className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#A1A1AA]" aria-hidden />
              <input
                name="q"
                placeholder="جستجو: کد پیگیری، موبایل یا نام"
                aria-label="جستجوی درخواست"
                className="h-[38px] w-full rounded-lg border border-[#E4E4E7] bg-white pl-3 pr-9 text-sm outline-none transition-[border,box-shadow] placeholder:text-[#A1A1AA] focus:border-[#2563EB] focus:shadow-[0_0_0_3px_#DBEAFE]"
              />
            </form>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener" className={cn(adminButtonVariants({ variant: "secondary" }), "hidden sm:inline-flex")}>
              <ExternalLink />
              مشاهده سایت
            </a>
            <a href="/admin/export" className={adminButtonVariants({ variant: "primary" })} aria-label="خروجی Excel">
              <Download />
              <span className="hidden sm:inline">خروجی Excel</span>
            </a>
          </div>
        </header>

        {notice}
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 sm:py-7 md:px-8">{children}</main>
      </div>
    </div>
  );
}
