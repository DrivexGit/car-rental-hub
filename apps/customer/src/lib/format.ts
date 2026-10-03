export const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const day = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const shortDay = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const daysBetween = (a: string | Date, b: string | Date) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
