/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg:      "#020408",
          card:    "#060c14",
          border:  "#0f1f33",
          muted:   "#0a1628",
          accent:  "#00f5ff",
          buy:     "#00ff88",
          sell:    "#ff0a3c",
          hold:    "#ffcc00",
          text:    "#e2f0ff",
          dim:     "#4a6080",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 1.5s ease-in-out infinite",
        "ticker":     "ticker 40s linear infinite",
        "fade-in":    "fade-in 0.4s ease-out",
        "slide-up":   "slide-up 0.3s ease-out",
        "flicker":    "flicker 3s step-end infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", filter: "brightness(1.2)" },
          "50%":       { opacity: "0.6", filter: "brightness(0.8)" },
        },
        "ticker": {
          "0%":   { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "flicker": {
          "0%, 95%, 100%": { opacity: "1" },
          "96%":            { opacity: "0.4" },
        },
      },
      boxShadow: {
        "buy-glow":  "0 0 12px rgba(0, 255, 136, 0.3)",
        "sell-glow": "0 0 12px rgba(255, 10, 60, 0.3)",
        "accent-glow": "0 0 16px rgba(0, 245, 255, 0.2)",
      },
    },
  },
  plugins: [],
};
