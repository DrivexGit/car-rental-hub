// Full-app QA with a mocked backend (nothing reaches the real Supabase project).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:9291";
const OUT = "e2e/.out";
mkdirSync(OUT, { recursive: true });

const UID = "11111111-1111-4111-8111-111111111111";
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const veh = (id, make, model, year, cat, daily, plate) => ({ id, make, model, year, categories: [cat], daily_price: daily, weekly_price: daily * 6, monthly_price: daily * 22, plate_number: plate, status: "available" });
const V = [veh("v-g63", "Mercedes", "G63", 2023, "SUV", 750, "A 1234"), veh("v-a6", "Audi", "A6", 2024, "Sedan", 250, "B 2345"), veh("v-911", "Porsche", "911", 2024, "Coupe", 950, "C 3456"), veh("v-a6b", "Audi", "A6", 2024, "Sedan", 250, "B 9999")];
const T = {
  customers: [{ id: UID, tenant_id: "t", phone: "+971501234567", full_name: "Test Customer", email: null, avatar_url: null, notify_bookings: true, notify_invoices: true, notify_offers: true }],
  vehicles: V,
  reservations: [
    { id: "r1", status: "confirmed", start_datetime: iso(-2), end_datetime: iso(3), rental_period: "daily", extras: ["full_cover"], total_amount: 3750, vehicles: V[0] },
    { id: "r2", status: "confirmed", start_datetime: iso(10), end_datetime: iso(14), rental_period: "daily", extras: [], total_amount: 1000, vehicles: V[1] },
    { id: "r3", status: "confirmed", start_datetime: iso(-30), end_datetime: iso(-25), rental_period: "daily", extras: [], total_amount: 4750, vehicles: V[2] },
  ],
  invoices: [{ id: "i1", number: "INV-1001", reservation_id: "r1", amount: 3750, issued_at: iso(-2), status: "pending", paid_at: null, description: "Mercedes G63 rental" }],
  fines: [{ id: "f1", reservation_id: "r1", type: "salik", amount: 4, occurred_at: iso(-1), location: "Al Barsha" }],
  offers: [
    { id: "o1", kind: "car", title: "Mercedes G63", subtitle: null, discount_pct: 15, image_url: null, description: null, terms: null, location: null, redeem_code: null, sort_order: 1 },
    { id: "o2", kind: "partner", title: "ZUMA", subtitle: "Dining", discount_pct: 45, image_url: null, description: "Enjoy 45% off.", terms: "Terms apply.", location: "DIFC", redeem_code: null, sort_order: 2 },
  ],
  customer_documents: [],
  vehicle_model_specs: [{ make: "Mercedes", model: "G63", engine: "4.0L V8", transmission: "Automatic", fuel: "Petrol", seats: 5, doors: 5, bags: 3, features: ["Leather seats", "Apple CarPlay"], image_url: null, gallery: [] }],
  notifications: [{ id: "n1", audience: "customer", type: "invoice", title: "New invoice", body: "Invoice INV-1001 is ready.", link: "/bookings/r1", read_at: null, created_at: iso(-0.1) }],
};

async function mock(ctx) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const u = new URL(req.url());
    if (u.pathname.startsWith("/rest/v1/rpc/")) {
      const name = u.pathname.split("/").pop();
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(name === "my_offer_code" ? "ZUMA-TEST1" : []) });
    }
    if (u.pathname.startsWith("/rest/v1/")) {
      const table = u.pathname.split("/").pop();
      const rows = T[table] ?? [];
      const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(single ? rows[0] ?? null : rows) });
    }
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: "{}" });
  });
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const body = u.pathname.endsWith("/chat") ? { reply: "Mock reply", urgent: false } : { ok: true };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

const SESSION = JSON.stringify({ access_token: "mock.jwt.token", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "mock-refresh", user: { id: UID, aud: "authenticated", role: "authenticated", email: "c@customers.drivex.app", app_metadata: {}, user_metadata: {}, created_at: iso(-30) } });

const PAGES = [
  ["home", "/"], ["book", "/book"], ["book-offers", "/book?offers=1"], ["reserve", "/book/mercedes-g63"], ["bookings", "/bookings"],
  ["booking-detail", "/bookings/r1"], ["support", "/support"], ["profile", "/profile"], ["profile-edit", "/profile/edit"],
  ["profile-docs", "/profile/documents"], ["profile-notif", "/profile/notifications"], ["profile-lang", "/profile/language"], ["inbox", "/notifications"],
];
const ALLOW = new Set(["DRIVEX", "English", "ready", "INV-", "Drivex", "Mercedes", "G63", "Audi", "Porsche", "Test", "Customer", "Apple", "Pay", "Dubai", "DIFC", "Barsha", "INV", "ZUMA", "Dining", "Enjoy", "Terms", "apply", "Automatic", "Petrol", "Leather", "seats", "CarPlay", "Sedan", "Coupe", "V8", "WhatsApp", "Mock", "reply", "Salik", "Ziina", "Mulkiya", "Emirates", "Car", "Rental", "rental", "invoice", "Invoice", "AED"]);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = [];
const VPS = [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 850 }]];
for (const [vp, viewport] of VPS) {
  for (const lang of ["en", "ar"]) {
    const ctx = await browser.newContext({ viewport });
    await mock(ctx);
    await ctx.addInitScript(([s, l]) => { try { localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.lang", l); sessionStorage.setItem("drivex.splash", "1"); localStorage.setItem("drivex.onboarded", "1"); } catch {} }, [SESSION, lang]);
    const page = await ctx.newPage();
    let errors = [];
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
    for (const [name, path] of PAGES) {
      errors = [];
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      const info = await page.evaluate(() => {
        const de = document.documentElement;
        const text = document.body.innerText;
        return { dir: de.dir, overflowX: de.scrollWidth > de.clientWidth + 1, text, title: document.querySelector("h1")?.textContent?.slice(0, 40) };
      });
      const latin = [...new Set((info.text.match(/[A-Za-z][A-Za-z'’-]{3,}/g) || []).filter((w) => !ALLOW.has(w)))];
      await page.screenshot({ path: `${OUT}/${vp}-${lang}-${name}.png` });
      report.push({ vp, lang, name, dir: info.dir, h1: info.title, overflowX: info.overflowX, errors: errors.slice(0, 2), latin: lang === "ar" ? latin.slice(0, 12) : undefined });
    }
    await ctx.close();
  }
}
writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.overflowX || r.errors.length || (r.latin && r.latin.length) || (r.lang === "ar" && r.dir !== "rtl"));
console.log(`pages checked: ${report.length}, with findings: ${bad.length}`);
for (const r of bad) console.log(JSON.stringify(r));
await browser.close();
