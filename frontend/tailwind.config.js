/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        background: "#FAFAFA",
        card: "#FFFFFF",
        ink: "#0F172A",
        muted: "#64748B",
        brand: {
          DEFAULT: "#3B82F6",
          dark: "#2563EB",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        // Per-agent accent colors used across the activity feed / cards.
        collect: "#3B82F6",
        recon: "#10B981",
        oracle: "#8B5CF6",
        pulse: "#F59E0B",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 8px 24px -12px rgb(15 23 42 / 0.12)",
      },
      keyframes: {
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(59 130 246 / 0.5)" },
          "70%": { boxShadow: "0 0 0 6px rgb(59 130 246 / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(59 130 246 / 0)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "pulse-ring": "pulse-ring 1.5s infinite",
      },
    },
  },
  plugins: [],
};
