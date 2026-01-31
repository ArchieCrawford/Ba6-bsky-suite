import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ba6: {
          bg: "#050507",
          panel: "#0B0B10",
          border: "#1A1A23",
          text: "#E9E9F2",
          muted: "#A3A3B2",
          accent: "#9B87F5",
          accent2: "#67E8F9"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(155,135,245,0.35), 0 0 24px rgba(155,135,245,0.22)",
        glow2: "0 0 0 1px rgba(103,232,249,0.35), 0 0 24px rgba(103,232,249,0.22)"
      }
    }
  },
  plugins: []
};

export default config;
