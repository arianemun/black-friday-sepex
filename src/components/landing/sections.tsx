import Link from "next/link";
import { ArrowLeft, Camera, Link2, Ship } from "lucide-react";
import { faqs, paths } from "@/content/landing";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-3xl font-black leading-tight text-white sm:text-[2.6rem]">{title}</h2>
      {lead && <p className="mt-3 text-base leading-8 text-white/55">{lead}</p>}
    </div>
  );
}

const pathIcons = { link: Link2, photo: Camera, shipping: Ship } as const;

export function Paths() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0b0b0b] py-20 sm:py-28" aria-labelledby="paths-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_100%_at_50%_0%,rgb(255_203_5/0.12),transparent)]" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead id="paths-title" title="از کجا شروع کنیم؟" lead="هر چیزی از کالا دارید، همان کافی است. یکی از این سه مسیر را انتخاب کنید." />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {paths.map((p, i) => {
            const Icon = pathIcons[p.method];
            const primary = i === 0;
            return (
              <Link
                key={p.method}
                href={`/order?method=${p.method}`}
                className={`chamfer group relative flex flex-col p-7 transition-all duration-300 hover:-translate-y-1 ${
                  primary
                    ? "bg-brand text-ink shadow-[0_30px_80px_-30px_rgb(255_203_5/0.6)]"
                    : "bg-[#151515] text-white ring-1 ring-inset ring-white/10 hover:ring-brand/50"
                }`}
              >
                <Icon className={`size-9 ${primary ? "text-ink" : "text-brand"}`} strokeWidth={1.6} aria-hidden />
                <h3 className="mt-8 text-2xl font-black">{p.title}</h3>
                <p className={`mt-3 flex-1 text-sm leading-7 ${primary ? "text-ink/70" : "text-white/55"}`}>{p.body}</p>
                <span className={`mt-8 inline-flex items-center gap-2 text-sm font-black ${primary ? "" : "text-brand"}`}>
                  {p.cta}
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-4 bg-black py-20 sm:py-28" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <SectionHead id="faq-title" title="سؤالات متداول" lead="جواب سؤال‌تان اینجا نبود؟ درخواست را ثبت کنید؛ کارشناس ما تماس می‌گیرد." />
        <Accordion type="single" collapsible className="border-t border-white/10">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className="border-white/10">
              <AccordionTrigger className="text-white">{f.q}</AccordionTrigger>
              <AccordionContent className="text-white/60">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

