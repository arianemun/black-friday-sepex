"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatFaDateTime, toEnDigits, toFaDigits } from "@/lib/utils";
import { btn, Frame, ProductPreviewCard } from "./ui";

type Result = {
  trackingCode: string;
  method: string;
  firstName: string;
  status: { key: string; name: string };
  createdAt: string;
  updatedAt: string;
  items: {
    title: string;
    note: string | null;
    store: string | null;
    image: string | null;
    price: string | null;
    quantity: number;
  }[];
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
        body: JSON.stringify({
          code: toEnDigits(code),
          phone: toEnDigits(phone),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        request?: Result;
      } | null;
      if (!res.ok || !data?.ok || !data.request) {
        setResult(null);
        setError(data?.error || "پیدا نشد. کد و شماره رو یه بار دیگه چک کن.");
      } else setResult(data.request);
    } catch {
      setError("ارتباط برقرار نشد. اینترنتت رو چک کن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!result && (
        <Frame
          as="form"
          onSubmit={onSubmit}
          className="mt-6"
          innerClassName="grid gap-4"
        >
          <div className="grid gap-2">
            <label htmlFor="code" className="text-sm font-semibold">
              کد پیگیری
            </label>
            <Input
              id="code"
              dir="ltr"
              className="text-left uppercase"
              placeholder="BF-XXXXXX"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="phone" className="text-sm font-semibold">
              شماره موبایل
            </label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              placeholder="09121234567"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={btn.primary}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            پیگیری
          </button>
        </Frame>
      )}

      {result && (
        <Frame as="section" tone="brand" className="mt-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p dir="ltr" className="text-xl font-black">
              {result.trackingCode}
            </p>
            <span
              className={cn(
                "chamfer-sm px-3 py-1 text-sm font-bold",
                result.status.key === "cancelled"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-brand text-ink",
              )}
            >
              {result.status.name}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/60">
            {result.method}، ثبت در {formatFaDateTime(result.createdAt)}
          </p>

          <h2 className="mt-6 text-sm font-bold text-white/70">کالاها</h2>
          <ul className="mt-3 space-y-3">
            {result.items.map((it, i) => (
              <li key={i} className="chamfer-sm bg-white/[0.05] p-3">
                <ProductPreviewCard
                  preview={{
                    title: it.title,
                    image: it.image,
                    price: it.price,
                    site: it.store,
                  }}
                  note={it.note}
                  quantity={toFaDigits(it.quantity)}
                  compact
                />
              </li>
            ))}
          </ul>

          <h2 className="mt-6 text-sm font-bold text-white/70">مراحل</h2>
          <ol className="mt-3 space-y-3">
            {result.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rotate-45",
                    i === result.history.length - 1
                      ? "bg-brand outline outline-1 outline-brand"
                      : "bg-white/30",
                  )}
                />
                <span className="flex-1 font-semibold">{h.label}</span>
                <span className="text-xs text-white/50">
                  {formatFaDateTime(h.at)}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setResult(null)}
            className={cn(btn.secondary, "mt-6 h-10 w-full text-xs")}
          >
            <RotateCw className="size-3.5" /> پیگیری یه درخواست دیگه
          </button>
        </Frame>
      )}

      <div className="chamfer mt-8 bg-brand p-5 text-ink sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-black">هنوز سفارشی ثبت نکردی؟</p>
            <p className="mt-1 text-sm text-ink/70">
              لینک، عکس یا اسم کالا رو بفرست؛ بقیه‌اش با ما.
            </p>
          </div>
          <Link
            href="/order"
            className="chamfer-sm inline-flex h-12 shrink-0 items-center justify-center gap-2 bg-ink px-6 font-black text-brand transition-colors hover:bg-[#222]"
          >
            ثبت سفارش
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}
