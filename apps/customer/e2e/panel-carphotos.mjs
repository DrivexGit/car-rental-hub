// QA for the panel's Car photos page (src/pages/CarPhotos.tsx) with a fully mocked Supabase. Nothing real is read or written.
// Needs the PANEL dev server pointed at a fake backend:
//   (repo root)  VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=anon npx vite --host 127.0.0.1 --port 9390
//   (apps/customer)  PANEL=http://127.0.0.1:9390 node e2e/panel-carphotos.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { OUT, chromePath } from "./lib.mjs";
import { deflateSync } from "node:zlib";

const PANEL = process.env.PANEL || "http://127.0.0.1:9390";
mkdirSync(OUT, { recursive: true });

function png(w = 32, h = 32) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let r = 0xffffffff; for (const x of b) r = table[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const UID = "22222222-2222-4222-8222-222222222222";
const SESSION = JSON.stringify({ access_token: "mock.jwt.token", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "r", user: { id: UID, aud: "authenticated", role: "authenticated", email: "staff@drivex.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
const PUB = "https://fake.supabase.co/storage/v1/object/public/vehicle-images/";

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra });
const browser = await chromium.launch({ executablePath: chromePath(), headless: true });

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const state = {
    specs: [
      { tenant_id: "t", make: "Citroen", model: "C3", image_url: null, gallery: [] },
      { tenant_id: "t", make: "Mercedes", model: "G63", image_url: PUB + "models/mercedes-g63/studio-old.png", gallery: [PUB + "models/mercedes-g63/gallery/a.png", PUB + "models/mercedes-g63/gallery/b.png"] },
    ],
    uploads: [], patches: [],
  };
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    if (u.pathname.startsWith("/storage/v1/object/vehicle-images/")) {
      state.uploads.push({ path: decodeURIComponent(u.pathname.replace("/storage/v1/object/vehicle-images/", "")), type: req.headers()["content-type"] || "" });
      return json({ Key: "ok" });
    }
    if (u.pathname.startsWith("/rest/v1/")) {
      const table = u.pathname.split("/").pop();
      const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
      if (table === "staff_profiles") return json({ id: UID, full_name: "Staff", role: "admin", tenant_id: "t" });
      if (table === "vehicle_model_specs" && req.method() === "PATCH") {
        const patch = req.postDataJSON(); state.patches.push(patch);
        const q = Object.fromEntries(u.searchParams); const make = q.make?.replace("eq.", ""), model = q.model?.replace("eq.", "");
        state.specs = state.specs.map((s) => (s.make === make && s.model === model ? { ...s, ...patch } : s));
        return route.fulfill({ status: 204, headers: cors });
      }
      if (table === "vehicle_model_specs") return json(state.specs);
      return json(single ? null : []);
    }
    return json({});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem("sb-fake-auth-token", s); } catch { /* ignore */ } }, SESSION);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|fetchProfile|net::ERR/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
  await page.goto(PANEL + "/car-photos", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Car photos" }).waitFor({ timeout: 15000 });
  return { ctx, page, state, errors };
}
const card = (page, name) => page.locator("div.rounded-lg, div[class*='rounded-xl']").filter({ has: page.getByText(name, { exact: true }) }).last();
const chooseFiles = async (page, button, files) => { const [fc] = await Promise.all([page.waitForEvent("filechooser"), button.click()]); await fc.setFiles(files); await page.waitForTimeout(700); };

// 1. Desktop flows
{
  const { ctx, page, state, errors } = await open();
  ok("lists both models", (await page.getByText("Citroen C3").count()) === 1 && (await page.getByText("Mercedes G63").count()) === 1);
  await page.screenshot({ path: OUT + "/p-carphotos.png" });

  const c3 = card(page, "Citroen C3");
  await chooseFiles(page, c3.getByRole("button", { name: "Upload" }), { name: "c3.png", mimeType: "image/png", buffer: png() });
  ok("studio upload goes to models/<slug>/studio-*", state.uploads.length === 1 && /^models\/citroen-c3\/studio-.+\.png$/.test(state.uploads[0].path), JSON.stringify(state.uploads));
  ok("studio upload saves a public url on the model", state.patches.length === 1 && state.patches[0].image_url?.startsWith(PUB + "models/citroen-c3/studio-"), JSON.stringify(state.patches));
  ok("success message is shown", (await page.getByText("Saved").count()) >= 1);
  ok("preview now shows the photo and the button says Replace", (await c3.locator("img").count()) >= 1 && (await c3.getByRole("button", { name: "Replace" }).count()) === 1);

  state.uploads.length = 0; state.patches.length = 0;
  await chooseFiles(page, c3.getByRole("button", { name: "Replace" }), { name: "IMG_1.HEIC", mimeType: "image/heic", buffer: Buffer.from("x") });
  ok("HEIC is refused with a clear message and nothing is uploaded", state.uploads.length === 0 && state.patches.length === 0 && (await page.getByText(/HEIC photos are not supported/).count()) >= 1);

  await chooseFiles(page, c3.getByRole("button", { name: "Replace" }), { name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(9 * 1024 * 1024, 1) });
  ok("file over 8 MB is refused", state.uploads.length === 0 && (await page.getByText(/larger than 8 MB/).count()) >= 1);

  const g63 = card(page, "Mercedes G63");
  await chooseFiles(page, g63.getByRole("button", { name: "Add gallery photos" }), [{ name: "1.png", mimeType: "image/png", buffer: png() }, { name: "2.png", mimeType: "image/png", buffer: png(40, 40) }]);
  ok("two gallery photos upload under gallery/", state.uploads.length === 2 && state.uploads.every((u) => /^models\/mercedes-g63\/gallery\/.+\.png$/.test(u.path)), JSON.stringify(state.uploads));
  ok("gallery keeps the old photos and appends the new ones", state.patches.length === 1 && state.patches[0].gallery?.length === 4 && state.patches[0].gallery[0].endsWith("/a.png"), JSON.stringify(state.patches));
  ok("count text updated", (await g63.getByText("4 gallery photos").count()) === 1);

  state.patches.length = 0;
  page.once("dialog", (d) => d.dismiss());
  await g63.locator("img[loading='lazy']").first().hover();
  await g63.getByRole("button", { name: "Remove photo" }).first().click({ force: true }); await page.waitForTimeout(400);
  ok("cancelling the confirmation removes nothing", state.patches.length === 0);
  page.once("dialog", (d) => d.accept());
  await g63.locator("img[loading='lazy']").first().hover();
  await g63.getByRole("button", { name: "Remove photo" }).first().click(); await page.waitForTimeout(600);
  ok("removing a gallery photo saves the list without it", state.patches.length === 1 && state.patches[0].gallery.length === 3 && !state.patches[0].gallery.some((x) => x.endsWith("/a.png")), JSON.stringify(state.patches));

  state.patches.length = 0;
  page.once("dialog", (d) => d.accept());
  await g63.getByRole("button", { name: "Remove", exact: true }).click(); await page.waitForTimeout(600);
  ok("removing the studio photo sets image_url to null", state.patches.length === 1 && state.patches[0].image_url === null && (await g63.getByText("No studio photo").count()) === 1, JSON.stringify(state.patches));

  await page.getByPlaceholder("Search model").fill("c3"); await page.waitForTimeout(200);
  ok("search filters the list", (await page.getByText("Mercedes G63").count()) === 0 && (await page.getByText("Citroen C3").count()) === 1);
  ok("no console errors (desktop)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 2. Touch device: the remove button must be visible without hovering (a tablet has no hover)
{
  const { ctx, page, errors } = await open({ viewport: { width: 820, height: 1100 }, hasTouch: true, isMobile: true });
  const g63 = card(page, "Mercedes G63");
  const btn = g63.getByRole("button", { name: "Remove photo" }).first();
  ok("touch: remove button is visible without hover", await btn.isVisible());
  await page.screenshot({ path: OUT + "/p-carphotos-touch.png" });
  ok("no console errors (touch)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

console.log(results.map((r) => (r.pass ? "PASS  " : "FAIL  ") + r.name + (r.pass ? "" : "   -> " + r.extra)).join("\n"));
console.log(results.filter((r) => r.pass).length + "/" + results.length + " passed");
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
