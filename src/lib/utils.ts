import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const arDigits = "٠١٢٣٤٥٦٧٨٩";

/** Converts Persian/Arabic digits to ASCII digits. */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arDigits.indexOf(d)));
}

/** Renders ASCII digits as Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => faDigits[Number(d)]);
}

export function formatFaNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export function formatFaDateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(d);
}
