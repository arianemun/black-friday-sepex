import type { LucideIcon } from "lucide-react";
import { Calendar, Moon, Sun } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/admin-ui/card";
import { panelDates } from "@/lib/dates";

/** The fetchX-style header card: title + description, with the three calendars on the side. */
export function PageHeader({ icon: Icon, title, description, dates, actions }: { icon: LucideIcon; title: string; description: string; dates?: boolean; actions?: React.ReactNode }) {
  const d = dates ? panelDates() : null;
  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="w-full flex-1 lg:w-auto">
            <CardTitle className="flex items-center justify-start gap-2 text-right text-lg md:text-xl">
              <Icon className="h-4 w-4 md:h-5 md:w-5" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1 text-right text-xs md:text-sm">{description}</CardDescription>
          </div>
          {actions}
          {d && (
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:gap-3 lg:w-auto">
              {[
                { icon: Sun, color: "text-yellow-500", label: "تاریخ خورشیدی", v: d.persian, dir: "rtl" },
                { icon: Calendar, color: "text-blue-500", label: "تاریخ میلادی", v: d.gregorian, dir: "ltr" },
                { icon: Moon, color: "text-purple-500", label: "تاریخ قمری", v: d.islamic, dir: "rtl" },
              ].map((x) => (
                <div key={x.label} className="flex min-w-0 items-start gap-1.5 rounded-lg bg-gray-50 p-2 md:gap-2 md:p-2.5">
                  <x.icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 md:h-4 md:w-4 ${x.color}`} />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                    <div className="w-full text-center text-[10px] font-semibold text-gray-600 md:text-xs">{x.label}</div>
                    <div dir={x.dir} className="w-full text-center text-xs font-medium leading-tight text-gray-700 md:text-sm">{x.v.short}</div>
                    <div dir={x.dir} className="w-full break-words text-center text-[10px] leading-tight text-gray-500 md:text-xs">{x.v.full}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

export function StatCard({ icon: Icon, title, value, hint, color }: { icon: LucideIcon; title: string; value: string; hint?: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2">
        <CardTitle className="text-right text-xs font-medium md:text-sm">{title}</CardTitle>
        <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${color ?? "text-muted-foreground"}`} />
      </CardHeader>
      <div className="p-4 pt-0 text-right md:p-6 md:pt-0">
        <div className="text-xl font-bold md:text-2xl">{value}</div>
        {hint && <p className="mt-1 text-[10px] text-muted-foreground md:text-xs">{hint}</p>}
      </div>
    </Card>
  );
}
