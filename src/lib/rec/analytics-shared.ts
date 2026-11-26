/** Labels and classifiers shared by server reports and client views. Client-safe. */

/* ------------------------------------------------------------------ channels (GA4-style default grouping) */

export function channelOf(r: { utm_source: string | null; utm_medium: string | null; referrer: string | null }): string {
  const src = (r.utm_source ?? "").toLowerCase();
  const med = (r.utm_medium ?? "").toLowerCase();
  if (src || med) {
    if (/sms/.test(src) || /sms/.test(med)) return "پیامک";
    if (/^(cpc|ppc|paid|paidsearch)$/.test(med) && /google|bing|yandex/.test(src)) return "جستجوی پولی";
    if (/display|banner|cpm|native|interstitial/.test(med) || /yektanet|tapsell|adivery|mediaad|sabavision/.test(src)) return "تبلیغات نمایشی";
    if (/social|sm/.test(med) || /instagram|telegram|facebook|twitter|x\.com|linkedin|aparat|rubika|bale|eitaa/.test(src)) return "شبکه‌های اجتماعی";
    if (/email|newsletter/.test(med)) return "ایمیل";
    if (/cpc|ppc|paid/.test(med)) return "تبلیغات پولی";
    if (/referral|site|internal/.test(med) || /sepex/.test(src)) return "ارجاع";
    return "کمپین‌های دیگر";
  }
  if (r.referrer) {
    try {
      const h = new URL(r.referrer).hostname;
      if (/google\.|bing\.|yandex\.|duckduckgo\.|yahoo\./.test(h)) return "جستجوی ارگانیک";
      if (/instagram|t\.me|telegram|facebook|twitter|x\.com|linkedin|aparat/.test(h)) return "شبکه‌های اجتماعی";
      if (h === "black.sepex.net") return "مستقیم";
      return "ارجاع";
    } catch {}
  }
  return "مستقیم";
}

export const EVENT_LABELS: Record<string, string> = {
  cta_order: "کلیک روی دکمه‌ی سفارش",
  cta_track: "کلیک روی پیگیری سفارش",
  contact_whatsapp: "تماس از واتس‌اپ",
  contact_phone: "تماس تلفنی",
  contact_telegram: "تماس از تلگرام",
  contact_bale: "تماس از بله",
  contact_email: "ایمیل",
  social_instagram: "رفتن به اینستاگرام",
  outbound: "لینک بیرونی (فروشگاه‌ها و…)",
  store_filter: "فیلتر فروشگاه‌ها (دسته یا کشور)",
  hero_name: "نوشتن اسم کالا به جای لینک (بالای صفحه)",
  expand: "باز کردن بخش‌های جمع‌شده (سؤال‌ها…)",
  form_step: "رسیدن به مرحله‌ی فرم سفارش",
  form_error: "خطای اعتبارسنجی فرم",
  method_select: "انتخاب روش سفارش",
  otp_request: "درخواست کد تأیید",
  order_submit: "ارسال نهایی سفارش",
};

export const FIELD_LABELS: Record<string, string> = {
  url: "لینک کالا",
  title: "نام / نوع کالا",
  qty: "تعداد",
  quantity: "تعداد",
  description: "توضیحات کالا",
  origin: "کشور مبدأ",
  weight: "وزن یا حجم",
  firstName: "نام",
  lastName: "نام خانوادگی",
  phone: "موبایل",
  note: "توضیحات سفارش",
  otp: "کد تأیید",
  "hero-link": "لینک کالا در صفحه‌ی اصلی",
  gender: "جنسیت",
};

export const VITALS = {
  LCP: { label: "بارگذاری محتوای اصلی (LCP)", good: 2500, poor: 4000, unit: "ms" },
  INP: { label: "سرعت واکنش به کلیک (INP)", good: 200, poor: 500, unit: "ms" },
  CLS: { label: "جابه‌جایی ناگهانی صفحه (CLS)", good: 0.1, poor: 0.25, unit: "" },
  FCP: { label: "اولین نمایش محتوا (FCP)", good: 1800, poor: 3000, unit: "ms" },
  TTFB: { label: "پاسخ سرور (TTFB)", good: 800, poor: 1800, unit: "ms" },
} as const;
export type VitalName = keyof typeof VITALS;

export const API_LABELS: Record<string, string> = {
  "/api/otp/send": "ارسال کد تأیید",
  "/api/requests": "ثبت سفارش",
  "/api/link-preview": "پیش‌نمایش لینک کالا",
  "/api/uploads": "آپلود عکس",
  "/api/track": "پیگیری سفارش",
};


/** Order-form steps and methods, as they appear in event properties. */
export const STEP_LABELS: Record<string, string> = {
  method: "انتخاب روش",
  items: "مشخصات کالا",
  contact: "اطلاعات تماس",
  otp: "کد تأیید",
  done: "ثبت شد",
};
export const METHOD_LABELS: Record<string, string> = {
  link: "لینک کالا",
  photo: "عکس یا نام کالا",
  shipping: "حمل و ترخیص",
  form: "فرم سایت سپکس",
};

/** One-line, human summary of an event's properties. */
export function eventDetail(name: string, props: Record<string, unknown> | string | null | undefined): string {
  let p: Record<string, unknown> = {};
  if (typeof props === "string") {
    try {
      p = JSON.parse(props) ?? {};
    } catch {}
  } else if (props) p = props;
  const v = (k: string) => (p[k] == null ? "" : String(p[k]));
  const fields = () =>
    v("fields")
      .split(",")
      .filter(Boolean)
      .map((f) => FIELD_LABELS[f] ?? f)
      .join("، ");
  switch (name) {
    case "form_step":
      return STEP_LABELS[v("step")] ?? v("step");
    case "method_select":
      return METHOD_LABELS[v("method")] ?? v("method");
    case "form_error":
      return `${STEP_LABELS[v("step")] ?? v("step")}: ${fields()}`;
    case "otp_request":
    case "order_submit":
      return p.ok === true || p.ok === "true" ? "موفق" : `ناموفق${v("status") ? ` (${v("status")})` : ""}${v("reason") ? ` ${v("reason")}` : ""}`;
    case "outbound":
      return v("host") || v("label");
    case "store_filter":
      return [v("cat"), v("country")].filter(Boolean).join("، ");
    default:
      return v("label") || v("section");
  }
}

/** A single property value, in Persian where we know it. */
export function propLabel(prop: string, value: unknown): string {
  const v = value == null ? "—" : String(value);
  if (prop === "step") return STEP_LABELS[v] ?? v;
  if (prop === "method") return METHOD_LABELS[v] ?? v;
  if (prop === "ok") return v === "1" || v === "true" ? "موفق" : v === "0" || v === "false" ? "ناموفق" : v;
  if (prop === "fields")
    return v
      .split(",")
      .filter(Boolean)
      .map((f) => FIELD_LABELS[f] ?? f)
      .join("، ");
  return v;
}
