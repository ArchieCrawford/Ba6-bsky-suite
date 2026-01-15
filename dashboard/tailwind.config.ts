import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        canvas: "#F7F4EF",
        sand: "#EFE7DA",
        ember: "#E26D5A",
        moss: "#3A5A40",
        tide: "#2A9D8F"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(16, 24, 32, 0.08)",
        card: "0 12px 32px rgba(16, 24, 32, 0.12)"
      },
      borderRadius: {
        xl: "18px"
      }
    }
  },
  plugins: []
} satisfies Config;
