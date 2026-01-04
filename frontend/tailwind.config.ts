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
        
        // Card colors
        card: {
          DEFAULT: "#111118",
          hover: "#1a1a24",
        },
        
        // Surface colors (for UI elements)
        surface: {
          DEFAULT: "#18181b",
          hover: "#27272a",
          active: "#3f3f46",
        },
        
        // Primary brand color (indigo)
        primary: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          light: "#a5b4fc",
          dark: "#4f46e5",
        },
        
        // Secondary (green)
        secondary: {
          DEFAULT: "#22c55e",
          hover: "#4ade80",
        },
        
        // Accent (purple/violet)
        accent: {
          DEFAULT: "#8b5cf6",
          hover: "#a78bfa",
          light: "#c4b5fd",
        },
        
        // Muted text
        muted: {
          DEFAULT: "#71717a",
          foreground: "#a1a1aa",
        },
        
        // Borders
        border: {
          DEFAULT: "#27272a",
          hover: "#3f3f46",
        },
        
        // Status colors
        success: {
          DEFAULT: "#22c55e",
          hover: "#16a34a",
          light: "#4ade80",
        },
        warning: {
          DEFAULT: "#f59e0b",
          hover: "#d97706",
          light: "#fbbf24",
        },
        error: {
          DEFAULT: "#ef4444",
          hover: "#dc2626",
          light: "#f87171",
        },
        info: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          light: "#60a5fa",
        },
        
        // Log level colors
        log: {
          debug: "#6b7280",
          info: "#3b82f6",
          warn: "#f59e0b",
          error: "#ef4444",
          fatal: "#dc2626",
        },
      },
      
      // Custom animations
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      
      // Custom box shadows
      boxShadow: {
        "glow-primary": "0 0 20px rgba(99, 102, 241, 0.3)",
        "glow-success": "0 0 20px rgba(34, 197, 94, 0.3)",
        "glow-error": "0 0 20px rgba(239, 68, 68, 0.3)",
        "glow-warning": "0 0 20px rgba(245, 158, 11, 0.3)",
      },
      
      // Background patterns
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-pattern": "linear-gradient(to right bottom, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))",
      },
    },
  },
  plugins: [],
};

export default config;
