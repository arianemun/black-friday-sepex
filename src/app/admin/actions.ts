"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { hashPassword, login, logout, requireAdmin, requireStaff } from "@/lib/auth";
import { categories, countries, detectStore, extractUrl, statuses } from "@/lib/catalog";
import { fetchLinkMeta } from "@/lib/link-meta";
import { normalizeIranMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-info";
import { defaultSettings, saveSettings, type Settings } from "@/lib/settings";
import { deleteUpload, storeRemoteImage, storeUpload } from "@/lib/uploads";
import { enrichRequestLinks } from "@/lib/requests";
import { toEnDigits } from "@/lib/utils";

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

function addEvent(requestId: number, staffId: number, type: string, body: string | null) {
  getDb().prepare("INSERT INTO request_events(request_id, staff_id, type, body) VALUES(?, ?, ?, ?)").run(requestId, staffId, type, body);
}

export async function setStatusAction(requestId: number, status: string) {
  const me = await requireStaff();
  if (!statuses.some((s) => s.key === status)) return;
  const db = getDb();
  const changed = db.prepare("UPDATE requests SET status = ?, updated_at = ? WHERE id = ? AND status != ?").run(status, nowIso(), requestId, status).changes;
  if (changed) {
    addEvent(requestId, me.id, "status", status);
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
  db.prepare("UPDATE requests SET assigned_to = ?, updated_at = ? WHERE id = ?").run(staffId, nowIso(), requestId);
  const name = staffId ? (db.prepare("SELECT name FROM staff WHERE id = ?").get(staffId) as { name: string }).name : "بدون کارشناس";
  addEvent(requestId, me.id, "assigned", staffId === me.id ? "برداشتن درخواست" : name);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
}

export async function addNoteAction(requestId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireStaff();
  const body = str(fd, "body", 2000);
  if (body.length < 2) return { error: "یادداشت خالی است." };
  addEvent(requestId, me.id, "note", body);
  getDb().prepare("UPDATE requests SET updated_at = ? WHERE id = ?").run(nowIso(), requestId);
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true };
}

export async function refetchLinksAction(requestId: number) {
  await requireStaff();
  getDb().prepare("UPDATE request_items SET meta_status = 'pending' WHERE request_id = ? AND url IS NOT NULL").run(requestId);
  await enrichRequestLinks(requestId);
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
  const discount = p.discount_percent ? Math.min(99, Math.max(1, Number(p.discount_percent) || 0)) || null : null;
  const db = getDb();
  if (p.id) {
    const old = db.prepare("SELECT image_upload_id FROM products WHERE id = ?").get(p.id) as { image_upload_id: string | null } | undefined;
    if (!old) return { error: "کالا پیدا نشد." };
    db.prepare(
      `UPDATE products SET title=?, url=?, category=?, country=?, store_key=?, price=?, old_price=?, currency=?, discount_percent=?, sort=?,
       image_upload_id=COALESCE(?, image_upload_id), updated_at=? WHERE id=?`
    ).run(p.title, url, p.category, p.country || null, store, p.price || null, p.old_price || null, p.currency || null, discount, p.sort, imageId, nowIso(), p.id);
    if (imageId && old.image_upload_id) await deleteUpload(old.image_upload_id);
  } else {
    db.prepare(
      `INSERT INTO products(title, url, category, country, store_key, price, old_price, currency, discount_percent, sort, image_upload_id)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    ).run(p.title, url, p.category, p.country || null, store, p.price || null, p.old_price || null, p.currency || null, discount, p.sort, imageId);
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true, message: p.id ? "کالا به‌روز شد." : imageId || p.image_url === "" ? "کالا اضافه شد." : "کالا اضافه شد، ولی تصویرش دانلود نشد. تصویر را دستی بارگذاری کنید." };
}

export async function toggleProductAction(id: number, active: boolean) {
  await requireStaff();
  getDb().prepare("UPDATE products SET active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, nowIso(), id);
  revalidatePath("/admin/products");
  revalidatePath("/");
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
  const role = fd.get("role") === "admin" ? "admin" : "expert";
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
