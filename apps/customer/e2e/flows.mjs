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
      sessionStorage.setItem("drivex.splash", "1"); localStorage.setItem("drivex.onboarded", "1");
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

// 4b. Onboarding: first launch only, skippable, translated, remembered.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mock(ctx);
  await ctx.addInitScript(([s]) => { try { if (!localStorage.getItem("drivex.customer.auth")) localStorage.setItem("drivex.customer.auth", s); sessionStorage.setItem("drivex.splash", "1"); } catch { /* ignore */ } }, [SESSION]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  ok("onboarding shows on first launch", (await page.getByRole("dialog").count()) === 1 && (await page.getByText("Book in a minute").count()) === 1);
  await page.screenshot({ path: OUT + "/i-onboarding.png" });
  await page.getByRole("button", { name: /Next/ }).click(); await page.waitForTimeout(600);
  ok("next slide", (await page.getByText("Everything in one place").count()) === 1);
  await page.getByRole("button", { name: /Next/ }).click(); await page.waitForTimeout(600);
  ok("last slide offers Get started", (await page.getByRole("button", { name: /Get started/ }).count()) === 1);
  await page.getByRole("button", { name: /Get started/ }).click(); await page.waitForTimeout(600);
  ok("onboarding closes and is remembered", (await page.getByRole("dialog").count()) === 0 && (await page.evaluate(() => localStorage.getItem("drivex.onboarded"))) === "1");
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  ok("not shown again after reload", (await page.getByRole("dialog").count()) === 0);
  await page.evaluate(() => { localStorage.removeItem("drivex.onboarded"); localStorage.setItem("drivex.lang", "ar"); });
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(600);
  ok("Arabic onboarding is translated and RTL", (await page.getByText("احجز في دقيقة").count()) === 1);
  await page.screenshot({ path: OUT + "/i-onboarding-ar.png" });
  await page.getByRole("button", { name: "تخطّي" }).click(); await page.waitForTimeout(500);
  ok("skip closes it", (await page.getByRole("dialog").count()) === 0);
  ok("no page errors (onboarding)", errors.length === 0, errors.join(" | "));
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

// 6. Invoice download: the tax invoice document is built with the right VAT split and customer.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/bookings/r1", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Download invoice" }).first().click();
  let html = null;
  for (let k = 0; k < 20 && !html; k++) { await page.waitForTimeout(150); const f = page.frames().find((fr) => fr !== page.mainFrame()); html = f ? await f.content().catch(() => null) : null; }
  ok("invoice document opened for printing", !!html && html.includes("TAX INVOICE"));
  ok("shows number, customer and amounts", !!html && html.includes("INV-1001") && html.includes("Test Customer") && html.includes("AED 3,571.43") && html.includes("AED 178.57") && html.includes("AED 3,750.00"), html ? "" : "no iframe");
  ok("shows car detail and unpaid stamp", !!html && html.includes("Mercedes G63") && html.includes("UNPAID"));
  if (html) { const p2 = await ctx.newPage(); await p2.setViewportSize({ width: 794, height: 1123 }); await p2.setContent(html, { waitUntil: "load" }); await p2.screenshot({ path: OUT + "/i-invoice.png" }); }
  ok("no console errors (invoice)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 7. Tapping the page you are already on never adds a history entry (#9), on phone and desktop.
{
  for (const [label, vp, sel] of [["phone", { width: 390, height: 844 }, "nav.fixed a"], ["desktop", { width: 1366, height: 850 }, "aside a"]]) {
    const { ctx, page, errors } = await fresh(vp);
    await page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
    const start = await page.evaluate(() => history.length);
    for (let k = 0; k < 3; k++) { await page.locator(sel, { hasText: "Profile" }).first().click(); await page.waitForTimeout(150); }
    ok(`${label}: tapping the current tab adds no history`, (await page.evaluate(() => history.length)) === start);
    if (label === "phone") {
      await page.locator("a[aria-label='Profile']").first().click().catch(() => {});
      ok("phone: tapping the avatar on the profile page adds no history", (await page.evaluate(() => history.length)) === start);
      await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
      const h = await page.evaluate(() => history.length);
      await page.locator("a[aria-label='Notifications']").first().click(); await page.waitForTimeout(300);
      ok("phone: the bell opens notifications with one history entry", (await page.evaluate(() => history.length)) === h + 1, String(await page.evaluate(() => history.length)));
    } else {
      await page.locator("aside a", { hasText: "Profile" }).last().click(); await page.waitForTimeout(150);
      ok("desktop: tapping the sidebar profile card adds no history", (await page.evaluate(() => history.length)) === start);
    }
    ok(`no console errors (history, ${label})`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}

// 8. Support chat shows long, multi-line and unbroken text inside the bubble (#10), phone and RTL.
{
  const { ctx, page, errors } = await fresh({ width: 360, height: 740 }, "ar");
  const long = "سطر أول\nسطر ثاني مع نص طويل جداً جداً جداً جداً جداً جداً جداً جداً جداً جداً جداً جداً\n" + "https://example.com/" + "a".repeat(120) + "\n" + "x".repeat(200);
  await ctx.route("**/api/chat", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: long, urgent: false }) }));
  await page.goto(BASE + "/support", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.locator("form input").fill(long.slice(0, 300));
  await page.locator("form button").click(); await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bubbles = [...document.querySelectorAll("div[dir='auto']")];
    return { overflowX: document.documentElement.scrollWidth > vw, bubbles: bubbles.length, outside: bubbles.filter((b) => { const r = b.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1; }).length, newlines: bubbles.some((b) => getComputedStyle(b).whiteSpace === "pre-wrap") };
  });
  ok("long unbroken text stays inside the screen", !m.overflowX && m.outside === 0 && m.bubbles >= 2, JSON.stringify(m));
  ok("line breaks are kept", m.newlines);
  await page.screenshot({ path: OUT + "/i-support-long.png" });
  const max = await page.locator("form input").getAttribute("maxlength");
  ok("input is limited to the 2000 characters the server reads", max === "2000", String(max));
  ok("no console errors (long chat)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

console.log(results.map((r) => (r.pass ? "PASS  " : "FAIL  ") + r.name + (r.pass ? "" : "   -> " + r.extra)).join("\n"));
console.log(results.filter((r) => r.pass).length + "/" + results.length + " passed");
await browser.close();
