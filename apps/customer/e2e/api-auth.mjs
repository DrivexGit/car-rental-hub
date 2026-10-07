// API test for api/auth.ts rate limiting, with PostgREST faked in-process (no network, no real project).
// Run from apps/customer: node e2e/api-auth.mjs
import { createServer } from "vite";

Object.assign(process.env, {
  SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon",
  TENANT_ID: "t", AUTH_SECRET: "secret", OTP_TEST_CODE: "123456",
});

const rows = [];
let failTable = false; // simulate "migration not applied"
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  const json = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  if (u.pathname === "/rest/v1/auth_attempts") {
    if (failTable) return json(404, { code: "42P01", message: "relation does not exist" });
    const q = (k) => { const v = u.searchParams.get(k); return v?.startsWith("eq.") ? v.slice(3) : v?.startsWith("gte.") ? v.slice(4) : null; };
    if (req.method === "POST") { rows.push({ ...(await req.json()), created_at: new Date().toISOString() }); return json(201, undefined); }
    if (req.method === "DELETE") return json(204, undefined);
    const n = rows.filter((r) => (!q("kind") || r.kind === q("kind")) && (!u.searchParams.get("phone") || r.phone === q("phone")) && (!u.searchParams.get("ip") || r.ip === q("ip"))).length;
    return json(200, [], { "content-range": `*/${n}` });
  }
  if (u.pathname === "/rest/v1/customers") return json(200, { id: "c1" }); // existing customer
  return json(400, { error_description: "stub" }); // password sign-in etc.
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error", resolve: { alias: {} } });
const { POST } = await s.ssrLoadModule("/api/auth.ts");
const call = async (body, ip = "203.0.113.5") => {
  const r = await POST(new Request("http://local/api/auth", { method: "POST", headers: { "x-forwarded-for": ip + ", 10.0.0.1" }, body: JSON.stringify(body) }));
  return r.status;
};

const results = [];
const check = (name, got, want) => results.push({ name, ok: got === want, got, want });
const PHONE = "+971501234567";

// send: 5 per phone per 10 minutes
for (let i = 1; i <= 5; i++) check(`send #${i} allowed`, await call({ action: "send", phone: PHONE }), 200);
check("send #6 blocked (429)", await call({ action: "send", phone: PHONE }), 429);
check("another phone is not affected", await call({ action: "send", phone: "+971509999999" }), 200);

// verify: 5 wrong guesses per phone, then locked, even with the right code
const P2 = "+971502222222";
for (let i = 1; i <= 5; i++) check(`wrong code #${i} -> 401`, await call({ action: "verify", phone: P2, code: "000000" }), 401);
check("6th attempt locked (429)", await call({ action: "verify", phone: P2, code: "000000" }), 429);
check("locked even with the right code (429)", await call({ action: "verify", phone: P2, code: "123456" }), 429);

// right code for a fresh phone gets past the code check (stubbed sign-in then fails with 500, which is fine here)
const st = await call({ action: "verify", phone: "+971503333333", code: "123456" });
check("right code is not rejected as 401/429", st !== 401 && st !== 429, true);

// per-IP limit across different phones: 20 sends per hour
let blocked = false;
for (let i = 0; i < 25; i++) if ((await call({ action: "send", phone: `+97150${String(4000000 + i)}` }, "198.51.100.9")) === 429) blocked = true;
check("per-IP send limit kicks in", blocked, true);

// fail open when the table is missing, so sign-in is not broken before the migration is applied
failTable = true;
const quiet = console.error; console.error = () => {};
check("send still works if auth_attempts is missing", await call({ action: "send", phone: "+971505555555" }), 200);
console.error = quiet;

console.log(results.map((r) => (r.ok ? "PASS  " : "FAIL  ") + r.name + (r.ok ? "" : `   -> got ${r.got}, want ${r.want}`)).join("\n"));
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
await s.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
