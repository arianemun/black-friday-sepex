"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LogOut, Menu, Settings, Tag, User, Users, X } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { SepexLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Sidebar shell in the soft style of the previous SEPEX panel (sepex-fetchX). */
export function AdminShell({ name, username, isAdmin, children }: { name: string; username: string; isAdmin: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the drawer after navigation
  useEffect(() => setOpen(false), [path]);

  const links = [
    { href: "/admin", label: "درخواست‌ها", icon: Inbox, match: (p: string) => p === "/admin" || p.startsWith("/admin/requests") },
    { href: "/admin/products", label: "پیشنهادهای لندینگ", icon: Tag, match: (p: string) => p.startsWith("/admin/products") },
    ...(isAdmin
      ? [
          { href: "/admin/staff", label: "کارشناس‌ها", icon: Users, match: (p: string) => p.startsWith("/admin/staff") },
          { href: "/admin/settings", label: "تنظیمات", icon: Settings, match: (p: string) => p.startsWith("/admin/settings") },
        ]
      : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 p-4">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="rounded-lg bg-brand p-2"><SepexLogo className="h-5 text-ink" /></span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-gray-900">پنل بلک‌فرایدی</span>
            <span className="block text-xs text-gray-500">سپکس</span>
          </span>
        </Link>
        <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="بستن منو">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((l) => {
          const active = l.match(path);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                active ? "bg-blue-100 font-semibold text-blue-700" : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="size-5 shrink-0" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
              <User className="size-5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">سلام، {name}</span>
              <span dir="ltr" className="block truncate text-right text-xs text-gray-500">{username}</span>
            </span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="flex h-9 w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-100">
              <LogOut className="size-4" /> خروج
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-soft flex min-h-dvh bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-l border-gray-200 bg-white lg:block">{sidebar}</aside>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-xl transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="باز کردن منو">
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-bold">پنل بلک‌فرایدی سپکس</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
