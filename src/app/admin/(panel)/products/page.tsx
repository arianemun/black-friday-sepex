import { requireStaff } from "@/lib/auth";
import { listProducts } from "@/lib/products";
import { mediaUrl } from "@/lib/uploads";
import { ProductManager } from "@/components/admin/product-manager";

export const metadata = { title: "پیشنهادها" };

export default async function ProductsPage() {
  await requireStaff();
  const products = listProducts().map((p) => ({ ...p, image: mediaUrl(p.image_upload_id) }));
  return (
    <div>
      <h1 className="text-2xl font-black">پیشنهادهای لندینگ</h1>
      <p className="mt-1 text-sm text-zinc-500">
        لینک کالا را بدهید تا عنوان، تصویر و قیمت خودکار خوانده شود؛ اگر فروشگاه اجازه نداد، دستی پر کنید. کالاهای فعال روی صفحه‌ی اصلی نمایش داده می‌شوند.
      </p>
      <ProductManager products={products} />
    </div>
  );
}
