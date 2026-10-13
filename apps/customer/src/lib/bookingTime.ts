import type { Booking } from "@/lib/store";
import { daysUntil } from "@/lib/format";

/** Days until the return (ongoing), days late (overdue) or days until pickup (upcoming); nothing for other statuses. */
export function timeLabel(b: Booking, t: (k: string, v?: Record<string, string | number>) => string): { text: string; late: boolean } | null {
  if (b.status === "ongoing" || b.status === "overdue") {
    const left = daysUntil(b.dropoff);
    if (left < 0 || b.status === "overdue") { const n = Math.max(1, -left); return { text: n === 1 ? t("{n} day overdue", { n }) : t("{n} days overdue", { n }), late: true }; }
    return { text: left === 0 ? t("Due today") : left === 1 ? t("{n} day left", { n: left }) : t("{n} days left", { n: left }), late: false };
  }
  if (b.status === "upcoming") {
    const n = daysUntil(b.pickup);
    return { text: n <= 0 ? t("Starts today") : n === 1 ? t("Starts tomorrow") : t("Starts in {n} days", { n }), late: false };
  }
  return null;
}
