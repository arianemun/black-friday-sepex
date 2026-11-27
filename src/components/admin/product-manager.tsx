"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Clapperboard, Copy, Package, Pencil, RefreshCw, Rocket, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  checkDealsAction,
  deleteProductAction,
  fetchProductMetaAction,
  publishNextAction,
  queueProductAction,
  saveProductAction,
  setDealsAutoAction,
  toggleProductAction,
} from "@/app/admin/actions";
import type { DealsStatus } from "@/lib/deals";
import { dealLink, StoryDialog } from "./story-dialog";
import { categories, categoryName, countries, countryName, stores, storeByKey } from "@/lib/catalog";
import type { ProductRow } from "@/lib/products";
import { AdminTable, AdminTd, AdminTh, AdminTHead, AdminTr, Badge, Button, EmptyState, FieldInput, FormField, IconButton, fieldControlClass } from "@/components/admin-ui";
import { useConfirm } from "@/components/admin-ui/confirm-dialog";
import { cn, toFaDigits } from "@/lib/utils";

type P = ProductRow & { image: string | null; orders: number };

const empty = { id: "", url: "", title: "", name_fa: "", name_en: "", category: "digital", country: "", store_key: "", price: "", old_price: "", currency: "", discount_percent: "", sort: "0", image_url: "", queued: "0" };
type Form = typeof empty;

const fromRow = (p: P): Form => ({
  id: String(p.id),
  url: p.url,
  title: p.title,
  name_fa: p.name_fa ?? "",
  name_en: p.name_en ?? "",
  queued: p.queued ? "1" : "0",
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

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

function StockBadge({ p }: { p: P }) {
  if (p.queued && !p.active) return <Badge variant="info" className="whitespace-nowrap">در صف انتشار</Badge>;
  if (p.stock === "out") return <Badge variant="danger" className="whitespace-nowrap">ناموجود{p.auto_hidden ? "، پنهان شد" : ""}</Badge>;
  if (!p.active) return <Badge className="whitespace-nowrap">خاموش</Badge>;
  if (p.stock === "in") return <Badge variant="success" className="whitespace-nowrap">موجود</Badge>;
  if (p.check_note === "blocked") return <Badge variant="warning" className="whitespace-nowrap" title="فروشگاه جلوی بررسی خودکار را می‌گیرد">بررسی نشد</Badge>;
  return <Badge variant="warning" className="whitespace-nowrap" title="سایت وضعیت موجودی را اعلام نمی‌کند">موجودی نامعلوم</Badge>;
}

function AutoPanel({ status }: { status: DealsStatus }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string } | null>) =>
    start(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else if (r?.message) toast.success(r.message);
    });
  return (
    <section className={cn("col-span-full flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[#E4E4E7] bg-white p-4", pending && "opacity-70")}>
      <label className="flex items-center gap-2 text-[14px] font-bold">
        <input type="checkbox" checked={status.auto} onChange={(e) => start(() => setDealsAutoAction(e.target.checked))} className="size-4 accent-[#18181B]" />
        انتشار خودکار هر ۲ ساعت
      </label>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#52525B] [&_dd]:font-bold [&_dd]:text-[#18181B] [&>div]:flex [&>div]:gap-1.5">
        <div><dt>روی لندینگ:</dt><dd>{toFaDigits(status.live)}</dd></div>
        <div><dt>در صف:</dt><dd>{toFaDigits(status.pool)}</dd></div>
        <div><dt>ناموجود:</dt><dd>{toFaDigits(status.soldOut)}</dd></div>
        <div><dt>انتشار بعدی:</dt><dd>{status.nextPublishAt ? fmtTime(status.nextPublishAt) : "—"}</dd></div>
        <div><dt>آخرین بررسی موجودی:</dt><dd>{fmtTime(status.lastCheckAt)}</dd></div>
      </dl>
      <div className="ms-auto flex gap-2">
        <Button variant="secondary" size="sm" icon={<RefreshCw />} loading={pending} onClick={() => run(() => checkDealsAction())}>
          بررسی موجودی الان
        </Button>
        <Button variant="secondary" size="sm" icon={<Rocket />} disabled={!status.pool} onClick={() => run(() => publishNextAction())}>
          انتشار کالای بعدی
        </Button>
      </div>
      <p className="basis-full text-xs leading-5 text-[#71717A]">
        موجودی و قیمت هر ۳۰ دقیقه از خود سایت خوانده می‌شود. کالای ناموجود از لندینگ پنهان می‌شود و با موجود شدن برمی‌گردد. اگر فروشگاه جلوی بررسی را بگیرد، کالا پنهان نمی‌شود و «بررسی نشد» می‌خورد.
      </p>
    </section>
  );
}

export function ProductManager({ products, status, siteUrl }: { products: P[]; status: DealsStatus; siteUrl: string }) {
  const [story, setStory] = useState<P | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [preview, setPreview] = useState<string | null>(null);
  const [fetchState, fetchAction, fetching] = useActionState(fetchProductMetaAction, null);
  const [saveState, saveAction, saving] = useActionState(saveProductAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    if (!fetchState) return;
    const d = fetchState.data ?? {};
    /* eslint-disable react-hooks/set-state-in-effect -- apply server action result to the form */
    setForm((f) => ({
      ...f,
      url: d.url ?? f.url,
      title: d.title ?? f.title,
      price: d.price ?? f.price,
      old_price: d.old_price ?? f.old_price,
      discount_percent: d.discount || f.discount_percent,
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
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] [&>*]:min-w-0">
      <AutoPanel status={status} />
      <StoryDialog product={story} siteUrl={siteUrl} onClose={() => setStory(null)} />
      <section className="flex flex-col gap-4 rounded-xl border border-[#E4E4E7] bg-white p-5 lg:sticky lg:top-24">
        <h2 className="m-0 text-[15px] font-bold">{form.id ? "ویرایش کالا" : "افزودن کالا"}</h2>

        <form action={fetchAction} className="flex flex-col gap-1.5">
          <label htmlFor="p-url" className="text-[13px] font-semibold">لینک کالا</label>
          <div className="flex gap-2">
            <FieldInput id="p-url" name="url" dir="ltr" value={form.url} onChange={set("url")} placeholder="https://" className="text-left" />
            <Button type="submit" variant="secondary" loading={fetching} disabled={!form.url} icon={<Wand2 />} title="خواندن خودکار اطلاعات">
              خواندن
            </Button>
          </div>
          <p className="text-xs text-[#71717A]">اگر فروشگاه اجازه ندهد، مشخصات را دستی پر کنید.</p>
        </form>

        <form ref={formRef} action={saveAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={form.id} />
          <input type="hidden" name="url" value={form.url} />
          <FormField label="عنوان" htmlFor="p-title">
            <FieldInput id="p-title" name="title" dir="auto" required value={form.title} onChange={set("title")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="اسم فارسی (استوری)" htmlFor="p-fa"><FieldInput id="p-fa" name="name_fa" value={form.name_fa} onChange={set("name_fa")} placeholder="هدفون سونی" /></FormField>
            <FormField label="اسم انگلیسی" htmlFor="p-en"><FieldInput id="p-en" name="name_en" dir="ltr" value={form.name_en} onChange={set("name_en")} placeholder="Sony WH-1000XM5" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="دسته" htmlFor="p-cat">
              <select id="p-cat" name="category" value={form.category} onChange={set("category")} className={fieldControlClass}>
                {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="کشور" htmlFor="p-country">
              <select id="p-country" name="country" value={form.country} onChange={set("country")} className={fieldControlClass}>
                <option value="">—</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="فروشگاه" htmlFor="p-store">
            <select id="p-store" name="store_key" value={form.store_key} onChange={set("store_key")} className={fieldControlClass}>
              <option value="">تشخیص از لینک</option>
              {stores.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="قیمت" htmlFor="p-price"><FieldInput id="p-price" name="price" dir="ltr" value={form.price} onChange={set("price")} /></FormField>
            <FormField label="قیمت قبل" htmlFor="p-old"><FieldInput id="p-old" name="old_price" dir="ltr" value={form.old_price} onChange={set("old_price")} /></FormField>
            <FormField label="ارز" htmlFor="p-cur"><FieldInput id="p-cur" name="currency" dir="ltr" placeholder="AED" value={form.currency} onChange={set("currency")} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="درصد تخفیف" htmlFor="p-disc"><FieldInput id="p-disc" name="discount_percent" dir="ltr" inputMode="numeric" value={form.discount_percent} onChange={set("discount_percent")} /></FormField>
            <FormField label="اولویت نمایش" htmlFor="p-sort" helper="عدد بزرگ‌تر، جلوتر"><FieldInput id="p-sort" name="sort" dir="ltr" inputMode="numeric" value={form.sort} onChange={set("sort")} /></FormField>
          </div>
          <FormField label="تصویر" htmlFor="p-img" helper={preview ? "از لینک خوانده شد؛ برای تعویض فایل بدهید." : "JPG، PNG یا WebP؛ سبک (زیر ۳۰۰ کیلوبایت)."}>
            <input id="p-img" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-xs text-[#52525B] file:ml-3 file:h-8 file:rounded-lg file:border file:border-[#E4E4E7] file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-[#18181B] hover:file:bg-[#FAFAFA]" />
          </FormField>
          <FormField label="یا لینک عکس" htmlFor="p-imgurl" helper="اگر فروشگاه جلوی خواندن را گرفت: روی عکس کالا در سایت راست‌کلیک ← Copy image address.">
            <FieldInput
              id="p-imgurl"
              name="image_url"
              dir="ltr"
              placeholder="https://…/image.jpg"
              value={form.image_url}
              onChange={(e) => {
                setForm((f) => ({ ...f, image_url: e.target.value }));
                setPreview(/^https:\/\//.test(e.target.value) ? e.target.value : null);
              }}
              className="text-left"
            />
          </FormField>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- remote preview before saving
            <img src={preview} alt="" referrerPolicy="no-referrer" className="h-32 w-full rounded-lg border border-[#E4E4E7] object-contain" />
          )}
          {!form.id && (
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="queued" value="1" checked={form.queued === "1"} onChange={(e) => setForm((f) => ({ ...f, queued: e.target.checked ? "1" : "0" }))} className="size-4 accent-[#18181B]" />
              به صف انتشار خودکار برود (نه همین الان)
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={saving} disabled={!form.url}>
              {form.id ? "ذخیره‌ی تغییرات" : form.queued === "1" ? "افزودن به صف" : "افزودن به لندینگ"}
            </Button>
            {form.id && (
              <Button variant="secondary" onClick={() => { setForm(empty); setPreview(null); }}>
                انصراف
              </Button>
            )}
          </div>
        </form>
      </section>

      <section className={cn("rounded-xl border border-[#E4E4E7] bg-white", pending && "opacity-70")}>
        {products.length === 0 ? (
          <EmptyState icon={<Package />} title="هنوز کالایی اضافه نشده" hint="تا وقتی کالای فعالی نباشد، بخش پیشنهادها روی لندینگ نمایش داده نمی‌شود." />
        ) : (
          <AdminTable>
            <AdminTHead>
              <tr>
                <AdminTh>کالا</AdminTh>
                <AdminTh className="hidden sm:table-cell" numeric>تخفیف</AdminTh>
                <AdminTh>وضعیت</AdminTh>
                <AdminTh className="hidden md:table-cell" numeric>کلیک و سفارش</AdminTh>
                <AdminTh>فعال</AdminTh>
                <AdminTh className="w-32" />
              </tr>
            </AdminTHead>
            <tbody>
              {products.map((p) => (
                <AdminTr key={p.id}>
                  <AdminTd className="max-sm:max-w-[11rem]">
                    <div className="flex items-center gap-3">
                      <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-[#E4E4E7] bg-white">
                        {p.image && (
                          // eslint-disable-next-line @next/next/no-img-element -- our own /media route
                          <img src={p.image} alt="" className="size-full object-contain" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p dir="auto" className="line-clamp-2 max-w-[18rem] font-semibold sm:truncate">{p.name_fa || p.title}</p>
                        <p className="text-xs text-[#71717A]">
                          {categoryName(p.category)}، {storeByKey(p.store_key)?.name ?? "فروشگاه نامشخص"}{p.country ? ` ${countryName(p.country)}` : ""}
                          {p.source === "sample" && <Badge variant="warning" className="mr-1.5">نمونه</Badge>}
                        </p>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd numeric className="hidden sm:table-cell">
                    {p.discount_percent ? `٪${toFaDigits(p.discount_percent)}` : "—"}
                    {p.discount_source && <span className="block text-[11px] text-[#71717A]">{p.discount_source === "site" ? "از سایت" : p.discount_source === "research" ? "تحقیق" : "دستی"}</span>}
                  </AdminTd>
                  <AdminTd>
                    <StockBadge p={p} />
                    <span className="mt-0.5 block text-[11px] text-[#71717A]">{p.checked_at ? fmtTime(p.checked_at) : "هنوز بررسی نشده"}</span>
                  </AdminTd>
                  <AdminTd numeric className="hidden md:table-cell">
                    {toFaDigits(p.clicks)} / {toFaDigits(p.orders)}
                  </AdminTd>
                  <AdminTd>
                    <input
                      type="checkbox"
                      aria-label="نمایش روی لندینگ"
                      checked={!!p.active}
                      onChange={(e) => start(() => toggleProductAction(p.id, e.target.checked))}
                      className="size-4 accent-[#18181B]"
                    />
                    {!p.active && !p.queued && p.stock !== "out" && (
                      <button type="button" onClick={() => start(() => queueProductAction(p.id, true))} className="mt-1 block text-[11px] font-semibold text-[#2563EB] hover:underline">
                        به صف
                      </button>
                    )}
                  </AdminTd>
                  <AdminTd>
                    <div className="ms-auto grid w-max grid-cols-3 gap-0.5">
                      <IconButton aria-label="ساخت استوری" tooltip="استوری اینستاگرام" onClick={() => setStory(p)}>
                        <Clapperboard />
                      </IconButton>
                      <IconButton
                        aria-label="کپی لینک اختصاصی"
                        tooltip="کپی لینک اختصاصی"
                        onClick={() => navigator.clipboard.writeText(dealLink(siteUrl, p.code)).then(() => toast.success("لینک اختصاصی کپی شد."))}
                      >
                        <Copy />
                      </IconButton>
                      <IconButton
                        aria-label="بررسی موجودی"
                        tooltip="بررسی موجودی همین کالا"
                        onClick={() =>
                          start(async () => {
                            const r = await checkDealsAction(p.id);
                            if (r?.error) toast.warning(r.error);
                            else if (r?.message) toast.success(r.message);
                          })
                        }
                      >
                        <RefreshCw />
                      </IconButton>
                      <IconButton aria-label="ویرایش" tooltip="ویرایش" onClick={() => { setForm(fromRow(p)); setPreview(p.image); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        <Pencil />
                      </IconButton>
                      <IconButton
                        variant="destructive"
                        aria-label="حذف"
                        tooltip="حذف"
                        onClick={async () => {
                          const ok = await confirm({ title: "حذف کالا", message: `«${p.title}» از لندینگ حذف شود؟`, confirmLabel: "حذف", danger: true });
                          if (ok) start(() => deleteProductAction(p.id));
                        }}
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </section>
    </div>
  );
}
