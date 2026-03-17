import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        shill: {
          bg: "#0A0A0A",
          surface: "#111111",
          card: "#161616",
          border: "#222222",
          lime: "#BFFF00",
          cyan: "#00F0FF",
          dark: "#0A0A0A",
          darker: "#060606",
          yellow: "#BFFF00",
          green: "#BFFF00",
          blue: "#00F0FF",
          pink: "#FF3FBE",
          text: "#FAFAFA",
          muted: "#888888",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "system-ui", "sans-serif"],
        sans: ["var(--font-display)", "Space Grotesk", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "hard": "4px 4px 0px 0px #0A0A0A",
        "hard-lime": "4px 4px 0px 0px rgba(191,255,0,0.8)",
        "hard-cyan": "4px 4px 0px 0px rgba(0,240,255,0.8)",
        "glow-lime": "0 0 30px 0px rgba(191,255,0,0.35)",
        "glow-cyan": "0 0 30px 0px rgba(0,240,255,0.5)",
      },
      animation: {
        "marquee": "marquee 25s linear infinite",
        "marquee-slow": "marquee 45s linear infinite",
        "float": "float 4s ease-in-out infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
