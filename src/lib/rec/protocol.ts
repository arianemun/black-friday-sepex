/**
 * Wire format between the in-page recorder and /api/rec. Client-safe.
 * The body is raw DEFLATE (fflate) of JSON `Batch`.
 */
export type RecMeta = {
  path: string;
  ref: string;
  utm: { s?: string; m?: string; c?: string };
  vw: number;
  vh: number;
  /** Anonymous id kept in the visitor's browser, to tell returning visitors apart (IPs are shared in Iran). */
  vid?: string;
};

export type RecItem =
  | { k: "page"; view: number; path: string; ts: number }
  | { k: "scroll"; view: number; max: number; docH: number; dur: number }
  | { k: "click"; path: string; ts: number; x: number; y: number; w: number; h: number; sel: string; label: string; rage: 0 | 1 | 2; dead: 0 | 1 }
  | { k: "err"; path: string; ts: number; msg: string }
  | { k: "order"; code: string };

export type Batch = {
  v: 1;
  meta?: RecMeta;
  events: unknown[];
  a: RecItem[];
};

export const SID_RE = /^[a-z0-9]{20,40}$/;
export const MAX_BODY = 2 * 1024 * 1024;
