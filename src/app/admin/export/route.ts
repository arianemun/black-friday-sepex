import { getCurrentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { countryName, methods, statusInfo, storeByKey, type Method } from "@/lib/catalog";

/** CSV with a UTF-8 BOM so Excel opens Persian text correctly. One row per item. */
export async function GET() {
  const me = await getCurrentStaff();
  if (!me) return new Response("Not found", { status: 404 });
  const rows = getDb()
    .prepare(
      `SELECT r.tracking_code, r.created_at, r.method, r.first_name, r.last_name, r.gender, r.phone, r.status, s.name AS assignee,
        r.note, r.utm_source, r.utm_medium, r.utm_campaign,
        i.position, i.url, i.title, i.description, i.quantity, i.origin_country, i.store_key, i.weight, i.meta_title, i.meta_price, i.meta_currency
       FROM requests r LEFT JOIN staff s ON s.id = r.assigned_to LEFT JOIN request_items i ON i.request_id = r.id
       ORDER BY r.id DESC, i.position`
    )
    .all() as Record<string, string | number | null>[];

  const header = ["کد پیگیری", "تاریخ ثبت", "روش", "نام", "نام خانوادگی", "جنسیت", "موبایل", "وضعیت", "کارشناس", "توضیحات مشتری", "منبع", "رسانه", "کمپین", "ردیف کالا", "لینک", "نام کالا", "توضیحات کالا", "تعداد", "کشور", "فروشگاه", "وزن", "عنوان از لینک", "قیمت از لینک"];
  const tehran = (iso: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(iso));
  // Neutralize spreadsheet formulas (CSV injection) and quote everything.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.tracking_code, tehran(String(r.created_at)), methods[r.method as Method]?.title, r.first_name, r.last_name, r.gender === "female" ? "خانم" : "آقا",
        r.phone, statusInfo(String(r.status)).name, r.assignee, r.note, r.utm_source, r.utm_medium, r.utm_campaign,
        r.position === null ? "" : Number(r.position) + 1, r.url, r.title, r.description, r.quantity, r.origin_country ? countryName(String(r.origin_country)) : "",
        storeByKey(r.store_key as string | null)?.name ?? "", r.weight, r.meta_title, r.meta_price ? `${r.meta_price} ${r.meta_currency ?? ""}` : "",
      ].map(cell).join(",")
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sepex-bf-requests-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
