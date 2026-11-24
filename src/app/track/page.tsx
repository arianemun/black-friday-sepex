import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { PackageSearch } from "lucide-react";
import { TrackForm } from "@/components/order/track-form";

export const metadata: Metadata = {
  title: "پیگیری درخواست",
  description: "وضعیت درخواست خرید، حمل و ترخیص خود را با کد پیگیری و شماره‌ی موبایل ببینید.",
  alternates: { canonical: "/track" },
};

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 20) : "";
  return (
    <div className="dark relative isolate min-h-dvh overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(50%_100%_at_50%_0%,rgb(255_203_5/0.14),transparent)]" aria-hidden />
      <SiteHeader variant="solid" />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="flex items-start gap-3">
          <span className="chamfer-sm mt-0.5 flex size-11 shrink-0 items-center justify-center bg-brand text-ink sm:size-12" aria-hidden>
            <PackageSearch className="size-5 sm:size-6" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">پیگیری درخواست</h1>
            <p className="mt-2 text-white/65">کد پیگیری و شماره موبایلی که باهاش ثبت کردی رو وارد کن.</p>
          </div>
        </div>
        <TrackForm initialCode={code} />
      </main>
    </div>
  );
}
