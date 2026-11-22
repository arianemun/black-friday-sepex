import Link from "next/link";
import { ArrowLeft, Camera, Link2, Ship } from "lucide-react";
import { about, faqs, paths, steps } from "@/content/landing";
import { countries, stores } from "@/lib/catalog";
import { toFaDigits } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-3xl font-black leading-tight text-white sm:text-[2.6rem]">{title}</h2>
      {lead && <p className="mt-3 text-base leading-8 text-white/55">{lead}</p>}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-4 bg-black py-20 sm:py-28" aria-labelledby="how-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead id="how-title" title="از لینک تا ترخیص، چطور کار می‌کند؟" />
        <ol className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* the route line the steps sit on */}
          <span className="absolute inset-x-0 top-7 hidden h-px bg-gradient-to-l from-brand via-brand/40 to-transparent lg:block" aria-hidden />
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="relative z-10 flex size-14 items-center justify-center bg-black text-2xl font-black text-brand ring-1 ring-brand/50">
                {toFaDigits(i + 1)}
              </span>
              <h3 className="mt-5 text-lg font-black text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-7 text-white/55">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
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

export function Stores() {
  return (
    <section id="stores" className="scroll-mt-4 bg-black py-20 sm:py-28" aria-labelledby="stores-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          id="stores-title"
          title="از هر فروشگاهی، به‌خصوص چین و امارات"
          lead="این‌ها فقط چند نمونه‌اند. لینک هر فروشگاه خارجی دیگری را هم می‌توانید بفرستید."
        />
        <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          {countries.map((c, i) => {
            const list = stores.filter((s) => s.country === c.code);
            const focus = i < 2;
            return (
              <div
                key={c.code}
                className={`relative overflow-hidden p-6 sm:p-7 ${
                  i === 0 ? "md:col-span-2 lg:col-span-4" : i === 1 ? "lg:col-span-2" : i === 4 ? "md:col-span-2 lg:col-span-2" : "lg:col-span-2"
                } ${focus ? "bg-[#151515] ring-1 ring-inset ring-brand/40" : "bg-[#0f0f0f] ring-1 ring-inset ring-white/8"}`}
              >
                <div className="relative flex items-baseline gap-3">
                  <h3 className={`font-black text-white ${i === 0 ? "text-4xl sm:text-5xl" : i === 1 ? "text-3xl" : "text-2xl"}`}>{c.name}</h3>
                  {focus && <span className="bg-brand px-2 py-0.5 text-xs font-black text-ink">تمرکز ویژه</span>}
                </div>
                <p className="relative mt-2 text-sm text-white/45">{c.tagline}</p>
                <ul className="relative mt-6 flex flex-wrap gap-2">
                  {list.map((s) => (
                    <li key={s.key}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener nofollow noreferrer"
                        className={`inline-flex items-baseline gap-2 px-3 py-2 transition-colors hover:bg-brand hover:text-ink ${
                          s.featured ? "bg-white/[0.08] font-bold text-white" : "bg-white/[0.04] text-white/65"
                        } ${i === 0 ? "sm:px-4 sm:py-3 sm:text-lg" : "text-sm"}`}
                      >
                        <span>{s.name}</span>
                        <span dir="ltr" className="text-xs font-normal opacity-50">{s.latin}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function About() {
  return (
    <section className="bg-[#0b0b0b] py-20 sm:py-24" aria-labelledby="about-title">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <h2 id="about-title" className="text-3xl font-black leading-tight text-brand sm:text-4xl">{about.title}</h2>
        <p className="text-base leading-8 text-white/65 sm:text-lg sm:leading-9">{about.body}</p>
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

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-black py-20 sm:py-28" aria-labelledby="cta-title">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_70%_at_50%_100%,rgb(255_203_5/0.28),transparent)]" aria-hidden />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <h2 id="cta-title" className="text-4xl font-black leading-tight text-white sm:text-6xl">
          کالای بعدی‌تان را
          <br />
          نشان‌مان بدهید.
        </h2>
        <p className="mt-4 text-white/55">ثبت درخواست رایگان است و چند دقیقه طول می‌کشد.</p>
        <Link
          href="/order"
          className="chamfer-sm mt-9 inline-flex h-15 items-center gap-2 bg-brand px-10 text-lg font-black text-ink shadow-[0_20px_60px_-15px_rgb(255_203_5/0.7)] transition-colors hover:bg-[#ffd633]"
        >
          ثبت سفارش
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
