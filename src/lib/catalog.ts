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

/** What a store is good for (the filter on the landing). */
export const storeCats = [
  { key: "all", name: "فروشگاه‌های بزرگ" },
  { key: "fashion", name: "پوشاک و کفش" },
  { key: "sport", name: "ورزشی" },
  { key: "digital", name: "دیجیتال" },
  { key: "beauty", name: "زیبایی و عطر" },
  { key: "home", name: "خانه و آشپزخانه" },
  { key: "kids", name: "کودک" },
  { key: "luxury", name: "لوکس" },
] as const;
export type StoreCat = (typeof storeCats)[number]["key"];

/** A Black Friday sale confirmed for this year. Hidden after `until` (Tehran date, inclusive). */
export type StoreDeal = { min?: number; max: number; until: string };

export type Store = {
  key: string;
  name: string; // Persian
  latin: string; // Latin wordmark text (rendered as plain text, not a logo)
  url: string;
  country: CountryCode;
  domains: string[]; // host suffixes used for detection
  /** Only links under these paths belong to this store (brands sharing a global domain, e.g. apple.com/ae). */
  paths?: string[];
  featured?: boolean;
  short?: string; // short Persian name for tight places
  brand?: string; // English display name when `latin` is a domain
  hint?: string; // what people usually buy there
  cats?: StoreCat[];
  /** The brand's own store, not a multi-brand shop. */
  official?: boolean;
  /** false: still recognised in links, but not suggested (hard to buy from for our customers). */
  suggest?: boolean;
  deal?: StoreDeal;
};

export const stores: Store[] = [
  // ---- China
  { key: "taobao", name: "تائوبائو", latin: "Taobao", url: "https://www.taobao.com", country: "CN", domains: ["taobao.com", "tb.cn"], featured: true, short: "تائوبائو", hint: "همه‌چیز با قیمت داخلی چین", cats: ["all", "fashion", "home"] },
  { key: "1688", name: "۱۶۸۸", latin: "1688", url: "https://www.1688.com", country: "CN", domains: ["1688.com"], featured: true, short: "۱۶۸۸", hint: "عمده و مستقیم از کارخانه", cats: ["all"] },
  { key: "alibaba", name: "علی‌بابا", latin: "Alibaba", url: "https://www.alibaba.com", country: "CN", domains: ["alibaba.com"], featured: true, short: "علی‌بابا", hint: "تأمین‌کننده و سفارش عمده", cats: ["all"] },
  { key: "aliexpress", name: "علی‌اکسپرس", latin: "AliExpress", url: "https://www.aliexpress.com", country: "CN", domains: ["aliexpress.com", "aliexpress.ru", "aliexpress.us"], featured: true, short: "علی‌اکسپرس", hint: "خرده و تک‌عدد از چین", cats: ["all", "digital"] },
  { key: "tmall", name: "تی‌مال", latin: "Tmall", url: "https://www.tmall.com", country: "CN", domains: ["tmall.com"], hint: "برندهای رسمی در چین", cats: ["all", "digital"] },
  { key: "jd", name: "جی‌دی", latin: "JD.com", url: "https://www.jd.com", country: "CN", domains: ["jd.com"], brand: "JD", hint: "دیجیتال و لوازم برقی چین", cats: ["digital"] },
  { key: "temu", name: "تمو", latin: "Temu", url: "https://www.temu.com", country: "CN", domains: ["temu.com"], short: "تمو", hint: "لوازم خانه و گجت", cats: ["home", "all"] },
  { key: "shein", name: "شین", latin: "SHEIN", url: "https://www.shein.com", country: "CN", domains: ["shein.com"], short: "شین", hint: "مد و پوشاک ارزان", cats: ["fashion"] },

  // ---- UAE: marketplaces and shops
  { key: "amazon-ae", name: "آمازون امارات", latin: "amazon.ae", url: "https://www.amazon.ae", country: "AE", domains: ["amazon.ae"], featured: true, short: "آمازون", hint: "دیجیتال، خانه و برندها", brand: "Amazon UAE", cats: ["all", "digital", "home"], deal: { max: 60, until: "2026-11-30" } },
  { key: "noon", name: "نون", latin: "noon", url: "https://www.noon.com/uae-en/", country: "AE", domains: ["noon.com"], featured: true, short: "نون", hint: "دیجیتال، عطر و مد", cats: ["all", "digital", "beauty", "fashion"], deal: { max: 80, until: "2026-11-30" } },
  { key: "namshi", name: "نمشی", latin: "Namshi", url: "https://www.namshi.com/uae-en/", country: "AE", domains: ["namshi.com"], short: "نمشی", hint: "مد، کفش و برندهای ورزشی", cats: ["fashion", "sport", "beauty"] },
  { key: "6thstreet", name: "سیکس‌استریت", latin: "6thStreet", url: "https://en-ae.6thstreet.com", country: "AE", domains: ["6thstreet.com"], short: "سیکس‌استریت", hint: "کفش و پوشاک برند", cats: ["fashion", "sport", "kids"] },
  { key: "styli", name: "استایلی", latin: "Styli", url: "https://stylishop.com/ae/en", country: "AE", domains: ["stylishop.com"], short: "استایلی", hint: "مد روز با قیمت مناسب", cats: ["fashion"] },
  { key: "brandsforless", name: "برندز فور لس", latin: "Brands For Less", url: "https://www.brandsforless.com/en-ae/", country: "AE", domains: ["brandsforless.com"], short: "برندز فور لس", hint: "برندهای معروف، حراجی همیشگی", cats: ["fashion", "kids"] },
  { key: "maxfashion", name: "مکس", latin: "Max", url: "https://www.maxfashion.com/ae/en/", country: "AE", domains: ["maxfashion.com"], short: "مکس", hint: "پوشاک خانواده و کودک", cats: ["fashion", "kids"] },
  { key: "centrepoint", name: "سنترپوینت", latin: "Centrepoint", url: "https://www.centrepointstores.com/ae/en/", country: "AE", domains: ["centrepointstores.com"], short: "سنترپوینت", hint: "کفش، پوشاک و کودک", cats: ["fashion", "kids", "beauty"] },
  { key: "ounass", name: "اوناس", latin: "Ounass", url: "https://www.ounass.ae", country: "AE", domains: ["ounass.ae"], short: "اوناس", hint: "برندهای لوکس و طراحان", cats: ["luxury", "fashion", "beauty"] },
  { key: "levelshoes", name: "لول شوز", latin: "Level Shoes", url: "https://www.levelshoes.com", country: "AE", domains: ["levelshoes.com"], short: "لول شوز", hint: "کفش و کیف لوکس", cats: ["luxury", "fashion"] },
  { key: "sssports", name: "سان اند سند اسپورتس", latin: "Sun & Sand Sports", url: "https://en-ae.sssports.com", country: "AE", domains: ["sssports.com"], short: "سان اند سند", hint: "نایک، آدیداس، نیوبالانس و…", cats: ["sport", "fashion"], deal: { min: 50, max: 70, until: "2026-11-29" } },
  { key: "sephora-ae", name: "سفورا", latin: "Sephora", url: "https://www.sephora.ae", country: "AE", domains: ["sephora.ae"], short: "سفورا", hint: "آرایشی، مراقبت پوست و عطر", cats: ["beauty"] },
  { key: "sharafdg", name: "شرف دی‌جی", latin: "Sharaf DG", url: "https://uae.sharafdg.com", country: "AE", domains: ["sharafdg.com"], short: "شرف دی‌جی", hint: "لوازم الکترونیکی", cats: ["digital"] },
  { key: "jumbo", name: "جامبو", latin: "Jumbo", url: "https://www.jumbo.ae", country: "AE", domains: ["jumbo.ae"], short: "جامبو", hint: "موبایل، لپ‌تاپ و صوتی", cats: ["digital"] },
  { key: "virginmegastore", name: "ویرجین مگااستور", latin: "Virgin Megastore", url: "https://www.virginmegastore.ae", country: "AE", domains: ["virginmegastore.ae"], short: "ویرجین", hint: "گیمینگ، گجت و سرگرمی", cats: ["digital", "kids"] },
  { key: "homecentre", name: "هوم سنتر", latin: "Home Centre", url: "https://www.homecentre.com/ae/en/", country: "AE", domains: ["homecentre.com"], short: "هوم سنتر", hint: "مبلمان و دکوراسیون", cats: ["home"] },
  { key: "mumzworld", name: "مامزورلد", latin: "Mumzworld", url: "https://www.mumzworld.com", country: "AE", domains: ["mumzworld.com"], short: "مامزورلد", hint: "مادر، نوزاد و اسباب‌بازی", cats: ["kids"] },
  // ---- UAE: official brand stores
  { key: "nike-ae", name: "نایکی", latin: "Nike", url: "https://www.nike.ae", country: "AE", domains: ["nike.ae"], short: "نایکی", hint: "کفش و لباس ورزشی", cats: ["sport", "fashion"], official: true },
  { key: "adidas-ae", name: "آدیداس", latin: "adidas", url: "https://www.adidas.ae", country: "AE", domains: ["adidas.ae"], short: "آدیداس", hint: "کفش، لباس و تجهیزات ورزشی", cats: ["sport", "fashion"], official: true },
  { key: "puma-ae", name: "پوما", latin: "PUMA", url: "https://ae.puma.com", country: "AE", domains: ["ae.puma.com"], short: "پوما", hint: "کفش و پوشاک ورزشی", cats: ["sport", "fashion"], official: true },
  { key: "zara-ae", name: "زارا", latin: "ZARA", url: "https://www.zara.com/ae/", country: "AE", domains: ["zara.com"], paths: ["/ae"], short: "زارا", hint: "مد روز زنانه و مردانه", cats: ["fashion"], official: true },
  { key: "hm-ae", name: "اچ‌اند‌ام", latin: "H&M", url: "https://ae.hm.com", country: "AE", domains: ["ae.hm.com"], short: "اچ‌اند‌ام", hint: "پوشاک روزمره و کودک", cats: ["fashion", "kids"], official: true },
  { key: "apple-ae", name: "اپل", latin: "Apple", url: "https://www.apple.com/ae/", country: "AE", domains: ["apple.com"], paths: ["/ae"], short: "اپل", hint: "آیفون، مک و ایرپاد", cats: ["digital"], official: true },
  { key: "samsung-ae", name: "سامسونگ", latin: "Samsung", url: "https://www.samsung.com/ae/", country: "AE", domains: ["samsung.com"], paths: ["/ae"], short: "سامسونگ", hint: "گوشی، تلویزیون و لوازم خانگی", cats: ["digital", "home"], official: true },
  { key: "dyson-ae", name: "دایسون", latin: "Dyson", url: "https://www.dyson.ae", country: "AE", domains: ["dyson.ae"], short: "دایسون", hint: "سشوار، جاروشارژی و تصفیه هوا", cats: ["home", "beauty", "digital"], official: true },
  { key: "ikea-ae", name: "ایکیا", latin: "IKEA", url: "https://www.ikea.com/ae/en/", country: "AE", domains: ["ikea.com"], paths: ["/ae"], short: "ایکیا", hint: "مبلمان و لوازم خانه", cats: ["home"], official: true },

  // ---- Europe
  { key: "amazon-de", name: "آمازون آلمان", latin: "amazon.de", url: "https://www.amazon.de", country: "EU", domains: ["amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.nl"], short: "آمازون آلمان", hint: "برندهای اروپایی و ابزار", brand: "Amazon DE", cats: ["all", "digital", "home"] },
  { key: "amazon-uk", name: "آمازون انگلیس", latin: "amazon.co.uk", url: "https://www.amazon.co.uk", country: "EU", domains: ["amazon.co.uk"], brand: "Amazon UK", hint: "برندهای انگلیسی و کتاب", cats: ["all", "digital"] },
  { key: "zalando", name: "زالاندو", latin: "Zalando", url: "https://www.zalando.de", country: "EU", domains: ["zalando.de", "zalando.com", "zalando.co.uk"], short: "زالاندو", hint: "مد و کفش اروپایی", cats: ["fashion", "sport"] },
  { key: "asos", name: "ایسوس (ASOS)", latin: "ASOS", url: "https://www.asos.com", country: "EU", domains: ["asos.com"], short: "ASOS", hint: "مد جوان و برندهای انگلیسی", cats: ["fashion"] },
  { key: "aboutyou", name: "اَبات یو", latin: "ABOUT YOU", url: "https://www.aboutyou.de", country: "EU", domains: ["aboutyou.de", "aboutyou.com"], short: "اَبات یو", hint: "پوشاک و کفش برند", cats: ["fashion"] },
  { key: "farfetch", name: "فارفچ", latin: "Farfetch", url: "https://www.farfetch.com", country: "EU", domains: ["farfetch.com"], short: "فارفچ", hint: "بوتیک‌های لوکس دنیا", cats: ["luxury", "fashion"] },
  { key: "mytheresa", name: "مای‌ترزا", latin: "Mytheresa", url: "https://www.mytheresa.com", country: "EU", domains: ["mytheresa.com"], short: "مای‌ترزا", hint: "مد لوکس زنانه و مردانه", cats: ["luxury", "fashion"] },
  { key: "notino", name: "نوتینو", latin: "Notino", url: "https://www.notino.de", country: "EU", domains: ["notino.de", "notino.com", "notino.co.uk"], short: "نوتینو", hint: "عطر و آرایشی اروپا", cats: ["beauty"] },
  { key: "douglas", name: "داگلاس", latin: "Douglas", url: "https://www.douglas.de", country: "EU", domains: ["douglas.de"], short: "داگلاس", hint: "عطر و مراقبت پوست", cats: ["beauty"] },

  // ---- Turkey
  { key: "trendyol", name: "ترندیول", latin: "Trendyol", url: "https://www.trendyol.com", country: "TR", domains: ["trendyol.com", "ty.gl"], short: "ترندیول", hint: "پوشاک و خانه ترکیه", cats: ["all", "fashion", "home"], deal: { max: 70, until: "2026-12-02" } },
  { key: "hepsiburada", name: "هپسی‌بورادا", latin: "Hepsiburada", url: "https://www.hepsiburada.com", country: "TR", domains: ["hepsiburada.com"], short: "هپسی‌بورادا", hint: "فروشگاه همه‌چیز ترکیه", cats: ["all", "digital", "home"] },
  { key: "amazon-tr", name: "آمازون ترکیه", latin: "amazon.com.tr", url: "https://www.amazon.com.tr", country: "TR", domains: ["amazon.com.tr"], brand: "Amazon TR", hint: "دیجیتال و خانه ترکیه", cats: ["all", "digital"] },
  { key: "n11", name: "ان‌یازده", latin: "n11", url: "https://www.n11.com", country: "TR", domains: ["n11.com"], short: "n11", hint: "بازار آنلاین ترکیه", cats: ["all"] },
  { key: "lcwaikiki", name: "ال‌سی وایکیکی", latin: "LC Waikiki", url: "https://www.lcw.com", country: "TR", domains: ["lcw.com", "lcwaikiki.com"], short: "ال‌سی وایکیکی", hint: "پوشاک خانواده و کودک", cats: ["fashion", "kids"], official: true },
  { key: "defacto", name: "دیفکتو", latin: "DeFacto", url: "https://www.defacto.com.tr", country: "TR", domains: ["defacto.com.tr", "defacto.com"], short: "دیفکتو", hint: "پوشاک روزمره", cats: ["fashion", "kids"], official: true },
  { key: "koton", name: "کوتون", latin: "Koton", url: "https://www.koton.com", country: "TR", domains: ["koton.com"], short: "کوتون", hint: "مد زنانه و مردانه", cats: ["fashion"], official: true },
  { key: "mavi", name: "ماوی", latin: "Mavi", url: "https://www.mavi.com", country: "TR", domains: ["mavi.com"], short: "ماوی", hint: "جین و پوشاک", cats: ["fashion"], official: true },
  { key: "boyner", name: "بوینر", latin: "Boyner", url: "https://www.boyner.com.tr", country: "TR", domains: ["boyner.com.tr"], short: "بوینر", hint: "برندهای مد و کفش", cats: ["fashion", "beauty"] },
  { key: "flo", name: "فلو", latin: "FLO", url: "https://www.flo.com.tr", country: "TR", domains: ["flo.com.tr"], short: "فلو", hint: "کفش ورزشی و روزمره", cats: ["fashion", "sport"] },
  { key: "englishhome", name: "اینگلیش هوم", latin: "English Home", url: "https://www.englishhome.com", country: "TR", domains: ["englishhome.com"], short: "اینگلیش هوم", hint: "منسوجات و دکور خانه", cats: ["home"] },
  { key: "karaca", name: "کاراجا", latin: "Karaca", url: "https://www.karaca.com", country: "TR", domains: ["karaca.com"], short: "کاراجا", hint: "ظروف و لوازم آشپزخانه", cats: ["home"] },
  { key: "gratis", name: "گراتیس", latin: "Gratis", url: "https://www.gratis.com", country: "TR", domains: ["gratis.com"], short: "گراتیس", hint: "آرایشی و بهداشتی", cats: ["beauty"] },
  { key: "teknosa", name: "تکنوسا", latin: "Teknosa", url: "https://www.teknosa.com", country: "TR", domains: ["teknosa.com"], short: "تکنوسا", hint: "دیجیتال و لوازم برقی", cats: ["digital"] },

  // ---- USA: still recognised in links, not suggested (hard to buy from for our customers)
  { key: "amazon-us", name: "آمازون آمریکا", latin: "amazon.com", url: "https://www.amazon.com", country: "US", domains: ["amazon.com", "amzn.to", "a.co"], short: "آمازون آمریکا", hint: "برندهای آمریکایی", brand: "Amazon US", suggest: false },
  { key: "ebay", name: "ای‌بی", latin: "eBay", url: "https://www.ebay.com", country: "US", domains: ["ebay.com", "ebay.de", "ebay.co.uk"], short: "ای‌بی", hint: "قطعات، کلکسیون و دست‌دوم", suggest: false },
  { key: "walmart", name: "والمارت", latin: "Walmart", url: "https://www.walmart.com", country: "US", domains: ["walmart.com"], short: "والمارت", hint: "خانه، آشپزخانه و مصرفی", suggest: false },
  { key: "bestbuy", name: "بست‌بای", latin: "Best Buy", url: "https://www.bestbuy.com", country: "US", domains: ["bestbuy.com"], short: "بست‌بای", hint: "لپ‌تاپ، کنسول و دیجیتال", suggest: false },
];

/**
 * Default order on the landing when there is no request data yet (real demand from requests
 * comes first): big UAE and Turkish shops, then brands, then the rest in catalog order.
 */
export const STORE_PRIORITY = [
  "amazon-ae", "noon", "namshi", "trendyol", "nike-ae", "adidas-ae", "sssports", "6thstreet",
  "shein", "zara-ae", "apple-ae", "hepsiburada", "sephora-ae", "aliexpress", "ounass", "taobao",
];

/** Stores suggested on the landing. */
export const suggestedStores = () => stores.filter((s) => s.suggest !== false);

/** The deal if it is still running on `today` (YYYY-MM-DD, Tehran). */
export const activeDeal = (s: Pick<Store, "deal">, today: string) => (s.deal && today <= s.deal.until ? s.deal : undefined);

export const storeByKey = (key?: string | null) => stores.find((s) => s.key === key);

/** Detects the store from a URL host (longest matching suffix wins). */
export function detectStore(rawUrl: string): Store | undefined {
  let host: string;
  let path: string;
  try {
    const u = new URL(rawUrl);
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    path = u.pathname.toLowerCase();
  } catch {
    return undefined;
  }
  let best: { store: Store; len: number } | undefined;
  for (const store of stores) {
    // Brands on a global domain (apple.com/ae) only own their regional section.
    if (store.paths && !store.paths.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "-"))) continue;
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
  form: { title: "فرم سایت سپکس", short: "فرم سایت" },
} as const;
export type Method = keyof typeof methods;
/** Methods a customer can pick on /order ("form" only arrives from sepex.net). */
export const orderMethods = ["link", "photo", "shipping"] as const;
export type OrderMethod = (typeof orderMethods)[number];

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

/** English name shown on the landing (store titles are written in Latin script). */
export const storeLabel = (s: Pick<Store, "brand" | "latin">) => s.brand ?? s.latin;
