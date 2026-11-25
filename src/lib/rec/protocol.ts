/**
 * Wire format between the in-page recorder and /api/rec. Client-safe.
 * The body is raw DEFLATE (fflate) of JSON `Batch`.
 */
export type RecMeta = {
  path: string;
  ref: string;
  utm: { s?: string; m?: string; c?: string; t?: string };
  vw: number;
  vh: number;
  /** Anonymous id kept in the visitor's browser, to tell returning visitors apart (IPs are shared in Iran). */
  vid?: string;
  /** The browser already had a visitor id before this session. */
  ret?: boolean;
  sw?: number;
  sh?: number;
  dpr?: number;
  lang?: string;
  tz?: string;
  /** navigator.connection.effectiveType when available (4g, 3g…). */
  conn?: string;
};

export type ClickItem = {
  k: "click";
  path: string;
  ts: number;
  /** Page coordinates and document size at the time of the click. */
  x: number;
  y: number;
  w: number;
  h: number;
  sel: string;
  label: string;
  /** 1 = the click that completed a rage burst, 2 = later clicks of the same burst. */
  rage: 0 | 1 | 2;
  /** Clicked something that looks clickable and nothing happened. */
  dead: 0 | 1;
  /** Target is a link/button/control or shows a pointer cursor. */
  ia: 0 | 1;
  /** Structural path to the element (nth-of-type), for element-relative heatmaps. */
  el?: string;
  /** Click position inside the element, 0–1000 on each axis. */
  ox?: number;
  oy?: number;
};

export type RecItem =
  | { k: "page"; view: number; path: string; ts: number; title?: string }
  | {
      k: "scroll";
      view: number;
      /** Deepest point seen, % of document height. */
      max: number;
      docH: number;
      /** Wall time on the page. */
      dur: number;
      /** Foreground, non-idle time on the page. */
      act?: number;
      /** Pixels scrolled in total (both directions). */
      dist?: number;
      /** User interactions (taps, clicks, keys, scroll gestures). */
      ia?: number;
      /** Foreground ms spent with each 5% band of the page on screen (20 values). */
      bands?: number[];
    }
  | ClickItem
  | { k: "err"; path: string; ts: number; msg: string; src?: "own" | "ext"; stack?: string }
  | { k: "order"; code: string }
  | { k: "ev"; path: string; ts: number; name: string; props?: Record<string, string | number | boolean | null> }
  | { k: "vital"; view: number; name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB"; value: number }
  | { k: "net"; path: string; ts: number; url: string; method: string; status: number; ms: number }
  | { k: "field"; path: string; ts: number; form: string; field: string; ms: number; filled: 0 | 1; changed: 0 | 1 }
  | { k: "qb"; view: number }
  | { k: "move"; path: string; w: number; h: number; pts: number[] }
  | { k: "hb"; path: string };

export type Batch = {
  v: 1;
  meta?: RecMeta;
  events: unknown[];
  a: RecItem[];
};

export const SID_RE = /^[a-z0-9]{20,40}$/;
export const MAX_BODY = 2 * 1024 * 1024;
