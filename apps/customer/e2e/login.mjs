import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:9291";
const OUT = "e2e/.out";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [];

for (const [vpName, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 850 }]]) {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["green", "navy"]) {
      const ctx = await browser.newContext({ viewport });
      await ctx.addInitScript(([l]) => { try { localStorage.setItem("drivex.lang", l); } catch {} }, [lang]);
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
      await page.goto(`${BASE}/?theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2800); // splash
      const info = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, theme: document.documentElement.dataset.theme, h1: document.querySelector("h1")?.textContent, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
      await page.screenshot({ path: `${OUT}/login-${vpName}-${lang}-${theme}.png` });
      results.push({ vpName, lang, theme, ...info, errors: errors.slice(0, 3) });
      await ctx.close();
    }
  }
}

// Phone validation (en, mobile): invalid Iranian number disables the button and shows the hint; a valid UAE number enables it.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2800);
const input = page.locator('input[inputmode="tel"]');
const btn = page.getByRole("button", { name: /send code/i });
await input.fill("09121234567");
const bad = { disabled: await btn.isDisabled(), hint: await page.getByText(/UAE mobile number/).count() };
await input.fill("۵۰ ۱۲۳ ۴۵۶۷"); // Persian digits
const persian = { disabled: await btn.isDisabled(), hint: await page.getByText(/UAE mobile number/).count() };
await input.fill("50 123 4567");
const good = { disabled: await btn.isDisabled(), hint: await page.getByText(/UAE mobile number/).count() };
await page.screenshot({ path: `${OUT}/login-valid-phone.png` });
console.log(JSON.stringify({ results, phone: { bad, persian, good } }, null, 1));
await browser.close();
