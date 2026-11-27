import type { Metadata } from "next";
import { OrderWizard } from "@/components/order/order-wizard";
import { SiteHeader } from "@/components/site/site-header";
import { extractUrl, orderMethods, storeByKey } from "@/lib/catalog";
import { getProductByCode } from "@/lib/products";
import { mediaUrl } from "@/lib/uploads";

export const metadata: Metadata = {
  title: "ثبت سفارش خرید از خارج",
  description: "لینک، عکس یا اسم کالا را از هر فروشگاه خارجی بفرستید؛ خرید، حمل و ترخیص با سپکس. ثبت درخواست رایگان است.",
  alternates: { canonical: "/order" },
};

export default async function OrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = orderMethods.find((x) => x === sp.method) ?? null;
  const link = typeof sp.link === "string" ? extractUrl(sp.link.slice(0, 4000)) : null;
  // A product name typed into the landing's box instead of a link.
  // A product's unique link (/d/<code>): the item is already known, only contact details are left.
  const p = typeof sp.deal === "string" ? getProductByCode(sp.deal.slice(0, 16).toLowerCase()) : undefined;
  const deal = p
    ? {
        code: p.code,
        url: p.url,
        title: p.name_en || p.title,
        preview: { title: p.title, image: mediaUrl(p.image_upload_id), price: p.price, currency: p.currency, site: storeByKey(p.store_key)?.latin ?? null },
      }
    : null;
  const name = !link && typeof sp.name === "string" ? sp.name.replace(/\s+/g, " ").trim().slice(0, 120) || null : null;
  return (
    <div className="dark relative isolate min-h-dvh overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(50%_100%_at_50%_0%,rgb(255_203_5/0.14),transparent)]" aria-hidden />
      <SiteHeader variant="solid" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <OrderWizard initialMethod={deal ? "link" : link ? "link" : name ? "photo" : m} initialLink={deal ? null : link} initialName={name} initialDeal={deal} />
      </main>
    </div>
  );
}
