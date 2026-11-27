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

/**
 * The colour of a product photo's own background (its corners), so the frame around the photo
 * continues it seamlessly. Store photos are usually white; transparent PNGs get white.
 */
export function photoBackground(img: CanvasImageSource & { width: number; height: number }): string {
  try {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 32, 32);
    const d = ctx.getImageData(0, 0, 32, 32).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of [[0, 0], [31, 0], [0, 31], [31, 31], [16, 0], [16, 31], [0, 16], [31, 16]]) {
      const i = (y * 32 + x) * 4;
      if (d[i + 3] < 200) continue;
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
    return n >= 5 ? `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` : "#FFFFFF";
  } catch {
    return "#FFFFFF";
  }
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

  // Product: a yellow frame, inside it a panel in the photo's own background colour, and the
  // photo as it is (no cut-out, no shadow) with even margins.
  const sq = { x: 404, y: 760, s: 600 };
  const frame = 14;
  chamferRect(ctx, sq.x, sq.y, sq.s, sq.s, 48);
  ctx.fillStyle = YELLOW;
  ctx.fill();
  const inner = { x: sq.x + frame, y: sq.y + frame, s: sq.s - frame * 2 };
  chamferRect(ctx, inner.x, inner.y, inner.s, inner.s, 40);
  ctx.fillStyle = product && product.width > 0 ? photoBackground(product) : "#FFFFFF";
  ctx.fill();
  if (product && product.width > 0) {
    const pad = 30;
    const box = inner.s - pad * 2;
    const k = Math.min(box / product.width, box / product.height);
    const pw = product.width * k, ph = product.height * k;
    ctx.save();
    chamferRect(ctx, inner.x, inner.y, inner.s, inner.s, 40);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(product, inner.x + (inner.s - pw) / 2, inner.y + (inner.s - ph) / 2, pw, ph);
    ctx.restore();
  }

  // Discount, on the dark side to the left of the frame.
  ctx.direction = "ltr";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
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
  ctx.fillText(cta[0], cx, 1478);
  ctx.fillText(cta[1], cx, 1560);

  ctx.restore();
}
