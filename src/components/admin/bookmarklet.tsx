"use client";

import { useEffect, useRef } from "react";
import { BookmarkPlus } from "lucide-react";

/**
 * "Send to SEPEX" bookmark for stores that block the server (noon, Trendyol): staff open the
 * product page in their own browser as usual, click the bookmark, and the page's own product
 * data (JSON-LD / Open Graph, crossed-out price, stock) opens in this panel, ready to save.
 * Nothing is fetched by the server from the store page.
 */
function source(origin: string) {
  return `(()=>{const m=s=>{const e=document.querySelector(s);return e?e.getAttribute('content'):null};let p=null;const f=n=>{if(!n||typeof n!=='object')return null;if(Array.isArray(n)){for(const x of n){const r=f(x);if(r)return r}return null}const t=[].concat(n['@type']||[]);if(t.some(x=>/^(Product|ProductGroup)$/i.test(String(x))))return n;return n['@graph']?f(n['@graph']):null};for(const e of document.querySelectorAll('script[type="application/ld+json"]')){try{p=p||f(JSON.parse(e.textContent))}catch(_){}}const o=(p&&[].concat(p.offers||[])[0])||{};let img=p&&[].concat(p.image||[])[0];if(img&&typeof img==='object')img=img.url;const num=v=>{if(typeof v==='number')return v>0?v:null;let s=String(v||'').replace(/[^0-9.,]/g,'');if(/,[0-9]{1,2}$/.test(s))s=s.replace(/[.]/g,'').replace(',','.');else if(/^[0-9]{1,3}([.][0-9]{3})+$/.test(s))s=s.replace(/[.]/g,'');else s=s.replace(/,/g,'');const x=parseFloat(s);return isFinite(x)&&x>0?x:null};const cur=num(o.price||m('meta[property="product:price:amount"]'));let old=null;for(const el of Array.from(document.querySelectorAll('del,s,strike,[class*="was" i],[class*="old" i],[class*="strike" i],[class*="before" i],[class*="original" i],[style*="line-through"]')).slice(0,300)){const v=num(el.textContent);if(v&&cur&&v>cur&&v<cur*10){old=v;break}}const d={u:location.href.split('#')[0].split('?')[0],t:(p&&p.name)||m('meta[property="og:title"]')||document.title,i:img||m('meta[property="og:image"]'),p:cur,c:o.priceCurrency||m('meta[property="product:price:currency"]'),o:old,a:o.availability||null};window.open(${JSON.stringify(origin)}+'/admin/import?d='+encodeURIComponent(JSON.stringify(d)),'_blank')})()`;
}

export function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // Set outside React: React refuses javascript: URLs in href.
    ref.current?.setAttribute("href", `javascript:${encodeURIComponent(source(window.location.origin))}`);
  }, []);
  return (
    <a
      ref={ref}
      onClick={(e) => e.preventDefault()}
      draggable
      title="این دکمه را با ماوس به نوار بوکمارک مرورگر بکشید"
      className="inline-flex h-[38px] shrink-0 cursor-grab items-center gap-1.5 rounded-lg border border-dashed border-[#A1A1AA] bg-white px-3 text-[13px] font-semibold text-[#18181B] hover:border-[#18181B]"
    >
      <BookmarkPlus className="size-4" aria-hidden />
      ارسال به سپکس
    </a>
  );
}

/** Data the bookmark sends: url, title, image, price, currency, crossed-out price, availability. */
export type ImportedPage = { u: string; t?: string | null; i?: string | null; p?: number | null; c?: string | null; o?: number | null; a?: string | null };

export function readImport(): ImportedPage | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("import");
    if (!raw) return null;
    const d = JSON.parse(raw) as ImportedPage;
    return typeof d?.u === "string" && /^https:\/\//.test(d.u) ? d : null;
  } catch {
    return null;
  }
}
