import { requireStaff } from "@/lib/auth";
import { listProducts } from "@/lib/products";
import { mediaUrl } from "@/lib/uploads";
import { Tag } from "lucide-react";
import { ProductManager } from "@/components/admin/product-manager";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "پیشنهادها" };

export default async function ProductsPage() {
  await requireStaff();
  const products = listProducts().map((p) => ({ ...p, image: mediaUrl(p.image_upload_id) }));
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader icon={Tag} title="پیشنهادهای لندینگ" description="لینک کالا را بدهید تا عنوان، تصویر و قیمت خودکار خوانده شود؛ اگر فروشگاه اجازه نداد، دستی پر کنید. کالاهای فعال روی صفحه‌ی اصلی نمایش داده می‌شوند." />
      <ProductManager products={products} />
    </div>
  );
}
