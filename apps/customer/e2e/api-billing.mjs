// Tests for the monthly billing rules (api/_billing.ts) and the cron routes' sign-in check. Nothing is read from or written to a database.
// Run from apps/customer: node e2e/api-billing.mjs
import { createServer } from "vite";

Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon", TENANT_ID: "t1", AUTH_SECRET: "s", CRON_SECRET: "cron-secret-for-tests" });

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const billing = await s.ssrLoadModule("/api/_billing.ts");
const monthly = await s.ssrLoadModule("/api/cron-monthly.ts");
const expiry = await s.ssrLoadModule("/api/cron-expiry.ts");

const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra: typeof extra === "string" ? extra : JSON.stringify(extra) });

// Previous calendar month in UAE time
{ const w = billing.previousMonth(new Date("2026-10-01T01:00:00Z"));
  check("the month before 1 October (UAE) is September 2026", w.label === "September 2026" && w.start === "2026-08-31T20:00:00.000Z" && w.end === "2026-09-30T20:00:00.000Z", w); }

// Dates in UAE time
check("UAE date: 15 Oct 21:30 UTC is already 16 Oct in Dubai", billing.uaeToday(new Date("2026-10-15T21:30:00Z")) === "2026-10-16");
check("adding 30 days to 15 Oct gives 14 Nov", billing.addDays("2026-10-15", 30) === "2026-11-14");

// Salik: one invoice per customer for the whole month
{ const fines = [
    { id: "f1", tenant_id: "t", customer_id: "c1", type: "salik", amount: 4, occurred_at: "2026-09-02T08:00:00Z" },
    { id: "f2", tenant_id: "t", customer_id: "c1", type: "salik_parking", amount: 10.5, occurred_at: "2026-09-12T08:00:00Z" },
    { id: "f3", tenant_id: "t", customer_id: "c2", type: "salik", amount: 4, occurred_at: "2026-09-03T08:00:00Z" },
    { id: "f4", tenant_id: "t", customer_id: "c2", type: "traffic", amount: 300, occurred_at: "2026-09-04T08:00:00Z" },
    { id: "f5", tenant_id: "t", customer_id: "c3", type: "salik", amount: 0, occurred_at: "2026-09-05T08:00:00Z" },
  ];
  const plans = billing.planSalik(fines, "September 2026");
  const c1 = plans.find((p) => p.customer_id === "c1");
  check("Salik of one customer becomes one invoice with the sum", plans.length === 2 && c1?.amount === 14.5 && c1.ids.join() === "f1,f2", plans);
  check("a fine is not Salik and is left for a person", !plans.some((p) => p.ids.includes("f4")), plans);
  check("a zero amount is not billed", !plans.some((p) => p.customer_id === "c3"), plans);
  check("the invoice says which month it is for", c1?.description === "Salik and parking, September 2026", c1); }

// Pay at month end: rental invoices of those customers only, and only once
{ const invoices = [
    { id: "i1", tenant_id: "t", customer_id: "c1", amount: 1000, issued_at: "2026-09-10T00:00:00Z", consolidated_into: null, status: "pending" },
    { id: "i2", tenant_id: "t", customer_id: "c1", amount: 500, issued_at: "2026-09-20T00:00:00Z", consolidated_into: null, status: "pending" },
    { id: "i3", tenant_id: "t", customer_id: "c1", amount: 700, issued_at: "2026-09-21T00:00:00Z", consolidated_into: "x", status: "pending" },
    { id: "i4", tenant_id: "t", customer_id: "c1", amount: 300, issued_at: "2026-09-22T00:00:00Z", consolidated_into: null, status: "paid" },
    { id: "i5", tenant_id: "t", customer_id: "c9", amount: 800, issued_at: "2026-09-22T00:00:00Z", consolidated_into: null, status: "pending" },
  ];
  const plans = billing.planConsolidation(invoices, new Set(["c1"]), "September 2026");
  check("pay-at-month-end customer: open invoices become one, the rest are left alone", plans.length === 1 && plans[0].amount === 1500 && plans[0].ids.join() === "i1,i2" && plans[0].description === "Rentals, September 2026", plans);
  check("a customer who pays per booking is not billed here", !plans.some((p) => p.customer_id === "c9"), plans); }

// The cron routes refuse anyone without the secret
for (const [name, route] of [["monthly", monthly], ["expiry", expiry]]) {
  const none = await route.GET(new Request("http://local/api/cron"));
  const wrong = await route.GET(new Request("http://local/api/cron", { headers: { authorization: "Bearer nope" } }));
  check(`cron ${name}: no secret -> 401`, none.status === 401);
  check(`cron ${name}: wrong secret -> 401`, wrong.status === 401);
}

const failed = results.filter((x) => !x.pass);
for (const x of results) console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.pass ? "" : `  -> ${x.extra}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
