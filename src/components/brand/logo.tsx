import { cn } from "@/lib/utils";

const D =
  "M316 121 L370 143 L424 121 L370 97 Z M124 23 L124 68 L247 121 L370 68 L493 121 L493 75 L370 23 L247 75 Z M193 23 L247 47 L300 23 L247 0 Z M507 241 L547 312 L507 384 L536 384 L562 339 L588 384 L616 384 L576 312 L616 241 L588 241 L562 285 L536 241 Z M380 241 L380 384 L480 384 L480 358 L406 358 L406 326 L480 326 L480 300 L406 300 L406 266 L480 266 L480 241 Z M353 241 L253 241 L253 266 L328 266 L328 296 L253 312 L253 384 L278 384 L278 332 L353 316 Z M124 241 L124 384 L226 384 L226 358 L152 358 L152 326 L226 326 L226 300 L152 300 L152 266 L226 266 L226 241 Z M0 241 L0 316 L74 332 L74 358 L0 358 L0 384 L100 384 L100 312 L26 296 L26 266 L100 266 L100 241 Z";

/** SEPEX logo (mark + wordmark). Inherits text color. */
export function SepexLogo({ className, title = "سپکس" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 617 385" fill="currentColor" role="img" aria-label={title} className={cn("h-8 w-auto", className)}>
      <path fillRule="evenodd" d={D} />
    </svg>
  );
}

/* The three parts of the SEPEX mark, separately, so they can be animated or used as a motif. */
export const MARK_PARTS = {
  top: "M193 23 L247 47 L300 23 L247 0 Z",
  wing: "M124 23 L124 68 L247 121 L370 68 L493 121 L493 75 L370 23 L247 75 Z",
  bottom: "M316 121 L370 143 L424 121 L370 97 Z",
};

/** SEPEX mark only (no wordmark). `assemble` slides the three parts into place when shown. */
export function SepexMark({ className, assemble, title }: { className?: string; assemble?: boolean; title?: string }) {
  return (
    <svg viewBox="124 0 370 143" fill="currentColor" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={cn("h-4 w-auto", assemble && "mark-assemble", className)}>
      <path d={MARK_PARTS.top} className="mark-top" />
      <path fillRule="evenodd" d={MARK_PARTS.wing} className="mark-wing" />
      <path d={MARK_PARTS.bottom} className="mark-bottom" />
    </svg>
  );
}

const LETTERS = D.slice(D.indexOf("M507 241"));

/** Full logo whose mark assembles and wordmark fades in when its <Reveal> parent is shown. */
export function SepexLogoAssemble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 617 385" fill="currentColor" role="img" aria-label="سپکس" className={cn("mark-assemble h-auto w-full", className)}>
      <path d={MARK_PARTS.top} className="mark-top" />
      <path fillRule="evenodd" d={MARK_PARTS.wing} className="mark-wing" />
      <path d={MARK_PARTS.bottom} className="mark-bottom" />
      <path fillRule="evenodd" d={LETTERS} className="mark-letters" />
    </svg>
  );
}

/** Logo drawn as an outline, then filled, when its <Reveal> parent comes into view. */
export function SepexLogoDraw({ className }: { className?: string }) {
  return (
    <svg viewBox="-4 -4 625 393" role="img" aria-label="سپکس" className={cn("logo-draw h-auto w-full", className)} fill="currentColor" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round">
      <path d={MARK_PARTS.top} pathLength={1} />
      <path fillRule="evenodd" d={MARK_PARTS.wing} pathLength={1} />
      <path d={MARK_PARTS.bottom} pathLength={1} />
      <path fillRule="evenodd" d={LETTERS} pathLength={1} />
    </svg>
  );
}
