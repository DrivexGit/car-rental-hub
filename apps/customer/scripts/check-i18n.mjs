// QA for translations: every t("...") key used in src/ must exist in the Arabic dictionary,
// placeholders must match, and dictionary keys nobody uses are reported.
// Run from apps/customer: node scripts/check-i18n.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk("src").filter((f) => /\.tsx?$/.test(f) && !f.includes("locales") && !f.endsWith("i18n.tsx"));

// t("key") / t('key'): the key is the first string argument.
const CALL = /(?<![\w.])t\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
const unescape = (s) => s.replace(/\\(["'\\])/g, "$1");

const used = new Map();
for (const f of src) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(CALL)) used.set(unescape(m[1] ?? m[2]), f);
  if (/(?<![\w.])t\(\s*`/.test(text)) console.log(`WARN ${f}: t(\`template\`) cannot be extracted, use a {placeholder} key`);
}

const dict = {};
for (const f of readdirSync("src/locales/ar").filter((x) => x !== "index.ts")) {
  const body = readFileSync(join("src/locales/ar", f), "utf8");
  const obj = new Function("return " + body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1))();
  for (const k of Object.keys(obj)) { if (k in dict && dict[k] !== obj[k]) console.log(`CONFLICT ${JSON.stringify(k)}: two different translations (${f})`); dict[k] = obj[k]; }
}

const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
const missing = [...used.keys()].filter((k) => !(k in dict));
const unused = Object.keys(dict).filter((k) => !used.has(k));
const badVars = Object.keys(dict).filter((k) => placeholders(k) !== placeholders(dict[k]));
const empty = Object.keys(dict).filter((k) => !dict[k].trim());
console.log(`keys used: ${used.size} · translated: ${Object.keys(dict).length}`);
for (const k of missing) console.log(`MISSING  ${JSON.stringify(k)}  (${used.get(k)})`);
for (const k of badVars) console.log(`PLACEHOLDER MISMATCH  ${JSON.stringify(k)}`);
for (const k of empty) console.log(`EMPTY  ${JSON.stringify(k)}`);
for (const k of unused) console.log(`unused   ${JSON.stringify(k)}`);
process.exit(missing.length || badVars.length || empty.length ? 1 : 0);
