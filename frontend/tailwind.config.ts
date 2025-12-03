import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Custom dark theme colors
        background: "#0a0a0f",
        foreground: "#fafafa",
        card: {
          DEFAULT: "#111118",
          hover: "#1a1a24",
        },
        primary: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
        },
        secondary: {
          DEFAULT: "#22c55e",
          hover: "#4ade80",
        },
        muted: {
          DEFAULT: "#71717a",
          foreground: "#a1a1aa",
        },
        border: "#27272a",
        // Log level colors
        log: {
          debug: "#6b7280",
          info: "#3b82f6",
          warn: "#f59e0b",
          error: "#ef4444",
          fatal: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
