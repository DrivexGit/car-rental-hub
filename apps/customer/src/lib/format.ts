import { currentLocale } from "@/lib/i18n";

export const money = (n: number) => n.toLocaleString(currentLocale(), { maximumFractionDigits: 0 });
export const day = (d: string | Date) =>
  new Date(d).toLocaleDateString(currentLocale(), { day: "2-digit", month: "short", year: "numeric" });
export const shortDay = (d: string | Date) => new Date(d).toLocaleDateString(currentLocale(), { day: "numeric", month: "short" });
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
// Local calendar date (not UTC), so Dubai evenings don't shift a day.
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const daysBetween = (a: string | Date, b: string | Date) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
/** Returns an English key; translate it at the call site: t(greeting()). */
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
