/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        canvas: "#F6F8FB",
        background: "#F6F8FB",
        card: "#FFFFFF",
        ink: "#0B1524",
        muted: "#64748B",
        brand: {
          DEFAULT: "#3395FF",
          dark: "#1E6FE0",
          light: "#E8F1FE",
        },
        navy: {
          700: "#12213B",
          800: "#0D1830",
          900: "#0A1122",
        },
        indigo: { DEFAULT: "#6366F1" },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        // Per-agent accent colors.
        collect: "#3395FF",
        recon: "#10B981",
        oracle: "#8B5CF6",
        pulse: "#F59E0B",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 1px 3px 0 rgb(15 23 42 / 0.05), 0 12px 30px -14px rgb(15 23 42 / 0.14)",
        glow: "0 0 0 1px rgb(51 149 255 / 0.15), 0 8px 30px -6px rgb(51 149 255 / 0.35)",
        pop: "0 20px 60px -18px rgb(15 23 42 / 0.35)",
      },
      keyframes: {
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(51 149 255 / 0.5)" },
          "70%": { boxShadow: "0 0 0 7px rgb(51 149 255 / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(51 149 255 / 0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "pulse-ring": "pulse-ring 1.6s infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
