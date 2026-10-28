// Copies the site's words into the iOS app, so the two never drift apart:
//   - the Arabic and Persian dictionaries (apps/customer/src/locales) -> strings-ar.json, strings-fa.json
//   - the Terms, Privacy and Delete-account texts (apps/customer/src/content/legal.ts) -> legal.json
// Run after changing any of them:  node apps/ios/scripts/sync-content.mjs
// Uses the esbuild that ships with the site's Vite (run npm install in apps/customer first).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, "../../customer");
const out = join(here, "../Drivex/Resources/Content");
const esbuild = createRequire(join(site, "package.json"))("esbuild");

/** Bundles one TypeScript module of the site and returns its exports. */
async function load(entry) {
  const r = await esbuild.build({ entryPoints: [join(site, entry)], bundle: true, format: "esm", platform: "neutral", write: false, alias: { "@": join(site, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
}

const write = (name, data) => {
  writeFileSync(join(out, name), JSON.stringify(data, null, 1) + "\n");
  console.log(`wrote ${name}`);
};

mkdirSync(out, { recursive: true });
for (const lang of ["ar", "fa"]) {
  const { default: dict } = await load(`src/locales/${lang}/index.ts`);
  write(`strings-${lang}.json`, Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b))));
}
const { LEGAL } = await load("src/content/legal.ts");
write("legal.json", LEGAL);
