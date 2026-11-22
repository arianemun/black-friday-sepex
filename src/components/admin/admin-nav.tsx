"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { SepexLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function AdminNav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/admin", label: "درخواست‌ها", match: (p: string) => p === "/admin" || p.startsWith("/admin/requests") },
    { href: "/admin/products", label: "پیشنهادها", match: (p: string) => p.startsWith("/admin/products") },
    ...(isAdmin
      ? [
          { href: "/admin/staff", label: "کارشناس‌ها", match: (p: string) => p.startsWith("/admin/staff") },
          { href: "/admin/settings", label: "تنظیمات", match: (p: string) => p.startsWith("/admin/settings") },
        ]
      : []),
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/admin" className="bg-brand px-2 py-1.5" aria-label="پنل">
          <SepexLogo className="h-5 text-ink" />
        </Link>
        <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "shrink-0 px-3 py-2 text-sm font-semibold",
                l.match(path) ? "bg-zinc-900 text-brand" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="hidden text-sm text-zinc-500 sm:block">{name}</span>
        <form action={logoutAction}>
          <button type="submit" className="flex size-9 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="خروج" title="خروج">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
