import { AdminTable, AdminTd, AdminTh, AdminTHead, AdminTr } from "@/components/admin-ui";

export type Col<R> = { label: string; cell: (r: R) => React.ReactNode; num?: boolean; className?: string };

/** Simple report table: first column text, the rest right-aligned numbers. Scrolls sideways on phones. */
export function ReportTable<R>({ rows, cols, rowKey, empty = "داده‌ای نیست." }: { rows: R[]; cols: Col<R>[]; rowKey: (r: R) => string; empty?: string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-[#71717A]">{empty}</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <div className="min-w-[560px] px-4 sm:px-5">
        <AdminTable>
          <AdminTHead>
            <tr>
              {cols.map((c) => (
                <AdminTh key={c.label} className={c.num ? "text-left" : undefined}>
                  {c.label}
                </AdminTh>
              ))}
            </tr>
          </AdminTHead>
          <tbody>
            {rows.map((r) => (
              <AdminTr key={rowKey(r)}>
                {cols.map((c) => (
                  <AdminTd key={c.label} className={c.num ? `text-left tabular-nums ${c.className ?? ""}` : c.className}>
                    {c.cell(r)}
                  </AdminTd>
                ))}
              </AdminTr>
            ))}
          </tbody>
        </AdminTable>
      </div>
    </div>
  );
}
