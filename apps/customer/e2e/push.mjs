// Web push, end to end, with the app closed: Chrome subscribes through the app (Profile > Notifications > Turn on),
// the app tab is closed, then the real api/push-hook.ts handler sends the push through the real push service, and the
// service worker must show the notification. The database is faked in-process; the push itself is real, so this
// needs a network connection and the VAPID keys in .env.local (it is skipped without them). Chrome runs with a window
// because headless Chrome does not show notifications; the alerts also pop up on this computer while it runs.
// Run from apps/customer with the dev server on BASE: node e2e/push.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { createServer, loadEnv } from "vite";
import { BASE, SESSION, UID, chromePath, mock } from "./lib.mjs";

const env = loadEnv("development", process.cwd(), "");
if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) { console.log("SKIP: no VAPID keys in .env.local"); process.exit(0); }
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY, VAPID_SUBJECT: env.VAPID_SUBJECT,
  PUSH_HOOK_SECRET: "hook-secret", SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service",
});

const results = [];
const check = (name, pass, extra = "") => results.push({ name, pass, extra });
check("the app and the server use the same VAPID public key", env.VITE_VAPID_PUBLIC_KEY === env.VAPID_PUBLIC_KEY);

// ---- the database the push hook reads, faked in-process (web-push itself talks to the real push service) ----
const db = { subs: [], notifyInvoices: true, deleted: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (!u.hostname.endsWith("fake.supabase.co")) return realFetch(input, init);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const table = u.pathname.split("/").pop();
  if (table === "customers") return json(200, { notify_bookings: true, notify_invoices: db.notifyInvoices, notify_offers: true });
  if (table === "push_subscriptions" && req.method === "DELETE") { db.deleted.push(u.search); return json(204, null); }
  if (table === "push_subscriptions") return json(200, db.subs);
  return json(200, []);
};
// own cache and no dependency scan: sharing node_modules/.vite with the running dev server would make it reload its deps
const vite = await createServer({ configFile: false, cacheDir: "e2e/.out/vite-push", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { POST: hook } = await vite.ssrLoadModule("/api/push-hook.ts");
const send = (row, secret = "hook-secret") => hook(new Request("http://local/api/push-hook", { method: "POST", headers: { "x-hook-secret": secret }, body: JSON.stringify(row) })).then(async (r) => ({ status: r.status, body: await r.json() }));
// a row as the database trigger sends it (to_jsonb of the new notification)
const FINE = { id: "n1", tenant_id: "t", audience: "customer", customer_id: UID, type: "fine", title: "New traffic fine", body: "Sheikh Zayed Rd · AED 300", link: "/bookings/r1" };

// ---- a real Chrome profile (push does not work in incognito-like contexts) ----
const dir = mkdtempSync(join(tmpdir(), "drivex-push-"));
const ctx = await chromium.launchPersistentContext(dir, {
  executablePath: chromePath(), headless: false, viewport: { width: 390, height: 844 },
  ignoreDefaultArgs: ["--disable-background-networking"], // Chrome needs it to reach its push service
});
try {
  await mock(ctx);
  let stored = null, removed = "";
  await ctx.route("**/rest/v1/push_subscriptions*", async (r) => {
    if (r.request().method() === "POST") stored = r.request().postDataJSON();
    if (r.request().method() === "DELETE") removed = decodeURIComponent(r.request().url());
    await r.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "[]" });
  });
  await ctx.addInitScript(([s]) => { try { localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.onboarded", "1"); sessionStorage.setItem("drivex.splash", "1"); } catch { /* ignore */ } }, [SESSION]);
  const app = await ctx.newPage();
  await app.goto(BASE + "/profile/notifications", { waitUntil: "networkidle" });
  const turnOn = app.getByRole("button", { name: "Turn on" });
  await turnOn.waitFor();
  await ctx.grantPermissions(["notifications"], { origin: BASE }); // the customer says Allow in the browser's question
  await turnOn.click();
  for (let i = 0; i < 300 && !stored; i++) await app.waitForTimeout(200); // the first subscription waits for Chrome's push service
  const row = Array.isArray(stored) ? stored[0] : stored;
  check("Turn on stores this phone's subscription", !!row?.endpoint && !!row?.p256dh && !!row?.auth && row.kind === "customer", JSON.stringify(row)?.slice(0, 120));
  check("the screen now says alerts are on", await app.getByText("On", { exact: true }).isVisible().catch(() => false));
  if (!row?.endpoint) throw new Error("no subscription, cannot go on");
  db.subs = [{ id: "s1", user_id: UID, kind: "customer", endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }];

  // the app is closed: no tab of it is left open
  await app.close();
  const worker = async () => ctx.serviceWorkers().find((w) => w.url().startsWith(BASE));
  const shown = async () => { const w = await worker(); return w ? w.evaluate(() => self.registration.getNotifications().then((ns) => ns.map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data?.url, renotify: n.renotify })))) : []; };
  const waitShown = async (n) => { for (let i = 0; i < 60; i++) { const s = await shown().catch(() => []); if (s.length >= n) return s; await new Promise((r) => setTimeout(r, 500)); } return shown().catch(() => []); };

  check("a wrong hook secret is refused", (await send(FINE, "nope")).status === 403);
  db.notifyInvoices = false;
  const off = await send(FINE);
  check("a customer who turned invoice alerts off gets no fine alert", off.body.sent === 0 && off.body.skipped === "preference", JSON.stringify(off.body));
  db.notifyInvoices = true;
  const sent = await send(FINE);
  check("the push hook sends the fine to the phone", sent.status === 200 && sent.body.sent === 1, JSON.stringify(sent.body));
  const list = await waitShown(1);
  const n = list.find((x) => x.title === "New traffic fine");
  check("with the app closed, the phone shows the alert", !!n && n.body === FINE.body, JSON.stringify(list));
  check("its link is this app (not a fixed domain), at the fines of that booking", !!n && n.url === `${BASE}/bookings/r1#fines`, n?.url);
  if (n) { // what a tap does when no app window is open: the worker opens the link in a new window
    const opened = await ctx.newPage();
    await opened.goto(n.url, { waitUntil: "networkidle" });
    await opened.waitForTimeout(1500);
    const inView = await opened.evaluate(() => { const b = document.getElementById("fines")?.getBoundingClientRect(); return !!b && b.top >= 0 && b.top < innerHeight; });
    check("the opened app shows the Salik & fines of the booking", inView);
    await opened.close();
  }

  const fine2 = await send({ ...FINE, id: "n2", title: "New Salik charge", body: "Al Safa · AED 4" });
  const inv = await send({ ...FINE, id: "n3", type: "invoice", title: "New invoice INV-1002", body: "Extension · AED 1,500" });
  const three = await waitShown(3);
  check("each alert stays: a second fine and an invoice do not replace the first", fine2.body.sent === 1 && inv.body.sent === 1 && three.length >= 3, JSON.stringify(three.map((x) => x.title)));
  check("an invoice alert opens the invoices of the booking", three.some((x) => x.title.startsWith("New invoice") && x.url === `${BASE}/bookings/r1#invoice`));

  // an expired device is removed from the list
  db.subs = [{ ...db.subs[0], id: "gone", endpoint: row.endpoint.replace(/[^/]+$/, "expired-device-token") }];
  const gone = await send(FINE);
  check("an expired subscription is deleted, not retried forever", gone.body.sent === 0 && db.deleted.some((q) => q.includes("gone")), JSON.stringify({ body: gone.body, deleted: db.deleted }));

  // signing out: the next person on this phone must not get this customer's alerts
  const me = await ctx.newPage();
  await me.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await me.getByRole("button", { name: "Log out" }).click();
  for (let i = 0; i < 50 && !removed; i++) await me.waitForTimeout(200);
  check("Log out removes this phone's subscription from the database", removed.includes(`endpoint=eq.${row.endpoint}`), removed.slice(0, 120));
  const still = await me.evaluate(async () => !!(await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()));
  check("and the phone itself is unsubscribed", !still);
  await me.close();
} catch (e) {
  check("no crash", false, e.message.split("\n")[0]);
} finally {
  await ctx.close();
  await vite.close();
  rmSync(dir, { recursive: true, force: true });
}

for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass || !r.extra ? "" : "  -> " + r.extra}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
