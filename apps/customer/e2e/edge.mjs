// Edge cases for the client tasks: no sideways scroll at 3 widths in EN/AR, email warning, keyboard on cards, weekly/monthly prices, invoice PDF with an Arabic name.
// Needs the app on BASE (dev server or vite preview). Run from apps/customer: node e2e/edge.mjs
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { BASE, OUT, SESSION, T, mock, chromePath } from "./lib.mjs";
const b = await chromium.launch({ executablePath: chromePath(), headless: true });
const res = []; const ok = (n, p, x = "") => res.push([p, n, x]);
async function fresh(vp, lang = "en") {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true }); await mock(ctx);
  await ctx.addInitScript(([s, l]) => { localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.lang", l); sessionStorage.setItem("drivex.splash","1"); localStorage.setItem("drivex.onboarded","1"); localStorage.setItem("drivex.push.asked","1"); }, [SESSION, lang]);
  const page = await ctx.newPage(); const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 150)); });
  page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 150)));
  return { ctx, page, errors };
}
const total = async (p) => (await p.locator(".fixed.inset-x-0.bottom-0 .text-2xl").innerText()).replace(/\D/g, "");

// A. no horizontal overflow on changed pages: 3 widths x 2 languages
for (const [w, h] of [[360, 740], [768, 1024], [1440, 900]]) for (const lang of ["en", "ar"]) {
  const { ctx, page, errors } = await fresh({ width: w, height: h }, lang);
  for (const path of ["/", "/bookings", "/profile", "/profile/edit", "/book/mercedes-g63?period=monthly", "/bookings/r1"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`no sideways scroll ${w}px ${lang} ${path}`, o <= 0, "over by " + o);
  }
  ok(`no console errors ${w}px ${lang}`, errors.length === 0, errors.join("|"));
  await ctx.close();
}

// B. email present -> no warning
{ T.customers[0].email = "a@b.com";
  const { ctx, page } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  ok("with an email there is no warning", (await page.getByText("Add your email").count()) === 0);
  ok("profile shows the email", (await page.getByText("a@b.com").count()) >= 1);
  await ctx.close(); T.customers[0].email = "test.customer@example.com"; }

// C. keyboard: focus a booking card and press Enter
{ const { ctx, page } = await fresh({ width: 1200, height: 800 });
  await page.goto(BASE + "/bookings", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  const card = page.locator("div.rounded-card[tabindex='0']", { hasText: "Mercedes G63" }).first();
  await card.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  ok("Enter on a focused booking card opens it", new URL(page.url()).pathname === "/bookings/r1", page.url());
  await page.goto(BASE + "/bookings", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  const inv = page.getByRole("button", { name: /^Invoice$/ }).first(); await inv.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  ok("Enter on the Invoice button inside a card does not also open the card twice", /#invoice$/.test(page.url()), page.url());
  await ctx.close(); }

// D. prices: weekly, monthly x2, deposit toggled back
{ const { ctx, page } = await fresh({ width: 390, height: 844 });
  await page.goto(BASE + "/book/mercedes-g63?period=weekly", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  ok("weekly: 4500 less 15% = 3825, insurance 574 -> 4399", (await total(page)) === "4399", await total(page));
  await page.getByText("Additional driver").click(); await page.getByText("Child seat").click(); await page.waitForTimeout(200);
  ok("weekly: driver 25x7 + child seat 15x7 -> 4679", (await total(page)) === "4679", await total(page));
  await page.getByText("Pay once. Nothing is blocked on your card.").click(); await page.waitForTimeout(150);
  await page.getByText("Blocked on your card at pickup and released after the return.").click(); await page.waitForTimeout(150);
  ok("choosing the refundable deposit again removes the 200 fee", (await total(page)) === "4679", await total(page));
  await page.getByText("Full coverage insurance").click(); await page.waitForTimeout(150);
  ok("unticking insurance removes it -> 4105", (await total(page)) === "4105", await total(page));
  await page.goto(BASE + "/book/mercedes-g63?period=monthly", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByLabel("More").click(); await page.getByText("Additional driver").click(); await page.waitForTimeout(200);
  ok("2 months: 28,050 + insurance 4,208 + driver 600 -> 32858", (await total(page)) === "32858", await total(page));
  await ctx.close(); }

// E. invoice: Arabic customer name in the PDF, one click = one file, Arabic UI sheet
{ T.customers[0].full_name = "محمد أحمد";
  const { ctx, page, errors } = await fresh({ width: 390, height: 844 }, "ar");
  await page.goto(BASE + "/bookings/r1", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  let n = 0; page.on("download", () => n++);
  const btn = page.getByRole("button", { name: "تنزيل الفاتورة" }).first();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), (async () => { await btn.dblclick(); })()]);
  await dl.saveAs(OUT + "/invoice-ar.pdf"); await page.waitForTimeout(1500);
  ok("double click gives exactly one file", n === 1, String(n));
  ok("Arabic-name invoice is a PDF of sensible size", readFileSync(OUT + "/invoice-ar.pdf").length > 30000);
  await page.getByRole("button", { name: "عرض الفاتورة" }).first().click(); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "/x-invoice-ar.png" });
  ok("no console errors (Arabic invoice)", errors.length === 0, errors.join("|"));
  await ctx.close(); T.customers[0].full_name = "Test Customer"; }

// F. Another time zone (a customer in the USA): dates are UAE dates, so nothing may shift by a day.
for (const tz of ["America/Los_Angeles", "Pacific/Auckland"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: tz }); await mock(ctx);
  await ctx.addInitScript(([s]) => { localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.lang", "en"); sessionStorage.setItem("drivex.splash","1"); localStorage.setItem("drivex.onboarded","1"); localStorage.setItem("drivex.push.asked","1"); }, [SESSION]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/book/mercedes-g63?period=monthly&from=2026-10-16&to=2026-11-15", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  const t = await page.locator("body").innerText();
  ok(`${tz}: pickup shows the day that was chosen (16 Oct 2026)`, t.includes("16 Oct 2026"), t.slice(t.indexOf("Pickup date"), t.indexOf("Pickup date") + 60).split("\n").join(" "));
  ok(`${tz}: 1 month later is 15 Nov (30 days)`, /Return\s*15 Nov/.test(t), (t.match(/Return\s*\d+ \w+/) || [""])[0]);
  await page.goto(BASE + "/book/mercedes-g63?period=daily&from=2026-12-31&to=2027-01-02", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  const t2 = await page.locator("body").innerText();
  ok(`${tz}: across New Year (31 Dec + 2 days = 2 Jan)`, t2.includes("31 Dec 2026") && /Return\s*02 Jan|Return\s*2 Jan/.test(t2), (t2.match(/Return\s*\d+ \w+/) || [""])[0]);
  // a booking stored as 10:00 UAE time must show the UAE day
  const r1 = T.reservations[0]; const keep = [r1.start_datetime, r1.end_datetime];
  r1.start_datetime = "2026-10-16T06:00:00.000Z"; r1.end_datetime = "2026-10-19T06:00:00.000Z"; // 10:00 in the UAE
  await page.goto(BASE + "/bookings", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  const bt = await page.locator("body").innerText();
  ok(`${tz}: a booking made for 10:00 UAE time shows 16 Oct and 19 Oct`, bt.includes("16 Oct 2026") && bt.includes("19 Oct 2026"), (bt.match(/Pickup\s*\d+ \w+ \d+/) || [""])[0]);
  [r1.start_datetime, r1.end_datetime] = keep;
  await ctx.close();
}

// G. UAE time for the greeting and the days left, from a phone set to Los Angeles time.
{ const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/Los_Angeles" }); await mock(ctx);
  await ctx.addInitScript(([s]) => { localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.lang", "en"); sessionStorage.setItem("drivex.splash","1"); localStorage.setItem("drivex.onboarded","1"); localStorage.setItem("drivex.push.asked","1"); }, [SESSION]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-10-14T03:00:00Z")); // 07:00 on 14 Oct in the UAE, but 20:00 on 13 Oct in Los Angeles
  const r1 = T.reservations[0]; const keep = [r1.start_datetime, r1.end_datetime];
  r1.start_datetime = "2026-10-12T06:00:00.000Z"; r1.end_datetime = "2026-10-16T06:00:00.000Z"; // returns 16 Oct 10:00 UAE
  await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  ok("greeting follows the UAE hour (07:00 = morning, though it is evening in Los Angeles)", (await page.locator("h1").first().innerText()).startsWith("Good morning"), await page.locator("h1").first().innerText());
  ok("Home card: return on the 16th, today is the 14th in the UAE -> 2 days left", (await page.getByTestId("booked-cars").innerText()).includes("2 days left"), (await page.getByTestId("booked-cars").innerText()).replaceAll("\n", "|"));
  await page.goto(BASE + "/bookings/r1", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  ok("booking details count the same 2 days left", (await page.locator("body").innerText()).includes("2 days left"));
  [r1.start_datetime, r1.end_datetime] = keep; await ctx.close(); }

// H. On a touch phone inputs are 16px, so iPhones do not zoom the page when one gets focus.
{ const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await mock(ctx);
  await ctx.addInitScript(([s]) => { localStorage.setItem("drivex.customer.auth", s); localStorage.setItem("drivex.lang", "en"); sessionStorage.setItem("drivex.splash","1"); localStorage.setItem("drivex.onboarded","1"); localStorage.setItem("drivex.push.asked","1"); }, [SESSION]);
  const page = await ctx.newPage();
  const sizes = [];
  for (const path of ["/book", "/delete-account", "/profile/edit", "/support"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
    sizes.push(...await page.locator("input:not([type=file]):not([type=checkbox]):not([hidden]), textarea").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize))));
  }
  ok("every input and textarea is at least 16px on a touch phone", sizes.length >= 8 && sizes.every((s) => s >= 16), sizes.join(","));
  await ctx.close(); }

console.log(res.map(([p, n, x]) => (p ? "PASS  " : "FAIL  ") + n + (p ? "" : "  -> " + x)).join("\n"));
console.log(res.filter((r) => r[0]).length + "/" + res.length);
await b.close();
