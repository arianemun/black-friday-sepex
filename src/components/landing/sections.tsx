import Link from "next/link";
import { ArrowLeft, Camera, Link2, PackageSearch, Ship } from "lucide-react";
import { faqs, paths } from "@/content/landing";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function SectionHead({
  id,
  title,
  lead,
}: {
  id: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <h2
        id={id}
        className="text-3xl font-black leading-tight text-white sm:text-[2.6rem]"
      >
        {title}
      </h2>
      {lead && <p className="mt-3 text-base leading-8 text-white/55">{lead}</p>}
    </div>
  );
}

const pathIcons = { link: Link2, photo: Camera, shipping: Ship } as const;

export function Paths() {
  return (
    <section
      className="relative isolate overflow-hidden bg-black py-20 sm:py-28"
      aria-labelledby="paths-title"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40%_45%_at_50%_55%,rgb(255_203_5/0.07),transparent_70%)]"
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          id="paths-title"
          title="از کجا شروع کنیم؟"
          lead="هر چیزی از کالا دارید، همان کافی است. یکی از این سه مسیر را انتخاب کنید."
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {paths.map((p, i) => {
            const Icon = pathIcons[p.method];
            const primary = i === 0;
            return (
              <Link
                key={p.method}
                href={`/order?method=${p.method}`}
                className={`chamfer group relative flex p-px transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none ${
                  primary
                    ? "bg-brand shadow-[0_30px_80px_-30px_rgb(255_203_5/0.6)]"
                    : "bg-white/12 hover:bg-brand/70 focus-visible:bg-brand"
                }`}
              >
                <span
                  className={`chamfer flex flex-1 flex-col p-7 ${primary ? "bg-brand text-ink" : "bg-[#121212] text-white"}`}
                >
                  <Icon
                    className={`size-9 ${primary ? "text-ink" : "text-brand"}`}
                    strokeWidth={1.6}
                    aria-hidden
                  />
                  <h3 className="mt-8 text-2xl font-black">{p.title}</h3>
                  <p
                    className={`mt-3 flex-1 text-sm leading-7 ${primary ? "text-ink/70" : "text-white/55"}`}
                  >
                    {p.body}
                  </p>
                  <span
                    className={`mt-8 inline-flex items-center gap-2 text-sm font-black ${primary ? "" : "text-brand"}`}
                  >
                    {p.cta}
                    <ArrowLeft
                      className="size-4 transition-transform group-hover:-translate-x-1.5"
                      aria-hidden
                    />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** A short question-and-answer exchange, in the brand's chamfered shapes. */
function FaqChat() {
  return (
    <div className="relative mt-10 max-w-md">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 left-0 select-none text-[11rem] font-black leading-none text-brand/[0.07]"
      >
        ؟
      </span>
      <div className="relative flex flex-col gap-3">
        <div aria-hidden className="flex flex-col gap-3">
          <div className="chamfer-sm self-start bg-white/[0.07] px-5 py-3.5 text-sm text-white/80">
            سفارشم رو از کجا دنبال کنم؟
          </div>
          <div className="chamfer-sm self-end bg-brand px-5 py-3.5 text-sm font-bold text-ink">
            با کد پیگیری؛ هر مرحله پیامک هم می‌گیری.
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/track"
            className="chamfer-sm inline-flex h-11 items-center gap-2 bg-white/[0.07] px-4 text-sm font-bold text-white transition-colors hover:bg-brand hover:text-ink"
          >
            <PackageSearch className="size-4" aria-hidden />
            پیگیری سفارش
          </Link>
          <Link
            href="/order"
            className="chamfer-sm inline-flex h-11 items-center gap-2 bg-brand px-4 text-sm font-black text-ink transition-colors hover:bg-[#ffd633]"
          >
            ثبت درخواست
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  return (
    <section
      id="faq"
      className="scroll-mt-4 bg-black py-20 sm:py-28"
      aria-labelledby="faq-title"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHead
            id="faq-title"
            title="سؤالات متداول"
            lead="جواب سؤال‌تان اینجا نبود؟ درخواست را ثبت کنید؛ کارشناس ما تماس می‌گیرد."
          />
          <FaqChat />
        </div>
        <Accordion type="single" collapsible>
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`q${i}`}
              className="border-white/10 last:border-b-0"
            >
              <AccordionTrigger className="text-white">{f.q}</AccordionTrigger>
              <AccordionContent className="text-white/60">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
