import Link from "next/link";
import { Download } from "lucide-react";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">درخواست‌ها</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {toFaDigits(counts.total)} درخواست، {toFaDigits(counts.today)} مورد در ۲۴ ساعت گذشته، {toFaDigits(counts.unassigned)} درخواست جدید بدون کارشناس
          </p>
        </div>
        <a href="/admin/export" className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:border-zinc-900">
          <Download className="size-4" /> خروجی اکسل
        </a>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <form action="/admin" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {view && <input type="hidden" name="view" value={view} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="جستجو: کد پیگیری، موبایل یا نام"
            className="h-10 w-full max-w-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          />
          <button className="h-10 bg-zinc-900 px-4 text-sm font-semibold text-white">جستجو</button>
        </form>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[
            { key: undefined, label: "همه" },
            { key: "mine", label: "مال من" },
            { key: "unassigned", label: "بدون کارشناس" },
          ].map((v) => (
            <Link key={v.label} href={qs({ view: v.key, page: undefined })} className={cn("shrink-0 border px-3 py-1.5 text-sm", view === v.key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500")}>
              {v.label}
            </Link>
          ))}
          <span className="mx-1 w-px shrink-0 bg-zinc-300" />
          <Link href={qs({ status: undefined })} className={cn("shrink-0 border px-3 py-1.5 text-sm", !status ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500")}>
            همه‌ی وضعیت‌ها
          </Link>
          {statuses.map((s) => (
            <Link key={s.key} href={qs({ status: s.key })} className={cn("shrink-0 border px-3 py-1.5 text-sm", status === s.key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500")}>
              {s.name} <span className="opacity-60">{toFaDigits(counts.byStatus[s.key] ?? 0)}</span>
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">درخواستی با این فیلتر نیست.</div>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 border border-zinc-200 bg-white">
          {rows.map((r) => {
            const st = statusInfo(r.status);
            return (
              <li key={r.id}>
                <Link href={`/admin/requests/${r.id}`} className="grid gap-1 p-4 hover:bg-zinc-50 sm:grid-cols-[8rem_1fr_9rem_8rem_9rem] sm:items-center sm:gap-4">
                  <span dir="ltr" className="text-right font-mono text-sm font-bold sm:text-left">{r.tracking_code}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.first_name} {r.last_name} <span dir="ltr" className="text-sm font-normal text-zinc-500">{r.phone}</span></span>
                    <span dir="auto" className="block truncate text-xs text-zinc-500">
                      {methods[r.method].short}، {toFaDigits(r.item_count)} کالا{r.first_item ? `: ${r.first_item}` : ""}
                    </span>
                  </span>
                  <span>
                    <Badge variant={st.tone === "brand" ? "brand" : st.tone}>{st.name}</Badge>
                  </span>
                  <span className="text-xs text-zinc-500">{r.assignee ?? "بدون کارشناس"}</span>
                  <span className="text-xs text-zinc-500">{formatFaDateTime(r.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="صفحه‌ها">
          {page > 1 && <Link href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page - 1}`} className="border bg-white px-3 py-1.5">قبلی</Link>}
          <span className="text-zinc-500">صفحه‌ی {toFaDigits(page)} از {toFaDigits(pages)}</span>
          {page < pages && <Link href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page + 1}`} className="border bg-white px-3 py-1.5">بعدی</Link>}
        </nav>
      )}
      <p className="mt-3 text-center text-xs text-zinc-400">{toFaDigits(total)} نتیجه</p>
    </div>
  );
}
