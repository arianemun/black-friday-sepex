"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, Check, ClipboardPaste, Copy, Link2, Loader2, Package, Pencil, Plus, RotateCw, ShieldCheck, Ship, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { countries, countryName, detectStore, extractUrl, methods, orderMethods, type OrderMethod as Method } from "@/lib/catalog";
import { cn, toEnDigits, toFaDigits } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { FilePicker, type PickedFile } from "./file-picker";
import { btn, Frame, ProductPreviewCard, type ProductPreview } from "./ui";

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
  /** Product info read from the link; `previewFor` is the URL it belongs to. */
  preview?: ProductPreview | null;
  previewFor?: string;
};

type Contact = { firstName: string; lastName: string; gender: "" | "male" | "female"; phone: string; note: string };

type Draft = { method: Method | null; items: Item[]; contact: Contact; draftToken: string; utm: Record<string, string> };

const STORAGE_KEY = "sbf-order-draft-v2";
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
  link: "لینک صفحه‌ی کالا رو از هر فروشگاه خارجی داری.",
  photo: "اسکرین‌شات، عکس، پیش‌فاکتور یا فقط اسم کالا رو داری.",
  shipping: "کالا رو خودت خریدی و فقط حمل و ترخیص می‌خوای.",
};

function Field({ label, required, error, hint, htmlFor, children }: { label: string; required?: boolean; error?: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required && <span className="mr-1 text-destructive" aria-hidden>*</span>}
      </label>
      {children}
      {(error || hint) && <p className={cn("text-xs leading-5", error ? "font-semibold text-destructive" : "text-white/55")}>{error ?? hint}</p>}
    </div>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  const labels = ["روش سفارش", "مشخصات کالا", "اطلاعات تماس"];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="مراحل">
      {labels.map((l, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={l} aria-current={state === "current" ? "step" : undefined}>
            <button
              type="button"
              disabled={state !== "done"}
              onClick={() => onJump(i)}
              className="flex w-full flex-col gap-2 text-start enabled:cursor-pointer enabled:hover:opacity-80"
            >
              <span className={cn("h-1.5 w-full", state === "todo" ? "bg-white/10" : state === "done" ? "bg-brand/50" : "bg-brand")} />
              <span className={cn("text-xs sm:text-sm", state === "todo" ? "text-white/45" : "font-bold text-white")}>
                {state === "done" ? <Check className="ml-1 inline size-3.5 text-brand" aria-hidden /> : `${toFaDigits(i + 1)}. `}
                {l}
              </span>
            </button>
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
      if (!Number.isInteger(q) || q < 1 || q > 999) e[`qty-${it.key}`] = "تعداد رو درست وارد کن.";
      if (method === "link") {
        if (!extractUrl(it.url)) e[`url-${it.key}`] = it.url.trim() ? "این لینک معتبر نیست. لینک کامل صفحه‌ی کالا رو بذار." : "لینک کالا رو وارد کن.";
      } else if (method === "photo") {
        if (!it.files.length && it.title.trim().length < 2) e[`title-${it.key}`] = "یه عکس بذار یا اسم کالا رو بنویس.";
      } else if (method === "shipping") {
        if (it.title.trim().length < 2) e[`title-${it.key}`] = "بنویس چه کالایی هست.";
      }
    });
    return e;
  }

  function validateContact(): Record<string, string> {
    const e: Record<string, string> = {};
    if (contact.firstName.trim().length < 2) e.firstName = "اسمت رو بنویس.";
    if (contact.lastName.trim().length < 2) e.lastName = "نام خانوادگیت رو بنویس.";
    if (!contact.gender) e.gender = "یکی رو انتخاب کن.";
    if (!phoneNorm) e.phone = "شماره موبایل رو درست وارد کن؛ مثل ۰۹۱۲۱۲۳۴۵۶۷.";
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
        toast.error(data?.error || "کد ارسال نشد. دوباره امتحان کن.");
        return;
      }
      setOtpSentTo(phoneNorm);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      setOtp("");
      setOtpLength(data.length ?? 5);
      setResendAt(Date.now() + (data.resendIn ?? 60) * 1000);
      setNow(Date.now());
      if (data.devCode) toast.info(`کد آزمایشی (فقط در محیط توسعه): ${data.devCode}`);
      else toast.success("کد تأیید برات پیامک شد.");
    } catch {
      toast.error("ارتباط برقرار نشد. اینترنتت رو چک کن.");
    } finally {
      setSending(false);
    }
  }

  async function submit(code = otp) {
    if (submitting || !method || !phoneNorm) return;
    if (code.length !== otpLength) {
      setErrors({ otp: "کد تأیید رو کامل وارد کن." });
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
          toast.error(data?.error || "درخواست ثبت نشد. دوباره امتحان کن.");
        }
        return;
      }
      clearDraft();
      setDone(data.trackingCode);
      window.dispatchEvent(new CustomEvent("bf:order", { detail: { trackingCode: data.trackingCode } }));
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch {
      toast.error("ارتباط برقرار نشد. اینترنتت رو چک کن.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- render */

  if (!ready) {
    return (
      <div className="flex min-h-80 items-center justify-center" aria-busy>
        <Loader2 className="size-6 animate-spin text-white/40" />
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
      <Stepper step={step} onJump={goto} />

      {step === 0 && (
        <section className="mt-8" aria-labelledby="s0">
          <h1 id="s0" className="text-2xl font-black sm:text-3xl">از کالات چی داری؟</h1>
          <p className="mt-2 text-white/65">هر کدوم رو داری انتخاب کن. قیمت نهایی رو بعد از بررسی، کارشناس بهت می‌گه.</p>
          <div className="mt-6 grid gap-3">
            {orderMethods.map((m) => {
              const Icon = methodIcons[m];
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    // A different method starts a fresh list; the old items don't fit its fields.
                    if (method !== m) setItems([newItem()]);
                    setMethod(m);
                    goto(1);
                  }}
                  className={cn("chamfer group p-px text-start transition-colors", active ? "bg-brand" : "bg-white/12 hover:bg-white/40 focus-visible:bg-brand focus-visible:outline-none")}
                >
                  <span className="chamfer flex items-center gap-4 bg-[#121212] p-4 sm:p-5">
                    <span className={cn("chamfer-sm flex size-12 shrink-0 items-center justify-center transition-colors", active ? "bg-brand text-ink" : "bg-white/5 text-white group-hover:bg-brand group-hover:text-ink")}>
                      <Icon className="size-6" strokeWidth={1.75} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-base font-black sm:text-lg">{methods[m].title}</span>
                      <span className="mt-1 block text-sm text-white/60">{methodBodies[m]}</span>
                    </span>
                    {active ? (
                      <span className="shrink-0 bg-brand px-2 py-0.5 text-xs font-bold text-ink">انتخاب فعلی</span>
                    ) : (
                      <ArrowLeft className="size-5 shrink-0 text-white/40 transition-transform group-hover:-translate-x-1 group-hover:text-white" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && method && (
        <section className="mt-8" aria-labelledby="s1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <StepIcon icon={methodIcons[method]} />
              <div>
                <h1 id="s1" className="text-2xl font-black sm:text-3xl">{methods[method].title}</h1>
                <p className="mt-2 text-white/65">
                  {method === "link"
                    ? "لینک صفحه‌ی کالا رو بذار؛ اطلاعات کالا رو خودمون از سایت می‌خونیم."
                    : method === "photo"
                      ? "عکس، اسکرین‌شات یا پیش‌فاکتور بذار، یا اسم و مشخصات کالا رو بنویس."
                      : "بگو چه باری داری و از کجا باید بیاد."}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => goto(0)} className={cn(btn.secondary, "h-9 px-3 text-xs")}>
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
              className="chamfer mt-4 flex w-full items-center justify-center gap-2 bg-white/[0.04] py-4 text-sm font-bold text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Plus className="size-4" /> یه کالای دیگه هم اضافه کن
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

      {step === 2 && method && !otpSentTo && (
        <section className="mt-8" aria-labelledby="s2">
          <div className="flex items-start gap-3">
            <StepIcon icon={UserRound} />
            <div>
              <h1 id="s2" className="text-2xl font-black sm:text-3xl">اطلاعات تماس</h1>
              <p className="mt-2 text-white/65">کارشناس سپکس با همین شماره باهات تماس می‌گیره.</p>
            </div>
          </div>

          <Summary method={method} items={items} onEdit={() => goto(1)} />

          <Frame className="mt-6" innerClassName="grid gap-5 sm:grid-cols-2">
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
                    className={cn("h-11 text-sm font-semibold transition-colors", contact.gender === v ? "bg-brand text-ink" : "bg-[#0d0d0d] text-white/70 hover:bg-white/5")}
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
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                aria-invalid={!!errors.phone}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="توضیحات (اختیاری)" htmlFor="note" hint="هر چیزی که کارشناس باید بدونه؛ مثلاً چه ساعتی برای تماس بهتره.">
                <Textarea id="note" rows={3} maxLength={1000} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} />
              </Field>
            </div>
          </Frame>

          <NavBar onBack={() => goto(1)} onNext={sendOtp} nextLabel="دریافت کد تأیید" busy={sending} />
          <p className="mt-3 text-center text-xs text-white/50">ثبت درخواست رایگانه و شماره‌ات فقط برای تماس کارشناس سپکس استفاده می‌شه.</p>
        </section>
      )}

      {step === 2 && method && otpSentTo && (
        <section className="mx-auto mt-10 max-w-md text-center" aria-labelledby="s3">
          <div className="flex justify-center">
            <StepIcon icon={ShieldCheck} />
          </div>
          <h1 id="s3" className="mt-5 text-2xl font-black sm:text-3xl">کد تأیید رو وارد کن</h1>
          <p className="mt-3 leading-7 text-white/65">
            یه کد {toFaDigits(otpLength)} رقمی به <span className="ltr font-bold text-white">{toFaDigits(otpSentTo)}</span> پیامک کردیم.
          </p>
          <Frame tone="brand" className="mt-7" innerClassName="flex flex-col items-center gap-4">
            <label htmlFor="otp" className="sr-only">کد تأیید</label>
            <InputOTP
              id="otp"
              maxLength={otpLength}
              value={otp}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="^[0-9۰-۹]*$"
              disabled={submitting}
              onChange={(v) => {
                const clean = toEnDigits(v);
                setOtp(clean);
                setErrors({});
                if (clean.length === otpLength) void submit(clean);
              }}
            >
              <InputOTPGroup dir="ltr">
                {Array.from({ length: otpLength }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className={cn("size-12 rounded-none border-white/25 bg-[#0d0d0d] text-lg font-black", errors.otp && "border-destructive")} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {errors.otp && <p className="text-sm font-semibold text-destructive" role="alert">{errors.otp}</p>}
            <button type="button" onClick={() => submit()} disabled={submitting || otp.length !== otpLength} className={cn(btn.primary, "w-full")}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              ثبت درخواست
            </button>
          </Frame>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button type="button" disabled={resendIn > 0 || sending} onClick={sendOtp} className={cn(btn.secondary, "h-10 px-4 text-xs")}>
              {sending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
              {resendIn > 0 ? `ارسال دوباره تا ${toFaDigits(resendIn)} ثانیه` : "ارسال دوباره‌ی کد"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpSentTo(null);
                setOtp("");
                setErrors({});
                requestAnimationFrame(() => document.getElementById("phone")?.focus());
              }}
              className={cn(btn.secondary, "h-10 px-4 text-xs")}
            >
              <Pencil className="size-3.5" /> ویرایش شماره یا اطلاعات
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ item card */

function StepIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <span className="chamfer-sm mt-0.5 flex size-11 shrink-0 items-center justify-center bg-brand text-ink sm:size-12" aria-hidden>
      <Icon className="size-5 sm:size-6" strokeWidth={2} />
    </span>
  );
}

type PreviewState = "idle" | "loading" | "ready" | "empty";

/** Reads the product behind a link (debounced) and stores it on the item. */
function useLinkPreview(item: Item, onChange: (p: Partial<Item>) => void): PreviewState {
  const url = extractUrl(item.url);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  });
  const fresh = !!url && item.previewFor === url;
  useEffect(() => {
    if (!url || fresh) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/link-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; preview?: ProductPreview | null } | null;
        change.current({ preview: data?.ok ? (data.preview ?? null) : null, previewFor: url });
      } catch {
        if (!ctrl.signal.aborted) change.current({ preview: null, previewFor: url });
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [url, fresh]);
  if (!url) return "idle";
  if (!fresh) return "loading";
  return item.preview ? "ready" : "empty";
}

function LinkField({ item, error, onChange }: { item: Item; error?: string; onChange: (p: Partial<Item>) => void }) {
  const k = item.key;
  const url = extractUrl(item.url);
  const store = url ? detectStore(url) : undefined;
  const state = useLinkPreview(item, onChange);
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after mount
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
  }, []);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange({ url: text.slice(0, 4000) });
    } catch {
      toast.error("دسترسی به کلیپ‌بورد نشد؛ لینک رو دستی بچسبون.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`url-${k}`} className="text-sm font-semibold">
          لینک کالا<span className="mr-1 text-destructive" aria-hidden>*</span>
        </label>
        {item.url ? (
          <button type="button" onClick={() => onChange({ url: "", preview: undefined, previewFor: undefined })} className="inline-flex items-center gap-1 text-xs font-semibold text-white/55 hover:text-white">
            <X className="size-3.5" /> پاک کردن
          </button>
        ) : canPaste ? (
          <button type="button" onClick={paste} className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:opacity-80">
            <ClipboardPaste className="size-3.5" /> چسباندن لینک
          </button>
        ) : null}
      </div>
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
        aria-invalid={!!error}
        aria-describedby={`url-${k}-status`}
      />
      <div id={`url-${k}-status`} aria-live="polite">
        {error ? (
          <p className="text-xs font-semibold leading-5 text-destructive">{error}</p>
        ) : state === "idle" ? (
          <p className="text-xs leading-5 text-white/55">آمازون، نون، ترندیول، ای‌بی یا هر فروشگاه خارجی دیگه. متن اشتراک‌گذاری اپ فروشگاه رو هم می‌تونی کامل بچسبونی.</p>
        ) : state === "loading" ? (
          <div className="chamfer-sm flex items-center gap-3 bg-white/[0.04] p-3">
            <span className="chamfer-sm size-14 shrink-0 animate-pulse bg-white/10" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-3/4 animate-pulse bg-white/10" />
              <span className="flex items-center gap-1.5 text-xs text-white/55">
                <Loader2 className="size-3.5 animate-spin" /> داریم اطلاعات کالا رو از {store ? (store.brand ?? store.latin) : "سایت"} می‌خونیم…
              </span>
            </span>
          </div>
        ) : state === "ready" && item.preview ? (
          <div className="chamfer-sm bg-white/[0.05] p-3">
            <ProductPreviewCard preview={item.preview} compact />
          </div>
        ) : (
          <p className="text-xs leading-5 text-white/55">
            <Check className="ml-1 inline size-3.5 text-brand" aria-hidden />
            لینک رسید{store ? ` (${store.brand ?? store.latin}، ${countryName(store.country)})` : ""}. اطلاعاتش از سایت خونده نشد، مشکلی نیست؛ کارشناس خودش بررسی می‌کنه.
          </p>
        )}
      </div>
    </div>
  );
}

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
  const k = item.key;
  return (
    <Frame as="fieldset">
      <legend className="sr-only">کالای {toFaDigits(index + 1)}</legend>
      <div className="mb-4 flex items-center justify-between">
        <span className="chamfer-sm inline-flex items-center gap-1.5 bg-brand px-2.5 py-1 text-xs font-bold text-ink">
          <Package className="size-3.5" aria-hidden />
          کالای {toFaDigits(index + 1)}
        </span>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs font-semibold text-white/55 hover:text-destructive">
            <Trash2 className="size-3.5" /> حذف
          </button>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        {method === "link" && (
          <div className="sm:col-span-2">
            <LinkField item={item} error={errors[`url-${k}`]} onChange={onChange} />
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
            hint={method === "photo" ? "اگه عکس گذاشتی، اختیاریه." : "مثلاً لوازم یدکی خودرو، پوشاک، قطعات الکترونیکی."}
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
          <QtyInput id={`qty-${k}`} value={item.quantity} invalid={!!errors[`qty-${k}`]} onChange={(quantity) => onChange({ quantity })} />
        </Field>

        {method === "shipping" && (
          <>
            <Field label="کشور مبدأ" htmlFor={`origin-${k}`}>
              <NativeSelect id={`origin-${k}`} value={item.originCountry} onChange={(e) => onChange({ originCountry: e.target.value })} className="rounded-none">
                <option value="">انتخاب کن</option>
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
              hint={method === "shipping" ? "فروشنده یا تأمین‌کننده، آدرس انبار مبدأ، باتری‌دار یا مایع بودن و…" : "مدل، رنگ، سایز یا هر جزئیات دیگه."}
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
    </Frame>
  );
}

/** Quantity with − / + so nobody has to open the keyboard for "2". */
function QtyInput({ id, value, invalid, onChange }: { id: string; value: string; invalid?: boolean; onChange: (v: string) => void }) {
  const n = Number(toEnDigits(value)) || 0;
  const set = (v: number) => onChange(String(Math.min(999, Math.max(1, v))));
  return (
    <div className={cn("flex h-11 items-stretch border border-input bg-[#0d0d0d]", invalid && "border-destructive")} dir="ltr">
      <button type="button" onClick={() => set(n - 1)} disabled={n <= 1} className="w-10 text-lg font-bold text-white/70 hover:bg-white/5 disabled:opacity-30" aria-label="کم کردن">
        −
      </button>
      <input
        id={id}
        inputMode="numeric"
        className="w-full min-w-0 bg-transparent text-center text-sm font-bold outline-none"
        value={value}
        onChange={(e) => onChange(toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 3))}
        aria-invalid={invalid}
      />
      <button type="button" onClick={() => set(n + 1)} className="w-10 text-lg font-bold text-white/70 hover:bg-white/5" aria-label="زیاد کردن">
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ footer nav, summary, done */

function NavBar({ onBack, onNext, nextLabel, busy }: { onBack: () => void; onNext: () => void; nextLabel: string; busy?: boolean; primary?: boolean }) {
  return (
    <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-8 flex gap-2 border-t border-white/10 bg-black/90 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <button type="button" onClick={onBack} className={btn.secondary}>
        <ArrowRight className="size-4" /> قبلی
      </button>
      <button type="button" onClick={onNext} disabled={busy} className={cn(btn.primary, "flex-1 text-base sm:flex-none sm:px-10")}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {nextLabel}
        {!busy && <ArrowLeft className="size-4" />}
      </button>
    </div>
  );
}

function Summary({ method, items, onEdit }: { method: Method; items: Item[]; onEdit: () => void }) {
  return (
    <Frame className="mt-6" innerClassName="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">
          {methods[method].title}، {toFaDigits(items.length)} کالا
        </p>
        <button type="button" onClick={onEdit} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/60 hover:text-white">
          <Pencil className="size-3.5" /> ویرایش
        </button>
      </div>
      <ul className="mt-3 space-y-3">
        {items.slice(0, 4).map((it) => {
          const url = extractUrl(it.url);
          const qty = toFaDigits(it.quantity || "1");
          if (it.preview && it.previewFor === url) {
            return (
              <li key={it.key}>
                <ProductPreviewCard preview={it.preview} quantity={qty} note={it.description || null} compact />
              </li>
            );
          }
          const store = url ? detectStore(url) : undefined;
          const label = it.title || (url ? (store ? (store.brand ?? store.latin) : hostOf(url)) : it.files.length ? `${toFaDigits(it.files.length)} فایل` : "کالا");
          return (
            <li key={it.key} className="flex items-center justify-between gap-3 text-sm text-white/75">
              <span dir="auto" className="truncate">{label}</span>
              <span className="shrink-0 text-xs text-white/55">تعداد: {qty}</span>
            </li>
          );
        })}
        {items.length > 4 && <li className="text-xs text-white/55">و {toFaDigits(items.length - 4)} کالای دیگه</li>}
      </ul>
    </Frame>
  );
}

function Done({ code, onNew }: { code: string; onNew: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="text-center" aria-labelledby="done-title">
      <div className="chamfer mx-auto flex size-16 items-center justify-center bg-brand">
        <Check className="size-8 text-ink" strokeWidth={3} />
      </div>
      <h1 id="done-title" className="mt-6 text-2xl font-black sm:text-3xl">درخواستت ثبت شد!</h1>
      <p className="mx-auto mt-3 max-w-md leading-8 text-white/65">کارشناس سپکس به‌زودی باهات تماس می‌گیره. کد پیگیری هم برات پیامک می‌شه.</p>
      <Frame tone="brand" className="mx-auto mt-8 max-w-sm" innerClassName="p-5">
        <p className="text-sm text-white/60">کد پیگیری</p>
        <p dir="ltr" className="mt-1 text-4xl font-black tracking-wider">{code}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error("کپی نشد؛ کد رو یادداشت کن.");
            }
          }}
          className={cn(btn.secondary, "mt-4 h-10 px-4")}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "کپی شد" : "کپی کد"}
        </button>
      </Frame>
      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-2">
        <Link href={`/track?code=${encodeURIComponent(code)}`} className={btn.primary}>
          پیگیری درخواست
        </Link>
        <button type="button" onClick={onNew} className={btn.secondary}>
          ثبت یه درخواست دیگه
        </button>
        <Link href="/" className={cn(btn.secondary, "bg-transparent text-white/60 hover:bg-white/[0.06] hover:text-white")}>برگشت به صفحه‌ی اصلی</Link>
      </div>
    </section>
  );
}
