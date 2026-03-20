import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        shill: {
          bg: "#1d1d1d",
          card: "#1a1a1a",
          surface: "#212121",
          line: "#2a2a2a",
          accent: "#bdfe00",
          "accent-dark": "#a8e600",
          text: "#e0dfe3",
          muted: "#666666",
          dim: "#444444",
          dark: "#1d1d1d",
          darker: "#141414",
          yellow: "#bdfe00",
          green: "#bdfe00",
          lime: "#bdfe00",
          blue: "#3b82f6",
          cyan: "#00F0FF",
          purple: "#a855f7",
          pink: "#FF3FBE",
        },
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "Orbitron", "system-ui", "sans-serif"],
        mono: ["var(--font-space-mono)", "Space Mono", "monospace"],
        sans: ["var(--font-space-mono)", "Space Mono", "system-ui", "monospace"],
      },
      boxShadow: {
        "glow-accent": "0 0 20px 0px rgba(189,254,0,0.3)",
        "glow-accent-lg": "0 0 40px 0px rgba(189,254,0,0.2)",
        "glow-blue": "0 0 20px 0px rgba(59,130,246,0.3)",
      },
      animation: {
        "marquee": "marquee 30s linear infinite",
        "blink": "blink 1s step-end infinite",
        "block-blink": "blockBlink 1.2s ease-in-out infinite",
        "scan": "scan 3s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        blockBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.15" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
