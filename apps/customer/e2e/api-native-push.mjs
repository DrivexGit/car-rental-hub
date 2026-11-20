// Native push (api/_native-push.ts through api/push-hook.ts): FCM for the Android app, the APNs token for the iPhone app.
// Google and the database are faked in-process. Run from apps/customer: node e2e/api-native-push.mjs
import { createVerify, generateKeyPairSync } from "node:crypto";
import { createServer } from "vite";

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
Object.assign(process.env, {
  PUSH_HOOK_SECRET: "hook-secret", SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service",
  VAPID_SUBJECT: "mailto:t@t.t", VAPID_PUBLIC_KEY: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  VAPID_PRIVATE_KEY: "UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls",
  FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: "drivex-test", client_email: "push@drivex-test.iam.gserviceaccount.com", private_key: rsa.privateKey.export({ type: "pkcs8", format: "pem" }) }),
});

const state = { subs: [], deleted: [], oauth: [], fcm: [], fcmStatus: 200 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (u.host === "oauth2.googleapis.com") { state.oauth.push(new URLSearchParams(await req.text())); return Response.json({ access_token: "ya29.test", expires_in: 3600 }); }
  if (u.host === "fcm.googleapis.com") {
    state.fcm.push({ path: u.pathname, auth: req.headers.get("authorization"), body: await req.json() });
    return state.fcmStatus === 200 ? Response.json({ name: "ok" }) : new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 });
  }
  if (u.pathname.endsWith("/customers")) return Response.json({ notify_bookings: true });
  if (u.pathname.endsWith("/push_subscriptions") && req.method === "DELETE") { state.deleted.push(u.search); return new Response(null, { status: 204 }); }
  if (u.pathname.endsWith("/push_subscriptions")) return Response.json(state.subs);
  return realFetch(input, init);
};

const s = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { POST } = await s.ssrLoadModule("/api/push-hook.ts");
const { jwt } = await s.ssrLoadModule("/api/_native-push.ts");
const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });
const hook = async (n) => (await POST(new Request("http://x/api/push-hook", { method: "POST", headers: { "x-hook-secret": "hook-secret" }, body: JSON.stringify(n) }))).json();
const note = { id: "n1", type: "booking_confirmed", title: "Booking confirmed", body: "Patrol, 16 Oct", link: "/bookings/r1", customer_id: "u1", audience: "customer" };

state.subs = [{ id: "s1", platform: "fcm", endpoint: "fcm-token-1234567890" }];
{ const out = await hook(note);
  const f = state.fcm[0];
  check("one FCM push sent", out.sent === 1 && state.fcm.length === 1, JSON.stringify(out));
  check("sent to the project's v1 endpoint with the OAuth token", f?.path === "/v1/projects/drivex-test/messages:send" && f?.auth === "Bearer ya29.test");
  check("the device token, title, body and link go to the phone", f?.body.message.token === "fcm-token-1234567890" && f.body.message.notification.title === "Booking confirmed" && f.body.message.data.url === "/bookings/r1", JSON.stringify(f?.body));
  const a = state.oauth[0]?.get("assertion") ?? "";
  const [h, c, sig] = a.split(".");
  const ok = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(rsa.publicKey, Buffer.from(sig ?? "", "base64url"));
  check("the OAuth assertion is signed by the service account key, for FCM", ok && JSON.parse(Buffer.from(c, "base64url")).scope.includes("firebase.messaging")); }

{ await hook({ ...note, id: "n2" });
  check("the OAuth token is reused (one sign-in per hour, not per push)", state.oauth.length === 1); }

{ state.fcmStatus = 404; state.deleted = [];
  const out = await hook({ ...note, id: "n3" });
  check("an unregistered token is deleted", out.sent === 0 && state.deleted.length === 1 && state.deleted[0].includes("s1"), JSON.stringify(state.deleted)); }

{ state.fcm = []; state.subs = [{ id: "s2", platform: "apns", endpoint: "abcd" }];
  const out = await hook({ ...note, id: "n4" });
  check("no APNs key yet: the iPhone token is skipped, nothing deleted, no error", out.sent === 0 && state.fcm.length === 0, JSON.stringify(out)); }

{ const t = jwt({ alg: "ES256", kid: "K" }, { iss: "TEAM" }, ec.privateKey.export({ type: "pkcs8", format: "pem" }), "SHA256", true);
  const [h, c, sig] = t.split(".");
  const raw = Buffer.from(sig, "base64url");
  const ok = createVerify("SHA256").update(`${h}.${c}`).verify({ key: ec.publicKey, dsaEncoding: "ieee-p1363" }, raw);
  check("APNs provider token: ES256, 64-byte signature that verifies", raw.length === 64 && ok); }

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "  -> " + r.extra}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await s.close();
process.exit(failed.length ? 1 : 0);
