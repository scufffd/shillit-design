import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        shill: {
          brand: "#FF6B35",
          dark: "#0a0a0f",
          darker: "#050508",
          accent: "#00d9ff",
          pink: "#ff2d92",
          green: "#00ff88",
          blue: "#3b82f6",
          yellow: "#facc15",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "system-ui", "sans-serif"],
      },
      animation: {
        "ripple": "ripple 2s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "marquee": "marquee 30s linear infinite",
        "marquee-slow": "marquee 45s linear infinite",
      },
      keyframes: {
        ripple: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0", transform: "scale(1.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      backgroundImage: {
        "logo-grid": "radial-gradient(circle at center, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "48px 48px",
      },
    },
  },
  plugins: [],
};
export default config;
