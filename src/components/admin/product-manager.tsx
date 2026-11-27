"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DropdownMenu } from "radix-ui";
import { AlertTriangle, Clapperboard, Copy, ImageOff, MoreHorizontal, Package, Pencil, Plus, RefreshCw, Rocket, Trash2, Wand2, ListPlus, ListMinus } from "lucide-react";
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
import { categories, categoryName, countries, countryName, detectStore, extractUrl, stores, storeByKey } from "@/lib/catalog";
import type { DealsStatus } from "@/lib/deals";
import type { ProductRow } from "@/lib/products";
import { Badge, Button, EmptyState, FieldInput, FormField, IconButton, SegmentedControl, Toggle, fieldControlClass } from "@/components/admin-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/admin-ui/dialog";
import { useConfirm } from "@/components/admin-ui/confirm-dialog";
import { cn, toFaDigits } from "@/lib/utils";
import { dealLink, StoryDialog } from "./story-dialog";
import { Bookmarklet, readImport } from "./bookmarklet";

type P = ProductRow & { image: string | null; orders: number };

const empty = { id: "", url: "", title: "", name_fa: "", name_en: "", category: "digital", country: "", store_key: "", price: "", old_price: "", currency: "", discount_percent: "", sort: "0", image_url: "", queued: "0", stock: "" };
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
  stock: "",
});

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

const fmtPrice = (v: string | null, cur: string | null) => {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return `${Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v}${cur ? ` ${cur}` : ""}`;
};

/**
 * A first guess at the category of a product sent by the bookmark: words in its title, then the
 * store's main category. Staff can still change it in the form.
 */
function guessCategory(storeCats: string[] | undefined, title?: string | null): string {
  const t = (title ?? "").toLowerCase();
  if (/shoe|sneaker|boot|trainer|running|football|jersey|tracksuit|tank top|sport|gym|yoga/.test(t)) return "sport";
  if (/perfume|parfum|eau de|fragrance|oil|makeup|serum|cream|skin|hair|shaver|trimmer|airwrap/.test(t)) return "beauty";
  if (/phone|iphone|galaxy|airpods|headphone|earbuds|laptop|macbook|ipad|tablet|watch|camera|console|playstation|speaker/.test(t)) return "digital";
  if (/kid|baby|toy|lego/.test(t)) return "kids";
  if (/dress|shirt|t-shirt|jacket|bag|jeans|hoodie|abaya|trouser|skirt|wallet|sunglass/.test(t)) return "fashion";
  const map: Record<string, string> = { fashion: "fashion", sport: "sport", digital: "digital", beauty: "beauty", home: "home", kids: "kids", luxury: "fashion" };
  for (const c of storeCats ?? []) if (map[c]) return map[c];
  return "other";
}

/* ------------------------------------------------------------------ status */

type Filter = "all" | "live" | "queue" | "attention" | "off";

/** Needs a person: shown (or about to be) but has no picture or no discount, or the store says sold out. */
const needsAttention = (p: P) => ((p.active || p.queued) && (!p.image || !p.discount_percent)) || p.stock === "out";
const isLive = (p: P) => !!p.active;
const inQueue = (p: P) => !!p.queued && !p.active;

function StatusBadge({ p }: { p: P }) {
  if (p.active && !p.image) return <Badge variant="warning" className="whitespace-nowrap">بدون عکس، دیده نمی‌شود</Badge>;
  if (p.active && !p.discount_percent) return <Badge variant="warning" className="whitespace-nowrap">بدون تخفیف، دیده نمی‌شود</Badge>;
  if (p.stock === "out") return <Badge variant="danger" className="whitespace-nowrap">ناموجود{p.auto_hidden ? "، پنهان شد" : ""}</Badge>;
  if (inQueue(p)) return <Badge variant="info" className="whitespace-nowrap">در صف انتشار</Badge>;
  if (!p.active) return <Badge className="whitespace-nowrap">خاموش</Badge>;
  return <Badge variant="success" className="whitespace-nowrap">روی لندینگ</Badge>;
}

function StockLine({ p }: { p: P }) {
  const text =
    p.check_note === "browser"
      ? `از مرورگر، ${p.stock === "in" ? "موجود" : "ناموجود"}`
      : p.check_note === "blocked"
        ? "فروشگاه جلوی بررسی را گرفت"
        : p.stock === "in"
          ? "موجود"
          : p.stock === "out"
            ? "ناموجود"
            : p.checked_at
              ? "سایت موجودی را اعلام نمی‌کند"
              : "هنوز بررسی نشده";
  return (
    <span className="mt-1 block text-[11px] leading-4 text-[#71717A]">
      {text}
      {p.checked_at && <span className="text-[#A1A1AA]">، {fmtTime(p.checked_at)}</span>}
    </span>
  );
}

function StoreLine({ p }: { p: P }) {
  const store = storeByKey(p.store_key);
  const [broken, setBroken] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#52525B]">
      {store && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- our own icon route
        <img src={`/store-icon/${store.key}`} alt="" className="size-4 rounded-[3px] object-contain" onError={() => setBroken(true)} />
      )}
      {store?.name ?? "فروشگاه نامشخص"}
      {!store && p.country && <span className="text-[#A1A1AA]">، {countryName(p.country)}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ top: automation */

function Stat({ label, value, tone, desktop }: { label: string; value: string; tone?: "warn" | "bad"; desktop?: boolean }) {
  return (
    <div className={cn("min-w-0 flex-col gap-1 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 sm:px-4 sm:py-3", desktop ? "hidden sm:flex" : "flex")}>
      <span className="truncate text-xs font-medium text-[#71717A]">{label}</span>
      <span className={cn("truncate text-lg font-extrabold leading-tight text-[#18181B] sm:text-xl", tone === "warn" && "text-[#B45309]", tone === "bad" && "text-[#B91C1C]")}>{value}</span>
    </div>
  );
}

function AutoBar({ status, counts }: { status: DealsStatus; counts: { visible: number; attention: number } }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string } | null>) =>
    start(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else if (r?.message) toast.success(r.message);
    });
  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
        <Stat label="روی لندینگ" value={toFaDigits(counts.visible)} />
        <Stat label="در صف انتشار" value={toFaDigits(status.pool)} />
        <Stat label="نیاز به رسیدگی" value={toFaDigits(counts.attention)} tone={counts.attention ? "warn" : undefined} />
        <Stat label="انتشار بعدی" value={status.auto ? fmtTime(status.nextPublishAt) : "خاموش"} desktop />
        <Stat label="آخرین بررسی موجودی" value={fmtTime(status.lastCheckAt)} desktop />
      </div>
      <div className={cn("flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 lg:flex-row lg:items-center", pending && "opacity-70")}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Toggle checked={status.auto} onCheckedChange={(v) => start(() => setDealsAutoAction(v))} aria-labelledby="auto-label" className="mt-0.5" />
          <div className="min-w-0">
            <p id="auto-label" className="text-[13px] font-semibold text-[#18181B]">انتشار خودکار</p>
            <p className="text-xs leading-5 text-[#71717A]">هر ۲ ساعت یک کالا از صف؛ اگر کمتر از ۶ کالا دیده شود، فوراً. موجودی و قیمت هر ۳۰ دقیقه.</p>
            <p className="mt-1 text-xs leading-5 text-[#52525B] sm:hidden">
              انتشار بعدی: <b>{status.auto ? fmtTime(status.nextPublishAt) : "خاموش"}</b>، آخرین بررسی: <b>{fmtTime(status.lastCheckAt)}</b>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Button variant="secondary" size="sm" icon={<RefreshCw />} loading={pending} onClick={() => run(() => checkDealsAction())}>
            بررسی موجودی الان
          </Button>
          <Button variant="secondary" size="sm" icon={<Rocket />} disabled={!status.pool} onClick={() => run(() => publishNextAction())}>
            انتشار کالای بعدی
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ add / edit modal */

function ProductDialog({ open, onOpenChange, initial, initialPreview }: { open: boolean; onOpenChange: (o: boolean) => void; initial: Form; initialPreview: string | null }) {
  const [form, setForm] = useState<Form>(initial);
  const [preview, setPreview] = useState<string | null>(initialPreview);
  const [fetchState, fetchAction, fetching] = useActionState(fetchProductMetaAction, null);
  const [saveState, saveAction, saving] = useActionState(saveProductAction, null);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!fetchState || handled.current === fetchState) return;
    handled.current = fetchState;
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
      image_url: d.image ?? f.image_url,
    }));
    if (d.image) setPreview(d.image);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (fetchState.error) toast.warning(fetchState.error);
    else if (fetchState.message) toast.success(fetchState.message);
  }, [fetchState]);

  useEffect(() => {
    if (!saveState || handled.current === saveState) return;
    handled.current = saveState;
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) {
      toast.success(saveState.message ?? "ذخیره شد.");
      onOpenChange(false);
    }
  }, [saveState, onOpenChange]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const editing = !!form.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(680px,calc(100%-2rem))] gap-5">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش کالا" : "افزودن کالا"}</DialogTitle>
          <DialogDescription>لینک صفحه‌ی کالا را بدهید و «خواندن» را بزنید. اگر فروشگاه اجازه نداد، از دکمه‌ی «ارسال به سپکس» در صفحه‌ی کالا استفاده کنید یا مشخصات را دستی پر کنید.</DialogDescription>
        </DialogHeader>

        <form action={fetchAction} className="flex gap-2">
          <FieldInput aria-label="لینک کالا" name="url" dir="ltr" value={form.url} onChange={set("url")} placeholder="https://" className="text-left" />
          <Button type="submit" variant="secondary" loading={fetching} disabled={!form.url} icon={<Wand2 />}>
            خواندن
          </Button>
        </form>

        <form action={saveAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={form.id} />
          <input type="hidden" name="url" value={form.url} />
          <input type="hidden" name="stock" value={form.stock} />

          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-[#E4E4E7] bg-white">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview before saving
                <img src={preview} alt="" referrerPolicy="no-referrer" className="size-full object-contain p-2" onError={() => setPreview(null)} />
              ) : (
                <ImageOff className="size-7 text-[#D4D4D8]" aria-hidden />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <FormField label="لینک عکس" htmlFor="p-imgurl" helper="روی عکس کالا در سایت راست‌کلیک ← Copy image address">
                <FieldInput
                  id="p-imgurl"
                  name="image_url"
                  dir="ltr"
                  placeholder="https://…/image.jpg"
                  value={form.image_url}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, image_url: e.target.value }));
                    if (/^https:\/\//.test(e.target.value)) setPreview(e.target.value);
                  }}
                  className="text-left"
                />
              </FormField>
              <FormField label="یا فایل عکس" htmlFor="p-img">
                <input id="p-img" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-xs text-[#52525B] file:ml-3 file:h-8 file:rounded-lg file:border file:border-[#E4E4E7] file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-[#18181B] hover:file:bg-[#FAFAFA]" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPreview(URL.createObjectURL(f));
                }} />
              </FormField>
            </div>
          </div>

          <FormField label="عنوان در فروشگاه" htmlFor="p-title">
            <FieldInput id="p-title" name="title" dir="auto" required value={form.title} onChange={set("title")} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="اسم فارسی (استوری و لندینگ)" htmlFor="p-fa"><FieldInput id="p-fa" name="name_fa" value={form.name_fa} onChange={set("name_fa")} placeholder="هدفون سونی" /></FormField>
            <FormField label="اسم انگلیسی کوتاه" htmlFor="p-en"><FieldInput id="p-en" name="name_en" dir="ltr" value={form.name_en} onChange={set("name_en")} placeholder="Sony WH-1000XM5" /></FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="دسته" htmlFor="p-cat">
              <select id="p-cat" name="category" value={form.category} onChange={set("category")} className={fieldControlClass}>
                {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="فروشگاه" htmlFor="p-store">
              <select id="p-store" name="store_key" value={form.store_key} onChange={set("store_key")} className={fieldControlClass}>
                <option value="">تشخیص از لینک</option>
                {stores.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="کشور" htmlFor="p-country">
              <select id="p-country" name="country" value={form.country} onChange={set("country")} className={fieldControlClass}>
                <option value="">—</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label="قیمت" htmlFor="p-price"><FieldInput id="p-price" name="price" dir="ltr" value={form.price} onChange={set("price")} /></FormField>
            <FormField label="قیمت قبل" htmlFor="p-old"><FieldInput id="p-old" name="old_price" dir="ltr" value={form.old_price} onChange={set("old_price")} /></FormField>
            <FormField label="ارز" htmlFor="p-cur"><FieldInput id="p-cur" name="currency" dir="ltr" placeholder="AED" value={form.currency} onChange={set("currency")} /></FormField>
            <FormField label="درصد تخفیف" htmlFor="p-disc" helper="خالی: از دو قیمت"><FieldInput id="p-disc" name="discount_percent" dir="ltr" inputMode="numeric" value={form.discount_percent} onChange={set("discount_percent")} /></FormField>
          </div>
          <input type="hidden" name="sort" value={form.sort} />

          <div className="flex flex-wrap items-center gap-3 border-t border-[#F4F4F5] pt-4">
            {!editing && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="queued" value="1" checked={form.queued === "1"} onChange={(e) => setForm((f) => ({ ...f, queued: e.target.checked ? "1" : "0" }))} className="size-4 accent-[#18181B]" />
                به صف انتشار خودکار برود
              </label>
            )}
            <div className="ms-auto flex gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
              <Button type="submit" loading={saving} disabled={!form.url}>
                {editing ? "ذخیره‌ی تغییرات" : form.queued === "1" ? "افزودن به صف" : "افزودن به لندینگ"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ row actions */

function RowMenu({ p, onEdit, run }: { p: P; onEdit: () => void; run: (fn: () => Promise<unknown>) => void }) {
  const confirm = useConfirm();
  const item = "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-[#18181B] outline-none data-[highlighted]:bg-[#F4F4F5]";
  return (
    <DropdownMenu.Root dir="rtl">
      <DropdownMenu.Trigger asChild>
        <IconButton aria-label="کارهای بیشتر" tooltip="بیشتر">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="admin-theme z-50 min-w-44 rounded-lg border border-[#E4E4E7] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <DropdownMenu.Item className={item} onSelect={onEdit}>
            <Pencil className="size-4" aria-hidden /> ویرایش
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={item}
            onSelect={() =>
              run(async () => {
                const r = await checkDealsAction(p.id);
                if (r?.error) toast.warning(r.error);
                else if (r?.message) toast.success(r.message);
              })
            }
          >
            <RefreshCw className="size-4" aria-hidden /> بررسی موجودی
          </DropdownMenu.Item>
          {!p.active &&
            (p.queued ? (
              <DropdownMenu.Item className={item} onSelect={() => run(() => queueProductAction(p.id, false))}>
                <ListMinus className="size-4" aria-hidden /> خارج کردن از صف
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={item} onSelect={() => run(() => queueProductAction(p.id, true))}>
                <ListPlus className="size-4" aria-hidden /> به صف انتشار
              </DropdownMenu.Item>
            ))}
          <DropdownMenu.Separator className="my-1 h-px bg-[#F4F4F5]" />
          <DropdownMenu.Item
            className={cn(item, "text-[#B91C1C]")}
            onSelect={async () => {
              const ok = await confirm({ title: "حذف کالا", message: `«${p.name_fa || p.title}» حذف شود؟ لینک اختصاصی‌اش هم دیگر کار نمی‌کند.`, confirmLabel: "حذف", danger: true });
              if (ok) run(() => deleteProductAction(p.id));
            }}
          >
            <Trash2 className="size-4" aria-hidden /> حذف
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ------------------------------------------------------------------ page */

export function ProductManager({ products, status, siteUrl }: { products: P[]; status: DealsStatus; siteUrl: string }) {
  const [story, setStory] = useState<P | null>(null);
  const [dialog, setDialog] = useState<{ key: number; form: Form; preview: string | null } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  const openForm = (form: Form, preview: string | null = null) => setDialog({ key: Date.now(), form, preview });

  // A product page sent by the bookmark: open the form filled in (keeping what we know about it).
  useEffect(() => {
    const d = readImport();
    if (!d) return;
    window.history.replaceState(null, "", window.location.pathname);
    const url = extractUrl(d.u) ?? d.u;
    const known = products.find((p) => p.url === url);
    const st = detectStore(url);
    const stock = /OutOfStock|SoldOut|Discontinued/i.test(d.a ?? "") ? "out" : /InStock|LimitedAvailability|PreOrder/i.test(d.a ?? "") ? "in" : "";
    const img = d.i && /^https:\/\//.test(d.i) ? d.i : "";
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fill from the bookmark */
    openForm(
      {
        ...(known ? fromRow(known) : { ...empty, queued: "1", store_key: st?.key ?? "", country: st?.country ?? "", category: guessCategory(st?.cats, d.t) }),
        url,
        title: d.t?.trim().slice(0, 300) || known?.title || "",
        image_url: img,
        price: d.p ? String(d.p) : (known?.price ?? ""),
        old_price: d.o ? String(d.o) : "",
        discount_percent: "",
        currency: d.c || known?.currency || "",
        stock,
      },
      img || known?.image || null
    );
    toast.info(known ? "اطلاعات تازه‌ی این کالا از صفحه‌اش آمد؛ بررسی و ذخیره کنید." : "اطلاعات کالا از صفحه‌اش آمد؛ اسم فارسی و دسته را بزنید و ذخیره کنید.");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, []);

  const counts = useMemo(
    () => ({
      all: products.length,
      live: products.filter(isLive).length,
      queue: products.filter(inQueue).length,
      attention: products.filter(needsAttention).length,
      off: products.filter((p) => !p.active && !p.queued).length,
      visible: products.filter((p) => p.active && p.discount_percent && (p.image || p.source !== "auto")).length,
    }),
    [products]
  );
  const shown = products.filter((p) =>
    filter === "live" ? isLive(p) : filter === "queue" ? inQueue(p) : filter === "attention" ? needsAttention(p) : filter === "off" ? !p.active && !p.queued : true
  );
  const missingImages = products.filter((p) => (p.active || p.queued) && !p.image).length;
  const noDiscount = products.filter((p) => (p.active || p.queued) && p.image && !p.discount_percent).length;

  return (
    <div className="flex flex-col gap-5">
      <AutoBar status={status} counts={counts} />

      {missingImages > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[13px] leading-6 text-[#78350F] sm:flex-row sm:items-center">
          <AlertTriangle className="hidden size-5 shrink-0 text-[#B45309] sm:block" aria-hidden />
          <p className="min-w-0 flex-1">
            <b>{toFaDigits(missingImages)} کالا عکس ندارد</b> و تا عکس نگیرد روی لندینگ دیده نمی‌شود.{" "}
            <span className="hidden sm:inline">
              نون و ترندیول جلوی خواندن خودکار را می‌گیرند: دکمه‌ی روبه‌رو را یک بار به نوار بوکمارک مرورگر بکشید، بعد در صفحه‌ی هر کالا رویش بزنید. عکس، قیمت، تخفیف و موجودی همان صفحه این‌جا می‌آید.
            </span>
            <span className="sm:hidden">از کامپیوتر با دکمه‌ی «ارسال به سپکس» یا با ویرایش کالا و گذاشتن لینک عکس درستش کنید.</span>
          </p>
          <span className="hidden sm:inline-flex"><Bookmarklet /></span>
        </div>
      )}

      {noDiscount > 0 && (
        <p className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-[13px] leading-6 text-[#52525B]">
          <b className="text-[#18181B]">{toFaDigits(noDiscount)} کالا تخفیف ندارد</b> و روی لندینگ نمی‌آید. اگر سایت تخفیف بدهد، بررسی بعدی خودش نشانش می‌دهد؛ یا قیمت قبل را در ویرایش وارد کنید.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&_button]:whitespace-nowrap">
        <SegmentedControl<Filter>
          aria-label="فیلتر کالاها"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: `همه ${toFaDigits(counts.all)}` },
            { id: "live", label: `روشن ${toFaDigits(counts.live)}` },
            { id: "queue", label: `در صف ${toFaDigits(counts.queue)}` },
            { id: "attention", label: `نیاز به رسیدگی ${toFaDigits(counts.attention)}` },
            { id: "off", label: `خاموش ${toFaDigits(counts.off)}` },
          ]}
          className="w-max"
        />
        </div>
        <div className="flex items-center gap-2 sm:ms-auto">
          {!missingImages && <span className="hidden sm:inline-flex"><Bookmarklet /></span>}
          <Button icon={<Plus />} onClick={() => openForm(empty)} className="flex-1 sm:flex-none">
            افزودن کالا
          </Button>
        </div>
      </div>

      <section className={cn("overflow-hidden rounded-xl border border-[#E4E4E7] bg-white", pending && "opacity-70")}>
        {shown.length === 0 ? (
          <EmptyState icon={<Package />} title={products.length ? "کالایی در این فیلتر نیست" : "هنوز کالایی اضافه نشده"} hint={products.length ? undefined : "با «افزودن کالا» یا دکمه‌ی «ارسال به سپکس» شروع کنید."} />
        ) : (
          <ul className="divide-y divide-[#F4F4F5]">
            {shown.map((p) => {
              const price = fmtPrice(p.price, p.currency);
              const old = p.old_price && p.discount_percent ? fmtPrice(p.old_price, p.currency) : null;
              return (
                <li key={p.id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:gap-x-4 xl:grid-cols-[3.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem_auto]">
                  <button
                    type="button"
                    onClick={() => openForm(fromRow(p), p.image)}
                    className="flex size-12 items-center justify-center overflow-hidden rounded-lg border border-[#E4E4E7] bg-white hover:border-[#A1A1AA] xl:size-14"
                    aria-label="ویرایش"
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- our own /media route
                      <img src={p.image} alt="" className="size-full object-contain p-1" />
                    ) : (
                      <ImageOff className="size-5 text-[#D4D4D8]" aria-hidden />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-[#18181B]">{p.name_fa || p.title}</p>
                    {p.name_en && <p dir="ltr" className="truncate text-right text-xs text-[#52525B]">{p.name_en}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2">
                      <StoreLine p={p} />
                      <span className="text-[11px] text-[#A1A1AA]">{categoryName(p.category)}</span>
                    </div>
                  </div>

                  <div className="hidden min-w-0 xl:block">
                    {price ? (
                      <>
                        <p dir="ltr" className="text-right text-[14px] font-bold text-[#18181B]">{price}</p>
                        <p className="flex items-center gap-1.5 text-xs">
                          {p.discount_percent ? (
                            <Badge variant="success" className="px-1.5 py-0 text-[11px]">٪{toFaDigits(p.discount_percent)} تخفیف</Badge>
                          ) : null}
                          {old && <span dir="ltr" className="text-[#A1A1AA] line-through">{old}</span>}
                          {p.discount_source && (
                            <span className="text-[11px] text-[#A1A1AA]">{p.discount_source === "site" ? "از سایت" : p.discount_source === "research" ? "تحقیق" : "دستی"}</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-[#A1A1AA]">قیمت خوانده نشده</span>
                    )}
                  </div>

                  <div className="col-span-2 min-w-0 xl:col-span-1">
                    <span className="me-2 inline xl:hidden">
                      {price && <span dir="ltr" className="text-[13px] font-bold text-[#18181B]">{price}</span>}
                      {p.discount_percent ? <Badge variant="success" className="ms-1.5 px-1.5 py-0 text-[11px]">٪{toFaDigits(p.discount_percent)}</Badge> : null}
                    </span>
                    <StatusBadge p={p} />
                    <StockLine p={p} />
                  </div>

                  <div className="hidden text-center xl:block" title="کلیک روی لینک اختصاصی / سفارش از همان لینک">
                    <p className="text-[14px] font-bold text-[#18181B]">{toFaDigits(p.clicks)} / {toFaDigits(p.orders)}</p>
                    <p className="text-[11px] text-[#A1A1AA]">کلیک / سفارش</p>
                  </div>

                  <div className="col-span-2 flex items-center gap-1 border-t border-[#F4F4F5] pt-2.5 xl:col-span-1 xl:justify-end xl:border-0 xl:pt-0">
                    <label className="me-auto flex items-center gap-2 text-xs text-[#52525B] xl:me-1">
                    <Toggle
                      checked={!!p.active}
                      onCheckedChange={(v) => run(() => toggleProductAction(p.id, v))}
                      aria-label="نمایش روی لندینگ"
                    />
                    <span className="xl:hidden">روی لندینگ</span>
                    </label>
                    <Button variant="secondary" size="sm" icon={<Clapperboard />} onClick={() => setStory(p)}>
                      استوری
                    </Button>
                    <IconButton
                      aria-label="کپی لینک اختصاصی"
                      tooltip="کپی لینک اختصاصی"
                      onClick={() => navigator.clipboard.writeText(dealLink(siteUrl, p.code)).then(() => toast.success("لینک اختصاصی کپی شد."))}
                    >
                      <Copy />
                    </IconButton>
                    <RowMenu p={p} onEdit={() => openForm(fromRow(p), p.image)} run={run} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog && <ProductDialog key={dialog.key} open onOpenChange={(o) => !o && setDialog(null)} initial={dialog.form} initialPreview={dialog.preview} />}
      <StoryDialog product={story} siteUrl={siteUrl} onClose={() => setStory(null)} />
    </div>
  );
}
