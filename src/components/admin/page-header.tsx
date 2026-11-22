import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Spinex admin page header. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-[#18181B]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#71717A]">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Spinex KPI card. */
export function KpiCard({ label, value, hint, hintTone = "muted" }: { label: string; value: string; hint?: ReactNode; hintTone?: "good" | "bad" | "muted" }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[#E4E4E7] bg-white px-5 py-[18px]">
      <span className="text-[13px] font-medium text-[#52525B]">{label}</span>
      <span className="text-[30px] font-extrabold leading-none tracking-tight text-[#18181B]">{value}</span>
      {hint != null && (
        <span className={cn("text-xs font-semibold", hintTone === "good" && "text-[#15803D]", hintTone === "bad" && "text-[#B91C1C]", hintTone === "muted" && "text-[#71717A]")}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** White bordered panel used for every section. */
export function Panel({ title, action, className, children }: { title?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border border-[#E4E4E7] bg-white p-5", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="m-0 text-[15px] font-bold text-[#18181B]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
