export type Theme = "green" | "navy";
export const THEMES: { value: Theme; label: string }[] = [{ value: "green", label: "Green" }, { value: "navy", label: "Navy" }];

const KEY = "drivex.theme";
const BG: Record<Theme, string> = { green: "#f6f5f2", navy: "#f5f6f9" };
const isTheme = (v: unknown): v is Theme => v === "green" || v === "navy";

export function getTheme(): Theme {
  const v = document.documentElement.dataset.theme;
  return isTheme(v) ? v : "green";
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BG[t]);
  try { localStorage.setItem(KEY, t); } catch { /* private mode: theme just won't persist */ }
}

/** Runs before first render. `?theme=navy` in the URL wins (handy for demos), then the saved choice. */
export function initTheme() {
  let t: unknown;
  try { t = new URLSearchParams(location.search).get("theme") ?? localStorage.getItem(KEY); } catch { /* ignore */ }
  setTheme(isTheme(t) ? t : "green");
}
