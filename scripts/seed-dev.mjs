// DEV ONLY: inserts sample products so the landing grid can be checked visually.
// Refuses to run when NODE_ENV=production. Remove samples in the admin panel.
import Database from "better-sqlite3";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

if (process.env.NODE_ENV === "production") throw new Error("seed-dev must not run in production");
const dataDir = path.resolve(process.env.DATA_DIR || "data");
const db = new Database(path.join(dataDir, "app.db"));
const samples = [
  ["[نمونه] Wireless noise-cancelling headphones", "https://www.amazon.ae/dp/B0SAMPLE01", "amazon-ae", "AE", "digital", "899", "1299", "AED", 31, "#2b2b2b"],
  ["[نمونه] 65W GaN fast charger, 3 ports", "https://www.aliexpress.com/item/1005000000001.html", "aliexpress", "CN", "digital", "18.5", "32", "USD", 42, "#e9e9e9"],
  ["[نمونه] Stainless steel cookware set, 10 pieces", "https://detail.1688.com/offer/600000000001.html", "1688", "CN", "home", "260", "", "CNY", null, "#b9b9b9"],
  ["[نمونه] Running shoes, breathable mesh", "https://www.noon.com/uae-en/sample", "noon", "AE", "sport", "219", "349", "AED", 37, "#ffcb05"],
  ["[نمونه] Smart watch with AMOLED display", "https://item.taobao.com/item.htm?id=1", "taobao", "CN", "digital", "399", "599", "CNY", 33, "#111111"],
  ["[نمونه] Leather crossbody bag", "https://www.trendyol.com/sample", "trendyol", "TR", "fashion", "1299", "1899", "TRY", 32, "#7a5230"],
];
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
for (const [title, url, store, country, cat, price, old, cur, disc, color] of samples) {
  const id = crypto.randomBytes(16).toString("base64url");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#fff"/><rect x="150" y="150" width="300" height="300" rx="0" fill="${color}"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).webp().toBuffer();
  fs.writeFileSync(path.join(dataDir, "uploads", `${id}.webp`), buf);
  db.prepare("INSERT INTO uploads(id, kind, file_name, mime, size, width, height) VALUES(?, 'product', ?, 'image/webp', ?, 600, 600)").run(id, `${id}.webp`, buf.length);
  db.prepare("INSERT INTO products(title, url, image_upload_id, store_key, country, category, price, old_price, currency, discount_percent, source) VALUES(?,?,?,?,?,?,?,?,?,?, 'sample')")
    .run(title, url, id, store, country, cat, price, old || null, cur, disc);
}
console.log(`seeded ${samples.length} sample products`);
