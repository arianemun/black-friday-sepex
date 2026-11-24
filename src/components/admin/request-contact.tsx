"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ImageOff, MessageCircle, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { logContactAction } from "@/app/admin/actions";
import { adminButtonVariants } from "@/components/admin-ui";
import { cn } from "@/lib/utils";

/** Call / WhatsApp / Telegram. Each tap is written to the request's activity log. */
export function ContactButtons({ requestId, phone, intl }: { requestId: number; phone: string; intl: string }) {
  const log = (c: "call" | "whatsapp" | "telegram") => void logContactAction(requestId, c).catch(() => {});
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <a href={`tel:${phone}`} onClick={() => log("call")} className={cn(adminButtonVariants({ variant: "primary" }), "col-span-2 sm:col-span-1")}>
        <Phone /> <span dir="ltr">{phone}</span>
      </a>
      <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" onClick={() => log("whatsapp")} className={adminButtonVariants({ variant: "secondary" })}>
        <MessageCircle className="text-[#15803D]" /> واتس‌اپ
      </a>
      <a href={`https://t.me/+${intl}`} target="_blank" rel="noopener noreferrer" onClick={() => log("telegram")} className={adminButtonVariants({ variant: "secondary" })}>
        <Send className="text-[#2563EB]" /> تلگرام
      </a>
    </div>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("کپی نشد.");
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2 py-1 font-mono text-[13px] font-bold text-[#18181B] transition-colors hover:border-[#A1A1AA]"
      aria-label={`کپی کد ${code}`}
      dir="ltr"
    >
      {code}
      {done ? <Check className="size-3.5 text-[#15803D]" /> : <Copy className="size-3.5 text-[#A1A1AA]" />}
    </button>
  );
}

/** Remote store image with a quiet fallback when the store blocks hotlinking. */
export function ItemImage({ src }: { src: string | null }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // The image may have failed before hydration, when onError wasn't attached yet.
    const img = ref.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the already-loaded <img>
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  return (
    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E4E4E7] bg-white sm:size-24">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote store image, shown to staff only
        <img ref={ref} src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full object-contain p-1" />
      ) : (
        <ImageOff className="size-6 text-[#D4D4D8]" aria-hidden />
      )}
    </div>
  );
}
