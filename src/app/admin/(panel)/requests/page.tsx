import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { listRequests, requestCounts } from "@/lib/admin-queries";
import { methods, statuses } from "@/lib/catalog";
import { AdminTable, AdminTd, AdminTh, AdminTHead, AdminTr, EmptyState, adminButtonVariants, fieldControlClass } from "@/components/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { LinkSegments } from "@/components/admin/link-segments";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatFaDateTime, toFaDigits } from "@/lib/utils";

export const metadata = { title: "درخواست‌ها" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const status = statuses.some((s) => s.key === one(sp.status)) ? one(sp.status) : undefined;
  const view = one(sp.view) === "mine" || one(sp.view) === "unassigned" ? one(sp.view) : undefined;
  const q = one(sp.q)?.trim().slice(0, 60) || undefined;
  const page = Math.max(1, Number(one(sp.page) || 1) || 1);
  const { rows, total, pages } = listRequests({ status, q, mine: view === "mine" ? me.id : undefined, unassigned: view === "unassigned", page });
  const counts = requestCounts();

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, view, q, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/requests?${s}` : "/admin/requests";
  };

  return (
    <>
      <PageHeader title="درخواست‌ها" description={`${toFaDigits(total)} درخواست${q ? ` برای «${q}»` : ""}`} />

      <section className="rounded-xl border border-[#E4E4E7] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#F4F4F5] p-4 lg:flex-row lg:items-center lg:justify-between">
          <form action="/admin/requests" className="flex w-full gap-2 lg:max-w-sm">
            {status && <input type="hidden" name="status" value={status} />}
            {view && <input type="hidden" name="view" value={view} />}
            <input name="q" defaultValue={q} placeholder="کد پیگیری، موبایل یا نام" aria-label="جستجو" className={fieldControlClass} />
            <button type="submit" className={adminButtonVariants({ variant: "secondary" })} aria-label="جستجو">
              <Search />
            </button>
          </form>
          <LinkSegments
            label="نمایش"
            items={[
              { href: qs({ view: undefined, page: undefined }), label: "همه", active: !view },
              { href: qs({ view: "mine", page: undefined }), label: "مال من", active: view === "mine" },
              { href: qs({ view: "unassigned", page: undefined }), label: "بدون کارشناس", active: view === "unassigned" },
            ]}
          />
        </div>
        <div className="border-b border-[#F4F4F5] px-4 py-3">
          <LinkSegments
            label="وضعیت"
            className="w-fit"
            items={[
              { href: qs({ status: undefined, page: undefined }), label: <>همه <span className="text-[#A1A1AA]">{toFaDigits(counts.total)}</span></>, active: !status },
              ...statuses.map((s) => ({
                href: qs({ status: s.key, page: undefined }),
                label: (
                  <>
                    {s.name} <span className="text-[#A1A1AA]">{toFaDigits(counts.byStatus[s.key] ?? 0)}</span>
                  </>
                ),
                active: status === s.key,
              })),
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Inbox />} title="درخواستی پیدا نشد" hint={q || status || view ? "فیلترها را تغییر دهید." : "درخواست‌های لندینگ اینجا نمایش داده می‌شوند."} />
        ) : (
          <>
            <div className="hidden md:block">
              <AdminTable>
                <AdminTHead>
                  <tr>
                    <AdminTh>کد پیگیری</AdminTh>
                    <AdminTh>مشتری</AdminTh>
                    <AdminTh>کالا</AdminTh>
                    <AdminTh>وضعیت</AdminTh>
                    <AdminTh>کارشناس</AdminTh>
                    <AdminTh>زمان ثبت</AdminTh>
                  </tr>
                </AdminTHead>
                <tbody>
                  {rows.map((r) => (
                    <AdminTr key={r.id} className="relative">
                      <AdminTd>
                        <Link href={`/admin/requests/${r.id}`} dir="ltr" className="font-mono text-[13px] font-bold text-[#2563EB] after:absolute after:inset-0">
                          {r.tracking_code}
                        </Link>
                      </AdminTd>
                      <AdminTd>
                        <div className="font-semibold">{r.first_name} {r.last_name}</div>
                        <div dir="ltr" className="text-right text-xs text-[#71717A]">{r.phone}</div>
                      </AdminTd>
                      <AdminTd className="max-w-72">
                        <div className="text-xs text-[#71717A]">{methods[r.method].short}، {toFaDigits(r.item_count)} کالا</div>
                        {r.first_item && <div dir="auto" className="truncate text-xs">{r.first_item}</div>}
                      </AdminTd>
                      <AdminTd><StatusBadge status={r.status} /></AdminTd>
                      <AdminTd className="text-[13px] text-[#52525B]">{r.assignee ?? "—"}</AdminTd>
                      <AdminTd className="text-xs text-[#71717A]">{formatFaDateTime(r.created_at)}</AdminTd>
                    </AdminTr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
            <ul className="divide-y divide-[#F4F4F5] md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex flex-col gap-1.5 p-4 hover:bg-[#FAFAFA]">
                    <div className="flex items-center justify-between gap-2">
                      <span dir="ltr" className="font-mono text-[13px] font-bold text-[#2563EB]">{r.tracking_code}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-sm font-semibold">
                      {r.first_name} {r.last_name} <span dir="ltr" className="text-xs font-normal text-[#71717A]">{r.phone}</span>
                    </div>
                    <div className="flex justify-between text-xs text-[#71717A]">
                      <span>{methods[r.method].short}، {toFaDigits(r.item_count)} کالا</span>
                      <span>{formatFaDateTime(r.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm text-[#52525B]">
          <span>صفحهٔ {toFaDigits(page)} از {toFaDigits(pages)}</span>
          <div className="flex gap-2">
            <Link aria-disabled={page <= 1} href={qs({ page: String(page - 1) })} className={cn(adminButtonVariants({ variant: "secondary", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}>قبلی</Link>
            <Link aria-disabled={page >= pages} href={qs({ page: String(page + 1) })} className={cn(adminButtonVariants({ variant: "secondary", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}>بعدی</Link>
          </div>
        </div>
      )}
    </>
  );
}
