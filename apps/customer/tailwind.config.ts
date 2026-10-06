import type { Config } from "tailwindcss";

// Every colour is a CSS variable (RGB triplet) defined per theme in src/index.css,
// so a theme or brand colour change is one block there and `/opacity` modifiers keep working.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: token("brand"), dark: token("brand-dark"), soft: token("brand-soft") },
        bg: token("bg"),
        ink: { DEFAULT: token("ink"), muted: token("ink-muted"), faint: token("ink-faint") },
        line: token("line"),
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        warn: { DEFAULT: token("warn"), text: token("warn-text"), soft: token("warn-soft") },
        tint: token("tint"),
        muted: token("muted"),
        hero: token("hero"),
        night: token("night"),
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgb(var(--ink) / .04)", tabbar: "0 -6px 24px rgb(var(--ink) / .08)" },
    },
  },
} satisfies Config;
