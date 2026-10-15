// API test for api/doc-check.ts: the AI check of an uploaded document, with Supabase and the AI faked in-process.
// Nothing real is written or sent. Run from apps/customer: node e2e/api-doc-check.mjs
import { createServer } from "vite";

Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon", TENANT_ID: "t1", AUTH_SECRET: "s", AI_BASE_URL: "https://fake-ai.test/v1", AI_API_KEY: "test" });

const CUSTOMER = { id: "c1", tenant_id: "t1", lead_id: "lead1", phone: "+971501234567", full_name: "Test Customer", email: "t@example.com" };
const DOC = { id: "d1", tenant_id: "t1", lead_id: "lead1", document_type: "driving_license", storage_bucket: "customer-documents", storage_path: "c1/dl.jpg", mime_type: "image/jpeg", verification_status: "pending" };
const state = { doc: DOC, ai: null, aiDown: false, aiCalls: 0, updates: [], notes: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.hostname === "fake-ai.test") {
    state.aiCalls++;
    if (state.aiDown) return new Response("upstream down", { status: 503 });
    return json(200, { choices: [{ message: { content: JSON.stringify(state.ai) } }] });
  }
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  if (u.pathname === "/auth/v1/user") return req.headers.get("authorization") === "Bearer good" ? json(200, { id: "c1", aud: "authenticated" }) : json(401, { msg: "bad jwt" });
  if (u.pathname.includes("/storage/v1/object/")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
  const table = u.pathname.split("/").pop();
  if (table === "customers") return json(200, CUSTOMER);
  if (table === "customer_documents") {
    if (req.method === "PATCH") { state.updates.push(await req.json()); return json(200, []); }
    const doc = state.doc && u.searchParams.get("id") === "eq.d1" ? state.doc : null;
    if (!doc) return json(200, []);
    return (req.headers.get("accept") || "").includes("pgrst.object") ? json(200, doc) : json(200, [doc]);
  }
  if (table === "notifications" && req.method === "POST") { state.notes.push(await req.json()); return json(201, {}); }
  return json(200, []);
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { POST } = await s.ssrLoadModule("/api/doc-check.ts");
const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });
const run = async (documentId, token = "good") => {
  state.updates = []; state.notes = []; state.aiCalls = 0;
  const r = await POST(new Request("http://local/api/doc-check", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ documentId }) }));
  return { status: r.status, body: await r.json() };
};
const today = new Date(Date.now() + 4 * 3600_000 + 86400_000 * 60).toISOString().slice(0, 10);

state.ai = { type: "driving_license", name: "Test", number: "123", expiry: today, readable: true, matches_expected: true };
{ const r = await run("d1");
  check("a clear, valid licence stays pending for a person", r.status === 200 && r.body.status === "pending" && r.body.checked === true && state.updates.length === 1 && state.updates[0].verification_status === "pending" && state.notes.length === 0, JSON.stringify(r.body)); }

state.ai = { ...state.ai, expiry: "2020-01-01" };
{ const r = await run("d1");
  check("an expired licence is rejected with the date, and staff are told", r.body.status === "rejected" && /expired on 2020-01-01/.test(r.body.reason) && state.updates[0].verification_status === "rejected" && state.notes[0]?.audience === "staff", JSON.stringify(r.body)); }

state.ai = { ...state.ai, expiry: today, readable: false };
{ const r = await run("d1");
  check("an unreadable picture is rejected", r.body.status === "rejected" && /not clear enough/.test(r.body.reason), JSON.stringify(r.body)); }

state.ai = { ...state.ai, readable: true, matches_expected: false };
{ const r = await run("d1");
  check("the wrong document is rejected", r.body.status === "rejected" && /does not look like your driving licence/.test(r.body.reason), JSON.stringify(r.body)); }

state.aiDown = true;
{ const r = await run("d1");
  check("AI down -> nothing rejected, the document waits for a person", r.body.status === "pending" && r.body.checked === false && state.updates.length === 0, JSON.stringify(r.body)); }
state.aiDown = false;

{ const r = await run("d1", "bad");
  check("no sign-in -> 401", r.status === 401); }
{ const r = await run("other-doc");
  check("someone else's document -> 404, nothing read", r.status === 404 && state.aiCalls === 0, JSON.stringify(r.body)); }

state.doc = { ...DOC, mime_type: "application/pdf", storage_path: "c1/dl.pdf" };
{ const r = await run("d1");
  check("a PDF is not read by the AI", r.body.checked === false && state.aiCalls === 0, JSON.stringify(r.body)); }
state.doc = DOC;

const failed = results.filter((x) => !x.pass);
for (const x of results) console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.pass ? "" : `  -> ${x.extra}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
