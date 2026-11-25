import Link from "next/link";
import { Panel } from "@/components/admin/page-header";
import { fa, pageLabel } from "@/components/admin/insights/insights-nav";

/** Elements with rage / dead / non-interactive clicks, with links to the heatmap and a sample replay. */
export function ProblemList({ title, rows, q }: { title: string; rows: { path: string; label: string; clicks: number; sessions: number; sample: string }[]; q: string }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#71717A]">موردی ثبت نشده است.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#F4F4F5]">
          {rows.map((r) => (
            <li key={`${r.path}|${r.label}`} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[#18181B]">«{r.label}»</div>
                <div className="text-[11px] text-[#71717A]">
                  {pageLabel(r.path)}، {fa(r.sessions)} جلسه، {fa(r.clicks)} بار
                </div>
              </div>
              <Link href={`/admin/insights/heatmaps?${q}&path=${encodeURIComponent(r.path)}`} className="text-xs font-semibold text-[#71717A] hover:text-[#2563EB]">
                هیت‌مپ
              </Link>
              <Link href={`/admin/insights/sessions/${r.sample}`} className="text-xs font-semibold text-[#2563EB] hover:underline">
                نمونه
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
