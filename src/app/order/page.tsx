import type { Metadata } from "next";
import { OrderWizard } from "@/components/order/order-wizard";
import { SiteHeader } from "@/components/site/site-header";
import { extractUrl, orderMethods } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "ثبت سفارش خرید از خارج",
  description: "لینک، عکس یا اسم کالا را از هر فروشگاه خارجی بفرستید؛ خرید، حمل و ترخیص با سپکس. ثبت درخواست رایگان است.",
  alternates: { canonical: "/order" },
};

export default async function OrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = orderMethods.find((x) => x === sp.method) ?? null;
  const link = typeof sp.link === "string" ? extractUrl(sp.link.slice(0, 4000)) : null;
  return (
    <div className="dark relative isolate min-h-dvh overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(50%_100%_at_50%_0%,rgb(255_203_5/0.14),transparent)]" aria-hidden />
      <SiteHeader variant="solid" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <OrderWizard initialMethod={link ? "link" : m} initialLink={link} />
      </main>
    </div>
  );
}
