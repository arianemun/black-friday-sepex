import Link from "next/link";
import { CheckCircle2, Clock, Download, Inbox, LayoutDashboard, Search, UserX } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { listRequests, requestCounts } from "@/lib/admin-queries";
import { methods, statuses } from "@/lib/catalog";
import { Button } from "@/components/admin-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin-ui/card";
import { Input } from "@/components/admin-ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin-ui/table";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatFaDateTime, toFaDigits } from "@/lib/utils";

export const metadata = { title: "درخواست‌ها" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const status = one(sp.status);
  const view = one(sp.view);
  const q = one(sp.q)?.slice(0, 60);
  const page = Number(one(sp.page) || 1) || 1;
  const { rows, total, pages } = listRequests({
    status: statuses.some((s) => s.key === status) ? status : undefined,
    q,
    mine: view === "mine" ? me.id : undefined,
    unassigned: view === "unassigned",
    page,
  });
  const counts = requestCounts();

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, view, q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin?${s}` : "/admin";
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
      active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader icon={LayoutDashboard} title="داشبورد مدیریت" description="درخواست‌های ثبت‌شده از لندینگ بلک‌فرایدی سپکس" dates />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Inbox} title="کل درخواست‌ها" value={toFaDigits(counts.total)} hint="از ابتدای کمپین" color="text-blue-500" />
        <StatCard icon={Clock} title="۲۴ ساعت گذشته" value={toFaDigits(counts.today)} hint="درخواست جدید" color="text-purple-500" />
        <StatCard icon={UserX} title="بدون کارشناس" value={toFaDigits(counts.unassigned)} hint="جدید و برداشته‌نشده" color="text-orange-500" />
        <StatCard icon={CheckCircle2} title="سفارش قطعی" value={toFaDigits(counts.byStatus.ordered ?? 0)} hint="تبدیل به سفارش" color="text-green-500" />
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base md:text-lg">لیست درخواست‌ها</CardTitle>
              <CardDescription className="mt-1 text-xs md:text-sm">{toFaDigits(total)} نتیجه</CardDescription>
            </div>
            <div className="flex gap-2">
              <form action="/admin" className="flex gap-2">
                {status && <input type="hidden" name="status" value={status} />}
                {view && <input type="hidden" name="view" value={view} />}
                <Input name="q" defaultValue={q} placeholder="کد پیگیری، موبایل یا نام" className="h-9 w-full md:w-64" />
                <Button type="submit" size="sm" variant="outline" aria-label="جستجو">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              <Button asChild size="sm" variant="outline">
                <a href="/admin/export">
                  <Download className="ml-1.5 h-4 w-4" />
                  اکسل
                </a>
              </Button>
            </div>
          </div>
          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
            <Link href={qs({ view: undefined, page: undefined })} className={chip(!view)}>همه</Link>
            <Link href={qs({ view: "mine", page: undefined })} className={chip(view === "mine")}>مال من</Link>
            <Link href={qs({ view: "unassigned", page: undefined })} className={chip(view === "unassigned")}>بدون کارشناس</Link>
            <span className="mx-1 w-px shrink-0 bg-gray-200" />
            <Link href={qs({ status: undefined, page: undefined })} className={chip(!status)}>همه‌ی وضعیت‌ها</Link>
            {statuses.map((s) => (
              <Link key={s.key} href={qs({ status: s.key, page: undefined })} className={chip(status === s.key)}>
                {s.name}
                <span className="opacity-60">{toFaDigits(counts.byStatus[s.key] ?? 0)}</span>
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">درخواستی با این فیلتر نیست.</div>
          ) : (
            <>
              {/* desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>کد پیگیری</TableHead>
                      <TableHead>مشتری</TableHead>
                      <TableHead>کالا</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>کارشناس</TableHead>
                      <TableHead>زمان ثبت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className="relative">
                        <TableCell>
                          <Link href={`/admin/requests/${r.id}`} className="font-mono text-sm font-bold text-blue-700 after:absolute after:inset-0" dir="ltr">
                            {r.tracking_code}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.first_name} {r.last_name}</div>
                          <div dir="ltr" className="text-right text-xs text-muted-foreground">{r.phone}</div>
                        </TableCell>
                        <TableCell className="max-w-64">
                          <div className="text-xs text-muted-foreground">{methods[r.method].short}، {toFaDigits(r.item_count)} کالا</div>
                          {r.first_item && <div dir="auto" className="truncate text-xs">{r.first_item}</div>}
                        </TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.assignee ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatFaDateTime(r.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* mobile */}
              <ul className="divide-y md:hidden">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/requests/${r.id}`} className="flex flex-col gap-1.5 p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-2">
                        <span dir="ltr" className="font-mono text-sm font-bold text-blue-700">{r.tracking_code}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-sm font-medium">{r.first_name} {r.last_name} <span dir="ltr" className="text-xs font-normal text-muted-foreground">{r.phone}</span></div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{methods[r.method].short}، {toFaDigits(r.item_count)} کالا</span>
                        <span>{formatFaDateTime(r.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {pages > 1 && (
            <nav className="flex items-center justify-center gap-2 p-4 text-sm" aria-label="صفحه‌ها">
              {page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={qs({ page: String(page - 1) })}>قبلی</Link>
                </Button>
              )}
              <span className="text-muted-foreground">صفحه‌ی {toFaDigits(page)} از {toFaDigits(pages)}</span>
              {page < pages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={qs({ page: String(page + 1) })}>بعدی</Link>
                </Button>
              )}
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
