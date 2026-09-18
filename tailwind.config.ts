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
      animation: {
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        marquee: "marquee var(--duration, 30s) linear infinite",
        "marquee-vertical": "marquee-vertical var(--duration, 30s) linear infinite",
        "float-slow": "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        "border-beam": {
          "100%": { "offset-distance": "100%" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap, 1rem)))" },
        },
        "marquee-vertical": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(calc(-100% - var(--gap, 1rem)))" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          from: { "background-position": "-200% 0" },
          to: { "background-position": "200% 0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
