import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Where the "send to SEPEX" bookmark lands. Outside the panel layout so a product sent while
 * logged out survives the login: login → back here → the products page with the form filled in.
 */
export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const d = (await searchParams).d;
  const data = typeof d === "string" ? d.slice(0, 5000) : "";
  const target = data ? `/admin/products?import=${encodeURIComponent(data)}` : "/admin/products";
  if (!(await getCurrentStaff())) redirect(`/admin/login?next=${encodeURIComponent(data ? `/admin/import?d=${encodeURIComponent(data)}` : "/admin/products")}`);
  redirect(target);
}
