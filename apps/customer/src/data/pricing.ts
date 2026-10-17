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

/** How each extra appears as a row on the invoice: its category and VAT rate. Insurance carries no VAT; the rest carry 5%. */
export const EXTRA_LINE: Record<string, { category: string; vatRate: number }> = {
  full_cover: { category: "insurance", vatRate: 0 },
  extra_driver: { category: "extra_driver", vatRate: 0.05 },
  child_seat: { category: "child_seat", vatRate: 0.05 },
  no_deposit: { category: "no_deposit", vatRate: 0.05 },
};

/** The standard VAT rate. The prices in the app already include it: the VAT is worked out from the total. */
export const RENTAL_VAT = 0.05;
/** VAT inside a VAT-inclusive amount, rounded to the fil. */
export const vatIn = (gross: number, rate: number) => (rate > 0 ? Math.round((gross - Math.round((gross / (1 + rate)) * 100) / 100) * 100) / 100 : 0);

/** The charge for a rental: the rental and its extras, each at its own VAT rate. `total` is what the customer pays (VAT included); `vat` is the VAT inside it. */
export function priceWithVat(base: number, extras: string[], input: PriceInput) {
  const rows = [
    { gross: base, rate: RENTAL_VAT },
    ...extras.filter((id) => id in EXTRA_LINE).map((id) => ({ gross: extraCost(id, input), rate: EXTRA_LINE[id].vatRate })),
  ];
  const total = Math.round(rows.reduce((s, r) => s + r.gross, 0) * 100) / 100;
  const vat = Math.round(rows.reduce((s, r) => s + vatIn(r.gross, r.rate), 0) * 100) / 100;
  return { net: Math.round((total - vat) * 100) / 100, vat, total };
}
