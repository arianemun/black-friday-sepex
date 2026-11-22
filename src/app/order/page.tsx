import type { Metadata } from "next";
import { OrderWizard } from "@/components/order/order-wizard";
import { SiteHeader } from "@/components/site/site-header";
import { extractUrl, methods, type Method } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "ثبت سفارش خرید از خارج",
  description: "لینک، عکس یا اسم کالا را از هر فروشگاه خارجی بفرستید؛ خرید، حمل و ترخیص با سپکس. ثبت درخواست رایگان است.",
  alternates: { canonical: "/order" },
};

export default async function OrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = typeof sp.method === "string" && sp.method in methods ? (sp.method as Method) : null;
  const link = typeof sp.link === "string" ? extractUrl(sp.link.slice(0, 4000)) : null;
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader variant="light" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <OrderWizard initialMethod={link ? "link" : m} initialLink={link} />
      </main>
    </div>
  );
}
