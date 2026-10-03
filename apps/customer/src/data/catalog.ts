export type Period = "daily" | "weekly" | "monthly";
export type Car = {
  id: string; make: string; model: string; year: number; category: string;
  daily: number; weekly: number; monthly: number; image: string; seats: number; vehicleIds: string[];
};

export const PERIOD_DAYS: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30 };
export const PERIOD_UNIT: Record<Period, string> = { daily: "day", weekly: "week", monthly: "month" };
export const priceFor = (c: Pick<Car, "daily" | "weekly" | "monthly">, p: Period) => (p === "daily" ? c.daily : p === "weekly" ? c.weekly : c.monthly);
export const carName = (c: Pick<Car, "make" | "model">) => `${c.make.replace("Mercedes-Benz", "Mercedes")} ${c.model}`;
export const slug = (make: string, model: string) => `${make}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const carImage = (make: string, model: string) => `/cars/${slug(make, model)}.webp`;
const SEVEN = /Patrol|Fortuner|Santa|Captiva|M8|Tahoe|Land Cruiser/;

type VehicleRow = { id: string; make: string; model: string; year: number | null; categories: string[] | null; daily_price: number | null; weekly_price: number | null; monthly_price: number | null };

/** Groups the vehicles table (one row per plate) into bookable models. */
export function toFleet(rows: VehicleRow[]): Car[] {
  const by = new Map<string, Car>();
  for (const v of rows) {
    if (!v.daily_price) continue;
    const id = slug(v.make, v.model);
    const c = by.get(id);
    if (c) { c.vehicleIds.push(v.id); continue; }
    by.set(id, {
      id, make: v.make, model: v.model, year: v.year ?? 0, category: v.categories?.[0] ?? "Car",
      daily: Number(v.daily_price), weekly: Number(v.weekly_price ?? v.daily_price * 7), monthly: Number(v.monthly_price ?? v.daily_price * 30),
      image: carImage(v.make, v.model), seats: SEVEN.test(v.model) ? 7 : 5, vehicleIds: [v.id],
    });
  }
  return [...by.values()];
}

// Marketing banners (content, not data).
export const BANNERS = [
  { kicker: "Exclusive renter benefits", title: "A little more luxury.", text: "Enjoy 30% off at Al Noor Restaurant.", cta: "Explore benefit", to: "/book", image: "/img/banner-luxury.webp" },
  { kicker: "Monthly plans", title: "Drive more, pay less.", text: "Save up to 40% with a monthly rental.", cta: "See monthly cars", to: "/book?period=monthly", image: "/img/banner-monthly.webp" },
];

// Shown for the price preview; the server (api/_lib.ts EXTRAS) is the source of truth.
export const EXTRAS = [
  { id: "full_cover", label: "Full insurance cover", daily: 45 },
  { id: "extra_driver", label: "Additional driver", daily: 25 },
  { id: "child_seat", label: "Child seat", daily: 15 },
];
