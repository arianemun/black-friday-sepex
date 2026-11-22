/** Persian, Gregorian and Hijri dates for the panel header (Tehran time). */
export function panelDates(d = new Date()) {
  const fmt = (cal: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(`fa-IR-u-ca-${cal}`, { timeZone: "Asia/Tehran", ...opts }).format(d);
  return {
    persian: { short: fmt("persian", { year: "numeric", month: "2-digit", day: "2-digit" }), full: fmt("persian", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
    gregorian: {
      short: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(d),
      full: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
    },
    islamic: { short: fmt("islamic-umalqura", { year: "numeric", month: "2-digit", day: "2-digit" }), full: fmt("islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }) },
  };
}
