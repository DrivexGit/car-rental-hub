// Interaction QA with a mocked backend: navigation, filters, booking flow, language/theme, chat chips, avatar upload, desktop.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { BASE, OUT, UID, SESSION, T, mock, chromePath } from "./lib.mjs";

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

const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
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
  ok("desktop header and footer are shown", (await page.locator("header nav a").count()) === 4 && (await page.locator("footer").isVisible()));
  await page.locator("header nav a", { hasText: "Support" }).click(); await page.waitForTimeout(700);
  ok("header navigates", page.url().endsWith("/support"), page.url());
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await page.getByText("Appearance").first().click(); await page.waitForTimeout(600);
  const box = await page.locator("h3", { hasText: "Appearance" }).locator("xpath=ancestor::div[contains(@class,'rounded-t-3xl')]").boundingBox();
  ok("sheet is a centred modal on desktop", !!box && box.y > 100 && box.y + box.height < 800, JSON.stringify(box));
  await page.screenshot({ path: OUT + "/i-desktop-sheet.png" });
  ok("no console errors (desktop)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 6. Invoice: View shows the tax invoice on screen, Download saves a real PDF file straight to the device (no print dialog).
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/bookings/r1", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "View invoice" }).first().click();
  let html = null;
  for (let k = 0; k < 20 && !html; k++) { await page.waitForTimeout(150); const f = page.frames().find((fr) => fr !== page.mainFrame()); html = f ? await f.content().catch(() => null) : null; }
  ok("View opens the invoice on screen", !!html && html.includes("TAX INVOICE"));
  ok("shows number, customer and amounts", !!html && html.includes("INV-1001") && html.includes("Test Customer") && html.includes("AED 3,571.43") && html.includes("AED 178.57") && html.includes("AED 3,750.00"), html ? "" : "no iframe");
  ok("shows car detail and unpaid stamp", !!html && html.includes("Mercedes G63") && html.includes("UNPAID"));
  await page.screenshot({ path: OUT + "/i-invoice-view.png" });
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  ok("the invoice view fits the phone width", fits);
  await page.getByRole("button", { name: "Close" }).first().click(); await page.waitForTimeout(500);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: "Download invoice" }).first().click()]);
  const file = OUT + "/invoice-test.pdf"; await dl.saveAs(file);
  const { readFileSync } = await import("node:fs");
  const pdf = readFileSync(file);
  ok("Download saves a PDF named after the invoice", dl.suggestedFilename() === "INV-1001.pdf", dl.suggestedFilename());
  ok("the file is a real PDF with a page image of reasonable size", pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 30000, String(pdf.length));
  ok("no print dialog frame is left behind", page.frames().length === 1);
  ok("no console errors (invoice)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 7. Tapping the page you are already on never adds a history entry (#9), on phone and desktop.
{
  for (const [label, vp, sel, start0, linkText] of [["phone", { width: 390, height: 844 }, "nav.fixed a", "/profile", "Profile"], ["desktop", { width: 1366, height: 850 }, "header nav a", "/support", "Support"]]) {
    const { ctx, page, errors } = await fresh(vp);
    await page.goto(BASE + start0, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
    const start = await page.evaluate(() => history.length);
    for (let k = 0; k < 3; k++) { await page.locator(sel, { hasText: linkText }).first().click(); await page.waitForTimeout(150); }
    ok(`${label}: tapping the current tab adds no history`, (await page.evaluate(() => history.length)) === start);
    if (label === "phone") {
      await page.locator("a[aria-label='Profile']:visible").first().click().catch(() => {});
      ok("phone: tapping the avatar on the profile page adds no history", (await page.evaluate(() => history.length)) === start);
      await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
      const h = await page.evaluate(() => history.length);
      await page.locator("a[aria-label='Notifications']:visible").first().click(); await page.waitForTimeout(300);
      ok("phone: the bell opens notifications with one history entry", (await page.evaluate(() => history.length)) === h + 1, String(await page.evaluate(() => history.length)));
    } else {
      await page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await page.waitForTimeout(300);
      const h0 = await page.evaluate(() => history.length);
      await page.locator("header button[aria-label=Profile]").click(); await page.getByRole("menuitem", { name: "Profile" }).click(); await page.waitForTimeout(300);
      ok("desktop: choosing Profile in the account menu while on Profile adds no history", (await page.evaluate(() => history.length)) === h0);
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

// 9. Splash (every other section skips it): shows, leaves, calms down for reduced motion, never traps the app.
{
  async function splashCase(opts, hang = false) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
    await mock(ctx);
    if (hang) await ctx.route("**/rest/v1/**", () => {}); // data never arrives, so the app is never "ready"
    await ctx.addInitScript(([s]) => { try { if (!localStorage.getItem("drivex.customer.auth")) localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.onboarded", "1"); } catch { /* ignore */ } }, [SESSION]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 150)));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const splash = page.locator("[role=status][aria-label=Drivex]");
    return { ctx, page, splash, errors, shown: async (ms) => { await page.waitForTimeout(ms); return (await splash.count()) > 0; } };
  }
  {
    const c = await splashCase({});
    ok("splash shows on first open", await c.shown(500));
    ok("splash has the full animation (road lines, icon, plain-text name)", (await c.page.locator("[role=status] img").count()) === 1 && (await c.page.locator("[role=status] p", { hasText: /^Drivex$/ }).count()) === 1);
    ok("splash leaves by itself", !(await c.shown(3000)));
    await c.page.reload({ waitUntil: "domcontentloaded" });
    ok("not shown again in the same session", !(await c.shown(300)));
    ok("no page errors (splash)", c.errors.length === 0, c.errors.join(" | "));
    await c.ctx.close();
  }
  {
    const c = await splashCase({ reducedMotion: "reduce" });
    ok("reduced motion: quiet splash (single icon, no wipe)", (await c.shown(200)) && (await c.page.locator("[role=status] img").count()) === 1);
    ok("reduced motion: leaves quickly", !(await c.shown(1500)));
    await c.ctx.close();
  }
  {
    const c = await splashCase({}, true);
    ok("slow data: splash waits for it", await c.shown(3500));
    ok("slow data: gives up after 5 s and shows the app", !(await c.shown(3000)));
    await c.ctx.close();
  }
}

// 10. Opening Support never scrolls the page, even with an earlier conversation saved (it used to jump to the bottom).
{
  for (const [label, vp] of [["phone", { width: 390, height: 700 }], ["desktop", { width: 1366, height: 700 }]]) {
    const { ctx, page, errors } = await fresh(vp);
    const chat = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "Message number " + i + " with a few more words so it takes some room" }));
    await page.addInitScript((c) => { try { sessionStorage.setItem("drivex.support.chat", JSON.stringify(c)); } catch { /* ignore */ } }, chat);
    await page.goto(BASE + "/support", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
    ok(`${label}: Support opens at the top`, (await page.evaluate(() => window.scrollY)) === 0, String(await page.evaluate(() => window.scrollY)));
    await page.locator("form input").fill("hello"); await page.locator("form button").click(); await page.waitForTimeout(1200);
    ok(`${label}: a new message still scrolls to the end`, (await page.evaluate(() => window.scrollY)) > 0 || label === "desktop");
    ok(`no console errors (support scroll, ${label})`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}

// 11. Legal pages: open without signing in, translate, and the deletion request form.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await mock(ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem("drivex.lang", "en"); sessionStorage.setItem("drivex.splash", "1"); localStorage.setItem("drivex.onboarded", "1"); } catch { /* ignore */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 150)));
  for (const [path, h1, marker] of [["/terms", "Terms & conditions", "Your rental agreement"], ["/privacy", "Privacy policy", "What we collect"], ["/delete-account", "Delete my account", "What we may have to keep"]]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
    ok(`signed out: ${path} opens without sign-in`, (await page.locator("h1").first().textContent()) === h1 && (await page.getByText(marker).count()) >= 1);
  }
  await page.goto(BASE + "/privacy", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "العربية" }).click(); await page.waitForTimeout(500);
  ok("privacy policy switches to Arabic (RTL)", (await page.locator("h1").first().textContent()) === "سياسة الخصوصية" && (await page.evaluate(() => document.documentElement.dir)) === "rtl");
  await page.screenshot({ path: OUT + "/i-legal-ar.png" });
  await page.getByRole("button", { name: "English" }).click();
  await page.goto(BASE + "/delete-account", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Send by email" }).click();
  ok("form asks for name and phone first", (await page.getByRole("alert").textContent()) === "Please enter your name and mobile number.");
  await page.getByLabel("Full name").fill("Emma Collins"); await page.getByLabel("Mobile number").fill("+971501234567");
  await page.getByRole("button", { name: "Send by WhatsApp" }).click();
  ok("form asks to confirm before sending", (await page.getByRole("alert").textContent()) === "Please confirm that you understand.");
  await page.getByLabel(/I understand/).check();
  await ctx.route(/wa\.me|whatsapp\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "ok" })); // the check is about the link we open, not about WhatsApp being reachable
  const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 4000 }).catch(() => null), page.getByRole("button", { name: "Send by WhatsApp" }).click()]);
  const url = popup ? popup.url() : "";
  const said = popup ? (new URL(url).searchParams.get("text") || "") : "";
  ok("WhatsApp opens with the request filled in", /whatsapp\.com|wa\.me/.test(url) && said.includes("Emma Collins") && said.includes("+971501234567"), url.slice(0, 120));
  ok("no page errors (legal)", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: OUT + "/i-legal-delete.png" });
  await ctx.close();
}

// 9. Client tasks: no zoom, grouped phone number, coloured name, booked cars on Home, clickable booking cards with days left, email warning, new prices.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  const vp = await page.locator("meta[name=viewport]").getAttribute("content");
  ok("pinch zoom stays available (no zoom lock in the viewport)", !/user-scalable|maximum-scale/.test(vp || ""), vp || "");
  ok("double-tap zoom is off", (await page.evaluate(() => getComputedStyle(document.body).touchAction)) === "manipulation");
  ok("first name in the greeting uses the brand colour", (await page.locator("h1 span.text-brand").first().textContent()) === "Test");
  const booked = page.getByTestId("booked-cars");
  ok("Home lists the booked cars (overdue, ongoing, upcoming)", (await booked.locator(":scope > div").count()) === 3, String(await booked.locator(":scope > div").count()));
  const bt = await booked.innerText();
  ok("Home cards show days left and days until pickup", /25 days overdue/.test(bt) && /3 days left/.test(bt) && /Starts in 10 days/.test(bt), bt.split("\n").join(" | "));
  await page.screenshot({ path: OUT + "/i-home-booked.png" });
  await booked.getByText("Mercedes G63").click(); await page.waitForTimeout(600);
  ok("a booked car card opens its booking", new URL(page.url()).pathname === "/bookings/r1", page.url());

  await page.goto(BASE + "/bookings", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  ok("booking cards show days left", (await page.getByText("3 days left").count()) >= 1);
  await page.screenshot({ path: OUT + "/i-bookings-days.png" });
  await page.getByText("Mercedes G63").first().click(); await page.waitForTimeout(600);
  ok("tapping anywhere on a booking card opens the details", new URL(page.url()).pathname === "/bookings/r1", page.url());
  const hist = await page.evaluate(() => history.length);
  await page.goto(BASE + "/bookings", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.locator("div.rounded-card", { hasText: "Mercedes G63" }).getByRole("button", { name: /^Invoice$/ }).first().click(); await page.waitForTimeout(600);
  ok("the Invoice button on a card goes to the invoice, not twice", page.url().endsWith("/bookings/r1#invoice"), page.url());

  T.customers[0].email = null; // the warning only shows without an email
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  ok("profile warns when there is no email", (await page.getByText("Add your email").count()) === 1);
  await page.screenshot({ path: OUT + "/i-profile-email.png" });
  await page.getByText("Add your email").click(); await page.waitForTimeout(600);
  ok("the warning opens the edit page", new URL(page.url()).pathname === "/profile/edit");
  ok("the email field no longer says (optional)", (await page.getByText("(optional)").count()) === 0 && (await page.getByText("Email", { exact: true }).count()) === 1);
  ok("mobile number is shown in groups", (await page.locator("input[disabled]").inputValue()) === "(+971) 50 123 4567");
  T.customers[0].email = "test.customer@example.com";
  ok("no console errors (client tasks)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 10. Prices on the reserve and checkout pages: insurance in percent, driver per day / per month, deposit choice.
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  const total = async () => (await page.locator(".fixed.inset-x-0.bottom-0 .text-2xl").innerText()).replace(/\D/g, "");
  await page.goto(BASE + "/book/mercedes-g63?period=monthly", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  ok("monthly: rental 16,500 less the 15% offer = 14,025, plus insurance 15% = 16,129", (await total()) === "16129", await total());
  ok("insurance is called Full coverage insurance and shows its percentage", (await page.getByText("Full coverage insurance").count()) === 1 && (await page.getByText("15% of the rental").count()) === 1);
  ok("driver shows the monthly price on a monthly plan", (await page.getByText(/300 \/ month/).count()) === 1);
  await page.getByText("Additional driver").click(); await page.waitForTimeout(200);
  ok("monthly: additional driver adds a flat 300", (await total()) === "16429", await total());
  await page.getByText("Pay once. Nothing is blocked on your card.").click(); await page.waitForTimeout(200);
  ok("no deposit adds a flat 200", (await total()) === "16629", await total());
  await page.screenshot({ path: OUT + "/i-reserve-extras.png", fullPage: true });
  await page.getByRole("button", { name: /Continue/ }).click(); await page.waitForTimeout(800);
  const co = await page.locator("main, body").first().innerText();
  ok("checkout lists insurance, driver and no-deposit rows with the total", /Full coverage insurance/.test(co) && /Additional driver/.test(co) && /No deposit/.test(co) && /16,629/.test(co));
  ok("checkout says no deposit is blocked", /No deposit is blocked on your card/.test(co) && !/refundable security deposit/.test(co));
  await page.screenshot({ path: OUT + "/i-checkout-nodeposit.png", fullPage: true });
  ok("Pay stays disabled until the terms are accepted", await page.getByRole("button", { name: /^Pay/ }).isDisabled());
  await page.getByRole("checkbox").check();
  ok("accepting the terms enables Pay", await page.getByRole("button", { name: /^Pay/ }).isEnabled());
  await page.goto(BASE + "/book/mercedes-g63?period=daily", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  ok("daily: 3 x 750 less 15% = 1,913, plus insurance 15% = 2,200", (await total()) === "2200", await total());
  ok("driver shows the daily price on a daily plan", (await page.getByText(/25 \/ day/).count()) === 1);
  await page.getByText("Additional driver").click(); await page.waitForTimeout(200);
  ok("daily: additional driver is 25 x 3 days", (await total()) === "2275", await total());
  await page.getByRole("button", { name: /Continue/ }).click(); await page.waitForTimeout(800);
  ok("checkout keeps the refundable 1,000 deposit by default", /refundable security deposit/.test(await page.locator("body").innerText()) && /1,000/.test(await page.locator("body").innerText()));
  ok("no console errors (prices)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 11. Documents are needed before booking (the profile warns, the reserve page stops and points to Documents).
{
  const keep = T.customer_documents; T.customer_documents = [];
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  ok("profile warns that documents are missing", (await page.getByText("Upload your documents").count()) === 1);
  await page.screenshot({ path: OUT + "/i-profile-docs.png" });
  await page.getByText("Upload your documents").click(); await page.waitForTimeout(500);
  ok("the warning opens Documents", new URL(page.url()).pathname === "/profile/documents");
  await page.goto(BASE + "/book/mercedes-g63?period=daily", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Continue/ }).click(); await page.waitForTimeout(500);
  const alert = await page.getByRole("alert").first().innerText().catch(() => "");
  ok("Continue stops with an error naming the missing documents", /update your documents first/i.test(alert) && /Emirates ID or passport/.test(alert) && /Driving licence/.test(alert), alert);
  ok("and stays on the reserve page", /\/book\/mercedes-g63/.test(page.url()), page.url());
  await page.screenshot({ path: OUT + "/i-reserve-docs.png" });
  await page.getByRole("button", { name: "Update documents" }).click(); await page.waitForTimeout(500);
  ok("Update documents goes to the Documents page", new URL(page.url()).pathname === "/profile/documents");
  ok("no console errors (documents rule)", errors.length === 0, errors.join(" | "));
  await ctx.close();
  // one rejected file counts as missing
  T.customer_documents = [{ id: "d1", document_type: "id_card", file_name: "id.jpg", verification_status: "rejected", created_at: new Date().toISOString() }, { id: "d2", document_type: "driving_license", file_name: "l.jpg", verification_status: "approved", created_at: new Date().toISOString() }];
  const c2 = await fresh({ width: 390, height: 844 });
  await c2.page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await c2.page.waitForTimeout(600);
  const warn = await c2.page.getByText(/You need these before you can book/).innerText().catch(() => "");
  ok("a rejected ID is listed as missing, the approved licence is not", /Emirates ID or passport/.test(warn) && !/Driving licence/.test(warn), warn);
  await c2.ctx.close();
  T.customer_documents = keep;
  const c3 = await fresh({ width: 390, height: 844 });
  await c3.page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await c3.page.waitForTimeout(600);
  ok("with both documents there is no warning", (await c3.page.getByText("Upload your documents").count()) === 0);
  await c3.ctx.close();
}

console.log(results.map((r) => (r.pass ? "PASS  " : "FAIL  ") + r.name + (r.pass ? "" : "   -> " + r.extra)).join("\n"));
console.log(results.filter((r) => r.pass).length + "/" + results.length + " passed");
await browser.close();
