import Link from "next/link";
import { ArrowLeft, Camera, Link2, Ship } from "lucide-react";
import { about, faqs, paths, steps } from "@/content/landing";
import { countries, stores } from "@/lib/catalog";
import { toFaDigits } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function SectionHead({ id, title, lead, dark }: { id: string; title: string; lead?: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
      {lead && <p className={`mt-3 text-base leading-8 ${dark ? "text-white/65" : "text-ink/65"}`}>{lead}</p>}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-4 bg-paper py-16 text-ink sm:py-24" aria-labelledby="how-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead id="how-title" title="از لینک تا ترخیص، چطور کار می‌کند؟" />
        <ol className="mt-10 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative bg-paper p-6 pt-14 lg:min-h-56">
              <span className="absolute right-6 top-5 text-3xl font-black text-brand [-webkit-text-stroke:1.5px_var(--brand-black)]">
                {toFaDigits(i + 1)}
              </span>
              <h3 className="text-lg font-black">{s.title}</h3>
              <p className="mt-2 text-sm leading-7 text-ink/65">{s.body}</p>
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
    <section className="bg-black py-16 text-white sm:py-24" aria-labelledby="paths-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead id="paths-title" dark title="از کجا شروع کنیم؟" lead="هر چیزی از کالا دارید، همان کافی است. یکی از این سه مسیر را انتخاب کنید." />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {paths.map((p, i) => {
            const Icon = pathIcons[p.method];
            const primary = i === 0;
            return (
              <Link
                key={p.method}
                href={`/order?method=${p.method}`}
                className={`chamfer group flex flex-col p-6 transition-colors sm:p-7 ${primary ? "bg-brand text-ink" : "bg-white/[0.06] text-white hover:bg-white/[0.1]"}`}
              >
                <Icon className={`size-8 ${primary ? "text-ink" : "text-brand"}`} strokeWidth={1.75} aria-hidden />
                <h3 className="mt-6 text-2xl font-black">{p.title}</h3>
                <p className={`mt-3 flex-1 text-sm leading-7 ${primary ? "text-ink/75" : "text-white/65"}`}>{p.body}</p>
                <span className={`mt-6 inline-flex items-center gap-2 text-sm font-bold ${primary ? "" : "text-brand"}`}>
                  {p.cta}
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
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
    <section id="stores" className="scroll-mt-4 bg-white py-16 text-ink sm:py-24" aria-labelledby="stores-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          id="stores-title"
          title="از هر فروشگاهی، به‌خصوص چین و امارات"
          lead="این‌ها فقط چند نمونه‌اند. لینک هر فروشگاه خارجی دیگری را هم می‌توانید بفرستید."
        />
        <div className="mt-10 grid gap-px border border-ink/10 bg-ink/10 md:grid-cols-2 lg:grid-cols-6">
          {countries.map((c, i) => {
            const list = stores.filter((s) => s.country === c.code);
            const lead = i === 0;
            return (
              <div key={c.code} className={`bg-white p-6 sm:p-7 ${lead ? "md:col-span-2 lg:col-span-4" : i === 1 ? "lg:col-span-2" : "lg:col-span-2"} ${i === 4 ? "md:col-span-2 lg:col-span-2" : ""}`}>
                <div className="flex items-baseline gap-3">
                  <h3 className={`font-black ${lead ? "text-4xl sm:text-5xl" : i === 1 ? "text-3xl" : "text-2xl"}`}>{c.name}</h3>
                  {i < 2 && <span className="bg-brand px-2 py-0.5 text-xs font-bold text-ink">تمرکز ویژه</span>}
                </div>
                <p className="mt-2 text-sm text-ink/55">{c.tagline}</p>
                <ul className={`mt-5 flex flex-wrap gap-2 ${lead ? "gap-2.5" : ""}`}>
                  {list.map((s) => (
                    <li key={s.key}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener nofollow noreferrer"
                        className={`inline-flex items-baseline gap-2 border px-3 py-2 transition-colors hover:border-ink hover:bg-ink hover:text-brand ${s.featured ? "border-ink/40 font-bold" : "border-ink/15 text-ink/75"} ${lead ? "sm:px-4 sm:py-3 sm:text-lg" : "text-sm"}`}
                      >
                        <span>{s.name}</span>
                        <span dir="ltr" className="text-xs font-normal opacity-55">{s.latin}</span>
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
    <section className="bg-black py-16 text-white sm:py-20" aria-labelledby="about-title">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <h2 id="about-title" className="text-3xl font-black leading-tight sm:text-4xl">{about.title}</h2>
        <p className="text-base leading-8 text-white/70 sm:text-lg sm:leading-9">{about.body}</p>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-4 bg-paper py-16 text-ink sm:py-24" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <SectionHead id="faq-title" title="سؤالات متداول" lead="جواب سؤال‌تان اینجا نبود؟ درخواست را ثبت کنید؛ کارشناس ما تماس می‌گیرد." />
        </div>
        <Accordion type="single" collapsible className="border-t border-ink/15">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className="border-ink/15">
              <AccordionTrigger className="hover:text-ink [&>svg]:text-ink">{f.q}</AccordionTrigger>
              <AccordionContent className="text-ink/70">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-brand text-ink" aria-labelledby="cta-title">
      <div className="stripes-yellow h-4" aria-hidden />
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="cta-title" className="text-3xl font-black sm:text-4xl">کالای بعدی‌تان را نشان‌مان بدهید.</h2>
          <p className="mt-2 text-ink/70">ثبت درخواست رایگان است و چند دقیقه طول می‌کشد.</p>
        </div>
        <Link href="/order" className="chamfer-sm inline-flex h-14 items-center gap-2 bg-ink px-8 text-lg font-bold text-brand hover:bg-neutral-800">
          ثبت سفارش
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
