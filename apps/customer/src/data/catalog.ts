import fleetJson from "./fleet.json";

export type Period = "daily" | "weekly" | "monthly";
export type Car = {
  id: string; make: string; model: string; year: number; category: string;
  daily: number; weekly: number; monthly: number; image: string; seats: number; count: number;
};

// Snapshot of the live DriveX fleet (vehicles table, active cars with prices).
// ponytail: static snapshot; switch to a Supabase query once a customer-readable view/RLS exists.
export const FLEET = fleetJson as Car[];
export const carById = (id: string) => FLEET.find((c) => c.id === id)!;
export const carName = (c: Car) => `${c.make.replace("Mercedes-Benz", "Mercedes")} ${c.model}`;

export const PERIOD_DAYS: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30 };
export const PERIOD_UNIT: Record<Period, string> = { daily: "day", weekly: "week", monthly: "month" };
export const priceFor = (c: Car, p: Period) => (p === "daily" ? c.daily : p === "weekly" ? c.weekly : c.monthly);

// Offers shown on Home. Discount is applied to the daily price.
export const OFFERS = [
  { carId: "mercedes-benz-gle-53", off: 15 },
  { carId: "nissan-patrol-platinum", off: 20 },
  { carId: "mercedes-benz-glb-250", off: 10 },
  { carId: "mini-cooper", off: 12 },
].filter((o) => FLEET.some((c) => c.id === o.carId));

export const DINING = [
  { name: "ZUMA", kind: "Dining", off: 45, image: "/img/dining-1.webp" },
  { name: "Nusr-Et", kind: "Dining", off: 22, image: "/img/dining-2.webp" },
  { name: "Al Noor", kind: "Dining", off: 30, image: "/img/dining-3.webp" },
];

export const BANNERS = [
  { kicker: "Exclusive renter benefits", title: "A little more luxury.", text: "Enjoy 30% off at Al Noor Restaurant.", cta: "Explore benefit", to: "/book", image: "/img/banner-luxury.webp" },
  { kicker: "Monthly plans", title: "Drive more, pay less.", text: "Save up to 40% with a monthly rental.", cta: "See monthly cars", to: "/book?period=monthly", image: "/img/banner-monthly.webp" },
];

export const EXTRAS = [
  { id: "full_cover", label: "Full insurance cover", daily: 45 },
  { id: "extra_driver", label: "Additional driver", daily: 25 },
  { id: "child_seat", label: "Child seat", daily: 15 },
];
