import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
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
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader variant="light" />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-2xl font-black sm:text-3xl">پیگیری درخواست</h1>
        <p className="mt-2 text-ink/65">کد پیگیری و شماره‌ی موبایلی را که با آن ثبت کرده‌اید وارد کنید.</p>
        <TrackForm initialCode={code} />
      </main>
    </div>
  );
}
