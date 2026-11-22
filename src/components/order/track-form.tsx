"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatFaDateTime, toEnDigits, toFaDigits } from "@/lib/utils";

type Result = {
  trackingCode: string;
  method: string;
  firstName: string;
  status: { key: string; name: string };
  createdAt: string;
  updatedAt: string;
  items: { title: string; quantity: number }[];
  history: { label: string; at: string }[];
};

export function TrackForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: toEnDigits(code), phone: toEnDigits(phone) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; request?: Result } | null;
      if (!res.ok || !data?.ok || !data.request) {
        setResult(null);
        setError(data?.error || "پیدا نشد. کد و شماره را بررسی کنید.");
      } else setResult(data.request);
    } catch {
      setError("ارتباط برقرار نشد. اینترنت‌تان را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 border border-white/10 bg-[#121212] p-4 sm:p-6">
        <div className="grid gap-2">
          <label htmlFor="code" className="text-sm font-semibold">کد پیگیری</label>
          <Input id="code" dir="ltr" className="text-left uppercase" placeholder="BF-XXXXXX" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label htmlFor="phone" className="text-sm font-semibold">شماره موبایل</label>
          <Input id="phone" type="tel" inputMode="numeric" dir="ltr" className="text-left" placeholder="09121234567" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="chamfer-sm flex h-12 items-center justify-center gap-2 bg-brand font-bold text-ink hover:bg-[#ffd633] disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />}
          پیگیری
        </button>
      </form>

      {result && (
        <section className="mt-6 border-2 border-brand bg-[#121212]" aria-live="polite">
          <div className="h-1.5 bg-brand" aria-hidden />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p dir="ltr" className="text-xl font-black">{result.trackingCode}</p>
              <span className={cn("px-3 py-1 text-sm font-bold", result.status.key === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-brand text-ink")}>
                {result.status.name}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/60">{result.method}، ثبت در {formatFaDateTime(result.createdAt)}</p>
            <ul className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
              {result.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span dir="auto" className="truncate">{it.title}</span>
                  <span className="shrink-0 text-white/55">× {toFaDigits(it.quantity)}</span>
                </li>
              ))}
            </ul>
            <ol className="mt-5 space-y-3 border-t border-white/10 pt-4">
              {result.history.map((h, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rotate-45", i === result.history.length - 1 ? "bg-brand outline outline-1 outline-brand" : "bg-white/30")} />
                  <span className="flex-1 font-semibold">{h.label}</span>
                  <span className="text-xs text-white/50">{formatFaDateTime(h.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      <p className="mt-6 text-center text-sm text-white/60">
        هنوز درخواستی ثبت نکرده‌اید؟ <Link href="/order" className="font-bold text-white underline underline-offset-4">ثبت سفارش</Link>
      </p>
    </>
  );
}
