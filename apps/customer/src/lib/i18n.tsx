import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import ar from "@/locales/ar";

// Strings are keyed by their English text: t("Pay now"). A missing translation falls back to the English key.
// Dynamic values use {name} placeholders: t("{n} days left", { n }).
export type Lang = "en" | "ar";
export const LANGS: { value: Lang; label: string }[] = [{ value: "en", label: "English" }, { value: "ar", label: "العربية" }];

const KEY = "drivex.lang";
const DICT: Record<Lang, Record<string, string>> = { en: {}, ar };
const isLang = (v: unknown): v is Lang => v === "en" || v === "ar";

let current: Lang = "en";
export const currentLang = () => current;
/** Locale for dates and numbers. Arabic keeps Latin digits, which is what UAE apps use. */
export const currentLocale = () => (current === "ar" ? "ar-AE-u-nu-latn" : "en-GB");

export function translate(key: string, vars?: Record<string, string | number>, lang: Lang = current): string {
  const text = DICT[lang][key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

function apply(lang: Lang) {
  current = lang;
  const el = document.documentElement;
  el.lang = lang;
  el.dir = lang === "ar" ? "rtl" : "ltr";
  try { localStorage.setItem(KEY, lang); } catch { /* private mode: the choice just won't persist */ }
}

/** Runs before first render so the page never flashes in the wrong direction. */
export function initLang() {
  let saved: unknown;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  apply(isLang(saved) ? saved : "en");
}

type Ctx = { lang: Lang; dir: "ltr" | "rtl"; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const I18n = createContext<Ctx>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const value = useMemo<Ctx>(() => ({
    lang, dir: lang === "ar" ? "rtl" : "ltr",
    setLang: (l) => { apply(l); setLangState(l); },
    t: (key, vars) => translate(key, vars, lang),
  }), [lang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
