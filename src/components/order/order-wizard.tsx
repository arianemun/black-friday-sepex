"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, Check, Copy, Link2, Loader2, Pencil, Plus, Ship, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { countries, countryName, detectStore, extractUrl, methods, type Method } from "@/lib/catalog";
import { cn, toEnDigits, toFaDigits } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { FilePicker, type PickedFile } from "./file-picker";

/* ------------------------------------------------------------------ types & storage */

type Item = {
  key: string;
  url: string;
  title: string;
  description: string;
  quantity: string;
  originCountry: string;
  weight: string;
  files: PickedFile[];
};

type Contact = { firstName: string; lastName: string; gender: "" | "male" | "female"; phone: string; note: string };

type Draft = { method: Method | null; items: Item[]; contact: Contact; draftToken: string; utm: Record<string, string> };

const STORAGE_KEY = "sbf-order-draft-v1";
const MAX_ITEMS = 10;

const newKey = () => Math.random().toString(36).slice(2, 10);
const newItem = (url = ""): Item => ({ key: newKey(), url, title: "", description: "", quantity: "1", originCountry: "", weight: "", files: [] });
const newToken = () => {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    // Object URLs do not survive a reload; keep the uploaded ids, drop the previews.
    d.items = d.items.map((it) => ({ ...it, files: it.files.map((f) => ({ ...f, preview: null })) }));
    return d;
  } catch {
    return null;
  }
}
function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* private mode / quota: the draft just won't survive a reload */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const normalizePhone = (raw: string) => {
  let s = toEnDigits(raw).replace(/[\s\-()+.]/g, "");
  if (s.startsWith("0098")) s = "0" + s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = "0" + s.slice(2);
  else if (s.startsWith("9") && s.length === 10) s = "0" + s;
  return /^09\d{9}$/.test(s) ? s : null;
};

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "لینک";
  }
};

/* ------------------------------------------------------------------ small pieces */

const methodIcons = { link: Link2, photo: Camera, shipping: Ship } as const;
const methodBodies: Record<Method, string> = {
  link: "لینک صفحه‌ی کالا در هر فروشگاه خارجی را دارید.",
  photo: "اسکرین‌شات، عکس، پیش‌فاکتور یا فقط اسم کالا را دارید.",
  shipping: "کالا را خودتان خریده‌اید و فقط حمل و ترخیص می‌خواهید.",
};

function Field({ label, required, error, hint, htmlFor, children }: { label: string; required?: boolean; error?: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required && <span className="mr-1 text-destructive" aria-hidden>*</span>}
      </label>
      {children}
      {(error || hint) && <p className={cn("text-xs leading-5", error ? "font-semibold text-destructive" : "text-ink/55")}>{error ?? hint}</p>}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["روش سفارش", "مشخصات کالا", "اطلاعات تماس"];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="مراحل">
      {labels.map((l, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={l} aria-current={state === "current" ? "step" : undefined} className="flex flex-col gap-2">
            <span className={cn("h-1.5", state === "todo" ? "bg-ink/10" : "bg-ink", state === "current" && "bg-brand outline outline-1 outline-ink")} />
            <span className={cn("text-xs sm:text-sm", state === "todo" ? "text-ink/45" : "font-bold text-ink")}>
              {toFaDigits(i + 1)}. {l}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ wizard */

export function OrderWizard({ initialMethod, initialLink }: { initialMethod: Method | null; initialLink: string | null }) {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method | null>(null);
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [contact, setContact] = useState<Contact>({ firstName: "", lastName: "", gender: "", phone: "", note: "" });
  const [draftToken, setDraftToken] = useState("");
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpLength, setOtpLength] = useState(5);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Restore or start a draft once, on the client.
  useEffect(() => {
    const d = loadDraft();
    const params = new URLSearchParams(window.location.search);
    const campaign: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = params.get(k);
      if (v) campaign[k.slice(4)] = v.slice(0, 80);
    }
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) campaign.referrer = document.referrer.slice(0, 300);

    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from sessionStorage/URL */
    if (d && !initialLink) {
      setMethod(initialMethod ?? d.method);
      setItems(d.items.length ? d.items : [newItem()]);
      setContact(d.contact);
      setDraftToken(d.draftToken);
      setUtm({ ...d.utm, ...campaign });
      if (initialMethod || d.method) setStep(1);
    } else {
      setDraftToken(d?.draftToken ?? newToken());
      setUtm({ ...(d?.utm ?? {}), ...campaign });
      if (d) setContact(d.contact);
      if (initialMethod) {
        setMethod(initialMethod);
        setItems([newItem(initialLink ?? "")]);
        setStep(1);
      }
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialMethod, initialLink]);

  useEffect(() => {
    if (ready && !done) saveDraft({ method, items, contact, draftToken, utm });
  }, [ready, done, method, items, contact, draftToken, utm]);

  useEffect(() => {
    if (!otpSentTo) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [otpSentTo]);

  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const phoneNorm = useMemo(() => normalizePhone(contact.phone), [contact.phone]);

  function goto(n: number) {
    setErrors({});
    setStep(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function focusFirstError(errs: Record<string, string>) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
    });
  }

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  /* ---------- validation */

  function validateItems(): Record<string, string> {
    const e: Record<string, string> = {};
    items.forEach((it) => {
      const q = Number(toEnDigits(it.quantity));
      if (!Number.isInteger(q) || q < 1 || q > 999) e[`qty-${it.key}`] = "تعداد را درست وارد کنید.";
      if (method === "link") {
        if (!extractUrl(it.url)) e[`url-${it.key}`] = it.url.trim() ? "این لینک معتبر نیست. لینک کامل صفحه‌ی کالا را بگذارید." : "لینک کالا را وارد کنید.";
      } else if (method === "photo") {
        if (!it.files.length && it.title.trim().length < 2) e[`title-${it.key}`] = "یک عکس بگذارید یا اسم کالا را بنویسید.";
      } else if (method === "shipping") {
        if (it.title.trim().length < 2) e[`title-${it.key}`] = "نوع کالا را بنویسید.";
      }
    });
    return e;
  }

  function validateContact(): Record<string, string> {
    const e: Record<string, string> = {};
    if (contact.firstName.trim().length < 2) e.firstName = "نام را وارد کنید.";
    if (contact.lastName.trim().length < 2) e.lastName = "نام خانوادگی را وارد کنید.";
    if (!contact.gender) e.gender = "یکی را انتخاب کنید.";
    if (!phoneNorm) e.phone = "شماره موبایل را درست وارد کنید؛ مثل ۰۹۱۲۱۲۳۴۵۶۷.";
    return e;
  }

  /* ---------- actions */

  async function sendOtp() {
    const e = { ...validateItems(), ...validateContact() };
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirstError(e);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/otp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phoneNorm }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; length?: number; resendIn?: number; retryAfter?: number; devCode?: string } | null;
      if (!res.ok || !data?.ok) {
        if (data?.retryAfter && otpSentTo === phoneNorm) setResendAt(Date.now() + data.retryAfter * 1000);
        toast.error(data?.error || "ارسال کد ناموفق بود. دوباره تلاش کنید.");
        return;
      }
      setOtpSentTo(phoneNorm);
      setOtp("");
      setOtpLength(data.length ?? 5);
      setResendAt(Date.now() + (data.resendIn ?? 60) * 1000);
      setNow(Date.now());
      if (data.devCode) toast.info(`کد آزمایشی (فقط در محیط توسعه): ${data.devCode}`);
      else toast.success("کد تأیید پیامک شد.");
    } catch {
      toast.error("ارتباط برقرار نشد. اینترنت‌تان را بررسی کنید.");
    } finally {
      setSending(false);
    }
  }

  async function submit(code = otp) {
    if (submitting || !method || !phoneNorm) return;
    if (code.length !== otpLength) {
      setErrors({ otp: "کد تأیید را کامل وارد کنید." });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const payload = {
        method,
        items: items.map((it) => ({
          url: it.url,
          title: it.title,
          description: it.description,
          quantity: Number(toEnDigits(it.quantity)) || 1,
          originCountry: method === "shipping" ? it.originCountry : "",
          weight: method === "shipping" ? it.weight : "",
          uploads: method === "link" ? [] : it.files.map((f) => f.id),
        })),
        firstName: contact.firstName,
        lastName: contact.lastName,
        gender: contact.gender,
        phone: phoneNorm,
        code: toEnDigits(code),
        note: contact.note,
        draftToken,
        utm,
      };
      const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; trackingCode?: string; otp?: string } | null;
      if (!res.ok || !data?.ok || !data.trackingCode) {
        if (data?.otp) {
          setOtp("");
          setErrors({ otp: data.error || "کد تأیید درست نیست." });
          requestAnimationFrame(() => document.getElementById("otp")?.focus());
          if (data.otp !== "invalid") setResendAt(0);
        } else {
          toast.error(data?.error || "ثبت درخواست ناموفق بود. دوباره تلاش کنید.");
        }
        return;
      }
      clearDraft();
      setDone(data.trackingCode);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch {
      toast.error("ارتباط برقرار نشد. اینترنت‌تان را بررسی کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- render */

  if (!ready) {
    return (
      <div className="flex min-h-80 items-center justify-center" aria-busy>
        <Loader2 className="size-6 animate-spin text-ink/40" />
      </div>
    );
  }

  if (done)
    return (
      <Done
        code={done}
        onNew={() => {
          setDone(null);
          setMethod(null);
          setItems([newItem()]);
          setOtpSentTo(null);
          setOtp("");
          setDraftToken(newToken());
          setStep(0);
        }}
      />
    );

  return (
    <div ref={topRef} className="scroll-mt-24">
      <Stepper step={step} />

      {step === 0 && (
        <section className="mt-8" aria-labelledby="s0">
          <h1 id="s0" className="text-2xl font-black sm:text-3xl">چه چیزی از کالا دارید؟</h1>
          <p className="mt-2 text-ink/65">هر کدام را دارید انتخاب کنید. قیمت نهایی را بعد از بررسی، کارشناس اعلام می‌کند.</p>
          <div className="mt-6 grid gap-3">
            {(Object.keys(methods) as Method[]).map((m) => {
              const Icon = methodIcons[m];
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    goto(1);
                  }}
                  className={cn(
                    "group flex items-center gap-4 border-2 bg-white p-4 text-start transition-colors sm:p-5",
                    active ? "border-ink" : "border-ink/10 hover:border-ink/50"
                  )}
                >
                  <span className={cn("flex size-12 shrink-0 items-center justify-center", active ? "bg-brand text-ink" : "bg-paper text-ink group-hover:bg-brand")}>
                    <Icon className="size-6" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-black sm:text-lg">{methods[m].title}</span>
                    <span className="mt-1 block text-sm text-ink/60">{methodBodies[m]}</span>
                  </span>
                  <ArrowLeft className="size-5 shrink-0 text-ink/40 transition-transform group-hover:-translate-x-1 group-hover:text-ink" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && method && (
        <section className="mt-8" aria-labelledby="s1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="s1" className="text-2xl font-black sm:text-3xl">{methods[method].title}</h1>
              <p className="mt-2 text-ink/65">
                {method === "link"
                  ? "لینک صفحه‌ی کالا را بگذارید. متن اشتراک‌گذاری اپ فروشگاه را هم می‌توانید کامل بچسبانید."
                  : method === "photo"
                    ? "عکس، اسکرین‌شات یا پیش‌فاکتور بگذارید، یا اسم و مشخصات کالا را بنویسید."
                    : "بگویید چه باری دارید و از کجا باید حمل شود."}
              </p>
            </div>
            <button type="button" onClick={() => goto(0)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-ink">
              <Pencil className="size-3.5" /> تغییر روش
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {items.map((it, idx) => (
              <ItemCard
                key={it.key}
                index={idx}
                total={items.length}
                item={it}
                method={method}
                errors={errors}
                draftToken={draftToken}
                onChange={(patch) => updateItem(it.key, patch)}
                onRemove={() => setItems((l) => l.filter((x) => x.key !== it.key))}
              />
            ))}
          </div>

          {items.length < MAX_ITEMS && (
            <button
              type="button"
              onClick={() => setItems((l) => [...l, newItem()])}
              className="mt-4 flex w-full items-center justify-center gap-2 border-2 border-dashed border-ink/25 bg-white py-4 text-sm font-bold text-ink/75 hover:border-ink hover:text-ink"
            >
              <Plus className="size-4" /> افزودن کالای دیگر
            </button>
          )}

          <NavBar
            onBack={() => goto(0)}
            onNext={() => {
              const e = validateItems();
              setErrors(e);
              if (Object.keys(e).length) focusFirstError(e);
              else goto(2);
            }}
            nextLabel="ادامه"
          />
        </section>
      )}

      {step === 2 && method && (
        <section className="mt-8" aria-labelledby="s2">
          <h1 id="s2" className="text-2xl font-black sm:text-3xl">اطلاعات تماس</h1>
          <p className="mt-2 text-ink/65">کارشناس سپکس با همین شماره با شما تماس می‌گیرد.</p>

          <Summary method={method} items={items} onEdit={() => goto(1)} />

          <div className="mt-6 grid gap-5 border border-ink/10 bg-white p-4 sm:grid-cols-2 sm:p-6">
            <Field label="نام" required htmlFor="firstName" error={errors.firstName}>
              <Input id="firstName" autoComplete="given-name" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} aria-invalid={!!errors.firstName} />
            </Field>
            <Field label="نام خانوادگی" required htmlFor="lastName" error={errors.lastName}>
              <Input id="lastName" autoComplete="family-name" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} aria-invalid={!!errors.lastName} />
            </Field>
            <div className="flex flex-col gap-2" id="gender">
              <span className="text-sm font-semibold">
                جنسیت<span className="mr-1 text-destructive" aria-hidden>*</span>
              </span>
              <div role="radiogroup" aria-label="جنسیت" className="grid grid-cols-2 border border-input">
                {(
                  [
                    ["male", "آقا"],
                    ["female", "خانم"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={contact.gender === v}
                    onClick={() => setContact({ ...contact, gender: v })}
                    className={cn("h-11 text-sm font-semibold transition-colors", contact.gender === v ? "bg-ink text-brand" : "bg-white text-ink/70 hover:bg-paper")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-xs font-semibold text-destructive">{errors.gender}</p>}
            </div>
            <Field label="شماره موبایل" required htmlFor="phone" error={errors.phone}>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                dir="ltr"
                placeholder="09121234567"
                className="text-left"
                value={contact.phone}
                disabled={!!otpSentTo}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                aria-invalid={!!errors.phone}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="توضیحات (اختیاری)" htmlFor="note" hint="هر چیزی که کارشناس باید بداند؛ مثلاً زمان مناسب برای تماس.">
                <Textarea id="note" rows={3} maxLength={1000} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} />
              </Field>
            </div>
          </div>

          {otpSentTo ? (
            <div className="mt-6 border-2 border-ink bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  کد {toFaDigits(otpLength)} رقمی به <span className="ltr font-bold">{toFaDigits(otpSentTo)}</span> پیامک شد.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSentTo(null);
                    setOtp("");
                    setErrors({});
                    requestAnimationFrame(() => document.getElementById("phone")?.focus());
                  }}
                  className="text-sm font-semibold text-ink/60 underline underline-offset-4 hover:text-ink"
                >
                  ویرایش شماره
                </button>
              </div>
              <div className="mt-5 flex flex-col items-center gap-3">
                <label htmlFor="otp" className="text-sm font-semibold">کد تأیید</label>
                <InputOTP
                  id="otp"
                  maxLength={otpLength}
                  value={otp}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="^[0-9۰-۹]*$"
                  onChange={(v) => {
                    const clean = toEnDigits(v);
                    setOtp(clean);
                    setErrors({});
                    if (clean.length === otpLength) void submit(clean);
                  }}
                >
                  <InputOTPGroup>
                    {Array.from({ length: otpLength }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} className={cn("rounded-none border-ink/25 bg-white", errors.otp && "border-destructive")} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {errors.otp && <p className="text-sm font-semibold text-destructive" role="alert">{errors.otp}</p>}
                <button
                  type="button"
                  disabled={resendIn > 0 || sending}
                  onClick={sendOtp}
                  className="text-sm font-semibold text-ink underline underline-offset-4 disabled:text-ink/45 disabled:no-underline"
                >
                  {resendIn > 0 ? `ارسال دوباره‌ی کد تا ${toFaDigits(resendIn)} ثانیه‌ی دیگر` : sending ? "در حال ارسال…" : "ارسال دوباره‌ی کد"}
                </button>
              </div>
            </div>
          ) : null}

          <NavBar
            onBack={() => goto(1)}
            onNext={() => (otpSentTo ? submit() : sendOtp())}
            nextLabel={otpSentTo ? "ثبت درخواست" : "دریافت کد تأیید"}
            busy={sending || submitting}
            primary
          />
          <p className="mt-3 text-center text-xs text-ink/50">ثبت درخواست رایگان است. شماره‌ی شما فقط برای تماس کارشناس سپکس استفاده می‌شود.</p>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ item card */

function ItemCard({
  index,
  total,
  item,
  method,
  errors,
  draftToken,
  onChange,
  onRemove,
}: {
  index: number;
  total: number;
  item: Item;
  method: Method;
  errors: Record<string, string>;
  draftToken: string;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const url = extractUrl(item.url);
  const store = url ? detectStore(url) : undefined;
  const k = item.key;
  return (
    <fieldset className="border border-ink/10 bg-white p-4 sm:p-6">
      <legend className="sr-only">کالای {toFaDigits(index + 1)}</legend>
      <div className="mb-4 flex items-center justify-between">
        <span className="bg-ink px-2.5 py-1 text-xs font-bold text-brand">کالای {toFaDigits(index + 1)}</span>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs font-semibold text-ink/55 hover:text-destructive">
            <Trash2 className="size-3.5" /> حذف
          </button>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        {method === "link" && (
          <div className="sm:col-span-2">
            <Field
              label="لینک کالا"
              required
              htmlFor={`url-${k}`}
              error={errors[`url-${k}`]}
              hint={store ? `فروشگاه: ${store.name}، ${countryName(store.country)}` : url ? "لینک دریافت شد." : "آمازون، علی‌بابا، تائوبائو، ۱۶۸۸، نون، ترندیول یا هر فروشگاه خارجی دیگر."}
            >
              <Textarea
                id={`url-${k}`}
                rows={2}
                dir="ltr"
                inputMode="url"
                spellCheck={false}
                placeholder="https://"
                className="min-h-0 resize-none text-left"
                value={item.url}
                onChange={(e) => onChange({ url: e.target.value })}
                aria-invalid={!!errors[`url-${k}`]}
              />
            </Field>
          </div>
        )}

        {method === "photo" && (
          <div className="sm:col-span-2">
            <FilePicker
              label="عکس، اسکرین‌شات یا پیش‌فاکتور"
              hint="عکس یا PDF، هر فایل تا ۱۰ مگابایت، حداکثر ۵ فایل."
              value={item.files}
              onChange={(files) => onChange({ files })}
              draftToken={draftToken}
              invalid={!!errors[`title-${k}`]}
            />
          </div>
        )}

        {method !== "link" && (
          <Field
            label={method === "photo" ? "اسم یا مشخصات کالا" : "نوع کالا"}
            required={method === "shipping"}
            htmlFor={`title-${k}`}
            error={errors[`title-${k}`]}
            hint={method === "photo" ? "اگر عکس گذاشته‌اید اختیاری است." : "مثلاً لوازم یدکی خودرو، پوشاک، قطعات الکترونیکی."}
          >
            <Input id={`title-${k}`} value={item.title} maxLength={200} onChange={(e) => onChange({ title: e.target.value })} aria-invalid={!!errors[`title-${k}`]} />
          </Field>
        )}

        {method === "link" && (
          <Field label="مدل، رنگ، سایز (اختیاری)" htmlFor={`desc-${k}`}>
            <Input id={`desc-${k}`} value={item.description} maxLength={300} onChange={(e) => onChange({ description: e.target.value })} />
          </Field>
        )}

        <Field label="تعداد" required htmlFor={`qty-${k}`} error={errors[`qty-${k}`]}>
          <Input
            id={`qty-${k}`}
            inputMode="numeric"
            dir="ltr"
            className="text-center"
            value={item.quantity}
            onChange={(e) => onChange({ quantity: toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 3) })}
            aria-invalid={!!errors[`qty-${k}`]}
          />
        </Field>

        {method === "shipping" && (
          <>
            <Field label="کشور مبدأ" htmlFor={`origin-${k}`}>
              <NativeSelect id={`origin-${k}`} value={item.originCountry} onChange={(e) => onChange({ originCountry: e.target.value })} className="rounded-none">
                <option value="">انتخاب کنید</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
                <option value="OTHER">سایر کشورها</option>
              </NativeSelect>
            </Field>
            <Field label="وزن یا حجم تقریبی" htmlFor={`weight-${k}`}>
              <Input id={`weight-${k}`} placeholder="مثلاً ۲۰ کیلو" value={item.weight} maxLength={60} onChange={(e) => onChange({ weight: e.target.value })} />
            </Field>
          </>
        )}

        {method !== "link" && (
          <div className="sm:col-span-2">
            <Field
              label="توضیحات (اختیاری)"
              htmlFor={`desc-${k}`}
              hint={method === "shipping" ? "فروشنده یا تأمین‌کننده، آدرس انبار مبدأ، باتری‌دار یا مایع بودن و…" : "مدل، رنگ، سایز یا هر جزئیات دیگر."}
            >
              <Textarea id={`desc-${k}`} rows={3} maxLength={1500} value={item.description} onChange={(e) => onChange({ description: e.target.value })} />
            </Field>
          </div>
        )}

        {method === "shipping" && (
          <div className="sm:col-span-2">
            <FilePicker
              label="فاکتور یا عکس بار (اختیاری)"
              hint="عکس یا PDF، هر فایل تا ۱۰ مگابایت."
              value={item.files}
              onChange={(files) => onChange({ files })}
              draftToken={draftToken}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ footer nav, summary, done */

function NavBar({ onBack, onNext, nextLabel, busy, primary }: { onBack: () => void; onNext: () => void; nextLabel: string; busy?: boolean; primary?: boolean }) {
  return (
    <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-8 flex gap-2 border-t border-ink/10 bg-paper/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <button type="button" onClick={onBack} className="flex h-12 items-center gap-1.5 border border-ink/20 bg-white px-4 text-sm font-semibold hover:border-ink">
        <ArrowRight className="size-4" /> قبلی
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={busy}
        className={cn(
          "chamfer-sm flex h-12 flex-1 items-center justify-center gap-2 text-base font-bold transition-colors disabled:opacity-60 sm:flex-none sm:px-10",
          primary ? "bg-brand text-ink hover:bg-brand-deep" : "bg-ink text-brand hover:bg-neutral-800"
        )}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {nextLabel}
        {!busy && <ArrowLeft className="size-4" />}
      </button>
    </div>
  );
}

function Summary({ method, items, onEdit }: { method: Method; items: Item[]; onEdit: () => void }) {
  return (
    <div className="mt-6 flex items-start justify-between gap-3 border-r-4 border-brand bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-bold">{methods[method].title}، {toFaDigits(items.length)} کالا</p>
        <ul className="mt-1 space-y-0.5 text-xs text-ink/60">
          {items.slice(0, 3).map((it) => {
            const url = extractUrl(it.url);
            const label = it.title || (url ? detectStore(url)?.name ?? hostOf(url) : it.files.length ? `${toFaDigits(it.files.length)} فایل` : "کالا");
            return (
              <li key={it.key} className="truncate">
                {label} × {toFaDigits(it.quantity || "1")}
              </li>
            );
          })}
          {items.length > 3 && <li>و {toFaDigits(items.length - 3)} کالای دیگر</li>}
        </ul>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-xs font-semibold text-ink/60 underline underline-offset-4 hover:text-ink">
        ویرایش
      </button>
    </div>
  );
}

function Done({ code, onNew }: { code: string; onNew: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="text-center" aria-labelledby="done-title">
      <div className="mx-auto flex size-16 items-center justify-center bg-brand">
        <Check className="size-8 text-ink" strokeWidth={3} />
      </div>
      <h1 id="done-title" className="mt-6 text-2xl font-black sm:text-3xl">درخواست شما ثبت شد</h1>
      <p className="mx-auto mt-3 max-w-md leading-8 text-ink/65">کارشناس سپکس به‌زودی با شماره‌ی شما تماس می‌گیرد. کد پیگیری برایتان پیامک هم می‌شود.</p>
      <div className="mx-auto mt-8 max-w-sm border-2 border-ink bg-white">
        <div className="stripes-yellow h-2" aria-hidden />
        <div className="p-5">
          <p className="text-sm text-ink/60">کد پیگیری</p>
          <p dir="ltr" className="mt-1 text-4xl font-black tracking-wider">{code}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast.error("کپی نشد؛ کد را یادداشت کنید.");
              }
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "کپی شد" : "کپی کد"}
          </button>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-2">
        <Link href={`/track?code=${encodeURIComponent(code)}`} className="chamfer-sm flex h-12 items-center justify-center bg-ink font-bold text-brand hover:bg-neutral-800">
          پیگیری درخواست
        </Link>
        <button type="button" onClick={onNew} className="flex h-12 items-center justify-center border border-ink/20 bg-white text-sm font-semibold hover:border-ink">
          ثبت درخواست دیگر
        </button>
        <Link href="/" className="mt-2 text-sm text-ink/60 hover:text-ink">بازگشت به صفحه‌ی اصلی</Link>
      </div>
    </section>
  );
}
