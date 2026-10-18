// API test for api/invoice-extract.ts: reads the total from an invoice PDF for staff only, with Supabase and the AI faked in-process.
// Nothing real is sent. Run from apps/customer: node e2e/api-invoice-extract.mjs
import { createServer } from "vite";

Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon", TENANT_ID: "t1", AUTH_SECRET: "s", AI_BASE_URL: "https://fake-ai.test/v1", AI_API_KEY: "test", PANEL_ORIGIN: "https://panel.test" });

const PDF_B64 = Buffer.from("%PDF-1.4\n%fake\n").toString("base64");
const state = { ai: null, aiDown: false, aiBodies: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.hostname === "fake-ai.test") {
    state.aiBodies.push(await req.json());
    if (state.aiDown) return new Response("upstream down", { status: 503 });
    return json(200, { choices: [{ message: { content: JSON.stringify(state.ai) } }] });
  }
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  if (u.pathname === "/auth/v1/user") {
    const token = req.headers.get("authorization");
    if (token === "Bearer staff") return json(200, { id: "s1", aud: "authenticated" });
    if (token === "Bearer customer") return json(200, { id: "c1", aud: "authenticated" });
    return json(401, { msg: "bad jwt" });
  }
  const table = u.pathname.split("/").pop();
  if (table === "staff_profiles") {
    const isStaff = u.searchParams.get("id") === "eq.s1";
    return (req.headers.get("accept") || "").includes("pgrst.object") ? (isStaff ? json(200, { tenant_id: "t1" }) : json(406, { message: "no rows" })) : json(200, isStaff ? [{ tenant_id: "t1" }] : []);
  }
  return json(200, []);
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { POST, OPTIONS } = await s.ssrLoadModule("/api/invoice-extract.ts");
const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });
const call = async (body, token = "Bearer staff") => {
  const r = await POST(new Request("http://local/api/invoice-extract", { method: "POST", headers: { authorization: token, "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json(), headers: r.headers };
};

state.ai = { total: 2299, paid: 2299, remaining: null };
{ const r = await call({ file: PDF_B64 });
  const sent = state.aiBodies.at(-1);
  check("staff get the total read from the PDF", r.status === 200 && r.body.total === 2299 && r.body.paid === 2299 && r.body.remaining === null, JSON.stringify(r.body));
  check("the PDF is sent as a file to a cheap model, deterministic", sent?.model === "gpt-4.1-mini" && sent?.temperature === 0 && sent?.messages[0].content[0].type === "file" && sent?.messages[0].content[0].file.file_data.startsWith("data:application/pdf;base64,"), JSON.stringify(sent?.model));
  check("CORS allows only the panel origin", r.headers.get("access-control-allow-origin") === "https://panel.test"); }

{ const o = await OPTIONS();
  check("preflight answers 204 with the panel origin", o.status === 204 && o.headers.get("access-control-allow-origin") === "https://panel.test" && /authorization/.test(o.headers.get("access-control-allow-headers")), String(o.status)); }

{ const r = await call({ file: PDF_B64 }, "Bearer customer");
  check("a customer cannot use it", r.status === 403, String(r.status)); }
{ const r = await call({ file: PDF_B64 }, "");
  check("no sign-in is refused", r.status === 401, String(r.status)); }
{ const r = await call({ file: PDF_B64 }, "Bearer forged");
  check("a forged token is refused", r.status === 401, String(r.status)); }

{ const before = state.aiBodies.length; const r = await call({ file: Buffer.from("hello world").toString("base64") });
  check("a file that is not a PDF is refused before the AI", r.status === 400 && state.aiBodies.length === before, String(r.status)); }
{ const before = state.aiBodies.length; const big = Buffer.alloc(3 * 1024 * 1024 + 10, 0x25).toString("base64");
  const r = await call({ file: big });
  check("a PDF over 3 MB is refused before the AI", r.status === 413 && state.aiBodies.length === before, String(r.status)); }

state.ai = { total: null, paid: null, remaining: null };
{ const r = await call({ file: PDF_B64 });
  check("an unclear total is not guessed", r.status === 422 && r.body.total === undefined, String(r.status)); }

state.ai = { total: -5 };
{ const r = await call({ file: PDF_B64 });
  check("a negative or absurd total is rejected", r.status === 422, String(r.status)); }

state.aiDown = true;
{ const r = await call({ file: PDF_B64 });
  check("AI down tells staff to type the total", r.status === 503 && /by hand/.test(r.body.error), String(r.status)); }
state.aiDown = false;

const failed = results.filter((x) => !x.pass);
for (const x of results) console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.pass ? "" : "  -> " + x.extra}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
