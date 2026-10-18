// API test for api/doc-view.ts: the code gate for viewing an approved document, with Supabase faked in-process.
// Nothing real is read, written or sent. Run from apps/customer: node e2e/api-doc-view.mjs
import { createHmac } from "node:crypto";
import { createServer } from "vite";

Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon", TENANT_ID: "t1", AUTH_SECRET: "s", OTP_TEST_CODE: "123456" });
delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID; delete process.env.WHATSAPP_OTP_TEMPLATE;

const CUSTOMER = { id: "c1", tenant_id: "t1", lead_id: "lead1", phone: "+971501234567", full_name: "Test Customer", email: "t@example.com" };
const DOCS = {
  d1: { id: "d1", tenant_id: "t1", lead_id: "lead1", document_type: "driving_license", storage_bucket: "customer-documents", storage_path: "c1/dl.jpg", verification_status: "approved" },
  d2: { id: "d2", tenant_id: "t1", lead_id: "lead1", document_type: "visa", storage_bucket: "customer-documents", storage_path: "c1/visa.jpg", verification_status: "pending" },
  d3: { id: "d3", tenant_id: "t1", lead_id: "other", document_type: "id_card", storage_bucket: "customer-documents", storage_path: "x/id.jpg", verification_status: "approved" },
};
const realFetch = globalThis.fetch;
const signed = [];
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  if (u.pathname === "/auth/v1/user") return req.headers.get("authorization") === "Bearer good" ? json(200, { id: "c1", aud: "authenticated" }) : json(401, { msg: "bad jwt" });
  if (u.pathname.startsWith("/storage/v1/object/sign/")) {
    const path = decodeURIComponent(u.pathname.replace("/storage/v1/object/sign/customer-documents/", ""));
    signed.push(path);
    return json(200, { signedURL: `/object/sign/customer-documents/${path}?token=abc` });
  }
  const table = u.pathname.split("/").pop();
  if (table === "customers") return json(200, CUSTOMER);
  if (table === "customer_documents") {
    const doc = DOCS[(u.searchParams.get("id") || "").replace("eq.", "")];
    if (!doc) return json(200, (req.headers.get("accept") || "").includes("pgrst.object") ? null : []);
    return (req.headers.get("accept") || "").includes("pgrst.object") ? json(200, doc) : json(200, [doc]);
  }
  return json(200, []);
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { POST } = await s.ssrLoadModule("/api/doc-view.ts");
const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });
const call = async (body, token = "Bearer good") => {
  const headers = { "content-type": "application/json", ...(token ? { authorization: token } : {}) };
  const r = await POST(new Request("http://local/api/doc-view", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sign = (exp) => createHmac("sha256", "s").update(`doc-view:c1:${exp}`).digest("hex");

{ const r = await call({ action: "send" }, "");
  check("no sign-in: refused", r.status === 401, String(r.status)); }

{ const r = await call({ action: "send" });
  check("send in test mode says so and sends nothing real", r.status === 200 && r.body.testMode === true, JSON.stringify(r.body)); }

{ const r = await call({ action: "unlock", code: "000000" });
  check("a wrong code is refused", r.status === 401, String(r.status)); }

let token;
{ const r = await call({ action: "unlock", code: "123456" });
  token = r.body.token;
  check("the right code gives a five-minute token", r.status === 200 && typeof token === "string" && r.body.expiresAt - Date.now() > 4 * 60_000 && r.body.expiresAt - Date.now() <= 5 * 60_000, JSON.stringify(r.body).slice(0, 80)); }

{ const r = await call({ action: "view", documentId: "d1" });
  check("viewing without the code is refused", r.status === 403, String(r.status)); }

{ const r = await call({ action: "view", documentId: "d1", unlock: token.slice(0, -2) + "00" });
  check("a forged token is refused", r.status === 403, String(r.status)); }

{ const exp = Date.now() - 1000; const expired = `${exp}.${sign(exp)}`;
  const r = await call({ action: "view", documentId: "d1", unlock: expired });
  check("an expired token is refused", r.status === 403, String(r.status)); }

{ const before = signed.length; const r = await call({ action: "view", documentId: "d1", unlock: token });
  check("an approved document gives a link that lasts 60 seconds", r.status === 200 && /object\/sign\/customer-documents\/c1\/dl\.jpg/.test(r.body.url || "") && r.body.expiresIn === 60 && signed.length === before + 1, JSON.stringify(r.body).slice(0, 120)); }

{ const r = await call({ action: "view", documentId: "d2", unlock: token });
  check("a document not yet approved is not shown", r.status === 403, String(r.status)); }

{ const r = await call({ action: "view", documentId: "d3", unlock: token });
  check("another customer's document is not found", r.status === 404, String(r.status)); }

{ const r = await call({ action: "nope" });
  check("unknown action is refused", r.status === 400, JSON.stringify(r.body)); }

const failed = results.filter((x) => !x.pass);
for (const x of results) console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.pass ? "" : "  -> " + x.extra}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
