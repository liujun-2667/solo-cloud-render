/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          950: "#05070d",
          900: "#0a0e1a",
          800: "#101626",
          700: "#1a2236",
          600: "#26304a",
          500: "#3a4666",
        },
        sky: {
          glow: "#4fc3f7",
          deep: "#1e88e5",
        },
        amber: {
          glow: "#ff8a3d",
          ember: "#ff5e3a",
        },
        cloud: {
          DEFAULT: "#e8f0ff",
          dim: "#9fb3d4",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
        sans: ['"Noto Sans SC"', '"Space Grotesk"', "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(79,195,247,0.45)",
        ember: "0 0 24px -4px rgba(255,138,61,0.45)",
        panel: "0 8px 40px -8px rgba(0,0,0,0.6)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
