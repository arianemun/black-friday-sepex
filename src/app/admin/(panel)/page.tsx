import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { dashboard, listRequests, type DashRange } from "@/lib/admin-queries";
import { methods, statuses, type Method } from "@/lib/catalog";
import { AdminTable, AdminTd, AdminTh, AdminTHead, AdminTr, EmptyState } from "@/components/admin-ui";
import { KpiCard, PageHeader, Panel } from "@/components/admin/page-header";
import { LinkSegments } from "@/components/admin/link-segments";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatFaDateTime, toFaDigits } from "@/lib/utils";
import { Inbox } from "lucide-react";

export const metadata = { title: "داشبورد" };

const fa = (n: number) => toFaDigits(n);
const pct = (part: number, whole: number) => (whole ? `${toFaDigits(((part / whole) * 100).toFixed(0))}٪` : "—");

function dayLabel(b: string) {
  const d = new Date(`${b}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? b : new Intl.DateTimeFormat("fa-IR", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(d);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const range: DashRange = sp.range === "today" || sp.range === "all" ? sp.range : "7d";
  const d = dashboard(range);
  const recent = listRequests({ page: 1 }).rows.slice(0, 8);
  const mine = listRequests({ mine: me.id, page: 1 }).total;

  const delta = d.yesterday ? Math.round(((d.today - d.yesterday) / d.yesterday) * 100) : null;
  const contacted = d.total - (d.byStatus.new ?? 0);
  const ordered = d.byStatus.ordered ?? 0;
  const series = d.filled;
  const max = Math.max(1, ...series.map((s) => s.c));
  const chartTitle = range === "today" ? "درخواست‌ها در طول امروز" : range === "7d" ? "درخواست‌ها در ۷ روز اخیر" : "درخواست‌ها در طول کمپین";

  return (
    <>
      <PageHeader
        title="داشبورد"
        description="عملکرد کمپین بلک‌فرایدی در یک نگاه"
        actions={
          <LinkSegments
            label="بازهٔ زمانی"
            items={[
              { href: "/admin?range=today", label: "امروز", active: range === "today" },
              { href: "/admin", label: "۷ روز", active: range === "7d" },
              { href: "/admin?range=all", label: "کل کمپین", active: range === "all" },
            ]}
          />
        }
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            label="درخواست‌ها"
            value={fa(d.total)}
            hintTone={delta === null ? "muted" : delta >= 0 ? "good" : "bad"}
            hint={
              delta === null ? (
                `امروز ${fa(d.today)} درخواست`
              ) : (
                <>
                  {delta >= 0 ? "▲" : "▼"} {fa(Math.abs(delta))}٪ <span className="font-normal text-[#71717A]">امروز نسبت به دیروز</span>
                </>
              )
            }
          />
          <KpiCard
            label="جدید، بدون کارشناس"
            value={fa(d.unassigned)}
            hintTone={d.unassigned > 0 ? "bad" : "good"}
            hint={d.unassigned > 0 ? <Link href="/admin/requests?view=unassigned&status=new" className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-2 py-0.5 hover:bg-[#FECACA]">منتظر تماس؛ مشاهده</Link> : "همه برداشته شده‌اند"}
          />
          <KpiCard label="پیگیری‌شده" value={fa(contacted)} hint={`${pct(contacted, d.total)} از درخواست‌ها`} />
          <KpiCard label="سفارش قطعی" value={fa(ordered)} hintTone={ordered ? "good" : "muted"} hint={`نرخ تبدیل ${pct(ordered, d.total)}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title={chartTitle}
            className="lg:col-span-2"
            action={
              <span className="flex gap-3.5 text-xs text-[#52525B]">
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-[#2563EB]" />درخواست</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-[#BFDBFE]" />سفارش قطعی</span>
              </span>
            }
          >
            {d.total === 0 ? (
              <p className="py-16 text-center text-sm text-[#71717A]">داده‌ای در این بازه نیست</p>
            ) : (
              <>
                <div className="flex h-[220px] items-end gap-2.5 border-b border-[#E4E4E7] px-1">
                  {series.map((s) => (
                    <div key={s.b} className="flex h-full min-w-0 flex-1 items-end gap-[3px]" title={`${fa(s.c)} درخواست، ${fa(s.o ?? 0)} سفارش`}>
                      <div className="flex-1 rounded-t bg-[#2563EB] hover:bg-[#1D4ED8]" style={{ height: `${Math.round((s.c / max) * 100)}%` }} />
                      <div className="flex-1 rounded-t bg-[#BFDBFE]" style={{ height: `${Math.round(((s.o ?? 0) / max) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2.5 px-1 text-[11px] text-[#71717A]">
                  {series.map((s) => (
                    <span key={s.b} className="min-w-0 flex-1 truncate text-center">
                      {range === "today" ? toFaDigits(Number(s.b)) : dayLabel(s.b)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel title="وضعیت درخواست‌ها">
            <div className="flex flex-col gap-3">
              {statuses.map((s) => {
                const c = d.byStatus[s.key] ?? 0;
                return (
                  <Link key={s.key} href={`/admin/requests?status=${s.key}`} className="group flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="group-hover:text-[#2563EB]">{s.name}</span>
                      <span className="font-bold">{fa(c)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F4F4F5]">
                      <div className="h-full rounded-full bg-[#18181B]" style={{ width: `${d.total ? (c / d.total) * 100 : 0}%`, background: s.key === "ordered" ? "#2563EB" : undefined }} />
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-auto flex justify-between border-t border-[#F4F4F5] pt-3 text-xs text-[#52525B]">
              <span>درخواست‌های من</span>
              <Link href="/admin/requests?view=mine" className="font-bold text-[#18181B] hover:text-[#2563EB]">{fa(mine)}</Link>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="روش ثبت">
            {d.byMethod.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#71717A]">هنوز درخواستی نیست</p>
            ) : (
              d.byMethod.map((m) => (
                <div key={m.method} className="flex items-center justify-between border-b border-[#F4F4F5] pb-2.5 text-[13px] last:border-0 last:pb-0">
                  <span>{methods[m.method as Method]?.short ?? m.method}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-[#71717A]">{pct(m.c, d.total)}</span>
                    <span className="font-bold">{fa(m.c)}</span>
                  </span>
                </div>
              ))
            )}
          </Panel>
          <Panel title="منبع ورود">
            {d.bySource.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#71717A]">هنوز درخواستی نیست</p>
            ) : (
              d.bySource.map((s) => (
                <div key={s.src} className="flex items-center justify-between border-b border-[#F4F4F5] pb-2.5 text-[13px] last:border-0 last:pb-0">
                  <span dir="auto" className="truncate">{s.src}</span>
                  <span className="font-bold">{fa(s.c)}</span>
                </div>
              ))
            )}
          </Panel>
          <Panel title="کارشناس‌ها">
            {d.experts.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#71717A]">کارشناس فعالی نیست</p>
            ) : (
              d.experts.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-[#F4F4F5] pb-2.5 text-[13px] last:border-0 last:pb-0">
                  <span className="truncate">{e.name}</span>
                  <span className="flex items-center gap-3 text-xs text-[#71717A]">
                    <span>باز {fa(e.open ?? 0)}</span>
                    <span>قطعی {fa(e.ordered ?? 0)}</span>
                    <span className="text-[13px] font-bold text-[#18181B]">{fa(e.assigned)}</span>
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>

        <Panel title="آخرین درخواست‌ها" action={<Link href="/admin/requests" className="text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]">همه‌ی درخواست‌ها</Link>} className="p-0 pt-5 [&>div:first-child]:px-5">
          {recent.length === 0 ? (
            <EmptyState icon={<Inbox />} title="هنوز درخواستی ثبت نشده" hint="درخواست‌های لندینگ اینجا نمایش داده می‌شوند." />
          ) : (
            <AdminTable>
              <AdminTHead>
                <tr>
                  <AdminTh>کد پیگیری</AdminTh>
                  <AdminTh>مشتری</AdminTh>
                  <AdminTh className="hidden md:table-cell">روش</AdminTh>
                  <AdminTh>وضعیت</AdminTh>
                  <AdminTh className="hidden md:table-cell">زمان</AdminTh>
                </tr>
              </AdminTHead>
              <tbody>
                {recent.map((r) => (
                  <AdminTr key={r.id} className="relative">
                    <AdminTd>
                      <Link href={`/admin/requests/${r.id}`} dir="ltr" className="font-mono text-[13px] font-bold text-[#2563EB] after:absolute after:inset-0">
                        {r.tracking_code}
                      </Link>
                    </AdminTd>
                    <AdminTd>{r.first_name} {r.last_name}</AdminTd>
                    <AdminTd className="hidden text-[#52525B] md:table-cell">{methods[r.method].short}</AdminTd>
                    <AdminTd><StatusBadge status={r.status} /></AdminTd>
                    <AdminTd className="hidden text-xs text-[#71717A] md:table-cell">{formatFaDateTime(r.created_at)}</AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </Panel>
      </div>
    </>
  );
}
