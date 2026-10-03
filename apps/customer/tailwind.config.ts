import type { Config } from "tailwindcss";

// Tokens taken from Zakeri's 5 master screens.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1f4d2f", dark: "#173a24", soft: "#e8f0ea" },
        bg: "#f6f5f2",
        ink: { DEFAULT: "#141414", muted: "#6b6b6b", faint: "#a3a3a3" },
        line: "#ecebe7",
        danger: { DEFAULT: "#d93025", soft: "#fdeeee" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgba(20,20,20,.04)" },
    },
  },
} satisfies Config;
