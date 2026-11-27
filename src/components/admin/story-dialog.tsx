"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button, FieldInput, FormField } from "@/components/admin-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/admin-ui/dialog";
import { countryName, storeByKey } from "@/lib/catalog";
import { cutWhiteBackground, drawStory, STICKER_ZONE, STORY_H, STORY_W } from "@/lib/story-render";
import type { ProductRow } from "@/lib/products";

type P = ProductRow & { image: string | null };

/** The font family next/font generated for Peyda, read from the CSS variable. */
function peydaFamily() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-peyda").trim();
  return v || "sans-serif";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** The public link for a deal, on the address the panel is open on (falls back to the configured site URL). */
export function dealLink(siteUrl: string, code: string) {
  const origin = typeof window !== "undefined" && /^https?:/.test(window.location.origin) ? window.location.origin : siteUrl;
  return `${origin.replace(/\/$/, "")}/d/${code}`;
}

export function StoryDialog({ product, siteUrl, onClose }: { product: P | null; siteUrl: string; onClose: () => void }) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[min(880px,calc(100%-2rem))]">
        {product && <StoryEditor key={product.id} product={product} siteUrl={siteUrl} />}
      </DialogContent>
    </Dialog>
  );
}

function StoryEditor({ product, siteUrl }: { product: P; siteUrl: string }) {
  const store = storeByKey(product.store_key);
  const [nameFa, setNameFa] = useState(product.name_fa ?? "");
  const [nameEn, setNameEn] = useState(product.name_en ?? product.title);
  const [discount, setDiscount] = useState(product.discount_percent ? String(product.discount_percent) : "");
  const [cutBg, setCutBg] = useState(true);
  const [custom, setCustom] = useState<string | null>(null);
  const [showZone, setShowZone] = useState(true);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cutRef = useRef<{ src: string; cut: boolean; canvas: HTMLCanvasElement } | null>(null);
  const link = dealLink(siteUrl, product.code);
  const src = custom ?? product.image;

  useEffect(() => {
    let alive = true;
    (async () => {
      const family = peydaFamily();
      // Load the real face only: next/font's "Fallback" face is a local() alias that rejects the whole load.
      const main = family.split(",")[0].trim();
      await Promise.all([300, 500, 700, 800, 850, 950].map((w) => document.fonts.load(`${w} 48px ${main}`, "سپکس abc ۱").catch(() => null)));
      let img: HTMLCanvasElement | null = null;
      if (src) {
        if (cutRef.current?.src === src && cutRef.current.cut === cutBg) img = cutRef.current.canvas;
        else {
          try {
            img = cutWhiteBackground(await loadImage(src), cutBg && !custom);
            cutRef.current = { src, cut: cutBg, canvas: img };
          } catch {
            img = null;
          }
        }
      }
      if (!alive || !canvasRef.current) return;
      const n = Number(discount);
      const source = store ? `از ${store.brand ?? store.latin}، ${countryName(store.country)}` : null;
      drawStory(canvasRef.current.getContext("2d")!, { nameFa, nameEn, discount: n >= 3 && n <= 90 ? Math.round(n) : null, source }, img, family);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [nameFa, nameEn, discount, cutBg, src, custom, store]);

  function download() {
    canvasRef.current?.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `sepex-story-${product.code}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_1fr]">
      <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#141414]">
        <canvas ref={canvasRef} width={STORY_W} height={STORY_H} className="block h-auto w-full" aria-label="پیش‌نمایش استوری" />
        {showZone && (
          <div
            className="pointer-events-none absolute inset-x-[18%] flex items-center justify-center rounded-md border-2 border-dashed border-white/40 text-[11px] font-semibold text-white/60"
            style={{ top: `${(STICKER_ZONE.y / STORY_H) * 100}%`, height: `${(STICKER_ZONE.h / STORY_H) * 100}%` }}
          >
            جای استیکر لینک
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <DialogHeader>
          <DialogTitle>استوری اینستاگرام</DialogTitle>
          <DialogDescription>تغییرات این‌جا فقط روی تصویر اثر دارد. کادر خط‌چین داخل فایل نیست؛ فقط محل استیکر لینک را نشان می‌دهد.</DialogDescription>
        </DialogHeader>
        <FormField label="اسم فارسی" htmlFor="st-fa">
          <FieldInput id="st-fa" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder="مثلاً هدفون سونی" />
        </FormField>
        <FormField label="اسم انگلیسی" htmlFor="st-en">
          <FieldInput id="st-en" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </FormField>
        <FormField
          label="درصد تخفیف"
          htmlFor="st-d"
          helper={
            product.discount_source === "site"
              ? "از خود سایت فروشگاه خوانده شده."
              : product.discount_source === "research"
                ? "از بررسی قیمت‌های بلک‌فرایدی امسال؛ بررسی بعدی از سایت جایگزینش می‌کند."
                : discount
                  ? "دستی وارد شده؛ مطمئن شوید روی سایت هم همین است."
                  : "خالی بماند، روی استوری «Black Friday deal» می‌آید."
          }
        >
          <FieldInput id="st-d" dir="ltr" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
        </FormField>
        <div className="flex flex-col gap-2 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cutBg} onChange={(e) => setCutBg(e.target.checked)} className="size-4 accent-[#18181B]" disabled={!!custom} />
            حذف پس‌زمینه‌ی سفید عکس کالا
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showZone} onChange={(e) => setShowZone(e.target.checked)} className="size-4 accent-[#18181B]" />
            نمایش محل استیکر لینک
          </label>
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 font-semibold text-[#18181B] hover:underline">
            <ImagePlus className="size-4" aria-hidden />
            عکس دیگر (PNG بدون پس‌زمینه بهتر است)
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setCustom(URL.createObjectURL(f));
              }}
            />
          </label>
          {!src && <p className="text-xs font-semibold text-[#B45309]">این کالا هنوز عکس ندارد؛ یک عکس انتخاب کنید.</p>}
        </div>

        <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3">
          <p className="mb-1.5 text-xs text-[#71717A]">لینک اختصاصی (برای استیکر لینک)</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate text-[13px] font-semibold">{link}</code>
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy />}
              onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("لینک کپی شد."))}
            >
              کپی
            </Button>
          </div>
        </div>

        <Button icon={<Download />} onClick={download} disabled={!ready}>
          دانلود استوری (PNG)
        </Button>
      </div>
    </div>
  );
}
