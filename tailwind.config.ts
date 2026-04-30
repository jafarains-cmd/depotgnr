import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--brand)",
          deep: "var(--brand-deep)",
          soft: "var(--brand-soft)",
          // backwards-compat untuk class lama
          50: "var(--brand-soft)",
          100: "var(--brand-soft)",
          400: "var(--brand)",
          500: "var(--brand)",
          600: "var(--brand)",
          700: "var(--brand-deep)",
          800: "var(--brand-deep)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          alt: "var(--accent2)",
        },
        ink: "var(--ink)",
        mist: "var(--mist)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface2)",
        },
        line: "var(--line)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
} satisfies Config;
