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
  await ctx.close(); T.customers[0].email = null; }

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

console.log(res.map(([p, n, x]) => (p ? "PASS  " : "FAIL  ") + n + (p ? "" : "  -> " + x)).join("\n"));
console.log(res.filter((r) => r[0]).length + "/" + res.length);
await b.close();
