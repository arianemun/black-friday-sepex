"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProductAction, fetchProductMetaAction, saveProductAction, toggleProductAction } from "@/app/admin/actions";
import { categories, categoryName, countries, countryName, stores, storeByKey } from "@/lib/catalog";
import type { ProductRow } from "@/lib/products";
import { cn, toFaDigits } from "@/lib/utils";

type P = ProductRow & { image: string | null };

const empty = { id: "", url: "", title: "", category: "digital", country: "", store_key: "", price: "", old_price: "", currency: "", discount_percent: "", sort: "0", image_url: "" };
type Form = typeof empty;

const fromRow = (p: P): Form => ({
  id: String(p.id),
  url: p.url,
  title: p.title,
  category: p.category,
  country: p.country ?? "",
  store_key: p.store_key ?? "",
  price: p.price ?? "",
  old_price: p.old_price ?? "",
  currency: p.currency ?? "",
  discount_percent: p.discount_percent ? String(p.discount_percent) : "",
  sort: String(p.sort),
  image_url: "",
});

const inputCls = "h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900";

export function ProductManager({ products }: { products: P[] }) {
  const [form, setForm] = useState<Form>(empty);
  const [preview, setPreview] = useState<string | null>(null);
  const [fetchState, fetchAction, fetching] = useActionState(fetchProductMetaAction, null);
  const [saveState, saveAction, saving] = useActionState(saveProductAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!fetchState) return;
    const d = fetchState.data ?? {};
    /* eslint-disable react-hooks/set-state-in-effect -- apply server action result to the form */
    setForm((f) => ({
      ...f,
      url: d.url ?? f.url,
      title: d.title ?? f.title,
      price: d.price ?? f.price,
      currency: d.currency ?? f.currency,
      store_key: d.store_key || f.store_key,
      country: d.country || f.country,
      image_url: d.image ?? "",
    }));
    setPreview(d.image ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (fetchState.error) toast.warning(fetchState.error);
    else if (fetchState.message) toast.success(fetchState.message);
  }, [fetchState]);

  useEffect(() => {
    if (!saveState) return;
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) {
      toast.success(saveState.message ?? "ذخیره شد.");
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset after a successful save */
      setForm(empty);
      setPreview(null);
      formRef.current?.reset();
    }
  }, [saveState]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[24rem_1fr]">
      <section className="h-fit border border-zinc-200 bg-white p-4 lg:sticky lg:top-20">
        <h2 className="font-black">{form.id ? "ویرایش کالا" : "افزودن کالا"}</h2>
        <form action={fetchAction} className="mt-3 flex gap-2">
          <input name="url" dir="ltr" value={form.url} onChange={set("url")} placeholder="https://" className={cn(inputCls, "text-left")} aria-label="لینک کالا" />
          <button disabled={fetching || !form.url} className="flex h-10 shrink-0 items-center gap-1.5 bg-brand px-3 text-sm font-bold text-ink disabled:opacity-50" title="خواندن خودکار اطلاعات">
            {fetching ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} خواندن
          </button>
        </form>

        <form ref={formRef} action={saveAction} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={form.id} />
          <input type="hidden" name="url" value={form.url} />
          <input type="hidden" name="image_url" value={form.image_url} />
          <label className="grid gap-1 text-xs font-semibold">
            عنوان
            <input name="title" dir="auto" required value={form.title} onChange={set("title")} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold">
              دسته
              <select name="category" value={form.category} onChange={set("category")} className={inputCls}>
                {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              کشور
              <select name="country" value={form.country} onChange={set("country")} className={inputCls}>
                <option value="">—</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            فروشگاه
            <select name="store_key" value={form.store_key} onChange={set("store_key")} className={inputCls}>
              <option value="">تشخیص از لینک</option>
              {stores.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-xs font-semibold">
              قیمت
              <input name="price" dir="ltr" value={form.price} onChange={set("price")} className={inputCls} />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              قیمت قبل
              <input name="old_price" dir="ltr" value={form.old_price} onChange={set("old_price")} className={inputCls} />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              ارز
              <input name="currency" dir="ltr" placeholder="AED" value={form.currency} onChange={set("currency")} className={inputCls} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold">
              درصد تخفیف
              <input name="discount_percent" dir="ltr" inputMode="numeric" value={form.discount_percent} onChange={set("discount_percent")} className={inputCls} />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              اولویت نمایش
              <input name="sort" dir="ltr" inputMode="numeric" value={form.sort} onChange={set("sort")} className={inputCls} title="عدد بزرگ‌تر بالاتر" />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            تصویر {preview ? "(از لینک خوانده شد؛ برای تعویض فایل بدهید)" : "(اختیاری)"}
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-xs file:ml-2 file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white" />
          </label>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- remote preview before saving
            <img src={preview} alt="" referrerPolicy="no-referrer" className="h-32 w-full border border-zinc-200 object-contain" />
          )}
          <div className="flex gap-2">
            <button disabled={saving || !form.url} className="flex h-10 flex-1 items-center justify-center gap-2 bg-zinc-900 text-sm font-bold text-white disabled:opacity-50">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {form.id ? "ذخیره‌ی تغییرات" : "افزودن به لندینگ"}
            </button>
            {form.id && (
              <button type="button" onClick={() => { setForm(empty); setPreview(null); }} className="h-10 border border-zinc-300 px-3 text-sm">
                انصراف
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        {products.length === 0 ? (
          <div className="border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            هنوز کالایی اضافه نشده. تا وقتی کالای فعالی نباشد، بخش پیشنهادها روی لندینگ نمایش داده نمی‌شود.
          </div>
        ) : (
          <ul className={cn("divide-y divide-zinc-200 border border-zinc-200 bg-white", pending && "opacity-70")}>
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="size-16 shrink-0 border border-zinc-200 bg-white">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- our own /media route
                    <img src={p.image} alt="" className="size-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-zinc-500">
                    {storeByKey(p.store_key)?.name ?? "فروشگاه"}، {countryName(p.country)}، {categoryName(p.category)}
                    {p.discount_percent ? `، ٪${toFaDigits(p.discount_percent)}` : ""}
                    {p.source === "sample" && <span className="mr-1 bg-amber-100 px-1 text-amber-800">نمونه</span>}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={!!p.active} onChange={(e) => start(() => toggleProductAction(p.id, e.target.checked))} className="size-4 accent-zinc-900" />
                  فعال
                </label>
                <button type="button" onClick={() => { setForm(fromRow(p)); setPreview(p.image); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex size-9 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="ویرایش">
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`«${p.title}» حذف شود؟`)) start(() => deleteProductAction(p.id));
                  }}
                  className="flex size-9 shrink-0 items-center justify-center text-zinc-500 hover:bg-red-50 hover:text-red-700"
                  aria-label="حذف"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
