// Records the tutorial scenes from the real customer app (this branch, dev server) with a fake backend, so no real
// customer data or production service is touched. Each scene becomes public/clips/<name>.webm plus <name>.json with the
// moments (clicks, hovers) the video highlights.
//
// Run from apps/customer so the shared mock backend finds its output folder:
//   (apps/customer)  npx vite --host 127.0.0.1 --port 9291
//   (apps/video)     npm run capture            all scenes
//                    npm run capture -- booking  one scene
import { chromium } from "playwright-core";
import { mkdirSync, renameSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, SESSION, T, mock } from "../../customer/e2e/lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIPS = join(HERE, "..", "public", "clips");
const TMP = join(HERE, ".tmp");
mkdirSync(CLIPS, { recursive: true });

const VIEW = { width: 1600, height: 900 }; // CSS pixels; the clip is recorded at exactly this size (Playwright does not scale)
const only = process.argv[2];

// ---------- demo data: the demo customer, a small fleet whose photos exist in the app, nice offers ----------
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const veh = (id, make, model, year, cat, daily, plate) => ({ id, make, model, year, categories: [cat], daily_price: daily, weekly_price: daily * 6, monthly_price: daily * 22, plate_number: plate, status: "available" });
const V = [
  veh("v1", "Mercedes-Benz", "GLE 53", 2024, "SUV", 650, "A 48213"),
  veh("v2", "Audi", "A6", 2024, "Sedan", 250, "B 30871"),
  veh("v3", "Nissan", "Patrol", 2023, "SUV", 420, "C 55102"),
  veh("v4", "Dodge", "Charger", 2023, "Sedan", 350, "D 11925"),
  veh("v5", "Mini", "Cooper", 2024, "Hatchback", 230, "E 70364"),
  veh("v6", "Hyundai", "Santa Fe", 2024, "SUV", 280, "F 20648"),
];
T.customers[0].full_name = "Emma Collins";
T.vehicles = V;
T.reservations = [
  { id: "r1", status: "confirmed", start_datetime: iso(-2), end_datetime: iso(3), rental_period: "daily", extras: ["full_cover"], total_amount: 3250, vehicles: V[0] },
  { id: "r2", status: "confirmed", start_datetime: iso(12), end_datetime: iso(16), rental_period: "daily", extras: [], total_amount: 1000, vehicles: V[1] },
  { id: "r3", status: "completed", start_datetime: iso(-30), end_datetime: iso(-24), rental_period: "daily", extras: [], total_amount: 1380, vehicles: V[4] },
];
T.invoices = [{ id: "i1", number: "INV-1001", reservation_id: "r1", amount: 3250, issued_at: iso(-2), status: "pending", paid_at: null, description: "Mercedes GLE 53 rental" }];
T.fines = [{ id: "f1", reservation_id: "r1", type: "salik", amount: 4, occurred_at: iso(-1), location: "Al Barsha" }];
T.offers = [
  { id: "o1", kind: "car", title: "Mercedes GLE 53", subtitle: null, discount_pct: 15, image_url: null, description: null, terms: null, location: null, redeem_code: null, sort_order: 1 },
  { id: "o2", kind: "car", title: "Audi A6", subtitle: null, discount_pct: 20, image_url: null, description: null, terms: null, location: null, redeem_code: null, sort_order: 2 },
  { id: "o3", kind: "partner", title: "ZUMA", subtitle: "Dining", discount_pct: 45, image_url: "/img/dining-1.webp", description: "Enjoy 45% off your bill.", terms: "Show your code at the venue.", location: "DIFC", redeem_code: null, sort_order: 3 },
  { id: "o4", kind: "partner", title: "Nusr-Et", subtitle: "Dining", discount_pct: 22, image_url: "/img/dining-2.webp", description: "Enjoy 22% off.", terms: "Terms apply.", location: "Business Bay", redeem_code: null, sort_order: 4 },
  { id: "o5", kind: "partner", title: "Al Noor Restaurant", subtitle: "Dining", discount_pct: 30, image_url: "/img/dining-3.webp", description: "Enjoy 30% off.", terms: "Terms apply.", location: "Downtown", redeem_code: null, sort_order: 5 },
];
const spec = (make, model, seats, features) => ({ make, model, engine: "3.0L Turbo", transmission: "Automatic", fuel: "Petrol", seats, doors: 5, bags: 3, features, image_url: null, gallery: [] });
T.vehicle_model_specs = [
  spec("Mercedes-Benz", "GLE 53", 5, ["Leather seats", "Apple CarPlay", "Panoramic roof"]),
  spec("Audi", "A6", 5, ["Leather seats", "Apple CarPlay", "Parking sensors"]),
  spec("Nissan", "Patrol", 7, ["7 seats", "Apple CarPlay", "Rear camera"]),
];

const CHAT = {
  "Extend my rental": "Of course, Emma. Open your booking and tap “Extend rental”, choose how many days, and we add the invoice to the same booking. You can pay it right away.",
  "Can I pay later?": "Yes. The new invoice stays under Payments, and you can pay it any time before the return date.",
};

// ---------- the page-side helpers: a visible cursor and click ripples (video does not record the real mouse) ----------
const FX = () => {
  const style = document.createElement("style");
  style.textContent = `#fx-cursor{position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))}
  .fx-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid rgba(255,255,255,.95);background:rgba(31,77,47,.35);animation:fxr .6s ease-out forwards}
  @keyframes fxr{to{transform:scale(4.2);opacity:0}}`;
  const mount = () => {
    if (document.getElementById("fx-cursor")) return;
    document.head.appendChild(style);
    const c = document.createElement("div"); c.id = "fx-cursor";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 2l15 9-6.5 1.6L9.5 19z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX - 5}px,${e.clientY - 3}px)`; }, true);
    addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "fx-ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount); else mount();
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--force-device-scale-factor=1"] });

async function scene(name, { signedIn = true, lang = "en" } = {}, run) {
  if (only && only !== name) return;
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: TMP, size: VIEW }, locale: "en-GB" });
  await mock(ctx);
  await ctx.route("**/api/chat", async (r) => {
    const last = r.request().postDataJSON()?.messages?.at(-1)?.content;
    await new Promise((res) => setTimeout(res, 1400)); // a believable "thinking" pause
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: CHAT[last] || "Happy to help! Our team is also on WhatsApp any time.", urgent: false }) });
  });
  await ctx.addInitScript(([s, l, auth]) => {
    try {
      if (auth && !localStorage.getItem("drivex.customer.auth")) localStorage.setItem("drivex.customer.auth", s);
      localStorage.setItem("drivex.lang", l); localStorage.setItem("drivex.push.asked", "1"); sessionStorage.setItem("drivex.splash", "1"); localStorage.setItem("drivex.onboarded", "1");
    } catch { /* ignore */ }
  }, [SESSION, lang, signedIn]);
  await ctx.addInitScript(FX);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const marks = [];
  const at = () => +((Date.now() - t0) / 1000).toFixed(2);
  let pos = { x: VIEW.width * 0.55, y: VIEW.height * 0.6 };
  await page.mouse.move(pos.x, pos.y);

  const kit = {
    page, marks,
    wait: (ms) => page.waitForTimeout(ms),
    mark: (kind, label, box) => marks.push({ t: at(), kind, label, box }),
    /** Moves the cursor to the element in a smooth, human-looking path. */
    async glide(loc, { ms = 800, dx = 0, dy = 0 } = {}) {
      const b = await loc.boundingBox();
      if (!b) throw new Error("no box for " + loc);
      const to = { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy };
      const from = pos; const n = Math.max(8, Math.round(ms / 16));
      for (let i = 1; i <= n; i++) {
        const k = i / n, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        await page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
        await page.waitForTimeout(16);
      }
      pos = to; return b;
    },
    async click(loc, label, opts) {
      const b = await kit.glide(loc, opts);
      kit.mark("click", label, b);
      await page.waitForTimeout(160); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    },
    async hover(loc, label, opts) { const b = await kit.glide(loc, opts); kit.mark("hover", label, b); },
    async type(loc, text, label) { await kit.click(loc, label); await page.keyboard.type(text, { delay: 85 }); },
    async scroll(px, ms = 1200) { await page.evaluate(([p, d]) => new Promise((res) => { const s = scrollY, t = performance.now(); const step = (now) => { const k = Math.min(1, (now - t) / d); scrollTo(0, s + p * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); }), [px, ms]); },
  };
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const start = Math.max(0, at() - 0.2); // the first moments of a recording are blank; the video skips them
  try { await run(kit); } catch (e) { await page.screenshot({ path: join(HERE, "debug.png") }); console.log("page text:", (await page.evaluate(() => document.body.innerText)).slice(0, 300).split("\n").join(" | ")); throw e; }
  const duration = at();
  await ctx.close();
  const file = readdirSync(TMP).find((f) => f.endsWith(".webm"));
  renameSync(join(TMP, file), join(CLIPS, name + ".webm"));
  writeFileSync(join(CLIPS, name + ".json"), JSON.stringify({ name, view: VIEW, start, duration, marks }, null, 2));
  rmSync(TMP, { recursive: true, force: true });
  console.log(`${name}: ${duration}s, ${marks.length} marks`);
}

const nav = (p, label) => p.locator("header nav").getByRole("link", { name: label, exact: true });

// 1. Sign in and the home page
await scene("home", { signedIn: false }, async (k) => {
  const { page } = k;
  await k.wait(1800);
  await k.type(page.locator("input[inputmode=tel]"), "501234567", "Mobile number");
  await k.wait(500);
  await page.route("**/api/auth", async (r) => {
    const a = r.request().postDataJSON()?.action;
    if (a === "send") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testMode: false }) });
    const s = JSON.parse(SESSION);
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token }) });
  });
  await k.click(page.getByRole("button", { name: "Send code" }), "Send code");
  await k.wait(1200);
  await k.type(page.locator("input[autocomplete=one-time-code]"), "123456", "6-digit code");
  // the fake session is already stored for the home page, so finish by loading it
  await k.wait(900);
  await page.evaluate(([s]) => { localStorage.setItem("drivex.customer.auth", s); }, [SESSION]);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await k.wait(2200);
  k.mark("view", "Home");
  await k.scroll(520, 1600); await k.wait(1500);
  await k.hover(page.getByRole("button", { name: /Pay now/ }).first(), "Pending invoice");
  await k.wait(1400);
});

// 2. Find a car and book it
await scene("booking", {}, async (k) => {
  const { page } = k;
  await k.click(nav(page, "Book"), "Book");
  await page.waitForURL("**/book"); await k.wait(1600);
  k.mark("view", "Cars");
  await k.click(page.getByRole("button", { name: "Weekly" }), "Daily, weekly, monthly");
  await k.wait(800);
  await k.click(page.getByRole("button", { name: "Daily" }), "Daily");
  await k.wait(900);
  await k.type(page.getByPlaceholder("Search cars"), "audi", "Search");
  await k.wait(1200);
  await k.click(page.getByRole("button", { name: /View & book/ }).first(), "View & book");
  await page.waitForURL("**/book/**"); await k.wait(1800);
  k.mark("view", "Car page");
  await k.scroll(380, 1300); await k.wait(900);
  await k.hover(page.getByRole("button", { name: /Continue/ }), "Continue");
  await k.wait(700);
  await k.click(page.getByRole("button", { name: /Continue/ }), "Continue");
  await page.waitForURL("**/checkout"); await k.wait(2600);
  k.mark("view", "Checkout");
});

// 3. My bookings, extend, invoice
await scene("bookings", {}, async (k) => {
  const { page } = k;
  await k.click(nav(page, "Bookings"), "Bookings");
  await page.waitForURL("**/bookings"); await k.wait(1800);
  k.mark("view", "My bookings");
  await k.click(page.getByText("Mercedes GLE 53").first().locator("xpath=ancestor::div[.//button[contains(., 'View details')]][1]").getByRole("button", { name: /View details/ }), "View details");
  await page.waitForURL("**/bookings/**"); await k.wait(1800);
  k.mark("view", "Booking details");
  await k.click(page.getByRole("button", { name: /Extend rental/ }).first(), "Extend rental");
  await k.wait(1800);
  await k.hover(page.getByRole("button", { name: /\+ 3 days/ }), "Choose the days");
  await k.wait(1400);
  await page.keyboard.press("Escape"); await k.wait(500);
  const dl = page.getByRole("button", { name: "Download invoice" }).first();
  await k.hover(dl, "Download invoice");
  await k.wait(1500);
  await k.hover(page.getByText("Pay now").first(), "Pay now");
  await k.wait(1500);
});

// 4. Support chat
await scene("support", {}, async (k) => {
  const { page } = k;
  await k.click(nav(page, "Support"), "Support");
  await page.waitForURL("**/support"); await k.wait(2000);
  k.mark("view", "Support");
  await k.click(page.getByRole("button", { name: "Extend my rental" }).first(), "Quick question");
  await k.wait(3600);
  await k.type(page.locator("form input"), "Can I pay later?", "Ask a question");
  await k.wait(500);
  await page.keyboard.press("Enter");
  await k.wait(3600);
  await k.hover(page.getByRole("button", { name: /Urgent call/ }).first(), "Urgent call");
  await k.wait(1800);
});

// 5. Profile, language and theme
await scene("profile", {}, async (k) => {
  const { page } = k;
  await k.click(page.locator("header button[aria-haspopup=menu]"), "Account menu");
  await k.wait(1600);
  k.mark("view", "Account menu");
  await k.click(page.getByRole("button", { name: "Navy" }), "Theme");
  await k.wait(1400);
  await k.click(page.getByRole("button", { name: "Green" }), "Theme");
  await k.wait(900);
  await k.click(page.getByRole("menuitem", { name: "Profile" }), "Profile");
  await page.waitForURL("**/profile"); await k.wait(1800);
  await k.click(page.locator("header button", { hasText: "العربية" }), "Language");
  await k.wait(2200);
  k.mark("view", "Arabic");
  await k.click(page.locator("header button", { hasText: "English" }), "Language");
  await k.wait(1800);
});

await browser.close();
