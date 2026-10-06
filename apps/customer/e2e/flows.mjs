// Interaction QA with a mocked backend: navigation, filters, booking flow, language/theme, chat chips, avatar upload, desktop.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { BASE, OUT, UID, SESSION, mock } from "./lib.mjs";

// A real 64x64 PNG for the upload test.
function makePng() {
  const w = 64, h = 64, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (x * 7 + y * 3) % 255;
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let r = 0xffffffff; for (const x of b) r = table[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
mkdirSync(OUT, { recursive: true }); writeFileSync(OUT + "/avatar.png", makePng());

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra });

async function fresh(viewport, lang = "en") {
  const ctx = await browser.newContext({ viewport });
  await mock(ctx);
  await ctx.addInitScript(([s, l]) => {
    try {
      if (!localStorage.getItem("drivex.customer.auth")) localStorage.setItem("drivex.customer.auth", s);
      if (!localStorage.getItem("drivex.lang")) localStorage.setItem("drivex.lang", l);
      sessionStorage.setItem("drivex.splash", "1");
    } catch { /* ignore */ }
  }, [SESSION, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text().slice(0, 150)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 150)));
  return { ctx, page, errors };
}

// 1. Mobile: tab navigation, offers filter, reserve -> checkout, browser back.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  for (const [label, h1] of [["Book", "Find your drive"], ["Bookings", "My bookings"], ["Profile", "My profile"], ["Home", null]]) {
    await page.locator("nav.fixed a", { hasText: label }).first().click(); await page.waitForTimeout(700);
    const t = await page.locator("h1").first().textContent().catch(() => null);
    ok("tab " + label + " navigates", h1 ? t === h1 : new URL(page.url()).pathname === "/", String(t));
  }
  await page.goto(BASE + "/book", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  const before = await page.getByRole("button", { name: /View & book/ }).count();
  await page.getByRole("button", { name: /Offers only/ }).click(); await page.waitForTimeout(500);
  const after = await page.getByRole("button", { name: /View & book/ }).count();
  ok("offers filter reduces the list", after === 1 && before > 1, before + " -> " + after);
  ok("discount badge and old price shown", (await page.getByText("15% off").count()) >= 1 && (await page.locator(".line-through").count()) >= 1);
  await page.getByRole("button", { name: /View & book/ }).first().click(); await page.waitForTimeout(900);
  ok("opens the reserve page", /\/book\/mercedes-g63/.test(page.url()), page.url());
  await page.getByRole("button", { name: /Continue/ }).click(); await page.waitForTimeout(900);
  ok("continue goes to checkout", page.url().endsWith("/checkout"), page.url());
  await page.screenshot({ path: OUT + "/i-checkout.png" });
  await page.goBack(); await page.waitForTimeout(700);
  ok("browser back returns to reserve", /\/book\/mercedes-g63/.test(page.url()), page.url());
  ok("no console errors (navigation)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 2. Language and theme switch through the UI, and persistence.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/profile/language", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "العربية" }).click(); await page.waitForTimeout(500);
  ok("language switch -> rtl", (await page.evaluate(() => document.documentElement.dir)) === "rtl");
  ok("title translated live", (await page.locator("h1").first().textContent()) === "اللغة");
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  ok("language persists after reload", (await page.evaluate(() => document.documentElement.dir)) === "rtl");
  await page.getByRole("button", { name: "English" }).click(); await page.waitForTimeout(400);
  ok("switch back -> ltr", (await page.evaluate(() => document.documentElement.dir)) === "ltr");
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.getByText("Appearance").first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Navy" }).click(); await page.waitForTimeout(400);
  const th = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, brand: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() }));
  ok("theme switch -> navy", th.t === "navy" && th.brand === "18 42 84", JSON.stringify(th));
  await page.screenshot({ path: OUT + "/i-theme-navy.png" });
  ok("no console errors (settings)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 3. Support chip in Arabic sends the Arabic text to the chat API and shows the reply.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 }, "ar");
  let body = null;
  await ctx.route("**/api/chat", async (r) => { body = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "رد تجريبي", urgent: false }) }); });
  await page.goto(BASE + "/support", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "مساعدة في الدفع" }).click(); await page.waitForTimeout(900);
  const last = body?.messages?.at(-1);
  ok("chip sends the translated text", last?.content === "مساعدة في الدفع", JSON.stringify(last));
  ok("reply is rendered", (await page.getByText("رد تجريبي").count()) === 1);
  await page.screenshot({ path: OUT + "/i-support-ar.png" });
  ok("no console errors (support)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 4. Avatar upload: compress -> storage upload -> customers.avatar_url update.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  const calls = [];
  await ctx.route("**/storage/v1/object/avatars/**", async (r) => {
    const req = r.request();
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    calls.push({ m: req.method(), u: new URL(req.url()).pathname, len: (req.postDataBuffer() || Buffer.alloc(0)).length });
    await r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify({ Key: "avatars/x" }) });
  });
  await ctx.route("**/rest/v1/customers**", async (r) => {
    const req = r.request();
    if (req.method() === "PATCH") { calls.push({ m: "PATCH", body: req.postData() }); return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } }); }
    return r.fallback();
  });
  await page.goto(BASE + "/profile/edit", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.setInputFiles("input[type=file]", OUT + "/avatar.png"); await page.waitForTimeout(1500);
  const up = calls.find((c) => c.m === "POST" || c.m === "PUT");
  const patch = calls.find((c) => c.m === "PATCH");
  ok("photo uploaded to avatars/<uid>/avatar.*", !!up && up.u.includes(UID + "/avatar."), JSON.stringify(up));
  ok("uploaded file is small (compressed)", !!up && up.len < 60000, String(up?.len));
  ok("avatar_url saved on the customer", !!patch && (patch.body || "").includes("avatars/" + UID + "/avatar."), patch?.body);
  ok("no console errors (upload)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 5. Desktop: no tab bar, sidebar navigation, sheet as a centred modal.
{
  const { ctx, page, errors } = await fresh({ width: 1366, height: 850 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  ok("tab bar hidden on desktop", !(await page.locator("nav.fixed.bottom-0").isVisible().catch(() => false)));
  await page.locator("aside a", { hasText: "Support" }).click(); await page.waitForTimeout(700);
  ok("sidebar navigates", page.url().endsWith("/support"), page.url());
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await page.getByText("Appearance").first().click(); await page.waitForTimeout(600);
  const box = await page.locator("h3", { hasText: "Appearance" }).locator("xpath=ancestor::div[contains(@class,'rounded-t-3xl')]").boundingBox();
  ok("sheet is a centred modal on desktop", !!box && box.y > 100 && box.y + box.height < 800, JSON.stringify(box));
  await page.screenshot({ path: OUT + "/i-desktop-sheet.png" });
  ok("no console errors (desktop)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

console.log(results.map((r) => (r.pass ? "PASS  " : "FAIL  ") + r.name + (r.pass ? "" : "   -> " + r.extra)).join("\n"));
console.log(results.filter((r) => r.pass).length + "/" + results.length + " passed");
await browser.close();
