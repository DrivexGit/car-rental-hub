import { currentLocale } from "@/lib/i18n";

export const money = (n: number) => n.toLocaleString(currentLocale(), { maximumFractionDigits: 0 });
// Rental dates are UAE dates. They are shown in Dubai time whatever the phone's time zone is (a customer in the USA used to see every date one day early).
const TZ = "Asia/Dubai";
/** "2026-10-16" (a plain date) means that day in the UAE; a timestamp stays what it is. */
export const toDate = (d: string | Date) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00+04:00`) : new Date(d));
export const day = (d: string | Date) =>
  toDate(d).toLocaleDateString(currentLocale(), { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });
export const shortDay = (d: string | Date) => toDate(d).toLocaleDateString(currentLocale(), { day: "numeric", month: "short", timeZone: TZ });
/** Today's date in the UAE as "YYYY-MM-DD". */
export const todayInUAE = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
// Local calendar date (not UTC), so Dubai evenings don't shift a day.
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const daysBetween = (a: string | Date, b: string | Date) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
/** UAE calendar day number (days since 1970), so "today", "tomorrow" and "days left" follow the UAE date, not the phone's. */
const uaeDayNumber = (d: string | Date) => {
  const [y, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(toDate(d)).split("-").map(Number);
  return Date.UTC(y, m - 1, dd) / 86400000;
};
/** Whole UAE calendar days from today to that moment: 0 = today, 1 = tomorrow, negative = past. */
export const daysUntil = (d: string | Date) => uaeDayNumber(d) - uaeDayNumber(new Date());
/** Returns an English key; translate it at the call site: t(greeting()). Uses the hour in the UAE. */
export const greeting = () => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/** "+971501234567" -> "+971 50 123 4567" (UAE mobiles). Anything else is returned as it came. */
export const formatPhone = (p?: string | null) => {
  const m = /^\+971(\d{2})(\d{3})(\d{4})$/.exec((p ?? "").replace(/\s/g, ""));
  return m ? `+971 ${m[1]} ${m[2]} ${m[3]}` : p ?? "";
};
