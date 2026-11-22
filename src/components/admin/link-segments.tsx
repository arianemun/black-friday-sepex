import Link from "next/link";
import { cn } from "@/lib/utils";

/** Spinex SegmentedControl look, driven by links (works in server components). */
export function LinkSegments({ items, label, className }: { items: { href: string; label: React.ReactNode; active: boolean }[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("no-scrollbar flex max-w-full overflow-x-auto rounded-lg bg-[#F4F4F5] p-[3px]", className)}>
      {items.map((it, i) => (
        <Link
          key={i}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={cn(
            "flex h-[30px] shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors",
            it.active ? "bg-white font-semibold text-[#18181B] shadow-sm" : "font-medium text-[#52525B] hover:text-[#18181B]"
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
