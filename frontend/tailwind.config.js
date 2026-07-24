/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        canvas: "#F5F7FB",
        background: "#F5F7FB",
        card: "#FFFFFF",
        ink: "#0A1020",
        muted: "#64748B",
        brand: {
          DEFAULT: "#3395FF",
          dark: "#1E6FE0",
          light: "#E8F1FE",
          glow: "#5AA9FF",
        },
        navy: {
          700: "#12213B",
          800: "#0C1730",
          900: "#070E1F",
          950: "#040814",
        },
        indigo: { DEFAULT: "#6366F1" },
        violet: { DEFAULT: "#8B5CF6" },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
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
        card: "0 1px 2px 0 rgb(10 16 32 / 0.04), 0 10px 30px -14px rgb(10 16 32 / 0.16)",
        elevated: "0 2px 4px 0 rgb(10 16 32 / 0.05), 0 24px 48px -20px rgb(10 16 32 / 0.28)",
        glow: "0 0 0 1px rgb(51 149 255 / 0.18), 0 10px 34px -8px rgb(51 149 255 / 0.42)",
        "glow-lg": "0 0 0 1px rgb(51 149 255 / 0.22), 0 18px 60px -12px rgb(51 149 255 / 0.55)",
        pop: "0 24px 70px -20px rgb(10 16 32 / 0.4)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg,#3395FF 0%,#5A7BFF 55%,#6366F1 100%)",
        "navy-gradient": "linear-gradient(160deg,#0C1730 0%,#070E1F 100%)",
        "aurora": "radial-gradient(closest-side, rgba(51,149,255,0.35), transparent)",
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
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        "gradient-x": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "aurora-move": {
          "0%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(6%,-4%) scale(1.1)" },
          "66%": { transform: "translate(-4%,5%) scale(0.95)" },
          "100%": { transform: "translate(0,0) scale(1)" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "pulse-ring": "pulse-ring 1.6s infinite",
        float: "float 6s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "aurora-move": "aurora-move 18s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
