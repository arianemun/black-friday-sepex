import { requireStaff } from "@/lib/auth";
import { listProducts } from "@/lib/products";
import { mediaUrl } from "@/lib/uploads";
import { ProductManager } from "@/components/admin/product-manager";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "پیشنهادها" };

export default async function ProductsPage() {
  await requireStaff();
  const products = listProducts().map((p) => ({ ...p, image: mediaUrl(p.image_upload_id) }));
  return (
    <>
      <PageHeader title="پیشنهادهای لندینگ" description="کالاهای فعال در کاروسل و بخش «تا بلک‌فرایدی تمام نشده» صفحه‌ی اصلی نمایش داده می‌شوند." />
      <ProductManager products={products} />
    </>
  );
}
