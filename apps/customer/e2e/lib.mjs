import { existsSync, mkdirSync } from "node:fs";

/** Chrome to drive: CHROME_PATH, else the usual install path on macOS / Windows / Linux, else Playwright's own Chromium. */
export const chromePath = () => process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find(existsSync);
/** Navigation timeout in ms (E2E_TIMEOUT); the dev server can be slow to serve the first page on a busy machine. */
export const NAV_TIMEOUT = Number(process.env.E2E_TIMEOUT) || 90000;
export const BASE = process.env.BASE || "http://127.0.0.1:9291";
export const OUT = "e2e/.out";
mkdirSync(OUT, { recursive: true });

export const UID = "11111111-1111-4111-8111-111111111111";
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const veh = (id, make, model, year, cat, daily, plate) => ({ id, make, model, year, categories: [cat], daily_price: daily, weekly_price: daily * 6, monthly_price: daily * 22, plate_number: plate, status: "available" });
const V = [veh("v-g63", "Mercedes", "G63", 2023, "SUV", 750, "A 1234"), veh("v-a6", "Audi", "A6", 2024, "Sedan", 250, "B 2345"), veh("v-911", "Porsche", "911", 2024, "Coupe", 950, "C 3456"), veh("v-a6b", "Audi", "A6", 2024, "Sedan", 250, "B 9999")];
export const T = {
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

export async function mock(ctx) {
  ctx.setDefaultNavigationTimeout(NAV_TIMEOUT);
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

export const SESSION = JSON.stringify({ access_token: "mock.jwt.token", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "mock-refresh", user: { id: UID, aud: "authenticated", role: "authenticated", email: "c@customers.drivex.app", app_metadata: {}, user_metadata: {}, created_at: iso(-30) } });

