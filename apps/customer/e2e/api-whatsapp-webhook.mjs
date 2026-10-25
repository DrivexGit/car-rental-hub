// API test for api/whatsapp-webhook.ts (Meta WhatsApp Cloud API webhook), with Supabase faked in-process.
// Nothing real is read, written or sent. Run from apps/customer: node e2e/api-whatsapp-webhook.mjs
import { createHmac } from "node:crypto";
import { createServer } from "vite";

Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_ANON_KEY: "anon", TENANT_ID: "t1", WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: "app-secret" });

const db = { leads: [{ id: "lead1", tenant_id: "t1", whatsapp_number: "971501234567", full_name: "Known Customer", current_stage: "booked" }], messages: [], notifications: [], leadUpdates: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  const one = (req.headers.get("accept") || "").includes("pgrst.object");
  const out = (rows) => new Response(JSON.stringify(one ? rows[0] ?? null : rows), { status: 200, headers: { "content-type": "application/json" } });
  const eq = (k) => u.searchParams.get(k)?.replace(/^eq\./, "");
  const table = u.pathname.split("/").pop();
  const body = req.method === "GET" ? null : await req.json().catch(() => null);
  if (table === "messages" && req.method === "GET") return out(db.messages.filter((m) => m.channel_message_id === eq("channel_message_id")));
  if (table === "messages" && req.method === "POST") { db.messages.push(body); return out([body]); }
  if (table === "leads" && req.method === "GET") return out(db.leads.filter((l) => l.tenant_id === eq("tenant_id") && l.whatsapp_number === eq("whatsapp_number")));
  if (table === "leads" && req.method === "POST") { const l = { id: "lead" + (db.leads.length + 1), ...body }; db.leads.push(l); return out([l]); }
  if (table === "leads" && req.method === "PATCH") { db.leadUpdates.push(eq("id")); return out([]); }
  if (table === "notifications") { db.notifications.push(body); return out([body]); }
  return out([]);
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { GET, POST } = await s.ssrLoadModule("/api/_whatsapp-webhook.ts");
const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });
const post = async (payload, secret = "app-secret") => {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const r = await POST(new Request("http://local/api/whatsapp-webhook", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body: raw }));
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const event = (messages, contacts = []) => ({ object: "whatsapp_business_account", entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", contacts, messages } }] }] });

{ const r = await GET(new Request("http://local/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"));
  check("Meta URL check: right token returns the challenge", r.status === 200 && (await r.text()) === "12345"); }
{ const r = await GET(new Request("http://local/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345"));
  check("Meta URL check: wrong token is refused", r.status === 403, String(r.status)); }

{ const r = await post(event([{ from: "971501234567", id: "wamid.1", timestamp: "1761000000", type: "text", text: { body: "Hi, I want to extend" } }]), "wrong-secret");
  check("a body signed with another secret is refused and nothing is saved", r.status === 401 && db.messages.length === 0, String(r.status)); }

{ const r = await post(event([{ from: "971501234567", id: "wamid.1", timestamp: "1761000000", type: "text", text: { body: "Hi, I want to extend" } }]));
  const m = db.messages[0];
  check("a message from a known number goes to that lead as inbound", r.status === 200 && m?.lead_id === "lead1" && m.direction === "inbound" && m.channel === "whatsapp" && m.message_text === "Hi, I want to extend", JSON.stringify(m));
  check("the WhatsApp time and stage are kept", m?.created_at === new Date(1761000000 * 1000).toISOString() && m.stage_at_time === "booked", JSON.stringify(m));
  check("staff get a notification that links to the lead", db.notifications.length === 1 && db.notifications[0].audience === "staff" && db.notifications[0].link === "/leads/lead1" && db.notifications[0].title.includes("Known Customer"), JSON.stringify(db.notifications));
  check("the lead's last message time is updated", db.leadUpdates.includes("lead1")); }

{ const r = await post(event([{ from: "971501234567", id: "wamid.1", timestamp: "1761000000", type: "text", text: { body: "Hi, I want to extend" } }]));
  check("the same message sent again by Meta is saved once", r.body.saved === 0 && db.messages.length === 1, JSON.stringify(r.body)); }

{ const r = await post(event([{ from: "447700900123", id: "wamid.2", type: "image", image: { caption: "my licence", id: "media1" } }], [{ wa_id: "447700900123", profile: { name: "New Person" } }]));
  const lead = db.leads.find((l) => l.whatsapp_number === "447700900123");
  check("an unknown number becomes a new WhatsApp lead with the profile name", r.status === 200 && lead?.full_name === "New Person" && lead.source === "whatsapp" && lead.primary_channel === "whatsapp", JSON.stringify(lead));
  check("a photo is saved as [image] with its caption", db.messages[1]?.message_text === "[image] my licence" && db.messages[1].message_type === "image" && db.messages[1].lead_id === lead?.id, JSON.stringify(db.messages[1])); }

{ const before = db.messages.length;
  const r = await post({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: "wamid.9", status: "read" }] } }] }] });
  check("delivery and read receipts are ignored", r.status === 200 && db.messages.length === before); }

{ delete process.env.WHATSAPP_APP_SECRET;
  const r = await post(event([{ from: "971501234567", id: "wamid.3", type: "text", text: { body: "x" } }]));
  check("without WHATSAPP_APP_SECRET the endpoint is off", r.status === 404, String(r.status)); }

console.log(results.map((r) => (r.pass ? "PASS  " : "FAIL  ") + r.name + (r.pass ? "" : "   -> " + r.extra)).join("\n"));
console.log(results.filter((r) => r.pass).length + "/" + results.length + " passed");
await s.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
