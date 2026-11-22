"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickedFile = { id: string; name: string; preview: string | null; isPdf: boolean };

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const MAX = 10 * 1024 * 1024;

export function FilePicker({
  value,
  onChange,
  draftToken,
  max = 5,
  label,
  hint,
  invalid,
}: {
  value: PickedFile[];
  onChange: (files: PickedFile[]) => void;
  draftToken: string;
  max?: number;
  label: string;
  hint: string;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  async function upload(file: File) {
    if (file.size > MAX) throw new Error("حجم هر فایل حداکثر ۱۰ مگابایت است.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("draftToken", draftToken);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string; mime?: string } | null;
    if (!res.ok || !data?.ok || !data.id) throw new Error(data?.error || "بارگذاری فایل ناموفق بود.");
    const isPdf = data.mime === "application/pdf";
    return { id: data.id, name: file.name, isPdf, preview: isPdf ? null : URL.createObjectURL(file) } satisfies PickedFile;
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room = max - latest.current.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > room) setError(`حداکثر ${max} فایل برای هر کالا.`);
    setBusy((b) => b + files.length);
    for (const f of files) {
      try {
        const picked = await upload(f);
        latest.current = [...latest.current, picked];
        onChange(latest.current);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {value.map((f) => (
          <div key={f.id} className="relative size-20 overflow-hidden border border-ink/15 bg-white">
            {f.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={f.preview} alt={f.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1 p-1 text-ink/60">
                <FileText className="size-6" />
                <span className="w-full truncate text-center text-[10px]" dir="ltr">{f.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x.id !== f.id))}
              className="absolute left-0 top-0 flex size-6 items-center justify-center bg-ink text-white"
              aria-label={`حذف ${f.name}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`busy-${i}`} className="flex size-20 items-center justify-center border border-dashed border-ink/25 bg-white">
            <Loader2 className="size-5 animate-spin text-ink/50" />
          </div>
        ))}
        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn(
              "flex size-20 flex-col items-center justify-center gap-1 border-2 border-dashed bg-white text-xs font-semibold text-ink/70 transition-colors hover:border-ink hover:text-ink",
              invalid ? "border-destructive" : "border-ink/25"
            )}
          >
            <ImagePlus className="size-6" />
            افزودن
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <p className={cn("mt-2 text-xs", error ? "font-semibold text-destructive" : "text-ink/55")}>{error ?? hint}</p>
    </div>
  );
}
