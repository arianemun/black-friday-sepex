/**
 * 9:16 Instagram story for a deal, drawn on a canvas in the browser (the browser shapes Persian
 * text; the server has no image stack). 1080×1920, matching the SEPEX story template:
 * logo, yellow Persian name box, English name strip, discount, product on a yellow square,
 * call to action, and an empty band at the bottom for Instagram's link sticker.
 */

import { LOGO_PATH } from "@/components/brand/logo";

export const STORY_W = 1080;
export const STORY_H = 1920;
/** The band left empty for the link sticker (y range), shown as a guide in the editor only. */
export const STICKER_ZONE = { y: 1640, h: 170 };

const YELLOW = "#FFCB05";
const INK = "#111111";
const BG = "#141414";

export type StoryData = {
  nameFa: string;
  nameEn: string;
  discount: number | null;
  /** e.g. "از noon، امارات" — optional line under the English name. */
  source?: string | null;
};

/** Makes a near-white background that touches the edges transparent, then trims empty margins. */
export function cutWhiteBackground(img: CanvasImageSource & { width: number; height: number }, enabled = true): HTMLCanvasElement {
  const max = 1400;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  if (enabled) {
    const isBg = (i: number) => {
      const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
      if (a < 20) return true;
      const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
      return mn > 232 && mx - mn < 20;
    };
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
      const p = y * w + x;
      if (seen[p]) return;
      seen[p] = 1;
      if (isBg(p * 4)) stack.push(p);
    };
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    const removed = new Uint8Array(w * h);
    while (stack.length) {
      const p = stack.pop()!;
      removed[p] = 1;
      const x = p % w, y = (p - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    // Only cut when the background really is white around the edges (a photo keeps its frame).
    let edge = 0, edgeBg = 0;
    for (let x = 0; x < w; x++) {
      edge += 2;
      edgeBg += removed[x] + removed[(h - 1) * w + x];
    }
    for (let y = 0; y < h; y++) {
      edge += 2;
      edgeBg += removed[y * w] + removed[y * w + w - 1];
    }
    // Enclosed pure-white areas (inside a headband, between straps) are background too.
    const holeSeen = new Uint8Array(w * h);
    const isPure = (p: number) => {
      const i = p * 4;
      return px[i + 3] > 200 && Math.min(px[i], px[i + 1], px[i + 2]) >= 247 && Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) < 8;
    };
    const minHole = Math.max(400, w * h * 0.004);
    for (let start = 0; start < w * h; start++) {
      if (removed[start] || holeSeen[start] || !isPure(start)) continue;
      const region: number[] = [];
      const st = [start];
      holeSeen[start] = 1;
      while (st.length) {
        const p = st.pop()!;
        region.push(p);
        const x = p % w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
          if (q < 0 || q >= w * h || holeSeen[q] || removed[q] || !isPure(q)) continue;
          holeSeen[q] = 1;
          st.push(q);
        }
      }
      if (region.length >= minHole) for (const p of region) removed[p] = 1;
    }
    let total = 0;
    for (let p = 0; p < w * h; p++) total += removed[p];
    // Cutting away nearly everything means the product itself is white: keep the photo as it is.
    if (edgeBg / edge > 0.5 && total / (w * h) < 0.9) {
      for (let p = 0; p < w * h; p++) {
        if (removed[p]) {
          px[p * 4 + 3] = 0;
          continue;
        }
        // Soften the outline: near-white pixels next to the cut fade out.
        const x = p % w, y = (p - x) / w;
        const near = (x > 0 && removed[p - 1]) || (x < w - 1 && removed[p + 1]) || (y > 0 && removed[p - w]) || (y < h - 1 && removed[p + w]);
        if (near) {
          const i = p * 4;
          const light = Math.min(px[i], px[i + 1], px[i + 2]);
          if (light > 200) px[i + 3] = Math.round(px[i + 3] * Math.max(0.15, (255 - light) / 55));
        }
      }
      ctx.putImageData(data, 0, 0);
    }
  }

  // Trim transparent margins so the product fills its spot.
  const a = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (a[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0 || (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1)) return c;
  const t = document.createElement("canvas");
  t.width = x1 - x0 + 1;
  t.height = y1 - y0 + 1;
  t.getContext("2d")!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
  return t;
}

/** Chamfered rectangle: the top-right corner cut, the shape the SEPEX identity uses. */
function chamferRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, start: number, min: number, maxW: number) {
  let size = start;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

/** Splits a long name into two balanced lines at a space. */
function twoLines(text: string): [string, string] | null {
  const words = text.split(/\s+/);
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const d = Math.abs(a.length - b.length);
    if (d < diff) {
      diff = d;
      best = [a, b];
    }
  }
  return best;
}

export function drawStory(ctx: CanvasRenderingContext2D, d: StoryData, product: CanvasImageSource & { width: number; height: number } | null, family: string) {
  const W = STORY_W, H = STORY_H, cx = W / 2;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // Background: near-black, a fine dot grid and a faint yellow glow behind the product.
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) ctx.fillRect(x - 1, y - 1, 2.4, 2.4);
  const glow = ctx.createRadialGradient(cx + 60, 1040, 40, cx + 60, 1040, 760);
  glow.addColorStop(0, "rgba(255,203,5,0.16)");
  glow.addColorStop(1, "rgba(255,203,5,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Logo + tagline.
  const logoW = 270, logoH = (logoW * 385) / 617, logoY = 130;
  ctx.save();
  ctx.translate(cx - logoW / 2, logoY);
  ctx.scale(logoW / 617, logoH / 385);
  ctx.fillStyle = YELLOW;
  ctx.fill(new Path2D(LOGO_PATH), "evenodd");
  ctx.restore();
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = YELLOW;
  ctx.font = `500 32px ${family}`;
  ctx.fillText("پست سریع بین‌المللی", cx, logoY + logoH + 52);

  // Persian name in the yellow box (shrinks, then wraps to two lines).
  const nameFa = d.nameFa.trim() || d.nameEn.trim();
  const boxMaxW = 940, padX = 50;
  let lines: string[] = [nameFa];
  let size = fitFont(ctx, nameFa, family, 850, 88, 64, boxMaxW - padX * 2);
  if (ctx.measureText(nameFa).width > boxMaxW - padX * 2) {
    const two = twoLines(nameFa);
    if (two) {
      lines = two;
      size = Math.min(fitFont(ctx, two[0], family, 850, 80, 48, boxMaxW - padX * 2), fitFont(ctx, two[1], family, 850, 80, 48, boxMaxW - padX * 2));
    } else size = fitFont(ctx, nameFa, family, 850, 64, 36, boxMaxW - padX * 2);
  }
  ctx.font = `850 ${size}px ${family}`;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const nameEn = d.nameEn.trim();
  ctx.font = `300 46px ${family}`;
  const enW = nameEn ? ctx.measureText(nameEn).width : 0;
  const boxW = Math.min(boxMaxW, Math.max(620, textW + padX * 2, enW + 80));
  const lineH = size * 1.35;
  const boxH = lines.length === 1 ? 128 : Math.round(lineH * 2 + 36);
  const boxX = cx - boxW / 2, boxY = 430;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.fillStyle = INK;
  ctx.font = `850 ${size}px ${family}`;
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, cx, boxY + (lines.length === 1 ? boxH / 2 + 4 : 18 + lineH * (i + 0.5) + 4)));

  // English name strip (top-right corner cut).
  let y = boxY + boxH + 14;
  if (nameEn) {
    chamferRect(ctx, boxX, y, boxW, 64, 22);
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.direction = "ltr";
    ctx.fillStyle = INK;
    fitFont(ctx, nameEn, family, 300, 46, 28, boxW - 60);
    ctx.fillText(nameEn, cx, y + 34);
    y += 64;
  }
  if (d.source) {
    ctx.direction = "rtl";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `500 30px ${family}`;
    ctx.fillText(d.source, cx, y + 42);
    y += 50;
  }

  // The product block is laid out for a one-line name (top at 720, bottom at 1450). A taller
  // header pushes it down and shrinks it so the call to action keeps its place.
  const top = Math.max(720, y + 40);
  const sc = Math.min(1, (1450 - top) / 730);
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(sc, sc);
  ctx.translate(-cx, -720);

  // Product on the yellow square.
  const sq = { x: 232, y: 760, s: 600 };
  chamferRect(ctx, sq.x, sq.y, sq.s, sq.s, 44);
  ctx.fillStyle = YELLOW;
  ctx.fill();
  if (product && product.width > 0) {
    const area = { x: 300, y: 720, w: 720, h: 740 };
    const k = Math.min(area.w / product.width, area.h / product.height);
    const pw = product.width * k, ph = product.height * k;
    const px = area.x + (area.w - pw) / 2, py = area.y + (area.h - ph) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetX = -10;
    ctx.shadowOffsetY = 34;
    ctx.drawImage(product, px, py, pw, ph);
    ctx.restore();
  }

  // Discount, on the left over the square's edge.
  ctx.direction = "ltr";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  const tx = 372;
  const spacing = (px: number) => {
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  };
  const words = (px: number) => {
    if ("wordSpacing" in ctx) (ctx as CanvasRenderingContext2D & { wordSpacing: string }).wordSpacing = `${px}px`;
  };
  words(16);
  if (d.discount) {
    spacing(-2);
    ctx.font = `800 68px ${family}`;
    ctx.fillText("get Up to", tx, 838);
    spacing(-6);
    ctx.font = `950 168px ${family}`;
    ctx.fillText(`%${d.discount}`, tx, 990);
    spacing(-2);
    ctx.font = `800 68px ${family}`;
    ctx.fillText("discount", tx, 1052);
  } else {
    spacing(-3);
    ctx.font = `950 92px ${family}`;
    ctx.fillText("Black", tx, 868);
    ctx.fillText("Friday", tx, 958);
    ctx.font = `800 64px ${family}`;
    ctx.fillText("deal", tx, 1030);
  }
  spacing(0);
  words(0);
  ctx.restore();

  // Call to action.
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = YELLOW;
  const cta = d.discount
    ? ["تا تخفیف فعاله، از لینک زیر درخواست", "خریدش رو در سپکس ثبت کنید."]
    : ["تا بلک‌فرایدی تموم نشده، از لینک زیر", "درخواست خریدش رو در سپکس ثبت کنید."];
  ctx.font = `700 52px ${family}`;
  ctx.fillText(cta[0], cx, 1510);
  ctx.fillText(cta[1], cx, 1592);

  ctx.restore();
}
