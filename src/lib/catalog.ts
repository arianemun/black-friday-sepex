/**
 * Countries and stores SEPEX covers. Order = business priority:
 * China and UAE first, then Europe, USA and Turkey.
 * This file is shared by the server and the client: keep it dependency-free.
 */

export type CountryCode = "CN" | "AE" | "EU" | "US" | "TR" | "OTHER";

export const countries: { code: CountryCode; name: string; tagline: string }[] = [
  { code: "CN", name: "چین", tagline: "تائوبائو، ۱۶۸۸، علی‌بابا، علی‌اکسپرس و…" },
  { code: "AE", name: "امارات", tagline: "آمازون امارات، نون و فروشگاه‌های دبی" },
  { code: "EU", name: "اروپا", tagline: "آمازون آلمان و انگلیس، زالاندو و…" },
  { code: "US", name: "آمریکا", tagline: "آمازون آمریکا، ای‌بی، والمارت و…" },
  { code: "TR", name: "ترکیه", tagline: "ترندیول، هپسی‌بورادا و…" },
];

export const countryName = (code?: string | null) =>
  countries.find((c) => c.code === code)?.name ?? (code === "OTHER" ? "سایر کشورها" : "نامشخص");

export type Store = {
  key: string;
  name: string; // Persian
  latin: string; // Latin wordmark text (rendered as plain text, not a logo)
  url: string;
  country: CountryCode;
  domains: string[]; // host suffixes used for detection
  featured?: boolean;
  short?: string; // short Persian name for tight places (hero tags)
  hint?: string; // what people usually buy there
};

export const stores: Store[] = [
  // China
  { key: "taobao", name: "تائوبائو", latin: "Taobao", url: "https://www.taobao.com", country: "CN", domains: ["taobao.com", "tb.cn"], featured: true, short: "تائوبائو", hint: "همه‌چیز با قیمت داخلی چین" },
  { key: "1688", name: "۱۶۸۸", latin: "1688", url: "https://www.1688.com", country: "CN", domains: ["1688.com"], featured: true, short: "۱۶۸۸", hint: "عمده و مستقیم از کارخانه" },
  { key: "alibaba", name: "علی‌بابا", latin: "Alibaba", url: "https://www.alibaba.com", country: "CN", domains: ["alibaba.com"], featured: true, short: "علی‌بابا", hint: "تأمین‌کننده و سفارش عمده" },
  { key: "aliexpress", name: "علی‌اکسپرس", latin: "AliExpress", url: "https://www.aliexpress.com", country: "CN", domains: ["aliexpress.com", "aliexpress.ru", "aliexpress.us"], featured: true, short: "علی‌اکسپرس", hint: "خرده و تک‌عدد از چین" },
  { key: "tmall", name: "تی‌مال", latin: "Tmall", url: "https://www.tmall.com", country: "CN", domains: ["tmall.com"] },
  { key: "jd", name: "جی‌دی", latin: "JD.com", url: "https://www.jd.com", country: "CN", domains: ["jd.com"] },
  { key: "temu", name: "تمو", latin: "Temu", url: "https://www.temu.com", country: "CN", domains: ["temu.com"], short: "تمو", hint: "لوازم خانه و گجت" },
  { key: "shein", name: "شین", latin: "SHEIN", url: "https://www.shein.com", country: "CN", domains: ["shein.com"], short: "شین", hint: "مد و پوشاک ارزان" },
  // UAE
  { key: "amazon-ae", name: "آمازون امارات", latin: "amazon.ae", url: "https://www.amazon.ae", country: "AE", domains: ["amazon.ae"], featured: true, short: "آمازون", hint: "دیجیتال، خانه و برندها" },
  { key: "noon", name: "نون", latin: "noon", url: "https://www.noon.com/uae-en/", country: "AE", domains: ["noon.com"], featured: true, short: "نون", hint: "دیجیتال، عطر و مد" },
  { key: "namshi", name: "نمشی", latin: "Namshi", url: "https://www.namshi.com", country: "AE", domains: ["namshi.com"], short: "نمشی", hint: "مد و کفش برند" },
  { key: "sharafdg", name: "شرف دی‌جی", latin: "Sharaf DG", url: "https://uae.sharafdg.com", country: "AE", domains: ["sharafdg.com"], short: "شرف دی‌جی", hint: "لوازم الکترونیکی" },
  // Europe
  { key: "amazon-de", name: "آمازون آلمان", latin: "amazon.de", url: "https://www.amazon.de", country: "EU", domains: ["amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.nl"], short: "آمازون آلمان", hint: "برندهای اروپایی و ابزار" },
  { key: "amazon-uk", name: "آمازون انگلیس", latin: "amazon.co.uk", url: "https://www.amazon.co.uk", country: "EU", domains: ["amazon.co.uk"] },
  { key: "zalando", name: "زالاندو", latin: "Zalando", url: "https://www.zalando.de", country: "EU", domains: ["zalando.de", "zalando.com", "zalando.co.uk"], short: "زالاندو", hint: "مد و کفش اروپایی" },
  { key: "asos", name: "ایسوس (ASOS)", latin: "ASOS", url: "https://www.asos.com", country: "EU", domains: ["asos.com"] },
  // USA
  { key: "amazon-us", name: "آمازون آمریکا", latin: "amazon.com", url: "https://www.amazon.com", country: "US", domains: ["amazon.com", "amzn.to", "a.co"], short: "آمازون آمریکا", hint: "برندهای آمریکایی" },
  { key: "ebay", name: "ای‌بی", latin: "eBay", url: "https://www.ebay.com", country: "US", domains: ["ebay.com", "ebay.de", "ebay.co.uk"], short: "ای‌بی", hint: "قطعات، کلکسیون و دست‌دوم" },
  { key: "walmart", name: "والمارت", latin: "Walmart", url: "https://www.walmart.com", country: "US", domains: ["walmart.com"], short: "والمارت", hint: "خانه، آشپزخانه و مصرفی" },
  { key: "bestbuy", name: "بست‌بای", latin: "Best Buy", url: "https://www.bestbuy.com", country: "US", domains: ["bestbuy.com"], short: "بست‌بای", hint: "لپ‌تاپ، کنسول و دیجیتال" },
  // Turkey
  { key: "trendyol", name: "ترندیول", latin: "Trendyol", url: "https://www.trendyol.com", country: "TR", domains: ["trendyol.com", "ty.gl"], short: "ترندیول", hint: "پوشاک و خانه ترکیه" },
  { key: "hepsiburada", name: "هپسی‌بورادا", latin: "Hepsiburada", url: "https://www.hepsiburada.com", country: "TR", domains: ["hepsiburada.com"], short: "هپسی‌بورادا", hint: "فروشگاه همه‌چیز ترکیه" },
  { key: "amazon-tr", name: "آمازون ترکیه", latin: "amazon.com.tr", url: "https://www.amazon.com.tr", country: "TR", domains: ["amazon.com.tr"] },
];

export const storeByKey = (key?: string | null) => stores.find((s) => s.key === key);

/** Detects the store from a URL host (longest matching suffix wins). */
export function detectStore(rawUrl: string): Store | undefined {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
  let best: { store: Store; len: number } | undefined;
  for (const store of stores) {
    for (const d of store.domains) {
      if (host === d || host.endsWith("." + d)) {
        if (!best || d.length > best.len) best = { store, len: d.length };
      }
    }
  }
  return best?.store;
}

/** Extracts the first http(s) URL from pasted text (share messages often wrap the link). */
export function extractUrl(text: string): string | null {
  const m = String(text || "").match(/https?:\/\/[^\s<>"'،]+/i);
  if (!m) return null;
  return m[0].replace(/[).,;!?]+$/, "");
}

export const categories: { key: string; name: string }[] = [
  { key: "digital", name: "دیجیتال" },
  { key: "fashion", name: "مد و پوشاک" },
  { key: "home", name: "خانه و آشپزخانه" },
  { key: "beauty", name: "زیبایی و سلامت" },
  { key: "sport", name: "ورزش و سفر" },
  { key: "kids", name: "کودک و اسباب‌بازی" },
  { key: "tools", name: "ابزار و خودرو" },
  { key: "other", name: "سایر" },
];

export const categoryName = (key?: string | null) => categories.find((c) => c.key === key)?.name ?? "سایر";

export const methods = {
  link: { title: "خرید با لینک کالا", short: "لینک کالا" },
  photo: { title: "خرید با عکس یا نام کالا", short: "عکس یا نام کالا" },
  shipping: { title: "فقط حمل و ترخیص", short: "حمل و ترخیص" },
} as const;
export type Method = keyof typeof methods;

export const statuses: { key: string; name: string; tone: "brand" | "info" | "warning" | "success" | "destructive" | "secondary" }[] = [
  { key: "new", name: "ثبت شده", tone: "brand" },
  { key: "reviewing", name: "در حال بررسی", tone: "info" },
  { key: "contacted", name: "تماس گرفته شد", tone: "info" },
  { key: "quoted", name: "قیمت اعلام شد", tone: "warning" },
  { key: "ordered", name: "سفارش قطعی شد", tone: "success" },
  { key: "closed", name: "بسته شد", tone: "secondary" },
  { key: "cancelled", name: "لغو شد", tone: "destructive" },
];
export const statusInfo = (key: string) => statuses.find((s) => s.key === key) ?? statuses[0];
