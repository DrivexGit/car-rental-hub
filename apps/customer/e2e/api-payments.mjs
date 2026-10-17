// API tests for the payment routes (api/pay.ts, api/stripe-webhook.ts) and the WhatsApp one-time code (api/auth.ts + api/_whatsapp-otp.ts).
// Supabase, Stripe and WhatsApp are faked in-process (no network). Run from apps/customer: node e2e/api-payments.mjs
import { createServer } from "vite";
import { createHmac } from "node:crypto";

Object.assign(process.env, {
  SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon",
  TENANT_ID: "t", AUTH_SECRET: "secret", OTP_TEST_CODE: "000000",
});
delete process.env.STRIPE_SECRET_KEY; delete process.env.ZIINA_API_KEY; delete process.env.ALLOW_TEST_PAYMENTS;
delete process.env.STRIPE_WEBHOOK_SECRET; delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID; delete process.env.WHATSAPP_OTP_TEMPLATE;

// ---- a small PostgREST in memory -------------------------------------------------------------
let db;
const sample = () => ({
  customers: [{ id: "c1", tenant_id: "t", phone: "+971501234567", full_name: "Test Customer", email: "t@example.com", lead_id: null }],
  invoices: [{ id: "i1", tenant_id: "t", customer_id: "c1", reservation_id: null, number: "INV-1", amount: 500, status: "pending", consolidated_into: null, description: "Traffic fine", issued_at: new Date().toISOString(), paid_at: null }],
  payments: [],
  otp_codes: [],
  reservations: [],
});
const reset = () => { db = sample(); };

const cmp = (row, k, op, val) => {
  const v = row[k];
  if (op === "is") return val === "null" ? v == null : String(v) === val;
  if (op === "in") return val.slice(1, -1).split(",").includes(String(v));
  if (op === "eq") return String(v ?? "null") === val;
  if (op === "neq") return String(v ?? "null") !== val;
  if (op === "gte" || op === "lt") { const a = Date.parse(v), b = Date.parse(val); return op === "gte" ? a >= b : a < b; }
  return false;
};
const match = (rows, u) => rows.filter((row) => [...u.searchParams].every(([k, v]) => {
  if (["select", "order", "limit", "offset"].includes(k)) return true;
  const i = v.indexOf("."); return cmp(row, k, v.slice(0, i), v.slice(i + 1));
}));

const realFetch = globalThis.fetch;
const stripe = { paid: false, calls: 0 };
const whatsapp = { bodies: [] };
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  if (u.hostname === "api.stripe.com") {
    if (u.pathname === "/v1/checkout/sessions" && req.method === "POST") {
      stripe.calls++;
      const form = new URLSearchParams(await req.text());
      return json(200, { id: `cs_${stripe.calls}`, url: `https://checkout.stripe.test/cs_${stripe.calls}`, client_reference_id: form.get("client_reference_id") });
    }
    if (u.pathname.startsWith("/v1/checkout/sessions/")) {
      const id = u.pathname.split("/").pop();
      const pay = db.payments.find((p) => p.provider_ref === id);
      return json(200, { id, payment_status: stripe.paid ? "paid" : "unpaid", client_reference_id: pay?.id ?? null });
    }
    return json(404, { error: { message: "stub" } });
  }
  if (u.hostname === "graph.facebook.com") {
    whatsapp.bodies.push(JSON.parse(await req.text()));
    return json(200, { messages: [{ id: "wamid.1" }] });
  }
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);

  if (u.pathname === "/auth/v1/user") return req.headers.get("authorization") === "Bearer good" ? json(200, { id: "c1" }) : json(401, { message: "bad token" });
  if (u.pathname === "/auth/v1/token") return json(200, { access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: 3600, user: { id: "c1" } });
  if (u.pathname === "/rest/v1/auth_attempts") return req.method === "POST" ? json(201) : json(200, []);
  if (!u.pathname.startsWith("/rest/v1/")) return json(404, { message: "stub" });

  const table = u.pathname.split("/").pop();
  const rows = db[table];
  if (!rows) return json(404, { code: "42P01", message: `no table ${table}` });
  const object = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
  const sendRep = (req.headers.get("prefer") || "").includes("return=representation");
  const shape = (list) => (object ? (list.length ? list[0] : (() => { throw "none"; })()) : list);
  try {
    if (req.method === "POST") {
      const body = await req.json();
      // column defaults as in the migrations: payments start pending, codes start with no tries
      const defaults = table === "payments" ? { status: "pending" } : table === "otp_codes" ? { attempts: 0 } : {};
      const list = (Array.isArray(body) ? body : [body]).map((b) => ({ id: globalThis.crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...b }));
      rows.push(...list);
      return sendRep ? json(201, object ? list[0] : list) : json(201);
    }
    if (req.method === "PATCH") {
      const hit = match(rows, u);
      const patch = await req.json();
      hit.forEach((r) => Object.assign(r, patch));
      return sendRep ? json(200, object ? shape(hit) : hit) : json(204);
    }
    if (req.method === "DELETE") {
      const hit = match(rows, u);
      for (const r of hit) rows.splice(rows.indexOf(r), 1);
      return json(204);
    }
    let list = match(rows, u);
    const order = u.searchParams.get("order");
    if (order) { const [k, dir] = order.split("."); list = [...list].sort((a, b) => (a[k] > b[k] ? 1 : -1) * (dir === "desc" ? -1 : 1)); }
    const limit = u.searchParams.get("limit"); if (limit) list = list.slice(0, Number(limit));
    if (object && list.length === 0) return json(406, { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" });
    return json(200, object ? list[0] : list);
  } catch (e) {
    return json(406, { code: "PGRST116", message: "none" });
  }
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error", resolve: { alias: {} } });
const { POST: pay } = await s.ssrLoadModule("/api/pay.ts");
const { POST: webhook } = await s.ssrLoadModule("/api/stripe-webhook.ts");
const { POST: auth } = await s.ssrLoadModule("/api/auth.ts");

const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok: !!ok, extra: typeof extra === "string" ? extra : JSON.stringify(extra) });
const startPay = (invoiceId = "i1") => pay(new Request("http://local/api/pay", { method: "POST", headers: { authorization: "Bearer good" }, body: JSON.stringify({ action: "start", invoiceId, returnUrl: "https://app.test/invoice" }) }));
const confirmPay = (paymentId) => pay(new Request("http://local/api/pay", { method: "POST", headers: { authorization: "Bearer good" }, body: JSON.stringify({ action: "confirm", paymentId }) }));
const signed = (raw, secret, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;
const hook = (raw, header) => webhook(new Request("http://local/api/stripe-webhook", { method: "POST", headers: header ? { "stripe-signature": header } : {}, body: raw }));
const invoice = () => db.invoices.find((i) => i.id === "i1");
const post = (body, ip = "203.0.113.9") => auth(new Request("http://local/api/auth", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) }));

// ---- payments ---------------------------------------------------------------------------------
reset();
{ const r = await startPay();
  check("no payment provider and no ALLOW_TEST_PAYMENTS -> 503, nothing is paid", r.status === 503 && invoice().status === "pending" && db.payments.length === 0, await r.text()); }
process.env.ALLOW_TEST_PAYMENTS = "true";
reset();
{ const r = await startPay(); const b = await r.json();
  check("test payment allowed only with ALLOW_TEST_PAYMENTS=true -> paid", r.status === 200 && b.paid === true && invoice().status === "paid", JSON.stringify(b)); }
delete process.env.ALLOW_TEST_PAYMENTS;

process.env.STRIPE_SECRET_KEY = "sk_test_fake";
reset(); stripe.paid = false;
let payId;
{ const r = await startPay(); const b = await r.json();
  payId = db.payments[0]?.id;
  check("Stripe: start returns a Checkout page and stores the session", r.status === 200 && /checkout\.stripe\.test/.test(b.url) && db.payments[0]?.provider === "stripe" && db.payments[0]?.provider_ref === "cs_1" && db.payments[0]?.status === "pending", JSON.stringify(b)); }
{ const r = await startPay();
  check("Stripe: a second checkout while one is pending -> 409, nothing new created", r.status === 409 && db.payments.length === 1, await r.text()); }
{ stripe.paid = false; const r = await confirmPay(payId); const b = await r.json();
  check("Stripe: confirm before paying -> not paid", r.status === 200 && b.paid === false && invoice().status === "pending", JSON.stringify(b)); }
{ stripe.paid = true; const r = await confirmPay(payId); const b = await r.json();
  check("Stripe: confirm after paying -> invoice paid, payment succeeded", r.status === 200 && b.paid === true && invoice().status === "paid" && db.payments[0].status === "succeeded", JSON.stringify(b)); }
delete process.env.STRIPE_SECRET_KEY;

// ---- webhook ------------------------------------------------------------------------------------
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
reset(); stripe.paid = false;
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
await startPay(); // creates a pending Stripe payment for i1
const pid = db.payments[0].id;
const event = (paid = true, id = pid) => JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: paid ? "paid" : "unpaid", client_reference_id: id } } });
{ const r = await hook(event(), undefined);
  check("webhook: no signature -> 400, nothing changes", r.status === 400 && invoice().status === "pending"); }
{ const raw = event(); const r = await hook(raw, signed(raw, "whsec_wrong"));
  check("webhook: wrong secret -> 400, nothing changes", r.status === 400 && invoice().status === "pending"); }
{ const raw = event(); const r = await hook(raw, signed(raw, "whsec_test", Math.floor(Date.now() / 1000) - 3600));
  check("webhook: old timestamp (more than 5 minutes) -> 400", r.status === 400 && invoice().status === "pending"); }
{ const raw = event(false); const r = await hook(raw, signed(raw, "whsec_test"));
  check("webhook: unpaid session -> ignored", r.status === 200 && invoice().status === "pending"); }
{ const raw = event(); const r = await hook(raw, signed(raw, "whsec_test"));
  check("webhook: valid paid event -> payment succeeded and invoice paid", r.status === 200 && db.payments[0].status === "succeeded" && invoice().status === "paid", await r.text()); }
{ const raw = event(); const r = await hook(raw, signed(raw, "whsec_test"));
  check("webhook: the same event again -> nothing counted twice", r.status === 200 && db.payments.length === 1 && db.payments[0].status === "succeeded"); }
delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET;

// ---- WhatsApp one-time code -----------------------------------------------------------------------
process.env.WHATSAPP_TOKEN = "wa_test"; process.env.WHATSAPP_PHONE_NUMBER_ID = "123"; process.env.WHATSAPP_OTP_TEMPLATE = "drivex_otp";
const PHONE = "+971501234567";
const sendCode = async () => { whatsapp.bodies.length = 0; const r = await post({ action: "send", phone: PHONE }); const b = await r.json(); const sent = whatsapp.bodies.at(-1); return { status: r.status, body: b, code: sent?.template?.components?.[0]?.parameters?.[0]?.text, sent }; };
const verify = (code) => post({ action: "verify", phone: PHONE, code });

reset();
{ const s1 = await sendCode();
  check("WhatsApp: send goes out as the authentication template with a 6-digit code", s1.status === 200 && s1.body.testMode === false && s1.sent?.type === "template" && s1.sent?.template?.name === "drivex_otp" && /^\d{6}$/.test(s1.code) && s1.sent.to === PHONE.slice(1), JSON.stringify(s1.sent)); }
{ const v = await verify("999999");
  check("WhatsApp: wrong code -> 401", v.status === 401); }
{ const s1 = await sendCode(); const v = await verify(s1.code);
  check("WhatsApp: right code -> signed in", v.status === 200 && (await v.json()).access_token === "a"); }
{ const s1 = await sendCode(); const code = s1.code; // a second send replaces the first
  const s2 = await sendCode(); const old = await verify(code); const ok = await verify(s2.code);
  check("WhatsApp: a new code replaces the old one", old.status === 401 && ok.status === 200, `old ${old.status}, new ${ok.status}`); }
{ const s1 = await sendCode();
  for (let i = 0; i < 5; i++) await verify("000001");
  const v = await verify(s1.code);
  check("WhatsApp: after five wrong tries even the right code is refused", v.status === 401, v.status); }
{ const s1 = await sendCode();
  db.otp_codes.forEach((c) => { c.expires_at = new Date(Date.now() - 1000).toISOString(); });
  const v = await verify(s1.code);
  check("WhatsApp: an expired code is refused", v.status === 401, v.status); }
{ const s1 = await sendCode(); const first = await verify(s1.code); const again = await verify(s1.code);
  check("WhatsApp: a used code cannot be used again", first.status === 200 && again.status === 401, again.status); }
delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID; delete process.env.WHATSAPP_OTP_TEMPLATE;
{ reset();
  const r = await post({ action: "verify", phone: PHONE, code: "000000" });
  check("without WhatsApp settings the test code still signs in", r.status === 200, r.status); }

const failed = results.filter((x) => !x.ok);
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.ok ? "" : `  -> ${x.extra}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
