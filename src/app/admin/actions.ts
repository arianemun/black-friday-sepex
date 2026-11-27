"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { hashPassword, login, logout, requireAdmin, requireInsights, requireShiftManager, requireStaff } from "@/lib/auth";
import { SID_RE } from "@/lib/rec/protocol";
import { setSessionNote } from "@/lib/rec/insights";
import { copyWeekForward, isDay, setShift, tehranDay } from "@/lib/shifts";
import { parseRole } from "@/lib/roles";
import { listTrainingVideos, recordWatch } from "@/lib/training";
import { categories, countries, detectStore, extractUrl, statuses } from "@/lib/catalog";
import { discountOf, fetchLinkMeta } from "@/lib/link-meta";
import { checkAllDeals, checkProduct, newCode, publishNext, setDealsAuto } from "@/lib/deals";
import type { ProductRow } from "@/lib/products";
import { normalizeIranMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-info";
import { defaultSettings, saveSettings, type Settings } from "@/lib/settings";
import { deleteUpload, storeRemoteImage, storeUpload } from "@/lib/uploads";
import { enrichRequestLinks } from "@/lib/requests";
import { logEvent } from "@/lib/events";
import { toEnDigits } from "@/lib/utils";
import { sendTemplateSms, smsAccount, type SmsAccountKey } from "@/lib/sms";

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, string | null> } | null;

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

/* ---------------------------------------------------------------- auth */

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!rateLimit(`login:ip:${ip}`, 10, 900)) return { error: "تلاش زیاد بود. ۱۵ دقیقه بعد دوباره امتحان کنید." };
  const ok = await login(str(fd, "username", 60), String(fd.get("password") ?? "").slice(0, 200));
  if (!ok) return { error: "نام کاربری یا رمز عبور اشتباه است." };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

/* ---------------------------------------------------------------- requests */

export async function setStatusAction(requestId: number, status: string) {
  const me = await requireStaff();
  if (!statuses.some((s) => s.key === status)) return;
  const db = getDb();
  const prev = db.prepare("SELECT status FROM requests WHERE id = ?").get(requestId) as { status: string } | undefined;
  const changed = db.prepare("UPDATE requests SET status = ?, updated_at = ? WHERE id = ? AND status != ?").run(status, nowIso(), requestId, status).changes;
  if (changed) {
    logEvent(requestId, "status", { staffId: me.id, body: status, meta: { from: prev?.status ?? null } });
    // Taking a request out of "new" claims it for whoever did it, if nobody had it.
    db.prepare("UPDATE requests SET assigned_to = ? WHERE id = ? AND assigned_to IS NULL").run(me.id, requestId);
  }
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
}

export async function assignAction(requestId: number, staffId: number | null) {
  const me = await requireStaff();
  const db = getDb();
  if (staffId !== null && !db.prepare("SELECT 1 FROM staff WHERE id = ? AND active = 1").get(staffId)) return;
  const prev = db.prepare("SELECT s.name FROM requests r LEFT JOIN staff s ON s.id = r.assigned_to WHERE r.id = ?").get(requestId) as { name: string | null } | undefined;
  db.prepare("UPDATE requests SET assigned_to = ?, updated_at = ? WHERE id = ?").run(staffId, nowIso(), requestId);
  const name = staffId ? (db.prepare("SELECT name FROM staff WHERE id = ?").get(staffId) as { name: string }).name : null;
  logEvent(requestId, "assigned", { staffId: me.id, body: name, meta: { from: prev?.name ?? null, self: staffId === me.id } });
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
}

export async function addNoteAction(requestId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireStaff();
  const body = str(fd, "body", 2000);
  if (body.length < 2) return { error: "یادداشت خالی است." };
  logEvent(requestId, "note", { staffId: me.id, body });
  getDb().prepare("UPDATE requests SET updated_at = ? WHERE id = ?").run(nowIso(), requestId);
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true };
}

export async function refetchLinksAction(requestId: number) {
  const me = await requireStaff();
  getDb().prepare("UPDATE request_items SET meta_status = 'pending' WHERE request_id = ? AND url IS NOT NULL").run(requestId);
  const r = await enrichRequestLinks(requestId);
  logEvent(requestId, "refetch", { staffId: me.id, meta: r });
  revalidatePath(`/admin/requests/${requestId}`);
}

/** Logged when a staff member taps call / WhatsApp / Telegram on a request. */
export async function logContactAction(requestId: number, channel: "call" | "whatsapp" | "telegram") {
  const me = await requireStaff();
  if (!["call", "whatsapp", "telegram"].includes(channel)) return;
  logEvent(requestId, "contact", { staffId: me.id, body: channel });
  revalidatePath(`/admin/requests/${requestId}`);
}

/* ---------------------------------------------------------------- products */

export async function fetchProductMetaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff();
  const url = extractUrl(str(fd, "url", 4000));
  if (!url) return { error: "لینک معتبر نیست." };
  const meta = await fetchLinkMeta(url);
  const store = detectStore(url);
  if (!meta) {
    return {
      error: "اطلاعات این لینک خودکار خوانده نشد (فروشگاه جلوی ربات‌ها را می‌گیرد یا در دسترس نیست). مشخصات را دستی وارد کنید.",
      data: { url, store_key: store?.key ?? "", country: store?.country ?? "" },
    };
  }
  return {
    ok: true,
    message: "اطلاعات خوانده شد. بررسی و ذخیره کنید.",
    data: {
      url,
      title: meta.title,
      image: meta.image,
      price: meta.price,
      old_price: meta.oldPrice ?? null,
      discount: String(discountOf(meta.price, meta.oldPrice) ?? ""),
      stock: meta.availability ?? null,
      currency: meta.currency,
      store_key: store?.key ?? "",
      country: store?.country ?? "",
    },
  };
}

const productSchema = z.object({
  id: z.coerce.number().int().optional(),
  title: z.string().trim().min(2).max(300),
  url: z.string().trim().max(4000),
  category: z.enum(categories.map((c) => c.key) as [string, ...string[]]),
  country: z.enum(["", ...countries.map((c) => c.code)] as [string, ...string[]]),
  store_key: z.string().max(40),
  price: z.string().trim().max(40),
  old_price: z.string().trim().max(40),
  currency: z.string().trim().max(8),
  discount_percent: z.string().trim().max(3),
  sort: z.coerce.number().int().min(-9999).max(9999).default(0),
  image_url: z.string().trim().max(2000),
  name_fa: z.string().trim().max(80),
  name_en: z.string().trim().max(80),
  queued: z.boolean(),
});

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = productSchema.safeParse({
    id: fd.get("id") || undefined,
    title: str(fd, "title", 300),
    url: str(fd, "url", 4000),
    category: str(fd, "category", 20) || "other",
    country: str(fd, "country", 8),
    store_key: str(fd, "store_key", 40),
    price: toEnDigits(str(fd, "price", 40)),
    old_price: toEnDigits(str(fd, "old_price", 40)),
    currency: str(fd, "currency", 8).toUpperCase(),
    discount_percent: toEnDigits(str(fd, "discount_percent", 3)),
    sort: toEnDigits(str(fd, "sort", 6)) || 0,
    image_url: str(fd, "image_url", 2000),
    name_fa: str(fd, "name_fa", 80),
    name_en: str(fd, "name_en", 80),
    queued: fd.get("queued") === "1",
  });
  if (!parsed.success) return { error: "عنوان، لینک و دسته‌بندی را کامل وارد کنید." };
  const p = parsed.data;
  const url = extractUrl(p.url);
  if (!url) return { error: "لینک کالا معتبر نیست." };

  let imageId: string | null = null;
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageId = (await storeUpload(Buffer.from(await file.arrayBuffer()), { kind: "product", maxSide: 900 })).id;
    } catch {
      return { error: "تصویر معتبر نیست (JPG، PNG یا WebP)." };
    }
  } else if (p.image_url) {
    imageId = (await storeRemoteImage(p.image_url))?.id ?? null;
  }

  const store = p.store_key || detectStore(url)?.key || null;
  const discount = p.discount_percent ? Math.min(99, Math.max(1, Number(p.discount_percent) || 0)) || null : discountOf(p.price, p.old_price);
  const db = getDb();
  if (p.id) {
    const old = db.prepare("SELECT image_upload_id FROM products WHERE id = ?").get(p.id) as { image_upload_id: string | null } | undefined;
    if (!old) return { error: "کالا پیدا نشد." };
    db.prepare(
      `UPDATE products SET title=?, url=?, category=?, country=?, store_key=?, price=?, old_price=?, currency=?, discount_percent=?, sort=?,
       image_upload_id=COALESCE(?, image_upload_id), name_fa=?, name_en=?,
       discount_source = CASE WHEN discount_percent IS ? THEN discount_source ELSE 'manual' END, updated_at=? WHERE id=?`
    ).run(p.title, url, p.category, p.country || null, store, p.price || null, p.old_price || null, p.currency || null, discount, p.sort, imageId, p.name_fa || null, p.name_en || null, discount, nowIso(), p.id);
    if (imageId && old.image_upload_id) await deleteUpload(old.image_upload_id);
  } else {
    db.prepare(
      `INSERT INTO products(title, url, category, country, store_key, price, old_price, currency, discount_percent, discount_source, sort, image_upload_id,
         name_fa, name_en, code, active, queued, published_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(p.title, url, p.category, p.country || null, store, p.price || null, p.old_price || null, p.currency || null, discount, discount ? "manual" : null, p.sort, imageId,
      p.name_fa || null, p.name_en || null, newCode(), p.queued ? 0 : 1, p.queued ? 1 : 0, p.queued ? null : nowIso());
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  if (p.image_url && !imageId && !(file instanceof File && file.size > 0)) {
    return { ok: true, message: "ذخیره شد، ولی عکس از این لینک دانلود نشد. لینک مستقیم عکس (آخرش ‎.jpg/.png/.webp) بدهید یا فایل عکس را بارگذاری کنید." };
  }
  return { ok: true, message: p.id ? "کالا به‌روز شد." : p.queued ? "کالا به صف انتشار خودکار اضافه شد." : imageId || p.image_url === "" ? "کالا اضافه شد." : "کالا اضافه شد، ولی تصویرش دانلود نشد. تصویر را دستی بارگذاری کنید." };
}

export async function toggleProductAction(id: number, active: boolean) {
  await requireStaff();
  // Turned on by hand: it leaves the queue and counts as published now.
  getDb()
    .prepare(
      "UPDATE products SET active = ?, auto_hidden = 0, queued = CASE WHEN ? THEN 0 ELSE queued END, published_at = CASE WHEN ? AND published_at IS NULL THEN ? ELSE published_at END, updated_at = ? WHERE id = ?"
    )
    .run(active ? 1 : 0, active ? 1 : 0, active ? 1 : 0, nowIso(), nowIso(), id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function queueProductAction(id: number, queued: boolean) {
  await requireStaff();
  getDb().prepare("UPDATE products SET queued = ?, active = CASE WHEN ? THEN 0 ELSE active END, updated_at = ? WHERE id = ?").run(queued ? 1 : 0, queued ? 1 : 0, nowIso(), id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function setDealsAutoAction(on: boolean) {
  await requireStaff();
  setDealsAuto(on);
  revalidatePath("/admin/products");
}

export async function publishNextAction(): Promise<ActionState> {
  await requireStaff();
  const id = await publishNext({ force: true });
  revalidatePath("/admin/products");
  revalidatePath("/");
  return id ? { ok: true, message: "کالای بعدی صف منتشر شد." } : { error: "کالای قابل انتشاری در صف نیست (یا همه ناموجودند)." };
}

export async function checkDealsAction(id?: number): Promise<ActionState> {
  await requireStaff();
  if (!rateLimit(`deals-check:${id ?? "all"}`, 6, 600)) return { error: "چند دقیقه‌ی دیگر دوباره امتحان کنید." };
  if (id) {
    const row = getDb().prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
    if (!row) return { error: "کالا پیدا نشد." };
    const r = await checkProduct(row);
    revalidatePath("/admin/products");
    revalidatePath("/");
    const label = r.note === "blocked" ? "فروشگاه جلوی بررسی را گرفت؛ وضعیت قبلی ماند." : r.stock === "out" ? "ناموجود است؛ از لندینگ پنهان شد." : r.stock === "in" ? "موجود است." : "خوانده شد، ولی سایت وضعیت موجودی را اعلام نمی‌کند.";
    return { ok: r.note !== "blocked", message: label, error: r.note === "blocked" ? label : undefined };
  }
  const all = await checkAllDeals();
  revalidatePath("/admin/products");
  return { ok: true, message: `${all.length} کالا بررسی شد.` };
}

export async function deleteProductAction(id: number) {
  await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT image_upload_id FROM products WHERE id = ?").get(id) as { image_upload_id: string | null } | undefined;
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (row?.image_upload_id) await deleteUpload(row.image_upload_id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

/* ---------------------------------------------------------------- staff */

export async function saveStaffAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = Number(fd.get("id") || 0) || null;
  const name = str(fd, "name", 80);
  const username = str(fd, "username", 40).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const phoneRaw = str(fd, "phone", 20);
  const role = parseRole(fd.get("role"));
  const notify = fd.get("notify_sms") === "on" ? 1 : 0;
  const active = fd.get("active") === "on" || !id ? 1 : 0;

  if (name.length < 2) return { error: "نام را وارد کنید." };
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "نام کاربری فقط حروف انگلیسی، عدد، نقطه و خط تیره (حداقل ۳ حرف)." };
  const phone = phoneRaw ? normalizeIranMobile(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: "شماره موبایل معتبر نیست." };
  if (notify && !phone) return { error: "برای دریافت پیامک، شماره موبایل لازم است." };
  if ((!id || password) && password.length < 8) return { error: "رمز عبور حداقل ۸ کاراکتر باشد." };
  if (id === me.id && (role !== "admin" || !active)) return { error: "نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید." };

  const db = getDb();
  const dup = db.prepare("SELECT id FROM staff WHERE username = ? AND id != ?").get(username, id ?? 0);
  if (dup) return { error: "این نام کاربری قبلاً استفاده شده." };
  if (id) {
    db.prepare("UPDATE staff SET name=?, username=?, phone=?, role=?, notify_sms=?, active=? WHERE id=?").run(name, username, phone, role, notify, active, id);
    if (password) {
      db.prepare("UPDATE staff SET password_hash=? WHERE id=?").run(hashPassword(password), id);
      db.prepare("DELETE FROM sessions WHERE staff_id = ? ").run(id);
    }
    if (!active) db.prepare("DELETE FROM sessions WHERE staff_id = ?").run(id);
  } else {
    db.prepare("INSERT INTO staff(name, username, password_hash, phone, role, notify_sms) VALUES(?,?,?,?,?,?)").run(name, username, hashPassword(password), phone, role, notify);
  }
  revalidatePath("/admin/staff");
  return { ok: true, message: id ? "ذخیره شد." : "کاربر اضافه شد." };
}

/* ---------------------------------------------------------------- shifts */

/** Past days are read-only, so the history of who was on duty stays intact. */
const editableDay = (day: unknown): day is string => isDay(day) && day >= tehranDay();

export async function toggleShiftAction(day: string, staffId: number, on: boolean): Promise<ActionState> {
  const me = await requireShiftManager();
  if (!editableDay(day)) return { error: "روزهای گذشته قابل تغییر نیستند." };
  const target = getDb().prepare("SELECT id FROM staff WHERE id = ? AND active = 1").get(Number(staffId));
  if (!target) return { error: "این کاربر پیدا نشد یا غیرفعال است." };
  setShift(day, Number(staffId), !!on, me.id);
  revalidatePath("/admin/shifts");
  return { ok: true };
}

/** Repeats a whole week's plan on the next week. */
export async function copyShiftWeekAction(start: string): Promise<ActionState> {
  const me = await requireShiftManager();
  if (!isDay(start)) return { error: "هفته معتبر نیست." };
  copyWeekForward(start, me.id);
  revalidatePath("/admin/shifts");
  return { ok: true };
}

/* ---------------------------------------------------------------- training */

/** Progress beacon from the training player. */
export async function trainingProgressAction(slug: string, position: number, duration: number, started: boolean): Promise<void> {
  const me = await requireStaff();
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9_-]{0,60}$/.test(slug)) return;
  if (!listTrainingVideos().some((v) => v.slug === slug)) return;
  const pos = Number(position);
  const dur = Number(duration);
  if (!Number.isFinite(pos) || !Number.isFinite(dur) || pos < 0 || dur < 0 || dur > 6 * 3600) return;
  recordWatch(me.id, slug, Math.min(pos, dur || pos), dur, !!started);
}

/* ---------------------------------------------------------------- settings */

/** "2026-11-27T00:00" in Tehran time (UTC+03:30, no DST since 2022) → ISO. */
function tehranLocalToIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+03:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const target = tehranLocalToIso(str(fd, "countdown_target", 20));
  if (!target) return { error: "زمان شروع را کامل وارد کنید." };
  const endRaw = str(fd, "campaign_end", 20);
  const end = endRaw ? tehranLocalToIso(endRaw) : "";
  if (end === null) return { error: "زمان پایان معتبر نیست." };
  const links = ["whatsapp", "telegram", "instagram", "bale"] as const;
  const patch: Partial<Settings> = {
    countdown_target: target,
    campaign_end: end,
    countdown_label: str(fd, "countdown_label", 60) || defaultSettings.countdown_label,
    notify_mode: fd.get("notify_mode") === "round_robin" ? "round_robin" : "all",
    support_phone: toEnDigits(str(fd, "support_phone", 20)),
  };
  for (const k of links) {
    const v = str(fd, k, 300);
    if (v && !/^https:\/\/[^\s]+$/.test(v)) return { error: "لینک شبکه‌های اجتماعی باید با https:// شروع شود." };
    patch[k] = v;
  }
  saveSettings(patch);
  revalidatePath("/", "layout");
  return { ok: true, message: "تنظیمات ذخیره شد." };
}

/* ---------------------------------------------------------------- visitor sessions */

export async function sessionNoteAction(sid: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireInsights();
  if (!SID_RE.test(sid)) return { error: "جلسه پیدا نشد." };
  setSessionNote(sid, str(fd, "note", 1000), fd.get("starred") === "1");
  revalidatePath(`/admin/insights/sessions/${sid}`);
  return { ok: true, message: "ذخیره شد." };
}

/* ---------------------------------------------------------------- SMS account */

const smsKey = (v: FormDataEntryValue | null): SmsAccountKey | null => (v === "a" || v === "b" ? v : null);

/** Chooses which SMS.ir account sends every message from now on. */
export async function setSmsAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const acc = smsKey(fd.get("account"));
  if (!acc) return { error: "حساب نامعتبر است." };
  const a = smsAccount(acc);
  if (!a.configured) return { error: `کلید API «${a.label}» روی سرور تنظیم نشده است.` };
  saveSettings({ sms_account: acc, sms_account_by: me.name, sms_account_at: nowIso() });
  console.info(`[sms] active account set to ${acc} by staff #${me.id}`);
  revalidatePath("/admin/settings");
  return { ok: true, message: `از این به بعد پیامک‌ها از «${a.label}» ارسال می‌شوند.` };
}

/** Sends the OTP template with a dummy code from the chosen account, to check it works. */
export async function smsTestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const acc = smsKey(fd.get("account"));
  const mobile = normalizeIranMobile(str(fd, "mobile", 20));
  if (!acc) return { error: "حساب نامعتبر است." };
  if (!mobile) return { error: "شماره موبایل معتبر نیست." };
  if (!rateLimit(`sms-test:${me.id}`, 5, 600)) return { error: "پیامک آزمایشی زیادی فرستادید. چند دقیقه دیگر دوباره امتحان کنید." };
  const a = smsAccount(acc);
  if (!a.configured) return { error: `کلید API «${a.label}» روی سرور تنظیم نشده است.` };
  if (!a.templates.otp) return { error: `قالب کد تأیید «${a.label}» تنظیم نشده است.` };
  const otpParam = process.env[acc === "a" ? "SMSIR_OTP_PARAM" : "SMSIR_B_OTP_PARAM"] || process.env.SMSIR_OTP_PARAM || "CODE";
  const r = await sendTemplateSms(mobile, a.templates.otp, [{ name: otpParam, value: "12345" }], acc);
  if ("dryRun" in r && r.dryRun) return { error: "ارسال واقعی خاموش است (SMS_DRY_RUN=1)؛ پیامکی فرستاده نشد." };
  return r.ok
    ? { ok: true, message: `پیامک آزمایشی (کد ۱۲۳۴۵) از «${a.label}» فرستاده شد.` }
    : { error: `SMS.ir پیامک را نپذیرفت. قالب و تأیید آن را در پنل «${a.label}» بررسی کنید؛ جزئیات در لاگ سرور است.` };
}
