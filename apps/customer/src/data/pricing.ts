// Extras and their prices. One source for the server (api/book.ts decides the real price) and for the app (the quote it shows before paying),
// so the two cannot drift apart. It lives in src/ (not api/) because the dev server and tests treat /api/* as server routes.
// No imports on purpose: it is bundled into the browser as well.

export const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 } as const;
export type Period = keyof typeof PERIOD_DAYS;

/** Full coverage insurance costs this percentage of the rental price (after any offer). */
export const FULL_COVER_PCT = 15;
/** Additional driver: per day, but a flat fee per month on a monthly rental. */
export const DRIVER_DAILY = 25;
export const DRIVER_MONTHLY = 300;
export const CHILD_SEAT_DAILY = 15;
/** Security deposit: 1,000 is blocked on the card at pickup, or the customer pays this fee once and nothing is blocked. */
export const DEPOSIT_AMOUNT = 1000;
export const NO_DEPOSIT_FEE = 200;

export const EXTRA_LABELS: Record<string, string> = {
  full_cover: "Full coverage insurance",
  extra_driver: "Additional driver",
  child_seat: "Child seat",
  no_deposit: "No deposit",
};
/** Ids a customer can pick as ordinary extras (no_deposit is chosen separately, as the deposit option). */
export const PICKABLE_EXTRAS = ["full_cover", "extra_driver", "child_seat"] as const;

export type PriceInput = { base: number; period: Period; qty: number };

/** What one extra costs for this rental. `base` is the rental price after any offer. Unknown ids cost nothing. */
export function extraCost(id: string, { base, period, qty }: PriceInput): number {
  const days = PERIOD_DAYS[period] * qty;
  switch (id) {
    case "full_cover": return Math.round((base * FULL_COVER_PCT) / 100);
    case "extra_driver": return period === "monthly" ? DRIVER_MONTHLY * qty : DRIVER_DAILY * days;
    case "child_seat": return CHILD_SEAT_DAILY * days;
    case "no_deposit": return NO_DEPOSIT_FEE;
    default: return 0;
  }
}

export const isExtra = (id: string) => id in EXTRA_LABELS;

export function extrasTotal(ids: string[], input: PriceInput): number {
  return ids.reduce((s, id) => s + extraCost(id, input), 0);
}
