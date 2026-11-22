import Link from "next/link";
import { CheckCircle2, Clock, Download, Inbox, UserX } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { listRequests, requestCounts } from "@/lib/admin-queries";
import { methods, statuses, statusInfo } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">درخواست‌ها</h1>
          <p className="mt-1 text-sm text-gray-500">درخواست‌های ثبت‌شده از لندینگ بلک‌فرایدی</p>
        </div>
        <a href="/admin/export" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-50">
          <Download className="size-4" /> خروجی اکسل
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {[
          { label: "کل درخواست‌ها", value: counts.total, icon: Inbox, color: "text-blue-600", iconColor: "text-blue-500" },
          { label: "۲۴ ساعت گذشته", value: counts.today, icon: Clock, color: "text-purple-600", iconColor: "text-purple-500" },
          { label: "جدید، بدون کارشناس", value: counts.unassigned, icon: UserX, color: "text-orange-600", iconColor: "text-orange-500", href: qs({ view: "unassigned", status: "new" }) },
          { label: "سفارش قطعی", value: counts.byStatus.ordered ?? 0, icon: CheckCircle2, color: "text-green-600", iconColor: "text-green-500", href: qs({ status: "ordered", view: undefined }) },
        ].map((c) => {
          const Icon = c.icon;
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 md:text-sm">{c.label}</span>
                <Icon className={`size-4 md:size-5 ${c.iconColor}`} />
              </div>
              <p className={`mt-2 text-2xl font-bold ${c.color}`}>{toFaDigits(c.value)}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">{body}</Link>
          ) : (
            <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{body}</div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <form action="/admin" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {view && <input type="hidden" name="view" value={view} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="جستجو: کد پیگیری، موبایل یا نام"
            className="h-10 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">جستجو</button>
        </form>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[
            { key: undefined, label: "همه" },
            { key: "mine", label: "مال من" },
            { key: "unassigned", label: "بدون کارشناس" },
          ].map((v) => (
            <Link key={v.label} href={qs({ view: v.key, page: undefined })} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm", view === v.key ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50")}>
              {v.label}
            </Link>
          ))}
          <span className="mx-1 w-px shrink-0 bg-gray-300" />
          <Link href={qs({ status: undefined })} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm", !status ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50")}>
            همه‌ی وضعیت‌ها
          </Link>
          {statuses.map((s) => (
            <Link key={s.key} href={qs({ status: s.key })} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm", status === s.key ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50")}>
              {s.name} <span className="opacity-60">{toFaDigits(counts.byStatus[s.key] ?? 0)}</span>
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">درخواستی با این فیلتر نیست.</div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {rows.map((r) => {
            const st = statusInfo(r.status);
            return (
              <li key={r.id}>
                <Link href={`/admin/requests/${r.id}`} className="grid gap-1 p-4 hover:bg-blue-50/50 sm:grid-cols-[8rem_1fr_9rem_8rem_9rem] sm:items-center sm:gap-4">
                  <span dir="ltr" className="text-right font-mono text-sm font-bold sm:text-left">{r.tracking_code}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.first_name} {r.last_name} <span dir="ltr" className="text-sm font-normal text-gray-500">{r.phone}</span></span>
                    <span dir="auto" className="block truncate text-xs text-gray-500">
                      {methods[r.method].short}، {toFaDigits(r.item_count)} کالا{r.first_item ? `: ${r.first_item}` : ""}
                    </span>
                  </span>
                  <span>
                    <Badge variant={st.tone === "brand" ? "brand" : st.tone}>{st.name}</Badge>
                  </span>
                  <span className="text-xs text-gray-500">{r.assignee ?? "بدون کارشناس"}</span>
                  <span className="text-xs text-gray-500">{formatFaDateTime(r.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="صفحه‌ها">
          {page > 1 && <Link href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page - 1}`} className="rounded-lg border bg-white px-3 py-1.5">قبلی</Link>}
          <span className="text-gray-500">صفحه‌ی {toFaDigits(page)} از {toFaDigits(pages)}</span>
          {page < pages && <Link href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page + 1}`} className="rounded-lg border bg-white px-3 py-1.5">بعدی</Link>}
        </nav>
      )}
      <p className="mt-3 text-center text-xs text-gray-400">{toFaDigits(total)} نتیجه</p>
    </div>
  );
}
