// Billing rules for the monthly jobs, kept free of database calls so they can be tested.
// Times are UAE time (UTC+4, no daylight saving).

const UAE = 4 * 3600_000;
export const SALIK_KINDS = ["salik", "salik_parking"];

export type FineRow = { id: string; tenant_id: string; customer_id: string; type: string; amount: number; occurred_at: string };
export type RentalInvoice = { id: string; tenant_id: string; customer_id: string; amount: number; issued_at: string; consolidated_into: string | null; status: string };
export type Plan = { tenant_id: string; customer_id: string; amount: number; description: string; ids: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The calendar month before `now`, in UAE time: [start, end) as ISO strings, and a label such as "September 2026". */
export function previousMonth(now: Date) {
  const d = new Date(now.getTime() + UAE);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1) - UAE).toISOString();
  const end = new Date(Date.UTC(y, m, 1) - UAE).toISOString();
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, label };
}

/** Today's date in UAE time, as YYYY-MM-DD. */
export const uaeToday = (now = new Date()) => new Date(now.getTime() + UAE).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * 86400_000).toISOString().slice(0, 10);

/** Salik and parking fines of the month: one invoice per customer, for the whole month. */
export function planSalik(fines: FineRow[], label: string): Plan[] {
  const groups = new Map<string, Plan>();
  for (const f of fines) {
    if (!SALIK_KINDS.includes(f.type)) continue;
    const key = `${f.tenant_id}|${f.customer_id}`;
    const g = groups.get(key) ?? { tenant_id: f.tenant_id, customer_id: f.customer_id, amount: 0, description: `Salik and parking, ${label}`, ids: [] };
    g.amount = round2(g.amount + Number(f.amount));
    g.ids.push(f.id);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.amount > 0);
}

/** "Pay at month end" customers: their open rental invoices of the month become one invoice. */
export function planConsolidation(invoices: RentalInvoice[], payMonthly: Set<string>, label: string): Plan[] {
  const groups = new Map<string, Plan>();
  for (const i of invoices) {
    if (i.status !== "pending" || i.consolidated_into || !payMonthly.has(i.customer_id)) continue;
    const key = `${i.tenant_id}|${i.customer_id}`;
    const g = groups.get(key) ?? { tenant_id: i.tenant_id, customer_id: i.customer_id, amount: 0, description: `Rentals, ${label}`, ids: [] };
    g.amount = round2(g.amount + Number(i.amount));
    g.ids.push(i.id);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.amount > 0);
}
