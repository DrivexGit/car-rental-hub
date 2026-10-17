// API test for api/book.ts: how the server prices a booking (extras, deposit option, offers) with Supabase faked in-process.
// Nothing real is written. Run from apps/customer: node e2e/api-book.mjs
import { createServer } from "vite";

Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon", TENANT_ID: "t1", AUTH_SECRET: "s" });

const CUSTOMER = { id: "c1", tenant_id: "t1", lead_id: "lead1", phone: "+971501234567", full_name: "Test Customer", email: "test.customer@example.com" };
const CARS = [1, 2].map((i) => ({ id: `v${i}`, make: "Mercedes", model: "GLE 53", plate_number: `A ${i}`, daily_price: 1000, weekly_price: 6000, monthly_price: 20000, status: "available" }));
const DOCS = [{ document_type: "id_card", verification_status: "approved" }, { document_type: "driving_license", verification_status: "pending" }];
const state = { offer: null, reservations: [], invoices: [], items: [], docs: DOCS, noLead: false, noEmail: false, payMonthly: false, docsError: false, docsQuery: "" };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  if (u.pathname === "/auth/v1/user") return req.headers.get("authorization") === "Bearer good" ? json(200, { id: "c1", aud: "authenticated" }) : json(401, { msg: "bad jwt" });
  const table = u.pathname.split("/").pop();
  if (table === "customers") return json(200, state.noLead ? { ...CUSTOMER, lead_id: null } : state.noEmail ? { ...CUSTOMER, email: null } : state.payMonthly ? { ...CUSTOMER, pay_monthly: true } : CUSTOMER);
  if (table === "customer_documents") { state.docsQuery = u.search; return state.docsError ? json(500, { message: "db is down" }) : json(200, state.docs); }
  if (table === "vehicles") return json(200, CARS);
  if (table === "offers") return state.offer ? json(200, { discount_pct: state.offer }) : json(406, { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" });
  if (table === "reservations" && req.method === "POST") { const row = await req.json(); state.reservations.push(row); return json(201, { id: "r1" }); }
  if (table === "invoices" && req.method === "POST") { const row = await req.json(); state.invoices.push(row); return json(201, { id: "i1" }); }
  if (table === "invoice_items" && req.method === "POST") { const rows = await req.json(); state.items.push(...(Array.isArray(rows) ? rows : [rows])); return json(201, []); }
  return json(200, []);
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { POST } = await s.ssrLoadModule("/api/book.ts");
const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
async function book(body, { token = "good", offer = null, docs = null, noLead = false, noEmail = false, payMonthly = false, docsError = false } = {}) {
  Object.assign(state, { offer, reservations: [], invoices: [], items: [], docs: docs ?? DOCS, noLead, noEmail, payMonthly, docsError });
  const r = await POST(new Request("http://local/api/book", { method: "POST", headers: { authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ modelId: "mercedes-gle-53", pickup: tomorrow, terms: true, ...body }) }));
  return { status: r.status, body: await r.json(), row: state.reservations[0], inv: state.invoices[0] };
}

check("no token -> 401", (await book({ period: "daily", qty: 1 }, { token: "" })).status === 401);

{ const r = await book({ period: "daily", qty: 3 });
  check("no extras: rental only (3 days x 1000)", r.status === 200 && r.body.total === 3000 && r.row.total_amount === 3000 && r.inv.amount === 3000, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["full_cover"] });
  check("full coverage insurance = 15% of the rental (450 on 3000)", r.body.total === 3450 && r.row.extras.join() === "full_cover", JSON.stringify(r.body)); }
{ const r = await book({ period: "weekly", qty: 1, extras: ["full_cover"] });
  check("full coverage insurance follows the plan (15% of 6000 = 900)", r.body.total === 6900, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["full_cover"] }, { offer: 20 });
  check("insurance is taken on the price after an offer (2400 + 360)", r.body.total === 2760, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["extra_driver"] });
  check("additional driver: 25 per day on a daily rental", r.body.total === 3075, JSON.stringify(r.body)); }
{ const r = await book({ period: "weekly", qty: 1, extras: ["extra_driver"] });
  check("additional driver: 25 per day on a weekly rental (7 days = 175)", r.body.total === 6175, JSON.stringify(r.body)); }
{ const r = await book({ period: "monthly", qty: 1, extras: ["extra_driver"] });
  check("additional driver: flat 300 for a monthly rental", r.body.total === 20300, JSON.stringify(r.body)); }
{ const r = await book({ period: "monthly", qty: 2, extras: ["extra_driver"] });
  check("additional driver: 300 for each month (2 months = 600)", r.body.total === 40600, JSON.stringify(r.body)); }
{ const r = await book({ period: "weekly", qty: 1, extras: ["child_seat"] });
  check("child seat: 15 per day (7 days = 105)", r.body.total === 6105, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["no_deposit"] });
  check("no deposit: a flat 200 fee, stored with the booking", r.body.total === 3200 && r.row.extras.join() === "no_deposit", JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["full_cover", "extra_driver", "no_deposit"] });
  check("extras add up (3000 + 450 + 75 + 200)", r.body.total === 3725, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["full_cover", "full_cover", "bogus", 7, null] });
  check("duplicates are charged once, unknown ids are dropped", r.body.total === 3450 && r.row.extras.join() === "full_cover", JSON.stringify(r.row?.extras)); }
{ const r = await book({ period: "daily", qty: 3, extras: "full_cover" });
  check("extras that is not a list is ignored, not a crash", r.status === 200 && r.body.total === 3000, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 3, extras: ["full_cover"], total: 1 });
  check("a total sent by the client is ignored", r.body.total === 3450); }

// Documents are required before a booking is created
{ const none = await book({ period: "daily", qty: 1 }, { docs: [] });
  check("no documents -> 403 and nothing is created", none.status === 403 && !none.row && !none.inv, JSON.stringify(none.body)); }
{ const r = await book({ period: "daily", qty: 1 }, { docs: [{ document_type: "id_card", verification_status: "approved" }] });
  check("only an ID, no driving licence -> 403", r.status === 403 && !r.row); }
{ const r = await book({ period: "daily", qty: 1 }, { docs: [{ document_type: "driving_license", verification_status: "approved" }] });
  check("only a driving licence, no ID -> 403", r.status === 403 && !r.row); }
{ const r = await book({ period: "daily", qty: 1 }, { docs: [{ document_type: "id_card", verification_status: "rejected" }, { document_type: "driving_license", verification_status: "approved" }] });
  check("a rejected ID counts as missing -> 403", r.status === 403 && !r.row); }
{ const r = await book({ period: "daily", qty: 1 }, { docs: [{ document_type: "passport", verification_status: "pending" }, { document_type: "driving_license", verification_status: "pending" }] });
  check("passport + driving licence waiting for review -> booking allowed", r.status === 200 && !!r.row, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 1 }, { docs: [{ document_type: "visa", verification_status: "approved" }, { document_type: "other", verification_status: "approved" }] });
  check("a visa or other file alone is not enough -> 403", r.status === 403); }

// The customer must tick the Terms at checkout: without it there is no booking, and with it the version and time are kept
{ const r = await book({ period: "daily", qty: 1, terms: false });
  check("terms not accepted -> 400, nothing created", r.status === 400 && /accept the terms/i.test(r.body.error) && !r.row, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 1 });
  check("accepted terms are stored with their version and time", r.status === 200 && r.row?.terms_version === "2026-10" && !!r.row?.terms_accepted_at, JSON.stringify(r.row)); }
// invoice rows: one per charge, VAT per row, and they add up to the invoice total
{ const r = await book({ period: "daily", qty: 3, extras: ["full_cover", "extra_driver", "no_deposit"] });
  const row = (c) => state.items.find((i) => i.category === c);
  const sum = Math.round(state.items.reduce((s, i) => s + i.amount, 0));
  check("invoice rows add up to the invoice total (3,000 + 450 + 75 + 200)", r.status === 200 && sum === r.body.total && sum === 3725, JSON.stringify({ sum, total: r.body.total, items: state.items }));
  check("rental and no-deposit carry 5% VAT, full cover none", row("rental")?.vat_rate === 0.05 && row("no_deposit")?.vat_rate === 0.05 && row("insurance")?.vat_rate === 0, JSON.stringify(state.items)); }
{ const r = await book({ period: "daily", qty: 3 }, { offer: 20 });
  const rental = state.items.find((i) => i.category === "rental");
  check("an offer is a discount row: 2,400 charged, 600 off", r.status === 200 && rental?.amount === 2400 && rental?.discount === 600, JSON.stringify(rental)); }

// "Pay at month end": the booking is confirmed straight away and the response says there is no payment step
{ const r = await book({ period: "daily", qty: 1 }, { payMonthly: true });
  check("pay-at-month-end customer -> confirmed booking with payLater", r.status === 200 && r.row?.status === "confirmed" && r.body.payLater === true, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 1 });
  check("normal customer -> pending booking, payLater false", r.status === 200 && r.row?.status === "pending" && r.body.payLater === false, JSON.stringify(r.body)); }

// No email on the account -> 409 asking for one, before any car is picked
{ const r = await book({ period: "daily", qty: 1 }, { noEmail: true });
  check("customer without an email -> 409 'add your email', nothing created", r.status === 409 && /add your email/i.test(r.body.error) && !r.row, JSON.stringify(r.body)); }

// A customer without a lead cannot upload documents, so that is a set-up problem (409), not "no documents"; a database error is a 500
{ const r = await book({ period: "daily", qty: 1 }, { noLead: true });
  check("customer without a lead -> 409 'not fully set up', not a documents error", r.status === 409 && /not fully set up/.test(r.body.error) && !r.row, JSON.stringify(r.body)); }
{ const r = await book({ period: "daily", qty: 1 }, { docsError: true });
  check("a database error while reading documents -> 500, not 'upload documents'", r.status === 500 && /db is down/.test(r.body.error) && !r.row, JSON.stringify(r.body)); }
{ await book({ period: "daily", qty: 1 });
  check("documents are read for this lead and this tenant only", /lead_id=eq\.lead1/.test(state.docsQuery) && /tenant_id=eq\.t1/.test(state.docsQuery), state.docsQuery); }

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "  -> " + r.extra}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
