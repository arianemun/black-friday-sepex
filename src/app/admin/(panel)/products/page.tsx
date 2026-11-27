import { requireStaff } from "@/lib/auth";
import { dealOrderCounts, listProducts } from "@/lib/products";
import { dealsStatus } from "@/lib/deals";
import { siteConfig } from "@/lib/site";
import { mediaUrl } from "@/lib/uploads";
import { ProductManager } from "@/components/admin/product-manager";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "پیشنهادها" };

export default async function ProductsPage() {
  await requireStaff();
  const orders = dealOrderCounts();
  const products = listProducts().map((p) => ({ ...p, image: mediaUrl(p.image_upload_id), orders: orders[p.code] ?? 0 }));
  return (
    <>
      <PageHeader title="پیشنهادهای لندینگ" description="کالاهای فعال روی لندینگ می‌آیند. هر کالا لینک اختصاصی و استوری خودش را دارد؛ با لینک، فرم سفارش از قبل پر است و مشتری فقط اطلاعات تماس را وارد می‌کند." />
      <ProductManager products={products} status={dealsStatus()} siteUrl={siteConfig.url} />
    </>
  );
}
